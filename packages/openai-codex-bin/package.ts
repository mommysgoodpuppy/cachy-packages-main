import type { PackageModule } from "../../scripts/package-module.ts";
import {
  githubLatestReleaseTag,
  pkgbuildField,
  setPkgverAndResetPkgrel,
} from "../../scripts/package-utils.ts";

export const aliases = ["codex", "openai-codex"];

const openaiCodexBin: PackageModule = {
  aliases,

  currentVersion(pkgbuild: string): string {
    return pkgbuildField(pkgbuild, "pkgver");
  },

  async latestVersion(): Promise<string> {
    const tag = await githubLatestReleaseTag("openai/codex", "OpenAI Codex");
    const match = tag.match(/^rust-v(\d+\.\d+\.\d+)$/);
    if (!match) throw new Error("GitHub returned an invalid OpenAI Codex release tag");
    return match[1];
  },

  updatePkgbuild(pkgbuild: string, latestVersion: string): string {
    return setPkgverAndResetPkgrel(pkgbuild, latestVersion);
  },
};

export default openaiCodexBin;
