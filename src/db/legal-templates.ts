/**
 * Starter text for the Privacy Policy and Terms of Use (Phase 7), seeded by
 * `npm run seed` only when the page doesn't exist yet. It is a TEMPLATE: it
 * describes what the site does today (AdSense, cookies, Supabase, Gemini AI,
 * newsletter, comments and accounts) but is not legal advice. The owner must
 * review it — the first paragraph says so on the page until it is edited.
 */

type Block = ["h2", string] | ["p", string] | ["ul", string[]];

function doc(blocks: Block[]) {
  const text = (value: string) => [{ type: "text", text: value }];
  return {
    type: "doc",
    content: blocks.map(([kind, value]) => {
      if (kind === "h2") return { type: "heading", attrs: { level: 2 }, content: text(value) };
      if (kind === "p") return { type: "paragraph", content: text(value) };
      return { type: "bulletList", content: value.map((item) => ({ type: "listItem", content: [{ type: "paragraph", content: text(item) }] })) };
    }),
  };
}

const NOTE_EN = "Template: this starter text must be reviewed (and, ideally, checked by a lawyer) by the site owner before launch. Remove this paragraph once it has been reviewed.";
const NOTE_UR = "نمونہ: سائٹ کے مالک کو لانچ سے پہلے اس ابتدائی متن کا جائزہ لینا (اور بہتر ہو کہ کسی وکیل سے اس کی جانچ کروانا) ضروری ہے۔ جائزے کے بعد یہ پیراگراف ہٹا دیں۔";

export const LEGAL_TEMPLATES = {
  privacy: {
    titleEn: "Privacy Policy",
    titleUr: "رازداری کی پالیسی",
    bodyEn: doc([
      ["p", NOTE_EN],
      ["p", "This policy explains what information Kabir Talks collects when you read the site, create an account, comment, subscribe to the newsletter or contact us, and how we use it."],
      ["h2", "Reading the site"],
      ["p", "You can read every article without an account. To count how often stories are read, we record one view per article per day for each visitor. We do this with a code made from your IP address and browser that changes every day, so we never store your IP address and can't follow you from one day to the next."],
      ["h2", "Advertising and cookies (Google AdSense)"],
      ["p", "We show ads from Google AdSense. Google and its partners use cookies and similar technologies to show ads, to measure them and, if you agree, to personalise them based on your visits to this and other websites. Visitors in the European Economic Area, the UK and Switzerland are asked for consent through Google's consent message."],
      ["ul", [
        "Google's use of advertising cookies: https://policies.google.com/technologies/ads",
        "How Google uses information from sites that use its services: https://policies.google.com/technologies/partner-sites",
        "You can turn off personalised ads at https://adssettings.google.com",
      ]],
      ["p", "If we start using Google Analytics, it will also use cookies to tell us how the site is used, and we will update this policy before we do."],
      ["p", "We also keep a few settings in your browser's local storage, such as your light or dark theme. These never leave your device."],
      ["h2", "Accounts and comments"],
      ["p", "If you create an account we store your name, email address, a securely hashed password (or your Google sign-in), your preferred language and, if you add one, a profile photo. Bookmarks and comments are linked to your account. Comments are checked before they appear and are shown publicly with your name. You can change your details or delete your account at any time from My account; your comments then stay on the site as \"Deleted user\"."],
      ["h2", "Newsletter"],
      ["p", "If you subscribe, we store your email address, which languages you want and when you subscribed and confirmed. We only email you after you confirm, and every email has a one-click unsubscribe link. Emails are sent through our email provider (Resend)."],
      ["h2", "AI features"],
      ["p", "Article summaries, \"Ask this article\" and \"Listen\" use Google's Gemini AI. The article's text and, for \"Ask this article\", the question you type are sent to Google to produce the answer. Don't include personal information in your questions."],
      ["h2", "Contact form"],
      ["p", "Messages you send through the contact form (your name, email address, subject and message) are stored so we can reply, and are forwarded to us by email."],
      ["h2", "Where your data is kept"],
      ["p", "Our database and image storage are run by Supabase. The website runs on our own server. Our service providers only process data on our behalf."],
      ["h2", "How long we keep it, and your rights"],
      ["p", "We keep account data until you delete your account, newsletter data until you unsubscribe or ask us to remove it, and contact messages for as long as needed to deal with them. You can ask us for a copy of your data, to correct it or to delete it by contacting us through the Contact page."],
      ["h2", "Changes"],
      ["p", "If we change this policy we will update this page and the date it was last updated."],
    ]),
    bodyUr: doc([
      ["p", NOTE_UR],
      ["p", "یہ پالیسی بتاتی ہے کہ جب آپ کبیر ٹاکس پڑھتے ہیں، اکاؤنٹ بناتے ہیں، تبصرہ کرتے ہیں، نیوز لیٹر سبسکرائب کرتے ہیں یا ہم سے رابطہ کرتے ہیں تو ہم کون سی معلومات جمع کرتے ہیں اور انہیں کیسے استعمال کرتے ہیں۔"],
      ["h2", "سائٹ پڑھنا"],
      ["p", "آپ ہر مضمون اکاؤنٹ کے بغیر پڑھ سکتے ہیں۔ یہ جاننے کے لیے کہ خبریں کتنی بار پڑھی جاتی ہیں، ہم ہر قاری کے لیے ہر مضمون پر روزانہ ایک بار شمار کرتے ہیں۔ اس کے لیے آپ کے آئی پی پتے اور براؤزر سے ایک کوڈ بنایا جاتا ہے جو ہر روز بدل جاتا ہے، اس لیے ہم آپ کا آئی پی پتہ محفوظ نہیں کرتے اور آپ کو ایک دن سے دوسرے دن تک ٹریک نہیں کر سکتے۔"],
      ["h2", "اشتہارات اور کوکیز (گوگل ایڈسینس)"],
      ["p", "ہم گوگل ایڈسینس کے اشتہارات دکھاتے ہیں۔ گوگل اور اس کے شراکت دار اشتہارات دکھانے، ان کی پیمائش کرنے اور آپ کی رضامندی سے انہیں اس اور دوسری ویب سائٹس پر آپ کے دوروں کی بنیاد پر ذاتی بنانے کے لیے کوکیز اور ایسی ہی ٹیکنالوجی استعمال کرتے ہیں۔ یورپی اقتصادی علاقے، برطانیہ اور سوئٹزرلینڈ کے قارئین سے گوگل کے رضامندی پیغام کے ذریعے اجازت لی جاتی ہے۔"],
      ["ul", [
        "اشتہاری کوکیز کا گوگل کا استعمال: https://policies.google.com/technologies/ads",
        "گوگل اپنی خدمات استعمال کرنے والی سائٹس سے معلومات کیسے استعمال کرتا ہے: https://policies.google.com/technologies/partner-sites",
        "آپ https://adssettings.google.com پر ذاتی اشتہارات بند کر سکتے ہیں",
      ]],
      ["p", "اگر ہم گوگل اینالیٹکس استعمال کرنا شروع کریں تو وہ بھی یہ جاننے کے لیے کوکیز استعمال کرے گا کہ سائٹ کیسے استعمال ہوتی ہے، اور ہم اس سے پہلے یہ پالیسی اپ ڈیٹ کریں گے۔"],
      ["p", "ہم آپ کے براؤزر کی لوکل اسٹوریج میں چند ترتیبات بھی رکھتے ہیں، جیسے روشن یا تاریک تھیم۔ یہ آپ کے آلے سے باہر نہیں جاتیں۔"],
      ["h2", "اکاؤنٹس اور تبصرے"],
      ["p", "اگر آپ اکاؤنٹ بناتے ہیں تو ہم آپ کا نام، ای میل پتہ، محفوظ طریقے سے ہیش کیا گیا پاس ورڈ (یا گوگل سائن اِن)، پسندیدہ زبان اور اگر آپ شامل کریں تو پروفائل تصویر محفوظ کرتے ہیں۔ بُک مارکس اور تبصرے آپ کے اکاؤنٹ سے منسلک ہوتے ہیں۔ تبصرے شائع ہونے سے پہلے دیکھے جاتے ہیں اور آپ کے نام کے ساتھ عوامی طور پر دکھائے جاتے ہیں۔ آپ \"میرا اکاؤنٹ\" سے کسی بھی وقت اپنی تفصیلات بدل سکتے ہیں یا اکاؤنٹ حذف کر سکتے ہیں؛ اس کے بعد آپ کے تبصرے \"حذف شدہ صارف\" کے نام سے سائٹ پر رہتے ہیں۔"],
      ["h2", "نیوز لیٹر"],
      ["p", "اگر آپ سبسکرائب کرتے ہیں تو ہم آپ کا ای میل پتہ، آپ کی منتخب زبانیں اور سبسکرپشن اور تصدیق کا وقت محفوظ کرتے ہیں۔ ہم صرف آپ کی تصدیق کے بعد ای میل بھیجتے ہیں، اور ہر ای میل میں ایک کلک سے سبسکرپشن ختم کرنے کا لنک ہوتا ہے۔ ای میلز ہمارے ای میل فراہم کنندہ (Resend) کے ذریعے بھیجی جاتی ہیں۔"],
      ["h2", "مصنوعی ذہانت کی سہولیات"],
      ["p", "مضمون کا خلاصہ، \"اس مضمون سے پوچھیں\" اور \"سنیں\" گوگل کی جیمنائی مصنوعی ذہانت استعمال کرتے ہیں۔ جواب بنانے کے لیے مضمون کا متن اور \"اس مضمون سے پوچھیں\" میں آپ کا لکھا سوال گوگل کو بھیجا جاتا ہے۔ اپنے سوالوں میں ذاتی معلومات شامل نہ کریں۔"],
      ["h2", "رابطہ فارم"],
      ["p", "رابطہ فارم سے بھیجے گئے پیغامات (آپ کا نام، ای میل پتہ، موضوع اور پیغام) جواب دینے کے لیے محفوظ کیے جاتے ہیں اور ای میل کے ذریعے ہمیں بھیجے جاتے ہیں۔"],
      ["h2", "آپ کا ڈیٹا کہاں رکھا جاتا ہے"],
      ["p", "ہمارا ڈیٹا بیس اور تصاویر کا ذخیرہ سوپابیس (Supabase) چلاتا ہے۔ ویب سائٹ ہمارے اپنے سرور پر چلتی ہے۔ ہمارے خدمات فراہم کنندگان صرف ہماری طرف سے ڈیٹا پر کام کرتے ہیں۔"],
      ["h2", "ڈیٹا کتنی دیر رکھا جاتا ہے، اور آپ کے حقوق"],
      ["p", "ہم اکاؤنٹ کا ڈیٹا اکاؤنٹ حذف ہونے تک، نیوز لیٹر کا ڈیٹا سبسکرپشن ختم کرنے یا ہٹانے کی درخواست تک، اور رابطہ پیغامات ضرورت کی حد تک رکھتے ہیں۔ آپ رابطہ صفحے کے ذریعے ہم سے اپنے ڈیٹا کی نقل، اس کی درستگی یا اسے حذف کرنے کی درخواست کر سکتے ہیں۔"],
      ["h2", "تبدیلیاں"],
      ["p", "اگر ہم یہ پالیسی بدلیں گے تو اس صفحے اور اس کی آخری تاریخ کو اپ ڈیٹ کریں گے۔"],
    ]),
  },
  terms: {
    titleEn: "Terms of Use",
    titleUr: "شرائط استعمال",
    bodyEn: doc([
      ["p", NOTE_EN],
      ["p", "By using Kabir Talks you agree to these terms. If you don't agree, please don't use the site."],
      ["h2", "Our content"],
      ["p", "Articles, images and other material on Kabir Talks belong to us or to their owners. You may read them, share links to them and quote short extracts with a link back. Please don't republish whole articles without our written permission."],
      ["h2", "Accounts"],
      ["p", "You are responsible for your account and for keeping your password safe. Give accurate information and don't use someone else's account. We may suspend accounts that break these terms."],
      ["h2", "Comments"],
      ["p", "Comments are reviewed before they appear. Don't post anything unlawful, hateful, harassing, defamatory, misleading or spam, or anyone else's personal information. We may edit, refuse or remove comments and turn off commenting for an account. You remain responsible for what you post, and you allow us to show it on the site."],
      ["h2", "AI features"],
      ["p", "Summaries, answers and audio produced by AI can contain mistakes. They are a reading aid, not a replacement for the article. Always check the article itself before relying on anything AI produced."],
      ["h2", "Newsletter"],
      ["p", "Our newsletter is free. You can unsubscribe at any time with the link in every email."],
      ["h2", "Advertising and links"],
      ["p", "The site shows advertising, including from Google AdSense, and links to other websites. We aren't responsible for advertisers' products or for the content of other websites."],
      ["h2", "No warranty"],
      ["p", "We work to be accurate, but the site is provided \"as is\". To the extent the law allows, we aren't liable for losses arising from your use of the site."],
      ["h2", "Changes and contact"],
      ["p", "We may update these terms; the new version applies from when it is posted here. Questions? Use our Contact page."],
    ]),
    bodyUr: doc([
      ["p", NOTE_UR],
      ["p", "کبیر ٹاکس استعمال کر کے آپ ان شرائط سے اتفاق کرتے ہیں۔ اگر آپ متفق نہیں تو براہ کرم سائٹ استعمال نہ کریں۔"],
      ["h2", "ہمارا مواد"],
      ["p", "کبیر ٹاکس پر مضامین، تصاویر اور دیگر مواد ہمارا یا اس کے مالکان کا ہے۔ آپ انہیں پڑھ سکتے ہیں، ان کے لنک شیئر کر سکتے ہیں اور لنک کے ساتھ مختصر اقتباسات نقل کر سکتے ہیں۔ براہ کرم ہماری تحریری اجازت کے بغیر پورے مضامین دوبارہ شائع نہ کریں۔"],
      ["h2", "اکاؤنٹس"],
      ["p", "آپ اپنے اکاؤنٹ اور پاس ورڈ کی حفاظت کے ذمہ دار ہیں۔ درست معلومات دیں اور کسی اور کا اکاؤنٹ استعمال نہ کریں۔ ہم ان شرائط کی خلاف ورزی کرنے والے اکاؤنٹس معطل کر سکتے ہیں۔"],
      ["h2", "تبصرے"],
      ["p", "تبصرے شائع ہونے سے پہلے دیکھے جاتے ہیں۔ غیر قانونی، نفرت انگیز، ہراساں کرنے والا، ہتک آمیز، گمراہ کن یا اسپام مواد، یا کسی اور کی ذاتی معلومات پوسٹ نہ کریں۔ ہم تبصروں میں ترمیم، انہیں مسترد یا حذف کر سکتے ہیں اور کسی اکاؤنٹ کے لیے تبصرے بند کر سکتے ہیں۔ آپ اپنی پوسٹ کے ذمہ دار رہتے ہیں اور ہمیں اسے سائٹ پر دکھانے کی اجازت دیتے ہیں۔"],
      ["h2", "مصنوعی ذہانت کی سہولیات"],
      ["p", "مصنوعی ذہانت سے بنے خلاصے، جوابات اور آڈیو میں غلطیاں ہو سکتی ہیں۔ یہ پڑھنے میں مدد کے لیے ہیں، مضمون کا متبادل نہیں۔ کسی بات پر بھروسہ کرنے سے پہلے ہمیشہ اصل مضمون دیکھیں۔"],
      ["h2", "نیوز لیٹر"],
      ["p", "ہمارا نیوز لیٹر مفت ہے۔ آپ ہر ای میل میں دیے گئے لنک سے کسی بھی وقت سبسکرپشن ختم کر سکتے ہیں۔"],
      ["h2", "اشتہارات اور لنکس"],
      ["p", "سائٹ پر گوگل ایڈسینس سمیت اشتہارات اور دوسری ویب سائٹس کے لنکس ہوتے ہیں۔ ہم مشتہرین کی مصنوعات یا دوسری ویب سائٹس کے مواد کے ذمہ دار نہیں۔"],
      ["h2", "کوئی ضمانت نہیں"],
      ["p", "ہم درستگی کی پوری کوشش کرتے ہیں، لیکن سائٹ \"جیسی ہے\" کی بنیاد پر فراہم کی جاتی ہے۔ قانون کی حد تک، سائٹ کے استعمال سے ہونے والے نقصانات کے ہم ذمہ دار نہیں۔"],
      ["h2", "تبدیلیاں اور رابطہ"],
      ["p", "ہم یہ شرائط اپ ڈیٹ کر سکتے ہیں؛ نیا ورژن یہاں شائع ہونے کے وقت سے لاگو ہوگا۔ سوالات کے لیے ہمارا رابطہ صفحہ استعمال کریں۔"],
    ]),
  },
} as const;
