import { spawn } from "node:child_process";
import { mkdtemp, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Vite treats # as a URL fragment. A junction gives the existing project a
// safe development path without moving or copying any of the user's files.
let clientDirectory = process.cwd();
if (/[#?]/.test(clientDirectory)) {
  const temporary = await mkdtemp(join(tmpdir(), "techcamp-vite-"));
  const link = join(temporary, "project");
  await symlink(
    clientDirectory,
    link,
    process.platform === "win32" ? "junction" : "dir",
  );
  clientDirectory = link;
}

const children = [
  spawn(process.execPath, ["--watch", "server/index.mjs"], {
    stdio: "inherit",
    windowsHide: true,
  }),
  spawn(
    process.execPath,
    [
      "--preserve-symlinks",
      "--preserve-symlinks-main",
      join(clientDirectory, "node_modules/vite/bin/vite.js"),
      clientDirectory,
    ],
    {
      stdio: "inherit",
      windowsHide: true,
      cwd: clientDirectory,
    },
  ),
];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill();
  setTimeout(() => process.exit(code), 200).unref();
}
children.forEach((child) => {
  child.on("error", (error) => {
    console.error(error.message);
    stop(1);
  });
  child.on("exit", (code) => stop(code || 0));
});
process.on("SIGINT", () => stop());
process.on("SIGTERM", () => stop());
