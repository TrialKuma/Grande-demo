/** Original, locally synthesized miniatures. Notes are MIDI, lengths in beats. */
const theme=(name,bpm,steps,chords,melody,settings)=>({name,bpm,steps,chords,melody,...settings});
export const SCORE_THEMES=Object.freeze({
  prologue:theme('雾外的灯',72,16,[[50,53,57,64],[46,50,53,60],[48,52,55,62],[45,49,52,59]],[[74,81,77],[72,77,74],[76,79,74],[73,76,69]],{pad:'bow',lead:'glass',arp:'pluck',melodyAt:[0,7,12],arpAt:[2,6,10,14],arpPattern:[0,2,1,3],bassAt:[0,8],kick:[],brush:[12],ticks:[],level:.8}),
  camp:theme('还热着的茶',64,12,[[55,59,62,64],[52,55,59,62],[48,52,55,62],[50,54,57,62]],[[79,78,74],[76,74,71],[72,76,79],[78,74,69]],{pad:'warm',lead:'flute',arp:'wood',melodyAt:[0,4,9],arpAt:[0,3,6,9],arpPattern:[0,2,1,2],bassAt:[0],kick:[],brush:[6],ticks:[],level:.8}),
  crystal:theme('断层的回声',88,16,[[50,53,57],[48,52,57],[46,50,53],[45,49,52]],[[74,77,76,69],[72,76,81,79],[77,74,70,72],[73,76,69,73]],{pad:'bow',lead:'glass',arp:'glass',melodyAt:[0,5,8,14],arpAt:[2,6,10,14],arpPattern:[0,2,1,2],bassAt:[0,8],kick:[0,10],brush:[4,12],ticks:[6,14],level:1}),
  mirror:theme('镜刃圆舞',116,12,[[57,60,64],[53,57,60],[55,59,62],[52,56,59]],[[81,84,83],[81,76,77],[79,83,86],[80,83,76]],{pad:'chamber',lead:'pluck',arp:'bowShort',melodyAt:[0,3,8],arpAt:[2,4,8,10],arpPattern:[2,1,0,1],bassAt:[0,6],kick:[0],brush:[4,8],ticks:[2,10],level:.94}),
  spore:theme('苔下呼吸',73,12,[[48,51,55,58],[53,57,60,63],[46,50,53,60],[48,51,55,62]],[[72,75],[77,79],[74,70],[75,74]],{pad:'breath',lead:'reed',arp:'wood',melodyAt:[1,8],arpAt:[0,5,7,10],arpPattern:[0,3,1,2],bassAt:[0,7],kick:[0],brush:[3,9],ticks:[],level:.92}),
  storm:theme('雷针脉搏',108,16,[[40,47,52,55],[43,50,55,59],[36,43,48,52],[38,45,50,54]],[[76,79,83,78],[79,83,86,83],[76,72,79,76],[78,81,74,78]],{pad:'brass',lead:'reed',arp:'pulse',melodyAt:[0,6,10,14],arpAt:[0,2,4,6,8,10,12,14],arpPattern:[0,0,2,1,3,2,1,2],bassAt:[0,6,10],kick:[0,6,10],brush:[4,12],ticks:[2,7,14],level:.92}),
  tide:theme('三道排水阀',84,12,[[41,48,53,56],[44,51,56,60],[46,53,56,60],[48,52,55,58]],[[77,80,79],[80,84,82],[82,80,77],[79,76,72]],{pad:'breath',lead:'wood',arp:'flute',melodyAt:[0,4,9],arpAt:[2,5,8,11],arpPattern:[0,1,3,2],bassAt:[0,6],kick:[0,9],brush:[3,6],ticks:[5,11],level:.98}),
  furnace:theme('搬运者的步距',102,16,[[40,47,52,55],[41,48,53,57],[38,45,50,53],[40,47,52,56]],[[64,65,71,67],[65,69,72,71],[65,62,69,65],[64,68,71,64]],{pad:'brass',lead:'brass',arp:'metal',melodyAt:[0,3,8,11],arpAt:[2,6,10,14],arpPattern:[0,0,2,1],bassAt:[0,3,8,11],kick:[0,3,8,11],brush:[4,12],ticks:[6,14],level:.9}),
  orrery:theme('第七条轨道',98,14,[[47,54,59,63],[49,56,61,65],[51,58,63,66],[46,53,58,61]],[[83,85,87,90],[85,89,87,80],[87,90,94,90],[85,82,80,78]],{pad:'warm',lead:'glass',arp:'metal',melodyAt:[0,4,8,12],arpAt:[0,2,4,6,8,10,12],arpPattern:[0,2,1,3,2,0,1],bassAt:[0,6,10],kick:[0,8],brush:[],ticks:[2,4,6,10,12],level:.87}),
  archive:theme('未盖章的页角',78,20,[[48,51,55,62],[44,48,51,58],[46,50,53,60],[43,47,50,56]],[[72,74,75,67],[72,68,70,75],[74,77,72,70],[71,74,68,67]],{pad:'organ',lead:'reed',arp:'pluck',melodyAt:[0,6,12,17],arpAt:[2,7,10,14,18],arpPattern:[0,1,3,2,1],bassAt:[0,12],kick:[0],brush:[4,10,16],ticks:[7,18],level:.91}),
  final:theme('停机之前',118,16,[[38,45,50,53],[34,41,46,50],[36,43,48,52],[33,40,45,49]],[[74,77,81,76],[77,82,81,77],[79,84,83,79],[73,76,81,85]],{pad:'choir',lead:'brass',arp:'pulse',melodyAt:[0,4,10,14],arpAt:[0,2,4,6,8,10,12,14],arpPattern:[0,2,1,3,2,1,0,2],bassAt:[0,6,8,14],kick:[0,6,8,14],brush:[4,12],ticks:[2,10,15],level:.94}),
});
const BOSS_SCORE={golem:'crystal',duelist:'mirror',cantor:'spore',warden:'storm',weaver:'archive',tide:'tide',furnace:'furnace',orrery:'orrery',arbiter:'archive',final:'final'};
export function scoreTheme({bossId='golem',screen='title'}={}){
  if(['camp','reward','dialogue','before','after','roster','ending','route','event','complete'].includes(screen))return 'camp';
  return screen==='battle'?(BOSS_SCORE[bossId]||'crystal'):'prologue';
}
export function scoreFrame(themeId,index,phase=0){
  const t=SCORE_THEMES[themeId]||SCORE_THEMES.prologue,core=phase==='core'||phase==='finale';
  const intensity=core?0:Math.min(4,Math.max(0,Number(phase)||0));
  const bar=Math.floor(index/t.steps)%8,beat=index%t.steps,chord=t.chords[bar%t.chords.length],notes=[];
  const put=(instrument,note,beats,amp,pan=0,offset=0)=>notes.push({instrument,note,beats,amp:amp*t.level,pan,offset});
  if(beat===0)put(core?'warm':t.pad,chord,t.steps/4*.97,core?.022:.032);
  const melodySlot=t.melodyAt.indexOf(beat);
  if(melodySlot>=0){
    const line=t.melody[bar%t.melody.length],note=line[melodySlot%line.length]+(core?12:bar>=4&&melodySlot===line.length-1?-12:0);
    put(core?'glass':t.lead,note,core?1.7:t.lead==='brass'?.55:.92,core?.027:.038,(melodySlot%2?1:-1)*.2);
  }
  if(t.bassAt.includes(beat))put('bass',chord[0]-12,.9,core?.032:.063);
  const arpSlot=t.arpAt.indexOf(beat);
  if(arpSlot>=0&&(!core||arpSlot%2===0))put(core?'glass':t.arp,chord[t.arpPattern[arpSlot%t.arpPattern.length]%chord.length]+12,.46,core?.016:.022,Math.sin(index*.7)*.4);
  if(!core){
    if(t.kick.includes(beat))put(t.pad==='brass'||themeId==='final'?'tom':'kick',36,.3,.65+intensity*.05);
    if(t.brush.includes(beat))put(themeId==='archive'?'paper':themeId==='spore'||themeId==='tide'?'flow':'brush',0,.18,.018,-.2);
    if(t.ticks.includes(beat))put(t.arp==='metal'?'gear':'tick',0,.1,.011,.24);
    if(intensity>=2&&beat===t.steps-1)put('tom',41,.3,.45);
  }
  return {theme:themeId,bpm:core?Math.round(t.bpm*.68):t.bpm+intensity*2,loopSteps:t.steps*8,notes};
}
