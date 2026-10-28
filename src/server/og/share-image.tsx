import "server-only";

import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ImageResponse } from "next/og";

import { getDictionary, type Locale } from "@/i18n";
import { safeImageSrc } from "@/lib/content/urls";
import { env } from "@/lib/env";
import { OG_IMAGE_SIZE } from "@/lib/seo";
import { imagePrefix } from "@/server/storage";

import { urduTextSvg } from "./shape-text";

/**
 * 1200×630 share images (Open Graph / X cards):
 *  - article with a JPEG/PNG cover → the cover, cropped, with a small brand mark
 *  - otherwise → black card, gold "KT" mark, Kabir Talks wordmark and the title
 * Urdu text is pre-shaped with HarfBuzz (see shape-text.ts).
 */

const GOLD = "#c9a54c";
const IVORY = "#f5f2ea";
const GREY = "#a19d93";
const FONT_DIR = join(process.cwd(), "assets", "fonts");

let fontData: Promise<{ playfair: Buffer; inter: Buffer }> | null = null;
function satoriFonts() {
  fontData ??= Promise.all([
    readFile(join(FONT_DIR, "PlayfairDisplay-Bold.ttf")),
    readFile(join(FONT_DIR, "Inter-Medium.ttf")),
  ]).then(([playfair, inter]) => ({ playfair, inter }));
  return fontData;
}

const siteHost = () => new URL(env.NEXT_PUBLIC_SITE_URL).host;

function Mark({ size = 64 }: { size?: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: size * 0.3 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: size,
          height: size,
          border: `2px solid ${GOLD}`,
          color: GOLD,
          fontFamily: "Playfair",
          fontSize: size * 0.4,
          letterSpacing: 2,
        }}
      >
        KT
      </div>
      <div style={{ display: "flex", color: IVORY, fontFamily: "Playfair", fontSize: size * 0.56 }}>Kabir Talks</div>
    </div>
  );
}

/**
 * Text in the card's language: Playfair for English, shaped Nastaliq (as an
 * image) for Urdu. Plain async helpers, not components: Satori renders
 * synchronously, so these are awaited before the element tree is built.
 */
async function title(text: string, locale: Locale, maxLines: number, size: number) {
  if (locale === "ur") {
    const svg = await urduTextSvg(text, { size, maxWidth: 1040, maxLines, color: IVORY });
    // eslint-disable-next-line @next/next/no-img-element -- Satori markup, not a page
    return <img src={svg.src} width={svg.width} height={svg.height} alt="" />;
  }
  const clipped = text.length > 120 ? `${text.slice(0, 117).trimEnd()}…` : text;
  return (
    <div
      style={{
        display: "flex",
        color: IVORY,
        fontFamily: "Playfair",
        fontSize: clipped.length > 80 ? size * 0.82 : size,
        lineHeight: 1.18,
        maxWidth: 1040,
      }}
    >
      {clipped}
    </div>
  );
}

async function label(text: string, locale: Locale, color = GOLD) {
  if (locale === "ur") {
    const svg = await urduTextSvg(text, { size: 30, maxWidth: 900, maxLines: 1, color, lineHeight: 1.7 });
    // eslint-disable-next-line @next/next/no-img-element -- Satori markup, not a page
    return <img src={svg.src} width={svg.width} height={svg.height} alt="" />;
  }
  return (
    <div style={{ display: "flex", color, fontFamily: "Inter", fontSize: 24, letterSpacing: 4, textTransform: "uppercase" }}>
      {text}
    </div>
  );
}

async function respond(element: React.ReactElement) {
  const { playfair, inter } = await satoriFonts();
  return new ImageResponse(element, {
    ...OG_IMAGE_SIZE,
    fonts: [
      { name: "Playfair", data: playfair, weight: 700, style: "normal" },
      { name: "Inter", data: inter, weight: 500, style: "normal" },
    ],
  });
}

function Frame({ children, rtl }: { children: React.ReactNode; rtl: boolean }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "56px 80px",
        backgroundColor: "#0a0a0a",
        backgroundImage: "radial-gradient(ellipse at 20% 0%, rgba(201,165,76,0.22), rgba(10,10,10,0) 60%)",
        alignItems: rtl ? "flex-end" : "flex-start",
      }}
    >
      {children}
    </div>
  );
}

function Footer({ rtl }: { rtl: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%", alignItems: rtl ? "flex-end" : "flex-start" }}>
      <div style={{ display: "flex", width: 160, height: 3, backgroundColor: GOLD, marginBottom: 18 }} />
      <div style={{ display: "flex", color: GREY, fontFamily: "Inter", fontSize: 24 }}>{siteHost()}</div>
    </div>
  );
}

const COVER_MAX_BYTES = 8 * 1024 * 1024;

/**
 * Fetches the cover (only from our own bucket, at a path our uploads create)
 * and returns it as a data URI. JPEG/PNG only — the image generator can't
 * decode WebP/AVIF. Any problem (timeout, wrong type, too big) returns null and
 * the branded title card is used instead, so a share image never fails.
 */
async function loadCover(url: string | null): Promise<string | null> {
  const src = safeImageSrc(url, imagePrefix());
  if (!src || !/\.(jpe?g|png)$/i.test(src)) return null;
  try {
    const response = await fetch(src, { signal: AbortSignal.timeout(5000) });
    const type = response.headers.get("content-type")?.split(";")[0];
    if (!response.ok || (type !== "image/jpeg" && type !== "image/png")) return null;
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > COVER_MAX_BYTES) return null;
    return `data:${type};base64,${bytes.toString("base64")}`;
  } catch {
    return null;
  }
}

export async function articleShareImageResponse(article: {
  locale: Locale;
  title: string;
  category: string;
  coverImageUrl: string | null;
}) {
  const rtl = article.locale === "ur";
  const cover = await loadCover(article.coverImageUrl);

  if (cover) {
    return respond(
      <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", backgroundColor: "#0a0a0a" }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- Satori markup, not a page */}
        <img src={cover} width={1200} height={630} alt="" style={{ objectFit: "cover", width: 1200, height: 630 }} />
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: 180,
            display: "flex",
            alignItems: "flex-end",
            padding: "0 56px 40px",
            backgroundImage: "linear-gradient(to top, rgba(10,10,10,0.92), rgba(10,10,10,0))",
          }}
        >
          <Mark size={56} />
        </div>
      </div>,
    );
  }

  return respond(
    <Frame rtl={rtl}>
      <div style={{ display: "flex", width: "100%", justifyContent: "space-between", flexDirection: rtl ? "row-reverse" : "row" }}>
        <Mark />
        {await label(article.category, article.locale)}
      </div>
      {await title(article.title, article.locale, rtl ? 3 : 4, rtl ? 54 : 68)}
      <Footer rtl={rtl} />
    </Frame>,
  );
}

export async function siteShareImageResponse(locale: Locale) {
  const dict = getDictionary(locale);
  const rtl = locale === "ur";
  return respond(
    <Frame rtl={rtl}>
      <Mark />
      <div style={{ display: "flex", flexDirection: "column", gap: 24, alignItems: rtl ? "flex-end" : "flex-start" }}>
        {await title(dict.home.title, locale, 1, rtl ? 64 : 84)}
        {await label(dict.site.tagline, locale, GREY)}
      </div>
      <Footer rtl={rtl} />
    </Frame>,
  );
}

/** 512×512 square logo (the gold KT mark on black): the publisher logo in structured data. */
export async function logoImageResponse() {
  const { playfair } = await satoriFonts();
  return new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%", alignItems: "center", justifyContent: "center", background: "#0a0a0a" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 360,
            height: 360,
            border: `10px solid ${GOLD}`,
            color: GOLD,
            fontFamily: "Playfair",
            fontSize: 150,
            letterSpacing: 6,
          }}
        >
          KT
        </div>
      </div>
    ),
    { width: 512, height: 512, fonts: [{ name: "Playfair", data: playfair, weight: 700, style: "normal" }] },
  );
}
