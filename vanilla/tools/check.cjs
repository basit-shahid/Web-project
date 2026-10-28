// Validate the static deliverable without bundling, transpiling or installing packages.
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const assert = require("node:assert/strict");
const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const assets = [...html.matchAll(/(?:src|href)="([^"#]+)"/g)]
  .map((m) => m[1])
  .filter((p) => !p.includes("://"));
for (const asset of assets)
  assert.ok(
    fs.existsSync(path.join(root, asset)),
    `Missing static asset: ${asset}`,
  );
const files = fs
  .readdirSync(path.join(root, "js"))
  .filter((n) => n.endsWith(".js"));
for (const name of files)
  new vm.Script(fs.readFileSync(path.join(root, "js", name), "utf8"), {
    filename: name,
  });
assert.equal(
  (html.match(/id="[^"]+"/g) || []).length,
  new Set(html.match(/id="[^"]+"/g) || []).size,
  "Duplicate static IDs",
);
console.log(
  `PASS: ${assets.length} static references and ${files.length} classic JavaScript files. Deploy vanilla/ as-is; no generated build is needed.`,
);
