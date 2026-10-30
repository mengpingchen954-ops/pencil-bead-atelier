import * as THREE from "three";
import { beadCanvas } from "./art.js";
import { BEADS } from "./content.js";
import { rng, adjacent } from "./model.js";
const smooth = (t) => t * t * (3 - 2 * t);
const cellPosition = (i) => ({ x: (i % 8) - 3.5, y: 3.5 - Math.floor(i / 8) });
const makeCanvas = (w, h, draw) => {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d"));
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
};
export class AtelierRenderer {
  constructor(host, handlers) {
    this.host = host;
    this.handlers = handlers;
    this.time = 0;
    this.motion = 1;
    this.mode = "none";
    this.hover = -1;
    this.selected = -1;
    this.meshes = [];
    this.particles = [];
    this.pulse = [];
    this.tweens = [];
    this.phase = "idle";
    this.boardPieces = [];
    this.boardCells = [];
    this.jolt = 0;
    this.effectPool = [];
    this.ray = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.root = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-4.4, 4.4, 4.4, -4.4, 0.1, 100);
    this.camera.position.z = 20;
    this.renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: "low-power",
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.autoClear = false;
    host.append(this.renderer.domElement);
    this.renderer.domElement.setAttribute("aria-label", "可触控的珠宝工作台");
    this.renderer.domElement.style.touchAction = "none";
    this.root.add(new THREE.AmbientLight(0xffffff, 2.5));
    const light = new THREE.DirectionalLight(0xfff6dd, 2.7);
    light.position.set(-3, 5, 12);
    this.root.add(light);
    this.group = new THREE.Group();
    this.root.add(this.group);
    this.textures = BEADS.map((_, i) => {
      const t = new THREE.CanvasTexture(beadCanvas(i, 256));
      t.colorSpace = THREE.SRGBColorSpace;
      return t;
    });
    this.spriteMaterials = this.textures.map(
      (map) =>
        new THREE.MeshBasicMaterial({
          map,
          transparent: true,
          depthWrite: false,
        }),
    );
    this.plane = new THREE.PlaneGeometry(1, 1);
    this.sparkTexture = makeCanvas(64, 64, (ctx) => {
      const glow = ctx.createRadialGradient(32, 32, 0, 32, 32, 30);
      glow.addColorStop(0, "#fffdf2");
      glow.addColorStop(0.17, "#fff5d4");
      glow.addColorStop(1, "#fff3cf00");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, 64, 64);
      ctx.fillStyle = "#fff8e5";
      ctx.beginPath();
      ctx.moveTo(32, 4);
      ctx.quadraticCurveTo(35, 28, 60, 32);
      ctx.quadraticCurveTo(35, 35, 32, 60);
      ctx.quadraticCurveTo(28, 35, 4, 32);
      ctx.quadraticCurveTo(28, 28, 32, 4);
      ctx.fill();
    });
    this.sphere = new THREE.SphereGeometry(1, 28, 20);
    this.beadMaps = BEADS.map((b, i) =>
      makeCanvas(256, 128, (ctx) => {
        ctx.fillStyle = b.color;
        ctx.fillRect(0, 0, 256, 128);
        const random = rng(150 + i);
        for (let n = 0; n < 10000; n++) {
          ctx.fillStyle =
            random() > 0.5 ? "rgba(255,248,230,.12)" : "rgba(98,70,60,.04)";
          ctx.fillRect(random() * 256, random() * 128, 1.5, 1.5);
        }
        for (let n = 0; n < 8; n++) {
          ctx.strokeStyle =
            i === 0 ? "rgba(200,172,200,.13)" : "rgba(255,245,228,.19)";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(0, n * 19);
          ctx.bezierCurveTo(60, n * 20 + 20, 190, n * 20 - 20, 256, n * 19);
          ctx.stroke();
        }
      }),
    );
    this.physical = this.beadMaps.map(
      (map, i) =>
        new THREE.MeshStandardMaterial({
          map,
          color: 0xffffff,
          roughness: 0.32,
          metalness: i === 4 ? 0.48 : 0.08,
        }),
    );
    this.gold = new THREE.MeshStandardMaterial({
      color: 0xc8a56c,
      metalness: 0.6,
      roughness: 0.38,
    });
    this.outline = new THREE.LineBasicMaterial({
      color: 0xb29a76,
      transparent: true,
      opacity: 0.7,
    });
    this.bind();
    let last = performance.now();
    this.renderer.setAnimationLoop((now) => {
      const dt = Math.min((now - last) / 1000, 0.04);
      last = now;
      this.tick(dt);
    });
    this.renderer.domElement.addEventListener("webglcontextlost", (e) => {
      e.preventDefault();
      this.handlers.context?.(false);
    });
    this.renderer.domElement.addEventListener("webglcontextrestored", () => {
      this.handlers.context?.(true);
      this.render();
    });
  }
  bind() {
    const c = this.renderer.domElement;
    c.addEventListener("pointerdown", (e) => {
      if (this.handlers.canInteract?.() === false) return;
      this.down = { x: e.clientX, y: e.clientY, index: this.pick(e) };
      c.setPointerCapture(e.pointerId);
      if (this.mode === "match" && this.phase === "idle") {
        this.pressed = this.down.index;
        this.handlers.press?.();
      }
    });
    c.addEventListener("pointermove", (e) => {
      this.hover = this.pick(e);
      if (this.down && this.mode === "craft") this.handlers.hover?.(this.hover);
      if (
        this.down &&
        this.mode === "match" &&
        this.phase === "idle" &&
        this.handlers.dragAllowed?.() !== false
      ) {
        const dx = e.clientX - this.down.x,
          dy = e.clientY - this.down.y;
        if (Math.hypot(dx, dy) > 5) {
          this.down.axis ??= Math.abs(dx) > Math.abs(dy) ? "x" : "y";
          const next = this.swipeNeighbor(
            this.down.index,
            dx,
            dy,
            this.down.axis,
          );
          this.previewDrag(this.down.index, next, dx, dy);
        }
      }
    });
    c.addEventListener("pointerup", (e) => {
      if (!this.down) return;
      const down = this.down;
      this.down = null;
      this.pressed = -1;
      const end = this.pick(e);
      if (down.index < 0) return;
      if (this.mode === "match") {
        if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 14) {
          const next = this.swipeNeighbor(
            down.index,
            e.clientX - down.x,
            e.clientY - down.y,
            down.axis,
          );
          if (!adjacent(down.index, next)) {
            this.resetDrag();
            return;
          }
          this.handlers.swipe?.(down.index, next);
        } else {
          this.resetDrag();
          this.handlers.board?.(down.index);
        }
      } else if (this.mode === "craft") {
        if (end >= 0 && end !== down.index)
          this.handlers.reorder?.(down.index, end);
        else this.handlers.slot?.(down.index);
      }
    });
    c.addEventListener("pointercancel", () => {
      this.down = null;
      this.pressed = -1;
      this.resetDrag();
    });
  }
  swipeNeighbor(index, dx, dy, axis) {
    return (
      index +
      ((axis ? axis === "x" : Math.abs(dx) > Math.abs(dy))
        ? dx > 0
          ? 1
          : -1
        : dy > 0
          ? 8
          : -8)
    );
  }
  previewDrag(a, b, dx, dy) {
    this.resetDrag();
    if (!adjacent(a, b)) return;
    const first = this.boardPieces[a],
      second = this.boardPieces[b];
    if (!first || !second) return;
    const start = cellPosition(a),
      end = cellPosition(b);
    const distance = Math.min(
      0.94,
      ((start.x !== end.x ? Math.abs(dx) : Math.abs(dy)) * 8.7) /
        this.host.clientWidth,
    );
    first.position.set(
      start.x + (end.x - start.x) * distance,
      start.y + (end.y - start.y) * distance,
      0.55,
    );
    second.position.set(
      end.x + (start.x - end.x) * distance,
      end.y + (start.y - end.y) * distance,
      0.3,
    );
    this.dragPreview = [a, b];
  }
  resetDrag() {
    for (const i of this.dragPreview ?? []) {
      const p = this.boardPieces[i];
      if (!p) continue;
      const at = cellPosition(i);
      p.position.set(at.x, at.y, 0.3);
    }
    this.dragPreview = null;
  }
  mount(anchor) {
    if (!anchor) {
      this.host.style.display = "none";
      this.mode = "none";
      return;
    }
    this.host.style.display = "block";
    const a = anchor.getBoundingClientRect(),
      r = this.host.parentElement.getBoundingClientRect();
    Object.assign(this.host.style, {
      left: `${a.left - r.left}px`,
      top: `${a.top - r.top}px`,
      width: `${a.width}px`,
      height: `${a.height}px`,
    });
    this.renderer.setSize(a.width, a.height, false);
    const aspect = a.width / a.height;
    if (this.mode === "match") {
      this.camera.left = -4.35;
      this.camera.right = 4.35;
      this.camera.top = 4.35 / aspect;
      this.camera.bottom = -4.35 / aspect;
    } else {
      this.camera.left = -4.5;
      this.camera.right = 4.5;
      this.camera.top = 4.5 / aspect;
      this.camera.bottom = -4.5 / aspect;
    }
    this.camera.updateProjectionMatrix();
    this.render();
  }
  clear() {
    for (const tween of this.tweens ?? []) tween.finish();
    this.tweens = [];
    this.phase = "idle";
    this.jolt = 0;
    this.group.position.set(0, 0, 0);
    this.boardPieces = [];
    this.boardCells = [];
    this.dragPreview = null;
    this.pressed = -1;
    for (const p of this.particles) {
      this.group.remove(p);
      this.effectPool.push(p);
    }
    if (this.boardMaterial) {
      this.boardMaterial.map.dispose();
      this.boardMaterial.dispose();
      this.boardMaterial = null;
    }
    for (const obj of [...this.group.children]) {
      this.group.remove(obj);
      obj.traverse((o) => {
        if (o.userData.transient) {
          if (o.geometry !== this.plane && o.geometry !== this.sphere)
            o.geometry?.dispose();
          if (o.material !== this.gold) {
            if (o.material?.map?.userData.transient) o.material.map.dispose();
            o.material?.dispose();
          }
        }
      });
    }
    this.meshes = [];
    this.particles = [];
    this.pulse = [];
  }
  sprite(type, x, y, size = 1) {
    const m = new THREE.Mesh(this.plane, this.spriteMaterials[type]);
    m.position.set(x, y, 0.3);
    m.scale.setScalar(size);
    return m;
  }
  setBoard(board, selected = -1, hint = null) {
    if (
      this.mode === "match" &&
      this.boardPieces.length === 64 &&
      this.boardPieces.every(Boolean)
    ) {
      this.boardPieces.forEach((piece, i) => {
        piece.material.map = this.textures[board[i]];
        piece.material.color.set(0xffffff);
        piece.material.opacity = 1;
        piece.userData.type = board[i];
        piece.userData.index = i;
        const at = cellPosition(i);
        piece.position.set(at.x, at.y, 0.3);
        piece.scale.setScalar(0.87);
        piece.rotation.z = 0;
      });
      this.phase = "idle";
      this.updateSelection(selected, hint);
      this.render();
      return;
    }
    this.clear();
    this.mode = "match";
    const tile = makeCanvas(96, 96, (ctx) => {
      ctx.fillStyle = "#f3e8d4";
      ctx.fillRect(0, 0, 96, 96);
      ctx.strokeStyle = "#c9b391";
      ctx.lineWidth = 2;
      ctx.strokeRect(2, 2, 92, 92);
      ctx.fillStyle = "rgba(255,255,255,.3)";
      ctx.fillRect(4, 4, 88, 2);
    });
    tile.userData.transient = true;
    const mat = new THREE.MeshBasicMaterial({ map: tile });
    for (let i = 0; i < 64; i++) {
      const x = (i % 8) - 3.5,
        y = 3.5 - Math.floor(i / 8);
      const cell = new THREE.Mesh(this.plane, mat);
      cell.position.set(x, y, 0);
      cell.scale.setScalar(0.99);
      cell.userData = { index: i };
      this.group.add(cell);
      this.boardCells.push(cell);
      this.boardPieces[i] = this.makeBoardPiece(board[i], i);
    }
    this.boardMaterial = mat;
    this.updateSelection(selected, hint);
    this.render();
  }
  makeBoardPiece(type, index) {
    const at = cellPosition(index);
    const gem = new THREE.Mesh(this.plane, this.spriteMaterials[type].clone());
    gem.position.set(at.x, at.y, 0.3);
    gem.scale.setScalar(0.87);
    gem.userData = { index, type, transient: true };
    this.group.add(gem);
    return gem;
  }
  removePiece(piece) {
    this.group.remove(piece);
    piece.material.dispose();
  }
  updateSelection(selected = -1, hint = null) {
    this.selected = selected;
    for (const ring of this.pulse) {
      this.group.remove(ring);
      ring.geometry.dispose();
      ring.material.dispose();
    }
    this.pulse = [];
    for (let i = 0; i < 64; i++)
      if (selected === i || hint?.includes(i)) {
        const { x, y } = cellPosition(i);
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(0.41, 0.47, 40),
          new THREE.MeshBasicMaterial({
            color: selected === i ? 0x667d54 : 0xc2a269,
            transparent: true,
            opacity: 0.9,
          }),
        );
        ring.position.set(x, y, 0.6);
        ring.userData.transient = true;
        this.group.add(ring);
        this.pulse.push(ring);
      }
  }
  animate(duration, update) {
    return new Promise((finish) => {
      const tween = {
        elapsed: 0,
        duration: this.motion ? duration : 0.025,
        update,
        finish,
      };
      update(0);
      this.tweens.push(tween);
    });
  }
  async animateSwap(a, b, returning = false) {
    if (!adjacent(a, b)) return;
    this.phase = returning ? "return" : "swap";
    this.updateSelection();
    const first = this.boardPieces[a],
      second = this.boardPieces[b];
    const startA = first.position.clone(),
      startB = second.position.clone();
    const endA = cellPosition(b),
      endB = cellPosition(a);
    this.dragPreview = null;
    await this.animate(returning ? 0.17 : 0.15, (t) => {
      const k = smooth(t),
        pop = this.motion ? Math.sin(t * Math.PI) * 0.09 : 0;
      first.position.set(
        THREE.MathUtils.lerp(startA.x, endA.x, k),
        THREE.MathUtils.lerp(startA.y, endA.y, k),
        0.5,
      );
      second.position.set(
        THREE.MathUtils.lerp(startB.x, endB.x, k),
        THREE.MathUtils.lerp(startB.y, endB.y, k),
        0.35,
      );
      first.scale.set(0.87 * (1 + pop), 0.87 * (1 - pop * 0.5), 1);
      second.scale.set(0.87 * (1 + pop), 0.87 * (1 - pop * 0.5), 1);
    });
    [this.boardPieces[a], this.boardPieces[b]] = [second, first];
    second.userData.index = a;
    first.userData.index = b;
    for (const piece of [first, second]) {
      piece.scale.setScalar(0.87);
      piece.position.z = 0.3;
    }
    this.phase = "idle";
  }
  async animateClear(hit, chain = 0) {
    this.phase = "clear";
    this.updateSelection();
    const pieces = hit.map((i) => this.boardPieces[i]).filter(Boolean);
    if (this.motion) {
      this.burst(hit, chain);
      if (chain > 0 || hit.length >= 6)
        this.jolt = Math.min(0.055, 0.018 + chain * 0.012);
    }
    await this.animate(0.2 * Math.max(0.65, 1 - chain * 0.07), (t) => {
      const anticipation =
        t < 0.3
          ? 1 + Math.sin(((t / 0.3) * Math.PI) / 2) * 0.2
          : 1.2 * (1 - ((t - 0.3) / 0.7) ** 2);
      for (const piece of pieces) {
        piece.scale.setScalar(
          0.87 * Math.max(0.01, this.motion ? anticipation : 1),
        );
        piece.material.opacity = 1 - t * t;
        if (this.motion)
          piece.material.color.setRGB(1, 1 - t * 0.1, 1 - t * 0.23);
      }
    });
    for (const i of hit) {
      const piece = this.boardPieces[i];
      if (piece) this.removePiece(piece);
      this.boardPieces[i] = null;
    }
  }
  async animateFall(frame, chain = 0) {
    this.phase = "fall";
    const previous = this.boardPieces,
      next = Array(64),
      drops = [];
    for (const fall of frame.falls) {
      const piece =
        fall.from === null
          ? this.makeBoardPiece(fall.type, fall.to)
          : previous[fall.from];
      const at = cellPosition(fall.to),
        fromY = 3.5 - fall.fromRow,
        distance = fromY - at.y;
      piece.userData.index = fall.to;
      piece.userData.type = fall.type;
      piece.position.set(at.x, fromY, 0.3);
      piece.material.opacity = 1;
      piece.material.color.set(0xffffff);
      next[fall.to] = piece;
      drops.push({
        piece,
        at,
        fromY,
        distance,
        delay: (fall.to % 8) * 0.008,
        duration: 0.16 + Math.sqrt(distance) * 0.065,
      });
    }
    this.boardPieces = next;
    const speed = Math.max(0.65, 1 - chain * 0.07),
      duration = Math.max(...drops.map((d) => d.delay + d.duration)) + 0.075;
    await this.animate(duration * speed, (t) => {
      for (const d of drops) {
        const p = Math.max(
          0,
          Math.min(1, (t * duration - d.delay) / d.duration),
        );
        d.piece.position.y = this.motion
          ? d.fromY - d.distance * p * p
          : d.at.y;
        const landing = Math.max(
          0,
          Math.min(1, (t * duration - d.delay - d.duration) / 0.075),
        );
        const squash =
          this.motion && d.distance > 0
            ? Math.sin(landing * Math.PI) * 0.13
            : 0;
        d.piece.scale.set(0.87 * (1 + squash), 0.87 * (1 - squash), 1);
      }
    });
    for (const { piece, at } of drops) {
      piece.position.set(at.x, at.y, 0.3);
      piece.scale.setScalar(0.87);
    }
    this.phase = "idle";
  }
  async animateShuffle(board) {
    this.phase = "shuffle";
    this.updateSelection();
    await this.animate(0.14, (t) =>
      this.boardPieces.forEach((p) => {
        p.scale.setScalar(0.87 * (1 - t * 0.7));
        p.material.opacity = 1 - t;
      }),
    );
    this.boardPieces.forEach((p, i) => {
      p.material.map = this.textures[board[i]];
      p.userData.type = board[i];
    });
    await this.animate(0.2, (t) =>
      this.boardPieces.forEach((p) => {
        const k = 1 - (1 - t) ** 3;
        p.scale.setScalar(0.87 * (0.3 + k * 0.7));
        p.material.opacity = t;
      }),
    );
    this.phase = "idle";
  }
  boardState() {
    return {
      phase: this.phase,
      activeTweens: this.tweens.length,
      pieces:
        this.mode === "match"
          ? this.boardPieces.map((p, i) =>
              p
                ? {
                    index: i,
                    type: p.userData.type,
                    x: +p.position.x.toFixed(3),
                    y: +p.position.y.toFixed(3),
                    scale: +p.scale.x.toFixed(3),
                    opacity: +p.material.opacity.toFixed(3),
                  }
                : null,
            )
          : [],
    };
  }
  setBracelet(beads, charm = "daisy", selected = -1) {
    this.clear();
    this.mode = "craft";
    const mattex = makeCanvas(512, 512, (ctx) => {
      ctx.fillStyle = "#f8efde";
      ctx.fillRect(0, 0, 512, 512);
      const r = rng(29);
      for (let i = 0; i < 18000; i++) {
        ctx.fillStyle =
          r() > 0.5 ? "rgba(174,144,105,.05)" : "rgba(255,255,255,.3)";
        ctx.fillRect(r() * 512, r() * 512, 1, 1);
      }
      ctx.strokeStyle = "#cfbb93";
      ctx.lineWidth = 2;
      ctx.strokeRect(18, 18, 476, 476);
      ctx.strokeStyle = "#ddd0b4";
      ctx.lineWidth = 1;
      ctx.strokeRect(24, 24, 464, 464);
    });
    mattex.userData.transient = true;
    const pad = new THREE.Mesh(
      new THREE.PlaneGeometry(8.2, 6.5),
      new THREE.MeshBasicMaterial({ map: mattex }),
    );
    pad.position.z = -0.4;
    pad.userData.transient = true;
    this.group.add(pad);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(2.28, 0.019, 8, 100),
      this.gold,
    );
    ring.scale.y = 0.94;
    ring.position.z = 0;
    ring.userData.transient = true;
    this.group.add(ring);
    for (let i = 0; i < 12; i++) {
      const a = Math.PI / 2 - (i / 12) * Math.PI * 2;
      const x = Math.cos(a) * 2.28,
        y = Math.sin(a) * 2.14;
      const hit = new THREE.Mesh(
        new THREE.CircleGeometry(0.48, 24),
        new THREE.MeshBasicMaterial({
          color: 0xd8c7a9,
          transparent: true,
          opacity: beads[i] === null ? 0.2 : 0,
        }),
      );
      hit.position.set(x, y, 0.03);
      hit.userData = { index: i, transient: true };
      this.group.add(hit);
      this.meshes.push(hit);
      const type = beads[i];
      if (type !== null && type !== undefined) {
        const gem = new THREE.Mesh(this.sphere, this.physical[type]);
        gem.scale.set(0.42, 0.42, 0.35);
        gem.position.set(x, y, 0.32);
        gem.rotation.y = i * 0.7;
        gem.userData = { index: i };
        this.group.add(gem);
        this.meshes.push(gem);
        const shine = new THREE.Mesh(
          new THREE.CircleGeometry(0.078, 20),
          new THREE.MeshBasicMaterial({
            color: 0xfffcf4,
            transparent: true,
            opacity: 0.72,
          }),
        );
        shine.position.set(x - 0.14, y + 0.16, 0.66);
        shine.scale.y = 0.65;
        shine.userData.transient = true;
        this.group.add(shine);
      }
      if (i === selected) {
        const selector = new THREE.Mesh(
          new THREE.RingGeometry(0.47, 0.51, 32),
          new THREE.MeshBasicMaterial({ color: 0x6c8059 }),
        );
        selector.position.set(x, y, 0.8);
        selector.userData.transient = true;
        this.group.add(selector);
      }
      const spacer = new THREE.Mesh(
        new THREE.SphereGeometry(0.065, 12, 8),
        this.gold,
      );
      spacer.position.set(
        Math.cos(a + Math.PI / 12) * 2.28,
        Math.sin(a + Math.PI / 12) * 2.14,
        0.15,
      );
      spacer.userData.transient = true;
      this.group.add(spacer);
    }
    const texture = makeCanvas(128, 128, (ctx) => {
      ctx.translate(64, 64);
      ctx.lineWidth = 3;
      ctx.strokeStyle = "#af8b54";
      ctx.fillStyle = charm === "heart" ? "#d7a09e" : "#f4dfab";
      if (charm === "daisy") {
        for (let i = 0; i < 6; i++) {
          ctx.save();
          ctx.rotate((i * Math.PI) / 3);
          ctx.beginPath();
          ctx.ellipse(0, -22, 12, 23, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.restore();
        }
        ctx.fillStyle = "#d6b463";
        ctx.beginPath();
        ctx.arc(0, 0, 12, 0, 7);
        ctx.fill();
        ctx.stroke();
      } else if (charm === "heart") {
        ctx.beginPath();
        ctx.moveTo(0, 44);
        ctx.bezierCurveTo(-80, -5, -30, -65, 0, -25);
        ctx.bezierCurveTo(30, -65, 80, -5, 0, 44);
        ctx.fill();
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, 43, 0.6, 5.8);
        ctx.quadraticCurveTo(-12, 0, 35, 24);
        ctx.fill();
        ctx.stroke();
      }
    });
    texture.userData.transient = true;
    const pendant = new THREE.Mesh(
      this.plane,
      new THREE.MeshBasicMaterial({ map: texture, transparent: true }),
    );
    pendant.position.set(0, -2.68, 0.7);
    pendant.scale.setScalar(0.88);
    pendant.userData.transient = true;
    this.group.add(pendant);
    this.render();
  }
  pick(event) {
    const targets = this.mode === "match" ? this.boardCells : this.meshes;
    if (!targets.length) return -1;
    const r = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(
      ((event.clientX - r.left) / r.width) * 2 - 1,
      (-(event.clientY - r.top) / r.height) * 2 + 1,
    );
    this.ray.setFromCamera(this.pointer, this.camera);
    const hits = this.ray.intersectObjects(targets, false);
    return hits[0]?.object.userData.index ?? -1;
  }
  burst(indices, chain = 0) {
    if (!this.motion) return;
    for (const i of indices.slice(0, 24)) {
      const x = (i % 8) - 3.5,
        y = 3.5 - Math.floor(i / 8);
      for (let n = 0; n < 5; n++) {
        if (this.particles.length >= 180) break;
        const p =
          this.effectPool.pop() ??
          new THREE.Mesh(
            this.plane,
            new THREE.MeshBasicMaterial({
              map: this.sparkTexture,
              transparent: true,
              depthWrite: false,
            }),
          );
        p.material.color.set(
          n % 2
            ? BEADS[this.boardPieces[i]?.userData.type ?? 4].color
            : "#e8c77b",
        );
        p.material.opacity = 1;
        p.position.set(x, y, 0.9);
        p.rotation.z = Math.random() * Math.PI;
        const life = 0.38 + Math.random() * 0.18;
        p.userData = {
          vx: (Math.random() - 0.5) * (2.8 + chain * 0.18),
          vy: 0.6 + Math.random() * 2.2,
          life,
          initialLife: life,
          size: 0.12 + Math.random() * 0.15,
          spin: (Math.random() - 0.5) * 4,
        };
        p.scale.setScalar(p.userData.size);
        this.group.add(p);
        this.particles.push(p);
      }
    }
  }
  tick(dt) {
    this.time += dt;
    if (this.mode === "none") return;
    for (const tween of [...this.tweens]) {
      tween.elapsed += dt;
      const t = Math.min(1, tween.elapsed / tween.duration);
      tween.update(t);
      if (t >= 1) {
        this.tweens.splice(this.tweens.indexOf(tween), 1);
        tween.finish();
      }
    }
    this.jolt = Math.max(0, this.jolt - dt * 0.24);
    this.group.position.set(
      Math.sin(this.time * 57) * this.jolt * this.motion,
      Math.cos(this.time * 43) * this.jolt * 0.5 * this.motion,
      0,
    );
    if (this.mode === "match" && this.phase === "idle")
      for (let i = 0; i < this.boardPieces.length; i++) {
        const p = this.boardPieces[i];
        if (!p) continue;
        const target =
          0.87 * (i === this.pressed ? 1.12 : i === this.selected ? 1.05 : 1);
        p.scale.x = THREE.MathUtils.lerp(
          p.scale.x,
          target,
          Math.min(1, dt * 24),
        );
        p.scale.y = p.scale.x;
      }
    for (const p of [...this.particles]) {
      p.userData.life -= dt;
      p.position.x += p.userData.vx * dt * this.motion;
      p.position.y += p.userData.vy * dt * this.motion;
      p.userData.vy -= dt * 4.2;
      p.rotation.z += p.userData.spin * dt;
      p.material.opacity = Math.max(
        0,
        p.userData.life / p.userData.initialLife,
      );
      p.scale.setScalar(p.userData.size * (0.4 + 0.6 * p.material.opacity));
      if (p.userData.life <= 0) {
        this.group.remove(p);
        this.effectPool.push(p);
        this.particles.splice(this.particles.indexOf(p), 1);
      }
    }
    for (const p of this.pulse)
      p.scale.setScalar(1 + Math.sin(this.time * 4) * 0.04 * this.motion);
    this.render();
  }
  render() {
    if (this.mode === "none") return;
    this.renderer.setScissorTest(false);
    this.renderer.clear();
    if (this.mode === "match") {
      const size = this.renderer.getSize(
        (this.renderSize ??= new THREE.Vector2()),
      );
      const mx = (0.35 / 8.7) * size.x,
        my =
          ((this.camera.top - 4) / (this.camera.top - this.camera.bottom)) *
          size.y;
      this.renderer.setScissor(mx, my, size.x - 2 * mx, size.y - 2 * my);
      this.renderer.setScissorTest(true);
    }
    this.renderer.render(this.root, this.camera);
  }
}
