import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const homePath = path.join(
  root,
  "public/stitch/viewport-engineering/home/index.html",
);

const required = [
  "Case Study: Texas Sofi Lakes",
  "Sofi Lakes — Texas",
  "622 Acres.",
  "Trails &amp; Courts",
  "View Sofi Lakes",
  'href="/sofi-lakes"',
  'PATH_USER = "/videos/sofi-lakes-featured-upload.mp4"',
  'PATH_CANON = "/videos/sofi-lakes-featured.mp4"',
  "Sofi Lakes — featured master-planned aerial video.",
];

const html = fs.readFileSync(homePath, "utf8");
let failed = false;
for (const needle of required) {
  if (!html.includes(needle)) {
    console.error(`verify-stitch-featured: missing expected substring:\n  ${needle}`);
    failed = true;
  }
}

const assets = [
  ["public/videos/sofi-lakes-featured.mp4", path.join(root, "public/videos/sofi-lakes-featured.mp4")],
  [
    "public/videos/sofi-lakes-featured-poster.png",
    path.join(root, "public/videos/sofi-lakes-featured-poster.png"),
  ],
];
for (const [label, abs] of assets) {
  if (!fs.existsSync(abs)) {
    console.error(`verify-stitch-featured: missing file ${label}`);
    failed = true;
    continue;
  }
  if (fs.statSync(abs).size === 0) {
    console.error(`verify-stitch-featured: empty file ${label}`);
    failed = true;
  }
}

if (failed) process.exit(1);
console.log("verify-stitch-featured: ok");
