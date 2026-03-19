#!/usr/bin/env node

/**
 * Build script for Electron desktop app.
 * Steps:
 * 1. Build Next.js (standalone)
 * 2. Resolve symlinks in standalone output (better-sqlite3, pdf-parse)
 * 3. Compile Electron TypeScript files
 * 4. Package with electron-builder
 */

const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const ROOT = path.resolve(__dirname, "..");

function run(cmd, label) {
  console.log(`\n=== ${label} ===\n`);
  execSync(cmd, { cwd: ROOT, stdio: "inherit" });
}

function resolveStandaloneSymlinks() {
  console.log("\n=== Resolving standalone symlinks ===\n");

  const dirs = [
    path.join(ROOT, ".next", "standalone", ".next", "node_modules"),
    path.join(ROOT, ".next", "standalone", "node_modules"),
  ];

  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;

    const entries = fs.readdirSync(dir);
    for (const entry of entries) {
      const fullPath = path.join(dir, entry);
      const stat = fs.lstatSync(fullPath);

      if (stat.isSymbolicLink()) {
        const target = fs.realpathSync(fullPath);
        console.log(`  Resolving symlink: ${entry} -> ${target}`);
        fs.unlinkSync(fullPath);

        if (fs.statSync(target).isDirectory()) {
          copyDirRecursive(target, fullPath);
        } else {
          fs.copyFileSync(target, fullPath);
        }
      }
    }
  }

  console.log("  Done.");
}

function copyDirRecursive(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else if (entry.isSymbolicLink()) {
      const realTarget = fs.realpathSync(srcPath);
      if (fs.statSync(realTarget).isDirectory()) {
        copyDirRecursive(realTarget, destPath);
      } else {
        fs.copyFileSync(realTarget, destPath);
      }
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

const platform = process.argv[2] || "current";

function cleanElectronOutput() {
  const outDir = path.join(ROOT, "dist-electron");
  if (!fs.existsSync(outDir)) return;
  const entries = fs.readdirSync(outDir);
  const toRemove = entries.filter(
    (e) =>
      e.startsWith("mac") ||
      e.endsWith(".dmg") ||
      e.endsWith(".zip") ||
      e.endsWith(".blockmap")
  );
  for (const entry of toRemove) {
    const full = path.join(outDir, entry);
    console.log("  Removing previous output:", entry);
    try {
      fs.rmSync(full, { recursive: true, force: true });
    } catch (err) {
      console.warn("  Warning: could not remove", entry, err.message);
    }
  }
}

try {
  run("npm run build", "Building Next.js");

  resolveStandaloneSymlinks();

  run(
    "npx tsc -p electron/tsconfig.json",
    "Compiling Electron TypeScript"
  );

  console.log("\n=== Cleaning previous Electron output ===\n");
  cleanElectronOutput();

  let builderCmd = "npx electron-builder";
  if (platform === "mac") {
    builderCmd += " --mac";
  } else if (platform === "win") {
    builderCmd += " --win";
  } else if (platform === "all") {
    builderCmd += " --mac --win";
  }

  run(builderCmd, "Packaging with electron-builder");

  console.log("\nBuild complete! Check dist-electron/ for output.\n");
} catch (err) {
  console.error("\nBuild failed:", err.message);
  process.exit(1);
}
