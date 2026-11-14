"use strict";

const assert = require("assert");
const planner = require("../js/travel-planner");

const shanghai = {
  id: "shanghai",
  name: "上海",
  city: "上海",
  duration: 4,
  price: 3280,
  highlights: [
    "外滩",
    "东方明珠",
    "豫园",
    "上海迪士尼",
    "武康路·梧桐区",
    "上海博物馆",
    "朱家角"
  ]
};

const catalog = [shanghai];

for (const query of ["上海停留三天", "上海玩3天", "上海三天两晚"]) {
  const result = planner.plan(query, catalog);
  assert(result, `${query} should return a plan`);
  assert.strictEqual(result.intent.days, 3, `${query} should parse 3 days`);
  assert.strictEqual(result.itinerary.length, 3, `${query} should generate 3 days`);
}

const budgetPlan = planner.plan("上海三天预算5000", catalog);
assert.strictEqual(budgetPlan.intent.budget, 5000);
assert.strictEqual(budgetPlan.estimatedBudget, 2460);

const history = [
  { role: "user", content: "上海停留三天" },
  { role: "assistant", content: "已生成三天方案" }
];
const familyPlan = planner.plan("换成亲子方案", catalog, history);
assert.strictEqual(familyPlan.intent.city, "上海");
assert.strictEqual(familyPlan.intent.days, 3);
assert.strictEqual(familyPlan.selectedVariant, "family");
assert.strictEqual(familyPlan.itinerary.length, 3);
const disneyDay = familyPlan.itinerary.find(day => day.items.includes("上海迪士尼"));
assert(disneyDay, "Family plan should include Disney");
assert.strictEqual(
  disneyDay.items.filter(item => shanghai.highlights.includes(item)).length,
  1,
  "A full-day attraction must not be mixed with other attractions"
);

const culturePlan = planner.plan("上海三天文化游", catalog);
assert(
  !culturePlan.itinerary.some(day => day.items.includes("上海迪士尼")),
  "Culture plan should not force a theme park"
);

for (const result of [budgetPlan, familyPlan]) {
  const highlights = result.itinerary.flatMap(day =>
    day.items.filter(item => shanghai.highlights.includes(item))
  );
  assert.strictEqual(
    new Set(highlights).size,
    highlights.length,
    "A highlight must not repeat across the itinerary"
  );
}

console.log("TRAVEL_PLANNER_TESTS_PASSED");
