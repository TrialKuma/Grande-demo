"""Blender 3.7 environment and enemy detail library.

Every module is an editable authored mesh. Exports one self-contained GLB with
named reusable modules; the game instantiates these on animated actors/scenery.
Coordinates passed to helpers use the game's X/right, Y/up, Z/front convention.
"""
import bpy
import bmesh
import math
import json
import random
import sys
from pathlib import Path
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'assets_3d'/'detail-kit'
OUT.mkdir(parents=True,exist_ok=True)
GLB=ROOT/'public'/'models'/'grande-detail-kit.glb'
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.context.preferences.filepaths.save_version=0
TAU=math.tau
def xyz(p):return Vector((p[0],-p[2],p[1]))
def mat(name,c,metal=0,rough=.6,emit=0):
    m=bpy.data.materials.new(name);m.diffuse_color=(*c,1);m.use_nodes=True
    bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*c,1)
    bs.inputs['Metallic'].default_value=metal;bs.inputs['Roughness'].default_value=rough
    if emit:bs.inputs['Emission Color'].default_value=(*c,1);bs.inputs['Emission Strength'].default_value=emit
    return m
M={
 'stone':mat('Weathered blue basalt',(.12,.16,.20),.12,.82),
 'edge':mat('Worn cut stone edge',(.25,.29,.32),.1,.72),
 'dark':mat('Recessed iron',(.023,.040,.051),.62,.4),
 'steel':mat('Machined steel',(.27,.37,.4),.79,.34),
 'gold':mat('Etched aged brass',(.40,.29,.13),.76,.38),
 'cyan':mat('Cold arcane light',(.12,.59,.72),.22,.24,1.3),
 'violet':mat('Amethyst core',(.40,.17,.57),.28,.28,1),
 'amber':mat('Furnace ember',(.86,.27,.035),.18,.3,1.4),
 'paper':mat('Ivory parchment',(.58,.51,.36),0,.92),
 'robe':mat('Oxidized plum lacquer',(.18,.058,.09),.36,.6),
 'moss':mat('Mineral green',(.13,.27,.21),.08,.85),
 'ink':mat('Engraved black glass',(.01,.018,.022),.35,.31),
}
MODULES={}; CURRENT=None;OBJECTS=[]
def module(name):
    global CURRENT
    o=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(o)
    o['grande_module']=True;o['authoring']='Explicit Blender polygon and curve modeling / 3.7'
    MODULES[name]=o;CURRENT=o;return o
def register(o,ma,smooth=True):
    o.parent=CURRENT;o.data.materials.append(M[ma] if isinstance(ma,str) else ma)
    if o.type=='MESH':
        for p in o.data.polygons:p.use_smooth=smooth
    OBJECTS.append(o);return o
def surface(name,vs,fs,ma,bevel=0,smooth=True):
    d=bpy.data.meshes.new(name+' topology');d.from_pydata([xyz(v) for v in vs],[],fs);d.update()
    o=bpy.data.objects.new(name,d);bpy.context.collection.objects.link(o);register(o,ma,smooth)
    if bevel:
        mod=o.modifiers.new('Physical edge bevel','BEVEL');mod.width=bevel;mod.segments=2
        normal=o.modifiers.new('Weighted corner normals','WEIGHTED_NORMAL');normal.keep_sharp=True
    return o
def box(name,p,s,ma,bevel=.02):
    x,y,z=p;a,b,c=[n/2 for n in s]
    vs=[(x+dx*a,y+dy*b,z+dz*c) for dx,dy,dz in [(-1,-1,-1),(1,-1,-1),(1,1,-1),(-1,1,-1),(-1,-1,1),(1,-1,1),(1,1,1),(-1,1,1)]]
    return surface(name,vs,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(3,7,6,2),(0,4,7,3),(1,2,6,5)],ma,bevel)
def lathe(name,profile,ma,n=32,flutes=0,center=(0,0,0)):
    vs=[];fs=[];cx,cy,cz=center
    for r,y in profile:
        for i in range(n):
            a=i/n*TAU;rr=r*(1+.055*math.cos(a*flutes)) if flutes else r
            vs.append((cx+math.cos(a)*rr,cy+y,cz+math.sin(a)*rr))
    for j in range(len(profile)-1):
        for i in range(n):
            a=j*n+i;b=j*n+(i+1)%n;fs.append((a,b,b+n,a+n))
    fs.extend([tuple(reversed(range(n))),tuple((len(profile)-1)*n+i for i in range(n))])
    return surface(name,vs,fs,ma,.006)
def rod(name,a,b,r,ma,n=16,r2=None):
    av,bv=xyz(a),xyz(b);d=bv-av
    bpy.ops.mesh.primitive_cone_add(vertices=n,radius1=r,radius2=r if r2 is None else r2,depth=d.length,location=(av+bv)*.5)
    o=bpy.context.object;o.name=name;o.rotation_euler=d.to_track_quat('Z','Y').to_euler();register(o,ma)
    edge=o.modifiers.new('Pipe end bevel','BEVEL');edge.width=min(.008,r*.12);edge.segments=2;return o
def curve(name,points,r,ma):
    d=bpy.data.curves.new(name+' path','CURVE');d.dimensions='3D';d.resolution_u=6;d.bevel_depth=r;d.bevel_resolution=2
    sp=d.splines.new('BEZIER');sp.bezier_points.add(len(points)-1)
    for p,co in zip(sp.bezier_points,points):p.co=xyz(co);p.handle_left_type=p.handle_right_type='AUTO'
    o=bpy.data.objects.new(name,d);bpy.context.collection.objects.link(o);return register(o,ma)
def ring(name,r,tube,ma,p=(0,0,0),axis='z',n=48):
    # Front-facing XY torus; axis='y' lies horizontally.
    vs=[];fs=[]
    for i in range(n):
        a=i/n*TAU
        for j in range(8):
            b=j/8*TAU;rr=r+math.cos(b)*tube
            v=(math.cos(a)*rr,math.sin(a)*rr,math.sin(b)*tube)
            if axis=='y':v=(v[0],v[2],v[1])
            vs.append(tuple(v[k]+p[k] for k in range(3)))
    for i in range(n):
        for j in range(8):fs.append((i*8+j,((i+1)%n)*8+j,((i+1)%n)*8+(j+1)%8,i*8+(j+1)%8))
    return surface(name,vs,fs,ma)
def panel(name,points,depth,ma,bevel=.015):
    n=len(points);vs=list(points)+[(x,y,z-depth) for x,y,z in points]
    fs=[tuple(range(n)),tuple(reversed(range(n,2*n)))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    return surface(name,vs,fs,ma,bevel)
def sphere(name,p,s,ma):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24,ring_count=12,location=xyz(p))
    o=bpy.context.object;o.name=name;o.scale=(s[0],s[2],s[1]);return register(o,ma)
def bolt_ring(name,r,y,z,count=12,ma='gold'):
    for i in range(count):
        a=i/count*TAU;x=math.cos(a)*r;yy=y+math.sin(a)*r
        rod(name+str(i),(x,yy,z),(x,yy,z+.035),.022,ma,n=6)
def wedge(name,r0,r1,a0,a1,y0,y1,ma):
    steps=4;vs=[]
    for y in [y0,y1]:
        for r in [r0,r1]:
            for i in range(steps+1):
                a=a0+(a1-a0)*i/steps;vs.append((math.cos(a)*r,y,math.sin(a)*r))
    k=steps+1;fs=[]
    for i in range(steps):
        fs.extend([(i,i+1,k+i+1,k+i),(2*k+i,3*k+i,3*k+i+1,2*k+i+1),(i,2*k+i,2*k+i+1,i+1),(k+i,k+i+1,3*k+i+1,3*k+i)])
    fs.extend([(0,k,3*k,2*k),(steps,2*k+steps,3*k+steps,k+steps)])
    return surface(name,vs,fs,ma,.013,smooth=False)

module('ruin_arch')
for s in [-1,1]:
    lathe('Fluted arch jamb',[(.48,0),(.48,.18),(.38,.23),(.31,.38),(.29,2.85),(.40,2.96),(.40,3.13)],'stone',n=48,flutes=12,center=(s*1.73,0,0))
    for y in [.2,.42,2.72,2.92]:box('Layered capital band',(s*1.73,y,0),(.84,.10,.78),'edge',.022)
# Actual masonry voussoirs, with gaps and depth in the arched opening.
for i in range(19):
    a0=i/19*math.pi+.008;a1=(i+1)/19*math.pi-.008
    vs=[]
    for z in [-.30,.30]:
        for r in [1.34,1.96]:
            for a in [a0,a1]:vs.append((math.cos(a)*r,3.02+math.sin(a)*r,z))
    surface('Arch cut voussoir '+str(i),vs,[(0,1,3,2),(4,6,7,5),(0,4,5,1),(2,3,7,6),(0,2,6,4),(1,5,7,3)],'edge' if i%4==0 else 'stone',.024,False)
    if i%2==0:curve('Inset arch inscription '+str(i),[(math.cos(a0+.024)*1.70,3.02+math.sin(a0+.024)*1.70,.332),(math.cos(a1-.024)*1.70,3.02+math.sin(a1-.024)*1.70,.332)],.009,'gold')
panel('Keystone sigil',[(-.13,4.48,.35),(0,4.30,.36),(.13,4.48,.35),(0,4.72,.36)],.05,'cyan')

module('fluted_pillar')
lathe('Chipped column profile',[(.52,0),(.55,.1),(.50,.21),(.37,.29),(.32,.42),(.29,2.84),(.34,2.99),(.45,3.09),(.48,3.24)],'stone',n=64,flutes=16)
for y,r in [(.18,.5),(.38,.36),(2.94,.33),(3.13,.46)]:ring('Column torus molding',r,.025,'edge',(0,y,0),'y')
for i in range(4):
    a=i/4*TAU
    curve('Column narrow gold flute',[(math.cos(a)*.306,.52,math.sin(a)*.306),(math.cos(a)*.286,2.77,math.sin(a)*.286)],.008,'gold')
lathe('Column brazier bowl',[(.23,3.24),(.34,3.38),(.42,3.43),(.39,3.49),(.18,3.35)],'gold',n=32)
sphere('Captured light',(0,3.49,0),(.10,.23,.10),'cyan')

module('terrace_segment')
for i in range(5):wedge('Separate radial paving tile '+str(i),5.55,6.72,i*.14-.35+.006,(i+1)*.14-.35-.006,.42,.49,'edge' if i%2 else 'stone')
for r in [5.62,6.62]:
    curve('Inlaid terrace band '+str(r),[(math.cos(a)*r,.505,math.sin(a)*r) for a in [-.34,-.17,0,.17,.34]],.013,'gold')
wedge('Carved platform fascia',6.72,6.93,-.36,.36,.12,.43,'dark')
for i in range(7):
    a=-.3+i*.1
    rod('Balustrade short baluster',(math.cos(a)*6.81,.4,math.sin(a)*6.81),(math.cos(a)*6.81,.62,math.sin(a)*6.81),.045,'steel',n=8)

module('crystal_cluster')
rng=random.Random(713)
for i in range(7):
    a=i*2.4;r=.35 if i else 0;h=rng.uniform(.5,1.25) if i else 1.75
    x=math.cos(a)*r;z=math.sin(a)*r;vs=[]
    for y,rad,offset in [(0,.14,0),(h*.12,.19,0),(h*.77,.14,.04),(h,.025,.07)]:
        for j in range(6):
            t=j/6*TAU+a;vs.append((x+math.cos(t)*rad+offset,y,z+math.sin(t)*rad))
    fs=[]
    for j in range(3):
        for k in range(6):fs.append((j*6+k,j*6+(k+1)%6,(j+1)*6+(k+1)%6,(j+1)*6+k))
    fs.extend([tuple(reversed(range(6))),tuple(18+k for k in range(6))]);surface('Twisted mineral prism '+str(i),vs,fs,'violet' if i%3==0 else 'cyan',.004,False)
lathe('Fractured mineral bed',[(.3,-.06),(.64,0),(.72,.1),(.51,.25),(.16,.32)],'stone',n=11)

module('coil_tower')
lathe('Relay tower pedestal',[(.57,0),(.59,.16),(.45,.24),(.42,.56),(.23,.70),(.17,2.73),(.12,2.90)],'dark',n=32)
for j in range(7):
    y=.88+j*.25;r=.33-j*.021
    lathe('Insulator curved skirt '+str(j),[(r*.59,y-.04),(r,y),(r,y+.05),(r*.53,y+.13)],'paper',n=32)
    ring('Copper coil '+str(j),r*.95,.027,'gold',(0,y+.085,0),'y')
for s in [-1,1]:
    curve('High voltage ear '+str(s),[(s*.11,2.62,0),(s*.36,2.91,0),(s*.40,3.24,0),(s*.22,3.48,0)],.04,'steel')
sphere('Relay discharge',(0,3.02,0),(.10,.22,.10),'cyan')
for s in [-1,1]:curve('Flexible armored feed '+str(s),[(s*.4,.35,0),(s*.62,.5,.20),(s*.53,.74,.18),(s*.26,.88,0)],.038,'gold')

module('pipe_elbow')
curve('Swept elbow shell',[(0,0,0),(0,.50,0),(.13,.79,0),(.42,.9,0),(1.08,.9,0)],.19,'steel')
for y in [.10,.43]:lathe('Bolted end flange',[(.19,y-.03),(.28,y),(.28,y+.065),(.19,y+.09)],'dark',n=24)
rod('Outlet flange',(1.03,.9,0),(1.15,.9,0),.27,'gold',n=24)
for i in range(8):
    a=i/8*TAU;rod('Outlet stud '+str(i),(1.10,.9+math.cos(a)*.225,math.sin(a)*.225),(1.17,.9+math.cos(a)*.225,math.sin(a)*.225),.022,'dark',n=6)

module('archive_lectern')
lathe('Lectern turned foot',[(.55,0),(.55,.12),(.36,.20),(.21,.33),(.14,.97),(.26,1.11)],'gold',n=32,flutes=8)
panel('Sloped open book support',[(-.66,1.08,.44),(.66,1.08,.44),(.66,1.39,-.36),(-.66,1.39,-.36)],.07,'dark')
for s in [-1,1]:
    for layer in range(4):
        d=layer*.012
        surface('Curved open paper leaf '+str(s)+'/'+str(layer),[(s*.024,1.16+d,.35),(s*.61,1.14+d,.35),(s*.58,1.43+d,-.30),(s*.025,1.40+d,-.28),(s*.31,1.20+d,.35),(s*.30,1.43+d,-.3)],[(0,4,5,3),(4,1,2,5)],'paper',0)
    for row in range(6):
        z=.22-row*.075;y=1.23+row*.023
        curve('Written line '+str(s)+'/'+str(row),[(s*.10,y,z),(s*.48,y+.009,z)],.003,'ink')

module('bookcase')
box('Recessed bookcase back',(0,1.56,-.23),(1.65,3.1,.16),'dark')
for s in [-1,1]:lathe('Carved case jamb',[(.11,0),(.13,.14),(.085,.29),(.081,2.92),(.15,3.05)],'gold',n=20,flutes=5,center=(s*.82,0,0))
for row in range(4):
    y=.22+row*.71;box('Shelf '+str(row),(0,y,.03),(1.70,.075,.72),'steel')
    for i in range(8):
        x=-.68+i*.19;h=.41+(i*13+row*7)%5*.03
        box('Individual book spine '+str(row)+'/'+str(i),(x,y+.07+h/2,.075),(.14,h,.38),'robe' if (i+row)%3 else 'paper',.009)
        for band in [-.13,.13]:box('Book binding band',(x,y+.07+h/2+band,.277),(.145,.022,.014),'gold',.003)
panel('Case pointed finial',[(-.92,3.11,.1),(0,3.57,.1),(.92,3.11,.1)],.12,'gold')

module('flood_pump')
lathe('Ribbed pump chamber',[(.69,0),(.72,.14),(.60,.28),(.58,1.75),(.68,1.89),(.46,2.04)],'steel',n=48,flutes=12)
for y in [.24,1.21,1.79]:ring('Pump horizontal retaining band',.60,.043,'gold',(0,y,0),'y')
for s in [-1,1]:curve('Pump water inlet '+str(s),[(s*.51,1.43,0),(s*.88,1.44,0),(s*1.11,1.18,0),(s*1.11,.08,0)],.13,'dark')
ring('Front inspection portal',.34,.055,'gold',(0,1.05,.586));sphere('Pump dark glass',(0,1.05,.60),(.275,.275,.04),'ink')
for j in range(7):box('Pressure bar '+str(j),(-.18+j*.06,1.01+j*.016,.65),(.018,.13+j*.018,.015),'cyan',.002)
bolt_ring('Pump portal bolt ',.41,1.05,.54,12)
rod('Pump release stem',(0,2.03,0),(0,2.41,0),.07,'gold')
ring('Pump hand wheel',.30,.039,'robe',(0,2.43,0),'y')
for i in range(5):
    a=i/5*TAU;rod('Pump handwheel spoke',(0,2.43,0),(math.cos(a)*.30,2.43,math.sin(a)*.30),.025,'robe')

module('star_globe')
lathe('Instrument carved base',[(.7,0),(.70,.15),(.51,.3),(.20,.52),(.17,1.46),(.31,1.6)],'dark',n=32,flutes=12)
for radius in [.75,.91,1.08]:ring('Graduated spherical band',radius,.028,'gold',(0,2.05,0),n=64)
for i in range(4):
    pts=[]
    for j in range(25):
        a=j/24*TAU;pts.append((math.cos(a)*.94*math.cos(i*.72),2.05+math.sin(a)*.94,math.cos(a)*.94*math.sin(i*.72)))
    curve('Orbital meridian '+str(i),pts,.018,'steel')
for i in range(32):
    a=i/32*TAU;r=.91
    rod('Degree graduation '+str(i),(math.cos(a)*(r-.035),2.05+math.sin(a)*(r-.035),.04),(math.cos(a)*(r+.055),2.05+math.sin(a)*(r+.055),.04),.007,'paper',n=6)
sphere('Instrument luminous focal lens',(0,2.05,0),(.20,.20,.20),'cyan')

# Ten thematic actor attachments. Their proportions are authored around the
# existing gameplay pivots, so every impact/attack animation remains intact.
module('boss_golem')
for i in range(9):
    a=i/9*TAU;r=.59
    x=math.cos(a)*r;y=math.sin(a)*r
    panel('Carved core escutcheon '+str(i),[(x*.72,y*.72,.035),(x-y*.20,y+x*.20,.04),(x*1.23,y*1.23,0),(x+y*.20,y-x*.20,.04)],.10,'edge')
ring('Core engraved brass circlet',.55,.025,'gold')
for i in range(12):
    a=i/12*TAU;rod('Fracture glow '+str(i),(math.cos(a)*.46,math.sin(a)*.46,.08),(math.cos(a+.05)*.64,math.sin(a+.05)*.64,.02),.009,'violet',n=6)

module('boss_duelist')
panel('Forged mirror breast crest',[(-.48,.47,0),(-.36,-.18,.13),(0,-.49,.20),(.36,-.18,.13),(.48,.47,0),(0,.29,.09)],.055,'steel')
for s in [-1,1]:
    curve('Mirror relief trim '+str(s),[(s*.39,.37,.07),(s*.28,.02,.18),(0,-.35,.26)],.016,'gold')
    panel('Inlaid mirror facet '+str(s),[(s*.06,.21,.19),(s*.31,.30,.13),(s*.23,-.02,.23),(s*.04,-.25,.25)],.016,'cyan',.005)
for i in range(5):box('Central breast engraving',(0,.19-i*.09,.255),(.065,.02,.017),'ink',.003)

module('boss_cantor')
lathe('Folded fungal crown',[(.02,.47),(.26,.45),(.58,.35),(.87,.16),(.94,.06),(.90,-.015),(.55,.07),(.14,.18)],'robe',n=48,flutes=12)
for i in range(36):
    a=i/36*TAU
    curve('Fine underside fungal gill '+str(i),[(math.cos(a)*.16,.18,math.sin(a)*.16),(math.cos(a)*.46,.11,math.sin(a)*.46),(math.cos(a)*.89,.005,math.sin(a)*.89)],.008,'paper' if i%4 else 'cyan')
for i in range(12):
    a=i/12*TAU;r=.47+(i%3)*.10;sphere('Dew pearl on fungal skin',(math.cos(a)*r,.31-(r-.47)*.50,math.sin(a)*r),(.033,.018,.045),'moss')

module('boss_warden')
for r,thick,ma in [(.44,.045,'dark'),(.36,.025,'gold'),(.27,.03,'steel')]:ring('Induction turbine concentric housing',r,thick,ma)
for i in range(14):
    a=i/14*TAU
    panel('Curved turbine stator vane '+str(i),[(math.cos(a)*.13,math.sin(a)*.13,.07),(math.cos(a+.18)*.30,math.sin(a+.18)*.30,.05),(math.cos(a+.32)*.32,math.sin(a+.32)*.32,.03),(math.cos(a+.15)*.16,math.sin(a+.15)*.16,.09)],.014,'steel',.004)
sphere('Induction lens',(0,0,.02),(.15,.15,.10),'cyan');bolt_ring('Turbine bolt ',.39,0,.055,12)

module('boss_weaver')
ring('Scripture reliquary frame',.68,.027,'gold')
for i in range(8):
    a=i/8*TAU;x=math.cos(a)*.70;y=math.sin(a)*.70
    panel('Layered floating folio '+str(i),[(x-.095,y+.18,.03),(x+.095,y+.18,.04),(x+.12,y-.17,.07),(x-.09,y-.22,.09)],.009,'paper',.003)
    for row in range(4):box('Folio ink line',(x,y+.10-row*.061,.075),(.11-row%2*.026,.009,.009),'ink',.001)
    rod('Folio sewn binding',(x-.074,y+.14,.083),(x-.074,y-.17,.083),.007,'gold',n=6)

module('boss_tide')
for r,t,ma in [(.65,.056,'dark'),(.55,.026,'gold'),(.47,.03,'steel')]:ring('Pressure seal machined ring',r,t,ma)
for i in range(8):
    a=i/8*TAU
    rod('Shaped handwheel spoke',(math.cos(a)*.13,math.sin(a)*.13,.08),(math.cos(a+.10)*.49,math.sin(a+.10)*.49,.06),.035,'gold')
bolt_ring('Pressure seal hex bolt ',.60,0,.03,16)
rod('Hand wheel recessed hub',(0,0,0),(0,0,.15),.145,'dark',n=24)
panel('Pressure dial needle',[(-.035,-.05,.17),(.02,-.09,.17),(.13,.22,.17)],.015,'cyan',.002)

module('boss_furnace')
panel('Forged furnace firebox',[(-.67,-.65,0),(.67,-.65,0),(.63,.52,0),(0,.77,0),(-.63,.52,0)],.12,'gold')
panel('Recessed ember glass',[(-.54,-.54,.04),(.54,-.54,.04),(.50,.42,.04),(0,.60,.04),(-.50,.42,.04)],.03,'amber')
for i in range(8):
    x=-.45+i*.13;rod('Curved iron firebox rib '+str(i),(x,-.56,.13),(x,.42,.13),.023,'dark',n=12)
for y in [-.49,.02,.4]:rod('Firebox crossbrace',(-.53,y,.16),(.53,y,.16),.025,'steel')
for s in [-1,1]:
    for y in [-.44,.34]:rod('Firebox hinge',(s*.63,y-.09,.13),(s*.63,y+.09,.13),.055,'dark')

module('boss_orrery')
for r in [.48,.63,.78]:ring('Fine graduated astrolabe ring',r,.018,'gold',n=64)
for i in range(48):
    a=i/48*TAU;r=.78;end=.71 if i%4==0 else .745
    rod('Astrolabe index '+str(i),(math.cos(a)*r,math.sin(a)*r,.01),(math.cos(a)*end,math.sin(a)*end,.01),.005,'paper',n=6)
for i in range(6):
    a=i/6*TAU
    curve('Sextant pierced web '+str(i),[(0,0,0),(math.cos(a+.2)*.32,math.sin(a+.2)*.32,0),(math.cos(a)*.63,math.sin(a)*.63,0)],.012,'steel')

module('boss_arbiter')
panel('Blind executor porcelain mask',[(-.28,.30,0),(-.27,-.04,.07),(-.15,-.29,.14),(0,-.40,.17),(.15,-.29,.14),(.27,-.04,.07),(.28,.30,0)],.055,'paper')
panel('Mechanical blindfold',[(-.30,.19,.04),(.30,.19,.04),(.30,.055,.13),(-.30,.055,.13)],.025,'robe')
for s in [-1,1]:curve('Mask gold tear seam '+str(s),[(s*.18,.02,.12),(s*.17,-.14,.15),(s*.07,-.28,.19)],.006,'gold')
rod('Executor mouth seal',(-.065,-.20,.185),(.065,-.20,.185),.005,'ink',n=6)

module('boss_final')
for i in range(8):
    a=i/8*TAU
    curve('Crown structural rib '+str(i),[(math.cos(a)*.56,0,math.sin(a)*.56),(math.cos(a)*.86,.28,math.sin(a)*.86),(math.cos(a)*.72,.86,math.sin(a)*.72),(math.cos(a)*.47,1.24,math.sin(a)*.47)],.025,'gold')
    sphere('Crown ward at rib '+str(i),(math.cos(a)*.70,.80,math.sin(a)*.70),(.065,.13,.065),'violet')
for y,r in [(0,.57),(.30,.84),(.78,.73)]:ring('Crown pierced horizontal tier',r,.023,'steel',(0,y,0),'y')
for s in [-1,1]:panel('Central authority crest '+str(s),[(s*.05,.17,.61),(s*.29,.37,.79),(s*.23,.62,.76),(s*.10,.76,.71)],.025,'paper')

# Fix normals once, keep editable bevels in the source file.
for o in OBJECTS:
    if o.type=='MESH':
        bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(o.data);bm.free()
bpy.ops.object.select_all(action='DESELECT')
for o in [*MODULES.values(),*OBJECTS]:o.select_set(True)
bpy.context.view_layer.objects.active=next(iter(MODULES.values()))
sys.path.insert(0,str(Path(__file__).resolve().parent))
from export_batched import export_batched
export_batched(GLB,[*MODULES.values(),*OBJECTS])

# A legible contact sheet in the saved .blend makes every module reviewable.
for o in MODULES.values():o.hide_render=True
gallery=[]
for idx,(name,prototype) in enumerate(MODULES.items()):
    row=idx//5;col=idx%5
    holder=bpy.data.objects.new('DISPLAY / '+name,None);bpy.context.collection.objects.link(holder)
    holder.location=xyz(((col-2)*4.2,0,-row*6.4))
    factor=.70 if name=='ruin_arch' else .78 if name=='terrace_segment' else 1
    holder.scale=(factor,factor,factor);gallery.append(holder)
    for child in list(prototype.children):
        clone=child.copy();clone.data=child.data;clone.parent=holder;bpy.context.collection.objects.link(clone);clone.hide_render=False
    bpy.context.view_layer.update()
    corners=[clone.matrix_world@Vector(v) for clone in holder.children for v in clone.bound_box]
    if corners:
        holder.location.x+=(col-2)*4.2-(min(v.x for v in corners)+max(v.x for v in corners))*.5
        holder.location.z+=.035-min(v.z for v in corners)
    font=bpy.data.curves.new('Module label','FONT');font.body=name.replace('boss_','').replace('_',' ');font.size=.18;font.align_x='CENTER'
    label=bpy.data.objects.new('LABEL / '+name,font);bpy.context.collection.objects.link(label);label.location=xyz(((col-2)*4.2,.06,-row*6.4+1.45));label.rotation_euler=(math.pi/2,0,0);label.data.materials.append(M['paper'])
for o in OBJECTS:o.hide_render=True
floor_mat=mat('Studio floor',(.017,.025,.034),.15,.7)
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.09));bpy.context.object.data.materials.append(floor_mat)
def area(name,p,power,size,c):
    d=bpy.data.lights.new(name,'AREA');d.energy=power;d.size=size;d.color=c
    o=bpy.data.objects.new(name,d);bpy.context.collection.objects.link(o);o.location=xyz(p);o.rotation_euler=(xyz((0,1,-8))-o.location).to_track_quat('-Z','Y').to_euler()
area('Large key',(-8,15,4),2200,12,(.78,.87,1));area('Warm side',(9,9,-9),1500,10,(1,.76,.48));area('Cool rear',(0,10,-24),1900,9,(.48,.72,1))
d=bpy.data.cameras.new('Gallery camera');d.type='ORTHO';d.ortho_scale=27
cam=bpy.data.objects.new('Gallery camera',d);bpy.context.collection.objects.link(cam)
cam.location=xyz((0,36,22));cam.rotation_euler=(xyz((0,1,-9))-cam.location).to_track_quat('-Z','Y').to_euler()
scene=bpy.context.scene;scene.camera=cam;scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=True
scene.render.resolution_x=1800;scene.render.resolution_y=1500;scene.render.resolution_percentage=100
scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.08,.11,.16,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.35
scene.view_settings.view_transform='AgX';scene.render.image_settings.file_format='PNG';scene.render.filepath=str(OUT/'detail-kit-gallery.png')
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'grande-detail-kit.blend'))
bpy.ops.render.render(write_still=True)
binary=GLB.read_bytes();doc=json.loads(binary[20:20+int.from_bytes(binary[12:16],'little')])
manifest={'version':'3.7','modules':list(MODULES),'module_count':len(MODULES),'source_objects':len(OBJECTS),'materials':len(M),'runtime_triangles':sum(doc['accessors'][p['indices']]['count']//3 for m in doc['meshes'] for p in m['primitives']),'runtime_meshes':len(doc['meshes']),'glb_bytes':len(binary),'method':'Authored Blender profile meshes, curved masonry, lathed and fluted objects, beveled sheet metal, inscriptions, gills and graduated mechanical rings. No external textures.'}
(OUT/'manifest.json').write_text(json.dumps(manifest,indent=2,ensure_ascii=False),encoding='utf8')
print('DETAIL_KIT_MANIFEST '+json.dumps(manifest));print('DETAIL_KIT_COMPLETE')
