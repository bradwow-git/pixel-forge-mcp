import { access, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import { createGodotEditorPlugin } from "../dist/tools/createGodotEditorPlugin.js";

const projectRoot = process.cwd();

async function assertExists(targetPath, label) {
  try {
    await access(targetPath, constants.F_OK);
  } catch {
    throw new Error(`${label} was not created: ${targetPath}`);
  }
}

async function main() {
  const result = await createGodotEditorPlugin({
    outputDir: "examples/godot-import-pack",
    pluginName: "pixel_forge",
    displayName: "Pixel Forge",
    manifestPath: "res://content/sprite_manifest.json"
  });

  const pluginDir = path.join(
    projectRoot,
    "examples",
    "godot-import-pack",
    "addons",
    "pixel_forge"
  );
  const pluginConfigPath = path.join(pluginDir, "plugin.cfg");
  const pluginScriptPath = path.join(pluginDir, "pixel_forge_plugin.gd");
  const dockScriptPath = path.join(pluginDir, "pixel_forge_dock.gd");
  const dockScenePath = path.join(pluginDir, "pixel_forge_dock.tscn");
  const readmePath = path.join(pluginDir, "README_PIXEL_FORGE_PLUGIN.md");

  await assertExists(pluginConfigPath, "Godot plugin config");
  await assertExists(pluginScriptPath, "Godot plugin script");
  await assertExists(dockScriptPath, "Godot dock script");
  await assertExists(dockScenePath, "Godot dock scene");
  await assertExists(readmePath, "Godot plugin README");

  const pluginConfigText = await readFile(pluginConfigPath, "utf8");
  const pluginScriptText = await readFile(pluginScriptPath, "utf8");
  const dockScriptText = await readFile(dockScriptPath, "utf8");
  const dockSceneText = await readFile(dockScenePath, "utf8");
  const readmeText = await readFile(readmePath, "utf8");

  const requiredPluginConfigSnippets = [
    'script="res://addons/pixel_forge/pixel_forge_plugin.gd"',
    'name="Pixel Forge"',
    'version="1.0.0-rc1"'
  ];

  for (const snippet of requiredPluginConfigSnippets) {
    if (!pluginConfigText.includes(snippet)) {
      throw new Error(`Generated plugin.cfg is missing expected content: ${snippet}`);
    }
  }

  const requiredPluginScriptSnippets = [
    "@tool",
    "extends EditorPlugin",
    "DOCK_SLOT_RIGHT_UL",
    "remove_control_from_docks",
    'preload("res://addons/pixel_forge/pixel_forge_dock.tscn")',
    'set_editor_interface',
    "get_editor_interface()"
  ];

  for (const snippet of requiredPluginScriptSnippets) {
    if (!pluginScriptText.includes(snippet)) {
      throw new Error(`Generated plugin script is missing expected content: ${snippet}`);
    }
  }

  const requiredDockScriptSnippets = [
    "@tool",
    "extends Control",
    '@export var manifest_path := "res://content/sprite_manifest.json"',
    "const CONTENT_SOURCE_ROOT := \"res://addons/pixel_forge/../../content\"",
    "const CONTENT_TARGET_ROOT := \"res://content\"",
    "FileAccess.file_exists(manifest_path)",
    "DirAccess.make_dir_recursive_absolute(target_dir)",
    "JSON.new()",
    "DisplayServer.clipboard_set(_selected_sprite_path)",
    "func _on_install_pressed() -> void:",
    "func _install_content_pack() -> Dictionary:",
    'Manifest field \'sprites\' must be an Array.',
    'const TEST_SCENE_PATH := "res://content/scenes/test/PixelForgeMonsterTest.tscn"',
    "func _infer_scene_path(entry: Dictionary) -> String:",
    'return "res://content/scenes/monsters/%s.tscn" % sprite_id',
    "func _on_open_scene_pressed() -> void:",
    "func _on_create_test_scene_pressed() -> void:",
    "func _create_test_scene(entry: Dictionary) -> Dictionary:",
    "ResourceLoader.exists(scene_path)",
    "PackedScene.new()",
    "ResourceSaver.save(packed_scene, TEST_SCENE_PATH)",
    "_editor_interface.open_scene_from_path(scene_path)",
    "_editor_interface.open_scene_from_path(TEST_SCENE_PATH)"
  ];

  for (const snippet of requiredDockScriptSnippets) {
    if (!dockScriptText.includes(snippet)) {
      throw new Error(`Generated dock script is missing expected content: ${snippet}`);
    }
  }

  const requiredDockSceneSnippets = [
    'script = ExtResource("1")',
    'path="res://addons/pixel_forge/pixel_forge_dock.gd"',
    'name="InstallButton"',
    'text = "Install Content Pack"',
    'name="OpenSceneButton"',
    'text = "Open Monster Scene"',
    'name="CreateTestSceneButton"',
    'text = "Create Test Scene"',
    'name="StatusLabel"',
    'name="CategoryFilter"',
    'name="SpriteList"',
    'name="DetailsText"'
  ];

  for (const snippet of requiredDockSceneSnippets) {
    if (!dockSceneText.includes(snippet)) {
      throw new Error(`Generated dock scene is missing expected content: ${snippet}`);
    }
  }

  const requiredReadmeSnippets = [
    "Project Settings > Plugins",
    "res://content/",
    "sprite_manifest.json",
    "Copy Sprite Path",
    "Install Content Pack",
    "Open Monster Scene",
    "Create Test Scene",
    "overwrite",
    "Missing source folders are reported as warnings",
    "res://content/scenes/monsters/<id>.tscn",
    "PixelForgeMonsterTest.tscn"
  ];

  for (const snippet of requiredReadmeSnippets) {
    if (!readmeText.includes(snippet)) {
      throw new Error(`Generated plugin README is missing expected content: ${snippet}`);
    }
  }

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
