import { readFile, writeFile } from "node:fs/promises";
import { loadConfig } from "./config.js";
import {
  ensureParentDirectory,
  pathExists,
  resolveProjectPath
} from "./paths.js";

export interface BaseManifestEntry {
  id: string;
  [key: string]: unknown;
}

export async function readManifestEntries<T extends BaseManifestEntry>(
  manifestPathInput: string
): Promise<{ manifestPath: string; entries: T[] }> {
  const config = await loadConfig();
  const manifestPath = resolveProjectPath(manifestPathInput);

  if (!(await pathExists(manifestPath))) {
    throw new Error(`Manifest file not found: ${manifestPathInput}`);
  }

  const manifestDocument = JSON.parse(await readFile(manifestPath, "utf8"));

  if (!manifestDocument || typeof manifestDocument !== "object") {
    throw new Error(`Manifest file is not a JSON object: ${manifestPathInput}`);
  }

  const entries = Array.isArray(manifestDocument[config.manifestCollectionKey])
    ? (manifestDocument[config.manifestCollectionKey] as T[])
    : [];

  return {
    manifestPath,
    entries
  };
}

export async function upsertManifestEntry<T extends BaseManifestEntry>(
  manifestPathInput: string,
  entry: T
) {
  const config = await loadConfig();
  const manifestPath = resolveProjectPath(manifestPathInput);

  await ensureParentDirectory(manifestPath);

  const baseDocument: Record<string, unknown> = {
    [config.manifestCollectionKey]: []
  };

  const manifestDocument = (await pathExists(manifestPath))
    ? JSON.parse(await readFile(manifestPath, "utf8"))
    : baseDocument;

  if (!manifestDocument || typeof manifestDocument !== "object") {
    throw new Error(`Manifest file is not a JSON object: ${manifestPathInput}`);
  }

  const entries = Array.isArray(manifestDocument[config.manifestCollectionKey])
    ? (manifestDocument[config.manifestCollectionKey] as T[])
    : [];

  const existingIndex = entries.findIndex((currentEntry) => currentEntry.id === entry.id);

  if (existingIndex >= 0) {
    entries[existingIndex] = entry;
  } else {
    entries.push(entry);
  }

  manifestDocument[config.manifestCollectionKey] = entries;

  await writeFile(manifestPath, `${JSON.stringify(manifestDocument, null, 2)}\n`, "utf8");

  return {
    manifestPath: manifestPathInput,
    entry,
    action: existingIndex >= 0 ? "updated" : "created"
  };
}
