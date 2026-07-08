const userAgent = "local-reviewed-packages";

export function pkgbuildField(text: string, name: string): string {
  const match = text.match(new RegExp(`^${name}=["']?([^"'\\n]+)`, "m"));
  if (!match) throw new Error(`${name} not found in PKGBUILD`);
  return match[1];
}

export function replacePkgbuildField(text: string, name: string, value: string): string {
  const pattern = new RegExp(`^${name}=["']?[^"'\\n]+["']?$`, "m");
  if (!pattern.test(text)) throw new Error(`${name} not found in PKGBUILD`);
  return text.replace(pattern, `${name}="${value}"`);
}

export function setPkgverAndResetPkgrel(pkgbuild: string, pkgver: string): string {
  const updated = replacePkgbuildField(pkgbuild, "pkgver", pkgver);
  return replacePkgbuildField(updated, "pkgrel", "1");
}

export async function githubLatestReleaseTag(repo: string, name: string): Promise<string> {
  const response = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, {
    headers: { "user-agent": userAgent },
  });
  if (!response.ok) {
    throw new Error(`${name} release lookup failed: HTTP ${response.status}`);
  }
  const release: unknown = await response.json();
  if (
    release && typeof release === "object" &&
    typeof (release as { tag_name?: unknown }).tag_name === "string"
  ) {
    return (release as { tag_name: string }).tag_name;
  }
  throw new Error(`GitHub returned an invalid ${name} release`);
}

export async function githubLatestVPrefixedVersion(repo: string, name: string): Promise<string> {
  const tag = await githubLatestReleaseTag(repo, name);
  const match = tag.match(/^v(\d+\.\d+\.\d+)$/);
  if (!match) throw new Error(`GitHub returned an invalid ${name} release tag`);
  return match[1];
}

export function fetchUserAgentHeaders(): HeadersInit {
  return { "user-agent": userAgent };
}
