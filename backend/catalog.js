"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const config = require("./config");

const context = { window: {} };
for (const file of ["data.js", "cities.js", "city-catalog.js"]) {
  vm.runInNewContext(
    fs.readFileSync(path.join(config.root, "js", file), "utf8"),
    context,
    { filename: file }
  );
}
const catalog = context.window.ALL_CITY_DESTINATIONS || context.window.TRAVEL_DATA || [];
if (!catalog.length) throw new Error("无法构建全国城市目的地目录");

function normalize(value) {
  return String(value || "").toLowerCase();
}

function localPlan(message, tripIds) {
  const query = normalize(message);
  const has = (...words) => words.some(word => query.includes(word));
  const filters = [];
  const reasons = new Map();

  const direct = catalog.find(item => query.includes(item.name.toLowerCase()) || query.includes(item.city.toLowerCase()));
  if (direct) {
    filters.push(item => item.id === direct.id);
    reasons.set(direct.id, "与你指定的城市直接匹配");
  }
  if (has("亲子", "孩子", "小孩", "家庭", "带娃")) {
    filters.push(item => item.tags.some(tag => ["休闲", "自然", "海岛", "度假"].includes(tag)) || ["chengdu", "sanya"].includes(item.id));
    reasons.set("chengdu", reasons.get("chengdu") || "节奏轻松，熊猫与亲子体验丰富");
    reasons.set("sanya", reasons.get("sanya") || "海边度假设施成熟，适合家庭同行");
  }
  if (has("海", "沙滩", "海岛", "看海")) {
    filters.push(item => item.tags.includes("海岛") || item.tags.includes("度假") || /海|湾|滩/.test(item.description));
  }
  if (has("浪漫", "情侣", "蜜月", "约会")) {
    filters.push(item => item.tags.includes("浪漫") || /浪漫|海角|夕阳|夜/.test(item.description));
  }
  if (has("美食", "好吃", "吃货", "吃")) filters.push(item => item.tags.includes("美食"));
  if (has("历史", "文化", "古城", "古迹", "遗产")) filters.push(item => item.tags.includes("人文古迹") || item.tags.includes("世界遗产"));
  if (has("自然", "山水", "风景")) filters.push(item => item.tags.includes("自然") || item.tags.includes("山水"));
  if (has("都市", "城市", "购物", "逛街")) filters.push(item => item.tags.includes("都市") || item.tags.includes("购物"));
  for (const region of ["华北", "华东", "华南", "西南", "西北"]) {
    if (query.includes(region)) filters.push(item => item.region === region);
  }

  let pool = filters.length ? catalog.filter(item => filters.every(filter => filter(item))) : catalog.slice();
  const dayMatch = query.match(/(\d+)\s*(天|日)/);
  if (dayMatch) {
    const days = Number(dayMatch[1]);
    pool = pool.filter(item => item.duration <= days + 1);
  }
  const budgetMatch = query.match(/(?:预算\s*(\d[\d,]*)|(\d[\d,]*)\s*(?:以内|以下|元|块钱))/);
  if (budgetMatch) {
    const budget = Number((budgetMatch[1] || budgetMatch[2]).replace(/,/g, ""));
    pool = pool.filter(item => item.price <= budget);
  }
  if (has("省钱", "便宜", "性价比")) pool.sort((a, b) => a.price - b.price);
  else pool.sort((a, b) => Number(b.popular) - Number(a.popular) || b.rating - a.rating);

  if (!pool.length) pool = catalog.filter(item => item.popular).slice(0, 4);
  const selected = pool.slice(0, 4);
  const trip = tripIds.map(id => catalog.find(item => item.id === id)).filter(Boolean);
  const context = trip.length ? `结合你当前行程中的 ${trip.map(item => item.name).join("、")}，` : "";
  const response = {
    reply: `${context}为你筛选了 ${selected.length} 个适合“${message.slice(0, 36)}”的目的地，并结合参考时长与预算做了排序。点击卡片可以继续查看景点、门票和行程信息。`,
    recommendations: selected.map(item => ({
      id: item.id,
      reason: reasons.get(item.id) || `${item.description}；参考 ${item.duration} 天、约 ¥${item.price.toLocaleString()}。`
    })),
    itinerary: null
  };
  return response;
}

function promptCatalog() {
  return catalog.map(item => ({
    id: item.id,
    name: item.name,
    region: item.region,
    price: item.price,
    duration: item.duration,
    tags: item.tags
  }));
}

module.exports = { catalog, localPlan, promptCatalog };
