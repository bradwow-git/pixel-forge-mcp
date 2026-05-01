import { copyFile, readFile } from "node:fs/promises";
import path from "node:path";
import { createAnimationManifestEntry } from "../dist/tools/createAnimationManifestEntry.js";
import { createAnimationStrip } from "../dist/tools/createAnimationStrip.js";
import { createGodotImportPack } from "../dist/tools/createGodotImportPack.js";
import { createGodotSpriteFrames } from "../dist/tools/createGodotSpriteFrames.js";

const projectRoot = process.cwd();

async function main() {
  const baseFramePath = path.join(projectRoot, "examples", "output", "monsters", "slime_t1.png");
  const frameOnePath = path.join(
    projectRoot,
    "examples",
    "output",
    "monsters",
    "slime_vertical_01.png"
  );
  const frameTwoPath = path.join(
    projectRoot,
    "examples",
    "output",
    "monsters",
    "slime_vertical_02.png"
  );

  await copyFile(baseFramePath, frameOnePath);
  await copyFile(baseFramePath, frameTwoPath);

  const stripResult = await createAnimationStrip({
    framePaths: [
      "examples/output/monsters/slime_vertical_01.png",
      "examples/output/monsters/slime_vertical_02.png"
    ],
    outputPath: "examples/output/monsters/slime_vertical_strip.png",
    frameWidth: 32,
    frameHeight: 32,
    direction: "vertical"
  });

  const verticalStripGodotTarget = path.join(
    projectRoot,
    "examples",
    "godot-project",
    "content",
    "art",
    "monsters",
    "slime_vertical_strip.png"
  );

  await copyFile(path.join(projectRoot, "examples", "output", "monsters", "slime_vertical_strip.png"), verticalStripGodotTarget);

  await createAnimationManifestEntry({
    manifestPath: "examples/manifests/test-sprites.json",
    id: "slime_t1_vertical_idle",
    name: "Slime Vertical Idle",
    category: "monsters",
    family: "ooze",
    tier: 1,
    spritePath: "res://content/art/monsters/slime_vertical_strip.png",
    frameWidth: 32,
    frameHeight: 32,
    frameCount: stripResult.framePaths.length,
    fps: 6,
    loop: true,
    animation: "idle_vertical",
    stripDirection: "vertical"
  });

  await createGodotImportPack({
    manifestPath: "examples/manifests/test-sprites.json",
    outputDir: "examples/godot-import-pack"
  });

  const result = await createGodotSpriteFrames({
    manifestPath: "examples/godot-import-pack/content/sprite_manifest.json",
    outputDir: "examples/godot-import-pack",
    spriteFramesDir: "content/resources/spriteframes"
  });

  const spriteFramesPath = path.join(
    projectRoot,
    "examples",
    "godot-import-pack",
    "content",
    "resources",
    "spriteframes",
    "slime_t1_vertical_idle.tres"
  );

  const spriteFramesText = await readFile(spriteFramesPath, "utf8");

  const requiredVerticalSnippets = [
    'region = Rect2(0, 0, 32, 32)',
    'region = Rect2(0, 32, 32, 32)',
    '"name": &"idle_vertical"',
    '"loop": true'
  ];

  for (const snippet of requiredVerticalSnippets) {
    if (!spriteFramesText.includes(snippet)) {
      throw new Error(`Vertical SpriteFrames resource is missing expected content: ${snippet}`);
    }
  }

  if (spriteFramesText.includes("region = Rect2(32, 0, 32, 32)")) {
    throw new Error("Vertical SpriteFrames resource incorrectly used horizontal frame regions.");
  }

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
