import type { PackageModule } from "../../scripts/package-module.ts";
import {
  githubLatestReleaseTag,
  pkgbuildField,
  setPkgverAndResetPkgrel,
} from "../../scripts/package-utils.ts";

export const aliases = ["melonloader-installer", "melonloader"];

const melonloaderInstallerBin: PackageModule = {
  aliases,

  currentVersion(pkgbuild: string): string {
    return pkgbuildField(pkgbuild, "pkgver");
  },

  async latestVersion(): Promise<string> {
    const tag = await githubLatestReleaseTag(
      "LavaGang/MelonLoader.Installer",
      "MelonLoader Installer",
    );
    const match = tag.match(/^(\d+\.\d+\.\d+)$/);
    if (!match) {
      throw new Error("GitHub returned an invalid MelonLoader Installer release tag");
    }
    return match[1];
  },

  updatePkgbuild(pkgbuild: string, latestVersion: string): string {
    return setPkgverAndResetPkgrel(pkgbuild, latestVersion);
  },
};

export default melonloaderInstallerBin;
