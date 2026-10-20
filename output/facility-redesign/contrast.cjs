const fs=require('fs');
const css=fs.readFileSync(__dirname+'/../../แผนผังงานซ่อมอาคาร.html','utf8').match(/<style>([\s\S]*?)<\/style>/)[1];
const luminance=hex=>{const c=hex.slice(1).match(/../g).slice(0,3).map(x=>parseInt(x,16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);return c[0]*.2126+c[1]*.7152+c[2]*.0722;};
const ratio=(a,b)=>{const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
const tokens={};let min=Infinity;
for(const [theme,selector]of [['light',':root'],['dark',':root[data-theme=dark]']]){
 const block=css.slice(css.indexOf(selector+'{')+selector.length+1).split('}')[0];
 for(const m of block.matchAll(/--([a-z0-9-]+):(#[a-f0-9]+)/gi))tokens[m[1]]=m[2].length===4?'#'+m[2].slice(1).split('').map(x=>x+x).join(''):m[2];
 for(const [a,b]of [['fg','surface'],['muted','surface'],['muted','surface-2'],['accent','accent-soft'],['pending','pending-soft'],['progress','progress-soft'],['done','done-soft'],['fg','overview-a'],['muted','overview-b'],['muted','overview-c']]){const r=ratio(tokens[a],tokens[b]);min=Math.min(min,r);if(r<4.5)throw Error(`${theme} ${a}/${b}: ${r}`);}
}
console.log(`Theme text token contrast PASS; minimum ${min.toFixed(2)}:1`);
