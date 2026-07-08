export interface PackageModule {
  aliases: readonly string[];
  currentVersion(pkgbuild: string): string;
  latestVersion(): Promise<string>;
  updatePkgbuild(pkgbuild: string, latestVersion: string): string;
}
