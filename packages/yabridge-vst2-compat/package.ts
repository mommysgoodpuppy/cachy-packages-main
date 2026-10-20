import type { PackageModule } from "../../scripts/package-module.ts";
import { pkgbuildField } from "../../scripts/package-utils.ts";
export const aliases = ["yabridge", "yabridgectl"];
const pinnedVersion = "5.1.1.r41.gba7022df";
// Keep this compatibility experiment pinned until the owner approves a new runtime.
const bridge: PackageModule = {
  aliases,
  currentVersion: (text) => pkgbuildField(text, "pkgver"),
  latestVersion: () => Promise.resolve(pinnedVersion),
  updatePkgbuild(text, version) {
    if (version !== pinnedVersion || pkgbuildField(text, "pkgver") !== pinnedVersion) {
      throw new Error("Review Wine compatibility and source pins before changing yabridge");
    }
    return text;
  },
};
export default bridge;
