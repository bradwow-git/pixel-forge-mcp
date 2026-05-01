import { copyFile, readFile } from "node:fs/promises";
import path from "node:path";
import { createAnimationManifestEntry } from "../dist/tools/createAnimationManifestEntry.js";
import { createAnimationStrip } from "../dist/tools/createAnimationStrip.js";

const projectRoot = process.cwd();

async function main() {
  const baseFramePath = path.join(projectRoot, "examples", "output", "monsters", "slime_t1.png");
  const frameOnePath = path.join(
    projectRoot,
    "examples",
    "output",
    "monsters",
    "slime_idle_01.png"
  );
  const frameTwoPath = path.join(
    projectRoot,
    "examples",
    "output",
    "monsters",
    "slime_idle_02.png"
  );

  await copyFile(baseFramePath, frameOnePath);
  await copyFile(baseFramePath, frameTwoPath);

  const stripResult = await createAnimationStrip({
    framePaths: [
      "examples/output/monsters/slime_idle_01.png",
      "examples/output/monsters/slime_idle_02.png"
    ],
    outputPath: "examples/output/monsters/slime_idle_strip.png",
    frameWidth: 32,
    frameHeight: 32,
    direction: "horizontal"
  });

  if (stripResult.frameCount !== stripResult.framePaths.length) {
    throw new Error("Animation strip frameCount did not match the number of provided frame paths.");
  }

  const manifestResult = await createAnimationManifestEntry({
    manifestPath: "examples/manifests/test-sprites.json",
    id: "slime_t1_idle",
    name: "Slime Idle",
    category: "monsters",
    family: "ooze",
    tier: 1,
    spritePath: "res://content/art/monsters/slime_idle_strip.png",
    frameWidth: 32,
    frameHeight: 32,
    frameCount: stripResult.framePaths.length,
    fps: 6,
    loop: true,
    animation: "idle",
    stripDirection: "horizontal"
  });

  const manifestPath = path.join(projectRoot, "examples", "manifests", "test-sprites.json");
  const manifestRaw = await readFile(manifestPath, "utf8");
  const manifestDocument = JSON.parse(manifestRaw);
  const matchingEntry = manifestDocument.sprites.find((entry) => entry.id === "slime_t1_idle");

  if (!matchingEntry) {
    throw new Error("Animation manifest entry was not written to the manifest file.");
  }

  if (matchingEntry.frameCount !== 2) {
    throw new Error("Animation manifest frameCount did not match the expected frame count.");
  }

  if (matchingEntry.stripDirection !== "horizontal") {
    throw new Error("Animation manifest stripDirection did not match the expected direction.");
  }

  console.log(
    JSON.stringify(
      {
        stripResult,
        manifestResult
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
