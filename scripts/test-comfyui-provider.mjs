import { readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { generateSpriteFromPrompt } from "../dist/tools/generateSpriteFromPrompt.js";
import { resetConfigCache } from "../dist/lib/config.js";

const projectRoot = process.cwd();
const configPath = path.join(projectRoot, "config", "sprite-forge.config.json");
const testWorkflowPath = path.join(
  projectRoot,
  "config",
  "comfyui",
  "test_text_to_image_workflow.json"
);

async function main() {
  const originalConfigText = await readFile(configPath, "utf8");
  const originalConfig = JSON.parse(originalConfigText);

  const mockWorkflow = {
    "1": {
      class_type: "CLIPTextEncode",
      inputs: {
        text: "{{PROMPT}}"
      }
    },
    "2": {
      class_type: "CLIPTextEncode",
      inputs: {
        text: "{{NEGATIVE_PROMPT}}"
      }
    },
    "3": {
      class_type: "EmptyLatentImage",
      inputs: {
        width: "{{WIDTH}}",
        height: "{{HEIGHT}}",
        batch_size: 1
      }
    },
    "4": {
      class_type: "KSampler",
      inputs: {
        seed: "{{SEED}}"
      }
    }
  };

  try {
    await writeFile(
      testWorkflowPath,
      `${JSON.stringify(mockWorkflow, null, 2)}\n`,
      "utf8"
    );

    const testConfig = {
      ...originalConfig,
      comfyuiBaseUrl: "http://127.0.0.1:65531",
      comfyuiWorkflowPath: "config/comfyui/test_text_to_image_workflow.json",
      comfyuiTimeoutMs: 2000
    };

    await writeFile(configPath, `${JSON.stringify(testConfig, null, 2)}\n`, "utf8");
    resetConfigCache();

    let unreachableMessage = "";

    try {
      await generateSpriteFromPrompt({
        id: "comfyui_unreachable_t1",
        name: "ComfyUI Unreachable",
        prompt: "glowing swamp ooze monster",
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

      throw new Error("Expected unreachable ComfyUI request to fail.");
    } catch (error) {
      unreachableMessage = error instanceof Error ? error.message : String(error);
      if (!unreachableMessage.includes("Make sure ComfyUI is running")) {
        throw new Error(
          `Expected clear unreachable ComfyUI message, received: ${unreachableMessage}`
        );
      }
    }

    const fallbackResult = await generateSpriteFromPrompt({
      id: "comfyui_fallback_t1",
      name: "ComfyUI Fallback",
      prompt: "glowing fallback ooze monster",
      category: "monsters",
      family: "ooze",
      tier: 1,
      palette: "toxic",
      size: 32,
      provider: "comfyui",
      negativePrompt: "blurry, noisy, text, watermark",
      seed: 67890,
      width: 512,
      height: 512,
      allowProviderFallback: true,
      manifestPath: "examples/manifests/test-sprites.json"
    });

    if (!fallbackResult.source.fallbackUsed) {
      throw new Error(
        "Expected allowProviderFallback=true to use the placeholder provider."
      );
    }

    if (fallbackResult.source.requestedProvider !== "comfyui") {
      throw new Error("Fallback result did not retain the requested provider.");
    }

    console.log(
      JSON.stringify(
        {
          unreachableMessage,
          fallbackResult
        },
        null,
        2
      )
    );
  } finally {
    await writeFile(configPath, originalConfigText, "utf8");
    resetConfigCache();
    await rm(testWorkflowPath, { force: true });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
