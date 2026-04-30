import { access, copyFile, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import { createGodotImportPack } from "../dist/tools/createGodotImportPack.js";

const projectRoot = process.cwd();

async function assertExists(targetPath, label) {
  try {
    await access(targetPath, constants.F_OK);
  } catch {
    throw new Error(`${label} was not created: ${targetPath}`);
  }
}

async function main() {
  const animationStripSource = path.join(
    projectRoot,
    "examples",
    "output",
    "monsters",
    "slime_idle_strip.png"
  );
  const animationStripGodotTarget = path.join(
    projectRoot,
    "examples",
    "godot-project",
    "content",
    "art",
    "monsters",
    "slime_idle_strip.png"
  );

  await copyFile(animationStripSource, animationStripGodotTarget);

  const packResult = await createGodotImportPack({
    manifestPath: "examples/manifests/test-sprites.json",
    outputDir: "examples/godot-import-pack"
  });

  const outputDir = path.join(projectRoot, "examples", "godot-import-pack");
  const copiedStaticSprite = path.join(outputDir, "content", "art", "monsters", "slime_t1.png");
  const copiedAnimationStrip = path.join(
    outputDir,
    "content",
    "art",
    "monsters",
    "slime_idle_strip.png"
  );
  const manifestOutputPath = path.join(outputDir, "content", "sprite_manifest.json");
  const readmeOutputPath = path.join(outputDir, "README_IMPORT.md");

  await assertExists(copiedStaticSprite, "Static sprite copy");
  await assertExists(copiedAnimationStrip, "Animation strip copy");
  await assertExists(manifestOutputPath, "Portable sprite manifest");
  await assertExists(readmeOutputPath, "Import README");

  const manifestDocument = JSON.parse(await readFile(manifestOutputPath, "utf8"));
  const animationEntry = manifestDocument.sprites.find((entry) => entry.id === "slime_t1_idle");

  if (!animationEntry) {
    throw new Error("Animation entry was not included in the Godot import pack manifest.");
  }

  if (animationEntry.frameCount !== 2 || animationEntry.animation !== "idle") {
    throw new Error("Animation metadata was not preserved in the Godot import pack manifest.");
  }

  console.log(JSON.stringify(packResult, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
