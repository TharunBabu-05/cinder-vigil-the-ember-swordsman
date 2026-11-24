(() => {
  'use strict';
  const $=id=>document.getElementById(id),world=$('world'),ctx=world.getContext('2d',{alpha:false}),view=$('view');
  const {project}=Art,rand=Art.random(782),tau=Math.PI*2;
  const coarsePointer=matchMedia('(pointer:coarse)');
  const ground=Art.ground(),gatehouse=Art.gatehouse(),meadow=Art.meadow(),bowl=Art.brazier();
  const trees=[Art.tree(55,112),Art.tree(22,88),Art.tree(87,158)],stones=[1,2,3].map(Art.stone);
  const props=[],obstacles=[],rails=[],flames=[
    {x:-777,y:225,name:'Cedar watchfire'}, {x:755,y:133,name:'Market watchfire'}, {x:127,y:597,name:'Kiln watchfire'}
  ];
  const post=(x,y,sprite,type='scenery')=>props.push({x,y,sprite,type});
  post(0,0,gatehouse,'gatehouse');
  const water=[];
  for(let start=-2200;start<1800;start+=200){
    const y=Art.riverY(start);water.push({point:project(start,y),sprite:Art.riverSection(start)});
  }
  const crossing=Art.bridge();
  const ferryBoat=Art.ferry();
  const stalls=['#9d655a','#546c81','#b18a56'].map(Art.stall),furnace=Art.kiln();
  for(const [i,x] of [600,700,800,900].entries()){
    post(x,54,stalls[i%3]);obstacles.push([x,48,29]);
    post(x+13,239,stalls[(i+1)%3]);obstacles.push([x+13,227,29]);
  }
  for(const [x,y] of [[52,567],[211,565],[289,605],[-35,633]]){
    post(x,y,furnace);obstacles.push([x,y,28]);
  }
  for(let i=0;i<53;i++){
    const x=-1010+rand()*445,y=40+rand()*310;
    if(Math.abs(y-223)<39||Math.abs(x+777)<44)continue;
    post(x,y,trees[i%3],'tree');obstacles.push([x,y,11]);
  }
  for(let i=0;i<28;i++){
    const x=-995+rand()*1950,y=542+rand()*150;
    if(Math.abs(x)<330||Math.abs(x-355)<42||Math.abs(x+455)<42)continue;
    post(x,y,trees[i%3],'tree');obstacles.push([x,y,12]);
  }
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
  Reach.scenery(post,obstacles);
  Survey.scenery(post,obstacles,trees,stones);
  const motes=Array.from({length:65},()=>({x:rand()*1260-610,y:rand()*530-130,z:rand()*48,phase:rand()*tau}));
  let width=0,height=0,dpr=1,fit=1,mode='play',muted=true,audio=null,t=0,last=0,elapsed=0;
  let player,keys=new Set(),wisps=[],sparks=[],paths=[],zoom=1,wantedZoom=1,camX=0,camY=0,shake=0,active=null;
  const duration={slash:.65,counter:.86};
  let swordTrail=[],lastPress=-Infinity;
  let intro=true,echoes=[],nextEcho=0,soundChosen=false;
  let stage=-1,letter=0,trackLetter=false,bolts=[],swingNumber=0,arrival=0;
  const findings=new Set(),visitedRests=new Set();
  let charted=false,surveyStarted=false,trackedSite=null,rescued=false;
  const jumpDuration=.70,jumpPeak=34;
  const score=$('score');score.volume=.65;
  let flashUntil=0,noticeTime=0,initialized=false;
  function resize(){
    const r=view.getBoundingClientRect();width=r.width;height=r.height;dpr=Math.min(devicePixelRatio||1,2);
    world.width=Math.round(width*dpr);world.height=Math.round(height*dpr);
    fit=Math.max(.59,Math.min(width/995,height/665));ctx.imageSmoothingEnabled=true;
    if(initialized)render();
  }
  function spawnShade(kind,x,y,roams=false){
    const w=Shades.create(kind,...project(x,y),rand()*tau,roams);
    wisps.push(w);return w;
  }
  function reset(){
    const checkpoint=mode==='lost'&&stage>=0;
    const spawn=checkpoint?[door,Reach.wreck,Reach.sluice,Reach.beacon,Reach.beacon][stage]:null;
    if(!checkpoint){stage=-1;letter=0;trackLetter=false;}
    if(mode!=='lost'){findings.clear();visitedRests.clear();charted=false;surveyStarted=false;trackedSite=null;rescued=false;}
    if(stage===3)stage=2;
    player={x:spawn?spawn.x:5,y:spawn?spawn.y+32:101,angle:-.65,walk:0,moving:false,hp:letter===2?4:3,attack:0,cooldown:0,form:"slash",queued:false,stepCount:0,invuln:0,dashTime:0,dashCooldown:0,dashX:0,dashY:0,pose:0,cloth:Keeper.motion(),
      z:0,airTime:0,jumpCooldown:0,safeX:0,safeY:0};
    for(const f of flames)f.lit=checkpoint;
    wisps=[];bolts=[];sparks=[];paths=[];keys.clear();elapsed=0;arrival=0;mode='play';shake=0;active=null;noticeTime=0;
    view.classList.remove('homecoming');
    for(const [kind,x,y] of [...Reach.patrols,...Survey.patrols])spawnShade(kind,x,y,true);
    swordTrail=[];lastPress=-Infinity;echoes=[];nextEcho=0;intro=true;syncMusic();wantedZoom=zoom=1;const [x,y]=project(player.x,player.y);camX=x+30;camY=y-117;
    $('overlay').hidden=true;$('message').textContent='';$('interaction').textContent='';updateHud();world.focus({preventScroll:true});
    if(checkpoint)notify(rescued?'Back on the headland. The ferry is safe.':'Back on watch. '+Reach.orders[stage].title+'.');
    else if(!surveyStarted)notify('The watchfires are dark. Open the river atlas to find the old survey roads.',5);
  }
  function updateHud(){
    const n=flames.filter(f=>f.lit).length;
    const duties=[stage>=1,stage>=2,stage>=4,rescued];
    const checks=stage<0?flames.map(f=>f.lit):duties;
    let order=Reach.orders[stage];
    if(stage<0)order={
      title:n===3?'Sound the gatehouse gong':'Kindle the watchfires',
      entry:'The cedar cutters, dyers and kiln workers each kept a fire for the ferry. Kindle all three, then ring the gong to hear from the far bank.'
    };
    if(rescued)order={title:'The ferry is home',entry:'The workers have reached Salt Quay. The survey roads and the pilots’ shrine are open to explore.'};
    $('seals').textContent=checks.map(done=>done?'◆':'◇').join(' ');
    $('count').textContent=stage<0?n+' / 3 lit':duties.filter(Boolean).length+' / 4 duties';
    $('chapter').textContent=stage<0?'The night watch':'The last ferry';
    $('mission').textContent=order.title;
    $('health').textContent='◆ '.repeat(player.hp)+'◇ '.repeat((letter===2?4:3)-player.hp);$('health').setAttribute('aria-label',player.hp+' vitality');
    $('orderTitle').textContent=order.title;$('orderCopy').textContent=order.entry;
    $('letterCopy').textContent=['A sealed dispatch was left on the east side of the gatehouse court. Take it to the pilots’ roadside shrine for an extra point of vitality.',
      'The seal bears a little heron. Carry the letter up the shell road to the pilots’ shrine.',
      'Letter delivered. Four lamps now burn for the night watch. Your maximum vitality is four.'][letter];
    $('trackLetter').hidden=letter===2||mode==='won';
    $('trackLetter').textContent=trackLetter?'Follow main duty':'Follow letter';
    $('trackLetter').setAttribute('aria-pressed',String(trackLetter));
    if(trackedSite&&mode!=='won'){
      $('chapter').textContent='The pilots’ survey';$('mission').textContent=trackedSite.name;
      $('seals').textContent=Survey.sites.map(s=>findings.has(s.id)?'◆':'◇').join(' ');
      $('count').textContent=findings.size+' / 3 recorded';
    }
  }
  function notify(msg,seconds=3.6){$('message').textContent=msg;noticeTime=seconds;$('message').style.opacity='1';}
  function tone(freq,duration,volume=.09,type='sine',delay=0,end=freq){
    if(muted||!audio)return;
    const o=audio.createOscillator(),g=audio.createGain(),when=audio.currentTime+delay;
    o.type=type;o.frequency.setValueAtTime(freq,when);o.frequency.exponentialRampToValueAtTime(Math.max(15,end),when+duration);
    g.gain.setValueAtTime(.0001,when);g.gain.exponentialRampToValueAtTime(volume,when+.012);g.gain.exponentialRampToValueAtTime(.0001,when+duration);
    o.connect(g);g.connect(audio.destination);o.start(when);o.stop(when+duration+.02);
  }
  const effects=new Map(),buffers=new Map(),playing=new Set(),previousStep=new Map();
  function loadEffects(){
    if(effects.size)return;
    const names=['cut','return','finish','dash'];
    for(const surface of ['stone','sand'])for(const side of ['l','r'])
      for(let n=1;n<=3;n++)names.push(surface+'-'+side+n);
    for(const name of names){
      const url='audio/'+name+'.ogg',element=new Audio();effects.set(name,element);
      // Web Audio mixes overlapping cloth, blade and foot transients precisely.
      // Direct file launches use ordinary media elements with local URLs.
      if(audio&&location.protocol!=='file:'){
        fetch(url).then(r=>{if(!r.ok)throw Error(r.status);return r.arrayBuffer();})
          .then(bytes=>audio.decodeAudioData(bytes)).then(buffer=>buffers.set(name,buffer))
          .catch(()=>{element.src=url;});
      }else{element.preload='auto';element.src=url;}
    }
  }
  function sample(name,volume,rate=1){
    if(muted||mode!=='play')return;
    if(audio?.state==='running'&&buffers.has(name)){
      const source=audio.createBufferSource(),gain=audio.createGain();
      source.buffer=buffers.get(name);source.playbackRate.value=rate;gain.gain.value=volume;
      source.connect(gain);gain.connect(audio.destination);playing.add(source);
      source.onended=()=>{playing.delete(source);source.disconnect();gain.disconnect();};
      source.start();return;
    }
    const channel=effects.get(name);if(!channel)return;
    if(!channel.hasAttribute('src'))channel.src='audio/'+name+'.ogg';
    channel.currentTime=0;channel.volume=volume;channel.playbackRate=rate;
    channel.play().catch(()=>{});
  }
  function footfall(){
    const stone=(player.x>=-620&&player.x<=565&&player.y<=188)||player.y>1100;
    const shoe=(stone?'stone':'sand')+(player.stepCount%2?'-l':'-r');
    const variant=((previousStep.get(shoe)||0)+1+Math.floor(rand()*2))%3;
    previousStep.set(shoe,variant);sample(shoe+(variant+1),stone?.48:.57,.97+rand()*.07);
  }
  function bell(root){[1,2.01,2.72,4.12].forEach((m,i)=>tone(root*m,2.4-i*.32,.14/(i+1)));}
  function syncMusic(){
    if(muted||mode!=='play'||document.hidden){score.pause();for(const fx of effects.values())fx.pause();for(const source of playing)source.stop();return;}
    score.play().catch(()=>{});
  }
  function toggleSound(){
    soundChosen=true;muted=!muted;
    if(!muted){
      const Audio=window.AudioContext||window.webkitAudioContext;
      if(Audio){audio??=new Audio();audio.resume().catch(()=>{});}
      loadEffects();
    }else if(audio){audio.suspend().catch(()=>{});}
    syncMusic();
    $('sound').textContent=muted?'Sound off':'Sound on';$('sound').setAttribute('aria-label',muted?'Enable music and sound':'Mute music and sound');$('sound').setAttribute('aria-pressed',String(!muted));
  }
  function startSound(e){
    if($('guide').open||$('atlas').open||e.target.closest?.('#openGuide,#openAtlas'))return;
    if(soundChosen||e.target.closest?.('#sound')||e.code==='KeyM')return;
    if(e.type==='keydown'&&!mapping[e.code]&&!['Space','KeyE','KeyJ','KeyC','ShiftLeft','ShiftRight'].includes(e.code))return;
    toggleSound();
  }
  function modal(state){
    mode=state;syncMusic();clearInput();$('overlay').hidden=false;$('interaction').textContent='';
    $('explore').hidden=state!=='won';
    const content={pause:['Watch paused',$('orderCopy').textContent,'Resume watch'],
      lost:['The vigil fades',stage>=0?'The ferryman keeps your place. Return to the last duty with your vitality restored.':'The shades have taken the yard. The ferry gate waits for another watch.',stage>=0?'Return to checkpoint':'Try again'],
      won:['The last ferry comes home','The pilot sees the beacon. A hull parts the reeds below Salt Quay, and the ferryman brings the last kiln workers home before dawn.','Keep another vigil']}[state];
    [$('overlayTitle').textContent,$('overlayCopy').textContent,$('resume').textContent]=content;$('resume').focus({preventScroll:true});
  }
  function unpause(){mode='play';syncMusic();$('overlay').hidden=true;world.focus({preventScroll:true});}
  function pause(){if(mode==='play')modal('pause');else if(mode==='pause')unpause();}
  function burst(x,y,z,n,color){
    const [sx,sy]=project(x,y,z);
    for(let i=0;i<n;i++)sparks.push({x:sx,y:sy,dx:(rand()-.5)*36,dy:-9-rand()*28,life:.3+rand()*.7,color,glyph:rand()<.5?'+':'*'});
  }
  const door={x:Art.doorX,y:22,name:'Gatehouse gong'};
  function letterSite(){return letter===0?Reach.bag:Reach.shrine;}
  function dutySites(){
    if(rescued)return [];
    if(stage>=0)return [Reach.orders[stage].site];
    const unlit=flames.filter(f=>!f.lit);return unlit.length?unlit:[door];
  }
  function actionFor(target){
    if(visitedRests.has(target.id))return 'Listen at '+target.name;
    if(target===Survey.desk&&findings.size===3&&!charted)return 'Bind the river chart';
    if(Survey.stations.includes(target)&&(charted||findings.has(target.id)))return 'Open the river atlas';
    if(target===door)return 'Sound the gatehouse gong';
    if(target===Reach.beacon&&stage>=3)return stage===3?'Drive off the bell warden':'Light the pilot’s beacon';
    return target.action||'Kindle '+target.name.toLowerCase();
  }
  function nearTarget(){
    const possible=dutySites();
    if(stage<0&&!possible.includes(door))possible.push(door);
    if(letter<2)possible.push(letterSite());
    possible.push(...Survey.stations,...Survey.rests);
    return possible.find(o=>Math.hypot(player.x-o.x,player.y-o.y)<(o===door?43:40))||null;
  }
  function inspectSite(site){
    if(charted||findings.has(site.id)){openAtlas(site);return;}
    surveyStarted=true;
    if(site===Survey.desk){
      if(findings.size===3){
        charted=true;bell(392);trackedSite=null;
        notify('The old ferry route is whole. Open the atlas at any survey station to travel between them.',7);
      }else{
        trackedSite=Survey.sites.find(s=>!findings.has(s.id));trackLetter=false;
        notify('Nao left three blanks on her chart. Follow the map bearing, or choose another station in the atlas.',7);
      }
      return;
    }
    findings.add(site.id);bell([261.6,329.6,392][findings.size-1]);
    burst(site.x,site.y,18,12,'#b4d7c4');
    if(trackedSite===site||!trackedSite){
      trackedSite=Survey.sites.find(s=>!findings.has(s.id))||Survey.desk;trackLetter=false;
    }
    notify(site.finding,8);
  }
  function use(){
    if(mode!=='play'||player.airTime>0)return;
    window.playerCount?.recordPlay();
    const target=nearTarget(),n=flames.filter(f=>f.lit).length;
    if(!target){notify(trackedSite?'Follow the bearing to '+trackedSite.name+'.':trackLetter?'Follow the bearing to the '+letterSite().name.toLowerCase()+'.':rescued?'Choose a survey station in the river atlas.':$('mission').textContent+'. Follow the bearing.');return;}
    if(Survey.stations.includes(target)){inspectSite(target);updateHud();return;}
    if(Survey.rests.includes(target)){
      const first=!visitedRests.has(target.id);
      if(first){visitedRests.add(target.id);player.hp=letter===2?4:3;updateHud();tone(330,.9,.08);}
      notify((first?'Vitality restored. ':'')+target.finding,8);return;
    }
    if(target===Reach.bag||target===Reach.shrine){
      letter++;
      if(letter===2){player.hp=4;trackLetter=false;bell(392);}
      notify(letter===1?'A pilot’s letter. The pilots’ shrine stands on the shell road.':'The shrine lamps catch. Your vitality is restored and raised to four.');
      updateHud();return;
    }
    if(target===door){
      if(n<3){notify('The gong waits for all three watchfires.');return;}
      bell(146.8);tone(220,3,.11,'sine',.6);wisps=wisps.filter(w=>w.roams);
      stage=0;player.hp=letter===2?4:3;updateHud();
      notify('A pilot answers the gong. “We’re aground! Find the crank pin at Salt Quay.”');return;
    }
    if(stage>=0){
      if(stage===3){notify(Reach.orders[3].entry);return;}
      burst(target.x,target.y,24,24,'#f0c993');bell(stage===4?196:330);
      if(stage===4){
        rescued=true;modal('won');updateHud();view.classList.add('homecoming');
        arrival=matchMedia('(prefers-reduced-motion: reduce)').matches?1:0;
        showArrival();return;
      }
      if(stage===2)spawnShade('warden',target.x+55,target.y+48,true);
      stage++;updateHud();
      notify(['','Brass pin recovered. Take it across the eastern footbridge.','Water runs through the sluice. The ferry needs a light on the headland.','The bell warden rises. Dash through the ring when it reaches you.'][stage]);return;
    }
    target.lit=true;burst(target.x,target.y,20,32,'#edae60');bell([261.6,329.6,392][n]);updateHud();
    notify(n===2?'All fires are lit. Return to the gatehouse gong.':'A shade stirs. Strike with Space to drive it off.');
    spawnShade('shade',target.x+(target.x>300?-80:100),target.y+75);
  }
  function blocked(x,y,z=0){
    const b=Survey.bounds;
    if(x<b.west||x>b.east||y<b.north||y>b.south)return true;
    if(z<15&&Math.abs(y-187)<5&&rails.some(([a,b])=>x>a-3&&x<b+3))return true;
    if(z<4&&Survey.overPool(x,y))return true;
    if(Math.abs(y-Art.riverY(x))<38 && !Art.bridgeXs.some(b=>Math.abs(x-b)<21))return true;
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
      if(!blocked(player.x+vx*dist,player.y,player.z))player.x+=vx*dist;
      if(!blocked(player.x,player.y+vy*dist,player.z))player.y+=vy*dist;
    }
    if(player.attack<=0)player.angle=Math.atan2(-dx,dy);

  }
  function jump(){
    if(mode!=='play'||player.airTime>0||player.jumpCooldown>0||player.attack>0||player.dashTime>0)return;
    window.playerCount?.recordPlay();player.airTime=jumpDuration;
    player.safeX=player.x;player.safeY=player.y;
    sample('dash',.24,1.35);
  }
  function advanceJump(dt){
    player.jumpCooldown=Math.max(0,player.jumpCooldown-dt);
    if(player.airTime<=0)return;
    player.airTime=Math.max(0,player.airTime-dt);
    const u=1-player.airTime/jumpDuration;player.z=4*jumpPeak*u*(1-u);
    if(!blocked(player.x,player.y)){player.safeX=player.x;player.safeY=player.y;}
    if(player.airTime===0){
      if(blocked(player.x,player.y)){
        player.x=player.safeX;player.y=player.safeY;notify('Short landing. Take a run at the gap and hold your direction.');
      }
      player.jumpCooldown=.14;footfall();burst(player.x,player.y,1,7,'#c6b99b');
    }
  }
  function dash(){
    if(mode!=='play'||player.dashCooldown>0||player.airTime>0)return;
    window.playerCount?.recordPlay();
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
    burst(player.x,player.y,5,14,'#e4bf8d');sample('dash',.72,1.24);
  }
  function strike(angle){
    if(mode!=='play'||player.dashTime>0||player.airTime>0)return;
    const now=performance.now();
    if(player.attack>0){
      if(player.form==='slash'&&now-lastPress<=360)player.queued=true;
      return;
    }
    if(player.cooldown>0)return;
    window.playerCount?.recordPlay();
    if(typeof angle==='number')player.angle=angle;
    lastPress=now;swingNumber++;player.form='slash';player.attack=duration.slash;
    player.queued=false;swordTrail=[];
  }
  function sweepBlade(oldPhase,phase,from,to){
    const combo=player.form==='counter',windows=combo?[[.18,.46,'return'],[.59,.80,'finish']]:[[.31,.61,'cut']];
    for(const [start,end,sound] of windows){
      if(oldPhase<start&&phase>=start)sample(sound,combo?.90:.84,.96+rand()*.08);
      const lo=Math.max(start,oldPhase),hi=Math.min(end,phase);
      if(lo>=hi)continue;
      const stroke=swingNumber*3+(combo?(sound==='return'?1:2):0);
      // Sample the moving blade along the arc, even between rendered frames.
      const steps=Math.max(1,Math.ceil((hi-lo)*85));
      for(let j=0;j<=steps;j++){
        const at=lo+(hi-lo)*j/steps,u=(at-oldPhase)/(phase-oldPhase);
        const x=from[0]+(to[0]-from[0])*u,y=from[1]+(to[1]-from[1])*u;
        const {guard,tip}=Keeper.edgePath(player.angle,at,player.form);
        const gx=x+guard[0],gy=y+guard[1],dx=tip[0]-guard[0],dy=tip[1]-guard[1],len=dx*dx+dy*dy;
        for(let i=wisps.length-1;i>=0;i--){
          const w=wisps[i];if(w.hitStroke===stroke||Math.hypot(w.x-x,w.y-y)>73)continue;
          const hits=[5,14,23].some(h=>{
            const px=w.x-gx,py=w.y-h-gy;
            const k=Math.max(0,Math.min(1,(px*dx+py*dy)/(len||1)));
            return Math.hypot(px-k*dx,py-k*dy)<9;
          });
          if(!hits)continue;
          for(let k=0;k<22;k++)sparks.push({x:w.x,y:w.y-14,dx:(rand()-.5)*63,dy:(rand()-.65)*47,life:.3+rand()*.5,color:'#f4cd9e',glyph:'+'});
          w.hitStroke=stroke;w.hp--;w.flash=.16;shake=2.2;tone(94,.19,.055,'triangle',0,37);
          if(w.hp===0){
            wisps.splice(i,1);
            if(w.kind==='warden'){stage=4;bell(261.6);updateHud();notify('The bell falls silent. Light the beacon for the pilot.');}
          }
        }
        if(j>0)swordTrail.push({x:gx+dx,y:gy+dy,gx,gy,life:.165,stroke:start});
      }
    }
  }
  function cycleZoom(){intro=false;const levels=[1,2.7,6.6,8];wantedZoom=levels.find(v=>v>wantedZoom+.12)||1;}
  function hurt(source,clearance=Infinity){
    if(player.invuln>0||player.z>clearance||mode!=='play')return false;
    player.hp--;player.invuln=1.9;shake=4;flashUntil=t+.16;updateHud();tone(90,.4,.12,'triangle',0,36);
    if(!player.hp)modal('lost');else notify(source+' struck. Dash clear or answer with a cut.');
    return true;
  }
  function nextWaypoint(target){
    const {x,y}=player,bank=Art.riverY(x);
    let point=target;
    if((y-bank)*(target.y-Art.riverY(target.x))<0){
      const cost=bx=>Math.hypot(x-bx,y-Art.riverY(bx))+Math.hypot(target.x-bx,target.y-Art.riverY(bx));
      const bx=Art.bridgeXs.reduce((a,b)=>cost(a)<cost(b)?a:b);
      const side=Math.sign(y-bank);
      point={x:bx,y:Art.riverY(bx)+(Math.abs(x-bx)<15?-side:side)*52,name:'Footbridge'};
    }else if(Math.abs(y-bank)<38&&Math.abs(target.y-bank)>42){
      const bx=Art.bridgeXs.find(b=>Math.abs(x-b)<21);
      if(bx!==undefined)point={x:bx,y:Art.riverY(bx)+Math.sign(target.y-bank)*52,name:'Footbridge'};
    }
    if((y-187)*(point.y-187)<0){
      const crossX=x+(point.x-x)*(187-y)/(point.y-y);
      if(rails.some(([a,b])=>crossX>a-4&&crossX<b+4)){
        const cost=g=>Math.hypot(x-g,y-187)+Math.hypot(point.x-g,point.y-187);
        const g=[-600,-29,345,595].reduce((a,b)=>cost(a)<cost(b)?a:b);
        return {x:g,y:187+(Math.abs(x-g)<15?-1:1)*Math.sign(y-187)*12,name:'Court opening'};
      }
    }
    return point;
  }
  function update(dt){
    t+=dt;elapsed+=dt;player.moving=false;player.cooldown=Math.max(0,player.cooldown-dt);player.invuln=Math.max(0,player.invuln-dt);
    advanceJump(dt);
    if(intro&&elapsed>3.5){wantedZoom=2.7;intro=false;}
    player.dashCooldown=Math.max(0,player.dashCooldown-dt);
    const before=project(player.x,player.y);
    if(player.dashTime>0){
      const portion=Math.min(dt,player.dashTime);
      move(player.dashX,player.dashY,portion,460);
      player.dashTime-=portion;
    }else if(player.attack>0){
      const phase=1-player.attack/duration[player.form],combo=player.form==='counter';
      if(combo?(phase>.15&&phase<.47):(phase>.30&&phase<.52))
        move(-Math.sin(player.angle),Math.cos(player.angle),dt,combo?152:82);
    }else{
      move(Number(keys.has('right'))-Number(keys.has('left')),Number(keys.has('down'))-Number(keys.has('up')),dt);
    }
    player.pose+=(Number(player.dashTime>0)-player.pose)*(1-Math.exp(-dt*14));
    const p=project(player.x,player.y),vx=dt?(p[0]-before[0])/dt:0,vd=dt?(p[1]-before[1])/(dt*.74):0;
    const distance=Math.hypot(p[0]-before[0],(p[1]-before[1])/.74);
    player.moving=distance>.02;
    if(player.moving){
      window.playerCount?.recordPlay();
      const speed=player.dashTime>0?.063:.108;
      player.walk+=distance*speed;
      const step=Math.floor(player.walk/Math.PI);
      if(step!==player.stepCount){player.stepCount=step;if(player.airTime<=0)footfall();}
    }
    for(const trace of swordTrail)trace.life-=dt;
    swordTrail=swordTrail.filter(trace=>trace.life>0);
    if(player.attack>0){
      const len=duration[player.form],old=1-player.attack/len;
      player.attack=Math.max(0,player.attack-dt);
      const phase=1-player.attack/len;
      sweepBlade(old,phase,before,p);
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
    if(player.moving&&player.airTime<=0&&Math.floor(elapsed*12)!==Math.floor((elapsed-dt)*12)){
      paths.push({x:p[0],y:p[1]-1,life:1.1});
      if(rand()<.45)burst(player.x,player.y,20,1,'#c18958');
    }
    for(const w of wisps){
      const attack=Shades.update(w,dt,t,p,bolts,hurt);
      if(attack==='warden')bell(82.4);
      if(attack==='moth')tone(790,.22,.048,'sine',0,390);
      if(attack==='stalker')sample('dash',.28,1.44);
      if(mode==='lost')return;
    }
    for(const bolt of bolts){
      bolt.life-=dt;bolt.x+=bolt.vx*dt;bolt.y+=bolt.vy*dt;
      if(Math.hypot(bolt.x-p[0],bolt.y-p[1])<9&&player.z<18){bolt.life=0;hurt('Lantern moth');}
    }
    bolts=bolts.filter(b=>b.life>0);
    if(mode==='lost')return;
    for(const s of sparks){s.x+=s.dx*dt;s.y+=s.dy*dt;s.dy+=12*dt;s.life-=dt;}sparks=sparks.filter(s=>s.life>0);
    for(const s of paths)s.life-=dt;paths=paths.filter(s=>s.life>0);
    const tracking=1-Math.exp(-dt*6.5);zoom+=(wantedZoom-zoom)*tracking;
    if(Math.abs(wantedZoom-zoom)<.014)zoom=wantedZoom;
    camX+=(p[0]+30/zoom-camX)*tracking;camY+=(p[1]-18-99/zoom-camY)*tracking;
    shake=Math.max(0,shake-dt*12);
    const action=player.airTime>0?'Jumping':player.attack>0?(player.form==='counter'?'Crossing lunge':player.queued?'Follow-up queued':'Crescent slash'):player.dashTime>0?'Shadow step':player.moving?'Walking':'On watch';
    if($('moveName').textContent!==action)$('moveName').textContent=action;
    $('dashFill').style.transform='scaleX('+Math.min(1,1-player.dashCooldown/.85)+')';
    const dashStatus=player.dashCooldown>0?'Recovering':'Dash ready';
    if($('dashLabel').textContent!==dashStatus)$('dashLabel').textContent=dashStatus;
    active=player.airTime>0?null:nearTarget();
    let prompt=active&&!(stage===3&&active===Reach.beacon)?(coarsePointer.matches?'[ Use ]  ':'[ E ]  ')+actionFor(active):'';
    const fenDx=Math.abs(player.x-Survey.fen.x),fenDy=Math.abs(player.y-Survey.fen.y);
    if(!prompt&&!player.airTime&&fenDx<87&&fenDy<80&&(fenDx>48||fenDy>38)){
      prompt=(coarsePointer.matches?'[ Jump ]':'[ J ]')+'  Jump the reed cut';
    }
    if($('interaction').textContent!==prompt)$('interaction').textContent=prompt;
    const bank=Art.riverY(player.x);
    const area=Survey.area(player.x,player.y)||Reach.area(player.x,player.y)||(Math.abs(player.y-bank)<55?'Reedwater crossing':player.y>bank?'Kiln terrace':player.x>570?'Dyers market':player.x< -560?'Cedar grove':player.y>190?'River meadow':'Lantern court');
    const goals=trackedSite?[trackedSite]:trackLetter?[letterSite()]:dutySites();
    let bearing='Explore Reedwater · Open the atlas';
    if(goals.length){
      const target=goals.reduce((a,b)=>Math.hypot(player.x-a.x,player.y-a.y)<Math.hypot(player.x-b.x,player.y-b.y)?a:b);
      const waypoint=nextWaypoint(target);
      const [dx,dy]=project(waypoint.x-player.x,waypoint.y-player.y);
      const arrow=['E','SE','S','SW','W','NW','N','NE'][(Math.round(Math.atan2(dy,dx)/(Math.PI/4))+8)%8];
      bearing=(trackedSite?'Survey · ':trackLetter?'Letter · ':'')+waypoint.name+' / '+arrow;
    }
    if($('bearing').textContent!==bearing)$('bearing').textContent=bearing;
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
  function keeperSprite(){
    const swing=player.attack>0?1-player.attack/duration[player.form]:0;
    return Art.pilgrim(player.angle,player.walk,swing,t,player.cloth,player.pose,player.moving,player.form,player.z/jumpPeak);
  }
  function hero(x,y){
    for(let i=1;i<swordTrail.length;i++){
      const a=swordTrail[i-1],b=swordTrail[i];
      if(a.stroke!==b.stroke||Math.hypot(a.x-b.x,a.y-b.y)<.3)continue;
      const fade=b.life/.165,color=player.form==='counter'?'#ffc985':'#e4eeec';
      // Keep the void between arm and blade visible. Only the outer part
      // of the arc gets a wash, with loose glyphs marking its bright edge.
      ctx.globalAlpha=.15*fade;ctx.fillStyle=color;ctx.beginPath();
      ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.lineTo(b.x*.77+b.gx*.23,b.y*.77+b.gy*.23);
      ctx.lineTo(a.x*.77+a.gx*.23,a.y*.77+a.gy*.23);ctx.closePath();ctx.fill();
      const span=Math.hypot(a.x-b.x,a.y-b.y),count=Math.ceil(span/1.6);
      for(let j=0;j<count;j++){
        const u=j/count,dx=a.x+(b.x-a.x)*u,dy=a.y+(b.y-a.y)*u;
        ctx.globalAlpha=.88*fade;glyph(ctx,j%3?'-':'+',dx,dy,color,2.15);
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
    for(let y=Math.floor(minY/216)*216;y<maxY;y+=216)
      for(let x=Math.floor(minX/288)*288;x<maxX;x+=288)Art.draw(g,meadow,x,y);
    Survey.terrain(g,minX,minY,maxX,maxY);
    Art.draw(g,ground);
    for(const w of water){
      const [x,y]=w.point;
      if(x>minX-280&&x<maxX+80&&y>minY-130&&y<maxY+65)Art.draw(g,w.sprite,x,y);
    }
    Reach.terrain(g,minX,minY,maxX,maxY);
    for(const bx of Art.bridgeXs)Art.draw(g,crossing,...project(bx,Art.riverY(bx)));
    for(const q of props){
      if(q.type!=='woods')continue;
      const [x,y]=project(q.x,q.y),s=q.sprite;
      if(x+s.left+s.w>=minX&&x+s.left<=maxX&&y+s.top+s.h>=minY&&y+s.top<=maxY)Art.draw(g,s,x,y);
    }
    g.fillStyle='rgba(3,4,9,.45)';g.beginPath();
    [[-194,0],[194,0],[217,30],[-171,30]].forEach(([a,b],i)=>{const p=project(a,b);if(i)g.lineTo(...p);else g.moveTo(...p);});g.fill();
    Art.draw(g,gatehouse);
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
  function ferryPosition(){
    const travel=arrival*arrival*(3-2*arrival),x=1360-travel*132;
    return [x,Art.riverY(x)+4-travel*31];
  }
  function showArrival(){
    const [x,y]=project(...ferryPosition());
    zoom=wantedZoom=1.85;camX=x;camY=y+height/(fit*zoom)*.14;
    render();
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
    const lift=player.z/jumpPeak;
    shadow(px+3,py+.6,15-4*lift,4-lift,.95-.34*lift);
    const figure=keeperSprite();
    ctx.save();ctx.translate(px,py);ctx.transform(1,.04,-.67,.19,0,0);
    ctx.globalAlpha=.77-.38*lift;ctx.drawImage(figure.shadow,figure.left+player.z*.48,figure.top,figure.w,figure.h);ctx.restore();
    for(const p of paths){ctx.globalAlpha=Math.min(1,p.life)*.55;glyph(ctx,'.',p.x,p.y,'#e0b08a',4);}ctx.globalAlpha=1;
    const visible=[];
    const boat=ferryPosition(),[boatX,boatY]=project(...boat);
    if(boatX>minX-70&&boatX<maxX+70&&boatY>minY-30&&boatY<maxY+70){
      visible.push({depth:boat[1],paint:()=>{
        const bob=stage>=2?Math.sin(t*2.5)*1.1:0;
        Art.draw(ctx,ferryBoat,boatX,boatY+bob);
        glow(boatX+35,boatY-18+bob,13,'#ffac69',.3);
      }});
    }
    for(const q of props){
      if(q.type==='woods'||(q.type==='bag'&&letter!==0))continue;
      const [x,y]=project(q.x,q.y),sp=q.sprite;
      if(x+sp.left+sp.w<minX||x+sp.left>maxX||y+sp.top+sp.h<minY||y+sp.top>maxY)continue;
      // Depth follows the object's baseline at the actor's horizontal position.
      const depth=q.type==='gatehouse'?-100:q.type==='woods'?-600:q.y;
      visible.push({depth,paint:()=>{
        if(q.type!=='gatehouse'){
          const coversKeeper=depth>player.y&&sp.h>58&&px+8>x+sp.left&&px-8<x+sp.left+sp.w&&py-player.z-7>y+sp.top&&py-player.z-35<y+sp.top+sp.h;
          if(coversKeeper)ctx.globalAlpha=.37;
          Art.draw(ctx,sp,x,y);ctx.globalAlpha=1;
        }
        if(q.type.startsWith('fire'))fire(x,y,Number(q.type.slice(4)));
        const station=Survey.stations.find(site=>site.id===q.type);
        if(station){
          const inked=station===Survey.desk?charted:findings.has(station.id);
          if(!inked||station===trackedSite)marker(x,y-station.height);
          if(inked)glow(x,y-station.height+18,9,'#a9d7bf',.38);
        }
        if(q.type==='fold'){
          glow(x,y-19,22,'#f7a45d',.28);
          for(let i=0;i<8;i++){const u=(i/8+t*.9)%1;glyph(ctx,'*',x+Math.sin(i+t*4)*3,y-17-u*12,'#ffc283',4-u*2);}
        }
        if(q.type==='blind'||q.type==='fen'){
          for(let i=0;i<3;i++){
            const bx=x-24+i*17,by=y+9+3*Math.sin(t*.65+i);
            glyph(ctx,'~',bx,by+2,'#718c85',5);glyph(ctx,'v',bx,by,'#d2ccac',6);
          }
        }
        if(q.type==='mill'){
          for(let i=0;i<14;i++){
            const u=(t*.86+i*.17)%1;
            glyph(ctx,i%3?'~':'+',x+32+Math.sin(i*12)*5-u*8,y+12+u*12,'#a5c2b7',3.5);
          }
        }
        if(q.type==='stars'){
          const a=t*.22;
          glyph(ctx,'+',x+34*Math.cos(a),y-78+31*Math.sin(a),'#ead9a4',5);
        }
        if(q.type==='wreck'&&stage===0)marker(x,y-74);
        if(q.type==='sluice'){
          if(stage===1)marker(x,y-75);
          if(stage>=2)for(let i=0;i<22;i++){
            const u=(t*.8+i*.137)%1;
            glyph(ctx,i%3?'~':'+',x+(i%8)*3-11-u*15,y+2+u*15,'#a6ccbf',3.8);
          }
        }
        if(q.type==='beacon'){
          if(stage>=2&&stage!==3)marker(x,y-132);
          if(rescued)glow(x,y-93,48,'#ffe0a4',.85);
        }
        if(q.type==='bag'||(q.type==='shrine'&&letter===1))marker(x,y-(q.type==='bag'?23:53));
        if(q.type==='shrine'&&letter===2)glow(x,y-16,14,'#ffba72',.52);
        if(q.type==='gatehouse'){
          for(const lamp of [-166,-82,82,166]){const [lx,ly]=project(lamp,15,78);glow(lx,ly,19,'#e6a265',.11+.025*Math.sin(t*4+lamp));}
          if(stage<0&&flames.every(f=>f.lit)){const p=project(door.x,6,107);marker(...p,true);}
        }
      }});
    }
    for(const e of echoes)visible.push({depth:e.depth,paint:()=>{
      ctx.globalAlpha=.48*(e.life/.24);Art.draw(ctx,e.sprite,e.x,e.y);ctx.globalAlpha=1;
    }});
    visible.push({depth:player.y,paint:()=>hero(px,py-player.z)});
    for(const w of wisps){
      if(w.x<minX-140||w.x>maxX+140||w.y<minY-100||w.y>maxY+100)continue;
      visible.push({depth:(w.y-.275*w.x)/(.58+.275*.77),paint:()=>Shades.draw(ctx,w,t,glyph,glow)});
    }
    visible.sort((a,b)=>a.depth-b.depth);for(const q of visible)q.paint();
    for(const bolt of bolts){
      glow(bolt.x,bolt.y-12,6,'#aee9de',.4);
      glyph(ctx,'*',bolt.x-2,bolt.y-10,'#cff8df',6);
    }
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
  const movementPointers=new Map();
  function syncKeys(){
    keys=new Set([...pressed].map(code=>mapping[code]));
    for(const button of movementPointers.values())keys.add(button.dataset.move);
  }
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
    if($('atlas').open){
      if(e.code==='Escape'||e.code==='KeyG'){e.preventDefault();if(!e.repeat)$('atlas').close();}
      return;
    }
    if($('guide').open){
      if(e.code==='Escape'){e.preventDefault();$('guide').close();}
      return;
    }
    if(e.altKey||e.ctrlKey||e.metaKey)return;
    if(e.code==='KeyG'){e.preventDefault();if(!e.repeat)openAtlas();return;}
    if(e.code==='Escape'&&!e.repeat){e.preventDefault();pause();return;}
    if(mode!=='play')return;
    if(e.code==='KeyJ'){e.preventDefault();if(!e.repeat)jump();return;}
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
  function clearInput(){
    pressed.clear();
    for(const button of movementPointers.values())button.removeAttribute('data-held');
    movementPointers.clear();
    keys.clear();lastPress=-Infinity;
  }
  window.addEventListener('blur',clearInput);document.addEventListener('visibilitychange',()=>{clearInput();if(document.hidden&&mode==='play'&&initialized)modal('pause');});
  $('resume').onclick=()=>{clearInput();if(mode==='pause')unpause();else reset();};
  $('explore').onclick=()=>{
    arrival=1;view.classList.remove('homecoming');unpause();wantedZoom=zoom=2.7;
    const [x,y]=project(player.x,player.y);camX=x;camY=y-55;
    updateHud();notify('The ferry is home. Open the atlas to pick your next stop.');
  };
  $('pause').onclick=()=>{clearInput();pause();};$('sound').onclick=()=>{toggleSound();world.focus({preventScroll:true});};
  $('zoom').onclick=()=>{if(mode==='play')cycleZoom();world.focus({preventScroll:true});};
  world.addEventListener('wheel',e=>{e.preventDefault();intro=false;if(mode==='play')wantedZoom=Math.max(.8,Math.min(8.5,wantedZoom*Math.exp(-Math.sign(e.deltaY)*.18)));},{passive:false});
  world.addEventListener('pointerdown',e=>{
    if(e.pointerType==='touch'||e.button!==0||mode!=='play')return;
    world.focus({preventScroll:true});const rect=world.getBoundingClientRect(),s=fit*zoom,[x,y]=project(player.x,player.y,23);
    const dx=(e.clientX-rect.left-width*.5)/s+camX-x,dy=(e.clientY-rect.top-height*.5)/s+camY-y;
    strike(Math.atan2(-dx,dy));
  });
  const touchControls=$('touch');
  touchControls.addEventListener('contextmenu',e=>{if(e.target.closest('button'))e.preventDefault();});
  function releaseMovementPointer(e){
    const button=movementPointers.get(e.pointerId);
    if(!button)return;
    movementPointers.delete(e.pointerId);
    if(![...movementPointers.values()].includes(button))button.removeAttribute('data-held');
    syncKeys();
  }
  for(const button of touchControls.querySelectorAll('[data-move]')){
    button.addEventListener('pointerdown',e=>{
      if(mode!=='play'||e.button!==0)return;
      e.preventDefault();
      button.setPointerCapture(e.pointerId);
      movementPointers.set(e.pointerId,button);
      button.setAttribute('data-held','');
      syncKeys();
    });
    button.addEventListener('pointerup',releaseMovementPointer);
    button.addEventListener('pointercancel',releaseMovementPointer);
    button.addEventListener('lostpointercapture',releaseMovementPointer);
  }
  const touchActions={touchDash:dash,touchJump:jump,touchAttack:()=>strike(),touchUse:use};
  for(const [id,action] of Object.entries(touchActions)){
    const button=$(id);
    button.addEventListener('click',action);
    button.addEventListener('touchend',e=>{
      // Some browsers drop the click from a second finger while movement is held.
      e.preventDefault();
      const releasedOnButton=[...e.changedTouches].some(touch=>
        button.contains(document.elementFromPoint(touch.clientX,touch.clientY)));
      if(releasedOnButton)action();
    },{passive:false});
  }
  let guidePaused=false;
  $('openGuide').onclick=()=>{
    guidePaused=mode==='play';
    if(guidePaused){mode='guide';clearInput();syncMusic();}
    $('guide').showModal();
  };
  $('closeGuide').onclick=()=>$('guide').close();
  $('trackLetter').onclick=()=>{trackedSite=null;trackLetter=!trackLetter;updateHud();};
  $('guide').addEventListener('close',()=>{
    if(guidePaused){unpause();guidePaused=false;}else $('openGuide').focus();
  });
  let selectedSite=Survey.desk,atlasPaused=false;
  function atStation(){return Survey.stations.find(s=>Math.hypot(player.x-s.x,player.y-s.y)<42);}
  function showStation(site){
    selectedSite=site;
    for(const b of $('stations').children)b.setAttribute('aria-pressed',String(b.dataset.site===site.id));
    Survey.drawMap($('chart'),player,findings,site,dutySites(),visitedRests);
    $('waysideTitle').textContent='Wayside notes · '+visitedRests.size+' / '+Survey.rests.length;
    $('waysideLog').textContent=visitedRests.size?Survey.rests.filter(s=>visitedRests.has(s.id)).map(s=>s.name+' — '+s.finding).join('\n\n'):'Off the marked roads, look for the reedcutters’ shelter and a shepherds’ fire. Both offer a place to rest.';
    $('chart').setAttribute('aria-label','River chart. You are in '+$('area').textContent+'. Selected station: '+site.name+'.');
    $('surveyCount').textContent=charted?'Chart bound':findings.size+' / 3 records';
    $('stationTitle').textContent=site.name;
    if(site===Survey.desk){
      $('stationNote').textContent=charted?'Nao’s sheets are bound in river order again. The pilots will carry the keeper between all four survey stations.':
        findings.size===3?'Bring all three records to the desk and bind the river chart. The pilots can then take you between stations.':
        'At the west end of the gatehouse court, Nao left a chart with three empty margins. Collect the mill watermark, the flood marks and the star sighting in any order.';
    }else $('stationNote').textContent=findings.has(site.id)?site.finding:site.clue;
    $('pinStation').textContent=trackedSite===site?'Clear bearing':'Track on compass';
    $('pinStation').hidden=!atlasPaused;
    const from=atStation();
    const canTravel=charted&&atlasPaused&&player.airTime===0&&from&&from!==site;
    $('travelStation').hidden=!canTravel;
    $('travelHint').textContent=charted&&!from?'Return to a survey station to travel.':'';
  }
  function openAtlas(site){
    if($('atlas').open||$('guide').open)return;
    atlasPaused=mode==='play';
    if(atlasPaused){mode='atlas';clearInput();syncMusic();}
    $('atlas').showModal();showStation(site||trackedSite||Survey.desk);
  }
  for(const site of Survey.stations){
    const b=document.createElement('button');b.dataset.site=site.id;b.textContent=site.name;
    b.onclick=()=>showStation(site);$('stations').append(b);
  }
  $('openAtlas').onclick=()=>openAtlas();
  $('chart').onclick=e=>{
    const canvas=$('chart'),rect=canvas.getBoundingClientRect();
    const site=Survey.stations.find(s=>{
      const [x,y]=Survey.chartPoint(s.x,s.y);
      return Math.hypot(e.clientX-rect.left-x/canvas.width*rect.width,e.clientY-rect.top-y/canvas.height*rect.height)<17;
    });
    if(site)showStation(site);
  };
  $('closeAtlas').onclick=()=>$('atlas').close();
  $('pinStation').onclick=()=>{
    trackedSite=trackedSite===selectedSite?null:selectedSite;trackLetter=false;
    updateHud();$('atlas').close();
  };
  $('travelStation').onclick=()=>{
    if(!charted||!atlasPaused||player.airTime>0||!atStation()||atStation()===selectedSite)return;
    player.x=selectedSite.x;player.y=selectedSite.y+34;player.invuln=1.2;
    player.attack=0;player.queued=false;player.dashTime=0;swordTrail=[];echoes=[];
    const [x,y]=project(player.x,player.y);camX=x;camY=y-55;
    $('atlas').close();notify('Arrived at '+selectedSite.name+'.');
  };
  $('atlas').addEventListener('close',()=>{
    if(atlasPaused){unpause();atlasPaused=false;}else $('openAtlas').focus();
  });
  new ResizeObserver(resize).observe(view);resize();reset();
  function frame(now){
    const dt=last?Math.min((now-last)/1000,.045):0;last=now;
    if(mode==='play'){update(dt);render();}
    else if(mode==='won'&&arrival<1&&!$('guide').open&&!$('atlas').open&&!document.hidden){
      t+=dt;arrival=Math.min(1,arrival+dt/6);showArrival();
    }
    initialized=true;requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
