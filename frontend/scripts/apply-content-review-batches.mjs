import { readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const frontendDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const catalogFiles = ["legacy-catalog.json", "generated-catalog.json", "expanded-catalog.json"];

function itemKey(item) {
  const title = item.translations?.find((translation) => translation.lang === "en")?.title || "";
  return `${item.category}|${String(item.latitude)}|${String(item.longitude)}|${title}`;
}

function updateTranslation(translation, patch, lang) {
  const next = { ...translation };
  const title = patch[`title_${lang}`];
  const description = patch[`description_${lang}`];
  const history = patch[`history_${lang}`];
  if (typeof title === "string" && title.trim()) next.title = title.trim();
  if (typeof description === "string" && description.trim()) next.description = description.trim();
  if (typeof history === "string" && history.trim()) next.history = history.trim();
  return next;
}

function applyPatch(item, patch) {
  const translations = ["en", "vi"].map((lang) => {
    const current = item.translations?.find((translation) => translation.lang === lang) || { lang, title: "" };
    return updateTranslation(current, patch, lang);
  });
  const richFields = item.rich_fields && typeof item.rich_fields === "object" ? { ...item.rich_fields } : {};
  if (Array.isArray(patch.ingredients) && patch.ingredients.length > 0) {
    richFields.ingredients = patch.ingredients.map((name) => ({
      name: String(name).trim(),
      quantity: "varies by regional recipe",
    })).filter((ingredient) => ingredient.name);
  }
  if (Array.isArray(patch.sources) && patch.sources.length > 0) richFields.sources = patch.sources;
  return {
    ...item,
    translations,
    ...(Object.keys(richFields).length > 0 ? { rich_fields: richFields } : {}),
    ...(typeof patch.youtube_url === "string" && patch.youtube_url.trim() ? { youtube_url: patch.youtube_url.trim() } : {}),
  };
}

function validatePatch(patch, sourceFile) {
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) throw new Error(`${sourceFile}: patch must be an object`);
  if (typeof patch.item_key !== "string" || !patch.item_key.trim()) throw new Error(`${sourceFile}: item_key is required`);
  for (const field of ["description_en", "history_en", "description_vi", "history_vi"]) {
    if (typeof patch[field] !== "string" || !patch[field].trim()) throw new Error(`${sourceFile}:${patch.item_key}: ${field} is required`);
    if (patch[field].trim().split(/\s+/u).length > 150) throw new Error(`${sourceFile}:${patch.item_key}: ${field} exceeds 150 words`);
  }
  if (!Array.isArray(patch.sources) || patch.sources.length === 0 || patch.sources.some((source) => !/^https:\/\//u.test(String(source?.url || "")))) {
    throw new Error(`${sourceFile}:${patch.item_key}: at least one HTTPS source is required`);
  }
}

export async function applyContentReviewBatches({
  dataDir = resolve(frontendDir, "data"),
  batchDir = resolve(dataDir, "content-review-batches"),
  write = false,
} = {}) {
  const files = await Promise.all(catalogFiles.map(async (filename) => ({
    filename,
    path: resolve(dataDir, filename),
    items: JSON.parse(await readFile(resolve(dataDir, filename), "utf8")),
  })));
  const itemsByKey = new Map();
  for (const file of files) for (const item of file.items) {
    const key = itemKey(item);
    if (itemsByKey.has(key)) throw new Error(`Duplicate catalog item key: ${key}`);
    itemsByKey.set(key, { file, item });
  }

  const batchFiles = (await readdir(batchDir)).filter((filename) => filename.endsWith(".json")).sort();
  const seen = new Set();
  let updated = 0;
  for (const filename of batchFiles) {
    const patches = JSON.parse(await readFile(resolve(batchDir, filename), "utf8"));
    if (!Array.isArray(patches)) throw new Error(`${filename}: expected an array`);
    for (const patch of patches) {
      validatePatch(patch, filename);
      if (seen.has(patch.item_key)) throw new Error(`Duplicate review patch: ${patch.item_key}`);
      seen.add(patch.item_key);
      const target = itemsByKey.get(patch.item_key);
      if (!target) throw new Error(`${filename}: unknown catalog item key ${patch.item_key}`);
      const index = target.file.items.indexOf(target.item);
      target.file.items[index] = applyPatch(target.item, patch);
      target.item = target.file.items[index];
      updated += 1;
    }
  }
  if (write) {
    for (const file of files) await writeFile(file.path, `${JSON.stringify(file.items, null, 2)}\n`);
  }
  return { batch_files: batchFiles.length, patches: seen.size, updated, write };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await applyContentReviewBatches({ write: process.argv.includes("--write") });
  console.log(`${result.write ? "Applied" : "Validated"} ${result.patches} content review patches from ${result.batch_files} batch files.`);
}
