import {
  _decorator, Component, Node, UITransform, Graphics, Color, Label, Sprite,
  SpriteFrame, resources, Canvas, Camera, Layers, view, ResolutionPolicy,
  Vec3, tween, Tween, AudioSource, AudioClip, BlockInputEvents, EventTouch,
  input, Input, KeyCode, sys, game, Game, EditBox, JsonAsset, VideoPlayer,
  VideoClip, screen as displayScreen,
} from 'cc';
import { BEADS, ORDERS, RETURN_ORDERS, CHAPTERS, STORIES, JOURNEY, FURNITURE, CHARMS, CLEAN_SPOTS, REPAIRS } from './content';
import * as rules from './model';
import { pendingStory, storyUnlocked, finishStory } from './story';
import { BrowserAccessibility } from './BrowserAccessibility';
import { AtelierLayout } from './AtelierLayout';
import { layoutKey } from './layout-key';
import { COMPETITIONS, beginCompetition, submitCompetition, evaluateCompetition, competitionPalette } from './competition';
import { SEA_QUESTIONS, SEA_BLESSINGS, SEA_PAPERS, SEA_RIBBONS, askSea, chooseSeaGift, seaVisitReady, finishSeaVisit, seaResponse } from './heart';

const { ccclass } = _decorator;
const PAPER = '#f7f0df', INK = '#594d3f', SAGE = '#718366', MUTED = '#94846d', GOLD = '#c2a477';
const color = (hex: string) => new Color().fromHEX(hex);
type Page = 'cover' | 'home' | 'orders' | 'craft' | 'match' | 'decor' | 'album' | 'journal' | 'contest' | 'contestCraft';

@ccclass('AtelierGame')
export class AtelierGame extends Component {
  private save: any;
  private page: Node;
  private overlay: Node;
  private notices: Node;
  private screen: Page = 'cover';
  private returnScreen: Page = 'home';
  private textures = new Map<string, SpriteFrame>();
  private sounds = new Map<string, AudioClip>();
  private sound: AudioSource;
  private session: any = null;
  private selected = -1;
  private slot = -1;
  private tool = '';
  private hint: number[] = [];
  private busy = false;
  private undo: any[] = [];
  private contestUndo: any[] = [];
  private boardNodes: Node[] = [];
  private slotNodes: Node[] = [];
  private modal = '';
  private storyIndex = 0;
  private storyLine = 0;
  private journalPage = 0;
  private albumRepeat = false;
  private media: any = {};
  private video: VideoPlayer | null = null;
  private videoSubtitle: Label | null = null;
  private captions: { start: number; end: number; text: string }[] = [];
  private queued: number[] | null = null;
  private keyboardCursor = 0;
  private keyboardArmed = -1;
  private storageFailed = false;
  private toastGeneration = 0;
  private accessibility: BrowserAccessibility;
  private camera: Camera;

  private layouts = new Map<string, Node>();
  private layoutCounts = new Map<string, number>();
  private layoutKeys = new Map<Node, string>();

  async onLoad() {
    const templates = this.node.getChildByPath('Canvas/Atelier/EditableLayouts');
    if (templates) {
      const collect = (node: Node) => {
        const layout = node.getComponent(AtelierLayout);
        if (layout) this.layouts.set(layout.key, node);
        node.children.forEach(collect);
      };
      collect(templates);
      templates.active = false;
    }
    view.setDesignResolutionSize(720, 1280, ResolutionPolicy.SHOW_ALL);
    const canvas = this.node.getChildByName('Canvas') || new Node('Canvas');
    canvas.layer = Layers.Enum.UI_2D;
    canvas.parent = this.node;
    (canvas.getComponent(UITransform) || canvas.addComponent(UITransform)).setContentSize(720, 1280);
    const cameraNode = canvas.getChildByName('UI Camera') || new Node('UI Camera');
    cameraNode.parent = canvas;
    cameraNode.setPosition(0, 0, 1000);
    const camera = cameraNode.getComponent(Camera) || cameraNode.addComponent(Camera);
    this.camera=camera;
    camera.projection = Camera.ProjectionType.ORTHO;
    camera.orthoHeight = 640;
    camera.near = 0.1;
    camera.far = 2000;
    camera.visibility = Layers.Enum.UI_2D;
    camera.clearColor = color('#e8dfca');
    const c = canvas.getComponent(Canvas) || canvas.addComponent(Canvas);
    c.alignCanvasWithScreen=false;
    c.cameraComponent = camera;
    this.fitCamera();
    view.on('canvas-resize',this.fitCamera,this);
    const root = canvas.getChildByName('Atelier') || new Node('Atelier');
    root.layer = Layers.Enum.UI_2D;
    root.parent = canvas;
    root.setPosition(-360, 640);
    (root.getComponent(UITransform) || root.addComponent(UITransform)).setContentSize(720, 1280);
    this.page = this.container('Page', root);
    this.overlay = this.container('Dialogs', root);
    this.notices = this.container('Notices', root);
    this.accessibility = new BrowserAccessibility();
    this.sound = this.node.addComponent(AudioSource);
    this.rect('Paper', 0, 0, 720, 1280, PAPER);
    this.text('正在打开奶奶的旧珠盒…', 70, 590, 580, 70, 30, SAGE, this.page, true);
    try { this.save = rules.refreshEnergy(rules.normalizeSave(JSON.parse(sys.localStorage.getItem(rules.SAVE_KEY) || 'null'))); }
    catch { this.save = rules.freshSave(); }
    try {
      const frames = await new Promise<SpriteFrame[]>((resolve, reject) => resources.loadDir('art', SpriteFrame, (err, data) => err ? reject(err) : resolve(data)));
      frames.forEach(frame => this.textures.set(frame.name, frame));
      const beads = await new Promise<SpriteFrame[]>((resolve, reject) => resources.loadDir('beads', SpriteFrame, (err, data) => err ? reject(err) : resolve(data)));
      beads.forEach(frame => this.textures.set(frame.name, frame));
      const clips = await new Promise<AudioClip[]>((resolve, reject) => resources.loadDir('audio', AudioClip, (err, data) => err ? reject(err) : resolve(data)));
      clips.forEach(clip => this.sounds.set(clip.name, clip));
      resources.load('story-media', JsonAsset, (err, json) => { if (!err) this.media = json.json || {}; });
    } catch (err) {
      console.error('Atelier assets failed to load', err);
      this.page.removeAllChildren();
      this.text('珠盒暂时没有打开\n请检查 resources 素材是否完整，再重新预览。', 60, 500, 600, 180, 28);
      return;
    }
    this.screen = this.save.started ? 'home' : 'cover';
    this.render();
    input.on(Input.EventType.KEY_DOWN, this.onKey, this);
    game.on(Game.EVENT_HIDE, this.onHide, this);
    game.on(Game.EVENT_SHOW, this.onShow, this);
    this.schedule(this.tickEnergy, 15);
    // Read-only automation/QA interface; all gameplay input uses Cocos events.
    if (typeof window !== 'undefined') (window as any).render_game_to_text = () => JSON.stringify(this.snapshot());
  }

  onDestroy() {
    input.off(Input.EventType.KEY_DOWN, this.onKey, this);
    game.off(Game.EVENT_HIDE, this.onHide, this);
    game.off(Game.EVENT_SHOW, this.onShow, this);
    this.stopVideo();
    this.textures.clear();
    this.sounds.clear();
    this.accessibility?.destroy();
    view.off('canvas-resize',this.fitCamera,this);
    if (typeof window !== 'undefined') delete (window as any).render_game_to_text;
  }

  private snapshot() {
    return { engine: 'Cocos Creator 3.8.2', screen: this.screen, modal: this.modal, busy: this.busy,
      save: this.save, session: this.session, selected: this.selected, slot: this.slot,
      story: this.modal === 'story' ? { id: STORIES[this.storyIndex].id, line: this.storyLine } : null };
  }
  private onHide() { this.persist(); this.video?.pause(); this.sound.pause(); }
  private onShow() { this.tickEnergy(); }
  private fitCamera() {
    const size=view.getFrameSize();
    if(this.camera&&size.width>0)this.camera.orthoHeight=Math.max(640,360*size.height/size.width);
  }
  private tickEnergy() {
    const energy = this.save.energy;
    this.save = rules.refreshEnergy(this.save);
    if (energy !== this.save.energy) { this.persist(); if (!this.busy && !this.modal) this.render(); }
  }
  private persist() {
    try { sys.localStorage.setItem(rules.SAVE_KEY, JSON.stringify(this.save)); this.storageFailed = false; }
    catch { if (!this.storageFailed) this.toast('当前设备无法保存，请先导出进度。'); this.storageFailed = true; }
  }
  private play(name = 'tap') { const clip = this.sounds.get(name); if (this.save.sound && clip) this.sound.playOneShot(clip, 0.7); }

  private container(name: string, parent: Node) {
    const n = new Node(name); n.layer = Layers.Enum.UI_2D; n.parent = parent;
    const t = n.addComponent(UITransform); t.setAnchorPoint(0, 1); t.setContentSize(720, 1280);
    return n;
  }
  private clear(parent: Node) {
    parent.children.slice().forEach(n => { n.active=false; n.removeFromParent(); n.destroy(); });
    if(parent===this.page||parent===this.overlay)this.accessibility?.clear(parent===this.overlay);
  }
  private isDialog(parent:Node) { for(let p:Node|null=parent;p;p=p.parent)if(p===this.overlay)return true;return false; }
  private accessibleButton(name:string,action:()=>void,parent=this.page,enabled=true) { this.accessibility?.button(name,()=>{if(!this.busy)action();},this.isDialog(parent),enabled); }
  private setBusy(value:boolean) { this.busy=value;this.accessibility?.busy(value); }
  private box(name: string, x: number, y: number, w: number, h: number, parent = this.page) {
    const n = new Node(name); n.layer = Layers.Enum.UI_2D; n.parent = parent; n.setPosition(x, -y);
    const t = n.addComponent(UITransform); t.setAnchorPoint(0, 1); t.setContentSize(w, h);
    if (parent === this.page || this.layoutKeys.has(parent)) {
      const key = layoutKey(this.layoutKeys.get(parent) || this.screen, x, y, w, h, this.layoutCounts);
      this.layoutKeys.set(n, key);
      const template = this.layouts.get(key);
      if (template) {
        n.setPosition(template.position); n.setScale(template.scale); n.setRotation(template.rotation);
        n.active = template.active;
        const transform = template.getComponent(UITransform)!;
        t.setContentSize(transform.contentSize); t.setAnchorPoint(transform.anchorPoint);
      }
    }
    return n;
  }
  private rect(name: string, x: number, y: number, w: number, h: number, fill: string, parent = this.page, radius = 16, stroke = '') {
    const n = this.box(name, x, y, w, h, parent), g = n.addComponent(Graphics);
    const size=n.getComponent(UITransform)!.contentSize; w=size.width; h=size.height;
    g.fillColor = color(fill); g.roundRect(0, -h, w, h, radius); g.fill();
    if (stroke) { g.lineWidth = 1.5; g.strokeColor = color(stroke); g.roundRect(1, -h+1, w-2, h-2, radius); g.stroke(); }
    return n;
  }
  private polygon(name: string, points: number[][], fill: string, parent=this.page, stroke='#a88b66') {
    const n=this.box(name,0,0,720,1280,parent),g=n.addComponent(Graphics);
    g.fillColor=color(fill);g.strokeColor=color(stroke);g.lineWidth=2;
    g.moveTo(points[0][0],-points[0][1]);
    for(let i=1;i<points.length;i++)g.lineTo(points[i][0],-points[i][1]);
    g.close();g.fill();g.stroke();return n;
  }
  private ellipse(name:string,cx:number,cy:number,rx:number,ry:number,fill:string,parent=this.page,stroke='') {
    const n=this.box(name,cx-rx,cy-ry,rx*2,ry*2,parent),g=n.addComponent(Graphics);
    g.fillColor=color(fill);g.ellipse(rx,-ry,rx,ry);g.fill();
    if(stroke){g.strokeColor=color(stroke);g.lineWidth=2;g.ellipse(rx,-ry,rx,ry);g.stroke();}return n;
  }
  private text(value: string, x: number, y: number, w: number, h: number, size = 24, fill = INK, parent = this.page, center = false) {
    const n = this.box(value.slice(0, 26), x, y, w, h, parent), label = n.addComponent(Label);
    label.string = value; label.fontSize = size; label.lineHeight = Math.round(size * 1.5);
    label.color = color(fill); label.fontFamily = 'Microsoft YaHei'; label.enableWrapText = true;
    label.overflow = Label.Overflow.SHRINK;
    label.horizontalAlign = center ? Label.HorizontalAlign.CENTER : Label.HorizontalAlign.LEFT;
    label.verticalAlign = Label.VerticalAlign.CENTER;
    if(!parent.name.startsWith('Button:')&&parent!==this.notices)this.accessibility?.text(value,this.isDialog(parent));
    const template = this.layouts.get(this.layoutKeys.get(n) || '');
    const style = template?.getComponent(Label), baseline = template?.getComponent(AtelierLayout);
    if (style && baseline?.originalLabel) {
      const original = JSON.parse(baseline.originalLabel);
      for (const field of ['fontSize','lineHeight','fontFamily','horizontalAlign','verticalAlign','overflow','enableWrapText','string']) {
        if ((style as any)[field] !== original[field]) (label as any)[field] = (style as any)[field];
      }
      if (style.color.toHEX('#rrggbbaa') !== original.color) label.color = style.color;
    }
    return label;
  }
  private image(key: string, x: number, y: number, w: number, h: number, parent = this.page) {
    const frame = this.textures.get('pencil-'+key) || this.textures.get(key);
    if (!frame) return this.box(key, x, y, w, h, parent);
    const n = this.box(key, x, y, w, h, parent), s = n.addComponent(Sprite);
    s.sizeMode = Sprite.SizeMode.CUSTOM; s.spriteFrame = frame;
    const template = this.layouts.get(this.layoutKeys.get(n) || '');
    const artwork = template?.getComponent(Sprite), baseline = template?.getComponent(AtelierLayout);
    if (artwork?.spriteFrame && artwork.spriteFrame.name !== baseline?.originalImage) s.spriteFrame = artwork.spriteFrame;
    const transform=n.getComponent(UITransform)!, size=transform.contentSize, source=s.spriteFrame!.originalSize;
    // Fit the artwork itself, including editor replacements, without changing its proportions.
    if(source?.width>0&&source?.height>0){
      const scale=Math.min(size.width/source.width,size.height/source.height),width=source.width*scale,height=source.height*scale;
      const anchor=transform.anchorPoint;
      n.setPosition(n.position.x+(size.width-width)*(.5-anchor.x),n.position.y+(size.height-height)*(.5-anchor.y),n.position.z);
      transform.setContentSize(width,height);
    }
    return n;
  }
  private button(label: string, x: number, y: number, w: number, h: number, action: () => void, parent = this.page, primary = false, enabled = true) {
    const n = this.rect('Button: ' + label, x, y, w, h, enabled ? primary ? SAGE : '#eee5d2' : '#e6e0d2', parent, 14, primary ? '' : '#d9cab0');
    if(primary&&enabled){const g=n.getComponent(Graphics)!;g.strokeColor=color('#d8c591');g.lineWidth=1.5;g.roundRect(5,-h+5,w-10,h-10,10);g.stroke();}
    this.text(label, 10, 0, w-20, h, 23, enabled ? primary ? PAPER : INK : MUTED, n, true);
    this.accessibleButton(label,action,parent,enabled);
    if (enabled) n.on(Node.EventType.TOUCH_END, (e: EventTouch) => { e.propagationStopped = true; if(this.busy)return; this.play(); action(); });
    return n;
  }
  private title(eyebrow: string, title: string, subtitle = '') {
    this.text(eyebrow, 38, 108, 644, 32, 18, MUTED);
    this.text(title, 38, 144, 644, 60, 36);
    if (subtitle) this.text(subtitle, 38, 207, 644, 60, 21, MUTED);
  }
  private toast(message: string) {
    this.accessibility?.announce(message);
    this.notices.removeAllChildren();
    const id = ++this.toastGeneration;
    this.rect('Toast', 40, 1090, 640, 80, '#594d3ff2', this.notices);
    this.text(message, 55, 1096, 610, 68, 23, PAPER, this.notices, true);
    this.scheduleOnce(() => { if (this.toastGeneration === id) this.notices.removeAllChildren(); }, 2.8);
  }
  private navigate(page: Page) {
    if (this.busy) return;
    if (page === 'match') { this.matchIntro(); return; }
    this.closeModal(); this.screen = page; this.slot = -1; this.selected = -1; this.hint = []; this.render();
  }
  private render() {
    this.layoutCounts.clear(); this.layoutKeys.clear();
    this.clear(this.page);
    this.boardNodes = []; this.slotNodes = [];
    this.rect('Paper', 0, 0, 720, 1280, PAPER);
    for(let y=0;y<1280;y+=720*112/680)this.image('pencil-paper',0,y,720,720*112/680);
    this.image('pencil-frame',0,0,720,1280);
    // Subtle stationary paper grain, generated once per page instead of every frame.
    const grain = this.box('Paper fibres', 0, 0, 720, 1280).addComponent(Graphics);
    grain.strokeColor = color('#b6a17b14'); grain.lineWidth = 1;
    for (let i=0;i<180;i++) { const x=(i*173)%720,y=(i*97)%1280; grain.moveTo(x,-y); grain.lineTo(x+3,-y-1); } grain.stroke();
    if (this.screen !== 'cover') this.chrome();
    switch (this.screen) {
      case 'cover': this.cover(); break;
      case 'home': this.home(); break;
      case 'orders': this.orders(); break;
      case 'craft': this.craft(); break;
      case 'match': this.match(); break;
      case 'decor': this.decor(); break;
      case 'album': this.album(); break;
      case 'journal': this.journal(); break;
      case 'contest': this.contest(); break;
      case 'contestCraft': this.craft(); break;
    }
    this.layoutKeys.forEach((key,node) => {
      const source=this.layouts.get(key)?.getComponent(AtelierLayout), drawing=node.getComponent(Graphics);
      if(source && drawing && source.drawing !== source.originalDrawing) source.redraw(drawing);
    });
  }
  private chrome() {
    const names = { home:'珠光小店', orders:'顾客委托', craft:'手串工坊', match:'珠材花园', decor:'小店焕新', album:'作品图鉴', journal:'我们的故事', contest:'参加比赛', contestCraft:'参赛手作' };
    this.rect('Header', 0, 0, 720, 88, '#f9f3e7', this.page, 0);
    this.button(this.screen === 'home' ? '✿' : '‹', 20, 17, 52, 52, () => this.screen === 'match' ? this.pauseMatch() : this.navigate(this.screen==='contestCraft'?'contest':'home'));
    this.text(names[this.screen], 84, 20, 205, 50, 29);
    this.button('珠 ' + rules.total(this.save.inventory), 298, 20, 114, 48, () => this.inventory());
    this.text('金 ' + this.save.coins, 426, 20, 112, 48, 24, GOLD);
    this.button('♥ '+this.save.energy, 540, 20, 88, 48, () => this.info('体力', '每 3 分钟恢复一点，上限 10。\n采珠消耗 1 点；手作、装修与阅读不耗体力。'));
    this.button('⚙', 640, 20, 60, 48, () => this.settings());
    if (this.screen === 'match') return;
    this.rect('Navigation', 0, 1194, 720, 86, '#f9f3e7', this.page, 0);
    (['home','orders','craft','decor','album'] as Page[]).forEach((p,i) => {
      const labels=['小店','委托','手作','装修','图鉴'], icons=['home','orders','craft','chair','album'];
      const n=this.box('Navigate '+p, i*144,1196,144,84);
      if(this.screen===p)this.rect('Active',14,0,116,78,'#e4e8d7',n,14);
      this.image('icon-'+icons[i],54,7,36,36,n);
      this.text(labels[i],0,45,144,34,20,this.screen===p?SAGE:MUTED,n,true);
      n.on(Node.EventType.TOUCH_END,()=>this.navigate(p));
      this.accessibleButton(labels[i],()=>this.navigate(p));
    });
  }
  private cover() {
    this.text('AH HE’S LITTLE ATELIER',50,110,620,44,22,MUTED,this.page,true);
    this.text('珠光小店物语',30,167,660,88,51,INK,this.page,true);
    this.rect('Illustration mount',35,320,650,526,'#b7986e',this.page,18);
    this.image('pencil-cover',42,327,636,512);
    this.text('一间小店，两代人的手作时光',60,910,600,54,28,SAGE,this.page,true);
    this.text('与奶奶一起，把日子慢慢串成光。',40,982,640,56,26,MUTED,this.page,true);
    this.button('打开小店  →',160,1080,400,78,()=>{this.save.started=true;this.persist();this.navigate('home');this.startStory(0);},this.page,true);
    this.text('消除采珠  ·  手串定制  ·  小店经营',70,1190,580,40,21,MUTED,this.page,true);
  }
  private get repeatOrder() { return this.save.completed.length===ORDERS.length; }
  private currentOrder() { return rules.currentOrder(this.save); }
  private home() {
    this.title('AH HE’S LITTLE ATELIER','一颗珠子，一段新生活','午后的阳光刚好，小店又开门了。');
    this.rect('Illustration mount',35,277,650,524,'#b7986e',this.page,10);
    this.image('pencil-shop',38,280,644,518);
    this.rect('Shop sign',65,732,280,52,'#f9f3e7ee'); this.text('阿禾手作  ·  营业中',80,736,250,44,23,SAGE);
    this.button('参加比赛',494,735,164,52,()=>this.navigate('contest'),this.page,COMPETITIONS.some(event=>this.save.completed.length>=event.unlock&&!this.save.competitions.entries.some((entry:any)=>entry.id===event.id)));
    const chapter=CHAPTERS[Math.min(2,Math.floor(this.save.completed.length/2))];
    this.text(chapter.title,38,809,530,42,23,MUTED);
    this.button('手账',586,806,96,48,()=>this.navigate('journal'));
    const order=this.currentOrder();
    this.rect('Commission',38,867,644,140,'#fffaf0',this.page,18,'#dfd1b6');
    this.text((this.repeatOrder?'回头客追加委托 · ':'正在等待的心意 · ')+order.customer,60,878,550,28,20,MUTED);
    this.text(order.name,60,910,600,42,31);
    this.text(order.text,60,956,600,42,21,MUTED);
    this.button('按单制作',38,1020,311,60,()=>this.navigate('craft'),this.page,true);
    this.button('消除采珠',371,1020,311,60,()=>this.matchIntro());
    const journey=JOURNEY[Math.min(6,this.save.completed.length)];
    this.text(journey.title,38,1088,644,34,25,SAGE);
    this.text(journey.goal,38,1122,644,30,21,MUTED);
    const pending=pendingStory(this.save);
    if(seaVisitReady(this.save))this.button('小满回来了 · 看旅行留影',38,1157,644,31,()=>this.seaVisit());
    else if(this.save.orderId==='sea'&&!this.save.completed.includes('sea'))this.button('听听她的故事 · 小满的第一次旅行',38,1157,644,31,()=>this.seaChat());
    else this.button(pending?'继续剧情 · '+pending.title:'翻阅我们的故事',38,1157,644,31,()=>pending?this.startStory(STORIES.indexOf(pending)):this.navigate('journal'));
  }
  private orders() {
    const repeat=this.repeatOrder,current=this.currentOrder();
    this.title('LET EVERY WISH BE SEEN','为每一份心意，认真配色',repeat?'回头客第 '+(this.save.repeatOrders+1)+' 单 · 交付后继续收到新的委托。':'按顺序完成剧情委托，之后继续承接回头客订单。');
    (repeat?RETURN_ORDERS:ORDERS).forEach((o,i)=>{
      const y=288+i*146,done=repeat?i<this.save.repeatOrders%ORDERS.length:this.save.completed.includes(o.id),unlocked=repeat?o.id===current.id:i<=this.save.completed.length;
      this.rect('Order '+o.id,38,y,644,132,done?'#e9ecdf':'#fffaf0',this.page,16,'#dfd1b6');
      this.image('bead-'+o.main,50,y+14,74,74);
      this.text(o.customer+' · '+o.occasion,139,y+8,510,29,18,MUTED);
      this.text(o.name,139,y+39,500,40,28);
      this.text(`${BEADS[o.main].short}≥${o.mainNeed} / ${BEADS[o.accent].short}≥${o.accentNeed} / ${CHARMS[o.charm]}`,139,y+83,338,32,19,MUTED);
      if(!repeat&&o.id==='sea'&&unlocked)this.button('听听她的故事',430,y+8,232,30,()=>this.seaChat());
      this.button(done?'已交付':unlocked?'按单制作 '+o.reward+'金':repeat?'等待来店':'尚未解锁',486,y+83,176,38,()=>{this.save.orderId=o.id;this.persist();this.navigate('craft');},this.page,unlocked&&!done,unlocked&&!done);
    });
  }
  private get contestEntry() { return this.screen==='contestCraft'?this.save.competitions.draft:null; }
  private get workingDraft() { return this.contestEntry?.beads || this.save.draft; }
  private set workingDraft(beads:(number|null)[]) { if(this.contestEntry)this.contestEntry.beads=beads;else this.save.draft=beads; }
  private get workingCharm() { return this.contestEntry?.charm || this.save.charm; }
  private set workingCharm(charm:string) { if(this.contestEntry)this.contestEntry.charm=charm;else this.save.charm=charm; }
  private get workingUndo() { return this.contestEntry?this.contestUndo:this.undo; }
  private remember() { this.workingUndo.push({draft:[...this.workingDraft],charm:this.workingCharm}); if(this.workingUndo.length>60)this.workingUndo.shift(); }
  private slotPos(i: number) {
    const a=i*Math.PI/6-Math.PI/2, x=360+Math.cos(a)*190, y=722+Math.sin(a)*116;
    return {x,y};
  }
  private bracelet(beads: (number|null)[], cx: number, cy: number, r: number, parent=this.page) {
    this.ellipse('Bracelet shadow',cx,cy+r*.7,r*1.05,r*.37,'#9a7f4d19',parent);
    const wire=this.box('Bracelet wire',cx-r,cy-r,r*2,r*2,parent).addComponent(Graphics);
    wire.lineWidth=4;wire.strokeColor=color(GOLD);wire.ellipse(r,-r,r,r*.95);wire.stroke();
    beads.forEach((t,i)=>{const a=i*Math.PI/6-Math.PI/2,x=cx+Math.cos(a)*r,y=cy+Math.sin(a)*r*.95;
      if(t!==null){this.ellipse('Bead shadow',x+2,y+r*.11,r*.17,r*.08,'#8b705535',parent);this.image('bead-'+t,x-r*.2,y-r*.2,r*.4,r*.4,parent);}
    });
  }
  private craft() {
    const event=this.contestEntry&&COMPETITIONS.find(e=>e.id===this.contestEntry.id),o=this.currentOrder();
    this.title(event?'NEIGHBOURHOOD BEAD CONTEST':(this.repeatOrder?'RETURNING CUSTOMER · ':'COMMISSION · ')+o.customer,event?event.theme:o.name);
    if(!event&&o.id==='sea'&&!this.repeatOrder)this.button('听故事',552,156,130,43,()=>this.seaChat());
    const checks=rules.checkOrder(this.save),counts=rules.draftCounts(this.workingDraft);
    this.text(event?`${BEADS[event.main].short}≥6 · ${BEADS[event.accent].short}≥3 · ${CHARMS[event.charm]} · 相对珠槽呼应`:`${o.customer} · ${BEADS[o.main].short} ${counts[o.main]}/${o.mainNeed} · ${BEADS[o.accent].short} ${counts[o.accent]}/${o.accentNeed} · ${CHARMS[o.charm]}吊坠`,38,212,644,50,23,SAGE,this.page,true);
    this.rect('Workshop mount',105,276,510,331,'#b89c77',this.page,12);
    this.image('pencil-workshop',108,279,504,325);
    this.polygon('Counter edge',[[80,550],[640,550],[688,889],[32,889]],'#d0b18d');
    const wood=this.box('Counter grain',0,0,720,1280).addComponent(Graphics);
    wood.strokeColor=color('#9e79583b');wood.lineWidth=1.3;
    for(let y=568;y<888;y+=17){wood.moveTo(75,-y);wood.bezierCurveTo(185,-y-7,496,-y+8,645,-y-2);}wood.stroke();
    this.image('pencil-tray',80,550,560,331);
    const g=this.box('Wire',0,0,720,1280).addComponent(Graphics);
    g.strokeColor=color('#c1a06b');g.lineWidth=2;g.ellipse(360,-722,190,116);g.stroke();
    g.fillColor=color('#d5b776');
    for(let i=0;i<12;i++){const a=(i+.5)*Math.PI/6-Math.PI/2;g.ellipse(360+Math.cos(a)*190,-722-Math.sin(a)*116,6,4);g.fill();g.stroke();}
    this.text('AH HE\nHANDMADE',270,685,180,76,23,'#ac9473',this.page,true);
    this.workingDraft.forEach((type: number|null,i: number)=>{
      const p=this.slotPos(i),n=this.box('Slot '+i,p.x-37,p.y-37,74,74);
      this.ellipse('Slot recess',37,37,28,28,this.slot===i?'#e9d28d':'#b39a7045',n,this.slot===i?'#ac8a4b':'#c3ac88');
      if(type!==null){const size=68+Math.sin(i*Math.PI/6-Math.PI/2)*5;this.ellipse('Bead contact shadow',39,54,26,10,'#82634250',n);this.image('bead-'+type,(74-size)/2,(74-size)/2,size,size,n);}
      else this.text(String(i+1),0,7,74,62,17,'#a68c66',n,true);
      this.slotNodes.push(n);this.bindCraftDrag(n,i);
      this.accessibleButton(`第${i+1}槽：${type===null?'空槽':BEADS[type].name}`,()=>{this.slot=this.slot===i?-1:i;this.render();});
    });
    this.image('charm-'+this.workingCharm,338,851,44,44);
    this.text('点珠材入槽 · 拖动换位 · 点选后替换',38,891,644,28,20,MUTED,this.page,true);
    BEADS.forEach((b,i)=>{
      const x=39+i*108;
      const n=this.rect('Bead material '+i,x,920,102,90,'#fffaf0',this.page,13,'#cab394');
      this.image('bead-'+i,23,0,56,56,n);
      this.text(event?b.short:b.short+' '+Math.max(0,this.save.inventory[i]-counts[i]),0,58,102,30,18,INK,n,true);
      n.on(Node.EventType.TOUCH_END,()=>this.place(i));
      this.accessibleButton('放入'+b.name,()=>this.place(i));
    });
    Object.entries(CHARMS).forEach(([id,name],i)=>this.button((this.workingCharm===id?'✓ ':'')+name,40+i*218,1020,204,44,()=>{this.remember();this.workingCharm=id;this.persist();this.render();},this.page,this.workingCharm===id));
    this.button('撤销',38,1075,144,44,()=>{const s=this.workingUndo.pop();if(!s)return this.toast('还没有可撤销的操作。');this.workingDraft=s.draft;this.workingCharm=s.charm;this.slot=-1;this.persist();this.render();});
    this.button('取下',197,1075,144,44,()=>{if(this.slot<0)return this.toast('先点选一颗珠子。');this.remember();this.workingDraft[this.slot]=null;this.slot=-1;this.persist();this.render();});
    this.button('参考配色',356,1075,160,44,()=>this.sample());
    this.button(event?'评分规则':'采珠',531,1075,151,44,()=>event?this.contestRules():this.matchIntro());
    this.button(event?'提交参赛作品':'包装交付  ·  '+o.reward+' 金币',38,1133,644,52,()=>{
      if(event){if(this.workingDraft.includes(null))return this.toast('先串满十二颗珠子，再提交作品。');this.contestConfirm();return;}
      if(!Object.values(checks).every(Boolean))return this.toast(!checks.full?'先串满十二颗珠子。':!checks.charm?'换成客人需要的吊坠吧。':'配色或库存还未满足，看看上方要求。');
      this.confirmDelivery();
    },this.page,true);
  }
  private place(type: number) {
    if(this.modal||!Number.isInteger(type)||type<0||type>5)return;
    const index=rules.craftTarget(this.workingDraft,this.slot);
    if(index<0)return this.toast('手串已满，点选一颗可替换珠材。');
    if(!this.contestEntry&&!rules.canPlace(this.save,type,index))return this.toast('这份珠材用完了，去花园采一些吧。');
    this.remember();this.workingDraft[index]=type;this.slot=-1;this.persist();this.render();this.play();
    const n=this.slotNodes[index],p=n.position.clone();
    if(!this.save.reduced){n.setPosition(39+type*108+14,-920);n.setScale(.4,.4,1);tween(n).to(.18,{position:new Vec3((p.x+323)/2,p.y+85,0),scale:new Vec3(1.12,1.12,1)}).to(.24,{position:p,scale:Vec3.ONE},{easing:'quadIn'}).to(.08,{scale:new Vec3(1.08,.92,1)}).to(.12,{scale:Vec3.ONE}).call(()=>this.play('land')).start();}
  }
  private localPoint(e: EventTouch) {
    // getUILocation already accounts for SHOW_ALL letterboxing; page origin is top left.
    const p=e.getUILocation();return new Vec3(p.x,p.y-1280,0);
  }
  private bindCraftDrag(n: Node,index: number) {
    let start: Vec3|null=null, original: Vec3|null=null, dragged=false;
    n.on(Node.EventType.TOUCH_START,(e: EventTouch)=>{
      if(this.modal)return;start=this.localPoint(e);original=n.position.clone();dragged=false;Tween.stopAllByTarget(n);n.setScale(1,1,1);
    });
    n.on(Node.EventType.TOUCH_MOVE,(e: EventTouch)=>{
      if(!start||this.workingDraft[index]===null)return;
      const p=this.localPoint(e);if(Vec3.distance(start,p)>14)dragged=true;
      if(dragged){n.setSiblingIndex(this.page.children.length-1);n.setPosition(p.x-37,p.y+37);}
    });
    n.on(Node.EventType.TOUCH_END,(e: EventTouch)=>{
      if(!start||this.modal)return;
      if(dragged){const p=this.localPoint(e);let target=-1,nearest=85;for(let i=0;i<12;i++){if(i===index)continue;const s=this.slotNodes[i].position,d=Math.hypot(s.x+37-p.x,s.y-37-p.y);if(d<nearest){target=i;nearest=d;}}
        if(target>=0&&target!==index){this.remember();[this.workingDraft[index],this.workingDraft[target]]=[this.workingDraft[target],this.workingDraft[index]];this.slot=target;this.persist();this.play('land');}
      }else this.slot=this.slot===index?-1:index;
      start=null;this.render();
    });
    n.on(Node.EventType.TOUCH_CANCEL,()=>{if(original)n.setPosition(original);start=null;dragged=false;});
  }
  private sample() {
    if(this.contestEntry){this.contestSample();return;}
    const o=this.currentOrder();this.dialog('sample','参考配色');
    this.bracelet(o.palette,360,500,160,this.overlay);
    this.text(`${BEADS[o.main].name}至少 ${o.mainNeed} 颗\n${BEADS[o.accent].name}至少 ${o.accentNeed} 颗\n吊坠：${CHARMS[o.charm]}`,105,710,510,120,25,INK,this.overlay,true);
    this.button('按参考排珠',130,874,460,64,()=>{
      if(rules.draftCounts(o.palette).some((n,i)=>n>this.save.inventory[i]))return this.toast('珠材还不够，先去采珠。');
      this.remember();this.workingDraft=[...o.palette];this.workingCharm=o.charm;this.slot=-1;this.persist();this.closeModal();this.render();
    },this.overlay,true);
  }
  private contest() {
    this.title('A SMALL OCCASION, A LITTLE COURAGE','偶尔，去参加一场比赛','街坊主题赛 · 完成第 1、3、5 份委托后，收到新的邀请。');
    this.rect('Contest invitation',38,282,644,76,'#e8ecde',this.page,16,'#c9b995');
    this.text('赛事提供练习珠材 · 免费参加 · 委托草稿独立保留',54,292,612,55,22,SAGE,this.page,true);
    COMPETITIONS.forEach((event,i)=>{
      const y=384+i*244,entry=this.save.competitions.entries.find((e:any)=>e.id===event.id);
      const unlocked=this.save.completed.length>=event.unlock,resuming=this.save.competitions.draft?.id===event.id;
      this.rect('Competition '+event.id,38,y,644,224,entry?'#edf0e3':'#fffaf0',this.page,18,'#d3bf9d');
      this.text('✦ '+event.title,58,y+12,604,44,29,entry?SAGE:INK);
      this.text(event.description,58,y+62,604,56,22,MUTED);
      this.text(`${BEADS[event.main].short}≥6 · ${BEADS[event.accent].short}≥3 · ${CHARMS[event.charm]}吊坠`,58,y+122,604,32,21,SAGE);
      this.text(entry?entry.medal+' · '+entry.score+' 分':unlocked?'邀请已送达 · 金奖 '+event.reward+' 金':'完成 '+event.unlock+' 份委托后邀请',58,y+170,370,36,21,MUTED);
      this.button(entry?'查看参赛作品':unlocked?resuming?'继续参赛':'报名参加':'等待下一次邀请',438,y+164,224,46,()=>entry?this.contestResult(event.id):this.enterCompetition(event.id),this.page,unlocked&&!entry,unlocked);
    });
    this.text('每场可提交一件作品，成绩与奖牌会保留在这里。',38,1144,644,40,22,MUTED,this.page,true);
  }
  private enterCompetition(id:string,replace=false) {
    const old=this.save.competitions.draft,next=beginCompetition(this.save,id,replace);
    if(!next){
      if(old&&old.id!==id&&!replace){
        this.dialog('contest-switch','换一个主题参加？');
        this.text('切换主题会放下这份未提交的参赛草稿。\n委托中的手串会继续保留。',105,412,510,180,28,INK,this.overlay,true);
        this.button('继续当前作品',135,722,450,62,()=>{this.closeModal();this.navigate('contestCraft');},this.overlay,true);
        this.button('放下参赛草稿并换题',135,814,450,60,()=>this.enterCompetition(id,true),this.overlay);
      }
      return;
    }
    if(old?.id!==id)this.contestUndo=[];
    this.save=next;this.persist();this.navigate('contestCraft');
  }
  private contestRules() {
    this.info('街坊评审 · 100 分制','主题色：达到 6 颗得 45 分。\n辅助色：达到 3 颗得 20 分。\n主题吊坠：10 分。\n\n相对珠槽呼应：共 25 分。\n1 与 7、2 与 8，依次到 6 与 12；\n每对同色，增加一份呼应。\n\n90 分金奖，75 分银奖，60 分铜奖；\n其余作品也会获得参与纪念。');
  }
  private contestSample() {
    const event=COMPETITIONS.find(e=>e.id===this.contestEntry?.id);if(!event)return;
    const palette=competitionPalette(event.id)!;
    this.dialog('contest-sample','一点配色灵感');this.bracelet(palette,360,500,145,this.overlay);
    this.text('主题色与辅助色交替，\n让相对的珠子相互呼应。\n这是一个示例，也可以做自己的设计。',105,715,510,130,26,INK,this.overlay,true);
    this.button('以此为起点排珠',135,918,450,62,()=>{this.remember();this.workingDraft=palette.slice();this.workingCharm=event.charm;this.slot=-1;this.persist();this.closeModal();this.render();},this.overlay,true);
  }
  private contestConfirm() {
    const draft=this.contestEntry,event=COMPETITIONS.find(e=>e.id===draft?.id);
    if(!event||!evaluateCompetition(event.id,draft.beads,draft.charm))return;
    this.dialog('contest-submit','把作品交给街坊评审');
    this.bracelet(draft.beads,360,520,140,this.overlay);
    this.text(event.title+'\n'+event.theme,105,720,510,85,26,SAGE,this.overlay,true);
    this.text('提交后本场作品定稿，不能再次改动。\n免费参赛，不扣珠材或体力。',105,817,510,86,24,MUTED,this.overlay,true);
    this.button('提交评审',135,946,450,62,()=>{
      const next=submitCompetition(this.save);if(!next)return this.toast('作品尚未完成，或本场已提交。');
      this.save=next;this.contestUndo=[];this.persist();this.play('success');this.navigate('contest');this.contestResult(event.id);
    },this.overlay,true);
  }
  private contestResult(id:string) {
    const entry=this.save.competitions.entries.find((e:any)=>e.id===id);if(!entry)return;
    const event=COMPETITIONS.find(e=>e.id===id)!;
    this.dialog('contest-result',event.title+' · 评审结果');
    const medal=entry.score>=90?'#d2b566':entry.score>=75?'#b7bdb4':entry.score>=60?'#bf9777':'#a4b08e';
    this.ellipse('Contest medal',360,373,45,45,medal,this.overlay,'#9c8766');
    this.text('✦',318,334,84,78,48,PAPER,this.overlay,true);
    this.text(entry.medal,105,428,510,50,32,SAGE,this.overlay,true);
    this.bracelet(entry.beads,360,577,85,this.overlay);this.image('charm-'+entry.charm,340,655,40,45,this.overlay);
    this.text('总分 '+entry.score+' / 100',105,706,510,44,29,INK,this.overlay,true);
    this.text(`主题色 ${entry.theme}/45 · 辅助色 ${entry.accent}/20\n吊坠 ${entry.detail}/10 · 珠槽呼应 ${entry.echo}/25`,105,759,510,82,24,MUTED,this.overlay,true);
    this.text(entry.score>=90?'“配色与细节都很完整，愿你继续做喜欢的作品。”':entry.score>=60?'“我们看见你的心意了，下次试试让相对珠子呼应。”':'“谢谢你把第一步交给我们，继续自由尝试吧。”',105,846,510,70,24,SAGE,this.overlay,true);
    this.text('本场奖励 '+entry.reward+' 金币 · 已入账',105,921,510,32,22,GOLD,this.overlay,true);
    this.button('收好这份纪念',135,970,450,56,()=>this.closeModal(),this.overlay,true);
  }
  private confirmDelivery() {
    const o=this.currentOrder();if(o.id==='sea'&&!this.repeatOrder){this.seaPacking();return;}this.dialog('delivery','把心意，认真送到');
    this.image('pencil-delivery',80,325,560,320,this.overlay);
    this.text(o.name+'\n'+o.customer+' · '+o.reward+' 金币 / '+o.rep+' 口碑',100,683,520,110,27,INK,this.overlay,true);
    this.button('确认交付',130,863,460,70,()=>this.deliverOrder(),this.overlay,true);
  }
  private deliverOrder() {
    const o=this.currentOrder(),repeat=this.repeatOrder,next=rules.deliver(this.save);
    if(!next)return this.toast('交付条件尚未满足。');
    this.save=next;this.undo=[];
    this.persist();this.play('success');this.closeModal();this.screen='home';this.render();
    if(repeat){this.toast(o.customer+'收到了手串 · '+o.reward+' 金币已入账，下一份委托已送达。');return;}
    const invitation=COMPETITIONS.find(event=>event.unlock===this.save.completed.length);
    if(invitation)this.toast('收到比赛邀请：'+invitation.title+'，首页可参加。');
    const nextStory=()=>this.startStory(STORIES.findIndex(story=>story.afterOrder===o.id));
    if(o.id!=='sea'){nextStory();return;}
    this.dialog('sea-response','小满把祝福读了两遍');
    this.text(seaResponse(this.save),105,365,510,210,29,SAGE,this.overlay);
    const gift=this.save.collection.find((item:any)=>item.id==='sea').gift;
    this.rect('Blessing card',100,605,520,135,gift.paper==='sky'?'#e4edf0':'#fff9e9',this.overlay,16,'#c7b18b');
    this.text('你写下的祝福\n'+SEA_BLESSINGS.find(b=>b.id===gift.blessing)!.text,120,620,480,105,25,INK,this.overlay,true);
    this.text('这张卡已和作品一起收入图鉴。',105,780,510,60,23,MUTED,this.overlay,true);
    this.button('目送她出发',135,917,450,64,()=>{this.closeModal();nextStory();},this.overlay,true);
  }
  private seaChat(questionId='') {
    if(!this.save.completed.includes('daisy'))return;
    this.dialog('sea-chat','听听小满的故事');
    const question=SEA_QUESTIONS.find(q=>q.id===questionId);
    this.text(question?'阿禾：'+question.ask+'\n\n小满：'+question.answer+'\n\n'+question.follow:'小满：我想要蓝色。第一次自己出远门，有点怕。\n\n阿禾把珠盒往她身边推了推，等她慢慢说。',105,342,510,300,26,INK,this.overlay);
    SEA_QUESTIONS.forEach((q,i)=>this.button((this.save.seaHeart.facts.includes(q.id)?'✓ ':'')+q.ask,105,666+i*74,510,60,()=>{
      const next=askSea(this.save,q.id);if(next){this.save=next;this.persist();}this.seaChat(q.id);
    },this.overlay));
    this.button('把这份心意记住',135,928,450,60,()=>{this.closeModal();this.render();},this.overlay,true);
  }
  private seaPacking() {
    this.dialog('sea-packing','亲手写一句祝福');
    const state=this.save.seaHeart,gift=state.gift;
    this.rect('Sea wrapping paper',100,340,520,184,gift.paper==='sky'?'#dce9ec':'#fff8e8',this.overlay,14,'#ccb99a');
    this.rect('Sea wrapping ribbon',112,496,496,13,gift.ribbon==='blue'?'#91b6c4':'#9bad87',this.overlay,3);
    this.ellipse('Ribbon bow left',340,499,23,9,gift.ribbon==='blue'?'#91b6c4':'#9bad87',this.overlay);
    this.ellipse('Ribbon bow right',382,499,23,9,gift.ribbon==='blue'?'#91b6c4':'#9bad87',this.overlay);
    this.bracelet(this.save.draft,360,432,72,this.overlay);
    this.text('没有标准答案，选一句你想对她说的话。',105,535,510,38,21,MUTED,this.overlay,true);
    const choose=(field:string,id:string)=>{const next=chooseSeaGift(this.save,field,id);if(!next)return;this.save=next;this.persist();this.seaPacking();};
    SEA_BLESSINGS.forEach((b,i)=>{
      const open=!b.requires||state.facts.includes(b.requires);
      this.button((gift.blessing===b.id?'✓ ':'')+b.text+(open?'':b.id==='slow'?'（聊聊担心）':'（聊聊家人）'),100,586+i*59,520,51,()=>choose('blessing',b.id),this.overlay,gift.blessing===b.id,open);
    });
    SEA_PAPERS.forEach((paper,i)=>this.button((gift.paper===paper.id?'✓ ':'')+paper.name,100+i*268,778,252,49,()=>choose('paper',paper.id),this.overlay,gift.paper===paper.id,!paper.requires||state.facts.includes(paper.requires)));
    SEA_RIBBONS.forEach((ribbon,i)=>this.button((gift.ribbon===ribbon.id?'✓ ':'')+ribbon.name,100+i*268,841,252,49,()=>choose('ribbon',ribbon.id),this.overlay,gift.ribbon===ribbon.id,!ribbon.requires||state.facts.includes(ribbon.requires)));
    this.button('再听听她的故事',100,909,252,45,()=>this.seaChat(),this.overlay);
    this.button('确认包装交付',368,909,252,65,()=>this.deliverOrder(),this.overlay,true);
    this.text('蓝色纸与丝带：聊过想看的风景后可选。',100,991,520,32,18,MUTED,this.overlay,true);
  }
  private seaPhoto(y=348) {
    const photo=this.rect('Xiaoman travel photograph',105,y,510,260,'#fffbef',this.overlay,6,'#c9b995');
    this.rect('Dawn sky',14,14,482,192,'#dbe4df',photo,0);
    this.ellipse('Sunrise sun',342,88,32,32,'#ecd3a0',photo);
    this.rect('Morning sea',14,112,482,94,'#a8c5c5',photo,0);
    const waves=this.box('Pencil sea waves',14,112,482,94,photo).addComponent(Graphics);
    waves.lineWidth=2;waves.strokeColor=color('#e7e8cf');
    for(let i=0;i<9;i++){const x=23+(i*83)%400,wy=13+(i*19)%70;waves.moveTo(x,-wy);waves.bezierCurveTo(x+18,-wy-5,x+43,-wy+5,x+68,-wy);waves.stroke();}
    this.text('小满的第一次独行 · 海边日出',20,211,470,40,22,INK,photo,true);
  }
  private seaVisit() {
    if(!seaVisitReady(this.save)){this.seaRecord();return;}
    this.dialog('sea-visit','小满带回了一阵海风');this.seaPhoto();
    this.text('小满：这是我第一次自己看日出。\n我也坐错过车，可后来还是到了。\n\n她摊开旅行带回的小吊坠：\n“帮我把这次旅行，也留在手串上吧。”',105,638,510,225,26,INK,this.overlay);
    this.text('选一枚旅行纪念 · 不消耗库存',105,874,510,35,21,MUTED,this.overlay,true);
    const finish=(charm:string)=>{const next=finishSeaVisit(this.save,charm);if(!next)return;this.save=next;this.persist();this.closeModal();this.render();this.seaRecord();};
    this.button('添一朵小雏菊',105,940,246,58,()=>finish('daisy'),this.overlay,true);
    this.button('添一颗小爱心',369,940,246,58,()=>finish('heart'),this.overlay,true);
  }
  private seaRecord() {
    this.dialog('sea-memory','海风订单 · 心意手账');
    if(this.save.seaHeart.visited){
      this.seaPhoto();
      this.text('小满：“原来勇敢不一定是不害怕，\n也可以是害怕着，还是去看了日出。”\n\n旅行留影已收进手账，'+CHARMS[this.save.seaHeart.travelCharm]+'纪念挂件已添在作品上。',105,638,510,205,27,INK,this.overlay);
      this.button('看看后来这条手串',135,920,450,62,()=>{const item=this.save.collection.find((x:any)=>x.id==='sea');if(item)this.collectionPreview('把海风戴在手上',item.beads,item.charm);},this.overlay,true);
    }else if(seaVisitReady(this.save)){
      this.text('门口的风铃响了。\n小满拿着一张旅行留影，站在阳光里。',105,390,510,210,29,SAGE,this.overlay,true);
      this.button('听听她后来的故事',135,885,450,65,()=>this.seaVisit(),this.overlay,true);
    }else{
      const facts=this.save.seaHeart.facts.map((id:string)=>SEA_QUESTIONS.find(q=>q.id===id)?.detail).join('\n\n');
      this.text(facts||'先完成第一份委托，再听小满聊聊她的第一次独自旅行。',105,360,510,300,27,INK,this.overlay);
      this.text(this.save.completed.includes('sea')?'她已经出发。完成“温柔也有力量”后，留意门口的风铃。':'听过的话、写下的祝福，都会留在这里。',105,720,510,120,24,MUTED,this.overlay,true);
      if(this.save.completed.includes('daisy'))this.button('重温出发前的聊天',135,928,450,60,()=>this.seaChat(),this.overlay);
    }
  }
  private matchIntro() {
    if(this.busy)return;this.dialog('intro','珠材花园');
    this.text('交换相邻珠子\n同色横竖三颗，或 2×2 方块即可收集。\n\n16 步内完成目标，收获六色珠材包。\n每关赠送小木槌、花开十字与重新排珠。\n提示免费，工具不扣步数。',100,345,520,390,27,INK,this.overlay,true);
    this.text(`本关目标 ${rules.targetForLevel(this.save.level)} 颗 · 消耗 1 体力`,100,770,520,60,25,SAGE,this.overlay,true);
    this.button('开始采珠',130,880,460,72,()=>this.startMatch(),this.overlay,true);
  }
  private startMatch() {
    this.save=rules.refreshEnergy(this.save);if(this.save.energy<1)return this.toast('体力不足，稍等一会儿，或先去做手串。');
    this.returnScreen=this.screen==='match'?this.returnScreen:this.screen;this.save.energy--;this.save.energyAt=Date.now();this.persist();
    this.session=rules.newSession(Date.now()%1000000,this.save.level);this.selected=-1;this.tool='';this.hint=[];this.closeModal();this.screen='match';this.render();
  }
  private boardPos(i: number, edited=true) {
    const x=48+(i%8)*78,y=440+Math.floor(i/8)*78;
    const template=edited?this.layouts.get(layoutKey('match',x,y,72,72,new Map())):null;
    return template?template.position.clone():new Vec3(x,-y,0);
  }
  private match() {
    const s=this.session;if(!s){this.screen='home';this.home();return;}
    this.text('让灵感，一颗颗绽放',38,104,644,52,32,INK,this.page,true);
    this.image('pencil-match-banner',38,163,644,218);
    this.rect('Match status paper',39,385,642,43,'#fff8e7',this.page,8,'#c6ae86');
    this.text('步数 '+s.moves,54,386,180,42,26,SAGE);
    this.text('采集 '+rules.total(s.collected)+' / '+s.target,281,386,380,42,26,INK,this.page,true);
    this.rect('Board frame',39,430,642,642,'#e6d8be',this.page,20,'#ad8a60');
    s.board.forEach((type: number,i: number)=>{
      const p=this.boardPos(i,false),n=this.rect('Cell '+i,p.x,-p.y,72,72,this.selected===i||this.hint.includes(i)?'#ffe4a6':'#f9f1df',this.page,15,this.selected===i||this.hint.includes(i)?GOLD:'#ddccb0');
      this.image('bead-'+type,1,1,70,70,n);this.boardNodes.push(n);this.bindBoard(n,i);
      this.accessibleButton(`${this.hint.includes(i)?'提示格 ':''}第${Math.floor(i/8)+1}行第${i%8+1}列 ${BEADS[type].name}`,()=>this.boardClick(i));
    });
    s.collected.forEach((count: number,i: number)=>{this.image('bead-'+i,44+i*109,1080,43,43);this.text(String(count),88+i*109,1083,53,38,21);});
    ['hammer','bloom','shuffle','hint'].forEach((id,i)=>{
      const names=['小木槌','花开十字','重新排珠','灵感提示'];
      this.button(names[i]+(id==='hint'?'':` ${s.tools[id]}`),38+i*165,1137,149,60,()=>this.selectTool(id),this.page,this.tool===id,id==='hint'||s.tools[id]>0);
    });
    this.text(this.tool?this.tool==='hammer'?'点一颗珠子，使用小木槌':'点一颗珠子，收集整行整列':'拖动相邻珠子 · 三连或 2×2 同色方块可消',38,1200,644,34,20,MUTED,this.page,true);
    this.button('暂停',280,1235,160,40,()=>this.pauseMatch());
  }
  private bindBoard(n: Node,i: number) {
    let start: Vec3|null=null,didSwipe=false;
    n.on(Node.EventType.TOUCH_START,(e: EventTouch)=>{if(this.modal)return;start=this.localPoint(e);didSwipe=false;});
    n.on(Node.EventType.TOUCH_MOVE,(e: EventTouch)=>{
      if(!start||didSwipe||this.tool)return;const p=this.localPoint(e),dx=p.x-start.x,dy=p.y-start.y;
      if(Math.max(Math.abs(dx),Math.abs(dy))<28)return;didSwipe=true;
      const j=i+(Math.abs(dx)>Math.abs(dy)?dx>0?1:-1:dy>0?-8:8);if(rules.adjacent(i,j))this.swap(i,j);
    });
    n.on(Node.EventType.TOUCH_END,()=>{if(start&&!didSwipe)this.boardClick(i);start=null;});
    n.on(Node.EventType.TOUCH_CANCEL,()=>{start=null;});
  }
  private boardClick(i: number) {
    if(this.modal||this.session?.status!=='playing')return;
    if(this.busy){this.queued=[i];return;}
    if(this.tool){const id=this.tool;this.tool='';this.resolve(rules.useTool(this.session,id,i));return;}
    if(this.selected>=0&&rules.adjacent(this.selected,i)){this.swap(this.selected,i);return;}
    this.selected=this.selected===i?-1:i;this.hint=[];this.render();this.play();
  }
  private selectTool(id: string) {
    if(this.busy||this.modal||this.session?.status!=='playing')return;
    if(id==='hint'){this.hint=rules.findMove(this.session.board)||[];this.selected=-1;this.render();return;}
    if(id==='shuffle'){this.resolve(rules.useTool(this.session,id));return;}
    this.tool=this.tool===id?'':id;this.render();
  }
  private async swap(a: number,b: number) {
    if(this.modal||!rules.adjacent(a,b)||this.session?.status!=='playing')return;
    if(this.busy){this.queued=[a,b];return;}
    const result=rules.move(this.session,a,b);
    if(!result.valid){
      this.setBusy(true);
      await Promise.all([this.animate(this.boardNodes[a],this.boardPos(b),.16),this.animate(this.boardNodes[b],this.boardPos(a),.16)]);
      await Promise.all([this.animate(this.boardNodes[a],this.boardPos(a),.16),this.animate(this.boardNodes[b],this.boardPos(b),.16)]);
      this.setBusy(false);this.selected=-1;this.render();this.toast('这两颗还不能消除，再试试其他相邻珠子。');this.consumeInput();return;
    }
    await this.resolve(result,[a,b]);
  }
  private animate(n: Node,position: Vec3,duration: number,scale?: Vec3) {
    return new Promise<void>(resolve=>{
      if(!n?.isValid){resolve();return;}
      if(this.save.reduced){n.setPosition(position);if(scale)n.setScale(scale);resolve();return;}
      tween(n).to(duration,scale?{position,scale}:{position},{easing:'quadInOut'}).call(resolve).start();
    });
  }
  private async resolve(result: any,pair?: number[]) {
    if(!result.valid)return this.toast('这个工具已经用完了。');
    this.setBusy(true);this.selected=-1;this.hint=[];
    if(pair){await Promise.all([this.animate(this.boardNodes[pair[0]],this.boardPos(pair[1]),.18),this.animate(this.boardNodes[pair[1]],this.boardPos(pair[0]),.18)]);
      [this.boardNodes[pair[0]],this.boardNodes[pair[1]]]=[this.boardNodes[pair[1]],this.boardNodes[pair[0]]];}
    const frames=result.frames||[];
    for(let chain=0;chain<frames.length;chain++){
      const frame=frames[chain];
      this.play('clear');
      await Promise.all(frame.hit.map((i:number)=>this.animate(this.boardNodes[i],this.boardPos(i),.13,new Vec3(.02,.02,1))));
      frame.hit.forEach((i:number)=>this.boardNodes[i].destroy());
      const next: Node[]=[], tasks: Promise<void>[]=[];
      frame.falls.forEach((fall:any)=>{
        let n=fall.from===null?null:this.boardNodes[fall.from];
        if(!n?.isValid){const pos=this.boardPos(fall.to);n=this.rect('Falling bead',pos.x,440+fall.fromRow*78,72,72,'#f9f1df',this.page,15);this.image('bead-'+fall.type,1,1,70,70,n);this.bindBoard(n,fall.to);}
        else {n.off(Node.EventType.TOUCH_START);n.off(Node.EventType.TOUCH_MOVE);n.off(Node.EventType.TOUCH_END);n.off(Node.EventType.TOUCH_CANCEL);this.bindBoard(n,fall.to);}
        next[fall.to]=n;tasks.push(this.animate(n,this.boardPos(fall.to),.2+Math.max(0,Math.floor(fall.to/8)-fall.fromRow)*.035));
      });
      this.boardNodes=next;await Promise.all(tasks);this.play('land');
      if(chain>0)this.toast(`${chain+1} 连消 · 收获 ${frame.hit.length} 颗灵感`);
    }
    this.session=result.session;this.setBusy(false);this.render();
    if(this.session.status==='playing')this.consumeInput();else{this.queued=null;this.result();}
  }
  private consumeInput() { const q=this.queued;this.queued=null;if(q?.length===2)this.swap(q[0],q[1]);else if(q?.length===1)this.boardClick(q[0]); }
  private result() {
    const won=this.session.status==='won';this.dialog('result',won?'珠材，已经满载而归':'还差一点灵感');
    this.text(won?'六色珠材包已备好，回工坊串珠吧。':'这一次没有完成采集目标。\n已采集的珠子不会扣除现有库存。',100,340,520,130,27,INK,this.overlay,true);
    if(won){const pack=this.session.collected.map((n:number,i:number)=>n+(i===0?8:6));pack.forEach((n:number,i:number)=>{this.image('bead-'+i,145+(i%3)*164,510+Math.floor(i/3)*135,80,80,this.overlay);this.text('+'+n,140+(i%3)*164,592+Math.floor(i/3)*135,90,40,24,SAGE,this.overlay,true);});}
    this.button(won?'收好珠材':'重新采珠 · 1 体力',130,865,460,70,()=>won?this.claim():this.startMatch(),this.overlay,true);
    if(!won)this.button('回到小店',130,958,460,56,()=>{this.session=null;this.navigate(this.returnScreen);},this.overlay);
  }
  private claim() {
    if(this.session?.status!=='won'||this.session.claimed)return;
    this.session.claimed=true;this.save.inventory=this.save.inventory.map((n:number,i:number)=>n+this.session.collected[i]+(i===0?8:6));this.save.level++;this.persist();this.play('success');this.session=null;this.navigate(this.returnScreen);this.toast('珠材已收好，来串一份心意吧。');
  }
  private pauseMatch() {
    if(this.busy)return;this.dialog('pause','在花园歇一会儿');
    this.text('本局进度保留在当前游戏中。\n离开采珠不返还已经消耗的体力。',100,430,520,150,28,INK,this.overlay,true);
    this.button('继续采珠',130,690,460,70,()=>this.closeModal(),this.overlay,true);
    this.button('离开花园',130,794,460,60,()=>{this.session=null;this.navigate(this.returnScreen);},this.overlay);
  }
  private drawRoom() {
    const p=this.save.renovation.repairs;
    this.ellipse('Room contact shadow',360,625,293,58,'#846d4020');
    this.polygon('Left plaster wall',[[58,404],[360,282],[360,440],[58,562]],p.wall?'#eee1c8':'#d3c3a4');
    this.polygon('Right plaster wall',[[360,282],[662,404],[662,562],[360,440]],p.wall?'#e5d4b5':'#c4b494');
    this.polygon('Floor foundation',[[58,562],[360,440],[662,562],[662,576],[360,698],[58,576]],'#9b7e5d');
    this.polygon('Wood floor',[[58,562],[360,440],[662,562],[360,684]],p.floor?'#dbbf92':'#bba582');
    this.image('pencil-plaster',0,270,720,430);
    this.image('pencil-floor',58,440,604,244).getComponent(Sprite)!.color=color(p.floor?'#e5cba0':'#bda98b');
    this.polygon('Left wall coping',[[52,398],[360,273],[369,279],[61,404]],'#c6a580');
    this.polygon('Right wall coping',[[360,273],[668,398],[659,404],[351,279]],'#c6a580');
    const g=this.box('Pencil room grain',0,0,720,1280).addComponent(Graphics);
    g.strokeColor=color('#9f805558');g.lineWidth=1.3;
    for(let i=1;i<9;i++){
      const t=i/9;g.moveTo(58+302*t,-(562-122*t));g.lineTo(360+302*t,-(684-122*t));
      g.moveTo(58+302*t,-(562+122*t));g.lineTo(360+302*t,-(440+122*t));
    }g.stroke();
    g.strokeColor=color('#ac9375');g.lineWidth=4;
    g.moveTo(58,-551);g.lineTo(360,-429);g.lineTo(662,-551);g.moveTo(360,-283);g.lineTo(360,-429);g.stroke();
    if(!p.wall){g.strokeColor=color('#927959');g.lineWidth=2;g.moveTo(105,-405);g.lineTo(118,-432);g.lineTo(109,-458);g.lineTo(130,-480);g.moveTo(605,-419);g.lineTo(588,-443);g.lineTo(600,-478);g.stroke();}
    this.polygon('Window oak frame',[[153,385],[300,326],[300,432],[153,491]],'#b79b74');
    this.polygon('Window glass',[[162,390],[291,338],[291,424],[162,476]],p.window?'#caddd0':'#a7b6aa');
    this.polygon('Window mullion',[[224,365],[230,363],[230,450],[224,452]],'#b79b74');
    this.polygon('Window crossbar',[[162,429],[291,377],[291,383],[162,435]],'#b79b74');
    if(p.window){
      this.polygon('Curtain left',[[146,380],[170,370],[170,467],[153,489]],'#97ab87');
      this.polygon('Curtain right',[[282,325],[307,315],[307,424],[291,444]],'#97ab87');
      this.polygon('Afternoon sunlight',[[175,520],[281,478],[408,534],[301,578]],'#f9e8b750',this.page,'#f9e8b750');
    }else{const crack=this.box('Window crack',0,0,720,1280).addComponent(Graphics);crack.strokeColor=color('#778377');crack.lineWidth=2;crack.moveTo(191,-382);crack.lineTo(206,-410);crack.lineTo(190,-445);crack.stroke();}
    const deskTier=this.save.upgrades.desk,displayTier=this.save.upgrades.display;
    this.polygon('Display cabinet side',[[549,409],[575,397],[575,533],[549,545]],'#998363');
    this.polygon('Display cabinet face',[[427,360],[549,409],[549,545],[427,496]],displayTier?'#b4ad8a':'#a18c6e');
    this.polygon('Display cabinet top',[[427,360],[453,348],[575,397],[549,409]],'#cebd99');
    for(let i=0;i<2;i++){
      const y=377+i*60;
      this.polygon('Cabinet pane',[[438,y],[538,y+40],[538,y+82],[438,y+42]],displayTier?'#d1d9c7':'#bdac8d');
      if(displayTier){this.image('bead-'+i,454,y+5,23,23);this.image('charm-daisy',500,y+26,23,23);}
    }
    if(displayTier===2)this.polygon('Cabinet crown',[[424,357],[485,368],[552,406],[552,415],[424,363]],'#d4bd83');
    this.ellipse('Desk shadow',300,567,107,30,'#6a59302a');
    for(const [x,y] of [[213,509],[299,546],[384,513]])this.polygon('Desk leg',[[x,y],[x+10,y+4],[x+8,y+72],[x,y+68]],'#9d805e');
    this.polygon('Desk front',[[194,494],[302,538],[302,554],[194,510]],'#b29570');
    this.polygon('Desk right',[[302,538],[401,498],[401,514],[302,554]],'#987c5b');
    this.polygon('Worktop',[[194,494],[293,454],[401,498],[302,538]],deskTier?'#dbc9a3':'#bda17c');
    if(deskTier){
      this.polygon('Beading mat',[[229,492],[285,469],[359,500],[303,522]],'#f2e5c7');
      this.ellipse('Desk bracelet',291,495,25,11,'#c7bd9e',this.page,'#9c956f');
      this.image('bead-0',268,480,21,21);this.image('bead-3',300,488,20,20);
    }
    if(deskTier===2){this.image('charm-moon',342,492,22,26);this.polygon('Sketchbook',[[218,491],[244,481],[264,489],[238,500]],'#fcf5e6');}
    this.ellipse('Chair shadow',168,586,49,17,'#66543025');
    this.image(FURNITURE[0].art[this.save.upgrades.chair],121,465,104,151);
    const spotPositions:Record<string,number[]>={
      'box-left':[148,585],'box-right':[531,585],'papers':[371,630],
      'glass-1':[195,391],'glass-2':[259,366],'glass-3':[195,436],'glass-4':[259,411],
      'dust-1':[103,563],'dust-2':[252,610],'dust-3':[451,620],'dust-4':[599,558],
    };
    CLEAN_SPOTS.forEach(spot=>{
      if(this.save.renovation.cleared.includes(spot.id))return;
      const [cx,cy]=spotPositions[spot.id],x=cx-31,y=cy-24;
      const n=this.rect('Clean '+spot.id,x,y,62,48,spot.kind==='clutter'?'#b89b6d':'#8d826797',this.page,spot.kind==='clutter'?4:23);
      this.text(spot.kind==='clutter'?'▧':'✦',0,0,62,48,28,'#f8e7bb',n,true);
      let elapsed=0,done=false;
      const clean=()=>{if(done||this.modal)return;done=true;const next=rules.cleanSpot(this.save,spot.id);if(next){this.save=next;this.persist();this.play('land');n.active=false;this.scheduleOnce(()=>this.render(),0);}};
      const scrub=()=>{elapsed+=.1;if(elapsed>=.55){this.unschedule(scrub);clean();}};
      n.on(Node.EventType.TOUCH_START,()=>{elapsed=0;if(spot.kind!=='clutter')this.schedule(scrub,.1);});
      n.on(Node.EventType.TOUCH_MOVE,()=>{elapsed+=.14;if(elapsed>.45)clean();});
      n.on(Node.EventType.TOUCH_END,()=>{this.unschedule(scrub);clean();});
      n.on(Node.EventType.TOUCH_CANCEL,()=>{this.unschedule(scrub);});
      this.accessibleButton(spot.name,clean);
    });
  }
  private decor() {
    const progress=rules.shopProgress(this.save);
    this.title('A LITTLE HOME, A LITTLE AT A TIME','把小店，慢慢变成家',progress.stage+' · 焕新 '+progress.percent+'%');
    this.drawRoom();
    this.text(`免费打扫 ${progress.cleaned}/${CLEAN_SPOTS.length} · 点杂物，按住或划动擦拭灰尘`,38,691,644,48,21,SAGE,this.page,true);
    REPAIRS.forEach((r,i)=>{
      const done=this.save.renovation.repairs[r.id];
      this.button(done?r.result:r.title+' · '+r.price+' 金',38+i*219,753,206,66,()=>{
        const next=rules.repairShop(this.save,r.id);if(!next)return this.toast(!rules.isShopClean(this.save)?'先把杂物与灰尘清理干净。':'金币还不够，完成委托再来吧。');
        this.save=next;this.persist();this.play('success');this.render();
      },this.page,false,!done);
    });
    FURNITURE.forEach((f,i)=>{
      const tier=this.save.upgrades[f.id],y=847+i*103;
      this.rect('Furniture '+f.id,38,y,644,89,'#fffaf0',this.page,14,'#dfd1b6');
      this.text(f.title,58,y+6,400,34,26);
      this.text(f.names[tier],58,y+45,392,30,20,MUTED);
      this.button(tier===2?'已升满':'升级 '+f.prices[tier+1]+' 金',484,y+20,178,50,()=>{
        const next=rules.purchase(this.save,f.id,tier+1);if(!next)return this.toast(!rules.isShopClean(this.save)?'先打扫干净，再把新家具请进来。':'金币不足，去完成一份委托吧。');
        this.save=next;this.persist();this.play('success');this.render();this.toast('家具已摆好，手账里多了一段生活支线。');
      },this.page,true,tier<2);
    });
    this.button('查看生活支线',180,1164,360,28,()=>this.navigate('journal'));
  }
  private album() {
    const repeat=this.albumRepeat&&this.save.repeatCollection.length>0,collection=repeat?this.save.repeatCollection:this.save.collection;
    this.title('EVERY BRACELET TELLS A STORY','认真做过的，都在这里');
    this.text(repeat?'回头客最近六份作品':'剧情作品 '+this.save.collection.length+'/6',38,215,350,46,21,MUTED);
    if(this.save.repeatCollection.length)this.button(repeat?'查看剧情作品':'查看回头客作品',406,215,276,46,()=>{this.albumRepeat=!repeat;this.render();});
    if(!collection.length){this.image('delivery-album',80,360,560,360);this.text('完成第一份委托，\n把我们的第一束光留在这里。',100,780,520,120,29,MUTED,this.page,true);return;}
    collection.forEach((item:any,i:number)=>{
      const title=(repeat?RETURN_ORDERS:ORDERS).find(o=>o.id===item.id)!.name;
      const x=38+(i%2)*332,y=290+Math.floor(i/2)*291;
      const n=this.rect('Collection '+item.id,x,y,312,271,'#fffaf0',this.page,16,'#dfd1b6');
      this.bracelet(item.beads,156,114,82,n);
      this.text(title,12,215,288,40,24,INK,n,true);
      n.on(Node.EventType.TOUCH_END,()=>this.collectionPreview(title,item.beads,item.charm));
      this.accessibleButton('欣赏'+title,()=>this.collectionPreview(title,item.beads,item.charm));
    });
    this.button('我们的故事与回忆手账',90,1170,540,24,()=>this.navigate('journal'));
  }
  private collectionPreview(title:string,beads:number[],charm:string) {
    this.dialog('collection',title);this.bracelet(beads,360,560,198,this.overlay);this.image('charm-'+charm,338,752,44,44,this.overlay);this.text(CHARMS[charm]+'吊坠 · 阿禾手作',130,817,460,62,28,SAGE,this.overlay,true);
    if(title==='把海风戴在手上'){
      const item=this.save.collection.find((x:any)=>x.id==='sea');
      if(item?.travelCharm)this.image('charm-'+item.travelCharm,476,692,43,48,this.overlay);
      if(item?.gift){const card=SEA_BLESSINGS.find(b=>b.id===item.gift.blessing)!;this.text('祝福：'+card.text,100,890,520,48,23,INK,this.overlay,true);this.text((SEA_PAPERS.find(p=>p.id===item.gift.paper)?.name||'')+' · '+(SEA_RIBBONS.find(r=>r.id===item.gift.ribbon)?.name||''),100,945,520,35,21,MUTED,this.overlay,true);}
    }
  }
  private journal() {
    this.title('OUR STORY, IN OUR OWN WORDS','把自己的名字，写进明天',`${this.save.seenStories.length}/${STORIES.length} 段已读 · 重温不会重复发放奖励`);
    const journey=JOURNEY[Math.min(6,this.save.completed.length)];
    this.rect('Current chapter',38,283,644,164,'#e8ecde');
    this.text(journey.title,58,297,604,38,27,SAGE);
    this.text(journey.pressure+'\n'+journey.goal,58,340,604,94,21,INK);
    const start=this.journalPage*5;
    STORIES.slice(start,start+5).forEach((s,offset)=>{
      const i=start+offset,y=470+offset*119,unlocked=storyUnlocked(this.save,s),read=this.save.seenStories.includes(s.id);
      this.rect('Story '+s.id,38,y,644,104,'#fffaf0',this.page,14,'#dfd1b6');
      this.text((read?'已读':unlocked?'未读':'待解锁')+' · '+s.title,55,y+4,605,41,25,unlocked?INK:MUTED);
      this.button(unlocked?'阅读 / 重温':'完成对应委托或升级家具',55,y+52,s.evidence&&read?334:605,40,()=>this.startStory(i),this.page,false,unlocked);
      if(s.evidence&&read)this.button('收好相关记录',404,y+52,257,40,()=>this.info(s.evidence.title,s.evidence.text));
    });
    this.button(this.journalPage?'← 前五段':'后五段 →',180,1095,360,50,()=>{this.journalPage=this.journalPage?0:1;this.render();});
    this.button(this.save.seaHeart.visited?'旅行留影 · 小满的第一次独行':seaVisitReady(this.save)?'小满回来了 · 听听后来的故事':'海风订单 · 心意聊天与回访',38,1155,644,35,()=>this.seaRecord());
  }
  private dialog(id: string,title: string) {
    this.stopVideo();this.clear(this.overlay);this.modal=id;
    this.accessibility?.showDialog(title);
    const blocker=this.rect('Modal backdrop',0,0,720,1280,'#403a2cc4',this.overlay,0);blocker.addComponent(BlockInputEvents);
    this.rect('Dialog paper',60,230,600,820,PAPER,this.overlay,26,'#c7b18b');
    this.text(title,94,253,478,70,32,INK,this.overlay);
    this.button('×',579,250,58,54,()=>this.dismiss(),this.overlay);
  }
  private closeModal() { this.stopVideo();this.clear(this.overlay);this.modal='';this.accessibility?.closeDialog(); }
  private dismiss() {
    if(this.modal==='result'){if(this.session?.status==='won')this.claim();else{this.session=null;this.navigate(this.returnScreen);}return;}
    this.closeModal();
  }
  private info(title:string,body:string) {
    this.dialog('info',title);this.text(body,100,355,520,480,28,INK,this.overlay,true);this.button('收好了',150,899,420,62,()=>this.closeModal(),this.overlay,true);
  }
  private inventory() {
    this.dialog('inventory','奶奶的珠材盒');const counts=rules.draftCounts(this.save.draft);
    BEADS.forEach((b,i)=>{const y=349+i*84;this.image('bead-'+i,110,y,64,64,this.overlay);this.text(b.name,195,y+8,250,48,27,INK,this.overlay);this.text(`${this.save.inventory[i]}  /  草稿 ${counts[i]}`,440,y+8,175,48,23,SAGE,this.overlay,true);});
    this.button('去花园采珠',150,914,420,64,()=>this.matchIntro(),this.overlay,true);
  }
  private settings() {
    this.dialog('settings','让小店，按自己的节奏');
    this.button('声音  '+(this.save.sound?'开启':'关闭'),110,355,500,64,()=>{this.save.sound=!this.save.sound;this.persist();this.settings();},this.overlay);
    this.button('减少动态效果  '+(this.save.reduced?'开启':'关闭'),110,441,500,64,()=>{this.save.reduced=!this.save.reduced;this.persist();this.settings();},this.overlay);
    this.button('导出 / 导入存档',110,527,500,64,()=>this.saveDialog(),this.overlay);
    this.button('玩法说明',110,613,500,64,()=>this.info('小店的日常','采珠：交换相邻珠子，三连或 2×2 同色方块可消。\n手作：点珠材入槽，拖动换位，选吊坠后交付。\n装修：先免费打扫，再用金币修屋与添置家具。\n故事：委托推进主线，家具解锁支线。\n电脑：Esc 返回，F 全屏；方向键、空格操作棋盘。'),this.overlay);
    this.button('我们的故事',110,699,500,64,()=>this.navigate('journal'),this.overlay);
    this.button('重新开始',110,871,500,60,()=>this.resetDialog(),this.overlay);
    this.text('Cocos 原生版 · 本地自动存档\n原网页存档可通过 JSON 导入继续',110,952,500,66,20,MUTED,this.overlay,true);
  }
  private saveDialog() {
    this.dialog('save','带上我们的日子');
    this.text('复制下方文本可备份；粘贴原网页导出的存档后点导入。',100,335,520,83,23,MUTED,this.overlay);
    const area=this.rect('Save field',100,434,520,365,'#fffcf5',this.overlay,12,'#c7b18b');
    const edit=area.addComponent(EditBox);
    const label=this.text('',16,12,488,341,18,INK,area);edit.textLabel=label;
    const placeholder=this.text('粘贴存档 JSON',16,12,488,341,18,MUTED,area);edit.placeholderLabel=placeholder;
    edit.inputMode=EditBox.InputMode.ANY;edit.maxLength=50000;edit.string=JSON.stringify(this.save);
    this.accessibility?.input(edit.string,value=>{edit.string=value;});
    this.button('导入这份进度',130,856,460,64,()=>{
      try{
        const parsed=JSON.parse(edit.string);
        if(!parsed||parsed.version!==1||!Array.isArray(parsed.inventory)||parsed.inventory.length!==6||!Array.isArray(parsed.completed))throw new Error('invalid');
        const normalized=rules.refreshEnergy(rules.normalizeSave(parsed));
        this.dialog('import-confirm','使用这份存档？');
        this.text(`剧情委托 ${normalized.completed.length}/6 · 回头客 ${normalized.repeatOrders} 单\n金币 ${normalized.coins} · 体力 ${normalized.energy}\n导入将替换本机当前进度。`,100,425,520,220,28,INK,this.overlay,true);
        this.button('确认导入',130,820,460,70,()=>{this.save=normalized;this.session=null;this.undo=[];this.contestUndo=[];this.persist();this.navigate(this.save.started?'home':'cover');this.toast('进度已导入。');},this.overlay,true);
      }catch{this.toast('这份存档格式不正确，请粘贴完整的 JSON。');}
    },this.overlay,true);
  }
  private resetDialog() {
    this.dialog('reset','重新打开旧珠盒？');
    this.text('这会清空当前设备的游戏进度。\n建议先在设置中导出存档。',100,430,520,160,29,INK,this.overlay,true);
    this.button('保留进度',130,719,460,64,()=>this.closeModal(),this.overlay,true);
    this.button('确认重新开始',130,823,460,64,()=>{this.save=rules.freshSave();this.session=null;this.undo=[];this.contestUndo=[];this.persist();this.navigate('cover');},this.overlay);
  }
  private startStory(index: number) {
    const s=STORIES[index];if(!s||!storyUnlocked(this.save,s))return;
    this.storyIndex=index;this.storyLine=0;
    const media=this.media[s.id];
    if(media?.src&&/^videos\/[a-zA-Z0-9_\-/]+\.mp4$/.test(media.src))this.storyVideo(media);
    else this.storyText();
  }
  private storyText() {
    const s=STORIES[this.storyIndex],line=s.lines[this.storyLine];this.dialog('story',s.title);
    this.image('pencil-counter',85,330,550,315,this.overlay);
    if(['阿禾','奶奶'].includes(line[0]))this.image(line[0]==='阿禾'?'girl':'grandma',104,502,122,140,this.overlay);
    this.text(line[0],110,667,500,46,29,SAGE,this.overlay);
    this.text(line[1],110,724,500,163,27,INK,this.overlay);
    this.text(`${this.storyLine+1} / ${s.lines.length}`,110,954,160,40,20,MUTED,this.overlay);
    this.button(this.storyLine===s.lines.length-1?'收好这一页':'下一句  →',315,941,292,60,()=>{
      if(this.storyLine<s.lines.length-1){this.storyLine++;this.storyText();}
      else{this.save=finishStory(this.save,s.id);this.persist();this.closeModal();this.render();if(s.evidence)this.toast('已收入手账：'+s.evidence.title);}
    },this.overlay,true);
  }
  private storyVideo(media:any) {
    const id=STORIES[this.storyIndex].id;this.dialog('story',STORIES[this.storyIndex].title);
    this.text('点击开始播放，或阅读完整文字剧情。',100,785,520,60,24,MUTED,this.overlay,true);
    const videoNode=this.box('Story video',95,344,530,372,this.overlay);this.video=videoNode.addComponent(VideoPlayer);
    this.video.resourceType=VideoPlayer.ResourceType.LOCAL;
    videoNode.on(VideoPlayer.EventType.COMPLETED,()=>{this.save=finishStory(this.save,id);this.persist();this.closeModal();this.render();});
    videoNode.on(VideoPlayer.EventType.ERROR,()=>{this.storyText();this.toast('视频暂时无法播放，已打开完整文字。');});
    this.videoSubtitle=this.text('',100,713,520,70,24,INK,this.overlay,true);
    const clipPath=media.src.replace(/\.mp4$/,'');
    resources.load(clipPath,VideoClip,(err,clip)=>{
      if(this.modal!=='story'||!this.video?.isValid)return;
      if(err){this.storyText();return;}this.video.clip=clip;
    });
    this.captions=Array.isArray(media.captions)?media.captions.filter((c:any)=>typeof c.text==='string'&&Number.isFinite(c.start)&&Number.isFinite(c.end)):[];
    this.button('开始播放',120,868,220,62,()=>this.video?.play(),this.overlay,true);
    this.button('阅读文字',375,868,220,62,()=>{this.storyLine=0;this.storyText();},this.overlay);
  }
  update() {
    if(this.video&&this.videoSubtitle&&this.captions.length){const t=this.video.currentTime,c=this.captions.find(c=>t>=c.start&&t<c.end);this.videoSubtitle.string=c?.text||'';}
  }
  private stopVideo() { if(this.video?.isValid)this.video.stop();this.video=null;this.videoSubtitle=null;this.captions=[]; }
  private onKey(e: any) {
    if(typeof document!=='undefined'&&(/^(INPUT|TEXTAREA)$/.test(document.activeElement?.tagName||'')||document.activeElement?.closest('#atelier-accessibility')))return;
    if(e.keyCode===KeyCode.ESCAPE){if(this.modal)this.dismiss();else if(this.screen==='match')this.pauseMatch();else this.navigate(this.screen==='contestCraft'?'contest':'home');return;}
    if(e.keyCode===KeyCode.KEY_F){if(displayScreen.fullScreen())displayScreen.exitFullScreen();else displayScreen.requestFullScreen();return;}
    if(this.screen!=='match'||this.modal||this.busy)return;
    const offsets:Record<number,number>={[KeyCode.ARROW_LEFT]:-1,[KeyCode.ARROW_RIGHT]:1,[KeyCode.ARROW_UP]:-8,[KeyCode.ARROW_DOWN]:8};
    if(offsets[e.keyCode]!==undefined){const next=this.keyboardCursor+offsets[e.keyCode];if(rules.adjacent(this.keyboardCursor,next)){this.keyboardCursor=next;this.selected=next;this.hint=this.keyboardArmed<0?[]:[this.keyboardArmed];this.render();}}
    if(e.keyCode===KeyCode.SPACE||e.keyCode===KeyCode.ENTER){
      if(this.tool){this.boardClick(this.keyboardCursor);return;}
      if(this.keyboardArmed>=0&&rules.adjacent(this.keyboardArmed,this.keyboardCursor)){const a=this.keyboardArmed;this.keyboardArmed=-1;this.swap(a,this.keyboardCursor);}
      else{this.keyboardArmed=this.keyboardCursor;this.selected=this.keyboardCursor;this.hint=[];this.render();}
    }
  }
}
