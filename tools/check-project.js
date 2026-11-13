"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const errors = [];
const frontendFiles = [];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (["node_modules", ".codeartsdoer", "data", "vendor"].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name.endsWith(".js")) frontendFiles.push(full);
  }
}
walk(root);

for (const file of frontendFiles) {
  try {
    new vm.Script(fs.readFileSync(file, "utf8"), { filename: file });
  } catch (error) {
    errors.push(`${path.relative(root, file)}: ${error.message}`);
  }
}

for (const htmlFile of ["index.html", "cities.html", "route.html", "hotel.html", "community.html"]) {
  const file = path.join(root, htmlFile);
  const html = fs.readFileSync(file, "utf8");
  for (const match of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    const reference = match[1];
    if (/^(?:#|https?:|data:|mailto:)/.test(reference)) continue;
    const target = reference.split(/[?#]/)[0];
    if (!fs.existsSync(path.join(root, target))) errors.push(`${htmlFile}: missing ${reference}`);
  }
}

const context = { window: {} };
for (const file of ["data.js", "hotels.js"]) {
  vm.runInNewContext(fs.readFileSync(path.join(root, "js", file), "utf8"), context);
}
const destinations = new Set(context.window.TRAVEL_DATA.map(item => item.name));
if (!context.window.HOTEL_DATA.length) errors.push("hotel data is empty");
for (const hotel of context.window.HOTEL_DATA) {
  if (!destinations.has(hotel.city)) errors.push(`hotel ${hotel.id}: unknown city ${hotel.city}`);
}

for (const required of [
  "backend/server.js", "backend/agent.js", "Dockerfile", "docker-compose.yml",
  ".env.example", "route.html", "hotel.html"
]) {
  if (!fs.existsSync(path.join(root, required))) errors.push(`missing ${required}`);
}

const manifestFile = path.join(root, "assets", "cities", "manifest.json");
if (!fs.existsSync(manifestFile)) {
  errors.push("missing city cover manifest");
} else {
  const manifest = JSON.parse(fs.readFileSync(manifestFile, "utf8"));
  if (manifest.length !== 90) errors.push(`city cover manifest should contain 90 entries, got ${manifest.length}`);
  for (const item of manifest) {
    const image = path.join(root, "assets", "cities", item.file);
    if (!fs.existsSync(image) || fs.statSync(image).size < 1000) {
      errors.push(`missing or invalid city cover: ${item.file}`);
    }
  }
  const photoSources = path.join(root, "assets", "cities", "photo-sources.json");
  if (!fs.existsSync(photoSources)) {
    errors.push("missing real-photo source manifest");
  } else {
    const sources = JSON.parse(fs.readFileSync(photoSources, "utf8"));
    for (const item of sources) {
      if (!item.localFile || !fs.existsSync(path.join(root, item.localFile))) {
        errors.push(`real-photo cover missing: ${item.city}`);
      }
      if (!item.sourcePage || !item.license) {
        errors.push(`real-photo attribution incomplete: ${item.city}`);
      }
    }
  }
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log(`Project check passed: ${frontendFiles.length} JS files, ${context.window.HOTEL_DATA.length} hotels, no broken local links.`);
