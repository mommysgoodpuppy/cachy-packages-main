import type { PackageModule } from "../../scripts/package-module.ts";
import {
  fetchUserAgentHeaders,
  pkgbuildField,
  setPkgverAndResetPkgrel,
} from "../../scripts/package-utils.ts";

export const aliases = ["bitwig", "bitwig-studio"];
const releasesUrl = "https://www.bitwig.com/previous_releases/";

// License ceiling: changing this series requires the owner's explicit approval.
function requireLicensedVersion(version: string): string {
  if (!/^6\.0(?:\.(?:0|[1-9]\d*))?$/.test(version)) {
    throw new Error(`Bitwig license is limited to stable 6.0.x; refusing ${version}`);
  }
  return version;
}

export function latestLicensedVersion(html: string): string {
  const versions: string[] = [];
  for (const match of html.matchAll(/href\s*=\s*["']([^"']+)["']/gi)) {
    const url = new URL(match[1], releasesUrl);
    if (url.origin !== "https://www.bitwig.com") continue;
    const version = decodeURIComponent(url.pathname).match(
      /^\/dl\/Bitwig Studio\/(6\.0(?:\.(?:0|[1-9]\d*))?)\/installer_linux\/$/,
    )?.[1];
    if (version) versions.push(version);
  }
  if (!versions.length) {
    throw new Error("No stable Bitwig 6.0.x Linux release found; refusing fallback");
  }
  versions.sort((a, b) => Number(b.split(".")[2] ?? 0) - Number(a.split(".")[2] ?? 0));
  return versions[0];
}

const bitwig: PackageModule = {
  aliases,
  currentVersion(pkgbuild) {
    return requireLicensedVersion(pkgbuildField(pkgbuild, "pkgver"));
  },
  async latestVersion() {
    const response = await fetch(releasesUrl, { headers: fetchUserAgentHeaders() });
    if (!response.ok) throw new Error(`Bitwig release lookup failed: HTTP ${response.status}`);
    return latestLicensedVersion(await response.text());
  },
  updatePkgbuild(pkgbuild, version) {
    return setPkgverAndResetPkgrel(pkgbuild, requireLicensedVersion(version));
  },
};
export default bitwig;
