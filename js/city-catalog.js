/* 将中国城市库转换为首页、AI、酒店和路线共用的目的地目录。 */
(function(){
  "use strict";
  const cities = window.CHINA_CITIES || {};
  const base = window.TRAVEL_DATA || [];
  const baseByName = new Map(base.map(item=>[item.name,item]));
  const featured = ["北京","上海","西安","成都","重庆","杭州","三亚","拉萨","乌鲁木齐"];
  const regionBase = {华北:2400,华东:2700,华南:2600,华中:2300,西南:2450,西北:2500,东北:2150,港澳台:3200};

  function hash32(text){
    let h=2166136261;
    for(let i=0;i<text.length;i++){
      h^=text.charCodeAt(i);
      h=Math.imul(h,16777619);
    }
    return h>>>0;
  }

  function tagsFor(city,item){
    if(item)return item.tags.slice();
    const set=new Set();
    const text=(city.desc||"")+" "+(city.sights||[]).map(s=>`${s[0]} ${s[2]}`).join(" ");
    if(/历史|古城|古镇|博物馆|石窟|寺庙|遗址|文化|街区/.test(text))set.add("人文古迹");
    if(/自然|山|湖|海|草原|森林|湿地|公园|风光|峡谷|瀑布/.test(text))set.add("自然");
    if(/主题乐园|海洋馆|亲子|滑雪|度假/.test(text)){set.add("亲子");set.add("休闲");}
    if(/海滩|海岛|海滨/.test(text)){set.add("海岛");set.add("度假");}
    if(/火锅|美食|小吃|茶|夜市|食品街|市集/.test(text))set.add("美食");
    if(/夜景|灯光|都市|购物/.test(text))set.add("都市");
    if(!set.size)set.add("城市探索");
    return [...set].slice(0,4);
  }

  function bestSeason(region){
    if(region==="东北"||region==="华北")return "秋季";
    if(region==="华南"||region==="港澳台")return "冬季";
    if(region==="西北")return "夏秋";
    if(region==="西南")return "春秋";
    return "春季";
  }

  const all=[];
  Object.entries(cities).forEach(([region,provinces])=>{
    Object.entries(provinces).forEach(([province,list])=>{
      list.forEach(city=>{
        const item=baseByName.get(city.name);
        const hash=hash32(city.name);
        const sights=(city.sights||[]).map(s=>s[0]);
        all.push(item?{
          ...item,
          region,
          province,
          city:city.name,
          lat:city.lat,
          lng:city.lng,
          description:city.desc||item.description,
          highlights:sights.length?sights.slice(0,8):item.highlights,
          popular:featured.includes(city.name)
        }:{
          id:"city-"+hash.toString(36),
          name:city.name,
          region,
          province,
          country:"中国",
          city:city.name,
          description:city.desc||`${province}${city.name}，发现城市里的经典景点与地方风味`,
          price:(regionBase[region]||2400)+(hash%10)*90,
          duration:Math.min(6,3+Math.ceil((sights.length||3)/3)),
          rating:Number((4.5+(hash%4)/10).toFixed(1)),
          reviews:800+hash%16000,
          tags:tagsFor(city,null),
          lat:city.lat,
          lng:city.lng,
          highlights:sights.slice(0,8),
          bestSeason:bestSeason(region),
          popular:featured.includes(city.name)
        });
      });
    });
  });

  const rank = name => {
    const index=featured.indexOf(name);
    return index<0?999:index;
  };
  all.sort((a,b)=>rank(a.name)-rank(b.name)||a.name.localeCompare(b.name,"zh"));
  window.FEATURED_CITY_NAMES=featured;
  window.ALL_CITY_DESTINATIONS=all;
})();
