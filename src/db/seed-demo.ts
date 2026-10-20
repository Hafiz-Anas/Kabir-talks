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

type Demo = {
  slug: string;
  category: "current-affairs" | "sports";
  status: "DRAFT" | "PUBLISHED";
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
          publishedAt: demo.status === "PUBLISHED" ? when : null,
          createdAt: when,
          updatedAt: when,
        })
        .returning({ id: articles.id });

      for (const name of demo.tags) {
        const slug = name.toLowerCase();
        await tx.insert(tags).values({ slug, nameEn: name }).onConflictDoNothing({ target: tags.slug });
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
