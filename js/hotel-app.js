(function(){
  "use strict";
  const $ = s => document.querySelector(s);
  const esc = s => String(s??"").replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const namedHotels = window.HOTEL_DATA || [];
  const destinations = window.ALL_CITY_DESTINATIONS || window.TRAVEL_DATA || [];
  const html = document.documentElement;

  let theme = localStorage.getItem("theme") || (matchMedia("(prefers-color-scheme:dark)").matches?"dark":"light");
  html.dataset.theme = theme;
  $("#themeToggle").addEventListener("click", ()=>{
    theme = theme==="dark"?"light":"dark";
    html.dataset.theme = theme;
    localStorage.setItem("theme", theme);
  });

  function hash(s){let h=0;for(let i=0;i<s.length;i++){h=(h*31+s.charCodeAt(i))>>>0;}return h;}
  function generatedStays(city){
    const seed=hash(city.name);
    const sights=city.highlights||[];
    const areaNames=[sights[0]?`${sights[0]}周边`:"市中心商圈",sights[1]?`${sights[1]}周边`:"高铁/机场沿线","城市中心"];
    const types=[
      {name:"市中心品质住宿",tags:["交通便利","餐饮丰富"],summary:`适合首次到访${city.name}，方便串联主要景点和城市商圈。`},
      {name:"景区度假住宿",tags:["景观","安静"],summary:`靠近${city.name}热门景区，适合慢节奏游览和家庭度假。`},
      {name:"交通枢纽便捷住宿",tags:["高铁","机场","短住"],summary:`方便衔接到达与返程，适合多城串联行程或短暂停留。`}
    ];
    return types.map((type,i)=>({
      id:`stay-${seed.toString(36)}-${i}`,
      city:city.name,
      name:`${city.name} · ${type.name}`,
      area:areaNames[i],
      price:280+(seed%7)*55+i*80,
      rating:Number((4.4+((seed+i)%5)/10).toFixed(1)),
      tags:type.tags,
      distance:`${areaNames[i]} · 住宿区域参考`,
      summary:`${type.summary} 当前为区域与类型建议，具体酒店请通过地图或预订平台核对。`,
      amenities:["住宿区域","交通建议","行程衔接"],
      generated:true
    }));
  }
  const hotels=namedHotels.concat(destinations.flatMap(city=>{
    return namedHotels.some(h=>h.city===city.name)?[]:generatedStays(city);
  }));
  function cover(h,w,height){
    return "assets/cities/"+encodeURIComponent(h.city||"中国")+".webp";
  }
  function dateAfter(days){
    const date=new Date();
    date.setDate(date.getDate()+days);
    const year=date.getFullYear();
    const month=String(date.getMonth()+1).padStart(2,"0");
    const day=String(date.getDate()).padStart(2,"0");
    return `${year}-${month}-${day}`;
  }
  function ctripHotelURL(city,keyword){
    const params=new URLSearchParams({
      cityName:city||"",
      keyword:keyword||"",
      checkin:dateAfter(1),
      checkout:dateAfter(2),
      adult:"1",
      children:"0"
    });
    return "https://hotels.ctrip.com/hotels/list?"+params.toString();
  }

  const citySel=$("#hotelCity"), searchInput=$("#hotelSearch"), sortSel=$("#hotelSort");
  citySel.innerHTML='<option value="">全部目的地</option>'+destinations.map(d=>`<option value="${esc(d.name)}">${esc(d.name)}</option>`).join("");
  const requested=new URLSearchParams(location.search).get("city");
  if(requested && destinations.some(d=>d.name===requested)) citySel.value=requested;
  const hotelPageSize=()=>matchMedia("(max-width:760px)").matches?9:12;
  let hotelLimit=hotelPageSize();
  let toastTimer;
  function toast(message){
    const el=$("#toast");
    el.textContent=message;
    el.hidden=false;
    clearTimeout(toastTimer);
    toastTimer=setTimeout(()=>{el.hidden=true;},2200);
  }
  function openCtripSearch(){
    const city=citySel.value.trim();
    if(!city){
      toast("请先选择目的地城市");
      citySel.focus();
      return;
    }
    const keyword=searchInput.value.trim();
    window.open(ctripHotelURL(city,keyword),"_blank","noopener,noreferrer");
  }

  function filtered(){
    const q=searchInput.value.trim().toLowerCase();
    let list=hotels.filter(h=>{
      if(citySel.value && h.city!==citySel.value) return false;
      if(!q) return true;
      return [h.name,h.city,h.area,h.summary,...h.tags,...h.amenities].join(" ").toLowerCase().includes(q);
    });
    if(sortSel.value==="priceAsc") list=list.slice().sort((a,b)=>a.price-b.price);
    else if(sortSel.value==="ratingDesc") list=list.slice().sort((a,b)=>b.rating-a.rating||a.price-b.price);
    else list=list.slice().sort((a,b)=>(b.rating-a.rating)||(a.price-b.price));
    return list;
  }

  function render(){
    const list=filtered();
    const shown=list.slice(0,hotelLimit);
    $("#hotelCount").textContent=list.length>hotelLimit?`${shown.length} / ${list.length} 个住宿方案`:`${list.length} 个住宿方案`;
    $("#hotelGrid").innerHTML=shown.map(h=>`
      <article class="hotel-card" tabindex="0" role="button" data-id="${esc(h.id)}" aria-label="查看 ${esc(h.name)} 详情">
        <div class="hotel-card-img"><img src="${cover(h,640,360)}" alt="${esc(h.city)} ${esc(h.area)}" /><span class="hotel-rating">★ ${h.rating.toFixed(1)}</span></div>
        <div class="hotel-card-body">
          <div class="hotel-loc">${esc(h.city)} · ${esc(h.area)}${h.generated?" · 住宿建议":""}</div>
          <h3>${esc(h.name)}</h3>
          <p>${esc(h.summary)}</p>
          <div class="hotel-tags">${h.tags.map(t=>`<span>${esc(t)}</span>`).join("")}</div>
          <div class="hotel-foot"><small>${esc(h.distance)}</small><b>¥${h.price.toLocaleString()}<em>/晚起</em></b></div>
        </div>
      </article>`).join("");
    $("#hotelEmpty").hidden=list.length>0;
    $("#hotelMore").hidden=list.length<=hotelLimit;
    $("#hotelMore").innerHTML=list.length>hotelLimit?`<button class="btn-ghost" id="hotelMoreBtn" type="button">加载更多住宿方案</button>`:"";
    const moreBtn=$("#hotelMoreBtn");
    if(moreBtn)moreBtn.addEventListener("click",()=>{hotelLimit+=hotelPageSize();render();});
    document.querySelectorAll(".hotel-card").forEach(card=>{
      const open=()=>openHotel(card.dataset.id);
      card.addEventListener("click",open);
      card.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();open();}});
    });
  }

  const modal=$("#hotelModal"), modalBody=$("#hotelModalBody");
  function openHotel(id){
    const h=hotels.find(x=>x.id===id); if(!h) return;
    const mapUrl="https://uri.amap.com/search?keyword="+encodeURIComponent(h.name)+"&city="+encodeURIComponent(h.city)+"&src=jiuzhou&callnative=0";
    modalBody.innerHTML=`
      <div class="hotel-detail-hero"><img src="${cover(h,760,380)}" alt="${esc(h.name)}" /></div>
      <div class="hotel-detail">
        <span class="eyebrow">${esc(h.city)} · ${esc(h.area)}</span>
        <h2>${esc(h.name)}</h2>
        <div class="hotel-detail-stats"><span>★ ${h.rating.toFixed(1)}</span><span>${esc(h.distance)}</span><b>¥${h.price.toLocaleString()} / 晚起</b></div>
        <p>${esc(h.summary)}</p>
        <h4>设施与服务</h4>
        <div class="hotel-tags">${h.amenities.map(t=>`<span>${esc(t)}</span>`).join("")}</div>
        <div class="hotel-book-actions">
          <a class="btn-accent" href="${ctripHotelURL(h.city,h.generated?h.area:h.name)}" target="_blank" rel="noopener noreferrer">在携程查询酒店 ↗</a>
          <a class="btn-ghost" href="${mapUrl}" target="_blank" rel="noopener noreferrer">高德地图查看周边 →</a>
        </div>
        <p class="hotel-disclaimer">${h.generated?"这是基于城市景点与交通生成的住宿区域建议，不代表具体酒店或实时房态。":"示范房源，价格与房态仅供作品演示。"} 预订前请核对酒店官方信息。</p>
      </div>`;
    modal.hidden=false;
    document.body.style.overflow="hidden";
    modal.querySelector(".modal-close").focus();
  }
  function closeHotel(){modal.hidden=true;document.body.style.overflow="";}
  modal.querySelectorAll("[data-hotel-close]").forEach(x=>x.addEventListener("click",closeHotel));
  document.addEventListener("keydown",e=>{if(e.key==="Escape")closeHotel();});

  $("#hotelReset").addEventListener("click",()=>{citySel.value="";searchInput.value="";sortSel.value="recommended";hotelLimit=hotelPageSize();render();});
  $("#hotelCtrip").addEventListener("click",openCtripSearch);
  searchInput.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();openCtripSearch();}});
  [citySel,sortSel].forEach(el=>el.addEventListener("change",()=>{hotelLimit=hotelPageSize();render();}));
  searchInput.addEventListener("input",()=>{hotelLimit=hotelPageSize();render();});
  render();
})();
