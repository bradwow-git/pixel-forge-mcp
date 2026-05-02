import { access, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import { createGodotMonsterScenes } from "../dist/tools/createGodotMonsterScenes.js";
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
  await createGodotSpriteFrames({
    manifestPath: "examples/godot-import-pack/content/sprite_manifest.json",
    outputDir: "examples/godot-import-pack",
    spriteFramesDir: "content/resources/spriteframes"
  });

  const result = await createGodotMonsterScenes({
    manifestPath: "examples/godot-import-pack/content/sprite_manifest.json",
    outputDir: "examples/godot-import-pack",
    sceneRootDir: "content/scenes/monsters",
    baseScriptPath: "res://content/scripts/MonsterActor.gd"
  });

  const scenesDir = path.join(
    projectRoot,
    "examples",
    "godot-import-pack",
    "content",
    "scenes",
    "monsters"
  );
  const staticScenePath = path.join(scenesDir, "slime_t1.tscn");
  const animationScenePath = path.join(scenesDir, "slime_t1_idle.tscn");
  const actorScriptPath = path.join(
    projectRoot,
    "examples",
    "godot-import-pack",
    "content",
    "scripts",
    "MonsterActor.gd"
  );
  const readmePath = path.join(scenesDir, "README_MONSTER_SCENES.md");

  await assertExists(staticScenePath, "Static monster scene");
  await assertExists(animationScenePath, "Animated monster scene");
  await assertExists(actorScriptPath, "MonsterActor.gd");
  await assertExists(readmePath, "Monster scenes README");

  const staticSceneText = await readFile(staticScenePath, "utf8");
  const animationSceneText = await readFile(animationScenePath, "utf8");
  const actorScriptText = await readFile(actorScriptPath, "utf8");
  const readmeText = await readFile(readmePath, "utf8");

  const requiredStaticSceneSnippets = [
    'type="Sprite2D"',
    'script = ExtResource("1")',
    'metadata/sprite_id = "slime_t1"',
    'metadata/category = "monsters"',
    'metadata/sprite_path = "res://content/art/monsters/slime_t1.png"'
  ];

  for (const snippet of requiredStaticSceneSnippets) {
    if (!staticSceneText.includes(snippet)) {
      throw new Error(`Static scene is missing expected content: ${snippet}`);
    }
  }

  const requiredAnimationSceneSnippets = [
    'type="AnimatedSprite2D"',
    'type="SpriteFrames" path="res://content/resources/spriteframes/slime_t1_idle.tres" id="2"',
    'sprite_frames = ExtResource("2")',
    'autoplay = "idle"',
    'metadata/animation = "idle"',
    "metadata/frame_count = 2",
    "metadata/fps = 6",
    "metadata/loop = true"
  ];

  for (const snippet of requiredAnimationSceneSnippets) {
    if (!animationSceneText.includes(snippet)) {
      throw new Error(`Animation scene is missing expected content: ${snippet}`);
    }
  }

  const requiredActorScriptSnippets = [
    "extends Node2D",
    "class_name PixelForgeMonsterActor",
    "@export var sprite_id: String = \"\"",
    "@export var family: String = \"\"",
    "@export var tier: int = 1",
    "func get_summary() -> Dictionary:"
  ];

  for (const snippet of requiredActorScriptSnippets) {
    if (!actorScriptText.includes(snippet)) {
      throw new Error(`MonsterActor.gd is missing expected content: ${snippet}`);
    }
  }

  if (actorScriptText.includes("class_name MonsterActor")) {
    throw new Error("MonsterActor.gd should not declare class_name MonsterActor.");
  }

  const requiredReadmeSnippets = [
    "AnimatedSprite2D",
    "Sprite2D",
    "SpriteFrames",
    "If a matching SpriteFrames resource exists"
  ];

  for (const snippet of requiredReadmeSnippets) {
    if (!readmeText.includes(snippet)) {
      throw new Error(`Monster scenes README is missing expected content: ${snippet}`);
    }
  }

  if (result.sceneCount < 1) {
    throw new Error("Expected at least one generated monster scene.");
  }

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
