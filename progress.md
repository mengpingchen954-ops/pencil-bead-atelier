Original prompt: 根据 E:\Game\手串\铅笔2 美术制作手机游戏原型，Three.js 实现，浏览器预览测试并修复；优先 imagegen，美术不可用时继续用程序化几何、Canvas、SVG、CSS 与粒子完成统一视觉。

## Decisions
- Dedicated project and GitHub repository: pencil-bead-atelier. Existing games are preserved.
- Three.js is responsible for match-three board rendering/picking, animated pieces, 3D bracelet and effects. DOM handles accessible mobile menus.
- Use cropped user-provided pencil artwork with source manifest; original complete UI screenshots are not shipped as fake playable screens.
- image_gen is not exposed in this session. No imagegen API/CLI invoked; procedural art and supplied artwork are used as authorized.
- Prototype loop: match-three → materials → 12-bead custom order → delivery → coins/collection/story → shop furniture upgrades. Six orders, three story acts.
- GitHub Pages publication is authorized by the user's global instructions; no Netlify deployment.

## Progress
- Inspected 61 reference images and extracted nine production illustration/furniture assets.
- Completed playable cover, shop, 6 orders, Three.js craft bench, match-three, 3 furniture upgrade chains, 6-work album, story journal, dialogues, inventory, settings and local persistence.
- Seven model tests passed, including 100 seeded boards, cascades, finite tools, inventory conservation, duplicate delivery protection, purchase costs and malformed save bounds.
- Browser test completed all 6 orders through actual puzzles and crafting, real canvas raycasting/dragging, upgrades and reload persistence; checked 360, 390 and 1440 widths. No page/console errors or missing resources.
- Raised puzzle goal and reduced moves so loss is possible; tested real loss and retry without granting materials.
- Inspected actual cover, shop, board, craft, story and decor screenshots; fixed oversized floral decoration, missing mini-bracelet class and shared material cleanup.
- Published source: https://github.com/mengpingchen954-ops/pencil-bead-atelier
- GitHub Actions Pages deployment succeeded: run 41038098503 (runtime commit 112c021).
- Public game: https://mengpingchen954-ops.github.io/pencil-bead-atelier/
- Repeated the complete browser integration test against the public Pages URL in an unauthenticated context. All 6 deliveries, real touch/canvas picks, drag editing, purchases, story replay, reload persistence, loss/retry and zero-energy behavior passed; no console errors or HTTP failures.
- Ran the supplied web-game Playwright client (unchanged copy to resolve local dependencies); inspected actual Three.js screenshots and read-only state outputs.
- Public game is open in the in-app browser as a deliverable. Native iOS/Android packaging and physical-device Safari testing are outside this prototype.

## Match-three feel update
- Replaced board redraws with persistent pieces and a visual timeline: finger-follow preview, axis lock, eased swap/return, anticipation/pop, sparkle, real survivor/spawn gravity, landing squash and settle.
- Cascade frames now expose exact source/destination bead mappings; rules, random sequence, inventory and rewards are unchanged.
- Added pooled glints, tiny decaying board movement for larger matches, collection flights, combo labels, pitch-stepped clear sounds, live HUD updates, and one buffered board gesture. Existing reduced-motion/mute settings are honored.
- Added model coverage for gravity conservation across 100 seeds, and a touch/mouse browser test inspecting intermediate swap/fall positions, invalid return, cascades, queued tap, reduced motion and final board agreement with pure rules. All tests passed locally; full 6-order regression also passed with no console errors.
- Deployed runtime commit 6e3dfe5 successfully through Pages run 41040883348. The same feel test passed against the anonymous public URL, including 2 cascades, real touch-event axis lock, swap return, continuous gravity, input buffering, reduced motion and desktop mouse. Console errors: zero. Public test screenshots and video remain local in artifacts/.

## Family story and optional video update
- Added the requested childhood loss, grandmother upbringing, uncle/aunt inheritance abuse and continued family/business pressure to seven main scenes across three acts. The six-order prototype ends at early independence and preparation for professional consultation, not an instant inheritance victory.
- Connected every order to the heroine's current pressure, concrete crafting goal and consequence. Furniture upgrades unlock three optional life scenes. Six story records/memories can be collected by finishing their scenes and inspected in the journal.
- Added stable scene IDs, validated seen-state persistence, unread reminders, replay and legacy-save preservation. Partial closing stays unread. Replaying scenes never changes coins, inventory or delivery rewards.
- Added public/story-media.json and optional inline video with explicit playback, VTT captions, mute preference, end confirmation, text alternative, media-error fallback and background/close pause. No unfinished video URLs or generated test clips ship as story assets.
- Added docs/剧情与视频接入.md with the implemented scope, proposed eight-chapter expansion, first-session beats, scene/video map, production recommendations and exact replacement steps.
- Local verification: 12 unit tests, the complete 6-order browser loop, and dedicated story/video tests all passed. Dedicated tests used a real in-memory video and captions, plus blocked-playback and damaged-media cases; checked 360/390/1440 widths, no page/console errors or failed requests. Reviewed opening, journal and player screenshots. Physical-device Safari and future authored MP4/caption sync remain untested.
- Published runtime commit c081119 via successful Pages run 41043631349. Repeated both the complete six-order integration test and the story/video suite against the public repository-subpath URL in fresh anonymous browser contexts; all passed, zero console/page errors and failed requests. Source and documentation are in the existing game repository; no test videos were published.

## 2×2 four-bead square matching
- Added same-color 2×2 squares to the shared matching rule, alongside straight lines of three or more. Hint search, cascades and tools use that rule; new and shuffled boards avoid starting with pre-existing squares. Overlapping clears count each bead once.
- Updated board instructions, introduction, help and README. No special-piece or power-up mechanic added.
- Added corner/boundary, overlapping-match and square-only hint/move unit tests. Dedicated mobile browser test uses a deterministic normally generated board (seed 117), follows its square-only hinted swap through real touch input and checks settled board, inventory counts, one spent move and rendered piece types.
- Local 15 unit tests, production build, square touch test and existing feel tests passed; no console errors. Reviewed square clear screenshot.

## Craft bead launch and free groove placement
- Replaced sequential bead insertion with a center pop, curved outward rolling motion and gentle groove landing. Random empty-slot selection reserves the draft slot immediately, so concurrent launches cannot collide in one groove. Selected occupied beads can still be replaced; full drafts and insufficient stock are guarded.
- Kept persistent craft meshes during updates to preserve concurrent animations; added recessed groove textures, moving shadows, bead rotation, launch ripple, landing bounce and subtle sound. Reduced-motion mode places beads directly.
- Added finger-follow craft dragging, drop into any empty groove, occupied-groove swap, eased settling and cancelled-drag snapback. Editing preserves real inventory until delivery, supports undo and saves the draft before visual playback. Leaving the workshop/reloading restores the committed layout.
- Local validation: 16 unit tests, production build, six-order integration, match feel, four-square touch test and dedicated craft browser checks passed. Dedicated coverage includes center/intermediate/settled positions, concurrent launches, real touch drag, mouse swap, cancel, full/replacement, undo/reload, reduced motion, limited stock and keyboard launch. No console/page errors or failed requests. Reviewed motion and resting-layout screenshots; physical phone Safari remains untested.
- Published runtime commit e5baf9f via successful Pages run 41173572787. The full dedicated craft suite also passed against the public game in fresh anonymous browser contexts, including real touch drag, concurrent launches, limited stock, persistence and reduced motion; no errors or failed requests.

## Dilapidated shop, hands-on cleaning and earned renovation
- Added a shared room scene on home and renovation screens, beginning with cracked/peeling walls, broken boarded glass, damaged floorboards, old furnishings, boxes, papers and dirt. Procedural SVG and existing furniture art retain the warm paper palette.
- Added 11 saved cleaning spots: click/tap clutter, wipe glass and floor dirt continuously with a visible cloth, or activate each spot individually. Cleaning is free and never spends energy. New repairs and furniture require a clean shop; orders and crafting remain available throughout.
- Added one-time wall/floor/window repairs and retained all three furniture categories and both paid tiers. Purchases immediately update the room and reveal it with a brief highlight, respecting reduced motion. Initial coins plus six order rewards cover the complete room exactly. Existing saves preserve purchased furniture and money, and previously furnished legacy shops skip cleaning.
- Added validation/idempotence/budget unit coverage and a dedicated browser suite for real touch wipes, partial reload, insufficient coins, order-backed purchases, all six deliveries through complete renovation, shared home appearance, legacy saves and 360/390/1440 layouts. Reviewed before/after screenshots. Local 20 unit tests, production build, full six-order gameplay suite, renovation suite and story/video suite passed with no console/page errors or failed requests. Physical-device Safari remains untested.
- Published runtime commit 3c890f9 through successful Pages run 41174329261. Repeated the full renovation suite against the public repository-subpath URL in fresh anonymous browser contexts: touch wiping, six order deliveries funding the complete room, persistence, legacy progress and all three widths passed, with zero console/page errors or failed requests.
