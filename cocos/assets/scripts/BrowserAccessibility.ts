// Browser screen readers need semantic controls alongside the native canvas.
// These controls dispatch to the same Cocos actions; they never draw the game.
export class BrowserAccessibility {
  private root: HTMLElement | null = null;
  private page: HTMLElement | null = null;
  private dialog: HTMLElement | null = null;
  private status: HTMLElement | null = null;

  constructor() {
    if (typeof document === 'undefined') return;
    this.root=document.createElement('div');this.root.id='atelier-accessibility';
    this.root.style.cssText='position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap';
    this.page=document.createElement('section');this.page.setAttribute('aria-label','珠光小店');
    this.dialog=document.createElement('section');this.dialog.hidden=true;
    this.status=document.createElement('div');this.status.setAttribute('role','status');this.status.setAttribute('aria-live','polite');
    this.root.append(this.page,this.dialog,this.status);document.body.append(this.root);
    document.getElementById('GameCanvas')?.setAttribute('aria-hidden','true');
  }
  clear(modal=false) { (modal?this.dialog:this.page)?.replaceChildren(); }
  showDialog(title:string) {
    if(!this.dialog||!this.page)return;
    this.dialog.hidden=false;this.dialog.setAttribute('role','dialog');this.dialog.setAttribute('aria-label',title);this.dialog.setAttribute('aria-modal','true');this.page.setAttribute('aria-hidden','true');this.page.setAttribute('inert','');
  }
  closeDialog() { if(!this.dialog||!this.page)return;this.dialog.hidden=true;this.dialog.replaceChildren();this.page.removeAttribute('aria-hidden');this.page.removeAttribute('inert'); }
  text(value:string,modal=false) { const parent=modal?this.dialog:this.page;if(!parent)return;const n=document.createElement('p');n.textContent=value;parent.append(n); }
  button(name:string,action:()=>void,modal=false,enabled=true) {
    const parent=modal?this.dialog:this.page;if(!parent)return;
    const n=document.createElement('button');n.type='button';n.textContent=name;n.disabled=!enabled;n.addEventListener('click',action);parent.append(n);
  }
  input(value:string,onInput:(value:string)=>void) {
    if(!this.dialog)return;const n=document.createElement('textarea');n.setAttribute('aria-label','存档 JSON');n.value=value;n.addEventListener('input',()=>onInput(n.value));this.dialog.append(n);
  }
  busy(value:boolean) {
    this.page?.setAttribute('aria-busy',String(value));
    this.page?.querySelectorAll('button').forEach(n=>{if(value){n.dataset.wasDisabled=String(n.disabled);n.disabled=true;}else n.disabled=n.dataset.wasDisabled==='true';});
  }
  announce(message:string) { if(this.status)this.status.textContent=message; }
  destroy() { this.root?.remove(); }
}
