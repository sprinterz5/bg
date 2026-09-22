// Crops Figma-exported SVG viewBoxes to the real path bounds (Figma often exports icons shifted inside an empty frame).
// Usage (from apps/mobile/assets/icons): ../../../../.tools/node/node.exe ../../scripts/crop-svg.cjs a.svg b.svg
// Only for path-only SVGs with absolute commands; skip files with <circle>/<rect> backgrounds or masks.
const fs=require('fs');
for (const f of process.argv.slice(2)) {
  let s=fs.readFileSync(f,'utf8');
  let minX=1e9,minY=1e9,maxX=-1e9,maxY=-1e9;
  const sw=Math.max(0,...[...s.matchAll(/stroke-width="([\d.]+)"/g)].map(m=>+m[1]));
  for (const m of s.matchAll(/ d="([^"]+)"/g)) {
    const toks=m[1].match(/[A-Za-z]|-?[\d.]+(?:e-?\d+)?/g); let cmd='',nums=[];
    const flush=()=>{ if(!cmd)return; const u=cmd.toUpperCase();
      if(cmd!==u&&cmd!=='z'){ throw new Error(f+': relative cmd '+cmd); }
      if(u==='H'){for(const x of nums){minX=Math.min(minX,x);maxX=Math.max(maxX,x);}}
      else if(u==='V'){for(const y of nums){minY=Math.min(minY,y);maxY=Math.max(maxY,y);}}
      else if(u==='A'){for(let i=0;i+6<nums.length;i+=7){const x=nums[i+5],y=nums[i+6];minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}}
      else for(let i=0;i+1<nums.length;i+=2){const x=nums[i],y=nums[i+1];minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);} };
    for(const t of toks){ if(/[A-Za-z]/.test(t)){flush();cmd=t;nums=[];} else nums.push(+t); } flush();
  }
  const p=sw/2; minX-=p;minY-=p;maxX+=p;maxY+=p;
  const w=+(maxX-minX).toFixed(2),h=+(maxY-minY).toFixed(2);
  s=s.replace(/width="[^"]*" height="[^"]*" viewBox="[^"]*"/,`width="${w}" height="${h}" viewBox="${minX.toFixed(2)} ${minY.toFixed(2)} ${w} ${h}"`)
     .replace(' preserveAspectRatio="none"','').replace(' overflow="visible"','').replace(' style="display: block;"','');
  fs.writeFileSync(f,s); console.log(f,w,h);
}
