import type { PackageModule } from "../../scripts/package-module.ts";
import {
  fetchUserAgentHeaders,
  pkgbuildField,
  replacePkgbuildField,
} from "../../scripts/package-utils.ts";

const latestUrl = "https://lmstudio.ai/download/latest/linux/x64";

function versionFromUrl(url: string): string {
  const match = url.match(/\/(\d+\.\d+\.\d+)-(\d+)\/LM-Studio-\1-\2-x64\.AppImage$/);
  if (!match) throw new Error(`Could not parse LM Studio version from ${url}`);
  return `${match[1]}-${match[2]}`;
}

const lmstudio: PackageModule = {
  aliases: ["lmstudio", "lm-studio"],

  currentVersion(pkgbuild: string): string {
    return `${pkgbuildField(pkgbuild, "pkgver")}-${pkgbuildField(pkgbuild, "pkgrel")}`;
  },

  async latestVersion(): Promise<string> {
    const response = await fetch(latestUrl, {
      method: "HEAD",
      redirect: "follow",
      headers: fetchUserAgentHeaders(),
    });
    if (!response.ok) {
      throw new Error(`LM Studio release lookup failed: HTTP ${response.status}`);
    }
    return versionFromUrl(response.url);
  },

  updatePkgbuild(pkgbuild: string, latestVersion: string): string {
    const [pkgver, pkgrel] = latestVersion.split("-");
    if (!pkgver || !pkgrel) throw new Error(`Invalid LM Studio version ${latestVersion}`);
    const updated = replacePkgbuildField(pkgbuild, "pkgver", pkgver);
    return replacePkgbuildField(updated, "pkgrel", pkgrel);
  },
};

export default lmstudio;
