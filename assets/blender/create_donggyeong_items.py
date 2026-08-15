"""Generate the five wearable Donggyeong item GLBs used by the frontend."""

from math import cos, pi, radians, sin
from pathlib import Path

import bpy


REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
OUTPUT_DIR = REPOSITORY_ROOT / "frontend/public/models/donggyeong/items"


def three_position(x, y, z):
    """Convert the frontend's Three.js coordinates to Blender coordinates."""
    return (x, -z, y)


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for collection in (
        bpy.data.meshes,
        bpy.data.curves,
        bpy.data.materials,
    ):
        for datablock in list(collection):
            if datablock.users == 0:
                collection.remove(datablock)


def make_material(name, color, *, metallic=0.0, roughness=0.55, emission=None):
    material = bpy.data.materials.new(name)
    material.diffuse_color = (*color, 1.0)
    material.use_nodes = True
    principled = material.node_tree.nodes.get("Principled BSDF")
    principled.inputs["Base Color"].default_value = (*color, 1.0)
    principled.inputs["Metallic"].default_value = metallic
    principled.inputs["Roughness"].default_value = roughness
    if emission:
        principled.inputs["Emission Color"].default_value = (*emission, 1.0)
        principled.inputs["Emission Strength"].default_value = 1.8
    return material


def finish_object(obj, name, material):
    obj.name = name
    obj.data.name = f"{name}_Mesh"
    obj.data.materials.append(material)
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    return obj


def add_sphere(name, location, scale, material, rotation=(0, 0, 0)):
    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=28,
        ring_count=16,
        location=three_position(*location),
        rotation=rotation,
    )
    obj = finish_object(bpy.context.object, name, material)
    obj.scale = (scale[0], scale[2], scale[1])
    return obj


def add_cube(name, location, dimensions, material, rotation=(0, 0, 0), bevel=0.0):
    bpy.ops.mesh.primitive_cube_add(
        location=three_position(*location),
        rotation=rotation,
    )
    obj = finish_object(bpy.context.object, name, material)
    obj.dimensions = (dimensions[0], dimensions[2], dimensions[1])
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        modifier = obj.modifiers.new("Rounded edges", "BEVEL")
        modifier.width = bevel
        modifier.segments = 3
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.modifier_apply(modifier=modifier.name)
    return obj


def add_cylinder(
    name,
    location,
    radius,
    depth,
    material,
    *,
    rotation=(0, 0, 0),
    vertices=40,
):
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=vertices,
        radius=radius,
        depth=depth,
        location=three_position(*location),
        rotation=rotation,
    )
    return finish_object(bpy.context.object, name, material)


def add_cone(name, location, bottom_radius, top_radius, depth, material):
    bpy.ops.mesh.primitive_cone_add(
        vertices=56,
        radius1=bottom_radius,
        radius2=top_radius,
        depth=depth,
        location=three_position(*location),
    )
    return finish_object(bpy.context.object, name, material)


def add_torus(name, location, major_radius, minor_radius, material):
    bpy.ops.mesh.primitive_torus_add(
        major_segments=48,
        minor_segments=12,
        major_radius=major_radius,
        minor_radius=minor_radius,
        location=three_position(*location),
    )
    return finish_object(bpy.context.object, name, material)


def add_curve(name, points, bevel_depth, material):
    curve = bpy.data.curves.new(f"{name}_Curve", "CURVE")
    curve.dimensions = "3D"
    curve.resolution_u = 2
    curve.bevel_depth = bevel_depth
    curve.bevel_resolution = 3
    spline = curve.splines.new("BEZIER")
    spline.bezier_points.add(len(points) - 1)
    for point, coordinate in zip(spline.bezier_points, points):
        point.co = three_position(*coordinate)
        point.handle_left_type = "AUTO"
        point.handle_right_type = "AUTO"
    obj = bpy.data.objects.new(name, curve)
    bpy.context.scene.collection.objects.link(obj)
    curve.materials.append(material)
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.convert(target="MESH")
    return obj


def build_crown():
    gold = make_material("Crown_Gold", (0.83, 0.55, 0.10), metallic=0.72, roughness=0.24)
    jade = make_material("Crown_Jade", (0.10, 0.54, 0.43), metallic=0.08, roughness=0.28)
    add_torus("Crown_Band", (0, 2.05, -0.02), 0.88, 0.10, gold)
    for index, (x, height) in enumerate(((-0.62, 0.62), (-0.31, 0.82), (0, 1.02), (0.31, 0.82), (0.62, 0.62))):
        base_y = 2.06
        top_y = base_y + height
        add_curve(
            f"Crown_Branch_{index}",
            [(x, base_y, 0.04), (x, top_y, 0.08)],
            0.035,
            gold,
        )
        for direction in (-1, 1):
            branch_y = base_y + height * 0.56
            tip_x = x + direction * 0.17
            tip_y = branch_y + 0.17
            add_curve(
                f"Crown_Twig_{index}_{direction}",
                [(x, branch_y, 0.07), (tip_x, tip_y, 0.09)],
                0.026,
                gold,
            )
            add_sphere(
                f"Crown_Jade_{index}_{direction}",
                (tip_x, tip_y, 0.10),
                (0.055, 0.075, 0.035),
                jade,
            )
        add_sphere(
            f"Crown_Top_{index}",
            (x, top_y, 0.09),
            (0.07, 0.09, 0.04),
            gold,
        )


def build_lotus():
    pink = make_material("Lotus_Petal", (0.88, 0.31, 0.50), roughness=0.4)
    pale = make_material("Lotus_Highlight", (1.0, 0.69, 0.73), roughness=0.46)
    gold = make_material("Lotus_Cord", (0.77, 0.54, 0.18), metallic=0.4, roughness=0.3)
    center = (0, -0.68, 1.54)
    add_curve(
        "Lotus_Neck_Cord",
        [(-0.76, -0.28, 0.90), (-0.46, -0.58, 1.30), center, (0.46, -0.58, 1.30), (0.76, -0.28, 0.90)],
        0.025,
        gold,
    )
    for index in range(8):
        angle = index * pi / 4
        x = center[0] + cos(angle) * 0.20
        y = center[1] + sin(angle) * 0.20
        add_sphere(
            f"Lotus_Petal_{index}",
            (x, y, center[2]),
            (0.11, 0.22, 0.055),
            pink if index % 2 else pale,
            rotation=(0, -angle, 0),
        )
    add_sphere("Lotus_Center", center, (0.13, 0.13, 0.07), gold)


def build_hanbok():
    teal = make_material("Hanbok_Teal", (0.05, 0.43, 0.38), roughness=0.68)
    dark_teal = make_material("Hanbok_Trim", (0.02, 0.23, 0.23), roughness=0.52)
    cream = make_material("Hanbok_Collar", (0.94, 0.84, 0.66), roughness=0.62)
    gold = make_material("Hanbok_Knot", (0.78, 0.51, 0.12), metallic=0.3, roughness=0.35)
    add_cone("Hanbok_Robe", (0, -1.58, 0), 1.18, 0.78, 1.76, teal)
    add_torus("Hanbok_Waist_Band", (0, -1.45, 0), 0.96, 0.075, dark_teal)
    add_curve(
        "Hanbok_Left_Collar",
        [(-0.58, -0.67, 0.66), (0.02, -1.03, 1.02), (0.34, -1.43, 1.08)],
        0.055,
        cream,
    )
    add_curve(
        "Hanbok_Right_Collar",
        [(0.58, -0.67, 0.66), (-0.02, -1.03, 1.04), (-0.24, -1.34, 1.10)],
        0.055,
        cream,
    )
    add_curve(
        "Hanbok_Ribbon",
        [(0.18, -1.30, 1.09), (0.45, -1.58, 1.14), (0.36, -1.94, 1.16)],
        0.045,
        gold,
    )
    add_sphere("Hanbok_Knot", (0.16, -1.30, 1.10), (0.12, 0.10, 0.07), gold)


def build_camera():
    navy = make_material("Camera_Body", (0.08, 0.14, 0.25), metallic=0.3, roughness=0.34)
    black = make_material("Camera_Lens", (0.015, 0.02, 0.03), metallic=0.55, roughness=0.18)
    glass = make_material("Camera_Glass", (0.10, 0.34, 0.58), metallic=0.35, roughness=0.08)
    silver = make_material("Camera_Detail", (0.58, 0.64, 0.70), metallic=0.8, roughness=0.22)
    location = (1.25, -1.74, 0.72)
    add_cube("Camera_Body", location, (0.68, 0.46, 0.28), navy, bevel=0.06)
    add_cylinder(
        "Camera_Lens_Housing",
        (location[0], location[1], 0.92),
        0.20,
        0.25,
        black,
        rotation=(radians(90), 0, 0),
    )
    add_cylinder(
        "Camera_Lens_Glass",
        (location[0], location[1], 1.06),
        0.13,
        0.035,
        glass,
        rotation=(radians(90), 0, 0),
    )
    add_cube("Camera_Shutter", (1.04, -1.48, 0.72), (0.10, 0.06, 0.08), silver, bevel=0.02)
    add_curve(
        "Camera_Wrist_Strap",
        [(0.94, -1.56, 0.61), (0.82, -1.31, 0.50), (1.00, -1.12, 0.43), (1.18, -1.37, 0.51)],
        0.018,
        navy,
    )


def build_lantern():
    bronze = make_material("Lantern_Bronze", (0.45, 0.20, 0.06), metallic=0.58, roughness=0.3)
    warm = make_material(
        "Lantern_Glow",
        (1.0, 0.52, 0.10),
        roughness=0.22,
        emission=(1.0, 0.20, 0.02),
    )
    location = (1.30, -1.84, 0.66)
    add_cylinder("Lantern_Light", location, 0.25, 0.50, warm, vertices=48)
    add_torus("Lantern_Top", (location[0], -1.56, location[2]), 0.26, 0.045, bronze)
    add_torus("Lantern_Bottom", (location[0], -2.12, location[2]), 0.26, 0.045, bronze)
    for direction in (-1, 1):
        add_curve(
            f"Lantern_Frame_{direction}",
            [(location[0] + direction * 0.23, -2.09, location[2]), (location[0] + direction * 0.23, -1.58, location[2])],
            0.025,
            bronze,
        )
    add_curve(
        "Lantern_Handle",
        [(1.05, -1.57, 0.66), (1.05, -1.26, 0.66), (1.30, -1.08, 0.66), (1.55, -1.26, 0.66), (1.55, -1.57, 0.66)],
        0.035,
        bronze,
    )


ITEM_BUILDERS = {
    "crown": ("hat", build_crown),
    "lotus": ("accessory", build_lotus),
    "hanbok": ("clothes", build_hanbok),
    "camera": ("hand", build_camera),
    "lantern": ("hand", build_lantern),
}


def export_item(item_id, slot, builder):
    clear_scene()
    root = bpy.data.objects.new(f"DonggyeongItem_{item_id}", None)
    root["item_id"] = item_id
    root["slot"] = slot
    bpy.context.scene.collection.objects.link(root)
    builder()

    children = [obj for obj in bpy.context.scene.objects if obj != root]
    for child in children:
        child.parent = root

    bpy.ops.object.select_all(action="DESELECT")
    root.select_set(True)
    for child in children:
        child.select_set(True)
    bpy.context.view_layer.objects.active = root

    output_path = OUTPUT_DIR / f"{item_id}.glb"
    bpy.ops.export_scene.gltf(
        filepath=str(output_path),
        export_format="GLB",
        use_selection=True,
        export_animations=False,
        export_cameras=False,
        export_lights=False,
        export_extras=True,
        export_apply=True,
    )
    print(f"Exported {item_id}: {output_path}")


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    for item_id, (slot, builder) in ITEM_BUILDERS.items():
        export_item(item_id, slot, builder)


if __name__ == "__main__":
    main()
