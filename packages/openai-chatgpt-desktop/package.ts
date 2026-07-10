import type { PackageModule } from "../../scripts/package-module.ts";
import {
  fetchUserAgentHeaders,
  pkgbuildField,
  setPkgverAndResetPkgrel,
} from "../../scripts/package-utils.ts";

const appcastUrl = "https://persistent.oaistatic.com/codex-app-prod/appcast.xml";
export const aliases = ["chatgpt-desktop"];

const openaiChatgptDesktop: PackageModule = {
  aliases,

  currentVersion(pkgbuild: string): string {
    return pkgbuildField(pkgbuild, "pkgver");
  },

  async latestVersion(): Promise<string> {
    const response = await fetch(appcastUrl, { headers: fetchUserAgentHeaders() });
    if (!response.ok) {
      throw new Error(`ChatGPT Desktop appcast lookup failed: HTTP ${response.status}`);
    }
    const appcast = await response.text();
    const match = appcast.match(
      /<sparkle:shortVersionString>([^<]+)<\/sparkle:shortVersionString>/,
    );
    if (!match || !/^\d+\.\d+\.\d+$/.test(match[1])) {
      throw new Error("ChatGPT Desktop appcast returned an invalid version");
    }
    return match[1];
  },

  updatePkgbuild(pkgbuild: string, latestVersion: string): string {
    return setPkgverAndResetPkgrel(pkgbuild, latestVersion);
  },
};

export default openaiChatgptDesktop;
