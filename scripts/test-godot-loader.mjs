import { access, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import { createGodotLoaderStub } from "../dist/tools/createGodotLoaderStub.js";

const projectRoot = process.cwd();

async function assertExists(targetPath, label) {
  try {
    await access(targetPath, constants.F_OK);
  } catch {
    throw new Error(`${label} was not created: ${targetPath}`);
  }
}

async function main() {
  const result = await createGodotLoaderStub({
    outputDir: "examples/godot-import-pack",
    className: "SpriteManifestLoader"
  });

  const scriptPath = path.join(
    projectRoot,
    "examples",
    "godot-import-pack",
    "godot",
    "scripts",
    "SpriteManifestLoader.gd"
  );
  const readmePath = path.join(
    projectRoot,
    "examples",
    "godot-import-pack",
    "godot",
    "scripts",
    "README_GODOT_LOADER.md"
  );

  await assertExists(scriptPath, "Godot loader script");
  await assertExists(readmePath, "Godot loader README");

  const scriptText = await readFile(scriptPath, "utf8");
  const readmeText = await readFile(readmePath, "utf8");

  const requiredScriptSnippets = [
    "extends Node",
    "class_name SpriteManifestLoader",
    "func get_sprite(id: String) -> Dictionary:",
    "func get_sprite_path(id: String) -> String:",
    "func get_animation(id: String) -> Dictionary:",
    "func has_sprite(id: String) -> bool:",
    "func list_by_category(category: String) -> Array[Dictionary]:",
    "JSON.new()",
    "res://content/sprite_manifest.json"
  ];

  for (const snippet of requiredScriptSnippets) {
    if (!scriptText.includes(snippet)) {
      throw new Error(`Generated GDScript is missing expected content: ${snippet}`);
    }
  }

  const requiredReadmeSnippets = [
    "Autoload",
    "Sprite2D",
    "AnimatedSprite2D",
    "res://content/"
  ];

  for (const snippet of requiredReadmeSnippets) {
    if (!readmeText.includes(snippet)) {
      throw new Error(`Generated Godot loader README is missing expected content: ${snippet}`);
    }
  }

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
