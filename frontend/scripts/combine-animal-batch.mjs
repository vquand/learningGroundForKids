import { readFile, writeFile } from "node:fs/promises";

const input = process.env.ANIMAL_BASE || process.argv[2];
const topup = process.env.ANIMAL_TOPUP || process.argv[3];
const output = process.env.ANIMAL_OUTPUT || process.argv[4];
if (!input || !topup || !output) throw new Error("Usage: ANIMAL_BASE=... ANIMAL_TOPUP=... ANIMAL_OUTPUT=... node combine-animal-batch.mjs");

const read = async (path) => JSON.parse(await readFile(path, "utf8"));
const itemKey = (item) => `${item.category}|${item.latitude}|${item.longitude}|${item.translations?.find((translation) => translation.lang === "en")?.title ?? ""}`;
const rows = [...await read(input), ...await read(topup)];
const provenanceRows = [...await read(input.replace(/\.json$/i, "-provenance.json")), ...await read(topup.replace(/\.json$/i, "-provenance.json"))];
const keys = new Set();
for (const row of rows) {
  const key = itemKey(row);
  if (keys.has(key)) throw new Error(`duplicate animal key: ${key}`);
  keys.add(key);
}
const provenance = new Map(provenanceRows.map((entry) => [entry.item_key, entry]));
if (rows.some((row) => !provenance.has(itemKey(row)))) throw new Error("animal batch is missing provenance");
rows.sort((a, b) => itemKey(a).localeCompare(itemKey(b)));
provenanceRows.sort((a, b) => a.item_key.localeCompare(b.item_key));
await writeFile(output, `${JSON.stringify(rows, null, 2)}\n`);
await writeFile(output.replace(/\.json$/i, "-provenance.json"), `${JSON.stringify(provenanceRows, null, 2)}\n`);
console.log(`Combined ${rows.length} animal records to ${output}`);
