export const THEME = {
  paper: '#faf5e9', ink: '#60391f', sage: '#687c5d', muted: '#857359', gold: '#a77b43',
  disabled: '#ebe5d8', disabledBorder: '#ddd3c2', buttonRadius: 14, dialogRadius: 26,
  bodyFont: 'KaiTi, STKaiti, serif', titleFont: 'KaiTi, STKaiti, serif',
};

export function actionText(label:string) { return label.replace(/ · \d+$/, ''); }

// Keep Chinese punctuation with its preceding glyph and avoid a final orphan.
export function wrapText(value:string,width:number,size:number) {
  return value.split('\n').map(line=>{
    if(!/[\u3400-\u9fff]/.test(line))return line;
    const rows:string[]=[];let row='',used=0;
    for(const glyph of Array.from(line)){
      const advance=/[\u2e80-\uffff]/.test(glyph)?size:size*.56;
      if(row&&used+advance>width&&!/[，。！？；：、）》】」』…]/.test(glyph)){rows.push(row);row='';used=0;}
      row+=glyph;used+=advance;
    }
    if(row)rows.push(row);
    const last=rows.length-1;
    if(last>0&&rows[last].length===1&&rows[last-1].length>2){rows[last]=rows[last-1].slice(-1)+rows[last];rows[last-1]=rows[last-1].slice(0,-1);}
    return rows.join('\n');
  }).join('\n');
}
