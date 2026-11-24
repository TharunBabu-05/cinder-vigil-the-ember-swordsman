/* Shades move in projected ground space, the same space used by the katana sweep. */
const Shades = (() => {
  const kinds={
    shade:   {name:'Watchfire shade',hp:1,speed:22,ink:'#baa6ad',dark:'#827c8b'},
    stalker: {name:'Reed stalker',hp:2,speed:29,ink:'#d7bc8a',dark:'#a58e65'},
    moth:    {name:'Lantern moth',hp:1,speed:22,ink:'#a9dcdb',dark:'#668e9e'},
    warden:  {name:'Bell warden',hp:5,speed:18,ink:'#f4ba85',dark:'#a67473'}
  };
  function create(kind,x,y,phase,roams=false){
    const spec=kinds[kind];
    return {kind,spec,x,y,homeX:x,homeY:y,phase,roams,hp:spec.hp,spawn:.8,state:'idle',
      timer:0,cooldown:.65,aimX:0,aimY:1,hitStroke:-1,flash:0,spent:false};
  }
  function drift(w,dx,dy,distance){
    const length=Math.hypot(dx,dy);
    if(length<=0)return;
    const scale=Math.min(1,distance/length);w.x+=dx*scale;w.y+=dy*scale;
  }
  function update(w,dt,time,p,bolts,hurt){
    w.flash=Math.max(0,w.flash-dt);
    if(w.spawn>0){w.spawn-=dt;return;}
    w.cooldown=Math.max(0,w.cooldown-dt);
    w.timer=Math.max(0,w.timer-dt);
    const dx=p[0]-w.x,dy=p[1]-w.y,dist=Math.hypot(dx,dy);
    if(w.state==='windup'){
      if(w.timer>0)return;
      w.spent=false;
      if(w.kind==='moth'){
        bolts.push({x:w.x,y:w.y,vx:w.aimX*92,vy:w.aimY*92,life:2});
        w.state='idle';w.cooldown=2.7;
      }else{
        w.state=w.kind==='warden'?'ring':'lunge';
        w.timer=w.kind==='warden'?1:.37;
      }
      return w.kind;
    }
    if(w.state==='ring'||w.state==='lunge'){
      if(w.state==='lunge'){w.x+=w.aimX*168*dt;w.y+=w.aimY*168*dt;}
      const gap=w.state==='ring'?Math.abs(Math.hypot(dx,dy/.74)-(1-w.timer)*85):Math.hypot(p[0]-w.x,p[1]-w.y);
      if(!w.spent&&gap<(w.state==='ring'?6:12)){
        w.spent=true;hurt(w.spec.name);
      }
      if(w.timer===0){w.state='idle';w.cooldown=w.kind==='warden'?1.7:1.35;}
      return;
    }
    if(w.roams&&Math.hypot(p[0]-w.homeX,p[1]-w.homeY)>155){
      const a=w.phase+time*.45;
      drift(w,w.homeX+15*Math.cos(a)-w.x,w.homeY+8*Math.sin(a)-w.y,dt*24);
      return;
    }
    if(w.kind==='shade'){
      drift(w,dx,dy,dt*w.spec.speed);
      if(dist<10&&hurt(w.spec.name)){w.x-=dx/(dist||1)*34;w.y-=dy/(dist||1)*34;}
      return;
    }
    const reach=w.kind==='moth'?132:w.kind==='warden'?69:55;
    if(dist<=reach&&w.cooldown===0){
      w.aimX=dx/(dist||1);w.aimY=dy/(dist||1);
      w.state='windup';w.timer=w.kind==='warden'?.95:w.kind==='moth'?.82:.62;
    }else if(w.kind==='moth'&&dist<59){
      drift(w,-dx,-dy,dt*16);
    }else if(dist>reach*.75){
      drift(w,dx,dy,dt*w.spec.speed);
    }
  }
  function draw(ctx,w,time,glyph,glow){
    const {kind,spec}=w,windup=w.state==='windup',bob=Math.sin(time*3+w.phase)*2;
    ctx.save();ctx.translate(w.x,w.y);
    if(kind==='warden'&&(windup||w.state==='ring')){
      const r=windup?10+6*Math.sin(time*12):(1-w.timer)*85;
      const n=Math.max(12,Math.ceil(r*.9));
      for(let i=0;i<n;i++){
        const a=i*Math.PI*2/n;
        glyph(ctx,i%3?'-':'+',r*Math.cos(a),r*.74*Math.sin(a),'#ffb67f',4.5);
      }
    }else if(windup){
      for(let i=1;i<=8;i++){
        const d=i*(kind==='moth'?13:7);
        glyph(ctx,i%2?'·':'+',w.aimX*d,w.aimY*d-(kind==='moth'?12:1),spec.ink,4);
      }
    }
    ctx.translate(0,-13+bob);
    ctx.globalAlpha=w.spawn>0?.55+.2*Math.sin(time*10):1;
    const light=w.flash>0?'#ffffe8':spec.ink;
    glow(0,-2,kind==='warden'?25:16,light,windup?.38:.17);
    if(kind==='moth'){
      const spread=7+3*Math.cos(time*8);
      for(const side of [-1,1])for(let i=0;i<20;i++){
        const u=(i%5)/4,v=Math.floor(i/5)/3;
        glyph(ctx,'/:+~'[i%4],side*(2+u*spread),-4-5*u+v*(3+5*u),i%3?spec.dark:light,3.6);
      }
      glyph(ctx,'*',-2,0,light,7);
    }else if(kind==='warden'){
      for(let row=0;row<9;row++){
        const half=4+row*.85;
        for(let col=-half;col<=half;col+=2.8){
          const ch=row===8?'#':row===5?'=':col<0?'/':'\\';
          glyph(ctx,ch,col,-15+row*2.3,Math.abs(col)<2||row===5?light:spec.dark,4.9);
        }
      }
      for(let i=-2;i<=2;i++)glyph(ctx,'T',i*2.7-1,-15+Math.abs(i)*.6,light,4.7);
      glyph(ctx,'O',-3,9,'#e6b273',8);
      glyph(ctx,'=',-3,-8,windup?'#fff2b5':'#ffac6b',6);
    }else{
      for(let i=0;i<42;i++){
        const a=i*2.39996,rad=Math.sqrt(i/42);
        const x=Math.cos(a)*rad*(kind==='stalker'?10:7),y=Math.sin(a)*rad*(kind==='stalker'?6:10);
        glyph(ctx,';:/i+'[i%5],x+Math.sin(time*4+i*.3),y,i%3?spec.dark:light,3.7);
      }
      if(kind==='stalker')for(const side of [-1,1])glyph(ctx,'/',side*8,-4,light,7);
      glyph(ctx,'=',-3,-2,windup?'#fff2b5':light,5);
    }
    ctx.restore();
    if(spec.hp>1){
      for(let i=0;i<spec.hp;i++)
        glyph(ctx,'-',w.x+(i-(spec.hp-1)/2)*3-1,w.y-(kind==='warden'?37:28),i<w.hp?spec.ink:'#514b48',5);
    }
  }
  return {create,update,draw};
})();
