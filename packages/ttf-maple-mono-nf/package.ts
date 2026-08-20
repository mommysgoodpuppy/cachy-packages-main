import type { PackageModule } from "../../scripts/package-module.ts";
import {
  githubLatestReleaseTag,
  pkgbuildField,
  setPkgverAndResetPkgrel,
} from "../../scripts/package-utils.ts";

export const aliases = ["maple-font", "maple-mono", "maplemono"];

const ttfMapleMonoNf: PackageModule = {
  aliases,

  currentVersion(pkgbuild: string): string {
    return pkgbuildField(pkgbuild, "pkgver");
  },

  async latestVersion(): Promise<string> {
    const tag = await githubLatestReleaseTag("subframe7536/maple-font", "Maple Mono");
    const match = tag.match(/^v(\d+\.\d+)$/);
    if (!match) throw new Error("GitHub returned an invalid Maple Mono release tag");
    return match[1];
  },

  updatePkgbuild(pkgbuild: string, latestVersion: string): string {
    return setPkgverAndResetPkgrel(pkgbuild, latestVersion);
  },
};

export default ttfMapleMonoNf;
