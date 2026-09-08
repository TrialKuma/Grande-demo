"""3.7 reference-guided surface refinement; authored meshes, not image-to-3D."""
import math
import random
import bpy
from mathutils import Vector


def refine(g):
    M, MODEL, BODY, HEAD, ARMS = [g[n] for n in ['M','MODEL','BODY','HEAD','ARMS']]
    custom, loft, curve, plate, sphere, cylinder, mirrored = [g[n] for n in ['custom','loft','curve','plate','sphere','cylinder','mirrored']]
    # Replace the earlier facial construction and uniform combed ribbons.
    replace = ['Head / continuous', 'Hair /', 'Mouth /', 'eye /', '/ upper eyelid', '/ lower eyelid', '/ eyelash margin', '/ sculpted eyebrow', '/ nasal ala', '/ nostril', '/ floating shoulder lamella']
    for obj in list(MODEL):
        if any(key in obj.name for key in replace):
            MODEL.remove(obj)
            bpy.data.objects.remove(obj, do_unlink=True)
    hair_bs = M['hair'].node_tree.nodes.get('Principled BSDF')
    hair_bs.inputs['Specular IOR Level'].default_value = .15
    M['skin'].node_tree.nodes.get('Principled BSDF').inputs['Subsurface Weight'].default_value=.035
    # Denser continuous head: a stronger male jaw, recessed temples and brow.
    sections=[(2.01,.057,.061,.006),(2.022,.078,.077,.001),(2.044,.102,.085,.001),(2.073,.123,.092,.003),(2.101,.135,.102,.005),(2.131,.141,.108,.006),(2.154,.146,.113,.008),(2.177,.148,.116,.011),(2.198,.149,.119,.013),(2.217,.150,.121,.014),(2.238,.149,.121,.017),(2.262,.147,.12,.022),(2.290,.146,.123,.026),(2.320,.144,.124,.029),(2.347,.135,.118,.031),(2.373,.115,.101,.032),(2.392,.077,.068,.033),(2.40,.015,.015,.033)]
    verts=[]; count=64
    for z,rx,ry,cy in sections:
        for i in range(count):
            a=i/count*math.tau; x=math.cos(a)*rx
            y=cy+math.sin(a)*ry
            front=max(0,-math.sin(a))**5
            nose=.079*math.exp(-((x/.024)**2)-(((z-2.166)/.052)**2))
            bridge=.025*math.exp(-((x/.020)**2)-(((z-2.212)/.048)**2))
            brow=.014*math.exp(-(((abs(x)-.062)/.049)**2)-(((z-2.227)/.017)**2))
            cheek=.017*math.exp(-(((abs(x)-.094)/.034)**2)-(((z-2.162)/.035)**2))
            socket=.016*math.exp(-(((abs(x)-.064)/.031)**2)-(((z-2.203)/.014)**2))
            mouth=.013*math.exp(-((x/.051)**4)-(((z-2.099)/.024)**2))
            chin=.013*math.exp(-((x/.063)**4)-(((z-2.040)/.027)**2))
            y-=front*(nose+bridge+brow+cheek+mouth+chin-socket)
            verts.append((x,y,z))
    faces=[]
    for j in range(len(sections)-1):
        for i in range(count):
            a=j*count+i;b=j*count+(i+1)%count
            faces.append((a,b,b+count,a+count))
    faces.extend([tuple(reversed(range(count))),tuple((len(sections)-1)*count+i for i in range(count))])
    custom('Head / 3.7 continuous brow cheek nose jaw surface',verts,faces,M['skin'],HEAD,subdiv=2)
    for s in [-1,1]:
        tag='R' if s>0 else 'L'
        # The eyelids sit on the eye sphere; narrower aperture avoids the old stare.
        sphere(f'{tag} eye / socket orb',(s*.064,-.117,2.203),(.031,.019,.011),M['white'],HEAD)
        sphere(f'{tag} eye / iris',(s*.064,-.135,2.203),(.010,.0025,.0082),M['iris'],HEAD)
        sphere(f'{tag} eye / pupil',(s*.064,-.137,2.203),(.0048,.001,.006),M['pupil'],HEAD)
        sphere(f'{tag} eye / light',(s*.060,-.138,2.207),(.0015,.001,.0015),M['white'],HEAD,segments=12,rings=8)
        curve(f'{tag} / anatomical upper eyelid',mirrored([(.031,-.127,2.202),(.046,-.136,2.21),(.066,-.138,2.212),(.083,-.129,2.21),(.094,-.116,2.206)],s),.0032,M['skin'],HEAD)
        curve(f'{tag} / anatomical lower eyelid',mirrored([(.032,-.127,2.201),(.049,-.136,2.197),(.071,-.135,2.197),(.092,-.12,2.205)],s),.0029,M['skin'],HEAD)
        curve(f'{tag} / eyelid dark edge',mirrored([(.033,-.13,2.203),(.05,-.139,2.211),(.072,-.136,2.212),(.092,-.12,2.206)],s),.0011,M['socket'],HEAD)
        curve(f'{tag} / tired lower orbital fold',mirrored([(.040,-.124,2.189),(.065,-.121,2.183),(.093,-.103,2.188)],s),.0013,M['skin'],HEAD)
        curve(f'{tag} / angled eyebrow',mirrored([(.026,-.141,2.238),(.052,-.145,2.241),(.080,-.137,2.236),(.106,-.115,2.226)],s),.0032,M['hair'],HEAD)
        for i in range(10):
            x=.031+i*.0068;z=2.24-max(0,x-.052)*.20
            curve(f'{tag} / brow strand {i}',mirrored([(x,-.143+(x-.05)*.32,z-.003),(x+.004,-.144+(x-.05)*.32,z+.003)],s),.00075,M['hair'],HEAD)
        # Tiny recessed nostrils instead of spherical pieces glued onto the face.
        sphere(f'{tag} / nostril recess',(s*.016,-.159,2.143),(.0065,.002,.0028),M['socket'],HEAD,segments=16,rings=8)
    curve('Mouth / subtle upper vermilion',[(-.038,-.111,2.100),(-.018,-.124,2.101),(-.008,-.127,2.103),(0,-.126,2.101),(.012,-.127,2.102),(.027,-.119,2.1),(.038,-.111,2.101)],.0028,M['lip'],HEAD)
    curve('Mouth / lower lip volume',[(-.034,-.113,2.096),(-.016,-.125,2.093),(0,-.127,2.093),(.019,-.124,2.094),(.036,-.112,2.098)],.0034,M['lip'],HEAD)
    curve('Mouth / natural closed seam',[(-.038,-.113,2.098),(-.014,-.128,2.098),(0,-.129,2.098),(.021,-.125,2.098),(.038,-.113,2.10)],.0011,M['socket'],HEAD)
    # Short asymmetric cut. Every lock is a curved ribbon with its own direction,
    # root width, tip and silhouette, rather than a repeated straight comb tooth.
    verts=[]; faces=[]; n=48
    hair_sections=[(0,.161,.148),(2.30,.166,.149),(2.35,.158,.144),(2.395,.126,.116),(2.426,.070,.064),(2.44,.004,.004)]
    for row,(z,rx,ry) in enumerate(hair_sections):
        for i in range(n):
            a=i/n*math.tau
            lower=2.219+.068*max(0,-math.sin(a))+.01*abs(math.cos(a))
            verts.append((math.cos(a)*rx,.031+math.sin(a)*ry,lower if row==0 else z))
    for j in range(len(hair_sections)-1):
        for i in range(n):
            k=j*n+i;l=j*n+(i+1)%n;faces.append((k,l,l+n,k+n))
    custom('Hair / closely cropped underlying scalp',verts,faces,M['hair'],HEAD,subdiv=1)
    rng=random.Random(731)
    def lock(name,points,width):
        vs=[]
        for i,p in enumerate(points):
            tangent=Vector(points[min(i+1,len(points)-1)])-Vector(points[max(0,i-1)])
            normal=Vector((p[0],p[1]-.025,(p[2]-2.22)*.65)).normalized()
            across=tangent.cross(normal).normalized()
            w=width*(.55 if i==0 else .02 if i==len(points)-1 else 1-i/len(points)*.6)
            v=Vector(p)
            vs.extend([tuple(v-across*w),tuple(v+normal*.006),tuple(v+across*w)])
        fs=[]
        for i in range(len(points)-1):
            for j in range(2):fs.append((i*3+j,i*3+j+1,(i+1)*3+j+1,(i+1)*3+j))
        obj=custom(name,vs,fs,M['hair'],HEAD,subdiv=1)
        solid=obj.modifiers.new('Tapered lock body','SOLIDIFY');solid.thickness=.002
    for i in range(37):
        x=rng.uniform(-.135,.135);root_y=rng.uniform(-.005,.091)
        peak=2.425-abs(x)*.22+rng.uniform(-.005,.014)
        sweep=rng.uniform(-.075,-.028)
        endx=max(-.166,x+sweep); endz=2.277+rng.uniform(-.022,.037)+abs(endx)*.07
        pts=[(x,root_y,peak-.015),(x-.004,root_y-.035,peak+.009),(x+sweep*.45,-.082,peak-.025),(endx,-.126+rng.uniform(-.008,.008),endz)]
        lock(f'Hair / asymmetric swept tuft {i:02}',pts,rng.uniform(.009,.020))
    for s in [-1,1]:
        for i in range(12):
            y=-.07+i*.016+rng.uniform(-.004,.004)
            outer=.164*math.sqrt(max(.2,1-((y-.031)/.152)**2))
            lock(f'Hair / tapered short side {s}/{i}',[(s*(outer-.006),y+.018,2.35),(s*(outer+.006),y+.003,2.305),(s*outer,y-.01,2.266),(s*(outer-.013),y-.017,2.232+rng.random()*.014)],.006+rng.random()*.005)
        for i in range(11):
            x=s*(.013+i*.012)
            lock(f'Hair / textured nape {s}/{i}',[(x,.115,2.366),(x+s*.012,.163,2.332),(x+s*.008,.181,2.271),(x,.16,2.214+rng.random()*.015)],.009+rng.random()*.005)
    # Curved shoulder shells, each surface wraps around the joint in two axes.
    for s in [-1,1]:
        parent=ARMS[s]
        for layer in range(3):
            vs=[];fs=[];rows=5;cols=13
            for j in range(rows):
                t=j/(rows-1)
                z=(1.92-.145*(1-math.cos(t*math.pi/2))) if layer==0 else (1.89-layer*.072-t*.125)
                radius=(.032+math.sin(t*math.pi/2)*.145) if layer==0 else (.138+math.sin(t*math.pi*.7)*.035)
                for k in range(cols):
                    a=-math.pi*.98+k/(cols-1)*math.pi*1.82
                    vs.append((s*(.427+math.cos(a)*radius),-.004+math.sin(a)*radius*1.1,z))
            for j in range(rows-1):
                for k in range(cols-1):
                    a=j*cols+k;fs.append((a,a+1,a+cols+1,a+cols))
            obj=custom(f'{s} / wrapped shoulder shell {layer}',vs,fs,M['silver'] if layer!=1 else M['edge'],parent,subdiv=1)
            thick=obj.modifiers.new('Cast alloy wall thickness','SOLIDIFY');thick.thickness=.018
            rim=obj.modifiers.new('Shoulder rolled edge','BEVEL');rim.width=.004;rim.segments=2
        # Real mechanical articulation is visible at the elbow and side of torso.
        cylinder(f'{s} / external elbow axle',(s*.438,.005,1.444),(s*.55,.005,1.444),.066,M['edge'],parent,vertices=24)
        cylinder(f'{s} / elbow ceramic bearing',(s*.55,.005,1.444),(s*.559,.005,1.444),.046,M['darkmetal'],parent,vertices=24)
        cylinder(f'{s} / elbow hub',(s*.559,.005,1.444),(s*.566,.005,1.444),.019,M['light'],parent,vertices=16)
        for j in range(5):
            z=1.58-j*.056
            curve(f'{s} / oblique flexible armor rib {j}',mirrored([(.246,-.162,z),(.302,-.10,z+.03),(.31,.025,z+.04),(.273,.116,z+.02)],s),.012,M['edge'])
        cylinder(f'{s} / lateral hydraulic rod',(s*.30,.052,1.29),(s*.346,.046,1.57),.014,M['light'])
        cylinder(f'{s} / lateral hydraulic housing',(s*.278,.056,1.19),(s*.31,.052,1.38),.027,M['darkmetal'])
        # Collar guards and diagonal breast segments match the portrait armor's
        # visual hierarchy: collar, broad breastplate, overlapping ribs, dark gaps.
        plate(f'{s} / high neck gorget',mirrored([(.05,-.091,1.945),(.11,-.07,2.011),(.162,-.026,1.948),(.165,-.088,1.869),(.095,-.136,1.876)],s),M['silver'],.018,bevel=.004)
        for j in range(3):
            z=1.6-j*.068
            plate(f'{s} / overlapping diagonal rib plate {j}',mirrored([(.063,-.24,z),(.238,-.213,z+.061),(.29,-.175,z+.053),(.254,-.206,z+.01),(.069,-.231,z-.047)],s),M['edge'] if j==1 else M['silver'],.019,bevel=.003)
        for j in range(3):
            x=.108+j*.055;z=1.752+j*.006
            plate(f'{s} / inset breast panel {j}',mirrored([(x,-.206,z+.039),(x+.024,-.213,z+.041),(x+.014,-.231,z-.008),(x-.011,-.224,z-.015)],s),M['darkmetal'],.005,bevel=.002)
        for j in range(3):
            z=.25+j*.067
            curve(f'{s} / greave recessed diagonal seam {j}',mirrored([(.102,-.157,z),(.196,-.148,z+.03)],s),.003,M['darkmetal'])
        plate(f'{s} / rear thigh alloy panel',mirrored([(.066,.119,1.029),(.202,.131,1.027),(.255,.102,.917),(.215,.13,.799),(.103,.141,.765),(.06,.108,.854)],s),M['edge'],-.017,bevel=.004)
        plate(f'{s} / posterior calf shell',mirrored([(.086,.133,.581),(.222,.134,.58),(.231,.139,.41),(.192,.131,.272),(.12,.131,.257),(.082,.122,.403)],s),M['silver'],-.016,bevel=.004)
        for j in range(4):
            z=.63+j*.029
            curve(f'{s} / rear knee flexible seam {j}',mirrored([(.081,.113,z),(.159,.133,z-.006),(.228,.111,z)],s),.005,M['rubber'])
        cylinder(f'{s} / heel shock absorber',(s*.164,.156,.085),(s*.164,.124,.237),.022,M['light'])
        curve(f'{s} / calf cable return',mirrored([(.125,.158,.54),(.134,.17,.42),(.157,.15,.29)],s),.0035,M['cyan'])
        for j in range(3):
            z=1.40-j*.07
            plate(f'{s} / lumbar floating panel {j}',mirrored([(.055,.184,z),(.20,.164,z+.027),(.218,.145,z-.019),(.06,.181,z-.05)],s),M['edge'],-.015,bevel=.003)
        for x,y,z in [(.323,-.15,1.784),(.238,-.232,1.563),(.233,-.197,1.417),(.238,-.155,.956),(.17,-.156,.647)]:
            cylinder(f'{s} / armor countersunk insert',(s*x,y-.009,z),(s*x,y-.013,z),.009,M['rubber'],vertices=12)
            cylinder(f'{s} / inset hex bolt',(s*x,y-.014,z),(s*x,y-.017,z),.005,M['light'],vertices=6)
    # Expand the optical emitter into an articulated faceted housing with vents.
    parent=ARMS[1]
    for s in [-1,1]:
        curve('Emitter / longitudinal exoshell rail '+str(s),[(.52+s*.075,-.195,1.40),(.53+s*.072,-.243,1.29),(.527+s*.068,-.282,1.10)],.013,M['edge'],parent)
    for i in range(4):
        z=1.27-i*.034
        cylinder(f'Emitter / circumferential reinforcing rib {i}',(.521,-.224-(1.27-z)*.18,z),(.522,-.226-(1.27-z)*.18,z-.01),.075,M['darkmetal'],parent,vertices=24)
    # The render includes all three-quarter/back surfaces, not only a front sheet.
    g['REFINEMENT_VERSION']='3.7 / contoured alloy, short asymmetric hair, anatomical face'
