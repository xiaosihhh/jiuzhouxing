(function(){
  "use strict";
  const $ = s => document.querySelector(s);
  const esc = s => String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const html=document.documentElement;
  const ACCOUNTS_KEY="hy_accounts_v1", SESSION_KEY="hy_session_phone";
  const state={posts:[],sort:"hot",city:"",loading:true,busy:false};
  let toastTimer,previewUrls=[];

  let theme=localStorage.getItem("theme")||(matchMedia("(prefers-color-scheme:dark)").matches?"dark":"light");
  html.dataset.theme=theme;
  $("#themeToggle").addEventListener("click",()=>{
    theme=theme==="dark"?"light":"dark";
    html.dataset.theme=theme;
    localStorage.setItem("theme",theme);
  });

  function toast(message){
    const el=$("#toast");el.textContent=message;el.hidden=false;
    clearTimeout(toastTimer);toastTimer=setTimeout(()=>{el.hidden=true;},2400);
  }
  function currentUser(){
    try{
      const accounts=JSON.parse(localStorage.getItem(ACCOUNTS_KEY)||"{}");
      const phone=localStorage.getItem(SESSION_KEY)||"";
      const account=accounts[phone];
      return account&&account.accountId?{...account,phone}:null;
    }catch{return null;}
  }
  async function refreshUser(){
    try{
      const response=await fetch("/api/auth/me",{cache:"no-store",credentials:"same-origin"});
      if(!response.ok)throw new Error("not authenticated");
      const data=await response.json();
      if(!data.user)throw new Error("not authenticated");
      const accounts=JSON.parse(localStorage.getItem(ACCOUNTS_KEY)||"{}");
      accounts[data.user.phone]={accountId:data.user.accountId,nickname:data.user.nickname,createdAt:data.user.createdAt||"",hasPassword:!!data.user.hasPassword};
      localStorage.setItem(ACCOUNTS_KEY,JSON.stringify(accounts));
      localStorage.setItem(SESSION_KEY,data.user.phone);
      return data.user;
    }catch{
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
  }
  function requireUser(){
    const user=currentUser();
    if(!user){
      $("#communityAuthModal").hidden=false;
      document.body.style.overflow="hidden";
      return null;
    }
    return user;
  }
  function closeAuth(){
    $("#communityAuthModal").hidden=true;
    document.body.style.overflow="";
  }
  function relativeTime(value){
    const time=new Date(value).getTime();
    if(!Number.isFinite(time))return "";
    const seconds=Math.max(0,Math.floor((Date.now()-time)/1000));
    if(seconds<60)return "刚刚";
    if(seconds<3600)return Math.floor(seconds/60)+" 分钟前";
    if(seconds<86400)return Math.floor(seconds/3600)+" 小时前";
    if(seconds<86400*7)return Math.floor(seconds/86400)+" 天前";
    return new Date(value).toLocaleDateString("zh-CN",{month:"numeric",day:"numeric"});
  }

  const cityNames=[];
  Object.values(window.CHINA_CITIES||{}).forEach(region=>{
    Object.values(region||{}).forEach(list=>{
      (Array.isArray(list)?list:[]).forEach(city=>{
        if(city&&city.name&&!cityNames.includes(city.name))cityNames.push(city.name);
      });
    });
  });
  cityNames.sort((a,b)=>a.localeCompare(b,"zh"));
  $("#communityCity").insertAdjacentHTML("beforeend",cityNames.map(name=>`<option value="${esc(name)}">${esc(name)}</option>`).join(""));
  $("#shareCity").innerHTML=cityNames.map(name=>`<option value="${esc(name)}">${esc(name)}</option>`).join("");

  function mediaItem(item){
    const url=String(item&&item.url||"");
    if(!url.startsWith("/api/community/media/"))return "";
    if(item.type==="video"||/^video\//.test(item.type||""))return `<video src="${esc(url)}" poster="${esc(item.poster||"")}" controls playsinline preload="metadata"></video>`;
    return `<img src="${esc(url)}" alt="旅行分享图片" loading="lazy"/>`;
  }
  function mediaBlock(post){
    const media=Array.isArray(post.media)?post.media.filter(item=>item&&item.url).slice(0,4):[];
    if(!media.length)return "";
    const isVideo=item=>item.type==="video"||/^video\//.test(item.type||"");
    return `<div class="community-media" data-media-count="${media.length}">
      <div class="community-media-stage">${mediaItem(media[0])}</div>
      <span class="community-media-badge">${isVideo(media[0])?"▶ 视频":"📷 照片"} ${media.length>1?"1 / "+media.length:""}</span>
      ${media.length>1?`<div class="community-media-strip">${media.map((item,index)=>`<button type="button" class="${index===0?"active":""}" data-media-index="${index}" aria-label="查看第 ${index+1} 个媒体">${isVideo(item)?"▶":`<img src="${esc(item.url)}" alt=""/>`}</button>`).join("")}</div>`:""}
    </div>`;
  }
  function commentsBlock(post,user){
    const comments=Array.isArray(post.comments)?post.comments:[];
    return `<div class="community-comments">
      <div class="community-comments-head"><b>旅行评价</b><span>${comments.length} 条</span></div>
      <div class="community-comment-list">${comments.slice(-8).map(item=>`<div class="community-comment"><span>${esc((item.nickname||"旅行者").slice(0,1))}</span><div><b>${esc(item.nickname||"旅行者")}</b><small>${esc(relativeTime(item.createdAt))}</small><p>${esc(item.text)}</p></div></div>`).join("")||`<p class="community-no-comments">还没有评价，来说说你的感受。</p>`}</div>
      <form class="community-comment-form" data-comment-form="${esc(post.id)}">
        <input name="text" maxlength="500" placeholder="${user?"写下你的旅行评价…":"登录后参与评价"}" autocomplete="off"/>
        <button type="submit">评价</button>
      </form>
    </div>`;
  }
  function postCard(post,user){
    const liked=!!user&&Array.isArray(post.likes)&&post.likes.includes(user.accountId);
    const favorited=!!user&&Array.isArray(post.favorites)&&post.favorites.includes(user.accountId);
    return `<article class="community-card" data-post-id="${esc(post.id)}">
      <header class="community-card-head">
        <span class="community-avatar">${esc((post.nickname||"旅").slice(0,1))}</span>
        <div><b>${esc(post.nickname||"旅行者")}</b><small>${esc(relativeTime(post.createdAt))}</small></div>
        <span class="community-city-chip">📍 ${esc(post.city)}</span>
      </header>
      ${mediaBlock(post)}
      <div class="community-card-copy"><p>${esc(post.caption)}</p></div>
      <div class="community-actions">
        <button type="button" class="${liked?"active":""}" data-community-action="like" data-id="${esc(post.id)}" aria-pressed="${liked}"><span>${liked?"♥":"♡"}</span> 点赞 ${Array.isArray(post.likes)?post.likes.length:0}</button>
        <button type="button" class="${favorited?"active":""}" data-community-action="favorite" data-id="${esc(post.id)}" aria-pressed="${favorited}"><span>${favorited?"★":"☆"}</span> 收藏 ${Array.isArray(post.favorites)?post.favorites.length:0}</button>
        <span class="community-comment-count">💬 ${Array.isArray(post.comments)?post.comments.length:0}</span>
        ${user&&post.accountId===user.accountId?`<button type="button" class="community-delete" data-community-action="delete" data-id="${esc(post.id)}" title="删除我的分享">删除</button>`:""}
      </div>
      ${commentsBlock(post,user)}
    </article>`;
  }
  function sortedPosts(){
    let list=state.posts.filter(post=>!state.city||post.city===state.city);
    if(state.sort==="new")list=list.slice().sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
    else list=list.slice().sort((a,b)=>{
      const score=p=>(p.likes||[]).length*3+(p.favorites||[]).length*2+(p.comments||[]).length*4;
      return score(b)-score(a)||new Date(b.createdAt)-new Date(a.createdAt);
    });
    return list;
  }
  function render(){
    const user=currentUser();
    const posts=sortedPosts();
    $("#communityCount").textContent=state.loading?"正在加载分享…":`${posts.length} 条旅行分享`;
    if(state.loading)return;
    $("#communityEmpty").hidden=posts.length>0;
    $("#communityFeed").innerHTML=posts.map(post=>postCard(post,user)).join("");
    const targetId=new URLSearchParams(location.search).get("post");
    if(targetId){
      const card=document.querySelector(`[data-post-id="${CSS.escape(targetId)}"]`);
      if(card){card.classList.add("community-card-focus");setTimeout(()=>card.scrollIntoView({behavior:"smooth",block:"center"}),120);}
    }
  }
  async function loadPosts(){
    state.loading=true;render();
    try{
      await refreshUser();
      const response=await fetch("/api/community/posts",{cache:"no-store"});
      if(!response.ok)throw new Error("load failed");
      const data=await response.json();
      state.posts=Array.isArray(data.posts)?data.posts:[];
    }catch{
      state.posts=[];
      toast("社区服务暂不可用，请确认本地服务器已启动");
    }finally{
      state.loading=false;render();
    }
  }
  async function toggle(postId,action){
    const user=requireUser();if(!user||state.busy)return;
    state.busy=true;
    try{
      const response=await fetch(`/api/community/posts/${encodeURIComponent(postId)}/${action}`,{
        method:"POST",headers:{"Content-Type":"application/json"},credentials:"same-origin",body:JSON.stringify({accountId:user.accountId})
      });
      const data=await response.json();
      if(response.status===401)requireUser();
      if(!response.ok)throw new Error(data.error||"操作失败");
      const index=state.posts.findIndex(post=>post.id===postId);
      if(index>=0)state.posts[index]=data.post;
      render();
    }catch(error){toast(error.message||"操作失败");}
    finally{state.busy=false;}
  }
  async function deletePost(postId){
    const user=requireUser();if(!user||state.busy)return;
    if(!confirm("确定删除这条旅行分享吗？此操作无法撤销。"))return;
    state.busy=true;
    try{
      const response=await fetch(`/api/community/posts/${encodeURIComponent(postId)}`,{
        method:"DELETE",headers:{"Content-Type":"application/json"},credentials:"same-origin",body:JSON.stringify({accountId:user.accountId})
      });
      const data=await response.json();
      if(response.status===401)requireUser();
      if(!response.ok)throw new Error(data.error||"删除失败");
      state.posts=state.posts.filter(post=>post.id!==postId);
      render();toast("分享已删除");
    }catch(error){toast(error.message||"删除失败");}
    finally{state.busy=false;}
  }
  async function addComment(postId,text){
    const user=requireUser();if(!user)return false;
    if(!text.trim()){toast("请输入评价内容");return false;}
    try{
      const response=await fetch(`/api/community/posts/${encodeURIComponent(postId)}/comments`,{
        method:"POST",headers:{"Content-Type":"application/json"},credentials:"same-origin",body:JSON.stringify({accountId:user.accountId,nickname:user.nickname,text:text.trim()})
      });
      const data=await response.json();
      if(response.status===401)requireUser();
      if(!response.ok)throw new Error(data.error||"评价失败");
      const index=state.posts.findIndex(post=>post.id===postId);
      if(index>=0)state.posts[index]=data.post;
      render();toast("评价已发布");
      return true;
    }catch(error){toast(error.message||"评价失败");return false;}
  }

  const feed=$("#communityFeed");
  feed.addEventListener("click",event=>{
    const mediaButton=event.target.closest("[data-media-index]");
    if(mediaButton){
      const card=mediaButton.closest("[data-post-id]");
      const post=state.posts.find(item=>item.id===card.dataset.postId);
      const index=Number(mediaButton.dataset.mediaIndex);
      if(post&&post.media&&post.media[index]){
        card.querySelector(".community-media-stage").innerHTML=mediaItem(post.media[index]);
        card.querySelector(".community-media-badge").textContent=(post.media[index].type==="video"?"▶ 视频":"📷 照片")+" "+(index+1)+" / "+post.media.length;
        card.querySelectorAll("[data-media-index]").forEach(btn=>btn.classList.toggle("active",Number(btn.dataset.mediaIndex)===index));
      }
      return;
    }
    const action=event.target.closest("[data-community-action]");
    if(action){
      if(action.dataset.communityAction==="delete")deletePost(action.dataset.id);
      else toggle(action.dataset.id,action.dataset.communityAction);
    }
  });
  feed.addEventListener("submit",async event=>{
    const form=event.target.closest("[data-comment-form]");
    if(!form)return;
    event.preventDefault();
    const input=form.querySelector("[name=text]");
    if(await addComment(form.dataset.commentForm,input.value))input.value="";
  });

  document.querySelectorAll("[data-sort]").forEach(button=>button.addEventListener("click",()=>{
    state.sort=button.dataset.sort;
    document.querySelectorAll("[data-sort]").forEach(item=>{
      const active=item===button;item.classList.toggle("active",active);item.setAttribute("aria-selected",String(active));
    });
    render();
  }));
  $("#communityCity").addEventListener("change",event=>{state.city=event.target.value;render();});

  function resetPreview(){
    previewUrls.forEach(url=>URL.revokeObjectURL(url));previewUrls=[];
    $("#sharePreview").hidden=true;$("#sharePreview").innerHTML="";
  }
  function showShareError(message){
    const error=$("#shareError");error.textContent=message;error.hidden=!message;
  }
  function openShare(){
    if(!requireUser())return;
    $("#shareModal").hidden=false;document.body.style.overflow="hidden";setTimeout(()=>$("#shareCaption").focus(),100);
  }
  function closeShare(){
    $("#shareModal").hidden=true;document.body.style.overflow="";
  }
  $("#communityCreate").addEventListener("click",openShare);
  document.querySelectorAll("[data-open-share]").forEach(button=>button.addEventListener("click",openShare));
  document.querySelectorAll("[data-share-close]").forEach(button=>button.addEventListener("click",closeShare));
  document.querySelectorAll("[data-auth-close]").forEach(button=>button.addEventListener("click",closeAuth));
  document.addEventListener("keydown",event=>{
    if(event.key!=="Escape")return;
    if(!$("#shareModal").hidden)closeShare();
    else if(!$("#communityAuthModal").hidden)closeAuth();
  });
  $("#shareMedia").addEventListener("change",event=>{
    resetPreview();showShareError("");
    const files=Array.from(event.target.files||[]);
    if(files.length>4){showShareError("最多选择 4 个照片或视频文件");event.target.value="";return;}
    const total=files.reduce((sum,file)=>sum+file.size,0);
    if(total>32*1024*1024){showShareError("照片和视频总大小不能超过 32 MB");event.target.value="";return;}
    $("#sharePreview").hidden=!files.length;
    $("#sharePreview").innerHTML=files.map(file=>{
      const url=URL.createObjectURL(file);previewUrls.push(url);
      return `<div class="community-preview-item">${file.type.startsWith("video/")?`<video src="${url}" muted></video>`:`<img src="${url}" alt=""/>`}<span>${esc(file.name)}</span><button type="button" data-preview-remove="${esc(file.name)}" aria-label="移除">✕</button></div>`;
    }).join("");
  });
  $("#sharePreview").addEventListener("click",event=>{
    const remove=event.target.closest("[data-preview-remove]");
    if(!remove)return;
    showShareError("如需移除文件，请重新选择");
  });
  function readDataURL(file){
    return new Promise((resolve,reject)=>{
      const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file);
    });
  }
  $("#shareForm").addEventListener("submit",async event=>{
    event.preventDefault();
    const user=requireUser();if(!user)return;
    const files=Array.from($("#shareMedia").files||[]);
    const caption=$("#shareCaption").value.trim();
    const city=$("#shareCity").value;
    if(!files.length){showShareError("请至少上传一张照片或一个视频");return;}
    if(!caption){showShareError("请填写旅行配文");return;}
    showShareError("");
    const submit=$("#shareSubmit");submit.disabled=true;submit.textContent="正在发布…";
    try{
      const media=await Promise.all(files.map(readDataURL));
      const response=await fetch("/api/community/posts",{
        method:"POST",headers:{"Content-Type":"application/json"},credentials:"same-origin",
        body:JSON.stringify({accountId:user.accountId,nickname:user.nickname,city,caption,media})
      });
      const data=await response.json();
      if(!response.ok)throw new Error(data.error||"发布失败");
      state.posts.unshift(data.post);
      $("#shareForm").reset();resetPreview();closeShare();render();toast("旅行分享已发布");
      setTimeout(()=>document.querySelector(`[data-post-id="${CSS.escape(data.post.id)}"]`)?.scrollIntoView({behavior:"smooth",block:"center"}),120);
    }catch(error){showShareError(error.message||"发布失败，请稍后重试");}
    finally{submit.disabled=false;submit.textContent="发布分享";}
  });

  loadPosts();
})();
