export type DesktopPatch = {
  id: string;
  script: string;
  reason: string;
};

const patches: readonly DesktopPatch[] = [
  {
    id: "linux-desktop-id",
    script: "patch-linux-desktop-id.mjs",
    reason: "Aligns Electron's Wayland application ID with the installed desktop entry.",
  },
];

export default patches;
