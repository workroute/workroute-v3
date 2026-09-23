// Regenerate PWA/app icons from scripts/assets/logo-source.png.
// Run with: node scripts/generate-icons.mjs
import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(root, "..");
const source = path.join(root, "assets", "logo-source.png");

const targets = [
  { file: "public/icons/icon-192.png", size: 192 },
  { file: "public/icons/icon-512.png", size: 512 },
  { file: "app/apple-icon.png", size: 180 },
  { file: "app/icon.png", size: 48 },
];

async function main() {
  await mkdir(path.join(projectRoot, "public/icons"), { recursive: true });

  for (const { file, size } of targets) {
    const out = path.join(projectRoot, file);
    await sharp(source).resize(size, size, { fit: "cover" }).png().toFile(out);
    console.log(`wrote ${file} (${size}x${size})`);
  }

  // Sample the background navy from a corner pixel for the manifest theme colour.
  const { data } = await sharp(source)
    .extract({ left: 4, top: 4, width: 1, height: 1 })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const hex = `#${data[0].toString(16).padStart(2, "0")}${data[1].toString(16).padStart(2, "0")}${data[2].toString(16).padStart(2, "0")}`;
  console.log(`sampled navy background: ${hex}`);
}

main();
