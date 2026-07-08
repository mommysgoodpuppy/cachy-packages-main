import type { PackageModule } from "../../scripts/package-module.ts";
import {
  fetchUserAgentHeaders,
  pkgbuildField,
  setPkgverAndResetPkgrel,
} from "../../scripts/package-utils.ts";

const releasesUrl = "https://update.code.visualstudio.com/api/releases/stable";

const vscode: PackageModule = {
  aliases: ["vscode"],

  currentVersion(pkgbuild: string): string {
    return pkgbuildField(pkgbuild, "pkgver");
  },

  async latestVersion(): Promise<string> {
    const response = await fetch(releasesUrl, {
      headers: fetchUserAgentHeaders(),
    });
    if (!response.ok) {
      throw new Error(`VS Code release lookup failed: HTTP ${response.status}`);
    }
    const releases: unknown = await response.json();
    if (
      !Array.isArray(releases) || typeof releases[0] !== "string" ||
      !/^\d+\.\d+\.\d+$/.test(releases[0])
    ) {
      throw new Error("Microsoft returned an invalid stable VS Code version");
    }
    return releases[0];
  },

  updatePkgbuild(pkgbuild: string, latestVersion: string): string {
    return setPkgverAndResetPkgrel(pkgbuild, latestVersion);
  },
};

export default vscode;
