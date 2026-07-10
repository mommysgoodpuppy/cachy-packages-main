import type { PackageModule } from "../../scripts/package-module.ts";
import {
  githubLatestVPrefixedVersion,
  pkgbuildField,
  setPkgverAndResetPkgrel,
} from "../../scripts/package-utils.ts";

export const aliases = ["t3code"];

const t3Code: PackageModule = {
  aliases,

  currentVersion(pkgbuild: string): string {
    return pkgbuildField(pkgbuild, "pkgver");
  },

  async latestVersion(): Promise<string> {
    return await githubLatestVPrefixedVersion("pingdotgg/t3code", "T3 Code");
  },

  updatePkgbuild(pkgbuild: string, latestVersion: string): string {
    return setPkgverAndResetPkgrel(pkgbuild, latestVersion);
  },
};

export default t3Code;
