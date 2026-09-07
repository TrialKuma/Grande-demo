import {attackTheme,materialFor,impactTiming,damagingEvent,hitDamageFor} from './battle-feedback.js';
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));

/** A bounded, inspectable audio timeline sharing visual impact timing. */
export function attackSoundPlan(event,{speed=1,bossId='golem'}={}){
  const rate=clamp(Number(speed)||1,.5,3),timing=impactTiming(event),hits=clamp(Math.floor(timing.hits||event.hits||1),1,6);
  const theme=attackTheme({...event,bossId:event.bossId||bossId}),targets=(event.targets?.length?event.targets:[event.type==='boss'?'knibbs':'boss']).filter(id=>id&&id!==event.actor),targetBoss=event.bossId||bossId;
  const landed=damagingEvent(event),multiGain=1/Math.sqrt(1+(hits-1)*.6),pan=event.type==='boss'?.17:-.17;
  const lastDamage=Array.from({length:hits},(_,i)=>targets.some(id=>hitDamageFor(event,id,i)>0)?i:-1).reduce((n,i)=>Math.max(n,i),-1);
  const events=[];
  for(let i=0;i<hits;i++){
    const at=(timing.impactAt+i*timing.interval)/rate;
    const injured=targets.filter(id=>hitDamageFor(event,id,i)>0),loss=injured.reduce((n,id)=>n+hitDamageFor(event,id,i),0)/Math.max(1,injured.length);
    const materials=[...new Set(injured.map(id=>materialFor(id,targetBoss)))].slice(0,2);
    const absorbed=targets.reduce((n,id)=>n+(Array.isArray(event.hitAbsorbedAmounts?.[id])?Number(event.hitAbsorbedAmounts[id][i])||0:i===0?Number(event.absorbedAmounts?.[id])||0:0),0);
    const weight=clamp(.5+Math.sqrt(loss)/14,.55,1.15),heavy=loss>=55||['burst','quake'].includes(event.style);
    events.push({kind:'launch',at:Math.max(0,at-Math.min(.16,timing.impactAt)/rate),theme,weight:multiGain*.85,pan,hit:i});
    // Fully absorbed hits receive a shield ring instead of an invented body hit.
    if(absorbed>0)events.push({kind:'ward',at,theme,weight:multiGain*(loss>0?.28:.64),pan:-pan,hit:i});
    if(landed&&loss>0){
      for(const [j,material]of materials.entries())events.push({kind:'impact',at:at+j*.009/rate,theme,material,weight:weight*multiGain/(materials.length===2?1.3:1),heavy:heavy&&i===lastDamage,pan:-pan+(j?-.2:0),hit:i});
    }else if(!absorbed){
      events.push({kind:'contact',at,theme,weight:multiGain*.22,pan:-pan,hit:i});
    }
  }
  return {theme,hits,speed:rate,duration:timing.duration/rate,events};
}

/** Transients are timbral layers, not a louder copy of the old common hit. */
export function soundLayers(cue){
  const layers=[],gain=(cue.weight??1)*(cue.kind==='impact'?1.18:1),pan=cue.pan||0;
  const tone=(frequency,duration,amp,options={},offset=0)=>layers.push({type:'tone',frequency,duration,offset,options:{amp:amp*gain,pan,...options}});
  const noise=(duration,amp,frequency,endFrequency,options={},offset=0)=>layers.push({type:'noise',duration,offset,options:{amp:amp*gain,frequency,endFrequency,pan,...options}});
  if(cue.kind==='ward'){
    tone(730,.17,.055,{endPitch:960});tone(1468,.24,.024);noise(.08,.035,2600,900);return layers;
  }
  if(cue.kind==='contact'){
    tone(['ballistic','blade','surgery'].includes(cue.theme)?510:1174,.065,.04,{endPitch:720});return layers;
  }
  if(cue.kind==='launch'){
    switch(cue.theme){
      case 'ballistic':noise(.048,.145,1700,3800,{filter:'highpass'});tone(138,.11,.11,{endPitch:45});noise(.07,.028,720,220,{brown:true},.022);break;
      case 'blade':noise(.15,.1,430,4700,{q:.45,attack:.027});tone(380,.085,.027,{endPitch:145},.065);break;
      case 'arcane':tone(195,.15,.043,{wave:'triangle',endPitch:780,attack:.02});tone(390,.18,.028,{endPitch:1170});noise(.13,.03,4400,1400);break;
      case 'mind':noise(.075,.042,1600,3900,{q:.4});tone(440,.22,.041,{endPitch:660,attack:.045});tone(446,.2,.024,{endPitch:665,pan:-pan});break;
      case 'silverfire':tone(310,.15,.046,{wave:'sawtooth',endPitch:2100,cutoff:3400,endCutoff:900});noise(.13,.041,2200,5400,{filter:'highpass'});tone(83,.095,.042,{endPitch:60});break;
      case 'surgery':tone(1880,.048,.034,{endPitch:1410});noise(.058,.06,3400,680,{q:1.3},.019);tone(580,.055,.028,{wave:'triangle',endPitch:180},.04);break;
      case 'clockwork':tone(1680,.031,.044,{wave:'triangle'});tone(2370,.034,.026,{},.045);noise(.042,.04,950,3100,{q:2},.068);tone(523,.17,.029,{endPitch:1046},.015);break;
      case 'water':noise(.21,.087,280,1700,{brown:true,q:1.1,attack:.045});tone(155,.16,.041,{endPitch:470});noise(.11,.037,2800,1300,{},.068);break;
      case 'furnace':noise(.2,.078,650,170,{brown:true,filter:'lowpass'});tone(86,.18,.074,{wave:'triangle',endPitch:54});noise(.115,.046,4200,1900,{},.035);break;
      case 'lightning':for(let j=0;j<3;j++)noise(.025,.064,3100,750,{filter:'highpass'},j*.034);tone(1420,.1,.045,{wave:'sawtooth',endPitch:95,cutoff:4200});break;
      case 'spore':noise(.24,.065,470,1700,{q:1.8,attack:.055});tone(147,.22,.037,{endPitch:183,attack:.08,wave:'triangle'});tone(155,.2,.026,{endPitch:206,attack:.075});break;
      case 'crystal':for(const [j,f]of [740,1115,1970].entries())tone(f,.21-j*.04,.033/(1+j*.5),{endPitch:f*1.06},j*.03);noise(.08,.038,3600,1600,{filter:'highpass'});break;
      case 'edict':noise(.095,.06,1700,4800,{q:.3});tone(174,.17,.035,{wave:'square',cutoff:650,endCutoff:290});tone(261,.18,.026,{wave:'triangle'},.035);break;
      default:tone(440,.12,.045,{endPitch:880});
    }
    return layers;
  }
  // Resonant metal, stone chips, glass, pages and soft impacts have separate
  // spectra and decays. No hard material crunch is used for a fully blocked hit.
  switch(cue.material){
    case 'metal':noise(.055,.085,2800,850);for(const [j,f]of [620,1037,1711].entries())tone(f,.23/(1+j*.45),.048/(1+j),{endPitch:f*.94});break;
    case 'stone':noise(.22,.095,730,160,{brown:true,filter:'lowpass'});noise(.095,.056,2300,650,{},.018);tone(126,.12,.061,{endPitch:62});break;
    case 'crystal':noise(.045,.06,4500,1900,{filter:'highpass'});for(const [j,f]of [1240,1735,2890].entries())tone(f,.34-j*.05,.044/(1+j*.6),{},j*.012);break;
    case 'paper':noise(.055,.075,3700,1200,{q:.35});noise(.16,.044,1900,4400,{attack:.021},.028);tone(185,.054,.024,{endPitch:92});break;
    case 'cloth':noise(.095,.074,800,250,{q:.5});noise(.14,.023,1900,750,{},.015);tone(148,.075,.03,{endPitch:67});break;
    default:noise(.075,.075,420,190,{brown:true});tone(117,.095,.071,{endPitch:48});noise(.038,.03,1700,550);
  }
  // A heavy final blow receives an additional low thump and a short debris
  // tail; small rapid hits keep their own normalized gain and short decay.
  if(cue.heavy){tone(cue.material==='metal'?76:61,.28,.075,{endPitch:29});noise(.2,.045,cue.material==='crystal'?3400:1100,280,{brown:cue.material!=='crystal'},.025);}
  return layers;
}
