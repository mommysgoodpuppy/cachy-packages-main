import type { PackageModule } from "../../scripts/package-module.ts";
import {
  fetchUserAgentHeaders,
  pkgbuildField,
  replacePkgbuildField,
  setPkgverAndResetPkgrel,
} from "../../scripts/package-utils.ts";

const latestUrl = "https://lmstudio.ai/download/latest/linux/x64";
export const aliases = ["lmstudio", "lm-studio"];

function versionFromUrl(url: string): string {
  const match = url.match(/\/(\d+\.\d+\.\d+)-(\d+)\/LM-Studio-\1-\2-x64\.AppImage$/);
  if (!match) throw new Error(`Could not parse LM Studio version from ${url}`);
  return `${match[1]}-${match[2]}`;
}

const lmstudio: PackageModule = {
  aliases,

  currentVersion(pkgbuild: string): string {
    return `${pkgbuildField(pkgbuild, "pkgver")}-${pkgbuildField(pkgbuild, "_build")}`;
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
    const [pkgver, build] = latestVersion.split("-");
    if (!pkgver || !build) throw new Error(`Invalid LM Studio version ${latestVersion}`);
    const updated = setPkgverAndResetPkgrel(pkgbuild, pkgver);
    return replacePkgbuildField(updated, "_build", build);
  },
};

export default lmstudio;
