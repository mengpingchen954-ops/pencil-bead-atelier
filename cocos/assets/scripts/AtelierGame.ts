import {
  _decorator, Component, Node, UITransform, Graphics, Color, Label, Sprite,
  SpriteFrame, resources, Canvas, Camera, Layers, view, ResolutionPolicy,
  Vec3, tween, Tween, AudioSource, AudioClip, BlockInputEvents, EventTouch,
  input, Input, KeyCode, sys, game, Game, EditBox, JsonAsset, VideoPlayer,
  VideoClip, UIOpacity, Mask, screen as displayScreen,
} from 'cc';
import { BEADS, ORDERS, RETURN_ORDERS, CHAPTERS, STORIES, JOURNEY, FURNITURE, CHARMS, CLEAN_SPOTS, REPAIRS } from './content';
import * as rules from './model';
import { pendingStory, storyUnlocked, finishStory, STORY_STOPS, storyRoute } from './story';
import { BrowserAccessibility } from './BrowserAccessibility';
import { AtelierLayout } from './AtelierLayout';
import { layoutKey } from './layout-key';
import { MUSIC_TRACKS } from './music-settings';
import { BackgroundMusic } from './BackgroundMusic';
import { COMPETITIONS, beginCompetition, submitCompetition, evaluateCompetition, competitionPalette } from './competition';
import { SEA_QUESTIONS, SEA_BLESSINGS, SEA_PAPERS, SEA_RIBBONS, askSea, chooseSeaGift, seaVisitReady, finishSeaVisit, seaResponse } from './heart';
import { characterMemories } from './memories';

const { ccclass } = _decorator;
const PAPER = '#f7f0df', INK = '#594d3f', SAGE = '#627351', MUTED = '#7a6b57', GOLD = '#826637';
const BOARD_Y = 340, CELL = 78;
const color = (hex: string) => new Color().fromHEX(hex);
// A damped spring reaches the wire, recoils, and settles without rotating the artwork.
export function craftSpring(t:number) {
  if(t<=0)return 0;if(t>=1)return 1;
  const seconds=t*.64;
  return 1-Math.exp(-11*seconds)*(Math.cos(17*seconds)+11/17*Math.sin(17*seconds));
}
type Page = 'cover' | 'home' | 'orders' | 'orderArrival' | 'craft' | 'match' | 'decor' | 'album' | 'journal' | 'contest' | 'contestCraft' | 'delivery' | 'dialogue' | 'memories' | 'packing' | 'storyMap';

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
  private music: BackgroundMusic;
  private session: any = null;
  private selected = -1;
  private slot = -1;
  private craftMaterial = 0;
  private craftMotion: Node;
  private craftFlights = new Map<number,{node:Node;type:number}>();
  private craftRipples = new WeakSet<Node>();
  private tool = '';
  private hint: number[] = [];
  private busy = false;
  private undo: any[] = [];
  private contestUndo: any[] = [];
  private boardNodes: Node[] = [];
  private obstacleNodes: Node[] = [];
  private goalLabels: Label[] = [];
  private movesLabel: Label | null = null;
  private slotNodes: Node[] = [];
  private modal = '';
  private musicFromPause = false;
  private orderGuide = true;
  private storyIndex = 0;
  private storyLine = 0;
  private dialogueState: { title:string; speaker:string; text:string } | null = null;
  private recordReturn: (()=>void) | null = null;
  private journalPage = 0;
  private ordersPage = 0;
  private memoryId = 'grandma';
  private memoryIndex = -1;
  private albumRepeat = false;
  private albumChapter = -1;
  private albumSearch = '';
  private albumQuery = '';
  private selectedCollection: {id:string;repeat:boolean} | null = null;
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
    this.craftMotion = this.container('Rolling beads', root);
    this.overlay = this.container('Dialogs', root);
    this.notices = this.container('Notices', root);
    this.accessibility = new BrowserAccessibility();
    this.sound = this.node.addComponent(AudioSource);
    this.rect('Paper', 0, 0, 720, 1280, PAPER);
    this.text('正在打开奶奶的旧珠盒…', 70, 590, 580, 70, 30, SAGE, this.page, true);
    try { this.save = rules.refreshEnergy(rules.normalizeSave(JSON.parse(sys.localStorage.getItem(rules.SAVE_KEY) || 'null'))); }
    catch { this.save = rules.freshSave(); }
    this.music=new BackgroundMusic(this.node.addComponent(AudioSource),undefined,()=>this.toast('这首音乐暂时没有加载成功，请选择另一首。'));
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
    this.screen = rules.pendingDelivery(this.save) ? 'delivery' : this.save.started ? 'home' : 'cover';
    this.render();
    this.music.update(this.save.music);
    input.on(Input.EventType.KEY_DOWN, this.onKey, this);
    game.on(Game.EVENT_HIDE, this.onHide, this);
    game.on(Game.EVENT_SHOW, this.onShow, this);
    this.schedule(this.tickEnergy, 15);
    // Read-only automation/QA interface; all gameplay input uses Cocos events.
    if (typeof window !== 'undefined') (window as any).render_game_to_text = () => JSON.stringify(this.snapshot());
  }

  onDestroy() {
    this.clearCraftFlights();
    this.releaseInputs(this.node);
    input.off(Input.EventType.KEY_DOWN, this.onKey, this);
    game.off(Game.EVENT_HIDE, this.onHide, this);
    game.off(Game.EVENT_SHOW, this.onShow, this);
    this.stopVideo();
    this.music?.dispose();
    this.textures.clear();
    this.sounds.clear();
    this.accessibility?.destroy();
    view.off('canvas-resize',this.fitCamera,this);
    if (typeof window !== 'undefined') delete (window as any).render_game_to_text;
  }

  private snapshot() {
    return { engine: 'Cocos Creator 3.8.2', screen: this.screen, modal: this.modal, busy: this.busy,
      coordinates: { origin:'top-left', width:720, height:1280, board:{x:48,y:BOARD_Y,step:CELL,cell:72} },
      goals: this.session ? rules.goalProgress(this.session) : [],
      supply: this.session ? rules.goalProgress({...this.session,objectives:this.session.supplyGoals||[]}):[],
      save: this.save, session: this.session, selected: this.selected, slot: this.slot,
      delivery: rules.pendingDelivery(this.save),
      dialogue: this.dialogueState,
      incomingOrder: this.screen==='orderArrival'?{...this.currentOrder(),guide:this.orderGuide,repeatNumber:this.repeatOrder?this.save.repeatOrders+1:null,stock:this.save.inventory,deficits:this.orderMaterialDeficits(),materialNote:this.materialNeed()}:null,
      album: this.screen==='album'?this.albumView():null,
      collectionDetail: this.selectedCollection&&['collection','collection-story','collection-remake','dialogue-record'].includes(this.modal)?this.collectionView():null,
      memory: this.screen==='memories'?this.memoryView():null,
      packing: this.screen==='packing'?{orderId:this.currentOrder().id,beads:this.save.draft,charm:this.save.charm,gift:this.currentOrder().id==='sea'&&!this.repeatOrder?this.save.seaHeart.gift:null}:null,
      storyRoute: this.screen==='storyMap'?storyRoute(this.save):null,
      pause: this.modal==='pause'||this.modal==='pause-restart'||this.modal==='pause-leave'||this.musicFromPause?{context:this.screen,music:this.save.music.enabled,sound:this.save.sound,reduced:this.save.reduced}:null,
      crafting: ['craft','contestCraft'].includes(this.screen)?{orderId:this.contestEntry?null:this.currentOrder().id,contestId:this.contestEntry?.id||null,material:this.craftMaterial,beads:this.workingDraft,charm:this.workingCharm,flights:Array.from(this.craftFlights.entries()).map(([index,f])=>({index,type:f.type,x:f.node.position.x+41,y:-f.node.position.y+41,angle:f.node.angle,scale:f.node.scale.x})),slots:this.slotNodes.map(n=>{const size=n.getComponent(UITransform)!.contentSize;return {x:n.position.x+size.width/2,y:-n.position.y+size.height/2};}),materials:BEADS.map((_,i)=>({x:90+i*108,y:932}))}:null,
      music:this.music?.snapshot(),
      story: this.modal === 'story' ? { id: STORIES[this.storyIndex].id, line: this.storyLine } : null };
  }
  private onHide() { this.persist(); this.video?.pause(); this.sound.pause(); this.music?.setHidden(true); }
  private onShow() { this.tickEnergy(); this.music?.setHidden(false); }
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
  private play(name = 'tap', volume = .7) { this.music?.update(this.save.music);const clip = this.sounds.get(name); if (this.save.sound && clip) this.sound.playOneShot(clip, volume); }

  private container(name: string, parent: Node) {
    const n = new Node(name); n.layer = Layers.Enum.UI_2D; n.parent = parent;
    const t = n.addComponent(UITransform); t.setAnchorPoint(0, 1); t.setContentSize(720, 1280);
    return n;
  }
  private releaseInputs(parent: Node) {
    // Creator 3.8.2 leaves the web EditBox resize listener registered after disposal.
    parent.getComponentsInChildren(EditBox).forEach(edit=>{const impl=(edit as any)._impl;if(impl)view.targetOff(impl);});
  }
  private clear(parent: Node) {
    this.releaseInputs(parent);
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
  private button(label: string, x: number, y: number, w: number, h: number, action: () => void, parent = this.page, primary = false, enabled = true, icon = '') {
    const n = this.rect('Button: ' + label, x, y, w, h, enabled ? primary ? SAGE : '#eee5d2' : '#e6e0d2', parent, 14, primary ? '' : '#d9cab0');
    if(primary&&enabled){const g=n.getComponent(Graphics)!;g.strokeColor=color('#d8c591');g.lineWidth=1.5;g.roundRect(5,-h+5,w-10,h-10,10);g.stroke();}
    this.text(label, 10, icon?h*.46:0, w-20, icon?h*.5:h, icon&&h<60?16:23, enabled ? primary ? PAPER : INK : MUTED, n, true);
    if(icon==='preview'){
      this.ellipse('Preview eye',w/2,h*.23,20,11,'#e7eadb',n,INK);
      this.ellipse('Preview pupil',w/2,h*.23,7,9,SAGE,n,INK);
    }else if(icon)this.image(icon,(w-32)/2,3,32,h*.43,n);
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
    const y=this.screen==='match'?1131:1090,h=this.screen==='match'?66:80;
    this.rect('Toast', 40, y, 640, h, '#594d3ff2', this.notices);
    this.text(message, 55, y+4, 610, h-8, 23, PAPER, this.notices, true);
    this.scheduleOnce(() => { if (this.toastGeneration === id) this.notices.removeAllChildren(); }, 2.8);
  }
  private navigate(page: Page) {
    if (this.busy) return;
    if (page === 'match') { this.matchIntro(); return; }
    this.clearCraftFlights();
    if (page === 'orderArrival') this.orderGuide = true;
    if (page === 'orders') this.ordersPage = Math.floor((this.repeatOrder ? this.save.repeatOrders % ORDERS.length : Math.min(this.save.completed.length, ORDERS.length - 1)) / 3);
    if(this.save.firstSteps?.craft&&this.save.completed.length===1&&['craft','orderArrival'].includes(page)){this.save=rules.recordFirstStep(this.save,'secondOrder');this.persist();}
    this.closeModal(); this.screen = page; this.slot = -1; this.selected = -1; this.hint = []; this.render();
  }
  private render() {
    this.craftFlights.forEach((flight,index)=>{if(!['craft','contestCraft'].includes(this.screen)||this.save.reduced||this.workingDraft[index]!==flight.type)this.clearCraftFlight(index);});
    this.layoutCounts.clear(); this.layoutKeys.clear();
    this.clear(this.page);
    this.boardNodes = []; this.slotNodes = [];
    this.rect('Paper', 0, 0, 720, 1280, PAPER);
    for(let y=0;y<1280;y+=720*112/680)this.image('pencil-paper',0,y,720,720*112/680);
    if(['cover','delivery','dialogue','packing'].includes(this.screen))this.image('pencil-frame',0,0,720,1280);
    // Subtle stationary paper grain, generated once per page instead of every frame.
    const grain = this.box('Paper fibres', 0, 0, 720, 1280).addComponent(Graphics);
    grain.strokeColor = color('#b6a17b14'); grain.lineWidth = 1;
    for (let i=0;i<180;i++) { const x=(i*173)%720,y=(i*97)%1280; grain.moveTo(x,-y); grain.lineTo(x+3,-y-1); } grain.stroke();
    if (!['cover','delivery','dialogue','memories','packing','storyMap','craft','contestCraft','orderArrival','album'].includes(this.screen)) this.chrome();
    switch (this.screen) {
      case 'cover': this.cover(); break;
      case 'home': this.home(); break;
      case 'orders': this.orders(); break;
      case 'orderArrival': this.orderArrival(); break;
      case 'craft': this.craft(); break;
      case 'match': this.match(); break;
      case 'decor': this.decor(); break;
      case 'album': this.album(); break;
      case 'journal': this.journal(); break;
      case 'contest': this.contest(); break;
      case 'contestCraft': this.craft(); break;
      case 'delivery': this.delivery(); break;
      case 'dialogue': this.storyText(); break;
      case 'memories': this.memories(); break;
      case 'packing': this.packing(); break;
      case 'storyMap': this.storyMap(); break;
    }
    this.layoutKeys.forEach((key,node) => {
      const source=this.layouts.get(key)?.getComponent(AtelierLayout), drawing=node.getComponent(Graphics);
      if(source && drawing && source.drawing !== source.originalDrawing) source.redraw(drawing);
    });
  }
  private chrome() {
    const names = { home:'珠光小店', orders:'顾客委托', craft:'手串工坊', match:'珠材花园', decor:'小店焕新', album:'作品图鉴', journal:'我们的故事', contest:'参加比赛', contestCraft:'参赛手作' };
    this.rect('Header', 0, 0, 720, 100, '#faf6ed', this.page, 0);
    if(this.screen==='home')this.image('icon-flower',32,31,38,38);
    else this.button('‹',24,18,56,64,()=>this.screen==='match'?this.pauseMatch():this.navigate('home'));
    this.text(names[this.screen], 90, 25, 198, 50, 28);
    this.button('珠 ' + rules.total(this.save.inventory), 306, 20, 116, 60, () => this.inventory());
    this.text('金 ' + this.save.coins, 440, 25, 100, 50, 23, GOLD);
    this.button('♥ '+this.save.energy, 550, 20, 78, 60, () => this.info('体力', '每 3 分钟恢复一点，上限 10。\n采珠消耗 1 点；手作、装修与阅读不耗体力。'));
    this.button('⚙', 640, 20, 56, 60, () => this.settings());
    if (this.screen === 'match') return;
    this.rect('Navigation', 0, 1180, 720, 100, '#faf6ed', this.page, 0);
    (['home','orders','craft','decor','album'] as Page[]).forEach((p,i) => {
      const labels=['小店','委托','手作','装修','图鉴'], icons=['home','orders','craft','chair','album'];
      const n=this.box('Navigate '+p, i*144,1180,144,100);
      if(this.screen===p)this.rect('Active',20,10,104,80,'#e4e8d7',n,22);
      this.image('icon-'+icons[i],54,18,36,36,n);
      this.text(labels[i],0,57,144,32,21,this.screen===p?SAGE:MUTED,n,true);
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
    this.button('打开小店  →',160,1080,400,78,()=>{this.save.started=true;this.persist();this.navigate('home');if(!this.save.completed.length)this.firstOrder();},this.page,true);
    this.text('消除采珠  ·  手串定制  ·  小店经营',70,1190,580,40,21,MUTED,this.page,true);
  }
  private firstOrder() {
    const begin=()=>{this.save=rules.recordFirstStep(this.save,'craft');this.persist();this.closeModal();this.navigate('craft');};
    const line='想送奶奶一朵花，颜色清淡一点。';
    const stage=this.dialogueStage('first-order','第一份心意','林阿姨',line,[['林阿姨',line]],()=>this.firstOrder(),begin);
    this.text('奶奶已经备好了珠材，先做一条喜欢的手串。',82,1183,305,57,21,SAGE,stage);
    this.button('开始做手串',396,1180,242,56,begin,stage,true);
  }
  private get repeatOrder() { return this.save.completed.length===ORDERS.length; }
  private currentOrder() { return rules.currentOrder(this.save); }
  private home() {
    this.text('AH HE’S LITTLE ATELIER',48,136,440,28,18,MUTED);
    this.text('一颗珠子，一段新生活',48,180,624,58,39);
    this.text('阿禾手作 · 午后营业中',48,254,624,36,22,SAGE);
    const shop=this.box('Shop panorama',48,314,624,348);
    shop.addComponent(Mask);
    this.image('pencil-shop',0,-78,624,510,shop);
    this.rect('Commission',48,694,624,292,'#fffaf1',this.page,22,'#dfd1b6');
    const chapter=CHAPTERS[Math.min(2,Math.floor(this.save.completed.length/2))];
    const order=this.currentOrder();
    const commission=this.box('Current commission',72,714,576,118);
    commission.on(Node.EventType.TOUCH_END,()=>this.navigate('orderArrival'));
    this.accessibleButton('查看当前订单',()=>this.navigate('orderArrival'));
    this.text((this.repeatOrder?'回头客委托 · ':'今日心意 · ')+order.customer,76,716,414,32,21,MUTED);
    this.text('酬谢 '+order.reward+' 金',494,716,150,32,21,GOLD,this.page,true);
    this.text(order.name+'  ›',76,762,568,52,34);
    const shortage=this.orderMaterialDeficits().some((n:number)=>n>0)||rules.total(this.save.inventory)<12;
    this.text(this.materialNeed(),76,831,568,42,22,shortage?MUTED:SAGE);
    this.button('按单制作',76,894,274,68,()=>this.navigate('orderArrival'),this.page,!shortage);
    this.button('消除采珠',370,894,274,68,()=>this.matchIntro(),this.page,shortage);
    const pending=pendingStory(this.save);
    this.text(chapter.title,48,1010,450,34,22,MUTED);
    const storyLabel=seaVisitReady(this.save)?'小满回来了 · 看旅行留影':this.save.orderId==='sea'&&!this.save.completed.includes('sea')?'听听她的故事 · 小满的第一次旅行':pending?'继续剧情 · '+pending.title:'翻阅我们的故事';
    const storyAction=()=>seaVisitReady(this.save)?this.seaVisit():this.save.orderId==='sea'&&!this.save.completed.includes('sea')?this.seaChat():pending?this.startStory(STORIES.indexOf(pending)):this.navigate('journal');
    const story=this.box('Story invitation',48,998,624,62);
    story.on(Node.EventType.TOUCH_END,storyAction);this.accessibleButton(storyLabel,storyAction);
    this.text(seaVisitReady(this.save)?'旅行留影  ›':this.save.orderId==='sea'&&!this.save.completed.includes('sea')?'心意来信  ›':pending?'新故事  ›':'阅读  ›',510,1010,162,34,21,SAGE,this.page,true);
    this.button('故事解锁',48,1080,192,70,()=>this.navigate('storyMap'));
    this.button('手账',264,1080,192,70,()=>this.navigate('journal'));
    this.button('参加比赛',480,1080,192,70,()=>this.navigate('contest'));
  }
  private orders() {
    const repeat=this.repeatOrder,current=this.currentOrder();
    this.text('CUSTOMER WISHES',48,136,624,28,18,MUTED);
    this.text('为每一份心意，认真配色',48,180,624,58,38);
    this.text(repeat?'回头客第 '+(this.save.repeatOrders+1)+' 单':'顾客委托 · '+this.save.completed.length+' / 6 已交付',48,254,624,36,22,SAGE);
    const start=this.ordersPage*3;
    (repeat?RETURN_ORDERS:ORDERS).slice(start,start+3).forEach((o,offset)=>{
      const i=start+offset,y=326+offset*246,done=repeat?i<this.save.repeatOrders%ORDERS.length:this.save.completed.includes(o.id),unlocked=repeat?o.id===current.id:i<=this.save.completed.length;
      this.rect('Order '+o.id,48,y,624,222,done?'#edf0e5':'#fffaf1',this.page,22,'#dfd1b6');
      this.image('bead-'+o.main,70,y+24,80,80);
      this.text(o.customer+' · '+o.occasion,172,y+22,o.id==='sea'&&unlocked&&!repeat?290:470,32,21,MUTED);
      this.text(o.name,172,y+66,470,44,32);
      this.text(`${BEADS[o.main].short} ≥${o.mainNeed} · ${BEADS[o.accent].short} ≥${o.accentNeed} · ${CHARMS[o.charm]}`,72,y+137,335,60,21,MUTED);
      if(!repeat&&o.id==='sea'&&unlocked)this.button('听听她的故事',484,y+18,164,54,()=>this.seaChat());
      this.button(done?'已交付':unlocked?'按单制作 '+o.reward+'金':repeat?'等待来店':'尚未解锁',434,y+140,214,60,()=>{this.save.orderId=o.id;this.persist();this.navigate('orderArrival');},this.page,unlocked&&!done,unlocked&&!done);
    });
    this.button('← 前三份',48,1094,200,62,()=>{this.ordersPage=0;this.render();},this.page,false,this.ordersPage>0);
    this.text((this.ordersPage+1)+' / 2',270,1100,180,50,22,MUTED,this.page,true);
    this.button('后三份 →',472,1094,200,62,()=>{this.ordersPage=1;this.render();},this.page,false,this.ordersPage<1);
  }
  private orderArrival() {
    const o=this.currentOrder(),shortage=this.orderMaterialDeficits().some((n:number)=>n>0)||rules.total(this.save.inventory)<12;
    this.image('pencil-incoming-room',0,-5,720,1290);
    this.button('返回小店',36,46,126,44,()=>this.navigate('home'));
    if(this.orderGuide){
      this.button('跳过引导',550,46,134,44,()=>{this.orderGuide=false;this.render();},this.page,true);
      this.image('pencil-incoming-grandma',92,133,169,172);
      this.polygon('Guide tail',[[302,202],[278,220],[302,234]],'#fffaf0',this.page);
      this.rect('Grandmother guide',296,155,330,122,'#fffaf0',this.page,18,'#a88b66');
      this.text('奶奶的提示',319,166,288,34,26,INK);
      this.text('看看顾客的心意，\n点击订单开始制作。',319,204,288,61,25,INK);
    }else{
      this.text('一份心意，来到小店',135,180,450,58,33,PAPER,this.page,true);
    }
    const card=this.image('pencil-incoming-card',174,361,371,577);
    card?.on(Node.EventType.TOUCH_END,()=>this.navigate('craft'));
    this.accessibleButton('查看订单并开始制作',()=>this.navigate('craft'));
    this.text(o.name,194,385,331,40,28,INK,this.page,true);
    this.text((this.repeatOrder?'回头客第 '+(this.save.repeatOrders+1)+' 单 · ':'顾客委托 · ')+o.customer,194,428,331,32,21,MUTED,this.page,true);
    this.image('pencil-incoming-heroine',268,468,180,210);
    this.text('阿禾 · 为这份心意构思',198,680,323,28,18,MUTED,this.page,true);
    this.text('所需材料 · 串满十二颗',204,717,310,34,23,INK);
    [o.main,o.accent].forEach((type,i)=>{
      const y=763+i*54,need=i?o.accentNeed:o.mainNeed,stock=this.save.inventory[type];
      this.image('bead-'+type,208,y,38,38);
      this.text(BEADS[type].short+' ≥ '+need+' 颗',255,y-3,230,29,24,INK);
      this.text('库存 '+stock+(stock<need?' · 还缺 '+(need-stock):' · 已备齐'),255,y+25,230,24,18,stock<need?'#a05c4c':SAGE);
    });
    this.image('charm-'+o.charm,208,871,38,38);
    this.text(CHARMS[o.charm]+'吊坠 × 1',255,868,230,29,24,INK);
    this.text('制作时选择 · 无需采集',255,897,230,24,18,SAGE);
    if(this.orderGuide)this.image('pencil-incoming-hand',520,741,105,123);
    this.text('交付酬谢 '+o.reward+' 金 · 声望 +'+o.rep,125,950,470,34,24,PAPER,this.page,true);
    this.rect('Supply note',110,990,500,44,'#fffaf0ed',this.page,12);
    this.text(this.materialNeed(),120,993,480,37,21,shortage?'#a05c4c':SAGE,this.page,true);
    this.button('开始制作',219,1053,281,80,()=>this.navigate('craft'),this.page,true);
    if(shortage)this.button('去采珠',260,1150,200,48,()=>this.matchIntro());
    else this.text('点击订单卡，也能走进手作台',135,1151,450,32,21,PAPER,this.page,true);
  }
  private get contestEntry() { return this.screen==='contestCraft'?this.save.competitions.draft:null; }
  private get workingDraft() { return this.contestEntry?.beads || this.save.draft; }
  private set workingDraft(beads:(number|null)[]) { if(this.contestEntry)this.contestEntry.beads=beads;else this.save.draft=beads; }
  private get workingCharm() { return this.contestEntry?.charm || this.save.charm; }
  private set workingCharm(charm:string) { if(this.contestEntry)this.contestEntry.charm=charm;else this.save.charm=charm; }
  private get workingUndo() { return this.contestEntry?this.contestUndo:this.undo; }
  private remember() { this.workingUndo.push({draft:[...this.workingDraft],charm:this.workingCharm}); if(this.workingUndo.length>60)this.workingUndo.shift(); }
  private slotPos(i: number) {
    const a=i*Math.PI/6-Math.PI/2, x=360+Math.cos(a)*228, y=532+Math.sin(a)*228;
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
    const checks=rules.checkOrder(this.save),counts=rules.draftCounts(this.workingDraft);
    const ready=event?!this.workingDraft.includes(null):Object.values(checks).every(Boolean);
    this.image('pencil-frame',0,0,720,1280);
    this.button(event?'返回比赛':'返回委托',22,20,100,46,()=>this.navigate(event?'contest':'orders'));
    this.button('暂停',600,20,98,46,()=>this.pauseMatch());
    this.text(event?'街坊串珠比赛':'手串工坊',140,16,440,54,34,INK,this.page,true);
    this.ellipse('Customer seal',65,113,32,32,'#e8e0cb',this.page,'#c0a176');
    this.image(event?'icon-album':'pencil-album-flower',42,90,46,46);
    this.text(event?event.theme:o.customer+' · '+o.name,114,76,562,37,25,INK);
    this.text(event?event.description:!this.save.completed.length?'想送奶奶一朵花，颜色清淡一点。':o.text,114,116,562,53,22,MUTED);
    const main=event?event.main:o.main,accent=event?event.accent:o.accent;
    this.text(`${BEADS[main].short} ${counts[main]}/${event?6:o.mainNeed} · ${BEADS[accent].short} ${counts[accent]}/${event?3:o.accentNeed} · ${CHARMS[event?event.charm:o.charm]}吊坠`,66,178,588,36,24,SAGE,this.page,true);
    const g=this.box('Wire',0,0,720,1280).addComponent(Graphics);
    g.strokeColor=color('#c1a06b');g.lineWidth=2;g.ellipse(360,-532,228,228);g.stroke();
    const first=!event&&!this.save.completed.length&&counts.every(n=>n===0);
    this.text(first?'点一颗喜欢的珠材':'把心意，一颗颗串起',213,463,294,40,25,'#9a8262',this.page,true);
    this.text(`${this.workingDraft.filter(t=>t!==null).length} / 12 颗`,250,507,220,45,33,SAGE,this.page,true);
    this.text('已选 '+BEADS[this.craftMaterial].name,211,557,298,34,23,INK,this.page,true);
    this.text('点珠弹入 · 拖动调整位置',204,598,312,35,21,MUTED,this.page,true);
    this.image('charm-'+this.workingCharm,336,645,48,48);
    this.workingDraft.forEach((type: number|null,i: number)=>{
      const p=this.slotPos(i),n=this.box('Slot '+i,p.x-46,p.y-46,92,92),active=this.slot===i;
      this.ellipse('Slot recess',46,46,36,36,active?'#f2d38b':'#b39a7045',n,active?'#9a7738':'#c3ac88');
      if(active)this.ellipse('Selected groove',46,46,43,43,'#f2d38b19',n,'#aa7d37');
      if(type!==null&&!this.craftFlights.has(i)){this.ellipse('Bead contact shadow',48,65,31,12,'#82634250',n);this.image('bead-'+type,5,5,82,82,n);}
      else this.text(String(i+1),0,12,92,68,21,'#a68c66',n,true);
      this.slotNodes.push(n);this.bindCraftDrag(n,i);
      this.accessibleButton(`第${i+1}槽：${type===null?'空槽':BEADS[type].name}`,()=>this.selectCraftSlot(i));
    });
    this.text(event?'赛事提供珠材 · 委托草稿独立保留':this.materialNeed(),38,828,644,32,22,MUTED,this.page,true);
    this.text('点珠材加入手串 · 拖动调整位置',60,865,600,28,21,MUTED,this.page,true);
    BEADS.forEach((b,i)=>{
      const x=39+i*108;
      const chosen=this.craftMaterial===i,n=this.rect('Bead material '+i,x,900,102,94,chosen?'#e6d39d':'#fffaf040',this.page,13,chosen?'#9b7b43':'#cbb799');
      this.image('bead-'+i,21,0,60,60,n);
      this.text(event?b.short:b.short+' '+Math.max(0,this.save.inventory[i]-counts[i]),0,61,102,30,20,INK,n,true);
      const choose=()=>{this.craftMaterial=i;this.slot=-1;this.place(i);};n.on(Node.EventType.TOUCH_END,choose);
      this.accessibleButton('放入'+b.name,choose);
    });
    Object.entries(CHARMS).forEach(([id,name],i)=>this.button((this.workingCharm===id?'✓ ':'')+name,50+i*212,1011,196,44,()=>{this.remember();this.workingCharm=id;this.persist();this.render();},this.page,this.workingCharm===id));
    const controls=[['撤销','icon-undo',()=>{const s=this.workingUndo.pop();if(!s)return this.toast('还没有可撤销的操作。');this.workingDraft=s.draft;this.workingCharm=s.charm;this.slot=-1;this.persist();this.render();}],['移除','icon-bin',()=>{if(this.slot<0)return this.toast('先点选一颗珠子。');this.remember();this.workingDraft[this.slot]=null;this.slot=-1;this.persist();this.render();}],['预览','preview',()=>this.previewCraft()]] as const;
    controls.forEach(([label,,action],i)=>this.button(label,28+i*100,1070,92,45,action));
    this.button('替换',328,1070,92,45,()=>this.slot<0?this.toast('先点选要替换的珠子。'):this.place(this.craftMaterial));
    this.button('参考配色',428,1070,143,45,()=>this.sample());
    this.button(event?'评分规则':'采珠',579,1070,113,45,()=>event?this.contestRules():this.matchIntro());
    if(!event&&o.id==='sea'&&!this.repeatOrder)this.button('听故事',24,1147,120,70,()=>this.seaChat());
    const hasChat=!event&&o.id==='sea'&&!this.repeatOrder;
    const finish=this.button(event?'提交参赛作品':'完成制作',hasChat?164:126,1147,hasChat?528:468,70,()=>{
      if(event){if(this.workingDraft.includes(null))return this.toast('先串满十二颗珠子，再提交作品。');this.contestConfirm();return;}
      if(!Object.values(checks).every(Boolean))return this.toast(!checks.full?'先串满十二颗珠子。':!checks.charm?'换成客人需要的吊坠吧。':'配色或库存还未满足，看看上方要求。');
      this.confirmDelivery();
    },this.page,ready);
    finish.children.find(n=>n.getComponent(Label))!.getComponent(Label)!.fontSize=29;
    this.text(ready?'作品已符合委托，准备装进礼盒。':this.slot>=0?'已选第 '+(this.slot+1)+' 颗 · 可取下，或用当前珠材替换。':'点已有珠子，可替换或取下；撤销随时可用。',45,1220,630,26,19,ready?SAGE:MUTED,this.page,true);
  }
  private selectCraftSlot(index:number) {
    this.slot=this.slot===index?-1:index;this.render();
  }
  private previewCraft() {
    this.dialog('craft-preview','作品预览');
    this.bracelet(this.workingDraft,360,525,158,this.overlay);
    this.image('charm-'+this.workingCharm,337,695,46,46,this.overlay);
    this.text(`${this.workingDraft.filter(t=>t!==null).length} / 12 颗 · ${CHARMS[this.workingCharm]}吊坠\n${this.contestEntry?'参赛作品 · 免费练习珠材':this.currentOrder().customer+'的委托 · 交付后获得 '+this.currentOrder().reward+' 金币'}`,105,762,510,82,24,INK,this.overlay,true);
    this.button('继续制作',130,875,460,64,()=>this.closeModal(),this.overlay,true);
    this.button('参考配色',130,962,460,56,()=>this.sample(),this.overlay);
  }
  private place(type: number) {
    if(this.modal||!Number.isInteger(type)||type<0||type>5)return;
    const index=rules.craftTarget(this.workingDraft,this.slot);
    if(index<0){this.render();return this.toast('手串已满，可拖动换位，或点选一颗后替换。');}
    if(!this.contestEntry&&!rules.canPlace(this.save,type,index)){this.render();return this.toast(BEADS[type].name+'不足，点工具栏「采珠」获取。');}
    this.clearCraftFlight(index);
    this.remember();this.workingDraft[index]=type;this.slot=-1;this.persist();
    if(!this.save.reduced)this.launchCraftBead(index,type);
    this.render();this.play();
  }
  private clearCraftFlight(index:number) {
    const flight=this.craftFlights.get(index);if(!flight)return;
    Tween.stopAllByTarget(flight.node);flight.node.removeFromParent();flight.node.destroy();this.craftFlights.delete(index);
  }
  private clearCraftFlights() {this.craftFlights.forEach((flight,index)=>this.clearCraftFlight(index));}
  private launchCraftBead(index:number,type:number) {
    const n=this.box('Bouncing bead '+index,49+type*108,891,82,82,this.craftMotion);
    this.ellipse('Flight shadow',43,66,29,10,'#82634235',n);this.image('bead-'+type,0,0,82,82,n);
    n.setScale(.72,.72,1);this.craftFlights.set(index,{node:n,type});
    const slot=this.slotNodes[index],p=slot?new Vec3(slot.position.x+5,slot.position.y-5,0):new Vec3(this.slotPos(index).x-41,41-this.slotPos(index).y,0);
    const center=new Vec3(319,-491,0),radius=Vec3.distance(center,p);let touched=false;
    tween(n).to(.22,{position:center,scale:Vec3.ONE},{easing:'quadOut'})
      .delay(.035)
      .to(.64,{position:p},{easing:craftSpring,onUpdate:()=>{
        if(!touched&&Vec3.distance(center,n.position)>=radius){touched=true;this.bumpCraftNeighbors(index);this.play('land',.35);}
      }})
      .call(()=>{
        if(this.craftFlights.get(index)?.node!==n)return;this.clearCraftFlight(index);
        const target=this.slotNodes[index];
        target.children.filter(child=>child.getComponent(Label)).forEach(child=>{child.removeFromParent();child.destroy();});
        this.ellipse('Bead contact shadow',48,65,31,12,'#82634250',target);this.image('bead-'+type,5,5,82,82,target);
      }).start();
  }
  private bumpCraftNeighbors(index:number) {
    if(this.save.reduced)return;
    this.slotNodes.forEach((slot,i)=>{
      const gap=Math.min((i-index+12)%12,(index-i+12)%12);
      if(gap<1||gap>2||this.craftFlights.has(i))return;
      // Move only the artwork; groove hit targets and an active drag stay untouched.
      const p=this.slotPos(i),dx=(p.x-360)/228,dy=-(p.y-532)/228,amount=gap===1?9:4;
      slot.children.filter(child=>child.name.startsWith('bead-')||child.name==='Bead contact shadow').forEach(child=>{
        if(this.craftRipples.has(child))return;
        this.craftRipples.add(child);
        const rest=child.position.clone();
        tween(child).to(.08,{position:new Vec3(rest.x+dx*amount,rest.y+dy*amount,rest.z)},{easing:'quadOut'})
          .to(.13,{position:new Vec3(rest.x-dx*amount*.35,rest.y-dy*amount*.35,rest.z)},{easing:'sineInOut'})
          .to(.19,{position:rest},{easing:'sineOut'}).call(()=>this.craftRipples.delete(child)).start();
      });
    });
  }
  private localPoint(e: EventTouch) {
    // getUILocation already accounts for SHOW_ALL letterboxing; page origin is top left.
    const p=e.getUILocation();return new Vec3(p.x,p.y-1280,0);
  }
  private bindCraftDrag(n: Node,index: number) {
    let start: Vec3|null=null, original: Vec3|null=null, dragged=false;
    n.on(Node.EventType.TOUCH_START,(e: EventTouch)=>{
      if(this.modal)return;
      if(this.craftFlights.has(index)){this.clearCraftFlight(index);this.image('bead-'+this.workingDraft[index],5,5,82,82,n);}
      start=this.localPoint(e);original=n.position.clone();dragged=false;Tween.stopAllByTarget(n);n.setScale(1,1,1);
    });
    n.on(Node.EventType.TOUCH_MOVE,(e: EventTouch)=>{
      if(!start||this.workingDraft[index]===null)return;
      const p=this.localPoint(e);if(Vec3.distance(start,p)>14)dragged=true;
      if(dragged){n.setSiblingIndex(this.page.children.length-1);n.setPosition(p.x-46,p.y+46);}
    });
    n.on(Node.EventType.TOUCH_END,(e: EventTouch)=>{
      if(!start||this.modal)return;
      if(dragged){const p=this.localPoint(e);let target=-1,nearest=95;for(let i=0;i<12;i++){if(i===index)continue;const s=this.slotNodes[i].position,d=Math.hypot(s.x+46-p.x,s.y-46-p.y);if(d<nearest){target=i;nearest=d;}}
        if(target>=0&&target!==index){this.remember();[this.workingDraft[index],this.workingDraft[target]]=[this.workingDraft[target],this.workingDraft[index]];this.slot=target;this.persist();this.play('land');}
      }else{start=null;this.selectCraftSlot(index);return;}
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
    if(!this.save.completed.length){
      this.dialog('first-finished','第一条手串，完成了');
      this.bracelet(this.save.draft,360,540,190,this.overlay);this.image('charm-'+this.save.charm,332,727,56,60,this.overlay);
      this.text('珠序和吊坠会原样收进收藏。',115,815,490,47,24,SAGE,this.overlay,true);
      this.button('装进礼盒',130,902,460,66,()=>this.navigate('packing'),this.overlay,true);return;
    }
    this.navigate('packing');
  }
  private packing() {
    const o=this.currentOrder(),sea=o.id==='sea'&&!this.repeatOrder,gift=sea?this.save.seaHeart.gift:null;
    this.text('手串工坊',180,50,360,65,49,'#69452e',this.page,true);
    this.button('返回修改',566,44,122,48,()=>this.navigate('craft'));
    this.text(o.customer+' · '+o.name,85,119,550,39,24,INK,this.page,true);
    this.image('pencil-packing-box',40,169,640,540);
    const ribbon=gift?.ribbon==='blue'?'#91b6c4':'#9bad87';
    this.rect('Chosen ribbon',245,601,230,8,ribbon,this.page,4);
    this.ellipse('Gift bow left',345,605,18,9,ribbon);
    this.ellipse('Gift bow right',375,605,18,9,ribbon);
    this.bracelet(this.save.draft,360,496,89);
    this.image('charm-'+this.save.charm,341,563,38,43);
    this.text('祝福卡',255,735,210,48,34,'#69452e',this.page,true);
    this.image('pencil-packing-people',0,724,720,376);
    this.image('pencil-packing-card',223,795,275,183);
    this.rect('Blessing paper',255,837,210,99,gift?.paper==='sky'?'#dce9ec':'#fff8ed',this.page,5);
    const blessing=gift?SEA_BLESSINGS.find(b=>b.id===gift.blessing)!.text:'愿每一天，都有属于自己的光。';
    this.text(blessing,261,847,198,84,24,'#69452e',this.page,true);
    if(sea)this.button('挑选祝福与包装',231,992,258,46,()=>this.seaPacking());
    else this.text('把这份心意，认真送到。',220,994,280,45,21,SAGE,this.page,true);
    this.text('确认后交付给'+o.customer+' · '+o.reward+' 金币 / '+o.rep+' 口碑',75,1074,570,32,21,MUTED,this.page,true);
    this.button('完成包装',62,1130,284,82,()=>this.completePacking(),this.page,true);
    this.button('使用默认包装',374,1130,284,82,()=>this.completePacking(true),this.page,true);
  }
  private completePacking(useDefault=false) {
    if(this.screen!=='packing'||rules.pendingDelivery(this.save))return;
    if(useDefault&&this.currentOrder().id==='sea'&&!this.repeatOrder){
      for(const [field,id] of [['blessing','scenery'],['paper','cream'],['ribbon','sage']])this.save=chooseSeaGift(this.save,field,id)||this.save;
    }
    this.deliverOrder();
  }
  private deliverOrder() {
    if(rules.pendingDelivery(this.save))return;
    const next=rules.deliver(this.save);
    if(!next)return this.toast('交付条件尚未满足。');
    this.save=next;this.undo=[];
    this.persist();this.play('success');this.closeModal();this.clear(this.notices);this.toastGeneration++;
    this.screen='delivery';this.render();
  }
  private delivery() {
    const receipt=rules.pendingDelivery(this.save);
    if(!receipt){this.screen='home';this.home();return;}
    const {order:o,work,repeat}=receipt,history=repeat?this.save.repeatCollection:this.save.collection;
    this.image('pencil-handover',0,0,720,768);
    this.rect('Delivery complete seal',264,112,192,36,'#718366ed',this.page,18);
    this.text('委托已交付',269,112,182,36,21,PAPER,this.page,true);
    const thanks=this.rect('Thank you note',514,752,174,70,'#fff8e8',this.page,3,'#b9946b');
    this.rect('Thank you note lining',6,6,162,58,'#fff8e8',thanks,1,'#d6bb92');
    this.text('感谢您的光临！',10,13,154,43,20,INK,thanks,true);
    this.text(o.customer+' · '+o.name,38,785,466,39,23,INK,this.page,true);
    this.rect('Delivery receipt shadow',30,840,660,300,'#b99b72',this.page,12);
    this.rect('Delivery receipt',27,831,666,300,'#fff9ec',this.page,12,'#9b7a55');
    this.rect('Delivery receipt lining',38,842,644,278,'#fff9ec',this.page,8,'#d4bea0');
    this.text('交付作品',54,853,202,38,29,INK,this.page,true);
    const preview=this.rect('Delivered work',52,901,204,194,'#efe6d4',this.page,14,'#c9b292');
    this.bracelet(work.beads,102,89,76,preview);
    this.image('charm-'+work.charm,88,147,28,34,preview);
    this.text('十二颗珠子 · '+CHARMS[work.charm]+'吊坠',53,1098,202,22,16,MUTED,this.page,true);
    const lines=this.box('Receipt dividers',0,0,720,1280).addComponent(Graphics);
    lines.strokeColor=color('#d4bea0');lines.lineWidth=2;
    lines.moveTo(273,-856);lines.lineTo(273,-1107);lines.moveTo(289,-976);lines.lineTo(662,-976);lines.stroke();
    this.text('金币',290,854,155,37,27,INK,this.page,true);
    this.ellipse('Reward coin',309,924,20,20,'#e5c278',this.page,'#b28c45');
    this.ellipse('Reward coin inner',309,924,15,15,'#f3d494',this.page,'#cba75c');
    this.text('✦',291,904,36,38,27,'#b38b3c',this.page,true);
    this.text('+'+o.reward,336,898,113,48,33,INK,this.page,true);
    this.text('信誉',476,854,173,37,27,INK,this.page,true);
    this.text('★',472,895,45,51,38,'#d9b35f',this.page,true);
    this.text('+'+o.rep,521,897,128,45,30,SAGE,this.page,true);
    const milestone=Math.max(50,Math.ceil(this.save.rep/50)*50),progress=Math.min(1,this.save.rep/milestone);
    this.rect('Reputation track',484,945,168,12,'#d4c7b2',this.page,6);
    this.rect('Earned reputation',484,945,Math.max(4,168*progress),12,'#dfba6b',this.page,6);
    this.text('累计 '+this.save.rep+' / '+milestone,478,958,180,20,15,MUTED,this.page,true);
    this.text(repeat?'回头客收藏 · 第 '+receipt.number+' 单':'收藏解锁 · '+this.save.collection.length+' / '+ORDERS.length,286,982,375,37,25,INK,this.page,true);
    for(let i=0;i<6;i++){
      const item=history[i],x=287+i*62;
      const n=this.rect('Receipt collection '+i,x,1030,56,70,item?'#f6ecda':'#ede4d4',this.page,9,item&&item===work?'#a58e55':'#d0bca0');
      if(item){
        this.bracelet(item.beads,28,30,20,n);
        this.image('charm-'+item.charm,22,48,12,14,n);
      }else{
        const g=this.box('Locked collection',0,0,56,70,n).addComponent(Graphics);
        g.strokeColor=color('#c1ac8f');g.lineWidth=3;g.ellipse(28,-28,8,12);g.stroke();
        this.rect('Lock body',16,28,24,23,'#d3c1a5',n,5,'#bea78a');
        this.ellipse('Lock keyhole',28,39,2,4,'#b49a78',n);
      }
    }
    const button=this.button('继续营业',163,1163,394,78,()=>this.continueDelivery(),this.page,true);
    button.children.find(n=>n.getComponent(Label))!.getComponent(Label)!.fontSize=34;
    this.text('奖励已入账 · 作品与进度已保存',120,1250,480,25,18,MUTED,this.page,true);
  }
  private continueDelivery() {
    if(this.screen!=='delivery')return;
    const receipt=rules.pendingDelivery(this.save);if(!receipt)return;
    const {order:o,repeat}=receipt;
    this.save.deliveryReceipt=null;this.persist();this.navigate('home');
    if(repeat){this.toast(o.customer+'收到了手串，下一份委托已送达。');return;}
    const invitation=COMPETITIONS.find(event=>event.unlock===this.save.completed.length);
    if(invitation)this.toast('收到比赛邀请：'+invitation.title+'，首页可参加。');
    if(o.id==='daisy'){
      const receive=()=>{this.save=rules.recordFirstStep(this.save,'secondOrder');this.persist();this.navigate('orderArrival');},counts=rules.draftCounts(receipt.work.beads);
      const feedback=counts[0]>=8?'这些珍珠的颜色真温柔，妈妈一定会喜欢这朵小花。':'绿玉衬着这朵小花，清清淡淡的，正是妈妈喜欢的样子。';
      const show=()=>{const stage=this.dialogueStage('first-feedback','林阿姨收到了手串','林阿姨',feedback,[['林阿姨',feedback]],show,receive);
        this.button('领取下一份委托',344,1180,294,56,receive,stage,true);};show();return;
    }
    const nextStory=()=>this.startStory(STORIES.findIndex(story=>story.afterOrder===o.id));
    if(o.id!=='sea'){nextStory();return;}
    const gift=this.save.collection.find((item:any)=>item.id==='sea').gift;
    const blessing=SEA_BLESSINGS.find(b=>b.id===gift.blessing)!.text;
    const response=seaResponse(this.save).replace(/^小满：/,'');
    const depart=()=>{this.closeModal();nextStory();};
    const show=()=>{
      const stage=this.dialogueStage('sea-response','小满把祝福读了两遍','小满',response,
        [['祝福卡',blessing],['小满',response]],show,depart);
      this.text('祝福卡 · '+blessing,82,1138,556,35,20,SAGE,stage);
      this.button('目送她出发',396,1180,242,56,depart,stage,true);
    };show();
  }
  private seaChat(questionId='') {
    if(!this.save.completed.includes('daisy'))return;
    const question=SEA_QUESTIONS.find(q=>q.id===questionId);
    const leave=()=>{this.closeModal();this.render();};
    const records=[['小满','我想要蓝色。第一次自己出远门，有点怕。'],
      ...this.save.seaHeart.facts.flatMap((id:string)=>{const q=SEA_QUESTIONS.find(q=>q.id===id)!;return [['阿禾',q.ask],['小满',q.answer],['阿禾',q.follow.replace(/^阿禾：/,'')]];})];
    const stage=this.dialogueStage('sea-chat','听听小满的故事','小满',question?question.answer+'\n'+question.follow:records[0][1],records,()=>this.seaChat(questionId),leave,true);
    SEA_QUESTIONS.forEach((q,i)=>this.button((this.save.seaHeart.facts.includes(q.id)?'✓ ':'')+q.ask,82,1002+i*61,556,53,()=>{
      const next=askSea(this.save,q.id);if(next){this.save=next;this.persist();}this.seaChat(q.id);
    },stage));
    this.button('把这份心意记住',246,1191,392,52,leave,stage,true);
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
    this.button('保存包装选择',368,909,252,65,()=>{this.closeModal();this.render();},this.overlay,true);
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
      this.button('看看后来这条手串',135,920,450,62,()=>this.collectionPreview('sea'),this.overlay,true);
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
    if(this.busy)return;
    if(!this.save.completed.length&&!rules.supplyGoals(this.save).length){this.dialog('first-supplies','先完成第一条手串');this.text('奶奶赠送的珠材已经够做这一单。\n先把这份心意做好，下一单再去花园采珠。',105,409,510,202,28,INK,this.overlay,true);this.button('回制作台',130,858,460,66,()=>this.navigate('craft'),this.overlay,true);return;}
    const preview=rules.newSession(42,this.save.level,this.currentOrder(),this.save);
    this.dialog('intro',`第 ${this.save.level} 关 · ${preview.title}`);
    this.text('为'+this.currentOrder().customer+'的委托准备珠材',100,340,520,50,25,SAGE,this.overlay,true);
    this.text(this.materialNeed(),100,397,520,76,23,MUTED,this.overlay,true);
    rules.goalProgress(preview).forEach((g:any,i:number)=>{
      this.rect('Level objective '+i,107,482+i*51,506,44,'#e7ebdb',this.overlay,12);
      this.text(g.label+'  '+g.target,125,482+i*51,470,44,25,INK,this.overlay,true);
    });
    if(preview.objectives.length<=2){
      this.bracelet(this.currentOrder().palette,360,preview.objectives.length===1?612:632,preview.objectives.length===1?64:43,this.overlay);
      this.text('把这份颜色，带回手作台',130,680,460,30,19,MUTED,this.overlay,true);
    }
    this.text(preview.tip,100,710,520,128,24,INK,this.overlay,true);
    const enough=!rules.supplyGoals(this.save).length;
    this.button(enough?'材料已够 · 返回制作':`开始采珠 · ${preview.moves} 步`,130,868,460,64,()=>enough?this.navigate('craft'):this.startMatch(),this.overlay,true);
    if(enough)this.button('再采一些备用',130,943,460,54,()=>this.startMatch(),this.overlay);
    else this.text('消耗 1 体力 · 提示免费 · 前三关所得随消除保存',100,960,520,55,21,MUTED,this.overlay,true);
  }
  private materialNeed() {
    const needed=this.orderMaterialDeficits();
    const parts=needed.map((n:number,i:number)=>n?BEADS[i].short+' '+n+' 颗':'').filter(Boolean);
    if(parts.length)return '本单还缺：'+parts.join(' · ');
    const missing=Math.max(0,12-rules.total(this.save.inventory));
    return missing?'主辅色已够，再采 '+missing+' 颗喜欢的珠材。':'珠材已经备齐，可以按单制作了。';
  }
  private orderMaterialDeficits() {
    return rules.materialDeficits(this.save);
  }
  private startMatch() {
    this.save=rules.refreshEnergy(this.save);if(this.save.energy<1)return this.toast('体力不足，稍等一会儿，或先去做手串。');
    this.returnScreen=this.screen==='match'?this.returnScreen:this.screen;this.save.energy--;this.save.energyAt=Date.now();this.persist();
    this.save=rules.recordFirstStep(this.save,'firstGather');this.persist();
    this.session=rules.newSession(Date.now()%1000000,this.save.level,this.currentOrder(),this.save);this.selected=-1;this.tool='';this.hint=rules.findSupplyMove(this.session.board,this.session.supplyGoals)||[];this.closeModal();this.screen='match';this.render();
  }
  private boardPos(i: number, edited=true) {
    const x=48+(i%8)*CELL,y=BOARD_Y+Math.floor(i/8)*CELL;
    const template=edited?this.layouts.get(layoutKey('match',x,y,72,72,new Map())):null;
    return template?template.position.clone():new Vec3(x,-y,0);
  }
  private match() {
    const s=this.session;if(!s){this.screen='home';this.home();return;}
    this.text(`第 ${s.level} 关 · ${s.title}`,38,105,644,46,30,INK,this.page,true);
    const supply=rules.goalProgress({...s,objectives:s.supplyGoals||[]});
    this.text(supply.length?'本单缺料 · '+supply.map(g=>g.label+' '+Math.min(g.current,g.target)+'/'+g.target).join(' · '):'材料已够 · 本局采珠用于额外储备',38,155,644,37,21,MUTED,this.page,true);
    this.rect('Moves shadow',40,206,112,107,'#cfb98e',this.page,20);
    this.rect('Moves card',40,198,112,107,'#728467',this.page,20,'#c6b681');
    this.movesLabel=this.text(String(s.moves),45,198,102,67,43,PAPER,this.page,true);
    this.text('剩余步数',45,265,102,33,18,PAPER,this.page,true);
    this.goalLabels=[];
    const goals=rules.goalProgress(s),width=510/goals.length;
    goals.forEach((g:any,i:number)=>{
      if(goals.length>3){
        const columns=goals.length>4?3:2,w=510/columns,x=167+(i%columns)*w,y=198+Math.floor(i/columns)*56;
        this.rect('Goal '+i,x,y,w-10,51,'#fffaf0',this.page,12,'#d6c6a5');
        if(g.kind==='color')this.image('bead-'+g.type,x+5,y+7,34,34);
        else this.text(g.kind==='paper'?'▧':'⌘',x+5,y+4,34,39,25,GOLD,this.page,true);
        this.text(g.label,x+42,y+4,w-116,41,18,MUTED);
        this.goalLabels.push(this.text(`${Math.min(g.current,g.target)}/${g.target}`,x+w-73,y+4,60,41,21,g.current>=g.target?SAGE:INK,this.page,true));
        return;
      }
      const x=167+i*width;
      this.rect('Goal '+i,x,198,width-10,107,'#fffaf0',this.page,17,'#d6c6a5');
      if(g.kind==='color')this.image('bead-'+g.type,x+12,209,43,43);
      else this.text(g.kind==='paper'?'▧':g.kind==='thread'?'⌘':'✦',x+10,207,47,45,31,GOLD,this.page,true);
      this.text(g.label,x+60,209,width-78,39,20,MUTED);
      this.goalLabels.push(this.text(`${Math.min(g.current,g.target)} / ${g.target}`,x+8,252,width-26,44,28,g.current>=g.target?SAGE:INK,this.page,true));
    });
    this.rect('Board shadow',35,333,650,640,'#cbb58e',this.page,22);
    this.rect('Board frame',39,330,642,642,'#d8c49f',this.page,20,'#ad8a60');
    s.board.forEach((type: number,i: number)=>{
      const n=this.makeBoardBead(i,type,s.specials?.[i]||'');this.boardNodes.push(n);this.bindBoard(n,i);
      const special=s.specials?.[i],obstacle=s.obstacles?.[i];
      this.accessibleButton(`${this.hint.includes(i)?'提示格 ':''}第${Math.floor(i/8)+1}行第${i%8+1}列 ${BEADS[type].name}${special?' '+(special==='burst'?'花束珠':'丝线珠'):''}${obstacle?' '+(obstacle==='paper'?'纸袋':'线结'):''}`,()=>this.boardClick(i));
    });
    this.drawObstacles(s.obstacles);
    s.collected.forEach((count: number,i: number)=>{this.image('bead-'+i,44+i*109,991,43,43);this.text(String(count),88+i*109,994,53,38,21);});
    ['hammer','bloom','shuffle','hint'].forEach((id,i)=>{
      const names=['小木槌','花开十字','重新排珠','灵感提示'];
      this.button(names[i]+(id==='hint'?'':` ${s.tools[id]}`),38+i*165,1063,149,64,()=>this.selectTool(id),this.page,this.tool===id,id==='hint'||s.tools[id]>0);
    });
    this.text(this.tool?this.tool==='hammer'?'点一颗珠子，使用小木槌':'点一颗珠子，收集整行整列':s.tip,38,1146,644,53,22,MUTED,this.page,true);
    this.button('暂停',280,1212,160,46,()=>this.pauseMatch());
  }
  private makeBoardBead(i:number,type:number,special='',row?:number) {
    const p=this.boardPos(i,false),active=this.selected===i||this.hint.includes(i);
    const n=this.rect('Cell '+i,p.x,row===undefined?-p.y:BOARD_Y+row*CELL,72,72,active?'#f5dfa5':'#fff7e5',this.page,14,active?GOLD:'#cdb991');
    this.ellipse('Bead grounding',38,56,23,7,'#8e75422b',n);
    this.image('bead-'+type,3,1,66,66,n);
    if(special)this.drawSpecial(n,special);
    return n;
  }
  private drawSpecial(n:Node,special:string) {
    const ring=this.box('Special halo',0,0,72,72,n).addComponent(Graphics);
    ring.strokeColor=color('#fffdf4');ring.lineWidth=3;ring.ellipse(36,-35,30,29);ring.stroke();
    ring.strokeColor=color('#b68b42');ring.lineWidth=2;
    if(special==='row'){for(const y of [29,42]){ring.moveTo(8,-y);ring.lineTo(64,-y);}ring.stroke();}
    else if(special==='column'){for(const x of [29,42]){ring.moveTo(x,-8);ring.lineTo(x,-64);}ring.stroke();}
    else {for(let k=0;k<6;k++){const a=k*Math.PI/3;ring.ellipse(36+Math.cos(a)*18,-35-Math.sin(a)*18,7,7);}ring.stroke();}
    ring.fillColor=color(special==='burst'?'#b58a44':'#6a8269');ring.ellipse(58,-57,13,13);ring.fill();
    ring.strokeColor=color('#fff8df');ring.lineWidth=2;
    if(special==='row'){
      ring.moveTo(49,-57);ring.lineTo(67,-57);ring.moveTo(53,-53);ring.lineTo(49,-57);ring.lineTo(53,-61);ring.moveTo(63,-53);ring.lineTo(67,-57);ring.lineTo(63,-61);
    }else if(special==='column'){
      ring.moveTo(58,-48);ring.lineTo(58,-66);ring.moveTo(54,-52);ring.lineTo(58,-48);ring.lineTo(62,-52);ring.moveTo(54,-62);ring.lineTo(58,-66);ring.lineTo(62,-62);
    }else{
      for(let k=0;k<6;k++){const a=k*Math.PI/3;ring.moveTo(58+Math.cos(a)*3,-57-Math.sin(a)*3);ring.lineTo(58+Math.cos(a)*9,-57-Math.sin(a)*9);}
    }ring.stroke();
  }
  private drawObstacles(obstacles:any[]=[]) {
    this.obstacleNodes.forEach(n=>{if(n?.isValid)n.destroy();});this.obstacleNodes=[];
    obstacles.forEach((kind,i)=>{
      if(!kind)return;
      const p=this.boardPos(i),n=this.box('Obstacle '+i,p.x,-p.y,72,72),g=n.addComponent(Graphics);
      if(kind==='paper'){
        g.fillColor=color('#d9bd86ba');g.roundRect(5,-65,62,58,8);g.fill();
        g.strokeColor=color('#a3804e');g.lineWidth=2;g.roundRect(5,-65,62,58,8);g.stroke();
        g.moveTo(6,-21);g.lineTo(66,-21);g.moveTo(27,-21);g.bezierCurveTo(18,-7,38,-5,36,-20);g.bezierCurveTo(45,-4,57,-15,36,-21);g.stroke();
      }else{
        g.strokeColor=color('#a98456');g.lineWidth=4;g.moveTo(4,-15);g.bezierCurveTo(19,-63,53,-10,68,-57);g.moveTo(4,-57);g.bezierCurveTo(25,-7,50,-65,68,-15);g.stroke();
        g.strokeColor=color('#f9e4bd');g.lineWidth=1.5;g.ellipse(36,-36,10,7);g.stroke();
      }
      // Obstacles decorate a fixed board cell; gestures pass through to its bead.
      this.obstacleNodes[i]=n;
    });
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
    if(this.session.specials?.[i]){this.resolve(rules.activateSpecial(this.session,i));return;}
    if(this.selected>=0&&rules.adjacent(this.selected,i)){this.swap(this.selected,i);return;}
    this.selected=this.selected===i?-1:i;this.hint=[];this.render();this.play();
  }
  private selectTool(id: string) {
    if(this.busy||this.modal||this.session?.status!=='playing')return;
    if(id==='hint'){this.hint=rules.findMove(this.session.board,this.session.specials,this.session.obstacles)||[];this.selected=-1;this.render();return;}
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
    const visual={...this.session,moves:result.session.moves,collected:[...this.session.collected],cleared:{...this.session.cleared}};
    if(this.movesLabel)this.movesLabel.string=String(result.session.moves);
    for(let chain=0;chain<frames.length;chain++){
      const frame=frames[chain];
      this.play(frame.activated?.length?'special':chain?'chain-'+Math.min(3,chain):'clear',.6);
      if(frame.activated?.length){
        frame.activated.forEach((special:any)=>this.specialFlash(special.index,special.kind));
        if(!this.save.reduced)await new Promise<void>(done=>this.scheduleOnce(done,.16));
      }
      if(!this.save.reduced)await Promise.all(frame.hit.map((i:number)=>this.animate(this.boardNodes[i],this.boardPos(i),.07,new Vec3(1.1,1.1,1))));
      frame.hit.forEach((i:number)=>{
        visual.collected[frame.before[i]]++;
        if(!this.save.reduced)this.beadSpark(i,frame.before[i],chain);
      });
      await Promise.all(frame.hit.map((i:number)=>this.animate(this.boardNodes[i],this.boardPos(i),.13,new Vec3(.02,.02,1))));
      frame.hit.forEach((i:number)=>this.boardNodes[i].destroy());
      for(const kind of ['paper','thread'])visual.cleared[kind]=(visual.cleared[kind]||0)+(frame.cleared?.[kind]||0);
      this.updateGoals(visual);
      this.drawObstacles(frame.obstaclesAfter);
      (frame.created||[]).forEach((created:any)=>{
        const n=this.boardNodes[created.index];if(n?.isValid){this.drawSpecial(n,created.kind);if(!this.save.reduced){n.setScale(.85,.85,1);tween(n).to(.16,{scale:new Vec3(1.13,1.13,1)}).to(.12,{scale:Vec3.ONE}).start();}}
      });
      const next: Node[]=[], tasks: Promise<void>[]=[];
      frame.falls.forEach((fall:any)=>{
        let n=fall.from===null?null:this.boardNodes[fall.from];
        if(!n?.isValid){n=this.makeBoardBead(fall.to,fall.type,fall.special||'',0);n.setScale(.05,.05,1);this.bindBoard(n,fall.to);}
        else {n.off(Node.EventType.TOUCH_START);n.off(Node.EventType.TOUCH_MOVE);n.off(Node.EventType.TOUCH_END);n.off(Node.EventType.TOUCH_CANCEL);this.bindBoard(n,fall.to);}
        next[fall.to]=n;tasks.push(this.animate(n,this.boardPos(fall.to),.16+Math.max(0,Math.floor(fall.to/8)-Math.max(0,fall.fromRow))*.03,Vec3.ONE).then(async()=>{
          if(!this.save.reduced){n.setScale(1.015,.985,1);await this.animate(n,this.boardPos(fall.to),.09,Vec3.ONE);}
        }));
      });
      this.boardNodes=next;await Promise.all(tasks);this.drawObstacles(frame.obstaclesAfter);this.play('land',.4);
      if(chain>0)this.chainLabel(chain+1);
    }
    this.session=result.session;this.bankGather();this.setBusy(false);this.render();
    if(this.session.status==='playing')this.consumeInput();else{this.queued=null;this.result();}
  }
  private updateGoals(s:any) {
    rules.goalProgress(s).forEach((g:any,i:number)=>{
      const label=this.goalLabels[i];if(!label?.isValid)return;
      label.string=g.current>=g.target?'✓ 已完成':`${g.current} / ${g.target}`;
      label.color=color(g.current>=g.target?SAGE:INK);
    });
  }
  private beadSpark(index:number,type:number,chain:number) {
    const p=this.boardPos(index),cx=p.x+36,cy=-p.y+36;
    for(let k=0;k<3;k++){
      const n=this.ellipse('Pencil glint',cx,cy,3+k,3+k,k===0?'#fff9db':BEADS[type].color),opacity=n.addComponent(UIOpacity);
      const a=(index*2.3+k*2.1),distance=18+k*9;
      tween(n).to(.27,{position:new Vec3(n.position.x+Math.cos(a)*distance,n.position.y+Math.sin(a)*distance,0),scale:new Vec3(.15,.15,1)},{easing:'quadOut'}).call(()=>n.destroy()).start();
      tween(opacity).to(.27,{opacity:0}).start();
    }
    if(index%4===0){
      const n=this.image('bead-'+type,cx-13,cy-13,26,26),opacity=n.addComponent(UIOpacity);
      tween(n).to(.42,{position:new Vec3(53+type*109,-1004,0),scale:new Vec3(.3,.3,1)},{easing:'quadIn'}).call(()=>n.destroy()).start();
      tween(opacity).delay(.24).to(.18,{opacity:0}).start();
    }
  }
  private specialFlash(index:number,kind:string) {
    if(this.save.reduced)return;
    const p=this.boardPos(index),cx=p.x+36,cy=-p.y+36;
    const n=kind==='burst'?this.ellipse('Flower burst',cx,cy,108,108,'#f8e4a86e',this.page,'#f5dc9e'):
      kind==='row'?this.rect('Thread row',44,cy-8,632,16,'#fff0c1dc',this.page,8):this.rect('Thread column',cx-8,BOARD_Y,16,618,'#fff0c1dc',this.page,8);
    const opacity=n.addComponent(UIOpacity);tween(opacity).to(.28,{opacity:0}).call(()=>n.destroy()).start();
  }
  private chainLabel(chain:number) {
    if(this.save.reduced){this.accessibility?.announce(chain+' 连消');return;}
    const n=this.rect('Chain paper',234,636,252,61,'#fff7e5ee',this.page,22,'#c4a46c');
    this.text(chain+' 连消 · '+(chain>2?'灵感盛放':'配色正好'),5,0,242,61,27,SAGE,n,true);
    const opacity=n.addComponent(UIOpacity);
    tween(n).to(.44,{position:new Vec3(234,-607,0)},{easing:'quadOut'}).call(()=>n.destroy()).start();
    tween(opacity).delay(.18).to(.26,{opacity:0}).start();
  }
  private consumeInput() { const q=this.queued;this.queued=null;if(q?.length===2)this.swap(q[0],q[1]);else if(q?.length===1)this.boardClick(q[0]); }
  private result() {
    this.bankGather();
    const won=this.session.status==='won';this.dialog('result',won?'心意所需，满载而归':'还差一点灵感');
    if(won)this.play('success');
    this.text(won?'✦  第 '+this.session.level+' 关完成  ✦':'这一关的目标还没有全部完成。',100,337,520,60,30,SAGE,this.overlay,true);
    const early=this.session.level<=3,pack=won?rules.sessionRewards(this.session,this.save):this.session.collected;
    const inventory=won?this.save.inventory.map((n:number,i:number)=>n+pack[i]-(this.session.banked?.[i]||0)):this.save.inventory;
    const remaining=rules.supplyGoals({...this.save,inventory});
    this.text((won?'为'+this.currentOrder().customer+'采到了这些珠材。':early?'本次采到的珠材已全部保存。':'本次尚未完成，库存保持原样。')+'\n'+(!remaining.length?'材料已够，可以回去制作了。':'还缺：'+remaining.map(g=>g.kind==='color'?BEADS[g.type].short+' '+g.target+' 颗':'任意珠材 '+g.target+' 颗').join(' · ')),100,404,520,86,24,INK,this.overlay,true);
    if(won||early){pack.forEach((n:number,i:number)=>{const x=137+(i%3)*164,y=505+Math.floor(i/3)*137;this.rect('Reward '+i,x-8,y-4,126,120,'#fff9ed',this.overlay,18,'#dfcfb1');this.image('bead-'+i,x+10,y,80,80,this.overlay);this.text('+'+n,x,y+80,100,36,25,SAGE,this.overlay,true);});}
    else rules.goalProgress(this.session).forEach((g:any,i:number)=>this.text(g.label+'  '+Math.min(g.current,g.target)+' / '+g.target,110,540+i*72,500,55,27,g.current>=g.target?SAGE:INK,this.overlay,true));
    this.button(won?'收好珠材 · 回工坊':early?'带着珠材回制作':'重新采珠 · 1 体力',130,865,460,70,()=>won?this.claim():early?this.leaveGather():this.startMatch(),this.overlay,true);
    if(!won)this.button(early?'继续采珠 · 1 体力':'回到小店',130,958,460,56,()=>early?this.startMatch():this.leaveGather(),this.overlay);
  }
  private bankGather() {
    if(!this.session||this.session.level>3)return;
    const next=rules.bankEarlyCollection(this.save,this.session);this.save=next.save;this.session=next.session;this.persist();
  }
  private leaveGather() {this.bankGather();this.session=null;this.navigate('craft');}
  private claim() {
    if(this.session?.status!=='won'||this.session.claimed)return;
    const pack=rules.sessionRewards(this.session,this.save);this.session.claimed=true;
    this.save.inventory=this.save.inventory.map((n:number,i:number)=>n+pack[i]-(this.session.banked?.[i]||0));this.save.level++;this.persist();this.session=null;this.navigate('craft');this.toast('珠材已收好 · '+this.materialNeed());
  }
  private pauseMatch() {
    if(this.busy||!['match','craft','contestCraft'].includes(this.screen)||this.screen==='match'&&this.session?.status!=='playing')return;
    this.stopVideo();this.clear(this.overlay);this.modal='pause';this.musicFromPause=false;this.dialogueState=null;
    this.clear(this.notices);this.toastGeneration++;
    this.accessibility?.showDialog('暂停游戏');
    for(const [node,key] of this.layoutKeys)if(key==='pause'||key.startsWith('pause/'))this.layoutKeys.delete(node);
    for(const key of this.layoutCounts.keys())if(key.startsWith('pause/'))this.layoutCounts.delete(key);
    const stage=this.container('Pause menu',this.overlay);this.layoutKeys.set(stage,'pause');
    this.rect('Pause backdrop',0,0,720,1280,'#40382d80',stage,0).addComponent(BlockInputEvents);
    this.image('pencil-pause-panel',24,182,660,868,stage);
    this.text('暂停游戏',230,309,275,67,46,'#674526',stage,true);
    const rows=[['音乐',this.save.music.enabled,()=>{this.save.music.enabled=!this.save.music.enabled;this.music?.update(this.save.music);}],['音效',this.save.sound,()=>{this.save.sound=!this.save.sound;}],['减少动效',this.save.reduced,()=>{this.save.reduced=!this.save.reduced;}]] as const;
    rows.forEach(([label,enabled,change],i)=>{
      const y=421+i*78,row=this.box('Pause '+label,191,y,351,67,stage),icon=this.box('Pause icon '+i,5,13,40,40,row).addComponent(Graphics);
      icon.strokeColor=color('#94703e');icon.fillColor=color('#c3a06b');icon.lineWidth=2.5;
      if(i===0){this.text('♫',0,0,40,40,38,'#a4814e',icon.node,true);}
      else if(i===1){icon.moveTo(4,-16);icon.lineTo(12,-16);icon.lineTo(23,-7);icon.lineTo(23,-34);icon.lineTo(12,-25);icon.lineTo(4,-25);icon.close();icon.fill();icon.moveTo(29,-13);icon.bezierCurveTo(36,-17,36,-23,29,-29);icon.stroke();}
      else {icon.ellipse(19,-16,9,10);icon.stroke();icon.moveTo(6,-33);icon.lineTo(31,-33);icon.moveTo(3,-4);icon.lineTo(37,-38);icon.stroke();}
      this.text(label,54,0,183,62,31,'#674526',row);
      this.rect('Toggle border',241,9,94,46,'#ae8a58',row,23,'#8d6d43');
      this.rect('Toggle track',245,13,86,38,enabled?'#b6bf8a':'#c9bba6',row,19,'#ead2a3');
      this.ellipse('Toggle knob',enabled?310:266,32,18,18,'#fff6e5',row,'#e2c69a');
      this.text(enabled?'开':'关',enabled?249:291,15,34,33,17,enabled?'#526149':'#7e715d',row,true);
      const toggle=()=>{change();this.persist();this.pauseMatch();};
      row.on(Node.EventType.TOUCH_END,()=>{if(!this.busy){this.play();toggle();}});
      this.accessibleButton(label+'：'+(enabled?'开启':'关闭'),toggle,stage);
      this.rect('Pause row divider',195,y+66,339,1,'#d3bfa1',stage,0);
    });
    this.button('切歌 / 音量',235,658,250,43,()=>this.musicDialog(true),stage);
    this.pauseButton('继续游戏',157,720,407,103,()=>this.closeModal(),stage);
    this.pauseButton('重新开始',137,858,210,66,()=>this.pauseRestart(),stage);
    this.pauseButton('返回店铺',374,858,210,66,()=>this.pauseLeave(),stage);
    this.text(this.screen==='match'?'继续保留本局 · 重开消耗 1 体力':'当前订单与作品草稿已保存',169,827,382,27,18,MUTED,stage,true);
    this.layoutKeys.forEach((key,node)=>{if(!key.startsWith('pause/'))return;const source=this.layouts.get(key)?.getComponent(AtelierLayout),drawing=node.getComponent(Graphics);if(source&&drawing&&source.drawing!==source.originalDrawing)source.redraw(drawing);});
  }
  private pauseButton(label:string,x:number,y:number,w:number,h:number,action:()=>void,parent:Node) {
    const n=this.box('Button: '+label,x,y,w,h,parent);
    this.image('pencil-pause-button',0,0,w,h,n);
    this.text(label,12,0,w-24,h,w>300?39:26,'#fff4d9',n,true);
    n.on(Node.EventType.TOUCH_END,(e:EventTouch)=>{e.propagationStopped=true;if(!this.busy){this.play();action();}});
    this.accessibleButton(label,action,parent);
  }
  private pauseRestart() {
    this.dialog('pause-restart',this.screen==='match'?'重新开始本关？':'重新制作当前作品？');
    this.text(this.screen==='match'?(this.session.level<=3?'本局采到的珠材已保存，棋盘会重新排列。':'本局步数、棋盘和未领取珠材会放下。')+'\n重新开始消耗 1 体力，已有库存与订单不变。':'只清空正在制作的十二颗珠子。\n顾客订单、吊坠和库存保留，可用撤销找回作品。',105,402,510,198,27,INK,this.overlay,true);
    this.button('继续当前游戏',130,711,460,66,()=>this.pauseMatch(),this.overlay);
    this.button(this.screen==='match'?'重开本关 · 1 体力':'重新制作本单',130,811,460,66,()=>{
      if(this.modal!=='pause-restart')return;
      if(this.screen==='match'){this.startMatch();return;}
      this.remember();this.workingDraft=Array(12).fill(null);this.slot=-1;this.persist();this.closeModal();this.render();
    },this.overlay,true);
  }
  private pauseLeave() {
    if(this.screen!=='match'){this.navigate('home');return;}
    this.dialog('pause-leave','返回店铺？');
    this.text((this.session.level<=3?'本局采到的珠材已保存，棋盘进度会放下。':'本局未领取的珠材与棋盘进度会放下。')+'\n已消耗体力不会返还，订单草稿继续保留。',105,421,510,174,27,INK,this.overlay,true);
    this.button('继续当前游戏',130,711,460,66,()=>this.pauseMatch(),this.overlay);
    this.button('确认返回店铺',130,811,460,66,()=>{if(this.modal!=='pause-leave')return;this.session=null;this.navigate('home');},this.overlay,true);
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
        this.revealRenovation(next,r.id);
      },this.page,false,!done);
    });
    FURNITURE.forEach((f,i)=>{
      const tier=this.save.upgrades[f.id],y=847+i*103;
      this.rect('Furniture '+f.id,38,y,644,89,'#fffaf0',this.page,14,'#dfd1b6');
      this.text(f.title,58,y+6,400,34,26);
      this.text(f.names[tier],58,y+45,392,30,20,MUTED);
      this.button(tier===2?'已升满':'升级 '+f.prices[tier+1]+' 金',484,y+20,178,50,()=>{
        const next=rules.purchase(this.save,f.id,tier+1);if(!next)return this.toast(!rules.isShopClean(this.save)?'先打扫干净，再把新家具请进来。':'金币不足，去完成一份委托吧。');
        this.revealRenovation(next,f.id);
      },this.page,true,tier<2);
    });
    this.button('查看生活支线',488,212,194,54,()=>this.navigate('journal'));
  }
  private async revealRenovation(next:any,id:string) {
    if(this.busy)return;
    const previous=this.save;
    this.save=next;this.persist();this.render();this.setBusy(true);
    if(!this.save.reduced){
      // Overlay the old room, then reveal the already-saved renovation underneath.
      const priorChildren=new Set(this.page.children);this.save=previous;this.drawRoom();this.save=next;
      const oldRoom=this.container('Before renovation',this.page);
      this.page.children.filter(n=>n!==oldRoom&&!priorChildren.has(n)).forEach(n=>n.parent=oldRoom);
      const fade=oldRoom.addComponent(UIOpacity);
      tween(fade).delay(.2).to(.7,{opacity:0},{easing:'quadInOut'}).call(()=>oldRoom.destroy()).start();
      for(let k=0;k<14;k++){
        const x=100+(k*73)%530,y=350+(k*41)%300,n=this.ellipse('Renovation pencil dust',x,y,5+k%4,5+k%4,'#fff1cbd0'),opacity=n.addComponent(UIOpacity);
        tween(n).to(.8,{position:new Vec3(n.position.x+(k%2?24:-24),n.position.y+45,0),scale:new Vec3(.1,.1,1)},{easing:'quadOut'}).call(()=>n.destroy()).start();
        tween(opacity).to(.8,{opacity:0}).start();
      }
      await new Promise<void>(done=>this.scheduleOnce(done,1));
    }
    this.setBusy(false);this.play('success');
    const moments:any={
      window:{title:'阳光，又回到窗边',line:'奶奶：“这下看珠子的颜色，也更清楚了。”\n\n阿禾拉开窗帘。暖暖的光落在桌上，旧屋里多了一处可以慢慢坐下的地方。',art:'pencil-workshop'},
      wall:{title:'旧墙，也有了新气色',line:'阿禾退后看了看，手上还沾着一点墙灰。\n\n奶奶笑着递来毛巾：“慢慢来，咱们的小店会越来越好。”',art:'pencil-shop'},
      floor:{title:'走起来，心里也踏实了',line:'奶奶在新地板上走了两步，又回头招呼阿禾。\n\n“以后客人来，咱们就能放心请她们进门了。”',art:'pencil-shop'},
      chair:{title:'给奶奶，留一个舒服的位置',line:'奶奶坐下试了试，把旁边的珠盒推近一点。\n\n“你忙你的。我在这儿陪你。”',art:'pencil-workshop'},
      display:{title:'认真做过的，值得被看见',line:'阿禾把作品一条条摆好，给每条手串留出位置。\n\n奶奶：“再放一张小卡，写上是你做的。”',art:'pencil-shop'},
      desk:{title:'下一份心意，从这里开始',line:'珠盒归了位，桌面也宽敞起来。\n\n阿禾摊开新的设计稿。奶奶把茶放在手边：“先喝一口，再慢慢想。”',art:'pencil-workshop'},
    };
    const moment=moments[id]||moments.desk;
    const show=()=>{
      const stage=this.dialogueStage('renovation',moment.title,'小店日常',moment.line,[['小店日常',moment.line]],show,()=>this.closeModal());
      this.text('小店焕新 '+rules.shopProgress(this.save).percent+'%',82,1188,250,40,20,SAGE,stage);
      this.button('看看我们的新角落',344,1180,294,56,()=>this.closeModal(),stage,true);
    };show();
  }
  private albumView() {
    const collection=this.albumRepeat?this.save.repeatCollection:this.save.collection;
    const series=(this.albumRepeat?RETURN_ORDERS:ORDERS).filter((_,i)=>this.albumRepeat||this.albumChapter<0||Math.floor(i/2)===this.albumChapter);
    const works=series.map(o=>({...o,work:collection.find((item:any)=>item.id===o.id)||null}));
    const collected=works.filter(o=>o.work).length,query=this.albumQuery.toLocaleLowerCase();
    return {series:this.albumRepeat?'回头客 · 近六单':this.albumChapter<0?'全部剧情':['第一章','第二章','第三章'][this.albumChapter],collected,total:works.length,percent:Math.round(collected/works.length*100),query:this.albumQuery,
      items:works.filter(o=>!query||[o.name,o.customer,BEADS[o.main].name,BEADS[o.accent].name,CHARMS[o.charm]].join(' ').toLocaleLowerCase().includes(query))};
  }
  private album() {
    const view=this.albumView();
    this.image('pencil-album-frame',0,-5,720,1290);
    this.text('订单收藏',220,31,280,32,23,INK,this.page,true);
    this.button('‹',43,75,48,48,()=>this.navigate('home'));
    const field=this.rect('Collection search',105,75,252,49,'#fffaf2',this.page,24,'#b6977e'),visible=field.active;
    // Assign our labels before activation so EditBox does not create default labels.
    field.active=false;const edit=field.addComponent(EditBox);
    edit.textLabel=this.text('',14,2,224,45,21,INK,field);
    edit.placeholderLabel=this.text('名称 / 顾客',14,2,224,45,20,MUTED,field);
    edit.inputMode=EditBox.InputMode.SINGLE_LINE;edit.maxLength=32;edit.placeholder='名称 / 顾客';edit.string=this.albumSearch;field.active=visible;
    const search=()=>{this.albumQuery=this.albumSearch.trim();this.render();};
    field.on(EditBox.EventType.TEXT_CHANGED,()=>{this.albumSearch=edit.string;});
    field.on(EditBox.EventType.EDITING_RETURN,search);
    this.accessibility?.search?.(this.albumSearch,value=>{this.albumSearch=value.slice(0,32);edit.string=this.albumSearch;},search);
    this.button('系列筛选 ▾',370,75,147,49,()=>this.albumFilter());
    this.button('搜索',529,75,95,49,search,this.page,true);
    this.text('系列完成进度',146,142,360,37,28,INK);
    this.text(view.percent+'%',512,142,78,37,28,INK,this.page,true);
    this.rect('Series progress track',146,187,428,18,'#ddceb8',this.page,9,'#b79674');
    if(view.collected)this.rect('Series collected progress',149,190,422*view.collected/view.total,12,'#8fa17b',this.page,6);
    this.text(view.series+' · '+view.collected+'/'+view.total+(view.query?' · 找到 '+view.items.length+' 件':''),92,211,540,29,21,MUTED,this.page,true);
    if(!view.items.length){
      this.text('没有找到这份心意',100,450,520,60,32,INK,this.page,true);
      this.text('试试作品名称、顾客或珠材颜色。',100,530,520,72,25,MUTED,this.page,true);
      this.button('清空搜索',220,635,280,60,()=>{this.albumSearch='';this.albumQuery='';this.render();},this.page,true);
    }
    view.items.forEach((o,i)=>{
      const x=88+(i%2)*286,y=248+Math.floor(i/2)*246,n=this.box('Collection '+o.id,x,y,258,238);
      this.image('pencil-album-card',0,0,258,238,n);
      if(o.work){
        this.bracelet(o.work.beads,129,98,74,n);
        this.image('charm-'+o.work.charm,115,160,28,28,n);
        if(o.work.travelCharm)this.image('charm-'+o.work.travelCharm,180,142,23,23,n);
        this.image('pencil-album-flower',207,0,39,39,n);
      }else{
        for(let j=0;j<12;j++){const a=j*Math.PI/6-Math.PI/2;this.ellipse('Uncollected bead',129+Math.cos(a)*68,96+Math.sin(a)*68,13,13,'#dfcfb8',n);}
        const lock=this.box('Collection lock',109,68,40,46,n).addComponent(Graphics);lock.lineWidth=4;lock.strokeColor=color('#baa68c');lock.ellipse(20,-13,10,12);lock.stroke();
        this.rect('Lock body',109,83,40,30,'#baa68c',n,6);this.ellipse('Keyhole',129,96,3,5,PAPER,n);
        this.text('未收集',69,117,120,37,27,'#a68b6d',n,true);
      }
      this.text(o.name,13,185,232,30,23,INK,n,true);
      this.text(o.work?(this.albumRepeat?'第 '+o.work.number+' 单 · ':'已收藏 · ')+o.customer:'完成委托后收藏',13,216,232,22,17,MUTED,n,true);
      const open=()=>o.work?this.collectionPreview(o.id,this.albumRepeat):this.info('尚未收藏 · '+o.name,'完成「'+o.name+'」委托后，这里会保存你亲手制作的珠子、吊坠与心意。\n\n按顺序完成顾客委托，即可逐件收藏。');
      n.on(Node.EventType.TOUCH_END,open);this.accessibleButton((o.work?'欣赏':'未收集 · ')+o.name,open);
    });
    this.text('继续顾客委托 · '+this.currentOrder().name,84,995,467,32,22,INK,this.page,true);
    this.image('pencil-album-grandma',567,997,142,174);
    this.button('制作新手串',195,1040,331,69,()=>this.navigate('orderArrival'),this.page,true);
    this.button('我们的故事与回忆手账',84,1121,270,36,()=>this.navigate('journal'));
    if(this.save.repeatCollection.length)this.button(this.albumRepeat?'查看剧情作品':'查看回头客作品',370,1121,260,36,()=>{this.albumRepeat=!this.albumRepeat;this.albumChapter=-1;this.render();});
    this.rect('Collection navigation',0,1173,720,107,'#faf4e8',this.page,0,'#c5aa85');
    (['店铺','图鉴','任务','我的'] as const).forEach((label,i)=>{
      const target=(['home','album','orders','journal'] as Page[])[i],n=this.box('Collection navigation '+target,i*180,1175,180,105);
      if(target==='album')this.rect('Collection active tab',6,1,168,102,'#e2e8d7',n,10);
      this.image('pencil-album-nav-'+['shop','works','orders','journal'][i],41,2,98,70,n);
      this.text(label,0,72,180,32,25,INK,n,true);
      n.on(Node.EventType.TOUCH_END,()=>this.navigate(target));this.accessibleButton(label,()=>this.navigate(target));
    });
  }
  private albumFilter() {
    this.dialog('album-filter','选择收藏系列');
    ['全部剧情','第一章','第二章','第三章','回头客 · 近六单'].forEach((name,i)=>{
      this.button(name,130,356+i*100,460,65,()=>{this.albumRepeat=i===4;this.albumChapter=i>0&&i<4?i-1:-1;this.closeModal();this.render();},this.overlay,true);
    });
    this.text('按该系列的实际交付作品计算进度',100,885,520,65,22,MUTED,this.overlay,true);
  }
  private collectionView() {
    const selection=this.selectedCollection;if(!selection)return null;
    const order=(selection.repeat?RETURN_ORDERS:ORDERS).find(o=>o.id===selection.id);
    const work=(selection.repeat?this.save.repeatCollection:this.save.collection).find((w:any)=>w.id===selection.id);
    if(!order||!work)return null;
    const materials=rules.draftCounts(work.beads).flatMap((count:number,i:number)=>count?[{name:BEADS[i].name,count,art:'bead-'+i}]:[]);
    materials.push({name:CHARMS[work.charm]+'吊坠',count:1,art:'charm-'+work.charm});
    if(work.travelCharm)materials.push({name:'旅行'+CHARMS[work.travelCharm],count:1,art:'charm-'+work.travelCharm});
    const story=STORIES.find(s=>s.afterOrder===order.id);
    return {id:order.id,repeat:selection.repeat,name:order.name,customer:order.customer,occasion:order.occasion,text:order.text,work,materials,
      series:selection.repeat?'回头客 · 第 '+work.number+' 单':['第一章','第二章','第三章'][Math.floor(ORDERS.findIndex(o=>o.id===order.id)/2)],
      blessing:work.gift?SEA_BLESSINGS.find(b=>b.id===work.gift.blessing)?.text:null,
      wrapping:work.gift?[SEA_PAPERS.find(p=>p.id===work.gift.paper)?.name,SEA_RIBBONS.find(r=>r.id===work.gift.ribbon)?.name].filter(Boolean).join(' · '):null,
      storyId:story&&storyUnlocked(this.save,story)?story.id:null};
  }
  private collectionPreview(id:string,repeat=false) {
    this.selectedCollection={id,repeat};const detail=this.collectionView();
    if(!detail){this.selectedCollection=null;this.info('尚未收藏','完成对应顾客委托后，就能欣赏这份作品。');return;}
    this.stopVideo();this.clear(this.overlay);this.modal='collection';this.dialogueState=null;this.recordReturn=null;
    this.clear(this.notices);this.toastGeneration++;this.accessibility?.showDialog('珍藏记忆 · '+detail.name);
    for(const [node,key] of this.layoutKeys)if(key==='collectionDetail'||key.startsWith('collectionDetail/'))this.layoutKeys.delete(node);
    for(const key of this.layoutCounts.keys())if(key.startsWith('collectionDetail/'))this.layoutCounts.delete(key);
    const stage=this.container('Collection detail stage',this.overlay);this.layoutKeys.set(stage,'collectionDetail');
    this.rect('Collection detail backdrop',0,0,720,1280,PAPER,stage,0).addComponent(BlockInputEvents);
    this.image('pencil-collection-detail-frame',0,-5,720,1290,stage);
    this.button('返回收藏',270,48,180,48,()=>this.closeModal(),stage);
    this.text('手串工坊 & 饰品店',151,114,418,56,36,'#69452e',stage,true);
    this.text('一条手串，留住一份心意',170,171,380,23,20,MUTED,stage,true);
    this.ellipse('Watercolor wash',360,405,220,197,'#e8cc9a25',stage);
    this.bracelet(detail.work.beads,360,395,170,stage);
    this.image('charm-'+detail.work.charm,327,550,66,72,stage);
    if(detail.work.travelCharm)this.image('charm-'+detail.work.travelCharm,475,502,47,51,stage);
    this.image('pencil-collection-detail-card',86,628,548,194,stage);
    this.rect('Memory illustration mat',110,656,114,130,'#e9dfc7',stage,3,'#c7ad88');
    this.image(detail.customer==='奶奶'?'grandma':'girl',116,660,102,92,stage);
    this.text(detail.customer==='奶奶'?'委托人 · 奶奶':'制作者 · 阿禾',112,752,110,30,16,MUTED,stage,true);
    this.text('珍藏记忆：'+detail.name,243,648,365,48,26,'#69452e',stage);
    this.text(detail.customer+' · '+detail.occasion+'\n'+detail.text,243,701,363,92,21,INK,stage);
    this.ellipse('Collection stamp',605,611,43,43,'#fcf2e8',stage,'#b77968');
    this.image('pencil-album-flower',589,579,32,32,stage);
    this.text(repeat?'第 '+detail.work.number+' 单':'已收藏',567,612,76,30,17,'#9c6352',stage,true);
    this.text('制作材料',245,833,230,39,28,'#69452e',stage,true);
    const compact=detail.materials.length>5,columns=compact?4:Math.max(4,detail.materials.length);
    detail.materials.forEach((material:any,i:number)=>{
      const width=560/columns,x=80+(i%columns)*width,y=compact?876+Math.floor(i/columns)*75:886,size=compact?39:49;
      this.rect('Material '+material.art,x+4,y,width-8,compact?43:69,'#eadcc3a0',stage,10);
      this.image(material.art,x+(width-size)/2,y+3,size,size,stage);
      this.text(material.name+(compact?' ×'+material.count:''),x,compact?y+44:958,width,compact?29:34,19,INK,stage,true);
      if(!compact)this.text('× '+material.count,x,990,width,26,18,MUTED,stage,true);
    });
    this.text('系列信息：'+detail.series+' · '+detail.customer,96,1031,528,35,23,'#69452e',stage,true);
    this.button('再做一条',95,1093,245,76,()=>this.collectionRemake(),stage,true);
    this.button('查看订单故事',372,1093,253,76,()=>this.collectionStory(),stage,true);
    this.text(detail.blessing?'祝福：'+detail.blessing:'阿禾手作 · 保存交付时的真实作品',131,1180,458,39,20,INK,stage,true);
    if(detail.wrapping)this.text(detail.wrapping,169,1221,382,29,18,MUTED,stage,true);
  }
  private collectionRemake() {
    const detail=this.collectionView();if(!detail)return;
    const {id,repeat}=this.selectedCollection!,order=this.currentOrder();
    this.dialog('collection-remake','沿用这份配色');
    this.text('将收藏作品的排珠与吊坠，作为当前委托「'+order.name+'」的制作起点。\n\n这会替换当前委托草稿，可在手作台撤销；仍需满足'+order.customer+'的要求才能交付。\n\n原收藏保留，珠材在正式交付时扣除。',105,356,510,390,26,INK,this.overlay);
    this.button('保留当前草稿',135,797,450,62,()=>this.collectionPreview(id,repeat),this.overlay);
    this.button('按此配色继续委托',135,892,450,64,()=>{
      this.undo.push({draft:[...this.save.draft],charm:this.save.charm});if(this.undo.length>60)this.undo.shift();
      this.save.draft=[...detail.work.beads];this.save.charm=detail.work.charm;this.persist();this.navigate('craft');
    },this.overlay,true);
  }
  private collectionStory(line=0) {
    const detail=this.collectionView();if(!detail)return;
    const {id,repeat}=this.selectedCollection!,story=detail.storyId?STORIES.find(s=>s.id===detail.storyId):null;
    const records=[[detail.customer,detail.text],...(!repeat&&story?story.lines:[])];
    const entry=records[Math.min(line,records.length-1)],back=()=>this.collectionPreview(id,repeat);
    const stage=this.dialogueStage('collection-story',detail.name,entry[0],entry[1],records.slice(0,line+1),()=>this.collectionStory(line),back);
    this.text('订单回忆 · '+(line+1)+' / '+records.length,82,1188,240,40,20,MUTED,stage);
    this.button(line===records.length-1?'返回珍藏':'下一句  →',396,1180,242,56,()=>line===records.length-1?back():this.collectionStory(line+1),stage,true);
  }
  private journal() {
    this.text('OUR LITTLE MEMORIES',48,136,624,28,18,MUTED);
    this.text('已读 '+this.save.seenStories.length+' / '+STORIES.length,480,136,192,28,18,MUTED,this.page,true);
    this.text('把自己的名字，写进明天',48,180,624,58,38);
    this.button('故事路线 · 解锁',48,266,300,64,()=>this.navigate('storyMap'));
    this.button('人物故事 · 回忆',372,266,300,64,()=>{this.memoryIndex=-1;this.navigate('memories');});
    const journey=JOURNEY[Math.min(6,this.save.completed.length)];
    const wish=this.rect('Current chapter',48,358,624,120,'#e8ecde',this.page,20);
    this.text(journey.title+'  ›',72,370,576,39,26,SAGE);
    this.text(journey.goal,72,420,576,42,22,INK);
    const readWish=()=>this.info(journey.title,journey.pressure+'\n\n'+journey.goal);
    wish.on(Node.EventType.TOUCH_END,readWish);this.accessibleButton('看看当前心愿',readWish);
    const start=this.journalPage*4;
    STORIES.slice(start,start+4).forEach((s,offset)=>{
      const i=start+offset,y=510+offset*142,unlocked=storyUnlocked(this.save,s),read=this.save.seenStories.includes(s.id);
      this.rect('Story '+s.id,48,y,624,124,unlocked?'#fffaf1':'#f0ebdf',this.page,18,unlocked?'#dfd1b6':'');
      this.text((read?'已读':unlocked?'未读':'待解锁')+' · '+s.title,72,y+14,576,40,26,unlocked?INK:MUTED);
      if(unlocked){
        this.button('阅读 / 重温',72,y+64,s.evidence&&read?274:576,48,()=>this.startStory(i));
        if(s.evidence&&read)this.button('收好相关记录',370,y+64,278,48,()=>this.info(s.evidence.title,s.evidence.text));
      }else this.text('完成对应委托或升级家具后开启',72,y+68,576,36,21,MUTED);
    });
    this.button('上一页故事',48,1094,162,64,()=>{this.journalPage--;this.render();},this.page,false,this.journalPage>0);
    const letter=this.button(this.save.seaHeart.visited?'旅行留影 · 小满的第一次独行':seaVisitReady(this.save)?'小满回来了 · 听听后来的故事':'海风订单 · 心意聊天与回访',230,1094,260,64,()=>this.seaRecord());
    letter.children.find(n=>n.getComponent(Label))!.getComponent(Label)!.string=this.save.seaHeart.visited?'旅行留影':seaVisitReady(this.save)?'小满回来了':'心意来信';
    this.button('下一页故事',510,1094,162,64,()=>{this.journalPage++;this.render();},this.page,false,start+4<STORIES.length);
  }
  private storyMap() {
    const route=storyRoute(this.save),current=route.stops.find(s=>s.id===route.currentId)!;
    this.image('pencil-route-frame',0,0,720,1280);
    this.image('pencil-route-banner',70,55,568,126);
    this.text('珠光小店 · 手作时光',157,76,408,60,35,'#69452e',this.page,true);
    this.button('设置',20,18,68,56,()=>this.settings());
    this.button('返回小店',101,22,136,46,()=>this.navigate('home'));
    this.button('珠材 '+rules.total(this.save.inventory),455,20,117,46,()=>this.inventory());
    this.rect('Route coins',578,20,118,46,'#fff8e8',this.page,18,'#b4976b');
    this.text('金币 '+this.save.coins,582,22,110,42,20,INK,this.page,true);
    const curves=[[[343,271],[449,244],[485,282],[520,360]],[[410,480],[361,487],[328,498],[313,543]],[[256,750],[271,801],[344,826],[411,827]],[[467,922],[430,958],[371,967],[337,970]]];
    const chain=this.box('Pearl story path',0,0,720,1280).addComponent(Graphics);
    curves.forEach((points,index)=>{
      chain.lineWidth=2;chain.strokeColor=color('#b39a7d');
      chain.moveTo(points[0][0],-points[0][1]);chain.bezierCurveTo(points[1][0],-points[1][1],points[2][0],-points[2][1],points[3][0],-points[3][1]);chain.stroke();
      for(let i=0;i<=17;i++){
        const t=i/17,u=1-t,x=u*u*u*points[0][0]+3*u*u*t*points[1][0]+3*u*t*t*points[2][0]+t*t*t*points[3][0],y=u*u*u*points[0][1]+3*u*u*t*points[1][1]+3*u*t*t*points[2][1]+t*t*t*points[3][1];
        chain.fillColor=color(i===8?(route.stops[index+1].unlocked?'#a4c0c6':'#d5c7b1'):'#fff4e3');chain.strokeColor=color('#9c7c54');chain.lineWidth=i===8?3:1.5;
        chain.ellipse(x,-y,i===8?10:5.5,i===8?10:5.5);chain.fill();chain.ellipse(x,-y,i===8?10:5.5,i===8?10:5.5);chain.stroke();
      }
    });
    const positions=[[76,190,280,215],[404,349,242,205],[83,523,270,199],[411,737,235,184],[86,830,263,193]];
    route.stops.forEach((stop,i)=>{
      const [x,y,w,h]=positions[i],active=stop.id===route.currentId;
      if(active)this.rect('Current story glow',x-7,y-7,w+14,h+28,'#f4d99d',this.page,20,'#b58c46');
      const tile=this.box('Story stop '+stop.id,x,y,w,h);
      this.image('pencil-route-'+stop.id,0,0,w,h,tile);
      if(!stop.unlocked){
        this.rect('Locked chapter wash',0,0,w,h,'#f7f0df80',tile,4);
        const lock=this.box('Chapter lock',w/2-22,h/2-27,44,54,tile).addComponent(Graphics);
        lock.lineWidth=4;lock.strokeColor=color('#8a704f');lock.ellipse(22,-15,12,15);lock.stroke();
        this.rect('Lock body',w/2-22,h/2-5,44,34,'#d6bf90',tile,7,'#8a704f');this.ellipse('Keyhole',w/2,h/2+9,4,7,'#69533e',tile);
      }
      this.rect('Chapter plaque',x+7,y+h-30,w-14,44,stop.unlocked?'#fff3d8':'#eee5d4',this.page,15,active?'#9d7b44':'#bca78c');
      this.text(stop.name,x+21,y+h-27,w-42,38,29,stop.unlocked?'#69452e':MUTED,this.page,true);
      if(stop.read)this.text('✓ 已读',x+6,y+5,89,30,19,SAGE);
      const open=()=>stop.unlocked?this.routeChapter(stop.id):this.toast('解锁条件：'+stop.hint);
      this.box('Chapter touch area '+stop.id,x,y,w,h+14).on(Node.EventType.TOUCH_END,open);
      this.accessibleButton((stop.unlocked?'查看章节 · ':'解锁条件 · ')+stop.name,open);
      if(active)this.button('制作手串',x+21,y+h+30,w-42,42,()=>this.navigate('craft'),this.page,true);
    });
    this.button('背包',70,1114,106,69,()=>this.inventory());
    this.button(route.nextStoryId?'继续故事':route.read===route.total?'继续营业':'制作手串 · 解锁故事',195,1112,330,78,()=>route.nextStoryId?this.startStory(STORIES.findIndex(s=>s.id===route.nextStoryId)):this.navigate(route.read===route.total?'home':'craft'),this.page,true);
    this.button('图鉴',545,1114,106,69,()=>this.navigate('album'));
    this.text('当前章节 · '+current.name+'  '+route.read+'/'+route.total,133,1197,454,34,24,INK,this.page,true);
    this.rect('Story reading track',199,1234,322,13,'#d8c9ae',this.page,6,'#a78d67');
    if(route.read)this.rect('Stories actually read',200,1235,320*route.read/route.total,11,SAGE,this.page,5);
    this.button('回忆手账',278,18,146,46,()=>this.navigate('journal'));
  }
  private routeChapter(id:string) {
    const stop=storyRoute(this.save).stops.find(s=>s.id===id);if(!stop?.unlocked)return;
    this.dialog('route-chapter',stop.name+' · 故事');
    stop.scenes.forEach((sceneId,i)=>{
      const scene=STORIES.find(s=>s.id===sceneId)!,open=storyUnlocked(this.save,scene),read=this.save.seenStories.includes(sceneId),y=360+i*211;
      this.rect('Chapter story '+sceneId,95,y,530,180,'#fffaf0',this.overlay,15,'#cfb99a');
      this.text(open?scene.title:'下一段故事',113,y+12,494,49,28,open?INK:MUTED,this.overlay,true);
      this.text(read?'已读 · 可以重温':open?'新故事已解锁':stop.hint,113,y+65,494,52,22,MUTED,this.overlay,true);
      this.button(read?'重温 · '+scene.title:'阅读 · '+(open?scene.title:'待解锁'),143,y+123,434,44,()=>this.startStory(STORIES.indexOf(scene)),this.overlay,true,open);
    });
    this.button('返回故事路线',160,945,400,58,()=>this.closeModal(),this.overlay);
  }
  private memoryView() {
    const people=characterMemories(this.save),person=people.find(p=>p.id===this.memoryId&&p.unlock)||people[0];
    const index=this.memoryIndex<0?person.known.length-1:Math.min(this.memoryIndex,person.known.length-1);
    return {id:person.id,name:person.name,stage:person.stage,steps:person.steps,index,entry:person.known[index],count:person.known.length,
      related:person.orders.slice(-2).map(o=>({id:o.id,name:o.name,completed:!!o.work})),people:people.map(p=>({id:p.id,name:p.name,unlocked:p.unlock}))};
  }
  private memories() {
    const people=characterMemories(this.save),view=this.memoryView(),person=people.find(p=>p.id===view.id)!;
    this.memoryId=person.id;
    this.rect('Memory paper',20,28,680,1224,'#fff8e9',this.page,6,'#c3a986');
    this.image('pencil-memory-frame',0,0,720,1280);
    this.text(person.name+'的故事',180,44,390,70,40,'#69452e',this.page,true);
    this.button('返回',596,48,84,52,()=>this.navigate('journal'));
    if(person.id==='grandma')this.image('pencil-memory-grandma',60,137,600,443);
    else if(person.portrait){
      this.ellipse('Portrait wash',360,350,232,211,'#e2e7d9');
      this.image(person.portrait,192,139,336,420);
    }else{
      const work=person.orders.map(o=>o.work).find(Boolean);
      this.ellipse('Memory wash',360,350,235,192,person.id==='xiaoman'?'#dce8e7':'#e9e1d2');
      this.image('botanical',93,184,92,249);
      if(work){this.bracelet(work.beads,360,341,143);this.image('charm-'+work.charm,338,468,44,44);}
      else{this.image('icon-book',292,238,136,156);this.text('从一份委托，\n慢慢认识一个人。',169,415,382,96,28,SAGE,this.page,true);}
      this.text(person.name+'的心意',160,530,400,44,26,SAGE,this.page,true);
    }
    this.text('关系阶段',76,585,300,43,30,'#69452e');
    this.rect('Relationship track',90,639,550,23,'#d7c6ae',this.page,12,'#ae8b69');
    this.rect('Known relationship',90,639,550*view.steps/4,23,'#cc8b86',this.page,12);
    for(let i=1;i<4;i++)this.rect('Relationship division '+i,90+550*i/4,640,2,21,'#fff8e9',this.page,0);
    this.image('icon-heart',67,622,48,54);
    this.text(view.stage,380,670,260,32,25,'#69452e',this.page,true);
    this.text('已知经历',76,704,270,43,30,'#69452e');
    this.text((view.index+1)+' / '+view.count,400,708,100,37,20,MUTED,this.page,true);
    const previous=this.button('上一段经历',506,704,62,43,()=>{this.memoryIndex=view.index-1;this.render();},this.page,false,view.index>0);
    const next=this.button('下一段经历',580,704,62,43,()=>{this.memoryIndex=view.index+1;this.render();},this.page,false,view.index<view.count-1);
    previous.children.find(n=>n.getComponent(Label))!.getComponent(Label)!.string='‹';
    next.children.find(n=>n.getComponent(Label))!.getComponent(Label)!.string='›';
    const entry=view.entry,card=this.rect('Known experience',74,756,572,128,'#fffaf0',this.page,10,'#b89a7c');
    this.text(entry.title,16,8,380,30,21,SAGE,card);
    this.text(entry.text,16,42,540,78,23,'#69452e',card);
    if(entry.storyId){
      const replay=()=>this.startStory(STORIES.findIndex(s=>s.id===entry.storyId));
      this.text('点此重温',420,8,135,30,18,MUTED,card,true);
      card.on(Node.EventType.TOUCH_END,replay);this.accessibleButton('重温这段回忆',replay);
    }
    this.text('相关订单',76,895,340,39,28,'#69452e');
    const orders=person.orders.slice(-2);
    if(!orders.length)this.text('完成更多委托，慢慢留下共同的故事。',80,942,560,54,22,MUTED,this.page,true);
    orders.forEach((order,i)=>{
      const x=76+i*292,go=()=>order.work?this.collectionPreview(order.id):this.navigate('craft');
      const tile=this.rect('Related '+order.id,x,942,276,67,'#f3ead9',this.page,9,'#cfb89b');
      if(order.work){this.bracelet(order.work.beads,36,31,23,tile);this.image('charm-'+order.work.charm,30,47,12,14,tile);}
      else this.image('icon-orders',14,12,44,44,tile);
      this.text(order.name,75,4,191,32,21,INK,tile);
      this.text(order.work?'查看已交付作品':'正在等待 · 去制作',75,35,191,27,17,SAGE,tile);
      tile.on(Node.EventType.TOUCH_END,go);this.accessibleButton((order.work?'查看相关作品 · ':'制作相关委托 · ')+order.name,go);
    });
    this.rect('People strip',68,1029,590,112,'#eee2cd',this.page,15);
    people.forEach((p,i)=>{
      const x=80+i*115,active=p.id===person.id;
      const tile=this.rect('Person '+p.id,x,1040,104,90,active?SAGE:'#f8efdf',this.page,10,active?'#b8ba91':'#b79a78');
      if(p.unlock&&p.portrait)this.image(p.portrait,24,6,56,59,tile);
      else if(p.unlock)this.text(p.name,7,9,90,42,25,active?PAPER:SAGE,tile,true);
      else{this.ellipse('Unknown person',52,27,15,17,'#aa9a85',tile);this.ellipse('Unknown shoulders',52,52,26,19,'#aa9a85',tile);this.text('锁',31,27,42,37,22,PAPER,tile,true);}
      this.text(p.unlock?p.name:'待相识',5,65,94,22,17,active?PAPER:MUTED,tile,true);
      const select=()=>{if(!p.unlock){this.toast('完成'+(p.id==='teacher'?'海风':'第一份')+'委托后，就能慢慢认识她。');return;}this.memoryId=p.id;this.memoryIndex=-1;this.render();};
      tile.on(Node.EventType.TOUCH_END,select);this.accessibleButton(p.unlock?'回忆'+p.name:'未相识的人物 '+(i+1),select);
    });
    this.button('开始制作 · 当前委托',178,1165,364,70,()=>this.navigate('craft'),this.page,true);
  }
  private dialog(id: string,title: string) {
    this.stopVideo();this.clear(this.overlay);this.modal=id;this.dialogueState=null;this.recordReturn=null;
    this.accessibility?.showDialog(title);
    const blocker=this.rect('Modal backdrop',0,0,720,1280,'#403a2cc4',this.overlay,0);blocker.addComponent(BlockInputEvents);
    this.rect('Dialog paper',60,230,600,820,PAPER,this.overlay,26,'#c7b18b');
    this.text(title,94,253,478,70,32,INK,this.overlay);
    this.button('×',579,250,58,54,()=>this.dismiss(),this.overlay);
  }
  private closeModal() { this.stopVideo();this.clear(this.overlay);this.modal='';this.musicFromPause=false;this.dialogueState=null;this.recordReturn=null;this.selectedCollection=null;this.accessibility?.closeDialog(); }
  private dismiss() {
    if(this.modal==='first-order'){this.save=rules.recordFirstStep(this.save,'craft');this.persist();this.navigate('craft');return;}
    if(this.modal==='pause-restart'||this.modal==='pause-leave'||this.modal==='music'&&this.musicFromPause){this.pauseMatch();return;}
    if(this.modal==='dialogue-record'&&this.recordReturn){const resume=this.recordReturn;this.recordReturn=null;resume();return;}
    if((this.modal==='collection-story'||this.modal==='collection-remake')&&this.selectedCollection){this.collectionPreview(this.selectedCollection.id,this.selectedCollection.repeat);return;}
    if(this.modal==='result'){if(this.session?.status==='won')this.claim();else this.leaveGather();return;}
    this.closeModal();if(this.screen==='packing')this.render();
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
    this.button('背景音乐 · 切歌 / 音量',110,345,500,64,()=>this.musicDialog(),this.overlay,true);
    this.button('操作音效  '+(this.save.sound?'开启':'关闭'),110,425,500,64,()=>{this.save.sound=!this.save.sound;this.persist();this.settings();},this.overlay);
    this.button('减少动态效果  '+(this.save.reduced?'开启':'关闭'),110,505,500,64,()=>{this.save.reduced=!this.save.reduced;this.persist();this.settings();},this.overlay);
    this.button('导出 / 导入存档',110,585,500,64,()=>this.saveDialog(),this.overlay);
    this.button('玩法说明',110,665,500,64,()=>this.info('小店的日常','采珠：交换相邻珠子，三连或 2×2 同色方块可消。\n手作：按顾客要求点珠、选吊坠后包装交付。\n音乐：设置中点选切歌，拖动音量条调节。\n装修：先免费打扫，再用金币修屋与添置家具。\n故事：委托推进主线，家具解锁支线。\n电脑：Esc 返回，F 全屏；方向键、空格操作棋盘。'),this.overlay);
    this.button('我们的故事',110,745,500,64,()=>this.navigate('journal'),this.overlay);
    this.button('重新开始',110,871,500,60,()=>this.resetDialog(),this.overlay);
    this.text('Cocos 原生版 · 本地自动存档\n原网页存档可通过 JSON 导入继续',110,952,500,66,20,MUTED,this.overlay,true);
  }
  private musicDialog(fromPause=false) {
    this.dialog('music','小店的背景音乐');
    this.musicFromPause=fromPause;
    this.text('点击曲名切换 · 当前曲目循环播放',105,335,510,40,22,MUTED,this.overlay,true);
    MUSIC_TRACKS.forEach((track,i)=>this.button((track.id===this.save.music.track?'✓ ':'')+track.name,105,390+i*61,510,51,()=>{
      this.save.music.track=track.id;this.save.music.enabled=true;this.persist();this.music?.update(this.save.music);this.musicDialog(fromPause);
    },this.overlay,track.id===this.save.music.track));
    const label=this.text('音乐音量 '+Math.round(this.save.music.volume*100)+'%',105,758,510,40,25,SAGE,this.overlay,true);
    const bar=this.box('Music volume',160,814,400,44,this.overlay),drawing=bar.addComponent(Graphics);
    let accessibleVolume:HTMLInputElement|undefined;
    const redraw=()=>{
      const width=380*this.save.music.volume;
      drawing.clear();drawing.fillColor=color('#ddd0b8');drawing.roundRect(10,-28,380,12,6);drawing.fill();
      if(width>0){drawing.fillColor=color(SAGE);drawing.roundRect(10,-28,width,12,6);drawing.fill();}
      drawing.fillColor=color('#c2a477');drawing.circle(10+width,-22,16);drawing.fill();
      label.string='音乐音量 '+Math.round(this.save.music.volume*100)+'%';
      if(accessibleVolume)accessibleVolume.value=String(Math.round(this.save.music.volume*100));
    };
    const change=(value:number)=>{this.save.music.volume=Math.round(Math.max(0,Math.min(1,value))*100)/100;this.music?.update(this.save.music);redraw();};
    const adjust=(e:EventTouch)=>change((this.localPoint(e).x-170)/380);
    bar.on(Node.EventType.TOUCH_START,adjust);bar.on(Node.EventType.TOUCH_MOVE,adjust);
    bar.on(Node.EventType.TOUCH_END,()=>this.persist());bar.on(Node.EventType.TOUCH_CANCEL,()=>this.persist());
    this.button('−',105,810,54,50,()=>{change(this.save.music.volume-.1);this.persist();},this.overlay);
    this.button('+',561,810,54,50,()=>{change(this.save.music.volume+.1);this.persist();},this.overlay);
    accessibleVolume=this.accessibility?.range?.('背景音乐音量',Math.round(this.save.music.volume*100),value=>{change(value/100);this.persist();});
    redraw();
    this.button(this.save.music.enabled?'暂停音乐':'播放音乐',105,888,245,58,()=>{this.save.music.enabled=!this.save.music.enabled;this.persist();this.music?.update(this.save.music);this.musicDialog(fromPause);},this.overlay);
    this.button('下一首',370,888,245,58,()=>{const i=MUSIC_TRACKS.findIndex(t=>t.id===this.save.music.track);this.save.music.track=MUSIC_TRACKS[(i+1)%MUSIC_TRACKS.length].id;this.save.music.enabled=true;this.persist();this.music?.update(this.save.music);this.musicDialog(fromPause);},this.overlay,true);
    if(fromPause)this.button('返回暂停',105,969,510,48,()=>this.pauseMatch(),this.overlay);
    else this.text('首次点按后开始播放 · 音乐与操作音效独立',105,969,510,48,20,MUTED,this.overlay,true);
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
        this.button('确认导入',130,820,460,70,()=>{this.save=normalized;this.session=null;this.undo=[];this.contestUndo=[];this.music?.update(this.save.music);this.persist();this.navigate(rules.pendingDelivery(this.save)?'delivery':this.save.started?'home':'cover');this.toast('进度已导入。');},this.overlay,true);
      }catch{this.toast('这份存档格式不正确，请粘贴完整的 JSON。');}
    },this.overlay,true);
  }
  private resetDialog() {
    this.dialog('reset','重新打开旧珠盒？');
    this.text('这会清空当前设备的游戏进度。\n建议先在设置中导出存档。',100,430,520,160,29,INK,this.overlay,true);
    this.button('保留进度',130,719,460,64,()=>this.closeModal(),this.overlay,true);
    this.button('确认重新开始',130,823,460,64,()=>{this.save=rules.freshSave();this.session=null;this.undo=[];this.contestUndo=[];this.music?.update(this.save.music);this.persist();this.navigate('cover');},this.overlay);
  }
  private startStory(index: number) {
    const s=STORIES[index];if(!s||!storyUnlocked(this.save,s))return;
    this.storyIndex=index;this.storyLine=0;
    const media=this.media[s.id];
    if(media?.src&&/^videos\/[a-zA-Z0-9_\-/]+\.mp4$/.test(media.src))this.storyVideo(media);
    else this.storyText();
  }
  private dialogueStage(id:string,title:string,speaker:string,body:string,records:string[][],resume:()=>void,skip:()=>void,choices=false) {
    this.stopVideo();this.clear(this.overlay);this.modal=id;this.dialogueState={title,speaker,text:body};
    this.clear(this.notices);this.toastGeneration++;
    this.accessibility?.showDialog(title);
    for(const [node,key] of this.layoutKeys)if(key==='dialogue'||key.startsWith('dialogue/'))this.layoutKeys.delete(node);
    for(const key of this.layoutCounts.keys())if(key.startsWith('dialogue/'))this.layoutCounts.delete(key);
    const stage=this.container('Dialogue stage',this.overlay);this.layoutKeys.set(stage,'dialogue');
    this.rect('Dialogue backdrop',0,0,720,1280,'#899879',stage,0).addComponent(BlockInputEvents);
    const illustration=this.image('pencil-dialogue-stage',0,0,720,930,stage),size=illustration.getComponent(UITransform)!.contentSize;
    for(const [id,name] of [['ahe','阿禾'],['grandma','奶奶']]){
      const portrait=this.image('pencil-dialogue-'+id,0,0,size.width,size.height,illustration).getComponent(Sprite);
      if(portrait)portrait.color=color(speaker===name?'#ffffff':'#787878');
    }
    this.text(title,218,301,284,66,25,PAPER,stage,true);
    this.image('icon-book',568,49,36,39,stage);
    this.button('记录',548,95,76,44,()=>this.dialogueRecord(title,records,resume),stage);
    const icon=this.box('Skip icon',650,53,40,34,stage).addComponent(Graphics);
    icon.strokeColor=color('#795f46');icon.fillColor=color('#fff8e8');icon.lineWidth=2.5;
    for(const x of [0,18]){icon.moveTo(x,0);icon.lineTo(x+17,-15);icon.lineTo(x,-30);icon.close();icon.fill();icon.stroke();}
    this.button('跳过',635,95,76,44,skip,stage);
    for(const [x,action] of [[548,()=>this.dialogueRecord(title,records,resume)],[635,skip]] as const){
      this.box('Dialogue control touch area',x,42,84,102,stage).on(Node.EventType.TOUCH_END,(e:EventTouch)=>{e.propagationStopped=true;if(!this.busy){this.play();action();}});
    }
    const top=choices?775:925;
    this.rect('Dialogue card shadow',38,top+7,648,1250-top,'#5e59486b',stage,13);
    this.rect('Dialogue card',34,top,652,1250-top,'#fff8ed',stage,12,'#967554');
    this.rect('Dialogue card lining',43,top+8,634,1234-top,'#fff8ed',stage,7,'#d1b895');
    this.polygon('Dialogue pointer',[[565,top+9],[590,top-22],[618,top+9]],'#fff8ed',stage,'#b79a77');
    this.text(speaker,82,top+22,550,58,34,'#69452e',stage);
    this.rect('Dialogue rule',82,top+91,556,2,'#d1b895',stage,0);
    const text=this.text(body,82,top+106,556,choices?112:140,choices?25:29,'#69452e',stage);
    text.verticalAlign=Label.VerticalAlign.TOP;
    return stage;
  }
  private dialogueRecord(title:string,records:string[][],resume:()=>void,page=-1) {
    const last=Math.max(0,Math.ceil(records.length/2)-1);page=page<0?last:Math.min(last,Math.max(0,page));
    this.dialog('dialogue-record','对话记录');this.recordReturn=resume;
    this.text(title,100,336,520,60,26,SAGE,this.overlay,true);
    records.slice(page*2,page*2+2).forEach((line,i)=>{
      this.text(line[0],105,411+i*200,510,39,26,SAGE,this.overlay);
      this.text(line[1],105,455+i*200,510,137,25,INK,this.overlay);
    });
    this.text((page+1)+' / '+(last+1),290,832,140,40,20,MUTED,this.overlay,true);
    this.button('上一页',105,883,155,52,()=>this.dialogueRecord(title,records,resume,page-1),this.overlay,false,page>0);
    this.button('下一页',460,883,155,52,()=>this.dialogueRecord(title,records,resume,page+1),this.overlay,false,page<last);
    this.button('返回对话',235,958,250,57,resume,this.overlay,true);
  }
  private finishDialogueStory() {
    const s=STORIES[this.storyIndex];this.save=finishStory(this.save,s.id);this.persist();this.closeModal();this.render();
    if(s.evidence)this.toast('已收入手账：'+s.evidence.title);
  }
  private storyText() {
    const s=STORIES[this.storyIndex],line=s.lines[this.storyLine];
    const stage=this.dialogueStage('story',s.title,line[0],line[1],s.lines.slice(0,this.storyLine+1),()=>this.storyText(),()=>this.finishDialogueStory());
    this.text(`${this.storyLine+1} / ${s.lines.length}`,82,1188,200,40,20,MUTED,stage);
    this.button(this.storyLine===s.lines.length-1?'收好这一页':'下一句  →',396,1180,242,56,()=>{
      if(this.storyLine<s.lines.length-1){this.storyLine++;this.storyText();}else this.finishDialogueStory();
    },stage,true);
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
    if(e.keyCode===KeyCode.ESCAPE){if(this.modal)this.dismiss();else if(this.screen==='delivery')this.continueDelivery();else if(['match','craft','contestCraft'].includes(this.screen))this.pauseMatch();else this.navigate(this.screen==='packing'?'craft':'home');return;}
    if(e.keyCode===KeyCode.KEY_F){if(displayScreen.fullScreen())displayScreen.exitFullScreen();else displayScreen.requestFullScreen();return;}
    if(this.screen!=='match'||this.modal||this.busy)return;
    const offsets:Record<number,number>={[KeyCode.ARROW_LEFT]:-1,[KeyCode.ARROW_RIGHT]:1,[KeyCode.ARROW_UP]:-8,[KeyCode.ARROW_DOWN]:8};
    if(offsets[e.keyCode]!==undefined){const next=this.keyboardCursor+offsets[e.keyCode];if(rules.adjacent(this.keyboardCursor,next)){this.keyboardCursor=next;this.selected=next;this.hint=this.keyboardArmed<0?[]:[this.keyboardArmed];this.render();}}
    if(e.keyCode===KeyCode.SPACE||e.keyCode===KeyCode.ENTER){
      if(this.tool||this.session.specials?.[this.keyboardCursor]){this.keyboardArmed=-1;this.boardClick(this.keyboardCursor);return;}
      if(this.keyboardArmed>=0&&rules.adjacent(this.keyboardArmed,this.keyboardCursor)){const a=this.keyboardArmed;this.keyboardArmed=-1;this.swap(a,this.keyboardCursor);}
      else{this.keyboardArmed=this.keyboardCursor;this.selected=this.keyboardCursor;this.hint=[];this.render();}
    }
  }
}
