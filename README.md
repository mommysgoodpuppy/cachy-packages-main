# Local reviewed packages

Small, self-managed Arch packages for software we do not want to source from the AUR.

Current package definitions:

- `visual-studio-code-bin`
- `android-apktool`
- `steamvr-linux-fixes-layer-bin`

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

Then run this once to add the local repo to `/etc/pacman.conf` and sync pacman's databases:

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
`deno task install <package>` installs through `pacman -S cachy-packages-main/<package>` when the
repo is configured. If it is not configured, it falls back to `pacman -U` and the package remains
visible in `pacman -Qm`.

```bash
cd /home/ellie/git/cachy-packages-main
deno task install vscode
```

That single command:

1. checks Microsoft's official stable release endpoint;
2. updates the pinned PKGBUILD and SHA-256 checksums when needed;
3. builds the package locally; and
4. asks for sudo access and pacman's confirmation before installing or upgrading it.

No Deno permissions are granted in advance. Deno prompts when a package module requests network,
filesystem, or command execution access, so review each requested permission before accepting it.
Package modules cannot silently inherit `-A` or broad default `--allow-*` flags from these tasks.

Downloaded source artifacts are cached under `/tmp/local-reviewed-package-sources`. Built package
archives are written to `repo/`. `src/` and `pkg/` build directories are removed automatically after
`build` or `install`; pass `--keep-build` to keep them for debugging.

Package-specific update logic lives beside its PKGBUILD, for example
`packages/visual-studio-code-bin/package.ts`. The root CLI discovers these modules and provides the
common check, build, and install workflow, so adding a package does not require editing
`scripts/package.ts`.

To update and build without installing:

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
