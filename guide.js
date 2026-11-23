(() => {
  const scenes=[
    ['close','Keeper portrait','Close camera','Wheel up or cycle C','A woven brim, a wrapped grip and rows of stitches catch the window light. Wind pulls at the hem even when the keeper stands still.'],
    ['walk','On foot','Movement','WASD / arrows','Reverse direction and the robe swings past the legs before settling. Each planted foot taps on the chapel paving and scuffs in the garden.'],
    ['yard','Chapel grounds','Wide camera','Wheel down or cycle C','Read the courtyard from above. The amber diamonds mark the three watchfires. Pass through the fence openings to reach the garden.'],
    ['dash','Shadow step','Dash','Shift + direction','Burst toward a gap or slip past a shade. Fading silhouettes mark the route. The gold meter fills when the next dash is ready.'],
    ['slash','Crescent slash','Single attack','Left click once','Aim with the pointer. The keeper draws the blade up, cuts across the body and returns to guard.'],
    ['combo','Crossing lunge','Double attack','Left click twice','A quick second press queues a lunging return cut and a descending finish after the opening slash.']
  ];
  const $=id=>document.getElementById(id),nav=$('techniques');
  function select(index){
    const [id,name,,key,copy]=scenes[index];
    for(const [i,button] of [...nav.children].entries())button.setAttribute('aria-pressed',String(i===index));
    $('still').srcset='media/'+id+'.webp';$('demo').src='media/'+id+'.gif';$('demo').alt=name+' captured from Cinder Vigil';
    $('demoKey').textContent=key;$('demoName').textContent=name;$('demoCopy').textContent=copy;
  }
  scenes.forEach(([id,name,type],i)=>{
    const button=document.createElement('button'),thumb=new Image(),label=document.createElement('span'),category=document.createElement('small');
    thumb.src='media/'+id+'.webp';thumb.alt='';category.textContent=type;label.append(category,document.createTextNode(name));
    button.append(thumb,label);button.onclick=()=>select(i);nav.append(button);
  });
  document.getElementById('openGuide').addEventListener('click',()=>{if(!$('demo').getAttribute('src'))select(0);});
})();
