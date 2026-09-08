"""Qianxing: an editable mesh study made from a portrait reference.

Run with Blender 5.2 --background --python this_file -- --output PATH.
This is reference-guided procedural modeling, not single-image reconstruction.
The face, garment and armor surfaces are explicit meshes; rounded fittings and
lights use standard primitives. Rigid pivot groups provide game animation hooks.
"""
import argparse
import json
import math
import random
import os
import sys
from pathlib import Path

import bpy
import bmesh
from mathutils import Vector

parser = argparse.ArgumentParser()
parser.add_argument('--output', default=str(Path(__file__).resolve().parents[1] / 'qianxing'))
parser.add_argument('--no-render', action='store_true')
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
OUT = Path(args.output).resolve()
OUT.mkdir(parents=True, exist_ok=True)
PROJECT = Path(__file__).resolve().parents[2]
GLB = PROJECT / 'public' / 'models' / 'qianxing.glb'
GLB.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.context.preferences.filepaths.save_version = 0
for collection in list(bpy.data.collections):
    if collection.name != 'Collection':
        bpy.data.collections.remove(collection)
base_collection = bpy.data.collections.get('Collection')
base_collection.name = 'QIANXING_EDITABLE_MODEL'
MODEL = []


def mat(name, color, metal=0.0, rough=.5, emission=0.0):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color, 1)
    m.use_nodes = True
    bs = m.node_tree.nodes.get('Principled BSDF')
    bs.inputs['Base Color'].default_value = (*color, 1)
    bs.inputs['Metallic'].default_value = metal
    bs.inputs['Roughness'].default_value = rough
    if emission:
        bs.inputs['Emission Color'].default_value = (*color, 1)
        bs.inputs['Emission Strength'].default_value = emission
    return m


M = {
    'skin': mat('01 / warm neutral synthetic skin', (.29, .195, .146), 0, .61),
    'lip': mat('02 / muted lip', (.31, .15, .12), 0, .56),
    'socket': mat('03 / eyelid shadow', (.115, .065, .05), 0, .56),
    'hair': mat('04 / blue-black hair', (.0018, .0025, .004), 0, .88),
    'hairline': mat('05 / hair strand glints', (.003, .004, .006), 0, .85),
    'white': mat('06 / eye whites', (.62, .65, .60), 0, .28),
    'iris': mat('07 / brown-grey iris', (.085, .072, .055), .05, .23),
    'pupil': mat('08 / pupil', (.004, .006, .007), 0, .22),
    'suit': mat('10 / flexible charcoal undersuit', (.026, .038, .048), .12, .67),
    'rubber': mat('11 / articulated joint seals', (.012, .017, .023), .05, .70),
    'silver': mat('20 / satin alloy broad planes', (.23, .30, .34), .76, .38),
    'light': mat('21 / brushed alloy trim', (.40, .47, .50), .82, .32),
    'darkmetal': mat('22 / recessed gunmetal', (.085, .13, .17), .75, .40),
    'edge': mat('23 / titanium bevel', (.27, .37, .42), .88, .25),
    'cyan': mat('30 / cyan light channels', (.10, .64, .84), .12, .22, 2.6),
    'lens': mat('31 / emitter lens', (.36, .84, 1.0), .2, .12, 3.0),
}


def empty(name, location=(0, 0, 0), parent=None):
    obj = bpy.data.objects.new(name, None)
    base_collection.objects.link(obj)
    obj.location = location
    obj.empty_display_type = 'PLAIN_AXES'
    obj.empty_display_size = .07
    if parent:
        obj.parent = parent
    MODEL.append(obj)
    return obj


ROOT = empty('Qianxing_Reference_Model')
BODY = empty('body', parent=ROOT)
HEAD = empty('head', (0, 0, 2.18), BODY)
ARMS = {side: empty('rightArm' if side > 0 else 'leftArm', (side * .385, 0, 1.84), BODY) for side in [-1, 1]}


def register(obj, material, parent=BODY, smooth=True):
    if obj.name not in base_collection.objects:
        for collection in list(obj.users_collection):
            collection.objects.unlink(obj)
        base_collection.objects.link(obj)
    obj.data.materials.append(material)
    if obj.type == 'MESH' and smooth:
        for face in obj.data.polygons:
            face.use_smooth = True
    bpy.context.view_layer.update()
    if parent:
        obj.parent = parent
        obj.matrix_parent_inverse = parent.matrix_world.inverted()
    MODEL.append(obj)
    return obj


def custom(name, verts, faces, material, parent=BODY, subdiv=0, bevel=0, smooth=True):
    data = bpy.data.meshes.new(name + ' / editable topology')
    data.from_pydata(verts, [], faces)
    data.update()
    obj = bpy.data.objects.new(name, data)
    base_collection.objects.link(obj)
    register(obj, material, parent, smooth)
    if subdiv:
        mod = obj.modifiers.new('Surface subdivision (editable cage)', 'SUBSURF')
        mod.levels = subdiv
        mod.render_levels = subdiv
    if bevel:
        mod = obj.modifiers.new('Machined edge radius', 'BEVEL')
        mod.width = bevel
        mod.segments = 3
        normal = obj.modifiers.new('Face-weighted normals', 'WEIGHTED_NORMAL')
        normal.keep_sharp = True
    return obj


def loft(name, rings, material, parent=BODY, segments=20, subdiv=1):
    # Each cross section: z, center-x, center-y, radius-x, radius-y.
    verts = []
    for z, x, y, rx, ry in rings:
        for i in range(segments):
            angle = i / segments * math.tau
            verts.append((x + math.cos(angle) * rx, y + math.sin(angle) * ry, z))
    faces = []
    for r in range(len(rings) - 1):
        for i in range(segments):
            a = r * segments + i
            b = r * segments + (i + 1) % segments
            faces.append((a, b, b + segments, a + segments))
    faces += [tuple(reversed(range(segments))), tuple((len(rings) - 1) * segments + i for i in range(segments))]
    return custom(name, verts, faces, material, parent, subdiv)


def plate(name, outline, material, thickness=.018, parent=BODY, bevel=.009):
    # A shaped perimeter with depth; front is -Y. Perimeters can curve in 3D.
    # Keep broad plates in front of the fitted cloth across their whole cage.
    clearance = .055 if 'thigh carapace' in name else .042 if 'forearm shell' in name else 0
    if 'boot toe cap' in name:
        outline = [(x, y - .045, z + .032) for x, y, z in outline]
    elif clearance:
        outline = [(x, y - clearance, z) for x, y, z in outline]
    elif 'rear shell' in name:
        outline = [(x, y + .035, z) for x, y, z in outline]
    n = len(outline)
    verts = list(outline) + [(x, y + thickness, z) for x, y, z in outline]
    # Two inset perimeter loops form a rounded forged shell instead of the
    # previous triangle fan. The front stays broad, with an actual rolled rim.
    center = tuple(sum(p[j] for p in outline) / n for j in range(3))
    crown = (.018 if thickness > 0 else -.018)
    for ratio,depth in [(.88,crown),(.28,crown*1.25)]:
        verts.extend([(center[0]+(x-center[0])*ratio,center[1]+(y-center[1])*ratio-depth,center[2]+(z-center[2])*ratio) for x,y,z in outline])
    faces=[]
    for outer,inner in [(0,n*2),(n*2,n*3)]:
        faces.extend([(outer+i,outer+(i+1)%n,inner+(i+1)%n,inner+i) for i in range(n)])
    faces.append(tuple(n*3+i for i in range(n)))
    faces += [tuple(n + i for i in reversed(range(n)))]
    faces += [(i, n + i, n + (i + 1) % n, (i + 1) % n) for i in range(n)]
    return custom(name, verts, faces, material, parent, bevel=min(bevel,.006))


def curve(name, points, radius, material, parent=BODY):
    data = bpy.data.curves.new(name, 'CURVE')
    data.dimensions = '3D'
    data.resolution_u = 12
    data.bevel_depth = radius
    data.bevel_resolution = 3
    spline = data.splines.new('BEZIER')
    spline.bezier_points.add(len(points) - 1)
    for point, xyz in zip(spline.bezier_points, points):
        point.co = xyz
        point.handle_left_type = point.handle_right_type = 'AUTO'
    obj = bpy.data.objects.new(name, data)
    base_collection.objects.link(obj)
    return register(obj, material, parent)


def sphere(name, location, scale, material, parent=BODY, segments=24, rings=16):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    return register(obj, material, parent)


def cylinder(name, a, b, radius, material, parent=BODY, radius2=None, vertices=24):
    a, b = Vector(a), Vector(b)
    d = b - a
    bpy.ops.mesh.primitive_cone_add(vertices=vertices, radius1=radius, radius2=radius if radius2 is None else radius2, depth=d.length, location=(a + b) * .5)
    obj = bpy.context.object
    obj.name = name
    obj.rotation_euler = d.to_track_quat('Z', 'Y').to_euler()
    register(obj, material, parent)
    mod = obj.modifiers.new('Fitting edge fillet', 'BEVEL')
    mod.width = min(.006, radius * .13)
    mod.segments = 2
    return obj


def mirrored(points, side):
    return [(x * side, y, z) for x, y, z in points]


# A fitted fabric torso is continuous, rather than three primitive blocks.
loft('Undersuit / continuous torso', [(1.03, 0, .01, .225, .125), (1.09, 0, .005, .25, .155), (1.19, 0, 0, .23, .145), (1.34, 0, 0, .235, .15), (1.52, 0, 0, .28, .18), (1.69, 0, 0, .355, .185), (1.80, 0, 0, .35, .14), (1.88, 0, .006, .17, .102), (1.90, 0, .006, .105, .09)], M['suit'])
loft('Neck / collar interior', [(1.85,0,0,.095,.085),(1.93,0,0,.101,.088),(2.02,0,0,.084,.077),(2.055,0,0,.080,.075)], M['skin'], HEAD)
for i in range(5):
    z = 1.88 + i * .021
    loft(f'Collar / flexible rib {i:02d}', [(z,0,.012,.115,.105),(z+.009,0,.012,.116,.108),(z+.016,0,.012,.113,.105)], M['rubber'], HEAD, segments=24, subdiv=0)

for side in [-1, 1]:
    tag = 'R' if side > 0 else 'L'
    leg = [(0.16,side*.155,.015,.09,.085),(.30,side*.165,.026,.094,.09),(.50,side*.16,.02,.11,.104),(.69,side*.152,.018,.10,.096),(.82,side*.15,.012,.13,.125),(1.02,side*.14,0,.147,.14),(1.11,side*.13,0,.128,.132)]
    loft(f'{tag} / tailored leg', leg, M['suit'])
    # Foot mesh follows the toe/instep/heel profile in each cross section.
    loft(f'{tag} / shaped combat boot', [(.035,side*.163,-.074,.108,.18),(.06,side*.163,-.084,.119,.185),(.115,side*.163,-.072,.114,.18),(.19,side*.163,-.024,.09,.13),(.24,side*.163,.013,.089,.089)], M['rubber'], segments=24, subdiv=1)
    plate(f'{tag} / boot toe cap', mirrored([(.07,-.238,.082),(.26,-.238,.082),(.27,-.185,.148),(.235,-.123,.182),(.097,-.123,.182),(.059,-.18,.148)], side), M['silver'], bevel=.013)
    plate(f'{tag} / thigh carapace', mirrored([(.061,-.102,1.02),(.218,-.114,1.05),(.275,-.06,.90),(.235,-.105,.752),(.15,-.135,.72),(.065,-.096,.80)],side), M['silver'], bevel=.014)
    plate(f'{tag} / knee plate', mirrored([(.083,-.101,.745),(.231,-.10,.745),(.258,-.112,.66),(.154,-.14,.583),(.060,-.11,.65)],side), M['light'], bevel=.012)
    plate(f'{tag} / shin armor', mirrored([(.076,-.103,.565),(.226,-.104,.563),(.253,-.079,.407),(.222,-.092,.24),(.153,-.13,.212),(.081,-.100,.31)],side), M['silver'], bevel=.012)
    curve(f'{tag} / shin power channel', mirrored([(.143,-.142,.525),(.148,-.16,.37),(.155,-.15,.285)],side), .007, M['cyan'])
    for row in range(4):
        z = .82 + row * .045
        curve(f'{tag} / inner thigh stitched rib {row}', mirrored([(.07,-.117,z),(.025,-.103,z-.004)],side), .006, M['darkmetal'])
    plate(f'{tag} / hip flanking plate', mirrored([(.03,-.143,1.16),(.23,-.157,1.19),(.30,-.098,1.10),(.226,-.134,1.00),(.13,-.173,1.02)],side), M['edge'])

# Independent, curved pectoral plates and a layered abdominal channel.
for side in [-1,1]:
    tag = 'R' if side > 0 else 'L'
    plate(f'{tag} / pectoral alloy shell', mirrored([(.035,-.151,1.82),(.19,-.173,1.845),(.342,-.115,1.775),(.338,-.176,1.62),(.205,-.235,1.535),(.034,-.205,1.555)],side), M['silver'], thickness=.030, bevel=.013)
    plate(f'{tag} / clavicle overlapping plate', mirrored([(.035,-.123,1.882),(.17,-.135,1.91),(.36,-.074,1.816),(.323,-.133,1.756),(.184,-.176,1.828),(.035,-.17,1.837)],side), M['light'], thickness=.020, bevel=.008)
    plate(f'{tag} / abdominal upper articulation', mirrored([(.037,-.202,1.52),(.196,-.231,1.505),(.284,-.161,1.416),(.236,-.173,1.331),(.041,-.178,1.347)],side), M['silver'], thickness=.022)
    plate(f'{tag} / flank joint trim', mirrored([(.25,-.13,1.57),(.33,-.09,1.57),(.275,-.098,1.38),(.231,-.13,1.34)],side), M['darkmetal'], thickness=.025)
    for row in range(3):
        z=1.29-row*.052
        plate(f'{tag} / abdomen louvre {row}', mirrored([(.035,-.175,z),(.207,-.178,z+.012),(.218,-.158,z-.024),(.04,-.176,z-.03)],side), M['edge'], thickness=.016, bevel=.005)
    curve(f'{tag} / collar circuit seam', mirrored([(.06,-.18,1.81),(.185,-.191,1.78),(.272,-.205,1.707)],side),.0045,M['darkmetal'])
    for x,y,z in [(.11,-.176,1.846),(.307,-.159,1.762),(.233,-.218,1.565),(.224,-.17,1.365)]:
        cylinder(f'{tag} / captive fastener', (side*x,y-.004,z),(side*x,y-.013,z),.012,M['darkmetal'],vertices=8)
        curve(f'{tag} / fastener slot', [(side*x-.005,y-.014,z),(side*x+.005,y-.014,z)],.0018,M['light'])

plate('Sternum / recessed light housing',[(-.033,-.212,1.76),(.033,-.212,1.76),(.040,-.239,1.563),(0,-.239,1.516),(-.040,-.239,1.563)],M['darkmetal'],.018,bevel=.006)
plate('Sternum / thin cyan signature',[(-.010,-.234,1.728),(.011,-.234,1.728),(.015,-.254,1.575),(0,-.258,1.55),(-.014,-.254,1.575)],M['cyan'],.004,bevel=.003)
plate('Belt / center buckle',[(-.055,-.188,1.15),(.055,-.188,1.15),(.063,-.19,1.085),(-.063,-.19,1.085)],M['light'],.025,bevel=.008)
for side in [-1,1]:
    # Back plating is modeled, so the specimen remains readable through 360°.
    plate(('R' if side>0 else 'L')+' / scapula rear shell',mirrored([(.02,.162,1.81),(.285,.142,1.78),(.342,.100,1.62),(.195,.192,1.485),(.034,.179,1.53)],side),M['silver'],thickness=-.025,bevel=.013)
    curve('Back / paired cyan spinal conduit',[(side*.056,.223,1.69),(side*.054,.238,1.47),(side*.041,.194,1.28)],.006,M['cyan'])
for i in range(5):
    z=1.75-i*.088
    plate(f'Back / spinal articulation {i}',[(-.035,.20,z),(.035,.20,z),(.045,.207,z-.048),(-.045,.207,z-.048)],M['darkmetal'],thickness=-.018,bevel=.007)

# Limb sleeves are lofted in anatomical proportions; armor floats over them.
for side in [-1,1]:
    tag='R' if side>0 else 'L'
    parent=ARMS[side]
    loft(f'{tag} / arm undersuit',[(1.80,side*.40,0,.12,.115),(1.71,side*.43,-.005,.112,.113),(1.54,side*.455,-.007,.091,.098),(1.45,side*.47,-.015,.087,.091),(1.36,side*.479,-.031,.086,.086),(1.19,side*.495,-.068,.076,.085),(1.11,side*.503,-.087,.065,.071)],M['suit'],parent)
    sphere(f'{tag} / elbow bearing',(side*.47,-.004,1.45),(.088,.085,.091),M['rubber'],parent)
    for level in range(3):
        drop=level*.054
        shoulder=[(.291,-.124,1.852),(.40,-.158,1.909),(.534,-.105,1.865),(.573,-.139,1.75),(.49,-.204,1.718),(.336,-.209,1.747)] if level==0 else [(.329,-.174,1.79-drop),(.489,-.211,1.766-drop),(.576,-.145,1.788-drop),(.574,-.147,1.724-drop),(.493,-.213,1.695-drop),(.339,-.211,1.723-drop)]
        plate(f'{tag} / floating shoulder lamella {level}',mirrored(shoulder,side),M['silver'] if level!=1 else M['edge'],thickness=.035,parent=parent,bevel=.010)
    plate(f'{tag} / biceps shell',mirrored([(.367,-.107,1.69),(.506,-.102,1.682),(.547,-.087,1.552),(.493,-.13,1.486),(.385,-.101,1.521)],side),M['silver'],parent=parent,bevel=.010)
    plate(f'{tag} / forearm shell',mirrored([(.394,-.105,1.399),(.535,-.103,1.414),(.575,-.121,1.248),(.555,-.139,1.123),(.454,-.156,1.099),(.397,-.126,1.203)],side),M['light'],thickness=.035,parent=parent,bevel=.009)
    curve(f'{tag} / shoulder luminous marker',mirrored([(.395,-.226,1.776),(.456,-.231,1.762),(.512,-.21,1.793)],side),.005,M['cyan'],parent)
    # Glove palm plus five tapered, bent digits with knuckle seams.
    loft(f'{tag} / glove palm',[(1.12,side*.504,-.082,.066,.067),(1.055,side*.507,-.103,.070,.071),(1.00,side*.509,-.105,.063,.060)],M['rubber'],parent,segments=16)
    for finger in range(4):
        x=side*(.458+finger*.031)
        bottom=.899+(abs(finger-1.2))*.010
        loft(f'{tag} / articulated finger {finger}',[(1.035,x,-.112,.014,.023),(.991,x,-.13,.016,.022),(.95,x,-.132,.014,.019),(bottom,x,-.151,.010,.013)],M['darkmetal'],parent,segments=10,subdiv=1)
        cylinder(f'{tag} / finger hinge {finger}',(x-side*.014,-.137,.977),(x+side*.014,-.137,.977),.012,M['silver'],parent,vertices=12)
    loft(f'{tag} / articulated thumb',[(1.083,side*.447,-.081,.023,.025),(1.041,side*.426,-.109,.020,.025),(.998,side*.434,-.14,.014,.018)],M['darkmetal'],parent,segments=12)

# The portrait's right forearm optical emitter, with a real recessed barrel.
parent=ARMS[1]
cylinder('Emitter / outer optical barrel',(.512,-.201,1.36),(.523,-.25,1.103),.067,M['darkmetal'],parent,vertices=32)
cylinder('Emitter / machined barrel sleeve',(.516,-.213,1.307),(.523,-.249,1.112),.058,M['silver'],parent,vertices=32)
cylinder('Emitter / dark aperture',(.523,-.249,1.11),(.524,-.251,1.095),.047,M['rubber'],parent,vertices=32)
cylinder('Emitter / optical lens',(.524,-.251,1.096),(.524,-.252,1.091),.035,M['lens'],parent,vertices=32)
for side in [-1,1]:
    curve('Emitter / energy feed '+str(side),[(.512+side*.054,-.218,1.30),(.52+side*.048,-.25,1.19),(.52+side*.035,-.273,1.13)],.006,M['cyan'],parent)
for i in range(5):
    z=1.32-i*.033
    plate(f'Emitter / cooling fin {i}',[(.43,-.215,z),(.477,-.251,z),(.49,-.25,z-.011),(.442,-.212,z-.011)],M['edge'],.012,parent,bevel=.003)
for i in range(3):
    x=-.46-i*.043
    plate(f'L gauntlet / defensive alloy spine {i}',[(x,-.144,1.33),(x-.023,-.145,1.36),(x-.031,-.246,1.421),(x+.004,-.172,1.284)],M['silver'],.012,ARMS[-1],bevel=.004)

# Face: a continuous quad cage with integrated cheek, brow and nose fields.
sections=[(2.018,.067,.065,.007),(2.035,.083,.083,.001),(2.068,.105,.096,0),(2.101,.127,.104,.004),(2.135,.139,.115,.007),(2.169,.147,.122,.009),(2.205,.153,.125,.012),(2.240,.153,.125,.017),(2.276,.149,.127,.023),(2.314,.147,.127,.027),(2.347,.137,.12,.030),(2.378,.112,.101,.032),(2.397,.055,.050,.033)]
verts=[]
segments=48
for z,rx,ry,cy in sections:
    for i in range(segments):
        a=i/segments*math.tau
        x=math.cos(a)*rx
        y=cy+math.sin(a)*ry
        front=max(0,-math.sin(a))**10
        nose=.072*math.exp(-((x/.030)**2)-(((z-2.162)/.073)**2))
        brow=.012*math.exp(-(((abs(x)-.063)/.045)**2)-(((z-2.224)/.021)**2))
        cheek=.014*math.exp(-(((abs(x)-.088)/.034)**2)-(((z-2.164)/.033)**2))
        sockets=.011*math.exp(-(((abs(x)-.061)/.036)**2)-(((z-2.202)/.015)**2))
        y-=front*(nose+brow+cheek-sockets)
        verts.append((x,y,z))
faces=[]
for j in range(len(sections)-1):
    for i in range(segments):
        n=j*segments+i
        faces.append((n,j*segments+(i+1)%segments,(j+1)*segments+(i+1)%segments,n+segments))
faces+=[tuple(reversed(range(segments))),tuple((len(sections)-1)*segments+i for i in range(segments))]
custom('Head / continuous facial quad cage',verts,faces,M['skin'],HEAD,subdiv=2)
for side in [-1,1]:
    tag='R' if side>0 else 'L'
    sphere(f'{tag} eye / eyeball',(side*.061,-.110,2.204),(.034,.027,.012),M['white'],HEAD)
    sphere(f'{tag} eye / iris',(side*.061,-.1351,2.204),(.0125,.004,.0105),M['iris'],HEAD)
    sphere(f'{tag} eye / pupil',(side*.061,-.1382,2.204),(.0054,.0016,.0065),M['pupil'],HEAD)
    sphere(f'{tag} eye / catchlight',(side*.057,-.14,2.209),(.002,.001,.002),M['white'],HEAD,segments=12,rings=8)
    curve(f'{tag} / upper eyelid',mirrored([(.027,-.127,2.203),(.044,-.133,2.212),(.065,-.136,2.214),(.084,-.127,2.209),(.095,-.116,2.202)],side),.0045,M['skin'],HEAD)
    curve(f'{tag} / lower eyelid',mirrored([(.028,-.126,2.202),(.047,-.135,2.195),(.072,-.134,2.195),(.093,-.12,2.202)],side),.0034,M['skin'],HEAD)
    curve(f'{tag} / eyelash margin',mirrored([(.029,-.131,2.206),(.05,-.139,2.214),(.074,-.137,2.214),(.095,-.122,2.204)],side),.0018,M['socket'],HEAD)
    plate(f'{tag} / sculpted eyebrow',mirrored([(.022,-.131,2.234),(.053,-.137,2.245),(.078,-.129,2.246),(.109,-.107,2.232),(.078,-.132,2.236),(.047,-.139,2.235)],side),M['hair'],.002,HEAD,bevel=.002)
    # Custom ears, with a separate helicoidal ridge and concha inset.
    ear=[(side*.145,.004,2.214),(side*.174,.009,2.239),(side*.185,.014,2.211),(side*.182,.015,2.174),(side*.17,.006,2.14),(side*.15,-.002,2.154)]
    plate(f'{tag} / ear pinna',ear,M['skin'],.022,HEAD,bevel=.009)
    curve(f'{tag} / ear helix',[(side*.154,-.008,2.212),(side*.172,-.005,2.227),(side*.177,-.005,2.192),(side*.165,-.006,2.158)],.006,M['skin'],HEAD)
    curve(f'{tag} / ear concha',[(side*.159,-.01,2.204),(side*.17,-.011,2.193),(side*.16,-.012,2.178)],.003,M['socket'],HEAD)
    sphere(f'{tag} / nasal ala',(side*.017,-.157,2.146),(.012,.009,.009),M['skin'],HEAD,segments=16,rings=12)
    sphere(f'{tag} / nostril',(side*.016,-.164,2.140),(.005,.003,.0025),M['socket'],HEAD,segments=12,rings=8)
curve('Mouth / upper lip',[(-.041,-.117,2.098),(-.02,-.13,2.100),(0,-.135,2.104),(.02,-.13,2.100),(.041,-.117,2.098)],.0055,M['lip'],HEAD)
curve('Mouth / lower lip',[(-.037,-.117,2.094),(-.016,-.132,2.089),(0,-.135,2.088),(.019,-.13,2.090),(.038,-.117,2.095)],.006,M['skin'],HEAD)
curve('Mouth / closed seam',[(-.035,-.12,2.096),(0,-.138,2.097),(.035,-.12,2.096)],.0018,M['socket'],HEAD)
plate('R temple / fitted silver implant',[(.124,-.073,2.287),(.147,-.042,2.288),(.155,-.045,2.247),(.143,-.082,2.223),(.126,-.104,2.239)],M['light'],.014,HEAD,bevel=.005)
curve('R temple / implant signal',[(.141,-.083,2.259),(.141,-.08,2.243)],.003,M['cyan'],HEAD)

# Hair has a continuous scalp and swept, tapering ribbons instead of cone spikes.
hair_verts=[];hair_faces=[];hair_segments=40
for j,(z,rx,ry) in enumerate([(0,.156,.142),(2.30,.164,.145),(2.355,.153,.138),(2.407,.099,.092),(2.422,.012,.012)]):
    for i in range(hair_segments):
        a=i/hair_segments*math.tau
        hem=2.208+.076*max(0,-math.sin(a))+.05*abs(math.cos(a))
        hair_verts.append((math.cos(a)*rx,.031+math.sin(a)*ry,hem if j==0 else z))
for j in range(4):
    for i in range(hair_segments):
        a=j*hair_segments+i;b=j*hair_segments+(i+1)%hair_segments
        hair_faces.append((a,b,b+hair_segments,a+hair_segments))
hair_faces.append(tuple(4*hair_segments+i for i in range(hair_segments)))
custom('Hair / fitted scalp with shaped nape',hair_verts,hair_faces,M['hair'],HEAD,subdiv=1)


def hair_lock(name, points, width):
    verts=[]
    count=len(points)
    for i,p in enumerate(points):
        amount=max(.006,math.sin((i/(count-1)*.89+.07)*math.pi))*width
        if i==count-1:amount=.001
        verts.extend([(p[0]-amount,p[1]+.002,p[2]),(p[0],p[1]-.008,p[2]+.006),(p[0]+amount,p[1]+.002,p[2])])
    faces=[]
    for i in range(count-1):
        for j in range(2):faces.append((i*3+j,i*3+j+1,(i+1)*3+j+1,(i+1)*3+j))
    obj=custom(name,verts,faces,M['hair'],HEAD,subdiv=1)
    solid=obj.modifiers.new('Lock thickness', 'SOLIDIFY');solid.thickness=.006
    curve(name+' / strand ridge',[(p[0],p[1]-.009,p[2]+.007) for p in points[:-1]],.0012,M['hairline'],HEAD)


for i in range(18):
    x=(i-8.5)*.016
    sweep=.055*(1-abs(x)/.16)
    tip_z=2.283+math.sin(i*1.7)*.014+abs(x)*.08
    hair_lock(f'Hair / swept front lock {i:02d}',[(x+.033,.070,2.404-abs(x)*.22),(x+.026,.019,2.422-abs(x)*.24),(x+.008,-.046,2.412-abs(x)*.26),(x-sweep*.65,-.104,2.369-abs(x)*.22),(x-sweep-.012*math.sin(i*.9),-.123,tip_z)],.012+(i%3)*.002)
for side in [-1,1]:
    for i in range(7):
        y=-.025+i*.024
        hair_lock(f'Hair / temple layered lock {side}/{i}',[(side*.131,y+.032,2.351),(side*.155,y,2.307),(side*.15,y-.026,2.265),(side*.139,y-.035,2.222+(i%2)*.025)],.011)
    for i in range(5):
        x=side*(.025+i*.025)
        hair_lock(f'Hair / rear swept lock {side}/{i}',[(x,.112,2.384),(x+side*.015,.176,2.341),(x+side*.018,.186,2.279),(x+side*.012,.166,2.206+(i%2)*.018)],.017)

# Refine the reference study before export, preserving its named animation pivots.
sys.path.insert(0,str(Path(__file__).resolve().parent))
from qianxing_refinement import refine
refine(globals())

# Ascending and descending lofts and mirrored plates share outward normals.
for obj in MODEL:
    if obj.type != 'MESH':
        continue
    bm=bmesh.new();bm.from_mesh(obj.data)
    bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
    bm.to_mesh(obj.data);bm.free();obj.data.update()

# Blueprint bone guides are editable in the native project. The runtime model
# deliberately uses rigid hierarchical pivots; it is not claimed to be skinned.
guides=bpy.data.collections.new('EDITABLE / bone guides (not runtime skin)')
bpy.context.scene.collection.children.link(guides)
arm_data=bpy.data.armatures.new('Proportion bone guide')
arm=bpy.data.objects.new('GuideRig / no automatic weights',arm_data)
guides.objects.link(arm)
bpy.context.view_layer.objects.active=arm
arm.select_set(True)
bpy.ops.object.mode_set(mode='EDIT')
bone_specs=[('pelvis',(0,0,.98),(0,0,1.2),None),('spine',(0,0,1.2),(0,0,1.59),'pelvis'),('chest',(0,0,1.59),(0,0,1.88),'spine'),('head',(0,0,1.88),(0,0,2.39),'chest')]
for side in [-1,1]:
    s='R' if side>0 else 'L'
    bone_specs.extend([(s+'_arm',(side*.38,0,1.84),(side*.47,-.015,1.45),'chest'),(s+'_forearm',(side*.47,-.015,1.45),(side*.50,-.085,1.11),s+'_arm'),(s+'_thigh',(side*.14,0,1.04),(side*.155,0,.69),'pelvis'),(s+'_shin',(side*.155,0,.69),(side*.164,0,.20),s+'_thigh')])
for name,a,b,parent in bone_specs:
    bone=arm_data.edit_bones.new(name);bone.head=a;bone.tail=b
    if parent:bone.parent=arm_data.edit_bones[parent]
bpy.ops.object.mode_set(mode='OBJECT')
arm.show_in_front=True
arm.hide_render=True
arm.hide_set(True)

# Reference is embedded in the .blend, linked to the study but hidden in renders.
reference=PROJECT/'public'/'art'/'recruits.png'
if reference.exists():
    img=bpy.data.images.load(str(reference));img.pack()
    obj=bpy.data.objects.new('REFERENCE / right half is Qianxing',None)
    guides.objects.link(obj);obj.empty_display_type='IMAGE';obj.data=img
    obj.empty_display_size=3;obj.location=(-2.3,.7,1.45);obj.rotation_euler=(math.pi/2,0,0)
    obj.hide_render=True;obj.hide_set(True)

# A studio rig and cameras make the saved Blender file immediately inspectable.
studio=bpy.data.collections.new('STUDIO / lights, floor, cameras')
bpy.context.scene.collection.children.link(studio)


def studio_link(obj):
    for c in list(obj.users_collection):c.objects.unlink(obj)
    studio.objects.link(obj)


floor_mat=mat('Studio / graphite',(.025,.035,.045),.12,.58)
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.008))
floor=bpy.context.object;floor.name='Studio floor';floor.data.materials.append(floor_mat);studio_link(floor)


def area(name, location, energy, color, size, target=(0,0,1.35)):
    data=bpy.data.lights.new(name,'AREA');data.energy=energy;data.color=color;data.shape='DISK';data.size=size
    obj=bpy.data.objects.new(name,data);studio.objects.link(obj);obj.location=location;obj.rotation_euler=(Vector(target)-obj.location).to_track_quat('-Z','Y').to_euler()


area('Key / softbox',(-3,-4,5.5),620,(.80,.89,1),4)
area('Fill / warm bounce',(3,-2,2.4),260,(1,.78,.58),3)
area('Rim / cyan',(.9,2,3.6),360,(.46,.78,1),2.2)
area('Face / portrait strip',(0,-3,3.4),75,(1,.93,.83),1.1,target=(0,0,2.18))
scene=bpy.context.scene
scene.render.engine='CYCLES'
scene.cycles.samples=32
scene.cycles.use_denoising=True
scene.render.image_settings.file_format='PNG'
scene.render.resolution_percentage=100
scene.world.color=(.06,.06,.06)
scene.world.use_nodes=True
scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.11,.14,.18,1)
scene.world.node_tree.nodes['Background'].inputs[1].default_value=.27
scene.view_settings.view_transform='AgX'


def camera(name, location, target, ortho):
    data=bpy.data.cameras.new(name);data.type='ORTHO';data.ortho_scale=ortho
    obj=bpy.data.objects.new(name,data);studio.objects.link(obj);obj.location=location
    obj.rotation_euler=(Vector(target)-obj.location).to_track_quat('-Z','Y').to_euler()
    return obj


cameras={
    'beauty':camera('Camera / three-quarter',(3.8,-7,3.0),(0,-.02,1.25),2.93),
    'front':camera('Camera / front',(0,-8,1.30),(0,0,1.30),2.88),
    'side':camera('Camera / right profile',(8,0,1.30),(0,0,1.30),2.88),
    'back':camera('Camera / back',(0,8,1.30),(0,0,1.30),2.88),
    'face':camera('Camera / portrait',(1.3,-4,2.40),(0,-.02,2.21),.57),
}
scene.camera=cameras['beauty']
scene.render.resolution_x=1000;scene.render.resolution_y=1200
bpy.ops.object.select_all(action='DESELECT')
for obj in MODEL:obj.select_set(True)
bpy.context.view_layer.objects.active=ROOT
# A useful startup viewport, with the model selected and modifiers retained.
for screen in bpy.data.screens:
    for region in screen.areas:
        if region.type=='VIEW_3D':
            region.spaces.active.region_3d.view_distance=4.0
            region.spaces.active.region_3d.view_location=(0,0,1.3)
            region.spaces.active.shading.type='MATERIAL'
scene['project_note']='Reference-guided scripted mesh modeling. Rigid editable pivots; guide armature is not a weighted runtime rig.'
scene['reference_note']='The right portrait in packed recruits.png is Qianxing. Clothing and face are an original demo interpretation, not a canon reference expansion.'
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'qianxing-reference-study.blend'))
from export_batched import export_batched
export_batched(GLB,MODEL)
deps=bpy.context.evaluated_depsgraph_get()
mesh_objects=[obj for obj in MODEL if obj.type=='MESH']
evaluated_triangles=0
for obj in mesh_objects:
    evaluated=obj.evaluated_get(deps);data=evaluated.to_mesh();data.calc_loop_triangles();evaluated_triangles+=len(data.loop_triangles);evaluated.to_mesh_clear()
manifest={'reference':str(reference),'blend':str(OUT/'qianxing-reference-study.blend'),'glb':str(GLB),'mesh_objects':len(mesh_objects),'editable_mesh_vertices':sum(len(obj.data.vertices) for obj in mesh_objects),'evaluated_mesh_triangles_excluding_curves':evaluated_triangles,'materials':len(M),'animation_pivots':['head','rightArm','leftArm'],'runtime_skinning':False,'method':'Explicit lofted/contoured polygon meshes, subdivision, thickness and bevel modifiers; portrait used as a visual reference, not image reconstruction.'}
glb_bytes=GLB.read_bytes()
gltf=json.loads(glb_bytes[20:20+int.from_bytes(glb_bytes[12:16],'little')])
manifest.update({'glb_bytes':len(glb_bytes),'runtime_triangles':sum(gltf['accessors'][p['indices']]['count']//3 for m in gltf['meshes'] for p in m['primitives']),'runtime_meshes':len(gltf['meshes']),'runtime_nodes':len(gltf['nodes'])})
(OUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf8')
print('MODEL_MANIFEST '+json.dumps(manifest,ensure_ascii=False))
if not args.no_render:
    for name in ['beauty','front','side','back','face']:
        scene.camera=cameras[name]
        scene.render.resolution_x=900 if name!='face' else 1000
        scene.render.resolution_y=1150 if name!='face' else 1000
        scene.render.filepath=str(OUT/f'qianxing-{name}.png')
        bpy.ops.render.render(write_still=True)
scene.camera=cameras['beauty']
scene.render.filepath=str(OUT/'qianxing-beauty.png')
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'qianxing-reference-study.blend'))
print('QIANXING_STUDY_COMPLETE')
