import type { PackageModule } from "../../scripts/package-module.ts";
import {
  githubLatestReleaseTag,
  pkgbuildField,
  setPkgverAndResetPkgrel,
} from "../../scripts/package-utils.ts";

const llamaCppHip: PackageModule = {
  aliases: ["llama", "llama-hip"],

  currentVersion(pkgbuild: string): string {
    return pkgbuildField(pkgbuild, "pkgver");
  },

  async latestVersion(): Promise<string> {
    const tag = await githubLatestReleaseTag("ggml-org/llama.cpp", "llama.cpp");
    if (!/^b\d+$/.test(tag)) throw new Error("GitHub returned an invalid llama.cpp release tag");
    return tag;
  },

  updatePkgbuild(pkgbuild: string, latestVersion: string): string {
    return setPkgverAndResetPkgrel(pkgbuild, latestVersion);
  },
};

export default llamaCppHip;
