import { readFile } from "node:fs/promises";
import path from "node:path";
import { createFamilyTierLadder } from "../dist/tools/createFamilyTierLadder.js";

const projectRoot = process.cwd();

async function main() {
  const baseInput = {
    family: "ooze",
    category: "monsters",
    packName: "w01_ooze_ladder",
    sourcePath: "examples/source/slime.png",
    manifestPath: "examples/manifests/test-sprites.json",
    tiers: [
      { tier: 1, id: "slime_t1", name: "Slime", palette: "swamp" },
      { tier: 2, id: "acid_slime_t2", name: "Acid Slime", palette: "toxic" },
      { tier: 3, id: "bog_slime_t3", name: "Bog Slime", palette: "swamp" }
    ],
    size: 32
  };

  const specOnlyResult = await createFamilyTierLadder(baseInput);
  const generatedSpecPath = path.join(
    projectRoot,
    "examples",
    "specs",
    "generated",
    "w01_ooze_ladder.json"
  );
  const generatedSpec = JSON.parse(await readFile(generatedSpecPath, "utf8"));

  if (!Array.isArray(generatedSpec.monsters) || generatedSpec.monsters.length !== 3) {
    throw new Error("Generated family ladder spec did not contain the expected monsters.");
  }

  const runPackResult = await createFamilyTierLadder({
    ...baseInput,
    packName: "w01_ooze_ladder_run",
    runMonsterPack: true
  });

  if (!runPackResult.monsterPackResult) {
    throw new Error("Expected runMonsterPack mode to return a monster pack result.");
  }

  if (runPackResult.monsterPackResult.failedCount !== 0) {
    throw new Error("Expected runMonsterPack mode to complete without failures.");
  }

  const manifestPath = path.join(projectRoot, "examples", "manifests", "test-sprites.json");
  const manifestDocument = JSON.parse(await readFile(manifestPath, "utf8"));
  const bogSlimeEntry = manifestDocument.sprites.find((entry) => entry.id === "bog_slime_t3");

  if (!bogSlimeEntry) {
    throw new Error("runMonsterPack mode did not create the bog_slime_t3 manifest entry.");
  }

  console.log(
    JSON.stringify(
      {
        specOnlyResult,
        runPackResult
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
