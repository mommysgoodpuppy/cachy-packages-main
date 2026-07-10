import type { PackageModule } from "../../scripts/package-module.ts";
import {
  githubLatestVPrefixedVersion,
  pkgbuildField,
  setPkgverAndResetPkgrel,
} from "../../scripts/package-utils.ts";

export const aliases = ["apktool"];

const apktool: PackageModule = {
  aliases,

  currentVersion(pkgbuild: string): string {
    return pkgbuildField(pkgbuild, "pkgver");
  },

  async latestVersion(): Promise<string> {
    return await githubLatestVPrefixedVersion("iBotPeaches/Apktool", "apktool");
  },

  updatePkgbuild(pkgbuild: string, latestVersion: string): string {
    return setPkgverAndResetPkgrel(pkgbuild, latestVersion);
  },
};

export default apktool;
