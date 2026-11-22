/* Furniture placement for the condo model.
   Classic script (works from file://). index.html calls window.Furnish(ctx) once the apartment is built.
   Units: inches in plan coordinates, the same as plan.json: model x = plan x, model z = plan y.
   On screen in Plan view: north (-x) is up, east (-z) is right.
   The furniture models come from ../furniture/models.js (window.FurnitureKit). */
window.Furnish = function(ctx){
'use strict';
const { THREE, scene, IN, CSS2DObject } = ctx;
const KIT = window.FurnitureKit(THREE);
const EPS = 0.04;                       // ~1 mm: touching is not a clash
const SNAP_PX = 9;                      // snap distance on screen
const DEG = Math.PI/180;
const cmTxt = i => (i*2.54).toFixed(1);
const esc = s => String(s).replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

/* ------------------------------------------------------------ catalogue */
const HIDDEN = new Set(['vanity-mirror']);           // always rides on the brown dresser
const ROOM_ORDER = ['Living','Bedroom','Office','Kitchen','Entryway'];
const CAT = KIT.ITEMS.filter(it=>!HIDDEN.has(it.id)).map(it=>{
  const params=[...(it.params||[])];
  if(it.id==='dresser-brown') params.push({key:'mirror',label:'Vanity mirror on top',type:'check',def:true});
  return {...it, qty:it.qty||1, limit:it.many?Infinity:(it.qty||1), params};
});
const CATI = Object.fromEntries(CAT.map(c=>[c.id,c]));
const variantName = (c,inst)=>{ const p=c.params.find(p=>p.type==='select'); if(!p) return ''; const v=inst.opts[p.key]??p.def; const o=p.options.find(o=>o[0]===v); return o?o[1]:''; };

function optsOf(inst){ const c=CATI[inst.id], o={}; for(const p of c.params) o[p.key]=inst.opts[p.key]??p.def; return o; }
function buildModel(inst){
  const o=optsOf(inst); const g=KIT.build(inst.id,o);
  if(inst.id==='dresser-brown' && o.mirror){ const m=KIT.build('vanity-mirror'); m.position.set(-3,40,-4.5); g.add(m); }
  return g;
}

/* ------------------------------------------------------------ geometry helpers (2D: [x,z]) */
const bbOf = pts=>{ let x0=Infinity,x1=-Infinity,z0=Infinity,z1=-Infinity; for(const [x,z] of pts){ if(x<x0)x0=x; if(x>x1)x1=x; if(z<z0)z0=z; if(z>z1)z1=z; } return {x0,x1,z0,z1}; };
const bbOver = (a,b,e=EPS)=> Math.min(a.x1,b.x1)-Math.max(a.x0,b.x0)>e && Math.min(a.z1,b.z1)-Math.max(a.z0,b.z0)>e;
const yOver = (a,b)=> Math.min(a.y1,b.y1)-Math.max(a.y0,b.y0)>EPS;
function sat(A,B){   // convex polygons overlap by more than EPS
  for(const P of [A,B]) for(let i=0;i<P.length;i++){
    const [x0,z0]=P[i], [x1,z1]=P[(i+1)%P.length]; let nx=z1-z0, nz=x0-x1; const L=Math.hypot(nx,nz); if(L<1e-9) continue; nx/=L; nz/=L;
    let a0=Infinity,a1=-Infinity,b0=Infinity,b1=-Infinity;
    for(const [x,z] of A){ const d=x*nx+z*nz; if(d<a0)a0=d; if(d>a1)a1=d; }
    for(const [x,z] of B){ const d=x*nx+z*nz; if(d<b0)b0=d; if(d>b1)b1=d; }
    if(Math.min(a1,b1)-Math.max(a0,b0)<=EPS) return false;
  }
  return true;
}
function inPoly(P,x,z){ let c=false; for(let i=0,j=P.length-1;i<P.length;j=i++){ const [xi,zi]=P[i],[xj,zj]=P[j]; if(((zi>z)!==(zj>z)) && x<(xj-xi)*(z-zi)/(zj-zi)+xi) c=!c; } return c; }
function distPoly(P,x,z){ if(inPoly(P,x,z)) return 0; let d=Infinity; for(let i=0;i<P.length;i++){ const [ax,az]=P[i],[bx,bz]=P[(i+1)%P.length]; const vx=bx-ax,vz=bz-az; const t=Math.max(0,Math.min(1,((x-ax)*vx+(z-az)*vz)/((vx*vx+vz*vz)||1))); d=Math.min(d,Math.hypot(ax+vx*t-x,az+vz*t-z)); } return d; }
function clipBand(P,ax,lo,hi){   // keep the part of a convex polygon with lo <= coord[ax] <= hi
  const cut=(pts,keep,val)=>{ const out=[]; for(let i=0;i<pts.length;i++){ const a=pts[i], b=pts[(i+1)%pts.length], ia=keep(a[ax]), ib=keep(b[ax]);
    if(ia) out.push(a); if(ia!==ib){ const t=(val-a[ax])/(b[ax]-a[ax]); out.push([a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t]); } } return out; };
  let p=cut(P,v=>v>=lo,lo); if(p.length) p=cut(p,v=>v<=hi,hi); return p;
}

/* ------------------------------------------------------------ collision boxes, measured from the model itself */
const _v=new THREE.Vector3(), _m=new THREE.Matrix4();
function measure(g){
  g.position.set(0,0,0); g.rotation.set(0,0,0); g.updateMatrixWorld(true);
  const boxes=[];
  const fromMatrix=(geo,mat)=>{ const pos=geo.attributes.position, b={x0:Infinity,x1:-Infinity,y0:Infinity,y1:-Infinity,z0:Infinity,z1:-Infinity};
    for(let i=0;i<pos.count;i++){ _v.fromBufferAttribute(pos,i).applyMatrix4(mat);
      if(_v.x<b.x0)b.x0=_v.x; if(_v.x>b.x1)b.x1=_v.x; if(_v.y<b.y0)b.y0=_v.y; if(_v.y>b.y1)b.y1=_v.y; if(_v.z<b.z0)b.z0=_v.z; if(_v.z>b.z1)b.z1=_v.z; }
    if(isFinite(b.x0)) boxes.push(b); };
  const visit=o=>{ if(o.userData.noCollide) return;
    if((o.isMesh||o.isInstancedMesh) && o.geometry && o.geometry.attributes.position){
      if(o.isInstancedMesh){ for(let i=0;i<o.count;i++){ o.getMatrixAt(i,_m); _m.premultiply(o.matrixWorld); fromMatrix(o.geometry,_m.clone()); } }
      else fromMatrix(o.geometry,o.matrixWorld); }
    for(const c of o.children) visit(c); };
  visit(g);
  // drop boxes that sit entirely inside a bigger one
  const vol=b=>(b.x1-b.x0)*(b.y1-b.y0)*(b.z1-b.z0); boxes.sort((a,b)=>vol(b)-vol(a));
  const kept=[]; const t=0.05;
  for(const b of boxes){ if(!kept.some(k=>b.x0>=k.x0-t&&b.x1<=k.x1+t&&b.y0>=k.y0-t&&b.y1<=k.y1+t&&b.z0>=k.z0-t&&b.z1<=k.z1+t)) kept.push(b); }
  // overall size uses every mesh (incl. palm fronds); collisions use the kept, non-foliage boxes
  const bx=new THREE.Box3().setFromObject(g,true);
  const all={x0:bx.min.x,x1:bx.max.x,y0:bx.min.y,y1:bx.max.y,z0:bx.min.z,z1:bx.max.z};
  return {boxes:kept, size:all};
}

/* ------------------------------------------------------------ state */
const FG = new THREE.Group(); FG.name='furniture'; FG.scale.setScalar(IN); FG.userData.noClip=true; scene.add(FG);
const OV = new THREE.Group(); OV.name='furniture overlay'; OV.scale.setScalar(IN); OV.userData.noClip=true; scene.add(OV);
const OVY = 140;                                       // overlay height (above everything, below the plan camera)
const mats = {
  line: new THREE.LineBasicMaterial({color:0x1d2427, transparent:true, opacity:.55, depthTest:false}),
  sel: new THREE.LineBasicMaterial({color:0x2f6f62, depthTest:false}),
  hard: new THREE.LineBasicMaterial({color:0xc0261b, depthTest:false}),
  soft: new THREE.LineBasicMaterial({color:0xc17a12, depthTest:false}),
  swing: new THREE.LineDashedMaterial({color:0x6b7580, dashSize:3, gapSize:2.5, transparent:true, opacity:.8, depthTest:false}),
  gap: new THREE.LineBasicMaterial({color:0x2f6f62, depthTest:false}),
  fillSel: new THREE.MeshBasicMaterial({color:0x2f6f62, transparent:true, opacity:.16, depthTest:false, depthWrite:false, side:THREE.DoubleSide}),
  fillHard: new THREE.MeshBasicMaterial({color:0xc0261b, transparent:true, opacity:.22, depthTest:false, depthWrite:false, side:THREE.DoubleSide}),
  fillSoft: new THREE.MeshBasicMaterial({color:0xd08a1c, transparent:true, opacity:.2, depthTest:false, depthWrite:false, side:THREE.DoubleSide}),
};
let OBST=[], SURF=[], placed=[], sel=null, mode='dollhouse', uidN=1;
const measured = {};                                   // per id+opts: {boxes,size}
function measureFor(inst, g){ const k=inst.id+JSON.stringify(optsOf(inst)); if(!measured[k]) measured[k]=measure(g); return measured[k]; }

/* ------------------------------------------------------------ storage: named layouts */
const KEY='condo5ne.layouts';
let store=null;
try{ store=JSON.parse(localStorage.getItem(KEY)||'null'); }catch(_){}
if(!store||!Array.isArray(store.list)||!store.list.length) store={cur:0, list:[{name:'Layout 1', items:[]}]};
for(const L of (window.CONDO_LAYOUTS||[])) if(L&&L.name&&!store.list.some(x=>x.name===L.name)) store.list.push({name:L.name, items:L.items||[]});
if(!(store.cur>=0&&store.cur<store.list.length)) store.cur=0;
let saveT=null;
function save(now){ clearTimeout(saveT); const f=()=>{ store.list[store.cur].items=placed.map(serial); try{ localStorage.setItem(KEY,JSON.stringify(store)); }catch(_){} }; if(now) f(); else saveT=setTimeout(f,250); }
addEventListener('pagehide',()=>save(true)); document.addEventListener('visibilitychange',()=>{ if(document.visibilityState==='hidden') save(true); });
const r2=v=>Math.round(v*100)/100;
function serial(i){ const R=ctx.rooms(); const room=roomOf(i); const o={id:i.id, x:r2(i.x), z:r2(i.z), rot:r2(i.rot)};
  if(room){ o.room=room; o.rx=r2(i.x-R[room].x0); o.rz=r2(i.z-R[room].z0); }
  if(Object.keys(i.opts).length) o.opts={...i.opts};
  if(i.gid) o.gid=i.gid; if(i.with){ o.with=i.with; o.lx=r2(i.lx); o.lz=r2(i.lz); o.lrot=r2(i.lrot); }
  return o; }
function roomOf(i){ const r=ctx.roomAt(i.x,i.z); return r==='out'?null:r; }

/* ------------------------------------------------------------ instances */
function makeInst(d){
  const R=ctx.rooms(); const i={uid:uidN++, id:d.id, opts:{...(d.opts||{})}, rot:d.rot||0, x:d.x??0, z:d.z??0};
  if(d.room&&R[d.room]&&d.rx!=null){ i.x=R[d.room].x0+d.rx; i.z=R[d.room].z0+d.rz; }   // positions follow their room if the plan is re-measured
  if(d.gid) i.gid=d.gid; if(d.with){ i.with=d.with; i.lx=d.lx||0; i.lz=d.lz||0; i.lrot=d.lrot||0; }
  return i;
}
function rebuild(inst){
  if(inst.g){ FG.remove(inst.g); inst.g.traverse(o=>{ if(o.geometry&&!o.geometry.userData.cached) o.geometry.dispose(); }); }
  const g=buildModel(inst); const m=measureFor(inst,g); inst.g=g; inst.boxes=m.boxes; inst.size=m.size; g.userData.inst=inst.uid; FG.add(g);
  place(inst);
}
function baseY(inst){ return inst.base??0; }
/* chairs placed with the dining table are linked to it (inst.with = table.gid, offsets in the table's frame) */
const linked=t=>t.gid?placed.filter(c=>c.with===t.gid):[];
const tableOf=c=>c.with?placed.find(t=>t.gid===c.with):null;
const isPair=(a,b)=>(a.gid&&b.with===a.gid)||(b.gid&&a.with===b.gid)||(a.with&&a.with===b.with);
function relink(c){ const t=tableOf(c); if(!t){ delete c.with; return; } const th=t.rot*DEG, co=Math.cos(th), si=Math.sin(th), dx=c.x-t.x, dz=c.z-t.z;
  c.lx=dx*co-dz*si; c.lz=dx*si+dz*co; c.lrot=c.rot-t.rot; }
function place(inst){ placeOne(inst);
  for(const c of linked(inst)){ if(!c.g) continue; const th=inst.rot*DEG, co=Math.cos(th), si=Math.sin(th);
    c.x=inst.x+c.lx*co+c.lz*si; c.z=inst.z-c.lx*si+c.lz*co; c.rot=((inst.rot+c.lrot)%360+360)%360; placeOne(c); } }
function placeOne(inst){
  constrain(inst);
  inst.g.position.set(inst.x, baseY(inst), inst.z); inst.g.rotation.set(0,inst.rot*DEG,0);
  inst.w=worldBoxes(inst);
}
function rotXZ(inst,lx,lz){ const t=inst.rot*DEG, c=Math.cos(t), s=Math.sin(t); return [inst.x+lx*c+lz*s, inst.z-lx*s+lz*c]; }
function worldBoxes(inst){ const by=baseY(inst);
  return inst.boxes.map(b=>{ const poly=[[b.x0,b.z0],[b.x1,b.z0],[b.x1,b.z1],[b.x0,b.z1]].map(([x,z])=>rotXZ(inst,x,z)); return {poly, bb:bbOf(poly), y0:b.y0+by, y1:b.y1+by}; }); }
function outline(inst){ const s=inst.size; return [[s.x0,s.z0],[s.x1,s.z0],[s.x1,s.z1],[s.x0,s.z1]].map(([x,z])=>rotXZ(inst,x,z)); }
function unionBB(w){ const b={x0:Infinity,x1:-Infinity,z0:Infinity,z1:-Infinity,y0:Infinity,y1:-Infinity}; for(const q of w){ b.x0=Math.min(b.x0,q.bb.x0); b.x1=Math.max(b.x1,q.bb.x1); b.z0=Math.min(b.z0,q.bb.z0); b.z1=Math.max(b.z1,q.bb.z1); b.y0=Math.min(b.y0,q.y0); b.y1=Math.max(b.y1,q.y1);} return b; }

// small kitchen things live on the counters: keep them fully on a counter surface, at its height
function constrain(inst){
  const c=CATI[inst.id];
  if(!c.small){ inst.base=ctx.floorAt(inst.x,inst.z); return; }
  const o=outline(inst).map(([x,z])=>[x-inst.x,z-inst.z]); const b=bbOf(o);
  let best=null;
  for(const s of SURF){ const lo=s.x0-b.x0, hi=s.x1-b.x1, lz=s.z0-b.z0, hz=s.z1-b.z1;
    const x=lo<=hi?Math.min(hi,Math.max(lo,inst.x)):(lo+hi)/2, z=lz<=hz?Math.min(hz,Math.max(lz,inst.z)):(lz+hz)/2;
    const d=Math.hypot(x-inst.x,z-inst.z); if(!best||d<best.d) best={d,x,z,s}; }
  if(best){ inst.x=best.x; inst.z=best.z; inst.base=best.s.y; inst.surf=best.s.name; }
}

/* ------------------------------------------------------------ checks */
function status(inst){
  const hard=new Set(), soft=new Set(), w=inst.w, A=unionBB(w);
  for(const o of OBST){ if(!bbOver(A,o.bb)) continue;
    for(const q of w){ if(yOver(q,o)&&bbOver(q.bb,o.bb)&&sat(q.poly,o.poly)){ (o.kind==='hard'?hard:soft).add(o.name); break; } } }
  for(const p of placed){ if(p===inst||!p.w||isPair(inst,p)||!bbOver(A,unionBB(p.w))) continue;
    let hit=false; for(const q of w){ for(const r of p.w){ if(yOver(q,r)&&bbOver(q.bb,r.bb)&&sat(q.poly,r.poly)){ hit=true; break; } } if(hit) break; }
    if(hit) soft.add(label(p)); }
  // outside the apartment (a door opening inside a wall counts as inside)
  let out=false; for(const q of w){ for(const [x,z] of q.poly){ if(ctx.roomAt(x,z)==='out'&&!ctx.inWall(x,z)) { out=true; break; } } if(out) break; }
  if(out) hard.add('outside the apartment');
  const ceil=ctx.ceilingAt(inst.x,inst.z), top=baseY(inst)+inst.size.y1;
  if(top>ceil+EPS) hard.add(`the ceiling (${cmTxt(top-ceil)} cm too tall)`);
  return {hard:[...hard], soft:[...soft]};
}
function label(p){ const c=CATI[p.id]; const v=variantName(c,p); const n=c.limit>1&&!v?` ${placed.filter(q=>q.id===p.id).indexOf(p)+1}`:''; return c.name+(v?` (${v})`:n); }

// gaps from the item's outer box to the nearest wall, fixture or furniture in each plan direction
const DIRS=[{k:'N',ax:0,s:-1,arrow:'↑'},{k:'S',ax:0,s:1,arrow:'↓'},{k:'W',ax:1,s:1,arrow:'←'},{k:'E',ax:1,s:-1,arrow:'→'}];
function gaps(inst){
  const A=unionBB(inst.w); const res={};
  const targets=OBST.filter(o=>o.kind==='hard'&&o.y1>A.y0+EPS&&o.y0<A.y1-EPS).map(o=>o.poly);
  for(const o of ctx.openings()) if(o.y1>A.y0+EPS&&o.y0<A.y1-EPS) targets.push(o.poly);          // stop at doorways
  if(CATI[inst.id].small){ const s=SURF.find(s=>s.name===inst.surf); if(s){ const t=0.5;               // edges of the counter it sits on
    targets.push([[s.x0-t,s.z0],[s.x0,s.z0],[s.x0,s.z1],[s.x0-t,s.z1]],[[s.x1,s.z0],[s.x1+t,s.z0],[s.x1+t,s.z1],[s.x1,s.z1]],
                 [[s.x0,s.z0-t],[s.x1,s.z0-t],[s.x1,s.z0],[s.x0,s.z0]],[[s.x0,s.z1],[s.x1,s.z1],[s.x1,s.z1+t],[s.x0,s.z1+t]]); } }
  for(const p of placed) if(p!==inst&&p.w&&!isPair(inst,p)) for(const q of p.w) if(q.y1>A.y0+EPS&&q.y0<A.y1-EPS) targets.push(q.poly);
  for(const d of DIRS){
    const along=d.ax, across=1-d.ax; const lo=across===0?A.x0:A.z0, hi=across===0?A.x1:A.z1; const face=along===0?(d.s>0?A.x1:A.x0):(d.s>0?A.z1:A.z0);
    let best=null;
    for(const P of targets){ const c=clipBand(P,across,lo+EPS,hi-EPS); if(c.length<2) continue;
      let near=Infinity, far=-Infinity, m0=Infinity, m1=-Infinity; for(const pt of c){ const v=pt[along]*d.s; if(v<near) near=v; if(v>far) far=v; m0=Math.min(m0,pt[across]); m1=Math.max(m1,pt[across]); }
      const g=near-face*d.s; if(g<-EPS||far<=face*d.s+EPS) continue; if(!best||g<best.g) best={g:Math.max(0,g), mid:(m0+m1)/2}; }
    if(best&&best.g<600) res[d.k]={...best, face, d};
  }
  return res;
}

/* ------------------------------------------------------------ snapping */
function pxIn(){ const cam=ctx.camera(); if(!cam.isOrthographicCamera) return 1; const w=ctx.dom.clientWidth||1; return (cam.right-cam.left)/cam.zoom/w/IN; }
function snap(inst){
  inst.w=worldBoxes(inst); const A=unionBB(inst.w); const tol=SNAP_PX*pxIn();
  const T=[]; for(const o of OBST) if(o.kind==='hard'&&o.y1>A.y0+EPS&&o.y0<A.y1-EPS) T.push({bb:o.bb,f:false});
  for(const p of placed) if(p!==inst&&p.w&&!isPair(inst,p)){ const U=unionBB(p.w); if(U.y1>A.y0+EPS&&U.y0<A.y1-EPS) T.push({bb:U,f:true}); }
  let bx=null, bz=null; const tryX=v=>{ if(Math.abs(v)<=tol&&(!bx||Math.abs(v)<Math.abs(bx))) bx=v; }, tryZ=v=>{ if(Math.abs(v)<=tol&&(!bz||Math.abs(v)<Math.abs(bz))) bz=v; };
  for(const {bb:t,f} of T){
    const zOv=Math.min(A.z1,t.z1)-Math.max(A.z0,t.z0), xOv=Math.min(A.x1,t.x1)-Math.max(A.x0,t.x0);
    if(zOv>EPS){ tryX(t.x0-A.x1); tryX(t.x1-A.x0); }
    if(xOv>EPS){ tryZ(t.z0-A.z1); tryZ(t.z1-A.z0); }
    if(f){ const zg=Math.max(t.z0-A.z1,A.z0-t.z1), xg=Math.max(t.x0-A.x1,A.x0-t.x1);   // line up with nearby furniture
      if(zg<30){ tryX(t.x0-A.x0); tryX(t.x1-A.x1); } if(xg<30){ tryZ(t.z0-A.z0); tryZ(t.z1-A.z1); } }
  }
  if(bx) inst.x+=bx; if(bz) inst.z+=bz;
}

/* ------------------------------------------------------------ overlay (Plan view only) */
function lineLoop(pts,mat,y=OVY){ const g=new THREE.BufferGeometry().setFromPoints(pts.map(([x,z])=>new THREE.Vector3(x,y,z))); const l=new THREE.LineLoop(g,mat); l.renderOrder=20; return l; }
function fill(pts,mat){ const s=new THREE.Shape(pts.map(([x,z])=>new THREE.Vector2(x,z))); const g=new THREE.ShapeGeometry(s); g.rotateX(Math.PI/2); const m=new THREE.Mesh(g,mat); m.position.y=OVY-1; m.renderOrder=19; return m; }
let ovLabels=[];
function clearOV(){ for(const o of OV.children.slice()){ OV.remove(o); o.geometry&&o.geometry.dispose(); } for(const l of ovLabels) l.element.remove(); ovLabels=[]; }
function drawOV(){
  clearOV(); OV.visible = mode==='plan'; if(mode!=='plan') return;
  for(const s of ctx.swings()){ const pts=s.poly.map(([x,z])=>new THREE.Vector3(x,OVY,z)); pts.push(pts[0].clone());
    const g=new THREE.BufferGeometry().setFromPoints(pts); const l=new THREE.Line(g,mats.swing); l.computeLineDistances(); l.renderOrder=18; OV.add(l); }
  for(const p of placed){ const st=p.st||{hard:[],soft:[]}; const m=p===sel?mats.sel:st.hard.length?mats.hard:st.soft.length?mats.soft:mats.line; const o=outline(p); OV.add(lineLoop(o,m));
    if(p===sel){ OV.add(fill(o,st.hard.length?mats.fillHard:st.soft.length?mats.fillSoft:mats.fillSel)); }
    else if(st.hard.length) OV.add(fill(o,mats.fillHard)); }
  if(sel){ const G=gaps(sel);
    for(const d of DIRS){ const g=G[d.k]; if(!g) continue; const a=d.ax===0?[g.face,g.mid]:[g.mid,g.face]; const b=d.ax===0?[g.face+d.s*g.g,g.mid]:[g.mid,g.face+d.s*g.g];
      if(g.g>0.2){ const geo=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(a[0],OVY,a[1]),new THREE.Vector3(b[0],OVY,b[1])]); const l=new THREE.Line(geo,mats.gap); l.renderOrder=21; OV.add(l);
        for(const e of [a,b]){ const t=d.ax===0?[[e[0],e[1]-2],[e[0],e[1]+2]]:[[e[0]-2,e[1]],[e[0]+2,e[1]]]; const tg=new THREE.BufferGeometry().setFromPoints(t.map(([x,z])=>new THREE.Vector3(x,OVY,z))); const tl=new THREE.Line(tg,mats.gap); tl.renderOrder=21; OV.add(tl); } }
      const el=document.createElement('div'); el.className='glabel'; el.textContent=cmTxt(g.g)+' cm'; const lo=new CSS2DObject(el); lo.position.set((a[0]+b[0])/2,OVY,(a[1]+b[1])/2); OV.add(lo); ovLabels.push(lo); }
  }
}

/* ------------------------------------------------------------ panel UI */
const css=`
#furn .fl-row{display:flex;gap:6px;align-items:center;margin-bottom:6px}
#furn select,#furn input[type=text]{font:12px var(--sans);padding:4px 6px;border:1px solid var(--line);border-radius:4px;background:#fff;color:var(--ink);min-width:0;flex:1}
#furn .fl-grp{font:600 10.5px var(--sans);text-transform:uppercase;letter-spacing:.08em;color:var(--ink-3,#7a848c);margin:10px 0 3px}
#furn .fl-item{display:grid;grid-template-columns:1fr auto;gap:2px 8px;align-items:center;padding:4px 0;border-top:1px solid var(--line)}
#furn .fl-item b{font:500 12.5px var(--sans)}
#furn .fl-item .dim{font:11px var(--mono);color:var(--ink-2);grid-column:1}
#furn .fl-chips{grid-column:1/3;display:flex;flex-wrap:wrap;gap:4px}
#furn .chip2{font:11px var(--sans);border:1px solid var(--line);border-radius:10px;padding:2px 8px;background:#fff;cursor:pointer}
#furn .chip2.on{background:var(--accent);border-color:var(--accent);color:#fff}
#furn .chip2.hard{border-color:#c0261b;color:#c0261b} #furn .chip2.soft{border-color:#c17a12;color:#a8641f}
#furn .chip2.on.hard,#furn .chip2.on.soft{color:#fff}
#furn .btn.sm{padding:3px 8px;font-size:11.5px}
#furn .fl-opt{grid-column:1/3;display:flex;align-items:center;gap:6px;font:12px var(--sans);color:var(--ink-2)}
#fl-card{border:1px solid var(--accent);border-radius:8px;padding:9px 10px;margin:8px 0;background:var(--accent-soft)}
#fl-card h3{margin:0;font:600 13px var(--sans)} #fl-card .dim{font:11px var(--mono);color:var(--ink-2);margin:2px 0 6px}
#fl-card .st{font-size:11.5px;margin:4px 0;padding:4px 6px;border-radius:4px}
#fl-card .st.hard{background:#fbe3df;color:#8f1d14} #fl-card .st.soft{background:var(--warn-soft);color:#7a4a12} #fl-card .st.ok{background:#e4efe9;color:#1f5b4c}
#fl-card .gaps{display:grid;grid-template-columns:1fr 1fr;gap:4px 10px;margin:6px 0}
#fl-card .gaps label{display:flex;align-items:center;justify-content:space-between;gap:4px;font:12px var(--sans)}
#fl-card input[type=number]{width:64px}
#fl-card .row label{font-size:12px}
#fl-paste textarea{width:100%;height:90px;font:11px var(--mono);box-sizing:border-box;border:1px solid var(--line);border-radius:4px;padding:5px}
.glabel{font:600 11px var(--mono);color:#fff;background:#2f6f62;padding:1px 5px;border-radius:3px;white-space:nowrap;pointer-events:none}
`;
const st=document.createElement('style'); st.textContent=css; document.head.appendChild(st);
const box=ctx.panel; box.hidden=false;
box.innerHTML=`<h2>Furniture</h2>
<div class="fl-row"><select id="fl-layout" aria-label="Layout"></select><button class="btn sm" id="fl-new">New</button><button class="btn sm" id="fl-dup">Duplicate</button></div>
<div class="fl-row"><input type="text" id="fl-name" aria-label="Layout name"><button class="btn sm" id="fl-del">Delete</button></div>
<div id="fl-card" hidden></div>
<div id="fl-list"></div>
<div class="btns" style="margin-top:10px"><button class="btn sm" id="fl-copy">Copy layout</button><button class="btn sm" id="fl-paste-b">Paste layout</button><button class="btn sm" id="fl-clear">Remove all</button></div>
<div id="fl-paste" hidden style="margin-top:6px"><textarea placeholder="Paste a copied layout here"></textarea><div class="btns" style="margin-top:4px"><button class="btn sm" id="fl-import">Add as new layout</button><button class="btn sm" id="fl-pcancel">Cancel</button></div></div>
<p class="note">Place and move furniture in <b>Plan</b> view. Drag to move, <kbd>R</kbd> turns 90° (<kbd>Shift</kbd>+<kbd>R</kbd> 15°), arrow keys nudge 1 cm (<kbd>Shift</kbd> 10 cm), <kbd>Del</kbd> removes. Hold <kbd>Alt</kbd> while dragging to stop snapping. Red = hits a wall or fixture, amber = overlaps furniture, a door swing or the hearth.</p>`;
const q=s=>box.querySelector(s);
const dimTxt=s=>`${cmTxt(s.x1-s.x0)} × ${cmTxt(s.z1-s.z0)} × ${cmTxt(s.y1)} cm`;
const sizeCache={};
function catSize(c){ if(!sizeCache[c.id]){ const tmp={id:c.id,opts:{}}; const g=buildModel(tmp); sizeCache[c.id]=measureFor(tmp,g).size; } return sizeCache[c.id]; }

function renderLayouts(){
  q('#fl-layout').innerHTML=store.list.map((L,i)=>`<option value="${i}"${i===store.cur?' selected':''}>${esc(L.name)}</option>`).join('');
  q('#fl-name').value=store.list[store.cur].name;
}
function renderList(){
  const groups={}; for(const c of CAT) (groups[c.room]||(groups[c.room]=[])).push(c);
  let h='';
  for(const room of ROOM_ORDER.concat(Object.keys(groups).filter(r=>!ROOM_ORDER.includes(r)))){ const list=groups[room]; if(!list) continue;
    h+=`<div class="fl-grp">${esc(room)}</div>`;
    for(const c of list){ const mine=placed.filter(p=>p.id===c.id); const left=c.limit-mine.length;
      h+=`<div class="fl-item"><b>${esc(c.name)}${c.many?` <span class="dim">${mine.length?`× ${mine.length}`:''}</span>`:c.qty>1?` <span class="dim">× ${c.qty}</span>`:''}</b>
        <button class="btn sm" data-place="${c.id}" ${left<=0?'disabled':''}>${left<=0?'Placed':c.many?(mine.length?'Place another':'Place'):c.qty>1?`Place (${left} left)`:'Place'}</button>
        <span class="dim">${dimTxt(catSize(c))}</span>
        ${c.id===TABLE&&left>0?`<label class="fl-opt"><input type="checkbox" id="fl-withchairs"${withChairs()?' checked':''}> with the dining chairs around it</label>`:''}
        ${mine.length?`<div class="fl-chips">${mine.map((p,k)=>{ const s=p.st||{hard:[],soft:[]}; const v=variantName(c,p);
          return `<button class="chip2${p===sel?' on':''}${s.hard.length?' hard':s.soft.length?' soft':''}" data-sel="${p.uid}">${esc(v||(c.limit>1?'#'+(k+1):'Placed'))}</button>`; }).join('')}</div>`:''}
      </div>`; }
  }
  q('#fl-list').innerHTML=h;
}
const FACE={N:'north',S:'south',E:'east',W:'west'};
function facing(inst){ const t=inst.rot*DEG; const fx=Math.sin(t), fz=Math.cos(t);   // front = local +z
  const a=Math.atan2(-fz,-fx)/DEG;   // 0 = north(-x), 90 = east(-z)
  const n=((a%360)+360)%360; const names=['north','north-east','east','south-east','south','south-west','west','north-west']; return names[Math.round(n/45)%8]; }
const cw=inst=>{ let v=-inst.rot%360; if(v<0) v+=360; return Math.round(v*100)/100; };
function renderCard(){
  const card=q('#fl-card'); if(!sel){ card.hidden=true; return; } card.hidden=false;
  const c=CATI[sel.id], s=sel.st||{hard:[],soft:[]}, G=gaps(sel), v=variantName(c,sel);
  let h=`<h3>${esc(c.name)}${v?` · ${esc(v)}`:''}</h3><div class="dim">${dimTxt(sel.size)} (W × D × H)${c.small?` · on ${esc(sel.surf||'the counter')}`:''}</div>`;
  if(s.hard.length) h+=`<div class="st hard">Hits ${esc(s.hard.join(', '))}</div>`;
  if(s.soft.length) h+=`<div class="st soft">Overlaps ${esc(s.soft.join(', '))}</div>`;
  if(!s.hard.length&&!s.soft.length) h+=`<div class="st ok">Fits, nothing in the way</div>`;
  h+=`<div class="row"><label>Turn</label><span class="btns"><button class="btn sm" data-rot="90">⟲ 90°</button><button class="btn sm" data-rot="-90">⟳ 90°</button><input type="number" id="fl-rot" step="1" value="${cw(sel)}" aria-label="Rotation, degrees clockwise">°</span></div>
  <div class="dim" style="margin:0 0 4px">Front faces ${facing(sel)}</div>
  <div style="font:500 12px var(--sans);margin-top:6px">Gap to nearest wall or item (cm)</div>
  <div class="gaps">${DIRS.map(d=>`<label>${d.arrow} ${FACE[d.k]}<input type="number" step="0.5" min="0" data-gap="${d.k}" value="${G[d.k]?cmTxt(G[d.k].g):''}" ${G[d.k]?'':'disabled placeholder="—"'}></label>`).join('')}</div>`;
  for(const p of c.params){ const val=sel.opts[p.key]??p.def;
    if(p.type==='range') h+=`<div class="row"><label for="fp-${p.key}">${esc(p.label)}</label><span style="display:flex;gap:6px;align-items:center"><input type="range" id="fp-${p.key}" data-param="${p.key}" min="${p.min}" max="${p.max}" step="${p.step}" value="${val}" style="width:100px"><span class="val" style="font:11px var(--mono);width:52px;text-align:right">${cmTxt(val)} cm</span></span></div>`;
    if(p.type==='select') h+=`<div class="row"><label for="fp-${p.key}">${esc(p.label)}</label><select id="fp-${p.key}" data-param="${p.key}" style="flex:0 1 auto">${p.options.map(([k,l])=>`<option value="${k}"${k===val?' selected':''}>${esc(l)}</option>`).join('')}</select></div>`;
    if(p.type==='check') h+=`<div class="row"><label for="fp-${p.key}">${esc(p.label)}</label><input type="checkbox" id="fp-${p.key}" data-param="${p.key}"${val?' checked':''}></div>`;
  }
  if(sel.id===TABLE){ const n=linked(sel).length, left=CATI[CHAIR].limit-placed.filter(p=>p.id===CHAIR).length;
    if(n) h+=`<div class="row"><span class="dim" style="margin:0">${n} chair${n>1?'s':''} move with the table</span><button class="btn sm" id="fl-detach">Detach chairs</button></div>`;
    if(n<4&&left>0) h+=`<div class="btns" style="margin-top:4px"><button class="btn sm" id="fl-addchairs">Add chairs around it</button></div>`; }
  if(sel.with&&tableOf(sel)) h+=`<div class="row"><span class="dim" style="margin:0">Moves with the table</span><button class="btn sm" id="fl-detach1">Detach</button></div>`;
  h+=`<div class="btns" style="margin-top:8px"><button class="btn sm" id="fl-remove">Remove</button><button class="btn sm" id="fl-done">Done</button></div>`;
  card.innerHTML=h;
}
function refreshUI(){ renderList(); renderCard(); drawOV(); }

/* ------------------------------------------------------------ actions */
function evalAll(){ for(const p of placed) p.st=status(p); }
function changed(inst, opt={}){ place(inst); if(inst.with) relink(inst); evalAll(); refreshUI(); if(!opt.nosave) save(); ctx.changed&&ctx.changed(); }
function select(inst){ sel=inst; refreshUI(); }
function addItem(id){
  const c=CATI[id]; const mine=placed.filter(p=>p.id===id); if(mine.length>=c.limit) return;
  const opts={}; const vp=c.params.find(p=>p.type==='select');
  if(vp){ const used=new Set(mine.map(p=>p.opts[vp.key]??vp.def)); const free=vp.options.find(o=>!used.has(o[0])); if(free) opts[vp.key]=free[0]; }
  if(ctx.mode()!=='plan') ctx.setMode('plan');
  const t=ctx.viewCenter(); let x=t.x, z=t.z; if(ctx.roomAt(x,z)==='out'){ const L=ctx.rooms().living; x=(L.x0+L.x1)/2; z=(L.z0+L.z1)/2; }
  const inst=makeInst({id,opts,x,z,rot:0}); placed.push(inst); rebuild(inst);
  if(id===TABLE&&withChairs()) addChairs(inst);
  findFree(inst,x,z); sel=inst; changed(inst); scrollCard();
}
const TABLE='dining-table-round', CHAIR='dining-chairs';
const withChairs=()=>{ try{ return localStorage.getItem('condo5ne.tableChairs')!=='0'; }catch(_){ return true; } };
// up to 4 chairs on the diagonals, seats tucked under the edge, all facing the table (same as the review page's set)
function addChairs(t){
  if(!t.gid) t.gid='t'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
  const free=CATI[CHAIR].limit-placed.filter(p=>p.id===CHAIR).length; const taken=linked(t).length;
  for(let k=0;k<4&&k<taken+free;k++){ if(k<taken) continue; const a=Math.PI/4+k*Math.PI/2;
    const c=makeInst({id:CHAIR,x:t.x,z:t.z}); c.with=t.gid; c.lx=Math.sin(a)*24; c.lz=Math.cos(a)*24; c.lrot=(a+Math.PI)/DEG; placed.push(c); rebuild(c); }
  place(t);
}
// nearest free spot to the view centre (or, for kitchen things, the nearest free spot on a counter)
function findFree(inst,x0,z0){
  const set=[inst,...linked(inst)];
  const free=()=>{ place(inst); return set.every(m=>{ const s=status(m); return !s.hard.length&&!s.soft.length; }); };
  if(CATI[inst.id].small){
    const pts=[]; for(const s of SURF) for(let x=s.x0;x<=s.x1;x+=1.5) for(let z=s.z0;z<=s.z1;z+=1.5) pts.push([x,z]);
    const sx=inst.x, sz=inst.z; pts.sort((a,b)=>Math.hypot(a[0]-sx,a[1]-sz)-Math.hypot(b[0]-sx,b[1]-sz));
    for(const [x,z] of pts){ inst.x=x; inst.z=z; if(free()) return true; }
    inst.x=sx; inst.z=sz; place(inst); return false;
  }
  for(const rot of [0,90]){ inst.rot=rot; inst.x=x0; inst.z=z0; place(inst);
    const A=unionBB(set.flatMap(m=>m.w)), ox0=A.x0-x0, ox1=A.x1-x0, oz0=A.z0-z0, oz1=A.z1-z0;
    const block=OBST.filter(o=>o.y1>A.y0+EPS&&o.y0<A.y1-EPS).map(o=>o.bb);
    for(const p of placed) if(!set.includes(p)&&p.w) block.push(unionBB(p.w));
    const quick=(x,z)=>{ const b={x0:x+ox0,x1:x+ox1,z0:z+oz0,z1:z+oz1};
      for(const [cx,cz] of [[b.x0,b.z0],[b.x1,b.z0],[b.x1,b.z1],[b.x0,b.z1],[x,z]]) if(ctx.roomAt(cx,cz)==='out') return false;
      for(const t of block) if(bbOver(b,t)) return false; return true; };
    for(let r=0;r<=300;r+=3){ const n=r?Math.ceil(2*Math.PI*r/3):1;
      for(let k=0;k<n;k++){ const a=k/n*2*Math.PI, x=x0+r*Math.cos(a), z=z0+r*Math.sin(a); if(!quick(x,z)) continue; inst.x=x; inst.z=z; if(free()) return true; } } }
  inst.rot=0; inst.x=x0; inst.z=z0; place(inst); return false;
}
function scrollCard(){ const c=q('#fl-card'); if(c&&!c.hidden) try{ c.scrollIntoView({block:'nearest',behavior:'smooth'}); }catch(_){} }
function removeItem(inst){ for(const c of linked(inst)) delete c.with; placed=placed.filter(p=>p!==inst); if(inst.g){ FG.remove(inst.g); } if(sel===inst) sel=null; evalAll(); refreshUI(); save(); }
function loadLayout(i,nosave){
  if(!nosave) save(true); for(const p of placed) if(p.g) FG.remove(p.g); placed=[]; sel=null; store.cur=i;
  for(const d of store.list[i].items||[]){ if(!CATI[d.id]) continue; const inst=makeInst(d); placed.push(inst); rebuild(inst); }
  evalAll(); renderLayouts(); refreshUI(); save(true);
}
const uniq=n=>{ let s=n, k=2; while(store.list.some(L=>L.name===s)) s=`${n} (${k++})`; return s; };

box.addEventListener('click',e=>{
  const t=e.target.closest('button'); if(!t) return;
  if(t.dataset.place) addItem(t.dataset.place);
  else if(t.dataset.sel){ const p=placed.find(p=>p.uid===+t.dataset.sel); if(ctx.mode()!=='plan') ctx.setMode('plan'); select(sel===p?null:p); }
  else if(t.dataset.rot&&sel){ sel.rot=((sel.rot+(+t.dataset.rot))%360+360)%360; changed(sel); }
  else if(t.id==='fl-remove'&&sel) removeItem(sel);
  else if(t.id==='fl-detach'&&sel){ for(const c of linked(sel)) delete c.with; refreshUI(); save(); }
  else if(t.id==='fl-detach1'&&sel){ delete sel.with; refreshUI(); save(); }
  else if(t.id==='fl-addchairs'&&sel){ addChairs(sel); changed(sel); }
  else if(t.id==='fl-done') select(null);
  else if(t.id==='fl-new'){ save(true); store.list.push({name:uniq('Layout '+(store.list.length+1)), items:[]}); loadLayout(store.list.length-1); }
  else if(t.id==='fl-dup'){ save(true); const L=store.list[store.cur]; store.list.push({name:uniq(L.name+' copy'), items:JSON.parse(JSON.stringify(L.items))}); loadLayout(store.list.length-1); }
  else if(t.id==='fl-del'){ if(t.dataset.arm!=='1'){ t.dataset.arm='1'; t.textContent='Sure?'; setTimeout(()=>{ t.dataset.arm=''; t.textContent='Delete'; },2500); return; }
    store.list.splice(store.cur,1); if(!store.list.length) store.list.push({name:'Layout 1',items:[]}); placed.forEach(p=>p.g&&FG.remove(p.g)); placed=[]; loadLayout(Math.min(store.cur,store.list.length-1),true); }
  else if(t.id==='fl-clear'){ if(!placed.length) return; if(t.dataset.arm!=='1'){ t.dataset.arm='1'; t.textContent='Remove all?'; setTimeout(()=>{ t.dataset.arm=''; t.textContent='Remove all'; },2500); return; }
    t.dataset.arm=''; t.textContent='Remove all'; for(const p of placed) p.g&&FG.remove(p.g); placed=[]; sel=null; evalAll(); refreshUI(); save(); }
  else if(t.id==='fl-copy'){ save(true); const L=store.list[store.cur]; const txt='{"name":'+JSON.stringify(L.name)+',"items":[\n'+L.items.map(i=>'  '+JSON.stringify(i)).join(',\n')+'\n]}';
    const done=ok=>{ t.textContent=ok?'Copied':'Select and copy below'; setTimeout(()=>t.textContent='Copy layout',1600); if(!ok){ q('#fl-paste').hidden=false; q('#fl-paste textarea').value=txt; q('#fl-paste textarea').select(); } };
    if(navigator.clipboard&&navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(()=>done(true),()=>done(false)); else done(false); }
  else if(t.id==='fl-paste-b'){ q('#fl-paste').hidden=false; q('#fl-paste textarea').value=''; q('#fl-paste textarea').focus(); }
  else if(t.id==='fl-pcancel') q('#fl-paste').hidden=true;
  else if(t.id==='fl-import'){ try{ let d=JSON.parse(q('#fl-paste textarea').value); if(Array.isArray(d)) d={name:'Pasted layout',items:d};
      if(!Array.isArray(d.items)) throw 0; save(true); store.list.push({name:uniq(d.name||'Pasted layout'), items:d.items.filter(i=>i&&CATI[i.id])}); q('#fl-paste').hidden=true; loadLayout(store.list.length-1);
    }catch(_){ t.textContent='Not a layout'; setTimeout(()=>t.textContent='Add as new layout',1600); } }
});
box.addEventListener('change',e=>{
  const t=e.target;
  if(t.id==='fl-withchairs'){ try{ localStorage.setItem('condo5ne.tableChairs',t.checked?'1':'0'); }catch(_){} return; }
  if(t.id==='fl-layout') loadLayout(+t.value);
  else if(t.id==='fl-name'){ const v=t.value.trim(); if(v&&!store.list.some((L,i)=>L.name===v&&i!==store.cur)){ store.list[store.cur].name=v; save(true); } renderLayouts(); }
  else if(t.id==='fl-rot'&&sel){ const v=parseFloat(t.value); if(isFinite(v)){ sel.rot=((-v)%360+360)%360; changed(sel); } }
  else if(t.dataset.gap&&sel){ const v=parseFloat(t.value)/2.54; const G=gaps(sel)[t.dataset.gap]; if(!isFinite(v)||!G||v<0) return renderCard();
    const d=G.d, delta=(G.g-v)*d.s; if(d.ax===0) sel.x+=delta; else sel.z+=delta; changed(sel); }
  else if(t.dataset.param&&sel){ const p=CATI[sel.id].params.find(p=>p.key===t.dataset.param); sel.opts[p.key]=p.type==='check'?t.checked:p.type==='range'?parseFloat(t.value):t.value; rebuild(sel); changed(sel); }
});
box.addEventListener('input',e=>{ const t=e.target; if(t.type==='range'&&t.dataset.param){ const s=t.parentElement.querySelector('.val'); if(s) s.textContent=cmTxt(parseFloat(t.value))+' cm'; } });

/* ------------------------------------------------------------ pointer (Plan view) */
const ray=new THREE.Raycaster();
function planPoint(e){ const r=ctx.dom.getBoundingClientRect(); const v=new THREE.Vector2(((e.clientX-r.left)/r.width)*2-1,-((e.clientY-r.top)/r.height)*2+1);
  ray.setFromCamera(v,ctx.camera()); const o=ray.ray.origin, d=ray.ray.direction; if(Math.abs(d.y)<1e-6) return null; const t=-o.y/d.y; return {x:(o.x+d.x*t)/IN, z:(o.z+d.z*t)/IN}; }
function hitAt(x,z){
  let best=null, top=-Infinity;
  for(const p of placed){ for(const q of p.w){ if(x<q.bb.x0||x>q.bb.x1||z<q.bb.z0||z>q.bb.z1) continue; if(inPoly(q.poly,x,z)&&q.y1>top){ top=q.y1; best=p; } } }
  if(best) return best;
  let area=Infinity; for(const p of placed){ const o=outline(p); if(inPoly(o,x,z)){ const s=p.size, a=(s.x1-s.x0)*(s.z1-s.z0); if(a<area){ area=a; best=p; } } }
  return best;
}
let drag=null;
ctx.stage.addEventListener('pointerdown',e=>{
  if(mode!=='plan'||ctx.measuring()||e.target!==ctx.dom||drag) return; if(e.button!==undefined&&e.button!==0) return;
  const p=planPoint(e); if(!p) return; const hit=hitAt(p.x,p.z);
  if(!hit){ drag={id:e.pointerId,none:true,x:e.clientX,y:e.clientY}; return; }
  ctx.pan.enabled=false; drag={id:e.pointerId,inst:hit,ox:hit.x-p.x,oz:hit.z-p.z,x:e.clientX,y:e.clientY,moved:false};
  try{ ctx.dom.setPointerCapture(e.pointerId); }catch(_){}
  if(sel!==hit){ select(hit); scrollCard(); }
},true);
addEventListener('pointermove',e=>{
  if(!drag||drag.none||e.pointerId!==drag.id) return;
  if(!drag.moved&&Math.hypot(e.clientX-drag.x,e.clientY-drag.y)<3) return; drag.moved=true;
  const p=planPoint(e); if(!p) return; const i=drag.inst; i.x=p.x+drag.ox; i.z=p.z+drag.oz; place(i); if(!e.altKey) snap(i);
  place(i); if(i.with) relink(i); evalAll(); drawOV(); renderCard(); ctx.changed&&ctx.changed();
});
const endDrag=e=>{ if(!drag||e.pointerId!==drag.id) return;
  if(drag.none){ if(Math.hypot(e.clientX-drag.x,e.clientY-drag.y)<4&&sel) select(null); }
  else { ctx.pan.enabled=mode==='plan'; if(drag.moved){ renderList(); save(); } }
  drag=null; };
addEventListener('pointerup',endDrag); addEventListener('pointercancel',endDrag);

function onKey(e){
  if(mode!=='plan'||!sel) return false; if(e.target&&/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return false;
  const step=(e.shiftKey?10:1)/2.54;
  const mv={ArrowUp:[-step,0],ArrowDown:[step,0],ArrowLeft:[0,step],ArrowRight:[0,-step]}[e.code];
  if(mv){ sel.x+=mv[0]; sel.z+=mv[1]; changed(sel); return true; }
  if(e.code==='KeyR'){ sel.rot=((sel.rot+(e.shiftKey?-15:-90))%360+360)%360; changed(sel); return true; }
  if(e.code==='Delete'||e.code==='Backspace'){ removeItem(sel); return true; }
  if(e.code==='Escape'){ select(null); return true; }
  return false;
}

/* ------------------------------------------------------------ public API */
function onBuild(){   // the apartment was (re)built: refresh obstacles, counter heights, checks
  loadObstacles();
  for(const p of placed) place(p); evalAll(); refreshUI();
}
const SWING_NAMES={'front entry door swing':'the front door swing','bedroom door swing':'the bedroom door swing','bath door swing':'the bathroom door swing',
  'WIC door swing':'the closet door swing','laundry bifolds swing':'the laundry doors','French door swing':'the French doors\u2019 swing'};
function loadObstacles(){
  OBST=ctx.obstacles().map(o=>({...o, bb:bbOf(o.poly)}));
  for(const s of ctx.swings()) OBST.push({name:SWING_NAMES[s.name]||('the '+s.name), poly:s.poly, y0:0, y1:80, kind:'soft', bb:bbOf(s.poly)});
  SURF=ctx.surfaces();
}
function setMode(m){ mode=m; if(m!=='plan'&&drag&&!drag.none){ drag=null; } drawOV(); }
function blocks(x,z,r){ for(const p of placed){ if(CATI[p.id].small||!p.w) continue; for(const q of p.w){ if(q.y0>60) continue;
  if(x<q.bb.x0-r||x>q.bb.x1+r||z<q.bb.z0-r||z>q.bb.z1+r) continue; if(distPoly(q.poly,x,z)<r) return true; } } return false; }
function hitClient(e){ if(mode!=='plan') return null; const p=planPoint(e); return p?hitAt(p.x,p.z):null; }

renderLayouts();
for(const d of store.list[store.cur].items||[]){ if(!CATI[d.id]) continue; const inst=makeInst(d); placed.push(inst); }
loadObstacles();
for(const p of placed) rebuild(p);
evalAll(); refreshUI();

return { group:FG, onBuild, setMode, onKey, blocks, hitClient,
  get placed(){ return placed; }, get selected(){ return sel; }, select:i=>select(i), add:addItem, gaps, status, KIT, CATI,
  screenOf:(x,z)=>{ const v=new THREE.Vector3(x*IN,0,z*IN).project(ctx.camera()); const r=ctx.dom.getBoundingClientRect(); return [r.left+(v.x+1)/2*r.width, r.top+(1-v.y)/2*r.height]; },
  measureRaw:(id,opts)=>{ const g=KIT.build(id,opts||{}); const m=measure(g); return {size:m.size, n:m.boxes.length}; } };
};
