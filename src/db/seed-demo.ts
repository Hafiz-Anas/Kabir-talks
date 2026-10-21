import "./load-env";

import { eq, inArray } from "drizzle-orm";

import type { ArticleDoc, BlockNode } from "@/lib/content/document";
import { db, pgClient } from "./index";
import { articles, articleTags, categories, tags, user } from "./schema";

/**
 * OPTIONAL demo content for testing the admin: `npm run seed:demo`.
 * Never runs automatically. Safe to run twice: articles are matched by slug
 * and left untouched if they already exist. No external images.
 *
 * Requires `npm run seed` (categories) and `npm run seed:admin` (author).
 */

const p = (text: string): BlockNode => ({ type: "paragraph", content: [{ type: "text", text }] });
const h2 = (text: string): BlockNode => ({ type: "heading", attrs: { level: 2 }, content: [{ type: "text", text }] });
const doc = (...content: BlockNode[]): ArticleDoc => ({ type: "doc", content });

const list = (...items: string[]): BlockNode => ({
  type: "bulletList",
  content: items.map((text) => ({ type: "listItem", content: [p(text)] })),
});

const quote = (text: string): BlockNode => ({ type: "blockquote", content: [p(text)] });

/** Paragraph with a link in the middle: before [label](href) after. */
const pLink = (before: string, label: string, href: string, after: string): BlockNode => ({
  type: "paragraph",
  content: [
    { type: "text", text: before },
    { type: "text", text: label, marks: [{ type: "link", attrs: { href } }] },
    { type: "text", text: after },
  ],
});

const numbered = (...items: string[]): BlockNode => ({
  type: "orderedList",
  attrs: { start: 1 },
  content: items.map((text) => ({ type: "listItem", content: [p(text)] })),
});

const youtube = (src: string): BlockNode => ({ type: "youtube", attrs: { src, start: null } });
const tweet = (url: string): BlockNode => ({ type: "tweet", attrs: { url } });

/** Urdu tag names; tags not listed here have an English name only. */
const TAG_URDU: Record<string, string> = {
  Economy: "معیشت",
  Budget: "بجٹ",
  Cricket: "کرکٹ",
  Hockey: "ہاکی",
  Climate: "موسمیات",
  Health: "صحت",
  Education: "تعلیم",
  Squash: "اسکواش",
};

type Demo = {
  slug: string;
  category: "current-affairs" | "sports";
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  featured?: boolean;
  daysAgo: number;
  tags: string[];
  en?: { title: string; excerpt: string; body: ArticleDoc };
  ur?: { title: string; excerpt: string; body: ArticleDoc };
};

const DEMOS: Demo[] = [
  {
    slug: "demo-budget-2026-what-it-means",
    category: "current-affairs",
    status: "PUBLISHED",
    featured: true,
    daysAgo: 1,
    tags: ["Economy", "Budget"],
    en: {
      title: "Budget 2026: what the new numbers mean for households",
      excerpt: "A plain-language guide to the tax changes, subsidies and spending priorities announced this week.",
      body: doc(
        p("The federal budget unveiled this week promises relief for salaried workers while widening the tax net for retailers and property owners."),
        h2("The headline changes"),
        list(
          "Income tax slabs adjusted for inflation for the first time in three years",
          "Targeted electricity subsidies for households using under 200 units",
          "A new digital filing portal for small traders",
        ),
        p("Economists broadly welcomed the direction but warned that revenue targets depend on collection improving faster than it has in the past."),
        quote("The question is not what was announced, but what will actually be collected."),
        h2("What to watch next"),
        p("Parliament will debate the finance bill over the coming two weeks, and several measures may change before it is passed."),
      ),
    },
    ur: {
      title: "بجٹ ۲۰۲۶: نئے اعداد و شمار گھریلو بجٹ پر کیا اثر ڈالیں گے",
      excerpt: "اس ہفتے اعلان کردہ ٹیکس تبدیلیوں، سبسڈیز اور اخراجات کی ترجیحات کا آسان جائزہ۔",
      body: doc(
        p("اس ہفتے پیش کیے گئے وفاقی بجٹ میں تنخواہ دار طبقے کے لیے ریلیف کا وعدہ کیا گیا ہے جبکہ تاجروں اور جائیداد مالکان کے لیے ٹیکس نیٹ کو وسیع کیا گیا ہے۔"),
        h2("اہم تبدیلیاں"),
        list(
          "تین برس میں پہلی بار انکم ٹیکس کی شرحیں مہنگائی کے مطابق کی گئیں",
          "دو سو یونٹ سے کم بجلی استعمال کرنے والے گھروں کے لیے سبسڈی",
          "چھوٹے تاجروں کے لیے نیا ڈیجیٹل فائلنگ پورٹل",
        ),
        quote("اصل سوال یہ نہیں کہ کیا اعلان ہوا، بلکہ یہ کہ کتنا وصول ہوگا۔"),
        p("پارلیمنٹ آئندہ دو ہفتوں میں فنانس بل پر بحث کرے گی اور کئی اقدامات میں تبدیلی ممکن ہے۔"),
      ),
    },
  },
  {
    slug: "demo-cricket-series-preview",
    category: "sports",
    status: "PUBLISHED",
    daysAgo: 2,
    tags: ["Cricket"],
    en: {
      title: "Series preview: five things to watch in the home Test series",
      excerpt: "Spin conditions, a new opening pair and a captain under pressure set up a fascinating contest.",
      body: doc(
        p("The home side starts the three-match Test series as favourites, but recent form suggests the visitors will not make it easy."),
        h2("1. The new opening partnership"),
        p("With two uncapped openers in the squad, the selectors have signalled a clear break from the past."),
        h2("2. Spin-friendly pitches"),
        p("Groundsmen at all three venues have prepared dry surfaces that should turn from day two."),
      ),
    },
  },
  {
    slug: "demo-hockey-revival",
    category: "sports",
    status: "PUBLISHED",
    daysAgo: 4,
    tags: ["Hockey"],
    ur: {
      title: "قومی ہاکی کی بحالی: نوجوان کھلاڑیوں سے نئی امیدیں",
      excerpt: "جونیئر ٹیم کی حالیہ کامیابیوں نے قومی کھیل میں نئی روح پھونک دی ہے۔",
      body: doc(
        p("جونیئر ہاکی ٹیم کی ایشیائی مقابلوں میں شاندار کارکردگی کے بعد شائقین ایک بار پھر قومی کھیل کی طرف متوجہ ہو رہے ہیں۔"),
        h2("تربیتی نظام میں تبدیلیاں"),
        p("فیڈریشن نے ملک بھر میں علاقائی اکیڈمیاں قائم کرنے کا اعلان کیا ہے جہاں جدید سہولیات فراہم کی جائیں گی۔"),
        list("آسٹروٹرف میدانوں کی تعداد میں اضافہ", "غیر ملکی کوچز کی خدمات", "اسکول کی سطح پر مقابلے"),
      ),
    },
  },
  {
    slug: "demo-monsoon-preparedness",
    category: "current-affairs",
    status: "DRAFT",
    daysAgo: 0,
    tags: ["Climate", "Cities"],
    en: {
      title: "Are our cities ready for this year’s monsoon?",
      excerpt: "Drainage upgrades are behind schedule in several districts. Draft — awaiting comments from officials.",
      body: doc(
        p("Municipal officials say drainage works are 70 percent complete, but residents of low-lying neighbourhoods remain sceptical."),
        p("[Draft: add quotes from the provincial disaster management authority.]"),
      ),
    },
  },
  {
    slug: "demo-education-reform-ur",
    category: "current-affairs",
    status: "DRAFT",
    daysAgo: 3,
    tags: ["Education"],
    ur: {
      title: "تعلیمی اصلاحات: نصاب میں بڑی تبدیلیوں کی تیاری",
      excerpt: "مسودہ — صوبائی وزارت تعلیم سے تصدیق باقی ہے۔",
      body: doc(
        p("ذرائع کے مطابق آئندہ تعلیمی سال سے پرائمری سطح پر نیا نصاب متعارف کرایا جائے گا۔"),
        p("[مسودہ: ماہرین تعلیم کی رائے شامل کریں۔]"),
      ),
    },
  },
  {
    slug: "demo-football-league-launch",
    category: "sports",
    status: "DRAFT",
    daysAgo: 5,
    tags: ["Football"],
    en: {
      title: "New national football league announces eight founding clubs",
      excerpt: "The league aims to kick off next spring with a mix of established and new teams.",
      body: doc(p("Organisers confirmed eight founding clubs and a broadcast partner, with the first season planned for next spring.")),
    },
    ur: {
      title: "نئی قومی فٹبال لیگ کے آٹھ بانی کلبوں کا اعلان",
      excerpt: "لیگ کا آغاز آئندہ موسم بہار میں متوقع ہے۔",
      body: doc(p("منتظمین نے آٹھ بانی کلبوں اور نشریاتی شراکت دار کی تصدیق کر دی ہے۔")),
    },
  },
  {
    slug: "demo-psl-final-review",
    category: "sports",
    status: "PUBLISHED",
    featured: true,
    daysAgo: 0.2,
    tags: ["Cricket", "PSL"],
    en: {
      title: "PSL 2026 final: how Lahore Qalandars won a thriller in Karachi",
      excerpt: "A last-over finish, a record chase and a captain’s knock decided the most dramatic final in the league’s history.",
      body: doc(
        p("The PSL 2026 final will be remembered for a chase that seemed impossible at the halfway mark. Needing 64 from the last 30 balls, Lahore Qalandars kept their nerve in front of 32,000 fans at the National Stadium."),
        p("The captain’s unbeaten 78 off 41 balls anchored the innings, while a 19-year-old debutant hit the winning boundary with two balls to spare."),
        p("Karachi’s bowlers had controlled the middle overs, conceding just 38 runs between overs 7 and 14, but two dropped catches in the 17th over changed the game."),
        h2("Turning points"),
        numbered(
          "Over 17: two dropped catches and 21 runs conceded",
          "Over 19: a review overturned an lbw decision",
          "Over 20: a scooped four over fine leg to win it",
        ),
        youtube("https://www.youtube.com/watch?v=aqz-KE-bpKQ"),
        quote("We never stopped believing — not even when the required rate passed 12."),
        tweet("https://x.com/TheRealPCB/status/1234567890123456789"),
        pLink("Full scorecard and ball-by-ball commentary are on the ", "official league website", "https://www.psl-t20.com/", "."),
      ),
    },
    ur: {
      title: "PSL 2026 فائنل: لاہور قلندرز نے کراچی میں سنسنی خیز مقابلہ کیسے جیتا",
      excerpt: "آخری اوور کا اختتام، ریکارڈ ہدف کا تعاقب اور کپتان کی شاندار اننگز نے لیگ کی تاریخ کا سب سے ڈرامائی فائنل طے کیا۔",
      body: doc(
        p("PSL 2026 کا فائنل اس تعاقب کی وجہ سے یاد رکھا جائے گا جو آدھے میچ تک ناممکن لگ رہا تھا۔ آخری 30 گیندوں پر 64 رنز درکار تھے، مگر لاہور قلندرز نے نیشنل اسٹیڈیم میں 32,000 تماشائیوں کے سامنے حوصلہ برقرار رکھا۔"),
        p("کپتان کی 41 گیندوں پر ناقابل شکست 78 رنز کی اننگز نے ٹیم کو سہارا دیا، جبکہ 19 سالہ نوجوان کھلاڑی نے دو گیندیں باقی رہتے فاتحانہ چوکا لگایا۔"),
        p("کراچی کے بولرز نے درمیانی اوورز میں کنٹرول رکھا اور 7 سے 14 اوورز کے دوران صرف 38 رنز دیے، لیکن 17ویں اوور میں دو کیچ چھوٹنے سے میچ کا پانسہ پلٹ گیا۔"),
        h2("فیصلہ کن لمحات"),
        numbered("17واں اوور: دو کیچ چھوٹے اور 21 رنز بنے", "19واں اوور: ریویو پر lbw کا فیصلہ تبدیل ہوا", "20واں اوور: فائن لیگ کے اوپر سے فاتحانہ چوکا"),
        youtube("https://www.youtube.com/watch?v=aqz-KE-bpKQ"),
        quote("ہم نے کبھی ہمت نہیں ہاری — اس وقت بھی نہیں جب مطلوبہ رن ریٹ 12 سے اوپر چلا گیا۔"),
        pLink("مکمل اسکور کارڈ ", "لیگ کی آفیشل ویب سائٹ", "https://www.psl-t20.com/", " پر دستیاب ہے۔"),
      ),
    },
  },
  {
    slug: "demo-inflation-eases",
    category: "current-affairs",
    status: "PUBLISHED",
    daysAgo: 1.5,
    tags: ["Economy"],
    en: {
      title: "Inflation eases for a third month as food prices stabilise",
      excerpt: "Consumer prices rose 6.1% year on year in September, the slowest pace since early 2022.",
      body: doc(
        p("Headline inflation slowed to 6.1% in September, down from 7.4% in August, according to figures released on Monday."),
        p("Food prices, which drove much of last year’s surge, were broadly flat month on month."),
        p("Analysts expect the central bank to consider a rate cut at its next meeting."),
      ),
    },
    ur: {
      title: "خوراک کی قیمتیں مستحکم، مہنگائی میں مسلسل تیسرے ماہ کمی",
      excerpt: "ستمبر میں صارفین کی قیمتوں میں سالانہ بنیاد پر 6.1 فیصد اضافہ ہوا، جو 2022 کے اوائل کے بعد سب سے کم ہے۔",
      body: doc(
        p("پیر کو جاری اعداد و شمار کے مطابق ستمبر میں مہنگائی کی شرح کم ہو کر 6.1 فیصد رہ گئی، جو اگست میں 7.4 فیصد تھی۔"),
        p("گزشتہ برس اضافے کی بڑی وجہ بننے والی خوراک کی قیمتیں ماہانہ بنیاد پر تقریباً مستحکم رہیں۔"),
      ),
    },
  },
  {
    slug: "demo-heatwave-advice",
    category: "current-affairs",
    status: "PUBLISHED",
    daysAgo: 3,
    tags: ["Climate", "Health"],
    en: {
      title: "Heatwave warning: how to stay safe as temperatures pass 45°C",
      excerpt: "Doctors share practical advice for families, outdoor workers and the elderly.",
      body: doc(
        p("The meteorological department has issued a heatwave warning for the next five days across central and southern districts."),
        list("Drink water regularly, even if you are not thirsty", "Avoid direct sun between 11am and 4pm", "Check on elderly neighbours twice a day"),
      ),
    },
    ur: {
      title: "ہیٹ ویو کی وارننگ: 45 ڈگری سے زائد درجہ حرارت میں محفوظ کیسے رہیں",
      excerpt: "ڈاکٹروں نے خاندانوں، باہر کام کرنے والوں اور بزرگوں کے لیے عملی مشورے دیے ہیں۔",
      body: doc(
        p("محکمہ موسمیات نے وسطی اور جنوبی اضلاع میں آئندہ پانچ دن کے لیے ہیٹ ویو کی وارننگ جاری کی ہے۔"),
        list("پیاس نہ بھی لگے تو باقاعدگی سے پانی پئیں", "صبح 11 سے شام 4 بجے تک دھوپ سے بچیں", "دن میں دو بار بزرگ پڑوسیوں کی خیریت دریافت کریں"),
      ),
    },
  },
  {
    slug: "demo-squash-champion",
    category: "sports",
    status: "PUBLISHED",
    daysAgo: 5,
    tags: ["Squash"],
    en: {
      title: "Teenage squash star reaches world junior final",
      excerpt: "The 17-year-old from Peshawar is the first player from the country to reach the final in a decade.",
      body: doc(p("A remarkable run at the World Junior Championships ended in a five-game final on Sunday.")),
    },
    ur: {
      title: "نوجوان اسکواش اسٹار ورلڈ جونیئر فائنل میں پہنچ گئے",
      excerpt: "پشاور سے تعلق رکھنے والے 17 سالہ کھلاڑی ایک دہائی میں فائنل تک پہنچنے والے پہلے پاکستانی ہیں۔",
      body: doc(p("ورلڈ جونیئر چیمپئن شپ میں شاندار سفر اتوار کو پانچ گیمز کے فائنل پر ختم ہوا۔")),
    },
  },
  {
    slug: "demo-ai-in-classrooms",
    category: "current-affairs",
    status: "PUBLISHED",
    featured: true,
    daysAgo: 6,
    tags: ["Education", "Technology"],
    en: {
      title: "Teachers weigh the promise and pitfalls of AI in the classroom",
      excerpt: "A new pilot in 40 schools is testing AI tutors — and raising questions about homework, fairness and privacy.",
      body: doc(
        p("Forty public schools began a year-long pilot this term that gives students access to AI tutoring tools for maths and English."),
        p("Teachers say the tools help struggling students practise, but worry about over-reliance and data privacy."),
      ),
    },
  },
  {
    slug: "demo-archived-election-explainer",
    category: "current-affairs",
    status: "ARCHIVED",
    daysAgo: 30,
    tags: ["Economy"],
    en: {
      title: "ARCHIVED: Election explainer that must never appear publicly",
      excerpt: "Archived test article — it must not appear on any public page.",
      body: doc(p("This archived article exists to test that archived content stays hidden.")),
    },
    ur: {
      title: "محفوظ شدہ: انتخابی وضاحت جو کبھی عوامی طور پر ظاہر نہیں ہونی چاہیے",
      excerpt: "محفوظ شدہ آزمائشی مضمون۔",
      body: doc(p("یہ مضمون صرف جانچ کے لیے ہے۔")),
    },
  },
];

async function main() {
  const admin = await db.query.user.findFirst({ where: eq(user.role, "admin") });
  if (!admin) throw new Error("No admin user found. Run `npm run seed:admin` first.");

  const categoryRows = await db.select().from(categories).where(inArray(categories.slug, ["current-affairs", "sports"]));
  const categoryId = Object.fromEntries(categoryRows.map((c) => [c.slug, c.id]));
  if (!categoryId["current-affairs"] || !categoryId.sports) throw new Error("Categories missing. Run `npm run seed` first.");

  let created = 0;
  for (const demo of DEMOS) {
    const exists = await db.query.articles.findFirst({ where: eq(articles.slug, demo.slug), columns: { id: true } });
    if (exists) continue;

    const when = new Date(Date.now() - demo.daysAgo * 86_400_000);
    await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(articles)
        .values({
          slug: demo.slug,
          categoryId: categoryId[demo.category],
          authorId: admin.id,
          status: demo.status,
          isFeatured: demo.featured ?? false,
          titleEn: demo.en?.title ?? null,
          excerptEn: demo.en?.excerpt ?? null,
          bodyEn: demo.en?.body ?? null,
          titleUr: demo.ur?.title ?? null,
          excerptUr: demo.ur?.excerpt ?? null,
          bodyUr: demo.ur?.body ?? null,
          // Archived articles were published once, so they keep their date.
          publishedAt: demo.status === "DRAFT" ? null : when,
          createdAt: when,
          updatedAt: when,
        })
        .returning({ id: articles.id });

      for (const name of demo.tags) {
        const slug = name.toLowerCase();
        await tx
          .insert(tags)
          .values({ slug, nameEn: name, nameUr: TAG_URDU[name] ?? null })
          .onConflictDoNothing({ target: tags.slug });
        const [tag] = await tx.select({ id: tags.id }).from(tags).where(eq(tags.slug, slug));
        await tx.insert(articleTags).values({ articleId: row.id, tagId: tag.id }).onConflictDoNothing();
      }
    });
    created++;
  }

  console.log(`✔ Demo articles: ${created} created, ${DEMOS.length - created} already existed (slugs start with "demo-")`);
}

main()
  .catch((error) => {
    console.error("✖ Demo seed failed:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => pgClient.end());
