/* ===== AI 旅行助手 · 本地智能引擎 ===== */
const AI = (function(){
  const data = () => window.ALL_CITY_DESTINATIONS || window.TRAVEL_DATA || [];
  const planner = () => window.JZTravelPlanner;
  const fmt = n => "¥" + n.toLocaleString();

  function pick(q){
    const d = data();
    const s = q.toLowerCase();
    const has = (...k)=>k.some(t=>s.includes(t));
    const filters = [];
    const direct = d.find(x=>s.includes(x.name.toLowerCase())||s.includes(x.city.toLowerCase()));
    if(direct) filters.push(x=>x.id===direct.id);

    if(has("亲子","小孩","孩子","家庭","带娃"))
      filters.push(x=>x.tags.some(t=>["休闲","自然","海岛","度假"].includes(t))||x.id==="chengdu"||x.id==="sanya");
    if(has("海边","沙滩","海岛","看海","海滨","大海","想去海"))
      filters.push(x=>x.tags.includes("海岛")||x.id==="dalian");
    if(has("浪漫","情侣","蜜月","约会"))
      filters.push(x=>x.tags.includes("浪漫")||/浪漫|铁塔|海角|夕阳|夜/.test(x.description));
    if(has("美食","吃","好吃","吃货"))
      filters.push(x=>x.tags.includes("美食"));
    if(has("古迹","历史","文化","古城","遗产"))
      filters.push(x=>x.tags.includes("人文古迹")||x.tags.includes("世界遗产"));
    if(has("国内","国内游","境内"))
      filters.push(x=>x.country==="中国");
    if(has("都市","城市","购物","逛街"))
      filters.push(x=>x.tags.includes("都市")||x.tags.includes("购物"));
    if(has("自然","山水","风景","大自然"))
      filters.push(x=>x.tags.includes("自然")||x.tags.includes("山水"));
    ["华北","华东","华南","西南","西北"].forEach(region=>{
      if(has(region)) filters.push(x=>x.region===region);
    });

    let pool = filters.length ? d.filter(x=>filters.every(f=>f(x))) : d.slice();
    if(!pool.length&&direct) pool=[direct];
    const parsedDays=planner()?.parseDays(q);
    const parsedBudget=planner()?.parseBudget(q);
    if(parsedDays){ pool=pool.filter(x=>x.duration<=parsedDays+1); }
    if(parsedBudget){ pool=pool.filter(x=>x.price<=parsedBudget); }
    if(!pool.length&&direct) pool=[direct];
    const genericIntent=has("推荐","去哪","好玩","周末","放松","选择","便宜","省钱","性价比","低价","评分","好评","最好","最佳");
    if(!filters.length&&!parsedDays&&!parsedBudget&&!genericIntent) return [];

    if(has("便宜","省钱","性价比","低价"))
      pool = pool.slice().sort((a,b)=>a.price-b.price);
    else if(has("评分","好评","最好","最佳","推荐"))
      pool = pool.slice().sort((a,b)=>b.rating-a.rating||b.reviews-a.reviews);
    else
      pool = pool.slice().sort((a,b)=>(b.popular?1:0)-(a.popular?1:0)||b.rating-a.rating);

    return pool.slice(0,4);
  }

  function answer(q,history){
    const d = data();
    const s = q.toLowerCase();
    const has = (...k)=>k.some(t=>s.includes(t));
    const specific=planner()?.plan(q,d,history);
    if(specific) return specific;
    if(/^(你好|您好|嗨|哈喽|hello|hi)[！!。,.，\s]*$/i.test(s)){
      return {text:"你好！我是九州行旅行助手。你可以直接告诉我目的地、预算、天数或偏好，例如“成都3天2000内”“想看海去哪里”。",cards:d.filter(x=>x.popular).slice(0,3)};
    }
    if(has("你是谁","你叫什么","介绍一下你")){
      return {text:"我是九州行旅行助手，可以结合90座城市的目的地、景点和预算帮你做国内旅行规划，也能把结果衔接到酒店和交通预订。",cards:d.filter(x=>x.popular).slice(0,3)};
    }
    if(has("怎么用","能做什么","会什么","帮助")){
      return {text:"你可以这样问我：\n• “成都3天2000内”\n• “亲子旅行5天推荐去哪里”\n• “上海有什么好吃的”\n• “想看海，预算3000”",cards:d.filter(x=>x.popular).slice(0,3)};
    }
    if(has("国外","海外","出境","国际")){
      return {text:"当前版本专注中国旅行规划，不提供出境目的地。可以先从国内的古都、山水、海岛和雪域线路中选择。",cards:d.filter(x=>x.popular).slice(0,3)};
    }
    const results = pick(q);
    if(results.length===0)
      return {text:`我暂时没有找到与“${q}”完全匹配的旅行目的地。你可以补充预算、天数、同行人或兴趣，我再为你筛选。`, cards:d.filter(x=>x.popular).slice(0,3)};

    let intro = "根据你的需求，为你精选以下目的地：";
    if(has("亲子","孩子","家庭")) intro="适合亲子同游的好去处，轻松又有趣：";
    else if(has("海边","沙滩","海岛","看海","海滨","大海","想去海")) intro="想看海？这些地方碧波万顷：";
    else if(has("浪漫","情侣","蜜月")) intro="浪漫满溢，适合两个人去的地方：";
    else if(has("美食","好吃","吃")) intro="吃货天堂，这些地方鲜香麻辣：";
    else if(has("古迹","历史","文化")) intro="穿越时光，触摸历史的好去处：";
    else if(has("国内")) intro="中国好风光，说走就走：";
    else if(has("便宜","省钱","性价比")) intro="高性价比之选，花得少玩得好：";
    else if(has("推荐","最好","最佳")) intro="为你推荐口碑最佳的目的地：";

    const parsedBudget=planner()?.parseBudget(q);
    const parsedDays=planner()?.parseDays(q);
    let tip = "";
    if(parsedBudget) tip += ` 预算约 ${fmt(parsedBudget)} 以内`;
    if(parsedDays) tip += ` 行程 ${parsedDays} 天左右`;
    const avg = (results.reduce((a,x)=>a+x.price,0)/results.length).toFixed(0);
    const direct = s.includes(results[0].name.toLowerCase())||s.includes(results[0].city.toLowerCase());
    const highlightText = direct&&Array.isArray(results[0].highlights)&&results[0].highlights.length
      ? ` ${results[0].name}值得重点体验：${results[0].highlights.slice(0,4).join("、")}。`
      : "";
    const text = `${intro}${tip}。${highlightText}共找到 ${results.length} 个推荐，平均花费约 ${fmt(+avg)}。点击卡片可查看详情 ✨`;
    return {text, cards:results};
  }

  function greet(){
    const d = data();
    const top = d.filter(x=>x.popular).slice(0,3);
    return {text:"你好！我是中国旅行助手 ✦\n告诉我你的偏好，我来帮你规划国内旅行。比如：\n• “预算5000去哪好”\n• “想看海”\n• “推荐历史文化名城”\n• “7天行程，亲子游”", cards:top};
  }

  return {
    answer,
    plan:(q,history)=>planner()?.plan(q,data(),history) || null,
    greet
  };
})();
window.AI = AI;
