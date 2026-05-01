import { access, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import { createGodotSpriteFrames } from "../dist/tools/createGodotSpriteFrames.js";

const projectRoot = process.cwd();

async function assertExists(targetPath, label) {
  try {
    await access(targetPath, constants.F_OK);
  } catch {
    throw new Error(`${label} was not created: ${targetPath}`);
  }
}

async function main() {
  const result = await createGodotSpriteFrames({
    manifestPath: "examples/godot-import-pack/content/sprite_manifest.json",
    outputDir: "examples/godot-import-pack",
    spriteFramesDir: "content/resources/spriteframes"
  });

  const resourcesDir = path.join(
    projectRoot,
    "examples",
    "godot-import-pack",
    "content",
    "resources",
    "spriteframes"
  );
  const spriteFramesPath = path.join(resourcesDir, "slime_t1_idle.tres");
  const readmePath = path.join(resourcesDir, "README_SPRITEFRAMES.md");

  await assertExists(spriteFramesPath, "SpriteFrames resource");
  await assertExists(readmePath, "SpriteFrames README");

  const spriteFramesText = await readFile(spriteFramesPath, "utf8");
  const readmeText = await readFile(readmePath, "utf8");

  const requiredResourceSnippets = [
    '[gd_resource type="SpriteFrames"',
    '[ext_resource type="Texture2D" path="res://content/art/monsters/slime_idle_strip.png" id="1"]',
    '[sub_resource type="AtlasTexture" id="AtlasTexture_1"]',
    'region = Rect2(0, 0, 32, 32)',
    'region = Rect2(32, 0, 32, 32)',
    '"name": &"idle"',
    '"speed": 6',
    '"loop": true'
  ];

  for (const snippet of requiredResourceSnippets) {
    if (!spriteFramesText.includes(snippet)) {
      throw new Error(`SpriteFrames resource is missing expected content: ${snippet}`);
    }
  }

  const requiredReadmeSnippets = [
    "may be horizontal or vertical",
    "defaults to `horizontal`",
    "SpriteFrames",
    "limitations"
  ];

  for (const snippet of requiredReadmeSnippets) {
    if (!readmeText.includes(snippet)) {
      throw new Error(`SpriteFrames README is missing expected content: ${snippet}`);
    }
  }

  if (result.resourceCount < 1) {
    throw new Error("Expected at least one generated SpriteFrames resource.");
  }

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
