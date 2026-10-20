import bitwig, { latestLicensedVersion } from "./package.ts";

const link = (v: string) =>
  `<a href="https://www.bitwig.com/dl/Bitwig%20Studio/${v}/installer_linux/">Ubuntu</a>`;
function equal(a: unknown, b: unknown) {
  if (a !== b) throw new Error(`Expected ${b}, received ${a}`);
}
function rejects(fn: () => unknown) {
  let rejected = false;
  try {
    fn();
  } catch {
    rejected = true;
  }
  if (!rejected) throw new Error("Expected rejection");
}
Deno.test("license ceiling, prerelease exclusion and numeric patch ordering", () => {
  equal(
    latestLicensedVersion(
      ["6.1", "7.0", "6.0.9", "6.0.11", "6.0.12 Beta 1", "6.0"].map(link).join(""),
    ),
    "6.0.11",
  );
  equal(latestLicensedVersion(link("6.0")), "6.0");
  rejects(() => latestLicensedVersion(link("6.1")));
  rejects(() => latestLicensedVersion(link("6.0.99").replace("www.bitwig.com", "example.com")));
});
Deno.test("update entry point cannot cross licensed series", () => {
  const original = 'pkgver="6.0.11"\npkgrel="3"\n';
  for (const v of ["6.1", "6.1.0", "7.0", "6.0.12 Beta 1", "6.0.12-rc1", "6.0.12\n"]) {
    rejects(() => bitwig.updatePkgbuild(original, v));
  }
  equal(bitwig.updatePkgbuild(original, "6.0.12"), 'pkgver="6.0.12"\npkgrel="1"\n');
  rejects(() => bitwig.currentVersion('pkgver="6.1"\n'));
});
