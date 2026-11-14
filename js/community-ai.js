(function(){
  "use strict";
  const $=s=>document.querySelector(s);
  const panel=$("#aiPanel"),fab=$("#aiFab"),messages=$("#aiMessages"),form=$("#aiForm"),input=$("#aiText");
  const apiBase=(window.APP_CONFIG&&window.APP_CONFIG.apiBase?String(window.APP_CONFIG.apiBase):"").replace(/\/$/,"");
  const threadKey="hy_community_ai_thread";
  let threadId=localStorage.getItem(threadKey);
  const history=[];
  if(!threadId){
    threadId=(crypto.randomUUID&&crypto.randomUUID())||("community-"+Date.now().toString(36)+"-"+Math.random().toString(36).slice(2,10));
    localStorage.setItem(threadKey,threadId);
  }

  function status(text,online){
    const el=$("#aiStatus");
    if(!el)return;
    el.textContent=text;
    el.classList.toggle("online",!!online);
  }
  function source(text){
    const el=document.createElement("div");
    el.className="msg-source";
    el.textContent=text;
    return el;
  }
  function appendSkills(wrap,skills){
    if(!Array.isArray(skills)||!skills.length)return;
    const box=document.createElement("div");
    box.className="msg-skills";
    const title=document.createElement("div");
    title.className="msg-skills-title";
    title.textContent=`Skills 编排 · ${skills.length} 项`;
    const list=document.createElement("div");
    list.className="msg-skill-list";
    skills.forEach(skill=>{
      const chip=document.createElement("span");
      chip.className="msg-skill";
      chip.textContent=skill.name||skill.id;
      if(skill.summary)chip.title=skill.summary;
      list.appendChild(chip);
    });
    box.append(title,list);
    wrap.appendChild(box);
  }
  function addMessage(content,who,cards,sourceText,skills){
    const wrap=document.createElement("div");
    wrap.className="msg "+who;
    const text=document.createElement("div");
    text.className="msg-text";
    text.textContent=typeof content==="string"?content:content.text||"";
    wrap.appendChild(text);
    const allCities=window.ALL_CITY_DESTINATIONS||window.TRAVEL_DATA||[];
    (cards||[]).forEach(card=>{
      const city=allCities.find(item=>item.id===(card.id||card));
      if(!city)return;
      const button=document.createElement("button");
      button.type="button";
      button.className="msg-card";
      button.innerHTML=`<img src="assets/cities/${encodeURIComponent(city.city||city.name)}.webp" alt=""/><div><b>${city.name}</b><br/><span>¥${(card.price||city.price).toLocaleString()} · ${card.days||city.duration}天 · ★${city.rating}</span>${card.reason?`<small>${city.description} ${card.reason}</small>`:""}</div>`;
      button.addEventListener("click",()=>{location.href="index.html?city="+encodeURIComponent(city.name);});
      wrap.appendChild(button);
    });
    appendSkills(wrap,skills);
    if(sourceText)wrap.appendChild(source(sourceText));
    messages.appendChild(wrap);
    messages.scrollTop=messages.scrollHeight;
    return wrap;
  }
  function itineraryText(items){
    if(!Array.isArray(items)||!items.length)return "";
    return items.map(day=>`第 ${day.day} 天 · ${day.city}\n${(day.items||[]).map(item=>"· "+item).join("\n")}`).join("\n\n");
  }
  function addLocalAnswer(question){
    const answer=window.AI&&window.AI.answer?window.AI.answer(question,history.slice(-8,-1)):{text:"当前为本地旅行助手，可以告诉我目的地、天数或预算。",cards:[]};
    addMessage(answer.text,"bot",answer.cards,"本地推荐引擎");
    history.push({role:"assistant",content:answer.text});
    if(history.length>16)history.splice(0,history.length-16);
  }
  async function ask(question){
    addMessage(question,"user");
    history.push({role:"user",content:question});
    const loading=addMessage("正在结合城市与人气分享整理建议","bot");
    loading.classList.add("loading");
    try{
      const response=await fetch(apiBase+"/api/ai/plan",{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({message:question,history:history.slice(-8,-1),thread_id:threadId,trip_ids:[]})
      });
      if(!response.ok)throw new Error("AI unavailable");
      const data=await response.json();
      loading.remove();
      const itinerary=itineraryText(data.itinerary);
      const reply=(data.reply||"已为你整理旅行建议。")+(itinerary?"\n\n"+itinerary:"");
      const skillCount=Array.isArray(data.skills)?data.skills.length:0;
      const sourceLabel=data.provider==="agentarts-managed"
        ?`AgentArts Managed Agent${skillCount?` · ${skillCount} Skills`:" · 官方智能体"}`
        :data.provider==="cloud-agent"
          ?`华为云智能体${skillCount?` · ${skillCount} Skills 编排`:" · 旅行规划"}`
          :"本地推荐引擎";
      addMessage(reply,"bot",data.recommendations||[],sourceLabel,data.skills||[]);
      history.push({role:"assistant",content:reply});
      if(history.length>16)history.splice(0,history.length-16);
    }catch{
      loading.remove();
      addLocalAnswer(question);
      status("本地推荐引擎",false);
    }
  }
  async function detect(){
    try{
      const response=await fetch(apiBase+"/api/health",{cache:"no-store"});
      if(!response.ok)throw new Error("health unavailable");
      const health=await response.json();
      const agent=health.services&&health.services.agent;
      status(agent==="configured"?"云端智能体已连接":"云服务在线 · 本地推理",true);
    }catch{
      status("本地推荐引擎",false);
    }
  }
  function open(){
    panel.hidden=false;fab.style.display="none";document.body.style.overflow="hidden";
    if(!messages.children.length)addMessage({text:"你好！我是中国旅行助手 ✦\n可以帮你选目的地、安排天数、控制预算，也能结合热门城市分享给你灵感。"},"bot");
    setTimeout(()=>input.focus(),100);
  }
  function close(){
    panel.hidden=true;fab.style.display="";document.body.style.overflow="";
  }
  fab.addEventListener("click",open);
  $("#aiClose").addEventListener("click",close);
  form.addEventListener("submit",event=>{
    event.preventDefault();
    const question=input.value.trim();
    if(!question)return;
    input.value="";
    ask(question);
  });
  document.querySelectorAll(".ai-quick [data-q]").forEach(button=>button.addEventListener("click",()=>{
    const question=button.dataset.q;
    if(question)ask(question);
  }));
  document.addEventListener("keydown",event=>{if(event.key==="Escape"&&!panel.hidden)close();});
  detect();
})();
