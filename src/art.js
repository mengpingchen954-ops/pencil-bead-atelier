import { BEADS } from "./content.js";
import { rng } from "./model.js";
export const artURL = (name) => `${import.meta.env.BASE_URL}art/${name}.jpg`;
const paths = {
  home: "M4 12 12 5l8 7M6 11v9h5v-6h3v6h4v-9",
  orders: "M7 5h10v16H5V5h2m2-2h6v4H9zm-1 8h8m-8 4h8",
  craft: "M4 18 16 6l3 3L7 21H4zm11-11 2-2 3 3-2 2M5 5l2 2m12 10 2 2",
  album: "M4 4h7c2 0 3 1 3 3v15c0-2-1-3-3-3H4zm16 0h-6M17 8h3m-3 4h3m-3 4h3",
  coin: "M20 12a8 8 0 1 1-16 0 8 8 0 0 1 16 0M12 6v12m3-9c-5-3-7 3-2 3s3 6-2 3",
  energy: "m13 2-8 12h6l-1 8 9-13h-6z",
  star: "m12 3 2.7 5.8 6.3.7-4.6 4.4 1.2 6.1-5.6-3-5.6 3 1.2-6.1L3 9.5l6.3-.7z",
  back: "m14 5-7 7 7 7M7 12h14",
  settings:
    "m9 3-1 3-3 1 1 3-2 2 2 2-1 3 3 1 1 3h5l1-3 3-1-1-3 2-2-2-2 1-3-3-1-1-3zm7 9a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
  close: "m6 6 12 12M18 6 6 18",
  check: "m5 12 4 5L20 6",
  arrow: "M5 12h14m-6-6 6 6-6 6",
  flower:
    "M12 9C5-2 0 11 9 12-2 20 14 25 12 15c9 10 15-6 3-3 11-8-3-15-3-3m2 3a2 2 0 1 1-4 0 2 2 0 0 1 4 0",
  hammer: "m4 20 9-11m-5-5 4-2 8 7-3 4-4-3-3 2-4-4z",
  shuffle:
    "M3 7h3c5 0 7 10 12 10h3m-4-4 4 4-4 4M3 17h3c2 0 3-2 4-4m4-3c1-2 2-3 4-3h3m-4-4 4 4-4 4",
  hint: "M8 16c0-3-3-4-3-7a7 7 0 0 1 14 0c0 3-3 4-3 7zm1 4h6m-6-2h6",
  pause: "M8 4v16M16 4v16",
  undo: "M4 10h10a6 6 0 0 1 0 12M4 10l5-5m-5 5 5 5",
  bin: "M4 6h16M9 3h6M6 6l1 15h10l1-15M10 9v8m4-8v8",
  eye: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12m13 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0",
  lock: "M6 10h12v11H6zm2 0V6a4 4 0 0 1 8 0v4m-4 4v3",
  bag: "M4 7h16l-1 14H5zm4 0V5a4 4 0 0 1 8 0v2",
  chair: "M6 3v10h12V3M6 9h12M4 13h16v4H4zm2 4-1 5m13-5 1 5",
  broom: "m16 3-6 10m-5 0 6-2 7 5-4 6-10-5zm3 1-3 4m6-2-3 4",
  paint: "M3 3h15v6H3zm15 3h3v7h-9v8H9v-9h9",
  floor: "m3 8 9-5 9 5-9 5zm0 0v9l9 5 9-5V8m-9 5v9M7 6l10 5M7 11v8m10-8v8",
  window: "M4 3h16v18H4zm8 0v18M4 12h16m-9-5-4 3m10 4-4 3",
  cabinet: "M5 3h14v18H5zm0 9h14M9 5v5m6-5v5m-6 5v3m6-3v3",
  desk: "M3 9h18v4H3zm2 4v9m14-9v9M5 16h5",
  book: "M5 3h14v18H5zm3 4h8m-8 4h8m-8 4h5",
  sound: "m3 9 5-1 5-5v18l-5-5-5-1zm14-3c5 3 5 9 0 12m-1-9c2 1 2 5 0 6",
  moon: "M18 4A9 9 0 1 0 21 17 9 9 0 0 1 18 4",
  heart: "M12 21C-7 8 7-2 12 7c5-9 19 1 0 14",
  gift: "M3 9h18v5H3zm2 5v8h14v-8M12 9v13M12 9C-2 7 9-5 12 9c14-2 3-14 0 0",
};
export function icon(name, cls = "") {
  return `<svg class="icon ${cls}" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round"><path d="${paths[name] || paths.flower}"/></svg>`;
}
export const flourish = `<svg viewBox="0 0 240 42" class="flourish" aria-hidden="true"><g fill="none" stroke="#b49668" stroke-width="1.2"><path d="M10 23h70c16 0 22-12 30-8s7 9 10 9 3-5 10-9 14 8 30 8h70M86 23c-18 8-30-2-23-7 8-4 17 12 25 11M154 23c18 8 30-2 23-7-8-4-17 12-25 11"/><path d="m120 6 4 6-4 6-4-6z" fill="#cbb38c"/></g></svg>`;
export const botanical = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 170 170"><g stroke="#a68d70" stroke-width="1.3"><path d="M8 160Q33 77 156 12M18 139Q64 150 73 114Q45 112 18 139M46 83Q34 45 63 32Q80 65 46 83M89 52Q103 16 135 25Q130 53 89 52" fill="#a8b493"/><g transform="translate(65 100)"><g fill="#faf2df"><ellipse cy="-17" rx="10" ry="19"/><ellipse cy="-17" rx="10" ry="19" transform="rotate(72)"/><ellipse cy="-17" rx="10" ry="19" transform="rotate(144)"/><ellipse cy="-17" rx="10" ry="19" transform="rotate(216)"/><ellipse cy="-17" rx="10" ry="19" transform="rotate(288)"/></g><circle r="9" fill="#d7b66c"/></g><g transform="translate(112 51) scale(.65)"><g fill="#dcb4aa"><ellipse cy="-17" rx="12" ry="19"/><ellipse cy="-17" rx="12" ry="19" transform="rotate(72)"/><ellipse cy="-17" rx="12" ry="19" transform="rotate(144)"/><ellipse cy="-17" rx="12" ry="19" transform="rotate(216)"/><ellipse cy="-17" rx="12" ry="19" transform="rotate(288)"/></g><circle r="7" fill="#d7b66c"/></g><path d="M3 160Q7 119 20 104Q9 154 45 162M9 151Q42 147 40 128Q22 124 9 151" fill="none" stroke="#c2a169" stroke-width="3"/></g></svg>`;
export function beadCanvas(type, size = 128) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d");
  ctx.scale(size / 128, size / 128);
  const b = BEADS[type],
    random = rng(43 + type);
  ctx.translate(64, 64);
  ctx.beginPath();
  if (b.shape === "circle") ctx.arc(0, 0, 45, 0, Math.PI * 2);
  if (b.shape === "heart") {
    ctx.moveTo(0, 43);
    ctx.bezierCurveTo(-79, -5, -30, -68, 0, -29);
    ctx.bezierCurveTo(30, -68, 79, -5, 0, 43);
  }
  if (b.shape === "diamond") {
    ctx.moveTo(0, -49);
    ctx.lineTo(43, -17);
    ctx.lineTo(27, 29);
    ctx.lineTo(0, 49);
    ctx.lineTo(-27, 29);
    ctx.lineTo(-43, -17);
    ctx.closePath();
  }
  if (b.shape === "leaf") {
    ctx.moveTo(36, -45);
    ctx.bezierCurveTo(-40, -47, -62, 9, -29, 36);
    ctx.bezierCurveTo(12, 65, 42, 6, 36, -45);
  }
  if (b.shape === "star") {
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? 24 : 48,
        a = (i * Math.PI) / 5 - Math.PI / 2;
      ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
  }
  if (b.shape === "flower") {
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3;
      ctx.moveTo(0, 0);
      ctx.ellipse(
        Math.sin(a) * 26,
        Math.cos(a) * 26,
        17,
        25,
        -a,
        0,
        Math.PI * 2,
      );
    }
  }
  const g = ctx.createRadialGradient(-18, -23, 2, 5, 12, 70);
  g.addColorStop(0, "#fff9ed");
  g.addColorStop(0.25, b.color);
  g.addColorStop(0.7, b.color);
  g.addColorStop(1, b.dark);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = b.dark;
  ctx.lineWidth = 2.3;
  ctx.stroke();
  ctx.save();
  ctx.clip();
  for (let i = 0; i < 1200; i++) {
    ctx.fillStyle =
      random() > 0.5 ? "rgba(85,65,42,.055)" : "rgba(255,249,230,.16)";
    ctx.fillRect(
      random() * 128 - 64,
      random() * 128 - 64,
      random() * 2 + 0.4,
      random() * 2 + 0.4,
    );
  }
  if (type === 0) {
    ctx.strokeStyle = "rgba(189,171,208,.26)";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(8, 4, 29, 0, 3);
    ctx.stroke();
    ctx.strokeStyle = "rgba(138,190,194,.23)";
    ctx.beginPath();
    ctx.arc(0, -5, 36, 0, 2.5);
    ctx.stroke();
  }
  if (type === 2) {
    ctx.strokeStyle = "rgba(255,255,255,.65)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-43, -17);
    ctx.lineTo(43, -17);
    ctx.moveTo(-43, -17);
    ctx.lineTo(0, 49);
    ctx.lineTo(43, -17);
    ctx.moveTo(0, -49);
    ctx.lineTo(-13, -17);
    ctx.lineTo(0, 49);
    ctx.lineTo(13, -17);
    ctx.lineTo(0, -49);
    ctx.stroke();
  }
  if (type === 3) {
    ctx.strokeStyle = "#6e8158";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(-30, 38);
    ctx.lineTo(33, -38);
    for (let i = 0; i < 4; i++) {
      ctx.moveTo(i * 12 - 20, 25 - i * 14);
      ctx.lineTo(i * 12 - 30, 7 - i * 14);
      ctx.moveTo(i * 12 - 16, 20 - i * 14);
      ctx.lineTo(i * 10 + 3, 23 - i * 13);
    }
    ctx.stroke();
  }
  if (type === 4) {
    ctx.fillStyle = "rgba(255,250,214,.35)";
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(
        Math.cos((i * 2 * Math.PI) / 5 - Math.PI / 2) * 48,
        Math.sin((i * 2 * Math.PI) / 5 - Math.PI / 2) * 48,
      );
      ctx.lineTo(
        Math.cos(((i * 2 + 1) * Math.PI) / 5 - Math.PI / 2) * 24,
        Math.sin(((i * 2 + 1) * Math.PI) / 5 - Math.PI / 2) * 24,
      );
      ctx.fill();
    }
  }
  ctx.restore();
  if (type === 5) {
    ctx.fillStyle = "#e3c583";
    ctx.strokeStyle = "#b59869";
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else {
    ctx.fillStyle = "rgba(255,255,250,.82)";
    ctx.beginPath();
    ctx.ellipse(-18, -23, 10, 6, -0.7, 0, Math.PI * 2);
    ctx.fill();
  }
  return c;
}
let beadImages;
export function beadImage(type) {
  if (!beadImages) beadImages = BEADS.map((_, i) => beadCanvas(i).toDataURL());
  return beadImages[type];
}
export function miniBracelet(beads, charm = "daisy") {
  return `<div class="mini-bracelet" aria-hidden="true"><div class="mini-wire"></div>${beads.map((t, i) => `<img class="mini-bead" src="${beadImage(t ?? 0)}" style="--a:${i * 30}deg;opacity:${t === null ? 0.2 : 1}" alt="">`).join("")}<span class="mini-charm">${icon(charm === "daisy" ? "flower" : charm)}</span></div>`;
}
