#!/usr/bin/env -S deno run

import type { PackageModule } from "./package-module.ts";

type PackageMetadata = {
  aliases: readonly string[];
};

type PackageCandidate = PackageMetadata & {
  name: string;
  directory: string;
};

type LoadedPackage = PackageCandidate & {
  module: PackageModule;
};

const root = await Deno.realPath(`${import.meta.dirname}/..`);
const packagesDir = `${root}/packages`;
const repoDir = `${root}/repo`;
const repoName = "cachy-packages-main";
const repoDatabase = `${repoDir}/${repoName}.db.tar.gz`;
const pacmanConfig = "/etc/pacman.conf";
const sourceDir = "/tmp/local-reviewed-package-sources";

function usage(packageNames: string[] = []): never {
  console.error("Usage:");
  console.error("  deno task check <package>");
  console.error("  deno task lock <package>");
  console.error("  deno task update <package|all>");
  console.error("  deno task build <package> [--keep-build]");
  console.error("  deno task install <package> [--keep-build]");
  console.error("  deno task setup-repo");
  if (packageNames.length) console.error(`Packages: ${packageNames.join(", ")}`);
  Deno.exit(2);
}

async function run(
  command: string,
  args: string[],
  options: Deno.CommandOptions = {},
): Promise<void> {
  console.log(`> ${command} ${args.join(" ")}`);
  const status = await new Deno.Command(command, {
    ...options,
    args,
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  }).spawn().status;
  if (!status.success) throw new Error(`${command} exited with status ${status.code}`);
}

async function output(
  command: string,
  args: string[],
  options: Deno.CommandOptions = {},
): Promise<string> {
  const result = await new Deno.Command(command, {
    ...options,
    args,
    stdout: "piped",
    stderr: "inherit",
  }).output();
  if (!result.success) throw new Error(`${command} exited with status ${result.code}`);
  return new TextDecoder().decode(result.stdout);
}

function isPackageModule(value: unknown): value is PackageModule {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<PackageModule>;
  return Array.isArray(candidate.aliases) &&
    candidate.aliases.every((alias) => typeof alias === "string") &&
    typeof candidate.currentVersion === "function" &&
    typeof candidate.latestVersion === "function" &&
    typeof candidate.updatePkgbuild === "function" &&
    (candidate.lockedDependencyFiles == null ||
      (Array.isArray(candidate.lockedDependencyFiles) &&
        candidate.lockedDependencyFiles.every((file) => typeof file === "string"))) &&
    (candidate.lockDependencies == null ||
      typeof candidate.lockDependencies === "function") &&
    (candidate.validateBuiltPackage == null ||
      typeof candidate.validateBuiltPackage === "function");
}

function parseAliases(text: string, path: string): PackageMetadata {
  const match = text.match(/^export const aliases = (\[[^\r\n]*\]);$/m);
  if (!match) {
    throw new Error(`${path} must export aliases as a one-line JSON array`);
  }
  let aliases: unknown;
  try {
    aliases = JSON.parse(match[1]);
  } catch (error) {
    throw new Error(
      `Invalid aliases in ${path}: ${error instanceof Error ? error.message : error}`,
    );
  }
  if (!Array.isArray(aliases) || aliases.some((alias) => typeof alias !== "string" || !alias)) {
    throw new Error(`${path} aliases must be a non-empty string array`);
  }
  if (new Set(aliases).size !== aliases.length) {
    throw new Error(`${path} contains duplicate aliases`);
  }
  return { aliases };
}

async function discoverPackages(): Promise<PackageCandidate[]> {
  const packages: PackageCandidate[] = [];
  const names = new Set<string>();
  for await (const entry of Deno.readDir(packagesDir)) {
    if (!entry.isDirectory) continue;
    const directory = `${packagesDir}/${entry.name}`;
    const modulePath = `${directory}/package.ts`;
    const metadata = parseAliases(await Deno.readTextFile(modulePath), modulePath);
    packages.push({ name: entry.name, directory, ...metadata });
  }
  for (const pkg of packages) {
    for (const name of [pkg.name, ...pkg.aliases]) {
      if (names.has(name)) throw new Error(`Duplicate package name or alias: ${name}`);
      names.add(name);
    }
  }
  return packages.sort((left, right) => left.name.localeCompare(right.name));
}

async function loadPackage(candidate: PackageCandidate): Promise<LoadedPackage> {
  const moduleUrl = new URL(`../packages/${candidate.name}/package.ts`, import.meta.url);
  const imported: { default?: unknown } = await import(moduleUrl.href);
  if (!isPackageModule(imported.default)) {
    throw new Error(`packages/${candidate.name}/package.ts has an invalid default export`);
  }
  const moduleAliases = [...imported.default.aliases].sort();
  const metadataAliases = [...candidate.aliases].sort();
  if (JSON.stringify(moduleAliases) !== JSON.stringify(metadataAliases)) {
    throw new Error(`packages/${candidate.name}/package.ts aliases do not match its static export`);
  }
  return { ...candidate, module: imported.default };
}

function resolvePackage(
  candidates: PackageCandidate[],
  target: string,
): PackageCandidate | undefined {
  return candidates.find((candidate) =>
    candidate.name === target || candidate.aliases.includes(target)
  );
}

async function updatePackage(pkg: LoadedPackage): Promise<boolean> {
  const pkgbuildPath = `${pkg.directory}/PKGBUILD`;
  const originalPkgbuild = await Deno.readTextFile(pkgbuildPath);
  const originalLockedFiles = new Map<string, string>();
  for (const file of pkg.module.lockedDependencyFiles ?? []) {
    originalLockedFiles.set(file, await Deno.readTextFile(`${pkg.directory}/${file}`));
  }
  const current = pkg.module.currentVersion(originalPkgbuild);
  const latest = await pkg.module.latestVersion();
  console.log(`${pkg.name}: ${current} -> ${latest}`);
  if (current === latest) return false;

  await Deno.writeTextFile(pkgbuildPath, pkg.module.updatePkgbuild(originalPkgbuild, latest));
  try {
    await Deno.mkdir(sourceDir, { recursive: true });
    await pkg.module.lockDependencies?.(pkg.directory, latest);
    await run("updpkgsums", [], {
      cwd: pkg.directory,
      env: { SRCDEST: sourceDir },
    });
  } catch (error) {
    await Deno.writeTextFile(pkgbuildPath, originalPkgbuild);
    for (const [file, contents] of originalLockedFiles) {
      await Deno.writeTextFile(`${pkg.directory}/${file}`, contents);
    }
    throw error;
  }
  console.log(`${pkg.name}: updated pinned source version and checksums.`);
  return true;
}

async function checkPackage(pkg: LoadedPackage): Promise<boolean> {
  const pkgbuild = await Deno.readTextFile(`${pkg.directory}/PKGBUILD`);
  const current = pkg.module.currentVersion(pkgbuild);
  const latest = await pkg.module.latestVersion();
  console.log(`${pkg.name}: ${current} -> ${latest}`);
  if (current !== latest) console.log("Update available");
  return current !== latest;
}

async function installedPackageNames(): Promise<Set<string>> {
  const installed = await output("expac", ["-Q", "%n"]);
  return new Set(installed.split("\n").filter(Boolean));
}

async function cleanupBuildOutput(pkg: LoadedPackage): Promise<void> {
  for (const directory of ["pkg", "src"]) {
    await Deno.remove(`${pkg.directory}/${directory}`, { recursive: true }).catch((error) => {
      if (!(error instanceof Deno.errors.NotFound)) throw error;
    });
  }
}

async function buildPackage(pkg: LoadedPackage): Promise<string[]> {
  await Deno.mkdir(repoDir, { recursive: true });
  await Deno.mkdir(sourceDir, { recursive: true });
  const environment = { SRCDEST: sourceDir, PKGDEST: repoDir };
  const archives = (await output("makepkg", ["--packagelist"], {
    cwd: pkg.directory,
    env: environment,
  })).trim().split("\n").filter(Boolean);
  if (!archives.length) throw new Error(`${pkg.name} does not produce any package archives`);
  for (const archive of archives) {
    await Deno.remove(archive).catch((error) => {
      if (!(error instanceof Deno.errors.NotFound)) throw error;
    });
    await Deno.remove(`${archive}.sig`).catch((error) => {
      if (!(error instanceof Deno.errors.NotFound)) throw error;
    });
  }
  await run("makepkg", ["-Csf", "--noconfirm"], {
    cwd: pkg.directory,
    env: environment,
  });
  for (const archive of archives) await Deno.stat(archive);
  return archives;
}

async function updateRepoDatabase(archives: string[]): Promise<void> {
  await run("repo-add", [repoDatabase, ...archives]);
}

async function buildAndRegisterPackage(
  pkg: LoadedPackage,
  install: boolean,
  keepBuild: boolean,
): Promise<void> {
  try {
    const archives = await buildPackage(pkg);
    await pkg.module.validateBuiltPackage?.(archives);
    await updateRepoDatabase(archives);
    archives.forEach((archive) => console.log(`Built ${archive}`));
    if (install) await installFromLocalRepo(pkg);
  } finally {
    if (!keepBuild) await cleanupBuildOutput(pkg);
  }
}

async function isRepoConfigured(): Promise<boolean> {
  try {
    const repos = await output("pacman-conf", ["--repo-list"]);
    return repos.split("\n").includes(repoName);
  } catch {
    return false;
  }
}

async function setupLocalRepo(): Promise<void> {
  await Deno.mkdir(repoDir, { recursive: true });
  const hasRepoDatabase = await Deno.stat(repoDatabase).then(() => true).catch((error) => {
    if (error instanceof Deno.errors.NotFound) return false;
    throw error;
  });
  if (!hasRepoDatabase && !(await isRepoConfigured())) {
    throw new Error(
      `${repoDatabase} does not exist yet. Run deno task build <package> first, ` +
        "then run deno task setup-repo.",
    );
  }

  if (await isRepoConfigured()) {
    console.log(`${repoName} is already configured in pacman.`);
    return;
  }

  const config = await Deno.readTextFile(pacmanConfig);
  const stanza = [
    "",
    `[${repoName}]`,
    "SigLevel = Optional TrustAll",
    `Server = file://${repoDir}`,
    "",
  ].join("\n");
  const updatedConfig = `${config.trimEnd()}\n${stanza}`;
  const tempConfig = await Deno.makeTempFile({ prefix: `${repoName}-`, suffix: ".conf" });
  await Deno.writeTextFile(tempConfig, updatedConfig);
  try {
    await run("sudo", ["install", "-m", "644", tempConfig, pacmanConfig]);
  } finally {
    await Deno.remove(tempConfig).catch((error) => {
      if (!(error instanceof Deno.errors.NotFound)) throw error;
    });
  }
  console.log(`Added ${repoName} to ${pacmanConfig}.`);
  console.log("The local repository will be refreshed only when installing a local package.");
}

async function installFromLocalRepo(pkg: LoadedPackage): Promise<void> {
  const config = [
    "[options]",
    "",
    `[${repoName}]`,
    "SigLevel = Optional TrustAll",
    `Server = file://${repoDir}`,
    "",
  ].join("\n");
  const tempConfig = await Deno.makeTempFile({ prefix: `${repoName}-install-`, suffix: ".conf" });
  await Deno.writeTextFile(tempConfig, config);
  await Deno.chmod(tempConfig, 0o644);
  try {
    await run("sudo", ["pacman", "--config", tempConfig, "-Sy"]);
    await run("sudo", ["pacman", "--config", tempConfig, "-S", `${repoName}/${pkg.name}`]);
  } finally {
    await Deno.remove(tempConfig).catch((error) => {
      if (!(error instanceof Deno.errors.NotFound)) throw error;
    });
  }
}

const [action, target, ...extra] = Deno.args;
const keepBuild = extra.includes("--keep-build");
const validActions = ["check", "lock", "update", "build", "install", "setup-repo"];
if (
  !action ||
  !validActions.includes(action) ||
  extra.some((arg) => arg !== "--keep-build") ||
  (keepBuild && action !== "build" && action !== "install") ||
  (action === "setup-repo" ? target || extra.length : !target)
) usage();

try {
  if (action === "setup-repo") {
    await setupLocalRepo();
    Deno.exit(0);
  }

  const candidates = await discoverPackages();
  if (action === "update" && target === "all") {
    const installed = await installedPackageNames();
    const selected = candidates.filter((candidate) => installed.has(candidate.name));
    console.log(`Updating and installing ${selected.length} local package(s).`);
    for (const candidate of selected) {
      const pkg = await loadPackage(candidate);
      if (await updatePackage(pkg)) {
        await buildAndRegisterPackage(pkg, true, false);
      }
    }
    Deno.exit(0);
  }

  const candidate = resolvePackage(candidates, target);
  if (!candidate) usage([...candidates.flatMap((pkg) => [pkg.name, ...pkg.aliases]), "all"]);
  const pkg = await loadPackage(candidate);

  if (action === "check") {
    await checkPackage(pkg);
    Deno.exit(0);
  }
  if (action === "lock") {
    if (!pkg.module.lockDependencies) {
      throw new Error(`${pkg.name} does not manage locked language dependencies`);
    }
    const pkgbuild = await Deno.readTextFile(`${pkg.directory}/PKGBUILD`);
    await pkg.module.lockDependencies(pkg.directory, pkg.module.currentVersion(pkgbuild));
    await Deno.mkdir(sourceDir, { recursive: true });
    await run("updpkgsums", [], { cwd: pkg.directory, env: { SRCDEST: sourceDir } });
    Deno.exit(0);
  }
  if (action === "update") {
    const updated = await updatePackage(pkg);
    const installed = await installedPackageNames();
    if (updated && installed.has(pkg.name)) {
      await buildAndRegisterPackage(pkg, true, false);
    } else if (updated) {
      console.log(`${pkg.name} is not installed; updated its definition without building.`);
    }
    Deno.exit(0);
  }

  if (action === "install") await updatePackage(pkg);
  await buildAndRegisterPackage(pkg, action === "install", keepBuild);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  Deno.exit(1);
}
