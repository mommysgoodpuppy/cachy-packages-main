import type { PackageModule } from "../../scripts/package-module.ts";
import {
  fetchUserAgentHeaders,
  pkgbuildField,
  replacePkgbuildField,
  setPkgverAndResetPkgrel,
} from "../../scripts/package-utils.ts";

export const aliases = ["aimp", "aimp-beta"];

const aimpBeta: PackageModule = {
  aliases,

  currentVersion(pkgbuild: string): string {
    return `${pkgbuildField(pkgbuild, "pkgver")}-${pkgbuildField(pkgbuild, "_upstreamrel")}`;
  },

  async latestVersion(): Promise<string> {
    // This endpoint is the native Linux beta's Arch archive, not the Wine release.
    const response = await fetch("https://aimp.ru/?do=download.file&id=16", {
      method: "HEAD",
      redirect: "follow",
      headers: fetchUserAgentHeaders(),
    });
    if (!response.ok) {
      throw new Error(`AIMP beta release lookup failed: HTTP ${response.status}`);
    }
    const url = new URL(response.url);
    const match = url.pathname.match(
      /^\/files\/desktop\/builds\/aimp-(\d+\.\d+\.\d+beta\d+)-(\d+)-x86_64\.pkg\.tar\.zst$/,
    );
    if (url.origin !== "https://aimp.ru" || !match) {
      throw new Error(`Unexpected AIMP native Linux beta archive: ${response.url}`);
    }
    return `${match[1]}-${match[2]}`;
  },

  updatePkgbuild(pkgbuild: string, latestVersion: string): string {
    const match = latestVersion.match(/^(\d+\.\d+\.\d+beta\d+)-(\d+)$/);
    if (!match) throw new Error(`Invalid AIMP beta version: ${latestVersion}`);
    let updated = pkgbuild;
    if (pkgbuildField(pkgbuild, "pkgver") !== match[1]) {
      updated = setPkgverAndResetPkgrel(pkgbuild, match[1]);
    } else if (pkgbuildField(pkgbuild, "_upstreamrel") !== match[2]) {
      updated = replacePkgbuildField(
        pkgbuild,
        "pkgrel",
        String(Number(pkgbuildField(pkgbuild, "pkgrel")) + 1),
      );
    }
    return replacePkgbuildField(updated, "_upstreamrel", match[2]);
  },
};

export default aimpBeta;
