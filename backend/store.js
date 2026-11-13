"use strict";

const fs = require("fs");
const fsp = fs.promises;
const path = require("path");
const crypto = require("crypto");

class Store {
  constructor(root, databaseUrl) {
    this.databaseUrl = databaseUrl;
    this.dataDir = path.join(root, "data");
    this.usersFile = path.join(this.dataDir, "users.json");
    this.database = null;
    this.mode = "local-json";
    this.userQueue = Promise.resolve();
  }

  async init() {
    await fsp.mkdir(this.dataDir, { recursive: true });
    if (!this.databaseUrl) return;
    try {
      const url = new URL(this.databaseUrl);
      if (!["mysql:", "mysql2:"].includes(url.protocol)) throw new Error("unsupported database protocol");
      const mysql = await import("mysql2/promise");
      this.database = mysql.createPool({
        host: url.hostname,
        port: Number(url.port || 3306),
        user: decodeURIComponent(url.username),
        password: decodeURIComponent(url.password),
        database: decodeURIComponent(url.pathname.replace(/^\//, "")),
        charset: "utf8mb4",
        connectionLimit: 5,
        enableKeepAlive: true
      });
      await this.database.query(`
        CREATE TABLE IF NOT EXISTS conversation_messages (
          id BIGINT AUTO_INCREMENT PRIMARY KEY,
          thread_id VARCHAR(64) NOT NULL,
          role VARCHAR(16) NOT NULL,
          content LONGTEXT NOT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_thread_created (thread_id, created_at)
        ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
      `);
      await this.database.query(`
        CREATE TABLE IF NOT EXISTS trip_plans (
          id VARCHAR(36) PRIMARY KEY,
          thread_id VARCHAR(64) NOT NULL,
          title VARCHAR(160) NOT NULL,
          payload LONGTEXT NOT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_trip_thread (thread_id, created_at)
        ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
      `);
      await this.database.query(`
        CREATE TABLE IF NOT EXISTS users (
          phone VARCHAR(20) PRIMARY KEY,
          account_id VARCHAR(32) NOT NULL UNIQUE,
          nickname VARCHAR(64) NOT NULL,
          password_hash VARCHAR(255) NULL,
          password_salt VARCHAR(64) NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
      `);
      this.mode = "mysql-rds";
    } catch {
      if (this.database) {
        try { await this.database.end(); } catch {}
      }
      this.database = null;
      this.mode = "local-json-fallback";
    }
  }

  async saveMessage(threadId, role, content) {
    if (this.database && this.mode === "mysql-rds") {
      try {
        await this.database.execute(
          "INSERT INTO conversation_messages (thread_id, role, content) VALUES (?, ?, ?)",
          [threadId, role, String(content).slice(0, 20000)]
        );
        return;
      } catch {
        this.mode = "local-json-fallback";
      }
    }
    const line = JSON.stringify({ threadId, role, content: String(content).slice(0, 20000), createdAt: new Date().toISOString() });
    await fsp.appendFile(path.join(this.dataDir, "conversations.jsonl"), line + "\n", "utf8");
  }

  async saveTrip(threadId, title, items) {
    const trip = {
      id: crypto.randomUUID(),
      threadId,
      title: String(title || "我的中国旅行计划").slice(0, 160),
      items,
      createdAt: new Date().toISOString()
    };
    if (this.database && this.mode === "mysql-rds") {
      try {
        await this.database.execute(
          "INSERT INTO trip_plans (id, thread_id, title, payload) VALUES (?, ?, ?, ?)",
          [trip.id, threadId, trip.title, JSON.stringify(trip)]
        );
        return trip;
      } catch {
        this.mode = "local-json-fallback";
      }
    }
    const file = path.join(this.dataDir, "trips.json");
    let trips = [];
    try { trips = JSON.parse(await fsp.readFile(file, "utf8")); } catch {}
    trips.push(trip);
    await fsp.writeFile(file, JSON.stringify(trips.slice(-500), null, 2), "utf8");
    return trip;
  }

  async listTrips(threadId) {
    if (this.database && this.mode === "mysql-rds") {
      try {
        const [rows] = await this.database.execute(
          "SELECT payload FROM trip_plans WHERE thread_id = ? ORDER BY created_at DESC LIMIT 30",
          [threadId]
        );
        return rows.map(row => JSON.parse(row.payload));
      } catch {
        this.mode = "local-json-fallback";
      }
    }
    try {
      const trips = JSON.parse(await fsp.readFile(path.join(this.dataDir, "trips.json"), "utf8"));
      return trips.filter(trip => trip.threadId === threadId).slice(-30).reverse();
    } catch {
      return [];
    }
  }

  userFromRow(row) {
    if (!row) return null;
    return {
      phone: String(row.phone),
      accountId: String(row.account_id),
      nickname: String(row.nickname),
      passwordHash: row.password_hash || "",
      passwordSalt: row.password_salt || "",
      createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at || "")
    };
  }

  async readUsers() {
    try {
      const value = JSON.parse(await fsp.readFile(this.usersFile, "utf8"));
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  }

  async writeUsers(users) {
    await fsp.writeFile(this.usersFile, JSON.stringify(users, null, 2), "utf8");
  }

  mutateUsers(worker) {
    const task = this.userQueue.then(async () => {
      const users = await this.readUsers();
      const result = await worker(users);
      await this.writeUsers(users);
      return result;
    });
    this.userQueue = task.catch(() => {});
    return task;
  }

  async findUser(phone) {
    if (this.database && this.mode === "mysql-rds") {
      try {
        const [rows] = await this.database.execute(
          "SELECT phone, account_id, nickname, password_hash, password_salt, created_at FROM users WHERE phone = ? LIMIT 1",
          [String(phone)]
        );
        return this.userFromRow(rows[0]);
      } catch {
        this.mode = "local-json-fallback";
      }
    }
    const users = await this.readUsers();
    return users.find(item => item.phone === phone) || null;
  }

  async findUserByAccountId(accountId) {
    if (this.database && this.mode === "mysql-rds") {
      try {
        const [rows] = await this.database.execute(
          "SELECT phone, account_id, nickname, password_hash, password_salt, created_at FROM users WHERE account_id = ? LIMIT 1",
          [String(accountId)]
        );
        return this.userFromRow(rows[0]);
      } catch {
        this.mode = "local-json-fallback";
      }
    }
    const users = await this.readUsers();
    return users.find(item => item.accountId === accountId) || null;
  }

  async createUser(user) {
    const record = {
      phone: String(user.phone),
      accountId: String(user.accountId),
      nickname: String(user.nickname),
      passwordHash: String(user.passwordHash || ""),
      passwordSalt: String(user.passwordSalt || ""),
      createdAt: user.createdAt || new Date().toISOString()
    };
    if (this.database && this.mode === "mysql-rds") {
      try {
        await this.database.execute(
          "INSERT INTO users (phone, account_id, nickname, password_hash, password_salt) VALUES (?, ?, ?, ?, ?)",
          [record.phone, record.accountId, record.nickname, record.passwordHash || null, record.passwordSalt || null]
        );
        return record;
      } catch {
        this.mode = "local-json-fallback";
      }
    }
    return this.mutateUsers(users => {
      if (users.some(item => item.phone === record.phone || item.accountId === record.accountId)) {
        throw new Error("user already exists");
      }
      users.push(record);
      return record;
    });
  }

  async updateUserPassword(phone, passwordHash, passwordSalt) {
    if (this.database && this.mode === "mysql-rds") {
      try {
        const [result] = await this.database.execute(
          "UPDATE users SET password_hash = ?, password_salt = ? WHERE phone = ?",
          [passwordHash, passwordSalt, String(phone)]
        );
        return result.affectedRows > 0;
      } catch {
        this.mode = "local-json-fallback";
      }
    }
    return this.mutateUsers(users => {
      const user = users.find(item => item.phone === phone);
      if (!user) return false;
      user.passwordHash = passwordHash;
      user.passwordSalt = passwordSalt;
      return true;
    });
  }

  status() {
    return this.mode;
  }

  async health() {
    if (this.database && this.mode === "mysql-rds") {
      try {
        await this.database.query("SELECT 1");
      } catch {
        this.mode = "local-json-fallback";
      }
    }
    return this.mode;
  }
}

module.exports = { Store };
