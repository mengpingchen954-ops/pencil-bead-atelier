import "./style.css";
import {
  BEADS,
  ORDERS,
  CHAPTERS,
  STORIES,
  FURNITURE,
  CHARMS,
  JOURNEY,
} from "./content.js";
import { storyUnlocked, pendingStory, finishStory, storyEvidence, mediaPath } from "./story.js";
import {
  SAVE_KEY,
  targetForLevel,
  freshSave,
  normalizeSave,
  refreshEnergy,
  newSession,
  move,
  useTool,
  findMove,
  total,
  draftCounts,
  canPlace,
  adjacent,
  checkOrder,
  deliver,
  purchase,
} from "./model.js";
import {
  artURL,
  icon,
  flourish,
  botanical,
  beadImage,
  miniBracelet,
} from "./art.js";
import { AtelierRenderer } from "./renderer.js";

const $ = (s) => document.querySelector(s);
let save;
try {
  save = refreshEnergy(
    normalizeSave(JSON.parse(localStorage.getItem(SAVE_KEY))),
  );
} catch {
  save = freshSave();
}
let screen = save.started ? "home" : "cover",
  session = null,
  selected = -1,
  slot = -1,
  tool = null,
  hint = null,
  busy = false,
  queuedInput = null,
  modal = null,
  undo = [],
  storyIndex = 0,
  storyLine = 0,
  returnScreen = "home",
  audio;
const view = $("#view"),
  chrome = $("#chrome"),
  modalRoot = $("#modal-root");
const order = () => ORDERS.find((o) => o.id === save.orderId);
const currentChapter = () =>
  CHAPTERS[Math.min(2, Math.floor(save.completed.length / 2))];
const journey = () => JOURNEY[Math.min(6, save.completed.length)];
const mediaController = new AbortController();
const mediaTimeout = setTimeout(() => mediaController.abort(), 4000);
const mediaReady = fetch(`${import.meta.env.BASE_URL}story-media.json`, {
  signal: mediaController.signal,
}).then((r) => r.ok ? r.json() : {}).catch(() => ({})).finally(() => clearTimeout(mediaTimeout));
const btn = (label, action, cls = "primary", attrs = "") =>
  `<button class="${cls}" data-action="${action}" ${attrs}>${label}</button>`;
const ibtn = (name, action, label) =>
  btn(icon(name), action, "icon-btn", `aria-label="${label}" title="${label}"`);
const tag = (text) => `<span class="eyebrow">${text}</span>`;
const bead = (type, cls = "") =>
  `<img class="bead-img ${cls}" src="${beadImage(type)}" alt="${BEADS[type].name}" draggable="false">`;
const heading = (small, title, sub = "") =>
  `<div class="page-heading">${tag(small)}<h1>${title}</h1>${sub ? `<p>${sub}</p>` : ""}</div>`;
const reward = (n) => `<span class="reward">${icon("coin")}${n}</span>`;
function persist() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch {
    toast("当前浏览器无法保存，请保留此页面。");
  }
}
function toast(message) {
  $("#toast").textContent = message;
  $("#toast").classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => $("#toast").classList.remove("show"), 2500);
}
function clearToast() {
  clearTimeout(toast.timer);
  $("#toast").classList.remove("show");
}
function chime(kind = 0) {
  if (!save.sound) return;
  try {
    audio ??= new (window.AudioContext || window.webkitAudioContext)();
    audio.resume();
    [0, 1, 2].slice(0, kind ? 3 : 1).forEach((n) => {
      const osc = audio.createOscillator(),
        gain = audio.createGain(),
        t = audio.currentTime + n * 0.085;
      osc.type = "sine";
      osc.frequency.value = [523.25, 659.25, 783.99][n];
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.035, t + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
      osc.connect(gain).connect(audio.destination);
      osc.start(t);
      osc.stop(t + 0.26);
    });
  } catch {}
}
function beadSound(event, chain = 0) {
  if (!save.sound) return;
  try {
    audio ??= new (window.AudioContext || window.webkitAudioContext)();
    audio.resume();
    const notes =
      event === "clear"
        ? [880, 1108.73, 1318.51].slice(0, chain ? 3 : 2)
        : event === "miss"
          ? [246.94, 220]
          : event === "land"
            ? [392]
            : [620];
    notes.forEach((frequency, i) => {
      const osc = audio.createOscillator(),
        gain = audio.createGain(),
        at = audio.currentTime + i * 0.045;
      osc.type = event === "miss" ? "triangle" : "sine";
      osc.frequency.setValueAtTime(
        frequency * (1 + Math.min(chain, 5) * 0.085),
        at,
      );
      osc.frequency.exponentialRampToValueAtTime(
        frequency * (event === "tap" ? 0.7 : 1),
        at + 0.075,
      );
      gain.gain.setValueAtTime(0.001, at);
      gain.gain.linearRampToValueAtTime(
        event === "tap" ? 0.012 : event === "land" ? 0.014 : 0.025,
        at + 0.008,
      );
      gain.gain.exponentialRampToValueAtTime(
        0.001,
        at + (event === "clear" ? 0.19 : 0.085),
      );
      osc.connect(gain).connect(audio.destination);
      osc.start(at);
      osc.stop(at + 0.22);
    });
  } catch {}
}
let renderer;
try {
  renderer = new AtelierRenderer($("#scene"), {
    board: boardClick,
    swipe: swap,
    slot: slotClick,
    reorder: reorderSlots,
    canInteract: () => !modal,
    dragAllowed: () => !busy && !tool,
    press: () => beadSound("tap"),
    context: (ok) => toast(ok ? "工作台已恢复" : "画布暂时中断，请稍候恢复。"),
  });
} catch (e) {
  console.error(e);
  view.innerHTML = `<div class="fatal"><h1>工作台暂时无法打开</h1><p>请在支持 WebGL 的浏览器中打开，并开启硬件加速。</p></div>`;
  throw e;
}

function furnitureArt(f, tier = save.upgrades[f.id]) {
  if (f.id === "chair")
    return `<img class="furniture-art" src="${artURL(f.art[tier])}" alt="${f.names[tier]}">`;
  const wood = ["#aa8965", "#b7a281", "#a6b19a"][tier];
  return `<svg class="furniture-art drawn-furniture" viewBox="0 0 220 150" aria-label="${f.names[tier]}" role="img"><defs><pattern id="grain-${f.id}-${tier}" width="8" height="11" patternUnits="userSpaceOnUse"><path d="M1 0v11m3-6v5" stroke="#766048" opacity=".12"/></pattern></defs><ellipse cx="110" cy="137" rx="88" ry="5" fill="#a79070" opacity=".15"/><g stroke="#7d6c54" stroke-width="1.8" stroke-linejoin="round" fill="${wood}">${f.id === "display" ? `<path d="M33 23h154v102H33z"/><path fill="#e7e5d0" d="M40 30h140v56H40z"/><path fill="#c4d0c4" opacity=".5" d="m42 31 138 55H42z"/><path d="M33 93h154m-77-63v56m0 7v32M41 125v13m138-13v13"/><circle cx="100" cy="109" r="2"/><circle cx="119" cy="109" r="2"/><path fill="#f2e6c5" d="M56 69q14-31 28 0zM126 69q14-31 28 0z"/><path fill="none" stroke="#d1ad64" stroke-width="4" d="M61 60q9 20 18 0m52 0q9 20 18 0"/>${tier === 2 ? '<path d="M32 22q78-29 156 0" fill="#a6b19a"/><path d="M96 11q15-12 28 0" stroke="#d5b87b"/>' : ""}` : `<path d="M22 60h176v13H22zM35 73h150v24H35zM35 97h12v40H35zm138 0h12v40h-12z"/><path d="M84 73v24m48-24v24m-78-12h12m33 0h12m37 0h12"/><path fill="#efdfbc" d="M52 39h75v21H52z"/><path fill="#d1c4a4" d="M136 42h32v18h-32z"/><g fill="#d9b9b4"><circle cx="65" cy="48" r="4"/><circle cx="79" cy="48" r="4"/><circle cx="93" cy="48" r="4"/></g><path d="M153 42V25m0 0 15-7m-15 7-12-8" fill="none"/>${tier === 2 ? '<path fill="#acc0be" d="M28 37h15v23H28z"/><path d="m29 37 3-18m5 18 4-22"/>' : ""}`}</g><path d="M25 140h170" stroke="#b8a489" stroke-dasharray="2 4"/></svg>`;
}
function render() {
  document.body.dataset.screen = screen;
  $("#app").dataset.screen = screen;
  renderer.motion = save.reduced ? 0 : 1;
  const names = {
    home: "珠光小店",
    orders: "顾客委托",
    craft: "手串工坊",
    match: "珠材花园",
    decor: "小店焕新",
    album: "作品图鉴",
    journal: "我们的故事",
  };
  chrome.innerHTML =
    screen === "cover"
      ? ""
      : `<header class="topbar"><div class="top-left">${screen === "home" ? `<span class="brand-mark">${icon("flower")}</span>` : ibtn("back", "back", "返回小店")}<span class="brand">${names[screen]}</span></div><div class="resources"><button data-action="inventory" class="resource" aria-label="查看珠材">${icon("bag")}<span>${total(save.inventory)}</span></button><span class="resource">${icon("coin")}<b>${save.coins}</b></span><button class="resource energy" data-action="energy">${icon("energy")}<span>${save.energy}<small>/10</small></span></button></div>${ibtn("settings", "settings", "设置")}</header>${
          screen !== "match"
            ? `<nav class="bottom-nav" aria-label="主导航">${[
                ["home", "小店", "home"],
                ["orders", "委托", "orders"],
                ["craft", "手作", "craft"],
                ["decor", "装修", "chair"],
                ["album", "图鉴", "album"],
              ]
                .map(([s, n, i]) =>
                  btn(
                    `${icon(i)}<span>${n}</span>`,
                    `nav:${s}`,
                    `nav-item ${screen === s ? "active" : ""}`,
                    `aria-label="${n}" ${screen === s ? 'aria-current="page"' : ""}`,
                  ),
                )
                .join("")}</nav>`
            : ""
        }`;
  const builders = {
    cover: coverView,
    home: homeView,
    orders: ordersView,
    craft: craftView,
    match: matchView,
    decor: decorView,
    album: albumView,
    journal: journalView,
  };
  view.innerHTML = builders[screen]();
  view.scrollTop = 0;
  if (screen === "match" && session)
    renderer.setBoard(session.board, selected, hint);
  else if (screen === "craft")
    renderer.setBracelet(save.draft, save.charm, slot);
  else renderer.mount(null);
  requestAnimationFrame(mountScene);
  renderModal();
}
function mountScene() {
  const anchor = $(".scene-anchor");
  if (anchor) renderer.mount(anchor);
  else renderer.mount(null);
}
function coverView() {
  return `<section class="cover"><div class="cover-arch">${botanical}</div><div class="cover-title">${tag("A LITTLE BEAD ATELIER")}<h1>珠光<span>小店物语</span></h1>${flourish}<p>与奶奶一起，把日子串成光。</p></div><img class="cover-art" src="${artURL("cover")}" alt="奶奶陪着阿禾在木桌边串珠，花叶环绕着她们"><div class="cover-bottom">${btn(`推开小店的门 ${icon("arrow")}`, "start", "primary start-button")}<p>三消采珠 · 亲手串珠 · 小店焕新</p><span class="cover-caption">献给每个认真生活、热爱手作的你</span></div></section>`;
}
function journeyCard() {
  const task = journey(), pending = pendingStory(save);
  return `<aside class="journey-card"><small>阿禾的心愿 · ${save.completed.length < 6 ? `第 ${save.completed.length + 1} 步` : "本篇后记"}</small><h2>${task.title}</h2><p>${task.pressure}</p><div class="journey-goal">${icon("flower")}<span>${task.goal}</span></div>${pending ? btn(`继续剧情 · ${pending.title} ${icon("arrow")}`, `story:${STORIES.indexOf(pending)}`, "text-button journey-read") : btn("翻开故事与线索手账", "nav:journal", "text-button journey-read")}</aside>`;
}
function homeView() {
  const o = order(),
    chapter = currentChapter();
  return `<section class="home-page"><div class="home-intro">${tag("AH HE’S LITTLE ATELIER")}<h1>一颗珠子，一段新生活</h1><p>午后的阳光刚好，小店又开门了。</p></div><div class="shop-illustration"><img src="${artURL("shop")}" alt="阿禾和奶奶的温暖手串小店"><div class="shop-plaque">阿禾手作 <span>营业中</span></div>${btn(`${icon("chair")} 布置小店`, "nav:decor", "floating-button")}</div><div class="home-paper"><div class="chapter-line"><span>${chapter.title}</span><button class="text-button" data-action="nav:journal">故事 ${icon("arrow")}</button></div><div class="chapter-progress"><span style="width:${(save.completed.length / 6) * 100}%"></span></div><div class="home-order"><div class="order-mark">${icon(save.completed.length === 6 ? "flower" : "orders")}</div><div><small>${save.completed.length === 6 ? "新的开始" : "正在等待的心意 · " + o.customer}</small><h2>${save.completed.length === 6 ? "我们的故事，会继续" : o.name}</h2></div>${reward(o.reward)}</div><p class="home-quote">“${save.completed.length === 6 ? "明天还要开门。先为自己做一条喜欢的手串吧。" : o.text}”</p><div class="home-actions">${btn(`${icon("craft")} ${save.completed.length === 6 ? "自由设计" : "开始手作"}`, "nav:craft", "secondary")}${btn(`${icon("flower")} 消除采珠`, "match-intro")}</div>${journeyCard()}<div class="home-footer"><span>${icon("star")} 小店口碑 ${save.rep}</span><span>已完成 ${save.completed.length}/6 份委托</span></div></div></section>`;
}
function ordersView() {
  return `<section class="page">${heading("LET EVERY WISH SHINE", "每一份心意，都值得", "听听客人的故事，为她们做一条独一无二的手串。")}<div class="order-list">${ORDERS.map(
    (o, i) => {
      const done = save.completed.includes(o.id),
        locked = i > save.completed.length;
      return `<article class="order-card ${done ? "finished" : ""}"><div class="order-number">${String(i + 1).padStart(2, "0")}<span>${done ? "已交付" : locked ? "待开启" : "可接单"}</span></div><div class="order-card-top">${miniBracelet(o.palette, o.charm)}<div><small>${o.customer} · ${o.occasion}</small><h2>${o.name}</h2><p>${o.text}</p></div></div><p class="order-story">${icon("book")} ${JOURNEY[i].title}</p><div class="order-requirements"><span>${bead(o.main)}${BEADS[o.main].short} ≥${o.mainNeed}</span><span>${bead(o.accent)}${BEADS[o.accent].short} ≥${o.accentNeed}</span><span>${icon(o.charm === "daisy" ? "flower" : o.charm)}${CHARMS[o.charm]}吊坠</span></div><div class="card-footer">${reward(o.reward)}<span class="muted">口碑 +${o.rep}</span>${btn(done ? `${icon("check")} 已送达` : locked ? `${icon("lock")} 完成前单解锁` : "为她制作", `accept:${o.id}`, done || locked ? "small-button disabled" : "small-button", done || locked ? "disabled" : "")}</div></article>`;
    },
  ).join("")}</div></section>`;
}
function craftView() {
  const o = order(),
    checks = checkOrder(save, o),
    counts = draftCounts(save.draft),
    done = save.completed.length === 6;
  return `<section class="craft-page"><div class="craft-banner"><img src="${artURL("workshop")}" alt="窗边手作台"><div>${tag("HANDMADE WITH LOVE")}<h1>${done ? "把喜欢，串给自己" : o.name}</h1><p>${done ? "试着搭配，作品会自动保存在工作台。" : o.customer + "的定制委托 · 12 颗珠子"}</p></div></div>${!done ? `<p class="craft-story">${icon("book")} ${journey().goal}</p>` : ""}<div class="craft-goals">${[
    [checks.main, `${BEADS[o.main].short} ${counts[o.main]}/${o.mainNeed}`],
    [
      checks.accent,
      `${BEADS[o.accent].short} ${counts[o.accent]}/${o.accentNeed}`,
    ],
    [checks.charm, `${CHARMS[o.charm]}吊坠`],
  ]
    .map(
      ([ok, t]) =>
        `<span class="${ok ? "met" : ""}">${icon(ok ? "check" : "flower")}${t}</span>`,
    )
    .join(
      "",
    )}</div><div class="workbench"><div class="scene-anchor bracelet-scene" aria-label="12颗珠子组成的可编辑三维手串"></div><div class="bench-label">${save.draft.filter((n) => n !== null).length} / 12 <span>颗心意</span></div><div class="bench-tools">${ibtn("undo", "undo", "撤销上一步")}${ibtn("bin", "erase", "取下选中珠子")}${ibtn("eye", "sample", "查看配珠参考")}</div></div><p class="craft-instruction">${slot >= 0 ? `已选第 ${slot + 1} 颗 · 点珠材替换，或取下` : "点珠材依次串入 · 拖动珠子可交换位置"}</p><div class="bead-tray">${BEADS.map((b, i) => btn(`${bead(i)}<span>${b.short}</span><small>余 ${Math.max(0, save.inventory[i] - counts[i])}</small>`, `bead:${i}`, "bead-option", `aria-label="添加${b.name}"`)).join("")}</div><div class="charm-row"><span>选择吊坠</span>${Object.entries(
    CHARMS,
  )
    .map(([id, n]) =>
      btn(
        `${icon(id === "daisy" ? "flower" : id)} ${n}`,
        `charm:${id}`,
        `charm-option ${save.charm === id ? "selected" : ""}`,
        `aria-pressed="${save.charm === id}"`,
      ),
    )
    .join(
      "",
    )}</div><div class="craft-actions">${btn(`${icon("flower")} 补充珠材`, "match-intro", "secondary")}${btn(`${icon("gift")} ${done ? "欣赏作品" : "包装交付"}`, done ? "free-preview" : "deliver", `primary ${!done && !Object.values(checks).every(Boolean) ? "pending" : ""}`)}</div></section>`;
}
function matchView() {
  if (!session) return "";
  const amount = Math.min(total(session.collected), session.target);
  return `<section class="match-page"><div class="match-heading">${tag("COLLECT A LITTLE LIGHT")}<div><h1>第 ${session.level} 关 · 珠材花园</h1>${ibtn("pause", "pause", "暂停游戏")}</div><p>${tool ? (tool === "hammer" ? "点选一颗珠子，使用小木槌" : "点选一颗珠子，收集整行整列") : "同色直线三颗，或 2×2 四颗方块即可收集"}</p></div><div class="match-stats"><div class="moves"><b>${session.moves}</b><span>剩余步数</span></div><div class="goal"><div><span>${icon("bag")} 收集珠材</span><b>${amount}<small> / ${session.target}</small></b></div><div class="progress-track"><i style="width:${(amount / session.target) * 100}%"></i></div></div></div><div class="board-frame ${busy ? "resolving" : ""}"><div class="scene-anchor board-scene" tabindex="0" role="application" aria-label="8行8列三消棋盘，方向键移动光标，空格选珠后移动到相邻格并按空格交换"></div></div><div class="collected-row">${BEADS.map((b, i) => `<span>${bead(i)}<small>${session.collected[i]}</small></span>`).join("")}</div><div class="match-tools">${[
    ["hammer", "小木槌", "hammer"],
    ["bloom", "花开十字", "flower"],
    ["shuffle", "重新排珠", "shuffle"],
    ["hint", "灵感提示", "hint"],
  ]
    .map(([id, n, ico]) =>
      btn(
        `${icon(ico)}<span>${n}</span><small>${id === "hint" ? "免费" : session.tools[id]}</small>`,
        `tool:${id}`,
        `tool-button ${tool === id ? "selected" : ""}`,
        id !== "hint" && !session.tools[id] ? "disabled" : "",
      ),
    )
    .join(
      "",
    )}</div><p class="match-note">${hint ? "金色圆圈是可以交换的一组珠子。" : "每关赠送手作工具 · 无效交换不扣步数"}</p></section>`;
}
function decorView() {
  return `<section class="page decor-page">${heading("A HOME FOR OUR DREAMS", "把小店，慢慢变好", "先添一把舒服的椅子，再给梦想多一点位置。")}<div class="decor-nook"><div class="nook-window">✧</div><div class="nook-furnitures">${FURNITURE.map((f) => `<div>${furnitureArt(f)}</div>`).join("")}</div><div class="nook-caption">阿禾与奶奶的小小天地</div></div><div class="furniture-list">${FURNITURE.map(
    (f) => {
      const tier = save.upgrades[f.id];
      return `<article class="furniture-card"><div class="furniture-preview">${furnitureArt(f)}</div><div class="furniture-info"><small>${f.title}</small><h2>${f.names[tier]}</h2><p>${f.text}</p><div class="tier-dots">${[0, 1, 2].map((i) => `<i class="${i <= tier ? "filled" : ""}"></i>`).join("")}<span>${tier === 2 ? "已全部焕新" : "第 " + (tier + 1) + " 阶段"}</span></div>${tier < 2 ? btn(`${icon("coin")} ${f.prices[tier + 1]} · 升级${f.names[tier + 1]}`, `buy:${f.id}`, "small-button") : `<span class="owned-label">${icon("check")} 已拥有最终款</span>`}${tier >= 1 ? btn("翻开这件家具的故事", `story:${STORIES.findIndex((s) => s.furniture === f.id)}`, "text-button furniture-story") : ""}</div></article>`;
    },
  ).join("")}</div></section>`;
}
function albumView() {
  return `<section class="page">${heading("LITTLE THINGS, PRECIOUS MEMORIES", "每一条，都有故事", `已收藏 ${save.collection.length} / 6 件作品 · 记录你亲手搭配的模样`)}${
    save.collection.length
      ? `<div class="album-grid">${save.collection
          .map((c) => {
            const o = ORDERS.find((o) => o.id === c.id);
            return `<button class="album-card" data-action="collection:${c.id}">${miniBracelet(c.beads, c.charm)}<small>${o.customer}的心意</small><h2>${o.name}</h2><span>${icon("check")} 已珍藏</span></button>`;
          })
          .join("")}</div>`
      : `<div class="empty-state">${miniBracelet(ORDERS[0].palette, "daisy")}<h2>第一份回忆，还在等你</h2><p>完成委托后，你亲手制作的手串<br>会连同客人的心意，一起收藏在这里。</p>${btn("去接第一份委托", "nav:orders")}</div>`
  }<button class="journal-link" data-action="nav:journal">${icon("book")} 翻开阿禾的故事手账 ${icon("arrow")}</button></section>`;
}
function journalView() {
  const evidence = storyEvidence(save);
  return `<section class="page">${heading("OUR DAYS, OUR STORY", "把生活，握回自己手里", "三章主线 · 家具支线 · 属于阿禾的记录与回忆")}<div class="journal-portrait"><img src="${artURL("shop")}" alt="陪伴彼此的阿禾与奶奶"><span>从一张旧桌子，到属于自己的天地</span></div><div class="memory-box"><h2>${icon("book")} 线索与回忆 · ${evidence.length}</h2><p>读完对应剧情后收好，随时可以翻看。</p>${evidence.length ? evidence.map((s) => btn(`${icon("book")} ${s.evidence.title} ${icon("arrow")}`, `evidence:${s.id}`, "evidence-card")).join("") : '<p class="muted">第一张订单收据，还在等你亲手写下。</p>'}</div>${CHAPTERS.map(
    (c, i) =>
      `<div class="chapter-card"><small>CHAPTER ${String(i + 1).padStart(2, "0")}</small><h2>${c.title}</h2><p>${c.subtitle}</p>${STORIES.map(
        (s, n) => ({ s, n }),
      )
        .filter(({ s }) => s.chapter === i)
        .map(({ s, n }) =>
          btn(
            `<span>${storyUnlocked(save, s) ? icon(save.seenStories.includes(s.id) ? "check" : "book") : icon("lock")}<span>${s.title}<small>${s.furniture ? `支线 · 升级${FURNITURE.find((f) => f.id === s.furniture).title}解锁` : s.afterOrder ? `主线 · 交付「${ORDERS.find((o) => o.id === s.afterOrder).name}」` : "序章 · 幼年的往事"}${storyUnlocked(save, s) ? save.seenStories.includes(s.id) ? " · 可重温" : " · 未读" : ""}</small></span></span>${icon("arrow")}`,
            `story:${n}`,
            `story-link ${!storyUnlocked(save, s) ? "locked" : ""}`,
            !storyUnlocked(save, s) ? "disabled" : "",
          ),
        )
        .join("")}</div>`,
  ).join("")}</section>`;
}

function open(type, data = {}) {
  clearToast();
  modal = { type, ...data };
  renderModal();
}
function close() {
  modal = null;
  renderModal();
}
function modalShell(title, body, footer = "", cls = "") {
  return `<div class="modal-scrim"><section class="modal ${cls}" role="dialog" aria-modal="true" aria-label="${title}"><div class="modal-heading"><h2>${title}</h2>${ibtn("close", "close", "关闭弹窗")}</div>${body}${footer ? `<div class="modal-footer">${footer}</div>` : ""}</section></div>`;
}
function stopStoryVideo() {
  const video = modalRoot.querySelector("video");
  if (!video) return;
  video.onerror = video.onended = null;
  video.pause();
  video.removeAttribute("src");
  video.load();
}
function storyBody(s) {
  if (modal.mode === "loading") return '<p class="story-loading" role="status">正在翻开这一页…</p>';
  const finishLabel = s.evidence ? `收好${s.evidence.title}` : "把这一页收好";
  if (modal.mode === "video")
    return `<div class="story-video-wrap"><video class="story-video" controls playsinline preload="metadata" aria-label="${s.title}剧情视频"></video><p class="video-status" role="status">点击播放，可随时切换文字剧情。</p><div class="video-actions">${btn("播放剧情", "story-play", "small-button")}${btn("跳过视频 · 阅读文字", "story-text", "text-button")}</div></div>`;
  if (modal.mode === "video-end")
    return `<div class="story-summary"><small>片段已结束</small><p>${s.summary}</p>${btn(finishLabel, "story-finish", "small-button")}${btn("阅读完整文字", "story-text", "text-button")}</div>`;
  const [speaker, line] = s.lines[storyLine];
  const portrait = speaker === "奶奶" || speaker === "阿禾"
    ? `<img src="${artURL(speaker === "奶奶" ? "grandma" : "girl")}" alt="${speaker}">`
    : `<span class="speaker-name">${speaker}</span>`;
  return `${modal.mediaError ? '<p class="video-fallback" role="status">视频暂时无法播放，已为你打开完整文字剧情。</p>' : ""}<div class="story-art"><img src="${artURL("shop")}" alt="阿禾与奶奶的手作小店"><div class="story-portrait">${portrait}</div></div><div class="dialogue"><small>${speaker}</small><p>${line}</p><div class="dialogue-footer"><span class="story-page-number">${storyLine + 1} / ${s.lines.length}</span>${btn(storyLine === s.lines.length - 1 ? finishLabel : "继续", "story-next", "small-button")}</div></div>`;
}
function bindStoryVideo() {
  const video = modalRoot.querySelector("video"), active = modal;
  if (!video) return;
  video.muted = !save.sound;
  video.poster = mediaPath(active.media.poster, import.meta.env.BASE_URL) || artURL("shop");
  const captions = mediaPath(active.media.captions, import.meta.env.BASE_URL);
  if (captions) {
    const track = document.createElement("track");
    Object.assign(track, { kind: "subtitles", srclang: "zh", label: "中文字幕", src: captions, default: true });
    video.append(track);
  }
  video.onerror = () => {
    if (modal !== active) return;
    active.mode = "text";
    active.mediaError = true;
    renderModal();
  };
  video.onended = () => {
    if (modal !== active) return;
    active.mode = "video-end";
    renderModal();
  };
  video.src = mediaPath(active.media.src, import.meta.env.BASE_URL);
}
function renderModal() {
  stopStoryVideo();
  if (!modal) {
    modalRoot.innerHTML = "";
    return;
  }
  let html = "";
  const o = order();
  if (modal.type === "intro")
    html = modalShell(
      "去珠材花园走走",
      `<div class="intro-beads">${BEADS.map((_, i) => bead(i)).join("")}</div><p class="modal-copy">交换相邻珠子：同色直线三颗起消，<br>2×2 四颗同色方块也能消除。<br>收集 ${targetForLevel(save.level)} 颗，即可带回一袋手作珠材。</p><div class="reward-strip">${icon("bag")} 六色珠材包 <span>${icon("energy")} 消耗 1 体力</span></div><p class="muted centered">${journey().goal}</p>`,
      btn("开始采珠", "match-start"),
    );
  if (modal.type === "inventory")
    html = modalShell(
      "我的珠材盒",
      `<p class="modal-copy">把喜欢的颜色，留给下一份心意。</p><div class="inventory-grid">${BEADS.map((b, i) => `<div>${bead(i)}<strong>${b.name}</strong><span>库存 ${save.inventory[i]} 颗</span></div>`).join("")}</div>`,
      btn("去采集更多珠材", "match-intro"),
    );
  if (modal.type === "energy")
    html = modalShell(
      "歇一会儿，再慢慢来",
      `<div class="large-symbol">${icon("energy")}</div><p class="modal-copy">当前体力 <b>${save.energy} / 10</b><br>每 3 分钟恢复 1 点，最多存储 10 点。<br>制作手串和装修小店不消耗体力。</p>`,
      btn("回到小店", "close"),
    );
  if (modal.type === "pause")
    html = modalShell(
      "让心意，歇一歇",
      `<p class="modal-copy">珠材花园会等你。<br>回到小店将结束本次采集，已用体力不返还。</p>`,
      btn("继续采珠", "close") + btn("结束本次采集", "abandon", "secondary"),
    );
  if (modal.type === "result") {
    const won = session?.status === "won";
    html = modalShell(
      won ? "收集到了，今天的小美好" : "还差一点点，就好",
      `<div class="result-symbol">${icon(won ? "flower" : "moon")}</div><p class="modal-copy">${won ? `采得 ${total(session.collected)} 颗珠材，另赠六色基础包。<br>把它们变成一份被珍惜的心意吧。` : "本次没有完成目标，暂未获得珠材。<br>试试灵感提示和花开十字，下一次会更顺手。"}</p>${won ? `<div class="result-beads">${modal.pack.map((n, i) => `<span>${bead(i)}<b>+${n}</b></span>`).join("")}</div>` : ""}`,
      won
        ? btn("收好珠材 · 继续手作", "claim")
        : btn("再试一次 · 1 体力", "match-start") +
            btn("回小店", "abandon", "secondary"),
    );
  }
  if (modal.type === "sample")
    html = modalShell(
      "这一份心意的配珠参考",
      `${miniBracelet(o.palette, o.charm)}<p class="modal-copy">${o.name}<br>${BEADS[o.main].name}至少 ${o.mainNeed} 颗，${BEADS[o.accent].name}至少 ${o.accentNeed} 颗。<br>共 12 颗，搭配${CHARMS[o.charm]}吊坠。<br>在满足要求后，其余颜色由你决定。</p>`,
      btn("按参考排珠", "sample-fill") +
        btn("我来自己搭配", "close", "secondary"),
    );
  if (modal.type === "delivery")
    html = modalShell(
      "把心意，好好交到她手上",
      `${miniBracelet(save.draft, save.charm)}<div class="delivery-note"><small>TO ${o.customer}</small><h3>${o.name}</h3><p>“${o.text}”</p><span>${reward(o.reward)} 口碑 +${o.rep}</span><p class="delivery-story">${journey().result}</p></div>`,
      btn("系好丝带，确认交付", "confirm-delivery"),
    );
  if (modal.type === "collection" || modal.type === "free") {
    const c =
      modal.type === "free"
        ? { beads: save.draft, charm: save.charm }
        : save.collection.find((x) => x.id === modal.id);
    const co = ORDERS.find((x) => x.id === c?.id);
    html = modalShell(
      co?.name ?? "属于自己的小小光芒",
      `${miniBracelet(c.beads, c.charm)}<p class="modal-copy">${co ? "这份心意已经被认真珍藏。" : "你搭配的颜色，就是今天的心情。"}<br>${co?.occasion ?? "工作台会自动保存你的设计。"}</p>`,
      btn("继续我们的故事", "close"),
    );
  }
  if (modal.type === "settings")
    html = modalShell(
      "小店设置",
      `<div class="setting-row"><span>${icon("sound")} 游戏声音与剧情音频</span>${btn(save.sound ? "已开启" : "已关闭", "sound", `toggle ${save.sound ? "on" : ""}`, `aria-pressed="${save.sound}"`)}</div><div class="setting-row"><span>${icon("flower")} 减少动态效果</span>${btn(save.reduced ? "已开启" : "已关闭", "motion", `toggle ${save.reduced ? "on" : ""}`, `aria-pressed="${save.reduced}"`)}</div><p class="modal-copy small-copy">进度自动保存在当前浏览器。<br>触屏滑动交换珠子；电脑可用鼠标操作。<br>棋盘聚焦后用方向键移动、空格选珠与交换。<br>F 全屏，Esc 返回或关闭弹窗。</p><div class="settings-links">${btn("玩法说明", "help", "text-button")}${btn("导出进度", "export", "text-button")}${btn("重新开始", "reset", "text-button danger")}</div>`,
    );
  if (modal.type === "help")
    html = modalShell(
      "把日子，慢慢串成光",
      `<ol class="help-list"><li><b>采珠</b><p>交换相邻珠子，同色直线三颗起消，2×2 四颗方块也能消除。工具不耗步数，提示可免费使用。</p></li><li><b>接单与手作</b><p>点珠材依次串入 12 个位置；点选已有珠子后可替换，拖动可换位。满足配色和吊坠要求即可交付。</p></li><li><b>小店与故事</b><p>交付推进主线，升级家具开启祖孙支线。手账可回看已解锁剧情和收集的记录。稍后阅读会保留未读状态；视频可以切换文字版。</p></li></ol>`,
      btn("知道了，开始吧", "close"),
    );
  if (modal.type === "reset")
    html = modalShell(
      "重新翻开第一页？",
      `<p class="modal-copy">这会清除本浏览器里的珠材、作品和装修进度。<br>你可以先在设置中导出一份进度。</p>`,
      btn("保留现在的故事", "close") +
        btn("确认清除并重新开始", "confirm-reset", "secondary danger"),
    );
  if (modal.type === "story") {
    const s = STORIES[storyIndex];
    html = `<div class="modal-scrim story-scrim"><section class="story-modal" role="dialog" aria-modal="true" aria-label="${s.title}"><div class="story-top">${tag(s.furniture ? "A LITTLE MEMORY" : "AH HE’S STORY")}<span>${s.furniture ? "生活支线" : "主线剧情"}</span>${ibtn("close", "story-close", "稍后阅读")}</div><h2>${s.title}</h2>${storyBody(s)}</section></div>`;
  }
  if (modal.type === "evidence") {
    const scene = storyEvidence(save).find((s) => s.id === modal.id);
    if (scene) html = modalShell(scene.evidence.title, `<div class="memory-seal">${icon("book")}</div><p class="modal-copy">${scene.evidence.text}</p>`, btn("放回手账", "close") + btn("重温这段故事", `story:${STORIES.indexOf(scene)}`, "secondary"));
  }
  modalRoot.innerHTML = html;
  if (modal.type === "story" && modal.mode === "video") bindStoryVideo();
  requestAnimationFrame(() =>
    modalRoot.querySelector("button")?.focus({ preventScroll: true }),
  );
}
function go(s) {
  if (busy) return;
  clearToast();
  $("#match-effects").replaceChildren();
  queuedInput = null;
  close();
  screen = s;
  selected = -1;
  slot = -1;
  tool = null;
  hint = null;
  render();
}
async function startStory(index) {
  if (!storyUnlocked(save, STORIES[index])) return;
  storyIndex = index;
  storyLine = 0;
  open("story", { mode: "loading" });
  const active = modal, manifest = await mediaReady;
  if (modal !== active) return;
  active.media = manifest?.[STORIES[index].id];
  active.mode = mediaPath(active.media?.src, import.meta.env.BASE_URL) ? "video" : "text";
  renderModal();
}
function rememberDraft() {
  undo.push({ draft: [...save.draft], charm: save.charm });
  if (undo.length > 30) undo.shift();
}
function updateCraft() {
  persist();
  render();
}
function placeBead(type) {
  let index = slot >= 0 ? slot : save.draft.indexOf(null);
  if (index < 0) {
    toast("手串已经串满，点选一颗后可替换。");
    return;
  }
  if (!canPlace(save, type, index)) {
    toast("这种珠材不够了，去珠材花园收集一些吧。");
    return;
  }
  rememberDraft();
  save.draft[index] = type;
  slot = -1;
  chime();
  updateCraft();
}
function slotClick(i) {
  if (modal || screen !== "craft") return;
  slot = slot === i ? -1 : i;
  renderer.setBracelet(save.draft, save.charm, slot);
  renderCraftHint();
}
function renderCraftHint() {
  const p = $(".craft-instruction");
  if (p)
    p.textContent =
      slot >= 0
        ? `已选第 ${slot + 1} 颗 · 点珠材替换，或取下`
        : "点珠材依次串入 · 拖动珠子可交换位置";
}
function reorderSlots(a, b) {
  if (modal || screen !== "craft") return;
  rememberDraft();
  [save.draft[a], save.draft[b]] = [save.draft[b], save.draft[a]];
  slot = b;
  updateCraft();
}
function startMatch() {
  clearToast();
  $("#match-effects").replaceChildren();
  queuedInput = null;
  save = refreshEnergy(save);
  if (!save.energy) {
    open("energy");
    return;
  }
  if (save.energy === 10) save.energyAt = Date.now();
  save.energy--;
  persist();
  if (screen !== "match") returnScreen = screen === "craft" ? "craft" : "home";
  session = newSession((Date.now() % 1000000) + save.level * 71, save.level);
  screen = "match";
  selected = -1;
  hint = null;
  tool = null;
  busy = false;
  modal = null;
  render();
}
function boardClick(i) {
  if (modal || session?.status !== "playing") return;
  if (busy) {
    if (queuedInput?.tap !== undefined && Math.abs(queuedInput.tap - i) > 0)
      queuedInput = { swap: [queuedInput.tap, i] };
    else queuedInput = { tap: i };
    return;
  }
  if (tool) {
    const result = useTool(session, tool, i);
    tool = null;
    resolveResult(result);
    return;
  }
  if (selected < 0) {
    selected = i;
    renderer.setBoard(session.board, selected, hint);
  } else if (selected === i) {
    selected = -1;
    renderer.setBoard(session.board);
  } else swap(selected, i);
}
async function swap(a, b) {
  if (screen !== "match" || modal || session?.status !== "playing") return;
  if (busy) {
    queuedInput = { swap: [a, b] };
    return;
  }
  if (!Number.isInteger(b) || b < 0 || b > 63) return;
  if (!adjacent(a, b)) {
    selected = b;
    renderer.updateSelection(selected);
    return;
  }
  const result = move(session, a, b);
  if (!result.valid) {
    busy = true;
    selected = -1;
    hint = null;
    await renderer.animateSwap(a, b);
    beadSound("miss");
    await renderer.animateSwap(a, b, true);
    renderer.setBoard(session.board);
    const note = $(".match-note");
    if (note) note.textContent = "这两颗还不能相连，试试旁边的珠子。";
    busy = false;
    consumeQueuedInput();
    return;
  }
  await resolveResult(result, [a, b]);
}
function updateMatchHUD(collected = session.collected, moves = session.moves) {
  const amount = Math.min(total(collected), session.target);
  const movesLabel = $(".moves b");
  if (movesLabel) movesLabel.textContent = moves;
  const goal = $(".goal b");
  if (goal) goal.innerHTML = `${amount}<small> / ${session.target}</small>`;
  const bar = $(".progress-track i");
  if (bar) bar.style.width = `${(amount / session.target) * 100}%`;
  document
    .querySelectorAll(".collected-row small")
    .forEach((el, i) => (el.textContent = collected[i]));
  document.querySelectorAll(".tool-button").forEach((el) => {
    const id = el.dataset.action.split(":")[1];
    el.classList.toggle("selected", tool === id);
    if (id !== "hint") {
      el.querySelector("small").textContent = session.tools[id];
      el.disabled = !session.tools[id];
    }
  });
  const help = $(".match-heading p");
  if (help)
    help.textContent = tool
      ? tool === "hammer"
        ? "点选一颗珠子，使用小木槌"
        : "点选一颗珠子，收集整行整列"
      : "同色直线三颗，或 2×2 四颗方块即可收集";
}
function matchFeedback(frame, chain) {
  const effects = $("#match-effects"),
    base = $("#app").getBoundingClientRect(),
    board = $(".board-scene").getBoundingClientRect();
  const label = document.createElement("div");
  label.className = "combo-feedback";
  label.style.top = `${board.top - base.top + board.height * 0.34}px`;
  label.innerHTML = chain
    ? `<strong>${chain + 1} 连消</strong><span>灵感绽放 · +${frame.hit.length}</span>`
    : `<strong>+${frame.hit.length}</strong><span>收获小美好</span>`;
  effects.append(label);
  label
    .animate(
      save.reduced
        ? [{ opacity: 1 }, { opacity: 0 }]
        : [
            { opacity: 0, transform: "translate(-50%,8px) scale(.8)" },
            {
              opacity: 1,
              transform: "translate(-50%,-2px) scale(1.08)",
              offset: 0.22,
            },
            {
              opacity: 1,
              transform: "translate(-50%,-6px) scale(1)",
              offset: 0.65,
            },
            { opacity: 0, transform: "translate(-50%,-19px) scale(.98)" },
          ],
      { duration: save.reduced ? 220 : 680, easing: "ease-out" },
    )
    .finished.then(() => label.remove());
  if (save.reduced) return;
  for (let type = 0; type < 6; type++) {
    const hits = frame.hit.filter((i) => frame.before[i] === type);
    if (!hits.length) continue;
    const i = hits[Math.floor(hits.length / 2)],
      target = document
        .querySelectorAll(".collected-row>span")
        [type].getBoundingClientRect();
    const x = board.left - base.left + (((i % 8) + 0.85) / 8.7) * board.width,
      y =
        board.top -
        base.top +
        ((Math.floor(i / 8) + 0.85) / 8.7) * board.height;
    const tx = target.left - base.left + target.width / 2,
      ty = target.top - base.top + target.height / 2;
    const chip = document.createElement("div");
    chip.className = "bead-pickup";
    chip.innerHTML = `${bead(type)}<b>+${hits.length}</b>`;
    chip.style.left = `${x}px`;
    chip.style.top = `${y}px`;
    effects.append(chip);
    chip
      .animate(
        [
          { opacity: 0, transform: "translate(-50%,-50%) scale(.6)" },
          {
            opacity: 1,
            transform: "translate(-50%,-65%) scale(1.05)",
            offset: 0.16,
          },
          {
            opacity: 1,
            transform: `translate(calc(-50% + ${(tx - x) * 0.4}px),calc(-50% + ${(ty - y) * 0.25 - 25}px)) scale(.85)`,
            offset: 0.45,
          },
          {
            opacity: 0.1,
            transform: `translate(calc(-50% + ${tx - x}px),calc(-50% + ${ty - y}px)) scale(.25)`,
          },
        ],
        {
          duration: 460,
          delay: type * 12,
          easing: "cubic-bezier(.3,.02,.7,1)",
        },
      )
      .finished.then(() => {
        chip.remove();
        const counter = document.querySelectorAll(".collected-row>span")[type];
        counter?.animate(
          [
            { transform: "scale(1)" },
            { transform: "scale(1.18)", offset: 0.4 },
            { transform: "scale(1)" },
          ],
          { duration: 180 },
        );
      });
  }
}
function consumeQueuedInput() {
  const queued = queuedInput;
  queuedInput = null;
  if (!queued || modal || session.status !== "playing") return;
  if (queued.swap) swap(...queued.swap);
  else if (queued.tap !== undefined) boardClick(queued.tap);
}
async function resolveResult(result, pair = null) {
  if (!result.valid) {
    toast("工具已经用完啦。");
    return;
  }
  busy = true;
  selected = -1;
  hint = null;
  clearToast();
  $(".board-frame")?.classList.add("resolving");
  const note = $(".match-note");
  if (note) note.textContent = "每关赠送手作工具 · 灵感提示免费使用";
  if (pair) await renderer.animateSwap(...pair);
  updateMatchHUD(session.collected, result.session.moves);
  const frames = result.frames ?? [];
  const collected = [...session.collected];
  for (let chain = 0; chain < frames.length; chain++) {
    const f = frames[chain];
    beadSound("clear", chain);
    matchFeedback(f, chain);
    await renderer.animateClear(f.hit, chain);
    for (const i of f.hit) collected[f.before[i]]++;
    updateMatchHUD(collected, result.session.moves);
    await renderer.animateFall(f, chain);
    beadSound("land");
  }
  if (
    !frames.length ||
    renderer.boardPieces.some(
      (p, i) => p.userData.type !== result.session.board[i],
    )
  )
    await renderer.animateShuffle(result.session.board);
  session = result.session;
  renderer.setBoard(session.board);
  updateMatchHUD();
  $(".board-frame")?.classList.remove("resolving");
  if (session.status !== "playing") await renderer.animate(0.16, () => {});
  busy = false;
  if (session.status !== "playing") {
    queuedInput = null;
    if (session.status === "won") {
      const pack = session.collected.map((n, i) => (i === 0 ? 8 : 6) + n);
      open("result", { pack });
    } else open("result");
  } else consumeQueuedInput();
}
function claim() {
  if (modal?.type !== "result" || session?.status !== "won" || session.claimed)
    return;
  session.claimed = true;
  save.inventory = save.inventory.map((n, i) => n + modal.pack[i]);
  save.level++;
  persist();
  chime(1);
  go(returnScreen);
  toast("珠材已收好，来串一份心意吧。");
}
function action(a) {
  const [key, arg] = a.split(":");
  switch (key) {
    case "nav":
      go(arg);
      break;
    case "back":
      if (screen === "match") open("pause");
      else go("home");
      break;
    case "start":
      save.started = true;
      persist();
      go("home");
      if (!save.seenStories.includes(STORIES[0].id)) startStory(0);
      break;
    case "close":
      if (modal?.type === "result") {
        if (session?.status === "won") claim();
        else action("abandon");
        return;
      }
      if (modal?.type === "story") {
        action("story-close");
        return;
      }
      close();
      break;
    case "settings":
    case "help":
    case "inventory":
    case "energy":
    case "pause":
    case "reset":
      open(key);
      break;
    case "match-intro":
      open("intro");
      break;
    case "match-start":
      startMatch();
      break;
    case "abandon":
      session = null;
      go(returnScreen);
      break;
    case "claim":
      claim();
      break;
    case "accept": {
      const i = ORDERS.findIndex((o) => o.id === arg);
      if (i > save.completed.length || save.completed.includes(arg)) return;
      save.orderId = arg;
      persist();
      go("craft");
      break;
    }
    case "bead":
      placeBead(Number(arg));
      break;
    case "undo": {
      const prev = undo.pop();
      if (!prev) {
        toast("还没有可以撤销的操作。");
        break;
      }
      save.draft = prev.draft;
      save.charm = prev.charm;
      slot = -1;
      updateCraft();
      break;
    }
    case "erase":
      if (slot < 0) {
        toast("先点选一颗想取下的珠子。");
        break;
      }
      rememberDraft();
      save.draft[slot] = null;
      slot = -1;
      updateCraft();
      break;
    case "charm":
      rememberDraft();
      save.charm = arg;
      chime();
      updateCraft();
      break;
    case "sample":
      open("sample");
      break;
    case "sample-fill": {
      const counts = draftCounts(order().palette);
      if (counts.some((n, i) => n > save.inventory[i])) {
        toast("珠材还不够，先去采珠，再按参考排珠。");
        break;
      }
      rememberDraft();
      save.draft = [...order().palette];
      save.charm = order().charm;
      slot = -1;
      close();
      updateCraft();
      chime(1);
      break;
    }
    case "deliver": {
      const checks = checkOrder(save);
      if (!Object.values(checks).every(Boolean)) {
        toast(
          !checks.full
            ? "先串满 12 颗，再把心意交付。"
            : !checks.charm
              ? "换成客人想要的吊坠吧。"
              : "再看看上方的配色要求，还有珠子没有配齐。",
        );
        break;
      }
      open("delivery");
      break;
    }
    case "confirm-delivery": {
      const deliveredOrder = save.orderId;
      const next = deliver(save);
      if (!next) return;
      save = next;
      save.orderId =
        ORDERS.find((o) => !save.completed.includes(o.id))?.id ?? "promise";
      undo = [];
      persist();
      chime(1);
      screen = "home";
      modal = null;
      render();
      startStory(STORIES.findIndex((s) => s.afterOrder === deliveredOrder));
      break;
    }
    case "free-preview":
      if (save.draft.some((n) => n === null)) {
        toast("先串满 12 颗，看看完整的作品吧。");
        break;
      }
      open("free");
      break;
    case "tool":
      if (busy || session?.status !== "playing") return;
      if (arg === "hint") {
        hint = findMove(session.board);
        selected = -1;
        renderer.setBoard(session.board, -1, hint);
        toast("试着交换金色圆圈中的两颗珠子。");
      } else if (arg === "shuffle") {
        resolveResult(useTool(session, arg));
      } else if (session.tools[arg] > 0) {
        tool = tool === arg ? null : arg;
        updateMatchHUD();
      }
      break;
    case "buy": {
      const f = FURNITURE.find((x) => x.id === arg),
        next = purchase(save, arg, save.upgrades[arg] + 1);
      if (!next) {
        toast(
          `还差 ${f.prices[save.upgrades[arg] + 1] - save.coins} 金币，完成委托就能添置啦。`,
        );
        break;
      }
      save = next;
      persist();
      chime(1);
      render();
      toast("新家具已经摆好，手账里多了一段生活支线。");
      break;
    }
    case "collection":
      open("collection", { id: arg });
      break;
    case "story":
      startStory(Number(arg));
      break;
    case "evidence":
      if (storyEvidence(save).some((s) => s.id === arg)) open("evidence", { id: arg });
      break;
    case "story-play": {
      const video = modalRoot.querySelector("video"), active = modal;
      if (video) video.play().catch(() => {
        const status = $(".video-status");
        if (modal === active && status) status.textContent = "未能开始播放，可再次点击播放，或阅读文字剧情。";
      });
      break;
    }
    case "story-text":
      if (modal?.type !== "story") return;
      modal.mode = "text";
      storyLine = 0;
      renderModal();
      break;
    case "story-next":
      if (modal?.type !== "story" || modal.mode !== "text") return;
      if (storyLine < STORIES[storyIndex].lines.length - 1) {
        storyLine++;
        renderModal();
      } else action("story-finish");
      break;
    case "story-finish": {
      if (modal?.type !== "story" || !(modal.mode === "video-end" || (modal.mode === "text" && storyLine === STORIES[storyIndex].lines.length - 1))) return;
      const scene = STORIES[storyIndex];
      save = finishStory(save, scene.id);
      persist();
      close();
      render();
      if (scene.evidence) toast(`已收入手账：${scene.evidence.title}`);
      break;
    }
    case "story-close":
      close();
      break;
    case "sound":
      save.sound = !save.sound;
      persist();
      renderModal();
      if (save.sound) chime();
      break;
    case "motion":
      save.reduced = !save.reduced;
      renderer.motion = save.reduced ? 0 : 1;
      persist();
      renderModal();
      break;
    case "confirm-reset":
      save = freshSave();
      session = null;
      undo = [];
      persist();
      go("cover");
      break;
    case "export": {
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(save, null, 2)], { type: "application/json" }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = "珠光小店-进度.json";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast("进度已导出。");
      break;
    }
  }
}
document.addEventListener("click", (e) => {
  const target = e.target.closest("[data-action]");
  if (target && !target.disabled) action(target.dataset.action);
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    e.preventDefault();
    if (modal) {
      if (modal.type === "result") {
        if (session.status === "won") claim();
        else action("abandon");
      } else if (modal.type === "delivery") close();
      else action("close");
    } else if (screen !== "cover" && screen !== "home") action("back");
  }
  if (e.key.toLowerCase() === "f" && !modal) {
    if (!document.fullscreenElement)
      $("#app")
        .requestFullscreen?.()
        .catch(() => {});
    else document.exitFullscreen?.();
  }
  if (
    screen === "match" &&
    !modal &&
    !busy &&
    e.target.closest(".board-scene")
  ) {
    if (e.key.startsWith("Arrow")) {
      e.preventDefault();
      const next =
        (keyboardIndex +
          (e.key === "ArrowRight"
            ? 1
            : e.key === "ArrowLeft"
              ? -1
              : e.key === "ArrowDown"
                ? 8
                : -8) +
          64) %
        64;
      keyboardIndex = next;
      renderer.setBoard(session.board, selected, [next]);
    }
    if (e.code === "Space" || e.key === "Enter") {
      e.preventDefault();
      boardClick(keyboardIndex);
    }
  }
  if (modal && e.key === "Tab") {
    const buttons = [...modalRoot.querySelectorAll("button:not(:disabled)")];
    if (!buttons.length) return;
    const first = buttons[0],
      last = buttons.at(-1);
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }
});
let keyboardIndex = 0;
window.addEventListener("resize", () => requestAnimationFrame(mountScene));
view.addEventListener("scroll", mountScene, { passive: true });
new ResizeObserver(() => requestAnimationFrame(mountScene)).observe($("#app"));
window.render_game_to_text = () =>
  JSON.stringify({
    screen,
    modal: modal?.type ?? null,
    resources: {
      coins: save.coins,
      energy: save.energy,
      rep: save.rep,
      inventory: save.inventory,
    },
    order: order().id,
    requirements: checkOrder(save),
    draft: save.draft,
    charm: save.charm,
    completed: save.completed,
    story: modal?.type === "story" ? { id: STORIES[storyIndex].id, line: storyLine, mode: modal.mode } : null,
    seenStories: save.seenStories,
    evidence: storyEvidence(save).map((s) => s.id),
    upgrades: save.upgrades,
    level: save.level,
    selected,
    tool,
    busy,
    queuedInput,
    match: session
      ? {
          board: session.board,
          seed: session.seed,
          level: session.level,
          score: session.score,
          moves: session.moves,
          collected: session.collected,
          target: session.target,
          status: session.status,
          tools: session.tools,
          claimed: !!session.claimed,
          animation: renderer.boardState(),
        }
      : null,
    coordinates:
      "Board: rows top-to-bottom, columns left-to-right, index=row*8+column; bracelet slots clockwise from 12 o’clock.",
  });
window.advanceTime = (ms) => {
  renderer.tick(Math.max(0, Number(ms) || 0) / 1000);
  return window.render_game_to_text();
};
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    modalRoot.querySelector("video")?.pause();
    persist();
  }
  else {
    save = refreshEnergy(save);
    persist();
    if (screen === "home" && !modal) render();
  }
});
setInterval(() => {
  const refreshed = refreshEnergy(save);
  if (refreshed.energy !== save.energy) {
    save = refreshed;
    persist();
    const meter = document.querySelector(".resource.energy span");
    if (meter) meter.innerHTML = `${save.energy}<small>/10</small>`;
  }
}, 15000);
render();
