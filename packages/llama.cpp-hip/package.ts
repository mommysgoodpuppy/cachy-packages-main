import type { PackageModule } from "../../scripts/package-module.ts";
import {
  fetchUserAgentHeaders,
  pkgbuildField,
  setPkgverAndResetPkgrel,
} from "../../scripts/package-utils.ts";

export const aliases = ["llama", "llama-hip"];

type GithubRelease = {
  tag_name?: unknown;
  assets?: unknown;
};

const llamaCppHip: PackageModule = {
  aliases,

  currentVersion(pkgbuild: string): string {
    return pkgbuildField(pkgbuild, "pkgver");
  },

  async latestVersion(): Promise<string> {
    const response = await fetch(
      "https://api.github.com/repos/ggml-org/llama.cpp/releases?per_page=100",
      { headers: fetchUserAgentHeaders() },
    );
    if (!response.ok) {
      throw new Error(`llama.cpp release lookup failed: HTTP ${response.status}`);
    }

    const releases: unknown = await response.json();
    if (!Array.isArray(releases)) {
      throw new Error("GitHub returned invalid llama.cpp releases");
    }

    for (const release of releases as GithubRelease[]) {
      if (typeof release.tag_name !== "string" || !/^b\d+$/.test(release.tag_name)) continue;
      if (!Array.isArray(release.assets)) continue;
      const expectedAsset = `llama-${release.tag_name}-bin-ubuntu-rocm-7.2-x64.tar.gz`;
      const hasRocmAsset = release.assets.some((asset: unknown) =>
        asset !== null && typeof asset === "object" &&
        (asset as { name?: unknown }).name === expectedAsset
      );
      if (hasRocmAsset) return release.tag_name;
    }

    throw new Error("No llama.cpp release with an Ubuntu ROCm 7.2 x64 archive was found");
  },

  updatePkgbuild(pkgbuild: string, latestVersion: string): string {
    return setPkgverAndResetPkgrel(pkgbuild, latestVersion);
  },

  async validateBuiltPackage(archives: readonly string[]): Promise<void> {
    if (archives.length !== 1) {
      throw new Error(`Expected one llama.cpp archive, found ${archives.length}`);
    }
    const directory = await Deno.makeTempDir({ prefix: "llama.cpp-hip-validate-" });
    try {
      const archive = archives[0];
      const extract = await new Deno.Command("bsdtar", {
        args: ["-xf", archive, "-C", directory],
        stdout: "inherit",
        stderr: "inherit",
      }).spawn().status;
      if (!extract.success) throw new Error("Could not extract llama.cpp package for validation");

      const executable = `${directory}/usr/bin/llama-cli`;
      const environment = { ...Deno.env.toObject(), LD_LIBRARY_PATH: `${directory}/usr/lib` };
      const ldd = await new Deno.Command("ldd", {
        args: [executable],
        env: environment,
        stdout: "piped",
        stderr: "inherit",
      }).output();
      if (!ldd.success) throw new Error("ldd failed for packaged llama-cli");
      const lddOutput = new TextDecoder().decode(ldd.stdout);
      if (lddOutput.includes("not found")) {
        throw new Error(`Packaged llama-cli has unresolved libraries:\n${lddOutput}`);
      }

      const smokeTest = await new Deno.Command(executable, {
        args: ["--version"],
        env: environment,
        stdout: "inherit",
        stderr: "inherit",
      }).spawn().status;
      if (!smokeTest.success) throw new Error("Packaged llama-cli --version failed");
    } finally {
      await Deno.remove(directory, { recursive: true });
    }
  },
};

export default llamaCppHip;
