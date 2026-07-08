# Agent Instructions

This repository maintains small local Arch package definitions with a Deno helper for checking,
updating, building, and optionally installing them.

## Hard Rules

- Do not run `pacman`, `paru`, `yay`, `makepkg -si`, system upgrade, or install commands in this
  workspace.
- Never pre-grant Deno permissions in shebangs, tasks, scripts, or documentation. Do not add `-A`,
  `--allow-all`, or any `--allow-*` flags. Run Deno without permission flags so it prompts the user
  when code requests privileged access.
- Treat this repo as a local package authoring repo.
- Keep one package per directory under `packages/<pkgname>/`.
- Each package should include a pinned `PKGBUILD` and package-specific `package.ts`.
- Treat `.SRCINFO`, `src/`, `pkg/`, and `repo/` contents as generated output.
- Pin upstream versions and checksums. Do not use dynamic download/install scripts.
- Do not download during `package()`. All sources must be declared in `source=()`.
- Keep install logic minimal and auditable.
- Prefer test-building packages in a clean disposable Arch environment before installing them on a
  real system.

## Project Preferences

- Prefer simple binary repackagers first, especially `*-bin` packages.
- This is a private reviewed package repo, not a public AUR submission repo.
- Keep PKGBUILDs boring and direct. Avoid clever shell, helper scripts, or broad abstractions.
- Prefer `sha256sums` unless there is a strong reason not to.
- Use detached signatures and `validpgpkeys` when upstream provides signed artifacts.
- Use standard Arch tooling for checksums and metadata: `updpkgsums` and `makepkg --printsrcinfo`.
- Keep `pkgrel` intentional. Reset it to `1` when bumping upstream `pkgver`.
- Do not add optional dependencies just because upstream/AUR lists them. Only keep dependencies
  needed for the default app to run.
- Do not add post-install scripts unless there is a clear runtime requirement.
- Avoid installing extra packaging-convention files that are not needed for use, such as duplicate
  license symlinks. If upstream already ships a license inside the binary bundle, do not add a
  separate `/usr/share/licenses` symlink just for convention.
- Avoid local flag wrapper scripts unless the user explicitly uses them. Prefer the upstream
  launcher or a direct symlink.
- Desktop files, icons, and command symlinks are acceptable when they are needed for normal app
  launch/integration.
- Security-relevant cleanup is acceptable when justified, for example removing setuid from an
  Electron `chrome-sandbox` on packages that work with user namespaces.

## Updating Packages

For a manual package update:

```bash
cd packages/<pkgname>
```

Edit `PKGBUILD` first:

- update `pkgver`
- reset `pkgrel=1` for upstream version bumps
- update package-specific fields such as `_commit` if needed
- keep `source=()` deterministic and version-pinned

Then regenerate checksums:

```bash
SRCDEST=/tmp/aur-self-managed-sources updpkgsums
```

Generate `.SRCINFO` for inspection only when needed:

```bash
makepkg --printsrcinfo
```

For signed sources, use:

```bash
SRCDEST=/tmp/aur-self-managed-sources makepkg --verifysource
```

`validpgpkeys` pins accepted signing keys but does not import keys. Import upstream keys only from
official upstream documentation.

## Version Automation

Use the Deno task from the repository root:

```bash
deno task check vscode
```

This only checks current pinned versions against upstream metadata.

To update package files locally:

```bash
deno task build vscode
```

The build task edits version fields when needed, runs `updpkgsums`, builds the pinned package, and
removes `src/` and `pkg/` afterward. `deno task install vscode` additionally installs the resulting
local archive after sudo and pacman confirmation. Neither task commits, pushes, or opens pull
requests.

There is no hosted update or build automation. Run the scripts locally and review all generated
changes before building the local repository.

## Adding A Binary Package

Minimum package directory:

```text
packages/<pkgname>/
├── PKGBUILD
└── package.ts
```

Additional small local source files are allowed only when they are actually needed, for example a
desktop/protocol file that upstream does not ship and that the package needs for normal use.

Minimum PKGBUILD expectations:

- `pkgname`, `pkgver`, `pkgrel`, `pkgdesc`, `arch`
- `license` for the packaged software, even though this is private
- runtime `depends` needed for default launch/use
- pinned `source=()` entries
- `sha256sums=()`
- minimal `package()` that unpacks/repackages declared sources only

For `.deb` repackagers, the normal shape is:

```bash
source=("https://example.invalid/package_${pkgver}_amd64.deb")
sha256sums=('<pinned sha256>')

package() {
  bsdtar -xf "${srcdir}/package_${pkgver}_amd64.deb" -C "${srcdir}"
  bsdtar -xf "${srcdir}/data.tar."* -C "${pkgdir}"
}
```

Adjust the extraction only as needed for the actual archive format.

## What Not To Add

- Do not add optional plugin runtimes such as `wine`, `wine-mono`, or `nodejs` unless they are
  required for the default app behavior we use.
- Do not add custom `*-flags.conf` launcher wrappers unless requested.
- Do not add install scripts for groups, PolKit, cache refreshes, browser helpers, or similar
  integration unless the app genuinely needs them to work.
- Do not add dynamic source discovery in `package()`.
- Do not download anything in `package()`.
- Do not copy AUR PKGBUILDs verbatim. Use them as references, then write the smallest auditable
  package for this repo.
- Do not commit downloaded source artifacts, tarballs, `.deb` files, signatures, build outputs, or
  Python bytecode.
