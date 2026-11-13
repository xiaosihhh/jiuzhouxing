"use strict";

class HybridCache {
  constructor(url, ttlSeconds) {
    this.url = url;
    this.ttlSeconds = ttlSeconds;
    this.memory = new Map();
    this.client = null;
    this.mode = url ? "redis-pending" : "memory";
  }

  async init() {
    if (!this.url) return;
    try {
      const redis = await import("redis");
      this.client = redis.createClient({ url: this.url });
      this.client.on("error", () => {
        this.mode = "memory-fallback";
      });
      await this.client.connect();
      this.mode = "redis";
    } catch {
      this.client = null;
      this.mode = "memory-fallback";
    }
  }

  async get(key) {
    if (this.client && this.mode === "redis") {
      try {
        const value = await this.client.get(key);
        if (value) return JSON.parse(value);
      } catch {
        this.mode = "memory-fallback";
      }
    }
    const item = this.memory.get(key);
    if (!item || item.expiresAt < Date.now()) {
      this.memory.delete(key);
      return null;
    }
    return item.value;
  }

  async set(key, value, ttlSeconds = this.ttlSeconds) {
    const safeTtl = Math.max(1, ttlSeconds);
    this.memory.set(key, { value, expiresAt: Date.now() + safeTtl * 1000 });
    if (this.client && this.mode === "redis") {
      try {
        await this.client.set(key, JSON.stringify(value), { EX: safeTtl });
      } catch {
        this.mode = "memory-fallback";
      }
    }
  }

  status() {
    return this.mode;
  }

  async health() {
    if (this.client && this.mode === "redis") {
      try {
        await this.client.ping();
      } catch {
        this.mode = "memory-fallback";
      }
    }
    return this.mode;
  }
}

module.exports = { HybridCache };
