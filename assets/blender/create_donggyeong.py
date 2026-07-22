"""Build the Blender scene directly from the user-provided Donggyeong GLB."""

from pathlib import Path
from math import radians

import bpy
import bmesh
from mathutils import Matrix, Vector


ROOT = Path(__file__).resolve().parent
SOURCE_GLB = Path("/Users/yondori/Downloads/Meshy_AI_Sunny_Shiba_540_0706192625_texture.glb")
BLEND_PATH = ROOT / "donggyeong.blend"
FRONT_RENDER = ROOT / "donggyeong-preview.png"
THREE_QUARTER_RENDER = ROOT / "donggyeong-preview-3q.png"
WAVE_UP_RENDER = ROOT / "donggyeong-wave-up.png"
CLAY_RENDER = ROOT / "donggyeong-clay-preview.png"
ANIMATED_GLB = ROOT / "donggyeong-arm-wave.glb"


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for datablocks in (bpy.data.meshes, bpy.data.curves, bpy.data.materials, bpy.data.cameras, bpy.data.lights):
        for datablock in list(datablocks):
            if datablock.users == 0:
                datablocks.remove(datablock)


def import_source_mesh():
    if not SOURCE_GLB.exists():
        raise FileNotFoundError(f"Source GLB not found: {SOURCE_GLB}")

    bpy.ops.import_scene.gltf(filepath=str(SOURCE_GLB))
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    if len(meshes) != 1:
        raise RuntimeError(f"Expected one mesh in source GLB, found {len(meshes)}")

    mesh = meshes[0]
    mesh.name = "Donggyeong_SourceMesh"
    mesh.data.name = "Donggyeong_HighDensityMesh"
    for polygon in mesh.data.polygons:
        polygon.use_smooth = True
    mesh.select_set(True)
    return mesh


def repair_chin(mesh):
    bm = bmesh.new()
    bm.from_mesh(mesh.data)
    bm.verts.ensure_lookup_table()
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.00045)
    bm.to_mesh(mesh.data)
    bm.free()
    mesh.data.update()

    group = mesh.vertex_groups.new(name="ChinRepair")
    for vertex in mesh.data.vertices:
        x_weight = max(0.0, 1.0 - abs(vertex.co.x) / 0.38)
        z_weight = max(0.0, 1.0 - abs(vertex.co.z + 0.01) / 0.13)
        y_weight = max(0.0, min(1.0, (-vertex.co.y - 0.34) / 0.18))
        weight = x_weight * z_weight * y_weight
        if weight > 0:
            group.add([vertex.index], weight, "REPLACE")

    modifier = mesh.modifiers.new("Chin surface relaxation", "SMOOTH")
    modifier.factor = 0.12
    modifier.iterations = 2
    modifier.vertex_group = group.name
    bpy.context.view_layer.objects.active = mesh
    mesh.select_set(True)
    bpy.ops.object.modifier_apply(modifier=modifier.name)


def color_ramp(nodes, low, high):
    ramp = nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].position = low
    ramp.color_ramp.elements[0].color = (0, 0, 0, 1)
    ramp.color_ramp.elements[1].position = high
    ramp.color_ramp.elements[1].color = (1, 1, 1, 1)
    return ramp


def add_fur_detail(mesh):
    material = mesh.data.materials[0]
    material.name = "Donggyeong_2K_Textured_Fur"
    material.use_nodes = True
    nodes = material.node_tree.nodes
    links = material.node_tree.links

    principled = next(node for node in nodes if node.type == "BSDF_PRINCIPLED")
    base_socket = principled.inputs["Base Color"]
    roughness_socket = principled.inputs["Roughness"]
    normal_socket = principled.inputs["Normal"]
    base_source = base_socket.links[0].from_socket
    roughness_source = roughness_socket.links[0].from_socket
    original_normal = normal_socket.links[0].from_socket

    # The source material is a single atlas. Bright, rough texels identify the
    # golden and white fur while excluding glossy eyes, nose, pads, medal, and stand.
    hsv = nodes.new("ShaderNodeSeparateColor")
    hsv.mode = "HSV"
    links.new(base_source, hsv.inputs["Color"])
    brightness_mask = color_ramp(nodes, 0.22, 0.46)
    links.new(hsv.outputs["Blue"], brightness_mask.inputs["Fac"])
    roughness_mask = color_ramp(nodes, 0.36, 0.64)
    links.new(roughness_source, roughness_mask.inputs["Fac"])

    fur_mask = nodes.new("ShaderNodeMixRGB")
    fur_mask.blend_type = "MULTIPLY"
    fur_mask.inputs[0].default_value = 1.0
    links.new(brightness_mask.outputs["Color"], fur_mask.inputs[1])
    links.new(roughness_mask.outputs["Color"], fur_mask.inputs[2])

    texcoord = nodes.new("ShaderNodeTexCoord")
    grain = nodes.new("ShaderNodeTexNoise")
    grain.noise_dimensions = "3D"
    grain.inputs["Scale"].default_value = 175.0
    grain.inputs["Detail"].default_value = 3.0
    grain.inputs["Roughness"].default_value = 0.76
    micro = nodes.new("ShaderNodeTexNoise")
    micro.noise_dimensions = "3D"
    micro.inputs["Scale"].default_value = 480.0
    micro.inputs["Detail"].default_value = 1.2
    micro.inputs["Roughness"].default_value = 0.68
    links.new(texcoord.outputs["Generated"], grain.inputs["Vector"])
    links.new(texcoord.outputs["Generated"], micro.inputs["Vector"])

    combined_grain = nodes.new("ShaderNodeMixRGB")
    combined_grain.blend_type = "MULTIPLY"
    combined_grain.inputs[0].default_value = 0.68
    links.new(grain.outputs["Fac"], combined_grain.inputs[1])
    links.new(micro.outputs["Fac"], combined_grain.inputs[2])

    masked_grain = nodes.new("ShaderNodeMixRGB")
    masked_grain.blend_type = "MULTIPLY"
    masked_grain.inputs[0].default_value = 1.0
    links.new(combined_grain.outputs["Color"], masked_grain.inputs[1])
    links.new(fur_mask.outputs["Color"], masked_grain.inputs[2])

    bump = nodes.new("ShaderNodeBump")
    bump.name = "Short_Fur_Detail"
    bump.inputs["Strength"].default_value = 0.22
    bump.inputs["Distance"].default_value = 0.007
    links.new(masked_grain.outputs["Color"], bump.inputs["Height"])
    links.new(original_normal, bump.inputs["Normal"])
    links.new(bump.outputs["Normal"], normal_socket)
    return normal_socket, original_normal, bump.outputs["Normal"]


def parent_keep_transform(obj, parent):
    matrix = obj.matrix_world.copy()
    obj.parent = parent
    obj.matrix_parent_inverse = parent.matrix_world.inverted()
    obj.matrix_world = matrix


def create_arm_pivots():
    pivots = {}
    for side, sign in (("L", -1), ("R", 1)):
        pivot = bpy.data.objects.new(f"ArmPivot.{side}", None)
        pivot.empty_display_type = "PLAIN_AXES"
        pivot.empty_display_size = 0.08
        pivot.location = (sign * 0.35, 0.0, -0.18)
        bpy.context.scene.collection.objects.link(pivot)
        pivots[side] = pivot
    return pivots


def add_accessory_sockets(mesh, arm_pivots):
    sockets = []
    socket_specs = {
        "Socket.Head": (0.0, 0.0, 0.82),
        "Socket.Face": (0.0, -0.55, 0.42),
        "Socket.Neck": (0.0, -0.15, -0.02),
        "Socket.Back": (0.0, 0.48, -0.12),
    }
    for name, location in socket_specs.items():
        socket = bpy.data.objects.new(name, None)
        socket.empty_display_type = "ARROWS"
        socket.empty_display_size = 0.07
        socket.location = location
        socket["socket_type"] = name.split(".")[-1].lower()
        bpy.context.scene.collection.objects.link(socket)
        parent_keep_transform(socket, mesh)
        sockets.append(socket)

    for side in ("L", "R"):
        socket = bpy.data.objects.new(f"Socket.Hand.{side}", None)
        socket.empty_display_type = "ARROWS"
        socket.empty_display_size = 0.045
        socket.location = ((-0.56 if side == "L" else 0.56), -0.45, -0.30)
        socket["socket_type"] = "hand"
        bpy.context.scene.collection.objects.link(socket)
        parent_keep_transform(socket, arm_pivots[side])
        sockets.append(socket)
    return sockets


def create_arm_wave(mesh, arm_pivots):
    mesh.shape_key_add(name="Basis")
    arms_up = mesh.shape_key_add(name="ArmsUp")

    for index, vertex in enumerate(mesh.data.vertices):
        co = vertex.co.copy()
        if not (-0.56 < co.z < 0.06):
            continue
        side = -1 if co.x < 0 else 1
        outward = abs(co.x)
        x_weight = max(0.0, min(1.0, (outward - 0.29) / 0.25))
        lower_weight = max(0.0, min(1.0, (co.z + 0.56) / 0.15))
        upper_weight = max(0.0, min(1.0, (0.06 - co.z) / 0.18))
        weight = x_weight * min(lower_weight, upper_weight)
        if weight == 0:
            continue
        pivot = Vector((side * 0.35, 0.0, -0.18))
        angle = radians(-side * 18)
        rotated = Matrix.Rotation(angle, 4, "Y") @ (co - pivot) + pivot
        arms_up.data[index].co = co.lerp(rotated, weight)

    keyframes = ((1, 0.0), (12, 1.0), (24, 0.0), (36, 1.0), (48, 0.0))
    for frame, value in keyframes:
        arms_up.value = value
        arms_up.keyframe_insert(data_path="value", frame=frame)
    if mesh.data.shape_keys.animation_data and mesh.data.shape_keys.animation_data.action:
        mesh.data.shape_keys.animation_data.action.name = "Donggyeong_ArmWave_Morph"

    for side, sign in (("L", -1), ("R", 1)):
        pivot = arm_pivots[side]
        pivot.rotation_mode = "XYZ"
        for frame, value in keyframes:
            pivot.rotation_euler[1] = radians(-sign * 18) * value
            pivot.keyframe_insert(data_path="rotation_euler", frame=frame)
        if pivot.animation_data and pivot.animation_data.action:
            pivot.animation_data.action.name = f"Donggyeong_ArmWave_{side}"

    scene = bpy.context.scene
    scene.frame_start = 1
    scene.frame_end = 48
    scene.render.fps = 24


def set_material_preview_on_open():
    for screen in bpy.data.screens:
        for area in screen.areas:
            if area.type == "VIEW_3D":
                area.spaces.active.shading.type = "MATERIAL"


def world_bounds(obj):
    corners = [obj.matrix_world @ Vector(corner) for corner in obj.bound_box]
    minimum = Vector((min(v.x for v in corners), min(v.y for v in corners), min(v.z for v in corners)))
    maximum = Vector((max(v.x for v in corners), max(v.y for v in corners), max(v.z for v in corners)))
    return minimum, maximum


def look_at(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()


def add_area_light(name, location, energy, size, color, target):
    data = bpy.data.lights.new(name, "AREA")
    data.energy = energy
    data.shape = "DISK"
    data.size = size
    data.color = color
    light = bpy.data.objects.new(name, data)
    bpy.context.scene.collection.objects.link(light)
    light.location = location
    look_at(light, target)


def setup_scene(mesh):
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 900
    scene.render.resolution_y = 1125
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.view_settings.look = "AgX - Medium High Contrast"
    scene.render.film_transparent = False

    minimum, maximum = world_bounds(mesh)
    center = (minimum + maximum) / 2
    height = maximum.z - minimum.z

    world = scene.world
    world.use_nodes = True
    background = world.node_tree.nodes.get("Background")
    background.inputs["Color"].default_value = (0.012, 0.018, 0.026, 1)
    background.inputs["Strength"].default_value = 0.28

    ground_material = bpy.data.materials.new("Studio_Ground")
    ground_material.diffuse_color = (0.055, 0.062, 0.07, 1)
    ground_material.use_nodes = True
    ground_bsdf = ground_material.node_tree.nodes.get("Principled BSDF")
    ground_bsdf.inputs["Base Color"].default_value = (0.055, 0.062, 0.07, 1)
    ground_bsdf.inputs["Roughness"].default_value = 0.78
    bpy.ops.mesh.primitive_plane_add(size=10, location=(center.x, center.y, minimum.z - 0.012))
    ground = bpy.context.object
    ground.name = "Studio_Ground"
    ground.data.materials.append(ground_material)

    bpy.ops.object.camera_add()
    camera = bpy.context.object
    camera.name = "Camera"
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = height * 1.22
    scene.camera = camera

    target = (center.x, center.y, center.z + height * 0.03)
    add_area_light("Key", (-2.7, -3.8, 3.4), 620, 2.5, (1.0, 0.72, 0.42), target)
    add_area_light("Fill", (2.8, -3.0, 2.2), 360, 2.2, (0.58, 0.76, 1.0), target)
    add_area_light("Rim", (2.4, 1.8, 3.0), 760, 2.0, (1.0, 0.44, 0.16), target)
    return camera, center, height


def set_front_camera(camera, center, height):
    camera.location = (center.x, center.y - height * 3.2, center.z + height * 0.02)
    look_at(camera, (center.x, center.y, center.z + height * 0.03))


def set_three_quarter_camera(camera, center, height):
    camera.location = (center.x + height * 2.0, center.y - height * 2.8, center.z + height * 0.35)
    look_at(camera, (center.x, center.y, center.z + height * 0.02))


def export_animated_glb(objects, normal_socket, original_normal, fur_normal):
    material = normal_socket.node.id_data
    links = material.links
    links.new(original_normal, normal_socket)

    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.export_scene.gltf(
        filepath=str(ANIMATED_GLB),
        export_format="GLB",
        use_selection=True,
        export_animations=True,
        export_cameras=False,
        export_lights=False,
        export_extras=True,
    )
    links.new(fur_normal, normal_socket)


def render_clay_preview(scene, camera, center, height):
    scene.frame_set(1)
    set_front_camera(camera, center, height)
    previous_engine = scene.render.engine
    scene.render.engine = "BLENDER_WORKBENCH"
    scene.display.shading.light = "STUDIO"
    scene.display.shading.color_type = "SINGLE"
    scene.display.shading.single_color = (0.62, 0.62, 0.62)
    scene.display.shading.show_shadows = True
    scene.display.shading.show_cavity = True
    scene.display.shading.cavity_type = "WORLD"
    scene.render.filepath = str(CLAY_RENDER)
    bpy.ops.render.render(write_still=True)
    scene.render.engine = previous_engine


def main():
    ROOT.mkdir(parents=True, exist_ok=True)
    clear_scene()
    mesh = import_source_mesh()
    repair_chin(mesh)
    normal_socket, original_normal, fur_normal = add_fur_detail(mesh)
    arm_pivots = create_arm_pivots()
    sockets = add_accessory_sockets(mesh, arm_pivots)
    create_arm_wave(mesh, arm_pivots)
    camera, center, height = setup_scene(mesh)
    scene = bpy.context.scene

    scene.frame_set(1)
    set_front_camera(camera, center, height)
    scene.render.filepath = str(FRONT_RENDER)
    bpy.ops.render.render(write_still=True)

    scene.frame_set(1)
    set_three_quarter_camera(camera, center, height)
    scene.render.filepath = str(THREE_QUARTER_RENDER)
    bpy.ops.render.render(write_still=True)

    scene.frame_set(12)
    set_front_camera(camera, center, height)
    scene.render.filepath = str(WAVE_UP_RENDER)
    bpy.ops.render.render(write_still=True)

    render_clay_preview(scene, camera, center, height)

    export_objects = [mesh, *arm_pivots.values(), *sockets]
    export_animated_glb(export_objects, normal_socket, original_normal, fur_normal)

    scene.frame_set(1)
    set_front_camera(camera, center, height)
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.filepath = str(FRONT_RENDER)
    set_material_preview_on_open()
    bpy.ops.file.pack_all()
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_PATH))
    print(f"Saved Blender scene: {BLEND_PATH}")
    print(f"Saved front render: {FRONT_RENDER}")
    print(f"Saved three-quarter render: {THREE_QUARTER_RENDER}")
    print(f"Saved arm-wave pose: {WAVE_UP_RENDER}")
    print(f"Saved clay preview: {CLAY_RENDER}")
    print(f"Saved animated GLB: {ANIMATED_GLB}")


if __name__ == "__main__":
    main()
