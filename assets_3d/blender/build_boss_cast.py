"""Grande: ten complete, articulated bosses with authored Blender/NLA clips.

Run in Blender 5.2 background mode. Geometry is authored in game coordinates
(X right, Y up, Z front), converted to Blender coordinates at the boundary.
Each rigid joint is batched by material, without merging across animated joints.
The GLB is checked after export: thirty clips, no cross-character channels.
"""
import bpy
import bmesh
import math
import json
import struct
import sys
from pathlib import Path
from collections import defaultdict
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'assets_3d' / 'boss-cast'
GLB = ROOT / 'public' / 'models' / 'grande-boss-cast.glb'
OUT.mkdir(parents=True, exist_ok=True)
GLB.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.context.preferences.filepaths.save_version = 0
TAU = math.tau
FPS = 30
scene = bpy.context.scene
scene.render.fps = FPS
BUFFERS = {}
JOINTS = {}
CAST = {}
CURRENT = None

def xyz(v): return Vector((v[0], -v[2], v[1]))
def linear(c): return c / 12.92 if c <= .04045 else ((c + .055) / 1.055) ** 2.4
def material(name, color, metal=0, rough=.55, emission=0):
    c = [linear(int(color[i:i+2], 16)/255) for i in (1,3,5)]
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*c, 1)
    m.use_nodes = True
    bs = m.node_tree.nodes.get('Principled BSDF')
    bs.inputs['Base Color'].default_value = (*c, 1)
    bs.inputs['Metallic'].default_value = metal
    bs.inputs['Roughness'].default_value = rough
    if emission:
        bs.inputs['Emission Color'].default_value = (*c, 1)
        bs.inputs['Emission Strength'].default_value = emission
    return m

M = {
    'dark': material('Obsidian recessed mechanisms', '#233344', .7, .42),
    'black': material('Deep joints and eye sockets', '#121b2a', .4, .48),
    'steel': material('Brushed blue silver', '#93a9b7', .8, .32),
    'gold': material('Weathered engraved brass', '#c3a368', .75, .35),
    'stone': material('Basalt rock planes', '#59627d', .12, .85),
    'stoneEdge': material('Fractured granite edges', '#8c91aa', .1, .78),
    'violet': material('Amethyst crystal facets', '#9e64dd', .4, .24),
    'purpleGlow': material('Amethyst inner glow', '#deb0ff', .2, .3, 1.8),
    'teal': material('Mirror knight enamel', '#347888', .66, .32),
    'mirror': material('Pale mirror blade', '#bde3dd', .9, .19),
    'cyan': material('Jade arcane light', '#86fff0', .25, .28, 1.8),
    'robe': material('Fungal indigo velvet', '#4e3f62', .02, .91),
    'plum': material('Fungal violet cap', '#97628c', .08, .75),
    'ivory': material('Ivory masks and parchment', '#e4d8bd', .04, .78),
    'moss': material('Fungal green ridges', '#77b6a1', .04, .66),
    'green': material('Luminous fungal spores', '#adffce', .1, .34, 1.5),
    'blue': material('Lightning glass', '#b4e5ff', .22, .22, 1.8),
    'paper': material('Aged book parchment', '#c7b391', .01, .88),
    'brown': material('Leather and dark bronze', '#574840', .18, .72),
    'copper': material('Pressure vessel copper', '#ae7b59', .71, .39),
    'sea': material('Deep sea enamel', '#346b72', .55, .42),
    'ember': material('Radiant furnace ember', '#ffa459', .16, .31, 2),
    'iron': material('Cast iron furnace shell', '#403b40', .67, .5),
    'red': material('Oxide and lacquer', '#854d48', .45, .46),
    'wine': material('Arbiter wine robes', '#733e59', .06, .9),
    'rose': material('Final control rose light', '#ffc2dc', .22, .25, 1.8),
    'azure': material('Observatory celestial blue', '#abcaff', .3, .26, 1.6),
}

def joint(name, parent=None, at=(0,0,0), role=None):
    name = f'{CURRENT}_{name}' if name != f'boss_{CURRENT}' else name
    o = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(o)
    o.empty_display_type = 'PLAIN_AXES'
    o.empty_display_size = .18
    o['rest_game_origin'] = list(at)
    o['grande_joint'] = role or name.split('_')[-1]
    if parent:
        o.parent = parent
        origin = Vector(parent['rest_game_origin'])
        o.location = xyz(Vector(at) - origin)
    else: o.location = xyz(at)
    JOINTS[name] = o
    return o

def start(id, name, concept):
    global CURRENT
    CURRENT = id
    r = joint(f'boss_{id}')
    r['grande_boss'] = id
    r['authoring'] = 'Complete Blender articulated boss / 3.8'
    r['front_axis'] = '+Z'
    body = joint('body', r, (0,2,0), 'body')
    CAST[id] = {'root': r, 'body': body, 'name': name, 'concept': concept, 'joints': []}
    return body

def surf(p, name, vertices, faces, mat, smooth=False):
    key = (p, mat, smooth)
    if key not in BUFFERS: BUFFERS[key] = [[], []]
    vv, ff = BUFFERS[key]
    base = len(vv)
    org = Vector(p['rest_game_origin'])
    vv.extend([xyz(Vector(v) - org) for v in vertices])
    ff.extend([tuple(base+i for i in f) for f in faces])

def panel(p, points, depth, mat, z=0, bevel=.035):
    # Authored chamfered outline: front/back bevel rings, side walls, filled faces.
    cx = sum(q[0] for q in points)/len(points)
    cy = sum(q[1] for q in points)/len(points)
    n = len(points)
    verts=[]
    for layer, zz in [(0,z-depth/2),(1,z-depth/2+bevel),(1,z+depth/2-bevel),(0,z+depth/2)]:
        for x,y in points:
            d=math.hypot(x-cx,y-cy)
            k=max(.5,1-bevel/max(d,.01)) if layer==0 else 1
            verts.append((cx+(x-cx)*k,cy+(y-cy)*k,zz))
    faces=[tuple(reversed(range(n))),tuple(3*n+i for i in range(n))]
    for row in range(3):
        for i in range(n): faces.append((row*n+i,row*n+(i+1)%n,(row+1)*n+(i+1)%n,(row+1)*n+i))
    surf(p,'shaped plate',verts,faces,mat)

def box(p, at, size, mat, chamfer=.05):
    x,y,z=at; a,b,c=[v/2 for v in size]; q=min(chamfer,a*.3,b*.3,c*.3)
    pts=[(x-a+q,y-b),(x+a-q,y-b),(x+a,y-b+q),(x+a,y+b-q),(x+a-q,y+b),(x-a+q,y+b),(x-a,y+b-q),(x-a,y-b+q)]
    panel(p,pts,size[2],mat,z,min(q,c*.45))

def rod(p, a, b, r, mat, r2=None, n=12):
    av,bv=Vector(a),Vector(b); axis=(bv-av).normalized()
    side=axis.cross(Vector((0,1,0)))
    if side.length<.01: side=axis.cross(Vector((1,0,0)))
    side.normalize(); up=axis.cross(side).normalized()
    verts=[]
    for c,rr in [(av,r),(bv,r if r2 is None else r2)]:
        for i in range(n): verts.append(c+rr*(math.cos(i/n*TAU)*side+math.sin(i/n*TAU)*up))
    faces=[tuple(reversed(range(n))),tuple(n+i for i in range(n))]
    faces.extend((i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n))
    surf(p,'tapered solid',verts,faces,mat,True)

def orb(p, at, scale, mat, n=16, rings=10, faceted=False):
    verts=[]
    for j in range(rings+1):
        a=-math.pi/2+j/rings*math.pi
        for i in range(n):
            b=i/n*TAU
            verts.append((at[0]+math.cos(a)*math.cos(b)*scale[0],at[1]+math.sin(a)*scale[1],at[2]+math.cos(a)*math.sin(b)*scale[2]))
    faces=[]
    for j in range(rings):
        for i in range(n): faces.append((j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i))
    surf(p,'ellipsoid',verts,faces,mat,not faceted)

def lathe(p, profile, mat, at=(0,0,0), n=32, pleats=0):
    verts=[]
    for r,y in profile:
        for i in range(n):
            a=i/n*TAU; rr=r*(1+.065*math.cos(a*pleats)) if pleats else r
            verts.append((at[0]+math.cos(a)*rr,at[1]+y,at[2]+math.sin(a)*rr))
    faces=[]
    for j in range(len(profile)-1):
        for i in range(n): faces.append((j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i))
    faces += [tuple(reversed(range(n))),tuple((len(profile)-1)*n+i for i in range(n))]
    surf(p,'profiled shell',verts,faces,mat,True)

def ring(p, at, r, tube, mat, axis='z', arc=TAU, start=0, n=48):
    verts=[]; sides=6
    for i in range(n+1):
        a=start+i/n*arc
        for j in range(sides):
            b=j/sides*TAU; rr=r+tube*math.cos(b)
            v=(rr*math.cos(a),rr*math.sin(a),tube*math.sin(b))
            if axis=='y':v=(v[0],v[2],v[1])
            if axis=='x':v=(v[2],v[1],v[0])
            verts.append(tuple(v[k]+at[k] for k in range(3)))
    faces=[]
    for i in range(n):
        for j in range(sides): faces.append((i*sides+j,(i+1)*sides+j,(i+1)*sides+(j+1)%sides,i*sides+(j+1)%sides))
    surf(p,'ring segment',verts,faces,mat,True)

def tube(p, pts, r, mat):
    for a,b in zip(pts,pts[1:]): rod(p,a,b,r,mat,n=8)
    for at in pts[1:-1]: orb(p,at,(r,r,r),mat,n=8,rings=4)

def crystal(p, at, scale, mat, lean=0):
    x,y,z=at; a,h,d=scale
    verts=[(x+math.cos(i/6*TAU)*a,y+(.12 if i%2 else 0)*h,z+math.sin(i/6*TAU)*d) for i in range(6)]
    verts += [(x+math.cos(i/6*TAU)*a*.82+lean*.55,y+h*.65,z+math.sin(i/6*TAU)*d*.82) for i in range(6)]
    verts.append((x+lean,y+h,z)); faces=[tuple(reversed(range(6)))]
    for i in range(6):faces.extend([(i,(i+1)%6,(i+1)%6+6,i+6),(i+6,(i+1)%6+6,12)])
    surf(p,'cut crystal',verts,faces,mat)

def fingers(p, at, side, mat, count=3, length=.34):
    x,y,z=at
    for i in range(count):
        dx=(i-(count-1)/2)*.10
        tube(p,[(x+dx,y,z),(x+dx+side*.08,y-length*.6,z+.13),(x+dx+side*.06,y-length,z+.23)],.032,mat)

def mask(p, at, w, h, mat='ivory', eyes='cyan'):
    x,y,z=at
    panel(p,[(x-w,y+h*.42),(x+w,y+h*.42),(x+w*.82,y-h*.28),(x,y-h*.63),(x-w*.82,y-h*.28)],.11,mat,z)
    for s in [-1,1]:
        panel(p,[(x+s*.04,y+.025),(x+s*w*.80,y+.07),(x+s*w*.65,y-.03),(x+s*.04,y-.045)],.024,'black',z+.071,.004)
        rod(p,(x+s*.075,y+.005,z+.09),(x+s*w*.64,y+.033,z+.09),.012,eyes,n=6)
    panel(p,[(x-.035,y+.09),(x+.035,y+.09),(x+.05,y-.20),(x,y-.28),(x-.04,y-.17)],.09,mat,z+.08,.012)

def build_golem():
    b=start('golem','魔晶巨人','Asymmetric crystal-and-basalt siege giant, massive fists, exposed rib cage')
    for s in [-1,1]:
        leg=joint('leg_'+str(s),b,(s*.62,1.56,0),'leg')
        orb(leg,(s*.67,.25,.24),(.55,.25,.71),'stone',12,7,True)
        orb(leg,(s*.63,.79,.02),(.38,.58,.38),'stoneEdge',10,6,True)
        orb(leg,(s*.55,1.47,-.03),(.44,.50,.43),'stone',10,6,True)
        ring(leg,(s*.63,1.05,.07),.22,.052,'purpleGlow','y',n=16)
    orb(b,(0,1.96,0),(.78,.38,.5),'stone',12,7,True)
    orb(b,(0,2.87,-.31),(1.00,.89,.65),'stone',14,8,True)
    for s in [-1,1]:
        for j in range(3):
            panel(b,[(s*.19,2.4+j*.3),(s*.9,2.52+j*.3),(s*.97,2.75+j*.3),(s*.31,2.64+j*.3)],.28,'stoneEdge',.36)
        a=joint('arm_'+str(s),b,(s*1.04,3.33,-.05),'arm')
        orb(a,(s*1.16,3.27,-.02),(.61,.49,.53),'stone',12,7,True)
        orb(a,(s*1.36,2.75,.05),(.34,.49,.36),'stone',10,6,True)
        fore=joint('forearm_'+str(s),a,(s*1.48,2.31,.13),'forearm')
        orb(fore,(s*1.57,1.86,.24),(.54 if s<0 else .43,.57,.47),'stoneEdge',12,7,True)
        orb(fore,(s*1.61,1.4,.36),(.57 if s<0 else .46,.34,.45),'stone',12,7,True)
        for i in range(3):box(fore,(s*1.61+(i-1)*.24,1.2,.5),(.20,.33,.35),'stoneEdge')
        for i in range(3):crystal(a,(s*(.88+i*.25),3.56,-.18),(.19,.7-i*.10,.18),'violet',s*.26)
    core=joint('core',b,(0,2.93,.55),'core')
    core['grande_core']=True
    crystal(core,(0,2.43,.64),(.33,1.0,.26),'purpleGlow')
    ring(core,(0,2.93,.55),.48,.037,'gold',n=32)
    h=joint('head',b,(0,3.93,.06),'head')
    orb(h,(0,3.97,.01),(.44,.42,.40),'stone',12,8,True)
    panel(h,[(-.36,4.04),(.36,4.04),(.28,3.8),(0,3.67),(-.28,3.8)],.20,'stoneEdge',.33)
    for s in [-1,1]:box(h,(s*.17,4.01,.475),(.19,.052,.045),'purpleGlow',.009)
    crystal(h,(0,4.24,-.03),(.22,.52,.23),'violet',.09)
    for i in range(4):crystal(b,((i-1.5)*.36,3.32,-.79),(.22,.92-abs(i-1.5)*.16,.23),'violet',.12*(i-1.5))

def build_duelist():
    b=start('duelist','折镜刃卫','Long-legged mirror fencer, narrow waist, asymmetrical layered armor and hooked saber')
    for s in [-1,1]:
        leg=joint('leg_'+str(s),b,(s*.27,1.78,0),'leg')
        box(leg,(s*.28,.13,.22),(.39,.26,.71),'dark')
        rod(leg,(s*.28,.28,.04),(s*.25,1.80,0),.115,'dark')
        for j in range(3):panel(leg,[(s*.28-.17,.31+j*.17),(s*.28,.25+j*.17),(s*.28+.17,.31+j*.17),(s*.28+.14,.54+j*.17),(s*.28-.14,.54+j*.17)],.15,'teal',.16)
        orb(leg,(s*.27,.96,.07),(.155,.155,.16),'gold',12,6)
        panel(leg,[(s*.26-.18,1.1),(s*.26+.18,1.1),(s*.26+.15,1.71),(s*.26,1.84),(s*.26-.15,1.71)],.21,'teal',.03)
        skirt=joint('tasset_'+str(s),b,(s*.30,2.06,0),'cloth')
        panel(skirt,[(s*.12,2.10),(s*.57,2.07),(s*.72,1.44),(s*.38,1.30),(s*.24,1.58)],.15,'teal',.22)
    lathe(b,[(.24,1.84),(.21,2.31),(.43,2.67),(.58,2.87),(.36,3.07)],'dark',n=16)
    for j in range(4):panel(b,[(-.32-j*.035,2.15+j*.18),(0,2.06+j*.18),(.32+j*.035,2.15+j*.18),(.31+j*.035,2.33+j*.18),(0,2.21+j*.18),(-.31-j*.035,2.33+j*.18)],.17,'teal' if j%2 else 'gold',.23)
    crystal(b,(0,2.72,.39),(.12,.36,.09),'cyan')
    for s in [-1,1]:
        a=joint('arm_'+str(s),b,(s*.59,2.99,0),'arm')
        orb(a,(s*.59,2.99,0),(.2,.21,.22),'gold',12,7)
        panel(a,[(s*.4,3.1),(s*.66,3.30),(s*1.02,3.19),(s*.88,2.95),(s*.57,2.82)],.41,'teal',0)
        rod(a,(s*.67,2.85,0),(s*.79,2.34,.08),.095,'dark')
        f=joint('forearm_'+str(s),a,(s*.79,2.34,.08),'forearm')
        rod(f,(s*.79,2.34,.08),(s*.91,1.87,.31),.12,'teal',.095)
        box(f,(s*.91,1.82,.32),(.2,.24,.22),'dark')
        if s>0:
            w=joint('weapon',f,(.91,1.82,.32),'weapon')
            rod(w,(.9,1.55,.34),(.9,2.14,.34),.052,'dark')
            rod(w,(.63,2.11,.34),(1.21,2.12,.34),.043,'gold')
            panel(w,[(.82,2.13),(.75,2.94),(.9,3.55),(1.24,4.04),(1.67,4.25),(1.44,3.76),(1.28,3.14),(1.1,2.13)],.13,'gold',.32)
            panel(w,[(.87,2.2),(.82,2.95),(.97,3.54),(1.28,3.97),(1.53,4.12),(1.37,3.73),(1.20,3.12),(1.04,2.2)],.032,'mirror',.405,.009)
            rod(w,(.92,2.3,.432),(.94,3.2,.432),.016,'cyan',n=6)
        else:
            panel(f,[(-.9,2.2),(-1.29,2.42),(-1.55,2.08),(-1.13,1.71),(-.91,1.92)],.14,'mirror',.35)
    h=joint('head',b,(0,3.56,0),'head')
    rod(b,(0,3.02,0),(0,3.5,0),.12,'gold')
    orb(h,(0,3.54,0),(.27,.36,.25),'dark',16,10)
    mask(h,(0,3.55,.25),.22,.5,'steel','cyan')
    for s in [-1,1]:panel(h,[(s*.20,3.66),(s*.34,3.6),(s*.45,4.17),(s*.26,3.95)],.10,'gold',-.01)
    fans=joint('mirror_fan',b,(0,2.88,-.5),'orbit')
    for s in [-1,1]:
        for i in range(2):
            x=s*(.67+i*.4);y=3.16-i*.59
            panel(fans,[(x,y-.4),(x+s*.24,y),(x,y+.42),(x-s*.17,y)],.08,'gold',-.5)
            panel(fans,[(x,y-.3),(x+s*.16,y),(x,y+.31),(x-s*.10,y)],.025,'mirror',-.44,.006)

def build_cantor():
    b=start('cantor','孢冠司祭','Floating pleated fungal bell robe, living root arms, large gilled cap and porcelain mask')
    lathe(b,[(.36,.54),(.94,.7),(.98,.91),(.72,1.27),(.53,1.93),(.38,2.64),(.52,2.85)],'robe',n=48,pleats=12)
    for i in range(10):
        a=i/10*TAU; s=math.sin(a);c=math.cos(a)
        tube(b,[(s*.36,2.73,c*.36),(s*.54,1.8,c*.54),(s*.91,.85,c*.91)],.022,'moss')
        t=joint('root_'+str(i),b,(s*.66,.88,c*.66),'tendril')
        tube(t,[(s*.66,.88,c*.66),(s*.83,.44,c*.83),(s*1.1,.16,c*1.1),(s*1.25,.25,c*1.25)],.048,'moss')
    for s in [-1,1]:
        a=joint('arm_'+str(s),b,(s*.47,2.73,0),'arm')
        tube(a,[(s*.47,2.73,0),(s*.76,2.42,.12),(s*1.01,2.52,.37)],.085,'ivory')
        lathe(a,[(.26,1.81),(.34,1.91),(.22,2.21),(.10,2.56)],'plum',at=(s*.76,0,.08),n=24,pleats=8)
        fingers(a,(s*1.02,2.52,.38),s,'ivory',4,.28)
        orb(a,(s*1.03,2.84,.40),(.16,.20,.16),'green')
    rod(b,(0,2.72,0),(0,3.29,.03),.13,'moss')
    h=joint('head',b,(0,3.31,.03),'head')
    orb(h,(0,3.16,.06),(.28,.39,.29),'robe')
    mask(h,(0,3.12,.36),.23,.64,'ivory','green')
    cap=joint('cap',h,(0,3.6,0),'crown')
    lathe(cap,[(.03,3.94),(.33,3.91),(.81,3.75),(1.21,3.52),(1.23,3.44),(.98,3.48),(.42,3.59),(.1,3.62)],'plum',n=48)
    for i in range(28):
        a=i/28*TAU
        tube(cap,[(math.sin(a)*.28,3.61,math.cos(a)*.28),(math.sin(a)*.8,3.49,math.cos(a)*.8),(math.sin(a)*1.17,3.44,math.cos(a)*1.17)],.014,'green' if i%4==0 else 'moss')
    for i in range(7):
        a=i/7*TAU;x=math.sin(a)*.62;z=math.cos(a)*.62;y=3.79+(i%3)*.12
        rod(cap,(x,3.7,z),(x*1.11,y+.28,z*1.11),.045,'moss')
        orb(cap,(x*1.11,y+.28,z*1.11),(.19,.095,.19),'green' if i%2 else 'ivory',16,8)
    crystal(b,(0,2.19,.53),(.15,.41,.11),'green')

def build_warden():
    b=start('warden','雷脊看守','Low mechanical hound, four digitigrade legs, arched conductor spine and articulated metal jaw')
    orb(b,(0,1.65,-.2),(.76,.57,1.24),'dark',24,14)
    for s in [-1,1]:
        for j,z in enumerate([.72,-.89]):
            leg=joint('leg_'+str(s)+'_'+str(j),b,(s*.69,1.76,z),'arm' if j==0 else 'leg')
            orb(leg,(s*.78,1.64,z),(.29,.32,.30),'gold')
            rod(leg,(s*.76,1.6,z),(s*1.08,.97,z-.15),.18,'dark',.14)
            knee=joint('knee_'+str(s)+'_'+str(j),leg,(s*1.08,.97,z-.15),'forearm')
            orb(knee,(s*1.08,.97,z-.15),(.18,.19,.18),'steel')
            rod(knee,(s*1.08,.92,z-.15),(s*.98,.27,z+.13),.13,'dark',.17)
            box(knee,(s*.98,.14,z+.26),(.45,.27,.61),'steel')
            for k in range(3):rod(knee,(s*.98+(k-1)*.13,.16,z+.41),(s*.98+(k-1)*.13,.08,z+.71),.07,'gold',.018,8)
        for j in range(5):
            z=-1.03+j*.43
            panel(b,[(s*.39,1.74),(s*.86,1.64),(s*.9,2.08),(s*.51,2.23)],.23,'steel' if j%2 else 'dark',z)
    spine=joint('lightning_spine',b,(0,2.13,-.25),'crown')
    for i in range(4):
        z=-1.05+i*.55; y=2.8+.44*math.sin(i/3*math.pi)
        rod(spine,(0,2.08,z),(0,y,z),.095,'gold')
        for j in range(3):ring(spine,(0,2.30+j*.17,z),.18,.052,'dark','y',n=20)
        crystal(spine,(0,y-.1,z),(.12,.40,.13),'blue')
    h=joint('head',b,(0,1.98,1.00),'head')
    orb(h,(0,1.97,1.12),(.48,.37,.48),'dark',18,10)
    box(h,(0,1.94,1.58),(.57,.33,.63),'steel')
    for s in [-1,1]:
        panel(h,[(s*.22,2.11),(s*.44,2.32),(s*.5,2.79),(s*.24,2.51)],.20,'gold',1.1)
        box(h,(s*.31,2.1,1.48),(.12,.075,.17),'blue',.01)
    jaw=joint('jaw',h,(0,1.74,1.34),'jaw')
    box(jaw,(0,1.67,1.63),(.60,.18,.58),'dark')
    for s in [-1,1]:
        for i in range(3):crystal(jaw,(s*.25,1.73,1.43+i*.17),(.04,.13,.045),'steel')
    tail=joint('tail',b,(0,1.69,-1.24),'tendril')
    tube(tail,[(0,1.69,-1.24),(.15,1.9,-1.64),(.33,2.2,-1.91),(.48,2.32,-2.03)],.082,'dark')
    crystal(tail,(.48,2.21,-2.03),(.13,.38,.12),'blue',.12)

def build_weaver():
    b=start('weaver','缚页织者','Six-legged manuscript arachnid, book abdomen, quill arms and layered parchment mantle')
    orb(b,(0,1.55,-.3),(.63,.56,.83),'brown',20,12)
    for s in [-1,1]:
        for j in range(3):
            z=-.72+j*.66; endz=z+(j-1)*.45
            l=joint('leg_'+str(s)+'_'+str(j),b,(s*.47,1.73,z),'leg')
            rod(l,(s*.47,1.73,z),(s*1.15,2.05,endz),.085,'gold')
            orb(l,(s*1.15,2.05,endz),(.14,.14,.14),'dark')
            rod(l,(s*1.15,2.05,endz),(s*1.69,.19,endz+.15),.10,'dark',.027)
            rod(l,(s*1.69,.19,endz+.15),(s*1.84,.04,endz+.36),.045,'gold',.01)
    lathe(b,[(.48,1.7),(.28,2.34),(.50,2.73),(.30,2.9)],'brown',n=20)
    for s in [-1,1]:
        for j in range(4):
            x=s*(.30+j*.15)
            panel(b,[(x,2.9-j*.12),(x+s*.30,2.88-j*.12),(x+s*.45,1.89-j*.11),(x+s*.12,2.07-j*.11)],.055,'paper' if j%2 else 'ivory',-.16-j*.09,.01)
        a=joint('arm_'+str(s),b,(s*.46,2.66,.1),'arm')
        rod(a,(s*.46,2.66,.1),(s*.81,2.33,.23),.074,'gold')
        rod(a,(s*.81,2.33,.23),(s*1.04,2.51,.55),.064,'brown')
        fingers(a,(s*1.04,2.51,.55),s,'gold',3,.27)
        if s>0:
            rod(a,(1.05,2.17,.66),(1.24,3.39,.54),.032,'gold')
            panel(a,[(1.23,2.81),(1.56,3.16),(1.37,3.59),(1.17,3.20)],.055,'ivory',.55,.012)
            for i in range(5):rod(a,(1.23,2.99+i*.08,.59),(1.45-i*.027,3.12+i*.075,.59),.008,'brown',n=4)
        else:
            book=joint('book',a,(-1.04,2.47,.54),'weapon')
            box(book,(-1.05,2.54,.68),(.64,.58,.11),'brown')
            box(book,(-1.05,2.56,.76),(.57,.51,.05),'ivory',.02)
            for i in range(5):rod(book,(-1.27,2.38+i*.075,.799),(-.9+(i%2)*.1,2.38+i*.075,.799),.007,'brown',n=4)
    h=joint('head',b,(0,3.17,.08),'head')
    orb(h,(0,3.16,.06),(.24,.31,.23),'dark')
    mask(h,(0,3.15,.28),.20,.52,'paper','purpleGlow')
    for i in range(7):
        x=(i-3)*.17;y=3.45+(.23 if i%2 else .08)
        panel(h,[(x-.065,3.34),(x+.065,3.34),(x+.10,y+.19),(x,y+.30),(x-.1,y+.19)],.055,'paper' if i%2 else 'gold',-.13,.01)
    for j in range(4):box(b,(0,1.50+j*.13,-.98),(.84-j*.1,.10,.37),'brown' if j%2 else 'paper',.02)

def build_tide():
    b=start('tide','潮闸监守','Circular pressure-bulkhead torso, exposed piston legs, nozzle cannon and anchored manipulator')
    for s in [-1,1]:
        l=joint('leg_'+str(s),b,(s*.62,1.51,-.07),'leg')
        rod(l,(s*.60,1.47,-.05),(s*.77,.60,.13),.21,'dark')
        rod(l,(s*.62,1.33,.22),(s*.80,.45,.34),.087,'steel')
        box(l,(s*.79,.20,.27),(.75,.39,.87),'sea')
        ring(l,(s*.65,.94,.26),.24,.07,'copper',n=24)
    orb(b,(0,2.38,-.07),(1.04,1.02,.59),'sea',32,18)
    ring(b,(0,2.38,.39),.96,.12,'copper',n=48)
    ring(b,(0,2.38,.53),.78,.034,'steel',n=40)
    for i in range(8):
        a=i/8*TAU;box(b,(math.sin(a)*.87,2.38+math.cos(a)*.87,.47),(.10,.1,.07),'gold',.02)
    wheel=joint('valve_wheel',b,(0,2.38,.64),'orbit')
    ring(wheel,(0,2.38,.64),.57,.077,'gold',n=40)
    for i in range(6):
        a=i/6*TAU;rod(wheel,(0,2.38,.64),(math.sin(a)*.57,2.38+math.cos(a)*.57,.64),.039,'gold')
    orb(wheel,(0,2.38,.68),(.20,.20,.09),'cyan')
    for s in [-1,1]:
        tube(b,[(s*.71,2.9,-.39),(s*.92,3.5,-.44),(s*.63,3.65,-.48),(s*.38,3.48,-.48)],.106,'copper')
        a=joint('arm_'+str(s),b,(s*1.01,2.89,0),'arm')
        orb(a,(s*1.02,2.88,0),(.24,.24,.25),'steel')
        rod(a,(s*1.02,2.88,0),(s*1.38,2.27,.19),.19,'dark')
        f=joint('forearm_'+str(s),a,(s*1.38,2.27,.19),'forearm')
        if s>0:
            rod(f,(1.38,2.28,.13),(1.43,2.2,1.11),.28,'sea')
            ring(f,(1.43,2.2,1.1),.29,.065,'copper',n=28)
            orb(f,(1.43,2.2,1.14),(.20,.20,.035),'black')
            ring(f,(1.43,2.2,1.17),.15,.023,'cyan',n=24)
        else:
            rod(f,(-1.38,2.27,.19),(-1.4,1.57,.36),.16,'sea')
            rod(f,(-1.41,1.51,.36),(-1.41,2.05,.36),.065,'gold')
            ring(f,(-1.41,1.51,.36),.35,.10,'dark',arc=math.pi,start=math.pi,n=24)
            for x in [-1.76,-1.06]:crystal(f,(x,1.38,.36),(.08,.32,.08),'steel')
    h=joint('head',b,(0,3.49,.02),'head')
    box(h,(0,3.5,.01),(.81,.38,.58),'dark')
    box(h,(0,3.53,.33),(.54,.075,.045),'cyan',.01)
    ring(h,(0,3.53,.36),.16,.035,'copper',n=24)

def build_furnace():
    b=start('furnace','焚炉驮兽','Six-legged furnace carrier, deep combustion mouth, twin stacks and asymmetric industrial tool arms')
    for s in [-1,1]:
        for i in range(3):
            z=-.88+i*.80;l=joint('leg_'+str(s)+'_'+str(i),b,(s*.70,1.18,z),'leg')
            rod(l,(s*.70,1.18,z),(s*1.12,.75,z+.08),.15,'copper')
            rod(l,(s*1.12,.75,z+.08),(s*1.38,.18,z+.22),.19,'iron',.23)
            box(l,(s*1.40,.13,z+.29),(.53,.25,.58),'dark')
    lathe(b,[(.75,.82),(1.0,1.02),(1.02,1.96),(.91,2.43),(.63,2.69)],'iron',n=32)
    for y,r in [(1.02,1.01),(2.0,1.03),(2.47,.91)]:ring(b,(0,y,0),r,.078,'copper','y',n=40)
    panel(b,[(-.66,1.1),(.66,1.1),(.69,2.18),(0,2.57),(-.69,2.18)],.15,'copper',.79)
    panel(b,[(-.51,1.20),(.51,1.20),(.52,2.09),(0,2.38),(-.52,2.09)],.12,'black',.90)
    panel(b,[(-.43,1.27),(.43,1.27),(.43,2.02),(0,2.25),(-.43,2.02)],.06,'ember',.99)
    jaw=joint('fire_gate',b,(0,1.16,1.04),'jaw')
    for i in range(7):rod(jaw,((i-3)*.14,1.21,1.08),((i-3)*.14,2.03-abs(i-3)*.025,1.08),.035,'iron')
    for i,x in enumerate([-.43,.44]):
        rod(b,(x,2.48,-.24),(x,3.43+i*.29,-.24),.20,'iron')
        for y in [2.65,3.27+i*.29]:ring(b,(x,y,-.24),.23,.065,'copper','y',n=24)
        ring(b,(x,3.46+i*.29,-.24),.23,.064,'dark','y',n=24)
        orb(b,(x,3.43+i*.29,-.24),(.15,.018,.15),'ember')
    for s in [-1,1]:
        a=joint('arm_'+str(s),b,(s*.87,2.22,.05),'arm')
        orb(a,(s*.87,2.22,.05),(.23,.23,.25),'copper')
        rod(a,(s*.9,2.22,.05),(s*1.36,1.96,.4),.13,'steel')
        if s>0:
            rod(a,(1.36,1.96,.4),(1.4,1.96,1.14),.12,'copper')
            for x in [1.18,1.63]:tube(a,[(x,1.96,1.05),(x,1.64,1.16),(x,1.46,1.08)],.07,'steel')
        else:
            rod(a,(-1.36,1.96,.4),(-1.58,1.25,.65),.10,'dark')
            box(a,(-1.58,1.2,.65),(.64,.48,.53),'iron')
            box(a,(-1.58,1.2,.94),(.49,.33,.08),'ember')
    h=joint('head',b,(0,2.74,.50),'head')
    box(h,(0,2.74,.51),(.72,.28,.44),'dark')
    for s in [-1,1]:box(h,(s*.20,2.75,.75),(.15,.075,.038),'ember',.009)

def build_orrery():
    b=start('orrery','错星仪','Nonhumanoid suspended celestial gyroscope, tripod observatory pedestal and articulated lens array')
    for i in range(3):
        a=i/3*TAU; x=math.sin(a);z=math.cos(a)
        l=joint('leg_'+str(i),b,(x*.28,.82,z*.28),'leg')
        rod(l,(x*.28,.82,z*.28),(x*.89,.18,z*.89),.14,'gold',.10)
        box(l,(x*.91,.12,z*.91),(.38,.23,.43),'dark')
    lathe(b,[(.39,.20),(.53,.36),(.32,.74),(.20,.9),(.19,1.69)],'dark',n=24)
    for y in [.50,.80,1.45]:ring(b,(0,y,0),.28,.052,'gold','y',n=28)
    crystal(b,(0,1.46,0),(.24,.65,.24),'azure')
    h=joint('head',b,(0,2.70,0),'head')
    orb(h,(0,2.70,0),(.47,.47,.47),'azure',32,18)
    ring(h,(0,2.70,.31),.45,.062,'gold',n=40)
    orb(h,(0,2.70,.44),(.28,.28,.08),'black',20,12)
    orb(h,(0,2.70,.52),(.18,.18,.028),'azure',20,12)
    for i in range(3):
        r=1.12+i*.25;p=joint('orbit_'+str(i),b,(0,2.70,0),'orbit')
        ring(p,(0,2.70,0),r,.065,'gold' if i!=1 else 'steel',axis=['z','x','y'][i],n=64)
        ring(p,(0,2.70,0),r+.11,.021,'azure',axis=['z','x','y'][i],n=64)
        for j in range(16):
            a=j/16*TAU;x=r*math.cos(a);y=r*math.sin(a)
            pos=(x,y+2.7,0) if i==0 else (0,y+2.7,x) if i==1 else (x,2.7,y)
            orb(p,pos,(.055,.055,.055),'gold',8,4)
    for s in [-1,1]:
        a=joint('arm_'+str(s),b,(s*.86,2.55,0),'arm')
        rod(a,(s*.86,2.55,0),(s*1.55,2.39,.15),.07,'gold')
        rod(a,(s*1.55,2.39,-.12),(s*1.55,2.39,.62),.19,'dark')
        ring(a,(s*1.55,2.39,.64),.20,.052,'gold',n=24)
        orb(a,(s*1.55,2.39,.67),(.16,.16,.027),'azure')
        rod(a,(s*1.55,2.18,.13),(s*1.55,1.43,.13),.025,'gold')
        crystal(a,(s*1.55,1.12,.13),(.13,.38,.13),'steel')

def build_arbiter():
    b=start('arbiter','沉律裁决者','Blindfolded mitred magistrate, heavy pleated wine robe, suspended balance scales and broad execution blade')
    for s in [-1,1]:box(b,(s*.30,.11,.14),(.44,.22,.58),'dark')
    lathe(b,[(.80,.18),(.89,.34),(.68,1.05),(.47,1.83),(.36,2.06)],'wine',n=48,pleats=12)
    lathe(b,[(.36,1.91),(.52,2.33),(.63,2.86),(.4,3.05)],'dark',n=20)
    panel(b,[(-.49,2.90),(.49,2.90),(.31,2.22),(0,1.97),(-.31,2.22)],.10,'gold',.59)
    panel(b,[(-.29,2.80),(.29,2.80),(.20,2.28),(0,2.10),(-.20,2.28)],.045,'ivory',.66,.015)
    for i in range(4):box(b,(0,2.38+i*.09,.693),(.28+(i%2)*.08,.016,.012),'brown',.002)
    for s in [-1,1]:
        for i in range(3):
            x=s*(.25+i*.21)
            panel(b,[(x-.10,1.8),(x+.1,1.8),(x+s*.17,.44),(x+s*.04,.22),(x-s*.055,.40)],.035,'paper',.32-i*.1,.006)
        a=joint('arm_'+str(s),b,(s*.62,2.83,0),'arm')
        orb(a,(s*.67,2.82,0),(.31,.23,.33),'gold')
        rod(a,(s*.68,2.71,0),(s*.9,2.16,.2),.12,'dark')
        f=joint('forearm_'+str(s),a,(s*.9,2.16,.2),'forearm')
        rod(f,(s*.9,2.16,.2),(s*1.02,1.82,.43),.13,'steel')
        if s>0:
            w=joint('weapon',f,(1.02,1.83,.43),'weapon')
            rod(w,(1.02,1.76,.43),(1.02,2.23,.43),.065,'gold')
            rod(w,(.69,1.79,.43),(1.36,1.79,.43),.06,'gold')
            panel(w,[(.73,1.78),(1.31,1.78),(1.31,.38),(1.02,.09),(.73,.38)],.14,'steel',.43)
            panel(w,[(.99,1.63),(1.055,1.63),(1.055,.44),(1.02,.3),(.99,.44)],.025,'rose',.513,.007)
        else:
            scale=joint('scales',f,(-1.02,2.04,.42),'weapon')
            rod(scale,(-1.02,1.87,.42),(-1.02,3.33,.42),.042,'gold')
            rod(scale,(-1.68,3.17,.42),(-.36,3.17,.42),.041,'gold')
            for x in [-1.67,-.37]:
                rod(scale,(x,3.17,.42),(x,2.54,.42),.014,'gold')
                lathe(scale,[(.25,2.43),(.30,2.5),(.07,2.6)],'gold',at=(x,0,.42),n=24)
    h=joint('head',b,(0,3.43,.02),'head')
    orb(h,(0,3.39,0),(.29,.34,.25),'dark')
    mask(h,(0,3.4,.25),.23,.50,'ivory','rose')
    box(h,(0,3.47,.355),(.51,.13,.055),'wine',.018)
    panel(h,[(-.31,3.64),(0,4.24),(.31,3.64),(.23,3.48),(-.23,3.48)],.27,'gold',-.015)
    panel(h,[(-.18,3.65),(0,4.04),(.18,3.65)],.035,'wine',.148,.012)
    ring(h,(0,3.53,-.32),.67,.034,'rose',arc=math.pi*1.62,start=-.31,n=48)

def build_final():
    b=start('final','无主总核','Six-armed cathedral control idol: suspended open rib cage, split mechanical wings, eye core and crown')
    for i in range(6):
        a=i/6*TAU;x=math.sin(a)*.57;z=math.cos(a)*.42
        crystal(b,(x,.18+(i%2)*.15,z),(.20,1.53,.18),'stoneEdge',-x*.7)
    lathe(b,[(.08,.56),(.39,1.03),(.45,1.75),(.35,2.18),(.52,2.47)],'dark',n=16)
    for s in [-1,1]:
        for j in range(4):
            y=2.05+j*.30
            tube(b,[(s*.12,y,-.37),(s*.58,y+.03,-.18),(s*.63,y-.09,.25),(s*.3,y-.15,.5)],.078,'gold' if j%2 else 'stoneEdge')
    core=joint('core',b,(0,2.66,.05),'core')
    orb(core,(0,2.66,.09),(.46,.64,.4),'rose',32,18)
    ring(core,(0,2.66,.44),.42,.05,'gold',n=40)
    orb(core,(0,2.66,.48),(.25,.37,.075),'black',24,14)
    orb(core,(0,2.66,.56),(.07,.26,.034),'rose',20,12)
    for s in [-1,1]:
        wing=joint('wing_'+str(s),b,(s*.45,3.11,-.53),'wing')
        for j in range(3):
            x=s*(1.05+j*.48);y=3.22-j*.21
            panel(wing,[(x-s*.16,y-.44),(x+s*.28,y-.9),(x+s*.4,y+.71),(x+s*.07,y+1.04),(x-s*.18,y+.44)],.17,'stoneEdge' if j%2 else 'gold',-.64-j*.05)
            panel(wing,[(x-s*.02,y-.3),(x+s*.15,y-.60),(x+s*.24,y+.6),(x+s*.05,y+.77)],.03,'rose',-.54-j*.05,.01)
        for j in range(3):
            y=2.08+j*.54
            a=joint('arm_'+str(s)+'_'+str(j),b,(s*.47,y,-.21),'arm')
            endx=s*(1.18+j*.12);endy=y+(.33 if j==2 else -.15)
            rod(a,(s*.47,y,-.21),(endx,endy,-.1),.09,'dark',.14)
            orb(a,(endx,endy,-.1),(.16,.16,.16),'gold')
            f=joint('forearm_'+str(s)+'_'+str(j),a,(endx,endy,-.1),'forearm')
            rod(f,(endx,endy,-.1),(endx+s*.38,endy-.45,.39),.10,'stoneEdge',.08)
            fingers(f,(endx+s*.38,endy-.46,.39),s,'gold',4,.39)
    h=joint('head',b,(0,3.71,.07),'head')
    rod(b,(0,3.15,0),(0,3.69,0),.105,'gold')
    mask(h,(0,3.73,.22),.27,.60,'ivory','rose')
    for s in [-1,1]:panel(h,[(s*.26,3.88),(s*.4,3.55),(s*.47,4.10),(s*.20,4.21)],.09,'dark',-.02)
    crown=joint('crown',h,(0,4.12,-.07),'crown')
    for i in range(7):
        x=(i-3)*.18; y=4.08-abs(i-3)*.037
        crystal(crown,(x,y,-.07),(.10,.70-abs(i-3)*.095,.10),'gold' if i%2 else 'rose',x*.18)
    for i in range(2):
        o=joint('orbit_'+str(i),b,(0,2.75,-.20),'orbit')
        for j in range(4):
            ring(o,(0,2.75,-.20),1.48+i*.40,.036 if i==0 else .058,'rose' if i==0 else 'gold',arc=math.pi*.34,start=j*math.pi/2+.08,n=20)

BUILDERS=[build_golem,build_duelist,build_cantor,build_warden,build_weaver,build_tide,build_furnace,build_orrery,build_arbiter,build_final]
for build in BUILDERS: build()

# One rigid batch for each joint/material/smoothing category, preserving pivots.
for (parent,ma,smooth),(verts,faces) in BUFFERS.items():
    data=bpy.data.meshes.new(parent.name+'_'+ma+'_geometry')
    data.from_pydata(verts,[],faces);data.update()
    bm=bmesh.new();bm.from_mesh(data)
    bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
    bm.to_mesh(data);bm.free()
    ob=bpy.data.objects.new(parent.name+'_'+ma+('_smooth' if smooth else '_planes'),data)
    bpy.context.collection.objects.link(ob);ob.parent=parent
    ob.data.materials.append(M[ma])
    for poly in data.polygons:poly.use_smooth=smooth
    ob['grande_rigid_batch']=True

# All keyframes are authored here and saved as Blender actions/NLA tracks.
# There is no runtime procedural replacement for idle / attack / hit movement.
def children(root):
    return [root,*root.children_recursive]

def key_pose(ob, rest, rotation, shift, scale, frame):
    ob.location=rest['location']+xyz(shift)
    # Game x/y/z rotations map to Blender x/z/-y.
    ob.rotation_euler=(rotation[0],-rotation[2],rotation[1])
    ob.scale=(scale,scale,scale)
    for path in ['location','rotation_euler','scale']:ob.keyframe_insert(data_path=path,frame=frame)

def movement(id,role,name,kind,t,index):
    rot=[0.,0.,0.];shift=[0.,0.,0.];scale=1.
    left=-1 if '_-1' in name else 1
    if kind=='idle':
        wave=math.sin(t*TAU);w2=math.sin(t*TAU+index*.73)-math.sin(index*.73)
        if role=='body':shift[1]=(.045 if id not in ['orrery','final','cantor'] else .085)*wave
        elif role=='head':rot=[.022*wave,.045*wave,0]
        elif role in ['arm','forearm']:rot=[.025*wave,0,left*.035*w2]
        elif role in ['tendril','cloth']:rot=[.05*w2,0,.035*wave]
        elif role=='orbit':
            if id=='orrery':rot=[.12*wave,.12*wave,TAU*t*(1 if index%2 else -1)]
            elif id=='tide':rot[2]=.28*wave
            else:rot[2]=.10*wave
        elif role in ['crown','wing']:rot=[.025*wave,0,left*.02*wave]
        elif role=='core':scale=1+.045*wave
        elif role=='jaw':rot[0]=.035*wave
    elif kind=='attack':
        # Deliberate preparation, decisive impact at 0.36, restrained recovery.
        def envelope(points):
            for (a,va),(bb,vb) in zip(points,points[1:]):
                if a<=t<=bb:return va+(vb-va)*(t-a)/(bb-a)
            return 0
        strike=envelope([(0,0),(.20,-.32),(.36,1),(.56,.8),(1,0)])
        wind=envelope([(0,0),(.20,1),(.37,0),(1,0)])
        if role=='body':
            rot[0]=.12*strike if id not in ['orrery','final'] else .02*strike
            shift[2]=.18*strike;shift[1]=-.08*abs(strike)
        elif role=='head':rot[0]=-.09*strike;rot[1]=-.08*wind
        elif role=='arm':
            if id in ['cantor','weaver','final','orrery']:
                rot[0]=-.52*strike;rot[2]=left*(.45*wind-.22*strike)
            elif id=='warden':rot[0]=-.60*strike
            elif id in ['golem','arbiter','furnace']:
                rot[0]=-2.05*wind-.90*strike;rot[2]=left*.12*wind
            elif id=='tide':
                rot[0]=-.20*strike;rot[1]=-left*.09*wind
            else:rot[0]=-1.18*wind+.69*strike;rot[2]=left*.17*wind
        elif role=='forearm':rot[0]=-.34*strike;rot[2]=left*.1*wind
        elif role=='weapon':rot[0]=-.18*wind+.32*strike
        elif role in ['wing','cloth','tendril']:rot[2]=left*.14*strike
        elif role=='orbit':rot[2]=.35*strike;rot[1]=.16*wind
        elif role=='core':scale=1+.14*wind-.045*strike
        elif role=='crown':shift[1]=.10*wind
        elif role=='jaw':rot[0]=.48*strike
    else:
        impact=math.sin(min(1,t/.22)*math.pi/2) if t<.22 else max(0,(1-t)/.78)*math.cos((t-.22)*math.pi*1.1)
        if role=='body':rot[0]=-.13*impact;rot[2]=.045*impact;shift[2]=-.12*impact
        elif role=='head':rot[0]=-.20*impact;rot[1]=.075*impact
        elif role in ['arm','forearm','wing']:rot[0]=-.14*impact;rot[2]=left*.11*impact
        elif role in ['crown','tendril','cloth']:rot[2]=left*.07*impact
        elif role=='core':scale=1-.07*impact
        elif role=='orbit':rot[2]=.06*impact
    return rot,shift,scale

DURATIONS={'idle':2.4,'attack':1.1,'hit':.6}
for id,entry in CAST.items():
    animated=[o for o in children(entry['root']) if o.type=='EMPTY' and o!=entry['root']]
    entry['joints']=animated
    for kind,duration in DURATIONS.items():
        clip=f'{id}_{kind}';end=round(duration*FPS)
        samples=range(0,end+1,3)
        if end%3:samples=list(samples)+[end]
        for index,ob in enumerate(animated):
            if ob['grande_joint']=='leg' and kind=='idle':continue
            rest={'location':ob.location.copy()}
            ob.animation_data_create()
            ob.animation_data.action=None
            for frame in samples:
                rot,shift,scale=movement(id,ob['grande_joint'],ob.name,kind,frame/end,index)
                key_pose(ob,rest,rot,shift,scale,frame)
            action=ob.animation_data.action;action.name=clip+'__'+ob.name
            # Blender 5 slotted actions: the assigned action slot follows its strip.
            track=ob.animation_data.nla_tracks.new();track.name=clip
            strip=track.strips.new(clip,0,action);strip.name=clip
            strip.extrapolation='NOTHING';strip.blend_type='REPLACE'
            ob.animation_data.action=None
            ob.location=rest['location'];ob.rotation_euler=(0,0,0);ob.scale=(1,1,1)

scene.frame_start=0;scene.frame_end=72;scene.frame_set(0)
bpy.context.view_layer.update()
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'grande-boss-cast.blend'))
bpy.ops.object.select_all(action='DESELECT')
sources=[]
for e in CAST.values():sources.extend(children(e['root']))
for ob in sources:ob.select_set(True)
bpy.context.view_layer.objects.active=CAST['golem']['root']
bpy.ops.export_scene.gltf(filepath=str(GLB),export_format='GLB',use_selection=True,
    export_yup=True,export_apply=False,export_animations=True,
    export_animation_mode='NLA_TRACKS',export_merge_animation='NLA_TRACK',
    export_nla_strips=True,export_frame_range=False,export_anim_slide_to_zero=True,
    export_optimize_animation_size=True,export_force_sampling=True,
    export_optimize_animation_keep_anim_object=False,
    export_cameras=False,export_lights=False,export_extras=True)

def parse_glb(path):
    data=path.read_bytes();size,kind=struct.unpack_from('<II',data,12)
    return json.loads(data[20:20+size])

gltf=parse_glb(GLB)
nodes=gltf['nodes'];accessors=gltf['accessors']
manifest={'version':'3.8','generator':'build_boss_cast.py','coordinateSystem':{'up':'+Y','front':'+Z','feetY':0,'runtimeRootY':.48},'glb':'/models/grande-boss-cast.glb','bytes':GLB.stat().st_size,'bosses':{},'animations':[]}
for id,entry in CAST.items():
    rootidx=next(i for i,n in enumerate(nodes) if n.get('name')==f'boss_{id}')
    descendants=set()
    def walk(i):
        descendants.add(i)
        for child in nodes[i].get('children',[]):walk(child)
    walk(rootidx)
    triangles=0;primitives=0
    for idx in descendants:
        if 'mesh' not in nodes[idx]:continue
        for prim in gltf['meshes'][nodes[idx]['mesh']]['primitives']:
            primitives+=1;triangles+=accessors[prim['indices']]['count']//3
    coords=[]
    for ob in children(entry['root']):
        if ob.type=='MESH':coords.extend(ob.matrix_world@Vector(v) for v in ob.bound_box)
    bounds={'width':round(max(v.x for v in coords)-min(v.x for v in coords),3),'height':round(max(v.z for v in coords)-min(v.z for v in coords),3),'depth':round(max(v.y for v in coords)-min(v.y for v in coords),3),'minY':round(min(v.z for v in coords),4),'maxY':round(max(v.z for v in coords),3)}
    manifest['bosses'][id]={'root':f'boss_{id}','name':entry['name'],'concept':entry['concept'],'triangles':triangles,'drawCalls':primitives,'bounds':bounds,'jointCount':len(entry['joints']),'clips':[]}
    for anim in gltf.get('animations',[]):
        if not anim['name'].startswith(id+'_'):continue
        targets={c['target']['node'] for c in anim['channels']}
        assert targets<=descendants,f'Cross-boss animation: {anim["name"]}'
        duration=max(accessors[s['input']]['max'][0] for s in anim['samplers'])
        info={'name':anim['name'],'duration':round(duration,4),'channels':len(anim['channels']),'targetJoints':len(targets)}
        manifest['bosses'][id]['clips'].append(info);manifest['animations'].append(info)
    assert {a['name'] for a in manifest['bosses'][id]['clips']}=={id+'_'+k for k in DURATIONS},f'Missing clips for {id}'
manifest['totalTriangles']=sum(b['triangles'] for b in manifest['bosses'].values())
manifest['totalDrawCalls']=sum(b['drawCalls'] for b in manifest['bosses'].values())
assert len(manifest['animations'])==30
assert manifest['totalTriangles']<=400000
(OUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf8')
print('BOSS_CAST_VALIDATED',manifest['totalTriangles'],len(manifest['animations']),GLB.stat().st_size,flush=True)

# Showcase is a separate presentation scene; exported asset roots remain at zero.
label_material=material('Presentation labels', '#e6d8b9', emission=1)
for j,(id,e) in enumerate(CAST.items()):
    row=j//5;col=j%5
    e['root'].location=xyz(((col-2)*5.5,row*6.1,0))
    e['root'].rotation_euler.z=math.radians(-13)
    bpy.ops.mesh.primitive_cylinder_add(vertices=64,radius=2.45,depth=.13,location=xyz(((col-2)*5.5,row*6.1-.095,0)))
    disk=bpy.context.object;disk.name='Display plinth '+id;disk.data.materials.append(M['dark'])
    curve=bpy.data.curves.new('Label '+id,'FONT');curve.body=id.upper();curve.align_x='CENTER';curve.size=.32;curve.extrude=0
    label=bpy.data.objects.new('Label '+id,curve);scene.collection.objects.link(label)
    label.location=xyz(((col-2)*5.5,row*6.1-.74,1.8));label.rotation_euler.x=math.pi/2;label.data.materials.append(label_material)
scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.08,.105,.16,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.65
def area(name,at,power,color,size):
    data=bpy.data.lights.new(name,'AREA');data.energy=power;data.color=color;data.shape='DISK';data.size=size
    o=bpy.data.objects.new(name,data);scene.collection.objects.link(o);o.location=xyz(at)
    direction=xyz((0,5,0))-o.location;o.rotation_euler=direction.to_track_quat('-Z','Y').to_euler()
area('Warm broad key',(-8,16,11),5500,(1,.83,.67),12)
area('Cool fill',(10,13,7),4800,(.57,.77,1),11)
area('Lower portrait fill',(0,5,12),2400,(.84,.91,1),12)
area('Rim across rear',(-1,16,-8),6500,(.65,.78,1),10)
camdata=bpy.data.cameras.new('Cast presentation');cam=bpy.data.objects.new('Cast presentation',camdata);scene.collection.objects.link(cam)
cam.location=xyz((0,14,34));target=xyz((0,5.15,0));cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler()
camdata.type='ORTHO';camdata.ortho_scale=29.8;scene.camera=cam
scene.render.engine='CYCLES';scene.cycles.samples=32;scene.cycles.use_denoising=True
scene.render.resolution_x=2560;scene.render.resolution_y=1440;scene.render.resolution_percentage=100
scene.view_settings.view_transform='AgX'
scene.render.image_settings.file_format='PNG';scene.render.filepath=str(OUT/'boss-cast-showcase.png')
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'boss-cast-showcase.blend'))
if '--skip-render' not in sys.argv:bpy.ops.render.render(write_still=True)
print('BOSS_CAST_COMPLETE',str(OUT),flush=True)
