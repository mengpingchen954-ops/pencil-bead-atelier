import { _decorator, Component, Graphics, Color } from 'cc';
import { EDITOR } from 'cc/env';

const { ccclass, property, executeInEditMode } = _decorator;

/** Serialized editor artwork and stable binding to the real game renderer. */
@ccclass('AtelierLayout')
@executeInEditMode
export class AtelierLayout extends Component {
  @property({ visible: false }) key = '';
  @property({ multiline: true, tooltip: '矢量绘图指令；位置、旋转和缩放请直接编辑节点。' }) drawing = '';
  @property({ visible: false }) originalDrawing = '';
  @property({ visible: false }) originalLabel = '';
  @property({ visible: false }) originalImage = '';
  private lastDrawing = '';

  onEnable() { if (this.drawing) this.redraw(); }
  update() { if (EDITOR && this.lastDrawing !== this.drawing) this.redraw(); }

  redraw(target = this.node.getComponent(Graphics) || this.node.addComponent(Graphics)) {
    this.lastDrawing = this.drawing;
    target.clear();
    if (!this.drawing) return;
    try {
      const commands = JSON.parse(this.drawing);
      for (const [op, ...args] of commands) {
        if (op === 'fillColor' || op === 'strokeColor') target[op] = new Color(...args);
        else if (op === 'lineWidth') target.lineWidth = args[0];
        else if (['moveTo','lineTo','bezierCurveTo','roundRect','rect','ellipse','circle','close','fill','stroke'].includes(op)) (target as any)[op](...args);
      }
    } catch (error) { console.error('Atelier layout drawing: ' + this.node.name, error); }
  }
}

