/* The scenery is built in world coordinates, shaded, then typeset into glyphs. */
const Art = (() => {
  const project = (x,y,z=0) => [x-.77*y, .275*x+.58*y-z];
  const canvas = (w,h) => Object.assign(document.createElement('canvas'),{width:Math.ceil(w),height:Math.ceil(h)});
  function random(seed) {
    return () => { seed=(Math.imul(seed,1664525)+1013904223)>>>0; return seed/4294967296; };
  }
  function noise(x,y) {
    let v=Math.imul(x+31,374761393)+Math.imul(y+17,668265263);
    v=Math.imul(v^(v>>>13),1274126177);return ((v^(v>>>16))>>>0)/4294967296;
  }
  function rgb(r,g,b){return 'rgb('+Math.round(r)+','+Math.round(g)+','+Math.round(b)+')';}
  function poly(c,points,fill) {
    c.fillStyle=fill;c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fill();
  }
  function line(c,a,b,color,w=1) {
    c.strokeStyle=color;c.lineWidth=w;c.beginPath();c.moveTo(...a);c.lineTo(...b);c.stroke();
  }
  function oval(c,x,y,rx,ry,color,angle=0) {
    c.fillStyle=color;c.beginPath();c.ellipse(x,y,rx,ry,angle,0,Math.PI*2);c.fill();
  }
  const face=(c,points,color)=>poly(c,points.map(p=>project(...p)),color);
  const edge=(c,a,b,color,w=1)=>line(c,project(...a),project(...b),color,w);
  function box(c,x,y,z,w,d,h,front,side,top) {
    face(c,[[x,y+d,z],[x+w,y+d,z],[x+w,y+d,z+h],[x,y+d,z+h]],front);
    face(c,[[x+w,y+d,z],[x+w,y,z],[x+w,y,z+h],[x+w,y+d,z+h]],side);
    face(c,[[x,y,z+h],[x+w,y,z+h],[x+w,y+d,z+h],[x,y+d,z+h]],top);
  }
  function glyphSprite(bounds,cell,paint,kind='stone') {
    const [left,top,w,h]=bounds;
    const scale=2/cell;
    const src=canvas(w*scale,h*scale),c=src.getContext('2d',{willReadFrequently:true});
    c.setTransform(scale,0,0,scale,-left*scale,-top*scale);paint(c);
    c.setTransform(1,0,0,1,0,0);
    const data=c.getImageData(0,0,src.width,src.height).data;
    const img=canvas(src.width,src.height),g=img.getContext('2d');
    g.drawImage(src,0,0);g.globalCompositeOperation='source-atop';g.fillStyle=kind==='cloth'?'rgba(3,5,9,.68)':'rgba(3,5,9,.80)';g.fillRect(0,0,img.width,img.height);g.globalCompositeOperation='source-over';
    // A larger atlas preserves the holes and strokes when the player zooms in.
    const sheets=Object.create(null), alphabet=kind==='ground'?'.,:;~-+<>=%':'.,:;!i|/txzjfooahHNM@';
    const cw=6,ch=10,cols=Math.ceil(src.width/2),rows=Math.ceil(src.height/3.35);
    const ink=canvas(cols*cw,rows*ch),ctx=ink.getContext('2d');
    const codes=new Uint8Array(cols*rows),colours=new Uint32Array(codes.length);
    const base=img;ctx.drawImage(base,0,0,ink.width,ink.height);
    function atlas(r,g,b,letters) {
      const key=letters+((r<<16)|(g<<8)|b);
      if(sheets[key])return sheets[key];
      const tile=canvas(letters.length*cw,ch),t=tile.getContext('2d');
      t.font='bold 10px Consolas, monospace';t.textBaseline='top';t.fillStyle=rgb(r,g,b);
      for(let i=0;i<letters.length;i++)t.fillText(letters[i],i*cw,-1,cw);
      sheets[key]=tile;return tile;
    }
    for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){
      const x=Math.min(src.width-1,2*col+1),y=Math.min(src.height-1,Math.floor(row*3.35+1.5)),i=(y*src.width+x)*4;
      if(data[i+3]<90)continue;
      const n=noise(col,row),v=(.27*data[i]+.55*data[i+1]+.18*data[i+2])/255;
      const before=Math.max(0,i-8),above=Math.max(0,i-src.width*4*3);
      const bevel=Math.max(-.22,Math.min(.32,(data[i+1]-(data[before+1]+data[above+1])*.5)/80));
      const grass=kind==='ground' && data[i+1]>data[i]+2 && data[i+1]>=data[i+2];
      const warm=data[i]>data[i+2]*1.4;
      const factor=(grass?1.58:kind==='ground'?1.76:1.56)*(.76+n*.48+bevel);
      const quant=k=>Math.max(0,Math.min(255,Math.round(data[i+k]*factor/8)*8));
      const letters=grass?" .,:'/|i!vY":warm?" .:itfEJH#@":alphabet;
      const tile=atlas(quant(0),quant(1),quant(2),letters);
      const gi=Math.min(letters.length-1,Math.max(0,Math.floor((Math.sqrt(v)*.84+n*.38-.09+bevel*.35)*letters.length)));
      codes[row*cols+col]=letters.charCodeAt(gi);
      colours[row*cols+col]=(quant(0)<<16)|(quant(1)<<8)|quant(2);
      ctx.drawImage(tile,gi*cw,0,cw,ch,col*cw,row*ch,cw,ch);
    }
    const levels=[ink];
    while(levels.at(-1).width>180 && levels.at(-1).height>100){
      const large=levels.at(-1),small=canvas(large.width/2,large.height/2);
      const preview=small.getContext('2d');preview.imageSmoothingQuality='high';
      preview.drawImage(large,0,0,small.width,small.height);levels.push(small);
    }
    return {levels,left,top,w,h,cols,rows,codes,colours,base,tiles:new Map()};
  }
  // Re-typeset only visible patches when a ground character spans several
  // screen pixels. This preserves distinct slashes, counters and serifs in close-up.
  function detailPatch(s,col,row){
    const key=row*s.cols+col;
    if(s.tiles.has(key))return s.tiles.get(key);
    const nx=Math.min(16,s.cols-col),ny=Math.min(16,s.rows-row),cw=18,ch=30;
    const tile=canvas(nx*cw,ny*ch),g=tile.getContext('2d');
    g.drawImage(s.base,col/s.cols*s.base.width,row/s.rows*s.base.height,
      nx/s.cols*s.base.width,ny/s.rows*s.base.height,0,0,tile.width,tile.height);
    g.font='bold 29px Consolas, monospace';g.textBaseline='alphabetic';
    for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){
      const idx=(row+j)*s.cols+col+i;
      if(!s.codes[idx])continue;
      g.fillStyle='#'+s.colours[idx].toString(16).padStart(6,'0');
      g.fillText(String.fromCharCode(s.codes[idx]),i*cw,j*ch+23.5,cw);
    }
    if(s.tiles.size>=96)s.tiles.delete(s.tiles.keys().next().value);
    s.tiles.set(key,tile);return tile;
  }
  function draw(c,s,x=0,y=0){
    const transform=c.getTransform(),pixelWidth=s.w*transform.a;
    if(s.tiles && pixelWidth/s.cols>8){
      const ox=x+s.left,oy=y+s.top,cw=s.w/s.cols,ch=s.h/s.rows;
      const col0=Math.max(0,Math.floor((-transform.e/transform.a-ox)/(16*cw))*16);
      const row0=Math.max(0,Math.floor((-transform.f/transform.d-oy)/(16*ch))*16);
      const col1=Math.min(s.cols,Math.ceil(((c.canvas.width-transform.e)/transform.a-ox)/cw));
      const row1=Math.min(s.rows,Math.ceil(((c.canvas.height-transform.f)/transform.d-oy)/ch));
      for(let row=row0;row<row1;row+=16)for(let col=col0;col<col1;col+=16){
        const tile=detailPatch(s,col,row);
        c.drawImage(tile,ox+col*cw,oy+row*ch,Math.min(16,s.cols-col)*cw,Math.min(16,s.rows-row)*ch);
      }
      return;
    }
    let level=0;
    while(level+1<s.levels.length && s.levels[level+1].width>=pixelWidth)level++;
    c.drawImage(s.levels[level],x+s.left,y+s.top,s.w,s.h);
  }
  function arch(c,x,width,height,base,y,fill){
    const pts=[[x-width/2,y,base],[x-width/2,y,base+height-width*.74]];
    for(let i=0;i<=12;i++){
      const t=i/12;pts.push([x+(t-.5)*width,y,base+height-width*.74*(1-Math.sin(t*Math.PI)**.8)]);
    }
    pts.push([x+width/2,y,base]);face(c,pts,fill);
  }
  const doorX=0,bridgeXs=[-455,355,1120],riverY=x=>410+24*Math.sin(x/248);
  function gatehouse(){
    return glyphSprite([-287,-382,665,470],1.32,c=>{
      const timber='#9c4a35',red='#b96243',dark='#49302e',gold='#d1a369';
      function roof(x,y,width,depth,z,rise){
        const ridge=y-depth*.53;
        const eave=u=>z+19*(Math.abs(2*u-1)**4);
        const pos=(u,v)=>[x+u*width+(u-.5)*(-28)*v,y+(ridge-y)*v,eave(u)+rise*(v**1.5)];
        for(let i=0;i<44;i++)for(let j=0;j<9;j++){
          const u=i/44,v=j/9,k=41+14*v+noise(i,j)*21;
          face(c,[pos(u,v),pos((i+1)/44,v),pos((i+1)/44,(j+1)/9),pos(u,(j+1)/9)],rgb(k*.82,k*1.04,k*1.14));
          edge(c,pos(u,v),pos(u,(j+1)/9),'#7e9091',1.5);
        }
        for(let i=0;i<44;i++){
          edge(c,pos(i/44,0),pos((i+1)/44,0),'#d0a26a',3.5);
          edge(c,pos(i/44,1),pos((i+1)/44,1),'#aba99d',3.0);
        }
        face(c,[pos(1,0),pos(1,1),[x+width,y-depth,z+16]],'#524b4e');
        edge(c,pos(1,1),[x+width,y-depth,z+16],'#88857a',2.5);
      }
      // An open timber landing, suspended gong and a second storey with paper screens.
      box(c,-193,-104,0,386,116,10,'#716565','#4c474d','#938477');
      for(let j=0;j<3;j++)box(c,-54,11+j*6,0,108,7,9-j*3,'#726961','#49484a','#a39984');
      for(const x of [-175,-83,83,175]){
        box(c,x-7,-87,10,14,13,98,dark,'#392a2b',gold);
        box(c,x-9,-1,10,18,13,6,'#887c71','#635851','#a29176');
        box(c,x-6,1,16,12,10,91,red,timber,gold);
        box(c,x-13,0,94,26,15,8,timber,dark,gold);
      }
      box(c,-192,-7,103,384,20,13,timber,dark,'#bf7955');
      for(const x of [-143,116]){
        box(c,x,-54,19,53,6,71,'#b58f67','#6c4c3e','#a4704d');
        for(let i=0;i<6;i++)edge(c,[x+i*10,-47,20],[x+i*10,-47,89],dark,2.1);
        for(let i=0;i<7;i++)edge(c,[x,-47,22+i*10],[x+53,-47,22+i*10],dark,1.8);
      }
      const [gx,gy]=project(doorX,-7,63);
      edge(c,[-19,-6,100],[-10,-6,83],'#998563',2);edge(c,[19,-6,100],[10,-6,83],'#998563',2);
      oval(c,gx,gy,24,26,'#7b6552',.22);oval(c,gx,gy,21,23,'#ccb079',.22);oval(c,gx,gy,17,19,'#85734f',.22);oval(c,gx,gy,7,8,'#d6b681');
      roof(-228,27,456,169,119,54);
      box(c,-123,-103,158,246,82,49,'#bd936a','#87654a','#aa815b');
      for(let x=-120;x<123;x+=15)box(c,x,-25,160,4,5,47,timber,dark,gold);
      for(const z of [167,183,201])edge(c,[-124,-18,z],[124,-18,z],timber,3.2);
      roof(-162,-3,324,132,211,49);
      for(const x of [-166,-82,82,166]){
        const [lx,ly]=project(x,15,78);
        edge(c,[x,15,102],[x,15,85],gold,1.2);
        oval(c,lx,ly,7,10,'#ffb26e');for(let i=-6;i<=6;i+=4)line(c,[lx-5,ly+i],[lx+5,ly+i+1],'#bd6951',1);
        line(c,[lx,ly+9],[lx,ly+17],red,1.5);
      }
      for(const x of [-64,42]){
        face(c,[[x,14,103],[x+21,14,103],[x+19,15,81],[x+9,15,84],[x,14,80]],'#50697e');
        edge(c,[x+4,15,99],[x+15,15,88],gold,1.6);
      }
    });
  }
  function stall(color){
    return glyphSprite([-42,-100,116,120],1.55,c=>{
      for(const x of [-28,28])for(const y of [-27,2])box(c,x-2,y-2,0,4,4,54,'#896447','#4b3940','#aa8764');
      box(c,-30,-24,15,60,28,5,'#896d52','#5d4942','#ba9b73');
      for(let i=0;i<9;i++){
        const x=-36+i*8;
        face(c,[[x,-32,63],[x+8,-32,63],[x+8,10,47],[x,10,47]],i%3?color:'#a89571');
        face(c,[[x,10,47],[x+8,10,47],[x+8,10,41],[x+2,10,39]],i%3?color:'#aa9372');
      }
      for(let i=0;i<6;i++)box(c,-24+i*8,-13,20,6,12,4+(i%3)*2,i%2?'#918eaa':color,'#68534e','#bc9b7d');
    });
  }
  function kiln(){
    return glyphSprite([-43,-98,92,118],1.5,c=>{
      oval(c,0,0,36,11,'#766258');oval(c,0,-14,33,25,'#a66e50');
      box(c,6,-16,22,10,12,42,'#996748','#674d43','#a88361');
      for(let j=0;j<4;j++)line(c,[-29+j,-3-j*7],[24-j,-3-j*7],'#855c4f',1.5);
      oval(c,0,-7,12,12,'#3e3031');oval(c,0,-5,8,7,'#ee9a53');
    });
  }
  function meadow(){
    return glyphSprite([0,0,288,216],3.5,c=>{
      const rand=random(569);
      c.fillStyle='#26332f';c.fillRect(0,0,288,216);
      for(let i=0;i<3700;i++){
        const x=rand()*288,y=rand()*216,k=23+rand()*54;
        line(c,[x,y],[x+rand()*4-2,y-2-rand()*5],rgb(k*.88,k*1.11,k*.98),1+rand()*1.6);
      }
    },'ground');
  }
  function riverSection(start){
    const width=200,bank=riverY(start),[px,py]=project(start,bank);
    return glyphSprite([-70,-58,340,180],2.7,c=>{
      c.translate(-px,-py);
      for(let i=0;i<20;i++){
        const a=start+i*10,b=a+10,ya=riverY(a),yb=riverY(b);
        for(const [half,col] of [[43,'#776d52'],[39,'#395053'],[33,'#244147']])
          face(c,[[a,ya-half,0],[b,yb-half,0],[b,yb+half,0],[a,ya+half,0]],col);
        const rand=random((a+4500)*751);
        for(let j=0;j<14;j++){
          const x=a+rand()*10,y=riverY(x)+(rand()-.5)*65;
          edge(c,[x,y,0],[x+rand()*9+2,y,0],j%4?'#486063':'#7a8d80',1.1);
        }
      }
    },'ground');
  }
  function bridge(){
    return glyphSprite([-82,-47,167,108],1.4,c=>{
      for(let j=0;j<18;j++){
        const y=-53+j*6,k=89+noise(j,4)*34;
        box(c,-23,y,0,46,5.8,2,rgb(k,k*.82,k*.67),'#54483e',rgb(k,k*.86,k*.72));
      }
      for(const x of [-24,24]){
        for(const y of [-51,0,51])box(c,x-1.6,y,0,3.2,3,15,'#8e7960','#57483c','#b39c7c');
        edge(c,[x,-51,13],[x,52,13],'#b29572',2);
      }
    });
  }
  function tree(seed,size){
    const rand=random(seed);
    return glyphSprite([-size*.64,-size*1.43,size*1.28,size*1.48],2,c=>{
      const s=size;
      poly(c,[[-.09*s,0],[-.045*s,-s*.42],[-.16*s,-s*.77],[-.035*s,-s*.69],[0,-s*1.1],[.065*s,-s*.66],[.105*s,-s*.9],[.14*s,-s*.83],[.06*s,-s*.44],[.035*s,-s*.08],[.13*s,0]],'#554b48');
      line(c,[-s*.02,-s*.04],[s*.015,-s*.75],'#8b7762',2);
      const clusters=[];
      for(let i=0;i<100;i++){let a=rand()*6.283,r=Math.sqrt(rand());clusters.push([Math.cos(a)*r*s*.43,-s*.93+Math.sin(a)*r*s*.31,s*(.075+rand()*.11)]);}
      clusters.sort((a,b)=>a[1]-b[1]);
      for(const [x,y,r] of clusters){
        oval(c,x,y,r,r*.88,'#283e3c');
        for(let i=0;i<30;i++){
          const a=rand()*6.283,rr=Math.sqrt(rand()),dx=Math.cos(a)*rr,dy=Math.sin(a)*rr;
          const k=25+Math.max(0,(-dx-dy)*.6)*85+rand()*33;
          oval(c,x+dx*r,y+dy*r*.85,1+rand()*3.5,1+rand()*2.5,rgb(k*.78,k*1.25,k*1.17));
        }
      }
    });
  }
  function ground(){
    const rand=random(151);
    return glyphSprite([-808,-193,1485,610],3.5,c=>{
      face(c,[[-620,-8,0],[565,-8,0],[565,188,0],[-620,188,0]],'#504b51');
      for(let row=0;row<20;row++)for(let x=-624-(row%2)*11;x<565;x+=22){
        const l=Math.max(-620,x),r=Math.min(565,x+21);if(r<=l)continue;
        const y=row*10-8,k=42+rand()*25;
        face(c,[[l,y,0],[r,y,0],[r,y+9,0],[l,y+9,0]],rgb(k,k*.93,k*1.06));
        if(rand()>.72)edge(c,[l,y,0],[r,y,0],'#827780',1.1);
      }
      // Pools of window light break across individual paving stones.
      c.save();c.globalCompositeOperation='screen';
      for(const wx of [-166,-82,82,166]){
        for(let j=0;j<135;j++){
          const y=rand()*86,x=wx+(rand()-.5)*(38+y*.65)+y*.19;
          c.globalAlpha=(1-y/90)*(.09+rand()*.21);
          edge(c,[x,y,.2],[x+3+rand()*8,y,.2],'#ca966f',1.6+rand()*1.5);
        }
      }
      c.restore();
      for(const [x,y] of [[-34,202],[375,207],[328,238],[300,271],[277,299]]){
        const p=project(x,y);oval(c,...p,17,4,'#5f5b58',.2);
      }
      for(let i=0;i<360;i++){
        let x=rand()*1200-560,y=195+rand()*150,p=project(x,y),k=46+rand()*40;
        for(let j=0;j<4;j++)line(c,p,[p[0]+rand()*6-3,p[1]-rand()*7],rgb(k,k*.94,k*.76),1.4);
      }
    },'ground');
  }
  function fence(span){
    return glyphSprite([-4,-30,span+10,span*.275+36],1.35,c=>{
      for(const z of [8,17]){edge(c,[0,0,z],[span,0,z],'#77738e',3);edge(c,[0,0,z+1.5],[span,0,z+1.5],'#aba0ae',1);}
      for(let x=3;x<span;x+=8){edge(c,[x,0,3],[x,0,18],'#655f78',1.5);}
      for(const x of [0,span]){
        box(c,x-2,-2,0,4,4,23,'#9990a3','#4f4e63','#c9b8ab');
        const p=project(x,0,26);poly(c,[[p[0],p[1]-3],[p[0]+3,p[1]],[p[0],p[1]+3],[p[0]-3,p[1]]],'#d1ad74');
      }
    });
  }
  function stone(seed){
    const rand=random(seed),w=11+rand()*8,h=18+rand()*10;
    return glyphSprite([-20,-40,46,51],1.5,c=>{
      box(c,-w/2-3,-4,0,w+6,9,4,'#565a60','#32343c','#6d7071');
      arch(c,0,w,h,3,0,'#727579');arch(c,0,w-4,h-4,5,1,'#55585d');
      for(let i=0;i<3;i++)edge(c,[-w*.3,2,10+i*3],[w*.3,2,10+i*3],'#99918a',1);
    });
  }
  function brazier(){
    return glyphSprite([-17,-31,34,36],.95,c=>{
      oval(c,0,0,12,4,'#575458');for(const x of [-7,7])line(c,[x,0],[x*.55,-14],'#928171',2.8);
      poly(c,[[-12,-19],[12,-19],[8,-12],[0,-9],[-8,-12]],'#8e7868');oval(c,0,-19,12,4,'#c39e74');oval(c,0,-19,9,2.4,'#382e33');
      for(let x=-6;x<=6;x+=4)line(c,[x,-19],[x+3,-23],'#c18a5d',2);
    });
  }
  function wreck(){
    return glyphSprite([-85,-91,165,121],1.1,c=>{
      const hull=[[-68,0,12],[-44,13,3],[30,15,3],[65,0,14],[38,-13,8],[-34,-14,8]];
      face(c,hull,'#95795b');
      face(c,[hull[0],hull[1],hull[2],hull[3],[34,13,19],[-36,14,18]],'#a06446');
      for(let x=-43;x<=36;x+=11){
        edge(c,[x,-11,9],[x-2,1,4],'#302e30',2.8);
        edge(c,[x-2,1,4],[x,13,18],'#bea47c',2.6);
      }
      for(const h of [5,10,15])edge(c,[-37,14,h],[34,15,h+1],'#d19b68',1);
      edge(c,[-12,0,5],[-29,0,69],'#c09564',4);
      face(c,[[-28,0,64],[13,0,34],[2,0,32],[-2,0,26],[-9,0,33],[-14,0,29]],'#aab2aa');
      edge(c,[-29,0,69],[57,0,14],'#a49d83',1.4);
      for(const x of [-71,66])box(c,x,-3,0,5,6,20,'#8d7660','#504541','#b89d73');
    });
  }
  function sluice(){
    return glyphSprite([-81,-109,168,138],1.12,c=>{
      for(const x of [-45,35]){
        box(c,x,-17,0,12,26,52,'#687571','#444c50','#a59e8b');
        for(let z=8;z<52;z+=9)edge(c,[x,9,z],[x+12,9,z],'#a0a397',1.4);
      }
      for(let i=0;i<7;i++)box(c,-33+i*10,-6,0,9,8,36,'#826345','#574c42','#b39976');
      for(const z of [9,27,48])box(c,-47,-6,z,95,9,5,'#a28162','#524a47','#d0b18b');
      for(const x of [-36,38])edge(c,[x,1,50],[x,1,71],'#95876d',3);
      edge(c,[-40,1,69],[45,1,69],'#c39f73',5);
      const [x,y]=project(16,13,34);
      for(let i=0;i<12;i++){
        const a=i*Math.PI/6,b=a+Math.PI/6;
        const rim=angle=>[x+Math.cos(angle)*20,y+Math.sin(angle)*22];
        line(c,[x,y],rim(a),'#b9a783',2);line(c,rim(a),rim(b),'#c6b493',4);
      }
      oval(c,x,y,4,4,'#6e5548');
    });
  }
  function ferry(){
    return glyphSprite([-54,-62,110,82],1,c=>{
      face(c,[[-47,0,12],[-31,-12,9],[27,-12,9],[48,0,14],[30,12,9],[-33,12,9]],'#b69b76');
      face(c,[[-47,0,12],[-33,12,9],[30,12,9],[48,0,14],[33,10,1],[-28,10,1]],'#845744');
      for(const x of [-25,-8,10])box(c,x,-9,8,4,18,3,'#947b69','#67534a','#d8b68b');
      for(const x of [-23,2,17]){
        const [px,py]=project(x,0,13);
        oval(c,px,py,3.7,5.6,'#616777');
        oval(c,px,py-6.5,2.7,2.8,'#cfab84');
        line(c,[px-4,py-8],[px+4,py-8],'#c6a67c',1.8);
      }
      edge(c,[35,0,9],[35,0,35],'#a08269',2);
      const [lx,ly]=project(35,0,28);oval(c,lx,ly,3.5,5,'#ffba70');
      edge(c,[-26,4,19],[-45,16,0],'#c7ab80',2);
    });
  }
  function beacon(){
    return glyphSprite([-56,-143,115,161],1.15,c=>{
      box(c,-25,-19,0,50,35,8,'#7b7977','#525660','#a7a090');
      for(const x of [-18,15])for(const y of [-13,9])
        box(c,x,y,8,5,5,72,'#b68c63','#755951','#d6b08a');
      for(const z of [12,42]){
        edge(c,[-16,13,z],[17,13,z+31],'#a08263',3);
        edge(c,[17,13,z],[-16,13,z+31],'#826857',3);
      }
      for(let z=12;z<78;z+=7)edge(c,[1,15,z],[10,15,z],'#c4b192',1.5);
      for(const x of [1,10])edge(c,[x,15,8],[x,15,79],'#aba08a',1.8);
      box(c,-22,-17,77,44,33,5,'#aa8e6a','#756256','#dcc098');
      box(c,-11,-8,82,22,16,18,'#667e80','#48585e','#c2bfa2');
      for(const x of [-11,-4,4,11])edge(c,[x,8,82],[x,8,101],'#b6a48a',1.8);
      for(const [a,b] of [[[-22,14,101],[22,14,101]],[[22,14,101],[22,-14,101]]])
        face(c,[a,b,[0,0,119]],a[1]===b[1]?'#737d79':'#505c63');
      edge(c,[0,0,118],[0,0,128],'#d7b381',2);
    });
  }
  function waysideShrine(){
    return glyphSprite([-36,-64,79,80],1,c=>{
      box(c,-18,-10,0,36,20,6,'#827c77','#525558','#b3a892');
      box(c,-12,-7,6,24,13,25,'#a35f4b','#69473f','#ba8e68');
      face(c,[[-18,11,32],[18,11,32],[0,-3,47]],'#738988');
      box(c,-7,7,12,14,2,12,'#c6b380','#655e54','#ccb08a');
      for(const x of [-5,0,5])edge(c,[x,10,13],[x,10,23],'#705748',1.2);
    });
  }
  function mailbag(){
    return glyphSprite([-16,-26,38,37],.8,c=>{
      box(c,-9,-6,0,18,12,4,'#846d58','#514846','#ad9979');
      box(c,-6,-4,4,12,8,9,'#ad8059','#785849','#d9ba8e');
      face(c,[[-6,5,13],[6,5,13],[1,5,8]],'#ded1aa');
      edge(c,[0,5,9],[2,5,9],'#b54e39',2);
    });
  }
  function reeds(){
    const rng=random(528);
    return glyphSprite([-19,-31,44,42],1.15,c=>{
      for(let i=0;i<38;i++){
        const x=rng()*26-13,y=rng()*7,z=8+rng()*22,bend=rng()*6;
        line(c,[x,y],[x+bend,y-z],i%3?'#83885e':'#a8a073',1.25);
        if(i%3===0)line(c,[x+bend,y-z],[x+bend+1,y-z-4],'#c9a579',2.2);
      }
    });
  }
  function saltPan(){
    const rng=random(863);
    return glyphSprite([-21,-4,80,39],1.4,c=>{
      box(c,0,0,0,54,23,2,'#8f8a75','#67685d','#566e72');
      for(let i=0;i<140;i++){
        const u=rng(),v=rng(),x=u*51+1,y=v*20+1;
        const crust=Math.min(u,v,1-u,1-v)<.16;
        edge(c,[x,y,2],[x+(crust?2.8:1.5),y,2],crust?'#c2c3ac':'#77908c',1);
      }
    },'ground');
  }
  function dockBoards(){
    return glyphSprite([-51,-4,121,63],1.55,c=>{
      for(let j=0;j<14;j++){
        const y=j*4,k=84+noise(j,17)*30;
        box(c,0,y,0,63,3.85,2,'#6a584d','#554743',rgb(k,k*.84,k*.7));
        for(const x of [4,57])edge(c,[x,y+1,2],[x+1,y+1,2],'#363a39',1.7);
        edge(c,[6+j%5,y+2,2],[19+j*2,y+2,2],'#a08a71',.9);
      }
    },'ground');
  }
  function spillway(){
    const rng=random(46);
    return glyphSprite([-91,-4,128,83],1.7,c=>{
      box(c,0,0,0,25,112,1,'#a99c81','#626b67','#39555a');
      for(let i=0;i<235;i++){
        const x=rng()*23,y=rng()*106;
        edge(c,[x,y,1],[x,y+2+rng()*5,1],i%4?'#537476':'#81958b',1.1);
      }
      for(const x of [0,24])edge(c,[x,0,2],[x,112,2],'#aa9d82',2);
    },'ground');
  }
  function beaconCourt(){
    return glyphSprite([-49,-4,140,66],1.45,c=>{
      for(let j=0;j<7;j++)for(let i=0;i<8;i++){
        const x=i*10+j%2*4,y=j*8,k=68+noise(i,j)*27;
        box(c,x,y,0,9.7,7.75,1,'#55534e','#464b47',rgb(k,k*.99,k*.93));
        if((i+j)%3===0)edge(c,[x+1,y+1,1],[x+6,y+3,1],'#9e9888',.9);
      }
    },'ground');
  }
  return {project,draw,ground,gatehouse,meadow,riverSection,riverY,bridgeXs,bridge,stall,kiln,tree,fence,stone,brazier,wreck,ferry,sluice,beacon,waysideShrine,mailbag,reeds,saltPan,dockBoards,spillway,beaconCourt,pilgrim:Keeper.draw,random,doorX};
})();
