#!/usr/bin/env -S deno run

import type { PackageModule } from "./package-module.ts";

type LoadedPackage = {
  name: string;
  directory: string;
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
  console.error("  deno task <check|build|install> <package> [--keep-build]");
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
    typeof candidate.updatePkgbuild === "function";
}

async function loadPackages(): Promise<LoadedPackage[]> {
  const packages: LoadedPackage[] = [];
  for await (const entry of Deno.readDir(packagesDir)) {
    if (!entry.isDirectory) continue;
    const moduleUrl = new URL(`../packages/${entry.name}/package.ts`, import.meta.url);
    try {
      await Deno.stat(moduleUrl);
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) continue;
      throw error;
    }
    const imported: { default?: unknown } = await import(moduleUrl.href);
    if (!isPackageModule(imported.default)) {
      throw new Error(`packages/${entry.name}/package.ts has an invalid default export`);
    }
    packages.push({
      name: entry.name,
      directory: `${packagesDir}/${entry.name}`,
      module: imported.default,
    });
  }
  return packages.sort((left, right) => left.name.localeCompare(right.name));
}

async function updatePackage(pkg: LoadedPackage, apply: boolean): Promise<void> {
  const pkgbuildPath = `${pkg.directory}/PKGBUILD`;
  const originalPkgbuild = await Deno.readTextFile(pkgbuildPath);
  const current = pkg.module.currentVersion(originalPkgbuild);
  const latest = await pkg.module.latestVersion();
  console.log(`${pkg.name}: ${current} -> ${latest}`);
  if (current === latest) return;
  if (!apply) {
    console.log("Update available");
    return;
  }

  await Deno.writeTextFile(pkgbuildPath, pkg.module.updatePkgbuild(originalPkgbuild, latest));
  try {
    await Deno.mkdir(sourceDir, { recursive: true });
    await run("updpkgsums", [], {
      cwd: pkg.directory,
      env: { SRCDEST: sourceDir },
    });
  } catch (error) {
    await Deno.writeTextFile(pkgbuildPath, originalPkgbuild);
    throw error;
  }
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
  } else {
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
  }

  if (hasRepoDatabase) {
    await run("sudo", ["pacman", "-Sy"]);
  } else {
    console.warn(
      `${repoDatabase} does not exist yet. Run deno task build <package> to create it, ` +
        "then run deno task setup-repo again or sudo pacman -Sy.",
    );
  }
}

const [action, target, ...extra] = Deno.args;
const keepBuild = extra.includes("--keep-build");
if (
  extra.some((arg) => arg !== "--keep-build") ||
  (action === "setup-repo" ? target || extra.length : !target) ||
  !["check", "build", "install", "setup-repo"].includes(action)
) usage();

try {
  if (action === "setup-repo") {
    await setupLocalRepo();
    Deno.exit(0);
  }

  const packages = await loadPackages();
  const pkg = packages.find((candidate) =>
    candidate.name === target || candidate.module.aliases.includes(target)
  );
  if (!pkg) usage(packages.flatMap((candidate) => [candidate.name, ...candidate.module.aliases]));

  await updatePackage(pkg, action !== "check");
  if (action === "check") Deno.exit(0);
  try {
    const archives = await buildPackage(pkg);
    await updateRepoDatabase(archives);
    archives.forEach((archive) => console.log(`Built ${archive}`));
    if (action === "install") {
      if (await isRepoConfigured()) {
        await run("sudo", ["pacman", "-Sy", `${repoName}/${pkg.name}`]);
      } else {
        console.warn(
          `${repoName} is not configured in pacman; falling back to pacman -U. ` +
            "The package will still appear in pacman -Qm until the local repo is configured.",
        );
        await run("sudo", ["pacman", "-U", ...archives]);
      }
    }
  } finally {
    if (!keepBuild) await cleanupBuildOutput(pkg);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  Deno.exit(1);
}
