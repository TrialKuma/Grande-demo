"""Five complete, concept-guided combat environments authored in Blender.

Geometry is created only after inspecting the scene concept references. The
combat surface stays at game Y=.48. GLB roots are marked with grande_world and
world_id extras, and geometry is batched per world/material for the runtime.
"""
import argparse
import bpy
import bmesh
import json
import math
import random
import sys
from pathlib import Path
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'assets_3d'/'worlds'
GLB=ROOT/'public'/'models'/'grande-worlds.glb'
TAU=math.tau
WORLD_IDS=['ruins','storm','sanctum','floodworks','observatory']
M={};WORLDS={};OBJECTS=[];CURRENT=None

def xyz(p):return Vector((p[0],-p[2],p[1]))

def material(name,color,metal=0,rough=.7,emission=0):
    mat=bpy.data.materials.new(name);mat.diffuse_color=(*color,1);mat.use_nodes=True
    bs=mat.node_tree.nodes.get('Principled BSDF')
    bs.inputs['Base Color'].default_value=(*color,1)
    bs.inputs['Metallic'].default_value=metal;bs.inputs['Roughness'].default_value=rough
    if emission:
        bs.inputs['Emission Color'].default_value=(*color,1)
        bs.inputs['Emission Strength'].default_value=emission
    return mat

def world(name):
    global CURRENT
    obj=bpy.data.objects.new('WORLD_'+name,None);bpy.context.collection.objects.link(obj)
    obj['grande_world']=True;obj['world_id']=name
    obj['combat_surface_y']=.48;obj['authoring']='Blender / generated concept reference guided'
    WORLDS[name]=obj;CURRENT=obj;return obj

def register(obj,mat,smooth=True):
    obj.parent=CURRENT;obj.data.materials.append(M[mat] if isinstance(mat,str) else mat)
    if obj.type=='MESH':
        for face in obj.data.polygons:face.use_smooth=smooth
    OBJECTS.append(obj);return obj

def mesh(name,vertices,faces,mat,bevel=0,smooth=False):
    data=bpy.data.meshes.new(name+' topology')
    data.from_pydata([xyz(v) for v in vertices],[],faces);data.update()
    obj=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(obj);register(obj,mat,smooth)
    if bevel:
        edge=obj.modifiers.new('Worn physical edge','BEVEL');edge.width=bevel;edge.segments=2
        normal=obj.modifiers.new('Weighted normals','WEIGHTED_NORMAL');normal.keep_sharp=True
    return obj

def box(name,position,size,mat,bevel=.035):
    x,y,z=position;rx,ry,rz=[v*.5 for v in size]
    vs=[(x+a*rx,y+b*ry,z+c*rz) for a,b,c in [(-1,-1,-1),(1,-1,-1),(1,1,-1),(-1,1,-1),(-1,-1,1),(1,-1,1),(1,1,1),(-1,1,1)]]
    return mesh(name,vs,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(3,7,6,2),(0,4,7,3),(1,2,6,5)],mat,min(bevel,min(size)*.2),bool(bevel))

def rotate_at(obj,position,euler):
    # Box vertices are authored in world coordinates; give a rotated part its
    # own origin before rotating so a coping block cannot orbit the world origin.
    center=xyz(position)
    for vertex in obj.data.vertices:vertex.co-=center
    obj.location=center;obj.rotation_euler=euler
    return obj

def slab(name,outline,top,bottom,mat,bevel=.045):
    n=len(outline);vs=[(x,y,z) for y in [top,bottom] for x,z in outline]
    fs=[tuple(range(n)),tuple(reversed(range(n,2*n)))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    return mesh(name,vs,fs,mat,bevel,False)

def rod(name,a,b,r,mat,segments=20,r2=None):
    av,bv=xyz(a),xyz(b);direction=bv-av
    bpy.ops.mesh.primitive_cone_add(vertices=segments,radius1=r,radius2=r if r2 is None else r2,depth=direction.length,location=(av+bv)*.5)
    obj=bpy.context.object;obj.name=name
    obj.rotation_euler=direction.to_track_quat('Z','Y').to_euler();register(obj,mat)
    edge=obj.modifiers.new('End fillet','BEVEL');edge.width=min(.012,r*.12);edge.segments=2
    return obj

def lathe(name,profile,mat,center=(0,0,0),segments=40,flutes=0):
    vs=[];faces=[];cx,cy,cz=center
    for radius,height in profile:
        for i in range(segments):
            a=i/segments*TAU;r=radius*(1+.045*math.cos(a*flutes)) if flutes else radius
            vs.append((cx+math.cos(a)*r,cy+height,cz+math.sin(a)*r))
    for row in range(len(profile)-1):
        for i in range(segments):
            a=row*segments+i;b=row*segments+(i+1)%segments
            faces.append((a,b,b+segments,a+segments))
    faces.extend([tuple(reversed(range(segments))),tuple((len(profile)-1)*segments+i for i in range(segments))])
    return mesh(name,vs,faces,mat,.009,True)

def curve(name,points,radius,mat,steps=5):
    data=bpy.data.curves.new(name+' path','CURVE');data.dimensions='3D'
    data.resolution_u=steps;data.bevel_depth=radius;data.bevel_resolution=2
    spline=data.splines.new('BEZIER');spline.bezier_points.add(len(points)-1)
    for point,p in zip(spline.bezier_points,points):
        point.co=xyz(p);point.handle_left_type=point.handle_right_type='AUTO'
    obj=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(obj);return register(obj,mat)

def ring(name,radius,tube,mat,position=(0,0,0),axis='y',arc=TAU,start=0,segments=64):
    vertices=[];faces=[];closed=abs(arc-TAU)<1e-6;n=segments if closed else segments+1
    for i in range(n):
        a=start+i/segments*arc
        for j in range(8):
            b=j/8*TAU;r=radius+math.cos(b)*tube
            v=(math.cos(a)*r,math.sin(b)*tube,math.sin(a)*r)
            if axis=='z':v=(v[0],v[2],v[1])
            if axis=='x':v=(v[1],v[0],v[2])
            vertices.append(tuple(v[k]+position[k] for k in range(3)))
    for i in range(segments):
        for j in range(8):faces.append((i*8+j,((i+1)%n)*8+j,((i+1)%n)*8+(j+1)%8,i*8+(j+1)%8))
    return mesh(name,vertices,faces,mat,0,True)

def panel(name,outline,depth,mat,bevel=.02):
    n=len(outline);vs=list(outline)+[(x,y,z-depth) for x,y,z in outline]
    fs=[tuple(range(n)),tuple(reversed(range(n,2*n)))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    return mesh(name,vs,fs,mat,bevel,True)

def rock(name,position,scale,mat,seed=1,subdiv=1):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=subdiv,radius=1,location=xyz(position))
    obj=bpy.context.object;obj.name=name;rng=random.Random(seed)
    for v in obj.data.vertices:v.co*=rng.uniform(.82,1.19)
    obj.scale=(scale[0],scale[2],scale[1]);register(obj,mat,False)
    return obj

def arch(name,x,z,width,spring,rise,thick,depth,mat,count=21,offset=0):
    # Curved voussoirs have visible joints and full side/back faces.
    for i in range(count):
        a0=i/count*math.pi+.007;a1=(i+1)/count*math.pi-.007;vs=[]
        for zz in [z-depth*.5,z+depth*.5]:
            for inset in [0,thick]:
                for a in [a0,a1]:
                    vs.append((x+math.cos(a)*(width*.5+inset),spring+math.sin(a)*(rise+inset)+offset,zz))
        mesh(name+' / cut arch stone '+str(i),vs,[(0,1,3,2),(4,6,7,5),(0,4,5,1),(2,3,7,6),(0,2,6,4),(1,5,7,3)],mat,.025)

def engraved_star(name,center,radius,mat,points=8):
    x,y,z=center;vertices=[center]
    for i in range(points*2):
        a=i/(points*2)*TAU;r=radius if i%2==0 else radius*.40
        vertices.append((x+math.cos(a)*r,y,z+math.sin(a)*r))
    return mesh(name,vertices,[(0,i+1,(i+1)%(points*2)+1) for i in range(points*2)],mat)

def fix_normals():
    for obj in OBJECTS:
        if obj.type!='MESH':continue
        bm=bmesh.new();bm.from_mesh(obj.data)
        bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(obj.data);bm.free()

# The five concepts in public/concepts were inspected before these compositions.
# Large silhouettes, the surface palette and the landmark construction are the
# reference targets. Texture microdetail and sprawling background cities are not.

def palette():
    specs={
      'sand':((.49,.40,.28),0,.84), 'sand_light':((.67,.57,.41),0,.78),
      'sand_dark':((.32,.28,.22),0,.9), 'moss':((.20,.25,.105),0,.94),
      'ivory':((.72,.68,.55),0,.63), 'ivory_light':((.85,.80,.67),0,.58),
      'ivory_dark':((.43,.42,.38),0,.73), 'marble':((.70,.74,.75),0,.57),
      'marble_light':((.83,.86,.84),0,.5), 'marble_dark':((.45,.52,.57),0,.68),
      'steel':((.20,.27,.32),.65,.44), 'steel_light':((.34,.42,.46),.68,.36),
      'steel_dark':((.095,.13,.17),.72,.49), 'copper':((.43,.21,.10),.68,.45),
      'copper_worn':((.26,.40,.36),.65,.63), 'brass':((.62,.40,.15),.73,.33),
      'brass_light':((.82,.60,.25),.8,.3), 'blue':((.07,.16,.30),.18,.57),
      'violet':((.20,.115,.29),.05,.77), 'teal':((.06,.27,.28),.10,.7),
      'wood':((.18,.085,.036),0,.84), 'book_red':((.29,.08,.055),0,.9),
      'book_ochre':((.44,.27,.10),0,.9), 'book_blue':((.07,.18,.23),0,.9),
      'paper':((.72,.60,.38),0,.93), 'water':((.025,.31,.34),.45,.18),
      'foam':((.17,.66,.67),.15,.28), 'rock':((.20,.24,.26),0,.93),
      'far_rock':((.19,.245,.31),0,.97), 'black':((.026,.036,.048),.25,.69),
    }
    for key,(color,metal,rough) in specs.items():M[key]=material(key,color,metal,rough)
    M['cyan']=material('Luminous cut crystal',(.055,.62,.72),.3,.2,1.8)
    M['amber']=material('Warm machine lamps',(1,.48,.075),.1,.3,2.1)
    M['lavender']=material('Archive heart',(.40,.17,.85),.2,.3,1.25)

def tiled_floor(name,xmin,xmax,zmin,zmax,step,mats):
    nx=round((xmax-xmin)/step);nz=round((zmax-zmin)/step)
    dx=(xmax-xmin)/nx;dz=(zmax-zmin)/nz;rng=random.Random(name)
    for ix in range(nx):
        for iz in range(nz):
            box(name+' / individual paving',
                (xmin+(ix+.5)*dx,.385,zmin+(iz+.5)*dz),
                (dx-.035,.19,dz-.035),rng.choice(mats),.02)

def stairs(name,x,z,width,steps=5,height=.22,depth=.42,mat='sand_light',base=-.62):
    for i in range(steps):
        top=base+(i+1)*height
        box(name+' / tread '+str(i),(x,(top+base)*.5,z-i*depth),
            (width,top-base,depth+.035),mat,.027)

def banner(name,x,y,z,width,length,mat='teal'):
    points=[(x-width*.5,y,z),(x,y+.018,z+.04),(x+width*.5,y,z),
      (x+width*.44,y-length+.22,z+.035),(x,y-length,z+.04),(x-width*.44,y-length+.22,z+.03)]
    panel(name,points,.035,mat,.003)
    rod(name+' / mounting bar',(x-width*.65,y+.08,z),(x+width*.65,y+.08,z),.035,'brass',12)
    # Emblem is a complete little three-dimensional medallion, visible in rotation.
    ring(name+' / seal',width*.17,.017,'brass_light',(x,y-length*.36,z+.09),'z',segments=24)
    rod(name+' / emblem axis',(x,y-length*.56,z+.09),(x,y-length*.17,z+.09),.012,'brass_light',8)

def crystal(name,x,y,z,scale=1,mat='cyan'):
    vs=[(x,y+1.6*scale,z),(x,y-.3*scale,z)]
    for i in range(6):
        a=i/6*TAU;vs.append((x+math.cos(a)*.33*scale,y+.9*scale,z+math.sin(a)*.33*scale))
    fs=[]
    for i in range(6):fs.extend([(0,2+i,2+(i+1)%6),(1,2+(i+1)%6,2+i)])
    return mesh(name,vs,fs,mat)

def lantern(name,x,y,z,scale=1):
    lathe(name+' / plinth',[(.19,0),(.21,.06),(.15,.11)],'brass',(x,y,z),24)
    box(name+' / glass',(x,y+.31*scale,z),(.22*scale,.4*scale,.22*scale),'amber',.035)
    for dx,dz in [(-1,-1),(-1,1),(1,-1),(1,1)]:
        rod(name+' / cage',(x+dx*.13*scale,y+.12*scale,z+dz*.13*scale),
          (x+dx*.13*scale,y+.55*scale,z+dz*.13*scale),.018,'steel_dark',8)
    lathe(name+' / hood',[(.23,0),(.18,.08),(.10,.14),(.05,.22)],'brass',(x,y+.54*scale,z),24)

def rivet_line(name,a,b,count,mat='brass',radius=.045):
    for i in range(count):
        t=i/max(count-1,1);p=tuple(a[j]+(b[j]-a[j])*t for j in range(3))
        rock(name,p,(radius,radius,radius),mat,subdiv=1)

def railing(name,x,z,length,axis='z',height=.7,mat='brass',base=.48):
    count=max(2,round(length/1.4)+1)
    for i in range(count):
        d=-length*.5+i/(count-1)*length;px=x+(d if axis=='x' else 0);pz=z+(d if axis=='z' else 0)
        rod(name+' / upright',(px,base,pz),(px,base+height,pz),.037,mat,12)
    for h in [.25,height]:
        a=(x-length*.5 if axis=='x' else x,base+h,z-length*.5 if axis=='z' else z)
        b=(x+length*.5 if axis=='x' else x,base+h,z+length*.5 if axis=='z' else z)
        rod(name+' / rail',a,b,.032,mat,12)

def grate(name,x,z,width=1.2,depth=.65,mat='steel_dark'):
    box(name+' / recess',(x,.489,z),(width,.018,depth),'black',.006)
    for i in range(9):box(name+' / vent',(x-width*.45+i*width*.9/8,.507,z),(.038,.03,depth*.91),mat,.006)

def rocky_foundation(name,outline,depth=3):
    slab(name+' / continuous bedrock',outline,.14,-depth,'rock',.09)
    for i,(x,z) in enumerate(outline):
        rock(name+' / cliff facets',(x,-depth*.55,z),(1.25,depth*.62,1.0),'rock',i,2)

def mountains(name,positions):
    if 'far_ridge' not in M:
        M['far_ridge']=material('Quiet distant mountain stone',(.145,.19,.23),0,.98)
    # Continuous mountains descend below every permitted viewing angle. Their
    # upper ridge is faceted, but there is deliberately no lower pointed tip.
    footprint=[(-1,-.40),(-.58,-.87),(.17,-.92),(.80,-.48),(1,.15),(.52,.65),(-.24,.72),(-.88,.24)]
    shoulders=[.02,.25,.32,.11,.04,.17,.29,.08]
    for i,(x,z,height,width) in enumerate(positions):
        if z>0:continue  # The two old front-side storm stones blocked wide views.
        vs=[(x+dx*width*1.65,-35,z+dz*width*1.16) for dx,dz in footprint]
        vs.extend((x+dx*width*.92,height*shoulders[j]-1.2,z+dz*width*.72) for j,(dx,dz) in enumerate(footprint))
        vs.append((x-width*.13,height*.68-1.2,z-width*.10))
        faces=[tuple(reversed(range(8)))]
        for j in range(8):
            k=(j+1)%8;faces.extend([(j,k,8+k,8+j),(8+j,8+k,16)])
        mesh(name+' / continuous distant mountain '+str(i),vs,faces,'far_ridge',0,False)

def pointed_arch(name,x,z,width,spring,rise,thick=.62,depth=1):
    for side in [-1,1]:
        for i in range(11):
            ts=[i/11+.006,(i+1)/11-.006];vs=[]
            for zz in [z-depth/2,z+depth/2]:
                for outer in [0,thick]:
                    for t in ts:
                        a=math.pi-t*math.pi/3
                        vs.append((x+side*(-width*.5-width*math.cos(a)+outer*(1-.5*t)),spring+rise*math.sin(a)/math.sin(math.pi/3)+outer*.45,zz))
            mesh(name+' / pointed voussoir',vs,[(0,1,3,2),(4,6,7,5),(0,4,5,1),(2,3,7,6),(0,2,6,4),(1,5,7,3)],'sand_light',.025)

def ruins():
    world('ruins')
    outline=[(-8.5,-8.2),(-4.5,-8.2),(-4.5,-9.1),(6.6,-9.1),(8.5,-7.2),(8.5,5.7),(6.3,7.8),(-6.8,7.8),(-8.5,6)]
    rocky_foundation('Sandstone cliff courtyard',outline,2.5)
    slab('Raised dressed-stone floor',outline,.29,-.25,'sand_dark')
    tiled_floor('Warm courtyard',-7.8,7.8,-7.7,7.5,1.3,['sand','sand_light','sand','sand'])
    # Low dressed edges leave the front readable from the combat camera.
    for side in [-1,1]:
        for j in range(10):box('Side coping',(side*8.0,.49,-6.7+j*1.35),(.46,.24,1.27),'sand_light',.055)
        for j in [0,1,3]:
            box('Broken side parapet',(side*8.0,.87,-5.8+j*2.25),(.5,.55,1.42),'sand',.045)
    stairs('Wide courtyard entrance',0,9.95,5.3,6,.18,.40,'sand_light',-.60)
    for x in [-6.4,6.4]:stairs('Raised rear aisle',x,-3.9,2.1,6,.24,.43,'sand_light',.48)
    # Main gateway is constructed through its full depth, rather than a billboard.
    for side in [-1,1]:
        x=side*3.7
        box('Gate footing',(x,.82,-7.7),(1.6,.68,1.9),'sand_light',.075)
        for row in range(8):box('Gate ashlar pier',(x,1.53+row*.62,-7.7),(1.24,.585,1.45),'sand' if row%3 else 'sand_light',.045)
        box('Gate buttress cap',(x,6.22,-7.7),(1.65,.29,1.85),'sand_light',.05)
        rod('Gate inner bronze jamb',(side*3.00,.62,-6.90),(side*3.00,4.75,-6.90),.065,'brass',12)
        banner('Tattered teal gate standard',x,5.92,-6.91,.8,3.4)
        for k in range(3):
            box('Broken wall wing',(side*(5.1+k*.9),1.9-k*.31,-8.0),(.82,2.9-k*.55,1.15),'sand',.055)
        box('Gate shoulder',(side*3.63,6.59,-7.74),(1.40,.40,1.54),'sand_dark',.06)
    pointed_arch('Suspended crystal gate',0,-7.72,6.05,4.72,3.95,.57,1.35)
    panel('Crest bronze shield',[(-.65,9.18,-7.02),(0,9.9,-7.02),(.65,9.18,-7.02),(0,8.2,-7.02)],.12,'brass',.025)
    rod('Crystal suspension',(0,8.58,-7.65),(0,7.25,-7.65),.035,'brass',12)
    crystal('Gateway suspended cyan crystal',0,5.9,-7.65,1.15)
    # Split columns and growth clusters are the only repeated decorative family.
    for i,(x,z,h) in enumerate([(-6.0,-1.4,2.7),(6.35,3.8,1.6),(-6.9,5.3,1.25)]):
        lathe('Broken fluted column',[(.78,0),(.8,.18),(.59,.35),(.49,.49),(.49,h),(.56,h+.08)],'sand_light',(x,.48,z),32,8)
        ring('Column metal collar',.50,.048,'brass',(x,.85+h*.55,z),segments=32)
        for k in range(3):crystal('Growing cyan crystals',x+.7+math.cos(k*2)*.27,.47,z+math.sin(k*2)*.34,.36+k*.12)
        for k in range(5):rock('Weathered column rubble',(x+math.cos(k)*.94,.50,z+math.sin(k)*.80),(.29,.24,.34),'sand_dark',k+i*9,1)
    for x,z in [(-7.4,-5),(7.5,-2),(-6.9,4.0),(5.3,6.9)]:
        rock('Moss along paving seam',(x,.48,z),(.65,.017,.32),'moss',1,2)
    ring('Inlaid compass border',2.55,.018,'brass',(0,.491,.4),segments=80)
    engraved_star('Cyan courtyard seal',(0,.488,.4),2.13,'teal',4)
    ring('Seal core',.42,.012,'brass',(0,.497,.4),segments=32)
    mountains('Ruined valley',[(-17,-15,5,3),(14,-18,7,4),(-23,-25,9,4),(22,-30,11,6)])

def storm():
    world('storm')
    outline=[(-6.65,-10),(6.65,-10),(6.65,8),(-6.65,8)]
    slab('Suspended bridge load deck',outline,.28,-.52,'steel_dark',.05)
    tiled_floor('Riveted bridge plate',-6.25,6.25,-9.5,7.6,1.8,['steel','steel_light','steel'])
    for x in [-6.5,6.5]:
        box('Structural side girder',(x,-.47,-1),(.43,.90,18.6),'steel',.05)
        for z in [-8.4,-4.3,-.2,3.9,7.6]:
            box('Hanging bridge pier',(x,-1.65,z),(.77,4.65,.78),'steel',.055)
            for y in [-2.9,-.30,.46]:box('Pier binding',(x,y,z),(1.01,.22,1.0),'brass',.025)
        for z in [-6.35,-2.25,1.85,5.75]:
            rod('Bridge diagonal cross brace',(x,-2.8,z-1.65),(x,-.58,z+1.65),.105,'steel_light',12)
            rod('Bridge diagonal cross brace',(x,-2.8,z+1.65),(x,-.58,z-1.65),.105,'steel_light',12)
        railing('Low safety barrier',x,0,12.8,'z',.66,'brass')
    for z in [-9.5,-5.2,-.9,3.4,7.6]:
        box('Deck cross strap',(0,.49,z),(12.8,.025,.11),'brass',.008)
        box('Underside transverse beam',(0,-.71,z),(13.0,.43,.38),'steel',.03)
    for x in [-3.15,0,3.15]:
        box('Deck longitudinal strap',(x,.49,-.95),(.08,.025,17.8),'brass',.008)
        for z in [-5.2,-.9,3.4]:
            box('Deck strap junction',(x,.511,z),(.46,.035,.46),'brass',.02)
            rock('Junction stud',(x,.548,z),(.09,.033,.09),'steel_dark',3,1)
    for x in [-5.4,5.4]:
        for z in [-6,5.3]:grate('Bridge deck ventilation',x,z)
    # The single rear fork is the scene landmark; no second competing tower.
    box('Lightning tower dais',(0,.73,-8.4),(5.1,.50,3.2),'steel_light',.075)
    stairs('Tower access stairs',0,-5.3,2.7,5,.2,.34,'steel_light',.48)
    lathe('Lightning receiving socket',[(1.2,0),(1.3,.25),(.97,.45),(.85,1.23),(.98,1.35)],'steel',(0,1.0,-8.5),40)
    ring('Charged socket',.75,.09,'cyan',(0,2.30,-8.5),segments=48)
    for side in [-1,1]:
        outline=[(side*.86,2,-8.25),(side*1.28,4.0,-8.25),(side*1.13,5.0,-8.25),
          (side*1.53,5.65,-8.25),(side*1.53,9.6,-8.25),(side*.90,10.2,-8.25),
          (side*.90,6.16,-8.25),(side*.58,5.6,-8.25),(side*.58,3.4,-8.25)]
        panel('Tall forked lightning conductor',outline,.65,'steel',.052)
        points=[(side*.9,2.0,-7.85),(side*.9,4.9,-7.85),(side*1.57,5.6,-7.85),(side*1.57,9.65,-7.85),(side*.9,10.18,-7.85)]
        for a,b in zip(points,points[1:]):rod('Fork brass edge',a,b,.055,'brass',12)
        rod('Rear tower flying buttress',(side*2.3,1.05,-9.0),(side*1.1,5.0,-8.4),.14,'steel_light',16)
        for h in [3.3,4.3,6.4,7.5,8.6]:rock('Fork conductor fastener',(side*1.29,h,-7.88),(.056,.056,.028),'brass',1,1)
    curve('Contained lightning arc',[(0,2.4,-8.5),(.2,3.7,-8.5),(-.30,4.1,-8.5),(.18,5.5,-8.5),(-.2,6.8,-8.5),(.32,8.1,-8.5),(0,10,-8.5)],.035,'cyan',1)
    for side in [-1,1]:
        for z in [-7.6,5.8]:
            x=side*6.9
            box('Cable anchor plinth',(x,.50,z),(1.25,.65,1.25),'steel_light',.06)
            for y in [.85,2.32]:box('Cable anchor cornice',(x,y,z),(1.08,.24,1.05),'brass',.035)
            for dx,dz in [(-1,-1),(-1,1),(1,-1),(1,1)]:
                rod('Anchor cage leg',(x+dx*.32,.96,z+dz*.32),(x+dx*.32,2.18,z+dz*.32),.10,'steel',12)
            rod('Anchor glowing core',(x,.99,z),(x,2.16,z),.15,'cyan',16)
            curve('Coarse tension cable',[(x,1.68,z),(side*9.6,.9,z-1),(side*12.5,2.0,z-2)],.10,'black')
            for k in range(4):ring('Cable ferrule',.14,.035,'brass',(x+side*(.65+k*.1),1.5,z-.30),'x',segments=16)
        curve('Rear tower feeder',[(side*1.7,2,-8.7),(side*3.8,1.3,-9.9),(side*6.9,1.7,-7.6)],.105,'black')
    mountains('Storm canyon',[(-11,-12,5,2.0),(12,-15,8,2.5),(-19,-23,10,3),(22,-27,12,3),(-14,8,4,1.8),(15,10,4.5,2)])

def bookshelf(name,x,z,width=2.6,height=5.1):
    box(name+' / back',(x,.48+height*.5,z),(width,height,.32),'wood',.025)
    for dx in [-width*.5,width*.5]:box(name+' / stile',(x+dx,.48+height*.5,z+.20),(.14,height+.16,.66),'wood',.025)
    rng=random.Random(name)
    levels=6;dy=height/levels
    for row in range(levels+1):box(name+' / shelf',(x,.48+row*dy,z+.23),(width+.12,.12,.72),'wood',.015)
    for row in range(levels):
        cursor=-width*.45
        while cursor<width*.43:
            w=rng.uniform(.10,.19);h=rng.uniform(dy*.61,dy*.83)
            box(name+' / book',(x+cursor+w*.5,.55+row*dy+h*.5,z+.36),(w-.013,h,.35),rng.choice(['book_red','book_blue','book_ochre']),0)
            box(name+' / spine gilding',(x+cursor+w*.5,.69+row*dy,z+.541),(w*.7,.017,.008),'brass',0)
            cursor+=w

def sanctum():
    world('sanctum')
    outline=[(-8.8,-9),(8.8,-9),(8.8,7.5),(6.4,8.4),(-6.4,8.4),(-8.8,7.5)]
    slab('Archive stepped foundation',outline,.29,-.6,'ivory_dark',.075)
    tiled_floor('Ivory archive mosaic',-8.2,8.2,-8.4,7.9,1.36,['ivory','ivory','ivory_light'])
    for x in [-5.7,5.7]:box('Dark floor border',(x,.487,.1),(.20,.013,15.6),'ivory_dark',.003)
    for z in [-6.9,6.9]:box('Dark floor border',(0,.487,z),(11.4,.013,.20),'ivory_dark',.003)
    ring('Archive reading circle',3.4,.027,'ivory_dark',(0,.491,.8),segments=96)
    engraved_star('Archive floor compass',(0,.490,.8),1.25,'ivory_dark',4)
    stairs('Archive entrance',0,9.7,6.7,4,.2,.40,'ivory_light',-.32)
    # Flanking book banks and a shallow service gallery, outside combat bounds.
    for side in [-1,1]:
        for j in range(2):bookshelf('Archive '+str(side)+' bank '+str(j),side*(5.45+j*2.5),-7.84,2.36,5.7)
        box('Side gallery stone foundation',(side*7.65,1.98,-4.35),(1.45,3.0,5.4),'ivory',.045)
        for zz in [-6.8,-4.4,-2.0]:
            box('Side gallery pilaster',(side*7.59,3.0,zz),(1.1,5.0,.50),'ivory_light',.035)
            box('Pilaster capital',(side*7.59,5.56,zz),(1.43,.28,.76),'ivory_dark',.03)
        box('Gallery timber deck',(side*7.43,3.45,-4.4),(2.15,.18,5.7),'wood',.025)
        railing('Gallery balustrade',side*6.52,-4.4,5.6,'z',.76,'brass',3.55)
        stairs('Gallery access stairs',side*7.4,.76,1.38,10,.30,.36,'ivory',.48)
        for z in [-1.8,5.9]:
            box('Reading hall low pier',(side*7.9,1.05,z),(.85,1.15,.85),'ivory',.04)
            box('Reading hall cap',(side*7.9,1.67,z),(1.0,.14,1.0),'ivory_light',.025)
            lantern('Reading lamp',side*7.9,1.75,z)
        railing('Reading hall edge',side*8.0,3.0,5.2,'z',.56,'brass')
        banner('Violet archive pennant',side*4.3,7.8,-7.24,.90,4.0,'violet')
    # Monumental indexed bronze ring with books held in radial trays.
    for x in [-4.05,4.05]:
        box('Catalog arch pier',(x,4.0,-8.0),(1.05,7.04,1.0),'ivory_light',.035)
        box('Catalog arch capital',(x,7.56,-8.0),(1.4,.32,1.35),'brass',.025)
    arch('Catalog framing arch',0,-8.0,7.0,6.9,2.8,.62,.9,'ivory_light',23)
    for r,y in [(3.35,.62),(3.04,.86),(2.72,1.10)]:
        lathe('Catalog stepped dais',[(r,0),(r,.20)],'ivory_light',(0,y-.2,-7.1),64)
    ring('Catalog outer bronze shell',2.85,.20,'brass',(0,4.35,-7.35),'z',segments=96)
    ring('Catalog outer rim',3.02,.075,'brass_light',(0,4.35,-7.10),'z',segments=96)
    ring('Catalog inner index race',2.29,.10,'brass',(0,4.35,-7.19),'z',segments=80)
    for i in range(24):
        a=i/24*TAU;cx=math.cos(a)*2.53;cy=4.35+math.sin(a)*2.53
        rod('Catalog indexed spoke',(math.cos(a)*2.25,4.35+math.sin(a)*2.25,-7.25),(math.cos(a)*2.83,4.35+math.sin(a)*2.83,-7.25),.036,'brass_light',10)
        # Open, thick bound folios are authored on individual radial shelves.
        if i%2==0:
            obj=box('Catalog bound folio',(cx,cy,-6.93),(.42,.30,.19),'paper',.018)
            obj.rotation_euler[1]=0
            box('Catalog folio binding',(cx,cy,-7.06),(.48,.35,.10),'wood',.01)
    ring('Archive suspended heart ring',.99,.055,'brass_light',(0,4.35,-7.23),'z',segments=56)
    crystal('Violet archive heart',0,3.75,-7.25,.68,'lavender')
    rod('Catalog upper spindle',(0,5.35,-7.25),(0,7.65,-7.25),.07,'brass',16)
    rod('Catalog lower spindle',(0,1.12,-7.25),(0,3.35,-7.25),.08,'brass',16)
    lantern('Catalog dais lamp',-3.1,1.28,-5.2);lantern('Catalog dais lamp',3.1,1.28,-5.2)
    for side in [-1,1]:
        box('Rear stone return',(side*8.5,2.6,-7.3),(.55,4.2,3.1),'ivory_dark',.04)
    mountains('Distant archive spires',[(-17,-22,6,2.3),(16,-24,7,2.2),(-23,-34,11,3.4)])

def valve(name,x,y,z,radius=.65):
    ring(name+' / rim',radius,.075,'copper',(x,y,z),'z',segments=48)
    rod(name+' / central stem',(x,y,z-.30),(x,y,z+.20),radius*.18,'brass',24)
    for i in range(6):
        a=i/6*TAU
        rod(name+' / spoke',(x,y,z),(x+math.cos(a)*radius,y+math.sin(a)*radius,z),.042,'copper',12)

def pipe_flange(name,x,y,z,radius=.56,axis='z'):
    ring(name+' / flange',radius,.09,'copper',(x,y,z),axis,segments=36)
    for i in range(10):
        a=i/10*TAU
        p=(x+math.cos(a)*radius,y+math.sin(a)*radius,z) if axis=='z' else (x+math.cos(a)*radius,y,z+math.sin(a)*radius)
        rock(name+' / flange bolt',p,(.05,.05,.05),'brass',i,1)

def floodworks():
    world('floodworks')
    outline=[(-7.0,-6.4),(7.0,-6.4),(7.0,6.6),(3.1,6.6),(3.1,10.4),(-3.1,10.4),(-3.1,6.6),(-7.0,6.6)]
    slab('Canal service quay',outline,.27,-.65,'sand_dark',.055)
    tiled_floor('Industrial service plates',-6.55,6.55,-6.0,6.2,1.72,['steel_light','steel_light','sand'])
    tiled_floor('Canal access bridge',-2.95,2.95,6.15,10.3,1.5,['steel','steel_light'])
    slab('Still turquoise canal basin',[(-13,-13),(13,-13),(13,13),(-13,13)],-.73,-.77,'water',.005)
    for x in [-9.8,9.8]:
        box('Canal outer retaining wall',(x,-.24,0),(.78,1.22,23),'sand',.06)
        for j in range(15):box('Canal dressed coping',(x,.43,-10.5+j*1.5),(.95,.19,1.43),'sand_light',.035)
    for x in [-6.9,6.9]:
        for j in range(8):box('Quay stone edging',(x,.39,-5.4+j*1.55),(.52,.30,1.45),'sand_light',.025)
        railing('Quay copper rail',x,.1,10.5,'z',.67,'copper')
        for z in [-4.8,4.8]:grate('Storm drain',x*.84,z,1.05,.60)
    for z in [-5.95,0,6.1]:
        box('Quay inset copper strap',(0,.492,z),(12.9,.02,.09),'copper',.006)
        for x in [-4.4,0,4.4]:rivet_line('Plate seam rivets',(x-.45,.512,z),(x+.45,.512,z),4,'brass',.035)
    for x in [-4.36,0,4.36]:box('Quay longitudinal seam',(x,.492,.1),(.075,.02,12.0),'copper',.006)
    # Twin flood doors with a central working valve make one dominant landmark.
    for x in [-5.6,0,5.6]:
        box('Sluice massive stone buttress',(x,3.45,-9.9),(1.20,8.45,1.75),'sand_light',.065)
        panel('Sluice sloped pier top',[(x-.61,7.70,-8.99),(x-.45,8.30,-9.34),(x+.45,8.30,-9.34),(x+.61,7.70,-8.99)],.68,'sand_light')
        for h in [.45,2.35,4.25,6.15]:box('Sluice pier ashlar joint',(x,h,-9.005),(1.05,.032,.025),'sand_dark',.004)
    box('Sluice stone lintel',(0,7.08,-10.0),(12.2,1.16,1.55),'sand',.055)
    for side in [-1,1]:
        x=side*2.80
        box('Closed oxidized floodgate',(x,2.93,-9.61),(4.22,7.28,.37),'copper_worn',.045)
        for h in [-.25,1.08,2.4,3.73,5.06,6.36]:
            box('Gate heavy transverse strap',(x,h,-9.33),(4.32,.18,.19),'copper',.018)
            rivet_line('Gate strap rivets',(x-1.9,h,-9.20),(x+1.9,h,-9.20),8,'brass',.062)
        for xx in [x-1.86,x+1.86]:box('Gate vertical strap',(xx,3.03,-9.32),(.18,6.80,.15),'copper',.018)
        box('Raised pump landing',(side*7.58,.41,-7.58),(3.6,.92,4.2),'sand',.055)
        box('Pump landing coping',(side*7.58,.91,-7.58),(3.8,.20,4.40),'sand_light',.04)
        # Two thick curved pipes terminate in real pump casings, including backs.
        points=[(side*5.98,4.85,-10),(side*7.35,4.85,-10),(side*8.15,4.08,-9.35),(side*8.15,2.36,-8.15)]
        curve('Sluice main elbow pipe',points,.48,'copper_worn',7)
        pipe_flange('Upper pipe connector',side*7.28,4.85,-9.89,.54,'z')
        pipe_flange('Pump upper connector',side*8.15,2.84,-8.25,.53,'y')
        lathe('Pump pressure housing',[(.84,0),(1.0,.18),(1.0,1.12),(.75,1.4),(.45,1.55)],'copper_worn',(side*8.15,1.02,-8.15),40)
        ring('Pump casing seam',1.01,.075,'copper',(side*8.15,1.7,-8.15),segments=40)
        valve('Pump handwheel',side*8.15,1.82,-7.15,.47)
        lantern('Pump landing lamp',side*6.28,1.06,-5.6)
        # Turbulence is kept beneath the walking surface.
        for k in range(6):
            curve('Sluice foam streak',[(side*2.8+(k-3)*.52,-.69,-9.14),(side*2.8+(k-3)*.52,-.66,-8.6),(side*2.8+(k-3)*.52+.1,-.69,-7.95)],.027,'foam',3)
    rod('Central gate rising stem',(0,-.28,-8.88),(0,6.41,-8.88),.12,'copper',24)
    valve('Central sluice control wheel',0,4.5,-8.62,.88)
    for x in [-2.6,2.6]:
        for z in [7.8,10]:lathe('Mooring bollard',[(.24,0),(.22,.12),(.14,.39),(.25,.44),(.24,.52)],'steel_dark',(x,.48,z),24)
    mountains('Reservoir escarpment',[(-17,-18,7,4),(17,-20,9,4),(24,-31,12,6)])

def dome_shell(name,center,radius,start,end,mat,phi_start=0,phi_end=math.pi/2,az_steps=32,el_steps=9):
    cx,cy,cz=center;vs=[]
    for layer in [0,.22]:
        for j in range(el_steps+1):
            p=phi_start+(phi_end-phi_start)*j/el_steps
            for i in range(az_steps+1):
                a=start+(end-start)*i/az_steps;r=radius+layer
                vs.append((cx+math.cos(a)*math.cos(p)*r,cy+math.sin(p)*r,cz+math.sin(a)*math.cos(p)*r))
    stride=az_steps+1;count=(el_steps+1)*stride;faces=[]
    for layer in [0,1]:
        for j in range(el_steps):
            for i in range(az_steps):
                p=layer*count+j*stride+i;faces.append((p,p+1,p+stride+1,p+stride))
    for i in range(az_steps):faces.append((i,i+1,count+i+1,count+i))
    for j in range(el_steps):
        for i in [0,az_steps]:
            p=j*stride+i;faces.append((p,p+stride,p+stride+count,p+count))
    return mesh(name,vs,faces,mat,0,True)

def armillary(name,x,y,z,radius=2.3):
    lathe(name+' / turned base',[(radius*.6,0),(radius*.64,.13),(radius*.51,.29),(radius*.27,.42),(radius*.19,.75)],'brass',(x,y,z),48)
    cy=y+radius*1.30
    for axis,r in [('z',radius),('x',radius*.84),('y',radius*1.08)]:
        ring(name+' / astronomical graduated circle',r,radius*.035,'brass_light',(x,cy,z),axis,segments=80)
    # A tilted equatorial band reads differently from the three meridian rings.
    obj=ring(name+' / inclined ecliptic',radius*.93,radius*.057,'brass',(0,0,0),'y',segments=80)
    obj.location=xyz((x,cy,z));obj.rotation_euler=(.62,.48,.15)
    for i in range(32):
        a=i/32*TAU
        rod(name+' / degree marking',(x+math.cos(a)*radius*.96,cy+math.sin(a)*radius*.96,z+.065),
            (x+math.cos(a)*radius*1.035,cy+math.sin(a)*radius*1.035,z+.065),radius*.007,'blue',8)
    rod(name+' / polar spindle',(x-radius*.43,cy-radius*1.24,z-.35),(x+radius*.43,cy+radius*1.24,z+.35),radius*.045,'brass_light',20)
    rock(name+' / sun globe',(x,cy,z),(radius*.33,)*3,'brass_light',1,3)

def observatory():
    world('observatory')
    outline=[(-5.4,-8.4),(5.4,-8.4),(8.5,-5.3),(8.5,4.8),(5.5,8.1),(-5.5,8.1),(-8.5,4.8),(-8.5,-5.3)]
    rocky_foundation('Octagonal observatory cliff',outline,3.8)
    slab('White stone octagonal foundation',outline,.34,-.43,'marble_dark',.06)
    slab('Star chart white stone field',[(x*.97,z*.97) for x,z in outline],.48,.32,'marble',.025)
    # Radial stone sectors instead of a uniform circular disc or square paving.
    for sector in range(8):
        a0=sector/8*TAU;a1=(sector+1)/8*TAU
        for row in range(4):
            r0=1.5+row*1.55;r1=r0+1.50
            vs=[]
            for a,r in [(a0+.008,r0),(a1-.008,r0),(a1-.008,r1),(a0+.008,r1)]:vs.append((math.cos(a)*r,math.sin(a)*r))
            slab('Radial cut paving sector',vs,.481,.39,'marble_light' if (row+sector)%3==0 else 'marble',.01)
    for i in range(8):
        a=i/8*TAU;x=math.cos(a)*7.2;z=math.sin(a)*7.2
        ring('Star chart outer constellation',.34,.018,'brass_light',(x,.493,z),segments=32)
        rod('Constellation connecting ray',(math.cos(a)*3.10,.489,math.sin(a)*3.10),(x,.489,z),.011,'brass_light',8)
    engraved_star('Blue eight-point celestial inlay',(0,.488,0),5.2,'blue',8)
    # Thin inset brass outlines remain essentially flush with the combat plane.
    for i in range(16):
        a=i/16*TAU;b=(i+1)/16*TAU;r=5.2 if i%2==0 else 2.08;s=5.2 if (i+1)%2==0 else 2.08
        rod('Celestial star brass outline',(math.cos(a)*r,.496,math.sin(a)*r),(math.cos(b)*s,.496,math.sin(b)*s),.017,'brass_light',8)
    for r in [.56,3.78,7.25]:ring('Celestial chart orbit',r,.019,'brass_light',(0,.497,0),segments=112)
    engraved_star('Celestial chart core',(0,.498,0),.48,'marble_light',4)
    for i in range(len(outline)):
        x0,z0=outline[i];x1,z1=outline[(i+1)%len(outline)]
        if i==4:continue
        steps=round(math.dist((x0,z0),(x1,z1))/1.3)
        for k in range(steps):
            t=(k+.5)/steps;x=x0+(x1-x0)*t;z=z0+(z1-z0)*t
            obj=box('Octagon coping block',(x,.56,z),(math.dist((x0,z0),(x1,z1))/steps-.04,.30,.38),'marble_light',.04)
            rotate_at(obj,(x,.56,z),(0,0,-math.atan2(z1-z0,x1-x0)))
    stairs('Observatory entrance stair',0,10.18,4.9,6,.18,.35,'marble_light',-.60)
    # Rear half-dome is a genuine curved shell with an asymmetric broken crown.
    dome_shell('Left surviving blue half-dome',(0,4.15,-8.10),4.35,math.pi,math.pi*1.48,'blue',0,1.40,18,10)
    dome_shell('Right surviving blue half-dome',(0,4.15,-8.10),4.35,math.pi*1.55,TAU,'blue',0,1.23,17,9)
    for a in [math.pi,math.pi*1.18,math.pi*1.37,math.pi*1.65,math.pi*1.83,TAU]:
        end=1.4 if a<math.pi*1.5 else 1.23
        points=[]
        for j in range(17):
            p=j/16*end;points.append((math.cos(a)*math.cos(p)*4.36,4.15+math.sin(p)*4.36,-8.10+math.sin(a)*math.cos(p)*4.36))
        curve('Dome stone meridian rib',points,.105,'marble_light',2)
    for side in [-1,1]:
        for zz in [-8.0,-10.9]:
            x=side*(4.45 if zz==-8 else 3.08)
            box('Dome supporting pier',(x,2.3,zz),(.93,3.64,.94),'marble_light',.05)
            box('Dome pier capital',(x,4.11,zz),(1.26,.26,1.25),'marble_dark',.03)
        banner('Observatory blue standard',side*4.43,3.91,-7.48,.72,2.42,'blue')
    for side in [-1,1]:
        for i in range(9):
            a=(i/9)*math.pi*.45
            # Broken front arch stops before its apex, preserving the missing roof.
            x=side*(math.cos(a)*4.50);y=4.13+math.sin(a)*4.52
            obj=box('Broken dome front arch stone',(x,y,-8.01),(.69,.48,.70),'marble_light',.04)
            rotate_at(obj,(x,y,-8.01),(0,-math.pi*.5-side*a,0))
    for r,y in [(3.25,.60),(2.96,.83),(2.68,1.06)]:lathe('Armillary stepped dais',[(r,0),(r,.20)],'marble_light',(0,y-.2,-7.15),64)
    armillary('Great golden armillary',0,1.13,-7.55,2.25)
    for side in [-1,1]:
        box('Side instrument stone pedestal',(side*6.72,1.13,-3.2),(1.55,1.30,1.55),'marble',.045)
        box('Side instrument pedestal cap',(side*6.72,1.86,-3.2),(1.75,.16,1.75),'marble_light',.035)
        armillary('Small astronomical instrument',side*6.72,1.97,-3.2,.53)
        banner('Instrument drape',side*6.72,1.69,-2.36,.72,.99,'blue')
        for z in [4.45]:
            box('Front low observatory pier',(side*6.90,.92,z),(.82,.88,.82),'marble_light',.035)
            rock('Front golden finial',(side*6.9,1.50,z),(.20,.20,.20),'brass',1,2)
    mountains('Mountain observatory',[(-15,-18,7,3),(14,-21,8,3),(-24,-31,11,4),(23,-37,13,5)])

def pack_references():
    collection=bpy.data.collections.new('REFERENCE / generated scene concepts');bpy.context.scene.collection.children.link(collection)
    collection.hide_render=True
    for i,id in enumerate(WORLD_IDS):
        path=ROOT/'public'/'concepts'/(id+'.png')
        if not path.exists():raise FileNotFoundError('Concept must be inspected and available before modeling: '+str(path))
        img=bpy.data.images.load(str(path),check_existing=True);img.pack()
        obj=bpy.data.objects.new('CONCEPT / '+id,None);obj.empty_display_type='IMAGE';obj.data=img
        obj.empty_display_size=14;obj.location=(i*17,25,8);collection.objects.link(obj)
        obj['reference_path']='public/concepts/'+id+'.png';obj.hide_render=True

def render_setup():
    scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=24
    scene.cycles.use_denoising=True;scene.render.resolution_x=1600;scene.render.resolution_y=1100
    scene.render.resolution_percentage=100;scene.render.image_settings.file_format='PNG'
    scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.22,.27,.34,1)
    scene.world.node_tree.nodes['Background'].inputs[1].default_value=.48
    scene.view_settings.view_transform='AgX'
    for name,pos,energy,size,color in [('Warm large key',(-10,17,8),2700,9,(1,.82,.62)),('Cool readable fill',(11,12,6),2100,10,(.65,.79,1)),('Rear silhouette',(0,14,-12),3200,8,(.77,.86,1))]:
        data=bpy.data.lights.new(name,'AREA');data.energy=energy;data.shape='DISK';data.size=size;data.color=color
        obj=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(obj);obj.location=xyz(pos)
        obj.rotation_euler=(xyz((0,1,0))-obj.location).to_track_quat('-Z','Y').to_euler()
    data=bpy.data.cameras.new('Full environment battle camera');camera=bpy.data.objects.new('Full environment battle camera',data)
    bpy.context.collection.objects.link(camera);scene.camera=camera
    camera.location=xyz((16,16,23));camera.rotation_euler=(xyz((0,2.4,-1.4))-camera.location).to_track_quat('-Z','Y').to_euler()
    data.type='ORTHO';data.ortho_scale=32
    return scene

def set_visible(id):
    for key,root in WORLDS.items():
        root.hide_render=key!=id
        for obj in root.children:obj.hide_render=key!=id

def glb_stats():
    import struct
    data=GLB.read_bytes();doc=json.loads(data[20:20+struct.unpack_from('<I',data,12)[0]])
    stats={'triangles':0,'bytes':len(data),'mesh_batches':len(doc.get('meshes',[])),'worlds':{}}
    def visit(index):
        node=doc['nodes'][index];total=0;batches=0
        if 'mesh' in node:
            batches+=1
            for primitive in doc['meshes'][node['mesh']]['primitives']:
                total+=doc['accessors'][primitive['indices']]['count']//3
        for child in node.get('children',[]):
            a,b=visit(child);total+=a;batches+=b
        return total,batches
    for i,node in enumerate(doc['nodes']):
        extra=node.get('extras',{})
        if extra.get('grande_world'):
            total,batches=visit(i);stats['worlds'][extra['world_id']]={'triangles':total,'mesh_batches':batches}
            stats['triangles']+=total
    (OUT/'manifest.json').write_text(json.dumps(stats,indent=2),encoding='utf-8');print(json.dumps(stats,indent=2))
    return stats

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--render',default='all');args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
    OUT.mkdir(parents=True,exist_ok=True);GLB.parent.mkdir(parents=True,exist_ok=True)
    palette()
    for build in [ruins,storm,sanctum,floodworks,observatory]:
        print('BUILDING '+build.__name__,flush=True);build()
    fix_normals();pack_references()
    sys.path.insert(0,str(Path(__file__).parent));from export_batched import export_batched
    export_batched(GLB,list(WORLDS.values())+OBJECTS)
    stats=glb_stats();assert stats['triangles']<400000,stats
    scene=render_setup();set_visible('ruins')
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'grande-worlds.blend'))
    ids=WORLD_IDS if args.render=='all' else [] if args.render=='none' else args.render.split(',')
    for id in ids:
        set_visible(id);scene.render.filepath=str(OUT/(id+'-showcase.png'));bpy.ops.render.render(write_still=True)
    set_visible('ruins')
    print('COMPLETE: '+str(GLB))

if __name__=='__main__':main()
