import { slugify } from "@/lib/articles/slug";

import { AiError, isAiErrorCode } from "./errors";
import type { AiProvider, AiRequest } from "./types";

/**
 * Deterministic fake provider for development and tests (AI_PROVIDER=mock).
 * Never active in production builds (see ./config.ts); it also refuses to
 * run if NODE_ENV is "production".
 *
 * It reads `request.mockInput` (not the prompt) to build plausible output:
 * Markdown drafts, a fake word-for-word EN⇄UR "translation" that keeps
 * Markdown syntax, links and [[KT_BLOCK_n]] placeholders intact, edits, and
 * JSON for suggestions.
 *
 * Test markers anywhere in the input strings:
 *   [[mock:error=CODE]]      fail immediately with that AiError code
 *   [[mock:error-mid=CODE]]  stream part of the output, then fail
 *   [[mock:slow]]            slow output (to test Stop)
 *   [[mock:hindi]] / [[mock:roman]]   wrong script for Urdu output
 *   [[mock:evil]]            append unsafe Markdown/HTML (must be stripped)
 *   [[mock:badjson]]         invalid JSON for structured calls
 *   [[mock:drop-placeholders]]  translation loses the embed placeholders
 */

type Locale = "en" | "ur";

const UR_WORDS = ["خبر", "شہر", "آج", "حکومت", "ٹیم", "میچ", "عوام", "رپورٹ", "اہم", "فیصلہ", "ملک", "وقت", "نئی", "بات", "لوگ", "کام", "سال", "دن", "بارش", "کھیل"];
const EN_WORDS = ["news", "city", "today", "government", "team", "match", "people", "report", "important", "decision", "country", "time", "new", "matter", "work", "year", "day", "rain", "game", "story"];

function hash(text: string) {
  let h = 0;
  for (const char of text) h = (h * 31 + char.codePointAt(0)!) >>> 0;
  return h;
}

/** Protected tokens (placeholders, link targets, URLs, escapes) are kept; words are swapped. */
const TOKENS = /(\[\[KT_BLOCK_\d+\]\])|(\]\([^)]*\))|(https?:\/\/\S+)|(\\.)|([A-Za-z][A-Za-z'’]*|[؀-ۿ]+)/g;

function mapWords(text: string, fn: (word: string, index: number) => string) {
  let index = 0;
  return text.replace(TOKENS, (match, placeholder, linkTarget, url, escape, word) =>
    word ? fn(word, index++) : match,
  );
}

const LINE_PREFIX = /^(\s*(?:#{1,6}\s+|>\s?|[-*+]\s+|\d+[.)]\s+)*)(.*)$/;

function mapLines(markdown: string, fn: (text: string, lineIndex: number) => string) {
  return markdown
    .split("\n")
    .map((line, i) => {
      const [, prefix, rest] = line.match(LINE_PREFIX)!;
      return prefix + fn(rest, i);
    })
    .join("\n");
}

export function mockTranslate(markdown: string, to: Locale): string {
  return mapLines(markdown, (text) =>
    mapWords(text, (word) => {
      const latin = /^[A-Za-z]/.test(word);
      if (to === "ur" && latin) return UR_WORDS[hash(word.toLowerCase()) % UR_WORDS.length];
      if (to === "en" && !latin) return EN_WORDS[hash(word) % EN_WORDS.length];
      return word;
    }),
  ).replace(/\.(\s|$)/g, to === "ur" ? "۔$1" : ".$1");
}

const EDIT_PREFIX: Record<string, Record<Locale, string>> = {
  improve: { en: "Notably, ", ur: "قابلِ ذکر ہے کہ " },
  formal: { en: "It should be noted that ", ur: "واضح رہے کہ " },
  simpler: { en: "Simply put, ", ur: "آسان الفاظ میں، " },
};
const LONGER: Record<Locale, string> = {
  en: " Officials said further details would follow in the coming days.",
  ur: " حکام کے مطابق مزید تفصیلات آئندہ دنوں میں سامنے آئیں گی۔",
};

export function mockEdit(markdown: string, action: string, locale: Locale): string {
  switch (action) {
    case "shorter":
      return mapLines(markdown, (text) => mapWords(text, (word, i) => (i % 3 === 2 ? "" : word)).replace(/ {2,}/g, " "));
    case "longer": {
      const lines = markdown.split("\n");
      const last = lines.findLastIndex((line) => line.trim());
      lines[last] += LONGER[locale];
      return lines.join("\n");
    }
    case "grammar":
      return mapLines(markdown, (text) => {
        const fixed = text.replace(/ {2,}/g, " ").replace(/^([a-z])/, (c) => c.toUpperCase());
        return fixed && !/[.!?۔؟:]$/.test(fixed) ? fixed + (locale === "ur" ? "۔" : ".") : fixed;
      });
    default: {
      const prefix = EDIT_PREFIX[action]?.[locale] ?? "";
      let done = false;
      return mapLines(markdown, (text) => {
        if (done || !text.trim()) return text;
        done = true;
        return prefix + (locale === "en" ? text.replace(/^([A-Z])/, (c) => c.toLowerCase()) : text);
      });
    }
  }
}

const LENGTH_PARAGRAPHS = { short: 2, medium: 4, long: 6 } as const;

function mockDraft(input: { prompt: string; notes?: string; locale: Locale; length: keyof typeof LENGTH_PARAGRAPHS }) {
  const n = LENGTH_PARAGRAPHS[input.length] ?? 2;
  const notes = input.notes?.trim();
  if (input.locale === "ur") {
    const body = Array.from({ length: n }, (_, i) =>
      `یہ مضمون کا پیراگراف نمبر ${i + 1} ہے۔ حکومت اور عوام دونوں اس اہم فیصلے پر **گہری نظر** رکھے ہوئے ہیں، اور ماہرین کے مطابق آنے والے دنوں میں *صورتحال* مزید واضح ہوگی۔`,
    );
    return [
      body[0],
      "## اہم نکات",
      "- پہلا اہم نکتہ\n- دوسرا اہم نکتہ\n- تیسرا اہم نکتہ",
      ...(notes ? [`فراہم کردہ حقائق کے مطابق: ${notes}`] : []),
      "> ہم صورتحال کا بغور جائزہ لے رہے ہیں۔",
      ...body.slice(1),
      "مزید معلومات کے لیے [سرکاری ویب سائٹ](https://example.com/source) دیکھیں۔",
    ].join("\n\n");
  }
  const topic = input.prompt.replace(/\[\[mock:[^\]]*\]\]/g, "").trim() || "the story";
  const body = Array.from({ length: n }, (_, i) =>
    `This is paragraph ${i + 1} of a mock article about ${topic}. Observers are watching the **key developments** closely, and analysts expect the *situation* to become clearer in the coming days.`,
  );
  return [
    body[0],
    "## Key points",
    "- The first key point\n- The second key point\n- The third key point",
    ...(notes ? [`According to the provided facts: ${notes}`] : []),
    "> We are reviewing the situation carefully.",
    ...body.slice(1),
    "For more information, see the [official source](https://example.com/source).",
  ].join("\n\n");
}

const EVIL = [
  "<script>alert('xss')</script>",
  "[click me](javascript:alert(1)) and <a href=\"javascript:alert(2)\">html link</a>",
  "![tracker](https://evil.com/pixel.png)",
  '<iframe src="https://evil.com/embed"></iframe>',
  "<img src=x onerror=alert(3)>",
  "```html\n<b>code block</b>\n```",
].join("\n\n");

const WRONG_SCRIPT = {
  hindi: "यह एक परीक्षण लेख है। सरकार ने आज नई नीति की घोषणा की और लोग इस फैसले पर नज़र रखे हुए हैं।",
  roman: "Yeh aik test khabar hai. Hukoomat ne aaj naya faisla kiya aur log is par nazar rakhe hue hain.",
};

const firstSentence = (text: string, max: number) => {
  const sentence = text.replace(/\s+/g, " ").trim().split(/(?<=[.!?۔؟])\s/)[0] ?? "";
  return sentence.length > max ? `${sentence.slice(0, max - 1).trimEnd()}…` : sentence;
};

type Any = Record<string, unknown>;
const str = (value: unknown) => (typeof value === "string" ? value : "");

function strings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value && typeof value === "object") return Object.values(value).flatMap(strings);
  return [];
}

function respond(request: AiRequest): string {
  const input = (request.mockInput ?? {}) as Any;
  const locale = (input.locale ?? input.to ?? "en") as Locale;
  const markers = strings(input).join(" ");
  const wrong = markers.includes("[[mock:hindi]]") ? "hindi" : markers.includes("[[mock:roman]]") ? "roman" : null;
  if (request.jsonSchema && markers.includes("[[mock:badjson]]")) return "{ not json";

  switch (request.kind) {
    case "ping":
      return "OK";
    case "draft-body": {
      if (wrong && locale === "ur") return WRONG_SCRIPT[wrong];
      const draft = mockDraft(input as Parameters<typeof mockDraft>[0]);
      return markers.includes("[[mock:evil]]") ? `${draft}\n\n${EVIL}` : draft;
    }
    case "draft-meta": {
      const markdown = str(input.markdown);
      const heading = locale === "ur" ? "اہم پیش رفت پر ایک نظر" : `Mock report: ${str(input.prompt).replace(/\[\[mock:[^\]]*\]\]/g, "").trim().slice(0, 80)}`;
      return JSON.stringify({
        title: heading,
        excerpt: firstSentence(markdown.replace(/[#>*_[\]-]/g, ""), 155),
        tags: ["Pakistan", "Analysis"],
      });
    }
    case "translate-chunk":
    case "edit": {
      const to = (request.kind === "edit" ? input.locale : input.to) as Locale;
      if (wrong && to === "ur") return WRONG_SCRIPT[wrong];
      let markdown = str(input.markdown);
      if (request.kind === "edit") return mockEdit(markdown, str(input.action), to);
      if (markers.includes("[[mock:drop-placeholders]]")) markdown = markdown.replace(/\[\[KT_BLOCK_\d+\]\]\n*/g, "");
      const out = mockTranslate(markdown, to);
      return markers.includes("[[mock:evil]]") ? `${out}\n\n${EVIL}` : out;
    }
    case "translate-fields": {
      const fields = (input.fields ?? {}) as Record<string, string>;
      return JSON.stringify(
        Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, mockTranslate(value, input.to as Locale)])),
      );
    }
    case "suggest-headlines": {
      const base = str(input.title) || firstSentence(str(input.text), 70) || (locale === "ur" ? "تازہ خبر" : "Latest story");
      const variants =
        locale === "ur"
          ? ["", " — اہم نکات", ": اب تک کیا معلوم ہے", " پر ایک نظر", " — تفصیلی جائزہ"]
          : ["", ": what we know", " — the key points", ", explained", ": a closer look"];
      return JSON.stringify({ headlines: variants.map((suffix, i) => (i === 0 ? `${base} (${locale === "ur" ? "نیا" : "new"})` : base + suffix)) });
    }
    case "suggest-excerpt":
      return JSON.stringify({ excerpt: firstSentence(str(input.text) || str(input.title), 155) });
    case "suggest-seo-title":
      return JSON.stringify({ seoTitle: (str(input.title) || firstSentence(str(input.text), 60)).slice(0, 60) });
    case "suggest-seo-description":
      return JSON.stringify({ seoDescription: firstSentence(str(input.excerpt) || str(input.text), 155) });
    case "suggest-tags": {
      const text = `${str(input.title)} ${str(input.text)}`.toLowerCase();
      const existing = (Array.isArray(input.existing) ? input.existing : []).map(String);
      const matched = existing.filter((name) => text.includes(name.toLowerCase())).slice(0, 3);
      return JSON.stringify({ tags: [...matched, "Mock Topic", "Analysis"] });
    }
    case "suggest-slug":
      return JSON.stringify({ slug: slugify(str(input.title)).split("-").slice(0, 5).join("-") || "mock-article" });
  }
}

function sleep(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) return reject(signal.reason);
    const timer = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => (clearTimeout(timer), reject(signal.reason)), { once: true });
  });
}

function controlFor(request: AiRequest) {
  const markers = strings(request.mockInput).join(" ");
  const error = markers.match(/\[\[mock:error=([a-z_]+)\]\]/)?.[1];
  const errorMid = markers.match(/\[\[mock:error-mid=([a-z_]+)\]\]/)?.[1];
  return {
    error: isAiErrorCode(error) ? error : null,
    errorMid: isAiErrorCode(errorMid) ? errorMid : null,
    slow: markers.includes("[[mock:slow]]"),
  };
}

export function createMockProvider(): AiProvider {
  if (process.env.NODE_ENV === "production") throw new AiError("not_configured", "The mock AI provider is disabled in production.");

  return {
    name: "mock",
    model: "mock",

    async generate(request) {
      const control = controlFor(request);
      await sleep(control.slow ? 2500 : 40, request.signal);
      if (control.error || control.errorMid) throw new AiError((control.error ?? control.errorMid)!);
      return { text: respond(request), truncated: false };
    },

    async *stream(request) {
      const control = controlFor(request);
      if (control.error) {
        await sleep(40, request.signal);
        throw new AiError(control.error);
      }
      const text = respond(request);
      const chunks = text.match(/[\s\S]{1,16}/g) ?? [];
      for (const [i, chunk] of chunks.entries()) {
        await sleep(control.slow ? 120 : 6, request.signal);
        if (control.errorMid && i === Math.floor(chunks.length / 2)) throw new AiError(control.errorMid);
        yield chunk;
      }
    },
  };
}
