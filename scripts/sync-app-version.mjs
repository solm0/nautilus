import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const rootDir = path.resolve(import.meta.dirname, "..");
const frontendPackagePath = path.join(rootDir, "frontend", "package.json");
const electronPackagePath = path.join(rootDir, "electron", "package.json");
const androidGradlePath = path.join(
  rootDir,
  "frontend",
  "android",
  "app",
  "build.gradle",
);
const latestVersionPath = path.join(
  rootDir,
  "central",
  "static",
  "latest-version.json",
);

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf-8"));
}

function writeJson(filePath, value) {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf-8");
}

function parseSemver(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);

  if (!match) {
    throw new Error(
      `Unsupported version format "${version}". Expected x.y.z`,
    );
  }

  return match.slice(1).map((part) => Number(part));
}

function toAndroidVersionCode(version) {
  const [major, minor, patch] = parseSemver(version);
  return major * 10000 + minor * 100 + patch;
}

const frontendPackage = readJson(frontendPackagePath);
const version = frontendPackage.version;

if (typeof version !== "string" || version.length === 0) {
  throw new Error("frontend/package.json is missing a valid version");
}

const electronPackage = readJson(electronPackagePath);
electronPackage.version = version;
writeJson(electronPackagePath, electronPackage);

const latestVersion = readJson(latestVersionPath);
latestVersion.version = version;
writeJson(latestVersionPath, latestVersion);

const androidGradle = readFileSync(androidGradlePath, "utf-8")
  .replace(/versionCode\s+\d+/, `versionCode ${toAndroidVersionCode(version)}`)
  .replace(/versionName\s+"[^"]+"/, `versionName "${version}"`);

writeFileSync(androidGradlePath, androidGradle, "utf-8");

process.stdout.write(`Synced app version to ${version}\n`);
