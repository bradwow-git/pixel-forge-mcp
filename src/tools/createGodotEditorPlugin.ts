import { writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { ensureDirectory, resolveProjectPath } from "../lib/paths.js";

export const createGodotEditorPluginInputSchema = {
  outputDir: z.string().min(1),
  pluginName: z.string().regex(/^[a-z0-9_]+$/),
  displayName: z.string().min(1),
  manifestPath: z.string().min(1)
};

type CreateGodotEditorPluginInput = z.infer<
  z.ZodObject<typeof createGodotEditorPluginInputSchema>
>;

function buildPluginConfig(
  pluginName: string,
  displayName: string
): string {
  return `[plugin]

name="${displayName}"
description="Browse Pixel Forge sprite manifests inside the Godot 4 editor."
author="pixel-forge-mcp"
version="1.0.0-rc1"
script="res://addons/${pluginName}/${pluginName}_plugin.gd"
`;
}

function buildPluginScript(pluginName: string): string {
  return `@tool
extends EditorPlugin

const DOCK_SCENE := preload("res://addons/${pluginName}/${pluginName}_dock.tscn")

var _dock: Control


func _enter_tree() -> void:
\t_dock = DOCK_SCENE.instantiate()
\tif _dock.has_method("set_editor_interface"):
\t\t_dock.call("set_editor_interface", get_editor_interface())
\tadd_control_to_dock(DOCK_SLOT_RIGHT_UL, _dock)


func _exit_tree() -> void:
\tif _dock != null:
\t\tremove_control_from_docks(_dock)
\t\t_dock.queue_free()
\t\t_dock = null
`;
}

function buildDockScript(displayName: string, manifestPath: string): string {
  return `@tool
extends Control

@export var manifest_path := "${manifestPath}"
@export var dry_run_install: bool = false

const CONTENT_SOURCE_ROOT := "res://addons/pixel_forge/../../content"
const CONTENT_TARGET_ROOT := "res://content"
const CONTENT_SUBDIRECTORIES := ["art", "resources", "scenes", "scripts"]
const TEST_SCENE_PATH := "res://content/scenes/test/PixelForgeMonsterTest.tscn"

var _entries: Array[Dictionary] = []
var _filtered_entries: Array[Dictionary] = []
var _selected_sprite_path: String = ""
var _editor_interface: EditorInterface

@onready var _header_label: Label = %HeaderLabel
@onready var _count_label: Label = %CountLabel
@onready var _reload_button: Button = %ReloadButton
@onready var _install_button: Button = %InstallButton
@onready var _open_scene_button: Button = %OpenSceneButton
@onready var _create_test_scene_button: Button = %CreateTestSceneButton
@onready var _category_filter: OptionButton = %CategoryFilter
@onready var _sprite_list: ItemList = %SpriteList
@onready var _details_text: RichTextLabel = %DetailsText
@onready var _copy_path_button: Button = %CopyPathButton
@onready var _status_label: Label = %StatusLabel


func set_editor_interface(editor_interface: EditorInterface) -> void:
\t_editor_interface = editor_interface


func _ready() -> void:
\t_header_label.text = "${displayName}"
\t_reload_button.pressed.connect(_on_reload_pressed)
\t_install_button.pressed.connect(_on_install_pressed)
\t_open_scene_button.pressed.connect(_on_open_scene_pressed)
\t_create_test_scene_button.pressed.connect(_on_create_test_scene_pressed)
\t_category_filter.item_selected.connect(_on_category_selected)
\t_sprite_list.item_selected.connect(_on_sprite_selected)
\t_copy_path_button.pressed.connect(_on_copy_path_pressed)
\t_open_scene_button.disabled = true
\t_create_test_scene_button.disabled = true
\t_set_status_label("Ready.")
\tload_manifest()


func load_manifest() -> void:
\t_entries.clear()
\t_filtered_entries.clear()
\t_selected_sprite_path = ""
\t_copy_path_button.disabled = true
\t_open_scene_button.disabled = true
\t_create_test_scene_button.disabled = true
\t_sprite_list.clear()
\t_details_text.clear()

\tif not FileAccess.file_exists(manifest_path):
\t\t_set_status("Manifest not found at %s" % manifest_path)
\t\t_rebuild_category_filter([])
\t\treturn

\tvar file := FileAccess.open(manifest_path, FileAccess.READ)
\tif file == null:
\t\t_set_status("Unable to open manifest at %s" % manifest_path)
\t\t_rebuild_category_filter([])
\t\treturn

\tvar raw_text := file.get_as_text()
\tfile.close()

\tvar json := JSON.new()
\tvar parse_error := json.parse(raw_text)
\tif parse_error != OK:
\t\t_set_status("Failed to parse manifest JSON at %s" % manifest_path)
\t\t_rebuild_category_filter([])
\t\treturn

\tvar data: Variant = json.data
\tif typeof(data) != TYPE_DICTIONARY:
\t\t_set_status("Manifest root must be a Dictionary.")
\t\t_rebuild_category_filter([])
\t\treturn

\tvar sprites: Variant = data.get("sprites", [])
\tif typeof(sprites) != TYPE_ARRAY:
\t\t_set_status("Manifest field 'sprites' must be an Array.")
\t\t_rebuild_category_filter([])
\t\treturn

\tfor sprite_variant in sprites:
\t\tif typeof(sprite_variant) != TYPE_DICTIONARY:
\t\t\tcontinue
\t\t_entries.append((sprite_variant as Dictionary).duplicate(true))

\t_rebuild_category_filter(_collect_categories())
\t_apply_category_filter()


func _collect_categories() -> Array[String]:
\tvar categories := {}
\tfor entry in _entries:
\t\tvar category := String(entry.get("category", "uncategorized"))
\t\tcategories[category] = true

\tvar sorted_categories := categories.keys()
\tsorted_categories.sort()
\tvar result: Array[String] = []
\tfor category_variant in sorted_categories:
\t\tresult.append(String(category_variant))
\treturn result


func _rebuild_category_filter(categories: Array[String]) -> void:
\t_category_filter.clear()
\t_category_filter.add_item("All")
\tfor category in categories:
\t\t_category_filter.add_item(category)
\t_category_filter.select(0)


func _apply_category_filter() -> void:
\t_sprite_list.clear()
\t_filtered_entries.clear()
\t_details_text.clear()
\t_selected_sprite_path = ""
\t_copy_path_button.disabled = true
\t_open_scene_button.disabled = true
\t_create_test_scene_button.disabled = true

\tvar selected_category := ""
\tif _category_filter.selected > 0:
\t\tselected_category = _category_filter.get_item_text(_category_filter.selected)

\tfor entry in _entries:
\t\tvar category := String(entry.get("category", ""))
\t\tif selected_category.is_empty() or category == selected_category:
\t\t\t_filtered_entries.append(entry)
\t\t\tvar sprite_id := String(entry.get("id", ""))
\t\t\tvar sprite_name := String(entry.get("name", ""))
\t\t\tvar display_text := sprite_id
\t\t\tif not sprite_name.is_empty():
\t\t\t\tdisplay_text = "%s - %s" % [sprite_id, sprite_name]
\t\t\t_sprite_list.add_item(display_text)

\t_count_label.text = "Sprites: %d" % _filtered_entries.size()
\tif _filtered_entries.is_empty():
\t\t_set_details_text("No sprites match the current filter.")
\t\t_set_status_label("Manifest loaded with no matching sprites.")
\telse:
\t\t_set_status_label("Manifest loaded successfully.")


func _set_status(message: String) -> void:
\t_count_label.text = "Sprites: 0"
\t_set_details_text(message)
\t_set_status_label(message)


func _set_status_label(message: String) -> void:
\t_status_label.text = "Status: %s" % message


func _set_details_text(message: String) -> void:
\t_details_text.clear()
\t_details_text.append_text(message)


func _format_entry_details(entry: Dictionary) -> String:
\tvar lines: Array[String] = []
\tvar scene_path := _infer_scene_path(entry)
\tlines.append("ID: %s" % String(entry.get("id", "")))
\tlines.append("Name: %s" % String(entry.get("name", "")))
\tlines.append("Category: %s" % String(entry.get("category", "")))
\tlines.append("Family: %s" % String(entry.get("family", "")))
\tlines.append("Tier: %s" % String(entry.get("tier", "")))
\tlines.append("Sprite Path: %s" % String(entry.get("spritePath", "")))
\tlines.append("Scene Path: %s" % scene_path)

\tif entry.has("frameCount"):
\t\tlines.append("")
\t\tlines.append("Animation: %s" % String(entry.get("animation", "")))
\t\tlines.append("Frame Width: %d" % int(entry.get("frameWidth", 0)))
\t\tlines.append("Frame Height: %d" % int(entry.get("frameHeight", 0)))
\t\tlines.append("Frame Count: %d" % int(entry.get("frameCount", 0)))
\t\tlines.append("FPS: %s" % String(entry.get("fps", 0)))
\t\tlines.append("Loop: %s" % String(entry.get("loop", true)))

\treturn "\\n".join(lines)


func _on_reload_pressed() -> void:
\tload_manifest()


func _on_install_pressed() -> void:
\tvar result := _install_content_pack()
\t_set_details_text(result.get("log", ""))
\t_set_status_label(String(result.get("summary", "Install completed.")))


func _on_category_selected(_index: int) -> void:
\t_apply_category_filter()


func _on_sprite_selected(index: int) -> void:
\tif index < 0 or index >= _filtered_entries.size():
\t\treturn

\tvar entry := _filtered_entries[index]
\t_selected_sprite_path = String(entry.get("spritePath", ""))
\t_copy_path_button.disabled = _selected_sprite_path.is_empty()
\t_open_scene_button.disabled = false
\t_create_test_scene_button.disabled = false
\t_set_details_text(_format_entry_details(entry))


func _on_copy_path_pressed() -> void:
\tif _selected_sprite_path.is_empty():
\t\treturn
\tDisplayServer.clipboard_set(_selected_sprite_path)
\t_set_status_label("Copied sprite path to clipboard.")


func _on_open_scene_pressed() -> void:
\tvar entry := _get_selected_entry()
\tif entry.is_empty():
\t\t_set_status_label("Select a monster entry before opening a scene.")
\t\treturn

\tvar scene_path := _infer_scene_path(entry)
\tif scene_path.is_empty():
\t\t_set_status_label("No scene path is available for the selected monster.")
\t\treturn

\tif not ResourceLoader.exists(scene_path):
\t\t_set_status_label("Monster scene not found at %s" % scene_path)
\t\treturn

\tif _editor_interface == null:
\t\t_set_status_label("Editor interface is unavailable. Reopen the plugin dock and try again.")
\t\treturn

\t_editor_interface.open_scene_from_path(scene_path)
\t_set_status_label("Opened monster scene %s" % scene_path)


func _on_create_test_scene_pressed() -> void:
\tvar entry := _get_selected_entry()
\tif entry.is_empty():
\t\t_set_status_label("Select a monster entry before creating a test scene.")
\t\treturn

\tvar test_scene_result := _create_test_scene(entry)
\t_set_details_text(String(test_scene_result.get("log", "")))
\t_set_status_label(String(test_scene_result.get("summary", "Test scene generated.")))


func _get_selected_entry() -> Dictionary:
\tvar selected_items := _sprite_list.get_selected_items()
\tif selected_items.is_empty():
\t\treturn {}

\tvar index := int(selected_items[0])
\tif index < 0 or index >= _filtered_entries.size():
\t\treturn {}

\treturn _filtered_entries[index]


func _infer_scene_path(entry: Dictionary) -> String:
\tvar configured_scene_path := String(entry.get("scenePath", ""))
\tif not configured_scene_path.is_empty():
\t\treturn configured_scene_path

\tvar sprite_id := String(entry.get("id", ""))
\tif sprite_id.is_empty():
\t\treturn ""

\treturn "res://content/scenes/monsters/%s.tscn" % sprite_id


func _create_test_scene(entry: Dictionary) -> Dictionary:
\tvar summary_lines: Array[String] = []
\tvar test_scene_dir := TEST_SCENE_PATH.get_base_dir()
\tDirAccess.make_dir_recursive_absolute(test_scene_dir)

\tvar root := Node2D.new()
\troot.name = "PixelForgeMonsterTest"

\tvar scene_path := _infer_scene_path(entry)
\tif not scene_path.is_empty() and ResourceLoader.exists(scene_path):
\t\tvar monster_scene := load(scene_path) as PackedScene
\t\tif monster_scene != null:
\t\t\tvar monster_instance := monster_scene.instantiate()
\t\t\tmonster_instance.name = "SelectedMonster"
\t\t\troot.add_child(monster_instance)
\t\t\tvar owner_root := root
\t\t\tmonster_instance.owner = owner_root
\t\t\tsummary_lines.append("Instanced monster scene %s" % scene_path)
\t\telse:
\t\t\tsummary_lines.append("Warning: scene exists but could not be instantiated: %s" % scene_path)
\telse:
\t\tsummary_lines.append("Warning: monster scene not found. Test scene was created without a monster instance.")

\tvar camera := Camera2D.new()
\tcamera.name = "Camera2D"
\tcamera.position = Vector2.ZERO
\tenable_camera(camera)
\troot.add_child(camera)
\tcamera.owner = root

\tvar light := PointLight2D.new()
\tlight.name = "PointLight2D"
\tlight.position = Vector2.ZERO
\tlight.energy = 0.75
\troot.add_child(light)
\tlight.owner = root

\tvar packed_scene := PackedScene.new()
\tvar pack_error := packed_scene.pack(root)
\tif pack_error != OK:
\t\troot.free()
\t\treturn {
\t\t\t"summary": "Failed to pack the test scene.",
\t\t\t"log": "PackedScene.pack returned error code %s" % String(pack_error)
\t\t}

\tvar save_error := ResourceSaver.save(packed_scene, TEST_SCENE_PATH)
\troot.free()
\tif save_error != OK:
\t\treturn {
\t\t\t"summary": "Failed to save the test scene.",
\t\t\t"log": "ResourceSaver.save returned error code %s" % String(save_error)
\t\t}

\tif _editor_interface != null:
\t\t_editor_interface.open_scene_from_path(TEST_SCENE_PATH)
\t\tsummary_lines.append("Opened test scene in the editor.")
\telse:
\t\tsummary_lines.append("Warning: editor interface unavailable, so the new test scene was not opened automatically.")

\treturn {
\t\t"summary": "Created test scene at %s" % TEST_SCENE_PATH,
\t\t"log": "\\n".join(summary_lines)
\t}


func enable_camera(camera: Camera2D) -> void:
\tcamera.enabled = true


func _install_content_pack() -> Dictionary:
\tvar source_root := CONTENT_SOURCE_ROOT
\tvar target_root := CONTENT_TARGET_ROOT
\tvar log_lines: Array[String] = []
\tvar copied_files := 0
\tvar skipped_files := 0
\tvar warnings := 0

\tif ProjectSettings.globalize_path(source_root) == ProjectSettings.globalize_path(target_root):
\t\tvar message := "Content source already resolves to res://content/. No copy was needed."
\t\treturn {
\t\t\t"summary": message,
\t\t\t"log": message
\t\t}

\tfor subdir in CONTENT_SUBDIRECTORIES:
\t\tvar source_dir := "%s/%s" % [source_root, subdir]
\t\tvar target_dir := "%s/%s" % [target_root, subdir]

\t\tDirAccess.make_dir_recursive_absolute(target_dir)

\t\tif not DirAccess.dir_exists_absolute(source_dir):
\t\t\twarnings += 1
\t\t\tlog_lines.append("Warning: missing source folder %s" % source_dir)
\t\t\tcontinue

\t\tvar copy_result := _copy_directory_recursive(source_dir, target_dir, dry_run_install)
\t\tcopied_files += int(copy_result.get("copied_files", 0))
\t\tskipped_files += int(copy_result.get("skipped_files", 0))
\t\twarnings += int(copy_result.get("warnings", 0))
\t\tvar copy_log: Array = copy_result.get("log_lines", [])
\t\tfor line_variant in copy_log:
\t\t\tlog_lines.append(String(line_variant))

\tvar summary := "Installed %d file(s)" % copied_files
\tif dry_run_install:
\t\tsummary = "Dry run complete. Would install %d file(s)" % copied_files
\tif skipped_files > 0:
\t\tsummary += ", skipped %d" % skipped_files
\tif warnings > 0:
\t\tsummary += ", warnings %d" % warnings

\tif log_lines.is_empty():
\t\tlog_lines.append(summary)

\treturn {
\t\t"summary": summary,
\t\t"log": "\\n".join(log_lines)
\t}


func _copy_directory_recursive(source_dir: String, target_dir: String, dry_run: bool) -> Dictionary:
\tvar log_lines: Array[String] = []
\tvar copied_files := 0
\tvar skipped_files := 0
\tvar warnings := 0
\tvar dir := DirAccess.open(source_dir)

\tif dir == null:
\t\treturn {
\t\t\t"copied_files": 0,
\t\t\t"skipped_files": 0,
\t\t\t"warnings": 1,
\t\t\t"log_lines": ["Warning: unable to open source folder %s" % source_dir]
\t\t}

\tdir.list_dir_begin()
\tvar entry_name := dir.get_next()
\twhile entry_name != "":
\t\tif entry_name == "." or entry_name == "..":
\t\t\tentry_name = dir.get_next()
\t\t\tcontinue

\t\tvar source_path := "%s/%s" % [source_dir, entry_name]
\t\tvar target_path := "%s/%s" % [target_dir, entry_name]

\t\tif dir.current_is_dir():
\t\t\tDirAccess.make_dir_recursive_absolute(target_path)
\t\t\tvar nested_result := _copy_directory_recursive(source_path, target_path, dry_run)
\t\t\tcopied_files += int(nested_result.get("copied_files", 0))
\t\t\tskipped_files += int(nested_result.get("skipped_files", 0))
\t\t\twarnings += int(nested_result.get("warnings", 0))
\t\t\tvar nested_log: Array = nested_result.get("log_lines", [])
\t\t\tfor line_variant in nested_log:
\t\t\t\tlog_lines.append(String(line_variant))
\t\telse:
\t\t\tif ProjectSettings.globalize_path(source_path) == ProjectSettings.globalize_path(target_path):
\t\t\t\tskipped_files += 1
\t\t\t\tlog_lines.append("Skipped already-installed file %s" % target_path)
\t\t\telif dry_run:
\t\t\t\tcopied_files += 1
\t\t\t\tlog_lines.append("Dry run: would copy %s -> %s" % [source_path, target_path])
\t\t\telse:
\t\t\t\tvar source_file := FileAccess.open(source_path, FileAccess.READ)
\t\t\t\tif source_file == null:
\t\t\t\t\twarnings += 1
\t\t\t\t\tlog_lines.append("Warning: unable to read %s" % source_path)
\t\t\t\telse:
\t\t\t\t\tvar bytes := source_file.get_buffer(source_file.get_length())
\t\t\t\t\tsource_file.close()
\t\t\t\t\tDirAccess.make_dir_recursive_absolute(target_dir)
\t\t\t\t\tvar target_file := FileAccess.open(target_path, FileAccess.WRITE)
\t\t\t\t\tif target_file == null:
\t\t\t\t\t\twarnings += 1
\t\t\t\t\t\tlog_lines.append("Warning: unable to write %s" % target_path)
\t\t\t\t\telse:
\t\t\t\t\t\ttarget_file.store_buffer(bytes)
\t\t\t\t\t\ttarget_file.close()
\t\t\t\t\t\tcopied_files += 1
\t\t\t\t\t\tlog_lines.append("Copied %s -> %s" % [source_path, target_path])

\t\tentry_name = dir.get_next()

\tdir.list_dir_end()

\treturn {
\t\t"copied_files": copied_files,
\t\t"skipped_files": skipped_files,
\t\t"warnings": warnings,
\t\t"log_lines": log_lines
\t}
`;
}

function buildDockScene(pluginName: string): string {
  return `[gd_scene load_steps=2 format=3]

[ext_resource type="Script" path="res://addons/${pluginName}/${pluginName}_dock.gd" id="1"]

[node name="PixelForgeDock" type="VBoxContainer"]
anchors_preset = 15
anchor_right = 1.0
anchor_bottom = 1.0
grow_horizontal = 2
grow_vertical = 2
theme_override_constants/separation = 8
script = ExtResource("1")

[node name="HeaderLabel" type="Label" parent="."]
unique_name_in_owner = true
text = "Pixel Forge"

[node name="Toolbar" type="HBoxContainer" parent="."]
theme_override_constants/separation = 8

[node name="ReloadButton" type="Button" parent="Toolbar"]
unique_name_in_owner = true
text = "Refresh Manifest"

[node name="InstallButton" type="Button" parent="Toolbar"]
unique_name_in_owner = true
text = "Install Content Pack"

[node name="OpenSceneButton" type="Button" parent="Toolbar"]
unique_name_in_owner = true
text = "Open Monster Scene"
disabled = true

[node name="CreateTestSceneButton" type="Button" parent="Toolbar"]
unique_name_in_owner = true
text = "Create Test Scene"
disabled = true

[node name="CountLabel" type="Label" parent="Toolbar"]
unique_name_in_owner = true
size_flags_horizontal = 3
text = "Sprites: 0"

[node name="CategoryLabel" type="Label" parent="."]
text = "Category Filter"

[node name="CategoryFilter" type="OptionButton" parent="."]
unique_name_in_owner = true

[node name="SpriteList" type="ItemList" parent="."]
unique_name_in_owner = true
size_flags_vertical = 3
allow_reselect = true

[node name="DetailsLabel" type="Label" parent="."]
text = "Selected Sprite Details"

[node name="DetailsText" type="RichTextLabel" parent="."]
unique_name_in_owner = true
size_flags_vertical = 3
bbcode_enabled = false
fit_content = false
scroll_active = true

[node name="CopyPathButton" type="Button" parent="."]
unique_name_in_owner = true
text = "Copy Sprite Path"
disabled = true

[node name="StatusLabel" type="Label" parent="."]
unique_name_in_owner = true
autowrap_mode = 3
text = "Status: Ready."
`;
}

function buildPluginReadme(
  pluginName: string,
  displayName: string
): string {
  return `# ${displayName} Godot Editor Plugin

This folder was generated by \`pixel-forge-mcp\`.

## Copy into a Godot project

1. Copy \`addons/${pluginName}\` into your Godot 4 project at \`res://addons/${pluginName}\`.
2. Copy the generated \`content/\` folder into your Godot project at \`res://content/\`.

## Enable the plugin

1. Open **Project Settings > Plugins** in Godot 4.
2. Enable **${displayName}**.

## Use the dock

Once enabled, the plugin adds a dock on the right side of the editor. Use it to:

- refresh \`sprite_manifest.json\`
- filter sprites by category
- browse sprite ids and names
- inspect sprite paths and animation metadata
- use the **Copy Sprite Path** button to copy the selected sprite path into the clipboard
- use **Install Content Pack** to copy bundled Pixel Forge content into \`res://content/\`
- use **Open Monster Scene** to open the selected monster scene in the Godot editor
- use **Create Test Scene** to build \`res://content/scenes/test/PixelForgeMonsterTest.tscn\` and open it for quick checks

## Install button behavior

- The dock looks for a sibling \`content/\` folder relative to the plugin bundle.
- It copies files into \`res://content/\`.
- It ensures the expected directories exist: \`art/\`, \`resources/\`, \`scenes/\`, and \`scripts/\`.
- Existing files overwrite earlier versions safely.
- Missing source folders are reported as warnings instead of crashing the plugin.
- If the content source already resolves to \`res://content/\`, the dock reports that the content is already in place.

## Expected folder structure

- \`res://addons/${pluginName}/\`
- \`res://content/art/\`
- \`res://content/resources/\`
- \`res://content/scenes/\`
- \`res://content/scripts/\`

The plugin expects the manifest at \`res://content/sprite_manifest.json\` unless you regenerate it with a different manifest path.

## Monster scene path convention

- If a manifest entry includes \`scenePath\`, the dock uses that scene directly.
- Otherwise the dock infers \`res://content/scenes/monsters/<id>.tscn\`.
- The generated test scene is written to \`res://content/scenes/test/PixelForgeMonsterTest.tscn\`.
`;
}

export async function createGodotEditorPlugin(
  input: CreateGodotEditorPluginInput
) {
  const outputDir = resolveProjectPath(input.outputDir);
  const pluginDir = path.join(outputDir, "addons", input.pluginName);
  const pluginConfigPath = path.join(pluginDir, "plugin.cfg");
  const pluginScriptPath = path.join(
    pluginDir,
    `${input.pluginName}_plugin.gd`
  );
  const dockScriptPath = path.join(pluginDir, `${input.pluginName}_dock.gd`);
  const dockScenePath = path.join(pluginDir, `${input.pluginName}_dock.tscn`);
  const readmePath = path.join(pluginDir, "README_PIXEL_FORGE_PLUGIN.md");

  await ensureDirectory(pluginDir);
  await writeFile(
    pluginConfigPath,
    buildPluginConfig(input.pluginName, input.displayName),
    "utf8"
  );
  await writeFile(pluginScriptPath, buildPluginScript(input.pluginName), "utf8");
  await writeFile(
    dockScriptPath,
    buildDockScript(input.displayName, input.manifestPath),
    "utf8"
  );
  await writeFile(dockScenePath, buildDockScene(input.pluginName), "utf8");
  await writeFile(
    readmePath,
    buildPluginReadme(input.pluginName, input.displayName),
    "utf8"
  );

  return {
    outputDir,
    pluginName: input.pluginName,
    displayName: input.displayName,
    manifestPath: input.manifestPath,
    pluginConfigPath,
    pluginScriptPath,
    dockScriptPath,
    dockScenePath,
    readmePath
  };
}
