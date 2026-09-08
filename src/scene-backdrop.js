import * as THREE from 'three';

export const BACKDROP_URLS={
  ruins:'/backdrops/ruins.png',storm:'/backdrops/storm.png',sanctum:'/backdrops/sanctum.png',
  floodworks:'/backdrops/floodworks.png',observatory:'/backdrops/observatory.png',
};
const GROUND={ruins:['#27362f','#3b5048'],storm:['#263b45','#405560'],sanctum:['#322d38','#514652'],floodworks:['#1a434b','#3d656c'],observatory:['#242e40','#405169']};

export function panoramaView(camera){
  const forward=camera.getWorldDirection(new THREE.Vector3());
  return {yaw:Math.atan2(forward.z,forward.x)+.20,pitch:THREE.MathUtils.clamp(Math.asin(forward.y)*.32,-.28,.28),
    aspect:camera.isOrthographicCamera?(camera.right-camera.left)/(camera.top-camera.bottom):camera.aspect||1};
}

function panoramicScreen(){
  // Three's unit skybox assumes perspective projection. A clip-space quad
  // explicitly covers an orthographic viewport, while camera azimuth still
  // controls a real wrapped panorama rather than stretching one static image.
  const material=new THREE.ShaderMaterial({
    name:'Orthographic panoramic landscape',depthTest:false,depthWrite:false,fog:false,toneMapped:false,
    uniforms:{panorama:{value:null},yaw:{value:0},pitch:{value:0},aspect:{value:1},brightness:{value:.58}},
    vertexShader:'varying vec2 screenPoint; void main(){screenPoint=position.xy; gl_Position=vec4(position.xy,1.0,1.0);}',
    fragmentShader:`
      uniform sampler2D panorama;
      uniform float yaw,pitch,aspect,brightness;
      varying vec2 screenPoint;
      void main(){
        vec3 forward=vec3(cos(yaw)*cos(pitch),sin(pitch),sin(yaw)*cos(pitch));
        vec3 right=normalize(cross(forward,vec3(0.0,1.0,0.0)));
        vec3 up=cross(right,forward);
        vec3 direction=normalize(forward+right*screenPoint.x*aspect*.46+up*screenPoint.y*.46);
        vec2 uv=vec2(atan(direction.z,direction.x)*.159154943+.5,asin(clamp(direction.y,-1.0,1.0))*.318309886+.5);
        vec3 color=texture2D(panorama,uv).rgb;
        // The source is already painted and exposed. Keep it independent of
        // combat lights; the dark tint preserves foreground silhouette contrast.
        color*=brightness*vec3(.89,.94,1.0);
        gl_FragColor=vec4(color,1.0);
        #include <colorspace_fragment>
      }`,
  });
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(2,2),material);
  mesh.name='360 panorama / full viewport';mesh.frustumCulled=false;mesh.renderOrder=-10000;mesh.visible=false;
  return mesh;
}

export class SceneBackdrop{
  constructor(stage){
    this.stage=stage;this.entries=new Map();this.disposed=false;this.active=null;
    this.root=new THREE.Group();this.root.name='Continuous landscape below battle architecture';stage.scene.add(this.root);
    this.sky=panoramicScreen();this.root.add(this.sky);
    for(const [id,colors] of Object.entries(GROUND)){
      const root=new THREE.Group();root.visible=false;this.root.add(root);
      const water=id==='floodworks',material=new THREE.MeshStandardMaterial({color:colors[0],roughness:water?.34:.92,metalness:water?.25:0,transparent:true,depthWrite:false});
      // A finite, fading apron leaves the panorama visible even with our
      // downward-looking orthographic camera. An infinite plane would hide it.
      material.onBeforeCompile=shader=>{
        shader.vertexShader='varying vec3 vLandscapePosition;\n'+shader.vertexShader;
        shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>','#include <project_vertex>\nvLandscapePosition=(modelMatrix*vec4(transformed,1.0)).xyz;');
        shader.fragmentShader='varying vec3 vLandscapePosition;\n'+shader.fragmentShader;
        shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.a*=1.0-smoothstep(9.0,23.0,length(vLandscapePosition.xz));');
      };
      const floor=new THREE.Mesh(new THREE.CircleGeometry(36,80),material);floor.rotation.x=-Math.PI/2;floor.position.y=water?-.91:-7.5;floor.receiveShadow=true;root.add(floor);
      const supportMaterial=new THREE.MeshStandardMaterial({color:water?'#52655f':colors[0],roughness:.96});
      const support=(geometry,position)=>{const mesh=new THREE.Mesh(geometry,supportMaterial);mesh.position.set(...position);mesh.receiveShadow=true;mesh.castShadow=true;root.add(mesh);};
      if(id==='storm'){
        for(const x of [-6.5,6.5])for(const z of [-8.4,7.6])support(new THREE.CylinderGeometry(.75,2.2,4.2,7),[x,-5.4,z]);
      }else if(water)support(new THREE.BoxGeometry(13.8,.65,12.8),[0,-.71,0]);
      else if(id==='sanctum')support(new THREE.BoxGeometry(17.45,7.0,16.1),[0,-4.0,-.15]);
      else support(new THREE.CylinderGeometry(8.25,13.5,7.0,8),[0,-4.0,0]);
      if(water){
        for(let i=0;i<3;i++){
          const line=new THREE.Mesh(new THREE.RingGeometry(17+i*8,17.03+i*8,80),new THREE.MeshBasicMaterial({color:colors[1],transparent:true,opacity:.12*(1-i/3),side:THREE.DoubleSide}));
          line.rotation.x=-Math.PI/2;line.position.y=-.895;root.add(line);
        }
      }
      this.entries.set(id,{root,texture:null,promise:null,status:'idle'});
    }
  }
  setWorld(id){
    const entry=this.entries.get(id);if(!entry||this.disposed)return Promise.resolve({status:'fallback'});
    this.active=id;
    for(const [key,e] of this.entries)e.root.visible=key===id;
    if(!entry.promise){
      entry.status='loading';entry.promise=new Promise(resolve=>{
        new THREE.TextureLoader().load(BACKDROP_URLS[id],texture=>{
          if(this.disposed||this.stage.disposed){texture.dispose();resolve({status:'disposed'});return;}
          texture.colorSpace=THREE.SRGBColorSpace;
          texture.wrapS=THREE.RepeatWrapping;texture.wrapT=THREE.ClampToEdgeWrapping;
          texture.generateMipmaps=true;texture.minFilter=THREE.LinearMipmapLinearFilter;
          entry.texture=texture;entry.status='ready';this.sync();resolve({status:'ready',world:id});
        },undefined,()=>{entry.status='fallback';resolve({status:'fallback',world:id});});
      });
    }
    this.sync();return entry.promise;
  }
  sync(){
    if(this.disposed)return;
    this.root.visible=!this.stage.modelReview;
    if(this.stage.modelReview)return;
    const entry=this.entries.get(this.active);this.sky.visible=!!entry?.texture;if(!entry?.texture)return;
    const world=this.stage.environmentCache?.get(this.active)?.worldGroup;
    if(world&&this.processedWorld!==world){
      world.traverse(node=>{
        if(!node.isMesh)return;
        const materials=Array.isArray(node.material)?node.material:[node.material];
        if(materials.some(material=>material?.name==='Quiet distant mountain stone'))node.visible=false;
      });
      this.processedWorld=world;
    }
    const uniforms=this.sky.material.uniforms,view=panoramaView(this.stage.camera);
    uniforms.panorama.value=entry.texture;uniforms.yaw.value=view.yaw;uniforms.pitch.value=view.pitch;uniforms.aspect.value=view.aspect;
  }
  dispose(){
    if(this.disposed)return;this.disposed=true;
    for(const entry of this.entries.values())entry.texture?.dispose();
    this.stage.removeEffect(this.root);this.entries.clear();
  }
}
