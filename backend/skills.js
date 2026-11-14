"use strict";

const { catalog } = require("./catalog");
const travelPlanner = require("../js/travel-planner");

const REGIONS = ["华北", "华东", "华南", "华中", "西南", "西北", "东北", "港澳台"];
const PREFERENCE_TAGS = {
  亲子: ["休闲", "自然", "海岛", "度假"],
  情侣: ["浪漫", "海岛", "度假"],
  摄影: ["摄影", "自然", "人文古迹"],
  美食: ["美食"],
  历史: ["人文古迹", "世界遗产"],
  自然: ["自然", "山水"],
  都市: ["都市", "购物"],
  海岛: ["海岛", "度假"],
  安静: ["休闲", "自然"]
};
const PREFERENCE_ALIASES = {
  看海: "海岛",
  海边: "海岛",
  海滨: "海岛",
  沙滩: "海岛",
  大海: "海岛",
  海岛游: "海岛",
  小孩: "亲子",
  孩子: "亲子",
  家庭: "亲子",
  带娃: "亲子",
  好吃: "美食",
  小吃: "美食",
  吃货: "美食",
  名胜古迹: "历史",
  古迹: "历史",
  文化: "历史",
  风景: "自然",
  自然风景: "自然",
  山水: "自然",
  购物: "都市",
  城市: "都市",
  蜜月: "情侣",
  浪漫: "情侣",
  放松: "安静",
  清净: "安静"
};

function clampBudget(value) {
  if (!Number.isFinite(value)) return 5000;
  return Math.min(10000, Math.max(1000, Math.round(value)));
}

function parseChineseDays(text) {
  const digit = { 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
  const match = text.match(/([一二两三四五六七八九十]+)\s*(?:天|日)/);
  if (!match) return null;
  const value = match[1];
  if (value === "十") return 10;
  if (value.includes("十")) {
    const [tens, ones] = value.split("十");
    return (digit[tens] || 1) * 10 + (digit[ones] || 0);
  }
  return digit[value] || null;
}

function parseChineseAmount(value) {
  const digit = { 零: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
  const unit = { 十: 10, 百: 100, 千: 1000 };
  let total = 0, section = 0, number = 0;
  for (const char of value) {
    if (Object.prototype.hasOwnProperty.call(digit, char)) {
      number = digit[char];
    } else if (unit[char]) {
      section += (number || 1) * unit[char];
      number = 0;
    } else if (char === "万") {
      total += (section + number) * 10000;
      section = 0;
      number = 0;
    }
  }
  return total + section + number;
}

function parseTravelIntent(message) {
  const text = String(message || "").toLowerCase();
  const budgetMatch =
    text.match(/(?:预算|人均预算|总预算)\s*(\d+(?:\.\d+)?)\s*(万|千)?/) ||
    text.match(/(\d+(?:\.\d+)?)\s*(万|千)?\s*(?:元|块钱|块)\s*(?:以内|以下)?/) ||
    text.match(/(\d+(?:\.\d+)?)\s*(?:元|块钱|块)?\s*(?:以内|以下|内)/);
  const chineseBudgetMatch = text.match(/(?:预算|人均预算|总预算)\s*([零一二两三四五六七八九十百千万]+)/);
  let budget = 5000;
  if (budgetMatch) {
    const multiplier = budgetMatch[2] === "万" ? 10000 : budgetMatch[2] === "千" ? 1000 : 1;
    budget = clampBudget(Number(budgetMatch[1]) * multiplier);
  } else if (chineseBudgetMatch) {
    budget = clampBudget(parseChineseAmount(chineseBudgetMatch[1]));
  }
  const dayMatch = text.match(/(\d+)\s*(?:天|日)/);
  const weekMatch = text.match(/([一二两三四])\s*(?:周|个星期)/);
  const parsedDays = dayMatch
    ? Number(dayMatch[1])
    : weekMatch
      ? ({ 一: 7, 二: 14, 两: 14, 三: 21, 四: 28 }[weekMatch[1]] || null)
      : parseChineseDays(text);
  const days = parsedDays ? Math.min(14, Math.max(1, parsedDays)) : 5;
  const region = REGIONS.find(item => text.includes(item.toLowerCase())) || "";
  const preferences = new Set(Object.keys(PREFERENCE_TAGS).filter(key => text.includes(key)));
  for (const [alias, preference] of Object.entries(PREFERENCE_ALIASES)) {
    if (text.includes(alias)) preferences.add(preference);
  }
  const direct = catalog.find(item => text.includes(item.name.toLowerCase()) || text.includes(item.city.toLowerCase()));
  return {
    budget,
    days,
    region,
    preferences: [...preferences],
    directCityId: direct ? direct.id : "",
    rawCity: direct ? direct.name : ""
  };
}

function scoreDestination(item, constraints) {
  let score = Number(item.rating || 0) * 4 + (item.popular ? 8 : 0);
  if (item.id === constraints.directCityId) score += 100;
  if (item.region === constraints.region) score += 15;
  const desiredTags = constraints.preferences.flatMap(key => PREFERENCE_TAGS[key] || []);
  score += desiredTags.filter(tag => (item.tags || []).includes(tag)).length * 9;
  if (item.price <= constraints.budget) score += 20;
  else score -= 40 + (item.price - constraints.budget) / 100;
  if (item.duration <= constraints.days + 2) score += 10;
  return score;
}

function searchDestinations(constraints, limit = 6) {
  return catalog
    .slice()
    .sort((a, b) => scoreDestination(b, constraints) - scoreDestination(a, constraints))
    .slice(0, limit)
    .map(item => ({
      id: item.id,
      name: item.name,
      city: item.city,
      region: item.region,
      price: item.price,
      duration: item.duration,
      rating: item.rating,
      tags: item.tags.slice(0, 4),
      bestSeason: item.bestSeason,
      highlights: (item.highlights || []).slice(0, 6)
    }));
}

async function inspectCommunityTrends(posts, candidates) {
  const cityNames = new Set(candidates.map(item => item.name));
  const ranked = (Array.isArray(posts) ? posts : [])
    .map(post => ({
      city: String(post.city || "").slice(0, 40),
      caption: String(post.caption || "").slice(0, 120),
      likes: Array.isArray(post.likes) ? post.likes.length : 0,
      favorites: Array.isArray(post.favorites) ? post.favorites.length : 0,
      comments: Array.isArray(post.comments) ? post.comments.length : 0
    }))
    .filter(post => cityNames.has(post.city))
    .sort((a, b) => (b.likes * 3 + b.favorites * 2 + b.comments * 4) - (a.likes * 3 + a.favorites * 2 + a.comments * 4))
    .slice(0, 5);
  return ranked;
}

function estimateBudget(constraints, candidates) {
  const base = candidates[0] || catalog.find(item => item.popular) || catalog[0];
  const duration = Math.max(1, Number(base.duration) || 1);
  const estimated = Math.round(base.price * (constraints.days / duration));
  const breakdown = {
    transport: Math.round(estimated * 0.3),
    lodging: Math.round(estimated * 0.35),
    food: Math.round(estimated * 0.2),
    ticketsAndOther: Math.round(estimated * 0.15)
  };
  return {
    cap: constraints.budget,
    estimated,
    dailyAverage: Math.round(estimated / Math.max(1, constraints.days)),
    withinBudget: estimated <= constraints.budget,
    remaining: constraints.budget - estimated,
    breakdown
  };
}

function composeItineraryDraft(constraints, candidates) {
  const city = candidates[0];
  if (!city) return [];
  const preference = constraints.preferences || [];
  const mode = preference.includes("亲子")
    ? "family"
    : preference.includes("历史")
      ? "culture"
      : preference.includes("美食")
        ? "food"
        : preference.includes("摄影")
          ? "photo"
          : "classic";
  return travelPlanner.buildItinerary(city, constraints.days, mode);
}

function buildBookingHandoff(constraints, candidates) {
  const city = candidates[0]?.name || constraints.rawCity || "北京";
  const hotel = new URLSearchParams({ cityName: city, adult: "1", children: "0" });
  return [
    { type: "hotel", provider: "携程", url: `https://hotels.ctrip.com/hotels/list?${hotel.toString()}` },
    { type: "rail", provider: "12306", url: "https://www.12306.cn/index/" },
    { type: "flight", provider: "携程", url: "https://www.ctrip.com/flight/" }
  ];
}

const SKILLS = [
  { id: "travel-intent", name: "旅行意图解析", description: "识别预算、天数、区域与偏好" },
  { id: "destination-search", name: "目的地检索", description: "从目的地目录中筛选并排序候选城市" },
  { id: "community-trend", name: "社区趋势洞察", description: "结合相关城市分享筛选真实旅行灵感" },
  { id: "budget-guard", name: "预算校验", description: "拆分交通、住宿、餐饮和门票预算" },
  { id: "itinerary-draft", name: "行程草稿", description: "按天数生成行程骨架供智能体细化" },
  { id: "booking-handoff", name: "预订衔接", description: "生成酒店、铁路和航班平台交接信息" }
];

async function runTravelSkills({ message, tripIds = [], communityPosts = [] }) {
  const trace = [];
  const timed = async (id, worker) => {
    const skill = SKILLS.find(item => item.id === id);
    const started = Date.now();
    const result = await worker();
    const summary = typeof result?.summary === "string" ? result.summary : "";
    trace.push({ ...skill, status: "completed", durationMs: Date.now() - started, summary });
    return result;
  };

  const intentResult = await timed("travel-intent", () => {
    const constraints = parseTravelIntent(message);
    return {
      constraints,
      summary: `预算 ${constraints.budget} 元，${constraints.days} 天${constraints.region ? `，${constraints.region}` : ""}`
    };
  });
  const destinationResult = await timed("destination-search", () => {
    const candidates = searchDestinations(intentResult.constraints);
    return {
      candidates,
      summary: candidates.length ? `筛出 ${candidates.map(item => item.name).slice(0, 4).join("、")}` : "未找到候选城市"
    };
  });
  const communityResult = await timed("community-trend", async () => {
    const insights = await inspectCommunityTrends(communityPosts, destinationResult.candidates);
    return {
      insights,
      summary: insights.length ? `${insights.length} 条相关社区分享` : "暂无相关社区分享"
    };
  });
  const budgetResult = await timed("budget-guard", () => {
    const budget = estimateBudget(intentResult.constraints, destinationResult.candidates);
    return {
      budget,
      summary: `预计 ${budget.estimated} 元，${budget.withinBudget ? "在预算内" : "高于预算"}`
    };
  });
  const itineraryResult = await timed("itinerary-draft", () => {
    const itinerary = composeItineraryDraft(intentResult.constraints, destinationResult.candidates);
    return {
      itinerary,
      summary: itinerary.length ? `${itinerary.length} 天行程骨架` : "需要用户补充目的地"
    };
  });
  const bookingResult = await timed("booking-handoff", () => {
    const actions = buildBookingHandoff(intentResult.constraints, destinationResult.candidates);
    return { actions, summary: "已准备酒店、铁路与航班交接" };
  });

  const currentTrip = tripIds.map(id => catalog.find(item => item.id === id)).filter(Boolean).map(item => ({
    id: item.id,
    name: item.name,
    price: item.price,
    duration: item.duration
  }));
  return {
    trace,
    context: {
      constraints: intentResult.constraints,
      candidates: destinationResult.candidates,
      communityInsights: communityResult.insights,
      budget: budgetResult.budget,
      itineraryDraft: itineraryResult.itinerary,
      bookingHandoff: bookingResult.actions,
      currentTrip
    }
  };
}

module.exports = { runTravelSkills, parseTravelIntent, SKILLS };
