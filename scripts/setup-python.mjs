import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { access, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { constants } from "node:fs";

const projectRoot = process.cwd();
const venvDir = path.join(projectRoot, ".venv");
const tempDir = path.join(projectRoot, ".tmp");
const pipCacheDir = path.join(projectRoot, ".pip-cache");

function isWindows() {
  return os.platform() === "win32";
}

function getVenvPythonPath() {
  return isWindows()
    ? path.join(venvDir, "Scripts", "python.exe")
    : path.join(venvDir, "bin", "python");
}

function getVenvSitePackagesPath() {
  return isWindows()
    ? path.join(venvDir, "Lib", "site-packages")
    : path.join(venvDir, "lib");
}

async function pathExists(targetPath) {
  try {
    await access(targetPath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function run(command, args, label) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: projectRoot,
      stdio: "inherit",
      env: {
        ...process.env,
        TEMP: tempDir,
        TMP: tempDir,
        TMPDIR: tempDir,
        PIP_CACHE_DIR: pipCacheDir
      }
    });

    child.on("error", (error) => {
      reject(new Error(`${label} failed to start: ${error.message}`));
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${label} failed with exit code ${code ?? "unknown"}.`));
    });
  });
}

async function getPythonTag() {
  const pyvenvConfigPath = path.join(venvDir, "pyvenv.cfg");
  const rawConfig = await readFile(pyvenvConfigPath, "utf8");
  const versionLine = rawConfig
    .split(/\r?\n/)
    .find((line) => line.trim().toLowerCase().startsWith("version ="));

  if (!versionLine) {
    throw new Error("Could not determine the virtual environment Python version.");
  }

  const versionValue = versionLine.split("=")[1]?.trim();
  const [major, minor] = (versionValue ?? "").split(".");

  if (!major || !minor) {
    throw new Error(`Unexpected virtual environment version value: ${versionValue}`);
  }

  return `cp${major}${minor}`;
}

function getPlatformWheelMarker() {
  if (isWindows()) {
    return "win_amd64";
  }

  if (os.platform() === "darwin") {
    return os.arch() === "arm64" ? "macosx" : "macosx";
  }

  return "manylinux";
}

async function installPillowWheelFallback(sitePackagesPath) {
  const response = await fetch("https://pypi.org/pypi/Pillow/json");
  if (!response.ok) {
    throw new Error(`Failed to fetch Pillow metadata: ${response.status}`);
  }

  const metadata = await response.json();
  const pythonTag = await getPythonTag();
  const platformMarker = getPlatformWheelMarker();
  const wheel = metadata.urls.find((entry) => {
    if (typeof entry.filename !== "string" || typeof entry.url !== "string") {
      return false;
    }

    return (
      entry.packagetype === "bdist_wheel" &&
      entry.filename.includes(`-${pythonTag}-${pythonTag}-`) &&
      entry.filename.includes(platformMarker)
    );
  });

  if (!wheel) {
    throw new Error(
      `Could not find a Pillow wheel for ${pythonTag} on ${os.platform()} ${os.arch()}.`
    );
  }

  const wheelResponse = await fetch(wheel.url);
  if (!wheelResponse.ok) {
    throw new Error(`Failed to download Pillow wheel: ${wheelResponse.status}`);
  }

  const wheelBytes = new Uint8Array(await wheelResponse.arrayBuffer());
  const wheelPath = path.join(tempDir, wheel.filename);
  await writeFile(wheelPath, wheelBytes);
  await rm(path.join(sitePackagesPath, "PIL"), { recursive: true, force: true });
  const sitePackagesEntries = await readdir(sitePackagesPath).catch(() => []);
  await Promise.all(
    sitePackagesEntries
      .filter((entry) => /^pillow-.*\.dist-info$/i.test(entry))
      .map((entry) =>
        rm(path.join(sitePackagesPath, entry), {
          recursive: true,
          force: true
        })
      )
  );

  await run(
    "python",
    [
      "-c",
      [
        "import sys, zipfile",
        "archive = zipfile.ZipFile(sys.argv[1])",
        "archive.extractall(sys.argv[2])",
        "archive.close()"
      ].join("; "),
      wheelPath,
      sitePackagesPath
    ],
    "wheel extraction fallback"
  );
}

async function main() {
  const venvPython = getVenvPythonPath();
  const sitePackagesPath = getVenvSitePackagesPath();

  await mkdir(tempDir, { recursive: true });
  await mkdir(pipCacheDir, { recursive: true });
  await mkdir(sitePackagesPath, { recursive: true });

  if (!(await pathExists(venvPython))) {
    await run("python", ["-m", "venv", ".venv"], "Python virtual environment creation");
  }

  try {
    await run(
      venvPython,
      ["-m", "ensurepip", "--upgrade"],
      "pip bootstrap"
    );
    await run(venvPython, ["-m", "pip", "install", "--upgrade", "pip"], "pip upgrade");
    await run(
      venvPython,
      ["-m", "pip", "install", "-r", "requirements.txt"],
      "requirements installation"
    );
    return;
  } catch (error) {
    console.warn(
      "Falling back to installing requirements directly into the project virtual environment."
    );
    console.warn(error instanceof Error ? error.message : String(error));
  }

  try {
    await run(
      "python",
      ["-m", "pip", "install", "--target", sitePackagesPath, "-r", "requirements.txt"],
      "requirements installation fallback"
    );
    await run(
      "python",
      ["-c", "import PIL; print(PIL.__version__)"],
      "Pillow import verification"
    );
  } catch {
    await installPillowWheelFallback(sitePackagesPath);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
