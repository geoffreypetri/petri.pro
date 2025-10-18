// deno-lint-ignore-file no-explicit-any
/**
 * Generate `build/tech-radar.zalando.json` compatible with Zalando's radar.js:
 * - entries[].quadrant: number (0..3)
 * - entries[].ring: number (0..3)
 * - entries[].label: string
 * - entries[].active: boolean
 * - entries[].moved: number (default: 0)
 * - entries[].link: string (optional; link to the fiche Markdown)
 *
 * INPUT:  docs/radar/**.md  (each with frontmatter, ex:)
 * ---
 * label: TypeScript
 * quadrant: Languages & Frameworks
 * ring: Adopt
 * status: active
 * ---
 *
 * USAGE:
 *   deno run -A scripts/generate-radar.ts
 *
 * OUTPUT:
 *   build/tech-radar.zalando.json  (numeric indices for quadrant/ring)
 *   build/tech-radar.json          (string-friendly mirror, optional)
 */

const DOCS_DIR = new URL("../docs/radar/", import.meta.url);
const OUT_NUMERIC = new URL("../build/tech-radar.zalando.json", import.meta.url);
const OUT_STRINGS = new URL("../build/tech-radar.json", import.meta.url); // optionnel, utile pour debug

// #### IMPORTANT ####
// Ordre imposé pour correspondre au radar Zalando (0..3).
// Adapte ces constantes à tes besoins, MAIS conserve l'ordre.
const QUADRANTS = [
  "Languages & Frameworks",
  "Platforms",
  "Tools",
  "Techniques",
] as const;

const RINGS = ["Adopt", "Trial", "Assess", "Hold"] as const;

// ────────────────────────────────────────────────────────────────────────────────

type QuadrantName = (typeof QUADRANTS)[number];
type RingName = (typeof RINGS)[number];

interface Frontmatter {
  label?: string;
  quadrant?: string;
  ring?: string;
  status?: string;
  owner?: string;
  last_review?: string;
  next_review?: string;
  tags?: string[] | string;
}

interface EntryNumeric {
  label: string;
  quadrant: number; // 0..3
  ring: number;     // 0..3
  active: boolean;
  moved: number;    // -1,0,1 ...
  link?: string;
}

interface EntryStrings {
  label: string;
  quadrant: QuadrantName;
  ring: RingName;
  status?: string;
  owner?: string;
  last_review?: string;
  next_review?: string;
  tags?: string[];
  note?: string;
  active: boolean;
  moved: number;
  link?: string;
}

function mapIndex<T extends readonly string[]>(arr: T) {
  const m = new Map<string, number>();
  arr.forEach((v, i) => m.set(v, i));
  return (val: string | number | undefined, kind: "quadrant" | "ring", label: string): number => {
    if (typeof val === "number") return val;
    if (typeof val === "string") {
      const idx = m.get(val);
      if (idx != null) return idx;
      const options = [...m.keys()].join(" | ");
      throw new Error(
        `Blip "${label}": valeur ${kind}="${val}" inconnue. Attendu: ${options}`
      );
    }
    throw new Error(`Blip "${label}": ${kind} manquant`);
  };
}

const quadrantIndex = mapIndex(QUADRANTS);
const ringIndex = mapIndex(RINGS);

function parseFrontmatter(md: string): Frontmatter {
  const m = md.match(/^---\n([\s\S]*?)\n---\n/);
  if (!m) return {};
  const yaml = m[1];
  const out: any = {};
  for (const line of yaml.split(/\n/)) {
    const mm = line.match(/^([A-Za-z_][A-Za-z0-9_-]*):\s*(.*)$/);
    if (!mm) continue;
    const key = mm[1].trim();
    let val = mm[2].trim();
    if (val.startsWith("[")) {
      const arr = val
        .replace(/^[\[]|[\]]$/g, "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      out[key] = arr;
    } else if (/^(true|false)$/i.test(val)) {
      out[key] = /^true$/i.test(val);
    } else if (/^-?\d+(?:\.\d+)?$/.test(val)) {
      out[key] = Number(val);
    } else {
      out[key] = val;
    }
  }
  return out;
}

function stripFrontmatter(md: string): string {
  return md.replace(/^---[\s\S]*?---\n/, "");
}

function firstParagraph(md: string): string | undefined {
  const content = stripFrontmatter(md).trim();
  // retire un éventuel # Titre
  const withoutH1 = content.replace(/^#[^\n]*\n+/, "");
  return withoutH1.split(/\n\n+/)[0]?.trim();
}

function relLinkFromUrl(file: URL): string {
  // Construit un lien relatif vers la fiche Markdown pour affichage dans l’UI
  // Exemple: docs/radar/languages-frameworks/typescript
  const path = file.pathname.split("/docs/")[1];
  if (!path) return file.pathname;

  // Supprime l'extension .md à la fin du chemin
  const clean = path.replace(/\.md$/i, "");

  return `./docs/${clean}`;
}

async function* walk(dir: URL): AsyncGenerator<URL> {
  for await (const entry of Deno.readDir(dir)) {
    const url = new URL(entry.name + (entry.isDirectory ? "/" : ""), dir);
    if (entry.isDirectory) {
      yield* walk(url);
    } else if (entry.isFile && entry.name.endsWith(".md")) {
      yield url;
    }
  }
}

const stringEntries: EntryStrings[] = [];

for await (const file of walk(DOCS_DIR)) {
  const text = await Deno.readTextFile(file);
  const fm = parseFrontmatter(text);

  const label = fm.label ?? file.pathname.split("/").pop()?.replace(/\.md$/, "") ?? "Unknown";
  const qName = fm.quadrant as QuadrantName;
  const rName = fm.ring as RingName;

  if (!qName || !QUADRANTS.includes(qName)) {
    const opts = QUADRANTS.join(" | ");
    throw new Error(`Blip "${label}": quadrant manquant ou invalide. Attendu: ${opts}`);
  }
  if (!rName || !RINGS.includes(rName)) {
    const opts = RINGS.join(" | ");
    throw new Error(`Blip "${label}": ring manquant ou invalide. Attendu: ${opts}`);
  }

  const active = (fm.status ?? "active").toLowerCase() !== "deprecated";
  const note = firstParagraph(text);
  const link = relLinkFromUrl(file);

  stringEntries.push({
    label,
    quadrant: qName,
    ring: rName,
    status: fm.status,
    owner: fm.owner,
    last_review: fm.last_review,
    next_review: fm.next_review,
    tags: Array.isArray(fm.tags) ? fm.tags as string[] : (typeof fm.tags === "string" ? [fm.tags] : undefined),
    note,
    active,
    moved: 0,
    link,
  });
}

// tri stable: quadrant puis ring puis label
stringEntries.sort((a, b) => {
  const q = QUADRANTS.indexOf(a.quadrant) - QUADRANTS.indexOf(b.quadrant);
  if (q !== 0) return q;
  const r = RINGS.indexOf(a.ring) - RINGS.indexOf(b.ring);
  if (r !== 0) return r;
  return a.label.localeCompare(b.label);
});

// Miroir “strings” (utile pour ton propre viewer, debug, etc.)
await Deno.mkdir(new URL("../build/", import.meta.url), { recursive: true });
await Deno.writeTextFile(
  OUT_STRINGS,
  JSON.stringify(
    {
      quadrants: QUADRANTS,
      rings: RINGS,
      entries: stringEntries,
    },
    null,
    2,
  ),
);

// Conversion en indices numériques (format attendu par radar.js)
const numericEntries: EntryNumeric[] = stringEntries.map((e) => ({
  label: e.label,
  quadrant: quadrantIndex(e.quadrant, "quadrant", e.label),
  ring: ringIndex(e.ring, "ring", e.label),
  active: e.active,
  moved: e.moved ?? 0,
  link: e.link,
}));

await Deno.writeTextFile(
  OUT_NUMERIC,
  JSON.stringify(
    {
      entries: numericEntries,
      // Le visualiseur zalando prend `rings` et `quadrants` via la CONFIG JS,
      // pas besoin de les resservir ici. On garde les données minimales.
    },
    null,
    2,
  ),
);

console.log(
  `✔ Wrote ${OUT_NUMERIC.pathname} (${numericEntries.length} entries) and ${OUT_STRINGS.pathname}`,
);