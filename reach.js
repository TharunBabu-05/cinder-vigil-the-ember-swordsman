const Reach = (() => {
  const wreck={x:1230,y:284,name:'Salt Quay wreck',action:'Salvage the crank pin'};
  const sluice={x:1100,y:522,name:'East Sluice',action:'Fit the pin and open the sluice'};
  const beacon={x:480,y:940,name:'Pilot’s Beacon',action:'Call the bell warden'};
  const bag={x:154,y:128,name:'Dispatch satchel',action:'Take the pilot’s letter'};
  const shrine={x:744,y:786,name:'Pilots’ shrine',action:'Deliver the pilot’s letter'};
  const orders=[
    {site:wreck,title:'Salvage the crank pin',entry:'A broken ferry lies on the beach beyond the dyers’ market. Its brass pin fits the floodgate wheel.'},
    {site:sluice,title:'Open the east sluice',entry:'Take the pin over the eastern footbridge. Opening the sluice will give the night ferry enough water to clear the shoal.'},
    {site:beacon,title:'Call the bell warden',entry:'Follow the shell road uphill to the pilot’s tower. Its keeper still answers the bell.'},
    {site:beacon,title:'Defeat the bell warden',entry:'Watch the ground when the crown flashes. Dash through the widening ring, then close in while the bell is quiet.'},
    {site:beacon,title:'Light the pilot’s beacon',entry:'The lens is yours. Light it to show the ferry a safe passage home.'}
  ];
  const patrols=[['stalker',1040,208],['moth',1236,334],['stalker',1034,585],['moth',809,738]];
  const surfaces=[],paths=[];
  const trails=[
    [[902,144],[1022,157],[1147,239],[1221,302],[1120,344]],
    [[1120,455],[1119,547],[1050,611],[938,672],[815,723],[726,803],[590,850],[486,958]],
    [[145,634],[286,708],[449,745],[612,759],[726,803]]
  ];
  function scenery(post,obstacles){
    post(wreck.x,wreck.y,Art.wreck(),'wreck');
    post(sluice.x,sluice.y,Art.sluice(),'sluice');
    post(beacon.x,beacon.y,Art.beacon(),'beacon');
    post(bag.x,bag.y,Art.mailbag(),'bag');post(shrine.x,shrine.y,Art.waysideShrine(),'shrine');
    for(const [site,r] of [[wreck,17],[sluice,20],[beacon,16],[shrine,8]])obstacles.push([site.x,site.y,r]);
    const reeds=Art.reeds(),stone=Art.stone(12),pine=Art.tree(63,75);
    const rng=Art.random(773);
    for(let i=0;i<66;i++){
      const x=710+rng()*680,y=Art.riverY(x)+(i%2?1:-1)*(46+rng()*32);
      if(Math.abs(x-1120)>43)post(x,y,reeds);
    }
    for(const [x,y] of [[960,95],[1090,112],[1330,230],[1270,566],[945,578],[914,795],
      [812,864],[659,900],[664,1020],[346,925],[395,834],[247,865],[-210,858],[-430,970]]){
      post(x,y,pine,'tree');obstacles.push([x,y,10]);
    }
    for(const [x,y] of [[693,808],[716,833],[739,846],[433,953],[418,924],[462,890],[521,902]])
      post(x,y,stone);
    const rack=Art.fence(39);
    for(const [x,y] of [[1170,160],[1234,173],[1298,186]])post(x,y,rack);
    const pan=Art.saltPan(),boards=Art.dockBoards();
    for(let i=0;i<6;i++)surfaces.push([1140+i%3*62,157+Math.floor(i/3)*28,pan]);
    surfaces.push([1196,292,boards],[1084,Art.riverY(1100)+22,Art.spillway()],[1070,510,boards],[437,908,Art.beaconCourt()]);
    surfaces.push([Survey.fen.x,Survey.fen.y,Art.marshPool()]);
    for(const trail of [...trails,...Survey.routes]){
      for(let i=1;i<trail.length;i++){
        const a=Art.project(...trail[i-1]),b=Art.project(...trail[i]);
        paths.push({a,b,x:Math.floor(Math.min(a[0],b[0]))-11,y:Math.floor(Math.min(a[1],b[1]))-11,
          w:Math.ceil(Math.abs(a[0]-b[0]))+22,h:Math.ceil(Math.abs(a[1]-b[1]))+22});
      }
    }
  }
  function pathTile(p){
    const canvas=document.createElement('canvas');canvas.width=p.w*2;canvas.height=p.h*2;
    const ctx=canvas.getContext('2d');ctx.setTransform(2,0,0,2,-p.x*2,-p.y*2);
    ctx.lineCap='round';ctx.lineWidth=17;ctx.strokeStyle='#282d29';
    ctx.beginPath();ctx.moveTo(...p.a);ctx.lineTo(...p.b);ctx.stroke();
    const rng=Art.random(Math.round(p.x+p.y)),dx=p.b[0]-p.a[0],dy=p.b[1]-p.a[1],steps=Math.ceil(Math.hypot(dx,dy)*1.65);
    ctx.font='bold 4.1px Consolas, monospace';
    for(let j=0;j<steps;j++){
      ctx.fillStyle=j%5?'#697065':'#afa286';
      ctx.fillText('.,:v~'[j%5],p.a[0]+dx*j/steps+(rng()-.5)*17,p.a[1]+dy*j/steps+(rng()-.5)*15);
    }
    return canvas;
  }
  function terrain(ctx,minX,minY,maxX,maxY){
    function visible(x,y,pad){
      return x+pad>=minX&&x-pad<=maxX&&y+pad>=minY&&y-pad<=maxY;
    }
    ctx.save();ctx.lineCap='round';ctx.lineJoin='round';
    for(const p of paths){
      if(p.x>maxX||p.x+p.w<minX||p.y>maxY||p.y+p.h<minY)continue;
      p.tile??=pathTile(p);ctx.drawImage(p.tile,p.x,p.y,p.w,p.h);
    }
    for(const [x,y,sprite] of surfaces){
      const [px,py]=Art.project(x,y);
      if(visible(px,py,135))Art.draw(ctx,sprite,px,py);
    }
    ctx.restore();
  }
  function area(x,y){
    if(y>735)return x>640?'Pilots’ road':'Beacon headland';
    if(x>980&&y>Art.riverY(x)+55)return 'East Sluice';
    if(x>985&&y<Art.riverY(x)-55)return 'Salt Quay';
    return '';
  }
  return {wreck,sluice,beacon,bag,shrine,orders,trails,patrols,scenery,terrain,area};
})();
