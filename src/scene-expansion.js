import * as THREE from 'three';

const Y=.48, TAU=Math.PI*2;
export function formationFor(bossId,count=3){
  if(count===1)return {name:'独狼对峙',boss:[0,Y,-1.8],party:[[0,Y,3.6]]};
  const layouts={
    scout:{name:'路口初遇',boss:[0,Y,-.8],party:[[0,Y,2.5],[-2.5,Y,3.1],[2.5,Y,3.1]]},
    bulwark:{name:'旧哨所前',boss:[0,Y,-1.1],party:[[-1.5,Y,2.4],[1.6,Y,2.9],[0,Y,4.0]]},
    conduit:{name:'检修通道',boss:[0,Y,-1.5],party:[[-2.4,Y,2.3],[.3,Y,3.5],[2.6,Y,2.5]]},
    duelist:{name:'回廊迎击',boss:[0,Y,-1.5],party:[[-2.5,Y,2.5],[.2,Y,3.8],[2.8,Y,2.2]]},
    cantor:{name:'过滤站侧翼',boss:[1,Y,-.9],party:[[-3.8,Y,.8],[-1.6,Y,3.1],[1.5,Y,4]]},
    warden:{name:'栈桥纵队',boss:[0,Y,-2],party:[[-1.4,Y,2.1],[1.1,Y,3],[0,Y,4.9]]},
    golem:{name:'避难室前线',boss:[.5,Y,-1.4],party:[[-3,Y,1.8],[-.6,Y,4.1],[2.6,Y,3.2]]},
    weaver:{name:'书庭交涉',boss:[0,Y,-2],party:[[-2.8,Y,2.8],[0,Y,3.8],[2.8,Y,2.8]]},
    tide:{name:'检修平台错位',boss:[1.1,Y,-1.3],party:[[-3.4,Y,1],[-.8,Y,3],[2.1,Y,4]]},
    furnace:{name:'避开炉口',boss:[-.6,Y,-1.7],party:[[-3.8,Y,1.2],[.1,Y,3.8],[3,Y,1.8]]},
    orrery:{name:'观测环两翼',boss:[0,Y,-.5],party:[[-4,Y,0],[-1,Y,3.5],[3.4,Y,2.3]]},
    arbiter:{name:'执行台正面',boss:[0,Y,-2.2],party:[[-2.5,Y,3.5],[0,Y,2.2],[2.8,Y,3.8]]},
    final:{name:'总控接入阵线',boss:[0,Y,-1.4],party:[[-3.5,Y,1.8],[0,Y,4],[3.5,Y,1.8]]},
  };
  const layout=layouts[bossId]||layouts.duelist;
  return {name:layout.name,boss:[...layout.boss],party:layout.party.slice(0,count).map(p=>[...p])};
}

// Small two-move training foes have distinct silhouettes and animation pivots.
// Their metal housings reuse the same local art palette as later machines.
export function trainingEnemy(id,k){
  const {material,mesh,box,orb,rod,plate,ring,finishEnemy}=k;
  const root=new THREE.Group(),body=new THREE.Group();root.add(body);
  const bones={},animated=[];
  const dark=material('#1c3036',{metalness:.65,roughness:.4});
  const steel=material('#637a80',{metalness:.72,roughness:.34});
  const bronze=material('#b2925c',{metalness:.78,roughness:.37});
  const accent={scout:'#71d1bf',bulwark:'#ddb475',conduit:'#89b7ff'}[id];
  const light=material(accent,{emissive:accent,emissiveIntensity:1.35,roughness:.3});
  for(const name of ['head','rightArm','leftArm']){bones[name]=new THREE.Group();body.add(bones[name]);}
  if(id==='scout'){
    orb(body,dark,[.58,.42,.66],[0,.97,0],2);
    const shell=mesh(body,new THREE.SphereGeometry(.58,20,12,0,Math.PI*2,0,Math.PI*.58),steel,0,1.02,0,[1,.75,1.12]);
    for(const s of [-1,1]){
      const arm=bones[s<0?'leftArm':'rightArm'];arm.position.set(s*.49,1.05,0);
      for(const z of [-.38,.34]){
        rod(arm,bronze,[0,0,z],[s*.36,-.3,z*1.3],.065);
        orb(arm,dark,[.09,.09,.09],[s*.36,-.3,z*1.3],1);
        rod(arm,steel,[s*.36,-.3,z*1.3],[s*.46,-.91,z*1.5+.12],.065,.033,10);
        box(arm,dark,[.20,.08,.26],[s*.46,-.93,z*1.5+.16]);
      }
    }
    bones.head.position.set(0,1.12,.47);
    orb(bones.head,dark,[.29,.21,.25],[0,0,0],1);
    for(const s of [-1,1])orb(bones.head,light,[.058,.058,.028],[s*.12,.02,.225],1);
    for(const s of [-1,1]){
      rod(bones.head,bronze,[s*.12,.15,0],[s*.22,.49,-.02],.019,.008,8);
      orb(bones.head,light,[.035,.04,.035],[s*.22,.49,-.02],1);
    }
    const tail=ring(body,.20,.02,accent,1.18,.65);tail.position.z=-.6;tail.rotation.x=0;
    animated.push({object:tail,type:'orbitRing',axis:'z',speed:.2});
  }else if(id==='bulwark'){
    for(const s of [-1,1]){
      rod(body,steel,[s*.24,.23,0],[s*.23,1.16,0],.12,.14,12);
      orb(body,bronze,[.16,.17,.16],[s*.24,.65,.02],1);
      box(body,dark,[.39,.17,.60],[s*.24,.13,.15]);
    }
    mesh(body,new THREE.CylinderGeometry(.43,.31,.75,16),dark,0,1.53,0);
    plate(body,steel,[[-.39,.25],[.39,.25],[.32,-.29],[0,-.45],[-.32,-.29]],.13,[0,1.56,.29]);
    bones.head.position.set(0,2.15,0);orb(bones.head,dark,[.25,.3,.25],[0,0,0],1);
    plate(bones.head,steel,[[-.25,.23],[.25,.23],[.26,-.11],[0,-.25],[-.26,-.11]],.07,[0,0,.20]);
    box(bones.head,light,[.34,.04,.025],[0,.05,.29]);
    for(const s of [-1,1]){
      const arm=bones[s<0?'leftArm':'rightArm'];arm.position.set(s*.49,1.87,0);
      orb(arm,bronze,[.20,.2,.2],[0,0,0],1);rod(arm,dark,[0,0,0],[s*.20,-.62,.17],.10,.09,12);
    }
    plate(bones.leftArm,bronze,[[-.55,.31],[.10,.31],[.15,-.67],[-.2,-.89],[-.60,-.67]],.12,[0,-.25,.31]);
    plate(bones.leftArm,dark,[[-.47,.22],[.02,.22],[.06,-.62],[-.2,-.78],[-.51,-.62]],.04,[0,-.25,.45]);
    rod(bones.rightArm,bronze,[.20,-.50,.24],[.20,.37,.25],.055);
    orb(bones.rightArm,steel,[.18,.28,.18],[.20,.42,.25],1);
  }else{
    mesh(body,new THREE.CylinderGeometry(.39,.66,.3,16),dark,0,.21,0);
    for(const s of [-1,1]){
      rod(body,bronze,[s*.25,.37,0],[s*.50,1.30,0],.066);
      const arm=bones[s<0?'leftArm':'rightArm'];arm.position.set(s*.52,1.53,0);
      rod(arm,dark,[0,0,0],[s*.30,-.21,.20],.06);
      for(const y of [-.1,.02,.14])mesh(arm,new THREE.CylinderGeometry(.15,.15,.05,16),bronze,s*.26,y,.20);
      orb(arm,light,[.09,.16,.09],[s*.26,.27,.20],1);
    }
    rod(body,steel,[0,.35,0],[0,2.12,0],.15);
    for(let i=0;i<5;i++){
      const y=.52+i*.27;
      mesh(body,new THREE.CylinderGeometry(.32,.24,.09,20),bronze,0,y,0);
      const band=ring(body,.24,.025,accent,y+.07,.85);
      animated.push({object:band,type:'coil',phase:i*.5});
    }
    bones.head.position.set(0,2.08,0);
    orb(bones.head,light,[.23,.32,.23],[0,0,0],2);
    for(const s of [-1,1])rod(bones.head,bronze,[s*.33,-.30,0],[s*.24,.45,0],.023);
    const halo=mesh(bones.head,new THREE.TorusGeometry(.42,.029,8,48),steel,0,0,0);
    halo.rotation.x=.3;animated.push({object:halo,type:'orbitRing',axis:'y',speed:.22});
  }
  return finishEnemy(id,root,body,bones,animated,accent,id==='scout'?1.9:2.65);
}

export function branchEnemy(id,k){
  const {material,mesh,box,orb,rod,plate,ring,finishEnemy}=k;
  const root=new THREE.Group(),body=new THREE.Group();root.add(body);
  const bones={},animated=[];
  for(const name of ['head','rightArm','leftArm']){bones[name]=new THREE.Group();body.add(bones[name]);}
  const dark=material('#202e39',{metalness:.7,roughness:.4});
  const steel=material('#6d838a',{metalness:.8,roughness:.3});
  const gold=material('#b7935b',{metalness:.75,roughness:.34});
  const accent={tide:'#67e8dc',furnace:'#ffa269',orrery:'#9fc8ff',arbiter:'#edb5c4'}[id];
  const light=material(accent,{emissive:accent,emissiveIntensity:1.5,roughness:.24});
  if(id==='tide'){
    // A mobile pressure bulkhead: central valve, two piston legs, pipe arms.
    box(body,dark,[1.72,2.24,.63],[0,2.36,0]);
    plate(body,steel,[[-.84,-.98],[.84,-.98],[1.02,.79],[.65,1.08],[-.65,1.08],[-1.02,.79]],.16,[0,2.36,.34]);
    const wheel=new THREE.Group();body.add(wheel);wheel.position.set(0,2.3,.66);
    mesh(wheel,new THREE.TorusGeometry(.64,.085,8,28),gold);
    for(let i=0;i<6;i++){const a=i/6*TAU;rod(wheel,gold,[0,0,0],[Math.cos(a)*.61,Math.sin(a)*.61,0],.035);}
    orb(wheel,light,[.22,.22,.09]);animated.push({object:wheel,type:'clockHand',speed:.2});
    for(const s of [-1,1]){
      rod(body,steel,[s*.55,1.45,0],[s*.86,.43,.3],.20,.15,10);box(body,dark,[.63,.23,.8],[s*.88,.18,.35]);
      const arm=bones[s<0?'leftArm':'rightArm'];arm.position.set(s*1.05,2.8,0);
      rod(arm,gold,[0,0,0],[s*.45,-.65,.25],.18);rod(arm,steel,[s*.45,-.65,.25],[s*.45,-1.2,.66],.24);
      mesh(arm,new THREE.TorusGeometry(.26,.06,6,18),gold,s*.45,-1.2,.82);
      orb(arm,light,[.17,.17,.045],[s*.45,-1.2,.86]);
      rod(body,gold,[s*.70,3.32,0],[s*.70,3.8,0],.12);mesh(body,new THREE.CylinderGeometry(.19,.19,.08,10),steel,s*.7,3.8,0);
    }
    bones.head.position.set(0,3.6,0);box(bones.head,dark,[.8,.4,.6]);box(bones.head,light,[.56,.065,.045],[0,0,.325]);
  }else if(id==='furnace'){
    // Four-legged furnace carrier with a hinged orange hearth and lifting fork.
    mesh(body,new THREE.CylinderGeometry(.87,1.08,1.65,10),dark,0,1.88,0);
    for(const y of [1.14,2.05,2.66])mesh(body,new THREE.TorusGeometry(y===1.14?1.04:.9,.072,6,24),gold,0,y,0).rotation.x=Math.PI/2;
    plate(body,gold,[[-.57,-.6],[.57,-.6],[.57,.45],[0,.73],[-.57,.45]],.1,[0,1.84,.84]);
    plate(body,light,[[-.43,-.48],[.43,-.48],[.43,.37],[0,.54],[-.43,.37]],.06,[0,1.84,.96]);
    for(let x=-.33;x<.4;x+=.16)rod(body,dark,[x,1.40,1.05],[x,2.24,1.05],.035);
    for(const s of [-1,1])for(const z of [-.68,.7]){
      rod(body,steel,[s*.67,1.30,z],[s*1.26,.7,z*1.35],.17);rod(body,dark,[s*1.26,.7,z*1.35],[s*1.46,.16,z*1.55],.16,.24);
      box(body,steel,[.53,.17,.66],[s*1.46,.15,z*1.55]);
    }
    for(const [i,x] of [-.49,.44].entries()){
      rod(body,dark,[x,2.58,-.22],[x,3.6+i*.34,-.22],.22);mesh(body,new THREE.CylinderGeometry(.28,.22,.14,10),gold,x,3.62+i*.34,-.22);
      const plume=orb(body,light,[.17,.33,.17],[x,3.87+i*.34,-.22]);animated.push({object:plume,type:'heart',y:3.87+i*.34});
    }
    bones.rightArm.position.set(1.05,2.4,0);rod(bones.rightArm,steel,[0,0,0],[.65,-.6,.3],.14);
    rod(bones.rightArm,gold,[.65,-.6,.3],[.65,-.6,1.25],.11);for(const x of [.37,.92])rod(bones.rightArm,steel,[x,-.6,1.15],[x,-1.2,1.15],.07);
    bones.head.position.set(0,2.91,.40);box(bones.head,steel,[.74,.3,.45]);box(bones.head,light,[.49,.07,.02],[0,0,.24]);
  }else if(id==='orrery'){
    // The observatory's instrument is all rotating graduated rings and lenses.
    mesh(body,new THREE.CylinderGeometry(.34,.9,.7,10),dark,0,.43,0);
    rod(body,gold,[0,.55,0],[0,2.3,0],.18);bones.head.position.set(0,2.65,0);
    orb(bones.head,material('#e7eeff',{emissive:'#e7eeff',emissiveIntensity:1.4}),[.47,.47,.47]);
    for(let i=0;i<3;i++){
      const frame=new THREE.Group();body.add(frame);frame.position.y=2.6;frame.rotation.set(.35+i*.6,.3*i,.32*i);
      mesh(frame,new THREE.TorusGeometry(1.2+i*.27,.07,7,56),i===1?steel:gold);
      const graduation=i<2?material('#f09c8d',{emissive:'#de6859',emissiveIntensity:1.2}):light;
      for(let j=0;j<16;j++){const a=j/16*TAU;const tick=box(frame,graduation,[.028,.14,.027],[Math.sin(a)*(1.2+i*.27),Math.cos(a)*(1.2+i*.27),0]);tick.rotation.z=-a;}
      animated.push({object:frame,type:'orbitRing',axis:i%2?'x':'y',speed:(i%2?-1:1)*(.14+i*.055)});
    }
    for(let i=0;i<4;i++){
      const a=i/4*TAU;const satellite=orb(body,i%2?steel:light,[.23,.33,.23]);
      animated.push({object:satellite,type:'prism',angle:a,y:2.7,radius:2.05});
    }
  }else{
    // A blindfolded executor carrying scales and a broad mechanical seal blade.
    const robe=material('#613a51'),paper=material('#d8cbb1');
    mesh(body,new THREE.CylinderGeometry(.45,.96,1.55,8),robe,0,1.14,0);
    box(body,dark,[.96,.94,.60],[0,2.28,0]);
    plate(body,gold,[[-.5,.4],[.5,.4],[.32,-.5],[0,-.7],[-.32,-.5]],.07,[0,2.3,.37]);
    plate(body,paper,[[-.30,.23],[.30,.23],[.21,-.39],[0,-.5],[-.21,-.39]],.03,[0,2.31,.455]);
    bones.head.position.set(0,3.20,0);orb(bones.head,steel,[.3,.39,.28]);box(bones.head,robe,[.66,.15,.09],[0,.07,.24]);
    plate(bones.head,paper,[[-.19,-.02],[.19,-.02],[.13,-.26],[0,-.35],[-.13,-.26]],.045,[0,0,.22]);
    for(let i=0;i<7;i++){
      const a=i/7*TAU;rod(body,gold,[Math.sin(a)*.44,1.82,Math.cos(a)*.44],[Math.sin(a)*.91,.42,Math.cos(a)*.91],.016);
      const leaf=plate(body,paper,[[-.08,.4],[.08,.4],[.07,-.35],[0,-.46],[-.07,-.35]],.018,[Math.sin(a)*.7,.98,Math.cos(a)*.7]);leaf.rotation.y=a;
    }
    for(let i=0;i<5;i++){box(body,dark,[.31-i*.025,.013,.012],[0,2.5-i*.12,.493]);}
    for(const s of [-1,1]){box(body,dark,[.42,.2,.58],[s*.41,.13,.23]);rod(body,gold,[s*.24,3.5,0],[s*.40,3.88,-.07],.036,.013);}
    for(const s of [-1,1]){
      const arm=bones[s<0?'leftArm':'rightArm'];arm.position.set(s*.7,2.68,0);orb(arm,gold,[.32,.20,.31]);rod(arm,dark,[0,0,0],[s*.28,-.85,.3],.12);
    }
    const blade=bones.rightArm;rod(blade,gold,[.26,-.64,.34],[.26,-1.04,.34],.065);
    plate(blade,steel,[[.01,-.84],[.51,-.84],[.51,-2.28],[.26,-2.62],[.01,-2.28]],.08,[0,0,.35]);
    rod(blade,light,[.26,-1.12,.46],[.26,-2.30,.46],.022);
    const scales=bones.leftArm;rod(scales,gold,[-.25,-.7,.38],[-.25,.64,.38],.045);rod(scales,gold,[-.92,.54,.38],[.42,.54,.38],.04);
    for(const x of [-.92,.42]){rod(scales,gold,[x,.54,.38],[x,-.08,.38],.016);mesh(scales,new THREE.ConeGeometry(.29,.13,10,1,true),gold,x,-.14,.38).rotation.x=Math.PI;}
    const halo=ring(body,1,.022,accent,3.85,.65);halo.rotation.x=.4;animated.push({object:halo,type:'orbitRing',axis:'y',speed:.14});
  }
  return finishEnemy(id,root,body,bones,animated,accent,id==='orrery'?4.5:4.2);
}

export function branchEnvironment(id,k,stage){
  const {material,mesh,box,rod,orb,ring}=k;
  const env=new THREE.Group();stage.scene.add(env);stage.environment=env;
  stage.flames=[];stage.fogSprites=[];stage.arenaCrystalMats=[];stage.environmentAnimated=[];
  const industrial=id==='floodworks';
  const dark=material(industrial?'#183338':'#202940',{metalness:.48}),steel=material(industrial?'#526d6b':'#5d617b',{metalness:.58});
  const trim=material('#a58b58',{metalness:.8});
  const color=industrial?'#62cec0':'#9ea9ff',light=material(color,{emissive:color,emissiveIntensity:.9});
  mesh(env,new THREE.CylinderGeometry(7.1,7.4,.4,industrial?8:24),dark,0,.15,0);
  mesh(env,new THREE.CylinderGeometry(6.98,7.0,.12,industrial?8:24),steel,0,.4,0);
  stage.arenaPulse=ring(env,2.7,.025,color,.48,.25);
  if(industrial){
    const water=material('#195d65',{metalness:.72,roughness:.16,transparent:true,opacity:.76});
    box(env,water,[24,.12,23],[0,-.35,0]);
    for(const side of [-1,1]){
      for(let i=0;i<8;i++){box(env,dark,[.12,1,.12],[side*6.3,.98,-4.4+i*1.2]);}
      rod(env,trim,[side*6.3,1.45,-4.6],[side*6.3,1.45,4.7],.047);
      for(let i=0;i<3;i++){
        rod(env,steel,[side*(7.7+i*.75),-.7,-6],[side*(7.7+i*.75),3.4,-6],.24);
        rod(env,steel,[side*(7.7+i*.75),3.4,-6],[side*(7.7+i*.75),3.4,6],.24);
        mesh(env,new THREE.TorusGeometry(.29,.06,6,18),trim,side*(7.7+i*.75),3.4,-3+i*2);
      }
    }
    box(env,dark,[8.8,5,.7],[0,2.1,-7]);
    for(let i=0;i<12;i++)box(env,steel,[.46,4.1,.16],[-3.7+i*.67,2.25,-6.5]);
    for(const x of [-5.4,5.4]){box(env,dark,[1.4,2,.8],[x,1.4,-4]);box(env,light,[1.1,.4,.04],[x,1.9,-3.55]);}
    for(let i=0;i<12;i++){const stripe=box(env,trim,[.13,.018,1.4],[-4.4+i*.8,.47,4.4]);stripe.rotation.y=-.45;}
    for(const z of [-4,-2,0,2])ring(env,7.8+z*.22,.012,color,-.23,.15);
  }else{
    for(const r of [1.5,3.5,5.5,6.7])ring(env,r,.019,'#b8a779',.476,.50);
    for(let i=0;i<24;i++){
      const a=i/24*TAU;rod(env,trim,[Math.sin(a)*5.6,.48,Math.cos(a)*5.6],[Math.sin(a)*6.7,.48,Math.cos(a)*6.7],.019);
      if(i%3===0){const x=Math.sin(a)*8.7,z=Math.cos(a)*8.7;mesh(env,new THREE.CylinderGeometry(.19,.34,5.6,10),dark,x,2,z);orb(env,light,[.12,.16,.12],[x,4.85,z]);}
    }
    for(let i=0;i<3;i++){
      const arch=mesh(env,new THREE.TorusGeometry(8.8+i*.35,.045,6,96,Math.PI*1.6),trim,0,.3,0);arch.rotation.set(.35+i*.42,0,.4*i);
      stage.environmentAnimated.push({object:arch,type:'starRing',phase:i});
    }
    for(let i=0;i<80;i++){
      const a=i*2.3999,r=10+(i%9)*.45;orb(env,light,[.02,.02,.02],[Math.sin(a)*r,1+(i%17)*.46,Math.cos(a)*r]);
    }
    for(const x of [-5.6,5.6]){box(env,dark,[1.9,1.1,.8],[x,1,-3.7]);const map=box(env,light,[1.65,.04,.72],[x,1.58,-3.7]);map.rotation.x=.23;}
  }
  stage.dust=stage.environmentDust(env,[color,'#b0cec9'],industrial?544:938);
}
