import type { PackageModule } from "../../scripts/package-module.ts";
import {
  fetchUserAgentHeaders,
  pkgbuildField,
  setPkgverAndResetPkgrel,
} from "../../scripts/package-utils.ts";

const packagesUrl =
  "https://persistent.oaistatic.com/codex-app-prod/linux/deb/dists/stable/main/binary-amd64/Packages";
export const aliases = ["chatgpt-desktop"];

export function chatgptVersionFromPackages(packages: string): string {
  const stanza = packages.split(/\r?\n\r?\n/).find((candidate) =>
    /^Package: chatgpt$/m.test(candidate)
  );
  const version = stanza?.match(/^Version: (\S+)$/m)?.[1];
  if (!version || !/^\d+\.\d+\.\d+$/.test(version)) {
    throw new Error("ChatGPT Linux repository returned an invalid package version");
  }
  return version;
}

const openaiChatgptDesktop: PackageModule = {
  aliases,

  currentVersion(pkgbuild: string): string {
    return pkgbuildField(pkgbuild, "pkgver");
  },

  async latestVersion(): Promise<string> {
    const response = await fetch(packagesUrl, { headers: fetchUserAgentHeaders() });
    if (!response.ok) {
      throw new Error(`ChatGPT Linux package lookup failed: HTTP ${response.status}`);
    }
    return chatgptVersionFromPackages(await response.text());
  },

  updatePkgbuild(pkgbuild: string, latestVersion: string): string {
    return setPkgverAndResetPkgrel(pkgbuild, latestVersion);
  },
};

export default openaiChatgptDesktop;
