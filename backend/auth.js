"use strict";

const crypto = require("crypto");

const PHONE_RE = /^1[3-9]\d{9}$/;
const ACCOUNT_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const SESSION_COOKIE = "jzx_session";
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;
const CODE_TTL_MS = 5 * 60 * 1000;

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function normalizePhone(value) {
  const phone = String(value || "").replace(/\D/g, "");
  if (!PHONE_RE.test(phone)) throw httpError(400, "请输入有效的 11 位中国大陆手机号");
  return phone;
}

function normalizePassword(value) {
  const password = String(value || "");
  if (password.length < 6) throw httpError(400, "密码至少需要 6 位字符");
  if (password.length > 128) throw httpError(400, "密码不能超过 128 位字符");
  return password;
}

function scrypt(password, salt) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (error, key) => {
      if (error) reject(error);
      else resolve(key.toString("hex"));
    });
  });
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left || ""));
  const b = Buffer.from(String(right || ""));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function parseCookies(req) {
  const cookies = {};
  for (const part of String(req.headers.cookie || "").split(";")) {
    const index = part.indexOf("=");
    if (index < 0) continue;
    cookies[part.slice(0, index).trim()] = decodeURIComponent(part.slice(index + 1).trim());
  }
  return cookies;
}

class AuthService {
  constructor(store) {
    this.store = store;
    this.secret = process.env.AUTH_SESSION_SECRET || crypto.randomBytes(32).toString("hex");
    this.codes = new Map();
    this.demoCode = process.env.AUTH_DEMO_CODE !== "false" && process.env.NODE_ENV !== "production";
  }

  publicUser(user) {
    return {
      phone: user.phone,
      accountId: user.accountId,
      nickname: user.nickname,
      hasPassword: Boolean(user.passwordHash && user.passwordSalt),
      createdAt: user.createdAt || ""
    };
  }

  sign(user) {
    const payload = Buffer.from(JSON.stringify({
      accountId: user.accountId,
      phone: user.phone,
      exp: Date.now() + SESSION_TTL_SECONDS * 1000
    })).toString("base64url");
    const signature = crypto.createHmac("sha256", this.secret).update(payload).digest("base64url");
    return payload + "." + signature;
  }

  async userFromToken(token) {
    const [payload, signature] = String(token || "").split(".");
    if (!payload || !signature) return null;
    const expected = crypto.createHmac("sha256", this.secret).update(payload).digest("base64url");
    if (!safeEqual(signature, expected)) return null;
    try {
      const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
      if (!data.accountId || Number(data.exp) <= Date.now()) return null;
      return this.store.findUserByAccountId(data.accountId);
    } catch {
      return null;
    }
  }

  async currentUser(req) {
    return this.userFromToken(parseCookies(req)[SESSION_COOKIE]);
  }

  sessionCookie(user, req) {
    const secure = req.headers["x-forwarded-proto"] === "https" || req.socket.encrypted;
    return `${SESSION_COOKIE}=${encodeURIComponent(this.sign(user))}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_TTL_SECONDS}${secure ? "; Secure" : ""}`;
  }

  clearCookie() {
    return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
  }

  async requestCode(phoneValue) {
    const phone = normalizePhone(phoneValue);
    const prior = this.codes.get(phone);
    if (prior && Date.now() - prior.sentAt < 60_000) {
      throw httpError(429, "验证码发送过于频繁，请 60 秒后重试");
    }
    const code = String(crypto.randomInt(100000, 1000000));
    this.codes.set(phone, { code, sentAt: Date.now(), expiresAt: Date.now() + CODE_TTL_MS });
    return {
      code,
      expiresIn: Math.floor(CODE_TTL_MS / 1000),
      demo: this.demoCode
    };
  }

  async ensureUser(phone) {
    let user = await this.store.findUser(phone);
    if (user) return { user, created: false };
    let accountId;
    do {
      accountId = "JZX-" + Array.from(crypto.randomBytes(8), byte => ACCOUNT_ALPHABET[byte % ACCOUNT_ALPHABET.length]).join("");
    } while (await this.store.findUserByAccountId(accountId));
    user = await this.store.createUser({
      phone,
      accountId,
      nickname: "旅行者 " + phone.slice(-4),
      createdAt: new Date().toISOString()
    });
    return { user, created: true };
  }

  async loginByCode(phoneValue, codeValue) {
    const phone = normalizePhone(phoneValue);
    const stored = this.codes.get(phone);
    if (!stored || stored.expiresAt <= Date.now()) throw httpError(400, "验证码已失效，请重新获取");
    if (!safeEqual(String(codeValue || ""), stored.code)) throw httpError(400, "验证码不正确");
    this.codes.delete(phone);
    return this.ensureUser(phone);
  }

  async loginByPassword(phoneValue, passwordValue) {
    const phone = normalizePhone(phoneValue);
    const user = await this.store.findUser(phone);
    if (!user) throw httpError(404, "该手机号尚未注册，请先使用验证码登录");
    if (!user.passwordHash || !user.passwordSalt) throw httpError(400, "该账号尚未设置密码，请使用验证码登录");
    const hash = await scrypt(normalizePassword(passwordValue), user.passwordSalt);
    if (!safeEqual(hash, user.passwordHash)) throw httpError(401, "手机号或密码不正确");
    return { user, created: false };
  }

  async changePassword(user, currentPassword, newPassword) {
    if (user.passwordHash && user.passwordSalt) {
      const currentHash = await scrypt(String(currentPassword || ""), user.passwordSalt);
      if (!safeEqual(currentHash, user.passwordHash)) throw httpError(400, "当前密码不正确");
    }
    const password = normalizePassword(newPassword);
    const salt = crypto.randomBytes(16).toString("hex");
    const passwordHash = await scrypt(password, salt);
    await this.store.updateUserPassword(user.phone, passwordHash, salt);
    return this.store.findUser(user.phone);
  }
}

module.exports = { AuthService, parseCookies, SESSION_COOKIE };
