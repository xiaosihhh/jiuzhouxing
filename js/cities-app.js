/* 九州行 · 中国城市库页面逻辑（区域 → 省份手风琴懒渲染，每城经典景点细化） */
(function(){
  "use strict";
  const $ = s => document.querySelector(s);
  const esc = s => String(s).replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

  /* ---- 封面 SVG（按城市名生成确定性渐变，图片加载前的兜底） ---- */
  function strHash(s){ let h=0; for(let i=0;i<s.length;i++){ h=(h*31+s.charCodeAt(i))>>>0; } return h; }
  function cover(name,w,h,label){
    return "assets/cities/"+encodeURIComponent(name||"中国")+".webp";
  }

  /* ---- Wikimedia 实况照片懒加载 ---- */
  const PHOTO_QUERY = {
    "北京":"Beijing skyline","上海":"Shanghai skyline","成都":"Chengdu city","重庆":"Chongqing skyline","杭州":"West Lake Hangzhou","西安":"Xi'an city wall",
    "三亚":"Sanya beach","拉萨":"Potala Palace","乌鲁木齐":"Urumqi","喀纳斯":"Kanas Lake","广州":"Guangzhou skyline","深圳":"Shenzhen skyline",
    "南京":"Nanjing","苏州":"Suzhou gardens","厦门":"Xiamen","青岛":"Qingdao","大连":"Dalian","昆明":"Kunming","兰州":"Lanzhou","敦煌":"Dunhuang Mingsha",
    "洛阳":"Luoyang Longmen","长沙":"Changsha","哈尔滨":"Harbin","天津":"Tianjin","武汉":"Wuhan Yellow Crane","大理":"Dali Erhai","丽江":"Lijiang old town",
    "桂林":"Guilin Li River","承德":"Chengde","平遥":"Pingyao","大同":"Yungang Grottoes","五台山":"Mount Wutai","黄山":"Huangshan","九寨沟":"Jiuzhaigou",
    "张家界":"Zhangjiajie","武夷山":"Wuyi Mountains","鼓浪屿":"Gulangyu","长白山":"Changbai Mountain","漠河":"Mohe","哈尔滨市":"Harbin",
    "香港":"Hong Kong skyline","澳门":"Macau","台北":"Taipei 101","高雄":"Kaohsiung","吐鲁番":"Turpan","喀什":"Kashgar","伊犁":"Ili Kazakh",
    "西双版纳":"Xishuangbanna","香格里拉":"Shangri-La","稻城":"Daocheng","林芝":"Nyingchi","恩施":"Enshi canyon","延吉":"Yanji","北海":"Beihai"
  };
  let photoObs=null;
  if("IntersectionObserver" in window){
    photoObs=new IntersectionObserver(entries=>{
      entries.forEach(en=>{
        if(en.isIntersecting){ const el=en.target; photoObs.unobserve(el); loadPhoto(el); }
      });
    },{rootMargin:"300px"});
  }
  function loadPhoto(){ /* 城市封面已随项目本地分发 */ }
  function observePhoto(el,city){
    el.dataset.q=(PHOTO_QUERY[city.name]||city.name+" "+(city.sights&&city.sights[0]?city.sights[0][0]:"China"))+" China";
    if(photoObs) photoObs.observe(el); else loadPhoto(el);
  }

  /* ---- 主题（与主页共用 localStorage.theme） ---- */
  const html = document.documentElement;
  let theme = localStorage.getItem("theme") || (matchMedia("(prefers-color-scheme:dark)").matches?"dark":"light");
  html.dataset.theme = theme;
  $("#themeToggle").addEventListener("click", ()=>{
    theme = theme==="dark"?"light":"dark";
    html.dataset.theme = theme;
    localStorage.setItem("theme", theme);
  });

  /* ---- 数据 ---- */
  const CC = window.CHINA_CITIES || {};
  const REGIONS = ["华北","华东","华南","华中","西南","西北","东北","港澳台"];
  const REGION_ICO = {"华北":"🏔","华东":"🌸","华南":"🌴","华中":"🏞","西南":"🏔","西北":"🏜","东北":"❄️","港澳台":"🌏"};
  const TYPE_EMOJI = {
    "博物馆":"🏛️","历史古迹":"🗿","寺庙":"🛕","公园":"🌳","自然风光":"🌄","山岳":"⛰️","湖泊":"💧","古镇":"🏘️",
    "历史街区":"🚶","地标":"🗼","海滩":"🏖️","岛屿":"🏝️","主题乐园":"🎡","石窟":"🗿","溶洞":"🕳️","峡谷":"🏞️",
    "草原":"🌾","沙漠":"🏜️","村落":"🏡","民俗村":"🎭","游船":"⛵","漂流":"🚣","演出":"🎪","市集":"🛍️",
    "园林":"🌿","教堂":"⛪","清真寺":"🕌","宫殿":"🏯","观景台":"🔭","瀑布":"💦","石林":"🗿",
    "梯田":"🌾","盐湖":"🧂","影视基地":"🎬","滑雪度假区":"🎿","海洋馆":"🐬","动物园":"🐼",
    "植物园":"🌿","河流":"🌊","交通体验":"🚡","奇观":"✨","工程奇观":"🌉","地质奇观":"🌋","自然奇观":"🌈",
    "文化园区":"🏛️","公路景观":"🛣️","国家公园":"🏞️","农场":"🐑","文创园区":"🎨","校园":"🎓","餐饮体验":"🍜",
    "桥梁奇观":"🌉","公路景观体验":"🛣️","观景体验":"🔭","文艺村":"🎨","小镇":"🏘️","山":"⛰️","古村落":"🏘️"
  };
  const te = t => TYPE_EMOJI[t] || "📍";

  const nProvinces = Object.values(CC).reduce((n,r)=>n+Object.keys(r).length,0);
  const allCities = [];
  REGIONS.forEach(r=>Object.entries(CC[r]||{}).forEach(([prov,list])=>list.forEach(c=>allCities.push({...c,region:r,province:prov}))));
  const nSights = allCities.reduce((n,c)=>n+(c.sights?c.sights.length:0),0);
  $("#chStat").textContent = nProvinces;
  $("#chCityStat").textContent = allCities.length;

  /* ---- 状态 ---- */
  let state = { q:"", region:"全部", onlyFull:false, view:"cities", open:new Set() };
  const body = $("#chBody");
  const S5 = window.SCENIC_5A || {}, MV = window.MUST_VISIT || {}, MT = window.MUST_TOP || [];

  function matchCity(c){
    if(state.onlyFull && !c.full) return false;
    if(state.q){
      const q = state.q.toLowerCase();
      if(c.name.toLowerCase().includes(q) || c.province.toLowerCase().includes(q) || (c.desc||"").toLowerCase().includes(q)) return true;
      return (c.sights||[]).some(s=>String(s[0]).toLowerCase().includes(q));
    }
    return true;
  }

  /* ---- 景区搜索词（英文优先，无映射用中文名） ---- */
  function scenicQuery(name){
    const EN = window.SCENIC_EN||{};
    if(EN[name]) return EN[name];
    const hit = Object.keys(EN).filter(k=>name.includes(k)||k.includes(name));
    if(hit.length) return EN[hit[0]];
    return name+" China";
  }
  /* ---- 景区图片卡片 ---- */
  function scenicCard(name,extra){
    return `<button type="button" class="sc-card" data-sname="${esc(name)}" ${extra||""}>
      <span class="sc-card-img"><img src="${cover(name,300,170,name)}" alt="${esc(name)}" data-sq="${esc(scenicQuery(name))}"/></span>
      <span class="sc-card-name">${esc(name)}</span>
    </button>`;
  }
  function observeScenicImgs(scope){
    (scope||body).querySelectorAll("img[data-sq]").forEach(im=>{
      if(im._ob)return; im._ob=1;
      if(photoObs) photoObs.observe(im); else loadPhoto(im);
    });
  }

  /* ---- 景区详情弹窗（大图） ---- */
  function openScenic(name,prov,city){
    chModal.setAttribute("aria-label",name+"景区详情");
    chModalBody.innerHTML = `
      <div class="ch-m-photo"><img src="${cover(name,560,260,name)}" alt="${esc(name)}" data-sq="${esc(scenicQuery(name))}"/></div>
      <span class="ch-m-eyebrow">${prov?"🏅 5A 景区":"🔥 必打卡点"}${city?" · "+esc(city):""}</span>
      <h3 class="ch-m-name">${esc(name)}</h3>
      ${prov&&S5[prov]?`<p class="ch-m-desc">${esc(prov)}国家级 5A 旅游景区（该省共 ${S5[prov].count} 家）</p>`:`<p class="ch-m-desc">平台必打卡榜上榜景点</p>`}
      <div class="ch-m-actions">
        <button type="button" class="btn-accent" data-search-city="${esc(city||prov||name.slice(0,2))}">查看相关城市 →</button>
      </div>`;
    chModal.hidden = false;
    document.body.style.overflow = "hidden";
    const im=chModalBody.querySelector("img[data-sq]"); if(im) loadPhoto(im);
    const btn=chModalBody.querySelector("[data-search-city]");
    if(btn)btn.addEventListener("click",()=>{
      closeCity();
      si.value = btn.dataset.searchCity.slice(0,4);
      state.q = si.value; sc.hidden=false;
      document.querySelector('.ch-tab[data-c="全部"]').click();
    });
  }

  /* ---- 5A 名录视图（省份分组 · 景区图片卡片 · 地图联动） ---- */
  function render5A(){
    const q = state.q.toLowerCase();
    showMapView(true,"5a");
    const frag = document.createDocumentFragment();
    let tot = 0;
    const entries = Object.entries(S5).filter(([p,v])=>v.count>0).sort((a,b)=>b[1].count-a[1].count);
    entries.forEach(([prov,v])=>{
      const list = q ? v.list.filter(a=>a.toLowerCase().includes(q)||prov.toLowerCase().includes(q)) : v.list;
      if(q && !list.length) return;
      tot += list.length;
      const box = document.createElement("section");
      box.className = "sc-box";
      box.innerHTML = `
        <div class="sc-head"><span class="ch-flag">${esc(prov[0])}</span><b>${esc(prov)}</b><span class="sc-count">🏅 ${v.count} 家 5A</span></div>
        <div class="sc-cards">${list.map(a=>scenicCard(a)).join("")}</div>`;
      frag.appendChild(box);
    });
    const sum = entries.reduce((n,[,v])=>n+v.count,0);
    const hdr = document.createElement("div");
    hdr.className = "sc-hero";
    hdr.innerHTML = `<div class="sc-hero-line">🏅 国家级 5A 景区名录 · 覆盖 ${entries.length} 个省区市 · 共 <b>${sum}</b> 家</div><div class="sc-hero-sub">按拥有数量排序 · 点击卡片查看景区大图与所在城市</div>`;
    body.innerHTML = "";
    if(!tot){ showMapView(false); body.innerHTML = `<div class="ch-empty">没有匹配的 5A 景区<br/><small>换个关键词试试</small></div>`; return; }
    body.appendChild(hdr); body.appendChild(frag);
    observeScenicImgs();
    body.querySelectorAll(".sc-card").forEach(c=>c.addEventListener("click",()=>{
      const prov2=c.closest(".sc-box").querySelector(".sc-head b").textContent;
      openScenic(c.dataset.sname,prov2,null);
    }));
  }

  /* ---- 必打卡榜视图（TOP10 + 城市分组图片卡片 + 地图联动） ---- */
  function renderMust(){
    const q = state.q.toLowerCase();
    showMapView(true,"must");
    const frag = document.createDocumentFragment();
    let tot = 0;
    const top = document.createElement("section");
    top.className = "sc-box mt-top";
    top.innerHTML = `<div class="sc-head"><b>🏆 必打卡榜 · 上榜数量 TOP10 城市</b></div>
      <div class="mt-rank">${MT.map((c,i)=>`<span class="mt-item ${MV[c]?"":"mt-dim"}"><i>${i+1}</i>${esc(c)}${MV[c]?`<em>${MV[c].count}</em>`:""}</span>`).join("")}</div>`;
    frag.appendChild(top);
    const entries = Object.entries(MV);
    entries.forEach(([city,v])=>{
      const list = q ? v.list.filter(m=>m.toLowerCase().includes(q)||city.toLowerCase().includes(q)) : v.list;
      if(q && !list.length) return;
      tot += list.length;
      const box = document.createElement("section");
      box.className = "sc-box";
      const rank = MT.indexOf(city);
      box.innerHTML = `
        <div class="sc-head"><b>${esc(city)}</b>${rank>=0?`<span class="mt-rank-tag">TOP${rank+1}</span>`:""}<span class="sc-count sc-must-count">🔥 上榜 ${list.length} 处</span></div>
        <div class="sc-cards">${list.map(m=>scenicCard(m)).join("")}</div>`;
      frag.appendChild(box);
    });
    body.innerHTML = "";
    if(q && !tot){ showMapView(false); body.innerHTML = `<div class="ch-empty">没有匹配的打卡点<br/><small>换个关键词试试</small></div>`; return; }
    body.appendChild(frag);
    observeScenicImgs();
    body.querySelectorAll(".sc-card").forEach(c=>c.addEventListener("click",()=>{
      const city2=c.closest(".sc-box").querySelector(".sc-head b").textContent;
      openScenic(c.dataset.sname,null,city2);
    }));
  }

  function render(){
    const frag = document.createDocumentFragment();
    const regions = state.region==="全部" ? REGIONS : [state.region];
    let total = 0;

    regions.forEach(region=>{
      const provEntries = Object.entries(CC[region] || {});
      if(!provEntries.length) return;
      const regCities = provEntries.flatMap(([prov,list])=>list.map(c=>({...c,region,province:prov})));
      const matched = regCities.filter(matchCity);
      total += matched.length;
      if(!matched.length) return;

      const sec = document.createElement("section");
      sec.className = "ch-cont";
      const secs = document.createElement("button");
      secs.type = "button";
      secs.className = "ch-cont-head";
      secs.setAttribute("aria-expanded", "true");
      secs.innerHTML = `<span class="ch-cont-ico">${REGION_ICO[region]||"🧭"}</span><b>${esc(region)}</b><span class="ch-cont-meta">${provEntries.length} 省区市 · ${regCities.length} 城市</span><span class="ch-cont-arrow">▾</span>`;
      secs.addEventListener("click", ()=>{
        const folded = sec.classList.toggle("fold");
        secs.setAttribute("aria-expanded", String(!folded));
      });
      sec.appendChild(secs);

      const wrap = document.createElement("div");
      wrap.className = "ch-countries";

      provEntries.forEach(([prov,list])=>{
        const cities = list.map(c=>({...c,region,province:prov}));
        const hit = cities.filter(matchCity);
        if(!hit.length) return;
        const open = state.open.has(prov) || !!state.q;
        const box = document.createElement("div");
        box.className = "ch-country" + (open?" open":"");
        const head = document.createElement("button");
        head.type = "button";
        head.className = "ch-country-head";
        head.setAttribute("aria-expanded", String(open));
        const sightCount = hit.reduce((n,c)=>n+(c.sights||[]).length,0);
        head.innerHTML = `<span class="ch-flag">${esc(prov[0])}</span><b>${esc(prov)}</b>${S5[prov]&&S5[prov].count?`<span class="ch-5a" title="国家级5A景区">🏅${S5[prov].count}家5A</span>`:""}<span class="ch-count">${hit.length} 城 · ${sightCount} 景点</span><span class="ch-arrow">▸</span>`;
        head.addEventListener("click", ()=>{
          const o = box.classList.toggle("open");
          head.setAttribute("aria-expanded", String(o));
          if(o) state.open.add(prov); else state.open.delete(prov);
        });
        box.appendChild(head);

        const grid = document.createElement("div");
        grid.className = "ch-city-grid";
        const cards = document.createElement("div");
        cards.className = "ch-cards";
        hit.forEach(c=>{
          const el = document.createElement("button");
          el.type = "button";
          el.className = "ch-city" + (c.full?" full":"");
          el.setAttribute("aria-label", `查看${c.name}${c.full?"精选详情":"城市景点"}`);
          const nS = (c.sights||[]).length;
          const nM = MV[c.name]?MV[c.name].count:0;
          el.innerHTML = `<span class="ch-city-img"><img src="${cover(c.name,340,140,c.name)}" alt="${esc(c.name)}" data-city="${esc(c.name)}"/></span><span class="ch-city-name">${esc(c.name)}</span>${c.full?'<span class="ch-star">★ 精选</span>':""}${nM?`<span class="ch-must">🔥 必打卡×${nM}</span>`:""}<span class="ch-city-desc">${esc(c.desc||"")}</span><span class="ch-city-sights">🎟 ${nS} 个经典景点</span>`;
          el.addEventListener("click", ()=>openCity(c));
          cards.appendChild(el);
        });
        grid.appendChild(cards);
        box.appendChild(grid);
        wrap.appendChild(box);
        requestAnimationFrame(()=>cards.querySelectorAll("img[data-city]").forEach(im=>{
          const ct=allCities.find(x=>x.name===im.dataset.city);
          if(ct)observePhoto(im,ct);
        }));
      });

      sec.appendChild(wrap);
      frag.appendChild(sec);
    });

    body.innerHTML = "";
    if(!total){
      body.innerHTML = `<div class="ch-empty">没有匹配的城市<br/><small>换个关键词试试，或清除筛选条件</small></div>`;
      return;
    }
    body.appendChild(frag);
  }

  /* ---- 地图视图（Leaflet · 高德瓦片 · 90 城标记） ---- */
  const mapWrap=$("#chMapWrap");
  let chMap=null, chMarkers=[];
  function chIcon(c){
    const must=MV[c.name]&&MV[c.name].count;
    const col=c.full?"#0052FF":(must?"#EF4444":"#7C9CD9");
    const s=c.full?20:(must?18:13);
    return L.divIcon({className:"chmk",html:`<div style="width:${s}px;height:${s}px;border-radius:50%;background:${col};border:${c.full?3:2}px solid #fff;box-shadow:0 2px 7px rgba(0,0,0,.4)${must?",0 0 0 4px rgba(239,68,68,.18)":""}"></div>`,iconSize:[s,s],iconAnchor:[s/2,s/2]});
  }
  function chPopup(c){
    const nS=(c.sights||[]).length, nM=MV[c.name]?MV[c.name].count:0;
    return `<div style="min-width:190px">
      <img src="${cover(c.name,220,90,c.name)}" data-ph="${esc(c.name)}" style="width:100%;height:90px;object-fit:cover;border-radius:8px;margin-bottom:6px" alt="${esc(c.name)}"/>
      <b style="font-size:15px">${esc(c.name)}</b><br/><span style="color:#64748b;font-size:11.5px">${esc(c.region)} · ${esc(c.province)}</span><br/>
      <span style="font-size:12px;color:#374151">🎟 ${nS} 景点${nM?` · 🔥 必打卡×${nM}`:""}</span><br/>
      <button type="button" data-chm="${esc(c.name)}" style="margin-top:6px;padding:5px 12px;border-radius:8px;background:#0052FF;color:#fff;border:none;cursor:pointer;font-size:12px;font-weight:600">查看详情 →</button>
    </div>`;
  }
  function initChMap(){
    if(chMap||!window.L)return;
    chMap=L.map("chMap",{scrollWheelZoom:true}).setView([35.5,105],4);
    L.tileLayer("https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=7&x={x}&y={y}&z={z}",{subdomains:"1234",attribution:"© 高德地图",minZoom:3,maxZoom:18}).addTo(chMap);
    setTimeout(()=>{ if(chMap)chMap.invalidateSize(); },300);
  }
  let mapLayer=null;
  function setMapMode(mode){
    if(!chMap||!window.L)return;
    if(mapLayer){ chMap.removeLayer(mapLayer); }
    mapLayer=L.layerGroup().addTo(chMap);
    chMarkers=[];
    if(mode==="cities"){
      allCities.forEach(c=>{
        const m=L.marker([c.lat,c.lng],{icon:chIcon(c),title:c.name});
        m.bindPopup(chPopup(c),{maxWidth:230});
        m.on("popupopen",e=>{
          const el=e.popup.getElement(); if(!el)return;
          const im=el.querySelector("img[data-ph]"); if(im){ const ct=allCities.find(x=>x.name===im.dataset.ph); if(ct)loadPhoto2(im,ct); }
          const btn=el.querySelector("[data-chm]"); if(btn)btn.addEventListener("click",()=>{ chMap.closePopup(); openCity(allCities.find(x=>x.name===btn.dataset.chm)); });
        });
        mapLayer.addLayer(m);
      });
    }else if(mode==="5a"){
      const PC=window.PROV_CITY||{};
      Object.entries(S5).forEach(([prov,v])=>{
        if(!v.count)return;
        const cities=(PC[prov]||[]).map(n=>allCities.find(x=>x.name===n)).filter(Boolean);
        cities.forEach(c=>{
          const m=L.marker([c.lat,c.lng],{title:prov+" 5A"});
          m.setIcon(L.divIcon({className:"chmk",html:`<div class="mk-5a">🏅</div>`,iconSize:[26,26],iconAnchor:[13,13]}));
          m.bindPopup(`<div style="min-width:200px">
            <b style="font-size:15px">🏅 ${esc(prov)}</b><br/>
            <span style="color:#B45309;font-weight:700;font-size:12.5px">${v.count} 家国家级 5A</span><br/>
            <span style="font-size:12px;color:#374151;line-height:1.8">${v.list.slice(0,6).map(esc).join("<br/>")}${v.list.length>6?"<br/>…":""}</span><br/>
            <button type="button" data-m5a="${esc(c.name)}" style="margin-top:6px;padding:5px 12px;border-radius:8px;background:#F59E0B;color:#fff;border:none;cursor:pointer;font-size:12px;font-weight:600">查看${esc(c.name)} →</button>
          </div>`,{maxWidth:230});
          m.on("popupopen",e=>{
            const btn=e.popup.getElement().querySelector("[data-m5a]");
            if(btn&&!btn._b){btn._b=1;btn.addEventListener("click",()=>{chMap.closePopup();openCity(allCities.find(x=>x.name===btn.dataset.m5a));});}
          });
          mapLayer.addLayer(m);
        });
      });
    }else if(mode==="must"){
      Object.entries(MV).forEach(([city,v])=>{
        const c=allCities.find(x=>x.name===city); if(!c)return;
        const m=L.marker([c.lat,c.lng],{title:city+" 必打卡"});
        m.setIcon(L.divIcon({className:"chmk",html:`<div class="mk-must">🔥</div>`,iconSize:[24,24],iconAnchor:[12,12]}));
        m.bindPopup(`<div style="min-width:200px">
          <b style="font-size:15px">🔥 ${esc(city)}</b><br/>
          <span style="color:#DC2626;font-weight:700;font-size:12.5px">必打卡榜上榜 ${v.count} 处</span><br/>
          <span style="font-size:12px;color:#374151;line-height:1.8">${v.list.slice(0,6).map(esc).join("<br/>")}${v.list.length>6?"<br/>…":""}</span><br/>
          <button type="button" data-mu="${esc(city)}" style="margin-top:6px;padding:5px 12px;border-radius:8px;background:#EF4444;color:#fff;border:none;cursor:pointer;font-size:12px;font-weight:600">查看${esc(city)} →</button>
        </div>`,{maxWidth:230});
        m.on("popupopen",e=>{
          const btn=e.popup.getElement().querySelector("[data-mu]");
          if(btn&&!btn._b){btn._b=1;btn.addEventListener("click",()=>{chMap.closePopup();openCity(allCities.find(x=>x.name===btn.dataset.mu));});}
        });
        mapLayer.addLayer(m);
      });
    }
  }
  function showMapView(on,mode){
    mapWrap.hidden=!on;
    const lg=mapWrap.querySelector(".ch-map-legend");
    if(lg){
      if(mode==="5a") lg.innerHTML=`<span><i class="lg" style="background:#F59E0B"></i>5A 省份代表城市</span><small>点击标记查看该省 5A 名录 · 滚轮缩放 · 拖动平移</small>`;
      else if(mode==="must") lg.innerHTML=`<span><i class="lg" style="background:#EF4444"></i>必打卡榜上榜城市（${Object.keys(MV).length} 城）</span><small>点击标记查看该城打卡点 · 滚轮缩放 · 拖动平移</small>`;
      else lg.innerHTML=`<span><i class="lg lg-full"></i>精选城市</span><span><i class="lg lg-must"></i>必打卡榜</span><span><i class="lg lg-normal"></i>其他城市</span><small>点击标记查看城市详情 · 滚轮缩放 · 拖动平移</small>`;
    }
    if(on){ initChMap(); if(mode)setMapMode(mode); setTimeout(()=>{ if(chMap)chMap.invalidateSize(); },80); }
  }
  const chModal = $("#chModal"), chModalBody = $("#chModalBody");
  let lastFocused = null;
  function openCity(c){
    lastFocused = document.activeElement;
    chModal.setAttribute("aria-label", `${c.name}城市详情`);
    const sights = c.sights||[];
    chModalBody.innerHTML = `
      <div class="ch-m-photo"><img src="${cover(c.name,560,240,c.province+" · "+c.name)}" alt="${esc(c.name)}实况照片"/></div>
      <span class="ch-m-eyebrow">${esc(c.region)} · ${esc(c.province)}</span>
      <h3 class="ch-m-name">${esc(c.name)}</h3>
      <p class="ch-m-desc">${esc(c.desc||"这座城市的故事等待你来书写。")}</p>
      ${sights.length?`<div class="ch-m-sights">
        <div class="ch-m-st">🎟 经典景点 · 门票参考 <small>共 ${sights.length} 处</small></div>
        ${sights.map((s,i)=>`<button type="button" class="ch-m-sight" data-scenic-name="${esc(s[0])}" data-scenic-city="${esc(c.name)}" data-scenic-type="${esc(s[2])}" data-scenic-price="${esc(s[1])}"><span class="ch-m-sn">${i+1}</span><div class="ch-m-sbody"><b>${esc(s[0])}</b><div class="ch-m-smeta"><span class="ch-m-type">${te(s[2])} ${esc(s[2])}</span></div></div><span class="ch-m-price">${esc(s[1])}</span><span class="ch-m-sarrow">›</span></button>`).join("")}
      </div>`:`<div class="ch-m-meta">✨ 景点数据整理中</div>`}
      ${MV[c.name]&&MV[c.name].list.length?`<div class="ch-m-sights">
        <div class="ch-m-st ch-m-st-must">🔥 必打卡榜 <small>该城上榜 ${MV[c.name].list.length} 处</small></div>
        <div class="ch-m-musts">${MV[c.name].list.map(m=>`<button type="button" class="ch-m-must" data-scenic-name="${esc(m)}" data-scenic-city="${esc(c.name)}" data-scenic-type="景点" data-scenic-price="">${esc(m)}</button>`).join("")}</div>
      </div>`:""}
      ${(S5[c.province]&&S5[c.province].list.length&&sights.some(s=>S5[c.province].list.some(a=>a.includes(s[0])||s[0].includes(a.slice(0,4)))))?`<div class="ch-m-5a">🏅 本城含国家级 5A 景区</div>`:""}
      <div class="ch-m-meta"><span>📍 ${c.lat.toFixed(2)}°, ${c.lng.toFixed(2)}°</span></div>
      <div class="ch-m-actions">
        ${c.full?`<a class="btn-accent" href="index.html?city=${encodeURIComponent(c.name)}">精选详情 →</a>`:""}
        <a class="btn-ghost" href="hotel.html?city=${encodeURIComponent(c.name)}">🏨 酒店与住宿</a>
        <a class="btn-ghost" href="route.html?to=${encodeURIComponent(c.name)}">🗺 出行路线</a>
      </div>`;
    chModal.hidden = false;
    document.body.style.overflow = "hidden";
    const ph=chModalBody.querySelector(".ch-m-photo img");
    if(ph) loadPhoto2(ph,c);
    chModalBody.querySelectorAll("[data-scenic-name]").forEach(item=>item.addEventListener("click",()=>{
      if(typeof window.openScenicDetail==="function")window.openScenicDetail({
        name:item.dataset.scenicName,
        city:item.dataset.scenicCity,
        type:item.dataset.scenicType,
        price:item.dataset.scenicPrice
      });
    }));
    requestAnimationFrame(()=>chModal.querySelector(".modal-close")?.focus());
  }
  function loadPhoto2(el,c){
    el.dataset.q=(PHOTO_QUERY[c.name]||c.name+" "+(c.sights&&c.sights[0]?c.sights[0][0]:"China"))+" China";
    loadPhoto(el);
  }
  function closeCity(){
    chModal.hidden = true;
    document.body.style.overflow = "";
    if(lastFocused && lastFocused.isConnected) lastFocused.focus();
  }
  chModal.addEventListener("click", e=>{ if(e.target.hasAttribute("data-ch-close")) closeCity(); });
  document.addEventListener("keydown", e=>{ if(e.key==="Escape") closeCity(); });

  /* ---- 工具栏事件 ---- */
  let deb;
  const si = $("#chSearch"), sc = $("#chClear");
  function dispatchView(){
    if(state.view==="map"&&state.q){
      showMapView(false);
      document.querySelector('.ch-tab[data-c="全部"]').click();
      return;
    }
    if(state.view==="5a") render5A(); else if(state.view==="must") renderMust(); else render();
  }
  si.addEventListener("input", e=>{
    state.q = e.target.value.trim();
    sc.hidden = !state.q;
    clearTimeout(deb); deb = setTimeout(dispatchView, 120);
  });
  sc.addEventListener("click", ()=>{ si.value=""; state.q=""; sc.hidden=true; dispatchView(); });
  document.querySelectorAll(".ch-tab[data-c]").forEach(t=>t.addEventListener("click", ()=>{
    document.querySelectorAll(".ch-tab[data-c]").forEach(x=>{x.classList.remove("active");x.setAttribute("aria-selected","false");});
    document.querySelectorAll(".ch-tab[data-view]").forEach(x=>{x.classList.remove("active");x.setAttribute("aria-pressed","false");});
    t.classList.add("active"); t.setAttribute("aria-selected","true");
    state.view = "cities"; state.region = t.dataset.c;
    showMapView(false);
    body.style.display="";
    render();
  }));
  document.querySelectorAll(".ch-tab[data-view]").forEach(t=>t.addEventListener("click", ()=>{
    document.querySelectorAll(".ch-tab[data-c]").forEach(x=>{x.classList.remove("active");x.setAttribute("aria-selected","false");});
    document.querySelectorAll(".ch-tab[data-view]").forEach(x=>{x.classList.remove("active");x.setAttribute("aria-pressed","false");});
    t.classList.add("active"); t.setAttribute("aria-pressed","true");
    state.view = t.dataset.view;
    if(t.dataset.view==="map"){ showMapView(true,"cities"); body.style.display="none"; return; }
    body.style.display="";
    if(t.dataset.view==="5a") render5A(); else renderMust();
  }));
  $("#chOnly").addEventListener("click", e=>{
    state.onlyFull = !state.onlyFull;
    e.currentTarget.classList.toggle("active", state.onlyFull);
    e.currentTarget.setAttribute("aria-pressed", state.onlyFull?"true":"false");
    render();
  });

  render();
  const cityParam=new URLSearchParams(location.search).get("city");
  if(cityParam){
    const target=allCities.find(c=>c.name===cityParam);
    if(target)setTimeout(()=>openCity(target),120);
  }
})();
