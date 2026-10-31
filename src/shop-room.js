import { CLEAN_SPOTS, FURNITURE } from "./content.js";
import { shopProgress } from "./model.js";

const clutterArt = (paper) => paper
  ? '<svg viewBox="0 0 90 65"><g stroke="#98866b" fill="#e3d6bb" stroke-width="1.5"><path d="m12 32 40-18 25 26-42 18z"/><path d="m19 15 43-5 8 35-43 7z"/><path d="m29 23 23-3m-22 9 28-4m-26 10 22-3" fill="none"/></g></svg>'
  : '<svg viewBox="0 0 90 70"><g stroke="#8c7458" stroke-width="1.6" stroke-linejoin="round"><path fill="#b89c72" d="m13 26 34-9 30 10v30l-31 10-33-12z"/><path fill="#d1b68c" d="m13 26-8-13 32-9 10 13 8-12 29 10-7 12-31 10z"/><path d="M46 37v30m-8-25-14-5m-1 7 11 4" fill="none"/><path fill="#d9c4a1" d="m55 43 15-5v12l-15 5z"/></g></svg>';

export function shopRoom(save, furnitureArt, interactive = false) {
  const { repairs } = save.renovation, progress = shopProgress(save);
  return `<div class="shop-room ${interactive ? "decor-room" : "home-room"} ${repairs.wall ? "room-wall-new" : "room-wall-old"} ${repairs.floor ? "room-floor-new" : "room-floor-old"} ${repairs.window ? "room-window-new" : "room-window-old"}" aria-label="${progress.stage}" ${interactive && progress.cleaned < CLEAN_SPOTS.length ? 'data-clean-room="true"' : ""}>
    <svg class="room-backdrop" viewBox="0 0 640 440" preserveAspectRatio="none" aria-hidden="true">
      <defs><pattern id="${interactive ? "decor" : "home"}-paper" width="8" height="7" patternUnits="userSpaceOnUse"><path d="M1 1h2m2 3h1m-5 2h1" stroke="#8a7656" opacity=".08"/></pattern></defs>
      <path class="room-wall" d="M0 0h640v310H0z"/><path class="room-side" d="M0 0 45 25v268L0 330zm640 0-45 25v268l45 37"/>
      <path class="room-floor" d="M0 310h640v130H0z"/><g class="room-floor-lines" fill="none" stroke-width="1.5"><path d="M0 337h640M0 373h640M0 417h640M96 310 55 440m140-130-19 130m131-130v130m110-130 20 130m90-130 43 130"/></g>
      <path d="M0 307h640" stroke="#b6a17d" stroke-width="7"/>
      <g class="room-peeling" fill="#c6b79b" stroke="#a79980" stroke-width="1.5"><path d="m50 95 55-10-7 43-25 22-24-11z"/><path d="m105 85-7 43-21-11z" fill="#e3d6bb"/><path d="m520 216 42-21 21 14-9 59-49-9z"/><path d="m562 195 12 38-24 4z" fill="#e3d6bb"/></g>
      <g class="room-cracks" fill="none" stroke="#8b7b63" stroke-width="2.3"><path d="m135 32-16 49 18 16-13 33 26 26m-31-75-22 9m40 7 21-11M488 58l18 36-17 27 20 25-12 30m9-82 19-3m-36 30-17-2"/></g>
      <g transform="translate(244 40)"><path d="M0 149V61a76 61 0 0 1 152 0v88z" fill="#d4d9ce" stroke="#a99778" stroke-width="9"/><path d="M76 0v149M0 77h152" stroke="#b1a080" stroke-width="5"/>
        <g class="room-window-damage" fill="none" stroke="#8d8e7d" stroke-width="2"><path d="m23 24 17 26-11 16 20 20-12 19m81-82-12 30 16 17-8 20"/><path d="m13 112 125-26" stroke="#a18a69" stroke-width="14"/><path d="m13 112 125-26" stroke="#c2ab83" stroke-width="10"/></g>
        <path class="room-sunbeam" fill="#fff8d4" opacity=".22" d="m4 70 126-29 44 269H-85z"/>
        <g class="room-curtains" fill="#a3b49c" stroke="#7e9378" stroke-width="1.7"><path d="M-13-8h45l-9 48-18 42-15-9zM165-8h-45l9 48 18 42 15-9z"/><path d="m-4 1 5 58m21-57L10 59m145-58-5 58m-20-57 11 57" fill="none"/></g>
      </g>
      <g class="room-broken-floor" fill="#ac9573" stroke="#8e795b"><path d="m79 363 62-13 12 11-53 18z"/><path d="m435 395 87-11-5 17-80 10z"/></g>
      <g class="room-details" stroke="#9b896b" stroke-width="2"><path d="M64 185h95v7H64z" fill="#cbb28d"/><path d="M79 183v-33m0 11-13-12m13 7 12-17" fill="none" stroke="#85966d"/><path d="M68 169h23l-4 16H72z" fill="#d4b69d"/><path d="M540 155v-26m0 5-12-10m12 15 13-13" fill="none" stroke="#85966d"/><path d="M528 145h24l-5 16h-14z" fill="#d3ba92"/><path d="M519 162h45v6h-45z" fill="#cbb28d"/></g>
      <path d="M0 0h640v440H0z" fill="url(#${interactive ? "decor" : "home"}-paper)"/>
    </svg>
    <div class="room-furniture">${FURNITURE.map((f) => `<div class="room-piece room-piece-${f.id} tier-${save.upgrades[f.id]}" data-room-furniture="${f.id}">${furnitureArt(f)}</div>`).join("")}</div>
    ${CLEAN_SPOTS.filter((spot) => !save.renovation.cleared.includes(spot.id)).map((spot) => {
      const visual = spot.kind === "clutter" ? clutterArt(spot.id === "papers") : `<svg viewBox="0 0 90 65" aria-hidden="true"><g fill="${spot.kind === "dust" ? "#94846b" : "#827e69"}" opacity=".65"><ellipse cx="45" cy="35" rx="31" ry="${spot.kind === "dust" ? 10 : 21}"/><ellipse cx="27" cy="29" rx="18" ry="10"/><ellipse cx="61" cy="29" rx="15" ry="13"/><circle cx="17" cy="44" r="3"/><circle cx="75" cy="44" r="2"/></g></svg>`;
      const attrs = `class="clean-spot spot-${spot.kind}" style="left:${spot.x}%;top:${spot.y}%"`;
      return interactive ? `<button ${attrs} data-action="clean:${spot.id}" data-clean="${spot.id}" aria-label="${spot.name}">${visual}<span>✦</span></button>` : `<div ${attrs}>${visual}</div>`;
    }).join("")}
    ${interactive ? '<div class="clean-tool" aria-hidden="true">✦</div>' : ""}
    <div class="room-caption">${progress.stage}</div>
  </div>`;
}
