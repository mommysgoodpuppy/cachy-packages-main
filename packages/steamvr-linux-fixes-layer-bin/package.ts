import type { PackageModule } from "../../scripts/package-module.ts";
import {
  githubLatestVPrefixedVersion,
  pkgbuildField,
  setPkgverAndResetPkgrel,
} from "../../scripts/package-utils.ts";

export const aliases = ["steamvr-linux-fixes", "steamvr-fixes"];

const steamvrLinuxFixes: PackageModule = {
  aliases,

  currentVersion(pkgbuild: string): string {
    return pkgbuildField(pkgbuild, "pkgver");
  },

  async latestVersion(): Promise<string> {
    return await githubLatestVPrefixedVersion(
      "BnuuySolutions/SteamVRLinuxFixes",
      "SteamVRLinuxFixes",
    );
  },

  updatePkgbuild(pkgbuild: string, latestVersion: string): string {
    return setPkgverAndResetPkgrel(pkgbuild, latestVersion);
  },
};

export default steamvrLinuxFixes;
