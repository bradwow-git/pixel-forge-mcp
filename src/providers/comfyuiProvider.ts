import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomInt } from "node:crypto";
import { ensureParentDirectory, resolveProjectPath } from "../lib/paths.js";
import { loadConfig } from "../lib/config.js";

export interface ComfyUiGenerationInput {
  id: string;
  prompt: string;
  negativePrompt: string;
  seed: number;
  width: number;
  height: number;
}

export interface ComfyUiGenerationResult {
  provider: "comfyui";
  sourcePath: string;
  outputPath: string;
  promptId: string;
  image: {
    filename: string;
    subfolder: string;
    type: string;
  };
  baseUrl: string;
}

type ComfyImageRecord = {
  filename: string;
  subfolder?: string;
  type?: string;
};

function withTimeout(
  timeoutMs: number
): { signal: AbortSignal; cancel: () => void } {
  const controller = new AbortController();
  const handle = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  return {
    signal: controller.signal,
    cancel: () => clearTimeout(handle)
  };
}

function replaceWorkflowPlaceholders(
  rawWorkflow: string,
  input: ComfyUiGenerationInput
): string {
  return rawWorkflow
    .replaceAll("{{PROMPT}}", input.prompt)
    .replaceAll("{{NEGATIVE_PROMPT}}", input.negativePrompt)
    .replaceAll("{{SEED}}", String(input.seed))
    .replaceAll("{{WIDTH}}", String(input.width))
    .replaceAll("{{HEIGHT}}", String(input.height));
}

function getComfyUiErrorMessage(baseUrl: string): string {
  return `ComfyUI provider could not reach ${baseUrl}. Make sure ComfyUI is running and the API is available.`;
}

function collectImageRecords(value: unknown): ComfyImageRecord[] {
  const images: ComfyImageRecord[] = [];

  const visit = (current: unknown) => {
    if (Array.isArray(current)) {
      for (const item of current) {
        visit(item);
      }
      return;
    }

    if (!current || typeof current !== "object") {
      return;
    }

    const currentRecord = current as Record<string, unknown>;
    if (typeof currentRecord.filename === "string") {
      images.push({
        filename: currentRecord.filename,
        subfolder:
          typeof currentRecord.subfolder === "string"
            ? currentRecord.subfolder
            : "",
        type:
          typeof currentRecord.type === "string"
            ? currentRecord.type
            : "output"
      });
    }

    for (const value of Object.values(currentRecord)) {
      visit(value);
    }
  };

  visit(value);
  return images;
}

async function fetchJson(
  url: string,
  init: RequestInit,
  timeoutMs: number,
  unreachableMessage: string
): Promise<unknown> {
  const timeout = withTimeout(timeoutMs);

  try {
    const response = await fetch(url, {
      ...init,
      signal: timeout.signal
    });

    if (!response.ok) {
      throw new Error(
        `ComfyUI request failed (${response.status} ${response.statusText}) at ${url}`
      );
    }

    return response.json();
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`ComfyUI request timed out after ${timeoutMs}ms at ${url}`);
    }

    if (error instanceof Error) {
      if (
        error.message.includes("fetch failed") ||
        error.message.includes("ECONNREFUSED")
      ) {
        throw new Error(unreachableMessage);
      }

      throw error;
    }

    throw new Error(unreachableMessage);
  } finally {
    timeout.cancel();
  }
}

async function fetchBuffer(
  url: string,
  timeoutMs: number,
  unreachableMessage: string
): Promise<Buffer> {
  const timeout = withTimeout(timeoutMs);

  try {
    const response = await fetch(url, {
      method: "GET",
      signal: timeout.signal
    });

    if (!response.ok) {
      throw new Error(
        `ComfyUI image download failed (${response.status} ${response.statusText}) at ${url}`
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`ComfyUI image download timed out after ${timeoutMs}ms at ${url}`);
    }

    if (error instanceof Error) {
      if (
        error.message.includes("fetch failed") ||
        error.message.includes("ECONNREFUSED")
      ) {
        throw new Error(unreachableMessage);
      }

      throw error;
    }

    throw new Error(unreachableMessage);
  } finally {
    timeout.cancel();
  }
}

export async function generateWithComfyUi(
  input: ComfyUiGenerationInput
): Promise<ComfyUiGenerationResult> {
  const config = await loadConfig();
  const baseUrl = config.comfyuiBaseUrl.replace(/\/+$/, "");
  const workflowPath = resolveProjectPath(config.comfyuiWorkflowPath);
  const outputPath = resolveProjectPath(
    path.join(config.generatedSourceDir, `${input.id}.png`)
  );
  const unreachableMessage = getComfyUiErrorMessage(baseUrl);
  const rawWorkflow = await readFile(workflowPath, "utf8");

  const parsedPlaceholderCheck = JSON.parse(rawWorkflow) as Record<string, unknown>;
  if (parsedPlaceholderCheck._pixelForgeExample === true) {
    throw new Error(
      `Configured ComfyUI workflow is still the placeholder example: ${config.comfyuiWorkflowPath}. Export a real API-format workflow from ComfyUI and replace that file first.`
    );
  }

  const hydratedWorkflowText = replaceWorkflowPlaceholders(rawWorkflow, input);
  const workflow = JSON.parse(hydratedWorkflowText) as Record<string, unknown>;
  const promptResponse = (await fetchJson(
    `${baseUrl}/prompt`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ prompt: workflow })
    },
    config.comfyuiTimeoutMs,
    unreachableMessage
  )) as { prompt_id?: string };

  const promptId = promptResponse.prompt_id;
  if (!promptId) {
    throw new Error("ComfyUI did not return a prompt_id from /prompt.");
  }

  const startedAt = Date.now();
  let historyPayload: unknown = null;
  while (Date.now() - startedAt < config.comfyuiTimeoutMs) {
    historyPayload = await fetchJson(
      `${baseUrl}/history/${promptId}`,
      {
        method: "GET"
      },
      config.comfyuiTimeoutMs,
      unreachableMessage
    );

    const matchingEntry =
      historyPayload &&
      typeof historyPayload === "object" &&
      !Array.isArray(historyPayload)
        ? (historyPayload as Record<string, unknown>)[promptId]
        : null;

    const images = collectImageRecords(matchingEntry);
    if (images.length > 0) {
      const image = images[0];
      const params = new URLSearchParams({
        filename: image.filename,
        subfolder: image.subfolder ?? "",
        type: image.type ?? "output"
      });
      const buffer = await fetchBuffer(
        `${baseUrl}/view?${params.toString()}`,
        config.comfyuiTimeoutMs,
        unreachableMessage
      );

      await ensureParentDirectory(outputPath);
      await writeFile(outputPath, buffer);

      return {
        provider: "comfyui",
        sourcePath: path.relative(resolveProjectPath("."), outputPath),
        outputPath,
        promptId,
        image: {
          filename: image.filename,
          subfolder: image.subfolder ?? "",
          type: image.type ?? "output"
        },
        baseUrl
      };
    }

    await new Promise((resolve) => setTimeout(resolve, 1500));
  }

  throw new Error(
    `ComfyUI did not produce an image before timeout (${config.comfyuiTimeoutMs}ms) for prompt_id ${promptId}.`
  );
}

export function createDefaultComfyUiSeed(): number {
  return randomInt(0, 2_147_483_647);
}
