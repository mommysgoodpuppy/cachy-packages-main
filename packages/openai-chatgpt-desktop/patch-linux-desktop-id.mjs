#!/usr/bin/env node
// SPDX-FileCopyrightText: 2026 Arch Linux Contributors
// SPDX-License-Identifier: 0BSD

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const appRoot = process.argv[2] ?? "app-extracted";
const packagePath = join(appRoot, "package.json");
const packageJson = JSON.parse(readFileSync(packagePath, "utf8"));

if (packageJson.desktopName != null && packageJson.desktopName !== "ChatGPT.desktop") {
  throw new Error(`unexpected existing desktopName: ${packageJson.desktopName}`);
}

packageJson.desktopName = "ChatGPT.desktop";
writeFileSync(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);
