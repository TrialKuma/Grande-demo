import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import {branchEnemy,branchEnvironment,formationFor,trainingEnemy} from './scene-expansion.js';
import {impactTiming,damagingEvent,attackTheme} from './battle-feedback.js';
import {impactSchedule,reactionPose,dispatchImpacts,actorStanding,IMPACT_COLORS} from './scene-feedback.js';
import {SceneAtmosphere} from './scene-atmosphere.js';
import {contactEffect} from './scene-impact.js';
import {loadSceneDetails,detailEnvironment,detailEnemy,beginModelStudio,endModelStudio} from './scene-details.js';
import {loadSceneWorlds,applySceneWorld} from './scene-worlds.js';
import {loadBossModels,applyBossModel,playBossAnimation,reactBossToImpact,resetBossAnimation,updateBossAnimation,disposeBossModels} from './scene-boss-models.js';
import {SceneExploration} from './scene-exploration.js';
import {SceneBackdrop} from './scene-backdrop.js';
import {syncSceneEnemies,syncEnemyVisibility,pickedEnemy} from './scene-enemies.js';

// Original local geometry, plus one reference-guided Blender character sample.
const TAU = Math.PI * 2;
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const ease = t => 1 - (1 - t) ** 3;
const clamp = THREE.MathUtils.clamp;
const lerp = THREE.MathUtils.lerp;
const QIANXING_MODEL_URL = '/models/qianxing.glb';
const WORLD_PREVIEW_SPAN={ruins:19,storm:21,sanctum:20,floodworks:20.5,observatory:20};
const ENVIRONMENT_LIGHTING={
  ruins:{background:'#132021',fog:'#263635',density:.012,sky:'#ece9df',ground:'#4b504b',key:'#fff0d5',rim:'#76b7b0',warm:'#ffd9a7',cyan:'#94d1c4',violet:'#b3b1c1'},
  storm:{background:'#152530',fog:'#344652',density:.011,sky:'#d6e0e6',ground:'#454d53',key:'#e2eaf0',rim:'#81c3d6',warm:'#c2dfeb',cyan:'#74d5e1',violet:'#acc1d9'},
  sanctum:{background:'#221e26',fog:'#403540',density:.011,sky:'#e8ddd0',ground:'#504441',key:'#ffe4bb',rim:'#b19ac9',warm:'#ffd296',cyan:'#c0bacd',violet:'#b398c5'},
  floodworks:{background:'#152628',fog:'#344749',density:.011,sky:'#e0e3df',ground:'#454f4d',key:'#f3e8d1',rim:'#8ebec1',warm:'#efce9f',cyan:'#90c9c5',violet:'#b3c0bf'},
  observatory:{background:'#101828',fog:'#273247',density:.009,sky:'#e1e3ef',ground:'#424454',key:'#f0eeff',rim:'#b1acd7',warm:'#ddd6c4',cyan:'#b3c7e1',violet:'#c4b4e1'},
};

function material(color, options = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: .72, flatShading: true, ...options });
}
function mesh(parent, geometry, mat, x = 0, y = 0, z = 0, scale) {
  const item = new THREE.Mesh(geometry, mat);
  item.position.set(x, y, z);
  if (scale) item.scale.set(...scale);
  item.castShadow = true;
  item.receiveShadow = true;
  parent.add(item);
  return item;
}
function box(parent, mat, size, pos = [0, 0, 0]) {
  return mesh(parent, new THREE.BoxGeometry(...size), mat, ...pos);
}
function orb(parent, mat, size, pos = [0, 0, 0], detail = 1) {
  return mesh(parent, new THREE.IcosahedronGeometry(1, detail), mat, ...pos, size);
}
function rod(parent, mat, a, b, r1 = .08, r2 = r1, sides = 6) {
  const av = Array.isArray(a) ? V(...a) : a;
  const bv = Array.isArray(b) ? V(...b) : b;
  const d = bv.clone().sub(av);
  const part = mesh(parent, new THREE.CylinderGeometry(r2, r1, d.length(), sides), mat);
  part.position.copy(av).add(bv).multiplyScalar(.5);
  part.quaternion.setFromUnitVectors(V(0, 1, 0), d.normalize());
  return part;
}
function ring(parent, radius, tube, color, y = .05, opacity = 1, arc = TAU) {
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending });
  const m = mesh(parent, new THREE.TorusGeometry(radius, tube, 5, 80, arc), mat, 0, y, 0);
  m.rotation.x = -Math.PI / 2;
  m.castShadow = false;
  return m;
}
function seeded(seed = 8349) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}
function radialTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(.16, 'rgba(255,255,255,.65)');
  g.addColorStop(.4, 'rgba(255,255,255,.15)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(canvas);
}

function crystal(parent, pos, scale, mat, angle = 0) {
  const crystalGroup = new THREE.Group();
  parent.add(crystalGroup);
  crystalGroup.position.set(...pos);
  crystalGroup.rotation.z = angle;
  const g = new THREE.CylinderGeometry(.01, .24, 1, 5, 1);
  const upper = mesh(crystalGroup, g, mat, 0, .3, 0, scale);
  const lower = mesh(crystalGroup, new THREE.CylinderGeometry(.24, .1, .35, 5), mat, 0, -.36 * scale[1], 0, [scale[0], scale[1], scale[2]]);
  return crystalGroup;
}

function face(parent, palette, { older = false, android = false } = {}) {
  const head = new THREE.Group();
  parent.add(head);
  head.position.y = 2.02;
  orb(head, palette.skin, [.245, .32, .225], [0, 0, 0], 1);
  // The muzzle, brows, nose, eyes and ears are separate sculpted pieces.
  orb(head, palette.skin, [.16, .12, .09], [0, -.13, .17], 0);
  orb(head, palette.skin, [.054, .088, .07], [0, -.025, .233], 0);
  for (const side of [-1, 1]) {
    orb(head, palette.skin, [.058, .09, .06], [side * .245, -.01, 0], 0);
    box(head, palette.white, [.091, .035, .018], [side * .105, .033, .212]);
    box(head, android ? palette.cyan : palette.dark, [.035, .032, .023], [side * .093, .033, .224]);
    const brow = box(head, palette.hair, [.105, .023, .025], [side * .107, .085, .21]);
    brow.rotation.z = side * -.1;
    if (older) {
      rod(head, palette.silver, [side * .145, -.06, .2], [side * .175, -.09, .176], .012);
    }
  }
  box(head, palette.lip, [.09, .017, .015], [0, -.165, .239]);
  if (older) {
    orb(head, palette.hair, [.17, .08, .075], [0, -.245, .134], 0);
    for (const side of [-1, 1]) box(head, palette.hair, [.03, .1, .04], [side * .177, -.155, .174]);
  }
  return head;
}

function person(id) {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const palette = {
    skin: material(id === 'apeilia' ? '#efe2de' : id === 'ric' ? '#d9cbc4' : '#caa48a'),
    dark: material('#172128'),
    white: material('#e8e7dd'),
    silver: material('#99a7b0', { metalness: .68, roughness: .32 }),
    cyan: material('#4aeedb', { emissive: '#1dc7c6', emissiveIntensity: 2.4, metalness: .35 }),
    violet: material('#b480ff', { emissive: '#8250ed', emissiveIntensity: 1.8 }),
    gold: material('#e4b96f', { metalness: .55, roughness: .34 }),
    lip: material('#865655'),
    hair: material(id === 'apeilia' ? '#eca4c8' : id === 'ric' ? '#d2dbdc' : '#4c4744'),
    coat: material(id === 'ric' ? '#29213d' : id === 'apeilia' ? '#e1e1e6' : '#24353d'),
    trim: material(id === 'ric' ? '#9177b9' : id === 'apeilia' ? '#c75d9f' : '#b07b41'),
  };
  if (id === 'haart') {
    palette.coat.color.set('#282941'); palette.trim.color.set('#8274b4');
    palette.hair.color.set('#242c3b'); palette.skin.color.set('#ccbebc');
    palette.dark.color.set('#202538'); palette.cyan.color.set('#c6b6ff');
    palette.cyan.emissive.set('#9370d0'); palette.cyan.emissiveIntensity = 1.8;
  } else if (id === 'qianxing') {
    palette.coat.color.set('#73848f'); palette.trim.color.set('#c3d1d7');
    palette.hair.color.set('#1c242b'); palette.skin.color.set('#c3b5a9');
    palette.gold.color.set('#acbdc5'); palette.silver.color.set('#afc1ce');
    palette.cyan.color.set('#97e1f3'); palette.cyan.emissive.set('#48b4d0'); palette.cyan.emissiveIntensity = 1.6;
  } else if (id === 'youmu') {
    palette.coat.color.set('#c9d3c5'); palette.trim.color.set('#457d72');
    palette.hair.color.set('#293d35'); palette.skin.color.set('#d4bea2');
    palette.cyan.color.set('#a9eed0'); palette.cyan.emissive.set('#5ab496');
  } else if (id === 'patch') {
    palette.coat.color.set('#344857'); palette.trim.color.set('#d3b675');
    palette.hair.color.set('#a9bbcb'); palette.skin.color.set('#d1c7bb');
    palette.cyan.color.set('#a5dfff'); palette.cyan.emissive.set('#6299cd');
  }
  const bones = {};
  // Boots, knees and shaped trouser legs, with a slight asymmetric stance.
  for (const side of [-1, 1]) {
    const legStart=body.children.length;
    const z = side * .045;
    rod(body, palette.dark, [side * .155, .25, z], [side * .14, .85, z], .12, .15, 7);
    orb(body, id === 'apeilia' ? palette.white : palette.coat, [.13, .14, .12], [side * .155, .48, z + .045], 0);
    mesh(body, new THREE.CylinderGeometry(.12, .135, .34, 7), palette.dark, side * .165, .2, z);
    orb(body, palette.dark, [.15, .12, .25], [side * .165, .095, z + .11], 0);
    box(body, palette.silver, [.17, .034, .13], [side * .165, .05, z + .2]);
    if (id === 'apeilia') {
      rod(body, palette.white, [side * .155, .54, z], [side * .14, .98, z], .13, .16);
      box(body, palette.trim, [.055, .22, .025], [side * .155, .66, z + .13]);
      box(body, palette.cyan, [.022, .17, .025], [side * .17, .21, z + .12]);
    }
    const parts=body.children.slice(legStart),leg=new THREE.Group();leg.position.set(side*.15,.98,0);body.add(leg);body.updateMatrixWorld(true);
    for(const part of parts)leg.attach(part);
    bones[side===1?'rightLeg':'leftLeg']=leg;
  }
  mesh(body, new THREE.CylinderGeometry(.24, .29, .35, 7), palette.dark, 0, .96, 0);
  mesh(body, new THREE.CylinderGeometry(.33, .25, .57, 7), palette.coat, 0, 1.39, 0);
  rod(body, palette.skin, [0, 1.66, 0], [0, 1.9, 0], .105, .105);
  box(body, palette.dark, [.56, .10, .34], [0, 1.09, 0]);
  box(body, palette.gold, [.12, .10, .028], [0, 1.09, .18]);

  for (const side of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(side * .335, 1.61, 0);
    body.add(arm);
    orb(arm, palette.coat, [.175, .17, .18], [side * .045, -.01, 0], 0);
    rod(arm, palette.coat, [side * .045, -.04, 0], [side * .14, -.36, .025], .12, .11);
    orb(arm, palette.silver, [.09, .09, .09], [side * .14, -.38, .028], 0);
    rod(arm, id === 'apeilia' ? palette.white : palette.coat, [side * .14, -.38, .03], [side * .13, -.62, .19], .09, .11);
    mesh(arm, new THREE.CylinderGeometry(.1, .1, .07, 7), palette.trim, side * .13, -.59, .17);
    orb(arm, id === 'apeilia' ? palette.dark : palette.skin, [.082, .09, .08], [side * .13, -.69, .21], 0);
    bones[side === 1 ? 'rightArm' : 'leftArm'] = arm;
  }
  const head = face(body, palette, { older: id === 'knibbs', android: id === 'apeilia' });
  bones.head = head;
  // A sculpted hair cap and asymmetric locks provide readable silhouettes.
  orb(head, palette.hair, [.265, .21, .24], [0, .18, -.035], 1);
  for (let i = 0; i < 6; i++) {
    const x = (i - 2.5) * .072;
    const lock = mesh(head, new THREE.ConeGeometry(.075, .23, 4), palette.hair, x, .13 - Math.abs(x) * .1, .19);
    lock.rotation.z = -.25 - i * .075;
    lock.rotation.x = Math.PI;
  }

  const accessories = new THREE.Group();
  body.add(accessories);
  const animated = [];
  const forms = {};
  if (id === 'knibbs') {
    // The heavy, split adventure coat and orange scarf are his key silhouette.
    for (const side of [-1, 1]) {
      const tail = mesh(body, new THREE.CylinderGeometry(.17, .25, .72, 5, 1, false, 0, Math.PI * 1.35), palette.coat, side * .185, .86, -.095);
      tail.rotation.z = side * -.12;
      box(body, palette.trim, [.028, .63, .038], [side * .3, .98, .13]).rotation.z = side * -.08;
      box(body, palette.trim, [.13, .1, .05], [side * .2, 1.28, .215]);
    }
    mesh(body, new THREE.CylinderGeometry(.17, .2, .18, 8), palette.gold, 0, 1.72, .025);
    const scarf = box(body, palette.gold, [.15, .43, .065], [.15, 1.42, .26]);
    scarf.rotation.z = -.23;
    box(body, palette.trim, [.13, .12, .07], [.205, 1.22, .265]);
    rod(body, palette.trim, [-.29, 1.63, .21], [.24, 1.12, .2], .045);
    for (let i = 0; i < 5; i++) {
      mesh(body, new THREE.CylinderGeometry(.024, .025, .09, 5), palette.gold, -.145 + i * .066, 1.45 - i * .066, .242).rotation.z = -.72;
    }
    const gun = new THREE.Group();
    bones.rightArm.add(gun);
    gun.position.set(.13, -.64, .25);
    box(gun, palette.dark, [.105, .16, .09], [0, -.055, 0]).rotation.x = -.2;
    box(gun, palette.silver, [.105, .105, .24], [0, .035, .08]);
    rod(gun, palette.silver, [0, .055, .18], [0, .055, .49], .039, .042, 8);
    rod(gun, palette.dark, [0, .055, .486], [0, .055, .502], .025);
    const drum = mesh(gun, new THREE.CylinderGeometry(.078, .078, .13, 8), palette.dark, 0, .03, .075);
    drum.rotation.z = Math.PI / 2;
    box(gun, palette.gold, [.026, .026, .035], [0, .123, .40]);
    bones.weapon = gun;
    // Leather holster at the opposite hip.
    box(body, palette.trim, [.13, .3, .13], [-.34, .97, -.015]).rotation.z = -.13;
  } else if (id === 'apeilia') {
    // Pink twin falls: layered tapered locks instead of a helmet or cube head.
    for (const side of [-1, 1]) {
      const tail = new THREE.Group();
      tail.position.set(side * .23, .14, -.10);
      head.add(tail);
      orb(tail, palette.dark, [.12, .115, .10], [side * .055, 0, 0], 0);
      box(tail, palette.cyan, [.04, .095, .07], [side * .145, 0, .01]);
      for (let j = 0; j < 4; j++) {
        const strand = mesh(tail, new THREE.ConeGeometry(.115 - j * .015, .42, 5), palette.hair, side * (.05 + j * .035), -.23 - j * .22, -.045 - j * .025);
        strand.rotation.z = side * -.14;
        strand.rotation.x = Math.PI;
      }
      animated.push({ object: tail, type: 'hair', side });
    }
    // Shaped white chest, black waist, pink armor seams and skirt plates.
    orb(body, palette.white, [.30, .23, .21], [0, 1.47, .07], 0);
    box(body, palette.dark, [.15, .21, .025], [0, 1.47, .271]);
    orb(body, palette.cyan, [.05, .062, .025], [0, 1.55, .294], 0);
    for (const side of [-1, 1]) {
      box(body, palette.trim, [.055, .22, .05], [side * .22, 1.43, .215]).rotation.z = side * -.15;
      const hip = box(body, palette.white, [.24, .33, .13], [side * .28, 1.02, .02]);
      hip.rotation.z = side * -.22;
      box(body, palette.trim, [.19, .045, .14], [side * .315, .9, .04]);
      orb(bones[side === 1 ? 'rightArm' : 'leftArm'], palette.white, [.22, .12, .20], [side * .04, .03, 0], 0);
    }
    const sword = new THREE.Group();
    bones.rightArm.add(sword);
    sword.position.set(.135, -.66, .25);
    sword.rotation.x = -.3;
    rod(sword, palette.dark, [0, 0, 0], [0, -.02, .22], .043);
    box(sword, palette.white, [.22, .055, .075], [0, 0, .23]);
    const blade = mesh(sword, new THREE.ConeGeometry(.1, 1.22, 4), palette.cyan, 0, .02, .85, [.4, 1, 1]);
    blade.rotation.x = Math.PI / 2;
    rod(sword, palette.silver, [0, .015, .24], [0, .02, 1.37], .022, .005);
    bones.weapon = sword;
    for (const side of [-1, 1]) {
      const drone = new THREE.Group();
      drone.position.set(side * .73, 1.85, -.31);
      accessories.add(drone);
      orb(drone, palette.dark, [.25, .13, .18], [0, 0, 0], 0);
      box(drone, palette.white, [.45, .05, .17], [0, .06, -.015]);
      orb(drone, palette.violet, [.10, .075, .06], [0, -.005, .175], 0);
      for (const s of [-1, 1]) {
        const fin = box(drone, palette.trim, [.055, .23, .12], [s * .21, .015, -.005]);
        fin.rotation.z = s * -.55;
      }
      animated.push({ object: drone, type: 'drone', side, y: 1.85 });
    }
  } else if (id === 'haart') {
    // Demo interpretation: loose academy coat, pointed ears and an open book.
    mesh(body, new THREE.CylinderGeometry(.25, .43, .79, 9, 1, true), palette.coat, 0, .99, -.04);
    for (const side of [-1, 1]) {
      const lapel = plate(body, palette.trim, [[-.08, .20], [0, -.32], [.12, -.08], [.14, .24]], .025, [side * .15, 1.46, .20]);
      lapel.rotation.z = side * -.22;
      rod(body, palette.trim, [side * .29, 1.31, .20], [side * .36, .66, .23], .014);
      plate(head, palette.skin, [[-.035,-.08],[side*.13,.11],[.025,.06]], .035, [side*.26,0,0]);
      box(body, palette.dark, [.12, .20, .11], [side * .32, 1.06, -.03]);
    }
    const book = new THREE.Group(); bones.leftArm.add(book); book.position.set(-.10, -.51, .45); book.rotation.x = -.6;
    for(const side of [-1, 1]) {
      const leaf = new THREE.Group(); book.add(leaf); leaf.rotation.y = side * -.25;
      box(leaf, palette.dark, [.32,.44,.065], [side*.16,0,0]);
      box(leaf, palette.white, [.28,.39,.045], [side*.16,0,.048]);
      for(let row=0;row<5;row++) box(leaf,palette.trim,[.19,.008,.008],[side*.16,.12-row*.06,.075]);
      box(leaf,palette.gold,[.025,.44,.04],[side*.31,0,.02]);
    }
    rod(book,palette.gold,[0,-.24,0],[0,.24,0],.023);
    bones.weapon = book;
    for (let i = 0; i < 3; i++) {
      const page = box(accessories,palette.trim,[.13,.18,.014],[0,0,0]);
      animated.push({ object: page, type: 'prism', angle: i / 3 * TAU, y: 1.74, radius: .59 });
    }
  } else if (id === 'qianxing') {
    // Silver alloy exosuit; no furnace, heat tank, medieval shield or axe.
    orb(body, palette.silver, [.34, .28, .23], [0, 1.43, .08], 0);
    plate(body, palette.dark, [[-.28,.20],[-.19,-.22],[0,-.29],[.19,-.22],[.28,.20]], .08, [0,1.48,.22]);
    for (const side of [-1, 1]) {
      const arm = bones[side > 0 ? 'rightArm' : 'leftArm'];
      orb(arm, palette.silver, [.22,.15,.21], [side*.025,.04,0], 0);
      plate(arm,palette.trim,[[-.17,.03],[0,-.14],[.16,.02],[.10,.15],[-.10,.15]],.06,[side*.03,.015,.17]);
      plate(body,palette.silver,[[-.10,.16],[0,-.14],[.10,.16]],.08,[side*.155,.53,.12]);
      box(body,palette.cyan,[.025,.22,.025],[side*.19,1.44,.315]).rotation.z=side*-.2;
      box(body,palette.silver,[.15,.30,.07],[side*.16,.27,.11]);
      rod(body,palette.cyan,[side*.155,.13,.16],[side*.155,.4,.15],.012);
      box(body,palette.dark,[.17,.43,.13],[side*.18,1.38,-.29]);
    }
    box(body,palette.cyan,[.045,.25,.026],[0,1.47,.323]);
    plate(head,palette.silver,[[-.045,.11],[.035,.09],[.035,-.09],[-.04,-.11]],.027,[-.23,.01,.09]);
    box(head,palette.cyan,[.018,.04,.018],[-.255,.04,.12]);
    const emitter = new THREE.Group(); bones.rightArm.add(emitter); emitter.position.set(.13,-.52,.24);
    box(emitter,palette.silver,[.25,.23,.43],[0,0,.16]);
    box(emitter,palette.dark,[.18,.16,.09],[0,0,.40]);
    orb(emitter,palette.cyan,[.059,.059,.025],[0,0,.455],1);
    for(const side of [-1,1])rod(emitter,palette.trim,[side*.1,.075,.13],[side*.1,.075,.42],.018);
    bones.weapon=emitter;
    const gauntlet = new THREE.Group(); bones.leftArm.add(gauntlet); gauntlet.position.set(-.13,-.5,.25);
    box(gauntlet,palette.silver,[.26,.32,.16],[0,0,0]);
    for(const x of [-.075,0,.075])rod(gauntlet,palette.trim,[x,.10,.05],[x,.10,.35],.026,.008,5);
  } else if (id === 'youmu') {
    // A travelling doctor changes into a ship captain: the same person, two
    // readable coats and tools. Pose/state is taken directly from combat data.
    const doctor = new THREE.Group(), captain = new THREE.Group();
    body.add(doctor, captain); forms.doctor = doctor; forms.captain = captain;
    const captainBlue = material('#1b4554'), brass = material('#bda76d', { metalness: .55, roughness: .38 });
    for (const side of [-1, 1]) {
      plate(doctor, palette.coat, [[-.11,.4],[.11,.38],[.17,-.38],[-.15,-.46]], .035, [side*.24,1.15,-.02]).rotation.z=side*-.09;
      box(doctor,palette.trim,[.16,.12,.025],[side*.18,1.3,.22]);
      const tail=plate(captain,captainBlue,[[-.16,.45],[.17,.40],[.24,-.48],[.07,-.67],[-.18,-.53]],.06,[side*.22,1.14,-.09]);tail.rotation.z=side*-.10;
      plate(captain,brass,[[-.12,.15],[.08,.16],[.11,-.12],[-.04,-.24]],.027,[side*.19,1.58,.24]);
      box(captain,brass,[.30,.04,.22],[side*.36,1.68,0]);
      for(let j=0;j<3;j++)box(captain,brass,[.04,.08,.03],[side*(.30+j*.06),1.62,.14]);
    }
    rod(doctor,palette.trim,[-.24,1.68,.21],[.25,1.05,.22],.025);
    const bag=box(doctor,palette.trim,[.26,.24,.14],[.31,1.02,.10]);bag.rotation.z=-.1;
    box(doctor,palette.white,[.08,.026,.018],[.32,1.045,.184]);
    box(doctor,palette.white,[.026,.08,.018],[.32,1.045,.186]);
    const cap=new THREE.Group();head.add(cap);forms.captainHat=cap;
    mesh(cap,new THREE.CylinderGeometry(.27,.29,.13,10),captainBlue,0,.29,0);
    orb(cap,captainBlue,[.34,.025,.25],[0,.237,.085],1);
    box(cap,brass,[.14,.032,.036],[0,.285,.265]);
    const injector=new THREE.Group();bones.rightArm.add(injector);injector.position.set(.13,-.67,.30);forms.doctorTool=injector;
    rod(injector,palette.silver,[0,0,0],[0,0,.34],.025,.02,10);
    rod(injector,palette.cyan,[0,0,.09],[0,0,.27],.028,.028,10);
    rod(injector,palette.silver,[0,0,.33],[0,0,.48],.006,.002,6);
    const cannon=new THREE.Group();bones.rightArm.add(cannon);cannon.position.set(.13,-.54,.23);forms.captainTool=cannon;
    rod(cannon,captainBlue,[0,0,0],[0,0,.64],.09,.07,12);
    rod(cannon,brass,[0,0,.56],[0,0,.70],.10,.09,12);
    orb(cannon,palette.cyan,[.069,.069,.015],[0,0,.706],1);
    box(cannon,brass,[.045,.06,.1],[0,.10,.43]);
    const compass=new THREE.Group();bones.leftArm.add(compass);compass.position.set(-.13,-.67,.27);
    mesh(compass,new THREE.CylinderGeometry(.11,.11,.038,12),brass).rotation.x=Math.PI/2;
    box(compass,palette.cyan,[.013,.16,.015],[0,0,.027]).rotation.z=.6;
    captain.visible=cap.visible=cannon.visible=false;
    bones.weapon=injector;
  } else if (id === 'patch') {
    // Clockwork scribe: a visible clock backplate, paper mantle, sword/shield
    // silhouette and a lens that opens while recording incoming attacks.
    const navy=material('#293c53'), parchment=material('#cbc4ad'), brass=palette.gold;
    for(const side of [-1,1]){
      plate(body,navy,[[-.13,.4],[.15,.38],[.19,-.47],[0,-.59],[-.16,-.44]],.04,[side*.22,1.14,-.03]).rotation.z=side*-.06;
      plate(body,parchment,[[-.09,.26],[.08,.24],[.11,-.24],[-.06,-.32]],.012,[side*.18,1.34,.24]);
      for(let row=0;row<4;row++)box(body,brass,[.11-row*.012,.011,.018],[side*.18,1.52-row*.085,.264]);
    }
    const clockwork=new THREE.Group();body.add(clockwork);clockwork.position.set(0,1.48,-.27);
    mesh(clockwork,new THREE.CylinderGeometry(.38,.38,.085,24),navy).rotation.x=Math.PI/2;
    const clockRim=mesh(clockwork,new THREE.TorusGeometry(.335,.023,6,40),brass,0,0,-.063);
    for(let i=0;i<12;i++){
      const a=i/12*TAU;const tick=box(clockwork,parchment,[.023,.071,.017],[Math.sin(a)*.275,Math.cos(a)*.275,-.079]);tick.rotation.z=-a;
    }
    const hand=new THREE.Group();clockwork.add(hand);box(hand,palette.cyan,[.018,.27,.019],[0,.10,-.09]);animated.push({object:hand,type:'clockHand',speed:.35});
    const shortHand=new THREE.Group();clockwork.add(shortHand);box(shortHand,brass,[.026,.19,.018],[0,.065,-.105]);animated.push({object:shortHand,type:'clockHand',speed:.07});
    box(head,palette.silver,[.20,.045,.035],[.13,.085,.224]);
    orb(head,palette.cyan,[.065,.037,.017],[.13,.085,.249],1);
    const sword=new THREE.Group();bones.rightArm.add(sword);sword.position.set(.14,-.66,.25);
    rod(sword,palette.dark,[0,0,0],[0,-.17,0],.038,.038,8);
    rod(sword,brass,[-.16,.03,0],[.16,.03,0],.022);
    plate(sword,palette.silver,[[-.06,.06],[-.066,.82],[0,1.02],[.066,.82],[.06,.06]],.035,[0,0,0]);
    rod(sword,palette.cyan,[0,.12,.037],[0,.82,.037],.008,.004);
    const shield=new THREE.Group();bones.leftArm.add(shield);shield.position.set(-.14,-.48,.33);
    plate(shield,navy,[[-.28,.28],[.28,.28],[.31,-.17],[0,-.43],[-.31,-.17]],.08);
    plate(shield,brass,[[-.23,.22],[.23,.22],[.245,-.15],[0,-.34],[-.245,-.15]],.04,[0,0,.078]);
    plate(shield,navy,[[-.19,.19],[.19,.19],[.20,-.13],[0,-.28],[-.20,-.13]],.024,[0,0,.12]);
    const lens=orb(shield,palette.cyan,[.105,.105,.045],[0,-.03,.163],1);forms.recordLens=lens;
    const aperture=mesh(shield,new THREE.TorusGeometry(.15,.018,5,24),palette.silver,0,-.03,.153);forms.recordRing=aperture;
    bones.weapon=sword;forms.shield=shield;
    lens.scale.multiplyScalar(.65);
  } else {
    // A silver-haired bartender/exorcist, with lapels, waistcoat and tails.
    box(body, palette.white, [.26, .48, .08], [0, 1.43, .187]);
    for (const side of [-1, 1]) {
      const lapel = box(body, palette.trim, [.1, .32, .045], [side * .115, 1.5, .25]);
      lapel.rotation.z = side * -.28;
      box(body, palette.coat, [.25, .80, .12], [side * .19, .82, -.16]).rotation.z = side * -.13;
      box(body, palette.silver, [.1, .055, .17], [side * .465, 1.05, .17]);
      orb(body, palette.dark, [.09, .043, .038], [side * .063, 1.66, .259], 0);
    }
    for (let i = 0; i < 3; i++) orb(body, palette.gold, [.023, .024, .025], [0, 1.44 - i * .11, .239], 0);
    const glass = new THREE.Group();
    bones.leftArm.add(glass);
    glass.position.set(-.13, -.65, .24);
    mesh(glass, new THREE.CylinderGeometry(.12, .018, .12, 8), material('#a1cfcf', { transparent: true, opacity: .75, metalness: .25 }), 0, .07, 0);
    rod(glass, palette.silver, [0, -.04, 0], [0, .04, 0], .012);
    mesh(glass, new THREE.CylinderGeometry(.064, .064, .012, 8), palette.silver, 0, -.05, 0);
    mesh(glass, new THREE.CylinderGeometry(.09, .045, .05, 8), palette.violet, 0, .07, 0);
    const book = new THREE.Group();
    bones.rightArm.add(book);
    book.position.set(.13, -.63, .27);
    book.rotation.set(.45, .15, -.15);
    box(book, palette.trim, [.22, .31, .09]);
    box(book, palette.white, [.18, .27, .073], [0, 0, .01]);
    box(book, palette.dark, [.23, .32, .025], [0, 0, .06]);
    box(book, palette.gold, [.035, .16, .013], [0, 0, .077]);
    box(book, palette.gold, [.12, .03, .013], [0, 0, .079]);
    bones.weapon = book;
    for (let i = 0; i < 4; i++) {
      const paper = new THREE.Group();
      const angle = i / 4 * TAU;
      paper.position.set(Math.cos(angle) * .68, 1.45 + i * .16, Math.sin(angle) * .55);
      paper.rotation.y = -angle;
      accessories.add(paper);
      box(paper, palette.gold, [.15, .3, .012]);
      for (let k = 0; k < 3; k++) {
        box(paper, palette.violet, [.075 - k * .015, .018, .016], [0, .065 - k * .07, .01]);
      }
      animated.push({ object: paper, type: 'rune', angle });
    }
  }
  const mats = new Set();
  root.traverse(node => { if (node.isMesh && node.material?.isMeshStandardMaterial) mats.add(node.material); });
  for (const mat of mats) {
    mat.userData.originalEmissive = mat.emissive.clone();
    mat.userData.originalIntensity = mat.emissiveIntensity;
  }
  return { id, root, body, bones, palette, animated, forms, mats, height: 2.43, hp: 1, shieldAmount: 0, flash: 0, action: false };
}

function golem() {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const dark = material('#30334c', { metalness: .18, roughness: .89 });
  const stone = material('#535570', { metalness: .16, roughness: .8 });
  const lightStone = material('#747087', { metalness: .25, roughness: .7 });
  const purple = material('#8750ca', { metalness: .45, roughness: .2, emissive: '#611cbd', emissiveIntensity: .45 });
  const bright = material('#d58bff', { metalness: .25, roughness: .22, emissive: '#ac3eff', emissiveIntensity: 2.4 });
  const armor = [];
  const addRock = (size, pos, mat = stone, rotation = [0, 0, 0]) => {
    const m = orb(body, mat, size, pos, 0);
    m.rotation.set(...rotation);
    m.userData.basePosition = m.position.clone();
    m.userData.baseScale = m.scale.clone();
    m.userData.seed = armor.length * 1.19;
    armor.push(m);
    return m;
  };
  for (const side of [-1, 1]) {
    addRock([.50, .3, .69], [side * .64, .28, .14], dark, [.1, 0, side * .08]);
    addRock([.38, .58, .4], [side * .61, .82, 0], stone, [0, .2, side * -.12]);
    orb(body, bright, [.19, .19, .19], [side * .58, 1.22, 0], 0);
    addRock([.43, .59, .43], [side * .50, 1.63, 0], dark, [0, 0, side * -.2]);
  }
  addRock([.73, .4, .48], [0, 2.05, 0], dark);
  addRock([1.02, .95, .63], [0, 2.96, -.16], stone, [.08, .1, 0]);
  for (const side of [-1, 1]) {
    addRock([.43, .61, .28], [side * .58, 2.99, .43], lightStone, [0, side * -.2, side * .32]);
    addRock([.46, .22, .32], [side * .33, 2.44, .42], dark, [0, 0, side * -.25]);
    addRock([.48, .30, .39], [side * .50, 3.67, .25], lightStone, [.15, 0, side * -.3]);
    addRock([.65, .55, .55], [side * 1.12, 3.37, -.015], dark, [0, .2, side * -.22]);
    addRock([.4, .55, .4], [side * 1.37, 2.78, .03], stone, [.15, 0, side * .12]);
    orb(body, bright, [.19, .19, .19], [side * 1.49, 2.29, .14], 0);
    addRock([.49, .57, .49], [side * 1.56, 1.92, .25], lightStone, [.2, 0, side * .1]);
    addRock([.51, .39, .46], [side * 1.62, 1.45, .36], dark);
    for (let f = 0; f < 3; f++) addRock([.14, .25, .19], [side * (1.34 + f * .23), 1.24, .51], stone, [.15, 0, side * .13]);
    addRock([.18, .29, .19], [side * 1.24, 1.5, .48], stone, [.5, 0, side * -.5]);
    for (let k = 0; k < 5; k++) {
      const c = crystal(body, [side * (1.03 + k * .13), 3.69 + (k % 2) * .07, -.12 + k * .035], [.75, 1.12 - k * .09, .75], k % 2 ? bright : purple, side * (-.15 - k * .14));
      c.userData.basePosition = c.position.clone();
      c.userData.baseScale = c.scale.clone();
      c.userData.seed = armor.length * 1.19;
      armor.push(c);
    }
  }
  const head = addRock([.45, .47, .40], [0, 3.99, .05], dark, [.04, 0, 0]);
  addRock([.29, .15, .28], [0, 3.73, .28], stone);
  for (const side of [-1, 1]) {
    const brow = addRock([.25, .10, .18], [side * .18, 4.10, .35], stone, [0, 0, side * .12]);
    box(body, bright, [.19, .052, .049], [side * .17, 4.055, .397]);
  }
  crystal(body, [0, 4.28, -.02], [.60, .78, .60], purple, .15);
  // Exposed crystal remains visible through an intentionally open chest.
  const core = new THREE.Group();
  body.add(core);
  core.position.set(0, 3.04, .62);
  const coreGem = orb(core, bright, [.43, .57, .34], [0, 0, 0], 0);
  const orbit = ring(core, .68, .026, '#d696ff', 0, .65);
  orbit.rotation.set(Math.PI * .12, .3, 0);
  const coreInner = orb(core, material('#fff1ff', { emissive: '#e8adff', emissiveIntensity: 3 }), [.12, .21, .10]);
  const light = new THREE.PointLight('#bc60ff', 4.5, 5);
  light.position.set(0, 0, .7);
  core.add(light);
  const mats = new Set([dark, stone, lightStone, purple, bright]);
  for (const m of mats) {
    m.userData.originalEmissive = m.emissive.clone();
    m.userData.originalIntensity = m.emissiveIntensity;
  }
  return { id: 'boss', modelId: 'golem', accent: '#ba85ef', root, body, armor, core, coreGem, coreInner, coreLight: light, coreOrbit: orbit, mats, height: 4.8, hp: 1, stage: 0, coreOpen: false, coreProgress: 0, broken: false, flash: 0, action: false, animated: [] };
}

// Shaped, extruded surfaces give the two new enemies their own silhouettes.
function plate(parent, mat, outline, depth = .08, pos = [0, 0, 0]) {
  const shape = new THREE.Shape();
  shape.moveTo(...outline[0]);
  for (const point of outline.slice(1)) shape.lineTo(...point);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSize: .018, bevelThickness: .018, bevelSegments: 1, curveSegments: 4 });
  return mesh(parent, geometry, mat, ...pos);
}

function finishEnemy(modelId, root, body, bones, animated, accent, height) {
  const mats = new Set();
  root.traverse(node => { if (node.isMesh && node.material?.isMeshStandardMaterial) mats.add(node.material); });
  for (const mat of mats) {
    mat.userData.originalEmissive = mat.emissive.clone();
    mat.userData.originalIntensity = mat.emissiveIntensity;
  }
  return { id: 'boss', modelId, root, body, bones, animated, mats, accent, height, armor: [], hp: 1, stage: 0, coreOpen: false, coreProgress: 0, broken: false, flash: 0, action: false };
}

function duelist() {
  const root = new THREE.Group(), body = new THREE.Group();
  root.add(body);
  const bones = {}, animated = [];
  const dark = material('#102c35', { metalness: .65, roughness: .38 });
  const blue = material('#286172', { metalness: .7, roughness: .33 });
  const gold = material('#a68b55', { metalness: .85, roughness: .32 });
  const edge = material('#c5d3c0', { metalness: .88, roughness: .23 });
  const light = material('#8ffff0', { emissive: '#2ed9d0', emissiveIntensity: 1.65, metalness: .4, roughness: .2 });
  const mirror = material('#6caeae', { metalness: .95, roughness: .12, emissive: '#154c58', emissiveIntensity: .4 });
  // Slender articulated legs and layered greaves, unlike the giant's stone masses.
  for (const side of [-1, 1]) {
    rod(body, dark, [side * .25, .24, .04], [side * .22, 1.89, -.04], .10, .14, 8);
    orb(body, gold, [.16, .16, .17], [side * .26, .96, .02], 1);
    const foot = plate(body, dark, [[-.16, 0], [.20, 0], [.16, .29], [-.11, .31]], .38, [side * .27, .08, -.13]);
    foot.rotation.x = -.18;
    for (let n = 0; n < 3; n++) {
      plate(body, n % 2 ? gold : blue, [[-.17, .02], [0, -.09], [.16, .04], [.14, .35], [-.13, .37]], .12, [side * .27, .37 + n * .20, .04]);
    }
    plate(body, blue, [[-.19, .03], [0, -.08], [.18, .02], [.18, .65], [-.15, .75]], .18, [side * .21, 1.05, -.01]);
    rod(body, light, [side * .27, .34, .23], [side * .27, .74, .24], .017, .011, 4);
    const skirt = plate(body, blue, [[-.24, -.02], [0, -.40], [.24, .02], [.20, .57], [-.16, .62]], .13, [side * .35, 1.76, .07]);
    skirt.rotation.z = side * -.24;
    plate(body, gold, [[-.12, 0], [0, -.20], [.12, 0], [.09, .37], [-.08, .41]], .02, [side * .42, 1.75, .26]).rotation.z = side * -.24;
  }
  mesh(body, new THREE.CylinderGeometry(.28, .23, .62, 8), dark, 0, 2.23, -.03);
  for (let n = 0; n < 4; n++) {
    const w = .31 + n * .065;
    plate(body, n % 2 ? blue : gold, [[-w, .08], [0, -.04], [w, .08], [w * .89, .28], [0, .20], [-w * .89, .28]], .18, [0, 2.19 + n * .19, .09]);
  }
  plate(body, blue, [[-.58, .19], [-.27, -.04], [0, -.17], [.27, -.04], [.58, .19], [.40, .49], [-.40, .49]], .28, [0, 2.74, -.09]);
  plate(body, gold, [[-.42, .21], [0, -.03], [.42, .21], [.30, .30], [0, .10], [-.30, .30]], .035, [0, 2.76, .215]);
  const gem = orb(body, light, [.14, .23, .10], [0, 2.94, .32], 0);
  animated.push({ object: gem, type: 'heart', y: 2.94 });
  // Two separate arm chains support the common attack animation interface.
  for (const side of [-1, 1]) {
    const arm = new THREE.Group();
    body.add(arm);
    arm.position.set(side * .59, 3.04, 0);
    bones[side > 0 ? 'rightArm' : 'leftArm'] = arm;
    orb(arm, gold, [.18, .18, .18], [0, 0, 0], 1);
    rod(arm, dark, [0, 0, 0], [side * .21, -.74, .12], .075, .1, 8);
    plate(arm, blue, [[-.27, 0], [0, -.23], [.28, .02], [.18, .25], [-.19, .22]], .31, [side * .09, .04, -.14]).rotation.z = side * -.2;
    plate(arm, gold, [[-.16, .02], [0, -.1], [.16, .02], [.12, .26], [-.11, .25]], .10, [side * .12, -.35, .065]);
    orb(arm, gold, [.10, .10, .10], [side * .20, -.69, .11], 1);
    rod(arm, blue, [side * .20, -.74, .11], [side * .22, -1.04, .27], .1, .13, 5);
    orb(arm, dark, [.105, .12, .11], [side * .22, -1.12, .28], 1);
  }
  const head = new THREE.Group();
  body.add(head); head.position.set(0, 3.66, -.02); bones.head = head;
  rod(body, gold, [0, 3.13, -.02], [0, 3.5, -.02], .12);
  orb(head, dark, [.29, .37, .27], [0, 0, 0], 1);
  plate(head, edge, [[-.22, .19], [-.19, -.12], [0, -.35], [.19, -.12], [.22, .19], [0, .32]], .055, [0, 0, .21]);
  plate(head, dark, [[-.2, .05], [0, -.07], [.2, .05], [.18, .12], [0, .03], [-.18, .12]], .02, [0, 0, .279]);
  for (const side of [-1, 1]) {
    rod(head, light, [side * .04, .012, .31], [side * .17, .066, .30], .017, .022, 4);
    plate(head, gold, [[0, -.13], [side * .17, .08], [side * .23, .67], [side * .02, .35]], .11, [side * .24, .13, -.06]);
  }
  plate(head, blue, [[-.055, .08], [0, .61], [.055, .08]], .09, [0, .21, .0]);
  // A large continuous hooked mirror blade, edged in bronze and teal light.
  const sword = new THREE.Group();
  bones.rightArm.add(sword); sword.position.set(.22, -1.10, .30); sword.rotation.z = -.58;
  rod(sword, dark, [0, -.23, 0], [0, .22, 0], .055, .055, 8);
  rod(sword, gold, [-.27, .19, 0], [.29, .21, 0], .045, .036, 6);
  plate(sword, gold, [[-.08, .19], [-.11, .90], [.01, 1.60], [.31, 2.16], [.69, 2.50], [.50, 1.96], [.39, 1.42], [.31, .58], [.11, .19]], .13, [0, 0, -.06]);
  plate(sword, mirror, [[-.035, .27], [-.055, .94], [.07, 1.60], [.34, 2.13], [.57, 2.35], [.41, 1.95], [.30, 1.40], [.22, .57], [.07, .27]], .035, [0, 0, .085]);
  rod(sword, light, [-.045, .35, .135], [-.055, .96, .135], .017, .014, 4);
  rod(sword, light, [-.055, .96, .135], [.06, 1.59, .135], .014, .008, 4);
  bones.weapon = sword;
  // Mirrors orbit at the back, leaving the blade and face unobstructed.
  for (let i = 0; i < 4; i++) {
    const shard = new THREE.Group(); body.add(shard);
    plate(shard, gold, [[0, -.39], [.20, 0], [0, .42], [-.19, 0]], .055);
    plate(shard, mirror, [[0, -.30], [.13, 0], [0, .33], [-.12, 0]], .015, [0, 0, .07]);
    orb(shard, light, [.035, .06, .025], [0, 0, .10], 0);
    animated.push({ object: shard, type: 'mirror', angle: i / 4 * TAU, y: 2.8 + (i % 2) * .45 });
  }
  return finishEnemy('duelist', root, body, bones, animated, '#79e4d4', 4.55);
}

function cantor() {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const bones = {}, animated = [];
  const dark = material('#251e39', { roughness: .84 });
  const robe = material('#534264', { roughness: .9 });
  const violet = material('#8b537e', { roughness: .7 });
  const cream = material('#c9c7b0', { roughness: .75 });
  const gill = material('#719994', { roughness: .55, emissive: '#28514e', emissiveIntensity: .45 });
  const light = material('#9bffd3', { emissive: '#4edeb1', emissiveIntensity: 1.65, roughness: .3 });
  const pink = material('#e7afff', { emissive: '#a94acd', emissiveIntensity: 1.25, roughness: .35 });
  const makeTendril = (parent, points, radius, mat) => {
    const curve = new THREE.CatmullRomCurve3(points.map(point => V(...point)));
    return mesh(parent, new THREE.TubeGeometry(curve, 14, radius, 5, false), mat);
  };
  // A continuous bell-shaped robe floats above curling roots: no humanoid legs.
  const robeProfile = [[.12, .64], [.60, .80], [.94, 1.04], [.71, 1.45], [.44, 2.13], [.33, 2.70], [.51, 2.91], [.26, 3.03]].map(([x, y]) => new THREE.Vector2(x, y));
  mesh(body, new THREE.LatheGeometry(robeProfile, 12), dark);
  for (let i = 0; i < 9; i++) {
    const a = i / 9 * TAU;
    const panel = new THREE.Group(); body.add(panel); panel.rotation.y = a;
    plate(panel, i % 3 === 0 ? violet : robe, [[-.21, 2.78], [-.28, 2.20], [-.41, 1.61], [-.54, 1.03], [-.1, .82], [.15, 1.17], [.25, 1.95], [.20, 2.76]], .04, [0, 0, .29]);
    makeTendril(panel, [[0, 2.78, .35], [-.04, 2.1, .54], [-.18, 1.43, .68], [-.35, 1.04, .65]], .023, i % 3 === 0 ? light : gill);
    const tendril = new THREE.Group(); body.add(tendril); tendril.rotation.y = a;
    makeTendril(tendril, [[.23, 1.03, .28], [.44, .63, .39], [.74, .23, .48], [.97, .29, .32]], .043, i % 2 ? gill : cream);
    animated.push({ object: tendril, type: 'tendril', angle: a });
  }
  const heart = orb(body, pink, [.19, .29, .15], [0, 2.54, .48], 1);
  animated.push({ object: heart, type: 'heart', y: 2.54 });
  for (const side of [-1, 1]) {
    const arm = new THREE.Group(); body.add(arm); arm.position.set(side * .48, 2.80, 0);
    bones[side > 0 ? 'rightArm' : 'leftArm'] = arm;
    makeTendril(arm, [[0, 0, 0], [side * .32, -.14, .04], [side * .47, -.45, .24], [side * .62, -.40, .45]], .077, cream);
    const sleeve = mesh(arm, new THREE.ConeGeometry(.34, .85, 7, 1, true), robe, side * .30, -.25, .02);
    sleeve.rotation.z = side * .48;
    for (let f = 0; f < 3; f++) {
      makeTendril(arm, [[side * .60, -.40, .45], [side * (.72 + f * .045), -.27 + f * .035, .53], [side * (.75 + f * .06), -.32 + f * .055, .65]], .025, cream);
    }
    orb(arm, light, [.16, .17, .16], [side * .71, -.04, .55], 1);
  }
  const head = new THREE.Group(); body.add(head); head.position.set(0, 3.30, .05); bones.head = head;
  orb(head, dark, [.28, .39, .24], [0, 0, 0], 1);
  // A pale, long ceremonial mask reads as a face underneath the fungal crown.
  plate(head, cream, [[-.22, .22], [-.19, -.14], [0, -.43], [.19, -.14], [.22, .22], [0, .32]], .07, [0, .01, .19]);
  for (const side of [-1, 1]) {
    const eye = orb(head, dark, [.077, .04, .023], [side * .105, .016, .286], 1); eye.rotation.z = side * .22;
    orb(head, light, [.045, .012, .012], [side * .105, .017, .31], 0);
    makeTendril(head, [[side * .21, .15, .19], [side * .27, -.15, .19], [side * .20, -.36, .20]], .017, gill);
  }
  rod(head, gill, [0, -.06, .285], [0, -.29, .286], .009, .005, 4);
  const cap = new THREE.Group(); head.add(cap); cap.position.y = .27;
  const capProfile = [[0, .31], [.32, .29], [.68, .19], [1.01, -.01], [1.18, -.13], [1.15, -.21], [.70, -.12], [.24, -.07], [0, -.04]].map(([x, y]) => new THREE.Vector2(x, y));
  mesh(cap, new THREE.LatheGeometry(capProfile, 16), violet);
  for (let i = 0; i < 18; i++) {
    const a = i / 18 * TAU;
    rod(cap, i % 3 ? gill : light, [Math.cos(a) * .24, -.095, Math.sin(a) * .24], [Math.cos(a) * 1.11, -.205, Math.sin(a) * 1.11], .014, .025, 4);
    if (i % 2 === 0) orb(cap, cream, [.065, .02, .095], [Math.cos(a) * .76, .135, Math.sin(a) * .76], 0);
  }
  // A crown of smaller luminous fruiting bodies raises the silhouette above the mask.
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * TAU, h = .52 + (i % 3) * .11;
    const growth = new THREE.Group(); cap.add(growth); growth.position.set(Math.cos(a) * .50, .17, Math.sin(a) * .48);
    makeTendril(growth, [[0, 0, 0], [Math.cos(a) * .11, h * .6, Math.sin(a) * .1], [Math.cos(a) * .18, h, Math.sin(a) * .14]], .038, gill);
    orb(growth, i % 2 ? light : pink, [.23, .11, .23], [Math.cos(a) * .18, h, Math.sin(a) * .14], 1);
    animated.push({ object: growth, type: 'tendril', angle: a, gentle: true });
  }
  const halo = ring(body, 1.16, .018, '#b7edbe', 3.55, .38);
  halo.rotation.x = Math.PI * .18; halo.rotation.z = -.16;
  animated.push({ object: halo, type: 'halo' });
  for (let i = 0; i < 7; i++) {
    const spore = new THREE.Group(); body.add(spore);
    orb(spore, i % 2 ? light : pink, [.07, .10, .07], [0, 0, 0], 1);
    const veil = mesh(spore, new THREE.SphereGeometry(.16, 8, 6), new THREE.MeshBasicMaterial({ color: i % 2 ? '#99ffd3' : '#d4a7ef', transparent: true, opacity: .11, depthWrite: false }));
    veil.castShadow = false;
    animated.push({ object: spore, type: 'spore', angle: i / 7 * TAU, y: 1.50 + (i % 3) * .64 });
  }
  return finishEnemy('cantor', root, body, bones, animated, '#b0e8ba', 4.55);
}

function cord(parent, mat, points, radius = .025, segments = 18) {
  return mesh(parent, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => V(...p))), segments, radius, 5, false), mat);
}

function warden() {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const bones = {}, animated = [];
  const dark = material('#1b2c3a', { metalness: .7, roughness: .44 });
  const iron = material('#516575', { metalness: .85, roughness: .30 });
  const bronze = material('#a78955', { metalness: .75, roughness: .4 });
  const light = material('#c1ecff', { emissive: '#66b8ff', emissiveIntensity: 1.8, roughness: .25 });
  const amber = material('#e3bd6b', { emissive: '#be7326', emissiveIntensity: .45, metalness: .7 });
  // A low, broad four-legged engine carries a tall bank of lightning spines.
  orb(body, dark, [.87, .69, 1.09], [0, 1.75, -.13], 1);
  for (const side of [-1, 1]) {
    for (const front of [-1, 1]) {
      const leg = new THREE.Group(); body.add(leg);
      leg.position.set(side * .73, 1.77, front * .66);
      if (front > 0) bones[side > 0 ? 'rightArm' : 'leftArm'] = leg;
      orb(leg, bronze, [.31, .30, .30], [0, 0, 0], 0);
      rod(leg, dark, [0, 0, 0], [side * .29, -.66, .17], .16, .19, 7);
      rod(leg, iron, [side * .15, -.15, .15], [side * .38, -.63, .27], .06, .06, 7);
      orb(leg, light, [.11, .11, .11], [side * .29, -.68, .17], 0);
      rod(leg, iron, [side * .29, -.70, .17], [side * .17, -1.41, .31], .15, .21, 6);
      plate(leg, bronze, [[-.20, .21], [-.15, -.29], [0, -.41], [.17, -.29], [.20, .21]], .10, [side * .23, -1.02, .34]);
      orb(leg, dark, [.32, .17, .40], [side * .18, -1.57, .42], 0);
      for (let f = 0; f < 3; f++) rod(leg, iron, [side * .18 + (f - 1) * .17, -1.59, .53], [side * .18 + (f - 1) * .17, -1.64, .84], .08, .025, 5);
    }
    for (let i = 0; i < 4; i++) {
      const shell = plate(body, i % 2 ? iron : bronze, [[-.31, .19], [-.39, -.12], [0, -.29], [.40, -.12], [.31, .19]], .20, [side * .57, 2.08, -.89 + i * .44]);
      shell.rotation.y = side * Math.PI / 2; shell.rotation.z = side * -.4;
    }
    rod(body, light, [side * .76, 1.91, -.95], [side * .76, 1.91, .94], .027, .027, 5);
  }
  const head = new THREE.Group(); body.add(head); head.position.set(0, 2.06, .94); bones.head = head;
  orb(head, dark, [.49, .37, .39], [0, 0, 0], 0);
  plate(head, iron, [[-.44, .14], [-.36, -.13], [0, -.30], [.36, -.13], [.44, .14], [0, .34]], .24, [0, .03, .24]);
  plate(head, dark, [[-.32, .08], [0, -.06], [.32, .08], [.26, .16], [0, .05], [-.26, .16]], .035, [0, .02, .505]);
  for (const side of [-1, 1]) {
    rod(head, light, [side * .05, .02, .55], [side * .26, .1, .55], .030, .026, 4);
    rod(head, bronze, [side * .32, .22, .1], [side * .55, .67, .16], .11, .035, 5);
    rod(head, light, [side * .55, .67, .16], [side * .54, .91, .19], .035, .006, 5);
  }
  const jaw = plate(head, bronze, [[-.34, .02], [-.26, -.16], [.26, -.16], [.34, .02]], .19, [0, -.20, .27]);
  for (let i = 0; i < 4; i++) box(head, iron, [.045, .06, .065], [(i - 1.5) * .14, -.23, .48]);
  const reactor = mesh(body, new THREE.TorusGeometry(.40, .078, 7, 24), bronze, 0, 1.68, 1.03);
  orb(body, light, [.24, .24, .16], [0, 1.68, 1.09], 1);
  for (let i = 0; i < 4; i++) {
    const z = -.98 + i * .45, height = 1.09 + (1 - Math.abs(i - 1.5) / 2) * .45;
    const tower = new THREE.Group(); body.add(tower); tower.position.set(0, 2.25, z);
    rod(tower, dark, [0, 0, 0], [0, height, 0], .105, .048, 6);
    for (let j = 0; j < 4; j++) {
      mesh(tower, new THREE.CylinderGeometry(.18 - j * .014, .18 - j * .014, .066, 7), bronze, 0, .25 + j * .20, 0);
      const coil = mesh(tower, new THREE.TorusGeometry(.14 - j * .011, .014, 4, 16), light, 0, .32 + j * .20, 0); coil.rotation.x = Math.PI / 2;
      animated.push({ object: coil, type: 'coil', phase: i + j * .4 });
    }
    crystal(tower, [0, height + .10, 0], [.28, .49, .28], light, i % 2 ? .16 : -.16);
  }
  for (const side of [-1, 1]) {
    const arc = cord(body, light, [[0, 3.47, -.88], [side * .24, 3.72, -.55], [side * .13, 3.37, -.22], [side * .29, 3.72, .15], [0, 3.43, .40]], .014, 9);
    animated.push({ object: arc, type: 'electric', phase: side });
  }
  cord(body, bronze, [[0, 1.88, -1.08], [0, 1.65, -1.47], [.40, 1.97, -1.69], [.51, 2.18, -1.53]], .09, 12);
  return finishEnemy('warden', root, body, bones, animated, '#a4d9ff', 4.1);
}

function weaver() {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const bones = {}, animated = [];
  const dark = material('#272334', { metalness: .2, roughness: .85 });
  const red = material('#603646', { roughness: .75 });
  const paper = material('#c5bba4', { roughness: .95, side: THREE.DoubleSide });
  const gold = material('#a88758', { metalness: .6, roughness: .47 });
  const ink = material('#5a445a', { roughness: .9 });
  const light = material('#d7b3eb', { emissive: '#9b5bb7', emissiveIntensity: 1.2 });
  const threadMat = new THREE.MeshBasicMaterial({ color: '#c9b597', transparent: true, opacity: .60 });
  mesh(body, new THREE.CylinderGeometry(.25, .41, 1.55, 8), dark, 0, 2.22, -.02);
  mesh(body, new THREE.CylinderGeometry(.31, .75, .83, 8, 1, true), red, 0, 1.27, -.02);
  // Torn scripture folds form a mantle rather than a solid stone torso.
  for (let i = 0; i < 11; i++) {
    const a = i / 11 * TAU;
    const page = new THREE.Group(); body.add(page); page.rotation.y = a;
    const length = 1.30 + (i % 3) * .23;
    plate(page, i % 4 ? paper : red, [[-.21, 0], [-.26, -.61], [-.37, -length], [-.09, -length + .13], [.02, -length - .13], [.29, -length + .05], [.21, -.45], [.17, .1]], .015, [0, 2.94, .29]);
    for (let row = 0; row < 6; row++) {
      const y = 2.74 - row * .16;
      box(page, i % 4 ? ink : gold, [.22 - (row % 3) * .036, .016, .018], [row % 2 ? .02 : -.01, y, .318]);
      if (row % 2 === 0) box(page, gold, [.027, .058, .018], [-.13, y, .32]);
    }
    animated.push({ object: page, type: 'pageFold', angle: a, phase: i });
  }
  for (const side of [-1, 1]) {
    rod(body, gold, [side * .22, 1.13, 0], [side * .39, .25, .19], .08, .11, 7);
    orb(body, dark, [.14, .10, .24], [side * .39, .16, .26], 0);
    const arm = new THREE.Group(); body.add(arm); arm.position.set(side * .43, 2.93, 0);
    bones[side > 0 ? 'rightArm' : 'leftArm'] = arm;
    orb(arm, gold, [.16, .16, .16], [0, 0, 0], 1);
    rod(arm, paper, [0, 0, 0], [side * .55, -.23, .07], .066, .08, 7);
    orb(arm, dark, [.10, .10, .10], [side * .56, -.24, .07], 1);
    rod(arm, paper, [side * .56, -.24, .07], [side * .72, -.68, .31], .058, .078, 7);
    orb(arm, gold, [.08, .08, .08], [side * .73, -.70, .31], 1);
    for (let f = 0; f < 3; f++) {
      cord(arm, paper, [[side * .73, -.7, .31], [side * (.79 + f * .09), -.81, .41], [side * (.83 + f * .10), -.93 + f * .04, .40]], .029, 6);
    }
    plate(arm, red, [[-.12, .05], [side * .50, -.12], [side * .58, -.67], [side * .29, -.86], [side * .20, -.22]], .018, [0, -.04, -.10]);
    // Gold strings lead from wrist to the high crossbar, visibly a marionette.
    cord(body, threadMat, [[side * 1.38, 4.09, -.12], [side * 1.28, 3.04, -.03], [side * 1.15, 2.24, .31]], .009, 8);
    cord(body, threadMat, [[side * .57, 4.34, -.12], [side * .42, 3.58, -.02], [side * .43, 2.95, 0]], .009, 8);
  }
  const head = new THREE.Group(); body.add(head); head.position.set(0, 3.43, 0); bones.head = head;
  orb(head, dark, [.27, .35, .24], [0, 0, 0], 1);
  plate(head, paper, [[-.19, .20], [-.20, -.11], [0, -.37], [.20, -.11], [.19, .20], [0, .32]], .055, [0, -.01, .18]);
  box(head, red, [.40, .13, .046], [0, .055, .253]);
  orb(head, gold, [.072, .081, .018], [0, .052, .29], 0);
  rod(head, ink, [0, -.12, .257], [0, -.27, .257], .010, .007, 4);
  rod(body, dark, [0, 3.67, -.17], [0, 4.30, -.17], .045, .045, 6);
  rod(body, gold, [-1.5, 4.04, -.17], [1.5, 4.04, -.17], .050, .050, 6);
  rod(body, gold, [-.64, 4.35, -.17], [.64, 4.35, -.17], .045, .045, 6);
  for (const side of [-1, 1]) crystal(body, [side * 1.50, 4.04, -.17], [.16, .25, .16], light, side * Math.PI / 2);
  for (let i = 0; i < 6; i++) {
    const leaf = new THREE.Group(); body.add(leaf);
    plate(leaf, paper, [[-.13, .26], [.14, .23], [.18, -.25], [-.11, -.29]], .010);
    for (let j = 0; j < 4; j++) box(leaf, ink, [.14 - (j % 2) * .04, .015, .018], [0, .13 - j * .07, .026]);
    animated.push({ object: leaf, type: 'leaf', angle: i / 6 * TAU, y: 1.65 + (i % 3) * .68 });
  }
  return finishEnemy('weaver', root, body, bones, animated, '#d6b894', 4.5);
}

function finalCore() {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const bones = {}, animated = [];
  const dark = material('#211c32', { metalness: .72, roughness: .34 });
  const gold = material('#a68d62', { metalness: .84, roughness: .29 });
  const stone = material('#534961', { metalness: .4, roughness: .50 });
  const red = material('#fa947c', { emissive: '#dd4c64', emissiveIntensity: 1.75 });
  const violet = material('#c6a4ff', { emissive: '#8158e6', emissiveIntensity: 1.45 });
  const voidMat = material('#171329', { metalness: .85, roughness: .13, emissive: '#27143c', emissiveIntensity: .4 });
  const head = new THREE.Group(); body.add(head); head.position.set(0, 2.71, 0); bones.head = head;
  const gem = mesh(head, new THREE.OctahedronGeometry(.77, 0), voidMat, 0, 0, .16, [.90, 1.12, .88]);
  animated.push({ object: gem, type: 'nucleus' });
  orb(head, red, [.14, .41, .10], [0, 0, .66], 0);
  const pupil = mesh(head, new THREE.TorusGeometry(.43, .033, 5, 32), gold, 0, 0, .40); pupil.rotation.y = .17;
  animated.push({ object: pupil, type: 'orbitRing', axis: 'y', speed: .21 });
  // Broken concentric machines encircle the core, with six separate arm shadows.
  for (let level = 0; level < 3; level++) {
    const orbit = new THREE.Group(); body.add(orbit); orbit.position.y = 2.71;
    orbit.rotation.set(.14 + level * .26, -.34 + level * .27, level * .48);
    const radius = 1.03 + level * .46;
    for (let sector = 0; sector < 4; sector++) {
      const arc = mesh(orbit, new THREE.TorusGeometry(radius, level === 2 ? .071 : .040, 5, 30, Math.PI * .40), level === 1 ? stone : gold);
      arc.rotation.z = sector * Math.PI / 2;
      const wire = mesh(orbit, new THREE.TorusGeometry(radius + .087, .012, 4, 28, Math.PI * .34), level % 2 ? red : violet);
      wire.rotation.z = sector * Math.PI / 2 + .06;
      const a = sector * Math.PI / 2 + .14;
      if (level === 2) {
        const stoneNode = orb(orbit, dark, [.17, .25, .14], [Math.cos(a) * radius, Math.sin(a) * radius, 0], 0);
        stoneNode.rotation.z = a;
      }
    }
    animated.push({ object: orbit, type: 'orbitRing', axis: 'z', speed: (level % 2 ? -.13 : .10) * (1 + level * .4) });
  }
  for (const side of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const arm = new THREE.Group(); body.add(arm); arm.position.set(side * .49, 2.68 + (i - 1) * .47, -.27);
      if (i === 1) bones[side > 0 ? 'rightArm' : 'leftArm'] = arm;
      const y = (i - 1) * .55;
      rod(arm, dark, [0, 0, 0], [side * .84, y, -.10], .10, .17, 5);
      orb(arm, gold, [.16, .16, .16], [side * .84, y, -.10], 0);
      rod(arm, stone, [side * .88, y, -.10], [side * 1.36, y - .53, .24], .13, .09, 5);
      rod(arm, i % 2 ? violet : red, [side * .19, y * .18, .04], [side * .76, y, .045], .016, .023, 4);
      for (let f = 0; f < 3; f++) {
        cord(arm, gold, [[side * 1.35, y - .53, .24], [side * (1.52 + f * .07), y - .69, .34], [side * (1.48 + f * .10), y - .92, .48]], .034, 6);
      }
      if (i !== 1) animated.push({ object: arm, type: 'shadowArm', phase: i + side });
    }
  }
  const crown = new THREE.Group(); body.add(crown); crown.position.set(0, 4.22, -.14);
  for (let i = 0; i < 5; i++) crystal(crown, [(i - 2) * .24, Math.abs(i - 2) * -.10, 0], [.32, .66 - Math.abs(i - 2) * .1, .25], i % 2 ? red : gold, (i - 2) * -.17);
  for (let i = 0; i < 7; i++) {
    const shard = orb(body, i % 2 ? stone : gold, [.18, .36, .15], [0, 0, 0], 0);
    animated.push({ object: shard, type: 'debrisOrbit', angle: i / 7 * TAU, y: .79 + (i % 2) * .19 });
  }
  return finishEnemy('final', root, body, bones, animated, '#dfa1bf', 4.75);
}

const PARTY_IDS = ['knibbs', 'apeilia', 'ric', 'haart', 'qianxing', 'youmu', 'patch'];
const geometryKit={material,mesh,box,orb,rod,plate,ring,finishEnemy};
const ENEMY_FACTORIES = { golem, duelist, cantor, warden, weaver, final: finalCore,
  ...Object.fromEntries(['scout','bulwark','conduit'].map(id=>[id,()=>trainingEnemy(id,geometryKit)])),
  ...Object.fromEntries(['tide','furnace','orrery','arbiter'].map(id=>[id,()=>branchEnemy(id,geometryKit)]))};
const PARTY_PLACEMENTS = [[-3.8, .48, 2.4], [3.8, .48, 2.4], [0, .48, 4.2]];
const BOSS_POSITION = [0, .48, 0];
const facingCenter = position => Math.atan2(-position.x, -position.z);

export class BattleScene {
  constructor(container) {
    this.container = container;
    this.disposed = false;
    this.speed = 1;
    this.paused = false;
    this.time = 0;
    this.effects = [];
    this.actions = [];
    this.shake = 0;
    this.motionPreference = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    this.reducedMotion = !!this.motionPreference?.matches;
    this.onMotionPreference = event => {
      this.reducedMotion=event.matches;this.shake=0;
      this.setAtmosphere(this.actors.get('boss')?.modelId||'golem');
    };
    this.motionPreference?.addEventListener?.('change',this.onMotionPreference);
    this.random = seeded(18275);
    this.state = { mode: 'title', selected: 'knibbs' };
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#0a1320');
    this.scene.fog = new THREE.FogExp2('#0b1523', .026);
    this.camera = new THREE.OrthographicCamera(-10, 10, 7, -7, .1, 120);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.domElement.className = 'battle-canvas';
    this.renderer.domElement.setAttribute('aria-label', '格朗德三维战场，可拖动旋转视角，滚轮缩放');
    this.renderer.domElement.style.cssText = 'width:100%;height:100%;display:block;touch-action:none;';
    container.appendChild(this.renderer.domElement);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = .065;
    this.controls.enablePan = false;
    this.controls.minPolarAngle = .45;
    this.controls.maxPolarAngle = 1.40;
    this.controls.minAzimuthAngle = -Infinity;
    this.controls.maxAzimuthAngle = Infinity;
    this.controls.minZoom = .75;
    this.controls.maxZoom = 1.6;
    this.controls.rotateSpeed = .42;
    this.controls.zoomSpeed = .5;
    this.glowTexture = radialTexture();
    this.effectRoot = new THREE.Group();
    this.scene.add(this.effectRoot);
    this.createLights();
    this.environmentCache = new Map();
    this.createEnvironment();
    this.rememberEnvironment('ruins');
    this.environmentId = 'ruins';
    this.setEnvironmentLighting('ruins');
    this.actors = new Map();
    this.heroCache = new Map();
    this.activePartyIds = ['knibbs', 'apeilia', 'ric'];
    for (const [index, id] of this.activePartyIds.entries()) {
      const pos = PARTY_PLACEMENTS[index];
      const hero = person(id);
      hero.root.position.set(...pos);
      hero.root.rotation.y = facingCenter(hero.root.position);
      hero.basePosition = hero.root.position.clone();
      hero.baseRotation = hero.root.rotation.y;
      hero.visualScale = V(1.14, 1.04, 1.10);
      hero.root.scale.copy(hero.visualScale);
      hero.seed = this.actors.size * 1.71;
      this.scene.add(hero.root);
      this.createActorMarker(hero);
      this.actors.set(id, hero);
      this.heroCache.set(id, hero);
    }
    this.bossCache = new Map();
    const boss = golem();
    boss.root.position.set(...BOSS_POSITION);
    boss.root.rotation.y = Math.atan2(PARTY_PLACEMENTS[0][0], PARTY_PLACEMENTS[0][2]);
    boss.basePosition = boss.root.position.clone();
    boss.baseRotation = boss.root.rotation.y;
    boss.visualScale = V(.98, .98, .98);
    boss.root.scale.copy(boss.visualScale);
    boss.seed = 3.5;
    this.scene.add(boss.root);
    this.createActorMarker(boss);
    this.actors.set('boss', boss);
    this.bossCache.set('golem', boss);
    boss.isEnemy=true;boss.root.userData.enemyUnitId='boss';
    this.backdrop=new SceneBackdrop(this);this.backdrop.setWorld(this.environmentId);
    this.installScenePointers();
    loadSceneDetails(this).then(()=>{
      if(this.disposed)return;
      // Whichever optional library finishes last, complete worlds own the
      // visible scenery and late legacy decorations stay in the fallback.
      for(const [id,entry] of this.environmentCache)applySceneWorld(this,id,entry);
    });
    loadSceneWorlds(this);
    loadBossModels(this);
    this.setAtmosphere('golem');
    this.resetCamera();
    this.resize = this.resize.bind(this);
    this.resizeObserver = new ResizeObserver(this.resize);
    this.resizeObserver.observe(container);
    window.addEventListener('resize', this.resize);
    this.resize();
    this.lastTime = performance.now();
    this.frame = this.frame.bind(this);
    this.raf = requestAnimationFrame(this.frame);
  }

  createLights() {
    const ambient = new THREE.HemisphereLight('#adcfe4', '#24213e', 2.2);
    this.scene.add(ambient);
    const key = new THREE.DirectionalLight('#ceddfa', 4.1);
    key.position.set(-4, 12, 5);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    Object.assign(key.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12, near: .1, far: 40 });
    key.shadow.normalBias = .045;
    key.shadow.bias = -.00015;
    key.shadow.radius = 4;
    this.scene.add(key);
    const rim = new THREE.DirectionalLight('#7777ff', 3.2);
    rim.position.set(5, 6, -8);
    this.scene.add(rim);
    const warm = new THREE.PointLight('#ffc16a', 25, 15, 2);
    warm.position.set(-4.7, 3.5, 4.5);
    this.scene.add(warm);
    const cyan = new THREE.PointLight('#32ccd9', 22, 16, 2);
    cyan.position.set(-4, 3.5, -4.5);
    this.scene.add(cyan);
    const violet = new THREE.PointLight('#b15eff', 24, 14, 2);
    violet.position.set(5, 3.4, -4.8);
    this.scene.add(violet);
    this.stageLights = { ambient, key, rim, warm, cyan, violet };
  }

  createEnvironment() {
    const env = new THREE.Group();
    this.scene.add(env);
    this.environment = env;
    const rng = this.random;
    const stone = material('#293642');
    const rim = material('#465364');
    const dark = material('#141f2c');
    const chip = material('#526071');
    const violet = material('#5b389a', { metalness: .5, roughness: .26, emissive: '#511b99', emissiveIntensity: .32 });
    const purple = material('#a061dd', { metalness: .35, roughness: .28, emissive: '#772dce', emissiveIntensity: .7 });
    const cyan = material('#53d3cd', { emissive: '#207579', emissiveIntensity: .55, metalness: .4 });
    this.arenaCrystalMats = [violet, purple];
    mesh(env, new THREE.CylinderGeometry(7.20, 7.46, .42, 12), dark, 0, -.15, 0);
    mesh(env, new THREE.CylinderGeometry(6.99, 7.15, .22, 12), rim, 0, .14, 0);
    mesh(env, new THREE.CylinderGeometry(6.89, 6.91, .2, 48), stone, 0, .33, 0);
    // Individual radial paving stones make the surface feel built, not printed.
    const floorMats = ['#35414e', '#394653', '#303e4c', '#414b59', '#334250'].map(c => material(c));
    for (let band = 0; band < 4; band++) {
      const inner = band === 0 ? .05 : 1.55 + (band - 1) * 1.62;
      const outer = 1.55 + band * 1.62;
      const sections = band === 0 ? 8 : 16;
      for (let s = 0; s < sections; s++) {
        const start = s / sections * TAU + band * .1 + .011;
        const end = (s + 1) / sections * TAU + band * .1 - .011;
        const shape = new THREE.Shape();
        shape.moveTo(Math.cos(start) * inner, Math.sin(start) * inner);
        shape.lineTo(Math.cos(start) * outer, Math.sin(start) * outer);
        shape.absarc(0, 0, outer, start, end, false);
        shape.lineTo(Math.cos(end) * inner, Math.sin(end) * inner);
        shape.absarc(0, 0, inner, end, start, true);
        const p = mesh(env, new THREE.ShapeGeometry(shape, 4), floorMats[(s + band * 3) % floorMats.length], 0, .438 + rng() * .008, 0);
        p.rotation.x = -Math.PI / 2;
      }
    }
    ring(env, 5.7, .022, '#64bcbf', .458, .48);
    ring(env, 5.92, .013, '#72968f', .457, .48);
    ring(env, 3.04, .014, '#7c738f', .46, .3);
    this.arenaPulse = ring(env, 2.58, .018, '#9777d7', .461, .18);
    for (let i = 0; i < 32; i++) {
      const a = i / 32 * TAU;
      const glyph = new THREE.Group();
      glyph.position.set(Math.cos(a) * 5.82, .47, Math.sin(a) * 5.82);
      glyph.rotation.y = -a;
      env.add(glyph);
      const m = new THREE.MeshBasicMaterial({ color: i % 4 ? '#4b8e97' : '#89e1cf', transparent: true, opacity: .58 });
      box(glyph, m, [.11, .005, .018]);
      box(glyph, m, [.017, .005, .10], [.036, 0, .04]);
      if (i % 2) box(glyph, m, [.065, .005, .016], [-.011, 0, -.032]);
    }
    // Radial hairline fractures, some showing the magic beneath the stone.
    for (let i = 0; i < 22; i++) {
      const angle = rng() * TAU;
      const r = 1.5 + rng() * 4.7;
      const from = [Math.cos(angle) * r, .459, Math.sin(angle) * r];
      const to = [from[0] + (rng() - .5) * .7, .459, from[2] + (rng() - .5) * .7];
      rod(env, i % 4 === 0 ? violet : dark, from, to, .009, .004, 3);
    }
    // Broken ceremonial steps on the front edge.
    for (let i = 0; i < 3; i++) {
      box(env, rim, [2.3 + i * .26, .18, .46], [-1.5, .22 - i * .17, 6.75 + i * .36]);
    }
    // Submerged, faceted rock shelf visible beneath the floating ring.
    for (let i = 0; i < 15; i++) {
      const a = i / 15 * TAU;
      orb(env, dark, [1.05 + rng() * .4, .6 + rng() * .7, 1.1], [Math.cos(a) * 5.7, -.66, Math.sin(a) * 5.7], 0);
    }
    const floor = mesh(env, new THREE.PlaneGeometry(180, 180), material('#0b1722'), 0, -1.65, 0);
    floor.rotation.x = -Math.PI / 2;
    floor.castShadow = false;

    const makeColumn = (x, z, h, broken = false) => {
      const p = new THREE.Group();
      p.userData.detailReplacement='ruins-masonry';
      p.position.set(x, .48, z);
      env.add(p);
      mesh(p, new THREE.CylinderGeometry(.65, .78, .22, 6), dark, 0, .04, 0);
      mesh(p, new THREE.CylinderGeometry(.43, .59, .28, 6), rim, 0, .28, 0);
      const segments = Math.max(2, Math.floor(h / .7));
      for (let n = 0; n < segments; n++) {
        const part = mesh(p, new THREE.CylinderGeometry(.34, .39, (h - .5) / segments - .045, 6), n % 2 ? stone : rim, 0, .55 + n * (h - .5) / segments, 0);
        part.rotation.y = (n % 2) * .035;
      }
      if (!broken) {
        mesh(p, new THREE.CylinderGeometry(.62, .38, .30, 6), rim, 0, h, 0);
        box(p, chip, [1.0, .15, .91], [0, h + .18, 0]);
      } else {
        orb(p, chip, [.35, .25, .4], [.06, h - .05, 0], 0);
      }
      return p;
    };
    makeColumn(-4.4, -5.25, 4.25);
    makeColumn(-1.45, -6.5, 4.65);
    makeColumn(3.8, -5.75, 2.1, true);
    makeColumn(6.1, -.4, 1.4, true);
    makeColumn(-6.35, .15, 1.5, true);
    // A fractured arch, supported on one side and ending in free stone teeth.
    const archStart = V(-4.4, 4.93, -5.25);
    const archEnd = V(-1.45, 5.33, -6.5);
    for (let i = 0; i < 7; i++) {
      const t = i / 6;
      const p = archStart.clone().lerp(archEnd, t);
      p.y += Math.sin(t * Math.PI) * .84;
      const stoneBlock = box(env, i % 2 ? rim : stone, [.59, .46, .70], p.toArray());
      stoneBlock.userData.detailReplacement='ruins-masonry';
      stoneBlock.rotation.y = .4;
      stoneBlock.rotation.z = -.25 + t * .4;
    }
    for (let i = 0; i < 36; i++) {
      const a = rng() * TAU;
      const r = 6 + rng() * 2.1;
      const s = .12 + rng() * .32;
      const b = orb(env, i % 3 ? stone : chip, [s * 1.4, s * .7, s], [Math.cos(a) * r, -.1 + s * .7, Math.sin(a) * r], 0);
      b.rotation.set(rng(), rng(), rng());
    }
    // Crystal growths at the arena perimeter and below the old arch.
    for (const [x, z, hue] of [[5, -4.5, 0], [-5.6, -2.8, 1], [4.9, 3.5, 0], [-3.5, -6.6, 1], [1, -6.8, 0]]) {
      orb(env, dark, [.8, .26, .65], [x, .45, z], 0);
      for (let j = 0; j < 5; j++) {
        const a = j / 5 * TAU;
        const scale = .6 + rng() * .55;
        crystal(env, [x + Math.cos(a) * .3, .7 + scale * .25, z + Math.sin(a) * .27], [.52, scale, .52], hue ? cyan : j % 2 ? purple : violet, (rng() - .5) * .65);
      }
      const glow = this.glow(hue ? '#31b9c4' : '#8151cc', 2.6, .37);
      glow.position.set(x, .7, z);
      env.add(glow);
    }
    // Warm braziers bring a gold edge light to the cool scene.
    this.flames = [];
    for (const [x, z] of [[-5.9, 3.2], [4.9, 4.7]]) {
      rod(env, dark, [x, .45, z], [x, 1.35, z], .15, .09, 6);
      mesh(env, new THREE.CylinderGeometry(.31, .17, .2, 7), rim, x, 1.35, z);
      const flame = orb(env, material('#ffc368', { emissive: '#f78b35', emissiveIntensity: 3 }), [.12, .34, .12], [x, 1.57, z], 0);
      const glow = this.glow('#ffa656', 1.65, .48);
      glow.position.set(x, 1.62, z);
      env.add(glow);
      this.flames.push({ flame, glow });
      const light = new THREE.PointLight('#ffac59', 5, 6);
      light.position.set(x, 1.85, z);
      env.add(light);
    }
    // Distant ruin silhouettes and geometric ridgelines fade naturally in fog.
    for (let i = 0; i < 22; i++) {
      const angle = Math.PI + i / 21 * Math.PI * 1.15;
      const r = 17 + rng() * 12;
      const x = Math.cos(angle) * r;
      const z = Math.sin(angle) * r - 8;
      const h = 2 + rng() * 7;
      mesh(env, new THREE.ConeGeometry(2 + rng() * 3.5, h, 5), material(i % 2 ? '#142634' : '#192a3c'), x, h / 2 - 2.0, z);
    }
    for (let i = 0; i < 7; i++) {
      const h = 3 + rng() * 5;
      const x = -15 + i * 4.8;
      const z = -15 - rng() * 10;
      box(env, dark, [.8, h, 1.05], [x, h / 2 - 1, z]);
      box(env, stone, [1.25, .3, 1.3], [x, h - 1, z]);
    }
    const moon = orb(env, new THREE.MeshBasicMaterial({ color: '#b0d3e2', fog: false }), [1.5, 1.5, 1.5], [-10.5, 12.7, -21], 2);
    moon.castShadow = false;
    const moonGlow = this.glow('#5fabc7', 10, .21);
    moonGlow.material.fog = false;
    moonGlow.position.copy(moon.position);
    env.add(moonGlow);

    const starPositions = [];
    for (let i = 0; i < 170; i++) starPositions.push((rng() - .5) * 85, 9 + rng() * 25, -25 - rng() * 35);
    const starsGeo = new THREE.BufferGeometry();
    starsGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
    env.add(new THREE.Points(starsGeo, new THREE.PointsMaterial({ color: '#b0c6df', size: .055, sizeAttenuation: true, transparent: true, opacity: .62, fog: false })));
    const dustPositions = [], dustColors = [];
    for (let i = 0; i < 170; i++) {
      dustPositions.push((rng() - .5) * 17, .5 + rng() * 7, (rng() - .5) * 17);
      const c = new THREE.Color(i % 3 ? '#64b5c1' : '#d19ce2');
      dustColors.push(c.r, c.g, c.b);
    }
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute('position', new THREE.Float32BufferAttribute(dustPositions, 3));
    dustGeo.setAttribute('color', new THREE.Float32BufferAttribute(dustColors, 3));
    this.dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ map: this.glowTexture, vertexColors: true, size: .11, transparent: true, opacity: .55, blending: THREE.AdditiveBlending, depthWrite: false }));
    env.add(this.dust);
    this.fogSprites = [];
    for (let i = 0; i < 12; i++) {
      const s = this.glow('#638c9c', 5 + rng() * 4, .032);
      s.scale.y *= .18;
      s.position.set((rng() - .5) * 19, -.3 + rng() * .6, (rng() - .5) * 18);
      env.add(s);
      this.fogSprites.push({ object: s, x: s.position.x, phase: rng() * TAU });
    }
  }

  rememberEnvironment(id) {
    this.environmentCache.set(id, {
      root: this.environment, arenaPulse: this.arenaPulse, crystalMats: this.arenaCrystalMats,
      flames: this.flames, dust: this.dust, fogSprites: this.fogSprites,
      animated: this.environmentAnimated || [],
    });
    detailEnvironment(this,id,this.environmentCache.get(id));
    applySceneWorld(this,id,this.environmentCache.get(id));
  }

  switchEnvironment(id) {
    if (id === this.environmentId) return;
    this.environment.visible = false;
    let entry = this.environmentCache.get(id);
    if (!entry) {
      if (id === 'storm') this.createStormEnvironment();
      else if (id === 'sanctum') this.createSanctumEnvironment();
      else if (id === 'floodworks'||id==='observatory') branchEnvironment(id,geometryKit,this);
      this.rememberEnvironment(id);
      entry = this.environmentCache.get(id);
    }
    this.environment = entry.root; this.environment.visible = true;
    this.arenaPulse = entry.arenaPulse; this.arenaCrystalMats = entry.crystalMats;
    this.flames = entry.flames; this.dust = entry.dust; this.fogSprites = entry.fogSprites;
    this.environmentAnimated = entry.animated;
    this.environmentId = id;
    this.setEnvironmentLighting(id);
    this.backdrop?.setWorld(id);
  }

  setEnvironmentLighting(id) {
    const palette=ENVIRONMENT_LIGHTING[id]||ENVIRONMENT_LIGHTING.ruins;
    // A loaded panorama is a Texture; reset to the palette while the next
    // world's image loads, then SceneBackdrop replaces it when ready.
    if(this.scene.background?.isColor)this.scene.background.set(palette.background);
    else this.scene.background=new THREE.Color(palette.background);
    this.scene.fog.color.set(palette.fog); this.scene.fog.density = palette.density;
    if (this.stageLights) {
      this.stageLights.ambient.color.set(palette.sky);
      this.stageLights.ambient.groundColor.set(palette.ground);
      for (const name of ['key', 'rim', 'warm', 'cyan', 'violet']) this.stageLights[name].color.set(palette[name]);
      // Warm stone and ivory retain their albedo; colored rim lights accent
      // silhouettes instead of washing every environment in saturated blue.
      for(const [name,intensity] of Object.entries({ambient:1.65,key:3.0,rim:1.15,warm:15,cyan:10,violet:8}))this.stageLights[name].intensity=intensity;
    }
  }

  environmentDust(env, colors, seed = 92) {
    const rng = seeded(seed), positions = [], vertexColors = [];
    for (let i = 0; i < 110; i++) {
      positions.push((rng() - .5) * 18, .7 + rng() * 7, (rng() - .5) * 16);
      const c = new THREE.Color(colors[i % colors.length]); vertexColors.push(c.r, c.g, c.b);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(vertexColors, 3));
    const points = new THREE.Points(geometry, new THREE.PointsMaterial({ map: this.glowTexture, vertexColors: true, size: .09, transparent: true, opacity: .49, blending: THREE.AdditiveBlending, depthWrite: false }));
    env.add(points); return points;
  }

  createStormEnvironment() {
    const env = new THREE.Group(); this.scene.add(env); this.environment = env;
    this.flames = []; this.fogSprites = []; this.arenaCrystalMats = []; this.environmentAnimated = [];
    const rng = seeded(723);
    const dark = material('#192b38', { metalness: .38, roughness: .70 });
    const steel = material('#455e6d', { metalness: .6, roughness: .5 });
    const pale = material('#748793', { metalness: .45, roughness: .64 });
    const bronze = material('#827152', { metalness: .7, roughness: .4 });
    const light = material('#9bd5ef', { emissive: '#4ba1e4', emissiveIntensity: 1.45, roughness: .24 });
    mesh(env, new THREE.CylinderGeometry(7.16, 6.69, .77, 8), dark, 0, -.07, 0);
    mesh(env, new THREE.CylinderGeometry(6.98, 7.08, .14, 8), steel, 0, .37, 0);
    // Offset, bolted platform sections replace the ceremonial circular paving.
    for (let x = -2; x <= 2; x++) for (let z = -2; z <= 2; z++) {
      if (Math.abs(x) === 2 && Math.abs(z) === 2) continue;
      box(env, (x + z) % 3 ? steel : pale, [2.18, .065, 2.10], [x * 2.24, .41, z * 2.17]);
      for (const side of [-1, 1]) mesh(env, new THREE.CylinderGeometry(.032, .038, .025, 6), bronze, x * 2.24 + side * .91, .456, z * 2.17 + .82);
    }
    this.arenaPulse = ring(env, 2.58, .018, '#8fcbeb', .462, .18);
    // Dark cuts with narrow blue energy seams branch across the deck.
    for (const trail of [
      [[-6.4, -1.1], [-4.5, -.91], [-3.2, -.32], [-1.5, -.42], [.2, .04], [2.3, -.25], [4.2, .58], [6.3, .66]],
      [[-2.7, -5.5], [-2.1, -3.8], [-1.2, -2.4], [-1.5, -.42]],
      [[2.3, -.25], [2.05, 1.5], [2.7, 3.0], [2.4, 5.8]],
    ]) for (let i = 0; i < trail.length - 1; i++) {
      const [a, b] = [trail[i], trail[i + 1]];
      rod(env, dark, [a[0], .458, a[1]], [b[0], .458, b[1]], .065, .045, 3);
      rod(env, light, [a[0], .468, a[1]], [b[0], .468, b[1]], .013, .011, 3);
    }
    for (const side of [-1, 1]) {
      // Exposed pylons, capacitor rings and grounding cables frame an open sky.
      const pylon = new THREE.Group(); env.add(pylon); pylon.position.set(side * 5.1, .46, -4.2);
      box(pylon, dark, [1.34, .25, 1.27], [0, .10, 0]);
      mesh(pylon, new THREE.CylinderGeometry(.27, .50, 4.4, 6), steel, 0, 2.38, 0);
      for (let i = 0; i < 6; i++) mesh(pylon, new THREE.CylinderGeometry(.43, .43, .10, 8), i % 2 ? bronze : dark, 0, 1.03 + i * .50, 0);
      const coil = mesh(pylon, new THREE.TorusGeometry(.56, .086, 6, 24), bronze, 0, 4.11, 0); coil.rotation.x = Math.PI / 2;
      for (let i = 0; i < 3; i++) {
        const a = i / 3 * TAU;
        rod(pylon, dark, [Math.cos(a) * .27, 3.72, Math.sin(a) * .27], [Math.cos(a) * .58, 4.65, Math.sin(a) * .58], .05, .026, 5);
        orb(pylon, light, [.095, .13, .095], [Math.cos(a) * .58, 4.65, Math.sin(a) * .58], 0);
      }
      crystal(pylon, [0, 4.65, 0], [.60, .87, .60], light);
      const glow = this.glow('#81c8f7', 2.5, .35); glow.position.set(0, 4.67, 0); pylon.add(glow);
      const source = new THREE.PointLight('#75b9ff', 14, 10); source.position.set(0, 4.6, 0); pylon.add(source);
      cord(env, dark, [[side * 5.1, .62, -4.2], [side * 4.4, .5, -3.25], [side * 5.55, .49, -.95], [side * 6.0, .5, 1.6]], .055, 15);
      for (let i = 0; i < 4; i++) {
        const z = -1.8 + i * 1.65;
        rod(env, steel, [side * 6.15, .45, z], [side * 6.15, 1.28, z], .065, .055, 5);
        box(env, bronze, [.15, .10, .15], [side * 6.15, 1.3, z]);
        if (i < 3) rod(env, dark, [side * 6.15, 1.13, z], [side * 6.15, 1.13, z + 1.65], .04);
      }
    }
    const arcMat = new THREE.MeshBasicMaterial({ color: '#a5d9fa', transparent: true, opacity: .45, blending: THREE.AdditiveBlending, depthWrite: false });
    const powerArc = cord(env, arcMat, [[-5.1, 5.0, -4.2], [-3.8, 5.8, -4.3], [-2.5, 5.2, -4.4], [-1.1, 5.9, -4.3], [.2, 5.1, -4.4], [1.8, 5.7, -4.3], [3.4, 5.3, -4.3], [5.1, 5.0, -4.2]], .017, 16);
    this.environmentAnimated.push({ object: powerArc, type: 'stormArc', phase: 0 });
    for (let i = 0; i < 13; i++) {
      const a = i / 13 * TAU, r = 11 + rng() * 10;
      const rock = orb(env, dark, [.7 + rng(), 1 + rng() * 1.7, .8 + rng()], [Math.cos(a) * r, -2.8 - rng() * 3, Math.sin(a) * r], 0);
      rock.rotation.set(rng(), rng(), rng());
    }
    for (let i = 0; i < 9; i++) {
      const cloud = this.glow('#7590a2', 10 + rng() * 9, .085); cloud.scale.y *= .19;
      cloud.position.set(-17 + i * 4.3, -1.8 + rng() * .7, -7 - rng() * 15); env.add(cloud);
      this.fogSprites.push({ object: cloud, x: cloud.position.x, phase: rng() * TAU, opacity: .075 });
    }
    for (const side of [-1, 1]) {
      const beam = mesh(env, new THREE.CylinderGeometry(.16, .85, 17, 6, 1, true), new THREE.MeshBasicMaterial({ color: '#97bdd7', transparent: true, opacity: .035, side: THREE.DoubleSide, depthWrite: false }), side * 9, 6.0, -12);
      beam.rotation.z = side * .23; beam.castShadow = false;
    }
    this.dust = this.environmentDust(env, ['#b7dced', '#739bc4'], 431);
  }

  createSanctumEnvironment() {
    const env = new THREE.Group(); this.scene.add(env); this.environment = env;
    this.flames = []; this.fogSprites = []; this.arenaCrystalMats = []; this.environmentAnimated = [];
    const rng = seeded(4941);
    const dark = material('#221f31', { metalness: .22, roughness: .82 });
    const slate = material('#4d4659', { metalness: .24, roughness: .69 });
    const gold = material('#8e795c', { metalness: .78, roughness: .45 });
    const red = material('#774758', { roughness: .8 });
    const light = material('#c8a3e8', { emissive: '#8a4fbc', emissiveIntensity: 1.2, roughness: .4 });
    const ember = material('#e4a185', { emissive: '#b3575d', emissiveIntensity: 1.0 });
    mesh(env, new THREE.CylinderGeometry(7.06, 7.48, .45, 10), dark, 0, .02, 0);
    mesh(env, new THREE.CylinderGeometry(6.92, 6.92, .20, 10), slate, 0, .33, 0);
    // An astral dial is inscribed into the dark metallic floor.
    for (const r of [1.6, 3.05, 4.6, 6.5]) ring(env, r, .019, '#b39567', .452, .38);
    this.arenaPulse = ring(env, 2.55, .022, '#d498c2', .461, .18);
    for (let i = 0; i < 10; i++) {
      const a = i / 10 * TAU;
      rod(env, gold, [Math.cos(a) * 1.70, .446, Math.sin(a) * 1.70], [Math.cos(a) * 6.50, .446, Math.sin(a) * 6.50], .016);
      const tile = box(env, dark, [.34, .018, .34], [Math.cos(a) * 4.60, .446, Math.sin(a) * 4.60]); tile.rotation.y = -a + Math.PI / 4;
      orb(env, i % 2 ? light : ember, [.064, .025, .064], [Math.cos(a) * 4.6, .46, Math.sin(a) * 4.6], 0);
    }
    for (let i = 0; i < 5; i++) {
      const a = i / 5 * TAU;
      const b = (i + 2) / 5 * TAU;
      rod(env, red, [Math.cos(a) * 2.94, .45, Math.sin(a) * 2.94], [Math.cos(b) * 2.94, .45, Math.sin(b) * 2.94], .026, .026, 3);
    }
    // A sealed, massive double door replaces the ruined arch at the back.
    const gate = new THREE.Group(); gate.position.set(.30, .46, -7.2); env.add(gate);
    box(gate, dark, [6.8, 6.45, .72], [0, 3.05, 0]);
    for (const side of [-1, 1]) {
      box(gate, slate, [2.7, 5.6, .20], [side * 1.47, 3.06, .47]);
      box(gate, gold, [.15, 5.8, .13], [side * 2.98, 3.07, .63]);
      box(gate, gold, [.075, 5.4, .14], [side * .17, 3.08, .64]);
      for (let j = 0; j < 4; j++) {
        const panel = plate(gate, dark, [[-1.05, 0], [0, -.30], [1.05, 0], [1.05, .64], [0, .95], [-1.05, .64]], .10, [side * 1.48, .80 + j * 1.19, .59]);
        box(gate, gold, [.12, .16, .12], [side * 1.48, 1.08 + j * 1.19, .77]);
      }
      box(gate, dark, [.74, 6.85, .82], [side * 3.47, 3.12, .09]);
      for (let j = 0; j < 6; j++) mesh(gate, new THREE.CylinderGeometry(.56, .48, .24, 6), gold, side * 3.47, .34 + j * 1.11, .11);
    }
    box(gate, gold, [6.22, .18, .19], [0, 6.13, .62]);
    const seal = mesh(gate, new THREE.TorusGeometry(1.35, .046, 6, 48), gold, 0, 3.38, .79);
    const sealInner = mesh(gate, new THREE.TorusGeometry(1.09, .017, 4, 44), light, 0, 3.38, .83);
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * TAU, b = (i + 2) / 6 * TAU;
      rod(gate, light, [Math.cos(a) * 1.09, 3.38 + Math.sin(a) * 1.09, .84], [Math.cos(b) * 1.09, 3.38 + Math.sin(b) * 1.09, .84], .009);
    }
    const sealGlow = this.glow('#a26aa9', 5.0, .19); sealGlow.position.set(0, 3.38, 1.01); gate.add(sealGlow);
    const altarLight = new THREE.PointLight('#c686bd', 22, 13); altarLight.position.set(0, 3.3, 1.4); gate.add(altarLight);
    // Floating stones and tilted celestial rings surround the combat platform.
    for (let i = 0; i < 14; i++) {
      const a = i / 14 * TAU, r = 7.9 + rng() * 1.7;
      const rock = orb(env, i % 3 ? slate : gold, [.48 + rng() * .35, .56 + rng() * .7, .44 + rng() * .4], [Math.cos(a) * r, .10 + rng() * 2.2, Math.sin(a) * r], 0);
      rock.rotation.set(rng(), rng(), rng());
      this.environmentAnimated.push({ object: rock, type: 'floatingStone', y: rock.position.y, phase: i });
    }
    for (let i = 0; i < 2; i++) {
      const orbit = mesh(env, new THREE.TorusGeometry(8.35 + i * .66, .022, 4, 100, Math.PI * 1.76), new THREE.MeshBasicMaterial({ color: i ? '#997daa' : '#af916a', transparent: true, opacity: .29, depthWrite: false }), 0, -.4 + i * .5, 0);
      orbit.rotation.set(-Math.PI / 2 + .07 + i * .09, -.13, i * .42);
      this.environmentAnimated.push({ object: orbit, type: 'starRing', phase: i });
    }
    for (const side of [-1, 1]) for (let i = 0; i < 2; i++) {
      const x = side * (5.6 + i * 1.0), z = -3.8 + i * 7.0;
      mesh(env, new THREE.CylinderGeometry(.26, .40, 1.25, 6), dark, x, .95, z);
      mesh(env, new THREE.CylinderGeometry(.42, .22, .15, 7), gold, x, 1.60, z);
      const flame = orb(env, ember, [.14, .36, .14], [x, 1.78, z], 0);
      const glow = this.glow('#d79694', 1.9, .36); glow.position.set(x, 1.85, z); env.add(glow);
      this.flames.push({ flame, glow });
    }
    this.dust = this.environmentDust(env, ['#d8b390', '#ac85c7'], 86);
    for (let i = 0; i < 7; i++) {
      const mist = this.glow('#8c6b96', 7 + rng() * 4, .05); mist.scale.y *= .14;
      mist.position.set((rng() - .5) * 22, -.36, (rng() - .5) * 21); env.add(mist);
      this.fogSprites.push({ object: mist, x: mist.position.x, phase: i, opacity: .035 });
    }
  }

  createActorMarker(actor) {
    const ground = new THREE.Group();
    ground.position.copy(actor.basePosition);
    ground.position.y = .48;
    this.scene.add(ground);
    const isBoss = actor.id === 'boss',isEnemy=isBoss||actor.isEnemy;
    actor.marker = ring(ground, isBoss ? 1.34 : .6, isBoss ? .025 : .020, isBoss ? '#9d6edf' : '#79b2bd', .005, isBoss ? .4 : .35);
    actor.selection = ring(ground, isBoss ? 1.5 : .73, .028, '#e4c990', .016, 0, Math.PI * 1.65);
    actor.markerRoot = ground;
    actor.shield = mesh(actor.root, new THREE.SphereGeometry(isBoss ? 2.4 : 1.01, 18, 12), new THREE.MeshBasicMaterial({ color: '#6edee5', transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, wireframe: true }), 0, isBoss ? 2.4 : 1.2, 0, [1, 1.28, 1]);
    actor.shield.castShadow = false;
    actor.shield.visible = false;
    if (!isEnemy) {
      const marker = mesh(actor.root, new THREE.ConeGeometry(.10, .17, 4), new THREE.MeshBasicMaterial({ color: '#f2d498' }), 0, actor.height + .29, 0);
      marker.rotation.z = Math.PI;
      actor.arrow = marker;
    }
  }

  glow(color, size, opacity = .7) {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTexture, color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending }));
    sprite.scale.set(size, size, 1);
    return sprite;
  }

  resize() {
    if (this.disposed) return;
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    this.width = width;
    this.height = height;
    this.renderer.setSize(width, height, false);
    const aspect = width / height;
    // The canvas occupies the actual space between the HUD and command board.
    // Fit the combatants in that viewport, preserving the entire party on phones.
    const boss=this.actors.get('boss'),bounds=boss?.modelBounds;
    const view = this.modelReview ? Math.max(3.25, 4.3 / aspect) : this.exploration ? Math.max(10.6,13.5/aspect) : this.bossPreviewFocus ? Math.max((bounds?.y||boss?.height||4.8)+1.7,(Math.max(bounds?.x||4,bounds?.z||3)+2)/aspect) : this.artPreview ? Math.max(WORLD_PREVIEW_SPAN[this.environmentId]||20,26/aspect) : Math.max(12.5, 15.0 / aspect);
    this.camera.left = -view * aspect / 2;
    this.camera.right = view * aspect / 2;
    this.camera.top = view / 2;
    this.camera.bottom = -view / 2;
    this.camera.clearViewOffset();
    this.camera.updateProjectionMatrix();
  }

  resetCamera() {
    if(this.exploration){
      this.camera.position.set(9.5,12.5,17);this.camera.zoom=1;this.controls.target.set(0,1.3,0);this.controls.update();this.camera.updateProjectionMatrix();return;
    }
    if(this.modelReview){
      this.camera.position.set(3.5, 2.9, 6.5);
      this.camera.zoom=1;this.controls.target.set(0,1.66,0);
      this.camera.lookAt(this.controls.target);this.controls.update();this.camera.updateProjectionMatrix();return;
    }
    if(this.bossPreviewFocus){
      const boss=this.actors.get('boss'),focus=boss.basePosition.clone().add(V(0,boss.height*.46,0));
      const angle=boss.baseRotation+.47;
      this.camera.position.copy(focus).add(V(Math.sin(angle)*13.5,4.0,Math.cos(angle)*13.5));this.camera.zoom=1;
      this.controls.target.copy(focus);this.camera.lookAt(focus);this.controls.update();this.camera.updateProjectionMatrix();return;
    }
    if(this.artPreview){
      const focus=V(0,3.2,-1.5);
      this.camera.position.copy(focus).add(V(12.5,15.0,22));this.camera.zoom=1;
      this.controls.target.copy(focus);this.camera.lookAt(focus);this.controls.update();this.camera.updateProjectionMatrix();return;
    }
    this.camera.position.set(10.8, 12.4, 18.2);
    this.camera.zoom = 1;
    const focus=V();let count=0;for(const actor of this.actors.values()){focus.add(actor.basePosition);count++;}
    if(count)focus.divideScalar(count);focus.y=3.5;
    this.controls.target.copy(focus);
    this.camera.lookAt(this.controls.target);
    this.controls.update();
    this.camera.updateProjectionMatrix();
  }

  setSpeed(speed) { this.speed = clamp(Number(speed) || 1, .25, 4); }
  setPaused(paused) { this.paused = Boolean(paused); }

  previewBossAnimation(kind='attack') {
    if(this.disposed||this.modelReview||this.state.mode==='playing')return false;
    return playBossAnimation(this.actors.get('boss'),kind);
  }

  setBossPreviewFocus(enabled) {
    if(this.disposed||this.modelReview)return false;
    this.bossPreviewFocus=!!enabled;this.syncArtPreviewVisibility();this.resize();this.resetCamera();return true;
  }

  setArtPreview(enabled) {
    if(this.disposed||this.modelReview)return false;
    this.artPreview=!!enabled;if(!enabled)this.bossPreviewFocus=false;
    this.syncArtPreviewVisibility();this.resize();this.resetCamera();return true;
  }

  syncArtPreviewVisibility() {
    if(this.modelReview){syncEnemyVisibility(this);return;}
    if(this.artPreview&&this.bossPreviewFocus){
      this.artPreviewHeroVisibility??=new Map();
      for(const actor of this.actors.values()){
        if(actor.id==='boss')continue;
        if(!this.artPreviewHeroVisibility.has(actor))this.artPreviewHeroVisibility.set(actor,{root:actor.root.visible,marker:actor.markerRoot.visible,shield:actor.shield.visible});
        actor.root.visible=actor.markerRoot.visible=actor.shield.visible=false;
      }
    }else if(this.artPreviewHeroVisibility){
      for(const [actor,visible] of this.artPreviewHeroVisibility){
        if(this.actors.get(actor.id)!==actor)continue;
        actor.root.visible=visible.root;actor.markerRoot.visible=visible.marker;actor.shield.visible=visible.shield;
      }
      this.artPreviewHeroVisibility=null;
    }
    syncEnemyVisibility(this);
  }

  getAssetStatus() {
    const boss=this.actors.get('boss');
    return {
      worlds:typeof this.worldStatus==='object'?{...this.worldStatus}:{status:this.worldStatus||'loading',worlds:this.worldLibrary?.size||0},
      bosses:{...(this.bossModelStatus||{status:'loading',bosses:0,clips:0})},
      currentBoss:{id:boss?.modelId,source:boss?.modelSource||'procedural',animations:boss?.bossAnimation?[...boss.bossAnimation.actions.keys()]:[]},
      backdrop:{world:this.environmentId,status:this.backdrop?.entries.get(this.environmentId)?.status||'idle'},
      enemies:[...this.actors.values()].filter(actor=>actor.isEnemy).map(actor=>({id:actor.id,modelId:actor.modelId,defeated:!!actor.defeated})),
    };
  }

  setAtmosphere(bossId) {
    this.atmosphere?.dispose();
    this.atmosphere=new SceneAtmosphere(this.scene,this.glowTexture,bossId,this.reducedMotion);
    this.atmosphere.root.visible=!this.modelReview;
    // The themed fixed-buffer layer replaces the old drifting dust cloud.
    for(const entry of this.environmentCache.values())if(entry.dust)entry.dust.visible=false;
    if(this.environmentId==='floodworks'&&this.stageLights){
      this.stageLights.warm.color.set(bossId==='furnace'?'#ff9954':'#e2bd83');
      this.stageLights.rim.color.set(bossId==='furnace'?'#dc7860':'#52bdbe');
    }
  }

  clearReactionOverlay(actor) {
    for(const delta of actor.reactionOverlay||[]){
      delta.object.position.x-=delta.x||0;delta.object.position.y-=delta.y||0;delta.object.position.z-=delta.z||0;
      delta.object.rotation.x-=delta.rx||0;delta.object.rotation.y-=delta.ry||0;delta.object.rotation.z-=delta.rz||0;
    }
    actor.reactionOverlay=[];
  }

  applyReaction(actor,dt) {
    const reaction=actor.reaction;if(!reaction)return;
    reaction.age+=dt;
    const pose=reactionPose(reaction.age,{...reaction,reducedMotion:this.reducedMotion,boss:actor.isEnemy||actor.id==='boss'});
    if(pose.done){actor.reaction=null;return;}
    const add=(object,delta)=>{if(!object)return;actor.reactionOverlay.push({object,...delta});object.position.x+=delta.x||0;object.position.y+=delta.y||0;object.position.z+=delta.z||0;object.rotation.x+=delta.rx||0;object.rotation.y+=delta.ry||0;object.rotation.z+=delta.rz||0;};
    add(actor.root,{x:reaction.worldDirection.x*pose.step,z:reaction.worldDirection.z*pose.step});
    if(actor.bossAnimation)return;
    add(actor.body,{y:pose.crouch,rx:pose.pitch,rz:pose.roll});
    add(actor.bones?.head,{rx:pose.headPitch,rz:pose.headRoll});
    add(actor.bones?.leftArm,{rx:pose.leftArm,rz:pose.armSpread});
    add(actor.bones?.rightArm,{rx:pose.rightArm,rz:-pose.armSpread});
    // The crystal golem has separate armor pieces instead of humanoid bones.
    // Their rotations supplement its weighted body bend without disturbing
    // the independent core-opening positions and scales.
    if(!actor.bones&&actor.armor)for(const part of actor.armor){
      const base=part.userData.basePosition;
      if(base.y>3.7&&Math.abs(base.x)<.55)add(part,{rx:pose.headPitch,rz:pose.headRoll});
      else if(Math.abs(base.x)>1.1)add(part,{rx:base.x<0?pose.leftArm*.35:pose.rightArm*.35,rz:Math.sign(base.x)*pose.armSpread*.4});
    }
  }

  loadDetailedHero(hero) {
    if (hero.modelPromise) return hero.modelPromise;
    hero.modelPromise = new Promise(resolve => {
      new GLTFLoader().load(QIANXING_MODEL_URL, gltf => {
        const body = gltf.scene;
        if (this.disposed||hero.sceneReleased) { this.removeEffect(body); resolve({ status: 'disposed' }); return; }
        const bones = Object.fromEntries(['head', 'rightArm', 'leftArm'].map(name => [name, body.getObjectByName(name)]));
        if (Object.values(bones).some(bone => !bone)) {
          this.removeEffect(body);
          resolve({ status: 'fallback', reason: '模型缺少动作枢轴' });
          return;
        }
        const mats = new Set();
        body.traverse(node => {
          if (!node.isMesh) return;
          node.castShadow = node.receiveShadow = true;
          for (const mat of Array.isArray(node.material) ? node.material : [node.material]) {
            if (!mat.emissive) continue;
            mat.userData.originalEmissive = mat.emissive.clone();
            mat.userData.originalIntensity = mat.emissiveIntensity;
            mats.add(mat);
          }
        });
        // Swap only the character, keeping combat markers and state intact.
        this.removeEffect(hero.body);
        hero.root.add(body);
        hero.body = body;
        hero.bones = bones;
        hero.mats = [...mats];
        hero.animated = [];
        hero.modelSource = 'blender';
        resolve({ status: 'ready', source: QIANXING_MODEL_URL });
      }, undefined, error => {
        console.warn('潜行模型载入失败，保留可玩的基础外观。', error);
        resolve({ status: 'fallback', reason: '模型载入失败，当前显示基础外观' });
      });
    });
    return hero.modelPromise;
  }

  async enterModelReview() {
    if (this.disposed) return { status: 'disposed' };
    this.exitExploration();
    if (this.modelReview) return this.loadDetailedHero(this.heroCache.get('qianxing'));
    this.setArtPreview(false);
    this.clearCombatEffects();
    let hero = this.heroCache.get('qianxing');
    if (!hero) {
      hero = person('qianxing');
      hero.basePosition = V(0, .48, 0);
      hero.visualScale = V(1.12, 1.04, 1.10);
      hero.baseRotation = 0;
      hero.seed = 0;
      this.scene.add(hero.root);
      this.createActorMarker(hero);
      this.heroCache.set('qianxing', hero);
      hero.root.visible = hero.markerRoot.visible = false;
    }
    const visibility = new Map([...this.actors.values(), hero].map(actor => [actor, {
      root: actor.root.visible, marker: actor.markerRoot.visible, shield: actor.shield.visible,
    }]));
    this.modelReview = {
      actors: this.actors, state: this.state, paused: this.paused, visibility,
      camera: this.camera.position.clone(), target: this.controls.target.clone(), zoom: this.camera.zoom,
      position: hero.root.position.clone(), basePosition: hero.basePosition.clone(),
      rotation: hero.root.rotation.clone(), baseRotation: hero.baseRotation,
      scale: hero.visualScale.clone(), hp: hero.hp,
    };
    for (const actor of visibility.keys()) actor.root.visible = actor.markerRoot.visible = actor.shield.visible = false;
    this.actors = new Map([['qianxing', hero], ['boss', this.actors.get('boss')]]);
    this.state = { mode: 'model', selected: 'qianxing' };
    this.paused = false;
    hero.basePosition.set(0, .48, 0);
    hero.root.position.copy(hero.basePosition);
    hero.root.rotation.set(0, 0, 0);
    hero.baseRotation = 0;
    hero.visualScale.set(1, 1, 1);
    hero.root.scale.copy(hero.visualScale);
    hero.hp = 1;
    hero.root.visible = true;
    hero.arrow.visible = false;
    beginModelStudio(this);
    this.resize();
    this.resetCamera();
    return this.loadDetailedHero(hero);
  }

  exitModelReview() {
    const saved = this.modelReview;
    if (!saved || this.disposed) return;
    endModelStudio(this);
    const hero = this.heroCache.get('qianxing');
    hero.root.position.copy(saved.position);
    hero.basePosition.copy(saved.basePosition);
    hero.root.rotation.copy(saved.rotation);
    hero.baseRotation = saved.baseRotation;
    hero.visualScale.copy(saved.scale);
    hero.root.scale.copy(saved.scale);
    hero.hp = saved.hp;
    this.actors = saved.actors;
    this.state = saved.state;
    this.paused = saved.paused;
    for (const [actor, visibility] of saved.visibility) {
      actor.root.visible = visibility.root;
      actor.markerRoot.visible = visibility.marker;
      actor.shield.visible = visibility.shield;
    }
    this.modelReview = null;
    this.resize();
    this.camera.position.copy(saved.camera);
    this.camera.zoom = saved.zoom;
    this.controls.target.copy(saved.target);
    this.camera.lookAt(saved.target);
    this.controls.update();
    this.camera.updateProjectionMatrix();
  }

  switchBoss(requestedId) {
    const modelId = Object.hasOwn(ENEMY_FACTORIES, requestedId) ? requestedId : 'golem';
    const current = this.actors.get('boss');
    if (current.modelId === modelId) return current;
    // Cached meshes remain owned by the
    // scene and are disposed with it, including their hidden ground markers.
    this.clearCombatEffects();
    current.root.visible = false;
    current.markerRoot.visible = false;
    let next = this.bossCache.get(modelId);
    if (!next) {
      next = ENEMY_FACTORIES[modelId]();
      next.root.position.set(...BOSS_POSITION);
      next.root.rotation.y = Math.atan2(PARTY_PLACEMENTS[0][0], PARTY_PLACEMENTS[0][2]);
      next.basePosition = next.root.position.clone();
      next.baseRotation = next.root.rotation.y;
      next.visualScale = V(1, 1, 1);
      next.seed = 3.5;
      this.scene.add(next.root);
      this.createActorMarker(next);
      this.bossCache.set(modelId, next);
      detailEnemy(this,next);
    }
    applyBossModel(this,next);
    next.isEnemy=true;next.root.userData.enemyUnitId='boss';
    resetBossAnimation(next);
    next.root.visible = true;
    next.markerRoot.visible = true;
    next.root.position.copy(next.basePosition);
    next.root.scale.copy(next.visualScale);
    next.body.position.set(0, 0, 0);
    next.body.rotation.set(0, 0, 0);
    next.coreProgress = 0;
    next.flash = 0;
    next.action = false;
    next.shield.visible = false;
    next.marker.material.color.set(next.accent);
    this.actors.set('boss', next);
    this.switchEnvironment(['tide','furnace'].includes(modelId)?'floodworks':modelId==='orrery'?'observatory':modelId === 'warden' ? 'storm' : ['weaver', 'final','arbiter'].includes(modelId) ? 'sanctum' : 'ruins');
    this.setAtmosphere(modelId);
    this.arenaPulse.material.color.set(next.accent);
    if (this.environmentId === 'ruins') {
      const colors = modelId === 'duelist' ? ['#37656c', '#72aa9c'] : modelId === 'cantor' ? ['#5e4a73', '#ab709e'] : ['#5b389a', '#a061dd'];
      this.arenaCrystalMats.forEach((mat, i) => {
        mat.color.set(colors[i]);
        mat.emissive.set(colors[i]).multiplyScalar(.55);
      });
    }
    return next;
  }

  clearCombatEffects() {
    for(const actor of this.actors.values()){this.clearReactionOverlay(actor);actor.reaction=null;actor.flash=0;resetBossAnimation(actor);}
    for (const action of this.actions) action.finish();
    this.actions.length = 0;
    for (const effect of this.effects) this.removeEffect(effect.object);
    this.effects.length = 0;
    this.shake = 0;
  }

  switchParty(heroes) {
    const ids = [...new Set(heroes.map(h => h.id).filter(id => PARTY_IDS.includes(id)))].slice(0, 3);
    if (!ids.length || ids.join('|') === this.activePartyIds.join('|')) return;
    this.clearCombatEffects();
    for (const id of this.activePartyIds) {
      const actor = this.actors.get(id);
      actor.root.visible = false;
      actor.markerRoot.visible = false;
      actor.shield.visible = false;
      this.actors.delete(id);
    }
    this.activePartyIds = ids;
    for (const [index, id] of ids.entries()) {
      let hero = this.heroCache.get(id);
      if (!hero) {
        hero = person(id);
        hero.basePosition = V(...PARTY_PLACEMENTS[index]);
        hero.visualScale = id === 'qianxing' ? V(1.12, 1.04, 1.10) : V(1.14, 1.04, 1.10);
        this.scene.add(hero.root);
        this.createActorMarker(hero);
        this.heroCache.set(id, hero);
        if(id==='qianxing')this.loadDetailedHero(hero);
      }
      hero.basePosition.set(...PARTY_PLACEMENTS[index]);
      hero.root.position.copy(hero.basePosition);
      hero.markerRoot.position.copy(hero.basePosition);
      hero.baseRotation = facingCenter(hero.basePosition);
      hero.root.rotation.set(0, hero.baseRotation, 0);
      hero.root.scale.copy(hero.visualScale);
      hero.root.visible = true;
      hero.markerRoot.visible = true;
      hero.body.position.set(0, 0, 0);
      hero.body.rotation.set(0, 0, 0);
      hero.seed = index * 1.71;
      hero.flash = 0;
      hero.action = false;
      this.actors.set(id, hero);
    }
  }

  updateState(state = {}) {
    if (this.disposed) return;
    if(this.modelReview)return;
    this.state = { ...this.state, ...state };
    if(this.exploration)return;
    if (state.heroes) this.switchParty(state.heroes);
    for (const data of state.heroes || []) {
      const hero = this.actors.get(data.id);
      if (!hero) continue;
      hero.hp = typeof data.hp === 'number' ? data.hp : hero.hp;
      hero.shieldAmount = Math.max(0, data.shield || 0);
      hero.shield.visible = hero.shieldAmount > 0 && hero.hp > 0;
      if(data.id==='youmu'&&hero.forms){
        const captain=data.youmuForm==='captain';
        hero.forms.doctor.visible=hero.forms.doctorTool.visible=!captain;
        hero.forms.captain.visible=hero.forms.captainHat.visible=hero.forms.captainTool.visible=captain;
        hero.bones.weapon=captain?hero.forms.captainTool:hero.forms.doctorTool;
      }
      if(data.id==='patch'&&hero.forms){
        const recording=data.patchForm==='record';
        hero.forms.recordLens.scale.set(.105,.105,.045).multiplyScalar(recording?1.15:.65);
        hero.forms.recordRing.scale.setScalar(recording?1.12:1);
        hero.forms.shield.rotation.y=recording?-.22:.12;
      }
    }
    const boss = state.boss ? this.switchBoss(state.boss.modelId||state.boss.id) : this.actors.get('boss');
    this.applyFormation(state.boss?.id||boss.modelId);
    if (state.boss) {
      boss.hp = state.boss.hp ?? boss.hp;
      boss.defeated=!!state.boss.defeated;
      boss.stage = state.boss.stage || 0;
      boss.coreOpen = boss.modelId === 'golem' && !!state.boss.core;
      boss.finaleOpen = boss.modelId === 'final' && !!state.boss.finale;
      boss.sealCount = boss.modelId === 'final' ? Math.max(0,state.boss.seals||0) : 0;
      if(boss.modelId==='final')boss.shield.visible=boss.sealCount>0||boss.finaleOpen;
      boss.broken = !!state.boss.broken;
      boss.fog = state.boss.fog || 0;
      const target=this.actors.get(state.boss.intentTarget)||this.actors.get(this.activePartyIds[0]);
      if(target)boss.baseRotation=Math.atan2(target.basePosition.x-boss.basePosition.x,target.basePosition.z-boss.basePosition.z);
    }
    syncSceneEnemies(this,state.enemyTargets||[],id=>(ENEMY_FACTORIES[id]||ENEMY_FACTORIES.scout)());
    this.syncArtPreviewVisibility();
    if(this.bossPreviewFocus||this.artPreview){this.resize();this.resetCamera();}
  }

  applyFormation(bossId){
    const key=(`${bossId}:${this.activePartyIds.join(',')}`);
    if(this.formationKey===key)return;
    this.formationKey=key;
    this.enemyFormationKey='';
    const layout=formationFor(bossId,this.activePartyIds.length),boss=this.actors.get('boss');
    this.formationName=layout.name;
    boss.basePosition.set(...layout.boss);boss.root.position.copy(boss.basePosition);boss.markerRoot.position.copy(boss.basePosition);
    this.activePartyIds.forEach((id,i)=>{
      const actor=this.actors.get(id);actor.basePosition.set(...layout.party[i]);
      actor.root.position.copy(actor.basePosition);actor.markerRoot.position.copy(actor.basePosition);
      actor.baseRotation=Math.atan2(boss.basePosition.x-actor.basePosition.x,boss.basePosition.z-actor.basePosition.z);
      actor.root.rotation.y=actor.baseRotation;
    });
    // A common focus keeps a frontal line and a split flank equally visible.
    const focus=boss.basePosition.clone();for(const id of this.activePartyIds)focus.add(this.actors.get(id).basePosition);
    focus.divideScalar(this.activePartyIds.length+1);focus.y=3.5;
    const delta=focus.clone().sub(this.controls.target);this.camera.position.add(delta);this.controls.target.copy(focus);this.controls.update();
  }

  installScenePointers(){
    const canvas=this.renderer.domElement;
    this.onScenePointerDown=event=>{if(event.button===0)this.scenePointerStart={x:event.clientX,y:event.clientY,time:performance.now()};};
    this.onScenePointerUp=event=>{
      const start=this.scenePointerStart;this.scenePointerStart=null;
      if(!start||Math.hypot(event.clientX-start.x,event.clientY-start.y)>6||performance.now()-start.time>600)return;
      if(this.exploration&&!this.exploration.paused){
        const rect=canvas.getBoundingClientRect(),ray=new THREE.Raycaster();
        ray.setFromCamera(new THREE.Vector2((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1),this.camera);
        const roots=[...this.exploration.items.values()].map(item=>item.root);
        for(const hit of ray.intersectObjects(roots,true)){let node=hit.object;while(node&&!node.userData.interactionId)node=node.parent;if(node){this.moveToInteraction(node.userData.interactionId);return;}}
        this.moveToGroundFromPointer(event);
      }else if(this.state.mode==='playing'&&!this.modelReview){const id=pickedEnemy(this,event);if(id)this.onTargetSelect?.(id);}
    };
    canvas.addEventListener('pointerdown',this.onScenePointerDown);canvas.addEventListener('pointerup',this.onScenePointerUp);
  }

  enterExploration(config){
    if(this.disposed)return {status:'disposed'};
    if(this.modelReview)this.exitModelReview();
    if(this.exploration?.id===config.id){
      const heroId=config.heroId||this.activePartyIds[0]||'knibbs';
      if(this.exploration.hero.id===heroId){this.exploration.updateConfig(config);return {status:'ready',...this.exploration.snapshot()};}
      // GM/progression changes can remove the controlled character. Rebuild
      // their independent exploration model without losing walking position.
      config={...config,position:this.exploration.position};
    }
    this.exitExploration();this.clearCombatEffects();this.setArtPreview(false);
    this.exploration=new SceneExploration(this,config,person);this.resize();
    return {status:'ready',...this.exploration.snapshot()};
  }
  exitExploration(){
    if(!this.exploration)return false;
    const exploration=this.exploration;this.exploration=null;exploration.dispose();this.resize();this.formationKey='';return true;
  }
  setMoveInput(input){this.exploration?.setInput(input);}
  setExplorationPaused(paused){if(this.exploration){this.exploration.paused=!!paused;if(paused){this.exploration.setInput({x:0,z:0});this.exploration.path=[];}}}
  getExplorationState(){return this.exploration?.snapshot()||null;}
  moveToInteraction(id){return this.exploration?.moveToInteraction(id)||false;}
  moveToGroundFromPointer(event){
    if(!this.exploration||this.exploration.paused)return false;
    const rect=this.renderer.domElement.getBoundingClientRect(),ray=new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1),this.camera);
    const point=ray.ray.intersectPlane(new THREE.Plane(V(0,1,0),-.48),V());
    return !!point&&this.exploration.moveTo([point.x,point.z]);
  }

  positionOf(id, y = 1.2) {
    const actor = this.actors.get(id) || this.actors.get('boss');
    return actor.root.position.clone().add(V(0, y * (actor.visualScale?.y || 1), 0));
  }

  addEffect(object, duration, update, delay = 0) {
    if(this.effects.length>=180){const retired=this.effects.shift();this.removeEffect(retired.object);}
    this.effectRoot.add(object);
    object.visible = delay <= 0;
    this.effects.push({ object, duration, update, elapsed: -delay });
    return object;
  }

  burst(position, color = '#cea0ff', count = 22, power = 1, delay = 0, debris = false) {
    count=Math.min(this.reducedMotion?6:40,count);
    if(this.reducedMotion)power*=.3;
    const geometry = debris ? new THREE.IcosahedronGeometry(.065, 0) : new THREE.SphereGeometry(.034, 4, 3);
    const mat = debris ? material('#9c81af') : new THREE.MeshBasicMaterial({ color, transparent: true, blending: THREE.AdditiveBlending });
    const group = new THREE.Group();
    group.position.copy(position);
    const points = [];
    for (let i = 0; i < count; i++) {
      const m = mesh(group, geometry, mat);
      const direction = V((Math.random() - .5) * 2, Math.random() * 1.8 - .35, (Math.random() - .5) * 2).normalize();
      points.push({ mesh: m, velocity: direction.multiplyScalar((1.6 + Math.random() * 3) * power), spin: Math.random() * 7 });
    }
    this.addEffect(group, .63 + power * .13, (t, age) => {
      for (const p of points) {
        p.mesh.position.copy(p.velocity).multiplyScalar(age);
        p.mesh.position.y -= age * age * (debris ? 5 : 2.2);
        p.mesh.scale.setScalar(Math.max(.03, 1 - t));
        p.mesh.rotation.set(age * p.spin, age * p.spin * .7, 0);
      }
    }, delay);
  }

  flashAt(position, color, size = 2, delay = 0) {
    size=Math.min(size,this.reducedMotion?1.1:3.2);
    const glow = this.glow(color, size, 1);
    glow.position.copy(position);
    this.addEffect(glow, .33, t => {
      glow.scale.setScalar(size * (1 + t * .8));
      glow.material.opacity = (1 - t) ** 2;
    }, delay);
  }

  shockwave(position, color, size = 3, delay = 0, vertical = false) {
    const r = ring(this.effectRoot, 1, .025, color, 0, 1);
    r.position.copy(position);
    if (vertical) {
      r.rotation.set(0, 0, 0);
      r.quaternion.copy(this.camera.quaternion);
    } else r.position.y = Math.max(.51, position.y);
    this.addEffect(r, .65, t => {
      r.scale.setScalar(.05 + ease(t) * size);
      r.material.opacity = (1 - t) ** 1.5;
    }, delay);
  }

  floatingText(position, text, color = '#ffffff', delay = 0, small = false) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `800 ${small ? 38 : 58}px "Segoe UI", "Microsoft YaHei", sans-serif`;
    ctx.lineWidth = 9;
    ctx.strokeStyle = '#101621';
    ctx.shadowColor = color;
    ctx.shadowBlur = 18;
    ctx.strokeText(String(text), 256, 65);
    ctx.fillStyle = color;
    ctx.fillText(String(text), 256, 65);
    const texture = new THREE.CanvasTexture(canvas);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false, depthWrite: false }));
    sprite.position.copy(position);
    sprite.scale.set(small ? 3.2 : 3.9, small ? .8 : .975, 1);
    sprite.renderOrder = 100;
    this.addEffect(sprite, 1.07, t => {
      sprite.position.y = position.y + ease(t) * .82;
      sprite.material.opacity = t > .65 ? (1 - t) / .35 : 1;
      const pop = t < .16 ? .72 + Math.sin(t / .16 * Math.PI / 2) * .28 : 1;
      sprite.scale.set((small ? 3.2 : 3.9) * pop, (small ? .8 : .975) * pop, 1);
    }, delay);
  }

  bolt(from, to, color, delay = 0, width = .04, duration = .2) {
    const group = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, blending: THREE.AdditiveBlending });
    const beam = rod(group, mat, from, to, width);
    const light = this.glow(color, .9, .95);
    group.add(light);
    this.addEffect(group, duration, t => {
      const end = from.clone().lerp(to, ease(t));
      const start = from.clone().lerp(to, Math.max(0, ease(t) - .35));
      const delta = end.clone().sub(start);
      beam.position.copy(start).add(end).multiplyScalar(.5);
      beam.quaternion.setFromUnitVectors(V(0, 1, 0), delta.clone().normalize());
      const total = from.distanceTo(to);
      beam.scale.y = Math.max(.001, delta.length() / total);
      light.position.copy(end);
      mat.opacity = t > .8 ? (1 - t) * 5 : 1;
    }, delay);
  }

  slash(position, color = '#77fff0', delay = 0, scale = 1.5) {
    const group = new THREE.Group();
    group.position.copy(position);
    group.quaternion.copy(this.camera.quaternion);
    group.rotation.z += -.6;
    const startRotation=group.rotation.z;
    const mat = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, transparent: true, opacity: 1, depthWrite: false, blending: THREE.AdditiveBlending });
    const arc = mesh(group, new THREE.RingGeometry(.85, 1.01, 45, 1, -.35, Math.PI * 1.32), mat);
    arc.castShadow = false;
    const thin = mesh(group, new THREE.RingGeometry(1.04, 1.07, 45, 1, -.2, Math.PI * 1.1), mat);
    this.addEffect(group, .38, t => {
      group.scale.setScalar(scale * (.5 + t * .65));
      group.rotation.z=startRotation+t*.8;
      mat.opacity = (1 - t) ** .6;
    }, delay);
  }

  runeCircle(position, color, delay = 0, duration = .8, radius = 1.3) {
    const group = new THREE.Group();
    group.position.copy(position);
    group.position.y = .53;
    const r1 = ring(group, radius, .035, color, 0, 1);
    ring(group, radius * .79, .012, color, .01, .8);
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * TAU;
      const b = ((i + 2) % 6) / 6 * TAU;
      rod(group, r1.material, [Math.cos(a) * radius * .78, .02, Math.sin(a) * radius * .78], [Math.cos(b) * radius * .78, .02, Math.sin(b) * radius * .78], .014, .014, 4);
    }
    this.addEffect(group, duration, t => {
      group.rotation.y = t * .7;
      group.scale.setScalar(Math.min(1, t * 6) * (1 + t * .1));
      group.traverse(n => { if (n.material) n.material.opacity = t > .65 ? (1 - t) / .35 : .85; });
    }, delay);
  }

  play(event = {}, {onImpact} = {}) {
    if (this.disposed || this.modelReview) return Promise.resolve();
    const type = event.type || 'attack';
    if(type==='shield-expire'){
      onImpact?.(0);
      for(const id of event.targets||[])this.floatingText(this.positionOf(id,2.2),`护盾到期 −${event.amounts?.[id]||event.amount||0}`,'#9daab8',0,false);
      return Promise.resolve();
    }
    const partyLead = this.activePartyIds[0];
    const actor = this.actors.get(event.actor) || this.actors.get(type === 'boss' ? 'boss' : partyLead);
    const targets = (Array.isArray(event.targets) && event.targets.length ? event.targets : [actor.isEnemy ? partyLead : this.state?.selectedEnemyId||'boss']).map(id => typeof id === 'string' ? id : id.id).filter(id => this.actors.has(id));
    const primary = this.actors.get(targets[0]) || this.actors.get('boss');
    if(type==='enemy-defeat'){
      primary.defeated=true;primary.enemyNameplate&&(primary.enemyNameplate.visible=false);
      this.burst(this.positionOf(primary.id,primary.height*.5),primary.accent,25,.85,0,true);this.floatingText(this.positionOf(primary.id,primary.height),'击破','#e7c68f');
      onImpact?.(0);return Promise.resolve();
    }
    const style = event.style || (actor.id === 'knibbs' ? 'shot' : ['apeilia', 'qianxing'].includes(actor.id) ? 'slash' : actor.isEnemy ? 'quake' : 'rune');
    event={...event,type,style,actor:actor.id,targets,bossId:event.bossId||this.actors.get('boss')?.modelId};
    const timing=impactTiming(event),hitCount=timing.hits,interval=timing.interval;
    const isHealing = type === 'heal';
    const isShield = type === 'shield' || (style === 'guard' && type!=='buff' && !isHealing && !damagingEvent(event));
    const response = ['parry', 'evade', 'counter'].includes(style);
    const color = response ? style === 'counter' ? '#ffcc86' : style === 'parry' ? '#88fff1' : '#a8d7ff' : isHealing ? '#91ffc2' : isShield ? '#84e9ff' : IMPACT_COLORS[attackTheme(event)];
    let duration = timing.duration;
    const impactAt = timing.impactAt;
    actor.action = true;
    const origin = actor.root.position.clone();
    const targetPosition = this.positionOf(primary.id, primary.isEnemy ? primary.height*.55 : 1.3);
    const from = this.positionOf(actor.id, actor.isEnemy ? actor.height*.55 : 1.42);
    const direction = primary.root.position.clone().sub(origin).setY(0).normalize();
    if (direction.lengthSq() < .001) direction.copy(this.actors.get(actor.isEnemy ? partyLead : this.state?.selectedEnemyId||'boss').root.position).sub(origin).setY(0).normalize();
    if (direction.lengthSq() > .001) actor.root.rotation.y = Math.atan2(direction.x, direction.z);
    const dashDistance = Math.max(0, origin.distanceTo(primary.root.position) - (primary.id === 'boss' ? 1.95 : 1.1));
    let movement = 'cast';

    if (type === 'victory' || type === 'defeat') {
      duration = 1.1;
      if (type === 'victory') {
        const p = this.positionOf('boss', 2.8);
        const defeated = this.actors.get('boss');
        this.burst(p, defeated.accent, 65, 1.7, .12, defeated.modelId !== 'cantor');
        this.shockwave(V(p.x, .52, p.z), defeated.accent, 5.7, .12);
        this.flashAt(p, defeated.accent, 5.5, .12);
        this.shake = .12;
      } else {
        for (const id of targets) this.flashAt(this.positionOf(id, 1.1), '#d481a2', 1.8, .1);
      }
    } else if (type === 'core' || type === 'break' || type === 'phase') {
      const p = this.positionOf(primary.id,primary.height*.65);
      this.runeCircle(this.positionOf(primary.id, .05), type === 'break' ? '#ffe0a0' : color, 0, 1,primary.id==='boss'?2.1:.85);
      this.flashAt(p, type === 'break' ? '#fff0ba' : '#d191ff', 4.8, .18);
      this.burst(p, color, 45, 1.3, .20, true);
      this.shockwave(V(p.x, .54, p.z), color, 4.4, .22);
      this.floatingText(p.clone().add(V(0, .5, 0)), event.label || (type === 'break' ? '架势崩溃' : type === 'core' ? '核心显露' : '魔晶共鸣'), type === 'break' ? '#ffe3a4' : '#ddbbff', .24, true);
      this.shake = .09;
      duration = 1.0;
    } else if (response) {
      if (style === 'parry') {
        movement = 'parry';
        const intercept = from.clone().addScaledVector(direction, .40);
        const shield = new THREE.Group();
        shield.position.copy(intercept); shield.quaternion.copy(this.camera.quaternion);
        const guardMat = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, transparent: true, opacity: .38, blending: THREE.AdditiveBlending, depthWrite: false });
        const disc = mesh(shield, new THREE.CircleGeometry(.77, 6), guardMat);
        const rimMat = guardMat.clone(); rimMat.opacity = .9;
        mesh(shield, new THREE.RingGeometry(.70, .77, 6), rimMat);
        disc.castShadow = false;
        this.addEffect(shield, .53, t => {
          shield.scale.setScalar(.60 + Math.sin(t * Math.PI) * .45);
          guardMat.opacity = Math.sin(t * Math.PI) * .34;
          rimMat.opacity = Math.sin(t * Math.PI) * .92;
        }, .08);
        this.flashAt(intercept, '#ddfff8', 2.3, .22);
        this.slash(intercept, color, .20, .94);
        this.burst(intercept, color, 20, .62, .23);
        if (targets.includes('boss')) this.slash(targetPosition, color, .34, 1.3);
      } else if (style === 'evade') {
        movement = 'evade';
        const side = V(direction.z, 0, -direction.x);
        // Two translucent silhouettes mark the short sidestep without copying
        // live model geometries or sharing disposable effect materials.
        for (let i = 0; i < 2; i++) {
          const ghost = new THREE.Group();
          ghost.position.copy(origin).addScaledVector(side, i * .42);
          ghost.rotation.copy(actor.root.rotation);
          const ghostMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .24, blending: THREE.AdditiveBlending, depthWrite: false });
          orb(ghost, ghostMat, [.23, .30, .22], [0, 2.02, 0], 1);
          mesh(ghost, new THREE.CylinderGeometry(.32, .26, .70, 7), ghostMat, 0, 1.36, 0);
          for (const sign of [-1, 1]) {
            rod(ghost, ghostMat, [sign * .14, 1.05, 0], [sign * .19, .12, .09], .10, .14, 5);
            rod(ghost, ghostMat, [sign * .36, 1.58, 0], [sign * .45, .91, .16], .08, .13, 5);
          }
          this.addEffect(ghost, .52, t => { ghostMat.opacity = (1 - t) * .22; ghost.position.addScaledVector(side, .007); }, .10 + i * .08);
        }
        this.slash(from.clone().addScaledVector(side, .4), color, .19, .75);
        this.burst(from.clone().addScaledVector(side, .75), color, 12, .4, .24);
      } else {
        movement = 'dash';
        this.runeCircle(origin, '#ffd393', .02, .5, .70);
        this.bolt(from, targetPosition, '#fff0be', .17, .04, .19);
        this.slash(targetPosition, color, .28, 1.85);
        this.slash(targetPosition.clone().add(V(.08, .14, .02)), '#fff4d6', .36, 1.3);
      }
      if (event.label) this.floatingText(this.positionOf(actor.id, actor.height + .15), event.label, color, .14, true);
    } else if(type==='buff'){
      for(const id of targets){this.runeCircle(this.positionOf(id,.15),color,.08,.8,id==='boss'?1.7:.85);this.floatingText(this.positionOf(id,id==='boss'?3.6:2.2),event.label||'状态改变',color,.2,true);}
    } else if (isHealing || isShield) {
      this.runeCircle(origin, color, 0, .83, .93);
      for (const [i, id] of targets.entries()) {
        const p = this.positionOf(id, .2);
        this.runeCircle(p, color, .12 + i * .035, .78, .9);
        this.shockwave(p.clone().add(V(0, .12, 0)), color, 1.1, .17 + i * .035);
        for (let j = 0; j < 12; j++) {
          const a = j / 12 * TAU;
          const sprite = this.glow(color, .22, .85);
          const base = p.clone().add(V(Math.cos(a) * .6, 0, Math.sin(a) * .6));
          sprite.position.copy(base);
          this.addEffect(sprite, .8, t => {
            sprite.position.y = base.y + t * 2.4;
            sprite.material.opacity = Math.sin(t * Math.PI);
          }, .10 + j * .024);
        }
        const actualAmount = event.amounts?.[id] ?? event.amount;
        const text = actualAmount ? `+${Math.round(actualAmount)}${isShield ? '  盾' : ''}` : isShield ? '护盾' : '恢复';
        this.floatingText(this.positionOf(id, 2.25), text, color, impactAt, isShield);
      }
    } else if (style === 'shot') {
      movement = 'shot';
      for (let h = 0; h < hitCount; h++) {
        const delay = impactAt-.16+h*interval;
        const muzzle = from.clone().add(direction.clone().multiplyScalar(.75));
        this.flashAt(muzzle, color, 1.3, delay);
        for(const id of targets){
          const recipient=this.actors.get(id),impact=this.positionOf(id,recipient.isEnemy?recipient.height*.55:1.3).add(V((Math.random()-.5)*.3,(Math.random()-.5)*.35,0));
          this.bolt(muzzle,impact,color,delay,.035,.16);
        }
      }
    } else if (style === 'slash') {
      movement = 'dash';
      for (let h = 0; h < hitCount; h++) {
        for(const id of targets){
          const recipient=this.actors.get(id),p=this.positionOf(id,recipient.isEnemy?recipient.height*.55:1.3).add(V(0,(h%2)*.32-.1,0));
          this.slash(p,color,impactAt-.05+h*interval,1.25+(h%2)*.2);
        }
      }
    } else if (style === 'quake') {
      movement = 'slam';
      const groundPosition = origin.clone();
      groundPosition.y = .54;
      this.shockwave(groundPosition, color, 6.9, .39);
      this.shockwave(groundPosition, '#e4cdfb', 4.9, .46);
      this.burst(origin.clone().add(V(0, .2, 0)), color, 30, 1.55, .4, true);
      for (const id of targets) {
        const p = this.positionOf(id, .13);
        this.runeCircle(p, color, .05, .5, .75);
      }
    } else if (style === 'mist') {
      this.runeCircle(origin, color, 0, .9, 2.15);
      for (const id of targets) {
        const p = this.positionOf(id, 1.0);
        for (let j = 0; j < 5; j++) {
          const sprite = this.glow(color, 3, .35);
          const a = j / 5 * TAU;
          sprite.position.copy(p).add(V(Math.cos(a) * .7, j * .2, Math.sin(a) * .7));
          this.addEffect(sprite, .85, t => {
            sprite.material.opacity = Math.sin(t * Math.PI) * .32;
            sprite.scale.setScalar(2.0 + t * 2);
            sprite.position.y += .004;
          }, j * .045);
        }
      }
    } else {
      this.runeCircle(origin, color, 0, .8, actor.id === 'boss' ? 1.75 : .85);
      for (let h = 0; h < hitCount; h++) {
        const travel=style==='burst'&&actor.id==='boss'?.25:.22;
        const delay=impactAt-travel+h*interval;
        for (const id of targets) {
          const p = this.positionOf(id, id === 'boss' ? 2.9 : 1.35);
          if (style === 'burst' && actor.id === 'boss') {
            const above = p.clone().add(V(.8, 5, -.5));
            this.bolt(above, p, color, delay, .17, .25);
          } else {
            this.bolt(from.clone().add(V(0, .23, 0)), p, color, delay, style === 'burst' ? .11 : .075, .22);
          }
        }
      }
    }

    const beats=impactSchedule(event);
    duration=Math.max(duration,timing.duration);
    if(actor.id==='boss'&&damagingEvent(event))playBossAnimation(actor,'attack',{duration});
    return new Promise(resolve => {
      this.actions.push({
        actor, elapsed: 0, duration, impactAt, interval, hitCount, nextHit:0,
        update: (t, age) => {
          const attackPulse = Math.sin(Math.min(1, t * 1.5) * Math.PI);
          if(actor.bossAnimation){
            if(movement==='dash'){
              const travel=t<.27?ease(t/.27):t>.66?1-ease((t-.66)/.34):1;
              actor.root.position.copy(origin).addScaledVector(direction,dashDistance*travel*(this.reducedMotion?.15:1));
            }
            return;
          }
          if (movement === 'evade') {
            const travel = t < .30 ? ease(t / .30) : t > .58 ? 1 - ease((t - .58) / .42) : 1;
            actor.root.position.copy(origin).addScaledVector(V(direction.z, 0, -direction.x), travel * (this.reducedMotion?.25:1));
            actor.body.rotation.z = -.17 * attackPulse;
          } else if (movement === 'parry') {
            actor.body.position.z = -.12 * attackPulse;
            if (actor.bones) {
              actor.bones.leftArm.rotation.x = -1.2 * attackPulse;
              actor.bones.rightArm.rotation.x = -.75 * attackPulse;
            }
          } else if (movement === 'dash') {
            const travel = t < .27 ? ease(t / .27) : t > .66 ? 1 - ease((t - .66) / .34) : 1;
            actor.root.position.copy(origin).addScaledVector(direction, dashDistance * travel * (this.reducedMotion?.15:1));
            actor.body.rotation.z = -.10 * attackPulse;
            if (actor.bones) {
              const swing=age<impactAt?Math.min(1,age/impactAt):age<impactAt+(hitCount-1)*interval+.12?.68+.32*Math.cos((age-impactAt)/interval*TAU):Math.max(0,(duration-age)/.38);
              actor.bones.rightArm.rotation.x=-1.8*swing;
            }
          } else if (movement === 'shot') {
            actor.body.position.z = -.11 * Math.max(0, Math.sin(age * 36)) * attackPulse;
            if (actor.bones) actor.bones.rightArm.rotation.x = -1.25 * Math.min(1, t * 7) * Math.min(1, (1 - t) * 5);
          } else if (movement === 'slam') {
            actor.body.position.y = t < .4 ? Math.sin(t / .4 * Math.PI / 2) * .5 : Math.max(0, (1 - (t - .4) * 7)) * .5;
            actor.body.rotation.x = -.12 * Math.sin(t * Math.PI * 2);
          } else if (actor.bones) {
            actor.bones.leftArm.rotation.x = -.8 * attackPulse;
            actor.bones.rightArm.rotation.x = -.55 * attackPulse;
          }
        },
        impact: index => {
          onImpact?.(index);
          for(const beat of beats.filter(beat=>beat.index===index)){
            const target=this.actors.get(beat.id);if(!target)continue;
            const point=this.positionOf(beat.id,target.isEnemy?target.height*.55:1.38).add(V((index%2?.08:-.08),index%2*.12,0));
            const away=target.basePosition.clone().sub(origin).setY(0).normalize();
            if(away.lengthSq()<.001)away.copy(direction);
            contactEffect(this,beat,point,away);
            if(beat.reaction){
              reactBossToImpact(target,beat);
              const local=away.clone().applyAxisAngle(V(0,1,0),-target.root.rotation.y);
              target.reaction={age:0,strength:beat.strength,index,worldDirection:away,direction:[local.x,local.z]};
              target.flash=this.reducedMotion?.055:.14;target.flashColor=color;
              if(!this.reducedMotion)this.shake=Math.max(this.shake,Math.min(.065,.020+beat.strength*.020));
              this.floatingText(this.positionOf(beat.id,beat.id==='boss'?3.9:2.1).add(V(index%2?.18:-.18,0,0)),String(beat.hpLoss),color);
            }else if(beat.absorbed>0){
              this.floatingText(this.positionOf(beat.id,beat.id==='boss'?3.9:2.1),`吸收 ${beat.absorbed}`,'#a4e7ff',0,true);
            }else if(target.coreOpen){
              this.floatingText(this.positionOf(beat.id,3.9),event.kind==='magic'?'魔法命中':'物理命中',color,0,true);
            }
          }
        },
        finish: () => {
          actor.action = false;
          actor.root.position.copy(actor.basePosition);
          actor.root.rotation.y = actor.baseRotation;
          if(actor.bossAnimation?.current==='attack')resetBossAnimation(actor);
          actor.body.position.set(0, 0, 0);
          actor.body.rotation.set(0, 0, 0);
          if (actor.bones) {
            actor.bones.rightArm.rotation.x = 0;
            actor.bones.leftArm.rotation.x = 0;
          }
          resolve();
        },
      });
    });
  }

  frame(now) {
    if (this.disposed) return;
    const rawDt = Math.min(.05, (now - this.lastTime) / 1000);
    this.lastTime = now;
    const dt = this.paused ? 0 : rawDt * this.speed;
    this.time += dt;
    const t = this.time;
    this.controls.update();
    syncEnemyVisibility(this);
    for (const actor of this.actors.values()) {
      this.clearReactionOverlay(actor);
      const alive = actorStanding(actor,this.state.mode);
      const fallen = actor.isEnemy ? .25 : 1;
      const visualScale = actor.visualScale || V(1, 1, 1);
      actor.root.scale.lerp(V(visualScale.x, visualScale.y * (alive ? 1 : fallen), visualScale.z), Math.min(1, dt * 4));
      actor.marker.material.opacity = alive ? actor.id === 'boss' ? .35 : .28 : .07;
      const selected = this.state.mode === 'playing' && (actor.isEnemy?actor.enemySelected||this.state.selectedEnemyId===actor.id:this.state.selected===actor.id) && alive;
      actor.selection.material.opacity = selected ? .7 + Math.sin(t * 3) * .18 : 0;
      actor.selection.rotation.z = t * .35;
      if (actor.arrow) {
        actor.arrow.visible = selected;
        actor.arrow.position.y = actor.height + .3 + Math.sin(t * 3) * .06;
      }
      actor.shield.material.opacity = .065 + Math.sin(t * 2) * .025;
      if(actor.modelId==='final'){
        actor.shield.material.color.set(actor.finaleOpen?'#ffcfdf':'#b4b1ed');
        actor.shield.material.opacity=actor.finaleOpen?.14+Math.sin(t*5)*.045:.045+Math.min(4,actor.sealCount||0)*.028;
      }
      actor.shield.rotation.y = t * .13;
      if (!actor.action) {
        const turn = Math.atan2(Math.sin(actor.baseRotation - actor.root.rotation.y), Math.cos(actor.baseRotation - actor.root.rotation.y));
        actor.root.rotation.y += turn * Math.min(1, dt * 7);
        if(!actor.bossAnimation){
        actor.body.position.y = alive ? Math.sin(t * 1.65 + actor.seed) * (actor.modelId === 'cantor' ? .12 : actor.id === 'boss' ? .055 : .023) : 0;
        actor.body.rotation.x = alive ? Math.sin(t * .9 + actor.seed) * .008 : actor.id === 'boss' ? .06 : -.12;
        if (actor.id !== 'boss') actor.body.rotation.z = lerp(actor.body.rotation.z, alive ? 0 : actor.isEnemy?-.3:-1.38, Math.min(1, dt * 5));
        if (actor.bones) {
          actor.bones.rightArm.rotation.x = Math.sin(t * 1.35 + actor.seed) * .035;
          actor.bones.leftArm.rotation.x = Math.sin(t * 1.1 + actor.seed + 1) * .035;
          actor.bones.head.rotation.y = Math.sin(t * .7 + actor.seed) * .035;
        }
        }
      }
      updateBossAnimation(actor,dt,{alive});
      for (const entry of actor.bossAnimation?[]:actor.animated) {
        if (entry.type === 'clockHand') entry.object.rotation.z = -t * entry.speed;
        if (entry.type === 'hair') entry.object.rotation.z = Math.sin(t * 1.6 + entry.side) * .055;
        if (entry.type === 'drone') {
          entry.object.position.y = entry.y + Math.sin(t * 2.1 + entry.side) * .09;
          entry.object.rotation.z = Math.sin(t * 1.8 + entry.side) * .05;
        }
        if (entry.type === 'rune') {
          const a = entry.angle + t * .3;
          entry.object.position.set(Math.cos(a) * .73, 1.65 + Math.sin(t * 1.4 + entry.angle) * .24, Math.sin(a) * .61);
          entry.object.rotation.y = -a;
          entry.object.rotation.z = Math.sin(t + entry.angle) * .18;
        }
        if (entry.type === 'mirror') {
          const a = entry.angle + t * .20;
          entry.object.position.set(Math.cos(a) * 1.45, entry.y + Math.sin(a) * .30, -.80 + Math.sin(a) * .46);
          entry.object.rotation.set(0, -.25 + Math.sin(a) * .4, Math.sin(a + .5) * .18);
        }
        if (entry.type === 'spore') {
          const a = entry.angle + t * .32;
          entry.object.position.set(Math.cos(a) * 1.42, entry.y + Math.sin(t * .9 + entry.angle) * .27, Math.sin(a) * .85);
          entry.object.rotation.y = a;
        }
        if (entry.type === 'tendril') {
          entry.object.rotation.y = (entry.gentle ? 0 : entry.angle) + Math.sin(t * 1.15 + entry.angle) * .045;
          entry.object.rotation.z = Math.sin(t * .9 + entry.angle) * .045;
        }
        if (entry.type === 'heart') entry.object.position.y = entry.y + Math.sin(t * 2.2) * .015;
        if (entry.type === 'halo') entry.object.rotation.z = -.16 + Math.sin(t * .35) * .08;
        if (entry.type === 'prism') {
          const a = entry.angle + t * .4;
          entry.object.position.set(Math.cos(a) * entry.radius, entry.y + Math.sin(t * 1.6 + entry.angle) * .13, Math.sin(a) * entry.radius * .68);
          entry.object.rotation.y = -a;
        }
        if (entry.type === 'coil') entry.object.scale.setScalar(1 + Math.sin(t * 2.4 + entry.phase) * .05);
        if (entry.type === 'electric') entry.object.visible = Math.sin(t * 2.2 + entry.phase) > -.2;
        if (entry.type === 'pageFold') {
          entry.object.rotation.y = entry.angle + Math.sin(t * .85 + entry.phase) * .028;
          entry.object.rotation.x = Math.sin(t * 1.1 + entry.phase) * .025;
        }
        if (entry.type === 'leaf') {
          const a = entry.angle + t * .21;
          entry.object.position.set(Math.cos(a) * 1.49, entry.y + Math.sin(t * .9 + entry.angle) * .16, Math.sin(a) * .76);
          entry.object.rotation.set(Math.sin(a) * .15, -.4 + Math.sin(a) * .45, Math.sin(t + a) * .12);
        }
        if (entry.type === 'nucleus') {
          entry.object.rotation.y = t * .23;
          entry.object.rotation.z = Math.sin(t * .55) * .10;
        }
        if (entry.type === 'orbitRing') entry.object.rotation[entry.axis] += dt * entry.speed * (actor.finaleOpen ? 2 : 1);
        if (entry.type === 'shadowArm') entry.object.rotation.z = Math.sin(t * .65 + entry.phase) * .055;
        if (entry.type === 'debrisOrbit') {
          const a = entry.angle + t * .13;
          entry.object.position.set(Math.cos(a) * 1.1, entry.y + Math.sin(t + entry.angle) * .12, Math.sin(a) * .65);
          entry.object.rotation.y = a;
        }
      }
      actor.flash = Math.max(0, actor.flash - dt);
      for (const mat of actor.mats) {
        const intensity=mat.userData.originalIntensity+(mat.userData.mechanismIntensity||0);
        if (actor.flash > 0) {
          mat.emissive.set(actor.flashColor||'#f6dbb5');
          mat.emissiveIntensity = Math.max(intensity,Math.min(2.5,intensity+actor.flash*5));
        } else {
          mat.emissive.copy(mat.userData.originalEmissive);
          mat.emissiveIntensity = intensity;
        }
      }
    }
    const boss = this.actors.get('boss');
    if (boss.modelId === 'golem'&&!boss.bossAnimation) {
    boss.coreProgress = lerp(boss.coreProgress, boss.coreOpen ? 1 : 0, Math.min(1, dt * 3.7));
    const cp = boss.coreProgress;
    boss.core.position.y = 3.04 + cp * .12 + Math.sin(t * 2) * .04;
    boss.core.scale.setScalar(1 + cp * .72 + Math.sin(t * 3) * .025);
    boss.coreGem.rotation.y = t * (.25 + cp * .65);
    boss.coreGem.rotation.z = Math.sin(t * .6) * .1;
    boss.coreOrbit.rotation.z = t * .48;
    boss.coreOrbit.material.opacity = .28 + cp * .64;
    boss.coreLight.intensity = (4 + cp * 6 + Math.sin(t * 3)) * (actorStanding(boss,this.state.mode) ? 1 : .18);
    for (const part of boss.armor) {
      const base = part.userData.basePosition;
      const seed = part.userData.seed;
      const outward = V(base.x, (base.y - 2.5) * .32, base.z).normalize();
      part.position.copy(base).addScaledVector(outward, cp * (1.0 + Math.sin(seed) * .3));
      part.position.y += cp * Math.sin(t * .9 + seed) * .17;
      part.scale.copy(part.userData.baseScale).multiplyScalar(1 - cp * .29);
      if (cp > .01) part.rotation.y += dt * cp * .1 * Math.sin(seed);
    }
    }
    if (boss.broken && boss.hp > 0&&!boss.bossAnimation) boss.body.rotation.z = Math.sin(t * 14) * .012;
    this.arenaPulse.material.opacity = .12 + boss.stage * .065 + Math.sin(t) * .045;
    for (const entry of this.flames) {
      entry.flame.scale.y = .32 + Math.sin(t * 8 + entry.flame.position.x) * .055;
      entry.glow.material.opacity = .40 + Math.sin(t * 7 + entry.flame.position.x) * .06;
    }
    this.dust.rotation.y = t * .012;
    this.dust.position.y = Math.sin(t * .25) * .2;
    this.atmosphere.root.visible=!this.modelReview;
    this.atmosphere.update(this.modelReview?0:dt);
    this.exploration?.update(this.paused?0:rawDt);
    this.backdrop?.sync();
    for (const fog of this.fogSprites) {
      fog.object.position.x = fog.x + Math.sin(t * .14 + fog.phase) * 1.7;
      fog.object.material.opacity = (fog.opacity || .027) + Math.sin(t * .3 + fog.phase) * .01 + (boss.fog ? .018 : 0);
    }
    for (const entry of this.environmentAnimated || []) {
      if (entry.type === 'stormArc') entry.object.material.opacity = .19 + (Math.sin(t * 1.3 + entry.phase) + 1) * .20;
      if (entry.type === 'floatingStone') {
        entry.object.position.y = entry.y + Math.sin(t * .55 + entry.phase) * .13;
        entry.object.rotation.y += dt * .022;
      }
      if (entry.type === 'starRing') entry.object.rotation.z += dt * .019 * (entry.phase ? -1 : 1);
    }
    for (let i = this.actions.length - 1; i >= 0; i--) {
      const action = this.actions[i];
      action.elapsed += dt;
      const progress = Math.min(1, action.elapsed / action.duration);
      action.update(progress, action.elapsed);
      dispatchImpacts(action,action.elapsed);
      if (progress >= 1) {
        this.actions.splice(i, 1);
        action.finish();
      }
    }
    for(const actor of this.actors.values())this.applyReaction(actor,dt);
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const effect = this.effects[i];
      effect.elapsed += dt;
      if (effect.elapsed < 0) continue;
      effect.object.visible = true;
      const progress = Math.min(1, effect.elapsed / effect.duration);
      effect.update(progress, effect.elapsed);
      if (progress >= 1) {
        this.effects.splice(i, 1);
        this.removeEffect(effect.object);
      }
    }
    // Shake only the rendered view: OrbitControls never inherits drift.
    const originalPosition = this.camera.position.clone();
    if (this.shake > .001 && !this.paused && !this.reducedMotion) {
      const pulse=Math.min(.065,this.shake);
      this.camera.position.x += Math.sin(this.time*48)*pulse;
      this.camera.position.y += Math.cos(this.time*48)*pulse*.45;
      this.shake *= Math.exp(-dt*19);
    }
    this.renderer.render(this.scene, this.camera);
    this.onHudFrame?.();
    this.camera.position.copy(originalPosition);
    this.raf = requestAnimationFrame(this.frame);
  }

  removeEffect(object) {
    object.removeFromParent();
    const geometries = new Set(), materials = new Set(), textures = new Set();
    object.traverse(node => {
      if (node.isLight && node.shadow) node.shadow.dispose();
      if (node.geometry) geometries.add(node.geometry);
      if (node.material) for (const mat of Array.isArray(node.material) ? node.material : [node.material]) {
        materials.add(mat);
        if (mat.map && mat.map !== this.glowTexture) textures.add(mat.map);
      }
    });
    for (const g of geometries) g.dispose();
    for (const m of materials) m.dispose();
    for (const t of textures) t.dispose();
  }

  dispose() {
    if (this.disposed) return;
    this.exitExploration();
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.resizeObserver.disconnect();
    window.removeEventListener('resize', this.resize);
    this.motionPreference?.removeEventListener?.('change',this.onMotionPreference);
    this.controls.dispose();
    this.renderer.domElement.removeEventListener('pointerdown',this.onScenePointerDown);this.renderer.domElement.removeEventListener('pointerup',this.onScenePointerUp);
    for (const action of this.actions) action.finish();
    this.actions.length = 0;
    this.atmosphere.dispose();
    this.backdrop?.dispose();
    disposeBossModels(this);
    this.removeEffect(this.scene);
    this.scene.clear();
    this.actors.clear();
    this.heroCache.clear();
    this.bossCache.clear();
    this.minionCache?.clear();
    this.environmentCache.clear();
    this.worldLibrary?.clear();this.worldPrototypeRoot=null;this.worldStatus='disposed';
    this.detailLibrary?.clear();
    this.glowTexture.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
