"use strict";

const crypto = require("crypto");
const { Readable } = require("stream");

class ObjectStore {
  constructor(config) {
    this.config = config;
    this.client = null;
    this.lastError = "";
  }

  get configured() {
    return Boolean(
      this.config.obsEndpoint &&
      this.config.obsBucket &&
      this.config.obsAccessKey &&
      this.config.obsSecretKey
    );
  }

  async init() {
    if (!this.configured) return false;
    try {
      const ObsClient = require("esdk-obs-nodejs");
      this.client = new ObsClient({
        access_key_id: this.config.obsAccessKey,
        secret_access_key: this.config.obsSecretKey,
        server: this.config.obsEndpoint,
        max_retry_count: 2
      });
      return true;
    } catch (error) {
      this.lastError = error.message;
      this.client = null;
      return false;
    }
  }

  call(method, params) {
    if (!this.client) return Promise.reject(new Error(this.lastError || "OBS 客户端未初始化"));
    return new Promise((resolve, reject) => {
      this.client[method](params, (error, result) => {
        if (error) reject(error);
        else resolve(result);
      });
    });
  }

  async health() {
    if (!this.configured) return "not-configured";
    if (!this.client && !(await this.init())) return "obs-error";
    try {
      await this.call("headBucket", { Bucket: this.config.obsBucket });
      return "obs";
    } catch (error) {
      this.lastError = error.message;
      return "obs-error";
    }
  }

  async put(buffer, contentType, extension) {
    if (!this.client && !(await this.init())) throw new Error(this.lastError || "OBS 客户端未初始化");
    const safeExtension = String(extension || "").replace(/[^.a-z0-9]/gi, "").slice(0, 10);
    const key = `community/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}${safeExtension}`;
    await this.call("putObject", {
      Bucket: this.config.obsBucket,
      Key: key,
      Body: Readable.from(buffer),
      ContentType: contentType
    });
    await this.call("copyObject", {
      Bucket: this.config.obsBucket,
      Key: key,
      CopySource: `/${this.config.obsBucket}/${key}`,
      MetadataDirective: "REPLACE",
      ContentType: contentType
    });
    return {
      key,
      url: "/api/community/media/obs?key=" + encodeURIComponent(key)
    };
  }

  async signedGetUrl(key, expires = 900) {
    if (!this.client && !(await this.init())) throw new Error(this.lastError || "OBS 客户端未初始化");
    if (!key || !String(key).startsWith("community/") || String(key).includes("..")) throw new Error("非法 OBS 对象路径");
    return this.client.createSignedUrlSync({
      Bucket: this.config.obsBucket,
      Key: key,
      Expires: Math.min(3600, Math.max(60, Number(expires) || 900))
    }).SignedUrl;
  }

  async head(key) {
    if (!this.client && !(await this.init())) throw new Error(this.lastError || "OBS 客户端未初始化");
    if (!key || !String(key).startsWith("community/") || String(key).includes("..")) throw new Error("非法 OBS 对象路径");
    return this.call("getObjectMetadata", {
      Bucket: this.config.obsBucket,
      Key: key
    });
  }

  async delete(key) {
    if (!this.client || !key) return false;
    try {
      await this.call("deleteObject", { Bucket: this.config.obsBucket, Key: key });
      return true;
    } catch {
      return false;
    }
  }
}

module.exports = { ObjectStore };
