import * as THREE from "three";
import { beadCanvas } from "./art.js";
import { BEADS } from "./content.js";
import { rng } from "./model.js";
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
      this.down = { x: e.clientX, y: e.clientY, index: this.pick(e) };
      c.setPointerCapture(e.pointerId);
    });
    c.addEventListener("pointermove", (e) => {
      this.hover = this.pick(e);
      if (this.down && this.mode === "craft") this.handlers.hover?.(this.hover);
    });
    c.addEventListener("pointerup", (e) => {
      if (!this.down) return;
      const down = this.down;
      this.down = null;
      const end = this.pick(e);
      if (down.index < 0) return;
      if (this.mode === "match") {
        if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 14) {
          let next = end;
          if (next === down.index || next < 0) {
            const dx = e.clientX - down.x,
              dy = e.clientY - down.y;
            next =
              down.index +
              (Math.abs(dx) > Math.abs(dy)
                ? dx > 0
                  ? 1
                  : -1
                : dy > 0
                  ? 8
                  : -8);
          }
          this.handlers.swipe?.(down.index, next);
        } else this.handlers.board?.(down.index);
      } else if (this.mode === "craft") {
        if (end >= 0 && end !== down.index)
          this.handlers.reorder?.(down.index, end);
        else this.handlers.slot?.(down.index);
      }
    });
    c.addEventListener("pointercancel", () => {
      this.down = null;
    });
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
    this.clear();
    this.mode = "match";
    this.selected = selected;
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
      this.meshes.push(cell);
      const gem = this.sprite(board[i], x, y, 0.87);
      gem.userData.index = i;
      this.group.add(gem);
      this.meshes.push(gem);
      if (selected === i || hint?.includes(i)) {
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
    this.boardMaterial = mat;
    this.render();
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
    if (!this.meshes.length) return -1;
    const r = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(
      ((event.clientX - r.left) / r.width) * 2 - 1,
      (-(event.clientY - r.top) / r.height) * 2 + 1,
    );
    this.ray.setFromCamera(this.pointer, this.camera);
    const hits = this.ray.intersectObjects(this.meshes, false);
    return hits[0]?.object.userData.index ?? -1;
  }
  burst(indices) {
    for (const i of indices.slice(0, 32)) {
      const x = (i % 8) - 3.5,
        y = 3.5 - Math.floor(i / 8);
      for (let n = 0; n < 4; n++) {
        const p = new THREE.Mesh(
          new THREE.CircleGeometry(0.035, 6),
          new THREE.MeshBasicMaterial({
            color: n % 2 ? 0xd5b779 : 0xe3bfbb,
            transparent: true,
            opacity: 1,
          }),
        );
        p.position.set(x, y, 0.9);
        p.userData = {
          vx: (Math.random() - 0.5) * 2,
          vy: Math.random() * 2,
          life: 0.65,
          transient: true,
        };
        this.group.add(p);
        this.particles.push(p);
      }
    }
  }
  tick(dt) {
    this.time += dt;
    if (this.mode === "none") return;
    for (const p of [...this.particles]) {
      p.userData.life -= dt;
      p.position.x += p.userData.vx * dt * this.motion;
      p.position.y += p.userData.vy * dt * this.motion;
      p.material.opacity = Math.max(0, p.userData.life / 0.65);
      if (p.userData.life <= 0) {
        this.group.remove(p);
        p.geometry.dispose();
        p.material.dispose();
        this.particles.splice(this.particles.indexOf(p), 1);
      }
    }
    for (const p of this.pulse)
      p.scale.setScalar(1 + Math.sin(this.time * 4) * 0.04 * this.motion);
    this.render();
  }
  render() {
    if (this.mode !== "none") this.renderer.render(this.root, this.camera);
  }
}
