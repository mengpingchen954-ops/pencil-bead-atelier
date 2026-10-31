import { _decorator, Component, Enum } from 'cc';
import { EDITOR } from 'cc/env';
const { ccclass, property, executeInEditMode } = _decorator;

const Pages = Enum({ '首页': 0, '封面': 1, '委托': 2, '手作': 3, '消除': 4, '装修': 5, '图鉴': 6, '手账': 7, '比赛': 8, '参赛手作': 9 });
const pageNames = ['home','cover','orders','craft','match','decor','album','journal','contest','contestCraft'];

@ccclass('AtelierLayouts')
@executeInEditMode
export class AtelierLayouts extends Component {
  @property({ type: Pages, tooltip: '切换编辑器中显示的页面；运行后按真实存档和操作进入页面。' }) page = 0;
  onEnable() { this.showPage(); }
  update() { if (EDITOR) this.showPage(); }
  private showPage() {
    if (EDITOR) this.node.children.forEach(child => { child.active = child.name === pageNames[this.page]; });
  }
}
