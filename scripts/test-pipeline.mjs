import { pixelizeSprite } from "../dist/tools/pixelizeSprite.js";
import { enforcePalette } from "../dist/tools/enforcePalette.js";
import { exportSprite } from "../dist/tools/exportSprite.js";
import { createManifestEntry } from "../dist/tools/createManifestEntry.js";

async function main() {
  const pixelized = await pixelizeSprite({
    sourcePath: "examples/source/slime.png",
    outputName: "slime_t1",
    size: 32,
    category: "monsters"
  });

  const paletteResult = await enforcePalette({
    sourcePath: pixelized.relativeOutputPath,
    palette: "swamp"
  });

  const exported = await exportSprite({
    sourcePath: pixelized.relativeOutputPath,
    godotOutputDir: "res://content/art/monsters",
    fileName: "slime_t1.png"
  });

  const manifest = await createManifestEntry({
    manifestPath: "examples/manifests/test-sprites.json",
    id: "slime_t1",
    name: "Slime",
    category: "monsters",
    family: "ooze",
    tier: 1,
    spritePath: exported.spritePath
  });

  console.log(
    JSON.stringify(
      {
        pixelized,
        paletteResult,
        exported,
        manifest
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
