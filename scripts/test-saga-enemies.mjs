import { readFile } from "node:fs/promises";
import path from "node:path";
import { createSagaEnemyData } from "../dist/tools/createSagaEnemyData.js";

const projectRoot = process.cwd();

async function main() {
  const result = await createSagaEnemyData({
    monsterSpecPath: "examples/specs/w01_oozes.json",
    spriteManifestPath: "examples/manifests/test-sprites.json",
    outputPath: "examples/saga/enemies_w01_oozes.json"
  });

  const outputPath = path.join(projectRoot, "examples", "saga", "enemies_w01_oozes.json");
  const outputDocument = JSON.parse(await readFile(outputPath, "utf8"));

  if (!Array.isArray(outputDocument.enemies) || outputDocument.enemies.length < 2) {
    throw new Error("SAGA enemy export did not produce the expected enemy array.");
  }

  const slime = outputDocument.enemies.find((enemy) => enemy.id === "slime_t1");
  const acidSlime = outputDocument.enemies.find((enemy) => enemy.id === "acid_slime_t2");

  if (!slime || !acidSlime) {
    throw new Error("Expected exported SAGA enemy data for both slime_t1 and acid_slime_t2.");
  }

  if (slime.stats.hp !== 30 || slime.stats.attack !== 6) {
    throw new Error("Tier-based default stats did not apply correctly to slime_t1.");
  }

  if (acidSlime.stats.attack !== 11 || acidSlime.stats.credits !== 12) {
    throw new Error("SAGA enemy stat overrides did not merge correctly for acid_slime_t2.");
  }

  if (!acidSlime.abilities.includes("acid_splash") || !acidSlime.tags.includes("acid")) {
    throw new Error("SAGA enemy ability or tag overrides were not preserved.");
  }

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
