(function () {
  "use strict";

  const isStaticHost =
    location.hostname.endsWith(".github.io") ||
    location.protocol === "file:" ||
    new URLSearchParams(location.search).has("static");
  if (!isStaticHost || window.__JZX_STATIC_API__) return;
  window.__JZX_STATIC_API__ = true;

  const KEYS = {
    posts: "jzx_static_posts_v1",
    accounts: "jzx_static_accounts_v1",
    session: "jzx_static_session_v1",
    code: "jzx_static_code_v1",
    trips: "jzx_static_trips_v1"
  };

  const seedPosts = [
    {
      id: "efea64d6-2e25-45bc-8ffb-0a520e53b82c",
      accountId: "JZX-TOUR0001",
      nickname: "九州行官方",
      city: "北京",
      caption: "从田野到群山，再到跨海长桥：第一支社区旅行短片，带你看见中国的辽阔与浪漫。",
      media: [
        {
          url: "assets/videos/community-demo.mp4",
          storage: "static",
          type: "video/mp4",
          poster: "assets/cities/北京.webp"
        }
      ],
      likes: ["JZX-5D6TACEC", "JZX-DEMO2026"],
      favorites: ["JZX-5D6TACEC"],
      comments: [
        {
          id: "9a7bd62a-2af6-4c4b-ae13-88bb6bf51542",
          accountId: "JZX-TOUR0001",
          nickname: "九州行官方",
          text: "首支社区旅行短片已上线，欢迎分享你镜头里的中国。",
          createdAt: "2026-11-10T12:00:00.000Z"
        }
      ],
      createdAt: "2026-11-10T11:19:36.567Z"
    },
    {
      id: "d4a45120-1b30-4a31-9a2e-421e647c0081",
      accountId: "JZX-DEMO2026",
      nickname: "旅行者 2026",
      city: "杭州",
      caption: "西湖的清晨很适合慢慢走。避开人最多的时段，沿着湖边小路看一场安静的日出。",
      media: [
        {
          url: "assets/cities/杭州.webp",
          storage: "static",
          type: "image/webp"
        }
      ],
      likes: ["JZX-TOUR0001"],
      favorites: [],
      comments: [],
      createdAt: "2026-11-11T01:20:00.000Z"
    }
  ];

  function readJson(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || "null");
      return value ?? fallback;
    } catch {
      return fallback;
    }
  }

  function writeJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function posts() {
    const value = readJson(KEYS.posts, null);
    if (Array.isArray(value)) return value;
    writeJson(KEYS.posts, seedPosts);
    return seedPosts.slice();
  }

  function savePosts(value) {
    writeJson(KEYS.posts, value.slice(-200));
  }

  function currentUser() {
    return readJson(KEYS.session, null);
  }

  function publicUser(user) {
    return user ? {
      phone: user.phone,
      nickname: user.nickname,
      accountId: user.accountId,
      createdAt: user.createdAt,
      hasPassword: !!user.hasPassword
    } : null;
  }

  function accountId(phone) {
    let hash = 2166136261;
    for (const char of String(phone)) {
      hash ^= char.charCodeAt(0);
      hash = Math.imul(hash, 16777619);
    }
    return "JZX-" + (hash >>> 0).toString(36).toUpperCase().padStart(8, "0").slice(-8);
  }

  function createUser(phone, previous) {
    return {
      phone,
      nickname: previous?.nickname || "旅行者 " + phone.slice(-4),
      accountId: previous?.accountId || accountId(phone),
      createdAt: previous?.createdAt || new Date().toISOString(),
      hasPassword: !!previous?.hasPassword,
      password: previous?.password || ""
    };
  }

  function setSession(user) {
    writeJson(KEYS.session, user);
    try {
      const accountState = readJson("hy_accounts_v1", {});
      accountState[user.phone] = {
        accountId: user.accountId,
        nickname: user.nickname,
        createdAt: user.createdAt,
        hasPassword: !!user.hasPassword
      };
      writeJson("hy_accounts_v1", accountState);
      localStorage.setItem("hy_session_phone", user.phone);
    } catch {}
  }

  function clearSession() {
    localStorage.removeItem(KEYS.session);
    localStorage.removeItem("hy_session_phone");
  }

  async function hashPassword(value) {
    if (!crypto.subtle) return "plain:" + value;
    const bytes = new TextEncoder().encode(value);
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
  }

  function json(payload, status = 200) {
    return new Response(JSON.stringify(payload), {
      status,
      headers: { "Content-Type": "application/json; charset=utf-8" }
    });
  }

  async function bodyOf(options) {
    if (!options?.body) return {};
    if (typeof options.body === "string") {
      try { return JSON.parse(options.body); } catch { return {}; }
    }
    if (options.body instanceof FormData) return Object.fromEntries(options.body.entries());
    return {};
  }

  function clean(value, max = 1200) {
    return String(value || "").replace(/\u0000/g, "").trim().slice(0, max);
  }

  function staticPlan(question, history = []) {
    const answer = window.AI?.answer
      ? window.AI.answer(question, history)
      : { text: "当前为 GitHub Pages 静态演示版，可使用地点、路线与社区功能。", cards: [] };
    const cards = Array.isArray(answer.cards) ? answer.cards : [];
    return {
      reply: answer.text,
      recommendations: cards.map(city => ({
        id: city.id,
        reason: city.description || "静态推荐",
        days: city.planDays,
        price: city.planPrice,
        variant: city.planVariant
      })),
      itinerary: Array.isArray(answer.itinerary) && answer.itinerary.length
        ? answer.itinerary
        : cards.slice(0, 3).map((city, index) => ({
            day: index + 1,
            city: city.name,
            items: (city.highlights || []).slice(0, 3)
          })),
      intent: answer.intent || null,
      variants: answer.variants || [],
      skills: [
        { name: "意图解析" },
        { name: "目的地检索" },
        { name: "社区趋势" },
        { name: "预算校验" },
        { name: "行程草稿" },
        { name: "预订衔接" }
      ],
      provider: "local-static",
      cached: false,
      createdAt: new Date().toISOString()
    };
  }

  async function handleApi(url, options) {
    const path = url.pathname;
    const method = String(options?.method || "GET").toUpperCase();

    if (path === "/api/health" && method === "GET") {
      return json({
        ok: true,
        services: {
          agent: "local-static",
          database: "browser-local",
          cache: "browser-local",
          objectStorage: "local-static"
        },
        version: "1.2.0-static"
      });
    }

    if (path === "/api/ai/plan" && method === "POST") {
      const body = await bodyOf(options);
      const message = clean(body.message, 2000);
      if (!message) return json({ error: "message is required" }, 400);
      return json(staticPlan(message, Array.isArray(body.history) ? body.history : []));
    }

    if (path === "/api/auth/code" && method === "POST") {
      const body = await bodyOf(options);
      const phone = clean(body.phone, 20).replace(/\D/g, "");
      if (!/^1\d{10}$/.test(phone)) return json({ error: "请输入有效的手机号" }, 400);
      writeJson(KEYS.code, {
        phone,
        code: "123456",
        expiresAt: Date.now() + 10 * 60 * 1000
      });
      return json({ ok: true, expiresIn: 600, demoCode: "123456" });
    }

    if (path === "/api/auth/login/code" && method === "POST") {
      const body = await bodyOf(options);
      const phone = clean(body.phone, 20).replace(/\D/g, "");
      const code = clean(body.code, 12);
      const challenge = readJson(KEYS.code, null);
      if (!challenge || challenge.phone !== phone || challenge.expiresAt < Date.now()) {
        return json({ error: "验证码已失效，请重新获取" }, 400);
      }
      if (code !== challenge.code) return json({ error: "验证码不正确" }, 400);
      const accounts = readJson(KEYS.accounts, {});
      const created = !accounts[phone];
      const user = createUser(phone, accounts[phone]);
      accounts[phone] = user;
      writeJson(KEYS.accounts, accounts);
      setSession(user);
      return json({ user: publicUser(user), created });
    }

    if (path === "/api/auth/login/password" && method === "POST") {
      const body = await bodyOf(options);
      const phone = clean(body.phone, 20).replace(/\D/g, "");
      const password = String(body.password || "");
      const accounts = readJson(KEYS.accounts, {});
      const user = accounts[phone];
      if (!user?.hasPassword) return json({ error: "该账号尚未设置密码" }, 400);
      if (user.password !== await hashPassword(password)) {
        return json({ error: "手机号或密码错误" }, 400);
      }
      setSession(user);
      return json({ user: publicUser(user), created: false });
    }

    if (path === "/api/auth/me" && method === "GET") {
      const user = currentUser();
      return user ? json({ user: publicUser(user) }) : json({ error: "not authenticated" }, 401);
    }

    if (path === "/api/auth/logout" && method === "POST") {
      clearSession();
      return json({ ok: true });
    }

    if (path === "/api/auth/password" && method === "POST") {
      const existing = currentUser();
      if (!existing) return json({ error: "请先登录" }, 401);
      const body = await bodyOf(options);
      const newPassword = String(body.newPassword || "");
      if (newPassword.length < 6) return json({ error: "密码至少需要 6 位字符" }, 400);
      const accounts = readJson(KEYS.accounts, {});
      const user = accounts[existing.phone] || createUser(existing.phone, existing);
      user.password = await hashPassword(newPassword);
      user.hasPassword = true;
      accounts[user.phone] = user;
      writeJson(KEYS.accounts, accounts);
      setSession(user);
      return json({ user: publicUser(user) });
    }

    if (path === "/api/trips" && method === "POST") {
      const body = await bodyOf(options);
      const threadId = clean(body.thread_id, 80) || "static-thread";
      const items = Array.isArray(body.items) ? body.items : [];
      if (!items.length) return json({ error: "items is required" }, 400);
      const trips = readJson(KEYS.trips, {});
      const trip = {
        id: "static-" + Date.now().toString(36),
        title: clean(body.title, 120) || "九州行行程计划",
        items,
        createdAt: new Date().toISOString()
      };
      trips[threadId] = [trip, ...(trips[threadId] || [])].slice(0, 30);
      writeJson(KEYS.trips, trips);
      return json({ trip }, 201);
    }

    if (path === "/api/trips" && method === "GET") {
      const threadId = clean(url.searchParams.get("thread_id"), 80) || "static-thread";
      const trips = readJson(KEYS.trips, {});
      return json({ trips: trips[threadId] || [] });
    }

    if (path === "/api/community/posts" && method === "GET") {
      return json({ posts: posts().slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)) });
    }

    if (path === "/api/community/posts" && method === "POST") {
      const user = currentUser();
      if (!user) return json({ error: "请先登录后再发布分享" }, 401);
      const body = await bodyOf(options);
      const city = clean(body.city, 40);
      const caption = clean(body.caption, 1200);
      const media = Array.isArray(body.media) ? body.media.slice(0, 4) : [];
      if (!city) return json({ error: "请选择城市" }, 400);
      if (!caption) return json({ error: "请填写旅行配文" }, 400);
      if (!media.length) return json({ error: "请至少上传一张照片或一个视频" }, 400);
      const normalized = media.map(item => {
        const value = String(item || "");
        const match = value.match(/^data:([^;,]+);base64,/);
        if (!match) throw new Error("媒体格式不支持");
        return { url: value, storage: "browser", type: match[1] };
      });
      const post = {
        id: crypto.randomUUID?.() || "post-" + Date.now().toString(36),
        accountId: user.accountId,
        nickname: user.nickname,
        city,
        caption,
        media: normalized,
        likes: [],
        favorites: [],
        comments: [],
        createdAt: new Date().toISOString()
      };
      const list = posts();
      list.unshift(post);
      try {
        savePosts(list);
      } catch {
        return json({ error: "当前浏览器存储空间不足，请上传更小的图片或视频" }, 413);
      }
      return json({ post }, 201);
    }

    const actionMatch = path.match(/^\/api\/community\/posts\/([^/]+)\/(like|favorite|comments)$/);
    if (actionMatch && method === "POST") {
      const user = currentUser();
      if (!user) return json({ error: "请先登录后再参与互动" }, 401);
      const list = posts();
      const post = list.find(item => item.id === actionMatch[1]);
      if (!post) return json({ error: "分享内容不存在" }, 404);
      const action = actionMatch[2];
      if (action === "comments") {
        const body = await bodyOf(options);
        const text = clean(body.text, 500);
        if (!text) return json({ error: "请输入评论内容" }, 400);
        const comment = {
          id: crypto.randomUUID?.() || "comment-" + Date.now().toString(36),
          accountId: user.accountId,
          nickname: user.nickname,
          text,
          createdAt: new Date().toISOString()
        };
        post.comments = Array.isArray(post.comments) ? post.comments : [];
        post.comments.push(comment);
        savePosts(list);
        return json({ post, comment }, 201);
      }
      const field = action === "like" ? "likes" : "favorites";
      post[field] = Array.isArray(post[field]) ? post[field] : [];
      const index = post[field].indexOf(user.accountId);
      if (index >= 0) post[field].splice(index, 1);
      else post[field].push(user.accountId);
      savePosts(list);
      return json({ post });
    }

    const deleteMatch = path.match(/^\/api\/community\/posts\/([^/]+)$/);
    if (deleteMatch && method === "DELETE") {
      const user = currentUser();
      if (!user) return json({ error: "请先登录后再操作" }, 401);
      const list = posts();
      const index = list.findIndex(item => item.id === deleteMatch[1]);
      if (index < 0) return json({ error: "分享内容不存在" }, 404);
      if (list[index].accountId !== user.accountId) {
        return json({ error: "只能删除自己发布的分享" }, 403);
      }
      const [removed] = list.splice(index, 1);
      savePosts(list);
      return json({ post: removed });
    }

    if (path.startsWith("/api/community/media/")) {
      return json({ error: "静态演示媒体由浏览器直接加载" }, 404);
    }

    return json({ error: "静态演示版暂不支持此接口" }, 404);
  }

  const nativeFetch = window.fetch.bind(window);
  window.fetch = async function (input, options) {
    const rawUrl = typeof input === "string" ? input : input?.url || String(input);
    const url = new URL(rawUrl, location.href);
    if (url.origin === location.origin && url.pathname.startsWith("/api/")) {
      try {
        return await handleApi(url, options);
      } catch (error) {
        return json({ error: error?.message || "静态演示接口异常" }, 500);
      }
    }
    return nativeFetch(input, options);
  };

  document.addEventListener("DOMContentLoaded", () => {
    const badge = document.createElement("div");
    badge.textContent = "GitHub Pages 静态演示 · 数据保存在当前浏览器";
    badge.setAttribute("aria-label", "静态演示模式");
    Object.assign(badge.style, {
      position: "fixed",
      left: "14px",
      bottom: "14px",
      zIndex: "9999",
      padding: "8px 12px",
      borderRadius: "999px",
      background: "rgba(17, 48, 66, .88)",
      color: "#fff",
      fontSize: "12px",
      lineHeight: "1",
      boxShadow: "0 8px 24px rgba(0,0,0,.2)",
      pointerEvents: "none"
    });
    document.body.appendChild(badge);
  });
})();
