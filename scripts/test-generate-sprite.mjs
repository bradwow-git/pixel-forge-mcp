import { access, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import { generateSpriteFromPrompt } from "../dist/tools/generateSpriteFromPrompt.js";

const projectRoot = process.cwd();

async function assertExists(targetPath, label) {
  try {
    await access(targetPath, constants.F_OK);
  } catch {
    throw new Error(`${label} was not created: ${targetPath}`);
  }
}

async function main() {
  const result = await generateSpriteFromPrompt({
    id: "toxic_slime_t1",
    name: "Toxic Slime",
    prompt:
      "small toxic green slime monster, glowing eyes, dark fantasy pixel art concept",
    category: "monsters",
    family: "ooze",
    tier: 1,
    palette: "toxic",
    size: 32,
    provider: "placeholder",
    manifestPath: "examples/manifests/test-sprites.json"
  });

  const generatedSourcePath = path.join(
    projectRoot,
    "examples",
    "source",
    "generated",
    "toxic_slime_t1.png"
  );
  const outputSpritePath = path.join(
    projectRoot,
    "examples",
    "output",
    "monsters",
    "toxic_slime_t1.png"
  );
  const manifestPath = path.join(
    projectRoot,
    "examples",
    "manifests",
    "test-sprites.json"
  );

  await assertExists(generatedSourcePath, "Generated placeholder source image");
  await assertExists(outputSpritePath, "Generated output sprite");

  const manifestDocument = JSON.parse(await readFile(manifestPath, "utf8"));
  const spriteEntries = Array.isArray(manifestDocument.sprites)
    ? manifestDocument.sprites
    : [];
  const entry = spriteEntries.find((currentEntry) => currentEntry.id === "toxic_slime_t1");

  if (!entry) {
    throw new Error("Manifest entry toxic_slime_t1 was not found after generation.");
  }

  if (entry.spritePath !== "res://content/art/monsters/toxic_slime_t1.png") {
    throw new Error(`Unexpected spritePath for toxic_slime_t1: ${entry.spritePath}`);
  }

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
