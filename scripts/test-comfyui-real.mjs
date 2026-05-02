import { readFile } from "node:fs/promises";
import path from "node:path";
import { loadConfig, resetConfigCache } from "../dist/lib/config.js";
import { generateSpriteFromPrompt } from "../dist/tools/generateSpriteFromPrompt.js";

const projectRoot = process.cwd();

async function canReach(url, timeoutMs) {
  const controller = new AbortController();
  const handle = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: "GET",
      signal: controller.signal
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(handle);
  }
}

async function main() {
  resetConfigCache();
  const config = await loadConfig();
  const workflowPath = path.join(projectRoot, config.comfyuiWorkflowPath);
  const rawWorkflow = await readFile(workflowPath, "utf8").catch(() => null);

  console.log(`Configured ComfyUI base URL: ${config.comfyuiBaseUrl}`);
  console.log(`Configured workflow path: ${workflowPath}`);

  if (!(await canReach(config.comfyuiBaseUrl, 3000))) {
    console.warn(
      `Warning: ComfyUI is not reachable at ${config.comfyuiBaseUrl}. Start ComfyUI and try again.`
    );
    process.exit(0);
  }

  if (rawWorkflow === null) {
    console.warn(
      `Warning: workflow file not found at ${workflowPath}. Export a ComfyUI API workflow and update comfyuiWorkflowPath.`
    );
    process.exit(0);
  }

  const parsedWorkflow = JSON.parse(rawWorkflow);
  if (parsedWorkflow && parsedWorkflow._pixelForgeExample === true) {
    console.warn(
      "Warning: the configured ComfyUI workflow is still the placeholder example. Replace it with a real API-format workflow export first."
    );
    process.exit(0);
  }

  const result = await generateSpriteFromPrompt({
    id: "comfyui_real_smoke_t1",
    name: "ComfyUI Real Smoke",
    prompt: "small toxic green slime monster, glowing eyes, dark fantasy pixel art concept",
    category: "monsters",
    family: "ooze",
    tier: 1,
    palette: "toxic",
    size: 32,
    provider: "comfyui",
    negativePrompt: "blurry, noisy, text, watermark",
    seed: 12345,
    width: 512,
    height: 512,
    allowProviderFallback: false,
    manifestPath: "examples/manifests/test-sprites.json"
  });

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
