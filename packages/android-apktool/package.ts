import type { PackageModule } from "../../scripts/package-module.ts";

const releasesUrl = "https://api.github.com/repos/iBotPeaches/Apktool/releases/latest";

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

const apktool: PackageModule = {
  aliases: ["apktool"],

  currentVersion(pkgbuild: string): string {
    return field(pkgbuild, "pkgver");
  },

  async latestVersion(): Promise<string> {
    const response = await fetch(releasesUrl, {
      headers: { "user-agent": "local-reviewed-packages" },
    });
    if (!response.ok) {
      throw new Error(`apktool release lookup failed: HTTP ${response.status}`);
    }
    const release: unknown = await response.json();
    const tag = release && typeof release === "object" &&
        typeof (release as { tag_name?: unknown }).tag_name === "string"
      ? (release as { tag_name: string }).tag_name
      : "";
    const match = tag.match(/^v(\d+\.\d+\.\d+)$/);
    if (!match) throw new Error("GitHub returned an invalid apktool release tag");
    return match[1];
  },

  updatePkgbuild(pkgbuild: string, latestVersion: string): string {
    const updated = replaceField(pkgbuild, "pkgver", latestVersion);
    return replaceField(updated, "pkgrel", "1");
  },
};

export default apktool;
