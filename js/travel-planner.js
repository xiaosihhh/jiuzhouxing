(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.JZTravelPlanner = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const CHINESE_DIGITS = {
    "零": 0, "〇": 0, "一": 1, "二": 2, "两": 2, "三": 3, "四": 4,
    "五": 5, "六": 6, "七": 7, "八": 8, "九": 9
  };
  const CHINESE_UNITS = { "十": 10, "百": 100, "千": 1000 };

  function parseChineseInteger(value) {
    const text = String(value || "").trim();
    if (!text) return null;
    if (/^\d+$/.test(text)) return Number(text);
    let total = 0;
    let section = 0;
    let number = 0;
    for (const char of text) {
      if (Object.prototype.hasOwnProperty.call(CHINESE_DIGITS, char)) {
        number = CHINESE_DIGITS[char];
      } else if (Object.prototype.hasOwnProperty.call(CHINESE_UNITS, char)) {
        section += (number || 1) * CHINESE_UNITS[char];
        number = 0;
      } else if (char === "万") {
        total += (section + number) * 10000;
        section = 0;
        number = 0;
      }
    }
    return total + section + number;
  }

  function unique(values) {
    return [...new Set((values || []).filter(Boolean))];
  }

  function normalizeQuestion(value) {
    return String(value || "").trim().toLowerCase();
  }

  function findCity(question, catalog) {
    const text = normalizeQuestion(question);
    const items = Array.isArray(catalog) ? catalog : [];
    return items
      .filter(city => city && city.name)
      .slice()
      .sort((a, b) => String(b.name).length - String(a.name).length)
      .find(city =>
        text.includes(String(city.name).toLowerCase()) ||
        (city.city && text.includes(String(city.city).toLowerCase()))
      ) || null;
  }

  function parseDays(question) {
    const text = normalizeQuestion(question);
    const arabicDay = text.match(/(\d{1,2})\s*(?:天|日)(?!气)/);
    if (arabicDay) return Math.max(1, Math.min(14, Number(arabicDay[1])));
    const chineseDay = text.match(/([零〇一二两三四五六七八九十百]+)\s*(?:天|日)(?!气)/);
    if (chineseDay) {
      const days = parseChineseInteger(chineseDay[1]);
      if (days) return Math.max(1, Math.min(14, days));
    }
    const nightMatch = text.match(/(\d{1,2}|[零〇一二两三四五六七八九十百]+)\s*晚/);
    if (nightMatch) {
      const nights = parseChineseInteger(nightMatch[1]);
      if (nights) return Math.max(1, Math.min(14, nights + 1));
    }
    return null;
  }

  function parseBudget(question) {
    const text = normalizeQuestion(question);
    const arabic = text.match(/(?:预算|人均|控制在)?\s*(\d{3,5})\s*(?:元|块|以内|以下|封顶)?/);
    if (arabic) return Number(arabic[1]);
    const chinese = text.match(/(?:预算|人均|控制在)?\s*([零〇一二两三四五六七八九十百千万]+)\s*(?:元|块|以内|以下)?/);
    if (chinese) {
      const value = parseChineseInteger(chinese[1]);
      if (value >= 100 && value <= 100000) return value;
    }
    return null;
  }

  function parsePreferences(question) {
    const text = normalizeQuestion(question);
    const preferences = [];
    if (/亲子|孩子|小孩|家庭|带娃/.test(text)) preferences.push("family");
    if (/历史|文化|博物馆|人文|古城|遗迹|建筑/.test(text)) preferences.push("culture");
    if (/美食|小吃|吃|餐厅/.test(text)) preferences.push("food");
    if (/轻松|慢节奏|休闲|度假/.test(text)) preferences.push("relaxed");
    if (/拍照|摄影|街拍/.test(text)) preferences.push("photo");
    return preferences;
  }

  function historyText(history) {
    return (Array.isArray(history) ? history : [])
      .filter(message => message && message.role === "user")
      .slice(-8)
      .map(message => String(message.content || ""))
      .join(" ");
  }

  function scoreHighlight(name, mode) {
    const value = String(name || "");
    if (mode === "family") {
      if (/迪士尼|乐园|海洋|水族|动物|科技|自然|博物|公园|亲子/.test(value)) return 100;
      if (/步行|登山|徒步|夜店/.test(value)) return -20;
      return 10;
    }
    if (mode === "culture") {
      if (/博物|历史|古城|古镇|老街|园林|寺|宫|建筑|外滩|豫园|文化/.test(value)) return 100;
      if (/迪士尼|乐园/.test(value)) return -10;
      return 20;
    }
    if (mode === "food") {
      if (/街|夜市|市场|美食|老街|古镇/.test(value)) return 90;
      return 10;
    }
    if (mode === "relaxed") {
      if (/公园|湖|江|街区|古镇|园林|沙滩/.test(value)) return 90;
      if (/登山|徒步/.test(value)) return -20;
      return 10;
    }
    if (mode === "photo") {
      if (/外滩|夜景|街|古镇|山|湖|建筑|塔/.test(value)) return 90;
      return 10;
    }
    return 0;
  }

  function rankedHighlights(city, mode) {
    const source = unique(city && city.highlights);
    if (mode === "classic") return source;
    return source.slice().sort((a, b) => scoreHighlight(b, mode) - scoreHighlight(a, mode));
  }

  function genericDayItem(city, day, days, mode) {
    if (day === 0) return "抵达与酒店入住";
    if (day === days - 1) return "机动时间与返程准备";
    const labels = {
      family: "亲子休闲与当地餐饮",
      culture: "城市漫步与在地文化体验",
      food: "当地特色餐饮与街区探索",
      relaxed: "自由活动与休息调整",
      photo: "街拍与城市景观记录"
    };
    return labels[mode] || `${city.name}当地餐饮与自由活动`;
  }

  function isFullDayAttraction(name) {
    return /迪士尼|环球影城|欢乐谷|长隆|野生动物园|海洋公园|九寨沟|张家界国家森林公园|黄山风景区/.test(String(name || ""));
  }

  function isFamilyOnlyAttraction(name) {
    return /迪士尼|环球影城|欢乐谷|长隆|野生动物园|海洋公园/.test(String(name || ""));
  }

  function attractionMinutes(name) {
    const value = String(name || "");
    if (isFullDayAttraction(value)) return 480;
    if (/朱家角|古镇|博物馆|美术馆|科技馆|动物园|海洋馆/.test(value)) return 180;
    if (/东方明珠|豫园|武康路|故宫|兵马俑|布达拉宫|西湖/.test(value)) return 120;
    if (/外滩|步行街|夜景|公园|街区/.test(value)) return 90;
    return 120;
  }

  function buildItinerary(city, dayCount, mode) {
    if (!city) return [];
    const days = Math.max(1, Math.min(14, Number(dayCount) || city.duration || 1));
    const ranked = rankedHighlights(city, mode);
    const fullDayAttractions = ranked.filter(isFullDayAttraction);
    const fullDayAttraction = mode === "family"
      ? fullDayAttractions[0] || null
      : mode === "classic"
        ? fullDayAttractions.find(item => !isFamilyOnlyAttraction(item)) || null
        : null;
    const regularHighlights = ranked.filter(item => !isFullDayAttraction(item));
    const slots = Array.from({ length: days }, () => []);
    if (fullDayAttraction && days === 1) {
      slots[0].push(fullDayAttraction);
    } else if (fullDayAttraction && days >= 2) {
      slots[Math.min(1, days - 1)].push(fullDayAttraction);
    }
    let cursor = 0;
    for (let day = 0; day < days; day += 1) {
      if (slots[day].some(isFullDayAttraction)) continue;
      let capacity = day === 0 || day === days - 1 ? 300 : 420;
      if (day === 0) capacity -= 60;
      if (day === days - 1) capacity -= 60;
      while (cursor < regularHighlights.length) {
        const highlight = regularHighlights[cursor];
        const minutes = attractionMinutes(highlight);
        const used = slots[day].reduce((sum, item) => sum + attractionMinutes(item), 0);
        if (used + minutes > capacity) break;
        slots[day].push(highlight);
        cursor += 1;
      }
    }
    while (cursor < regularHighlights.length) {
      let placed = false;
      for (let day = 0; day < days && !placed; day += 1) {
        if (slots[day].some(isFullDayAttraction)) continue;
        const minutes = attractionMinutes(regularHighlights[cursor]);
        const used = slots[day].reduce((sum, item) => sum + attractionMinutes(item), 0);
        const capacity = day === 0 || day === days - 1 ? 240 : 420;
        if (used + minutes <= capacity) {
          slots[day].push(regularHighlights[cursor]);
          cursor += 1;
          placed = true;
        }
      }
      if (!placed) break;
    }
    const itinerary = [];
    for (let index = 0; index < days; index += 1) {
      const items = [];
      if (index === 0) items.push(genericDayItem(city, index, days, mode));
      items.push(...slots[index]);
      items.push(genericDayItem(city, index, days, mode));
      itinerary.push({
        day: index + 1,
        city: city.name,
        items: unique(items)
      });
    }
    return itinerary;
  }

  function variantDefinitions(preferences) {
    const variants = [
      { key: "classic", name: "经典首次游" },
      { key: "family", name: "亲子轻松游" },
      { key: "culture", name: "城市文化游" }
    ];
    if (preferences.includes("food")) variants.push({ key: "food", name: "美食街区游" });
    if (preferences.includes("relaxed")) variants.push({ key: "relaxed", name: "慢节奏度假" });
    if (preferences.includes("photo")) variants.push({ key: "photo", name: "城市摄影游" });
    return variants;
  }

  function preferredVariant(preferences) {
    return ["family", "culture", "food", "relaxed", "photo"].find(key => preferences.includes(key)) || "classic";
  }

  function itineraryText(itinerary) {
    return itinerary
      .map(day => `D${day.day} ${day.city}：${day.items.join(" → ")}`)
      .join("\n");
  }

  function plan(question, catalog, history) {
    const current = normalizeQuestion(question);
    const previous = historyText(history);
    const city = findCity(current, catalog) || findCity(previous, catalog);
    if (!city) return null;

    const currentDays = parseDays(current);
    const previousDays = parseDays(previous);
    const daysSpecified = Boolean(currentDays || previousDays);
    const days = currentDays || previousDays || city.duration || 1;
    const currentPreferences = parsePreferences(current);
    const previousPreferences = parsePreferences(previous);
    const preferences = unique(currentPreferences.concat(previousPreferences));
    const focusMode = currentPreferences[0] || preferredVariant(preferences);
    const variants = variantDefinitions(preferences).map(variant => ({
      ...variant,
      itinerary: buildItinerary(city, days, variant.key)
    }));
    const selected = variants.find(variant => variant.key === focusMode) || variants[0];
    const baseDuration = Math.max(1, Number(city.duration) || days);
    const estimated = Math.round(Number(city.price || 0) * days / baseDuration);
    const budget = parseBudget(current) || parseBudget(previous);
    const budgetText = budget
      ? estimated <= budget
        ? `预计人均约 ¥${estimated.toLocaleString()}，在预算 ¥${budget.toLocaleString()} 内。`
        : `预计人均约 ¥${estimated.toLocaleString()}，比预算 ¥${budget.toLocaleString()} 高 ¥${(estimated - budget).toLocaleString()}，可减少付费景点或缩短行程。`
      : `预计人均约 ¥${estimated.toLocaleString()}。`;
    const alternatives = variants
      .filter(variant => variant.key !== selected.key)
      .slice(0, 2)
      .map(variant => variant.name)
      .join("、");
    const intro = daysSpecified
      ? `已按你的要求生成“${city.name} ${days}天”${selected.name}。`
      : `你没有指定天数，我按${city.name}的建议停留${days}天生成${selected.name}。`;
    const reply = [
      intro,
      budgetText,
      "",
      itineraryText(selected.itinerary),
      alternatives ? `\n另有两套可切换方案：${alternatives}。可以继续输入“换成亲子方案”或“换成文化方案”调整。` : ""
    ].join("\n").trim();

    return {
      text: reply,
      cards: [{
        ...city,
        planDays: days,
        planPrice: estimated,
        planVariant: selected.name
      }],
      intent: { city: city.name, days, daysSpecified, budget, preferences },
      itinerary: selected.itinerary,
      variants,
      selectedVariant: selected.key,
      estimatedBudget: estimated
    };
  }

  return {
    parseChineseInteger,
    parseDays,
    parseBudget,
    parsePreferences,
    findCity,
    buildItinerary,
    plan,
    itineraryText
  };
});
