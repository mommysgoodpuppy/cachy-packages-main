import type { PackageModule } from "../../scripts/package-module.ts";
import {
  fetchUserAgentHeaders,
  pkgbuildField,
  setPkgverAndResetPkgrel,
} from "../../scripts/package-utils.ts";

const updateApiUrl = "https://windsurf-stable.codeium.com/api/update/linux-x64-deb/stable/latest";
export const aliases = ["devin"];

let cachedUrl: string | null = null;

function versionFromApi(data: { url?: unknown }): string {
  const url = data?.url;
  if (!url || typeof url !== "string") {
    throw new Error("Devin Desktop update response missing url");
  }
  const match = url.match(/Devin-linux-x64-(\d+\.\d+\.\d+)\.deb$/);
  if (!match) {
    throw new Error("Devin Desktop update response url did not contain a version");
  }
  cachedUrl = url;
  return match[1];
}

const devinDesktop: PackageModule = {
  aliases,

  currentVersion(pkgbuild: string): string {
    return pkgbuildField(pkgbuild, "pkgver");
  },

  async latestVersion(): Promise<string> {
    const response = await fetch(updateApiUrl, {
      headers: fetchUserAgentHeaders(),
    });
    if (!response.ok) {
      throw new Error(`Devin Desktop update lookup failed: HTTP ${response.status}`);
    }
    const data = await response.json();
    return versionFromApi(data);
  },

  updatePkgbuild(pkgbuild: string, latestVersion: string): string {
    const response = setPkgverAndResetPkgrel(pkgbuild, latestVersion);
    if (!cachedUrl) {
      return response;
    }
    const sourcePattern =
      /^source=\(\n  "https:\/\/windsurf-stable\.codeiumdata\.com\/linux-x64-deb\/stable\/[^\/]+\/Devin-linux-x64-(?:\$\{pkgver\}|\d+\.\d+\.\d+)\.deb"\n\)$/m;
    if (!sourcePattern.test(response)) {
      throw new Error("Devin Desktop PKGBUILD source did not match the expected URL");
    }
    return response.replace(
      sourcePattern,
      `source=(\n  "${cachedUrl}"\n)`,
    );
  },
};

export default devinDesktop;
