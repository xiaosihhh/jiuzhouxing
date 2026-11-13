"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const context = { window: {} };

for (const file of ["data.js", "costs.js", "photos.js", "cities.js"]) {
  vm.runInNewContext(
    fs.readFileSync(path.join(root, "js", file), "utf8"),
    context,
  );
}
vm.runInNewContext(
  fs.readFileSync(path.join(root, "js", "city-catalog.js"), "utf8"),
  context,
);

const data = context.window.TRAVEL_DATA;
const costs = context.window.TRAVEL_COSTS;
const photos = context.window.PHOTO_QUERY;
const chinaCities = context.window.CHINA_CITIES;
const allDestinations = context.window.ALL_CITY_DESTINATIONS || [];
const errors = [];

const ids = new Set();
for (const item of data) {
  if (ids.has(item.id)) errors.push(`重复 ID: ${item.id}`);
  ids.add(item.id);

  for (const field of [
    "id", "name", "region", "country", "city", "description", "price",
    "duration", "rating", "reviews", "tags", "lat", "lng", "highlights",
    "bestSeason", "popular",
  ]) {
    if (!(field in item)) errors.push(`${item.id || "?"} 缺少字段 ${field}`);
  }

  if (!photos[item.id]) errors.push(`${item.id} 缺少照片检索词`);
  if (!Object.keys(costs).some((key) => key.includes(item.city) || item.city.includes(key))) {
    errors.push(`${item.id} 缺少费用数据`);
  }
}

if (!data.length) errors.push("目的地数据为空");
if (data.some((item) => item.country !== "中国")) {
  errors.push("旅行规划数据中仍包含境外目的地");
}

const cityNames = new Set();
let fullCityCount = 0;
for (const [region, provinces] of Object.entries(chinaCities)) {
  for (const [province, cities] of Object.entries(provinces)) {
    for (const city of cities) {
      if (!city || typeof city.name !== "string") {
        errors.push(`${province} 存在格式错误的城市数据`);
        continue;
      }
      const { name, lat, lng, desc, full, sights } = city;
      if (cityNames.has(name)) errors.push(`城市名称重复: ${name}`);
      cityNames.add(name);
      if (typeof desc !== "string") {
        errors.push(`${name} 缺少城市简介`);
      }
      if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
        errors.push(`${name} 纬度无效`);
      }
      if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
        errors.push(`${name} 经度无效`);
      }
      if (!Array.isArray(sights) || !sights.length) {
        errors.push(`${name} 缺少经典景点`);
      }
      if (full) {
        fullCityCount++;
        if (!data.some((item) => item.name === name)) {
          errors.push(`${region}/${province}/${name} 标记为精选但主页无对应详情`);
        }
      }
    }
  }
}

const missingFromLibrary = data
  .filter((item) => !cityNames.has(item.name))
  .map((item) => item.name);
if (missingFromLibrary.length) {
  errors.push(`城市库缺少主页目的地: ${missingFromLibrary.join("、")}`);
}
if (fullCityCount !== 9) {
  errors.push(`精选城市数量应为 9，当前为 ${fullCityCount}`);
}
if (allDestinations.length !== cityNames.size) {
  errors.push(`统一目的地目录 ${allDestinations.length} 条与城市库 ${cityNames.size} 座不一致`);
}
for (const city of allDestinations) {
  if (!Array.isArray(city.highlights) || !city.highlights.length) {
    errors.push(`${city.name} 缺少热门景点`);
  }
  if (!Array.isArray(city.tags) || !city.tags.length) {
    errors.push(`${city.name} 缺少旅行主题`);
  }
}
if (allDestinations.filter((city) => city.popular).length !== 9) {
  errors.push("首页精选城市数量不是 9");
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log(
  `数据校验通过：${allDestinations.length} 个城市目的地、` +
  `${new Set(allDestinations.map((item) => item.region)).size} 个旅行区域、` +
  `${allDestinations.reduce((sum, city) => sum + (city.highlights || []).length, 0)} 个首页景点入口，` +
  `其中 ${fullCityCount} 座为精选城市。`,
);
