import type { PackageModule } from "../../scripts/package-module.ts";
import {
  fetchUserAgentHeaders,
  pkgbuildField,
  replacePkgbuildField,
} from "../../scripts/package-utils.ts";

export const aliases = ["fresh-main"];

type GithubCommit = {
  sha?: unknown;
};

function compositeVersion(pkgver: string, commit: string): string {
  return `${pkgver}@${commit}`;
}

const freshGit: PackageModule = {
  aliases,

  currentVersion(pkgbuild: string): string {
    return compositeVersion(
      pkgbuildField(pkgbuild, "pkgver"),
      pkgbuildField(pkgbuild, "_commit"),
    );
  },

  async latestVersion(): Promise<string> {
    const response = await fetch(
      "https://api.github.com/repos/sinelaw/fresh/commits?sha=master&per_page=1",
      { headers: fetchUserAgentHeaders() },
    );
    if (!response.ok) {
      throw new Error(`Fresh development commit lookup failed: HTTP ${response.status}`);
    }

    const commits: unknown = await response.json();
    if (!Array.isArray(commits) || commits.length !== 1) {
      throw new Error("GitHub returned invalid Fresh development commits");
    }
    const commit = commits[0] as GithubCommit;
    if (typeof commit.sha !== "string" || !/^[0-9a-f]{40}$/.test(commit.sha)) {
      throw new Error("GitHub returned an invalid Fresh development commit");
    }

    const link = response.headers.get("link");
    const countMatch = link?.match(/[?&]page=(\d+)>; rel="last"/);
    const revision = countMatch?.[1] ?? "1";

    const manifestResponse = await fetch(
      `https://raw.githubusercontent.com/sinelaw/fresh/${commit.sha}/Cargo.toml`,
      { headers: fetchUserAgentHeaders() },
    );
    if (!manifestResponse.ok) {
      throw new Error(`Fresh Cargo.toml lookup failed: HTTP ${manifestResponse.status}`);
    }
    const manifest = await manifestResponse.text();
    const versionMatch = manifest.match(/^version = "(\d+\.\d+\.\d+)"$/m);
    if (!versionMatch) throw new Error("Fresh Cargo.toml has no valid workspace version");

    const pkgver = `${versionMatch[1]}.r${revision}.g${commit.sha.slice(0, 8)}`;
    return compositeVersion(pkgver, commit.sha);
  },

  updatePkgbuild(pkgbuild: string, latestVersion: string): string {
    const separator = latestVersion.indexOf("@");
    if (separator < 1) throw new Error("Invalid Fresh development version");
    const pkgver = latestVersion.slice(0, separator);
    const commit = latestVersion.slice(separator + 1);
    if (!/^[0-9a-f]{40}$/.test(commit)) throw new Error("Invalid Fresh development commit");

    let updated = replacePkgbuildField(pkgbuild, "_commit", commit);
    updated = replacePkgbuildField(updated, "pkgver", pkgver);
    return replacePkgbuildField(updated, "pkgrel", "1");
  },
};

export default freshGit;
