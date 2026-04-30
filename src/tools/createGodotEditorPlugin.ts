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

var _entries: Array[Dictionary] = []
var _filtered_entries: Array[Dictionary] = []
var _selected_sprite_path: String = ""

@onready var _header_label: Label = %HeaderLabel
@onready var _count_label: Label = %CountLabel
@onready var _reload_button: Button = %ReloadButton
@onready var _category_filter: OptionButton = %CategoryFilter
@onready var _sprite_list: ItemList = %SpriteList
@onready var _details_text: RichTextLabel = %DetailsText
@onready var _copy_path_button: Button = %CopyPathButton


func _ready() -> void:
\t_header_label.text = "${displayName}"
\t_reload_button.pressed.connect(_on_reload_pressed)
\t_category_filter.item_selected.connect(_on_category_selected)
\t_sprite_list.item_selected.connect(_on_sprite_selected)
\t_copy_path_button.pressed.connect(_on_copy_path_pressed)
\tload_manifest()


func load_manifest() -> void:
\t_entries.clear()
\t_filtered_entries.clear()
\t_selected_sprite_path = ""
\t_copy_path_button.disabled = true
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


func _set_status(message: String) -> void:
\t_count_label.text = "Sprites: 0"
\t_set_details_text(message)


func _set_details_text(message: String) -> void:
\t_details_text.clear()
\t_details_text.append_text(message)


func _format_entry_details(entry: Dictionary) -> String:
\tvar lines: Array[String] = []
\tlines.append("ID: %s" % String(entry.get("id", "")))
\tlines.append("Name: %s" % String(entry.get("name", "")))
\tlines.append("Category: %s" % String(entry.get("category", "")))
\tlines.append("Family: %s" % String(entry.get("family", "")))
\tlines.append("Tier: %s" % String(entry.get("tier", "")))
\tlines.append("Sprite Path: %s" % String(entry.get("spritePath", "")))

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


func _on_category_selected(_index: int) -> void:
\t_apply_category_filter()


func _on_sprite_selected(index: int) -> void:
\tif index < 0 or index >= _filtered_entries.size():
\t\treturn

\tvar entry := _filtered_entries[index]
\t_selected_sprite_path = String(entry.get("spritePath", ""))
\t_copy_path_button.disabled = _selected_sprite_path.is_empty()
\t_set_details_text(_format_entry_details(entry))


func _on_copy_path_pressed() -> void:
\tif _selected_sprite_path.is_empty():
\t\treturn
\tDisplayServer.clipboard_set(_selected_sprite_path)
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
text = "Reload Manifest"

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

- reload \`sprite_manifest.json\`
- filter sprites by category
- browse sprite ids and names
- inspect sprite paths and animation metadata
- use the **Copy Sprite Path** button to copy the selected sprite path into the clipboard

The plugin expects the manifest at \`res://content/sprite_manifest.json\` unless you regenerate it with a different manifest path.
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
