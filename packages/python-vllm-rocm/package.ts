import type { PackageModule } from "../../scripts/package-module.ts";
import {
  fetchUserAgentHeaders,
  pkgbuildField,
  setPkgverAndResetPkgrel,
} from "../../scripts/package-utils.ts";

export const aliases = ["vllm", "vllm-rocm"];

type GithubRelease = {
  tag_name?: unknown;
  prerelease?: unknown;
  draft?: unknown;
};

const requiredTorchVersion = "2.13.0";
const supportedVllmMinor = "0.27";

const pythonVllmRocm: PackageModule = {
  aliases,
  lockedDependencyFiles: ["requirements.lock"],

  currentVersion(pkgbuild: string): string {
    return pkgbuildField(pkgbuild, "pkgver");
  },

  async latestVersion(): Promise<string> {
    const response = await fetch(
      "https://api.github.com/repos/vllm-project/vllm/releases?per_page=30",
      { headers: fetchUserAgentHeaders() },
    );
    if (!response.ok) {
      throw new Error(`vLLM release lookup failed: HTTP ${response.status}`);
    }

    const releases: unknown = await response.json();
    if (!Array.isArray(releases)) throw new Error("GitHub returned invalid vLLM releases");

    for (const release of releases as GithubRelease[]) {
      if (release.draft === true || release.prerelease === true) continue;
      if (typeof release.tag_name !== "string") continue;
      const match = release.tag_name.match(/^v(\d+\.\d+\.\d+)$/);
      if (!match || !match[1].startsWith(`${supportedVllmMinor}.`)) continue;

      const pyprojectResponse = await fetch(
        `https://raw.githubusercontent.com/vllm-project/vllm/${release.tag_name}/pyproject.toml`,
      );
      if (!pyprojectResponse.ok) continue;
      const pyproject = await pyprojectResponse.text();
      const torchMatch = pyproject.match(/["']torch\s*==\s*(\d+\.\d+\.\d+)["']/);
      if (torchMatch?.[1] === requiredTorchVersion) return match[1];
    }

    throw new Error(`No stable vLLM release for PyTorch ${requiredTorchVersion} was found`);
  },

  updatePkgbuild(pkgbuild: string, latestVersion: string): string {
    return setPkgverAndResetPkgrel(pkgbuild, latestVersion);
  },

  async lockDependencies(directory: string, version: string): Promise<void> {
    const temporaryDirectory = await Deno.makeTempDir({ prefix: "vllm-lock-" });
    const outputPath = `${directory}/.requirements.lock.tmp`;
    try {
      for (const file of ["common.txt", "rocm.txt"]) {
        const response = await fetch(
          `https://raw.githubusercontent.com/vllm-project/vllm/v${version}/requirements/${file}`,
          { headers: fetchUserAgentHeaders() },
        );
        if (!response.ok) {
          throw new Error(`Could not fetch vLLM ${file}: HTTP ${response.status}`);
        }
        await Deno.writeTextFile(`${temporaryDirectory}/${file}`, await response.text());
      }
      await Deno.writeTextFile(`${temporaryDirectory}/gguf-plugin.txt`, "gguf>=0.17.0\n");
      // vLLM 0.27.1 pins tensorizer 2.10.1, which crashes during import on Python 3.14.
      // 2.12.1 keeps the same public API and fixes that interpreter compatibility issue.
      await Deno.writeTextFile(
        `${temporaryDirectory}/overrides.txt`,
        "tensorizer==2.12.1\n",
      );

      const command = new Deno.Command("uv", {
        args: [
          "pip",
          "compile",
          `${temporaryDirectory}/rocm.txt`,
          `${temporaryDirectory}/gguf-plugin.txt`,
          "--override",
          `${temporaryDirectory}/overrides.txt`,
          "--excludes",
          `${directory}/system-requirements.txt`,
          "--python-version",
          "3.14",
          "--python-platform",
          "x86_64-unknown-linux-gnu",
          "--torch-backend",
          "rocm7.2",
          "--no-annotate",
          "--emit-index-url",
          "--custom-compile-command",
          "deno task lock vllm",
          "--output-file",
          outputPath,
        ],
        stdout: "null",
        stderr: "inherit",
      });
      const status = await command.spawn().status;
      if (!status.success) throw new Error(`uv exited with status ${status.code}`);
      await Deno.rename(outputPath, `${directory}/requirements.lock`);
      console.log(`Locked vLLM ${version} Python dependencies.`);
    } finally {
      await Deno.remove(temporaryDirectory, { recursive: true });
      await Deno.remove(outputPath).catch((error) => {
        if (!(error instanceof Deno.errors.NotFound)) throw error;
      });
    }
  },

  async validateBuiltPackage(archives: readonly string[]): Promise<void> {
    if (archives.length !== 1) {
      throw new Error(`Expected one vLLM archive, found ${archives.length}`);
    }

    const directory = await Deno.makeTempDir({ prefix: "python-vllm-rocm-validate-" });
    try {
      const extract = await new Deno.Command("bsdtar", {
        args: ["-xf", archives[0], "-C", directory],
        stdout: "inherit",
        stderr: "inherit",
      }).spawn().status;
      if (!extract.success) throw new Error("Could not extract vLLM package for validation");

      const environment = {
        ...Deno.env.toObject(),
        PYTHONNOUSERSITE: "1",
        PYTHONPATH: `${directory}/opt/vllm/python`,
        VLLM_PLUGINS: "gguf",
      };

      const smokeTest = await new Deno.Command("python", {
        args: [
          "-c",
          "import vllm; import vllm._C; import vllm_gguf_plugin; " +
          "from vllm.entrypoints.cli.main import main; " +
          "print(vllm.__version__)",
        ],
        env: environment,
        stdout: "inherit",
        stderr: "inherit",
      }).spawn().status;
      if (!smokeTest.success) throw new Error("Packaged vLLM import smoke test failed");
    } finally {
      await Deno.remove(directory, { recursive: true });
    }
  },
};

export default pythonVllmRocm;
