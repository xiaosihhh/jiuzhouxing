/* 九州行 · 路线导航页（高德式：城市选择 + 途经点 + 交通方式 + 路线图 + 导航外链） */
(function(){
  "use strict";
  const $ = s => document.querySelector(s);
  const esc = s => String(s).replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

  /* ---- 主题 ---- */
  const html = document.documentElement;
  let theme = localStorage.getItem("theme") || (matchMedia("(prefers-color-scheme:dark)").matches?"dark":"light");
  html.dataset.theme = theme;
  $("#themeToggle").addEventListener("click", ()=>{
    theme = theme==="dark"?"light":"dark";
    html.dataset.theme = theme;
    localStorage.setItem("theme", theme);
  });

  /* ---- 城市数据 ---- */
  const CC = window.CHINA_CITIES || {};
  const REGIONS = ["华北","华东","华南","华中","西南","西北","东北","港澳台"];
  const allCities = [];
  REGIONS.forEach(r=>Object.entries(CC[r]||{}).forEach(([prov,list])=>list.forEach(c=>allCities.push({...c,region:r,province:prov}))));
  allCities.sort((a,b)=>a.province.localeCompare(b.province,"zh")||a.name.localeCompare(b.name,"zh"));

  /* ---- 交通模式（同主页行程单逻辑） ---- */
  const TRANS={
    plane:{label:"✈️ 飞机",speed:750,fixed:2.5,perKm:0.75,minCost:400,color:"#E11D48",note:"含机场往返约 2.5 小时",mode:"plane"},
    rail:{label:"🚄 高铁",speed:280,fixed:1.0,perKm:0.45,minCost:60,color:"#0052FF",note:"含进站候车约 1 小时",mode:"rail"},
    car:{label:"🚗 驾车",speed:95,fixed:0,perKm:0.85,minCost:0,color:"#F6A800",note:"油费+过路费约 0.85 元/km",mode:"car"},
    bus:{label:"🚌 大巴",speed:75,fixed:0.5,perKm:0.35,minCost:30,color:"#10B981",note:"适合 300km 内短途",mode:"bus"}
  };
  function hav(a,b){
    const R=6371,d=Math.PI/180;
    const dLat=(b.lat-a.lat)*d,dLng=(b.lng-a.lng)*d;
    const s=Math.sin(dLat/2)*Math.sin(dLat/2)+Math.cos(a.lat*d)*Math.cos(b.lat*d)*Math.sin(dLng/2)*Math.sin(dLng/2);
    return 2*R*Math.asin(Math.sqrt(s));
  }
  function defTrans(km){ return km>800?"plane":(km>300?"rail":"car"); }
  function fmtHrs(h){ if(h<1)return Math.round(h*60)+" 分钟"; const hh=Math.floor(h),mm=Math.round((h-hh)*60); return hh+" 小时"+(mm?" "+mm+" 分":""); }

  /* ---- 状态 ---- */
  const routeParams=new URLSearchParams(location.search);
  let state={ from:routeParams.get("from")||"北京", to:routeParams.get("to")||"三亚", via:[], mode:"auto" };
  try{ const s=JSON.parse(localStorage.getItem("hy_route_page")||"null"); if(s&&s.from&&s.to){ state={...state,...s}; state.via=(s.via||[]).filter(v=>typeof v==="string"); } }catch(e){}
  if(routeParams.has("from"))state.from=routeParams.get("from");
  if(routeParams.has("to"))state.to=routeParams.get("to");
  if(routeParams.has("via"))state.via=String(routeParams.get("via")||"").split(/[|,]/).filter(Boolean).slice(0,6);
  if(routeParams.has("custom"))state.via=[];
  state.via=state.via.filter(v=>v!==state.from&&v!==state.to&&allCities.some(c=>c.name===v));
  function save(){ try{ localStorage.setItem("hy_route_page",JSON.stringify(state)); }catch(e){} }
  save();

  /* ---- 下拉选项 ---- */
  function fillSelect(sel,val){
    const groups={};
    allCities.forEach(c=>{ (groups[c.region]=groups[c.region]||[]).push(c); });
    sel.innerHTML = REGIONS.filter(r=>groups[r]).map(r=>
      `<optgroup label="${esc(r)}">${groups[r].map(c=>`<option value="${esc(c.name)}">${esc(c.name)} · ${esc(c.province)}</option>`).join("")}</optgroup>`
    ).join("");
    if(allCities.some(c=>c.name===val)) sel.value=val;
  }
  const fromSel=$("#rtFrom"), toSel=$("#rtTo");
  fillSelect(fromSel,state.from);
  fillSelect(toSel,state.to);
  fromSel.addEventListener("change",()=>{state.from=fromSel.value;save();});
  toSel.addEventListener("change",()=>{state.to=toSel.value;save();});
  $("#rtSwap").addEventListener("click",()=>{
    const t=fromSel.value; fromSel.value=toSel.value; toSel.value=t;
    state.from=fromSel.value; state.to=toSel.value;
    state.via.reverse(); save(); renderVia();
    if(!$("#rtResult").hidden) buildRoute();
  });

  /* ---- 途经点 ---- */
  const viaList=$("#rtViaList");
  function renderVia(){
    viaList.innerHTML = state.via.length ? state.via.map((v,i)=>`
      <div class="rt-via-item">
        <span class="rt-dot rt-via"></span>
        <select class="rt-select rt-via-sel" data-i="${i}">${allCities.map(c=>`<option value="${esc(c.name)}" ${c.name===v?"selected":""}>${esc(c.name)} · ${esc(c.province)}</option>`).join("")}</select>
        <button class="rt-via-del" type="button" data-del="${i}" aria-label="删除途经点">✕</button>
      </div>`).join("") : '<div class="rt-via-empty">还没有途经城市。点击右上角“添加途经点”，可连续添加多个城市。</div>';
    viaList.querySelectorAll(".rt-via-sel").forEach(s=>s.addEventListener("change",()=>{ state.via[+s.dataset.i]=s.value; save(); if(!$("#rtResult").hidden)buildRoute(); }));
    viaList.querySelectorAll("[data-del]").forEach(b=>b.addEventListener("click",()=>{ state.via.splice(+b.dataset.del,1); save(); renderVia(); if(!$("#rtResult").hidden)buildRoute(); }));
  }
  renderVia();
  $("#rtViaAdd").addEventListener("click",()=>{
    if(state.via.length>=6){ toast("最多添加 6 个途经点"); return; }
    const from=cityByName(state.from),to=cityByName(state.to);
    const cand=allCities
      .filter(c=>c.name!==state.from&&c.name!==state.to&&!state.via.includes(c.name))
      .sort((a,b)=>{
        const da=from&&to?(hav(from,a)+hav(a,to)):0;
        const db=from&&to?(hav(from,b)+hav(b,to)):0;
        return da-db;
      })[0];
    if(cand){ state.via.push(cand.name); save(); renderVia(); toast(`已添加途经城市：${cand.name}`); }
  });

  /* ---- 交通方式 ---- */
  document.querySelectorAll(".rt-mode").forEach(b=>b.addEventListener("click",()=>{
    document.querySelectorAll(".rt-mode").forEach(x=>x.classList.remove("active"));
    b.classList.add("active");
    state.mode=b.dataset.mode; save();
    if(!$("#rtResult").hidden) buildRoute();
  }));
  document.querySelector(`.rt-mode[data-mode="${state.mode}"]`)?.classList.add("active");
  document.querySelectorAll(".rt-mode").forEach(x=>{ if(x.dataset.mode===state.mode){document.querySelectorAll(".rt-mode").forEach(y=>y.classList.remove("active"));x.classList.add("active");} });

  /* ---- Toast ---- */
  let toastT;
  function toast(msg){ const t=$("#toast"); t.textContent=msg; t.hidden=false; clearTimeout(toastT); toastT=setTimeout(()=>t.hidden=true,2200); }

  /* ---- 路线生成 ---- */
  let map=null, routeLayer=null;
  function arcPts(a,b,bend){
    const mx=(a.lat+b.lat)/2+(b.lng-a.lng)*bend, my=(a.lng+b.lng)/2-(b.lat-a.lat)*bend;
    const pts=[];
    for(let t=0;t<=1.0001;t+=1/32){
      const u=1-t;
      pts.push([u*u*a.lat+2*u*t*mx+t*t*b.lat, u*u*a.lng+2*u*t*my+t*t*b.lng]);
    }
    return pts;
  }
  function cityByName(n){ return allCities.find(c=>c.name===n); }
  function routeStops(){
    return [state.from,...state.via,state.to].map(cityByName).filter(Boolean);
  }
  function segMode(km){
    if(state.mode!=="auto") return state.mode;
    return defTrans(km);
  }
  function gaoDeURL(a,b){
    const f=encodeURIComponent(a.name+","+a.lat+","+a.lng), t=encodeURIComponent(b.name+","+b.lat+","+b.lng);
    return "https://uri.amap.com/navigation?from="+f+"&to="+t+"&mode=car&policy=0&src=hy&coordinate=gaode&callnative=0";
  }
  function gaoDeAllURL(stops){
    if(stops.length<2)return null;
    const enc=p=>encodeURIComponent(p.name+","+p.lat+","+p.lng);
    const via=stops.slice(1,-1).map(enc).join("|");
    return "https://uri.amap.com/navigation?from="+enc(stops[0])+(via?"&via="+via:"")+"&to="+enc(stops[stops.length-1])+"&mode=car&policy=0&src=hy&coordinate=gaode&callnative=0";
  }
  const TRAIN_BOOK_URL="https://www.12306.cn/index/";
  const FLIGHT_BOOK_URL="https://www.ctrip.com/flight/";
  function bookingLink(mode){
    if(mode==="rail")return {url:TRAIN_BOOK_URL,label:"12306 高铁购票",icon:"🚄"};
    if(mode==="plane")return {url:FLIGHT_BOOK_URL,label:"携程机票查询",icon:"✈️"};
    return null;
  }
  function buildRoute(){
    const stops=routeStops();
    if(stops.length<2){ toast("请选择有效的起点与终点"); return; }
    const segs=[];
    for(let i=0;i<stops.length-1;i++){
      const a=stops[i],b=stops[i+1];
      const km=hav(a,b);
      const mode=segMode(km), t=TRANS[mode];
      segs.push({a,b,km,mode,t,hrs:km/t.speed+t.fixed,cost:Math.max(t.minCost,km*t.perKm)});
    }
    const totKm=segs.reduce((n,s)=>n+s.km,0), totHrs=segs.reduce((n,s)=>n+s.hrs,0), totCost=segs.reduce((n,s)=>n+s.cost,0);

    const result=$("#rtResult"); result.hidden=false;
    $("#rtSummary").innerHTML=`
      <div class="rt-sum-card">
        <div class="rt-sum-line">🧭 全程 <b>${Math.round(totKm).toLocaleString()}</b> km · ${stops.length} 城 ${segs.length} 段</div>
        <div class="rt-sum-line">⏱ 交通约 <b>${fmtHrs(totHrs)}</b></div>
        <div class="rt-sum-line">💰 交通费约 <b>¥${Math.round(totCost).toLocaleString()}</b>/人</div>
      </div>`;
    $("#rtSegs").innerHTML = segs.map((s,i)=>{
      const booking=bookingLink(s.mode);
      return `
      <div class="rp-seg">
        <div class="rp-seg-head">
          <span class="rp-num" style="background:${s.t.color}">${i+1}</span>
          <div class="rp-cities"><b>${esc(s.a.name)}</b><span class="rp-arrow">➜</span><b>${esc(s.b.name)}</b></div>
          <span class="rp-km">${Math.round(s.km)} km</span>
        </div>
        <div class="rt-seg-info">
          <span class="rt-seg-mode" style="background:${s.t.color}">${s.t.label}</span>
          <span>⏱ ${fmtHrs(s.hrs)}</span>
          <span>💰 ¥${Math.round(s.cost).toLocaleString()}</span>
          ${booking?`<a class="rp-book ${esc(s.mode)}" href="${booking.url}" target="_blank" rel="noopener noreferrer">${booking.icon} ${booking.label} ↗</a>`:""}
          <a class="rp-gd" href="${gaoDeURL(s.a,s.b)}" target="_blank" rel="noopener">高德导航 ↗</a>
        </div>
      </div>`;}).join("");
    const allURL=gaoDeAllURL(stops);
    const destination=stops[stops.length-1];
    const hasRail=segs.some(s=>s.mode==="rail");
    const hasPlane=segs.some(s=>s.mode==="plane");
    $("#rtActions").innerHTML = `
      ${allURL?`<a class="rp-gdall" href="${allURL}" target="_blank" rel="noopener">🧭 在高德地图打开全程路线（含 ${stops.length} 城）</a>`:""}
      ${hasPlane?`<a class="rt-book" href="${FLIGHT_BOOK_URL}" target="_blank" rel="noopener noreferrer">✈️ 携程机票查询 ↗</a>`:""}
      ${hasRail?`<a class="rt-book rail" href="${TRAIN_BOOK_URL}" target="_blank" rel="noopener noreferrer">🚄 12306 高铁购票 ↗</a>`:""}
      <a class="rt-share" href="hotel.html?city=${encodeURIComponent(destination.name)}">💤 查看 ${esc(destination.name)} 住宿 →</a>`;

    drawRoute(stops,segs);
    result.scrollIntoView({behavior:"smooth",block:"start"});
  }
  function drawRoute(stops,segs){
    if(!map){
      map=L.map("rtMap",{scrollWheelZoom:true}).setView([35.5,105],4);
      L.tileLayer("https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=7&x={x}&y={y}&z={z}",{subdomains:"1234",attribution:"© 高德地图",minZoom:3,maxZoom:18}).addTo(map);
    }
    if(routeLayer){ routeLayer.forEach(l=>{try{map.removeLayer(l);}catch(e){}}); }
    routeLayer=[];
    stops.forEach((c,i)=>{
      const isFirst=i===0, isLast=i===stops.length-1;
      const col=isFirst?"#10B981":(isLast?"#EF4444":"#0052FF");
      const mk=L.marker([c.lat,c.lng],{icon:L.divIcon({className:"rtmk",html:`<div class="rt-stop" style="border-color:${col};background:${col}">${esc(i+1)}</div>`,iconSize:[26,26],iconAnchor:[13,13]})}).addTo(map);
      mk.bindPopup(`<b style="font-size:14px">${esc(c.name)}</b><br/><span style="color:#64748b;font-size:11.5px">${esc(c.province)} · ${isFirst?"起点":(isLast?"终点":"途经点")}</span><br/><span style="font-size:12px">${(c.sights||[]).length} 个经典景点</span>`);
      routeLayer.push(mk);
    });
    segs.forEach(s=>{
      const line=L.polyline(arcPts(s.a,s.b,0.12),{color:s.t.color,weight:4,opacity:.85,dashArray:s.mode==="plane"?"2 9":(s.mode==="rail"?"10 6":null)}).addTo(map);
      routeLayer.push(line);
      const mid=arcPts(s.a,s.b,0.12)[16];
      const mk=L.marker(mid,{icon:L.divIcon({className:"rt",html:`<div class="rt-tip" style="background:${s.t.color}">${s.t.label.split(" ")[0]}·${Math.round(s.km)}km</div>`,iconSize:[74,20],iconAnchor:[37,10]}),interactive:false}).addTo(map);
      routeLayer.push(mk);
    });
    map.flyToBounds(L.latLngBounds(stops.map(p=>[p.lat,p.lng])).pad(0.25),{duration:1.2});
  }
  $("#rtGo").addEventListener("click",buildRoute);
})();
