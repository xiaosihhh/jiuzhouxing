(function () {
  "use strict";

  if (document.getElementById("travelCompanion")) return;
  const path = location.pathname.split("/").pop() || "index.html";
  const phrases = path === "community.html"
    ? ["看到喜欢的分享，记得收藏哦！", "真实的旅行故事最有意思。", "要不要也记录一段你的旅程？", "我可以帮你把灵感变成行程。"]
    : path === "hotel.html"
      ? ["先定路线，再选住处更省钱。", "拿不准住哪里就问我吧！", "我可以帮你按预算筛目的地。", "记得到携程核对实时房态。"]
      : path === "route.html"
        ? ["远途可以比较高铁和飞机。", "点“智能推荐”让我帮你选交通。", "路线确定后就能继续规划行程。"]
        : ["今天想去哪里看看？", "预算和时间告诉我，我来规划。", "中国那么大，总有一站适合你。", "想看山、看海，还是逛古城？"];

  const root = document.createElement("div");
  root.id = "travelCompanion";
  root.className = "travel-companion";
  root.innerHTML = `
    <div class="companion-bubble" role="status" aria-live="polite" hidden></div>
    <button class="companion-person" type="button" aria-label="和九州行卡通旅行助手聊天">
      <span class="companion-shadow"></span>
      <span class="companion-figure">
        <span class="companion-hair"></span>
        <span class="companion-head">
          <i class="companion-eye left"></i><i class="companion-eye right"></i>
          <i class="companion-cheek left"></i><i class="companion-cheek right"></i>
          <i class="companion-mouth"></i>
        </span>
        <span class="companion-body"><i>✦</i></span>
        <span class="companion-arm left"></span>
        <span class="companion-arm right"></span>
        <span class="companion-bag">AI</span>
      </span>
    </button>`;
  document.body.appendChild(root);

  const bubble = root.querySelector(".companion-bubble");
  let phraseIndex = 0;
  let hideTimer = 0;
  function greet() {
    if (document.body.classList.contains("assistant-open")) return;
    bubble.textContent = phrases[phraseIndex++ % phrases.length];
    bubble.hidden = false;
    requestAnimationFrame(() => bubble.classList.add("show"));
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      bubble.classList.remove("show");
      setTimeout(() => { bubble.hidden = true; }, 260);
    }, 5400);
  }

  root.querySelector(".companion-person").addEventListener("click", () => {
    bubble.classList.remove("show");
    bubble.hidden = true;
    if (typeof window.openAI === "function") {
      window.openAI();
      return;
    }
    const communityFab = document.getElementById("aiFab");
    if (communityFab) {
      communityFab.click();
      return;
    }
    location.href = "index.html?ai=1";
  });

  setTimeout(greet, 1800);
  function schedule() {
    const delay = 12000 + Math.random() * 8000;
    setTimeout(() => {
      greet();
      schedule();
    }, delay);
  }
  setTimeout(schedule, 9000);
})();
