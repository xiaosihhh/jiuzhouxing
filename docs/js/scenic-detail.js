(function () {
  "use strict";

  const TYPE_INFO = {
    "历史古迹": { icon: "🏛️", color: "#F97316", text: "历史建筑、遗址与城市记忆", advice: "建议预留 2–3 小时，重点留意建筑布局、历史展陈和现场讲解。" },
    "寺庙": { icon: "🛕", color: "#D97706", text: "传统信仰、古建艺术与安静院落", advice: "建议避开正午客流高峰，进入宗教场所时遵守现场着装和拍摄规定。" },
    "公园": { icon: "🌳", color: "#16A34A", text: "城市绿地、园林景观与休闲空间", advice: "建议预留 1.5–3 小时，优先选择步行路线，并关注园区当天开放安排。" },
    "自然": { icon: "🏞️", color: "#0D9488", text: "山水地貌、自然生态与观景体验", advice: "天气对体验影响较大，出发前核对开放区域、索道或观光车运行状态。" },
    "山水": { icon: "⛰️", color: "#0891B2", text: "山岳、江河与地方自然风光", advice: "建议穿防滑鞋并预留交通接驳时间，雨雪天气及时调整路线。" },
    "博物馆": { icon: "🏺", color: "#7C3AED", text: "地方历史、文物收藏与主题展览", advice: "热门博物馆通常需要实名预约，建议提前查看闭馆日和预约规则。" },
    "古镇": { icon: "🏘️", color: "#BE123C", text: "传统街区、地方民居与慢节奏生活", advice: "清晨和傍晚更适合拍照，商业化街区的消费价格请以现场明示为准。" },
    "海岛": { icon: "🏝️", color: "#0284C7", text: "海岸、岛屿与亲水休闲体验", advice: "船班和海上项目受天气影响，出发前确认航运和景区实时通知。" },
    "海滩": { icon: "🌊", color: "#0EA5E9", text: "滨海步道、沙滩和日落景观", advice: "建议避开强紫外线时段，并留意潮汐、风浪和景区安全提示。" },
    "园林": { icon: "🪴", color: "#059669", text: "园林布局、水景与建筑审美", advice: "建议慢行游览，旺季提前预约，并关注园内限流和讲解服务。" },
    "都市": { icon: "🌆", color: "#2563EB", text: "城市地标、公共空间与夜景", advice: "夜景时段通常更受欢迎，建议错峰到达并预留返程交通时间。" },
    "演出": { icon: "🎭", color: "#C026D3", text: "地方文化与舞台演艺体验", advice: "演出场次和票价可能随日期变化，请以官方售票页面为准。" },
    "石窟": { icon: "🗿", color: "#A16207", text: "石窟艺术、造像与历史遗存", advice: "文物保护区域可能限制拍摄，请遵守现场标识并提前预约。" },
    "湖泊": { icon: "💧", color: "#0284C7", text: "湖泊景观、湿地生态与观景线路", advice: "环湖区域较大，建议根据体力选择一段精华路线，不必一次走完。" },
    "村落": { icon: "🏡", color: "#B45309", text: "传统村落、地方生活与田园景观", advice: "村内道路和公共服务条件各不相同，建议提前确认住宿与返程方式。" },
    "公路": { icon: "🛣️", color: "#475569", text: "公路沿线景观与自驾体验", advice: "自驾前检查车辆和天气，沿线补给点较少，请提前规划加油与休息。" },
    "奇观": { icon: "✨", color: "#7C3AED", text: "地质地貌和具有辨识度的自然奇观", advice: "建议根据光线和天气安排时段，并关注景区安全开放范围。" },
    "景点": { icon: "📍", color: "#0052FF", text: "城市代表性景观与旅行体验", advice: "开放时间和票务规则可能调整，出发前请以官方渠道为准。" }
  };

  const esc = value => String(value ?? "").replace(/[&<>"']/g, ch => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[ch]));

  function cityDestination(city) {
    return (window.ALL_CITY_DESTINATIONS || []).find(item => item.city === city || item.name === city) || null;
  }

  function citySights(city) {
    const costs = window.TRAVEL_COSTS || {};
    const key = Object.keys(costs).find(name => name.includes(city) || city.includes(name));
    return key && Array.isArray(costs[key].sights) ? costs[key].sights : [];
  }

  function typeInfo(type) {
    return TYPE_INFO[type] || TYPE_INFO["景点"];
  }

  function introFor(item, info) {
    const destination = cityDestination(item.city);
    const cityLine = destination?.description ? `${item.city}以“${destination.description}”的城市气质见长。` : "";
    return `${esc(item.name)}位于${esc(item.city)}，是当地具有代表性的${esc(info.text)}目的地。${esc(cityLine)} 这里适合通过步行、观景和现场讲解理解城市与自然之间的关系，也可作为当天行程中的核心停留点。`;
  }

  function ensureModal() {
    let modal = document.getElementById("scenicModal");
    if (modal) return modal;
    modal = document.createElement("div");
    modal.id = "scenicModal";
    modal.className = "modal scenic-detail-modal";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.innerHTML = `
      <div class="modal-backdrop" data-scenic-close></div>
      <div class="modal-card scenic-detail-card">
        <button class="modal-close" type="button" data-scenic-close aria-label="关闭景点介绍">✕</button>
        <div id="scenicDetailBody"></div>
      </div>`;
    document.body.appendChild(modal);
    modal.addEventListener("click", event => {
      if (event.target.hasAttribute("data-scenic-close")) {
        modal.hidden = true;
        document.body.style.overflow = "";
      }
    });
    return modal;
  }

  function openScenicDetail(item) {
    if (!item || !item.name) return;
    const type = item.type || "景点";
    const info = typeInfo(type);
    const modal = ensureModal();
    const body = document.getElementById("scenicDetailBody");
    const destination = cityDestination(item.city);
    const nearby = citySights(item.city).filter(sight => sight.name !== item.name).slice(0, 4);
    const imageCity = item.city || destination?.city || "北京";
    body.innerHTML = `
      <div class="scenic-hero" style="--scenic-color:${info.color}">
        <img src="assets/cities/${encodeURIComponent(imageCity)}.webp" alt="${esc(item.name)}"/>
        <div class="scenic-hero-shade"></div>
        <div class="scenic-hero-copy">
          <span class="scenic-type">${info.icon} ${esc(type)}</span>
          <small>${esc(item.city)} · 九州行景点档案</small>
          <h2>${esc(item.name)}</h2>
        </div>
      </div>
      <div class="scenic-content">
        <div class="scenic-main">
          <section class="scenic-intro">
            <span>ABOUT THIS PLACE</span>
            <h3>景点介绍</h3>
            <p>${introFor(item, info)}</p>
          </section>
          <section class="scenic-advice">
            <div class="scenic-advice-icon">${info.icon}</div>
            <div><b>游览建议</b><p>${esc(info.advice)}</p></div>
          </section>
          ${nearby.length ? `<section class="scenic-nearby">
            <div class="scenic-section-head"><h3>同城还可游览</h3><span>${esc(item.city)}精选</span></div>
            <div class="scenic-nearby-grid">${nearby.map(sight => `<button type="button" data-nearby-name="${esc(sight.name)}" data-nearby-type="${esc(sight.type || "景点")}" data-nearby-price="${esc(sight.cny || sight.local_price || "")}"><span>${typeInfo(sight.type).icon}</span><div><b>${esc(sight.name)}</b><small>${esc(sight.cny || sight.local_price || "门票参考待核对")}</small></div></button>`).join("")}</div>
          </section>` : ""}
        </div>
        <aside class="scenic-side">
          <div class="scenic-facts">
            <div><span>所在城市</span><b>${esc(item.city)}</b></div>
            <div><span>景点类型</span><b>${info.icon} ${esc(type)}</b></div>
            <div><span>门票参考</span><b>${esc(item.price || "以官方页面为准")}</b></div>
            <div><span>建议停留</span><b>${type === "古镇" || type === "山水" ? "3–5 小时" : "2–3 小时"}</b></div>
            <div><span>最佳季节</span><b>${esc(destination?.bestSeason || "四季皆宜")}</b></div>
          </div>
          <div class="scenic-booking-note">价格、开放区域和预约要求可能随季节调整，请出发前在官方平台核对。</div>
          <a class="btn-accent scenic-route-btn" href="route.html?to=${encodeURIComponent(item.city)}">规划前往 ${esc(item.city)} 的路线 →</a>
          <a class="btn-ghost scenic-route-btn" href="hotel.html?city=${encodeURIComponent(item.city)}">查看附近住宿参考</a>
        </aside>
      </div>`;
    modal.hidden = false;
    document.body.style.overflow = "hidden";
    requestAnimationFrame(() => modal.querySelector(".modal-close")?.focus());
    body.querySelectorAll("[data-nearby-name]").forEach(button => {
      button.addEventListener("click", () => openScenicDetail({
        name: button.dataset.nearbyName,
        city: item.city,
        type: button.dataset.nearbyType,
        price: button.dataset.nearbyPrice
      }));
    });
  }

  window.openScenicDetail = openScenicDetail;
  const params = new URLSearchParams(location.search);
  const scenicName = params.get("site");
  if (scenicName) {
    setTimeout(() => openScenicDetail({
      name: scenicName,
      city: params.get("city") || cityDestination(scenicName)?.city || "北京",
      type: params.get("type") || "景点",
      price: params.get("price") || ""
    }), 700);
  }
})();
