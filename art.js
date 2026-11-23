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
  const doorX=106;
  function chapel(){
    const rand=random(43),a=-366,b=265,back=-142,h=125,ridge=220;
    return glyphSprite([-380,-389,775,487],1.38,c=>{
      box(c,a-5,back-4,0,b-a+11,150,9,'#656064','#262431','#68616b');
      box(c,a,back,9,b-a,-back,h-9,'#51515a','#31313e','#42424e');
      // Individually cut stones follow the slant of the facade.
      for(let row=0;row<13;row++)for(let x=a-(row%2)*12;x<b;x+=24){
        const l=Math.max(a,x),r=Math.min(b,x+22);if(l>=r)continue;
        const k=39+rand()*42;face(c,[[l,.2,10+row*9],[r,.2,10+row*9],[r,.2,17.6+row*9],[l,.2,17.6+row*9]],rgb(k,k*.98,k*1.06));
        edge(c,[l+1,.4,17+row*9],[r-1,.4,17+row*9],rgb(k+11,k+10,k+14),.8);
        if(rand()<.25)edge(c,[l+3,.4,16+row*9],[l+7,.4,12+row*9],'#35323c',1.1);
      }
      for(const x of [-305,-206,-107,-8,201]){
        arch(c,x,57,89,18,1,'#252630');arch(c,x,51,85,19,2,'#9c8a78');
        arch(c,x,46,80,21,3,'#201c26');arch(c,x,40,74,24,4,'#df9956');
        for(let j=-16;j<=16;j+=8){
          const height=64+14*Math.cos(j/20*Math.PI/2);
          edge(c,[x+j,5,24],[x+j,5,height+17],'#5d493e',2.5);
        }
        for(let z=34;z<85;z+=11)edge(c,[x-18,5,z],[x+18,5,z],'#8e6550',1.7);
        edge(c,[x,6,24],[x,6,95],'#35313b',3);
        box(c,x-29,0,15,58,6,4,'#77717a','#49454c','#a58e7b');
      }
      arch(c,doorX,66,106,8,1,'#8c7b71');arch(c,doorX,56,99,8,2,'#201f29');
      for(let j=-22;j<=22;j+=6)edge(c,[doorX+j,3,9],[doorX+j,3,92-Math.abs(j)*.7],'#50444a',2);
      for(const z of [30,66])edge(c,[doorX-23,4,z],[doorX+23,4,z],'#756670',3);
      edge(c,[doorX,5,10],[doorX,5,96],'#211f29',2);
      box(c,doorX-37,1,0,74,13,5,'#695f66','#37343c','#928188');
      for(const x of [a,-257,-158,-59,46,159,b-6]){
        box(c,x-4,0,8,8,4,111,'#726b70','#393542','#969097');
        box(c,x-6,2,7,12,7,15,'#625d62','#342f39','#807881');
      }
      // The east gable has its own rose window and tracery.
      face(c,[[b,0,h],[b,back,h],[b,back/2,ridge]],'#454350');
      const [wx,wy]=project(b+1,-71,91);
      oval(c,wx,wy,18,23,'#82776f',.24);oval(c,wx,wy,14,19,'#c88951',.24);
      for(let j=0;j<8;j++){let an=j*Math.PI/4;line(c,[wx,wy],[wx+Math.cos(an)*14,wy+Math.sin(an)*18],'#554347',2);}
      face(c,[[a-10,back/2,ridge],[b+10,back/2,ridge],[b+10,7,h],[a-10,7,h]],'#3a4053');
      for(let row=0;row<15;row++){
        const t=row/15,nt=(row+1)/15,y=back/2+(7-back/2)*t,z=ridge+(h-ridge)*t;
        for(let x=a-10-(row%2)*9;x<b+10;x+=18){
          const l=Math.max(a-10,x),r=Math.min(b+10,x+17);if(l>=r)continue;
          const k=36+rand()*21+12*(1-t);
          face(c,[[l,y,z],[r,y,z],[r,back/2+(7-back/2)*nt,ridge+(h-ridge)*nt+1],[l,back/2+(7-back/2)*nt,ridge+(h-ridge)*nt+1]],rgb(k*.88,k*.98,k*1.26));
        }
      }
      edge(c,[a-10,back/2,ridge],[b+10,back/2,ridge],'#99939a',3);
      edge(c,[a-10,7,h],[b+10,7,h],'#817c84',3);
      edge(c,[b+10,7,h],[b+10,back/2,ridge],'#676c7d',3);
      edge(c,[b+10,back/2,ridge],[b+10,back-3,h],'#494b59',4);
      // A small open belfry rises above the west end.
      const tx=-179,ty=-68,tz=209;
      box(c,tx-17,ty-14,tz,34,28,7,'#686674','#444350','#94909b');
      for(const x of [-13,13])for(const y of [-10,10])edge(c,[tx+x,ty+y,tz+5],[tx+x,ty+y,tz+39],'#91838a',3);
      const [bx,by]=project(tx,ty,tz+20);
      poly(c,[[bx-4,by-7],[bx+4,by-7],[bx+7,by+4],[bx+9,by+6],[bx-9,by+6],[bx-6,by+2]],'#b79b70');
      box(c,tx-17,ty-14,tz+38,34,28,4,'#605e69','#3f3e49','#74717c');
      face(c,[[tx-21,ty+17,tz+42],[tx+21,ty+17,tz+42],[tx,ty,tz+68]],'#737482');
      face(c,[[tx+21,ty+17,tz+42],[tx+21,ty-17,tz+42],[tx,ty,tz+68]],'#454753');
      edge(c,[tx,ty,tz+66],[tx,ty,tz+83],'#b4a18c',2);edge(c,[tx-5,ty,tz+77],[tx+5,ty,tz+77],'#b4a18c',2);
      for(const x of [-347,64,148,252]){
        box(c,x-2,1,53,4,7,5,'#6a5d55','#3c3432','#716251');
        const [sx,sy]=project(x,8,62);poly(c,[[sx-4,sy-7],[sx+4,sy-7],[sx+3,sy+5],[sx-3,sy+5]],'#f7bc79');
        line(c,[sx-5,sy-7],[sx+5,sy-7],'#a78b6e',2);
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
    return glyphSprite([-1130,-710,2290,1450],3.5,c=>{
      c.fillStyle='#232c2d';c.fillRect(-1130,-710,2290,1450);
      for(let i=0;i<114000;i++){
        let x=rand()*2290-1130,y=rand()*1450-710,k=20+rand()*36+7*Math.sin(x/33+y/20);
        line(c,[x,y],[x+rand()*5-2.5,y-2-rand()*5],rgb(k*.94,k*1.06,k*1.04),1.3+rand()*1.8);
      }
      face(c,[[-620,-8,0],[565,-8,0],[565,188,0],[-620,188,0]],'#504b51');
      for(let row=0;row<20;row++)for(let x=-624-(row%2)*11;x<565;x+=22){
        const l=Math.max(-620,x),r=Math.min(565,x+21);if(r<=l)continue;
        const y=row*10-8,k=42+rand()*25;
        face(c,[[l,y,0],[r,y,0],[r,y+9,0],[l,y+9,0]],rgb(k,k*.93,k*1.06));
        if(rand()>.72)edge(c,[l,y,0],[r,y,0],'#827780',1.1);
      }
      // Pools of window light break across individual paving stones.
      c.save();c.globalCompositeOperation='screen';
      for(const wx of [-305,-206,-107,-8,201]){
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
      const [px,py]=project(-130,358);
      oval(c,px,py,144,48,'#444d49',.18);oval(c,px,py,137,44,'#1b282b',.18);
      for(let i=0;i<200;i++){
        const a=rand()*6.283,r=Math.sqrt(rand()),dx=r*Math.cos(a)*123,dy=r*Math.sin(a)*37;
        const x=px+dx,y=py+dy+dx*.17,k=20+rand()*30;
        line(c,[x,y],[x+rand()*12,y],rgb(k*.75,k,k*1.12),1);
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
  return {project,draw,ground,chapel,tree,fence,stone,brazier,pilgrim:Keeper.draw,random,doorX};
})();
