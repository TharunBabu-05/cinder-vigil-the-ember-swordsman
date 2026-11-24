/* The river pilots' survey. Coordinates are shared by the chart, terrain and interactions. */
const Survey=(()=>{
  const bounds={west:-1780,east:1390,north:17,south:1710};
  const desk={id:'desk',name:'Survey desk',x:-123,y:113,action:'Read the pilots’ chart',height:39};
  const mill={id:'mill',name:'Mulberry Mill',x:-1460,y:208,action:'Take a watermark rubbing',height:92,
    clue:'Follow the cutters’ track beyond the cedar watchfire. Three sheets hang from the mill eaves.',
    finding:'A heron shows through the paper when held to the mill lamp. Nao stamped that bird into every chart she made for the ferry crews.'};
  const fen={id:'fen',name:'Heron Fen',x:-1280,y:850,action:'Copy the flood marks',height:91,
    clue:'Cross the western timber bridge and follow the reed beds. Hold a direction and jump the missing boards to reach the flood pole.',
    finding:'The high-water line cuts through three sets of initials. Each pilot came back after the flood to cut the next mark a hand higher.'};
  const stars={id:'stars',name:'Nine-Reed Observatory',x:-350,y:1450,action:'Sight the pilot star',height:132,
    clue:'Follow the pale stone road south of the kilns. A brass ring above the observatory frames the pilot star.',
    finding:'One notch in the brass is polished smooth. Through it, the pilot star sits directly above the old ferry landing, even when the river is lost in fog.'};
  const sites=[mill,fen,stars],stations=[desk,...sites];
  const rests=[
    {id:'blind',name:'Reedcutters’ blind',x:-1590,y:965,action:'Share the reedcutters’ tea',
      finding:'“We leave the tall stems for the herons.” Under the reed roof, two warm cups sit beside a pair of empty nests.'},
    {id:'fold',name:'Shepherds’ fold',x:310,y:1480,action:'Rest by the shepherds’ fire',
      finding:'Stone walls curl around a little fire. The shepherd on late watch counts returning ferry lamps to keep herself awake.'}
  ];
  const routes=[
    [[-770,225],[-970,225],[-1130,249],[-1270,227],[-1430,236],[-1460,345]],
    [[-1460,470],[-1510,552],[-1470,640],[-1390,715],[-1280,773]],
    [[-1280,930],[-1190,1015],[-1070,1085],[-935,1120],[-805,1225],[-655,1300],[-538,1363],[-352,1478]],
    [[120,650],[40,746],[-38,850],[-109,935],[-170,1045],[-180,1175],[-257,1320],[-352,1478]],
    [[480,963],[395,1070],[280,1195],[140,1320],[0,1395],[-170,1460],[-352,1478]]
  ];
  const patrols=[['moth',-1590,315],['stalker',-1550,693],['moth',-836,1174],['stalker',-145,1535]];
  const earth=[];
  function overPool(x,y){
    const dx=Math.abs(x-fen.x),dy=Math.abs(y-fen.y);
    return dx<69&&dy<59&&(dx>48||dy>38);
  }
  function area(x,y){
    if(y>1100)return x< -755?'The drovers’ track':x>510?'Shell downs':'Nine-Reed Highlands';
    if(x< -1030)return y<Art.riverY(x)-52?'Mulberry Mill':y>Art.riverY(x)+52?'Heron Fen':'Mill crossing';
    return '';
  }
  function scenery(post,obstacles,trees,stones){
    const sprites=[Art.surveyDesk(),Art.paperMill(),Art.floodpole(),Art.starHouse()];
    stations.forEach((s,i)=>{post(s.x,s.y,sprites[i],s.id);obstacles.push([s.x,s.y,[13,29,7,24][i]]);});
    const reeds=Art.reeds(),shed=Art.stall('#938c70'),marker=Art.stone(9);
    for(const [x,y] of [[-1570,155],[-1360,130],[-1630,230]]){post(x,y,shed);obstacles.push([x,y,22]);}
    const rng=Art.random(379);
    const marsh=Art.uplandGround(true),shale=Art.uplandGround(false),race=Art.millRace();
    for(let i=0;i<165;i++){
      const wet=i<55,x=wet?-1740+rng()*675:bounds.west+75+rng()*3000;
      const y=wet?505+rng()*580:1090+rng()*610;
      earth.push({point:Art.project(x,y),sprite:wet?marsh:shale});
    }
    for(let i=0;i<4;i++)earth.push({point:Art.project(mill.x+41,mill.y+10+i*51),sprite:race});
    for(let i=0;i<85;i++){
      const x=-1710+rng()*660,y=505+rng()*565;
      if(Math.hypot(x-fen.x,y-fen.y)>95)post(x,y,reeds);
    }
    for(let i=0;i<56;i++){
      const x=bounds.west+45+rng()*(bounds.east-bounds.west-90),y=1110+rng()*530;
      if(Math.abs(x-stars.x)<105&&Math.abs(y-stars.y)<100)continue;
      post(x,y,i%4?stones[i%3]:trees[i%3],i%4?'scenery':'tree');
      obstacles.push([x,y,i%4?6:12]);
    }
    for(let i=0;i<26;i++){
      const x=-1740+rng()*690,y=55+rng()*270;
      if(Math.abs(y-230)<44||Math.abs(x-mill.x)<94)continue;
      post(x,y,trees[i%3],'tree');obstacles.push([x,y,10]);
    }
    for(let i=0;i<9;i++){
      const a=i*Math.PI*2/9;
      post(stars.x+Math.cos(a)*84,stars.y+Math.sin(a)*70,marker);
    }
    for(const trail of routes)for(let i=1;i<trail.length;i+=2){
      const [x,y]=trail[i];post(x-19,y+16,marker);
    }
    const [blind,fold]=rests;
    post(blind.x,blind.y,Art.stall('#938e61'),blind.id);
    for(let i=0;i<14;i++)post(blind.x-34+i*5,blind.y-20+Math.sin(i)*5,reeds);
    post(fold.x,fold.y,Art.brazier(),fold.id);
    for(let i=0;i<12;i++){
      const a=i*.39;post(fold.x+48*Math.cos(a),fold.y+33*Math.sin(a),stones[i%3]);
    }
  }
  function terrain(c,left,top,right,bottom){
    for(const {point:[x,y],sprite:s} of earth){
      if(x+s.left<right&&x+s.left+s.w>left&&y+s.top<bottom&&y+s.top+s.h>top)Art.draw(c,s,x,y);
    }
  }
  function chartPoint(x,y){
    return [37+(x-bounds.west)/(bounds.east-bounds.west)*726,22+(y-bounds.north)/(bounds.south-bounds.north)*307];
  }
  function drawMap(canvas,player,found,selected,goals,visited){
    const c=canvas.getContext('2d'),w=canvas.width,h=canvas.height,xy=chartPoint;
    function path(points,color,width){
      c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(...xy(x,y)):c.moveTo(...xy(x,y)));
      c.lineWidth=width;c.strokeStyle=color;c.stroke();
    }
    c.fillStyle='#172123';c.fillRect(0,0,w,h);c.lineJoin='round';c.lineCap='round';
    c.strokeStyle='#2b3635';c.lineWidth=1;
    for(let x=36;x<w;x+=46){c.beginPath();c.moveTo(x,12);c.lineTo(x,h-12);c.stroke();}
    for(let y=22;y<h;y+=39){c.beginPath();c.moveTo(15,y);c.lineTo(w-15,y);c.stroke();}
    const river=[];
    for(let x=bounds.west-200;x<=bounds.east+200;x+=40)river.push([x,Art.riverY(x)]);
    path(river,'#627f80',13);path(river,'#344f59',9);
    for(const x of Art.bridgeXs)path([[x,Art.riverY(x)-55],[x,Art.riverY(x)+55]],'#d2b48b',3);
    c.setLineDash([2,4]);
    for(const trail of [...Reach.trails,...routes])path(trail,'#8a8271',1.5);
    c.setLineDash([]);
    function pin(x,y,color,r){
      const [px,py]=xy(x,y);c.beginPath();c.arc(px,py,r,0,2*Math.PI);c.fillStyle=color;c.fill();return [px,py];
    }
    function label(name,x,y,align='left',above=false){
      c.font=(canvas.clientWidth<500?'19px':'15px')+' Georgia, serif';c.textAlign=align;c.fillStyle='#e8dec9';c.strokeStyle='#172123';c.lineWidth=3;
      const textX=x+(align==='right'?-8:8),textY=y+(above?-9:16);
      c.strokeText(name,textX,textY);c.fillText(name,textX,textY);
    }
    for(const [name,x,y,align] of [['Cedar grove',-777,225],['Dyers’ market',755,133,'right'],['Kiln terrace',127,597],['Salt Quay',1230,284,'right'],['Pilot’s Beacon',480,940]]){
      const [px,py]=pin(x,y,'#a39883',2.5);label(name,px,py,align);
    }
    for(const goal of goals)pin(goal.x,goal.y,'#edaf70',4);
    for(const site of stations){
      const [x,y]=pin(site.x,site.y,found.has(site.id)?'#97caba':'#dfb980',4.2);
      if(site===selected){c.strokeStyle='#f2dba7';c.lineWidth=1.5;c.strokeRect(x-7,y-7,14,14);}
      label(site.name,x,y,'left',true);
    }
    for(const site of rests)if(visited.has(site.id)){
      const [x,y]=pin(site.x,site.y,'#bca4a2',3);label(site.name,x,y);
    }
    const [px,py]=pin(player.x,player.y,'#b5f1ec',4);
    c.beginPath();c.arc(px,py,7,0,2*Math.PI);c.strokeStyle='#b5f1ec';c.lineWidth=1.5;c.stroke();
  }
  return {bounds,desk,sites,stations,rests,fen,overPool,area,scenery,terrain,routes,patrols,drawMap,chartPoint};
})();
