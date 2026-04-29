import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const src = path.join(root, "public", "brand", "logo-mark.png");

const targets = [
  { out: path.join(root, "src", "app", "icon.png"), size: 512, bg: "#ffffff" },
  { out: path.join(root, "src", "app", "apple-icon.png"), size: 180, bg: "#ffffff" },
  { out: path.join(root, "public", "icon-192.png"), size: 192, bg: "#ffffff" },
  { out: path.join(root, "public", "icon-512.png"), size: 512, bg: "#ffffff" },
  { out: path.join(root, "public", "icon-maskable-512.png"), size: 512, bg: "#ffffff", padRatio: 0.2 },
];

for (const { out, size, bg, padRatio = 0.12 } of targets) {
  await mkdir(path.dirname(out), { recursive: true });
  const inner = Math.round(size * (1 - padRatio * 2));
  const resized = await sharp(src)
    .resize(inner, inner, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();
  await sharp({
    create: { width: size, height: size, channels: 4, background: bg },
  })
    .composite([{ input: resized, gravity: "center" }])
    .png()
    .toFile(out);
  console.log(`  ${path.relative(root, out)} (${size}x${size})`);
}
console.log("Done.");
