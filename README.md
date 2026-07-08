# Local reviewed packages

Small, self-managed Arch packages for software we do not want to source from the AUR. It currently
contains the pinned official VS Code binary package.

## Install or update VS Code

Required tools: Deno, `base-devel`, `pacman-contrib`, and `libarchive`.

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
