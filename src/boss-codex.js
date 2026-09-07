import {BOSSES, BOSS_INTENTS, DIFFICULTIES, SOLO_RULES, isSolo, createBattle, intentInfo, responseOptions} from './combat.js';
import {icon} from './icons.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const normalResponses = [
  '本次主招减伤 55%；削韧 22。',
  '本次主招减伤 85%；执行者回复 2 资源。',
  '本次主招减伤 15%；反击基础伤害 76，削韧 10。'
];
const responses = (parry, evade, counter) => [parry || normalResponses[0], evade || normalResponses[1], counter || normalResponses[2]];

// Base numbers mirror combat.js. Variable damage uses the layers present at
// execution; the header explains difficulty and per-hit rounding explicitly.
const codex = {
  golem: {
    victory:'击碎躯壳后，向核心分别命中 3 次物理与 3 次魔法，完成净化。',
    rules:[
      ['岩铠与魔抗','普通魔法伤害降低 18%；地狱哨兵穿透此抗性。物理不受这项减伤。'],
      ['四次解体','生命依次降至约 80% / 60% / 40% / 20% 时解体。若当时未破韧，下一轮给出完整地裂预告；本轮最后一点行动触发解体，也有下一整轮应对。'],
      ['额外追击','解体 1 次后，主招后追加单体碎岩飞弹；解体 3 次后再追加全队真空波。若主招后的应对打出破韧或核心，追加攻击取消。'],
      ['共鸣与迷雾','每段物理受击使存活者共鸣 +1，即使伤害被护盾完全吸收。迷雾存在时，每次敌方回合末再 +1。共鸣达到 5 层时触发震荡并清零。'],
      ['清除压力','每次魔法命中驱散 1 层迷雾。庇护清除全队 1 层共鸣，同化清除 2 层，药剂清空目标共鸣。驱散迷雾不会直接清除已有共鸣。']
    ],
    cycle:'势能重击 → 迷雾孢子 → 碎岩连弹 → 魔力压缩 → 元素回收',
    skills:[
      {key:'slam',name:'势能重击',icon:'hammer',tag:'单体 · 物理',damage:'对预告目标造成 85 基础物理伤害。',detail:'主招命中后，存活的受击者增加 1 层共鸣。',responses:responses()},
      {key:'fog',name:'迷雾孢子',icon:'mist',tag:'全队魔法 · 迷雾领域',damage:'全队各受 24 基础魔法伤害，再将迷雾设置为 5 层。',detail:'随后按所选应对驱散层数；剩余迷雾大于 0 时，本轮末每名存活队员共鸣 +1。魔法每段命中继续驱散 1 层。',responses:responses('削韧 18；驱散 2 层迷雾，本次施放后剩 3 层。','执行者回复 2 资源；驱散 3 层迷雾，本次施放后剩 2 层。','反击基础伤害 70，削韧 10；先驱散 1 层迷雾。雷克的魔法反击还能再驱散 1 层。')},
      {key:'missiles',name:'碎岩连弹',icon:'scatter',tag:'单体 · 三段物理',damage:'对预告目标造成 3 × 31 基础物理伤害。',detail:'每段分别计算防御、应对和护盾，每段物理命中都可增加 1 层共鸣。目标途中倒下，后续弹会转向存活队员。',responses:responses('本次主招减伤 65%；削韧 30。')},
      {key:'compression',name:'魔力压缩',icon:'rune',tag:'全队 · 魔法',damage:'对全队各造成 48 基础魔法伤害。',detail:'魔法命中不直接叠加共鸣；若迷雾仍在，回合末照常增加共鸣。',responses:responses('本次主招减伤 55%；削韧 20。')},
      {key:'reclaim',name:'元素回收',icon:'heal',tag:'全队魔法 · 回收治疗',damage:'全队各受 22 基础魔法伤害；恢复生命 = 存活队员共鸣总层数 × 8。',detail:'先释放魔法冲击，治疗结算后清空所有存活队员的共鸣。治疗不随难度缩放，且不能超过最大生命。提前用庇护、同化或药剂驱散可降低治疗量。',responses:responses('阻止本次治疗；削韧 18。共鸣仍被回收并清空。','执行者回复 2 资源；敌人仍会正常恢复生命。','本次治疗减半；反击基础伤害 92，削韧 10。')},
      {key:'quake',name:'地裂',icon:'quake',tag:'阶段蓄力 · 全队物理',damage:'对全队各造成 70 基础物理伤害。',detail:'解体触发，覆盖下一轮的普通主招。枪式 · 咒弹可以直接打断；韧性归零也能取消该招。地裂不会因解体次数变多而提高基础伤害。',interrupt:true,responses:responses('本次主招减伤 50%；削韧 34。','本次主招减伤 90%；执行者回复 3 资源。','本次主招减伤 20%；反击基础伤害 110，削韧 18。')}
    ],
    extras:[
      {name:'碎岩飞弹',icon:'scatter',tag:'解体 ≥ 1 · 额外物理',text:'主招及应对结算后，对一名存活队员造成 12 基础物理伤害，并可叠加 1 共鸣。目标按回合轮换，不一定是主招目标。招架 / 回避 / 迎击的减伤不覆盖飞弹；个人防御和护盾仍有效。'},
      {name:'真空波',icon:'rune',tag:'解体 ≥ 3 · 额外魔法',text:'碎岩飞弹之后，对全队各造成 9 基础魔法伤害。招架 / 回避 / 迎击的减伤不覆盖真空波；个人防御和护盾仍有效。'},
      {name:'共鸣震荡',icon:'spark',tag:'共鸣 5 层 · 回合末魔法',text:'敌方阶段结束时，共鸣达到 5 层的存活队员受到 25 基础魔法伤害，然后共鸣归零。个人防御和护盾有效，预备应对不减免。破韧或核心阶段仍会结算迷雾与震荡。'},
      {name:'核心重组',icon:'crystal',tag:'核心规则 · 胜负条件',text:'击碎躯壳的攻击不计入核心命中；之后累计物理 3 次、魔法 3 次，不要求伤害量。若由玩家技能打出核心，可使用本轮剩余行动，再有 2 个完整回合；由敌方阶段迎击打出核心，接下来有 2 个完整回合。核心暴露时迷雾设为 5，停止主招与追击，但回合末共鸣仍在。期限届满，巨人恢复最大生命的 28%、韧性恢复至上限的 65%，回到解体 3 阶段，迷雾清空；可再次打出核心。'}
    ]
  },
  duelist: {
    victory:'生命归零即可获胜。先用魔法拆镜，再选择物理爆发或预备反击。',
    rules:[
      ['镜甲','开场 2 镜片，上限 3；每片降低 10% 物理伤害，最多降低 30%。魔法伤害不受镜甲减伤，每段魔法命中拆 1 镜片。'],
      ['半血 · 镜刃过载','生命降至 50% 时立即补充 1 镜片，之后每个新回合再恢复 1 镜片。所有主招的每段基础伤害 +6；折镜反噬不获得这 +6。'],
      ['拆镜时机','魔法伤害先结算，再移除该段对应镜片。招架的拆镜收益在主招之后结算；迎击先领取拆镜收益，再计算自身反击伤害。'],
      ['直接打断','贯镜突刺、双刃决斗可以被枪式 · 咒弹直接打断。其它招式需要将韧性削至 0；抗控回合无法直接打断或破韧。']
    ],
    cycle:'裂锋三连 → 折镜架势 → 贯镜突刺 → 双刃决斗',
    skills:[
      {key:'rend',name:'裂锋三连',icon:'blades',tag:'单体 · 三段物理',damage:'一阶段：3 × 28；半血后：3 × 34 基础物理伤害。',detail:'攻击结束后补充 1 镜片，随后才结算招架或迎击的收益。目标途中倒下，后续斩击转向存活队员。',responses:responses('本次主招减伤 65%；削韧 30；招后拆除 1 镜片。')},
      {key:'mirror',name:'折镜架势',icon:'mirror',tag:'单体物理 · 反噬架势',damage:'75 + 5 × 镜片数基础物理伤害；半血后基础值再 +6。',detail:'本轮此招处于预告时，只要镜片仍在且 BOSS 未破韧，每次玩家物理技能使施放者承受 7 + 3 × 镜片数基础物理反噬，每技能一次。反噬按出手前镜片数计算，受难度、防御与护盾影响；预备应对不保护反噬。魔法先拆净镜片可关闭反噬。',responses:responses('本次主招减伤 55%；削韧 24；拆除 2 镜片。','本次主招减伤 85%；执行者回复 2 资源；保留镜片。','本次主招减伤 15%；先拆除 1 镜片，再反击基础伤害 100、削韧 10；反击不触发折镜反噬。')},
      {key:'pierce',name:'贯镜突刺',icon:'blade',tag:'全队 · 物理蓄力',damage:'全队各受 44 + 4 × 镜片数基础物理伤害；半血后基础值再 +6。',detail:'出手前用魔法减少镜片，也会降低本次突刺的伤害。可用枪式 · 咒弹直接打断。',interrupt:true,responses:responses('本次主招减伤 40%；削韧 32；拆除 1 镜片。','本次主招减伤 90%；执行者回复 3 资源。','本次主招减伤 15%；先拆除 1 镜片，再反击基础伤害 96、削韧 10。')},
      {key:'duel',name:'双刃决斗',icon:'blades',tag:'单体 · 物理蓄力',damage:'一阶段：98；半血后：104 基础物理伤害。',detail:'集中攻击预告目标。可用枪式 · 咒弹直接打断，也可保留生命和护盾承担攻击，换取迎击的高伤害与削韧。',interrupt:true,responses:responses('本次主招减伤 65%；削韧 40。',null,'本次主招减伤 25%；反击基础伤害 112，削韧 24。')}
    ],
    extras:[]
  },
  cantor: {
    victory:'生命归零即可获胜。物理多段清理孢压，裸冠时用魔法抓住伤害窗口。',
    rules:[
      ['孢压','开场 1 层，上限 5。每段物理命中剥离 1 层；高孢压提高抽髓祷告的伤害、治疗，以及冠孢绽放的伤害。'],
      ['菌冠抗性','孢压 ≥ 3 时，普通魔法伤害降低 30%，地狱哨兵可以穿透；孢压为 0 时，所有魔法伤害提高 25%。1–2 层没有额外魔法抗性。'],
      ['半血 · 菌冠升华','生命降至 50% 时立即增加 2 孢压；此后播孢细雨由 +2 层改为 +3 层。所有造成伤害的主招基础值 +5，治疗量不变。'],
      ['直接打断','抽髓祷告、冠孢绽放可以被枪式 · 咒弹直接打断。播孢和重织仍可用削韧至 0 取消；抗控回合无法直接打断或破韧。']
    ],
    cycle:'播孢细雨 → 抽髓祷告 → 冠孢绽放 → 菌丝重织',
    skills:[
      {key:'sow',name:'播孢细雨',icon:'mist',tag:'全队魔法 · 播种',damage:'全队各受 35 基础魔法伤害；半血后为 40。',detail:'主招伤害结算后增加 2 孢压；半血后增加 3。回避可完全阻止本次增加孢压，但不会自动清除已有孢压。',responses:responses('本次主招减伤 55%；削韧 18；播种后剥离 1 孢压。','本次主招减伤 85%；执行者回复 2 资源；阻止本次播种增加孢压。')},
      {key:'drain',name:'抽髓祷告',icon:'rune',tag:'单体魔法 · 吸血蓄力',damage:'74 + 6 × 孢压基础魔法伤害；半血后基础值再 +5。',detail:'同时回复 30 + 12 × 孢压生命。伤害与治疗按出招前层数计算；治疗不取决于实际扣除队员多少生命。可用枪式 · 咒弹直接打断。',interrupt:true,responses:responses('本次主招减伤 55%；削韧 24；完全阻止本次吸血治疗。','本次主招减伤 85%；执行者回复 2 资源；司祭仍会正常恢复生命。','本次主招减伤 15%；反击基础伤害 104，削韧 10；司祭仍会正常恢复生命。')},
      {key:'bloom',name:'冠孢绽放',icon:'mushroom',tag:'全队魔法 · 绽放蓄力',damage:'全队各受 50 + 10 × 孢压基础魔法伤害；半血后基础值再 +5。',detail:'释放后将孢压清空，露出魔法弱点。结束回合前的物理多段攻击可以降低出招层数和伤害；枪式 · 咒弹可以直接打断。迎击收益采用敌人实际出招前的孢压，释放后清层不会使收益缩水。',interrupt:true,responses:responses('本次主招减伤 40%；削韧 38。','本次主招减伤 80%；执行者回复 3 资源。','本次主招减伤 15%；反击基础伤害 = 65 + 12 × 出招前孢压，削韧 18。反击命中时已是裸冠。')},
      {key:'weave',name:'菌丝重织',icon:'heal',tag:'全队魔法 · 恢复生命',damage:'全队各受 28 基础魔法伤害，半血后 33；恢复生命 = 60 + 12 × 孢压，并增加 2 孢压。',detail:'先释放菌丝冲击，再按出招前孢压计算治疗，最后增加 2 层。治疗不随难度缩放，且不能超过最大生命。可用破韧同时取消伤害与重织。',responses:responses('削韧 24；重织增加孢压之后剥离 2 层，不阻止治疗。','执行者回复 3 资源；司祭仍会正常治疗并增加 2 孢压。','本次治疗减半；反击基础伤害 94，削韧 10。重织仍会增加 2 孢压，随后才结算反击。')}
    ],
    extras:[]
  }
};

const expanded = {
  warden:{
    victory:'生命归零即可获胜。物理多段先泄能，再安排护盾、招架或反击，控制雷脊的蓄电。',
    rules:[['蓄电','开场 2 点，上限 6；每段物理命中泄能 1 点。雷链双击每段随蓄电增加 3 基础伤害，接地冲击增加 4，风暴倾泻增加 9。'],['半血 · 雷脊熔断','生命降至 50% 时蓄电 +2，此后每个新回合额外获得 1 蓄电，所有伤害主招的每段基础伤害提高 5。'],['泄能时机','攻击先结算伤害，再由该段物理命中泄能。招架、迎击的额外泄能在敌方主招之后结算；物理迎击自身命中还能再泄能 1 点。'],['直接打断','风暴倾泻可以用枪式 · 咒弹直接打断；其余主招需要削韧至 0。抗控期间无法打断或破韧。']],
    skills:{arc:{name:'雷链双击',detail:'对预告目标进行两段物理攻击，每段基础值为 35 + 3 × 蓄电，半血后再 +5。每段分别结算防御、应对和护盾；目标途中倒下，后续攻击转向存活队员。'},ground:{name:'接地冲击',detail:'全队各受 44 + 4 × 蓄电基础物理伤害，半血后再 +5。释放后蓄电减少 2，然后结算应对的额外泄能；半血阶段进入新回合还会补充 1 蓄电。'},storm:{name:'风暴倾泻',detail:'全队各受 50 + 9 × 蓄电基础魔法伤害，半血后再 +5。释放后清空蓄电；迎击使用出招前蓄电计算 90 + 10 × 蓄电的基础反击伤害。可先物理泄能，或直接打断。',interrupt:true},charge:{name:'雷针充能',detail:'先对全队造成 30 基础魔法伤害（半血后 35），再将蓄电增加 3（上限 6）。随后招架泄去 3，迎击先泄去 1 再反击；回避获得资源但不阻止充能。接近上限时，招架可能同时泄去原有蓄电。'}},extras:[]
  },
  weaver:{
    victory:'生命归零即可获胜。用封存属性的另一系拆页，避免让封页保护下一轮的抽取。',
    rules:[['封页','开场 2 层，上限 3。存在封页时，被封存属性的普通攻击伤害降低 45%；另一属性每段命中拆除 1 层。穿透攻击可以无视此抗性，但同系穿透不会拆封。'],['属性轮换','开场封存物理。每个新回合翻转封存属性，并补充 1 层封页（上限 3）；破韧回合也会正常轮换。'],['半血 · 缄默复写','生命降至 50% 时封页恢复至 3，所有伤害主招的每段基础伤害提高 5，封缄抽取资源由 1 提高至 2。'],['直接打断','资源封缄与命运复写可以用枪式 · 咒弹直接打断。抗控期间无法打断或破韧。']],
    skills:{script:{name:'缄页刻写',detail:'全队各受 42 基础魔法伤害，半血后为 47；攻击后增加 1 封页，再结算招架 / 迎击拆封。进入新回合时，仍会翻转属性并再补 1 封页。'},silence:{name:'资源封缄',detail:'对预告目标进行 2 × 42 基础魔法攻击，半血后为 2 × 47。若攻击后仍有封页，全队资源向 0 减少 1（半血后 2）；这次强制抽取不触发雷克的调和。提前拆净封页、直接打断、招架或回避都能阻止资源抽取。',interrupt:true},rewrite:{name:'命运复写',detail:'先对全队造成 32 基础魔法伤害（半血后 37）；一阶段回复 80 生命，半血后回复 100，并将封页恢复至 3。招架完全阻止治疗并在重建后拆 1 页；迎击使治疗减半。直接打断可同时取消治疗与重建。',interrupt:true},sever:{name:'断章裁切',detail:'全队各受 50 + 8 × 封页基础物理伤害，半血后基础值再 +5。出招前的异系多段可以拆页减伤；招架带来的拆页在主招后结算。'}},extras:[]
  },
  final:{
    victory:'耗尽生命后进入终幕：在期限内分别登记 1 次物理与魔法命中，准备任意战术应对，再结束回合承受末招，关闭核心。',
    rules:[['归零屏障','开场 3 层，每层使所有伤害降低 12%，最多减伤 36%。穿透魔抗的技能也不能跳过这层屏障。'],['双系同步','全队攻击在物理与魔法之间切换时，同步 +1、屏障 −1；同步上限 3，满同步后受到伤害 +20%。先结算该次命中伤害，再变化屏障与同步，同系多段不会连续触发切换；迎击与折射也参与同步。'],['半血 · 归零重启','生命降至 50% 时屏障恢复至 3，同步与上次攻击属性清空，所有伤害主招的每段基础伤害提高 7。空白脉冲可以直接打断；抗控期间无效。'],['第三阶段 · 停机过载','生命耗尽后，伤害变为双系命中登记。玩家阶段触发可使用本轮剩余行动，随后有 2 个完整回合；敌方阶段触发则从下一轮开始计算 2 个完整回合。满足双系与战术应对后，结束回合承伤并完成胜利。']],
    skills:{zero_lance:{name:'归零贯星',detail:'对预告目标进行两段物理攻击，每段基础值 40 + 5 × 屏障，半血后再 +7。先用全队双系轮流命中拆除屏障，同时降低本次主招伤害。'},zero_field:{name:'寂静边界',detail:'全队各受 45 基础魔法伤害，半血后为 52；主招后屏障 +1（最多 3）。招架或迎击的拆屏障收益在此次增加后结算。'},zero_pulse:{name:'空白脉冲',detail:'全队各受 56 + 9 × 屏障基础魔法伤害，半血后再 +7。可以先双系交替拆屏障，或用禁行直接打断；抗控期间需依靠减伤与恢复。',interrupt:true},zero_reset:{name:'回响重置',detail:'先对全队造成 30 基础魔法伤害（半血后 37）；一阶段回复 65 生命，半血后回复 90；屏障恢复至 3，同步归零，上次命中属性清空。招架阻止治疗并拆 1 屏障，迎击治疗减半；仍会重建屏障和重置同步。'}},
    extras:[{name:'停机过载 · 最后放电',icon:'crystal',tag:'生命归零后的最终条件',text:'进入终幕后，物理命中与魔法命中各登记 1 次，准备任意战术应对并结束回合。最后放电每次对全队造成 65 基础魔法伤害；队伍承受末招后仍有人存活，才可完成胜利。迎击与折射也可补足对应系的记录。期限耗尽恢复最大生命的 22%，屏障 3、同步 0、韧性恢复至上限的 65%，再次击破可重试。击碎生命的那一次攻击不计入终幕登记。'}]
  }
};

Object.assign(expanded,{
  tide:{victory:'耗尽生命即可获胜。累计三击排水，在满潮破堤前降低水位。',rules:[['三击排水','开场水位 2，上限 4。任意属性每段命中积累 1 阀击；达到 3 次时水位 −1、阀击归零。未完成的进度跨技能、跨回合保留，迎击同样计入。'],['主招与时机','牵流重锚每级水位 +5 基础伤害，满潮破堤每级 +12，泄流穿刺每级 +9。攻击前排水会立即降低预告；招架排水在主招之后结算。'],['半血 · 应急涨潮','半血时水位 +1，之后每段主招基础伤害 +5。没有无预告追击。']],skills:{tide_hook:{detail:'对预告目标重锚攻击。招架在命中后排水 1；可以用普通攻击补满三击，在出招前直接降低水压。'},tide_fill:{detail:'攻击全队，然后水位增加 2。招架会在涨水后排水 2；回避保留水位，返还更多资源。'},tide_breaker:{detail:'全队浪涌，水位越高越危险。释放后水位清零；可直接打断，但打断后仍保留原有水位。',interrupt:true},tide_release:{detail:'对预告目标穿刺；释放后排水 1，再结算应对的排水。'}},extras:[]},
  furnace:{victory:'耗尽生命即可获胜。排汽后利用敞开的炉门，连击泄热以削弱落锤。',rules:[['炉热与开口','开场炉热 2，上限 6。炉门排汽之后敞口，熔核落锤或投料升温之后关闭。敞口时受到伤害 +30%，任意属性每段命中泄热 1；闭口攻击不会泄热。'],['出手窗口','排汽每点炉热 +8 基础伤害，落锤每点 +9。开炉后的迎击也享受易伤，并计入泄热。若打断排汽，炉门也不会因此打开。'],['半血 · 炉膛过热','半血时炉热 +1，此后每段主招基础伤害 +5。']],skills:{furnace_lift:{detail:'对预告目标造成两段物理伤害；每段独立扣除护盾与生命。'},furnace_vent:{detail:'先对全队释放高温蒸汽，再打开炉门。招架额外泄热 2；迎击在开炉后发生，可以抢到易伤伤害。'},furnace_drop:{detail:'落锤攻击预告目标，释放后关闭炉门并清空炉热。出招前的敞口连击可降低落锤伤害。',interrupt:true},furnace_feed:{detail:'攻击全队，然后升温 3 并关闭炉门。招架在投料后泄热 3，迎击泄热 1。'}},extras:[]},
  orrery:{victory:'耗尽生命即可获胜。换用另一项攻击技能打乱测绘，避免连续重复堆满锁定。',rules:[['测绘锁定','上限 3。每次攻击技能结算后，若与上一项攻击的角色、技能 ID 都相同，锁定 +1；否则锁定 −1。多段只记录一次，记录跨回合保留。'],['不纳入记录','治疗、护盾、药剂、防御和应对不改变已记录技能；迎击不会加锁定，也不会替你重置上一项攻击。'],['伤害预告','锁定分别使贯星 +14、扫弧 +8、坍缩 +12 基础伤害。半血时锁定 +1，此后每段主招基础伤害 +5。']],skills:{orbit_lance:{detail:'单体魔法贯星，按出招时锁定计算伤害。招架在主招后消除 1 锁定。'},orbit_sweep:{detail:'全队物理扫弧。换攻击技能降低锁定，与个人防御、应对、护盾共同缓解压力。'},orbit_calibrate:{detail:'攻击全队后回复 55 生命、锁定 +1。招架阻止治疗并消除 2 锁定；迎击令治疗减半。'},orbit_collapse:{detail:'全队高压魔法。释放后清空锁定；直接打断取消主招，也不会触发清空。',interrupt:true}},extras:[]},
  arbiter:{victory:'耗尽生命即可获胜。阅读当前轻重击令，决定顺从节奏或承担判罚换取爆发。',rules:[['轻击令 / 重击令','开场为轻击令，只允许实际消耗 1 AP 的攻击。下一回合切换重击令，只允许实际消耗至少 2 AP 的攻击；此后逐轮交替，破韧回合也照常换令。'],['违令判罚','每次不符合当前法令的攻击增加 1 违令，上限 3；一项多段技能只判罚一次。按条件强化后的实际 AP 计算，治疗、护盾、药剂、防御和应对均不违令。'],['有限惩罚','违令只增加本轮已预告主招伤害，下一轮清零。半血后每段主招基础伤害 +5，不追加隐藏伤害或永久封技能。']],skills:{edict_mark:{detail:'全队魔法宣告，每层违令增加 7 基础伤害。'},edict_sentence:{detail:'预告目标承受单席判决，每层违令增加 16 基础伤害。招架可换取较高削韧。'},edict_audit:{detail:'全队魔法核验，每层违令增加 10 基础伤害。可直接打断，但抗控期间仍须防守。',interrupt:true},edict_revoke:{detail:'全队魔法攻击，每层违令增加 8 基础伤害。若主招后仍有至少 2 违令，全队资源向 0 减少 2；招架或回避阻止资源抽取。'}},extras:[]}
});

function soloEntry(state,bossId,entry){
  if(!isSolo(state))return entry;
  const result={...entry,rules:[['独狼数值',`每轮 ${SOLO_RULES.ap} AP；敌方生命 ×${SOLO_RULES.bossHp}、伤害 ×${SOLO_RULES.bossDamage}；最大韧性 ${SOLO_RULES.stagger}，每轮恢复 ${SOLO_RULES.staggerRegen}。我方生命、技能支付、3 瓶药剂保持原值。`],...entry.rules]};
  if(bossId==='golem'){
    result.victory=`击碎躯壳后，任意属性累计命中 ${SOLO_RULES.coreHits} 次即可净化，不要求物理与魔法分别命中。`;
    result.extras=entry.extras.map(extra=>extra.name==='核心重组'?{...extra,text:`击碎躯壳的攻击不计入核心命中；之后任意属性累计 ${SOLO_RULES.coreHits} 次，不要求伤害量。暴露后保留 2 个完整回合，核心不再攻击，但共鸣仍会结算。超时恢复 28% 生命，再次击碎即可重试。`}:extra);
  }
  if(bossId==='final'){
    result.victory=`进入终幕后，任意属性累计命中 ${SOLO_RULES.finaleHits} 次，准备任意应对并存活至末招结算即可停机。`;
    result.rules= result.rules.map(([name,detail])=>name==='第三阶段 · 停机过载'?[name,result.victory+' 期限为 2 个完整回合，超时恢复 22% 生命。']: [name,detail]);
    result.skills=entry.skills.map(skill=>skill.key==='zero_end'?{...skill,tag:'独狼最终条件',detail:result.victory+' 迎击也可计入一次任意属性命中；普通伤害与削韧不再计量。'}:skill);
    result.extras=entry.extras.map(extra=>({...extra,tag:'独狼最终条件',text:result.victory+' 最后放电为 65 基础魔法伤害，仍乘难度与独狼倍率。击碎生命的攻击不计入终幕；超时恢复 22% 生命，可重新尝试。'}));
  }
  return result;
}

function expandedEntry(state,bossId){
  const source=expanded[bossId];
  if(!source)return {victory:BOSSES[bossId].brief,rules:[['核心机制',BOSSES[bossId].mechanic]],skills:[],cycle:'',extras:[],dynamic:true};
  const active=state.boss.id===bossId;
  const snapshot=active?structuredClone(state):createBattle(state.difficulty,bossId,{mode:state.challengeMode,partyIds:state.heroes.map(hero=>hero.id),upgrades:state.upgrades,loadouts:state.loadouts});
  Object.assign(snapshot.boss,{core:false,finale:false,broken:false,exposed:false,charging:false,phasePending:false});
  snapshot.selected=snapshot.heroes.some(hero=>hero.id===state.selected)?state.selected:snapshot.heroes[0].id;
  const skills=(BOSS_INTENTS[bossId]||[]).map(key=>{
    const preview=structuredClone(snapshot);preview.boss.intent=key;
    const actual=intentInfo(preview),meta=source.skills[key]||{name:key,detail:BOSSES[bossId].brief};
    return {key,icon:actual.icon||BOSSES[bossId].icon,name:actual.name||meta.name,tag:`${active?'当前阶段与层数':'开场阶段与层数'} · ${DIFFICULTIES[preview.difficulty].name}难度`,damage:actual.desc||BOSSES[bossId].brief,detail:meta.detail,interrupt:meta.interrupt,responses:responseOptions(preview).map(option=>`${option.description}；${option.reward}。`)};
  });
  const cycle=skills.map(skill=>skill.name).join(' → ');
  if(bossId==='final'){
    const preview=structuredClone(snapshot);
    Object.assign(preview.boss,{finale:true,hp:0,finalePhysical:active?state.boss.finalePhysical:0,finaleMagic:active?state.boss.finaleMagic:0});
    const actual=intentInfo(preview);
    skills.push({key:'zero_end',name:actual.name,icon:actual.icon,tag:'第三阶段 · 全队魔法 · 最终条件',damage:actual.desc,detail:'本招不受半血伤害加成。先完成物理与魔法各 1 次命中，再准备应对并结束回合；迎击与折射也可以在主招后补足记录。普通伤害与削韧不再计量，满足条件并有人存活时获胜。',responses:responseOptions(preview).map(option=>`${option.description}；${option.reward}。`)});
  }
  return soloEntry(state,bossId,{...source,skills,cycle,dynamic:true});
}

// The original encounters use the same live damage/response calculation as the
// later chapters, so balance changes cannot leave an older handwritten preview.
function originalEntry(state,bossId){
  const source=codex[bossId],active=state.boss.id===bossId;
  const snapshot=active?structuredClone(state):createBattle(state.difficulty,bossId,{mode:state.challengeMode,partyIds:state.heroes.map(hero=>hero.id),upgrades:state.upgrades,loadouts:state.loadouts});
  Object.assign(snapshot.boss,{core:false,finale:false,broken:false,exposed:false,charging:false,phasePending:false});
  snapshot.selected=snapshot.heroes.some(hero=>hero.id===state.selected)?state.selected:snapshot.heroes[0].id;
  const skills=source.skills.map(skill=>{
    const preview=structuredClone(snapshot);
    if(skill.key==='quake')preview.boss.charging=true;else preview.boss.intent=skill.key;
    const actual=intentInfo(preview);
    return {...skill,damage:actual.desc,responses:responseOptions(preview).map(option=>`${option.description}；${option.reward}。`)};
  });
  return soloEntry(state,bossId,{...source,skills,dynamic:true});
}

function skillCard(skill, current, index) {
  const names = ['招架','回避','迎击'], icons = ['parry','evade','counter'];
  return `<details class="codex-skill${current ? ' is-current' : ''}"${current ? ' open' : ''}>
    <summary><span class="codex-skill-number">${String(index + 1).padStart(2,'0')}</span><span class="codex-skill-icon">${icon(skill.icon)}</span><span class="codex-skill-heading"><b>${esc(skill.name)}</b><small>${esc(skill.tag)}</small></span>${current ? '<em>当前预告</em>' : ''}<span class="codex-expand">${icon('chevron')}</span></summary>
    <div class="codex-skill-body"><p class="codex-threat">${esc(skill.damage)}</p><p>${esc(skill.detail)}</p>${skill.interrupt ? '<div class="codex-interrupt">'+icon('bind')+' 可被「枪式 · 咒弹」直接打断；抗控期间除外。</div>' : ''}
    <div class="codex-response-grid">${skill.responses.map((text, i) => `<article class="codex-response codex-response-${icons[i]}"><h4>${icon(icons[i])}${names[i]}<span>1 AP</span></h4><p>${esc(text)}</p></article>`).join('')}</div></div>
  </details>`;
}

export function bossCodexView(state, bossId = state.boss.id) {
  if (!Object.hasOwn(BOSSES, bossId)) bossId = 'golem';
  const boss = BOSSES[bossId], entry = codex[bossId]?originalEntry(state,bossId):expandedEntry(state,bossId), difficulty = DIFFICULTIES[state.difficulty] || DIFFICULTIES.standard;
  const active = state.boss.id === bossId;
  const current = active && !state.boss.core && !state.boss.broken ? state.boss.finale?'zero_end':state.boss.charging ? 'quake' : state.boss.intent : null;
  const actual = active ? intentInfo(state) : null;
  const hp = Math.round(difficulty.hp * boss.hpMultiplier*(isSolo(state)?SOLO_RULES.bossHp:1));
  return `<section class="boss-codex" style="--codex-accent:${boss.color}" aria-label="BOSS 招式手册">
    <div class="modal-eyebrow">ENCOUNTER CODEX</div><h2>BOSS 招式手册</h2><p class="codex-intro">全部招式、阶段机制和应对收益都可在这里查阅。点击招式展开详情。</p>
    <nav class="codex-tabs" aria-label="选择 BOSS">${Object.values(BOSSES).map(item => `<button type="button" class="${item.id === bossId ? 'selected' : ''}" data-codex-boss="${item.id}" aria-pressed="${item.id === bossId}">${icon(item.icon)}<span>${esc(item.name)}</span>${state.boss.id === item.id ? '<small>本场</small>' : ''}</button>`).join('')}</nav>
    <header class="codex-boss-heading"><span>${icon(boss.icon)}</span><div><small>${esc(boss.region)}</small><h3>${esc(boss.name)}</h3></div><div class="codex-hp"><small>${isSolo(state)?'独狼 · ':''}${esc(difficulty.name)} · 最大生命</small><b>${hp}</b></div></header>
    <p class="codex-victory">${icon('flag')}${esc(entry.victory)}</p>
    ${actual ? `<div class="codex-live"><strong>${icon(actual.icon)}本场状态 · ${esc(actual.name)}</strong><p>${esc(actual.desc)}</p></div>` : ''}
    <div class="codex-rules">${entry.rules.map(([title,text]) => `<article><h4>${esc(title)}</h4><p>${esc(text)}</p></article>`).join('')}</div>
    <div class="codex-section-heading"><h3>招式与应对</h3><span>${entry.skills.length} 项主动招式</span></div>
    <p class="codex-cycle"><b>普通循环</b>${esc(entry.cycle)}</p>
    <p class="codex-number-note">${entry.dynamic?`下列招式与应对直接按战斗规则推演，<b>已计入${esc(difficulty.name)}难度</b>，不可再次乘难度倍率。本场 BOSS 使用当前阶段与层数，其他 BOSS 使用开场状态；实际出招前层数变化会同步改变预览。应对承伤未扣除个人防御与护盾，反击仍显示基础值。`:`下列伤害使用基础值。当前${esc(difficulty.name)}难度：敌方伤害逐段 × <b>${difficulty.damage}</b> 后四舍五入，再扣除护盾；个人防御和预备应对的减伤在取整前一并计算。治疗、削韧与我方反击基础值不随难度缩放。镜片、孢压取实际出招时的层数。`}</p>
    <div class="codex-skills">${entry.skills.map((skill,i) => skillCard(skill, current === skill.key, i)).join('')}</div>
    ${entry.extras.length ? `<div class="codex-section-heading"><h3>额外攻击与核心</h3><span>预备应对不覆盖额外伤害</span></div><div class="codex-extras">${entry.extras.map(extra => `<article><h4>${icon(extra.icon)}${esc(extra.name)}</h4><small>${esc(extra.tag)}</small><p>${esc(extra.text)}</p></article>`).join('')}</div>` : ''}
    <details class="codex-common"><summary>${icon('book')}通用结算规则与角色应对差异${icon('chevron')}</summary><div>
      <p><b>一轮准备一项应对：</b>首次花费 1 AP，同轮更换方案或执行者不再收费。减伤只覆盖这一次主招，收益在主招之后结算。${isSolo(state)?'独狼单体招架最多减伤 45%、回避最多减伤 70%；群体招架减伤 30%、回避减伤 55%。':'群体主招的招架减伤 30%、回避减伤 60%；单体招式保留更强的招架 / 回避减伤。'}个人防御额外减伤 55%，两种减伤相乘，最后扣除护盾。</p>
      <p><b>执行者影响收益：</b>回避为尼布斯回复气息、艾佩莉雅回复连击、哈特与潜行回复魔力；雷克则让平衡向 0 靠近相应点数，并能触发过零支援。尼布斯、艾佩莉雅和潜行的迎击为物理，雷克与哈特为魔法；发起者倒下时，由第一名存活队员接续。若全队倒下，则无法反击。</p>
      <p><b>反击仍计算状态：</b>迎击基础伤害会受到镜甲、菌冠、魔抗、标记及直感修正。尼布斯满直感时，迎击伤害 +40%、削韧 +12；迎击不触发艾佩莉雅的物魔交替被动。反击属于一次命中，伤害类型可拆镜、清孢或驱散迷雾。</p>
      <p><b>破韧与抗控：</b>最大韧性 ${isSolo(state)?SOLO_RULES.stagger:160}，每个新回合恢复 ${isSolo(state)?SOLO_RULES.staggerRegen:12}。玩家行动期间击破韧性，取消本轮主招并使其受到伤害 +50%。BOSS 恢复架势后有一整轮抗控，期间韧性最低保留 1、直接打断无效。核心与终幕不再计算削韧。</p>
      <p><b>取消与应对破韧：</b>已准备应对后若敌方被打断或进入核心，应对随之取消；下轮正常恢复 ${state.maxAp} AP，不产生额外行动点。敌方出手后通过招架或迎击击破韧性，下一玩家回合保留 +50% 易伤并进入抗控，但该轮敌人仍会出招，需要继续看预告。</p>
      <p><b>轮转方式：</b>普通循环按回合数推进；破韧、核心或地裂覆盖主招时，也不暂停回合轮转。敌方回血不回退已触发的半血强化或解体阶段。</p>
    </div></details>
    <div class="codex-footer"><span>战斗内随时查阅 · 关闭后继续当前回合</span><button class="primary" data-action="close-modal">返回战斗 ${icon('arrow')}</button></div>
  </section>`;
}
