import { readFile } from "node:fs/promises";
import path from "node:path";
import { createPixeloramaProject } from "../dist/tools/createPixeloramaProject.js";
import { exportFromPixelorama } from "../dist/tools/exportFromPixelorama.js";
import { pathExists, resolveProjectPath } from "../dist/lib/paths.js";

const projectRoot = process.cwd();
const configPath = path.join(projectRoot, "config", "sprite-forge.config.json");

function printResult(prefix, payload) {
  console.log(`${prefix}\n${JSON.stringify(payload, null, 2)}\n`);
}

async function main() {
  const config = JSON.parse(await readFile(configPath, "utf8"));

  if (!config.enablePixeloramaBridge) {
    console.log(
      [
        "Pixelorama real smoke test skipped.",
        "Warning: enablePixeloramaBridge is false in config/sprite-forge.config.json.",
        "Set it to true to run the optional real executable check."
      ].join("\n")
    );
    return;
  }

  if (!config.pixeloramaExecutablePath) {
    console.log(
      [
        "Pixelorama real smoke test skipped.",
        "Warning: pixeloramaExecutablePath is not configured in config/sprite-forge.config.json.",
        "Set it to your local Pixelorama executable to run the optional real executable check."
      ].join("\n")
    );
    return;
  }

  const resolvedExecutablePath = resolveProjectPath(config.pixeloramaExecutablePath);
  const executableExists = await pathExists(resolvedExecutablePath);

  console.log(`Configured Pixelorama executable: ${config.pixeloramaExecutablePath}`);
  console.log(`Resolved Pixelorama executable: ${resolvedExecutablePath}`);
  console.log(`Executable exists: ${executableExists}\n`);

  const projectResult = await createPixeloramaProject({
    spritePath: "examples/output/monsters/slime_t1.png",
    projectName: "slime_t1_real_smoke",
    category: "monsters",
    size: 32
  });

  printResult("Pixelorama workspace creation result:", projectResult);

  if (!executableExists || !projectResult.bridge.executableFound) {
    console.log(
      [
        "Pixelorama export smoke test skipped.",
        `Warning: configured executable was not found at ${resolvedExecutablePath}.`,
        "Workspace creation succeeded, but export_from_pixelorama was not attempted."
      ].join("\n")
    );
    return;
  }

  const exportResult = await exportFromPixelorama({
    projectPath: "examples/pixelorama/monsters/slime_t1_real_smoke/slime_t1_real_smoke.pxo",
    outputPath: "examples/output/monsters/slime_t1_real_smoke_from_pixelorama.png"
  });

  printResult("Pixelorama export result:", exportResult);

  if (exportResult.exported && exportResult.method === "pixelorama-cli") {
    console.log(
      [
        "Pixelorama real smoke test completed.",
        "Success: the configured executable path exists and a real Pixelorama CLI export completed."
      ].join("\n")
    );
    return;
  }

  if (exportResult.exported && exportResult.method === "fallback-copy") {
    console.log(
      [
        "Pixelorama real smoke test completed with fallback export.",
        "Warning: the executable exists, but Pixel Forge had to fall back to copying the staged sprite.",
        "Check the bridge warnings above to see why CLI export did not finish cleanly."
      ].join("\n")
    );
    return;
  }

  console.log(
    [
      "Pixelorama real smoke test completed with warnings.",
      "The executable exists, but export_from_pixelorama did not report an export.",
      "Check the bridge warnings above for details."
    ].join("\n")
  );
}

main().catch((error) => {
  console.error(
    [
      "Pixelorama real smoke test failed.",
      error instanceof Error ? error.message : String(error)
    ].join("\n")
  );
  process.exit(1);
});
