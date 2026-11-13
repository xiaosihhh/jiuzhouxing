(function(){
  "use strict";
  const data = window.ALL_CITY_DESTINATIONS || window.TRAVEL_DATA || [];
  const $ = s => document.querySelector(s);
  const fmt = n => "¥" + n.toLocaleString();
  const esc = s => String(s??"").replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

  /* ---- 本地 SVG 封面生成（离线可用，替代外网图片） ---- */
  const PALETTES = [["#0f2027","#203a43","#2c5364"],["#1a2980","#26d0ce"],["#134e5e","#71b280"],["#614385","#516395"],["#41295a","#2F0743"],["#3a6186","#89253e"],["#0f3443","#34e89e"],["#1F1C2C","#928DAB"],["#355C7D","#6C5B7B"],["#141E30","#243B55"]];
  const EMOJI = {beijing:"🏮",xian:"🏯",shanghai:"🌃",hangzhou:"🌊",chengdu:"🐼",chongqing:"🌆",sanya:"🏖️",lasa:"🏔️",wulumuqi:"🐫",kanasi:"🏞️",tokyo:"🗼",kyoto:"⛩️",osaka:"🎡",seoul:"🛍️",jeju:"🌋",bangkok:"🛕",phuket:"🏝️",siemreap:"🏛️",singapore:"🦁",hanoi:"🏮",kualalumpur:"🗼",bali:"🌺",delhi:"🏰",agra:"🕌",kathmandu:"🗿",colombo:"🚂",kandy:"🛕",dubai:"🏙️",istanbul:"🕌",paris:"🗼",london:"🎡",rome:"🏛️",barcelona:"⛲",interlaken:"🏔️",athens:"🏛️",santorini:"🌊",berlin:"🏛️",prague:"🌉",budapest:"♨️",moscow:"⛪",reykjavik:"🌌",oslo:"🛶",bergen:"🏡",newyork:"🗽",losangeles:"🎬",sanfrancisco:"🌉",vancouver:"🌲",toronto:"🗼",cancun:"🌊",mexicocity:"💀",rio:"⛰️",buenosaires:"💃",cusco:"🏔️",havana:"🚗",cairo:"🔺",marrakech:"🕌",nairobi:"🦁",capetown:"🌊",zanzibar:"🏝️",sydney:"🦘",melbourne:"☕",queenstown:"🏔️",nadi:"🌺"};
  function hashCode(s){let h=0;for(let i=0;i<s.length;i++){h=(h<<5)-h+s.charCodeAt(i);h|=0}return Math.abs(h)}
  function fallbackCover(d,w,h){
    w=w||600;h=h||400;
    const key=d.id||d.name;
    const p=PALETTES[hashCode(key)%PALETTES.length];
    const gid="gx"+hashCode(key);
    const stops=p.map((c,i)=>`<stop offset="${Math.round(i/(p.length-1)*100)}%" stop-color="${c}"/>`).join("");
    const emo=EMOJI[key]||"✈️";
    const t1=Math.round(h*0.30), t2=t1+Math.round(h*0.13);
    const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs><linearGradient id="${gid}" x1="0" y1="0" x2="1" y2="1">${stops}</linearGradient></defs><rect width="${w}" height="${h}" fill="url(#${gid})"/><circle cx="${Math.round(w*0.84)}" cy="${Math.round(h*0.2)}" r="${Math.round(w*0.16)}" fill="none" stroke="#fff" stroke-opacity=".14" stroke-width="2"/><path d="M0 ${Math.round(h*0.78)} Q${Math.round(w*0.25)} ${Math.round(h*0.66)} ${Math.round(w*0.5)} ${Math.round(h*0.76)} T${w} ${Math.round(h*0.7)} V${h} H0 Z" fill="#000" fill-opacity=".12"/><text x="${Math.round(w*0.06)}" y="${t1}" font-family="PingFang SC,Microsoft YaHei,sans-serif" font-size="${Math.round(w*0.1)}" font-weight="700" fill="#fff">${esc(d.name)}</text><text x="${Math.round(w*0.063)}" y="${t2}" font-family="PingFang SC,sans-serif" font-size="${Math.round(w*0.028)}" fill="#fff" fill-opacity=".78">${esc(d.country)} · ${esc(d.region)}</text><text x="${Math.round(w*0.86)}" y="${Math.round(h*0.34)}" font-size="${Math.round(w*0.07)}">${esc(emo)}</text></svg>`;
    return "data:image/svg+xml;charset=utf-8,"+encodeURIComponent(svg);
  }
  function localCityImage(city){
    return "assets/cities/"+encodeURIComponent(city)+".webp";
  }
  function cover(d){
    return localCityImage(d.city||d.name||"中国");
  }

  /* ---- 本地城市封面：随项目分发，不依赖第三方图片网络 ---- */
  function photoSearch(el,d){
    el.src=localCityImage(d.city||d.name||"中国");
  }
  const photoObs=("IntersectionObserver" in window)?new IntersectionObserver(es=>{
    es.forEach(en=>{if(en.isIntersecting){const t=en.target;photoObs.unobserve(t);photoSearch(t,t._d);}});
  },{rootMargin:"300px"}):null;

  /* ---- 主题 ---- */
  const savedTheme = localStorage.getItem("theme") || (matchMedia("(prefers-color-scheme:dark)").matches?"dark":"light");
  document.documentElement.setAttribute("data-theme", savedTheme);
  $("#themeToggle").addEventListener("click", ()=>{
    const cur = document.documentElement.getAttribute("data-theme");
    const next = cur==="dark"?"light":"dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
    if(map) map.invalidateSize();
  });

  /* ---- 筛选项填充 ---- */
  const regions = [...new Set(data.map(d=>d.region))];
  const tags = [...new Set(data.flatMap(d=>d.tags))];
  const fr = $("#filterRegion"), ft = $("#filterTag");
  regions.forEach(r=>fr.insertAdjacentHTML("beforeend",`<option value="${esc(r)}">${esc(r)}</option>`));
  tags.forEach(t=>ft.insertAdjacentHTML("beforeend",`<option value="${esc(t)}">${esc(t)}</option>`));

  /* ---- 状态 ---- */
  const BUDGET_MIN=1000, BUDGET_MAX=10000;
  let state = { q:"", region:"", tag:"", sort:"popular", priceMax:BUDGET_MAX };

  function filtered(){
    let r = data.slice();
    const q = state.q.trim().toLowerCase();
    if(q) r = r.filter(d=> d.name.toLowerCase().includes(q)||d.city.toLowerCase().includes(q)||d.country.toLowerCase().includes(q)||d.tags.some(t=>t.toLowerCase().includes(q))||d.highlights.some(h=>h.toLowerCase().includes(q))||d.description.toLowerCase().includes(q));
    if(state.region) r = r.filter(d=>d.region===state.region);
    if(state.tag) r = r.filter(d=>d.tags.includes(state.tag));
    r = r.filter(d=>d.price<=state.priceMax);
    switch(state.sort){
      case "priceAsc": r.sort((a,b)=>a.price-b.price); break;
      case "priceDesc": r.sort((a,b)=>b.price-a.price); break;
      case "ratingDesc": r.sort((a,b)=>b.rating-a.rating||b.reviews-a.reviews); break;
      case "durationAsc": r.sort((a,b)=>a.duration-b.duration); break;
      default: r.sort((a,b)=>(b.popular?1:0)-(a.popular?1:0)||b.rating-a.rating);
    }
    return r;
  }

  /* ---- 渲染卡片（默认先展示 9 个精选，继续加载覆盖全部城市） ---- */
  const grid = $("#cardGrid"), empty = $("#emptyState"), countEl = $("#resultCount"), moreWrap = $("#loadMoreWrap");
  const PAGE = 9;
  let visible = PAGE;
  function isBrowsing(){ return !state.q && !state.region && !state.tag && state.sort==="popular" && state.priceMax>=BUDGET_MAX; }
  function renderMore(total, browsing){
    if(!browsing || total===0){ moreWrap.hidden = true; moreWrap.innerHTML=""; return; }
    moreWrap.hidden = false;
    if(visible < total){
      moreWrap.innerHTML = `<button id="loadMoreBtn" class="more-btn" aria-label="加载更多精选目的地"><span class="more-main">加载更多精选</span><small class="more-sub">还有 ${total-visible} 个目的地待探索</small><span class="more-arrow">→</span></button>`;
      $("#loadMoreBtn").addEventListener("click", ()=>{ visible += PAGE; render(); moreWrap.scrollIntoView({behavior:"smooth",block:"nearest"}); });
    }else{
      moreWrap.innerHTML = `<a href="cities.html" class="more-btn more-link" aria-label="前往中国城市库"><span class="more-main">探索中国城市库</span><small class="more-sub">八大区域 · 每城经典景点与门票参考</small><span class="more-arrow">→</span></a>`;
    }
  }
  function render(){
    const list = filtered();
    const browsing = isBrowsing();
    const show = browsing ? list.slice(0, visible) : list;
    countEl.textContent = browsing && list.length>visible ? `${show.length} / ${list.length}` : list.length;
    if(list.length===0){ grid.innerHTML=""; empty.hidden=false; moreWrap.hidden=true; moreWrap.innerHTML=""; return; }
    empty.hidden=true;
    grid.innerHTML = show.map((d,i)=>`
      <article class="card" data-id="${esc(d.id)}" tabindex="0" role="button" aria-label="查看${esc(d.name)}详情" style="animation-delay:${Math.min(i*0.05,0.5)}s">
        <div class="card-img">
          <img src="${cover(d)}" alt="${esc(d.name)}" loading="lazy" data-city="${esc(d.id)}"/>
          ${d.popular?`<span class="card-badge">热门</span>`:""}
          <span class="card-rating">★ ${d.rating}</span>
        </div>
        <div class="card-body">
          <div class="card-loc">${esc(d.country)} · ${esc(d.region)} · ${d.duration}天</div>
          <h3 class="card-name">${esc(d.name)}</h3>
          <p class="card-desc">${esc(d.description)}</p>
          <div class="card-tags">${d.tags.map(t=>`<span class="tag">${esc(t)}</span>`).join("")}</div>
          <div class="card-foot">
            <div class="card-price">${fmt(d.price)} <small>/人</small></div>
            <div class="card-meta">${d.reviews.toLocaleString()} 评价<br/>最佳：${d.bestSeason}</div>
          </div>
        </div>
      </article>`).join("");
    grid.querySelectorAll(".card").forEach(c=>{
      c.addEventListener("click",()=>openModal(c.dataset.id));
      c.addEventListener("keydown",e=>{
        if(e.key==="Enter"||e.key===" "){e.preventDefault();openModal(c.dataset.id);}
      });
    });
    grid.querySelectorAll(".card-img img").forEach(el=>{el._d=data.find(x=>x.id===el.dataset.city);if(el._d&&photoObs)photoObs.observe(el);});
    renderMore(list.length, browsing);
  }

  /* ---- 事件 ---- */
  const si = $("#searchInput"), sc = $("#searchClear");
  let debounceT;
  si.addEventListener("input", e=>{
    state.q = e.target.value;
    sc.classList.toggle("show", !!state.q);
    clearTimeout(debounceT); debounceT=setTimeout(render,180);
  });
  sc.addEventListener("click", ()=>{ si.value=""; state.q=""; sc.classList.remove("show"); render(); });
  fr.addEventListener("change", e=>{state.region=e.target.value;render();});
  ft.addEventListener("change", e=>{state.tag=e.target.value;render();});
  $("#sortSel").addEventListener("change", e=>{state.sort=e.target.value;render();});
  const pm = $("#priceMax"), pml = $("#priceMaxLabel");
  const priceLabel = ()=> "¥"+state.priceMax.toLocaleString();
  const syncChips = ()=> document.querySelectorAll(".p-chip").forEach(x=>x.classList.toggle("active",+x.dataset.p===state.priceMax));
  pm.addEventListener("input", e=>{state.priceMax=+e.target.value;pml.textContent=priceLabel();syncChips();clearTimeout(debounceT);debounceT=setTimeout(render,120);});
$("#resetFilters").addEventListener("click", ()=>{
    state={q:"",region:"",tag:"",sort:"popular",priceMax:BUDGET_MAX};
    visible=PAGE;
    si.value="";sc.classList.remove("show");fr.value="";ft.value="";$("#sortSel").value="popular";pm.value=BUDGET_MAX;pml.textContent=priceLabel();
    syncChips();
    render();
  });
  document.querySelectorAll(".p-chip").forEach(c=>c.addEventListener("click",()=>{
    state.priceMax=+c.dataset.p;
    pm.value=Math.min(Math.max(state.priceMax,BUDGET_MIN),BUDGET_MAX);
    pml.textContent=priceLabel();
    syncChips();
    render();
  }));

  /* ---- 弹窗 ---- */
  const modal = $("#modal"), modalBody = $("#modalBody");
  /* ---- 景点类型识别（关键词 → 类型 + emoji） ---- */
  function sightType(name){
    const n = (name||"").toLowerCase();
    const rules = [
      ["科技馆","🔬",["科技馆","科学馆","科学中心","科学博物馆","科技","science"]],
      ["博物馆","🏛️",["博物馆","美术馆","艺术馆","museum","gallery","卢浮宫"]],
      ["动物园","🐼",["动物园","海洋馆","水族馆","熊猫","野生动物"]],
      ["植物园","🌿",["植物园","植物","花卉","garden","花园"]],
      ["历史古迹","🗿",["长城","故宫","兵马俑","遗址","古迹","陵","卫城","斗兽场","金字塔","吴哥","城堡","凯旋门","纪念碑","城墙","考古","皇宫","王宫","遗迹","神庙","神殿","石窟","要塞","王陵","古"]],
      ["寺庙","🛕",["寺","庙","祠","宫","教堂","清真寺","修道院","神社","佛","temple","church","cathedral","shrine","mosque"]],
      ["公园","🌳",["公园","园林","园"]],
    ];
    for(const [t,e,ks] of rules){ if(ks.some(k=>n.includes(k.toLowerCase()))) return {t,e}; }
    return {t:"景点",e:"📍"};
  }
  /* ---- 必游景点：合并 highlights 与真实门票数据 ---- */
  function buildHighlights(d){
    const C = window.TRAVEL_COSTS||{};
    const key = Object.keys(C).find(k=>k.includes(d.city)||d.city.includes(k));
    const sights = key ? (C[key].sights||[]) : [];
    const items = d.highlights.map(h=>{
      const s = sights.find(x=>h.includes(x.name)||x.name.includes(h)||(x.name.length>2&&h.includes(x.name.slice(0,2))));
      return {name:h, price:s?(s.cny||s.local_price||""):"", ty:sightType(h)};
    });
    sights.forEach(s=>{
      if(!items.some(it=>it.name.includes(s.name)||s.name.includes(it.name)))
        items.push({name:s.name, price:s.cny||s.local_price||"", ty:sightType(s.name)});
    });
    return `<div class="m-highlights"><h4>必游景点 <small>点击景点查看介绍 · 出行前请核对官方信息</small></h4><div class="hl-list">${items.map((it,i)=>`<button type="button" class="hl-item scenic-link" data-scenic-name="${esc(it.name)}" data-scenic-city="${esc(d.city)}" data-scenic-type="${esc(it.ty.t)}" data-scenic-price="${esc(it.price)}"><span class="hl-num">${i+1}</span><div class="hl-body"><b>${esc(it.name)}</b><div class="hl-meta"><span class="hl-type">${it.ty.e} ${it.ty.t}</span>${it.price?`<span class="hl-price">🎟 ${esc(it.price)}</span>`:`<span class="hl-price hl-free">无需门票/未知</span>`}</div></div><span class="hl-arrow">›</span></button>`).join("")}</div></div>`;
  }
  function buildCosts(city){
    const C = window.TRAVEL_COSTS; if(!C) return "";
    const key = Object.keys(C).find(k=>k.includes(city)||city.includes(k));
    if(!key) return "";
    const c = C[key];
    const sec = (title,arr)=>(arr&&arr.length)?`<details class="cost-grp"><summary>${title}<span class="cg-cnt">${arr.length}</span></summary><div class="cost-list">${arr.map(it=>`<div class="cost-item"><div class="ci-name">${esc(it.name||"")}</div><div class="ci-price">${esc(it.cny||it.local_price||"")}</div>${it.note?`<div class="ci-note">${esc(it.note)}</div>`:""}</div>`).join("")}</div></details>`:"";
    const cur = c.currency?`<div class="cost-line"><span class="cl-k">💱 货币</span><span class="cl-v">${esc(c.currency.local_price||"")}${c.currency.cny?" · "+esc(c.currency.cny):""}</span></div>`:"";
    const visa = c.visa&&c.visa.cny&&c.visa.cny!=="—"?`<div class="cost-line"><span class="cl-k">📄 签证</span><span class="cl-v">${esc(c.visa.cny)}</span></div>`:"";
    return `<div class="m-costs"><h4>💰 旅行花费参考<small>价格随季节与汇率变化，请以官方渠道为准</small></h4>${cur}${visa}${sec("景点门票",c.sights)}${sec("市内交通",c.transport)}${sec("住宿",c.accommodation)}${sec("美食",c.food)}${sec("每日预算",c.daily_budget)}${sec("生活成本",c.cost_of_living)}</div>`;
  }
  let lastFocused=null;
  function openModal(id){
    const d = data.find(x=>x.id===id); if(!d) return;
    lastFocused=document.activeElement;
    modalBody.innerHTML = `
      <div class="m-hero">
        <img id="mHeroImg" src="${cover(d,1200,700)}" alt="${esc(d.name)}"/>
        <div class="m-hero-shade"></div>
        <div class="m-hero-top">
          <span class="m-hero-kicker">九州行 · 城市档案</span>
          <span class="m-hero-rating">★ ${d.rating} <small>${d.reviews.toLocaleString()} 条评价</small></span>
        </div>
      </div>
      <div class="m-info">
        <section class="m-insight-card">
          ${mTip(d)}
          <div class="m-quick-stats">
            <div class="m-cell"><span>人均参考</span><b>${fmt(d.price)}</b></div>
            <div class="m-cell"><span>建议停留</span><b>${d.duration} 天</b></div>
            <div class="m-cell"><span>最佳季节</span><b>${esc(d.bestSeason)}</b></div>
          </div>
        </section>
        <div class="m-heading-row">
          <div>
            <div class="m-loc">${esc(d.country)} / ${esc(d.region)} / ${esc(d.city)}</div>
            <h2 class="m-name">${esc(d.name)}</h2>
            <p class="m-desc">${esc(d.description)}</p>
          </div>
          <div class="m-tags">${d.tags.map(t=>`<span class="tag">${esc(t)}</span>`).join("")}</div>
        </div>
        ${mActions(d)}
        <div class="m-content-layout">
          <div class="m-primary-column">
            ${buildHighlights(d)}
            ${buildCosts(d.city)}
          </div>
          <aside class="m-side-column">
            ${mCommunityShell(d)}
          </aside>
        </div>
      </div>`;
    modal.hidden=false;
    document.body.style.overflow="hidden";
    requestAnimationFrame(()=>modal.querySelector(".modal-close")?.focus());
    const hEl=$("#mHeroImg"); if(hEl)photoSearch(hEl,d);
    const at=modalBody.querySelector("[data-adtrip]");
    if(at)at.addEventListener("click",()=>{
      const inT=trip.items.some(x=>x.id===d.id);
      if(inT){removeFromTrip(d.id);at.textContent="＋ 加入行程单";at.classList.remove("done");}
      else{addToTrip(d.id);at.textContent="✓ 已加入行程单";at.classList.add("done");}
    });
    const fv=modalBody.querySelector("[data-fav]");
    if(fv)fv.addEventListener("click",()=>{
      if(fav.has(d.id)){fav.delete(d.id);fv.textContent="♡ 收藏";fv.classList.remove("on");}
      else{fav.add(d.id);fv.textContent="♥ 已收藏";fv.classList.add("on");}
      saveFav();
    });
    modalBody.querySelectorAll("[data-scenic-name]").forEach(item=>{
      item.addEventListener("click",()=>{
        if(typeof window.openScenicDetail==="function")window.openScenicDetail({
          name:item.dataset.scenicName,
          city:item.dataset.scenicCity,
          type:item.dataset.scenicType,
          price:item.dataset.scenicPrice
        });
      });
    });
    loadCityCommunity(d);
  }
  function mTip(d){
    const C=window.TRAVEL_COSTS||{};const key=Object.keys(C).find(k=>k.includes(d.city)||d.city.includes(k));
    const vi=key?((C[key].visa&&C[key].visa.cny)||""):"";
    return `<div class="m-tip">
      <span class="m-tip-icon">✓</span>
      <div class="m-tip-copy">
        <span>出行可行性检查</span>
        <b>${d.duration} 天 · ${esc(d.bestSeason)} · 约 ${fmt(Math.round(d.price*1.15))}/人</b>
        <p>${vi&&vi!=="—"?`签证参考：${esc(vi)}。`:"路线、门票与住宿均已纳入预算检查。"}价格为参考值，预订前请在官方平台核对。</p>
      </div>
    </div>`;
  }
  function mActions(d){
    const inTrip=trip.items.some(x=>x.id===d.id);
    const liked=fav.has(d.id);
    return `<div class="m-actions">
      <button class="act-btn act-trip ${inTrip?"done":""}" data-adtrip="${d.id}"><span>${inTrip?"✓":"＋"}</span>${inTrip?"已加入行程单":"加入行程单"}</button>
      <button class="act-btn act-like ${liked?"on":""}" data-fav="${d.id}"><span>${liked?"♥":"♡"}</span>${liked?"已收藏":"收藏"}</button>
      <a class="act-btn" href="hotel.html?city=${encodeURIComponent(d.city)}"><span>⌂</span>住宿参考</a>
      <a class="act-btn" href="route.html?to=${encodeURIComponent(d.city)}"><span>↗</span>出行路线</a>
    </div>`;
  }
  function mCommunityShell(d){
    return `<section class="m-community" data-city-community>
      <div class="m-community-head">
        <div><span>COMMUNITY PICKS</span><h3>社区影像与评论</h3></div>
        <a href="community.html" target="_blank" rel="noopener">进入广场 ↗</a>
      </div>
      <div class="m-community-body">
        <div class="m-community-loading"><i></i><span>正在载入 ${esc(d.name)} 的旅行分享…</span></div>
      </div>
    </section>`;
  }
  async function loadCityCommunity(d){
    const shell=modalBody.querySelector("[data-city-community]");
    if(!shell)return;
    const requestKey=d.id+"-"+Date.now();
    shell.dataset.requestKey=requestKey;
    try{
      const response=await fetch(apiBase+"/api/community/posts",{cache:"no-store"});
      if(!response.ok)throw new Error("community unavailable");
      const body=await response.json();
      if(shell.dataset.requestKey!==requestKey)return;
      const aliases=new Set([d.city,d.name,"壮美中国","中国"]);
      const posts=(Array.isArray(body.posts)?body.posts:[])
        .filter(post=>aliases.has(String(post.city||"").trim()))
        .slice(0,2);
      const target=shell.querySelector(".m-community-body");
      if(!target)return;
      target.innerHTML=posts.length?posts.map(post=>{
        const media=(post.media||[])[0];
        const video=media&&(media.type==="video"||/^video\//.test(media.type||""));
        const comments=(Array.isArray(post.comments)?post.comments:[]).slice(-2);
        const mediaHTML=media?`<div class="m-community-media">${video
          ?`<video src="${esc(media.url)}" poster="${cover(d)}" controls playsinline preload="metadata"></video><span>▶ 视频分享</span>`
          :`<img src="${esc(media.url)}" alt="${esc(post.caption||"旅行分享")}"/><span>📷 影像分享</span>`}</div>`:"";
        return `<article class="m-community-card" data-post="${esc(post.id)}">
          ${mediaHTML}
          <div class="m-community-copy">
            <div class="m-community-author">
              <span>${esc((post.nickname||"旅行者").slice(0,1))}</span>
              <div><b>${esc(post.nickname||"旅行者")}</b><small>${esc(post.city||"中国")} · ${relativeCommunityTime(post.createdAt)}</small></div>
              <em>${Array.isArray(post.likes)?post.likes.length:0} 赞</em>
            </div>
            <p>${esc(post.caption||"分享一段旅途见闻")}</p>
            <div class="m-community-comments">
              <div class="m-community-comments-title">最新评论 <b>${Array.isArray(post.comments)?post.comments.length:0}</b></div>
              ${comments.length?comments.map(c=>`<div class="m-community-comment"><span>${esc((c.nickname||"旅").slice(0,1))}</span><div><b>${esc(c.nickname||"旅行者")}</b><p>${esc(c.text||"")}</p></div></div>`).join(""):`<p class="m-community-empty">还没有评论，登录后可以在社区留下你的见闻。</p>`}
              <form class="m-community-comment-form" data-detail-comment="${esc(post.id)}">
                <input name="text" maxlength="200" placeholder="写下你的评论…" aria-label="评论内容"/>
                <button type="submit">发送</button>
              </form>
              <div class="m-community-form-status" aria-live="polite"></div>
              <a class="m-community-more" href="community.html?post=${encodeURIComponent(post.id)}" target="_blank" rel="noopener">查看完整分享与评论 →</a>
            </div>
          </div>
        </article>`;
      }).join(""):`<div class="m-community-no-post"><span>✦</span><b>这里还没有同城分享</b><p>成为第一个记录 ${esc(d.name)} 的人，上传照片或视频后可同步展示在详情页。</p><a class="btn-accent btn-sm" href="community.html" target="_blank" rel="noopener">去发布第一条 →</a></div>`;
      target.querySelectorAll("[data-detail-comment]").forEach(form=>{
        form.addEventListener("submit",async event=>{
          event.preventDefault();
          const status=form.parentElement.querySelector(".m-community-form-status");
          const input=form.querySelector("input");
          const text=String(input.value||"").trim();
          if(!text){status.textContent="请先输入评论内容";return;}
          form.querySelector("button").disabled=true;
          status.textContent="正在发布…";
          try{
            const result=await fetch(apiBase+"/api/community/posts/"+encodeURIComponent(form.dataset.detailComment)+"/comments",{
              method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({text})
            });
            const payload=await result.json().catch(()=>({}));
            if(!result.ok)throw new Error(result.status===401?"请先在“我的”中登录":payload.error||"评论发布失败");
            status.textContent="评论已发布";
            input.value="";
            setTimeout(()=>loadCityCommunity(d),320);
          }catch(error){
            status.textContent=error.message;
            if(/登录/.test(error.message)){
              const login=document.querySelector("[data-my-open]");
              if(login)login.click();
            }
          }finally{
            form.querySelector("button").disabled=false;
          }
        });
      });
    }catch{
      const target=shell.querySelector(".m-community-body");
      if(target)target.innerHTML=`<div class="m-community-no-post"><span>✦</span><b>社区内容暂时未连接</b><p>其余城市信息不受影响，可稍后刷新重试。</p></div>`;
    }
  }
  function closeModal(){
    modal.hidden=true;
    document.body.style.overflow="";
    if(lastFocused&&lastFocused.isConnected)lastFocused.focus();
  }
  modal.addEventListener("click", e=>{if(e.target.hasAttribute("data-close"))closeModal();});
  document.addEventListener("keydown", e=>{if(e.key==="Escape"){closeModal();closeAI();closeQR();closeTrip();closeRoute();closePlanner();}});

  /* ---- 地图 ---- */
  let map; const mapMarkers={};
  function markerIcon(d,inTrip){
    const s=22;
    const html=`<div style="width:${s}px;height:${s}px;border-radius:50%;background:${inTrip?"#F6A800":(d.popular?"#0052FF":"#4D7CFF")};border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.45)${inTrip?",0 0 0 6px rgba(246,168,0,.22)":""};${d.popular&&!inTrip?"animation:pulse 2s infinite;":""}"></div>`;
    return L.divIcon({className:"mk",html,iconSize:[s,s],iconAnchor:[s/2,s/2]});
  }
  function mapPopupHTML(d){
    const C=window.TRAVEL_COSTS||{};
    const key=Object.keys(C).find(k=>k.includes(d.city)||d.city.includes(k));
    const sights=key?(C[key].sights||[]).slice(0,4):[];
    return `<div class="pp-box" data-id="${d.id}">
      <img class="pp-img" src="${cover(d,280,150)}" alt="${esc(d.name)}"/>
      <div class="pp-head"><b>${esc(d.name)}</b><span>${esc(d.country)} · ${esc(d.city)} · ${d.duration}天 · ★${d.rating}</span></div>
      <div class="pp-price">${fmt(d.price)}<small> /人</small></div>
      ${sights.length?`<div class="pp-sights"><div class="pp-st">🎟 热门门票参考</div>${sights.map(s=>`<button type="button" class="pp-sight" data-scenic-name="${esc(s.name)}" data-scenic-type="${esc(sightType(s.name).t)}" data-scenic-price="${esc(s.cny||s.local_price||"")}"><span>${esc(s.name)}</span><b>${esc(s.cny||s.local_price||"")}</b></button>`).join("")}</div>`:""}
      <button class="pp-btn" data-open="${d.id}">查看完整详情 →</button>
    </div>`;
  }
  function initMap(){
    if(!window.L){
      $("#map").innerHTML='<div class="feature-fallback"><b>地图组件未加载</b><span>目的地列表、筛选和行程规划仍可正常使用。</span></div>';
      return;
    }
    map = L.map("map",{scrollWheelZoom:false,worldCopyJump:true}).setView([32,110],4);
    const tiles=L.tileLayer("https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=7&x={x}&y={y}&z={z}",{subdomains:"1234",attribution:"© 高德地图",minZoom:3,maxZoom:18}).addTo(map);
    let tileFailures=0;
    tiles.on("tileerror",()=>{
      tileFailures++;
      if(tileFailures===3&&!map.getContainer().querySelector(".map-offline-note")){
        const note=document.createElement("div");
        note.className="map-offline-note";
        note.textContent="地图底图暂不可用，目的地标记和详情仍可正常使用";
        map.getContainer().appendChild(note);
      }
    });
    tiles.on("tileload",()=>{map.getContainer().querySelector(".map-offline-note")?.remove();});
    data.forEach(d=>{
      const m = L.marker([d.lat,d.lng],{icon:markerIcon(d,false),title:d.name}).addTo(map);
      mapMarkers[d.id]=m;
      m.bindPopup(mapPopupHTML(d),{maxWidth:290});
    });
    map.on("popupopen", e=>{
      const el=e.popup.getElement(); if(!el)return;
      const box=el.querySelector(".pp-box"); if(!box)return;
      const d0=data.find(x=>x.id===box.dataset.id);
      const im=el.querySelector(".pp-img");
      if(d0&&im)photoSearch(im,d0);
      const btn=el.querySelector(".pp-btn");
      if(btn&&!btn._b){btn._b=1;btn.addEventListener("click",()=>{map.closePopup();openModal(btn.dataset.open);});}
      el.querySelectorAll("[data-scenic-name]").forEach(item=>item.addEventListener("click",()=>{
        map.closePopup();
        if(typeof window.openScenicDetail==="function")window.openScenicDetail({
          name:item.dataset.scenicName,
          city:d0?.city||"北京",
          type:item.dataset.scenicType,
          price:item.dataset.scenicPrice
        });
      }));
    });
    const st = document.createElement("style"); st.textContent="@keyframes pulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.4);opacity:.6}}"; document.head.appendChild(st);
    setTimeout(()=>{if(map)map.invalidateSize();},400);
  }

  /* ---- 热门景点、社区视频与搜索趋势 ---- */
  const HOT_SIGHTS=[
    {name:"故宫博物院",city:"北京",type:"历史古迹",price:"¥60",tag:"古建顶流"},
    {name:"布达拉宫",city:"拉萨",type:"历史古迹",price:"¥200",tag:"雪域名片"},
    {name:"西湖",city:"杭州",type:"自然",price:"免费",tag:"江南人气"},
    {name:"亚龙湾",city:"三亚",type:"海滩",price:"免费",tag:"海岛度假"},
    {name:"秦始皇兵马俑博物馆",city:"西安",type:"历史古迹",price:"¥120",tag:"世界遗产"},
    {name:"洪崖洞",city:"重庆",type:"都市",price:"免费",tag:"夜景热门"},
    {name:"成都大熊猫繁育研究基地",city:"成都",type:"自然",price:"¥55",tag:"亲子首选"},
    {name:"外滩",city:"上海",type:"都市",price:"免费",tag:"城市地标"}
  ];
  function renderStats(){
    const rank=$("#hotAttractionRank");
    if(rank){
      rank.innerHTML=HOT_SIGHTS.map((item,index)=>{
        const city=data.find(d=>d.name===item.city||d.city===item.city);
        return `<button type="button" class="hot-attraction" data-hot-sight="${esc(item.name)}" data-hot-city="${esc(item.city)}" data-hot-type="${esc(item.type)}" data-hot-price="${esc(item.price)}">
          <span class="hot-rank ${index<3?"podium":""}">${String(index+1).padStart(2,"0")}</span>
          <span class="hot-attraction-photo"><img src="${localCityImage(item.city)}" alt="${esc(item.name)}"/><i>${esc(item.tag)}</i></span>
          <span class="hot-attraction-info"><b>${esc(item.name)}</b><small>${esc(item.city)} · ${esc(item.type)}</small></span>
          <span class="hot-attraction-price">${esc(item.price)}<small>门票参考</small></span>
          <span class="hot-attraction-arrow">›</span>
        </button>`;
      }).join("");
      rank.querySelectorAll("[data-hot-sight]").forEach(item=>item.addEventListener("click",()=>{
        if(typeof window.openScenicDetail==="function")window.openScenicDetail({
          name:item.dataset.hotSight,
          city:item.dataset.hotCity,
          type:item.dataset.hotType,
          price:item.dataset.hotPrice
        });
      }));
    }

    const tags=$("#hotSearchTags");
    if(tags){
      const searches=[
        {q:"故宫",label:"故宫怎么预约",meta:"文化古迹",price:BUDGET_MAX},
        {q:"三亚",label:"三亚亲子酒店",meta:"海岛度假",price:BUDGET_MAX},
        {q:"成都",label:"成都看熊猫",meta:"周末热门",price:BUDGET_MAX},
        {q:"西湖",label:"西湖怎么玩",meta:"自然风光",price:BUDGET_MAX},
        {q:"兵马俑",label:"兵马俑攻略",meta:"世界遗产",price:BUDGET_MAX},
        {q:"重庆",label:"重庆夜景路线",meta:"夜游",price:BUDGET_MAX},
        {q:"布达拉宫",label:"布达拉宫预约",meta:"雪域旅行",price:BUDGET_MAX},
        {q:"",label:"5000元去哪儿",meta:"预算热搜",price:5000}
      ];
      tags.innerHTML=searches.map((item,index)=>`<button type="button" data-hot-search="${esc(item.q)}" data-hot-price="${item.price}" aria-label="搜索：${esc(item.label)}"><span>${String(index+1).padStart(2,"0")}</span><div><b>${esc(item.label)}</b><small>${esc(item.meta)}</small></div><em>↗</em></button>`).join("");
      tags.querySelectorAll("[data-hot-search]").forEach(item=>item.addEventListener("click",()=>{
        state.q=item.dataset.hotSearch||"";
        state.region="";
        state.tag="";
        state.sort="popular";
        state.priceMax=Number(item.dataset.hotPrice)||BUDGET_MAX;
        si.value=state.q;
        fr.value="";
        ft.value="";
        $("#sortSel").value="popular";
        pm.value=state.priceMax;
        pml.textContent=priceLabel();
        sc.classList.toggle("show",!!state.q);
        syncChips();
        visible=PAGE;
        render();
        $("#destinations").scrollIntoView({behavior:"smooth",block:"start"});
        toast(state.q?`已为你筛选“${state.q}”相关目的地`:"已筛选 5000 元以内目的地");
      }));
    }
    renderHotCommunity();
  }
  async function renderHotCommunity(){
    const target=$("#hotCommunityMedia");
    if(!target)return;
    try{
      const response=await fetch((apiBase||"")+"/api/community/posts",{cache:"no-store"});
      if(!response.ok)throw new Error("community unavailable");
      const payload=await response.json();
      const posts=(Array.isArray(payload.posts)?payload.posts:[]).filter(post=>(post.media||[]).some(item=>item.type==="video"||/^video\//.test(item.type||""))).slice(0,1);
      if(!posts.length){
        target.innerHTML='<div class="hot-empty"><span>🎬</span><b>社区视频正在准备中</b><a href="community.html">去社区看看 →</a></div>';
        return;
      }
      const post=posts[0],media=post.media.find(item=>item.type==="video"||/^video\//.test(item.type||""));
      target.innerHTML=`<article class="hot-video-card">
        <video src="${esc(media.url)}" poster="${esc(media.poster||localCityImage("北京"))}" controls playsinline preload="metadata"></video>
        <div class="hot-video-overlay"><span>社区精选</span><b>${esc(post.city)}</b></div>
        <div class="hot-video-copy"><div><span>${esc((post.nickname||"旅行者").slice(0,1))}</span><p><b>${esc(post.nickname||"旅行者")}</b><small>${esc(post.caption||"记录旅途中的真实瞬间")}</small></p></div><a href="community.html?post=${encodeURIComponent(post.id)}">看视频与评论 →</a></div>
      </article>`;
    }catch{
      target.innerHTML='<div class="hot-empty"><span>🎬</span><b>社区视频暂时未连接</b><a href="community.html">打开社区 →</a></div>';
    }
  }

  /* ---- 灵感路线（组合玩法） ---- */
  const routeList = $("#routeList");
  const quickRouteForm=$("#quickRouteForm");
  const ROUTES=[
    {t:"古都山水线",k:"古都 · 山水",meta:"约 13 天 · 华北→西北→西南",cities:["北京","西安","成都","重庆"],bg:"#c31432",bg2:"#240b36"},
    {t:"江南海岛线",k:"江南 · 海岛",meta:"约 8 天 · 华东→华南",cities:["上海","杭州","三亚"],bg:"#2b5876",bg2:"#4e4376"},
    {t:"西南雪域线",k:"西南 · 雪域",meta:"约 13 天 · 川渝→西藏",cities:["成都","重庆","拉萨"],bg:"#4568dc",bg2:"#b06ab3"},
    {t:"西北辽阔线",k:"西北 · 秘境",meta:"约 14 天 · 陕西→新疆",cities:["西安","乌鲁木齐","喀纳斯"],bg:"#11998e",bg2:"#38ef7d"}
  ];
  function initQuickRoute(){
    if(!quickRouteForm)return;
    const from=$("#quickRouteFrom"),via=$("#quickRouteVia"),to=$("#quickRouteTo");
    const options=data.map(item=>`<option value="${esc(item.name)}">${esc(item.name)} · ${esc(item.region)} · ${fmt(item.price)}起</option>`).join("");
    from.innerHTML=options;
    to.innerHTML=options;
    via.innerHTML='<option value="">不添加途经城市</option>'+options;
    from.value="北京";
    via.value="西安";
    to.value="上海";
    quickRouteForm.addEventListener("submit",event=>{
      event.preventDefault();
      if(from.value===to.value){toast("起点和终点不能相同");return;}
      if(via.value===from.value||via.value===to.value){toast("途经城市不能与起点或终点相同");return;}
      const params=new URLSearchParams({from:from.value,to:to.value});
      if(via.value)params.set("via",via.value);
      location.href="route.html?"+params.toString();
    });
  }
  function renderRoutes(){
    const customRoute=`<a class="route-card route-card-custom" href="route.html?custom=1"><div class="rc-top">CUSTOM ROUTE · 自由组合</div><h3>自选路线</h3><div class="rc-meta">自己选择起点、途经城市和终点</div><div class="rc-tags"><span>起点</span><span>途经点</span><span>终点</span><span>交通方式</span></div><div class="rc-cta">开始组合专属路线 →</div></a>`;
    routeList.innerHTML=customRoute+ROUTES.map((r,index)=>{
      const cs=r.cities.map(n=>data.find(d=>d.name===n)).filter(Boolean);
      const total=cs.reduce((a,d)=>a+d.price,0);
      return `<button type="button" class="route-card" data-route-index="${index}" style="background:linear-gradient(135deg,${r.bg},${r.bg2})"><div class="rc-top">${r.k}</div><h3>${r.t}</h3><div class="rc-meta">${r.meta} · 预算约 ¥${Math.round(total).toLocaleString()}</div><div class="rc-tags">${r.cities.map(c=>`<span>${c}</span>`).join("")}</div><div class="rc-cta">查看整线 →</div></button>`;
    }).join("");
    routeList.querySelectorAll("[data-route-index]").forEach(card=>card.addEventListener("click",()=>openRouteModal(ROUTES[Number(card.dataset.routeIndex)])));
  }
  function openRouteModal(route){
    const cities=route.cities.map(name=>data.find(item=>item.name===name)).filter(Boolean);
    const total=cities.reduce((sum,item)=>sum+item.price,0);
    const days=cities.reduce((sum,item)=>sum+item.duration,0);
    const routeQuery=new URLSearchParams({from:route.cities[0],to:route.cities[route.cities.length-1],via:route.cities.slice(1,-1).join("|")});
    lastFocused=document.activeElement;
    modalBody.innerHTML=`<div class="route-modal">
      <div class="route-modal-head"><span class="eyebrow">${route.k}</span><h2>${route.t}</h2><p>${route.meta} · 共 ${cities.length} 站 · 建议 ${days} 天 · 人均参考 ${fmt(total)}</p></div>
      <div class="pl-result">${cities.map(d=>`<button type="button" class="pl-rc route-stop" data-id="${d.id}"><img src="${cover(d,120,120)}" alt=""/><div><b>${esc(d.name)}</b> <span class="rc-price">${fmt(d.price)}</span><span class="route-stop-meta"> · ${d.duration}天 · ★${d.rating}</span><p>${esc(d.description)}</p></div></button>`).join("")}</div>
      <div class="route-modal-actions"><a class="btn-accent" href="route.html?${routeQuery.toString()}">在这条线路上自选调整 →</a><a class="btn-ghost" href="route.html?custom=1">从空白路线开始</a></div>
      <p class="route-note">自选页面可增删途经城市、交换起终点，并分别选择驾车、高铁、飞机或大巴。</p>
    </div>`;
    modal.hidden=false;
    document.body.style.overflow="hidden";
    requestAnimationFrame(()=>modal.querySelector(".modal-close")?.focus());
    modalBody.querySelectorAll(".route-stop").forEach(stop=>stop.addEventListener("click",()=>openModal(stop.dataset.id)));
  }

  /* ---- 行程定制向导（四步） ---- */
  const plannerModal = $("#plannerModal"), plannerBody = $("#plannerBody");
  const PL_STYLES=["人文古迹","自然山水","海岛度假","美食之旅","现代都市","浪漫蜜月","亲子游乐","雪山高原"];
  const STYLE_TAG={"人文古迹":["人文古迹","世界遗产"],"自然山水":["自然","山水"],"海岛度假":["海岛","度假"],"美食之旅":["美食"],"现代都市":["都市","购物"],"浪漫蜜月":["浪漫","海岛"],"亲子游乐":["休闲","亲子"],"雪山高原":["雪山","自然","人文古迹"]};
  const planner={step:0,style:null,budget:10000,days:5,region:"",fav:[]};
  function openPlanner(){planner.step=0;planner.style=null;planner.budget=10000;planner.days=5;planner.region="";planner.fav=[];plRender();plannerModal.hidden=false;document.body.style.overflow="hidden";}
  function closePlanner(){plannerModal.hidden=true;document.body.style.overflow="";}
  plannerModal.addEventListener("click",e=>{if(e.target.hasAttribute("data-planner-close"))closePlanner();});
  function plannerSuggest(){
    let pool=data.slice();
    if(planner.style){const m=STYLE_TAG[planner.style];if(m)pool=pool.filter(d=>d.tags.some(t=>m.includes(t)));}
    pool=pool.filter(d=>d.price<=planner.budget);
    pool=pool.filter(d=>d.duration<=planner.days+2);
    if(planner.region)pool=pool.filter(d=>d.region===planner.region);
    const favMap={world:["世界遗产"],photo:["摄影","自然"],quiet:["休闲","自然"],food:["美食"]};
    planner.fav.forEach(f=>{const m=favMap[f];if(m)pool=pool.filter(d=>d.tags.some(t=>m.includes(t)));});
    pool.sort((a,b)=>(b.popular?1:0)-(a.popular?1:0)||b.rating-a.rating);
    return pool.slice(0,5);
  }
  function plRender(){
    const steps=["设定航向","舒适区","微调冒险","可行性检查"];
    const dots=`<div class="pl-ind">${steps.map((s,i)=>`<div class="pl-dot ${i<=planner.step?"on":""}" title="${s}"></div>`).join("")}</div>`;
    let body="";
    if(planner.step===0){
      body=`<div class="pl-step"><h3 class="pl-title">🌍 设定你的航向</h3><p class="pl-sub">选择你偏好的旅行风格（单选）</p><div class="pl-opts">${PL_STYLES.map(s=>`<button class="pl-opt ${planner.style===s?"on":""}" data-v="${s}">${s}</button>`).join("")}</div></div>`;
    }else if(planner.step===1){
      body=`<div class="pl-step"><h3 class="pl-title">💸 规划你的舒适区</h3><p class="pl-sub">选择 ¥1,000–¥10,000 预算档位</p><div class="pl-opts pl-budget">${[["1000","¥1,000 内 · 轻量短途"],["5000","¥5,000 内 · 经济实惠"],["10000","¥10,000 内 · 舒适之选"]].map(b=>`<button class="pl-opt ${planner.budget===+b[0]?"on":""}" data-v="${b[0]}">${b[1]}</button>`).join("")}</div><h3 class="pl-title" style="margin-top:22px">🗓 计划游玩几天？</h3><p class="pl-sub">选择行程天数</p><div class="pl-opts pl-days">${[3,5,7,10].map(n=>`<button class="pl-opt ${planner.days===n?"on":""}" data-v="${n}">${n} 天</button>`).join("")}</div></div>`;
    }else if(planner.step===2){
      body=`<div class="pl-step"><h3 class="pl-title">🎛 微调你的中国行程</h3><p class="pl-sub">限定旅行区域（单选）</p><div class="pl-opts pl-region">${[["","不限区域"],["华北","华北"],["华东","华东"],["华南","华南"],["西南","西南"],["西北","西北"]].map(w=>`<button class="pl-opt ${planner.region===w[0]?"on":""}" data-v="${w[0]}">${w[1]}</button>`).join("")}</div><h3 class="pl-title" style="margin-top:22px">✨ 加分偏好（可多选）</h3><p class="pl-sub">喜欢就点亮它</p><div class="pl-opts pl-fav">${[["world","🏛️ 世界遗产"],["photo","📷 摄影胜地"],["quiet","🏞️ 小众静谧"],["food","🍜 美食之都"]].map(f=>`<button class="pl-opt ${planner.fav.includes(f[0])?"on":""}" data-f="${f[0]}">${f[1]}</button>`).join("")}</div></div>`;
    }else{
      const res=plannerSuggest();
      body=`<div class="pl-step"><h3 class="pl-title">✅ 可行性检查 · 为你生成</h3><p class="pl-sub">已为你筛选出 ${res.length} 个契合需求的目的地，点击卡片查看详情</p><div class="pl-result">${res.map(d=>`<div class="pl-rc" data-id="${d.id}"><img src="${cover(d,120,120)}" alt=""/><div><b>${esc(d.name)}</b> <span class="rc-price">${fmt(d.price)}</span><span style="color:var(--muted-fg)"> · ${d.duration}天 · ★${d.rating}</span><p>${esc(d.description)}</p></div></div>`).join("")}</div><button class="btn-accent btn-sm" id="plSave" style="width:100%;justify-content:center">💾 让 AI 助手细化这个计划</button><span class="pl-save">· 也可在右下角直接与 AI 对话</span></div>`;
    }
    const nav=`<div class="pl-nav">${planner.step>0?`<button class="btn-ghost" id="plPrev">← 上一步</button>`:"<span></span>"}${planner.step<3?`<button class="btn-accent btn-sm" id="plNext">${planner.step===2?"生成计划 →":"下一步 →"}</button>`:""}</div>`;
    plannerBody.innerHTML=dots+body+nav;
    plannerBody.querySelectorAll(".pl-opt").forEach(b=>b.addEventListener("click",()=>{
      const group=b.parentElement;
      if(b.hasAttribute("data-f")){
        const f=b.dataset.f;
        planner.fav=planner.fav.includes(f)?planner.fav.filter(x=>x!==f):planner.fav.concat(f);
        b.classList.toggle("on"); return;
      }
      group.querySelectorAll("button").forEach(x=>x.classList.remove("on"));
      b.classList.add("on");
      const v=b.dataset.v;
      if(planner.step===0){planner.style=v;}
      else if(planner.step===1){if(group.classList.contains("pl-days")){planner.days=+v;}else{planner.budget=+v;}}
      else if(planner.step===2){planner.region=v;}
    }));
    const nb=plannerBody.querySelector("#plNext");
    if(nb)nb.addEventListener("click",()=>{planner.step++;plRender();});
    const pv=plannerBody.querySelector("#plPrev");
    if(pv)pv.addEventListener("click",()=>{planner.step--;plRender();});
    const sv=plannerBody.querySelector("#plSave");
    if(sv)sv.addEventListener("click",()=>{
      const q=`请帮我细化并推荐：${planner.style||"综合"}主题、预算¥${planner.budget}内、${planner.days}天、${planner.region||"不限区域"}的中国旅行计划`;
      closePlanner();openAI();
      setTimeout(()=>{addMsg(q,"user");setTimeout(()=>addMsg(window.AI.answer(q),"bot"),380);},150);
    });
    plannerBody.querySelectorAll(".pl-rc").forEach(c=>c.addEventListener("click",()=>{openModal(c.dataset.id);}));
  }

  /* ---- 我的行程单（原创核心） ---- */
  function loadStoredArray(key){
    try{
      const value=JSON.parse(localStorage.getItem(key)||"[]");
      return Array.isArray(value)?value:[];
    }catch{
      localStorage.removeItem(key);
      return [];
    }
  }
  const trip={items:loadStoredArray("hy_trip").filter(item=>item&&typeof item.id==="string")};
  const fav=new Set(loadStoredArray("hy_fav").filter(id=>typeof id==="string"));
  const tripPanel=$("#tripPanel"), tripBody=$("#tripBody"), tripBadge=$("#tripBadge");
  function saveTrip(){localStorage.setItem("hy_trip",JSON.stringify(trip.items));syncTripToCloud();}
  function saveFav(){localStorage.setItem("hy_fav",JSON.stringify([...fav]));}
  function addToTrip(id){if(!trip.items.some(x=>x.id===id)){trip.items.push({id});}saveTrip();updateTripUI();toast("已加入行程单 🧳");}
  function removeFromTrip(id){trip.items=trip.items.filter(x=>x.id!==id);saveTrip();updateTripUI();toast("已移出行程单");}
  function moveTrip(i,dir){const j=i+dir;if(!trip.items[j])return;const t=trip.items[i];trip.items[i]=trip.items[j];trip.items[j]=t;saveTrip();updateTripUI();}
  function clearTrip(){if(!trip.items.length)return;trip.items=[];saveTrip();updateTripUI();toast("行程单已清空");}
  function tripTotal(){let d=0,c=0;trip.items.forEach(x=>{const o=data.find(y=>y.id===x.id);if(o){d+=o.duration;c+=o.price;}});return{days:d,cost:c};}
  function updateTripUI(){
    if(tripBadge){tripBadge.textContent=""+trip.items.length;tripBadge.hidden=!trip.items.length;}
    renderTripPanel();paintTripMarkers();
    if(routeModal&&!routeModal.hidden){renderRoutePanel();if(trip.items.length>1)drawRoute();else clearRouteDraw();}
  }
  function renderTripPanel(){
    if(!tripBody)return;
    if(!trip.items.length){tripBody.innerHTML=`<div class="trip-empty"><span>🧳</span><p>行程单还是空的</p><div>在目的地详情里点「加入行程单」</div></div>`;return;}
    const t=tripTotal();
    tripBody.innerHTML=trip.items.map((x,i)=>{
      const d=data.find(y=>y.id===x.id);if(!d)return"";
      return `<div class="trip-rc"><img src="${cover(d,120,120)}" alt=""/><div class="tr-main"><div class="tr-head"><b>${esc(d.name)}</b><span class="tr-price">${fmt(d.price)}</span></div><div class="tr-meta">${esc(d.country)} · ${d.duration}天 · ★${d.rating}</div><div class="tr-tools"><button class="tr-btn" data-move="${i},-1" title="上移">↑</button><button class="tr-btn" data-move="${i},1" title="下移">↓</button><button class="tr-btn tr-del" data-del="${d.id}" title="移除">✕</button></div></div></div>`;
    }).join("")+`<div class="trip-summary">🧾 合计 ${trip.items.length} 站 · 约 <b>${t.days}</b> 天 · 预算约 <b>${fmt(t.cost)}</b></div>`;
    tripBody.querySelectorAll("[data-move]").forEach(b=>b.addEventListener("click",e=>{e.stopPropagation();const p=b.dataset.move.split(",").map(Number);moveTrip(p[0],p[1]);}));
    tripBody.querySelectorAll("[data-del]").forEach(b=>b.addEventListener("click",e=>{e.stopPropagation();removeFromTrip(b.dataset.del);}));
    tripBody.querySelectorAll(".trip-rc").forEach(rc=>rc.addEventListener("click",()=>{const el=rc.querySelector("[data-del]");if(el&&el.dataset.del)openModal(el.dataset.del);}));
  }
  function copyTrip(){
    if(!trip.items.length){toast("行程单是空的");return;}
    const t=tripTotal();
    const lines=trip.items.map((x,i)=>{const d=data.find(y=>y.id===x.id);return "D"+(i+1)+" "+d.name+"（"+d.country+"）·"+d.duration+"天 · "+fmt(d.price)+" · 最佳"+d.bestSeason;});
    const txt="【九州行 · 我的中国旅行计划】\n"+lines.join("\n")+"\n—— 合计 "+trip.items.length+" 站 · 约 "+t.days+" 天 · 预算约 "+fmt(t.cost);
    const done=()=>toast("行程文本已复制 📋");
    if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(txt).then(done).catch(()=>fbCopy(txt,done));}
    else fbCopy(txt,done);
  }
  function fbCopy(txt,done){const ta=document.createElement("textarea");ta.value=txt;ta.style.position="fixed";ta.style.opacity="0";document.body.appendChild(ta);ta.select();try{document.execCommand("copy");done();}catch(e){}ta.remove();}
  function paintTripMarkers(){
    if(!map)return;
    Object.entries(mapMarkers||{}).forEach(([id,m])=>{
      const d=data.find(x=>x.id===id);if(!d)return;
      m.setIcon(markerIcon(d,trip.items.some(x=>x.id===id)));
    });
  }
  function openTrip(){tripPanel.hidden=false;document.body.style.overflow="hidden";renderTripPanel();}
  function closeTrip(){tripPanel.hidden=true;document.body.style.overflow="";}
  const to=$("#tripOpen");if(to)to.addEventListener("click",openTrip);
  const tf=$("#tripFab");if(tf)tf.addEventListener("click",openTrip);
  const tcl=$("#tripClose");if(tcl)tcl.addEventListener("click",closeTrip);
  const tcp=$("#tripCopy");if(tcp)tcp.addEventListener("click",copyTrip);
  const tcc=$("#tripClear");if(tcc)tcc.addEventListener("click",clearTrip);

  /* ---- 我的账户中心 ---- */
  const myPanel=$("#myPanel"), myBody=$("#myBody");
  const MY_ACCOUNTS_KEY="hy_accounts_v1", MY_SESSION_KEY="hy_session_phone";
  function loadStoredObject(key){
    try{
      const value=JSON.parse(localStorage.getItem(key)||"{}");
      return value&&typeof value==="object"&&!Array.isArray(value)?value:{};
    }catch{
      localStorage.removeItem(key);
      return {};
    }
  }
  let myAccounts=loadStoredObject(MY_ACCOUNTS_KEY);
  let myPhone=localStorage.getItem(MY_SESSION_KEY)||"";
  let myView="overview";
  let myLoginMode="code", myLoginPhone=myPhone, myCodeState=null, myLoginErrorText="";
  function currentMyUser(){
    const account=myPhone&&myAccounts[myPhone];
    return account&&typeof account==="object"?{...account,phone:myPhone}:null;
  }
  function maskPhone(phone){return phone?phone.slice(0,3)+"****"+phone.slice(-4):"";}
  function saveMyAccounts(){localStorage.setItem(MY_ACCOUNTS_KEY,JSON.stringify(myAccounts));}
  const communityApiBase=(window.APP_CONFIG&&window.APP_CONFIG.apiBase?String(window.APP_CONFIG.apiBase):"").replace(/\/$/,"");
  function validMyPhone(phone){return /^1[3-9]\d{9}$/.test(phone);}
  function cacheAuthUser(user){
    const cached={accountId:user.accountId,nickname:user.nickname,createdAt:user.createdAt||"",hasPassword:!!user.hasPassword};
    myPhone=user.phone;
    myAccounts[user.phone]=cached;
    saveMyAccounts();
    localStorage.setItem(MY_SESSION_KEY,user.phone);
    return {...cached,phone:user.phone};
  }
  function clearAuthUser(){
    myAccounts={};
    saveMyAccounts();
    myPhone="";
    localStorage.removeItem(MY_SESSION_KEY);
  }
  async function refreshAuthUser(){
    try{
      const response=await fetch(communityApiBase+"/api/auth/me",{cache:"no-store",credentials:"same-origin"});
      if(!response.ok)throw new Error("not authenticated");
      const data=await response.json();
      if(data.user)return cacheAuthUser(data.user);
    }catch{}
    clearAuthUser();
    return null;
  }
  function finishMyLogin(user,isNew){
    myLoginPhone=user.phone;
    myLoginErrorText="";
    myCodeState=null;
    cacheAuthUser(user);
    myView="overview";
    renderMy();
    toast(isNew?"账号已创建 · 欢迎来到九州行":"登录成功 · 欢迎回来");
  }
  function myBookings(){return loadStoredArray("hy_bookings_"+(myPhone||"guest")).filter(item=>item&&typeof item==="object");}
  function myReviews(){return loadStoredArray("hy_reviews").filter(item=>item&&typeof item==="object");}
  function myViewHead(title,sub){
    return `<div class="my-view-head"><button type="button" class="my-back" data-my-view="overview" aria-label="返回我的主页">←</button><div><b>${title}</b><span>${sub}</span></div></div>`;
  }
  function myEmpty(icon,title,text,action){
    return `<div class="my-empty"><span>${icon}</span><b>${title}</b><p>${text}</p>${action?`<button type="button" class="btn-accent btn-sm" data-my-action="browse">去发现目的地</button>`:""}</div>`;
  }
  function renderMyLogin(){
    const passwordMode=myLoginMode==="password";
    const codeReady=myCodeState&&myCodeState.phone===myLoginPhone&&myCodeState.expiresAt>Date.now();
    myBody.innerHTML=`<div class="my-login">
      <span class="my-login-mark">◈</span>
      <h2>登录我的旅行空间</h2>
      <p>${passwordMode?"使用手机号和已设置的密码登录。":"使用手机验证码快捷登录。首次登录会随机生成专属账号。"}</p>
      <div class="my-login-tabs" role="tablist" aria-label="登录方式">
        <button type="button" role="tab" aria-selected="${!passwordMode}" class="${passwordMode?"":"active"}" data-my-login-mode="code">验证码登录</button>
        <button type="button" role="tab" aria-selected="${passwordMode}" class="${passwordMode?"active":""}" data-my-login-mode="password">密码登录</button>
      </div>
      <form id="myLoginForm" novalidate>
        <label for="myPhone">手机号码</label>
        <div class="my-phone-field"><span>+86</span><input id="myPhone" name="phone" type="tel" inputmode="numeric" maxlength="11" autocomplete="tel" placeholder="请输入 11 位手机号" value="${esc(myLoginPhone)}"/></div>
        ${passwordMode?`
          <label for="myPassword">登录密码</label>
          <div class="my-field"><input id="myPassword" name="password" type="password" autocomplete="current-password" placeholder="请输入登录密码"/></div>
        `:`
          <label for="myCode">手机验证码</label>
          <div class="my-code-row">
            <div class="my-field"><input id="myCode" name="code" type="text" inputmode="numeric" maxlength="6" autocomplete="one-time-code" placeholder="请输入 6 位验证码"/></div>
            <button type="button" class="my-code-btn" data-my-action="send-code">${codeReady?"重新获取":"获取验证码"}</button>
          </div>
          ${codeReady?`<div class="my-code-demo"><span>演示验证码</span><b>${esc(myCodeState.code)}</b><small>5 分钟内有效，真实上线时将通过短信发送</small></div>`:""}
        `}
        <div id="myLoginError" class="my-form-error" ${myLoginErrorText?"":"hidden"}>${esc(myLoginErrorText)}</div>
        <button type="submit" class="btn-accent my-login-submit">${passwordMode?"密码登录":"验证码登录"}</button>
      </form>
      <small class="my-login-note">${passwordMode?"首次使用请先用验证码登录，再在右上角设置中创建密码。":"演示版不会发送真实短信，验证码直接显示在本页面。"}</small>
    </div>`;
  }
  function renderMyOverview(user){
    const totals=tripTotal(), bookingCount=myBookings().length, reviewCount=myReviews().length, favoriteCount=fav.size;
    myBody.innerHTML=`<div class="my-profile">
      <div class="my-profile-avatar">${esc((user.nickname||"旅").slice(0,1))}</div>
      <div class="my-profile-info"><span>已登录</span><b>${esc(user.nickname)}</b><small>${esc(maskPhone(user.phone))}</small><code>${esc(user.accountId)}</code></div>
      <button type="button" class="my-logout" data-my-action="logout">退出</button>
    </div>
    <div class="my-section-title"><div><span>MY JOURNEY</span><h2>我的旅行空间</h2></div><small>服务端账号会话</small></div>
    <div class="my-category-grid">
      <button type="button" class="my-category-card" data-my-view="trips"><span class="my-category-icon blue">🧳</span><div><b>行程单</b><small>${trip.items.length?`${trip.items.length} 个目的地 · 约 ${totals.days} 天`:"还没有添加目的地"}</small></div><em>${trip.items.length}</em></button>
      <button type="button" class="my-category-card" data-my-view="favorites"><span class="my-category-icon rose">♥</span><div><b>我的收藏</b><small>${favoriteCount?`已收藏 ${favoriteCount} 个目的地`:"收藏喜欢的旅行地"}</small></div><em>${favoriteCount}</em></button>
      <button type="button" class="my-category-card" data-my-view="bookings"><span class="my-category-icon green">🏨</span><div><b>机酒预订</b><small>${bookingCount?`${bookingCount} 条关联记录`:"携程与 12306 订单入口"}</small></div><em>${bookingCount}</em></button>
      <button type="button" class="my-category-card" data-my-view="reviews"><span class="my-category-icon amber">★</span><div><b>我的评价</b><small>${reviewCount?`${reviewCount} 条旅行评价`:"分享真实旅行体验"}</small></div><em>${reviewCount}</em></button>
      <button type="button" class="my-category-card my-community-card" data-my-view="community"><span class="my-category-icon community">✦</span><div><b>热门城市分享</b><small>查看社区点赞、收藏、评价和我上传的分享</small></div><em>查看记录 →</em></button>
    </div>
    <div class="my-account-strip"><span>专属账号</span><b>${esc(user.accountId)}</b><small>账号与权限由服务端会话验证</small></div>`;
  }
  function renderMyTrips(){
    const totals=tripTotal();
    const rows=trip.items.map(item=>data.find(d=>d.id===item.id)).filter(Boolean).map(d=>`<button type="button" class="my-destination-row" data-my-dest="${esc(d.id)}"><img src="${cover(d)}" alt=""/><div><b>${esc(d.name)}</b><span>${esc(d.country)} · ${d.duration} 天 · ${fmt(d.price)}</span></div><em>→</em></button>`).join("");
    myBody.innerHTML=myViewHead("我的行程单",trip.items.length?`${trip.items.length} 个目的地 · 约 ${totals.days} 天`:"规划你的下一段旅程")
      +(rows?`<div class="my-summary-band"><span>行程参考</span><b>${fmt(totals.cost)}</b><small>约 ${totals.days} 天 · ${trip.items.length} 站</small></div><div class="my-list">${rows}</div><button type="button" class="btn-accent my-wide-btn" data-my-action="open-trip">查看完整行程单</button>`
      :myEmpty("🧳","行程单还是空的","在目的地详情中点击“加入行程单”，就能在这里统一查看。",true));
  }
  function renderMyFavorites(){
    const favorites=[...fav].map(id=>data.find(d=>d.id===id)).filter(Boolean);
    const rows=favorites.map(d=>`<button type="button" class="my-destination-row" data-my-dest="${esc(d.id)}"><img src="${cover(d)}" alt=""/><div><b>${esc(d.name)}</b><span>${esc(d.tags.slice(0,2).join(" · "))} · ★${d.rating}</span></div><em>→</em></button>`).join("");
    myBody.innerHTML=myViewHead("我的收藏",favorites.length?`已收藏 ${favorites.length} 个目的地`:"收藏想去的地方")
      +(rows?`<div class="my-list">${rows}</div>`:myEmpty("♡","还没有收藏","浏览目的地详情，点击“收藏”后会出现在这里。",true));
  }
  function renderMyBookings(){
    const records=myBookings();
    const rows=records.map(item=>`<div class="my-record"><span>${esc(item.type||"预订")}</span><div><b>${esc(item.title||item.orderNo||"旅行订单")}</b><small>${esc(item.orderNo?`订单号 ${item.orderNo}`:item.date||item.meta||"待出行")}</small></div><em>${esc(item.status||"本地记录")}</em></div>`).join("");
    myBody.innerHTML=myViewHead("机酒预订",records.length?`${records.length} 条本机关联记录`:"携程与铁路订单入口")
      +`<div class="my-platform-links">
        <a class="my-platform-link ctrip" href="https://www.ctrip.com/myctrip/order" target="_blank" rel="noopener noreferrer"><span>🏨</span><div><b>携程酒店订单</b><small>登录携程查看实时订单</small></div><em>↗</em></a>
        <a class="my-platform-link ctrip" href="https://www.ctrip.com/myctrip/order" target="_blank" rel="noopener noreferrer"><span>✈️</span><div><b>携程机票订单</b><small>登录携程查看实时订单</small></div><em>↗</em></a>
        <a class="my-platform-link rail" href="https://www.12306.cn/index/" target="_blank" rel="noopener noreferrer"><span>🚄</span><div><b>12306 火车票订单</b><small>登录 12306 查看铁路订单</small></div><em>↗</em></a>
      </div>
      <div class="my-booking-note"><span>i</span><p>外部平台订单需登录对应平台查看。九州行没有平台授权，不能自动读取你的携程或 12306 账户。</p></div>
      <form id="myBookingForm" class="my-booking-form" novalidate>
        <div class="my-settings-title"><h3>关联已有订单</h3><p>录入订单编号后，可集中显示在“我的”中；该记录保存在本机，不代替平台核验。</p></div>
        <div class="my-booking-form-row">
          <select name="platform" aria-label="订单平台">
            <option value="携程酒店">携程酒店</option>
            <option value="携程机票">携程机票</option>
            <option value="12306火车票">12306 火车票</option>
          </select>
          <div class="my-field"><input name="orderNo" type="text" maxlength="40" placeholder="请输入订单编号"/></div>
        </div>
        <div id="myBookingError" class="my-form-error" hidden></div>
        <button type="submit" class="btn-ghost my-login-submit">保存订单记录</button>
      </form>`
      +(rows?`<div class="my-list my-booking-list"><div class="my-list-label">本机关联订单</div>${rows}</div>`:`<div class="my-empty compact"><span>🧾</span><b>暂无本机关联订单</b><p>可在上方录入订单编号，或直接前往平台订单中心查看。</p></div>`);
  }
  function renderMyReviews(){
    const records=myReviews();
    const rows=records.map(item=>`<div class="my-review"><div><b>${esc(item.city||item.title||"旅行目的地")}</b><span>★ ${esc(item.rating||"5.0")}</span></div><p>${esc(item.content||"暂无评价内容")}</p><small>${esc(item.date||"")}</small></div>`).join("");
    myBody.innerHTML=myViewHead("我的评价",records.length?`${records.length} 条旅行评价`:"记录你的真实旅行体验")
      +(rows?`<div class="my-list">${rows}</div>`:myEmpty("★","还没有旅行评价","你发布的评价会集中展示在这里。",true));
  }
  function renderMySettings(user){
    const hasPassword=!!user.hasPassword;
    myBody.innerHTML=myViewHead("账户设置","管理登录密码与账号安全")
      +`<div class="my-security-card">
        <div><span>登录手机号</span><b>${esc(maskPhone(user.phone))}</b></div>
        <div><span>专属账号</span><b>${esc(user.accountId)}</b></div>
        <div><span>密码状态</span><b class="${hasPassword?"ok":""}">${hasPassword?"已设置":"尚未设置"}</b></div>
      </div>
      <form id="myPasswordForm" class="my-settings-form" novalidate>
        <div class="my-settings-title"><h3>${hasPassword?"修改登录密码":"创建登录密码"}</h3><p>设置后可在登录页选择“密码登录”，验证码登录仍可继续使用。</p></div>
        ${hasPassword?`<label for="myCurrentPassword">当前密码</label><div class="my-field"><input id="myCurrentPassword" name="currentPassword" type="password" autocomplete="current-password" placeholder="请输入当前密码"/></div>`:""}
        <label for="myNewPassword">新密码</label>
        <div class="my-field"><input id="myNewPassword" name="newPassword" type="password" minlength="6" autocomplete="new-password" placeholder="至少 6 位字符"/></div>
        <label for="myConfirmPassword">确认新密码</label>
        <div class="my-field"><input id="myConfirmPassword" name="confirmPassword" type="password" minlength="6" autocomplete="new-password" placeholder="请再次输入新密码"/></div>
        <div id="mySettingsError" class="my-form-error" hidden></div>
        <button type="submit" class="btn-accent my-login-submit">${hasPassword?"更新密码":"保存密码"}</button>
      </form>
      <div class="my-security-tip"><span>🛡</span><p>密码经过哈希后保存在当前浏览器。验证码登录同样可用于找回访问权限。</p></div>`;
  }
  async function renderMyCommunity(user){
    myBody.innerHTML=myViewHead("热门城市分享记录","点赞、收藏、评价与我的上传")
      +`<div class="my-community-loading"><span>◈</span><p>正在整理你的社区记录…</p></div>`;
    try{
      const response=await fetch(communityApiBase+"/api/community/posts",{cache:"no-store"});
      if(!response.ok)throw new Error("community unavailable");
      const data=await response.json();
      const posts=Array.isArray(data.posts)?data.posts:[];
      const activeUser=currentMyUser();
      if(!activeUser||activeUser.accountId!==user.accountId||myView!=="community")return;
      const liked=posts.filter(post=>Array.isArray(post.likes)&&post.likes.includes(user.accountId));
      const favorited=posts.filter(post=>Array.isArray(post.favorites)&&post.favorites.includes(user.accountId));
      const commented=[];
      posts.forEach(post=>{
        (Array.isArray(post.comments)?post.comments:[]).forEach(comment=>{
          if(comment.accountId===user.accountId)commented.push({post,comment});
        });
      });
      const uploaded=posts.filter(post=>post.accountId===user.accountId);
      const record=(post,meta,content)=>`<a class="my-community-record" href="community.html?post=${encodeURIComponent(post.id)}" target="_blank" rel="noopener">
        <span>📍 ${esc(post.city)}</span>
        <div><b>${esc(content||(post.caption||"旅行分享").slice(0,55))}</b><small>${esc(meta)}</small></div>
        <em>→</em>
      </a>`;
      const section=(title,icon,count,rows)=>`<section class="my-community-section">
        <div class="my-community-section-head"><b>${icon} ${title}</b><span>${count}</span></div>
        ${rows||`<div class="my-community-none">暂时没有${title}记录</div>`}
      </section>`;
      myBody.innerHTML=myViewHead("热门城市分享记录","点赞、收藏、评价与我的上传")
        +`<div class="my-community-summary">
          <div><b>${liked.length}</b><span>点赞</span></div>
          <div><b>${favorited.length}</b><span>收藏</span></div>
          <div><b>${commented.length}</b><span>评价</span></div>
          <div><b>${uploaded.length}</b><span>上传</span></div>
        </div>`
        +section("我点赞的分享","♥",liked.length,liked.map(post=>record(post,"喜欢这条旅行分享")).join(""))
        +section("我收藏的分享","★",favorited.length,favorited.map(post=>record(post,"已收藏到社区")).join(""))
        +section("我发布的评价","💬",commented.length,commented.map(item=>record(item.post,relativeCommunityTime(item.comment.createdAt),"“"+item.comment.text+"”")).join(""))
        +section("我上传的分享","📷",uploaded.length,uploaded.map(post=>record(post,`${Array.isArray(post.likes)?post.likes.length:0} 赞 · ${Array.isArray(post.comments)?post.comments.length:0} 条评价`)).join(""))
        +`<a class="btn-accent my-wide-btn" href="community.html" target="_blank" rel="noopener">去热门城市分享广场 →</a>`;
    }catch{
      if(myView!=="community")return;
      myBody.innerHTML=myViewHead("热门城市分享记录","点赞、收藏、评价与我的上传")
        +myEmpty("✦","社区记录暂时无法加载","请确认本地服务器正在运行，然后再试一次。",false)
        +`<a class="btn-accent my-wide-btn" href="community.html" target="_blank" rel="noopener">打开热门城市分享 →</a>`;
    }
  }
  function relativeCommunityTime(value){
    const time=new Date(value).getTime();
    if(!Number.isFinite(time))return "";
    const minutes=Math.max(0,Math.floor((Date.now()-time)/60000));
    if(minutes<1)return "刚刚";
    if(minutes<60)return minutes+" 分钟前";
    const hours=Math.floor(minutes/60);
    if(hours<24)return hours+" 小时前";
    const days=Math.floor(hours/24);
    return days<7?days+" 天前":new Date(value).toLocaleDateString("zh-CN");
  }
  function renderMy(){
    if(!myBody)return;
    const user=currentMyUser();
    if(!user){myView="overview";renderMyLogin();return;}
    if(myView==="trips")renderMyTrips();
    else if(myView==="favorites")renderMyFavorites();
    else if(myView==="bookings")renderMyBookings();
    else if(myView==="reviews")renderMyReviews();
    else if(myView==="settings")renderMySettings(user);
    else if(myView==="community")renderMyCommunity(user);
    else renderMyOverview(user);
  }
  async function openMy(){
    if(aiPanel&&!aiPanel.hidden)closeAI();
    if(tripPanel)tripPanel.hidden=true;
    renderMy();
    myPanel.hidden=false;
    document.body.style.overflow="hidden";
    setTimeout(()=>{const target=myBody.querySelector("input,button");if(target)target.focus();},80);
    await refreshAuthUser();
    if(!myPanel.hidden)renderMy();
  }
  function closeMy(){
    myPanel.hidden=true;
    document.body.style.overflow="";
  }
  document.querySelectorAll("[data-my-open]").forEach(btn=>btn.addEventListener("click",openMy));
  $("#myClose").addEventListener("click",closeMy);
  $("#mySettings").addEventListener("click",()=>{
    if(!currentMyUser()){toast("请先登录后再设置密码");return;}
    myView="settings";renderMy();myBody.scrollTop=0;
  });
  myPanel.addEventListener("click",e=>{if(e.target===myPanel)closeMy();});
  myBody.addEventListener("click",async e=>{
    const loginMode=e.target.closest("[data-my-login-mode]");
    if(loginMode){
      const phoneInput=myBody.querySelector("#myPhone");
      if(phoneInput)myLoginPhone=phoneInput.value.replace(/\D/g,"");
      myLoginMode=loginMode.dataset.myLoginMode;
      myLoginErrorText="";
      renderMyLogin();
      return;
    }
    const view=e.target.closest("[data-my-view]");
    if(view){myView=view.dataset.myView;renderMy();myBody.scrollTop=0;return;}
    const action=e.target.closest("[data-my-action]");
    if(action){
      if(action.dataset.myAction==="logout"){
        try{await fetch(communityApiBase+"/api/auth/logout",{method:"POST",credentials:"same-origin"});}catch{}
        clearAuthUser();myView="overview";myLoginMode="code";myLoginPhone="";myCodeState=null;renderMy();toast("已退出我的账户");
      }else if(action.dataset.myAction==="browse"){
        closeMy();$("#destinations").scrollIntoView({behavior:"smooth"});
      }else if(action.dataset.myAction==="open-trip"){
        closeMy();openTrip();
      }else if(action.dataset.myAction==="send-code"){
        const form=myBody.querySelector("#myLoginForm");
        const phone=form?String(new FormData(form).get("phone")||"").replace(/\D/g,""):"";
        myLoginPhone=phone;
        myLoginErrorText="";
        if(!validMyPhone(phone)){
          myLoginErrorText="请输入有效的 11 位中国大陆手机号";
        }else{
          try{
            const response=await fetch(communityApiBase+"/api/auth/code",{
              method:"POST",headers:{"Content-Type":"application/json"},credentials:"same-origin",
              body:JSON.stringify({phone})
            });
            const data=await response.json();
            if(!response.ok)throw new Error(data.error||"验证码获取失败");
            myCodeState={phone,code:data.demoCode||"",expiresAt:Date.now()+Number(data.expiresIn||300)*1000};
          }catch(error){
            myLoginErrorText=error.message||"验证码获取失败";
            myCodeState=null;
          }
        }
        renderMyLogin();
        if(phone&&validMyPhone(phone)&&myCodeState)toast("演示验证码已生成");
      }
      return;
    }
    const destination=e.target.closest("[data-my-dest]");
    if(destination){closeMy();openModal(destination.dataset.myDest);}
  });
  myBody.addEventListener("input",e=>{
    if(e.target.id==="myPhone")myLoginPhone=e.target.value.replace(/\D/g,"");
    if(e.target.id==="myPhone"||e.target.id==="myCode"||e.target.id==="myPassword"){
      const error=myBody.querySelector("#myLoginError");
      if(error){error.hidden=true;myLoginErrorText="";}
    }
  });
  myBody.addEventListener("submit",async e=>{
    if(e.target.id==="myLoginForm"){
      e.preventDefault();
      const formData=new FormData(e.target);
      const phone=String(formData.get("phone")||"").replace(/\D/g,"");
      myLoginPhone=phone;
      if(!validMyPhone(phone)){
        myLoginErrorText="请输入有效的 11 位中国大陆手机号";
        renderMyLogin();
        return;
      }
      try{
        const passwordMode=myLoginMode==="password";
        const response=await fetch(communityApiBase+(passwordMode?"/api/auth/login/password":"/api/auth/login/code"),{
          method:"POST",headers:{"Content-Type":"application/json"},credentials:"same-origin",
          body:JSON.stringify(passwordMode?{
            phone,password:String(formData.get("password")||"")
          }:{
            phone,code:String(formData.get("code")||"").replace(/\D/g,"")
          })
        });
        const data=await response.json();
        if(!response.ok)throw new Error(data.error||"登录失败");
        finishMyLogin(data.user,!!data.created);
      }catch(error){
        myLoginErrorText=error.message||"登录失败，请稍后重试";
        renderMyLogin();
      }
      return;
    }
    if(e.target.id==="myPasswordForm"){
      e.preventDefault();
      const user=currentMyUser();
      if(!user){myView="overview";renderMy();return;}
      const formData=new FormData(e.target);
      const error=myBody.querySelector("#mySettingsError");
      const showError=message=>{if(error){error.textContent=message;error.hidden=false;}};
      try{
        const currentPassword=String(formData.get("currentPassword")||"");
        const newPassword=String(formData.get("newPassword")||"");
        const confirmPassword=String(formData.get("confirmPassword")||"");
        if(newPassword.length<6){showError("新密码至少需要 6 位字符");return;}
        if(newPassword!==confirmPassword){showError("两次输入的新密码不一致");return;}
        const response=await fetch(communityApiBase+"/api/auth/password",{
          method:"POST",headers:{"Content-Type":"application/json"},credentials:"same-origin",
          body:JSON.stringify({currentPassword,newPassword})
        });
        const data=await response.json();
        if(!response.ok)throw new Error(data.error||"密码保存失败");
        cacheAuthUser(data.user);
        renderMy();
        toast("登录密码已保存");
      }catch(error){
        showError(error.message||"密码保存失败，请稍后重试");
      }
      return;
    }
    if(e.target.id==="myBookingForm"){
      e.preventDefault();
      const user=currentMyUser();
      if(!user){myView="overview";renderMy();return;}
      const formData=new FormData(e.target);
      const platform=String(formData.get("platform")||"").trim();
      const orderNo=String(formData.get("orderNo")||"").trim();
      const error=myBody.querySelector("#myBookingError");
      const showError=message=>{if(error){error.textContent=message;error.hidden=false;}};
      if(!orderNo){showError("请输入订单编号");return;}
      const records=myBookings();
      if(records.some(item=>item.platform===platform&&item.orderNo===orderNo)){
        showError("该订单编号已经关联");return;
      }
      records.unshift({
        id:"booking-"+Date.now().toString(36),
        platform,
        type:platform,
        title:platform+"订单",
        orderNo,
        status:"本地记录",
        createdAt:new Date().toISOString()
      });
      localStorage.setItem("hy_bookings_"+myPhone,JSON.stringify(records));
      renderMy();
      toast("订单编号已保存在本机");
    }
  });

  /* ---- 路线规划（参考高德地图：交通方式 + 耗时/费用估算 + 地图绘制 + 高德导航外链） ---- */
  const TRANS={
    plane:{label:"✈️ 飞机",speed:750,fixed:2.5,perKm:0.75,minCost:400,color:"#E11D48",note:"含机场往返约 2.5 小时"},
    rail:{label:"🚄 高铁",speed:280,fixed:1.0,perKm:0.45,minCost:60,color:"#0052FF",note:"含进站候车约 1 小时"},
    car:{label:"🚗 自驾",speed:95,fixed:0,perKm:0.85,minCost:0,color:"#F6A800",note:"油费+过路费约 0.85 元/km"},
    bus:{label:"🚌 大巴",speed:75,fixed:0.5,perKm:0.35,minCost:30,color:"#10B981",note:"适合 300km 内短途"}
  };
  function hav(a,b){
    const R=6371,d=Math.PI/180;
    const dLat=(b.lat-a.lat)*d,dLng=(b.lng-a.lng)*d;
    const s=Math.sin(dLat/2)*Math.sin(dLat/2)+Math.cos(a.lat*d)*Math.cos(b.lat*d)*Math.sin(dLng/2)*Math.sin(dLng/2);
    return 2*R*Math.asin(Math.sqrt(s));
  }
  function defTrans(km){ return km>800?"plane":(km>300?"rail":"car"); }
  function routeKey(i){ const a=trip.items[i],b=trip.items[i+1]; return (a&&b)?a.id+"->"+b.id:""; }
  let routePrefs={}; try{routePrefs=JSON.parse(localStorage.getItem("hy_route")||"{}")||{};}catch(e){}
  function saveRoutePrefs(){ try{localStorage.setItem("hy_route",JSON.stringify(routePrefs));}catch(e){} }
  function arcPts(a,b,bend){
    const mx=(a.lat+b.lat)/2+(b.lng-a.lng)*bend, my=(a.lng+b.lng)/2-(b.lat-a.lat)*bend;
    const pts=[];
    for(let t=0;t<=1.0001;t+=1/32){
      const u=1-t;
      pts.push([u*u*a.lat+2*u*t*mx+t*t*b.lat, u*u*a.lng+2*u*t*my+t*t*b.lng]);
    }
    return pts;
  }
  let routeLayer=null;
  function clearRouteDraw(){ if(routeLayer&&map){routeLayer.forEach(l=>{try{map.removeLayer(l);}catch(e){}});} routeLayer=null; }
  function drawRoute(){
    if(!map)return; clearRouteDraw(); routeLayer=[];
    const pts=[];
    trip.items.forEach((x,i)=>{
      const d=data.find(y=>y.id===x.id); if(!d)return; pts.push(d);
      if(i>0){
        const prev=data.find(y=>y.id===trip.items[i-1].id); if(!prev)return;
        const km=hav(prev,d);
        const mode=routePrefs[routeKey(i-1)]||defTrans(km);
        const color=TRANS[mode].color;
        const line=L.polyline(arcPts(prev,d,0.12),{color,weight:3,opacity:.85,dashArray:mode==="plane"?"2 9":(mode==="rail"?"10 6":null)});
        line.addTo(map); routeLayer.push(line);
        const mid=arcPts(prev,d,0.12)[16];
        const mk=L.marker(mid,{icon:L.divIcon({className:"rt",html:`<div class="rt-tip" style="background:${color}">${TRANS[mode].label.split(" ")[0]}·${Math.round(km)}km</div>`,iconSize:[74,20],iconAnchor:[37,10]}),interactive:false});
        mk.addTo(map); routeLayer.push(mk);
      }
    });
    if(pts.length>1&&routeLayer.length){
      map.flyToBounds(L.latLngBounds(pts.map(p=>[p.lat,p.lng])).pad(0.25),{duration:1.2});
    }
  }
  function segData(i){
    const a=data.find(y=>y.id===trip.items[i].id), b=data.find(y=>y.id===trip.items[i+1].id);
    if(!a||!b)return null;
    const km=hav(a,b);
    const mode=routePrefs[routeKey(i)]||defTrans(km);
    const t=TRANS[mode];
    return {a,b,km,mode,t,hrs:km/t.speed+t.fixed,cost:Math.max(t.minCost,km*t.perKm)};
  }
  function gaoDeURL(a,b){
    const f=encodeURIComponent(a.name+","+a.lat+","+a.lng), t=encodeURIComponent(b.name+","+b.lat+","+b.lng);
    return "https://uri.amap.com/navigation?from="+f+"&to="+t+"&mode=car&policy=0&src=hy&coordinate=gaode&callnative=0";
  }
  function gaoDeAllURL(){
    const pts=trip.items.map(x=>data.find(y=>y.id===x.id)).filter(Boolean);
    if(pts.length<2)return null;
    const enc=p=>encodeURIComponent(p.name+","+p.lat+","+p.lng);
    const via=pts.slice(1,-1).map(enc).join("|");
    return "https://uri.amap.com/navigation?from="+enc(pts[0])+(via?"&via="+via:"")+"&to="+enc(pts[pts.length-1])+"&mode=car&policy=0&src=hy&coordinate=gaode&callnative=0";
  }
  const routeModal=$("#routeModal"), routeBodyEl=$("#routeBody");
  function fmtHrs(h){ if(h<1)return Math.round(h*60)+" 分钟"; const hh=Math.floor(h),mm=Math.round((h-hh)*60); return hh+" 小时"+(mm?" "+mm+" 分":""); }
  function renderRoutePanel(){
    if(!routeBodyEl)return;
    if(trip.items.length<2){
      routeBodyEl.innerHTML=`<div class="rp-empty"><span>🗺</span><p>至少加入 2 个目的地才能规划路线</p><small>在目的地详情里点「加入行程单」</small></div>`;
      return;
    }
    let totKm=0,totHrs=0,totCost=0; const segs=[];
    for(let i=0;i<trip.items.length-1;i++){
      const s=segData(i); if(!s)continue;
      segs.push(s); totKm+=s.km; totHrs+=s.hrs; totCost+=s.cost;
    }
    const allURL=gaoDeAllURL();
    routeBodyEl.innerHTML=segs.map((s,i)=>`
      <div class="rp-seg">
        <div class="rp-seg-head">
          <span class="rp-num">${i+1}</span>
          <div class="rp-cities"><b>${esc(s.a.name)}</b><span class="rp-arrow">➜</span><b>${esc(s.b.name)}</b></div>
          <span class="rp-km">${Math.round(s.km)} km</span>
        </div>
        <div class="rp-modes">
          ${Object.entries(TRANS).map(([k,t])=>`<button type="button" class="rp-mode ${k===s.mode?"on":""}" data-seg="${i}" data-mode="${k}" style="--c:${t.color}" title="${esc(t.note)}">${t.label}</button>`).join("")}
        </div>
        <div class="rp-est">
          <span>⏱ ${fmtHrs(s.hrs)}</span><span>💰 ¥${Math.round(s.cost).toLocaleString()}</span>
          <span class="rp-note">${esc(s.t.note)}</span>
          <a class="rp-gd" href="${gaoDeURL(s.a,s.b)}" target="_blank" rel="noopener">高德导航 ↗</a>
        </div>
      </div>`).join("")
      +`<div class="rp-total">
          <div class="rp-total-line">🧭 全程 ${Math.round(totKm).toLocaleString()} km · 交通约 ${fmtHrs(totHrs)} · 约 ¥${Math.round(totCost).toLocaleString()}</div>
          ${allURL?`<a class="rp-gdall" href="${allURL}" target="_blank" rel="noopener">🧭 在高德地图打开全程路线</a>`:""}
        </div>`;
    routeBodyEl.querySelectorAll(".rp-mode").forEach(b=>b.addEventListener("click",()=>{
      routePrefs[routeKey(+b.dataset.seg)]=b.dataset.mode; saveRoutePrefs(); renderRoutePanel(); drawRoute();
    }));
  }
  function openRoute(){
    if(trip.items.length<2){toast("至少加入 2 个目的地才能规划路线");return;}
    tripPanel.hidden=true;
    routeModal.hidden=false; document.body.style.overflow="hidden";
    renderRoutePanel(); drawRoute();
  }
  function closeRoute(){ routeModal.hidden=true; document.body.style.overflow=""; clearRouteDraw(); }
  const trb=$("#tripRoute"); if(trb)trb.addEventListener("click",openRoute);
  routeModal.addEventListener("click",e=>{ if(e.target.hasAttribute("data-route-close"))closeRoute(); });

  /* ---- AI 面板 ---- */
  const aiPanel = $("#aiPanel"), aiFab = $("#aiFab"), aiMessages = $("#aiMessages"), aiForm = $("#aiForm"), aiText = $("#aiText");
  const apiBase=(window.APP_CONFIG&&window.APP_CONFIG.apiBase?String(window.APP_CONFIG.apiBase):"").replace(/\/$/,"");
  const cloudThreadKey="hy_cloud_thread";
  let cloudThreadId=localStorage.getItem(cloudThreadKey);
  if(!cloudThreadId){
    cloudThreadId=(crypto.randomUUID&&crypto.randomUUID())||("thread-"+Date.now().toString(36)+"-"+Math.random().toString(36).slice(2,10));
    localStorage.setItem(cloudThreadKey,cloudThreadId);
  }
  let cloudReady=false;
  let cloudRetryAt=0;
  const chatHistory=[];

  function setAIStatus(text,online){
    const el=$("#aiStatus");
    if(!el)return;
    el.textContent=text;
    el.classList.toggle("online",!!online);
  }

  async function detectCloud(){
    if(!/^https?:$/.test(location.protocol)){setAIStatus("本地推荐引擎",false);return;}
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),3500);
    try{
      const response=await fetch(apiBase+"/api/health",{signal:controller.signal,cache:"no-store"});
      if(!response.ok)throw new Error("health unavailable");
      const health=await response.json();
      cloudReady=!!health.ok;
      const agent=health.services&&health.services.agent;
      setAIStatus(agent==="agentarts-managed"?"AgentArts · Skill 已连接":agent==="configured"?"云端智能体已连接":"云服务在线 · 本地推理",true);
      if(cloudReady)syncTripToCloud();
    }catch{
      setAIStatus("本地推荐引擎",false);
    }finally{
      clearTimeout(timer);
    }
  }

  async function syncTripToCloud(){
    if(!cloudReady||!trip.items.length)return;
    try{
      await fetch(apiBase+"/api/trips",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({thread_id:cloudThreadId,title:"九州行行程计划",items:trip.items.map(x=>x.id)})
      });
    }catch{}
  }

  function openAI(){aiPanel.hidden=false;aiFab.style.display="none";setTimeout(()=>aiText.focus(),100);if(!aiMessages.children.length)addMsg(window.AI.greet(),"bot");}
  function closeAI(){aiPanel.hidden=true;aiFab.style.display="";}
  document.querySelectorAll("[data-open-ai]").forEach(btn=>btn.addEventListener("click",openAI));
  $("#aiClose").addEventListener("click",closeAI);
  aiFab.addEventListener("click",openAI);
  window.closeAI = closeAI;
  window.openAI = openAI;

  function addMsg(content,who){
    const div = document.createElement("div");
    div.className = "msg "+who;
    const text=document.createElement("div");
    text.className="msg-text";
    text.textContent=typeof content==="string"?content:content.text;
    div.appendChild(text);
    if(typeof content!=="string"&&content.cards&&content.cards.length){
      content.cards.forEach(c=>{
        const card = document.createElement("button");
        card.type="button";
        card.className="msg-card";
        card.innerHTML = `<img src="${cover(c,120,120)}" alt="${esc(c.name)}"/><div><b>${esc(c.name)}</b><br/><span>${fmt(c.price)} · ${c.duration}天 · ★${c.rating}</span>${c.reason?`<small>${esc(c.reason)}</small>`:""}</div>`;
        card.addEventListener("click",()=>{openModal(c.id);});
        div.appendChild(card);
      });
    }
    if(typeof content!=="string"&&Array.isArray(content.skills)&&content.skills.length){
      const skills=document.createElement("div");
      skills.className="msg-skills";
      const title=document.createElement("div");
      title.className="msg-skills-title";
      title.textContent=`Skills 编排 · ${content.skills.length} 项`;
      const list=document.createElement("div");
      list.className="msg-skill-list";
      content.skills.forEach(skill=>{
        const chip=document.createElement("span");
        chip.className="msg-skill";
        chip.textContent=skill.name||skill.id;
        if(skill.summary)chip.title=skill.summary;
        list.appendChild(chip);
      });
      skills.appendChild(title);
      skills.appendChild(list);
      div.appendChild(skills);
    }
    if(typeof content!=="string"&&content.source){
      const source=document.createElement("div");
      source.className="msg-source";
      source.textContent=content.source;
      div.appendChild(source);
    }
    aiMessages.appendChild(div);
    aiMessages.scrollTop = aiMessages.scrollHeight;
    return div;
  }

  function cloudAnswer(payload){
    const cards=(payload.recommendations||[]).map(item=>{
      const id=typeof item==="string"?item:item.id;
      const d=data.find(x=>x.id===id);
      return d?{...d,reason:(item&&item.reason)||""}:null;
    }).filter(Boolean);
    let text=payload.reply||"已根据你的需求生成推荐。";
    if(Array.isArray(payload.itinerary)&&payload.itinerary.length&&!/(第1天|Day\s*1|D1\b)/i.test(text)){
      text+="\n\n"+payload.itinerary.map(day=>`D${day.day||"·"} ${day.city||""}：${(day.items||[]).join(" → ")}`).join("\n");
    }
    if(payload.warning&&payload.provider==="local-fallback")text+="\n\n云端服务暂时不可用，本次已自动使用本地推荐。";
    const skillCount=Array.isArray(payload.skills)?payload.skills.length:0;
    const source=payload.provider==="agentarts-managed"
      ?`AgentArts Managed Agent${skillCount?` · ${skillCount} Skills`:" · 官方智能体"}`
      :payload.provider==="cloud-agent"
        ?`华为云智能体${skillCount?` · ${skillCount} Skills 编排`:" · 结构化行程"}`
        :payload.provider==="local-fallback"?"本地降级 · Skills 结果可用":"云服务 · 本地推荐";
    return {text,cards,source,skills:payload.skills||[]};
  }

  async function aiSend(q){
    if(!q.trim()) return;
    addMsg(q,"user");
    const previous=chatHistory.slice(-8);
    chatHistory.push({role:"user",content:q});
    const loading=addMsg({text:"正在结合目的地与当前行程生成建议…"},"bot");
    loading.classList.add("loading");
    let result=null;
    if(cloudReady&&Date.now()>=cloudRetryAt){
      const controller=new AbortController();
      const timer=setTimeout(()=>controller.abort(),180000);
      try{
        const response=await fetch(apiBase+"/api/ai/plan",{
          method:"POST",
          headers:{"Content-Type":"application/json"},
          body:JSON.stringify({message:q,thread_id:cloudThreadId,history:previous,trip_ids:trip.items.map(x=>x.id)}),
          signal:controller.signal
        });
        if(!response.ok)throw new Error("agent request failed");
        const payload=await response.json();
        if(!payload||typeof payload.reply!=="string"||!payload.reply.trim())throw new Error("agent returned an empty reply");
        result=cloudAnswer(payload);
        if(payload.cached)result.source+=" · 结果缓存命中";
      }catch{
        cloudRetryAt=Date.now()+15000;
        setAIStatus("本次云端响应失败 · 本地临时回答",false);
        toast("本次云端响应失败，稍后会自动重试云端服务");
      }finally{
        clearTimeout(timer);
      }
    }
    if(!result){
      await new Promise(resolve=>setTimeout(resolve,260));
      const local=window.AI.answer(q);
      result={...local,source:"本地推荐引擎"};
    }
    loading.remove();
    addMsg(result,"bot");
    chatHistory.push({role:"assistant",content:result.text});
    if(chatHistory.length>16)chatHistory.splice(0,chatHistory.length-16);
    toast("旅行助手已为你推荐 "+(result.cards?result.cards.length:0)+" 个目的地");
  }
  aiForm.addEventListener("submit", e=>{e.preventDefault();aiSend(aiText.value);aiText.value="";});
  document.querySelectorAll(".chip").forEach(c=>c.addEventListener("click",()=>{aiSend(c.dataset.q);}));

  /* ---- 手机扫码访问 ---- */
  const qrModal=$("#qrModal"), qrCanvas=$("#qrCanvas"), qrUrl=$("#qrUrl");
  function shareQR(){
    let host = location.hostname;
    const config = window.APP_CONFIG || {};
    if(host==="localhost"||host==="127.0.0.1"||host==="0.0.0.0"||location.protocol==="file:") host = config.lanIp || "";
    if(!host){
      qrUrl.textContent = "请使用电脑的局域网 IP 打开本页后再扫码";
      qrCanvas.innerHTML = '<div class="feature-fallback"><b>无法自动获取局域网地址</b><span>请通过 start-server.ps1 启动，并确认手机与电脑在同一 WiFi。</span></div>';
      qrModal.hidden=false;
      document.body.style.overflow="hidden";
      return;
    }
    const protocol = location.protocol==="file:" ? "http:" : location.protocol;
    const sharePort = config.port || location.port || (protocol==="http:" ? "80" : "443");
    const url = protocol+"//"+host+(sharePort==="80"||sharePort==="443"?"":":"+sharePort)+"/";
    qrUrl.textContent = url;
    if(window.QRCode){
      qrCanvas.innerHTML="";
      new window.QRCode(qrCanvas,{
        text:url,
        width:200,
        height:200,
        colorDark:"#0052FF",
        colorLight:"#ffffff",
        correctLevel:window.QRCode.CorrectLevel.M
      });
    } else {
      qrCanvas.innerHTML = '<div class="feature-fallback"><b>二维码组件未加载</b><span>请手动输入上方网址。</span></div>';
    }
    qrModal.hidden=false;
    document.body.style.overflow="hidden";
  }
  function closeQR(){ qrModal.hidden=true; document.body.style.overflow=""; }
  $("#qrOpen").addEventListener("click", shareQR);
  qrModal.addEventListener("click", e=>{ if(e.target.hasAttribute("data-qr-close")) closeQR(); });

  /* ---- Toast ---- */
  let toastT;
  function toast(msg){
    const t = $("#toast"); t.textContent=msg; t.hidden=false;
    clearTimeout(toastT); toastT=setTimeout(()=>t.hidden=true,2200);
  }

  /* ---- 启动 ---- */
  $("#hsCount").textContent = data.length;
  $("#hsCountries").textContent = new Set(data.map(d=>d.region)).size;
  $("#hsAvg").textContent = (data.reduce((a,d)=>a+d.rating,0)/data.length).toFixed(1);
  initQuickRoute();
  renderRoutes();
  render();
  initMap();
  renderStats();
  updateTripUI();
  detectCloud();
  const pageParams = new URLSearchParams(location.search);
  const pq = pageParams.get("city");
  if(pq){ const d = data.find(x=>x.name===pq||x.city===pq); if(d) setTimeout(()=>openModal(d.id), 500); }
  if(pageParams.get("my")==="1") setTimeout(openMy, 420);
  if(pageParams.get("ai")==="1") setTimeout(openAI, 520);
  document.querySelectorAll('a[href="#planner"]').forEach(a=>a.addEventListener("click",e=>{e.preventDefault();openPlanner();}));
  setTimeout(()=>{if(map)map.invalidateSize();},300);
  window.addEventListener("resize",()=>{if(map)map.invalidateSize();});
  toast("欢迎来到九州行 · 共 "+data.length+" 个中国目的地");
})();
