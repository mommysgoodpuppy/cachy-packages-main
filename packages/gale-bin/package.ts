import type { PackageModule } from "../../scripts/package-module.ts";
import {
  fetchUserAgentHeaders,
  pkgbuildField,
  setPkgverAndResetPkgrel,
} from "../../scripts/package-utils.ts";

export const aliases = ["gale"];

type GithubRelease = {
  tag_name?: unknown;
  assets?: unknown;
};

const galeBin: PackageModule = {
  aliases,

  currentVersion(pkgbuild: string): string {
    return pkgbuildField(pkgbuild, "pkgver");
  },

  async latestVersion(): Promise<string> {
    const response = await fetch(
      "https://api.github.com/repos/Kesomannen/gale/releases/latest",
      { headers: fetchUserAgentHeaders() },
    );
    if (!response.ok) {
      throw new Error(`Gale release lookup failed: HTTP ${response.status}`);
    }

    const release: unknown = await response.json();
    if (!release || typeof release !== "object") {
      throw new Error("GitHub returned an invalid Gale release");
    }

    const { tag_name, assets } = release as GithubRelease;
    if (typeof tag_name !== "string" || !/^\d+\.\d+\.\d+$/.test(tag_name)) {
      throw new Error("GitHub returned an invalid Gale release tag");
    }
    if (!Array.isArray(assets)) {
      throw new Error("GitHub returned invalid Gale release assets");
    }

    const expectedAsset = `Gale_${tag_name}_amd64.deb`;
    const hasLinuxAsset = assets.some((asset: unknown) =>
      asset !== null && typeof asset === "object" &&
      (asset as { name?: unknown }).name === expectedAsset
    );
    if (!hasLinuxAsset) {
      throw new Error(`Gale release is missing ${expectedAsset}`);
    }

    return tag_name;
  },

  updatePkgbuild(pkgbuild: string, latestVersion: string): string {
    return setPkgverAndResetPkgrel(pkgbuild, latestVersion);
  },
};

export default galeBin;
