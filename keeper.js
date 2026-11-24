/* A small depth buffer resolves overlapping garment panels, sleeves, brim and blade
   before each visible surface sample is printed as one character. */
const Keeper = (() => {
  const TAU=Math.PI*2, cell=.58, leading=.86, left=-80, top=-103;
  const cols=280, rows=157, cw=7, ch=10;
  const depth=new Float32Array(cols*rows), light=new Float32Array(depth.length);
  const mat=new Uint8Array(depth.length), tex=new Uint32Array(depth.length);
  const canvas=document.createElement('canvas');canvas.width=cols*cw;canvas.height=rows*ch;
  const ink=canvas.getContext('2d');
  const backing=document.createElement('canvas');backing.width=cols;backing.height=rows;
  const bg=backing.getContext('2d'),surface=bg.createImageData(cols,rows);
  const shadow=document.createElement('canvas');shadow.width=cols;shadow.height=rows;
  const sg=shadow.getContext('2d');
  const frame=ink.createImageData(canvas.width,canvas.height);
  const output=new Uint32Array(frame.data.buffer);
  const sprite={left,top,w:cols*cell,h:rows*leading,levels:[canvas],shadow};
  const palettes=[
    // Ink colours run from recessed folds through to moonlit edges.
    ['robe', [20,28,43],[188,210,218],'.:;irsxzZS2HNM@'],
    ['lining',[29,24,35],[157,142,147],'.:;ijtfzZSHM'],
    ['trousers',[19,23,38],[145,155,186],'.:;i|/tzZnNH'],
    ['straw',[35,32,34],[246,238,221],'.:,;/txwWmM#@'],
    ['binding',[29,28,33],[208,197,180],'.:;+szSZ8HX'],
    ['steel',[48,59,72],[252,250,235],'.:!/tYAHMW@'],
    ['brass',[59,39,31],[255,199,117],'.:;xjZ8#@'],
    ['skin',[38,32,38],[183,157,137],'.:;+jxsSHN'],
    ['silk',[53,30,35],[234,167,119],'.:;ifsSZHNM']
  ];
  const atlases=palettes.map(([,lo,hi,letters])=>{
    const a=document.createElement('canvas');a.width=cw*letters.length;a.height=ch*32;
    const g=a.getContext('2d');g.font='bold 11px Consolas, monospace';g.textBaseline='alphabetic';
    for(let i=0;i<32;i++){
      const f=i/31,color=lo.map((k,j)=>Math.round(k+(hi[j]-k)*f));
      const base=6+Math.round(21*f);
      g.fillStyle='rgb('+(base+2)+','+base+','+(base+2)+')';g.fillRect(0,i*ch,a.width,ch);
      g.fillStyle='rgb('+color.join(',')+')';
      for(let j=0;j<letters.length;j++)g.fillText(letters[j],j*cw,i*ch+8.6,cw);
    }
    return {pixels:new Uint32Array(g.getImageData(0,0,a.width,a.height).data.buffer),width:a.width};
  });
  function triangle(a,b,c,material){
    const ax=a[0],ay=a[1],ux=b[0]-ax,uy=b[1]-ay,vx=c[0]-ax,vy=c[1]-ay;
    const area=ux*vy-uy*vx;if(Math.abs(area)<.0001)return;
    const x0=Math.max(0,Math.ceil(Math.min(ax,b[0],c[0]))),x1=Math.min(cols-1,Math.floor(Math.max(ax,b[0],c[0])));
    const y0=Math.max(0,Math.ceil(Math.min(ay,b[1],c[1]))),y1=Math.min(rows-1,Math.floor(Math.max(ay,b[1],c[1])));
    for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
      const u=((x-ax)*vy-(y-ay)*vx)/area,v=(ux*(y-ay)-uy*(x-ax))/area;
      if(u<-.0001||v<-.0001||u+v>1.0001)continue;
      const idx=y*cols+x,z=a[2]+u*(b[2]-a[2])+v*(c[2]-a[2]);
      if(z<depth[idx])continue;
      depth[idx]=z;mat[idx]=material;light[idx]=a[3]+u*(b[3]-a[3])+v*(c[3]-a[3]);
      const s=Math.floor(a[4]+u*(b[4]-a[4])+v*(c[4]-a[4]));
      const t=Math.floor(a[5]+u*(b[5]-a[5])+v*(c[5]-a[5]));
      tex[idx]=Math.imul(s+97,2246822519)^Math.imul(t+41,3266489917);
    }
  }
  function sheet(across,down,vertex,material){
    let last;
    for(let j=0;j<=down;j++){
      const row=[];
      for(let i=0;i<=across;i++){
        row.push(vertex(i/across,j/down));
        if(i&&j){
          triangle(last[i-1],last[i],row[i],material);
          triangle(last[i-1],row[i],row[i-1],material);
        }
      }
      last=row;
    }
  }
  const clamp=v=>Math.max(0,Math.min(1,v));
  function motion(){return Array.from({length:5},()=>({x:0,d:0,vx:0,vd:0}));}
  // Successive rows of fabric inherit the displaced row above. The collar is
  // fixed and the last row carries momentum when the keeper brakes or turns.
  function advance(chain,dt,time,vx,vd){
    const steps=Math.max(1,Math.ceil(dt/.012)),h=dt/steps;
    for(let j=0;j<steps;j++)for(let i=0;i<chain.length;i++){
      const c=chain[i],parent=chain[i-1],phase=time*2.8-i*.52;
      const gust=.58+.5*Math.sin(time*.89);
      const tx=(parent?.x||0)*.73+(.85+1.12*Math.sin(phase)*gust)-Math.max(-4,Math.min(4,vx/95))*2.8;
      const td=(parent?.d||0)*.73+.65*Math.cos(phase*.91)-Math.max(-4,Math.min(4,vd/95))*2.5;
      c.vx+=(62*(tx-c.x)-10*c.vx)*h;c.vd+=(62*(td-c.d)-10*c.vd)*h;
      c.x+=c.vx*h;c.d+=c.vd*h;
    }
  }
  // Time, blade yaw, blade elevation, body turn and extension. Both cuts
  // return to the same guard so a queued follow-up can start seamlessly.
  const forms={
    slash:[[0,.20,.06,0,0],[.23,-.67,1.00,-.55,.32],[.34,-.76,.96,-.62,.53],[.57,2.82,-.28,.59,1],[.72,3.01,-.33,.72,.94],[1,.20,.06,0,0]],
    counter:[[0,.20,.06,0,0],[.18,2.64,-.36,.56,.52],[.44,-.45,.85,-.58,1],[.58,-.55,1.15,-.50,.78],[.77,2.36,-.54,.76,1],[.89,2.65,-.46,.66,.80],[1,.20,.06,0,0]]
  };
  function bladePose(kind,p){
    const frames=forms[kind]||forms.slash;
    const j=frames.findIndex(k=>k[0]>=p);
    if(j<=0)return frames[0].slice(1);
    const a=frames[j-1],b=frames[j],v=(p-a[0])/(b[0]-a[0]),ease=v*v*(3-2*v);
    return a.slice(1).map((x,i)=>x+(b[i+1]-x)*ease);
  }
  const bladeLength=52,bladeCurve=6.1;
  function grip(turn,extension,lift,gait){
    return [7.7-Math.max(turn,0)*9+extension*1.2,3.0-gait*2.8+extension*8.2,24.8+extension*4.5+Math.max(0,lift-.06)*9];
  }
  function edgePath(angle,phase,kind){
    const [yaw,lift,turn,extension]=bladePose(kind,phase);
    const [s,f,z]=grip(turn,extension,lift,0),a=angle+turn;
    function projected(length,curve){
      const reach=length*Math.cos(lift)-curve*Math.sin(lift);
      const side=s+Math.cos(yaw)*reach,forward=f+Math.sin(yaw)*reach;
      return [side*Math.cos(a)-forward*Math.sin(a),(side*Math.sin(a)+forward*Math.cos(a))*.47-z-length*Math.sin(lift)-curve*Math.cos(lift)];
    }
    return {guard:projected(3.1,0),tip:projected(5.1+bladeLength,bladeCurve+1.03)};
  }
  let lastTime=-1,lastChain=null;
  function draw(angle,stride,swing,time,chain,dash,walking,kind){
    if(chain===lastChain&&time>=lastTime&&time-lastTime<1/34)return sprite;
    lastTime=time;lastChain=chain;depth.fill(-Infinity);
    const [bladeYaw,elevation,turn,extend]=bladePose(kind,swing);
    angle+=turn;
    const ca=Math.cos(angle),sa=Math.sin(angle),gait=walking?Math.sin(stride):0;
    const bob=-extend*2.4+Math.abs(gait)*.85+.17*Math.sin(time*2.1);
    const cos=Math.cos,sin=Math.sin,stitches=[];
    function stitching(p,tangent,letter,tint,size=1){
      stitches.push({p,tangent,letter,tint,size});
    }
    function point(s,f,z,l,u,v,windX=0,windD=0){
      f+=dash*(z/54)*16;z-=dash*(z/54)*10;
      // Feet plant while the upper body carries the cut across the hips.
      if(extend && z<25){
        const untwist=-turn*(1-clamp(z/25)),cc=cos(untwist),ss=sin(untwist);
        [s,f]=[s*cc-f*ss,s*ss+f*cc];s+=Math.sign(s)*extend*1.8;
      }
      const x=s*ca-f*sa+windX,d=s*sa+f*ca+windD;
      return [(x-left)/cell,(d*.47-z-bob-top)/leading,d+.47*z,l,u,v];
    }
    function breeze(q){
      const p=clamp(q)*4,i=Math.floor(p),k=p-i,a=chain[i],b=chain[Math.min(4,i+1)];
      return [(a.x*(1-k)+b.x*k)*q,(a.d*(1-k)+b.d*k)*q];
    }
    function illumination(a,detail=0){
      const n=a+angle;return .49-.39*cos(n)+.13*sin(n)+detail;
    }
    // Closed rings with independent joint centres keep sleeves, calves and
    // headwear in depth order as the body turns through a full circle.
    function rings(profile,material,detail=()=>0,segments=32){
      sheet(segments,profile.length-1,(u,v)=>{
        const a=u*TAU,[z,s,f,rx,ry,glow=0]=profile[Math.round(v*(profile.length-1))];
        return point(s+rx*cos(a),f+ry*sin(a),z,illumination(a,detail(a,v)+glow),u*78,v*39);
      },material);
    }
    for(const sign of [-1,1]){
      const strideF=sign*gait*(walking?5:0),footZ=Math.max(0,sign*gait)*2;
      rings([[.5+footZ,sign*3.1,strideF+2,1.9,3.2],[2+footZ,sign*3.1,strideF+1,2.2,3.1],[4.8+footZ,sign*3.2,strideF,1.7,1.8]],7);
      rings([[3+footZ,sign*3.2,strideF,1.7,1.9],[5,sign*3.4,strideF*.9,2.3,2.2],[8,sign*3.7,strideF*.75,2.7,2.4],[14,sign*3.4,strideF*.45,3.4,3.3],[24,sign*2.6,0,3.4,3.7]],2,(a,v)=>.15*cos(a*6+v*4));
    }
    // Continuous warp over an open front. Each pleat has a lit ridge and
    // a recessed valley, and the embroidered border follows the moving hem.
    for(const sign of [-1,1]){
      sheet(35,25,(u,q)=>{
        const a=Math.PI/2+sign*(.13+u*(Math.PI-.12));
        const fold=cos(a*8+.7*sin(q*5)+.5*gait*q+q*.8*Math.sin(time*2.2));
        const taper=1.1*Math.sin(q*Math.PI),width=5.8+q*3.2+taper+fold*q*.78;
        const w=breeze(q*q),flap=q*q*(1.2*sin(a*3-time*3)+.8*gait);
        const lift=Math.min(8,Math.hypot(...w)*.37)*q*q;
        const z=28-22*q+flap+lift+q*q*Math.cos(a*2)*.9;
        const border=q>.88?.17*Math.cos((q-.88)*95):0;
        const wrap=sin(q*42+1.25*cos(a-.6)+q*1.45*fold);
        const ridge=Math.max(0,wrap)**3,crease=Math.max(0,-wrap)**2;
        const shade=illumination(a,.28*fold+.29*ridge-.20*crease+border-.03*q);
        const p=point(cos(a)*width,sin(a)*(4.7+q*2+.55*fold)+gait*q*.7,z,shade,u*47,q*37,...w);
        const row=Math.round(q*25),col=Math.round(u*35);
        if((row===6||row===11||row===16||row===21||row===24)&&sin(a+angle)>.06){
          const tangent=Math.atan2(.47*cos(a+angle),-sin(a+angle));
          const value=Math.round(113+116*clamp(shade));
          stitching(p,tangent,col%3?'s':'Z','rgb('+value+','+(value-4)+','+(value-12)+')',1.18);
        }
        if(q>.69&&q<.97&&sin(a+angle)>.04){
          const wave=(col%8)-4,arc=Math.round(Math.sqrt(Math.max(0,16-wave*wave))*.59);
          if(row===19+arc||row===22+arc)stitching(p,0,col%2?'c':'~','#d9af79',1.15);
        }
        return p;
      },0);
    }
    rings([[25.6,0,0,6.3,5],[29,0,0,5.8,4.7],[32.8,0,0,6.1,4.7],[36,0,0,7.3,4.9],[38.7,0,0,6.9,4.5],[40.5,0,0,3.8,3.3]],0,
      (a,v)=>.18*cos(5*a+v*6)+.15*cos(16*v+4*a)-.22*Math.max(0,(v-.58)*2));
    for(const sign of [-1,1]){
      // Crossed lapels climb the chest into the high collar.
      sheet(5,16,(u,v)=>{
        const a=.8+sign*(v-.42)*1.45+u*.30;
        return point((6.36+.72*v)*cos(a),(5.16-.4*v)*sin(a),28+12*v,.43+.46*u+.12*cos(v*28),u*3,v*30);
      },4);
    }
    rings([[25.1,0,0,6.4,5.3],[25.7,0,0,6.6,5.4],[27.5,0,0,6.45,5.25],[28.2,0,0,6.4,5.2]],4,(a,v)=>.17*cos(18*a+v*14));
    // A braided belt cord wraps over the obi and ties in two raised loops.
    rings([[26.2,0,0,6.62,5.51],[26.9,0,0,6.75,5.55],[27.3,0,0,6.61,5.51]],6,(a,v)=>.25*cos(a*30+v*6));
    for(const sign of [-1,1])sheet(14,4,(u,v)=>{
      const a=u*TAU;return point(1+sign*(1.6+1.7*cos(a)),5.65+v*.5,26.5+sin(a)*1.18+v*.55,.58+.27*cos(a),u*12,v*4);
    },6);
    // Lacquered scabbard at the opposite hip, with a brass cap and cord bands.
    sheet(18,22,(u,v)=>{
      const a=u*TAU,band=v<.07||v>.94;
      return point(-6.4-.82*v+cos(a)*.93,-2-22*v+sin(a)*1.14,25-13*v+.7*v*v,
        band?.89:.26+.11*cos(a)+.12*cos(v*32),u*18,v*38);
    },4);
    // Two independently curling sash ends stream from the knot at the back.
    for(const sign of [-1,1]){
      sheet(4,21,(u,q)=>{
        const w=breeze(q),ripple=sin(q*7-time*3.3+sign*.72);
        const width=(1.65-q*.65)*(u-.5)*2;
        return point(sign*(2.1+q*3.8)+width,-4.8-4*q+q*ripple*1.7,
          27-q*(sign<0?16:21)+2*q*ripple+q*Math.hypot(...w)*.53,
          .58+.25*cos(u*Math.PI+q*9-time*2)+.1*sign,u*7,q*37,w[0]*1.85,w[1]*1.85);
      },8);
    }
    rings([[38.4,0,0,3.7,3.6],[41.8,0,0,3.8,3.8],[45,0,.3,4.1,4.2],[47.4,0,0,3.9,3.8]],7,(a,v)=>v>.48?-.13:0);
    rings([[38.5,0,0,4.3,4.1],[40.2,0,.2,4.1,4.15],[42,0,.3,4.2,4.05]],1,(a,v)=>.16*cos(v*10+a));
    const hand=grip(turn,extend,elevation,gait);
    const tilt=sin(elevation),reach=cos(elevation),ux=cos(bladeYaw),uf=sin(bladeYaw);
    for(const sign of [-1,1]){
      let [handS,handF,handZ]=hand;handZ-=1;
      if(sign<0){
        const join=clamp(extend*2.8);
        handS=(-8.2)*(1-join)+(hand[0]-5.6*reach*ux)*join;
        handF=(2.5+gait*2.8)*(1-join)+(hand[1]-5.6*reach*uf)*join;
        handZ=23.8*(1-join)+(hand[2]-5.6*tilt-1)*join;
      }
      rings([[handZ,handS,handF,1.4,1.6],[handZ+1.8,handS,handF,1.8,1.65],[handZ+3.8,handS,handF,1.45,1.45]],7);
      sheet(24,14,(u,q)=>{
        const a=u*TAU,rad=2.5+.9*sin(q*Math.PI)+q*.5,wrinkle=cos(a*4+q*6+gait);
        const w=breeze(q*q*.42);
        const p=point(sign*6+(handS-sign*6)*q+rad*cos(a)+sign*sin(q*Math.PI)*extend*2.2,
          handF*q+rad*.94*sin(a),37.4+(handZ+2.8-37.4)*q+q*.6*wrinkle,
          illumination(a,.18*wrinkle+.11*cos(28*q+a)),u*31,q*20,...w);
        const row=Math.round(q*14),col=Math.round(u*24);
        if((row===11||row===13||((col+row)%5===0&&row<7))&&sin(a+angle)>.1)
          stitching(p,.18*sign,row>10?'=':'x',row>10?'#e7bd88':'#ced2c3',1.1);
        return p;
      },0);

    }
    const [hs,hf,hz]=hand;

    function sword(length,height,thickness=0){
      const horizontal=length*reach-height*tilt;
      return [hs+ux*horizontal-uf*thickness,hf+uf*horizontal+ux*thickness,hz+length*tilt+height*reach];
    }
    // Diamond-wrap grip, oval guard, brass collar and a single curved edge.
    function fitting(start,end,tall,thick,material,rib){
      sheet(16,12,(u,v)=>{
        const a=u*TAU,f=start+(end-start)*v;
        const binding=rib?.32*cos(a*2+v*34)*cos(a*2-v*34):0;
        return point(...sword(f,tall*cos(a),thick*sin(a)),.54+.23*cos(a)+binding,u*20,v*26);
      },material);
    }
    fitting(-8.2,2.2,1.28,1.02,4,true);fitting(-8.9,-8.1,1.43,1.12,6,false);
    fitting(2.2,3.1,3.9,3.3,6,false);fitting(3.1,5.1,1.35,.65,6,false);
    sheet(6,42,(u,v)=>{
      const curve=bladeCurve*v*v,tip=clamp((v-.89)/.11);
      const width=(3.65-.78*v)*(1-tip);
      const h=curve+(u-.5)*width+tip*1.03;
      const bevel=1-Math.abs(u-.6)/.6;
      const temper=u<.31+.08*sin(v*42)? .36:0;
      return point(...sword(5.1+bladeLength*v,h,.12+.42*bevel),.62+temper+.27*bevel+.11*cos(v*9),u*9,v*80);
    },5);
    const tip=point(...sword(5.1+bladeLength,bladeCurve+1.03),1,0,0),guard=point(...sword(3.1,0),1,0,0);
    sprite.blade={tip:[tip[0]*cell+left,tip[1]*leading+top],guard:[guard[0]*cell+left,guard[1]*leading+top]};
    // Woven rings follow the shallow cone. The raised lip catches a narrow
    // continuous highlight against the black underside.
    rings([[46.5,0,0,.6,.6],[46.65,0,0,10.65,10.4],[47.25,0,0,11,10.8]],1);
    sheet(64,15,(u,v)=>{
      const a=u*TAU,r=11*(1-v)+.3*v;
      return point(r*cos(a),r*.98*sin(a),47.25+5.1*v+.48*v*v,
        .50-.29*cos(a+angle)+.19*cos(38*a+3*v)+.13*cos(v*60)+.08*v,u*90,v*20);
    },3);
    for(let i=0;i<96;i++){
      const a=i*TAU/96,r=11.0;
      const p=point(r*cos(a),r*.98*sin(a),47.54,.9,i,0);
      const tilt=Math.atan2(.47*cos(a+angle),-sin(a+angle));
      stitching(p,tilt,i%4?'x':'W',i%3?'#d6cdc0':'#ece7dc',.96);
    }
    rings([[46.85,0,0,10.85,10.65,.44],[47.45,0,0,11.06,10.86,.78],[47.8,0,0,10.2,10.02,.19]],3);
    // Each opaque body cell masks the larger paving glyphs behind it. A
    // low-resolution copy of the same silhouette also casts the ground shadow.
    const pixels=surface.data;
    for(let i=0;i<depth.length;i++){
      const j=i*4,visible=depth[i]!==-Infinity;pixels[j+3]=visible?255:0;
      if(!visible)continue;
      const level=6+Math.round(21*clamp(light[i]));
      pixels[j]=level+2;pixels[j+1]=level;pixels[j+2]=level+2;
    }
    bg.putImageData(surface,0,0);
    sg.clearRect(0,0,cols,rows);sg.drawImage(backing,0,0);sg.globalCompositeOperation='source-in';
    sg.fillStyle='#07070b';sg.fillRect(0,0,cols,rows);sg.globalCompositeOperation='source-over';
    output.fill(0);
    for(let y=1;y<rows-1;y++)for(let x=1;x<cols-1;x++){
      const i=y*cols+x,z=depth[i];if(z===-Infinity)continue;
      const m=mat[i],letters=palettes[m][3],seed=tex[i]>>>0,noise=(seed%103)/102;
      const rim=depth[i-1]<z-2.8||depth[i-cols]<z-3.2;
      const cavity=depth[i-cols]>z+2.8||depth[i-1]>z+3.5;
      const l=clamp(light[i]+(rim?.18:0)-(cavity?.11:0)+(noise-.5)*.17);
      const index=Math.min(letters.length-1,Math.floor(clamp(.18+l*.57+noise*.28)*letters.length));
      const atlas=atlases[m],source=atlas.pixels;
      let start=Math.round(l*31)*ch*atlas.width+index*cw;
      let dest=y*ch*canvas.width+x*cw;
      for(let j=0;j<ch;j++,start+=atlas.width,dest+=canvas.width){
        for(let k=0;k<cw;k++)output[dest+k]=source[start+k];
      }
    }
    ink.putImageData(frame,0,0);
    // Printed trim is attached to the surface tangent. Depth-test each stitch
    // so the far side of a cuff or brim disappears behind the near side.
    ink.font='bold 11px Consolas, monospace';ink.textAlign='center';ink.textBaseline='middle';
    for(const {p,tangent,letter,tint,size} of stitches){
      const x=Math.round(p[0]),y=Math.round(p[1]);
      if(depth[y*cols+x]>p[2]+1.25)continue;
      const rot=tangent>Math.PI/2?tangent-Math.PI:tangent< -Math.PI/2?tangent+Math.PI:tangent;
      const c=cos(rot)*size,s=sin(rot)*size;
      ink.setTransform(c,s,-s,c,(p[0]+.5)*cw,(p[1]+.5)*ch);ink.fillStyle=tint;ink.fillText(letter,0,0);
    }
    ink.setTransform(1,0,0,1,0,0);
    return sprite;
  }
  return {draw,motion,advance,edgePath};
})();
