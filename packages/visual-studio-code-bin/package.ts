import type { PackageModule } from "../../scripts/package-module.ts";

const releasesUrl = "https://update.code.visualstudio.com/api/releases/stable";

function field(text: string, name: string): string {
  const match = text.match(new RegExp(`^${name}=["']?([^"'\\n]+)`, "m"));
  if (!match) throw new Error(`${name} not found in PKGBUILD`);
  return match[1];
}

function replaceField(text: string, name: string, value: string): string {
  const pattern = new RegExp(`^${name}=["']?[^"'\\n]+["']?$`, "m");
  if (!pattern.test(text)) throw new Error(`${name} not found in PKGBUILD`);
  return text.replace(pattern, `${name}="${value}"`);
}

const vscode: PackageModule = {
  aliases: ["vscode"],

  currentVersion(pkgbuild: string): string {
    return field(pkgbuild, "pkgver");
  },

  async latestVersion(): Promise<string> {
    const response = await fetch(releasesUrl, {
      headers: { "user-agent": "local-reviewed-packages" },
    });
    if (!response.ok) {
      throw new Error(`VS Code release lookup failed: HTTP ${response.status}`);
    }
    const releases: unknown = await response.json();
    if (
      !Array.isArray(releases) || typeof releases[0] !== "string" ||
      !/^\d+\.\d+\.\d+$/.test(releases[0])
    ) {
      throw new Error("Microsoft returned an invalid stable VS Code version");
    }
    return releases[0];
  },

  updatePkgbuild(pkgbuild: string, latestVersion: string): string {
    const updated = replaceField(pkgbuild, "pkgver", latestVersion);
    return replaceField(updated, "pkgrel", "1");
  },
};

export default vscode;
