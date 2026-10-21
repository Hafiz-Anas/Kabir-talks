import "server-only";

import { readFile } from "node:fs/promises";
import { join } from "node:path";

import * as hb from "harfbuzzjs";

/**
 * Urdu text for generated share images.
 *
 * next/og (Satori) can't lay out Noto Nastaliq Urdu: its OpenType engine
 * throws on the font's contextual lookups ("lookupType: 5 … not supported").
 * So Urdu is shaped here with HarfBuzz — the shaping engine browsers use —
 * and drawn as SVG paths, which the image is then given as a picture.
 *
 *  - Right-to-left paragraph with a small bidi pass: runs of Latin letters
 *    and digits (e.g. "PSL 2026", "6.1", "۲۰۲۶") stay left-to-right inside it.
 *  - Nastaliq has no Latin glyphs, so Latin runs use Inter.
 *  - Greedy word wrap to a maximum width and line count, with an ellipsis.
 */

type LoadedFont = { font: hb.Font; upem: number };

const FONT_DIR = join(process.cwd(), "assets", "fonts");
let loaded: Promise<{ urdu: LoadedFont; latin: LoadedFont }> | null = null;

function loadFont(file: string): Promise<LoadedFont> {
  return readFile(join(FONT_DIR, file)).then((data) => {
    const face = new hb.Face(new hb.Blob(new Uint8Array(data)));
    return { font: new hb.Font(face), upem: face.upem };
  });
}

function fonts() {
  loaded ??= Promise.all([loadFont("NotoNastaliqUrdu-Bold.ttf"), loadFont("Inter-Medium.ttf")]).then(
    ([urdu, latin]) => ({ urdu, latin }),
  );
  return loaded;
}

type Glyph = { id: number; advance: number; dx: number; dy: number };
type ShapedRun = { font: LoadedFont; glyphs: Glyph[]; width: number };

function shape(text: string, font: LoadedFont, direction: "ltr" | "rtl"): ShapedRun {
  const buffer = new hb.Buffer();
  buffer.addText(text);
  buffer.guessSegmentProperties();
  buffer.setDirection(direction === "rtl" ? hb.Direction.RTL : hb.Direction.LTR);
  hb.shape(font.font, buffer);
  const positions = buffer.getGlyphPositions();
  const glyphs = buffer.getGlyphInfos().map((info, index) => ({
    id: info.codepoint,
    advance: positions[index].xAdvance,
    dx: positions[index].xOffset,
    dy: positions[index].yOffset,
  }));
  return { font, glyphs, width: glyphs.reduce((sum, glyph) => sum + glyph.advance, 0) };
}

const LTR_CHAR = "A-Za-z0-9\\u0660-\\u0669\\u06F0-\\u06F9";
// A left-to-right run: starts and ends with a letter/digit; may contain the punctuation numbers and names use.
const LTR_RUN = new RegExp(`[${LTR_CHAR}](?:[${LTR_CHAR} .,:%'’&+/-]*[${LTR_CHAR}%])?`, "g");

/** Splits one line into runs in logical order. */
function bidiRuns(text: string): { text: string; rtl: boolean }[] {
  const runs: { text: string; rtl: boolean }[] = [];
  let last = 0;
  for (const match of text.matchAll(LTR_RUN)) {
    if (match.index > last) runs.push({ text: text.slice(last, match.index), rtl: true });
    runs.push({ text: match[0], rtl: false });
    last = match.index + match[0].length;
  }
  if (last < text.length) runs.push({ text: text.slice(last), rtl: true });
  return runs;
}

async function shapeLine(text: string): Promise<ShapedRun[]> {
  const { urdu, latin } = await fonts();
  return bidiRuns(text).map((run) => {
    if (run.rtl) return shape(run.text, urdu, "rtl");
    // Urdu digits exist in Nastaliq; Latin letters and Western digits don't.
    const inUrdu = shape(run.text, urdu, "ltr");
    return inUrdu.glyphs.some((glyph) => glyph.id === 0) ? shape(run.text, latin, "ltr") : inUrdu;
  });
}

const scaled = (run: ShapedRun, size: number) => (run.width * size) / run.font.upem;
const lineWidth = (runs: ShapedRun[], size: number) => runs.reduce((sum, run) => sum + scaled(run, size), 0);

/**
 * Wraps and shapes `text` into at most `maxLines` lines of `maxWidth` px,
 * right-aligned. Returns an SVG document plus its size, for an <img>.
 */
export async function urduTextSvg(
  text: string,
  { size, maxWidth, maxLines, color, lineHeight = 2 }: { size: number; maxWidth: number; maxLines: number; color: string; lineHeight?: number },
) {
  const fits = async (value: string) => lineWidth(await shapeLine(value), size) <= maxWidth;

  // Greedy wrap by words.
  const wrapped: string[][] = [];
  let current: string[] = [];
  for (const word of text.replace(/\s+/g, " ").trim().split(" ")) {
    if (current.length && !(await fits([...current, word].join(" ")))) {
      wrapped.push(current);
      current = [word];
    } else {
      current.push(word);
    }
  }
  if (current.length) wrapped.push(current);

  // Too many lines: keep maxLines and end the last with an ellipsis that fits.
  const texts = wrapped.slice(0, maxLines).map((line) => line.join(" "));
  if (wrapped.length > maxLines) {
    const last = [...wrapped[maxLines - 1]];
    while (last.length > 1 && !(await fits(`${last.join(" ")} …`))) last.pop();
    texts[maxLines - 1] = `${last.join(" ")} …`;
  }
  const lines = await Promise.all(texts.map(shapeLine));

  // Lay out at baseline y = lineIndex * step, tracking the real ink box:
  // Nastaliq glyphs reach well beyond the font's nominal ascent/descent.
  const step = size * lineHeight;
  const width = Math.ceil(Math.min(maxWidth, Math.max(...lines.map((line) => lineWidth(line, size)))));
  let minY = Infinity;
  let maxY = -Infinity;
  const placed: { d: string; x: number; y: number; scale: number }[] = [];

  lines.forEach((runs, lineIndex) => {
    const baseline = lineIndex * step;
    // Right-aligned: the first logical run starts at the right edge.
    let right = width;
    for (const run of runs) {
      const scale = size / run.font.upem;
      let x = right - scaled(run, size);
      right = x;
      for (const glyph of run.glyphs) {
        const d = run.font.font.glyphToPath(glyph.id);
        const extents = run.font.font.glyphExtents(glyph.id);
        if (d && extents) {
          const y = baseline - glyph.dy * scale;
          // Extents are y-up font units; SVG is y-down.
          minY = Math.min(minY, y - extents.yBearing * scale);
          maxY = Math.max(maxY, y - (extents.yBearing + extents.height) * scale);
          placed.push({ d, x: x + glyph.dx * scale, y, scale });
        }
        x += glyph.advance * scale;
      }
    }
  });

  if (!placed.length) {
    minY = 0;
    maxY = size;
  }
  const pad = Math.round(size * 0.1);
  const height = Math.ceil(maxY - minY) + pad * 2;
  const shift = pad - minY;
  const paths = placed.map(
    ({ d, x, y, scale }) =>
      `<path transform="translate(${x.toFixed(2)} ${(y + shift).toFixed(2)}) scale(${scale.toFixed(5)} ${(-scale).toFixed(5)})" d="${d}"/>`,
  );

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><g fill="${color}">${paths.join("")}</g></svg>`;
  return { src: `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`, width, height };
}
