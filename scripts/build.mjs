import { cp, mkdir, rm } from "node:fs/promises";

await import("./generate-data.mjs");

const staticDirectories = ["css", "data", "fonts", "js"];
const staticFiles = [
    "apple-touch-icon.png",
    "CNAME",
    "favicon-32.png",
    "icon-192.png",
    "icon-512-maskable.png",
    "icon-512.png",
    "index.html",
    "manifest.json",
    "og.png",
    "og-changefeed.png",
    "pwa_icon.png"
];

await rm("dist", { recursive: true, force: true });
await mkdir("dist/client", { recursive: true });
await mkdir("dist/server", { recursive: true });

await Promise.all([
    ...staticDirectories.map((directory) => cp(directory, `dist/client/${directory}`, { recursive: true })),
    ...staticFiles.map((file) => cp(file, `dist/client/${file}`)),
    cp("worker/index.js", "dist/server/index.js")
]);
