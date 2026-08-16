import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const backgroundDirectory = fileURLToPath(
  new URL("../src/landing/background/", import.meta.url),
);
const text = readFileSync(`${backgroundDirectory}/text.md`, "utf8");
const academicBasis = readFileSync(
  `${backgroundDirectory}/academic_basis.md`,
  "utf8",
);
const idPattern = String.raw`\d+(?:-(?:\d+|보완))+`;
const references = [
  ...new Set(
    [...text.matchAll(new RegExp(`\\b${idPattern}`, "g"))].map(
      (match) => match[0],
    ),
  ),
];
const rows = [
  ...academicBasis.matchAll(new RegExp(`^\\| (${idPattern}) \\|`, "gm")),
].map((match) => match[1]);
const rowIds = new Set(rows);
const missing = references.filter((id) => !rowIds.has(id));
const duplicates = [...rowIds].filter(
  (id) => rows.filter((rowId) => rowId === id).length > 1,
);

if (missing.length > 0 || duplicates.length > 0) {
  const messages = [];

  if (missing.length > 0) {
    messages.push(`근거가 없는 본문 ID: ${missing.join(", ")}`);
  }

  if (duplicates.length > 0) {
    messages.push(`중복된 근거 ID: ${duplicates.join(", ")}`);
  }

  throw new Error(messages.join("\n"));
}

console.log(
  `Background references validated: ${references.length} references, ${rows.length} basis rows.`,
);
