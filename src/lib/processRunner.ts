import { spawn } from "node:child_process";
import { readdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { loadConfig } from "./config.js";
import {
  ensureDirectory,
  getProjectRoot,
  pathExists,
  resolveProjectPath
} from "./paths.js";

export interface ProcessResult {
  stdout: string;
  stderr: string;
}

export interface CommandOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  timeoutMs?: number;
}

async function resolveVenvSitePackagesPath(): Promise<string | null> {
  const config = await loadConfig();
  const venvRoot = resolveProjectPath(config.pythonVenvPath);

  if (os.platform() === "win32") {
    const sitePackagesPath = path.join(venvRoot, "Lib", "site-packages");
    return (await pathExists(sitePackagesPath)) ? sitePackagesPath : null;
  }

  const libRoot = path.join(venvRoot, "lib");
  if (!(await pathExists(libRoot))) {
    return null;
  }

  const entries = await readdir(libRoot, { withFileTypes: true });
  const pythonDir = entries.find(
    (entry) => entry.isDirectory() && entry.name.startsWith("python")
  );

  if (!pythonDir) {
    return null;
  }

  const sitePackagesPath = path.join(libRoot, pythonDir.name, "site-packages");
  return (await pathExists(sitePackagesPath)) ? sitePackagesPath : null;
}

async function resolvePythonCommand(): Promise<string> {
  const config = await loadConfig();
  if (path.isAbsolute(config.pythonCommand)) {
    return config.pythonCommand;
  }

  const projectRelativePython = resolveProjectPath(config.pythonCommand);
  if (await pathExists(projectRelativePython)) {
    return projectRelativePython;
  }

  return config.pythonCommand;
}

export async function runPythonPipeline(scriptName: string, args: string[]): Promise<ProcessResult> {
  const scriptPath = path.join(getProjectRoot(), "pipeline", scriptName);
  const pythonCommand = await resolvePythonCommand();
  const sitePackagesPath = await resolveVenvSitePackagesPath();
  const pythonPathValue = sitePackagesPath
    ? [sitePackagesPath, process.env.PYTHONPATH].filter(Boolean).join(path.delimiter)
    : process.env.PYTHONPATH;
  const env = {
    ...process.env,
    PYTHONPATH: pythonPathValue
  };

  return new Promise((resolve, reject) => {
    const child = spawn(pythonCommand, [scriptPath, ...args], {
      cwd: getProjectRoot(),
      stdio: "inherit",
      env
    });

    child.on("error", (error) => {
      reject(new Error(`Failed to start Python pipeline with "${pythonCommand}". ${error.message}`));
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout: "", stderr: "" });
        return;
      }

      reject(new Error(`Python pipeline "${scriptName}" failed: exit code ${code}`));
    });
  });
}

export async function runLocalCommand(
  command: string,
  args: string[],
  options: CommandOptions = {}
): Promise<ProcessResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd ?? getProjectRoot(),
      env: options.env ?? process.env,
      stdio: ["ignore", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const timeoutHandle =
      typeof options.timeoutMs === "number" && options.timeoutMs > 0
        ? setTimeout(() => {
            timedOut = true;
            child.kill();
          }, options.timeoutMs)
        : null;

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }

      reject(new Error(`Failed to start command "${command}". ${error.message}`));
    });

    child.on("close", (code) => {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }

      if (timedOut) {
        reject(new Error(`Command timed out after ${options.timeoutMs}ms: ${command}`));
        return;
      }

      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }

      reject(
        new Error(
          `Command failed with exit code ${code}: ${command}\n${stderr || stdout}`.trim()
        )
      );
    });
  });
}
