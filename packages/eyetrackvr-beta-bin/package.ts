import type { PackageModule } from "../../scripts/package-module.ts";
import {
  fetchUserAgentHeaders,
  pkgbuildField,
  setPkgverAndResetPkgrel,
} from "../../scripts/package-utils.ts";

export const aliases = ["eyetrackvr-beta", "eyetrackvr"];

type GithubRelease = {
  prerelease?: unknown;
  tag_name?: unknown;
  assets?: unknown;
};

const eyetrackvrBetaBin: PackageModule = {
  aliases,

  currentVersion(pkgbuild: string): string {
    return pkgbuildField(pkgbuild, "pkgver");
  },

  async latestVersion(): Promise<string> {
    const response = await fetch(
      "https://api.github.com/repos/EyeTrackVR/EyeTrackVR/releases?per_page=30",
      { headers: fetchUserAgentHeaders() },
    );
    if (!response.ok) {
      throw new Error(`EyeTrackVR release lookup failed: HTTP ${response.status}`);
    }

    const releases: unknown = await response.json();
    if (!Array.isArray(releases)) {
      throw new Error("GitHub returned invalid EyeTrackVR releases");
    }

    for (const release of releases as GithubRelease[]) {
      if (release.prerelease !== true || typeof release.tag_name !== "string") continue;
      const match = release.tag_name.match(/^EyeTrackApp-(\d+\.\d+\.\d+)-BETA-(\d+)$/);
      if (!match || !Array.isArray(release.assets)) continue;
      const expectedAsset = `EyeTrackVR-${match[1]}-BETA-${match[2]}-linux-x86_64.tar.gz`;
      const hasLinuxAsset = release.assets.some((asset: unknown) =>
        asset !== null && typeof asset === "object" &&
        (asset as { name?: unknown }).name === expectedAsset
      );
      if (hasLinuxAsset) return `${match[1]}.beta${match[2]}`;
    }

    throw new Error("No EyeTrackVR beta release with a Linux x86_64 archive was found");
  },

  updatePkgbuild(pkgbuild: string, latestVersion: string): string {
    return setPkgverAndResetPkgrel(pkgbuild, latestVersion);
  },
};

export default eyetrackvrBetaBin;
