import { access, readFile, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import { createPixeloramaProject } from "../dist/tools/createPixeloramaProject.js";
import { exportFromPixelorama } from "../dist/tools/exportFromPixelorama.js";
import { resetConfigCache } from "../dist/lib/config.js";

const projectRoot = process.cwd();
const configPath = path.join(projectRoot, "config", "sprite-forge.config.json");
const defaultConfigRaw = await readFile(configPath, "utf8");
const defaultConfig = JSON.parse(defaultConfigRaw);

async function withConfig(overrides, callback) {
  const nextConfig = {
    ...defaultConfig,
    ...overrides
  };

  await writeFile(configPath, `${JSON.stringify(nextConfig, null, 2)}\n`, "utf8");
  resetConfigCache();

  try {
    return await callback();
  } finally {
    await writeFile(configPath, `${JSON.stringify(defaultConfig, null, 2)}\n`, "utf8");
    resetConfigCache();
  }
}

async function assertExists(targetPath, label) {
  try {
    await access(targetPath, constants.F_OK);
  } catch {
    throw new Error(`${label} was not created: ${targetPath}`);
  }
}

async function main() {
  const disabledResult = await withConfig(
    {
      enablePixeloramaBridge: false,
      pixeloramaExecutablePath: null,
      pixeloramaProjectTemplatePath: null
    },
    async () =>
      createPixeloramaProject({
        spritePath: "examples/output/monsters/slime_t1.png",
        projectName: "slime_t1",
        category: "monsters",
        size: 32
      })
  );

  if (!disabledResult.bridge.warnings.some((warning) => warning.includes("disabled"))) {
    throw new Error("Expected a warning when the Pixelorama bridge is disabled.");
  }

  const missingExecutableResult = await withConfig(
    {
      enablePixeloramaBridge: true,
      pixeloramaExecutablePath: "tools/pixelorama/missing.exe",
      pixeloramaProjectTemplatePath: null
    },
    async () =>
      exportFromPixelorama({
        projectPath: "examples/pixelorama/monsters/slime_t1/slime_t1.pxo",
        outputPath: "examples/output/monsters/slime_t1_from_pixelorama.png"
      })
  );

  if (missingExecutableResult.exported !== false) {
    throw new Error("Expected export_from_pixelorama to stay non-fatal when the executable is missing.");
  }

  if (
    !missingExecutableResult.bridge.warnings.some((warning) =>
      warning.includes("not found")
    )
  ) {
    throw new Error("Expected a warning when the Pixelorama executable path is missing.");
  }

  const workspaceCreationResult = await withConfig(
    {
      enablePixeloramaBridge: false,
      pixeloramaExecutablePath: null,
      pixeloramaProjectTemplatePath: null
    },
    async () =>
      createPixeloramaProject({
        spritePath: "examples/output/monsters/slime_t1.png",
        projectName: "slime_t1_workspace",
        category: "monsters",
        size: 32
      })
  );

  const expectedProjectPath = path.join(
    projectRoot,
    "examples",
    "pixelorama",
    "monsters",
    "slime_t1_workspace",
    "slime_t1_workspace.pxo"
  );

  const expectedWorkspaceDir = path.dirname(expectedProjectPath);
  const expectedMetadataPath = path.join(expectedWorkspaceDir, "bridge-metadata.json");
  const expectedStagedSpritePath = path.join(
    expectedWorkspaceDir,
    "slime_t1_workspace.png"
  );

  await assertExists(expectedWorkspaceDir, "Pixelorama workspace directory");
  await assertExists(expectedProjectPath, "Pixelorama project file");
  await assertExists(expectedMetadataPath, "Pixelorama bridge metadata file");
  await assertExists(expectedStagedSpritePath, "Pixelorama staged sprite");

  console.log(
    JSON.stringify(
      {
        disabledResult,
        missingExecutableResult,
        workspaceCreationResult
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
