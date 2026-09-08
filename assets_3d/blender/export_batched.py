"""Export evaluated meshes batched by rigid pivot/material; source stays editable."""
import bpy


def export_batched(filepath, sources):
    deps=bpy.context.evaluated_depsgraph_get()
    original_names={o:o.name for o in sources if o.type=='EMPTY'}
    temporary=bpy.data.collections.new('TEMP / game material batches')
    bpy.context.scene.collection.children.link(temporary)
    pivots={};created=[];groups={}
    for o,name in original_names.items():
        o.name=name+' / editable source'
    for o,name in original_names.items():
        p=bpy.data.objects.new(name,None);temporary.objects.link(p);created.append(p)
        p.matrix_world=o.matrix_world.copy()
        for key in o.keys():p[key]=o[key]
        pivots[o]=p
    for o,p in pivots.items():
        if o.parent in pivots:
            world=p.matrix_world.copy();p.parent=pivots[o.parent];p.matrix_world=world
    for source in sources:
        if source.type not in ['MESH','CURVE']:continue
        evaluated=source.evaluated_get(deps)
        data=bpy.data.meshes.new_from_object(evaluated,depsgraph=deps)
        if not data or not len(data.vertices):continue
        o=bpy.data.objects.new(source.name,data);temporary.objects.link(o)
        o.matrix_world=source.matrix_world.copy()
        ancestor=source.parent
        while ancestor and ancestor not in pivots:ancestor=ancestor.parent
        if ancestor:
            world=o.matrix_world.copy();o.parent=pivots[ancestor];o.matrix_world=world
        material=tuple(m.name for m in o.data.materials)
        groups.setdefault((ancestor,material),[]).append(o)
    for (ancestor,material),objects in groups.items():
        bpy.ops.object.select_all(action='DESELECT')
        for o in objects:o.select_set(True)
        bpy.context.view_layer.objects.active=objects[0]
        bpy.ops.object.join()
        merged=bpy.context.object;merged.name=(original_names.get(ancestor,'Mesh'))+' / '+(' + '.join(material))
        created.append(merged)
    bpy.ops.object.select_all(action='DESELECT')
    for o in created:o.select_set(True)
    bpy.context.view_layer.objects.active=created[0]
    bpy.ops.export_scene.gltf(filepath=str(filepath),export_format='GLB',use_selection=True,export_apply=False,export_animations=False,export_cameras=False,export_lights=False,export_extras=True)
    for o in created:
        data=o.data if o.type=='MESH' else None
        bpy.data.objects.remove(o,do_unlink=True)
        if data and data.users==0:bpy.data.meshes.remove(data)
    bpy.data.collections.remove(temporary)
    for o,name in original_names.items():o.name=name
