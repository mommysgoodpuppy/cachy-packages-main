import type { PackageModule } from "../../scripts/package-module.ts";
import {
  fetchUserAgentHeaders,
  pkgbuildField,
  replacePkgbuildField,
  setPkgverAndResetPkgrel,
} from "../../scripts/package-utils.ts";
export const aliases = ["gpuvis-git"];

type GithubTag = {
  name?: unknown;
  commit?: { sha?: unknown };
};

const gpuvis: PackageModule = {
  aliases,

  currentVersion(pkgbuild: string): string {
    return pkgbuildField(pkgbuild, "pkgver");
  },

  async latestVersion(): Promise<string> {
    const response = await fetch(
      "https://api.github.com/repos/mikesart/gpuvis/tags?per_page=10",
      { headers: fetchUserAgentHeaders() },
    );
    if (!response.ok) {
      throw new Error(`Gpuvis tag lookup failed: HTTP ${response.status}`);
    }

    const tags: unknown = await response.json();
    if (!Array.isArray(tags) || tags.length === 0) {
      throw new Error("GitHub returned invalid Gpuvis tags");
    }

    const names = tags
      .map((tag: unknown) => (tag as GithubTag).name)
      .filter((name): name is string => typeof name === "string")
      .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
    const latest = names[0];
    if (!/^v?\d+\.\d+$/.test(latest)) throw new Error("Unexpected Gpuvis tag format");

    return latest.replace(/^v/, "");
  },

  updatePkgbuild(pkgbuild: string, latestVersion: string): string {
    const commit = pkgbuildField(pkgbuild, "_commit");
    const updated = setPkgverAndResetPkgrel(pkgbuild, latestVersion);
    return replacePkgbuildField(updated, "_commit", commit);
  },
};

export default gpuvis;
