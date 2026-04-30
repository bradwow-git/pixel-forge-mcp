import { readFile } from "node:fs/promises";
import path from "node:path";
import { createMonsterPack } from "../dist/tools/createMonsterPack.js";

const projectRoot = process.cwd();

async function main() {
  const specPath = path.join(projectRoot, "examples", "specs", "w01_oozes.json");
  const spec = JSON.parse(await readFile(specPath, "utf8"));

  const successResult = await createMonsterPack(spec);

  if (successResult.createdCount + successResult.updatedCount < 2) {
    throw new Error("Monster pack did not process the expected number of successful entries.");
  }

  if (successResult.failedCount !== 0) {
    throw new Error("Expected the example monster pack to complete without failures.");
  }

  const failingResult = await createMonsterPack({
    ...spec,
    packName: "w01_oozes_with_failure",
    monsters: [
      ...spec.monsters,
      {
        id: "broken_slime_t9",
        name: "Broken Slime",
        tier: 9,
        sourcePath: "examples/source/does_not_exist.png",
        palette: "swamp",
        size: 32
      }
    ]
  });

  if (failingResult.failedCount !== 1) {
    throw new Error("Expected one per-monster failure in the mixed batch test.");
  }

  const failedEntry = failingResult.results.find((entry) => entry.id === "broken_slime_t9");
  if (!failedEntry || failedEntry.status !== "failed") {
    throw new Error("Expected the broken monster result to be reported as failed.");
  }

  console.log(
    JSON.stringify(
      {
        successResult,
        failingResult
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
