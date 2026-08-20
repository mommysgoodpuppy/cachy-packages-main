export interface PackageModule {
  aliases: readonly string[];
  currentVersion(pkgbuild: string): string;
  latestVersion(): Promise<string>;
  updatePkgbuild(pkgbuild: string, latestVersion: string): string;
  lockedDependencyFiles?: readonly string[];
  lockDependencies?(directory: string, version: string): Promise<void>;
  validateBuiltPackage?(archives: readonly string[]): Promise<void>;
}
