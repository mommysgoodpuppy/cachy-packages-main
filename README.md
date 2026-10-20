# Local reviewed packages

Small, self-managed Arch packages for software we do not want to source from the AUR.

Current package definitions:

- `aimp-beta-bin` (native Linux beta; aliases: `aimp`, `aimp-beta`)
- `bitwig-studio-bin` (license ceiling: stable 6.0.x only)
- `visual-studio-code-bin`
- `android-apktool`
- `llama.cpp-hip`
- `llama.cpp-vulkan`
- `lmstudio-bin`
- `openai-codex-bin`
- `openai-chatgpt-desktop`
- `python-vllm-rocm`
- `steamvr-linux-fixes-layer-bin`
- `t3-code`

The goal is to move selected `pacman -Qm` packages here as small, reviewed, pinned definitions and
eventually stop depending on AUR helpers for routine package installs.

## Install or update VS Code

Required tools: Deno, `base-devel`, `pacman-contrib`, and `libarchive`.

## One-time local repo setup

Packages installed with `pacman -U` still show up in `pacman -Qm`, because pacman only considers a
package non-foreign when it exists in a configured sync repository. Build at least one package first
so the local repo database exists:

```bash
deno task build vscode
```

Then run this once to add the local repo to `/etc/pacman.conf`:

```bash
deno task setup-repo
```

The task appends this stanza if it is not already configured:

```ini
[cachy-packages-main]
SigLevel = Optional TrustAll
Server = file:///home/ellie/git/cachy-packages-main/repo
```

The task refuses to add the stanza until `repo/cachy-packages-main.db.tar.gz` exists, because a
configured file repo without a database can break normal pacman syncs.

`deno task build <package>` updates `repo/cachy-packages-main.db.tar.gz` with `repo-add`.
`deno task install <package>` refreshes only this local repository through a temporary pacman
configuration, then installs `cachy-packages-main/<package>`. It does not refresh or partially
upgrade official repositories.

```bash
cd /home/ellie/git/cachy-packages-main
deno task install vscode
```

That command checks the selected package's upstream version, updates its pinned source/checksums
when needed, builds it, adds it to the local repository, then asks for sudo access and pacman's
confirmation before installing or upgrading it.

## Update

`update` refreshes a package definition from upstream. When that package is already installed, it
also builds and installs the result through the local repository:

```bash
deno task update vscode
```

When the package is not installed, `update` only changes its definition. A generated SHA-256 pins
later builds, but does not independently authenticate the first download. Prefer upstream
signatures or published checksums where available.

To update every package definition that is already installed on this machine:

```bash
deno task update all
```

It skips package definitions not present in the installed package database. It builds and installs a
selected package only when its upstream version changed. `build` is the explicit pinned-source build
command; `install` always refreshes the selected definition before building and installing it.

No Deno permissions are granted in advance. Deno prompts when a package module requests network,
filesystem, or command execution access, so review each requested permission before accepting it.
The runner reads the static `export const aliases = [...]` declaration from every `package.ts` for
discovery, then imports only the selected package module. Package modules cannot silently inherit
`-A` or broad default `--allow-*` flags from these tasks.

Downloaded source artifacts are cached under `/tmp/local-reviewed-package-sources`. Built package
archives are written to `repo/`. `src/` and `pkg/` build directories are removed automatically after
`build` or `install`; pass `--keep-build` to keep them for debugging.

Each package has a `PKGBUILD` and package-specific `package.ts` update logic. The root CLI reads
the static alias export without executing updater code, so adding a package does not require editing
`scripts/package.ts`.

Packages with large language-specific dependency graphs may keep those dependencies in a reviewed
lockfile and install them into a package-private prefix during `build()`. Primary sources remain in
`source=()`, and `package()` remains offline. To regenerate a supported package's dependency lock:

```bash
deno task lock vllm
```

To build the reviewed, pinned package without installing:

```bash
deno task build vscode
```

To keep generated build directories:

```bash
deno task build vscode --keep-build
```

To check for an update without changing, building, or installing anything:

```bash
deno task check vscode
```

## Bitwig Studio (licensed 6.0 series)

`deno task check bitwig` checks only stable 6.0.x Linux releases in Bitwig's official release archive.
The package updater rejects 6.1+, older series, and prereleases even when passed directly to its
update function. Changing the licensed series requires explicit owner approval.

`deno task build bitwig` builds the pinned official DEB as an Arch package. `deno task install bitwig`
uses the local repository workflow. Run `deno test packages/bitwig-studio-bin/package_test.ts` to
verify the license ceiling. No system Java or Wine is required by this package; the upstream
runtime and launcher are preserved. The packaged 32-bit native plugin host may need additional
multilib dependencies if used; they are not installed for the default 64-bit workflow.

The package version ceiling applies to this repository's updater, not Bitwig's own update
notifications or a separately installed Flatpak. Current pin: 6.0.11.

## Bitwig Windows VST bridge

`yabridge-vst2-compat` (aliases `yabridge`, `yabridgectl`) pins upstream's
`new-wine10-embedding` branch to commit `ba7022df0aee1e91cde62d7f0e940d3bc43a82b0`.
It is intentionally held at that revision until compatibility is reviewed again. It supports
64-bit Windows VST2 and VST3. The initial VST2 set is OTT, Dimension Expander, CamelCrusher,
Serum 1 and SerumFX; VST3 support is for legacy project-state recovery. It does not claim support
for 32-bit plugins or Windows CLAP. Native Linux VST3/CLAP remain unaffected.

All primary/C++ dependency archives are version/commit pinned with SHA-256. Build uses
`--wrap-mode=nodownload`, so Meson cannot silently fetch changed dependencies. The host and
bridge are built together with system Wine; only yabridgectl is reused from the official 5.1.1
binary archive. Upstream's compiled host banner still reports 5.1.1 from the source archive;
the Arch package version records the compatibility revision. Stable 5.1.1 Wine host binaries
are not installed. Known-good initial build runtime: Wine 11.16-2.1. Recheck compatibility after
future Wine upgrades.

Build with `deno task build yabridge`; install with `deno task install yabridge`.
