(() => {
  'use strict';
  const $=id=>document.getElementById(id),world=$('world'),ctx=world.getContext('2d',{alpha:false}),view=$('view');
  const {project}=Art,rand=Art.random(782),tau=Math.PI*2;
  const ground=Art.ground(),chapel=Art.chapel(),bowl=Art.brazier();
  const trees=[Art.tree(55,112),Art.tree(22,88),Art.tree(87,158)],stones=[1,2,3].map(Art.stone);
  const props=[],obstacles=[],rails=[],flames=[
    {x:-199,y:125,name:'West watchfire'}, {x:341,y:73,name:'East watchfire'}, {x:207,y:266,name:'Garden watchfire'}
  ];
  const post=(x,y,sprite,type='scenery')=>props.push({x,y,sprite,type});
  post(0,0,chapel,'chapel');
  for(let i=0;i<53;i++){
    const x=-910+i*35+rand()*25,y=-350-rand()*180;
    post(x,y,trees[i%3],'woods');
  }
  for(const [x,y,i] of [[-405,6,2],[-491,50,0],[-495,112,1],[445,-60,2],[525,37,0],[586,101,2],[-419,333,2],[565,324,0],[-557,251,1],[520,-195,2],[-502,-163,2]]){
    post(x,y,trees[i],'tree');obstacles.push([x,y,13]);
  }
  for(let i=0;i<23;i++){
    const x=-530+(i%8)*51+rand()*11,y=235+Math.floor(i/8)*40+rand()*7;
    if(x>-245 && y>280)continue;
    post(x,y,stones[i%3]);obstacles.push([x,y,10]);
  }
  for(const [start,end] of [[-579,-69],[11,309],[381,574]]){
    const segments=Math.ceil((end-start)/65),len=(end-start)/segments,sprite=Art.fence(len);
    rails.push([start,end]);
    for(let i=0;i<segments;i++)post(start+i*len,187,sprite,'rail');
  }
  flames.forEach((f,index)=>{post(f.x,f.y,bowl,'fire'+index);obstacles.push([f.x,f.y,8]);});
  const motes=Array.from({length:65},()=>({x:rand()*1260-610,y:rand()*530-130,z:rand()*48,phase:rand()*tau}));
  let width=0,height=0,dpr=1,fit=1,mode='play',muted=true,audio=null,t=0,last=0,elapsed=0;
  let player,keys=new Set(),wisps=[],sparks=[],paths=[],zoom=1,wantedZoom=1,camX=0,camY=0,shake=0,active=null;
  const duration={slash:.58,counter:.80};
  let swordTrail=[],lastPress=-Infinity,stepNoise;
  let intro=true,echoes=[],nextEcho=0,soundChosen=false;
  const score=$('score');score.volume=.65;
  let flashUntil=0,noticeTime=0,initialized=false;
  function resize(){
    const r=view.getBoundingClientRect();width=r.width;height=r.height;dpr=Math.min(devicePixelRatio||1,2);
    world.width=Math.round(width*dpr);world.height=Math.round(height*dpr);
    fit=Math.max(.59,Math.min(width/995,height/665));ctx.imageSmoothingEnabled=true;
    if(initialized)render();
  }
  function reset(){
    player={x:5,y:101,angle:-.65,walk:0,moving:false,hp:3,attack:0,cooldown:0,form:"slash",queued:false,stepCount:0,invuln:0,dashTime:0,dashCooldown:0,dashX:0,dashY:0,pose:0,cloth:Keeper.motion()};
    for(const f of flames)f.lit=false;
    wisps=[];sparks=[];paths=[];keys.clear();elapsed=0;mode='play';shake=0;active=null;noticeTime=0;
    swordTrail=[];lastPress=-Infinity;echoes=[];nextEcho=0;intro=true;syncMusic();wantedZoom=zoom=1;const [x,y]=project(player.x,player.y);camX=x+30;camY=y-117;
    $('overlay').hidden=true;$('message').textContent='';$('interaction').textContent='';updateHud();world.focus({preventScroll:true});
  }
  function updateHud(){
    const n=flames.filter(f=>f.lit).length;
    $('seals').textContent=flames.map(f=>f.lit?'◆':'◇').join(' ');$('count').textContent=n+' / 3 lit';
    $('mission').textContent=n===3?'Ring the chapel bell':'Kindle the watchfires';
    $('health').textContent='◆ '.repeat(player.hp)+'◇ '.repeat(3-player.hp);$('health').setAttribute('aria-label',player.hp+' vitality');
  }
  function notify(msg){$('message').textContent=msg;noticeTime=3.6;$('message').style.opacity='1';}
  function tone(freq,duration,volume=.09,type='sine',delay=0,end=freq){
    if(muted||!audio)return;
    const o=audio.createOscillator(),g=audio.createGain(),when=audio.currentTime+delay;
    o.type=type;o.frequency.setValueAtTime(freq,when);o.frequency.exponentialRampToValueAtTime(Math.max(15,end),when+duration);
    g.gain.setValueAtTime(.0001,when);g.gain.exponentialRampToValueAtTime(volume,when+.012);g.gain.exponentialRampToValueAtTime(.0001,when+duration);
    o.connect(g);g.connect(audio.destination);o.start(when);o.stop(when+duration+.02);
  }
  function footfall(){
    if(muted||!audio||audio.state!=='running')return;
    const grass=player.y>187,soft=player.stepCount%2===0;
    if(!stepNoise){
      stepNoise=audio.createBuffer(1,Math.ceil(audio.sampleRate*.23),audio.sampleRate);
      const samples=stepNoise.getChannelData(0);
      for(let i=0;i<samples.length;i++)samples[i]=Math.random()*2-1;
    }
    const shoe=audio.createBufferSource(),filter=audio.createBiquadFilter(),gain=audio.createGain();
    const now=audio.currentTime,end=grass?.135:.079,level=(soft?.14:.17)*(grass?.79:1);
    shoe.buffer=stepNoise;shoe.playbackRate.value=.93+Math.random()*.16;
    filter.type=grass?'bandpass':'lowpass';filter.frequency.setValueAtTime(grass?1280:2050,now);
    filter.frequency.exponentialRampToValueAtTime(grass?480:330,now+end);
    gain.gain.setValueAtTime(.0001,now);gain.gain.exponentialRampToValueAtTime(level,now+.005);
    gain.gain.exponentialRampToValueAtTime(.0001,now+end);
    shoe.connect(filter);filter.connect(gain);gain.connect(audio.destination);shoe.start();shoe.stop(now+end+.01);
    tone(soft?108:121,grass?.08:.105,grass?.042:.080,'sine',0,47);
  }
  function bell(root){[1,2.01,2.72,4.12].forEach((m,i)=>tone(root*m,2.4-i*.32,.14/(i+1)));}
  function syncMusic(){
    if(muted||mode!=='play'||document.hidden){score.pause();return;}
    score.play().catch(()=>{});
  }
  function toggleSound(){
    soundChosen=true;muted=!muted;
    if(!muted){
      const Audio=window.AudioContext||window.webkitAudioContext;
      if(Audio){audio??=new Audio();audio.resume().catch(()=>{});}
    }else if(audio){audio.suspend().catch(()=>{});}
    syncMusic();
    $('sound').textContent=muted?'Sound off':'Sound on';$('sound').setAttribute('aria-label',muted?'Enable music and sound':'Mute music and sound');$('sound').setAttribute('aria-pressed',String(!muted));
  }
  function startSound(e){
    if($('guide').open||e.target.closest?.('#openGuide'))return;
    if(soundChosen||e.target.closest?.('#sound')||e.code==='KeyM')return;
    if(e.type==='keydown'&&!mapping[e.code]&&!['Space','KeyE','KeyC','ShiftLeft','ShiftRight'].includes(e.code))return;
    toggleSound();
  }
  function modal(state){
    mode=state;syncMusic();clearInput();$('overlay').hidden=false;$('interaction').textContent='';
    const content={pause:['Watch paused','Three watchfires guard Ashmere. Follow the amber diamonds and kindle each fire, then return to the chapel door.','Resume watch'],
      lost:['The vigil fades','The shades have taken the yard. The chapel waits for another watch.','Try again'],
      won:['The bell answers','The three watchfires burn. As the bell sounds over Ashmere, the last of the shades slip into the trees.','Keep another vigil']}[state];
    [$('overlayTitle').textContent,$('overlayCopy').textContent,$('resume').textContent]=content;$('resume').focus({preventScroll:true});
  }
  function unpause(){mode='play';syncMusic();$('overlay').hidden=true;world.focus({preventScroll:true});}
  function pause(){if(mode==='play')modal('pause');else if(mode==='pause')unpause();}
  function burst(x,y,z,n,color){
    const [sx,sy]=project(x,y,z);
    for(let i=0;i<n;i++)sparks.push({x:sx,y:sy,dx:(rand()-.5)*36,dy:-9-rand()*28,life:.3+rand()*.7,color,glyph:rand()<.5?'+':'*'});
  }
  const door={x:Art.doorX,y:18,name:'Chapel bell'};
  function nearTarget(){
    const possible=[...flames.filter(f=>!f.lit),door];
    return possible.find(o=>Math.hypot(player.x-o.x,player.y-o.y)<(o===door?43:40))||null;
  }
  function use(){
    if(mode!=='play')return;
    const target=nearTarget(),n=flames.filter(f=>f.lit).length;
    if(!target){notify(n===3?'Return to the chapel door.':'Approach a watchfire marked with a diamond.');return;}
    if(target===door){
      if(n<3){notify('The bell waits for all three watchfires.');return;}
      bell(146.8);tone(220,3,.11,'sine',.6);wisps=[];modal('won');return;
    }
    target.lit=true;burst(target.x,target.y,20,32,'#edae60');bell([261.6,329.6,392][n]);updateHud();
    notify(n===2?'All fires are lit. Return to the chapel bell.':'A shade stirs. Strike with Space to drive it off.');
    const [sx,sy]=project(target.x+(target.x>300?-80:100),target.y+75);
    wisps.push({x:sx,y:sy,phase:rand()*tau,spawn:1.1});
  }
  function blocked(x,y){
    if(x< -565||x>555||y<17||y>342)return true;
    if(Math.abs(y-187)<5&&rails.some(([a,b])=>x>a-3&&x<b+3))return true;
    if(((x+130)/148)**2+((y-358)/72)**2<1)return true;
    return obstacles.some(([ox,oy,r])=>(x-ox)**2+(y-oy)**2<r*r);
  }
  function move(dx,dy,dt,speed=94){
    const mag=Math.hypot(dx,dy);if(!mag)return;
    // Invert the camera projection so arrow keys always move on screen axes.
    dx/=mag;dy/=mag;const det=.58+.77*.275;
    let vx=(.58*dx+.77*dy*.74)/det,vy=(dy*.74-.275*dx)/det;
    // Substep the burst so a low frame rate cannot skip a fence or watchfire.
    const steps=Math.max(1,Math.ceil(dt*speed/2.8)),dist=dt*speed/steps;
    for(let i=0;i<steps;i++){
    if(!blocked(player.x+vx*dist,player.y))player.x+=vx*dist;
    if(!blocked(player.x,player.y+vy*dist))player.y+=vy*dist;
    }
    if(player.attack<=0)player.angle=Math.atan2(-dx,dy);

  }
  function dash(){
    if(mode!=='play'||player.dashCooldown>0)return;
    const dx=Number(keys.has('right'))-Number(keys.has('left')),dy=Number(keys.has('down'))-Number(keys.has('up'));
    const length=Math.hypot(dx,dy);
    player.dashX=length?dx/length:-Math.sin(player.angle);
    player.dashY=length?dy/length:Math.cos(player.angle);
    player.angle=Math.atan2(-player.dashX,player.dashY);
    player.dashTime=.20;player.dashCooldown=.85;player.invuln=Math.max(.20,player.invuln);
    player.attack=0;player.queued=false;lastPress=-Infinity;swordTrail=[];player.pose=1;nextEcho=0;
    player.cloth.forEach((row,i)=>{
      row.vx-=player.dashX*(i+1)*10;row.vd-=player.dashY*(i+1)*10;
    });
    burst(player.x,player.y,5,14,'#e4bf8d');tone(175,.18,.07,'triangle',0,37);
  }
  function strike(angle){
    if(mode!=='play'||player.dashTime>0)return;
    const now=performance.now();
    if(player.attack>0){
      if(player.form==='slash'&&now-lastPress<=360)player.queued=true;
      return;
    }
    if(player.cooldown>0)return;
    if(typeof angle==='number')player.angle=angle;
    lastPress=now;player.form='slash';player.attack=duration.slash;
    player.queued=false;swordTrail=[];
  }
  function cut(wide){
    tone(wide?330:260,.18,.075,'triangle',0,42);
    const p=project(player.x,player.y,16);
    for(let i=wisps.length-1;i>=0;i--){
      const w=wisps[i],dx=w.x-p[0],dy=w.y-14-p[1],r=Math.hypot(dx,dy);
      const dot=(-Math.sin(player.angle)*dx+Math.cos(player.angle)*dy)/(r||1);
      if(r<(wide?55:51)&&(dot>(wide?-.65:.05)||r<18)){
        for(let j=0;j<24;j++)sparks.push({x:w.x,y:w.y-14,dx:(rand()-.5)*48,dy:(rand()-.65)*45,life:.4+rand()*.6,color:'#e7b995',glyph:'+'});
        wisps.splice(i,1);shake=2.0;tone(94,.3,.065,'triangle',0,32);
      }
    }
  }
  function cycleZoom(){intro=false;const levels=[1,2.7,6.6,8];wantedZoom=levels.find(v=>v>wantedZoom+.12)||1;}
  function update(dt){
    t+=dt;elapsed+=dt;player.moving=false;player.cooldown=Math.max(0,player.cooldown-dt);player.invuln=Math.max(0,player.invuln-dt);
    if(intro&&elapsed>.65){wantedZoom=6.6;intro=false;}
    player.dashCooldown=Math.max(0,player.dashCooldown-dt);
    const before=project(player.x,player.y);
    if(player.dashTime>0){
      const portion=Math.min(dt,player.dashTime);
      move(player.dashX,player.dashY,portion,460);
      player.dashTime-=portion;
    }else if(player.attack>0 && player.form==='counter' && player.attack<.66 && player.attack>.36){
      move(-Math.sin(player.angle),Math.cos(player.angle),dt,136);
    }else{
      move(Number(keys.has('right'))-Number(keys.has('left')),Number(keys.has('down'))-Number(keys.has('up')),dt);
    }
    player.pose+=(Number(player.dashTime>0)-player.pose)*(1-Math.exp(-dt*14));
    const p=project(player.x,player.y),vx=dt?(p[0]-before[0])/dt:0,vd=dt?(p[1]-before[1])/(dt*.74):0;
    const distance=Math.hypot(p[0]-before[0],(p[1]-before[1])/.74);
    player.moving=distance>.02;
    if(player.moving){
      const speed=player.dashTime>0?.063:.108;
      player.walk+=distance*speed;
      const step=Math.floor(player.walk/Math.PI);
      if(step!==player.stepCount){player.stepCount=step;footfall();}
    }
    for(const trace of swordTrail)trace.life-=dt;
    swordTrail=swordTrail.filter(trace=>trace.life>0);
    if(player.attack>0){
      const len=duration[player.form],old=1-player.attack/len;
      player.attack=Math.max(0,player.attack-dt);
      const phase=1-player.attack/len;
      const impacts=player.form==='counter'?[.32,.72]:[.39];
      for(const hit of impacts)if(old<hit&&phase>=hit)cut(player.form==='counter');
      const blade=keeperSprite().blade;
      if(blade && ((phase>.20&&phase<.62)||(player.form==='counter'&&phase>.63&&phase<.84))){
        swordTrail.push({x:p[0]+blade.tip[0],y:p[1]+blade.tip[1],gx:p[0]+blade.guard[0],gy:p[1]+blade.guard[1],life:.12});
      }
      if(player.attack===0){
        if(player.queued){
          player.queued=false;player.form='counter';player.attack=duration.counter;swordTrail=[];
          burst(player.x,player.y,4,10,'#e7b486');
        }else player.cooldown=.09;
      }
    }
    Keeper.advance(player.cloth,dt,t,vx,vd);
    for(const e of echoes)e.life-=dt;echoes=echoes.filter(e=>e.life>0);
    if(player.dashTime>0 && t>=nextEcho){
      const source=keeperSprite(),copy=document.createElement('canvas');
      copy.width=350;copy.height=230;copy.getContext('2d').drawImage(source.levels[0],0,0,350,230);
      echoes.push({x:p[0],y:p[1],depth:player.y,life:.24,sprite:{...source,levels:[copy]}});
      nextEcho=t+.032;
    }
    if(player.moving&&Math.floor(elapsed*12)!==Math.floor((elapsed-dt)*12)){
      paths.push({x:p[0],y:p[1]-1,life:1.1});
      if(rand()<.45)burst(player.x,player.y,20,1,'#c18958');
    }
    for(const w of wisps){
      w.spawn=Math.max(0,w.spawn-dt);
      if(w.spawn>0)continue;
      const dx=p[0]-w.x,dy=p[1]-w.y,dist=Math.hypot(dx,dy);
      if(dist>0){const speed=22;w.x+=dx/dist*speed*dt;w.y+=dy/dist*speed*dt;}
      if(dist<10&&player.invuln<=0){
        player.hp--;player.invuln=1.9;shake=4;flashUntil=t+.16;updateHud();tone(90,.4,.12,'triangle',0,36);
        w.x-=dx/(dist||1)*34;w.y-=dy/(dist||1)*34;
        if(!player.hp){modal('lost');return;}notify('The shade struck. Face it and press Space.');
      }
    }
    for(const s of sparks){s.x+=s.dx*dt;s.y+=s.dy*dt;s.dy+=12*dt;s.life-=dt;}sparks=sparks.filter(s=>s.life>0);
    for(const s of paths)s.life-=dt;paths=paths.filter(s=>s.life>0);
    const tracking=1-Math.exp(-dt*6.5);zoom+=(wantedZoom-zoom)*tracking;
    if(Math.abs(wantedZoom-zoom)<.014)zoom=wantedZoom;
    camX+=(p[0]+30/zoom-camX)*tracking;camY+=(p[1]-18-99/zoom-camY)*tracking;
    shake=Math.max(0,shake-dt*12);
    const action=player.attack>0?(player.form==='counter'?'Crossing lunge':player.queued?'Follow-up queued':'Crescent slash'):player.dashTime>0?'Shadow step':player.moving?'Walking':'On watch';
    if($('moveName').textContent!==action)$('moveName').textContent=action;
    $('dashFill').style.transform='scaleX('+Math.min(1,1-player.dashCooldown/.85)+')';
    const dashStatus=player.dashCooldown>0?'Recovering':'Dash ready';
    if($('dashLabel').textContent!==dashStatus)$('dashLabel').textContent=dashStatus;
    active=nearTarget();
    const prompt=active?(active===door?'[ E ]  Ring the chapel bell':'[ E ]  Kindle '+active.name.toLowerCase()):'';
    if($('interaction').textContent!==prompt)$('interaction').textContent=prompt;
    const area=player.y>193?'Chapel garden':player.x>280?'East walk':player.x< -245?'West walk':'Chapel yard';
    if($('area').textContent!==area)$('area').textContent=area;
    noticeTime=Math.max(0,noticeTime-dt);if(noticeTime<.45)$('message').style.opacity=String(noticeTime/.45);
  }
  function glyph(c,ch,x,y,color,size=4){
    c.fillStyle=color;c.font='bold '+size+'px Consolas, monospace';c.fillText(ch,x,y);
  }
  function shadow(x,y,rx,ry,alpha){
    ctx.save();ctx.translate(x,y);ctx.rotate(.19);ctx.scale(rx,ry);
    const g=ctx.createRadialGradient(0,0,0,0,0,1);g.addColorStop(0,'rgba(1,2,6,'+alpha+')');g.addColorStop(1,'rgba(1,2,6,0)');
    ctx.fillStyle=g;ctx.fillRect(-1,-1,2,2);ctx.restore();
  }
  function glow(x,y,r,color,strength){
    ctx.save();ctx.globalAlpha=strength;const g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,color);g.addColorStop(1,'transparent');ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2);ctx.restore();
  }
  function marker(x,y,isDoor=false){
    const bob=Math.sin(t*2.4)*1.5;
    ctx.save();ctx.translate(x,y+bob);ctx.strokeStyle='#d6af76';ctx.lineWidth=.85;ctx.beginPath();ctx.moveTo(0,-4);ctx.lineTo(3.5,0);ctx.lineTo(0,4);ctx.lineTo(-3.5,0);ctx.closePath();ctx.stroke();if(isDoor)glyph(ctx,'+',-1.5,1.8,'#ecc58c',4.5);ctx.restore();
  }
  function fire(x,y,index){
    const f=flames[index],lit=f.lit;
    if(!lit){marker(x,y-39);glow(x,y-19,9,'#ec9252',.24);return;}
    glow(x,y-23,27,'#e6843d',.22+.04*Math.sin(t*6+index));
    for(let i=0;i<18;i++){
      const ph=(t*(.8+i%3*.08)+i*.137)%1,dx=Math.sin(i*14+ph*4)*(1-ph)*7+Math.sin(ph*4+i)*1.3;
      glyph(ctx,i%3===0?'*':i%3===1?'+':':',x+dx,y-18-ph*20,ph>.7?'#d67a48':i%2?'#ffc780':'#ffe2aa',3+3*(1-ph));
    }
  }
  function shade(w){
    const bob=Math.sin(t*3+w.phase)*2;ctx.save();ctx.translate(w.x,w.y-13+bob);ctx.globalAlpha=w.spawn>0?.45+.4*Math.sin(t*10):1;
    glow(0,-2,16,'#ad7a85',.18);
    for(let i=0;i<42;i++){
      const a=i*2.39996,rad=Math.sqrt(i/42),x=Math.cos(a)*rad*7,y=Math.sin(a)*rad*10;
      glyph(ctx,';:/i+'[i%5],x+Math.sin(t*4+i*.3),y,i%3?'#827c8b':'#baa6ad',3.7);
    }
    glyph(ctx,'=',-3,-2,'#ffc178',5);ctx.restore();
  }
  function keeperSprite(){
    const swing=player.attack>0?1-player.attack/duration[player.form]:0;
    return Art.pilgrim(player.angle,player.walk,swing,t,player.cloth,player.pose,player.moving,player.form);
  }
  function hero(x,y){
    for(let i=1;i<swordTrail.length;i++){
      const a=swordTrail[i-1],b=swordTrail[i];
      if(Math.hypot(a.x-b.x,a.y-b.y)<1)continue;
      for(let j=0;j<8;j++){
        const u=j/8,dx=a.x+(b.x-a.x)*u,dy=a.y+(b.y-a.y)*u;
        ctx.globalAlpha=.72*b.life/.12;
        glyph(ctx,j%2?'-':'~',dx,dy,player.form==='counter'?'#ffcf86':'#f4e7d1',2.3);
        ctx.globalAlpha*=.45;glyph(ctx,'.',dx*.83+b.gx*.17,dy*.83+b.gy*.17,'#dab795',2.5);
      }
    }
    ctx.globalAlpha=1;
    if(player.invuln>.20&&Math.floor(t*12)%2)ctx.globalAlpha=.55;
    Art.draw(ctx,keeperSprite(),x,y);ctx.globalAlpha=1;
    // Cinders drift from the weapon hand even while the keeper is still.
    const handX=x+8*Math.cos(player.angle)-3*Math.sin(player.angle),handY=y-23+3*Math.cos(player.angle);
    for(let j=0;j<8;j++){
      const phase=(t*.85+j*.137)%1;
      const ex=handX-9*phase+Math.sin(j*7+t+phase*3)*4*phase,ey=handY-15*phase;
      ctx.globalAlpha=(1-phase)*.92;
      glyph(ctx,j%2?'*':'+',ex,ey,j%3?'#df974c':'#ffce84',1.7+phase);
    }
    ctx.globalAlpha=1;
  }
  const backdrop=document.createElement('canvas'),back=backdrop.getContext('2d',{alpha:false});
  let stored=null;
  function paintBackdrop(g,minX,minY,maxX,maxY){
    Art.draw(g,ground);
    for(const q of props){
      if(q.type!=='woods')continue;
      const [x,y]=project(q.x,q.y),s=q.sprite;
      if(x+s.left+s.w>=minX&&x+s.left<=maxX&&y+s.top+s.h>=minY&&y+s.top<=maxY)Art.draw(g,s,x,y);
    }
    g.fillStyle='rgba(3,4,9,.45)';g.beginPath();
    [[-369,0],[272,0],[313,37],[-327,37]].forEach(([a,b],i)=>{const p=project(a,b);if(i)g.lineTo(...p);else g.moveTo(...p);});g.fill();
    Art.draw(g,chapel);
  }
  function drawBackdrop(s,minX,minY,maxX,maxY){
    // Reuse the static courtyard while the camera moves inside the overscan.
    if(zoom!==wantedZoom){paintBackdrop(ctx,minX,minY,maxX,maxY);return;}
    const pixels=s*dpr,pad=100/pixels;
    if(!stored||stored.scale!==pixels||minX<stored.x||minY<stored.y||maxX>stored.right||maxY>stored.bottom){
      const x=minX-pad,y=minY-pad;
      backdrop.width=Math.ceil(width*dpr+200);backdrop.height=Math.ceil(height*dpr+200);
      const right=x+backdrop.width/pixels,bottom=y+backdrop.height/pixels;
      back.fillStyle='#0b0e12';back.fillRect(0,0,backdrop.width,backdrop.height);
      back.setTransform(pixels,0,0,pixels,-x*pixels,-y*pixels);paintBackdrop(back,x,y,right,bottom);
      stored={x,y,right,bottom,scale:pixels};
    }
    ctx.drawImage(backdrop,stored.x,stored.y,backdrop.width/pixels,backdrop.height/pixels);
  }
  function render(){
    const s=fit*zoom,ox=width*.5-camX*s+(shake?Math.sin(t*89)*shake:0),oy=height*.5-camY*s+(shake?Math.cos(t*99)*shake:0);
    ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle='#0b0e12';ctx.fillRect(0,0,width,height);
    ctx.translate(ox,oy);ctx.scale(s,s);
    const minX=-ox/s,minY=-oy/s,maxX=(width-ox)/s,maxY=(height-oy)/s;
    drawBackdrop(s,minX,minY,maxX,maxY);
    const [px,py]=project(player.x,player.y);
    for(const q of props){
      if(q.type!=='tree')continue;
      const [x,y]=project(q.x,q.y);if(x<minX-450||x>maxX+450||y<minY-100||y>maxY+370)continue;
      shadow(x+7,y+3,39,11,.7);
    }
    shadow(px+3,py+.6,15,4,.95);
    const figure=keeperSprite();
    ctx.save();ctx.translate(px,py);ctx.transform(1,.04,-.67,.19,0,0);
    ctx.globalAlpha=.77;ctx.drawImage(figure.shadow,figure.left,figure.top,figure.w,figure.h);ctx.restore();
    for(const p of paths){ctx.globalAlpha=Math.min(1,p.life)*.55;glyph(ctx,'.',p.x,p.y,'#e0b08a',4);}ctx.globalAlpha=1;
    const visible=[];
    for(const q of props){
      if(q.type==='woods')continue;
      const [x,y]=project(q.x,q.y),sp=q.sprite;
      if(x+sp.left+sp.w<minX||x+sp.left>maxX||y+sp.top+sp.h<minY||y+sp.top>maxY)continue;
      // Depth follows the object's baseline at the actor's horizontal position.
      const depth=q.type==='chapel'?-100:q.type==='woods'?-600:q.y;
      visible.push({depth,paint:()=>{
        if(q.type!=='chapel')Art.draw(ctx,sp,x,y);
        if(q.type.startsWith('fire'))fire(x,y,Number(q.type.slice(4)));
        if(q.type==='chapel'){
          for(const lamp of [-347,64,148,252]){const [lx,ly]=project(lamp,8,62);glow(lx,ly,19,'#e6a265',.11+.025*Math.sin(t*4+lamp));}
          if(flames.every(f=>f.lit)){const p=project(door.x,6,107);marker(...p,true);}
        }
      }});
    }
    for(const e of echoes)visible.push({depth:e.depth,paint:()=>{
      ctx.globalAlpha=.48*(e.life/.24);Art.draw(ctx,e.sprite,e.x,e.y);ctx.globalAlpha=1;
    }});
    visible.push({depth:player.y,paint:()=>hero(px,py)});
    for(const w of wisps)visible.push({depth:(w.y-.275*w.x)/(.58+.275*.77),paint:()=>shade(w)});
    visible.sort((a,b)=>a.depth-b.depth);for(const q of visible)q.paint();
    for(const m of motes){
      const [x,y]=project(m.x,m.y,m.z);
      if(x<minX||x>maxX||y<minY||y>maxY)continue;
      const v=Math.sin(t*.74+m.phase);if(v<-.2)continue;
      glyph(ctx,'.',x+Math.sin(t*.5+m.phase)*5,y+Math.cos(t*.7+m.phase)*3,'#9b9879',2.6);
    }
    for(const q of sparks){ctx.globalAlpha=Math.min(1,q.life*2);glyph(ctx,q.glyph,q.x,q.y,q.color,3.1);}ctx.globalAlpha=1;
    ctx.setTransform(dpr,0,0,dpr,0,0);
    if(t<flashUntil&&mode==='play'){ctx.fillStyle='rgba(165,72,51,.12)';ctx.fillRect(0,0,width,height);}
  }
  const mapping={KeyW:'up',ArrowUp:'up',KeyS:'down',ArrowDown:'down',KeyA:'left',ArrowLeft:'left',KeyD:'right',ArrowRight:'right'};
  const pressed=new Set();
  function syncKeys(){keys=new Set([...pressed].map(k=>mapping[k]||k));}
  window.addEventListener('keydown',startSound,true);
  window.addEventListener('pointerdown',startSound,true);
  // Some touch browsers grant audio playback on release of the first touch.
  window.addEventListener('touchend',()=>{
    if(!muted&&mode==='play'&&!document.hidden){
      if(score.paused)syncMusic();
      if(audio?.state==='suspended')audio.resume().catch(()=>{});
    }
  },{passive:true});
  window.addEventListener('keydown',e=>{
    if($('guide').open){
      if(e.code==='Escape'){e.preventDefault();$('guide').close();}
      return;
    }
    if(e.altKey||e.ctrlKey||e.metaKey)return;
    if(e.code==='Escape'&&!e.repeat){e.preventDefault();pause();return;}
    if(mode!=='play')return;
    if(e.code==='ShiftLeft'||e.code==='ShiftRight'){e.preventDefault();if(!e.repeat)dash();return;}
    if(mapping[e.code]){e.preventDefault();pressed.add(e.code);syncKeys();return;}
    if(['Space','KeyE','KeyC','KeyM','Equal','Minus'].includes(e.code)){
      if(e.code==='Space'&&document.activeElement?.tagName==='BUTTON')return;
      e.preventDefault();if(e.repeat)return;
      if(e.code==='Space')strike();else if(e.code==='KeyE')use();else if(e.code==='KeyC')cycleZoom();else if(e.code==='KeyM')toggleSound();
      else {intro=false;wantedZoom=Math.max(.8,Math.min(8.5,wantedZoom*(e.code==='Equal'?1.3:1/1.3)));}
    }
  });
  window.addEventListener('keyup',e=>{pressed.delete(e.code);syncKeys();});
  function clearInput(){pressed.clear();keys.clear();lastPress=-Infinity;}
  window.addEventListener('blur',clearInput);document.addEventListener('visibilitychange',()=>{clearInput();if(document.hidden&&mode==='play'&&initialized)modal('pause');});
  $('resume').onclick=()=>{clearInput();if(mode==='pause')unpause();else reset();};
  $('pause').onclick=()=>{clearInput();pause();};$('sound').onclick=()=>{toggleSound();world.focus({preventScroll:true});};
  $('zoom').onclick=()=>{if(mode==='play')cycleZoom();world.focus({preventScroll:true});};
  world.addEventListener('wheel',e=>{e.preventDefault();intro=false;if(mode==='play')wantedZoom=Math.max(.8,Math.min(8.5,wantedZoom*Math.exp(-Math.sign(e.deltaY)*.18)));},{passive:false});
  world.addEventListener('pointerdown',e=>{
    if(e.pointerType==='touch'||e.button!==0||mode!=='play')return;
    world.focus({preventScroll:true});const rect=world.getBoundingClientRect(),s=fit*zoom,[x,y]=project(player.x,player.y,23);
    const dx=(e.clientX-rect.left-width*.5)/s+camX-x,dy=(e.clientY-rect.top-height*.5)/s+camY-y;
    strike(Math.atan2(-dx,dy));
  });
  for(const b of document.querySelectorAll('[data-move]')){
    const dir=b.dataset.move;
    b.onpointerdown=e=>{e.preventDefault();if(mode!=='play')return;b.setPointerCapture(e.pointerId);pressed.add(dir);syncKeys();};
    b.onlostpointercapture=()=>{pressed.delete(dir);syncKeys();};
  }
  $('touchDash').onclick=dash;
  $('touchAttack').onclick=()=>strike();$('touchUse').onclick=use;
  let guidePaused=false;
  $('openGuide').onclick=()=>{
    guidePaused=mode==='play';
    if(guidePaused){mode='guide';clearInput();syncMusic();}
    $('guide').showModal();
  };
  $('closeGuide').onclick=()=>$('guide').close();
  $('guide').addEventListener('close',()=>{
    if(guidePaused){unpause();guidePaused=false;}else $('openGuide').focus();
  });
  new ResizeObserver(resize).observe(view);resize();reset();
  function frame(now){
    const dt=last?Math.min((now-last)/1000,.045):0;last=now;
    if(mode==='play'){update(dt);render();}
    initialized=true;requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
