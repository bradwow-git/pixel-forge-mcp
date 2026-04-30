import { readFile } from "node:fs/promises";
import path from "node:path";
import { createWorldMonsterPack } from "../dist/tools/createWorldMonsterPack.js";

const projectRoot = process.cwd();

async function main() {
  const result = await createWorldMonsterPack({
    worldId: "w01",
    worldName: "Forest of Teeth",
    category: "monsters",
    families: [
      {
        family: "ooze",
        sourcePath: "examples/source/slime.png",
        tiers: [
          { tier: 1, id: "slime_t1", name: "Slime", palette: "swamp" },
          { tier: 2, id: "acid_slime_t2", name: "Acid Slime", palette: "toxic" }
        ]
      },
      {
        family: "beast",
        sourcePath: "examples/source/slime.png",
        tiers: [{ tier: 1, id: "fang_pup_t1", name: "Fang Pup", palette: "swamp" }]
      }
    ],
    size: 32,
    manifestPath: "examples/manifests/test-sprites.json",
    runMonsterPack: true,
    runSagaEnemyExport: true
  });

  const specPath = path.join(
    projectRoot,
    "examples",
    "specs",
    "generated",
    "worlds",
    "w01_monsters.json"
  );
  const sagaPath = path.join(projectRoot, "examples", "saga", "worlds", "w01_enemies.json");

  const specDocument = JSON.parse(await readFile(specPath, "utf8"));
  const sagaDocument = JSON.parse(await readFile(sagaPath, "utf8"));

  if (!Array.isArray(specDocument.monsters) || specDocument.monsters.length !== 3) {
    throw new Error("World monster pack spec did not contain the expected combined monster list.");
  }

  if (!result.monsterPackResult || result.monsterPackResult.failedCount !== 0) {
    throw new Error("runMonsterPack mode did not complete successfully for the world pack.");
  }

  if (!result.sagaEnemyResult || !Array.isArray(sagaDocument.enemies) || sagaDocument.enemies.length !== 3) {
    throw new Error("runSagaEnemyExport mode did not create the expected SAGA enemy output.");
  }

  const fangPupEnemy = sagaDocument.enemies.find((enemy) => enemy.id === "fang_pup_t1");
  if (!fangPupEnemy || fangPupEnemy.family !== "beast") {
    throw new Error("World SAGA export did not preserve per-family enemy metadata.");
  }

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
