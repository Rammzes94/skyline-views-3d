/* Furniture 3D models for the condo.
   Units: inches, same as model/plan.json (viewers scale by 0.0254 to get metres).
   Every builder returns a THREE.Group with its origin on the floor at the centre of the footprint.
   Front faces +Z, width runs along X.
   Classic script (not an ES module) so it also works when opened from file://.
   Usage:  const KIT = FurnitureKit(THREE);  KIT.build('sofa-green-sectional')  */
window.FurnitureKit = function(THREE){
'use strict';
const TAU = Math.PI*2;
const V3 = (x,y,z)=>new THREE.Vector3(x,y,z);
function rng(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;}}

/* ------------------------------------------------------------ textures */
function canvasTex(size, draw, color=true){
  const c=document.createElement('canvas'); c.width=c.height=size; draw(c.getContext('2d'),size);
  const t=new THREE.CanvasTexture(c); t.wrapS=t.wrapT=THREE.RepeatWrapping; if(color) t.colorSpace=THREE.SRGBColorSpace; t.anisotropy=8; return t;
}
function woodTex(base, dark, seed=3, n=70){
  return canvasTex(512,(g,S)=>{ const R=rng(seed); g.fillStyle=base; g.fillRect(0,0,S,S);
    for(let i=0;i<n;i++){ const y=R()*S, a=1+R()*4, f=1+R()*2.5, ph=R()*6; g.strokeStyle=dark; g.globalAlpha=.05+R()*.18; g.lineWidth=.6+R()*2.6; g.beginPath();
      for(let x=0;x<=S;x+=12){ const yy=y+a*Math.sin(x/S*TAU*f+ph); x?g.lineTo(x,yy):g.moveTo(x,yy);} g.stroke(); }
    g.globalAlpha=1; });
}
function noiseTex(base, spots, seed=5, n=5000, s=1.6){
  return canvasTex(256,(g,S)=>{ const R=rng(seed); g.fillStyle=base; g.fillRect(0,0,S,S);
    for(let i=0;i<n;i++){ g.globalAlpha=.06+R()*.16; g.fillStyle=spots[(R()*spots.length)|0]; g.fillRect(R()*S,R()*S,.6+R()*s,.6+R()*s); } g.globalAlpha=1; });
}
function boxSpringTex(){
  return canvasTex(256,(g,S)=>{ g.fillStyle='#93a8c2'; g.fillRect(0,0,S,S); const R=rng(9);
    for(let y=0;y<S;y+=32) for(let x=0;x<S;x+=32){ const ox=(y/32)%2?16:0; g.fillStyle='#5d7594'; g.globalAlpha=.75;
      g.beginPath(); g.ellipse(x+ox,y,7,4,0,0,TAU); g.fill(); g.beginPath(); g.ellipse(x+ox,y,3,7,0,0,TAU); g.fill(); }
    g.globalAlpha=.25; for(let i=0;i<1500;i++){ g.fillStyle=R()<.5?'#fff':'#384b66'; g.fillRect(R()*S,R()*S,1,1);} g.globalAlpha=1; });
}
function ribBump(n=40, diag=0){
  const t=canvasTex(256,(g,S)=>{ g.fillStyle='#808080'; g.fillRect(0,0,S,S); g.save(); g.translate(S/2,S/2); g.rotate(diag); g.translate(-S,-S);
    for(let i=0;i<n*2;i++){ const x=i*S/n; const gr=g.createLinearGradient(x,0,x+S/n,0); gr.addColorStop(0,'#555'); gr.addColorStop(.5,'#ddd'); gr.addColorStop(1,'#555'); g.fillStyle=gr; g.fillRect(x,0,S/n,S*2);} g.restore(); }, false);
  return t;
}
function weaveTex(base, line){
  return canvasTex(128,(g,S)=>{ g.fillStyle=base; g.fillRect(0,0,S,S); g.strokeStyle=line; g.lineWidth=2;
    for(let y=4;y<S;y+=8){ g.beginPath(); g.moveTo(0,y); g.lineTo(S,y); g.stroke(); }
    for(let x=0;x<S;x+=16) for(let y=0;y<S;y+=16){ g.fillStyle=line; g.globalAlpha=.4; g.fillRect(x+((y/16)%2?8:0),y,3,8);} g.globalAlpha=1; });
}

/* ------------------------------------------------------------ materials (cached) */
const std = p => new THREE.MeshStandardMaterial(p);
const MDEF = {
  velvet:     ()=>new THREE.MeshPhysicalMaterial({color:0x123a32,roughness:.9,sheen:1,sheenRoughness:.35,sheenColor:0x3f7f70}),
  velvetBtn:  ()=>std({color:0x0f2b25,roughness:.6}),
  legWood:    ()=>std({color:0x3a2314,roughness:.45}),
  brass:      ()=>std({color:0xe2bb6a,metalness:1,roughness:.18}),
  gold:       ()=>std({color:0xd6ae62,metalness:1,roughness:.28}),
  roseGold:   ()=>std({color:0xe8ae92,metalness:1,roughness:.3}),
  chrome:     ()=>std({color:0xeceef0,metalness:1,roughness:.1}),
  steel:      ()=>std({color:0xa7adb2,metalness:.9,roughness:.28}),
  black:      ()=>std({color:0x1c1d1f,roughness:.5}),
  blackMatte: ()=>std({color:0x262729,roughness:.8}),
  rubber:     ()=>std({color:0x141414,roughness:.95}),
  deskTop:    ()=>std({color:0x1f2022,roughness:.55}),
  meshBlue:   ()=>std({color:0x22396b,roughness:.95,map:noiseTex('#2c4579',['#101c38','#4a66a3'],4,7000,1)}),
  blueAccent: ()=>std({color:0x2f6fd0,roughness:.4}),
  red:        ()=>std({color:0xc8262c,roughness:.4}),
  whitePaint: ()=>std({color:0xf3f1eb,roughness:.5}),
  whiteMetal: ()=>std({color:0xf5f5f3,roughness:.35,metalness:.15}),
  whiteBoard: ()=>std({map:woodTex('#f4f2ec','#dcd6ca',21,30),roughness:.45}),
  fabricWhite:()=>std({map:noiseTex('#ebe6dc',['#cfc8ba','#fffdf8'],6),roughness:1}),
  oak:        ()=>std({map:woodTex('#a5672f','#5a3211',5,90),roughness:.42}),
  walnut:     ()=>std({map:woodTex('#4b2c1c','#22110a',8),roughness:.5}),
  cherry:     ()=>std({map:woodTex('#4e2a1b','#28120a',11),roughness:.5}),
  cherryBack: ()=>std({color:0x3a1f14,roughness:.8}),
  blackWood:  ()=>std({map:woodTex('#1e1e20','#0b0b0c',13),roughness:.55}),
  bamboo:     ()=>std({map:woodTex('#dcb878','#a77d40',17,40),roughness:.55}),
  pink:       ()=>std({color:0xe8a7ad,roughness:.3}),
  pinkGloss:  ()=>std({color:0xf2a9b8,roughness:.18}),
  pinkRibbed: ()=>std({color:0xeba9ae,roughness:.65,bumpMap:ribBump(48,-0.5),bumpScale:4}),
  pinkFridge: ()=>std({color:0xf0b3b5,roughness:.35}),
  cream:      ()=>std({color:0xf3ead2,roughness:.35}),
  potWhite:   ()=>std({color:0xeee8db,roughness:.32}),
  soil:       ()=>std({color:0x3b2b1f,roughness:1}),
  leaf:       ()=>std({color:0xffffff,vertexColors:true,roughness:.75,side:THREE.DoubleSide}),
  stem:       ()=>std({color:0x6f7d3c,roughness:.8}),
  mirror:     ()=>std({color:0xe4eaec,metalness:1,roughness:.04}),
  bulb:       ()=>std({color:0xfff3dc,emissive:0xffc977,emissiveIntensity:1.5,roughness:.3}),
  sheet:      ()=>std({color:0x5f6f4d,roughness:.95,map:noiseTex('#6a7a57',['#4f5e3e','#7d8c69'],12)}),
  boxSpring:  ()=>std({map:boxSpringTex(),roughness:.9}),
  straw:      ()=>std({map:noiseTex('#dcc79c',['#b89e6a','#efe0bb'],14,6000,2.5),roughness:.9}),
  paper:      ()=>std({color:0xf2efe6,roughness:.9}),
  plastic:    ()=>std({color:0xe9e9e6,roughness:.45}),
  clear:      ()=>new THREE.MeshPhysicalMaterial({color:0xffffff,roughness:.1,transmission:.6,transparent:true,opacity:.45,thickness:.2}),
  glassBottle:()=>std({color:0x3a2a12,roughness:.15,metalness:.1}),
  basketGreen:()=>std({map:weaveTex('#a9cbb8','#7fa691'),roughness:.8}),
  canvas:     ()=>std({map:noiseTex('#ece5d4',['#d4cab4'],15),roughness:1}),
  leather:    ()=>std({color:0x4a2618,roughness:.55}),
};
const MC = {};
function M(k){ return MC[k] || (MC[k]=MDEF[k]()); }
const colorMats = {};
function C(hex, rough=.7, metal=0){ const k=hex+'|'+rough+'|'+metal; return colorMats[k] || (colorMats[k]=std({color:hex,roughness:rough,metalness:metal})); }

/* ------------------------------------------------------------ geometry helpers (inches) */
const GC = {};
// Rounded box: like three's RoundedBoxGeometry, edges bevelled with radius r.
function rboxGeo(w,h,d,r,seg=3){
  r=Math.max(0.01,Math.min(r,w/2-0.01,h/2-0.01,d/2-0.01));
  const key=[w,h,d,r,seg].map(v=>+v.toFixed?.(3)||v).join('|'); if(GC[key]) return GC[key];
  const n=2*seg+1, g=new THREE.BoxGeometry(1,1,1,n,n,n), p=g.attributes.position, nm=g.attributes.normal;
  const hx=w/2, hy=h/2, hz=d/2, o=new THREE.Vector3();
  const map=(t,H)=>{ const i=Math.round((t+0.5)*n); return i<=seg ? -H + r*(i/seg) : H - r*((n-i)/seg); };
  const cl=(v,H)=>Math.max(-H+r,Math.min(H-r,v));
  for(let i=0;i<p.count;i++){
    const X=map(p.getX(i),hx), Y=map(p.getY(i),hy), Z=map(p.getZ(i),hz);
    const ix=cl(X,hx), iy=cl(Y,hy), iz=cl(Z,hz); o.set(X-ix,Y-iy,Z-iz); const L=o.length();
    if(L>1e-6){ o.multiplyScalar(1/L); p.setXYZ(i,ix+o.x*r,iy+o.y*r,iz+o.z*r); nm.setXYZ(i,o.x,o.y,o.z); } else p.setXYZ(i,X,Y,Z);
  }
  g.computeBoundingBox(); g.computeBoundingSphere(); g.userData.cached=true; GC[key]=g; return g;
}
function mesh(parent, geo, mat, x=0,y=0,z=0){ const m=new THREE.Mesh(geo,mat); m.position.set(x,y,z); m.castShadow=true; m.receiveShadow=true; parent.add(m); return m; }
// box by extents
function bx(parent, x0,x1,y0,y1,z0,z1, mat, r=0, seg=3){
  const w=x1-x0,h=y1-y0,d=z1-z0; if(w<=0||h<=0||d<=0) return null;
  const g = r>0 ? rboxGeo(w,h,d,r,seg) : new THREE.BoxGeometry(w,h,d);
  return mesh(parent,g,mat,(x0+x1)/2,(y0+y1)/2,(z0+z1)/2);
}
// rounded box by centre
function rb(parent, w,h,d,r, mat, x,y,z, seg=3){ return mesh(parent, rboxGeo(w,h,d,r,seg), mat, x,y,z); }
function cyl(parent, rt, rbt, h, mat, x,y0,z, seg=20){ return mesh(parent,new THREE.CylinderGeometry(rt,rbt,h,seg),mat,x,y0+h/2,z); }
function sph(parent, r, mat, x,y,z, sx=1,sy=1,sz=1, seg=16){ const m=mesh(parent,new THREE.SphereGeometry(r,seg,Math.max(8,seg*0.6|0)),mat,x,y,z); m.scale.set(sx,sy,sz); return m; }
function strut(parent, a, b, r, mat, r2=r, seg=14){
  const A=V3(...a), B=V3(...b), d=B.clone().sub(A), L=d.length();
  const m=mesh(parent,new THREE.CylinderGeometry(r2,r,L,seg),mat); m.position.copy(A).addScaledVector(d,0.5);
  m.quaternion.setFromUnitVectors(V3(0,1,0), d.normalize()); return m;
}
function tube(parent, pts, r, mat, seg=48, rs=10, closed=false){
  const c=new THREE.CatmullRomCurve3(pts.map(p=>V3(...p)),closed,'centripetal');
  return mesh(parent,new THREE.TubeGeometry(c,seg,r,rs,closed),mat);
}
const LN=(a,b)=>new THREE.LineCurve3(V3(...a),V3(...b));
const QB=(a,c,b)=>new THREE.QuadraticBezierCurve3(V3(...a),V3(...c),V3(...b));
function pathTube(parent, curves, r, mat, seg=200){ const cp=new THREE.CurvePath(); curves.forEach(c=>cp.add(c)); return mesh(parent,new THREE.TubeGeometry(cp,seg,r,10,false),mat); }
function lathe(parent, prof, mat, x=0,y=0,z=0, seg=40){ return mesh(parent,new THREE.LatheGeometry(prof.map(([r,h])=>new THREE.Vector2(Math.max(0,r),h)),seg),mat,x,y,z); }
// a 2D profile (u = z, v = y) extruded along X, centred on x
function side(parent, shape, thick, mat, x=0, bevel=0){
  const g=new THREE.ExtrudeGeometry(shape,{depth:thick,bevelEnabled:bevel>0,bevelSize:bevel,bevelThickness:bevel,bevelSegments:2,curveSegments:18});
  g.rotateY(-Math.PI/2); g.translate(x+thick/2,0,0); return mesh(parent,g,mat);
}
// a plan shape (x, -z) extruded upward from y0
function slab(parent, shape, h, mat, y0=0, bevel=0){
  const g=new THREE.ExtrudeGeometry(shape,{depth:h,bevelEnabled:bevel>0,bevelSize:bevel,bevelThickness:bevel,bevelSegments:3,curveSegments:24});
  g.rotateX(-Math.PI/2); g.translate(0,y0,0); return mesh(parent,g,mat);
}
// knob on a front face at z (pointing +z)
function knob(parent,x,y,z,mat,r=0.5){
  const s=mesh(parent,new THREE.CylinderGeometry(r*0.35,r*0.45,r*0.9,12),mat,x,y,z+r*0.45); s.rotation.x=Math.PI/2;
  sph(parent,r,mat,x,y,z+r*1.25,1,1,0.75);
}
function bar(parent,x,y,z,len,vertical,mat,t=0.55){ // pull handle
  return vertical ? rb(parent,t,len,t,t*0.45,mat,x,y,z+t*0.9) : rb(parent,len,t,t,t*0.45,mat,x,y,z+t*0.9);
}
function group(parent,x=0,y=0,z=0,ry=0){ const g=new THREE.Group(); g.position.set(x,y,z); g.rotation.y=ry; if(parent) parent.add(g); return g; }
function ring(parent, R, r, mat, x,y,z, axis='y'){ const m=mesh(parent,new THREE.TorusGeometry(R,r,8,40),mat,x,y,z); if(axis==='y') m.rotation.x=Math.PI/2; else if(axis==='x') m.rotation.y=Math.PI/2; return m; }

/* ============================================================ LIVING */
function sofa(){
  const G=new THREE.Group(), vel=M('velvet'), btn=M('velvetBtn');
  const L=105, D=60, Dm=37, Wc=37, arm=5, legH=4.5, baseTop=13.5, seatTop=19, armTop=24.5, backT=6.5;
  const x0=-L/2, x1=L/2, zb=-D/2, zf=zb+Dm, zc=D/2, xc=x1-Wc;
  bx(G, x0+arm-1, x1-arm+1, legH, baseTop, zb+1, zf, vel, 1);           // platform, main
  bx(G, xc, x1-arm+1, legH, baseTop, zf-3, zc, vel, 1);                 // platform, chaise
  bx(G, x0+0.5, x1-0.5, legH, 27, zb, zb+backT, vel, 1.6);              // back frame
  bx(G, x0, x0+arm, legH, armTop, zb, zf, vel, 1.6);                    // left track arm
  bx(G, x1-arm, x1, legH, armTop, zb, zc, vel, 1.6);                    // right arm along the chaise
  bx(G, x0+arm, xc+0.3, baseTop, seatTop, zb+backT, zf+0.6, vel, 2.2, 4); // long seat cushion
  bx(G, xc, x1-arm, baseTop, seatTop, zb+backT, zc+0.4, vel, 2.2, 4);     // chaise cushion
  // tufted chaise top (staggered buttons)
  const cw=x1-arm-xc, cd=zc-(zb+backT);
  for(let r=0;r<7;r++) for(let c=0;c<(r%2?3:4);c++){
    const x=xc + (r%2 ? (c+1)*cw/4 : (c+0.5)*cw/4), z=zb+backT+(r+0.6)*cd/7.4;
sph(G,0.42,btn,x,seatTop-0.12,z,1,0.5,1,10);
  }
  // three tufted back cushions leaning back
  const bw=(x1-arm-(x0+arm))/3;
  for(let i=0;i<3;i++){
    const g=group(G, x0+arm+bw*(i+0.5), seatTop-0.6, zb+backT+3.1); g.rotation.x=-0.17;
    rb(g, bw-0.6, 14.6, 6.4, 2.6, vel, 0, 7.3, 0, 4);
    for(const y of [4.5,10]) for(const fx of [-1,0,1]) sph(g,0.42,btn,fx*bw*0.28,y,3.12,1,1,0.5,10);
  }
  // tapered dark wood legs
  const legs=[[x0+2.5,zb+2.5],[x0+2.5,zf-2.5],[x1-2.5,zb+2.5],[x1-2.5,zc-2.5],[xc+2.5,zc-2.5],[-6,zf-2.5],[-6,zb+2.5]];
  for(const [x,z] of legs) cyl(G,0.95,0.6,legH,M('legWood'),x,0,z,14);
  return G;
}

// 3-seat sleeper sofa (IKEA-style drawing), same green velvet. All sizes from the maker's sheet (inches).
function sofaSleeper(o={}){
  const G=new THREE.Group(), vel=M('velvet');
  const W=92.875, D=42.875, arm=(92.875-78.375)/2, legH=1.2;          // seat width 78 3/8 between the arms
  const seatTop=18.125, armTop=23.25, backTop=29.5, cushTop=33.875, seatD=25.25;
  const bedTop=16.875, bedL=78.75, bedD=55.875, totalD=57.5;
  const x0=-W/2, x1=W/2, zb=-D/2, zf=D/2, xi0=x0+arm, xi1=x1-arm, rear=totalD-bedD;   // rear = 1 5/8 back panel
  const bed=o.mode==='bed';
  for(const s of[-1,1]) bx(G, s<0?x0:xi1, s<0?xi0:x1, legH, armTop, zb, zf, vel, 1.6, 4);   // square arms
  bx(G, xi0-0.2, xi1+0.2, legH, bedTop+0.3, zb, zb+rear, vel, 0.6);                        // back panel, low part
  bx(G, xi0-0.2, xi1+0.2, bedTop+0.3, backTop, zb, zb+6, vel, 1.6, 4);                     // backrest frame
  if(!bed){
    bx(G, xi0, xi1, legH, 12.4, zb+rear, zf, vel, 1);                                       // base (bed folded inside)
    const sw=(xi1-xi0)/3;
    for(let i=0;i<3;i++){
      bx(G, xi0+i*sw+0.15, xi0+(i+1)*sw-0.15, 12.4, seatTop, zb+6, zf, vel, 2.2, 4);                       // seat cushions
      bx(G, xi0+i*sw+0.15, xi0+(i+1)*sw-0.15, seatTop-0.5, cushTop, zb+6, zf-seatD, vel, 2.8, 4);          // back cushions
    }
  } else {
    // folded out: back cushions off, three mattress sections pulled forward to 57 1/2" total depth
    const zEnd=zb+totalD, seg=bedD/3;
    bx(G, xi0, xi1, legH, 12.2, zb+rear, zf, vel, 1);                                       // base under the seat
    bx(G, -bedL/2+1, bedL/2-1, 3.5, 12.2, zf, zEnd-0.5, M('black'), 0.4);                   // pull-out frame
    for(let i=0;i<3;i++) bx(G, -bedL/2, bedL/2, 12.2, bedTop, zb+rear+i*seg+(i?0.1:0), zb+rear+(i+1)*seg-(i<2?0.1:0), vel, 1.8, 4);
    for(const x of [-bedL/2+3, bedL/2-3]) bx(G, x-1, x+1, 0, 3.5, zEnd-3, zEnd-1, M('black'));   // front feet of the pull-out
  }
  for(const [x,z] of [[x0+2,zb+2],[x0+2,zf-2],[x1-2,zb+2],[x1-2,zf-2]]) bx(G, x-1, x+1, 0, legH, z-1, z+1, M('black'), 0.2);  // low feet
  return G;
}

// Counter-height bar stool like the ones staged in the listing photos: light grey faux-leather bucket seat,
// black metal frame with splayed legs, side runners and a footrest. Typical size: 18.5 W x 19.5 D x 34 H, seat 26.
function barStool(){
  const G=new THREE.Group(), lea=C(0xd6d5d1,.55), met=C(0x1c1c1e,.45,.5);
  const seatY=26, r=0.42;
  // legs: tops under the seat, feet splayed out
  const top=[[-6.6,-6],[6.6,-6],[-6.6,6.2],[6.6,6.2]], foot=[[-9.25-0,-9.6],[9.25,-9.6],[-8.6,9.6],[8.6,9.6]];
  const legAt=(i,y)=>{ const t=(24.4-y)/24.4; return [top[i][0]+(foot[i][0]-top[i][0])*t, y, top[i][1]+(foot[i][1]-top[i][1])*t]; };
  for(let i=0;i<4;i++) strut(G,[foot[i][0],0,foot[i][1]],[top[i][0],24.4,top[i][1]],r,met);
  for(const y of [24.4]) for(const [a,b] of [[0,1],[2,3],[0,2],[1,3]]) strut(G,legAt(a,y),legAt(b,y),r,met);   // seat frame
  for(const [a,b] of [[0,2],[1,3]]) strut(G,legAt(a,3),legAt(b,3),r,met);                                  // side runners
  strut(G,legAt(2,10),legAt(3,10),r*1.1,met); strut(G,legAt(0,10),legAt(1,10),r,met);                      // footrest + back bar
  for(let i=0;i<4;i++){ const [x,,z]=legAt(i,0); cyl(G,0.5,0.5,0.25,C(0x111111,.8),x,0,z,10); }              // glides
  // bucket back: C-shaped shell wrapping the back and sides, tallest at the centre (34"), sloping to the front
  const rx=9.25, rz=9.0, cz=-0.2, th=0.75, A=1.95, n=40, sh=new THREE.Shape();
  // seat: follows the shell at the back, rounded front corners
  { const ps=new THREE.Shape(), sx=rx-0.35, sz=rz-0.35, zf=8.4, rc=3.6;
    for(let i=0;i<=24;i++){ const t=-Math.PI/2+Math.PI*i/24; const x=sx*Math.sin(t), z=cz-sz*Math.cos(t); i?ps.lineTo(x,-z):ps.moveTo(x,-z); }
    ps.lineTo(sx,-(zf-rc)); ps.quadraticCurveTo(sx,-zf,sx-rc,-zf); ps.lineTo(-sx+rc,-zf); ps.quadraticCurveTo(-sx,-zf,-sx,-(zf-rc)); ps.closePath();
    const sg=new THREE.ExtrudeGeometry(ps,{depth:1.0,bevelEnabled:true,bevelThickness:0.35,bevelSize:0.35,bevelSegments:3,curveSegments:8}); sg.rotateX(-Math.PI/2);
    mesh(G,sg,lea,0,24.65,0); }
  for(let i=0;i<=n;i++){ const t=-A+2*A*i/n; const x=rx*Math.sin(t), z=cz-rz*Math.cos(t); i?sh.lineTo(x,-z):sh.moveTo(x,-z); }
  for(let i=n;i>=0;i--){ const t=-A+2*A*i/n; const x=(rx-th)*Math.sin(t), z=cz-(rz-th)*Math.cos(t); sh.lineTo(x,-z); }
  const geo=new THREE.ExtrudeGeometry(sh,{depth:1,bevelEnabled:false,curveSegments:1}); geo.rotateX(-Math.PI/2);
  const pos=geo.attributes.position, H=34-24.8;      // back top 34", just under the peninsula overhang (34.5") so it tucks in
  for(let i=0;i<pos.count;i++){ const y=pos.getY(i); if(y<0.5) continue; const t=Math.atan2(pos.getX(i),-(pos.getZ(i)-cz));
    const k=Math.max(0,Math.cos(Math.min(Math.abs(t),Math.PI/2))); pos.setY(i,H*(0.22+0.78*Math.pow(k,1.3))); }
  geo.computeVertexNormals(); mesh(G,geo,lea,0,24.8,0);
  return G;
}

function palm(o={}){
  const H=o.height??104;                              // overall height in inches (ceiling 108)
  const G=new THREE.Group();
  // pot: 16" dia x 18" high, cream glazed
  lathe(G,[[0,0],[6.6,0],[7.2,0.6],[7.6,4],[8,16.6],[8.15,17.2],[8,18],[7.4,18],[7.3,16.9],[0,16.9]],M('potWhite'),0,0,0,48);
  cyl(G,7.35,7.35,0.3,M('soil'),0,16.6,0,40);
  const foliage=group(G,0,16.9,0), R=rng(41); foliage.userData.noCollide=true;   // fronds overhang other things; only pot + trunk collide
  const pos=[], col=[], idx=[]; let vi=0;
  const leafCol=new THREE.Color();
  const N=10;
  for(let s=0;s<N;s++){
    const a=s/N*TAU+R()*0.5, out=V3(Math.sin(a),0,Math.cos(a));
    const base=V3(out.x*R()*2.5,0,out.z*R()*2.5);
    const h=(H-17)*(0.62+R()*0.38), reach=14+R()*16;
    const p0=base, p1=base.clone().add(V3(0,h*0.65,0)).addScaledVector(out,reach*0.12),
          p2=base.clone().add(V3(0,h*1.0,0)).addScaledVector(out,reach*0.55),
          p3=base.clone().add(V3(0,h*0.8,0)).addScaledVector(out,reach);
    const curve=new THREE.CubicBezierCurve3(p0,p1,p2,p3);
    mesh(foliage,new THREE.TubeGeometry(curve,40,0.32,6,false),M('stem'));
    // leaflets along the outer half
    for(let t=0.42;t<=1.0;t+=0.022){
      const P=curve.getPoint(t), T=curve.getTangent(t).normalize();
      const S=new THREE.Vector3().crossVectors(T,V3(0,1,0)); if(S.lengthSq()<1e-4) S.set(1,0,0); S.normalize();
      const len=14*(1-0.55*(t-0.42)/0.58)*(0.85+R()*0.3);
      for(const sd of [-1,1]){
        const dir=S.clone().multiplyScalar(sd).addScaledVector(T,0.55).add(V3(0,-0.35-R()*0.3,0)).normalize();
        const nrm=new THREE.Vector3().crossVectors(dir,T).normalize();
        const pts=[0,0.33,0.66,1].map((u,k)=>P.clone().addScaledVector(dir,len*u).add(V3(0,-len*0.28*u*u,0)));
        const wid=[0.25,0.55,0.45,0.02];
        leafCol.setHSL(0.26+R()*0.04,0.45+R()*0.15,0.15+R()*0.08);
        for(let k=0;k<4;k++){ for(const sg of[-1,1]){ const q=pts[k].clone().addScaledVector(nrm,sg*wid[k]); pos.push(q.x,q.y,q.z); col.push(leafCol.r,leafCol.g,leafCol.b); } }
        for(let k=0;k<3;k++){ const a0=vi+k*2; idx.push(a0,a0+1,a0+2, a0+1,a0+3,a0+2); }
        vi+=8;
      }
    }
  }
  const lg=new THREE.BufferGeometry(); lg.setAttribute('position',new THREE.Float32BufferAttribute(pos,3)); lg.setAttribute('color',new THREE.Float32BufferAttribute(col,3)); lg.setIndex(idx); lg.computeVertexNormals();
  mesh(foliage,lg,M('leaf'));
  // fit the crown to the requested height
  const bb=new THREE.Box3().setFromObject(foliage); const top=bb.max.y-G.position.y;
  foliage.scale.y=(H-16.9)/(top-16.9);
  return G;
}

/* ============================================================ BEDROOM */
function bed(){
  const G=new THREE.Group(), br=M('brass');
  const hx=27.1, zh=-40.6, zf=40.6, pr=0.8;            // finials (r 1.4) land exactly on the measured 57 x 84 overall
  bx(G,-27,27,9,17.5,-37.5,37.5,M('boxSpring'),0.7);   // box spring
  bx(G,-27,27,17.5,26,-37.5,37.5,M('sheet'),2.2,4);    // mattress in a plain fitted sheet
  for(const s of[-1,1]) bx(G,Math.min(s*26.5,s*27.5),Math.max(s*26.5,s*27.5),7.6,9.2,zh,zf,M('black'));  // side rails
  function board(z, postH, archLow, archTop, rails, nSp, collarY){
    const ay=x=>archLow+(archTop-archLow)*Math.pow(Math.max(0,Math.cos(x/hx*Math.PI/2)),0.75);
    for(const s of[-1,1]){
      cyl(G,pr,pr,postH,br,s*hx,0,z,18);
      cyl(G,1.05,1.05,0.9,br,s*hx,postH-0.2,z,18);
      sph(G,1.4,br,s*hx,postH+1.9,z,1,1,1,18);
      for(const y of collarY){ sph(G,1.15,br,s*hx,y,z,1,0.55,1,16); }
      cyl(G,1.1,0.9,1.2,br,s*hx,0,z,16);  // foot cup
    }
    const arch=[]; for(let i=0;i<=20;i++){ const x=-hx+2*hx*i/20; arch.push([x,ay(x),z]); }
    tube(G,arch,0.55,br,64,10);
    for(const y of rails) tube(G,[[-hx,y,z],[hx,y,z]],0.45,br,2,10);
    const r0=rails[rails.length-1];
    for(let i=1;i<=nSp;i++){ const x=-hx+2*hx*i/(nSp+1), top=ay(x);
      cyl(G,0.3,0.3,top-r0,br,x,r0,z,10);
      sph(G,0.62,br,x,r0+(top-r0)*0.4,z,1,1.8,1,12);
    }
  }
  board(zh, 45, 44.6, 53.45, [12,26.5], 9, [12,26.5]);
  board(zf, 30.2, 29.8, 35.45, [14], 9, [14]);
  return G;
}

function dresserTallWhite(){
  const G=new THREE.Group(), w=M('whitePaint');
  const zb=-10.5, zf=5.5;
  bx(G,-11,11,6.2,53,zb,zf,w);                         // carcass
  for(const s of[-1,1]) bx(G,s>0?10.25:-11,s>0?11:-10.25,0,6.2,zb,zf,w); // side panels to floor
  bx(G,-10.3,10.3,0,6.2,zb,zb+0.6,w);                  // back skirt
  bx(G,-11.5,11.5,53,54,zb-0.3,zf+0.8,w,0.3);          // overhanging top
  const ap=new THREE.Shape(); ap.moveTo(-10.3,0.6); ap.lineTo(-8.6,0.6); ap.quadraticCurveTo(0,4.4,8.6,0.6); ap.lineTo(10.3,0.6); ap.lineTo(10.3,6.2); ap.lineTo(-10.3,6.2); ap.closePath();
  const apr=new THREE.ExtrudeGeometry(ap,{depth:0.7,bevelEnabled:false,curveSegments:20}); mesh(G,apr,w,0,0,zf-0.7);
  const hs=[9.4,8.4,7.6,7.0,6.5,6.0]; let y=52.7;
  for(const h of hs){ y-=h;
    bx(G,-9.8,9.8,y+0.12,y+h-0.12,zf,zf+0.55,w,0.2);
    bx(G,-9.0,9.0,y+0.8,y+h-0.8,zf+0.4,zf+0.75,w,0.3);
    knob(G,0,y+h/2,zf+0.75,w,0.6);
    y-=0.25;
  }
  // flared front feet
  for(const s of[-1,1]){
    const f=new THREE.Shape(); f.moveTo(zf-2.5,0); f.lineTo(zf+5,0); f.lineTo(zf+5,0.75); f.quadraticCurveTo(zf+1.0,1.0,zf+0.3,6.6); f.lineTo(zf-2.5,6.6); f.closePath();
    side(G,f,1.3,w,s*(11-0.65),0.1);
  }
  return G;
}

function wardrobeBlack(){
  const G=new THREE.Group(), bw=M('blackWood'), gold=M('gold');
  const W=31, D=20, H=72, zb=-D/2, zf=D/2-0.75;
  bx(G,-W/2,W/2,0,H,zb,zf,bw);
  bx(G,-W/2+0.6,W/2-0.6,0,1.2,zf-0.5,zf+0.6,bw);                       // toe board
  const fronts=[[1.3,10.9],[11.15,17.7],[17.95,24.5]];
  for(const [y0,y1] of fronts){ bx(G,-W/2+0.15,W/2-0.15,y0,y1,zf,zf+0.75,bw); bar(G,0,(y0+y1)/2+((y1-y0)>8?1.2:0),zf+0.75,5,false,gold); }
  for(const s of[-1,1]) bx(G,s<0?-W/2+0.15:0.08,s<0?-0.08:W/2-0.15,24.75,H-0.15,zf,zf+0.75,bw);
  bar(G,-1.3,46,zf+0.75,5.2,true,gold);
  // fluting: vertical ribs on drawer fronts and on a chevron panel across the doors
  const ribs=[], sp=0.56, zr=zf+0.75;
  for(let x=-W/2+0.6;x<=W/2-0.6;x+=sp){
    for(const [y0,y1] of fronts) ribs.push([x,y0+0.35,y1-0.35]);
    if(Math.abs(x)>0.35){ const top=55-19*Math.abs(x)/(W/2); ribs.push([x,25.2,top]); }
  }
  const im=new THREE.InstancedMesh(new THREE.CylinderGeometry(0.2,0.2,1,6),C(0x343437,.3),ribs.length); const m4=new THREE.Matrix4();
  ribs.forEach(([x,y0,y1],i)=>{ m4.makeScale(1,y1-y0,0.7).setPosition(x,(y0+y1)/2,zr); im.setMatrixAt(i,m4); });
  im.castShadow=true; G.add(im);
  return G;
}

function dresserBrown(){
  const G=new THREE.Group(), wd=M('walnut'), gold=M('gold');
  const W=31.5, D=19, H=40, zb=-D/2, zf=D/2-0.75;
  bx(G,-W/2,W/2,0,H-1,zb,zf,wd);
  bx(G,-W/2,W/2,H-1,H,zb,D/2,wd,0.15);
  bx(G,-W/2+0.8,W/2-0.8,0,1.4,zf-0.4,zf+0.3,M('cherryBack'));
  const hs=[7.6,7.1,7.1,7.1,7.1]; let y=H-1.25;
  for(const h of hs){ y-=h; bx(G,-W/2+0.5,W/2-0.5,y,y+h-0.25,zf,zf+0.75,wd,0.12); for(const s of[-1,1]) knob(G,s*8.6,y+h/2,zf+0.75,gold,0.42); }
  return G;
}

function vanityMirror(){
  // stands on the dresser; origin = underside of its stand
  const G=new THREE.Group(), W=24, H=25;
  const g=group(G,0,0.6,0); g.rotation.x=-0.1;
  bx(g,-W/2,W/2,0.5,H,-0.6,0.3,M('whiteMetal'),0.3);
  bx(g,-W/2+0.5,W/2-0.5,1,H-0.5,0.25,0.35,M('mirror'));
  const bulbs=[]; for(let i=0;i<6;i++) bulbs.push([-W/2+2+i*(W-4)/5,H-1.6]);
  for(let i=0;i<3;i++){ const y=H-1.6-(i+1)*(H-4)/3.6; bulbs.push([-W/2+1.6,y],[W/2-1.6,y]); }
  for(const [x,y] of bulbs){ cyl(g,0.45,0.45,0.4,M('chrome'),x,y,0.45); const b=sph(g,0.85,M('bulb'),x,y,1.4,1,1,1,14); b.castShadow=false; }
  bx(G,-9,9,0,0.6,-4.5,2,M('whiteMetal'),0.25);                     // foot
  strut(G,[0,0.6,-4.2],[0,12,-1.4],0.35,M('whiteMetal'));          // kickstand
  return G;
}

/* ============================================================ OFFICE */
function desk(o={}){
  const H=Math.max(26,Math.min(47,o.height??29));
  const G=new THREE.Group(), blk=M('black');
  bx(G,-35.5,35.5,H-1,H,-15.75,15.75,M('deskTop'),0.25);
  for(const s of[-1,1]){ const x=s*28;
    bx(G,x-1.3,x+1.3,0.3,1.8,-13.5,13.5,blk,0.6);
    for(const z of[-12.5,12.5]) cyl(G,0.7,0.7,0.3,M('rubber'),x,0,z,12);
    bx(G,x-1.6,x+1.6,1.8,23,-1.15,1.15,blk,0.2);
    bx(G,x-1.35,x+1.35,21,H-2.6,-0.9,0.9,M('blackMatte'),0.15);
    bx(G,x-1,x+1,H-2.6,H-1,-12.5,12.5,blk,0.2);
  }
  bx(G,-27,27,H-3.4,H-1,-1.2,1.2,blk,0.2);
  bx(G,19,26,H-2.2,H-1,14.4,16.3,blk,0.4);                  // keypad
  bx(G,20,23,H-1.9,H-1.3,16.25,16.35,C(0x7fd5ff,.3));
  return G;
}

function chairOffice(){
  const G=new THREE.Group(), blk=M('black'), al=M('chrome'), mb=M('meshBlue');
  for(let i=0;i<5;i++){ const a=i/5*TAU, ex=Math.sin(a)*12.5, ez=Math.cos(a)*12.5;
    strut(G,[0,4.4,0],[ex,3.2,ez],0.95,al,0.6);
    cyl(G,0.45,0.45,1,blk,ex,2.4,ez,10);
    const w=mesh(G,new THREE.CylinderGeometry(1.2,1.2,1.5,16),blk,ex,1.2,ez); w.rotation.set(0,a,Math.PI/2,'YXZ');
  }
  cyl(G,1.9,2.2,1.8,al,0,3.2,0);
  cyl(G,1.0,1.0,8,al,0,5,0);
  cyl(G,1.4,1.4,4.5,blk,0,4.8,0);
  bx(G,-4.5,4.5,13,16.8,-4,4,blk,0.6);
  bx(G,-10,10,16.8,19.2,-8.5,10,blk,1.1,4);                // seat frame
  bx(G,-9.2,9.2,18.6,19.9,-7.8,9.4,mb,0.6,4);              // mesh seat
  const b=group(G,0,19,-9); b.rotation.x=-0.17;
  bx(b,-1.3,1.3,-2.5,8,-1.6,0.2,blk,0.4);                  // spine
  rb(b,19,23,1.3,0.9,blk,0,14,0,4); rb(b,17.4,21.4,1.6,0.6,mb,0,14,0.05,3);
  bx(b,-9.8,-7.6,6,10.5,-0.4,1.1,M('whitePaint'),0.5); bx(b,7.6,9.8,6,10.5,-0.4,1.1,M('whitePaint'),0.5);
  bx(b,-0.9,0.9,24.5,28.5,-0.9,0.3,blk,0.3);
  rb(b,11,4.6,2.2,1,blk,0,30.2,0.3,4); rb(b,9.6,3.4,2.4,0.8,mb,0,30.2,0.35,3);
  for(const s of[-1,1]){
    bx(G,Math.min(s*9.2,s*11.4),Math.max(s*9.2,s*11.4),16.8,17.8,-5,-1,blk,0.3);
    bx(G,s*11-0.6,s*11+0.6,17.5,26.5,-3.6,-1.6,blk,0.3);
    bx(G,s*11-1.6,s*11+1.6,26.4,27.6,-7.5,3.5,blk,0.5);
  }
  return G;
}

function sideTableWhite(){
  const G=new THREE.Group(), wm=M('whiteMetal'), fab=M('fabricWhite'), gold=M('gold');
  const hx=4.6, hz=9.35, p=0.45;
  for(const sx of[-1,1]) for(const sz of[-1,1]){ bx(G,sx*hx-p,sx*hx+p,0.6,34.3,sz*hz-p,sz*hz+p,wm,0.1); cyl(G,0.45,0.5,0.6,wm,sx*hx,0,sz*hz,12); }
  for(const y of[1.2,26.2,33.8]){ for(const sx of[-1,1]) bx(G,sx*hx-0.3,sx*hx+0.3,y-0.35,y+0.35,-hz,hz,wm); bx(G,-hx,hx,y-0.35,y+0.35,-hz-0.3,-hz+0.3,wm); }
  bx(G,-5,5,34.25,35,-9.75,9.75,M('whiteBoard'),0.15);                      // top
  bx(G,-4.3,4.3,26.5,27.1,-9,9,M('whiteBoard'));                             // open shelf
  const hs=[6.4,6.1,5.8,5.6]; let y=26.1;
  for(const h of hs){ y-=h; rb(G,8.6,h-0.35,17.8,0.35,fab,0,y+h/2,-0.1); bx(G,-4.35,4.35,y+0.2,y+h-0.15,8.8,9.2,fab,0.2); knob(G,0,y+h*0.58,9.2,gold,0.5); y-=0.15; }
  return G;
}

function exerciseBike(){
  const G=new THREE.Group(), blk=M('blackMatte'), dk=M('black'), blu=M('blueAccent');
  bx(G,-13,13,0,2.3,20.8,24,blk,1);  bx(G,-11.5,11.5,0,2.3,-24,-20.8,blk,1);   // stabilisers
  strut(G,[0,2,-22],[0,9,-9],1.3,blk); strut(G,[0,2,22],[0,10,13],1.35,blk);
  strut(G,[0,9,-9],[0,10,13],1.45,blk);
  strut(G,[0,9,-9],[0,29,-12.5],1.25,blk);
  strut(G,[0,20,-10.8],[0,22.5,-11.3],1.35,blu);                    // blue badge band
  strut(G,[0,10,12],[0,31.5,5.5],1.35,blk);
  strut(G,[0,12,-4],[0,25,4.5],1.1,blk);
  const fw=mesh(G,new THREE.CylinderGeometry(8.4,8.4,4.2,44),dk,0,11,10.5); fw.rotation.z=Math.PI/2;
  for(const s of[-1,1]) ring(G,8.1,0.3,blu,s*2.15,11,10.5,'x');
  const cr=mesh(G,new THREE.CylinderGeometry(6.4,6.4,5,40),blk,0,12,-2.5); cr.rotation.z=Math.PI/2;
  for(const s of[-1,1]){ const d=mesh(G,new THREE.CylinderGeometry(3,3,0.3,24),M('steel'),s*2.6,12,-2.5); d.rotation.z=Math.PI/2; }
  for(const s of[-1,1]){ const th=s>0?0.7:0.7+Math.PI, ex=s*3.4, ey=12+6.5*Math.sin(th), ez=-2.5+6.5*Math.cos(th);
    strut(G,[s*3,12,-2.5],[ex,ey,ez],0.55,M('steel'));
    bx(G,Math.min(s*3.6,s*7.2),Math.max(s*3.6,s*7.2),ey-0.5,ey+0.5,ez-2,ez+2,dk,0.3);
    tube(G,[[s*3.8,ey+0.4,ez+1.9],[s*5.4,ey+1.9,ez+2.4],[s*7,ey+0.4,ez+1.9]],0.18,dk,12,6);
  }
  strut(G,[0,29,-12.5],[0,32,-13.2],0.95,M('steel'));
  strut(G,[0,32,-15.5],[0,32,-10.5],0.5,M('steel'));
  rb(G,10.8,2.6,7.2,1.25,dk,0,33.6,-15.2,4); rb(G,4.6,2.2,6,1.0,dk,0,33.5,-10.4,4);   // wide saddle + nose
  strut(G,[0,31.5,5.5],[0,33.8,5.2],1.0,M('steel'));
  tube(G,[[-9.5,34.4,10.5],[-8.6,34.1,6.2],[-5,33.6,3.4],[0,33.5,3],[5,33.6,3.4],[8.6,34.1,6.2],[9.5,34.4,10.5]],0.65,dk,40,10);
  bx(G,-2,2,33.6,38,4.2,6.6,dk,0.7);                                  // tablet holder ("CONNECT")
  cyl(G,0.9,0.9,1.4,M('red'),0,25.2,3.6,16); cyl(G,0.5,0.5,0.4,blu,0,26.6,3.6,12);
  return G;
}

/* ============================================================ KITCHEN / DINING */
function diningTable(){
  const G=new THREE.Group(), oak=M('oak'), R=24.5;
  lathe(G,[[0,28.7],[R-0.7,28.7],[R-0.1,29.0],[R,29.4],[R-0.15,29.8],[R-0.6,30],[0,30]],oak,0,0,0,72);
  bx(G,-0.05,0.05,29.98,30.02,-R+0.6,R-0.6,C(0x3a2410,.6));            // leaf seam
  const ap=mesh(G,new THREE.CylinderGeometry(R-3,R-3,3,64,1,true),new THREE.MeshStandardMaterial({map:oak.map,roughness:.45,side:THREE.DoubleSide}),0,27.2,0);
  lathe(G,[[0,5.2],[5.4,5.2],[5.8,6.2],[4.8,7.4],[3.6,9],[4.3,11.5],[4.9,14.2],[4.1,17],[2.7,19.2],[2.5,22],[3.3,23.2],[3.4,24.4],[4.8,25.2],[5.4,25.9],[0,25.9]],oak,0,0,0,40);
  for(let k=0;k<4;k++){
    const g=group(G,0,0,0,Math.PI/4+k*Math.PI/2);
    const sh=new THREE.Shape(); sh.moveTo(3,12); sh.quadraticCurveTo(9,11,13,6.5); sh.quadraticCurveTo(15.5,3.8,18.2,3.4); sh.lineTo(18.2,1.6); sh.quadraticCurveTo(13.5,1.8,10,4.4); sh.quadraticCurveTo(6.5,6.6,3,6); sh.closePath();
    side(g,sh,2.4,oak,0,0.25);
    sph(g,1.6,oak,0,1.6,17.6,1,1,1,16);                                  // ball foot
    for(const dx of[-0.9,0,0.9]) sph(g,0.55,oak,dx,2.6,18.6,1,0.8,1.4,10); // claw
  }
  return G;
}

function diningChair(){
  const G=new THREE.Group(), oak=M('oak');
  // contoured seat (plan shape: wide front, rounded back)
  const s=new THREE.Shape(); s.moveTo(-8.6,-8.2); s.lineTo(8.6,-8.2); s.quadraticCurveTo(9.2,-8.2,9.2,-7.2); s.lineTo(8.4,4.5); s.quadraticCurveTo(6.5,8.6,0,8.8); s.quadraticCurveTo(-6.5,8.6,-8.4,4.5); s.lineTo(-9.2,-7.2); s.quadraticCurveTo(-9.2,-8.2,-8.6,-8.2);
  slab(G,s,1.1,oak,16.7,0.35);
  const lp=[[7,6,8.6,8.6],[-7,6,-8.6,8.6],[6.2,-5.5,7.8,-8.4],[-6.2,-5.5,-7.8,-8.4]];
  const top={}; for(const [x,z,fx,fz] of lp){ strut(G,[fx,0,fz],[x,16.7,z],0.55,oak,0.72,12); }
  const at=(i,y)=>{ const [x,z,fx,fz]=lp[i], t=y/16.7; return [fx+(x-fx)*t,y,fz+(z-fz)*t]; };
  strut(G,at(0,6.5),at(2,6.5),0.42,oak); strut(G,at(1,6.5),at(3,6.5),0.42,oak);   // side stretchers
  const m0=at(0,6.5), m1=at(2,6.5); strut(G,[(m0[0]+m1[0])/2,6.5,(m0[2]+m1[2])/2],[-(m0[0]+m1[0])/2,6.5,(m0[2]+m1[2])/2],0.42,oak); // middle
  strut(G,at(0,9),at(1,9),0.38,oak);                                                 // front stretcher
  // back: two turned posts, five flat arrow slats, arched crest rail
  const b=group(G,0,17.6,-6.9); b.rotation.x=-0.17;
  for(const sx of[-1,1]) strut(b,[sx*7.6,-0.5,0],[sx*8.4,17,-0.6],0.48,oak,0.42,12);
  for(let i=0;i<5;i++){ const x=-5.2+i*2.6;
    const g=new THREE.BoxGeometry(1,15.2,0.42,1,16,1), p=g.attributes.position;
    for(let j=0;j<p.count;j++){ const t=(p.getY(j)+7.6)/15.2, w=0.55+1.25*Math.pow(Math.sin(Math.PI*Math.min(1,t*1.1)),1.3); p.setX(j,p.getX(j)*w); }
    g.computeVertexNormals(); const m=mesh(b,g,oak,x*(1+0.04),7.6+0.2,-0.25); m.rotation.z=-x*0.012;
  }
  const cg=new THREE.BoxGeometry(18.4,3,0.9,30,1,1), cp=cg.attributes.position;
  for(let j=0;j<cp.count;j++){ const x=cp.getX(j), t=x/9.2; cp.setY(j,cp.getY(j)+2.4*Math.cos(t*Math.PI/2)); cp.setZ(j,cp.getZ(j)-1.4*(1-t*t)); }
  cg.computeVertexNormals(); mesh(b,cg,oak,0,16.6,-0.4);
  return G;
}

function kitchenAid(){
  const G=new THREE.Group(), pk=M('pink'), ch=M('chrome');
  rb(G,7.4,2.3,12.6,1.1,pk,0,1.15,0.6,4);                               // base
  rb(G,5.6,9.4,5.2,2.3,pk,0,2+4.7,-4.4,4);                              // column
  const hd=mesh(G,new THREE.CapsuleGeometry(3.2,7.6,8,24),pk,0,11.1,-0.9); hd.rotation.x=Math.PI/2; hd.scale.set(1.08,1,0.88);
  ring(G,3.3,0.22,ch,0,11.1,1.8,'z').scale.set(1.08,0.88,1);
  const hub=mesh(G,new THREE.CylinderGeometry(1.5,1.7,0.8,24),ch,0,11.1,6.6); hub.rotation.x=Math.PI/2;
  bx(G,3.3,3.55,10.6,11.6,-4.5,-1.5,ch,0.1);                            // badge
  bx(G,-0.2,0.2,7.4,8.4,0.2,1.6,ch,0.1);                                // beater shaft stub
  cyl(G,3.6,3.6,0.4,ch,0,2.2,2.6,32);                                   // bowl clamp plate
  lathe(G,[[0,0],[2.6,0],[3.4,0.6],[4.2,2.6],[4.55,5.2],[4.6,5.6],[4.35,5.6],[4.3,5.2],[3.95,2.7],[3.2,0.9],[0,0.9]],M('pinkGloss'),0,2.6,2.6,40);
  tube(G,[[4.4,7.7,2.6],[5.9,7.3,2.6],[6.1,5.4,2.6],[4.3,4.4,2.6]],0.42,M('pinkGloss'),20,8);
  return G;
}
function smegHandMixer(){
  const G=new THREE.Group(), pk=M('pinkGloss');
  const b=mesh(G,new THREE.CapsuleGeometry(1.75,4.8,8,20),pk,0,2.1,0); b.rotation.x=Math.PI/2; b.scale.set(1,1,1.22);
  tube(G,[[0,3.4,-3],[0,5.4,-2.2],[0,5.9,0],[0,5.2,2.3],[0,3.6,3]],0.42,M('chrome'),30,10);
  bx(G,-1.2,1.2,3.05,3.35,-1.6,1.6,C(0xffffff,.5));                     // SMEG lettering strip
  for(const x of[-0.7,0.7]) cyl(G,0.25,0.25,0.8,M('chrome'),x,0.0,1.2,10);
  return G;
}
function kettle(){
  const G=new THREE.Group(), pk=M('pinkRibbed'), rg=M('roseGold');
  cyl(G,3.7,3.8,0.9,M('pink'),0,0,0,40);
  lathe(G,[[0,0.9],[3.25,0.9],[3.4,1.6],[3.35,4.5],[3.15,7.6],[2.75,8.6],[0,8.6]],pk,0,0,0,48);
  ring(G,3.3,0.12,rg,0,1.15,0,'y');
  lathe(G,[[2.8,8.5],[2.6,8.9],[1.6,9.25],[0,9.35]],M('pink'),0,0,0,40);
  ring(G,2.75,0.12,rg,0,8.6,0,'y');
  cyl(G,0.5,0.6,0.5,rg,0,9.3,0,14); sph(G,0.6,rg,0,10,0,1,0.6,1,14);
  strut(G,[0,7.3,2.8],[0,8.5,4.3],0.75,M('pink'),0.45,14);               // spout
  tube(G,[[0,7.9,-2.9],[0,8.5,-4.5],[0,6.8,-5.5],[0,3.6,-5.3],[0,1.9,-4.2],[0,1.8,-3.2]],0.55,M('pink'),30,10);
  return G;
}
function dutchOven(){
  const G=new THREE.Group(), pk=M('pink');
  lathe(G,[[0,0],[4.8,0],[5.4,0.5],[5.6,1.6],[5.6,5.6],[5.35,5.7]],pk,0,0,0,56);
  const inn=lathe(G,[[5.32,5.7],[5.32,1.2],[4.6,0.5],[0,0.5]],M('cream'),0,0,0,56); inn.material=inn.material.clone(); inn.material.side=THREE.DoubleSide;
  lathe(G,[[5.75,5.6],[5.8,5.9],[5.3,6.5],[3.5,7.0],[0,7.15]],pk,0,0,0,56);
  cyl(G,0.55,0.7,0.5,M('gold'),0,7.1,0,14); sph(G,1.0,M('gold'),0,7.95,0,1,0.6,1,16);
  for(const s of[-1,1]) tube(G,[[s*5.4,4.6,-1.4],[s*6.6,4.7,-1.2],[s*7.1,4.8,0],[s*6.6,4.7,1.2],[s*5.4,4.6,1.4]],0.38,pk,20,8);
  return G;
}

/* ============================================================ ENTRYWAY */
function coatRack(){
  const G=new THREE.Group(), gd=M('gold'), R=rng(77);
  pathTube(G,[LN([-12,1,0],[-12,59,0]),QB([-12,59,0],[-12,61.5,0],[-9.5,61.5,0]),LN([-9.5,61.5,0],[9.5,61.5,0]),QB([9.5,61.5,0],[12,61.5,0],[12,59,0]),LN([12,59,0],[12,1,0])],0.5,gd);
  for(const s of[-1,1]){ tube(G,[[s*12,0.75,-7],[s*12,0.75,7]],0.55,gd,2,10); for(const z of[-7,7]) sph(G,0.75,M('rubber'),s*12,0.75,z,1,1,1,10);
    for(const z of[-5,5]) tube(G,[[s*12,0.75,z],[s*12,7,z]],0.35,gd,2,8); }
  for(const z of[-5,5]) tube(G,[[-12,7,z],[12,7,z]],0.35,gd,2,8);
  const coats=[{c:0x3c3a28,L:40},{c:0x1b1b1d,L:30},{c:0x24382b,L:34},{c:0x58623f,L:27},{c:0x18191f,L:31,puffer:true},{c:0x2c2520,L:37},{c:0x1f2a3b,L:29}];
  coats.forEach((cs,i)=>{
    const x=-9.3+i*(18.6/(coats.length-1)), g=group(G,x,61.5,0); g.rotation.x=(R()-0.5)*0.08;
    const m=C(cs.c,0.85);
    tube(g,[[0,0,0],[0,0.6,0.5],[0,0.9,-0.3],[0,0.2,-0.6],[0,-1.3,-0.2]],0.12,M('steel'),12,6);
    tube(g,[[0,-2.3,-8],[0,-1.4,-3],[0,-1.2,0],[0,-1.4,3],[0,-2.3,8]],0.25,C(0x111111,.6),16,6);
    const top=-2.0, t=3.0+R()*0.6;
    if(cs.puffer){ for(let k=0;k*4<cs.L;k++) rb(g,t+0.6,4.3,16.6,1.7,m,0,top-2.1-k*4,0,3); }
    else rb(g,t,cs.L,16.4,1.3,m,0,top-cs.L/2,0,3);
    rb(g,t+0.4,3,17.2,1.4,m,0,top-1.2,0,3);
    rb(g,t+0.6,2.2,6,0.9,m,0,top+0.4,0,3);                                       // collar
    for(const s of[-1,1]){ const sl=Math.min(25,cs.L*0.78); const sg=group(g,0,top-1.5,s*8.4); sg.rotation.x=s*0.05; rb(sg,t*0.85,sl,3.4,1.2,m,0,-sl/2,0,3); }
  });
  const hat=group(G,-14.8,54.5,0); hat.rotation.z=Math.PI/2*0.92;
  cyl(hat,7.6,7.6,0.25,M('straw'),0,0,0,36); cyl(hat,3.5,3.9,3.9,M('straw'),0,0.25,0,30); cyl(hat,3.95,3.95,1.1,C(0x111111,.6),0,0.3,0,30);
  return G;
}

function shoe(parent, type, col, x, z, opt={}){
  const g=group(parent,x,0,z), m=C(col,opt.rough??0.7), sole=C(opt.sole??0xf2f2f0,0.8);
  if(type==='sneaker'){
    rb(g,3.8,1.1,10.4,0.45,sole,0,0.55,0,3);
    rb(g,3.45,3.0,8.0,1.2,m,0,1.0+1.5,-0.9,3);
    rb(g,3.3,2.1,4,1.0,m,0,1.05+1,3,3);
    sph(g,1.25,C(0x151515,.9),0,4.0,-1.6,1,0.12,1.5,12);
    if(opt.accent) bx(g,-1.78,1.78,1.6,2.4,-3,1.5,C(opt.accent,.6));
  } else if(type==='boot'){
    const h=opt.h??14;
    rb(g,3.8,1.0,10.2,0.45,C(0x151515,.8),0,0.5,0,3);
    rb(g,3.5,3.6,9.2,1.4,m,0,0.9+1.8,0.3,3);
    rb(g,3.7,h-1,4.6,1.5,m,0,1+(h-1)/2,-2.6,3);
    sph(g,1.4,C(0x111111,.9),0,h,-2.6,1.05,0.1,1.3,12);
  } else if(type==='slide'){
    rb(g,3.8,1.0,10,0.45,C(0x111111,.8),0,0.5,0,3);
    rb(g,4.0,1.5,3.6,0.6,m,0,1.4,1.4,3);
    for(const dx of[-0.9,0,0.9]) bx(g,dx-0.22,dx+0.22,1.2,2.17,-0.4,3.2,C(0xffffff,.6));
  } else { // loafer / flat
    rb(g,3.7,0.8,10,0.4,C(0x222222,.8),0,0.4,0,3);
    rb(g,3.4,2.2,8.6,1,m,0,0.8+1.1,0.2,3);
    sph(g,1.2,C(0x111111,.9),0,3.0,-1.5,1.1,0.12,1.6,12);
  }
  return g;
}
function pair(parent,type,col,x,opt){ shoe(parent,type,col,x-2.1,0,opt); shoe(parent,type,col,x+2.1,0.3,opt); }

function shoeRack(){
  const G=new THREE.Group(), bm=M('bamboo');
  for(const sx of[-1,1]) for(const sz of[-1,1]) bx(G,sx*12-0.6,sx*12+0.6,0,27,sz*4.9-0.4,sz*4.9+0.4,bm);
  const ys=[1.2,9.6,18,26.3], tiers=[];
  for(const y of ys){ const t=group(G,0,y,0); t.rotation.x=0.09; tiers.push(t);
    for(const sx of[-1,1]) bx(t,sx*11.6-0.5,sx*11.6+0.5,0,0.5,-5.5,5.5,bm);
    for(const zc of[-4.2,-1.4,1.4,4.2]) bx(t,-11.6,11.6,0.05,0.5,zc-0.8,zc+0.8,bm,0.1);
  }
  const on=t=>{ const g=group(t,0,0.5,0); return g; };
  let g=on(tiers[3]); pair(g,'boot',0x1a1c1a,-7.8,{h:14,rough:.35}); pair(g,'boot',0xeeeae2,0,{h:9}); pair(g,'boot',0x1d1d1f,7.8,{h:7});
  g=on(tiers[2]);     pair(g,'boot',0xa0703f,-7.8,{h:6}); pair(g,'sneaker',0x1d1d1f,0,{sole:0x222222}); pair(g,'loafer',0x2b2b2d,7.8);
  g=on(tiers[1]);     pair(g,'sneaker',0x8c8f93,-7.8,{accent:0xeeeeee}); pair(g,'sneaker',0x222326,0,{accent:0xc0262c}); pair(g,'sneaker',0xe7b4c2,7.8);
  g=on(tiers[0]);     pair(g,'sneaker',0xf2e3e8,-7.8,{accent:0x111111}); pair(g,'loafer',0x1c1c1e,0); pair(g,'slide',0x151515,7.8);
  return G;
}

/* ============================================================ SHELVES with contents */
const BOOKCOL=[0xb8342a,0x2a4a7a,0xe8d9b0,0x1f1f22,0x3f6b4a,0xd9a441,0x7a2e3b,0xefe8dc,0x5c7fa8,0xc76a2b,0x34343a,0x8d5a3b,0x9fb7c9,0xd3c4a2,0x6b4d8a];
function books(p,R,x0,x1,y,o={}){
  let x=x0; const hmax=o.hmax??10.2, hmin=o.hmin??7.2;
  while(x<x1-0.6){
    const t=0.6+R()*1.3, h=hmin+R()*(hmax-hmin), d=5.5+R()*2.5; if(x+t>x1) break;
    bx(p,x,x+t,y,y+h,4.7-d,4.7,C(BOOKCOL[(R()*BOOKCOL.length)|0],.75)); x+=t+0.04;
  }
  return x;
}
// books leaning against the right-hand side wall that ends at xEnd
function lean(p,R,xEnd,y,n=4){ let x=xEnd-2.6; for(let i=0;i<n;i++){ const h=8+R()*2, t=0.8+R()*0.6, g=group(p,x-t/2,y,0); g.rotation.z=-0.22;
  bx(g,-t/2,t/2,0,h,-3,4.5,C(BOOKCOL[(R()*BOOKCOL.length)|0],.75)); x-=t*1.1; } }
function games(p,R,x0,y,list){ let yy=y; for(const [w,h,d,c] of list){ bx(p,x0,x0+w,yy,yy+h,4.8-d,4.8,C(c,.6)); bx(p,x0+0.4,x0+w-0.4,yy+h,yy+h+0.02,4.8-d+0.4,4.4,C(0xffffff,.6)); yy+=h; } }
function teddy(p,x,y,z,col,s=1){ const m=C(col,1), g=group(p,x,y,z); g.scale.setScalar(s);
  sph(g,3.2,m,0,3.2,0,1,1.05,0.9,14); sph(g,2.4,m,0,7.6,0.3,1,1,1,14); sph(g,0.8,m,-1.7,9.4,0.2); sph(g,0.8,m,1.7,9.4,0.2);
  sph(g,0.9,m,0,7.2,2.4,1,0.75,0.7); for(const s2 of[-1,1]){ sph(g,1.1,m,s2*3,3.8,1.4,0.8,1.4,0.8); sph(g,1.3,m,s2*1.8,1,2.4,0.9,0.8,1.3); } return g; }
function openBox(p,x,y,z,w,h,d,mat,lip){ bx(p,x-w/2,x+w/2,y,y+0.3,z-d/2,z+d/2,mat); for(const s of[-1,1]){ bx(p,x-w/2,x+w/2,y,y+h,z+s*d/2-0.2,z+s*d/2+0.2,mat); bx(p,x+s*w/2-0.2,x+s*w/2+0.2,y,y+h,z-d/2,z+d/2,mat);} }

function shelf(o={}){
  const v=o.variant??'A', G=new THREE.Group(), wd=M('cherry'), R=rng(v.charCodeAt(0)*31);
  const W=24,H=80,D=11, zb=-D/2, zf=D/2, t=0.6;
  for(const s of[-1,1]) bx(G,s>0?W/2-t:-W/2,s>0?W/2:-W/2+t,0,H,zb,zf,wd);
  bx(G,-W/2+t,W/2-t,H-t,H,zb,zf,wd);
  bx(G,-W/2+t,W/2-t,0,2.6,zf-0.9,zf-0.3,wd);                 // kick board
  bx(G,-W/2+t,W/2-t,0.3,H-0.3,zb,zb+0.2,M('cherryBack'));      // back panel
  const fl=[]; for(let i=0;i<6;i++){ const y=2.6+i*12.8; fl.push(y+t); bx(G,-W/2+t,W/2-t,y,y+t,zb+0.2,zf-0.2,wd); }
  const xi=-W/2+t+0.15, xa=W/2-t-0.15;
  if(v==='A'){
    books(G,R,xi,xa,fl[5]);
    for(let i=0;i<6;i++){ const x=xi+1+i*2.4; cyl(G,0.9,0.9,2.2,C([0x2b2b2b,0xd8c9a8,0x8a3a2a,0x3a5a8a,0xeee6d6,0x6a6a6a][i],.5),x,fl[4],1.5,14); sph(G,1.1,C([0x2b2b2b,0xd8c9a8,0x8a3a2a,0x3a5a8a,0xeee6d6,0x6a6a6a][i],.5),x,fl[4]+3.2,1.5); }
    books(G,R,xi,xa,fl[3]);
    bx(G,xi+0.3,xi+3.6,fl[2],fl[2]+1.6,-2,3,C(0xb83a3a,.6)); bx(G,xi+4,xi+7,fl[2],fl[2]+2.2,-1,3.5,C(0xe6e2d8,.6)); bx(G,xi+4.2,xi+6.8,fl[2]+2.2,fl[2]+3.4,-0.6,3,C(0x7fa6c4,.6));
    books(G,R,xi+8.5,xa,fl[2],{hmax:9.8});
    books(G,R,xi,xa-6.4,fl[1]); lean(G,R,xa,fl[1],3);
    for(let i=0;i<6;i++){ const g=group(G,xi+5.5,fl[0]+i*0.45,0.5); g.rotation.y=(R()-0.5)*0.5; bx(g,-5,5,0,0.4,-4,4,C([0xf0ece2,0xe8cf6a,0x6aa0c8,0xf3f3f3,0xd88a6a,0xece6d0][i],.8)); }
    bx(G,xi+10.5,xa,fl[0],fl[0]+6,-4.5,6.5,M('plastic'),0.4); bx(G,xi+11.5,xa-1,fl[0]+5.95,fl[0]+6.05,-3,5,C(0x333333,.5));
    bx(G,-5,5,H,H+5.8,-2.5,2.5,C(0xece6d4,.5),0.4); bx(G,-4,4,H+1,H+4.8,2.48,2.55,C(0xa0a0a0,.6));          // old radio on top
  } else if(v==='B'){
    books(G,R,xi,xi+9,fl[5]); cyl(G,1.2,0.9,4.5,C(0xe9e6dd,.3),xi+10.8,fl[5],1.5); sph(G,1.3,C(0xe06a2a,.8),xi+10.4,fl[5]+6,1.5); sph(G,1,C(0xd6592b,.8),xi+11.5,fl[5]+5.4,1.8);
    rb(G,9.2,6.8,6.2,0.8,M('leather'),xa-4.8,fl[5]+3.4,1.2,3); bx(G,xa-6.5,xa-3.2,fl[5]+6.8,fl[5]+7.5,1.1,1.4,M('gold'));
    cyl(G,1.8,2.2,0.6,C(0x8b5a2b,.5),xi+3.2,fl[4],1.5); cyl(G,0.35,0.35,5.2,C(0xb8a37a,.4,.6),xi+3.2,fl[4]+0.6,1.5);
    mesh(G,new THREE.CylinderGeometry(2.6,3.4,4.6,28,1,true),new THREE.MeshStandardMaterial({color:0xf5f1e6,roughness:.9,side:THREE.DoubleSide,emissive:0x5a4a30,emissiveIntensity:.25}),xi+3.2,fl[4]+7.6,1.5);
    bx(G,xi+6.4,xi+8,fl[4],fl[4]+2,1,3,C(0xe8c39a,.6)); cyl(G,1.6,1.8,3.4,C(0xd99aa8,.5),xi+11,fl[4],1.6,20); cyl(G,0.5,0.5,5,C(0x1d1d1d,.3),xi+13.2,fl[4],2,10); cyl(G,0.9,0.9,3,C(0xcfd8de,.15),xi+14.8,fl[4],2,12);
    lean(G,R,xa,fl[4],3);
    books(G,R,xi,xa-3.5,fl[3]); sph(G,1.5,C(0xe8761e,.6),xa-1.8,fl[3]+1.4,2.8,1,0.85,1,14);
    games(G,R,xi+0.5,fl[2],[[10.4,2.8,10,0x2a3e78],[10.4,2.6,10,0xdd8a2a],[10.4,3.2,10,0x6c2a2a],[9.6,2.4,9.6,0xe7d9b8]]);
    games(G,R,xi+11,fl[2],[[10.2,3,9.5,0x1f6f8b],[10.2,2.8,9.5,0xf2eee2],[9.8,2.4,9.5,0x4a6a2a]]);
    games(G,R,xi+0.5,fl[1],[[11,2.6,10,0x3a2a1a],[11,3,10,0x8e2c24],[11,2.4,10,0xd7b56a],[10.4,2.4,10,0x223355]]);
    games(G,R,xi+12,fl[1],[[10,2.6,9.5,0x6b3a8a],[10,3,9.5,0x1a1a1a]]); lean(G,R,xa,fl[1]+5.6,2);
    rb(G,5.5,4.2,5,0.5,C(0xf0b6c4,.6),xi+4,fl[0]+2.1,1.5); rb(G,4.5,3.2,4.2,0.5,C(0xf6c8d2,.6),xi+4,fl[0]+5.8,1.5); rb(G,8,6.5,7,1.2,C(0x1f2022,.8),xi+14,fl[0]+3.25,0.5);
  } else {
    openBox(G,0,H,0,17,6.5,10.5,M('basketGreen'));                                                 // basket on top
    rb(G,10,8,9.6,0.8,M('canvas'),xi+5.3,fl[5]+4,0.2); bx(G,xi+11,xi+13,fl[5],fl[5]+7,-2,3.5,C(0xf4f2ec,.6)); books(G,R,xa-6,xa,fl[5],{hmin:9.5,hmax:11.4});
    bx(G,xi+0.2,xi+3,fl[4],fl[4]+11.2,-4.5,4.5,C(0x22252b,.7)); bx(G,xi+3.2,xi+6,fl[4],fl[4]+10.6,-4.5,4.5,C(0x2c2f36,.7));
    const bag=group(G,xi+6.8,fl[4]+2.5,2); bag.rotation.z=-0.15; rb(bag,5.5,8.5,3.2,0.6,C(0xd2232a,.7),0,4.2,0); bx(bag,-2.6,2.6,4,6,1.55,1.65,C(0xffffff,.6));
    teddy(G,xi+9,fl[4],0.8,0x9ab6c8,0.95); teddy(G,xi+14.5,fl[4],1,0xf1ece0,1.05);
    cyl(G,1.2,1.2,7.5,M('glassBottle'),xa-1.6,fl[4],1.5,14); cyl(G,0.45,0.6,2,M('glassBottle'),xa-1.6,fl[4]+7.5,1.5,10);
    openBox(G,xi+5.4,fl[3],0.3,10.4,5.2,9.6,M('basketGreen'));
    bx(G,xi+11.4,xa-0.4,fl[3],fl[3]+5,-4,4.4,M('clear')); bx(G,xi+11.2,xa-0.2,fl[3]+5,fl[3]+5.6,-4.2,4.6,C(0xe8e8e8,.4));
    teddy(G,xi+14.5,fl[3]+5.6,0,0xb8753a,0.45);
    rb(G,7.6,10.6,9,0.7,M('pinkFridge'),xi+4.2,fl[2]+5.3,0.3,3); bx(G,xi+0.3,xi+0.6,fl[2]+4,fl[2]+7.5,4.8,5.3,M('chrome')); cyl(G,1.1,1.1,0.2,M('chrome'),xi+4.2,fl[2]+7.5,4.8);
    teddy(G,xi+13.5,fl[2],0.5,0xc77a35,1.0);
  }
  return G;
}

/* ============================================================ catalog */
const ITEMS = [
  {id:'sofa-green-sectional', name:'Green velvet sectional', room:'Living', build:sofa, photos:[]},
  {id:'sofa-sleeper', name:'Green velvet sleeper sofa', room:'Living', build:sofaSleeper, photos:[],
    params:[{key:'mode',label:'Set up as',type:'select',def:'sofa',options:[['sofa','Sofa'],['bed','Bed (folded out)']]}], note:'3-seat sofa bed, no chaise. Sizes from the maker\'s sheet; same green velvet as the sectional.'},
  {id:'shelves-wood', name:'Brown bookshelf', room:'Living', qty:3, build:shelf, photos:[],
    params:[{key:'variant',label:'Which shelf',type:'select',def:'A',options:[['A','Pair, left one'],['B','Pair, right one'],['C','The single one']]}]},
  {id:'plant-palm', name:'Potted palm', room:'Living', many:true, build:palm, photos:[],
    params:[{key:'height',label:'Plant height',type:'range',min:60,max:108,step:0.5,def:104}]},
  {id:'bed-brass', name:'Brass bed (full)', room:'Bedroom', build:bed, photos:[]},
  {id:'dresser-brown', name:'Brown dresser', room:'Bedroom', build:dresserBrown, photos:[]},
  {id:'vanity-mirror', name:'Hollywood vanity mirror', room:'Bedroom', build:vanityMirror, photos:[], note:'Stands on top of the brown dresser.'},
  {id:'dresser-tall-white', name:'Tall white dresser', room:'Bedroom', build:dresserTallWhite, photos:[]},
  {id:'wardrobe-black', name:'Black wardrobe', room:'Bedroom', build:wardrobeBlack, photos:[]},
  {id:'desk-standing', name:'Standing desk', room:'Office', build:desk, photos:[],
    params:[{key:'height',label:'Desk height',type:'range',min:26,max:47,step:0.25,def:29}]},
  {id:'chair-office', name:'Mesh office chair', room:'Office', build:chairOffice, photos:[]},
  {id:'side-table-white', name:'White side table', room:'Office', build:sideTableWhite, photos:[]},
  {id:'exercise-bike', name:'Echelon exercise bike', room:'Office', build:exerciseBike, photos:[]},
  {id:'dining-table-round', name:'Round oak dining table', room:'Kitchen', build:diningTable, photos:[]},
  {id:'dining-chairs', name:'Oak dining chair', room:'Kitchen', qty:4, build:diningChair, photos:[]},
  {id:'bar-stool', name:'Bar stool (like the listing)', room:'Kitchen', many:true, build:barStool, photos:[], note:'Counter height (seat 66 cm) for the 91 cm peninsula. Modelled on the stools staged in the listing photos; size is typical, not measured.'},
  {id:'kitchenaid-mixer-pink', name:'Pink KitchenAid mixer', room:'Kitchen', build:kitchenAid, photos:[], small:true},
  {id:'smeg-hand-mixer-pink', name:'Pink SMEG hand mixer', room:'Kitchen', build:smegHandMixer, photos:[], small:true},
  {id:'kettle-pink', name:'Pink kettle', room:'Kitchen', build:kettle, photos:[], small:true},
  {id:'dutch-oven-pink', name:'Pink Dutch oven', room:'Kitchen', build:dutchOven, photos:[], small:true},
  {id:'coat-rack', name:'Coat rack with jackets', room:'Entryway', build:coatRack, photos:[]},
  {id:'shoe-rack', name:'Shoe rack with shoes', room:'Entryway', build:shoeRack, photos:[]},
].map(it=>({...it, photos:it.photos.map(p=>p)}));

// a few groupings, to judge items against each other
const SETS = [
  {id:'set-dining', name:'Table + 4 chairs', room:'Sets', photos:[], build:()=>{ const G=new THREE.Group(); G.add(diningTable());
    for(let k=0;k<4;k++){ const a=Math.PI/4+k*Math.PI/2, c=diningChair(); c.position.set(Math.sin(a)*24,0,Math.cos(a)*24); c.rotation.y=a+Math.PI; G.add(c); } return G; }},
  {id:'set-vanity', name:'Dresser + mirror', room:'Sets', photos:[], build:()=>{ const G=new THREE.Group(); G.add(dresserBrown()); const m=vanityMirror(); m.position.set(-3,40,-4.5); G.add(m); return G; }},
  {id:'set-office', name:'Desk, chair, side table', room:'Sets', photos:[], build:()=>{ const G=new THREE.Group(); G.add(desk());
    const c=chairOffice(); c.position.set(6,0,22); c.rotation.y=Math.PI+0.3; G.add(c); const s=sideTableWhite(); s.position.set(-42,0,-5); G.add(s); return G; }},
  {id:'set-shelves', name:'All three shelves', room:'Sets', photos:[], build:()=>{ const G=new THREE.Group();
    ['A','B','C'].forEach((v,i)=>{ const s=shelf({variant:v}); s.position.x=(i-1)*24+(i===2?10:0); G.add(s); }); return G; }},
  {id:'set-counter', name:'Pink kitchen things', room:'Sets', photos:[], build:()=>{ const G=new THREE.Group();
    const a=kitchenAid(); a.position.x=10; G.add(a); const k=kettle(); k.position.set(-4,0,-1); G.add(k); const s=smegHandMixer(); s.position.set(2,0,6); s.rotation.y=0.6; G.add(s); const d=dutchOven(); d.position.set(-18,0,1); G.add(d); return G; }},
];

const ALL = [...ITEMS, ...SETS];
function build(id, opts={}){
  const it=ALL.find(i=>i.id===id); if(!it) throw new Error('unknown item '+id);
  const o={}; (it.params||[]).forEach(p=>o[p.key]=opts[p.key]??p.def);
  const g=it.build(o); g.name=id; g.userData.furniture=id; return g;
}
return { ITEMS, SETS, ALL, build };
};
