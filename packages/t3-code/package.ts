import type { PackageModule } from "../../scripts/package-module.ts";
import {
  fetchUserAgentHeaders,
  pkgbuildField,
  setPkgverAndResetPkgrel,
} from "../../scripts/package-utils.ts";

export const aliases = ["t3code"];

type GithubRelease = {
  prerelease?: unknown;
  tag_name?: unknown;
  assets?: unknown;
};

const t3Code: PackageModule = {
  aliases,

  currentVersion(pkgbuild: string): string {
    return pkgbuildField(pkgbuild, "pkgver");
  },

  async latestVersion(): Promise<string> {
    const response = await fetch(
      "https://api.github.com/repos/pingdotgg/t3code/releases?per_page=30",
      { headers: fetchUserAgentHeaders() },
    );
    if (!response.ok) {
      throw new Error(`T3 Code release lookup failed: HTTP ${response.status}`);
    }

    const releases: unknown = await response.json();
    if (!Array.isArray(releases)) {
      throw new Error("GitHub returned invalid T3 Code releases");
    }

    for (const release of releases as GithubRelease[]) {
      if (release.prerelease !== true || typeof release.tag_name !== "string") continue;
      const match = release.tag_name.match(/^v((\d+\.\d+\.\d+)-nightly\.(\d+\.\d+))$/);
      if (!match || !Array.isArray(release.assets)) continue;
      const expectedAsset = `T3-Code-${match[1]}-x86_64.AppImage`;
      const hasLinuxAsset = release.assets.some((asset: unknown) =>
        asset !== null && typeof asset === "object" &&
        (asset as { name?: unknown }).name === expectedAsset
      );
      if (hasLinuxAsset) return `${match[2]}.nightly.${match[3]}`;
    }

    throw new Error("No T3 Code nightly release with an x86_64 AppImage was found");
  },

  updatePkgbuild(pkgbuild: string, latestVersion: string): string {
    return setPkgverAndResetPkgrel(pkgbuild, latestVersion);
  },
};

export default t3Code;
