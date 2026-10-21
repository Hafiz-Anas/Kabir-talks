# Kabir Talks

A bilingual (English + Urdu) news and blog platform, run by a single admin.
One full-stack Next.js app: public site, admin area, and API in the same codebase, deployed to Vercel.

**Current status: Phase 4 of 7 (Public site).** Readers get the full public site in English and Urdu: a homepage, section, article, tag, search and About pages, built from the database, with share buttons and link previews made for WhatsApp, Facebook and X. See [Public site](#public-site).

Built in earlier phases:

- **Phase 1:** foundation (schema, auth, design system, layout shell)
- **Phase 2:** admin core (bilingual Tiptap editor, image uploads, categories, publishing and sharing)
- **Phase 3:** admin AI on Google Gemini (draft with AI, English ⇄ Urdu translation, headline/excerpt/SEO/tag/slug suggestions, rewriting selected text), always with an explicit click and a review step before publishing

---

## Requirements

- **Node.js 20.9 or newer** (developed and verified on Node 24.16.0, npm 11.13.0)
- A **Supabase** project (free tier is fine)

## Tech stack (pinned versions)

| Area | Package | Version |
| --- | --- | --- |
| Framework | `next` | 16.4.2 |
| UI runtime | `react` / `react-dom` | 19.3.0 |
| Language | `typescript` (strict) | 5.9.3 |
| Styling | `tailwindcss` / `@tailwindcss/turbopack` | 4.3.3 |
| Components | `shadcn` (CLI + base CSS), `radix-ui` | 4.22.1 / 1.8.1 |
| Component helpers | `class-variance-authority` / `clsx` / `tailwind-merge` / `tw-animate-css` / `lucide-react` | 0.7.1 / 2.1.1 / 3.7.0 / 1.4.0 / 1.59.0 |
| Database driver | `postgres` (postgres-js) | 3.4.9 |
| ORM / migrations | `drizzle-orm` / `drizzle-kit` | 0.45.4 / 0.31.11 |
| Auth | `better-auth` (Drizzle adapter) / `auth` (Better Auth CLI) | 1.7.11 / 1.7.11 |
| Validation | `zod` | 4.6.7 |
| Rich-text editor | `@tiptap/react` / `starter-kit` / `extension-image` / `extension-youtube` / `extension-bubble-menu` / `extensions` / `core` / `pm` | 3.32.0 |
| AI | `@google/genai` (Google Gen AI SDK, server only) | 2.27.0 |
| Image storage | `@supabase/storage-js` (server only) | 2.118.0 |
| Scripts | `tsx` / `dotenv` | 4.23.15 / 18.0.8 |
| Lint | `eslint` / `eslint-config-next` | 9.39.5 / 16.4.2 |

Every version is pinned exactly in `package.json`, and `package-lock.json` is committed.

---

## 1. Install

```bash
npm install
```

> **Windows users:** run every command from a path whose letter-casing matches the real folders on disk (for example `C:\Users\<you>\Documents\...`, not `...\documents\...`). If the casing is wrong, Turbopack loads React twice and `npm run build` fails with `Cannot read properties of null (reading 'useContext')`. See [Troubleshooting](#troubleshooting).

## 2. Create the Supabase project and get both connection strings

1. Create a project at [supabase.com](https://supabase.com) and save the database password.
2. In the project dashboard, click **Connect** (top bar).
3. Copy two connection strings and put your password in place of `[YOUR-PASSWORD]`:
   - **Transaction pooler** (host `…pooler.supabase.com`, **port 6543**) → `DATABASE_URL`.
     The app uses this at runtime. It suits serverless (Vercel) but does not support prepared statements, so the client uses `prepare: false` (see `src/db/index.ts`).
   - **Direct connection** (host `db.<project-ref>.supabase.co`, **port 5432**) → `DIRECT_URL`.
     This is used **only** by `drizzle-kit` for migrations.
     If your network has no IPv6 and the direct host won't connect, use the **Session pooler** string (also port 5432) instead.

## 3. Configure environment variables

```bash
cp .env.example .env.local
```

Fill in `.env.local`. Every variable is explained in `.env.example`.

| Variable | Required? | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | yes | Transaction pooler, port 6543 (runtime) |
| `DIRECT_URL` | for migrations | Direct connection, port 5432 |
| `BETTER_AUTH_SECRET` | yes | 32+ random characters. Generate with `npx auth secret` |
| `BETTER_AUTH_URL` | yes | Site URL, e.g. `http://localhost:3000` |
| `NEXT_PUBLIC_SITE_URL` | yes | Same as above in most setups |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | for `seed:admin` | The single admin account |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | optional | Enables "Continue with Google" |
| `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | from Phase 2 | Image uploads (service key is server-only) |
| `GEMINI_API_KEY` | optional | Enables AI features (Phases 3 and 6). Server-only. See [AI setup](#8-ai-setup-gemini) |
| `GEMINI_MODEL` | optional | Gemini model code; default `gemini-3.8-flash` |
| `AI_PROVIDER` | optional | `gemini` (default) or `mock` (fake AI for local development; ignored in production builds) |
| `AI_RATE_LIMIT_PER_MINUTE` | optional | Cost guard: AI model calls per admin per minute (default 30) |
| `DATABASE_POOL_MAX` | optional | Override the DB pool size (default 1 in production, 5 in dev). Set to `1` only for a single-backend stand-in like PGlite |
| `RESEND_API_KEY` | optional | Enables the newsletter (Phase 7) |

Variables are validated with Zod in `src/lib/env.ts`. A missing required value stops the app at startup with a clear list of what's wrong. Missing optional values only turn their feature off through `src/lib/features.ts`, which then shows "Coming soon" or "Not configured" instead of crashing.

**Google OAuth (optional):** in the Google Cloud Console, create an OAuth client of type *Web application* and add this authorised redirect URI: `<BETTER_AUTH_URL>/api/auth/callback/google`.

## 4. Run migrations

```bash
npm run db:migrate
```

This applies these migrations over `DIRECT_URL`:

- `drizzle/0000_init.sql`: all 14 tables, enums, indexes, and constraints
- `drizzle/0001_enable_rls.sql`: Row Level Security
- `drizzle/0002_ai_review_pending.sql` (Phase 3): adds one boolean column, `articles.ai_review_pending`, default `false`. It's safe on existing data. See [AI review safeguard](#ai-review-safeguard).

`0001` turns on Row Level Security (with no policies) for every table. Supabase exposes the `public` schema through its auto-generated REST API, and this app never uses that API: it connects as the `postgres` role, which bypasses RLS. Enabling RLS shuts the REST API out without affecting the app.

When you change the schema later:

```bash
npm run db:generate   # writes a new SQL file in drizzle/
npm run db:migrate    # applies it
npm run db:studio     # optional: browse the data
```

## 5. Seed base data and create the admin

```bash
npm run seed         # categories + ad slots (safe to re-run)
npm run seed:admin   # admin from ADMIN_EMAIL / ADMIN_PASSWORD
```

- `seed` upserts **Current Affairs / حالات حاضرہ** (`current-affairs`) and **Sports / کھیل** (`sports`). It also inserts the five ad slots (`home-top`, `home-feed`, `article-top`, `article-inline`, `article-bottom`), disabled and empty. If you run it again, ad slots that already exist are not touched.
- `seed:admin` creates the admin with role `admin`, using Better Auth's own password hashing. If a user with that email already exists, it promotes them to admin and leaves their password alone. To also replace the password with the one in env, run `npm run seed:admin -- --reset-password`.

Credentials are never hard-coded. They come only from env.

**Optional demo content** for trying out the admin:

```bash
npm run seed:demo    # 6 sample articles; needs `seed` and `seed:admin` first
```

This creates six articles whose slugs start with `demo-`. They mix English-only, Urdu-only, and bilingual content, include both drafts and published articles, cover both categories, and one is featured. They use no external images. Running it twice is safe: articles that already exist (matched by slug) are left alone. It never runs automatically. To remove the demo content, delete the `demo-*` articles in the admin.

## 6. Set up image uploads (Supabase Storage)

Cover images and inline images are stored in a **public-read** Supabase Storage bucket named `article-images`. Without this setup the editor still works, but the image buttons show "Storage not configured".

1. In the Supabase dashboard, open **Project Settings → API** and copy:
   - the **Project URL** into `NEXT_PUBLIC_SUPABASE_URL`
   - the **service_role** secret key into `SUPABASE_SERVICE_ROLE_KEY`. This key bypasses all security: it is only read on the server (`src/server/storage.ts` imports `server-only`) and must **never** get a `NEXT_PUBLIC_` prefix.
2. Create the bucket:

   ```bash
   npm run storage:setup
   ```

   This creates the bucket, or updates it if it exists, with: **public** read access, a **5 MB** file size limit, and only `image/jpeg`, `image/png`, `image/webp`, `image/avif` allowed.

   *If you prefer the dashboard:* **Storage → New bucket**, name `article-images`, turn on **Public bucket**, then under the bucket's settings set the file size limit to 5 MB and the allowed MIME types to the four above.
3. **Policies: add none.** A public bucket lets anyone *read* a file by its URL. With no policies on `storage.objects`, the `anon` and `authenticated` roles can't upload, change, delete, or list anything. Only the server can write, using the service role key.
4. Restart `npm run dev` (or rebuild) so `next.config.ts` picks up the Supabase host for `next/image` (`images.remotePatterns`, limited to `/storage/v1/object/public/article-images/**`).

**How an upload works** (`src/server/uploads.ts`). Both steps are server actions that call `requireAdmin()`:

1. `createImageUpload` checks the declared type and size and generates an unguessable path `articles/{yyyy}/{mm}/{uuid}.{ext}`. It then returns a short-lived **signed upload URL** that works only for that path and can't overwrite an existing file.
2. The browser uploads the file straight to Supabase with a progress bar. Large files never pass through the app server, which also avoids Vercel's 4.5 MB request limit.
3. `finalizeImageUpload` reads the stored file back and checks its real type from the first bytes ("magic numbers"), not from the extension or the declared type. It also checks the size and that the type matches the extension. Anything that fails is deleted. Only after that does the editor get the public URL.

When saving, and again when rendering, an image is accepted only if its URL is in this bucket and matches that path pattern. External image URLs and `data:` URIs are stripped.

## 7. Run locally

```bash
npm run dev
```

- <http://localhost:3000> redirects to `/en`
- `/en` is the English site (LTR) and `/ur` is the Urdu site (RTL, Noto Nastaliq Urdu). Run `npm run seed:demo` to have stories to look at.
- `/login` has sign-in and reader sign-up
- `/admin` is for the admin only

### All scripts

| Script | What it does |
| --- | --- |
| `dev` / `build` / `start` | Next.js dev server, production build, production server |
| `lint` / `typecheck` | ESLint; route type generation + `tsc --noEmit` |
| `db:generate` / `db:migrate` / `db:studio` | Drizzle migrations (see step 4) |
| `seed` / `seed:admin` | Categories + ad slots; the admin account |
| `seed:demo` | Optional demo articles (see step 5) |
| `storage:setup` | Creates/updates the `article-images` bucket (see step 6) |
| `verify:content` | Self-checks for the content safety rules: link, YouTube and X URL allow-lists, Tiptap sanitizer, HTML renderer escaping (also when the body is split for the inline ad slot), localized embed labels, image magic bytes, slugs, reserved section slugs, publish checklist, `?page` parsing. No database needed. |
| `verify:ai` | Self-checks for the AI pipeline: Markdown ⇄ Tiptap round trips (incl. Urdu and mixed text), image/embed placeholders, stripping of malicious AI output, Urdu-script check, JSON validation, mock provider, rate limiter. No database or API key needed. |

## 8. AI setup (Gemini)

AI is optional. With no AI variables set, the app builds and runs normally, and every AI button shows **Coming soon**.

### Get a Gemini API key

1. Go to [Google AI Studio](https://aistudio.google.com) and sign in with a Google account.
2. Click **Get API key** → **Create API key**. You can attach it to a new or existing Google Cloud project.
3. Put it in `.env.local`, and later in your Vercel project's environment variables:

   ```bash
   GEMINI_API_KEY="your-key"
   ```

   The key is **server-only**. Only `src/lib/ai/gemini.ts` reads it, and that file imports `server-only`. The browser only talks to this app's own `/api/admin/ai` endpoint and never to Google. This was checked by building with a dummy key and searching the browser bundles for the key, the model name and Google endpoints: none were found.
4. Restart `npm run dev`. The dashboard's **AI status** card shows `Gemini (gemini-3.8-flash)`. Click **Test connection** to send one tiny request. It shows *Connected* or a clear error, such as a rejected key or a quota problem.

### Choosing a model

`GEMINI_MODEL` is optional. The default is **`gemini-3.8-flash`**, which Google's model list ([ai.google.dev/gemini-api/docs/models](https://ai.google.dev/gemini-api/docs/models)) marked as stable on 2026-10-20 and recommends for new projects: fast, cheap, a 65,536-token output limit, and structured output. For a cheaper and faster option, set `GEMINI_MODEL=gemini-3.5-flash-lite`. Use stable model codes rather than `-preview` ones, and check that page before changing.

### Mock mode (development without a key)

```bash
AI_PROVIDER=mock
```

The mock provider gives **fake but deterministic** output for every feature. It streams with small delays, produces a fake word-swap Urdu "translation" that keeps all formatting and embeds, and returns fake suggestions. No requests leave your machine and it costs nothing. It's for building and testing the UI, not for content: the text is nonsense on purpose.

Mock mode **only works in development**. In a production build (`npm run build` + `npm start`, or Vercel), `AI_PROVIDER=mock` is ignored, AI shows as *Not configured*, and the dashboard says why.

For testing error states, the mock responds to markers in your prompt or text:

| Marker | Effect |
| --- | --- |
| `[[mock:error=quota]]` | A quota error. Also works with `rate_limited`, `safety`, `timeout`, `network`, `unavailable` and `config`. |
| `[[mock:slow]]` | Slow output, to try the **Stop** button |
| `[[mock:hindi]]` / `[[mock:roman]]` | Urdu output in the wrong script |
| `[[mock:evil]]` | Unsafe output, to see it stripped |
| `[[mock:badjson]]` | Broken JSON for suggestions |

### Costs and limits

- **Cost guard.** Each admin can make at most **30 AI model calls per minute** by default; change this with `AI_RATE_LIMIT_PER_MINUTE`. Each action uses a few calls:
  - a draft is 2 calls (article + title/excerpt/tags)
  - a translation is 1 call for the fields plus 1 per section of the body (roughly every 6,000 characters)
  - a suggestion or a selected-text edit is 1 call
- **Limitation:** the counter is kept in memory. That's fine for one admin on one server. On Vercel, each warm serverless instance keeps its own counter and cold starts reset it, so the real ceiling can be higher. Move it to Postgres or Redis before reader-facing AI (Phase 6).
- **Per call:** every call has a timeout (20–120 s depending on the task), an output-token cap (16 to 8,192 tokens), and low "thinking" to keep cost and latency down.
- **Google's own limits:** Gemini's free tier has per-minute and per-day limits. When they're hit, the editor shows a friendly "quota" or "too many requests" message with **Retry**, and your article is never changed. Pricing and limits are on Google's [pricing page](https://ai.google.dev/gemini-api/docs/pricing). Set a budget alert in Google Cloud if you enable billing.
- **Privacy in logs.** Server logs record only the task name, outcome, duration and a running count, e.g. `[ai] draft-body ok 662ms (count 1)`. Prompts and article text are never logged.

---

## Admin guide

Sign in at `/login` with the admin account and open `/admin`.

### Dashboard

The dashboard has cards for total, published, and draft articles and for categories. Below them are your five most recently edited articles and a **New article** button. On a phone, the sidebar becomes a menu behind the ☰ button. Items marked *Coming soon* (Comments, Subscribers, Ads, Analytics, Settings) arrive in later phases.

The **AI status** card shows **Not configured** (with the reason), **Mock mode**, or **Gemini (model)**. **Test connection** sends one tiny request.

### Writing an article

1. Click **New article**. The editor has two tabs: **English** and **اردو**. You can write either language, or both. The dot on each tab shows its state: empty (outline), incomplete (gold), or complete (green, meaning it has a title and body).
2. In each tab, add a **title**, an optional **excerpt** (shown on cards and share previews), and the **body**. The Urdu tab is fully right-to-left and uses the Nastaliq font. Lists, quotes, and cursor movement all run right to left.
3. The toolbar has: H2/H3 headings; bold, italic, underline, strikethrough; bulleted and numbered lists; quote; divider; link; image; YouTube; X post; undo/redo. Word count and reading time appear under each editor.
   - **Links:** only `http://`, `https://`, and `mailto:` are allowed. Typing `example.com` becomes `https://example.com`.
   - **Images:** JPEG, PNG, WebP, or AVIF up to 5 MB. **Alt text is required.** A caption is optional.
   - **YouTube:** paste a `youtube.com` or `youtu.be` link. Readers get a privacy-friendly `youtube-nocookie.com` player.
   - **X/Twitter:** paste a post link (`x.com/<user>/status/<id>`). It is stored as a link and shown as a card.
4. In the side panel (under the editor on phones):
   - **Category:** required.
   - **URL slug:** filled in automatically from the English title (Urdu-only articles get `article-xxxxxxxx` unless you type one). It must be lowercase words joined by hyphens. You'll see live whether it's free. Once an article has been published, changing its slug asks for confirmation, because links people already shared would break.
   - **Tags:** pick existing tags or type a new one and press Enter.
   - **Featured on homepage**
   - **Cover image:** upload, replace, or remove. Alt text is required.
   - **Search & social (SEO):** optional SEO titles and descriptions per language, with character counters. If you leave them empty, the title and excerpt are used.
5. **Save draft** (or **Ctrl/Cmd + S**). The header shows *Saving…*, *Saved*, or *Unsaved changes*. If you try to close the tab or follow a link with unsaved changes, you'll be asked first.

Pasted content is cleaned on the server. Anything the toolbar can't produce, such as scripts, tables, code blocks, `javascript:` links, or external images, is removed. After saving you'll see a note listing what was removed.

### AI tools

When AI is configured (see [AI setup](#8-ai-setup-gemini)), these tools appear in the editor. Without it they show *Coming soon*. **AI never changes your article until you click to apply something**, and nothing is ever published automatically.

**Write with AI** (the **AI assist** button, top right):

1. Describe the article, e.g. *"Write an article about Pakistan's series win against England"*.
2. Optionally paste **key facts and notes**: figures, quotes, names, dates and sources. The AI is told to use only these and not to invent quotes, statistics, names or dates. Without notes, it keeps claims general.
3. Pick the **language** (English or اردو), **length** (short ~400 words, medium ~800, long ~1,200) and **tone** (news report, analysis, opinion, explainer). Then click **Generate draft**.
4. The draft streams into the panel's preview, not into your article. **Stop** cancels at any time.
5. When it's done, choose:
   - **Insert into editor**, only when that language's body is empty
   - **Replace current content…**, which asks for confirmation first
   - **Append below**

   The title and excerpt are filled in only if they're empty; otherwise they're offered with a *Use this … instead* button. Suggested tags are added only when you click them.
6. The insertion is **one undo step**: press **Ctrl+Z** in the editor to take it back.

An Urdu draft must come back in Urdu script. If the AI answers in Hindi (Devanagari) or Roman Urdu, you get an error with **Retry**.

**Translate** (**Translate to Urdu** on the English tab, **Translate to English** on the Urdu tab):

- **What's translated:** the title, excerpt, SEO title, SEO description and body, together. The aim is natural, journalistic language that keeps names accurate.
- **What's preserved:** headings, lists, quotes, bold and italic, and links (link addresses never change). Images, YouTube videos, X posts and dividers are not sent to the AI at all; they stay exactly where they were.
- **Long articles** are translated section by section, with a progress bar and **Stop**.
- **Existing content:** if the target language already has content, you're asked first (**Replace** or **Cancel**). Fields that are empty in the source language are left alone.
- **Result:** the translation appears in the target tab as **unsaved changes**. Review it, then save.

**Suggestions** (the small **✨ Suggest** links under fields):

- **Headlines:** 5 options under the title.
- **Excerpt:** written from the body, up to ~160 characters.
- **SEO title and description:** in the SEO section, within the 60/160-character counters.
- **Tags:** matched to your existing tags where possible. A new tag is only created if you click it and then save.
- **Slug:** a short slug from the **English** title. It still goes through the normal slug checks.

Suggestions use the language of the tab you're on (the slug always uses English). Nothing changes until you click a suggestion.

**Edit selected text.** Select text in either editor and a small **AI** menu appears:

- **Improve writing**
- **Fix grammar & spelling**
- **Make shorter**
- **Make longer**
- **More formal**
- **Simpler language**

The suggestion appears in a panel under the editor, in the same language as your selection. **Accept** replaces the selection as one undo step; **Discard** changes nothing.

#### AI review safeguard

Whenever AI-written or AI-translated content is inserted (including an applied headline, excerpt or SEO suggestion), this banner appears: **"Contains AI-generated content. Check names, facts, figures, dates and quotes before publishing."** The publish checklist also gets an extra item: **"I have reviewed the AI-generated content"**.

You must tick that box before the article can be published. This is stored with the article (`ai_review_pending`), so it:

- survives a page reload
- also blocks **Publish** in the article list
- stops a live article from being saved with unreviewed AI content

Inserting more AI content later clears the tick again.

**Errors** such as a rate limit, used-up quota, a safety block, a timeout or unusable output appear as a friendly message with **Retry**. A failed or stopped request never changes your article.

### Publishing

- **Publish** needs: a category, a slug, and **at least one complete language** (title + body). If there's a cover image, it also needs alt text, and if AI content was inserted, the AI review box must be ticked. The *Ready to publish?* checklist in the side panel shows what's missing, and a blocked publish opens the same checklist.
- After publishing, a **Published!** screen shows:
  - the public link for each completed language: `{NEXT_PUBLIC_SITE_URL}/en/{category}/{slug}` and `/ur/...`
  - **Copy link** buttons
  - one-tap sharing to WhatsApp, Facebook, X, LinkedIn, and Telegram
  - a preview of the share card
  - **View article**, **Edit again**, and **Write another**

  *Until Phase 4 builds the public article pages, these links show a 404.*
- **Unpublish** returns the article to Draft. **Archive** hides it but keeps it. You can move it back to drafts later.
- **Re-publishing** keeps the original publish date, unless you tick *Update the published date to now*.
- Editing a live article and saving updates it straight away. A live article must stay complete; to remove a language entirely, unpublish first.
- Every publish, unpublish, archive, delete, and live edit refreshes the cached homepage, category page, and article page (`src/server/revalidate.ts`).

### Preview

**Preview** (in the editor's side panel or the list's ⋯ menu) shows the article as readers will see it, with the site's typography, cover image, and embeds, in English or Urdu. Only admins can open it. It works for drafts too.

### Article list

`/admin/articles` lists articles 20 per page. You can filter by status and category, search titles in English or Urdu, and sort by last updated or published date. The ⋯ menu on each row has: Edit, Preview, Publish or Unpublish, Copy link (published only), Archive, and Delete. Delete asks for confirmation and suggests **Archive** as the safer choice, because deleting also removes the article's comments and stats permanently.

### Categories

`/admin/categories` lets you add or edit categories:

- English and Urdu names (both required)
- slug: automatic from the English name, must be unique; `en`, `ur`, `search`, `tags`, `about`, `admin`, `login` and `api` are reserved
- descriptions
- order: use the ↑/↓ buttons

A category with articles can't be deleted directly. The dialog shows how many articles it has and lets you move them all to another category, then delete it, in one step.

## Public site

Everything readers see lives under `/en` and `/ur`. Reading never needs an account.

### Pages and URLs

| URL | Page |
| --- | --- |
| `/en`, `/ur` | Homepage: hero (newest **featured** story, otherwise the newest), up to 4 top stories, a "Latest" feed with **Load more**, then one section per category in the admin's order. Newsletter and Trending show as "Coming soon". With nothing published it shows "Stories coming soon". |
| `/en/{section}` | Section (category) page: lead story, then a grid of 12 per page. Later pages: `?page=2`, `?page=3` … |
| `/en/{section}/{article}` | Article page |
| `/en/tags/{tag}` | Articles with that tag (same layout and paging as a section) |
| `/en/search?q=…` | Search (never indexed by search engines) |
| `/en/about` | About page. Its text is in the i18n dictionaries (`about.*` in `src/i18n/en.ts` / `ur.ts`). |

Swap `en` for `ur` for the Urdu site. `/` redirects to `/en`.

- **Reserved slugs.** A category can't use `search`, `tags`, `about`, `en`, `ur`, `admin`, `login` or `api`, because those paths are taken. The categories screen says so if you try.
- **Moved articles.** If an article's category changes, its old URL (`/en/old-section/slug`) redirects permanently (308) to the new one. Article slugs are unique across the whole site.
- **Not found.** Unknown sections, tags and articles, drafts, archived articles and out-of-range pages all return a real **404** with the site's 404 page.

### Articles in only one language

An article is *available* in a language when that language has a title **and** a body (the same rule as the publish checklist).

- Lists, search, tag pages and related articles only show articles available in the current language.
- Opening the other language's URL (e.g. `/ur/...` for an English-only story) shows "This article is only available in English" (in Urdu on the Urdu site) with a link to the available version. It returns a 404 status and is not indexed.
- On an article page, the language switcher goes to the other version if it exists, otherwise to the other language's homepage.

### Article page

Breadcrumb, section, headline, standfirst (excerpt), byline, date (plus "Updated …" when it was edited at least a day after publishing), reading time, cover image, the body, tags, share buttons, related articles (same section first, then shared tags, then latest), and a thin gold reading-progress bar.

- **Byline:** the admin account's name, or "Kabir Talks" when the account is still called "Admin".
- **Share buttons:** Copy link, WhatsApp, Facebook, X, LinkedIn, Telegram, and the phone's own share sheet where the browser supports it.
- **Coming soon** (later phases): Summarise, Ask this article, Listen (Phase 6), Save/bookmark and Comments (Phase 5). They show even when AI is configured.
- **Ad slots:** `<AdSlot placement="…" />` sits at `home-top`, `home-feed`, `article-top`, `article-inline` (after the 3rd paragraph) and `article-bottom`. It renders **nothing** until Phase 7 and leaves no gap.
- **Urdu:** Noto Nastaliq Urdu, right to left, larger text and line height around 2. English words and numbers inside Urdu text keep their own direction.

### Search

Searches published articles in the current language by title, excerpt and tag names (case-insensitive). Typing on an Arabic keyboard works too (ي and ك match ی and ک). Queries are trimmed to 100 characters on the server. It's a simple database search (`ILIKE`), fine for a small archive. For many thousands of articles, switch to Postgres full-text search.

### Sharing (link previews)

Every page has its own title and description, a canonical URL built from `NEXT_PUBLIC_SITE_URL`, Open Graph tags (`og:title`, `og:description`, `og:image` with width/height, `og:url`, `og:locale` `en_US`/`ur_PK`, and on articles `og:type=article`, published/modified time, section and tags) and a Twitter `summary_large_image` card.

- **SEO fields win.** The article's SEO title/description are used when filled in, otherwise its title and excerpt (or the start of the body).
- **hreflang** links (`en`, `ur`, `x-default`) appear only for language versions that exist.
- **Share images** are always 1200×630 PNGs:
  - `/og/article/{locale}/{slug}`: the article's cover photo (JPEG or PNG) cropped to fit, with a small Kabir Talks mark. Without a cover (or for WebP/AVIF covers, which the image generator can't read) it's a branded card: black background, gold "KT" mark, the wordmark, the section and the headline.
  - `/og/site/{locale}`: a branded card for the homepage, sections, tags, search and About.
  - They return 404 unless the article is published **and** available in that language, so a draft can never leak through a preview.
  - Each article's image URL carries `?v=…` from its last update, so WhatsApp, Facebook and X fetch a new image after an edit.
- **Urdu share images.** The image generator (`next/og`) can't lay out Noto Nastaliq Urdu (its text engine doesn't support the font's joining rules). So Urdu titles are shaped with **HarfBuzz** (`harfbuzzjs`, the same shaping engine browsers use), drawn as vector paths, and placed into the image. Latin words and numbers inside an Urdu title use Inter. Code: `src/server/og/shape-text.ts`. The fonts are in `assets/fonts/` (SIL Open Font License).

### How to test link previews

Locally you can check the tags and images directly:

1. `npm run build && npm start`, then open `http://localhost:3000/og/article/ur/{slug}` to see an article's share image.
2. View the page source of an article (or `curl -A "facebookexternalhit/1.1" http://localhost:3000/en/{section}/{slug}`) and check the `og:` and `twitter:` tags in `<head>`.

Real previews need a public URL. After deploying:

- **Facebook / WhatsApp:** paste the URL into the [Sharing Debugger](https://developers.facebook.com/tools/debug/) and press **Scrape Again** after edits. WhatsApp uses the same tags. It caches previews for a long time, so test new links, or links whose `?v=` image has changed.
- **X:** post the link in a draft (or a private account) and check the card. X has no public validator any more.
- **LinkedIn:** [Post Inspector](https://www.linkedin.com/post-inspector/).
- **Telegram:** send the link to yourself. If an old preview sticks, ask `@WebpageBot` to refresh it.

### Caching: why publishing shows up at once

Public pages are built from cached reads (`"use cache"` in `src/server/public/articles.ts`) tagged `articles`, `article:{id}`, `category:{slug}` and `categories`. Every admin save, publish, unpublish, archive, delete and category change expires those tags and paths (`src/server/revalidate.ts`), so the next visitor gets fresh pages without a redeploy.

- The homepage, section, tag, article and About pages are **fully static** (`ensureStatic = 'navigation'`). Known pages are built at deploy time, and new ones are built on their first visit. Because a page is only sent once it is complete, a draft or unknown URL can return a real 404 status instead of a 200 "soft 404". Only search renders per request.
- `?page=N` on section and tag pages is rewritten by `src/proxy.ts` to an internal static route (`/en/sports/p/2`), so paged lists stay static too. The public URL is always the `?page=` form. `?page=1` and direct `/p/N` visits redirect to it.
- The build reads the database (to prerender published articles), so `DATABASE_URL` must be reachable when Vercel builds.

---

## How things fit together

### Folder structure

```
src/
  app/
    [locale]/               public site root layout (<html lang dir>), homepage, about, search, localized 404
      [categorySlug]/       section page; p/[page]/ = later pages (?page=N rewrite target)
        [articleSlug]/      article page + not-found ("only available in …")
      tags/[tagSlug]/       tag page; p/[page]/ = later pages
    og/article, og/site     generated 1200×630 share images (route handlers)
    api/public/             articles (homepage "Load more"), article-locales/[slug] (languages of a published article)
    (internal)/             root layout for non-localised pages (route group: not part of the URL)
      admin/                protected admin: layout gate, dashboard, articles (list, new, [id], [id]/preview), categories
      login/                sign-in / sign-up
    api/auth/[...all]/      Better Auth handler
    api/admin/ai/           admin-only AI endpoint (POST, streams NDJSON; Stop cancels the request)
    global-not-found.tsx    404 for URLs that match nothing (e.g. /fr)
    global-error.tsx
    globals.css             design tokens (colours, fonts) — change them here only
  components/
    admin/                  admin shell nav, row actions, publish dialogs, category manager
      editor/               Tiptap editor, toolbar, extensions, slug/tag/cover fields, upload client
      ai/                   AI client (runAiTask, useAiTask), write panel, translate button, suggestions,
                            selected-text menu, status card, error/Stop notices
    articles/               article card (one component, three sizes), listing, load more, share bar,
                            reading progress, reader tools (coming soon), "only available in" notice
    content/article-body.tsx   renders a stored article body (admin preview + public article page)
    layout/                 header (sections from the database), footer, mobile menu, search, logo,
                            language switcher (+ locale-alternates.tsx for per-page overrides)
    ad-slot.tsx             <AdSlot /> placeholder (renders nothing until Phase 7)
    search-form.tsx, pagination.tsx, breadcrumb.tsx, not-found-message.tsx, coming-soon-strip.tsx
    ui/                     shadcn components
    coming-soon.tsx         <ComingSoon /> badge / panel
    skeleton-card.tsx, section-heading.tsx
  db/
    schema/                 auth, content, readers, ai, growth, relations, _shared
    index.ts                single shared postgres-js + Drizzle client
    seed.ts, seed-admin.ts, seed-demo.ts, load-env.ts
  i18n/                     config (locales, dir), en.ts, ur.ts dictionaries
  lib/
    ai/                     reusable AI layer (Phase 6 builds on it):
                              config.ts (provider/model from env), index.ts (generateText/streamText/generateJson:
                              timeout, abort, rate limit, errors, logging), gemini.ts (server-only), mock.ts,
                              prompts.ts (ALL prompt templates), markdown.ts (Markdown ⇄ Tiptap + placeholders),
                              script.ts (Urdu/English script check), tasks.ts (endpoint schemas), errors.ts
    content/                document.ts (Tiptap allow-list + sanitizer), render.ts (JSON → safe HTML), urls.ts (URL allow-lists)
    articles/               rules.ts (publish checklist), slug.ts, validation.ts (Zod payload schema)
    uploads/file-type.ts    image magic-byte detection
    cache-tags.ts, urls.ts  cache tag names; public URL + share-link builders
    seo.ts                  per-page metadata (canonical, hreflang, Open Graph, Twitter)
    articles/public.ts      public card type, page size, ?page parsing, "Updated" rule
    auth, auth-client, auth-guards, env, features, fonts, format (dates), utils
  server/                   all data access (server only)
    articles.ts, categories.ts           ADMIN reads (requireAdmin, include drafts)
    article-actions.ts, category-actions.ts, uploads.ts   server actions (requireAdmin + Zod)
    public/articles.ts      PUBLIC reads: published + available in the locale only, "use cache" + tags
    public/listing-pages.tsx   section/tag listing pages (shared by page 1 and later pages)
    og/                     share-image rendering; shape-text.ts = HarfBuzz shaping for Urdu
    revalidate.ts, storage.ts            cache invalidation; service-role Storage client
    ai/tasks.ts, ai/tags.ts AI task handlers (draft, translate, suggest, edit, ping); tag matching
  proxy.ts                  optimistic /admin redirect (no session cookie → /login); ?page= rewrite for listings
assets/fonts/               fonts for the share-image generator (OFL)
drizzle/                    SQL migrations + snapshots
scripts/                    setup-storage.ts, verify-content.ts
```

`admin/` and `login/` sit in the `(internal)` route group because they need their own root layout: English UI, no `[locale]` segment. The group name never shows up in URLs, so the paths are still `/admin` and `/login`.

### Authentication and access control

- Better Auth handles email/password and Google sign-in. Google only appears when both of its env vars are set.
- Reading the site **never** requires login.
- `user.role` is `admin` or `reader` and defaults to `reader`. It is declared `input: false`, so sign-up requests can't set it. (This was tested: a sign-up that sent `"role":"admin"` was stored as `reader`.)
- `src/lib/auth-guards.ts` provides `getSession()`, `requireUser()`, and `requireAdmin()`. `requireAdmin()` redirects logged-out visitors to `/login` and gives signed-in non-admins a **404**.
- `/admin` is protected in three layers:
  1. `src/proxy.ts` redirects requests that have no session cookie. This is an optimistic check only.
  2. `admin/layout.tsx` calls `requireAdmin()` before rendering anything.
  3. Every admin page calls `requireAdmin()` again.
  4. Every admin server action (`src/server/*-actions.ts`, `uploads.ts`) and admin read (`src/server/articles.ts`, `categories.ts`) calls `requireAdmin()` itself. Server actions can be POSTed to *any* page URL, so the proxy and layout don't protect them.
  5. The AI endpoint `POST /api/admin/ai` calls `requireAdmin()` first: logged-out → redirect to `/login`, readers → 404. Only then does it check that AI is configured, validate the input (Zod), and apply the rate limit.

  **Rule for later phases:** every admin server action and route handler must call `requireAdmin()` itself. Hiding a link is never enough.

### Article content and safety

- Bodies are stored as Tiptap JSON in `body_en` / `body_ur` (jsonb). `sanitizeDoc` (`src/lib/content/document.ts`) is the single allow-list of nodes and marks: paragraph, H2/H3, lists, quote, divider, image, YouTube, X post, hard break; bold, italic, underline, strike, link. It runs **on every save** and **again at render time**.
- `renderDocToHtml` (`src/lib/content/render.ts`) escapes all text and attributes, re-checks every link and image URL, and outputs YouTube only as a `youtube-nocookie.com` iframe. It never passes through raw HTML from the database. Phase 4 public pages use the same renderer through `<ArticleBody />`.
- Data access is split: `src/server/public/*` only ever returns `PUBLISHED` rows and is safe for public pages. Admin reads and all mutations are separate and guarded.
- **AI output is untrusted, exactly like pasted content.**
  - The model writes a restricted Markdown subset.
  - On the server, `markdownToDoc` strips raw HTML and script tags and drops images.
  - It then converts the result and runs the same `sanitizeDoc` allow-list, so `javascript:` links, unknown nodes, images and embeds can't come from the AI.
  - Existing images and embeds survive translation and edits as `[[KT_BLOCK_n]]` placeholders. They are restored only from the original document.
  - Urdu output is checked to be Urdu script.
  - Structured output (titles, tags and so on) is validated with Zod and trimmed to field limits.

### Next.js 16 Cache Components

This project keeps Next 16's defaults: `cacheComponents: true` and `partialPrefetching: true`. Reading cookies or headers (which includes any session check) has to happen **inside a `<Suspense>` boundary**, or the build fails. Public pages go further with `ensureStatic = 'navigation'` (see *Caching: why publishing shows up at once*). That rules out `cookies()`, `headers()` and `searchParams` on those pages, so Phase 5's reader features (bookmarks, comments) must load their per-reader parts in Client Components or behind `<Suspense>` in a way that keeps the page static. See `admin/layout.tsx` and `admin/page.tsx` for the pattern. Static UI can be prerendered or cached with `"use cache"`. The framework's own guides are in `node_modules/next/dist/docs/`.

### Locales and RTL

- Locales are configured in `src/i18n/config.ts` (`en` → `ltr`, `ur` → `rtl`). UI strings live in `src/i18n/en.ts` and `src/i18n/ur.ts`, typed so that Urdu must have every English key.
- Layouts use logical utilities only (`ms-*`, `me-*`, `ps-*`, `pe-*`, `start-*`, `end-*`), so they flip automatically in RTL.
- Urdu text uses Noto Nastaliq Urdu with `line-height: 2`. The brand wordmark stays in Latin type.
- The language switcher swaps only the locale segment, so `/en/sports` becomes `/ur/sports`. A page can override that (`SetLocaleAlternates`), which the article page uses when the other language doesn't exist.
- Every visible string on public pages comes from the dictionaries, including the YouTube/X embed labels the renderer adds. Dates use `Intl` (`en-GB`; `ur-PK` for Urdu month names) with Western digits.
- Urdu line heights are set in an unlayered block at the end of `globals.css`, because Tailwind's `text-*` sizes would otherwise squash Nastaliq.

### Design tokens

All colours and fonts are CSS variables in `src/app/globals.css`, exposed as Tailwind tokens: `bg-black`, `bg-obsidian`, `bg-obsidian-raised`, `text-gold`, `hover:text-gold-soft`, `text-ivory`, `text-grey`, `font-serif` (Playfair Display), `font-sans` (Inter), and `font-urdu`. shadcn's semantic tokens (`primary`, `muted`, and so on) map onto the same palette. Fonts are loaded once in `src/lib/fonts.ts`.

### Database schema overview

| Area | Tables |
| --- | --- |
| Auth | `user` (+ `role`), `session`, `account`, `verification` |
| Content | `categories`, `articles`, `tags`, `article_tags` |
| Readers | `bookmarks`, `comments` (threaded via `parent_id`, moderated via `status`) |
| AI | `ai_summaries` (unique per article + locale = generate once, cache) |
| Growth | `newsletter_subscribers`, `ad_slots`, `article_views` (daily counter) |

Integrity rules:

- Deleting a category that still has articles is **blocked** (`ON DELETE RESTRICT`). Reassign the articles first.
- Deleting a user who authored articles is blocked too.
- Deleting an article cascades to its tags, bookmarks, comments, summaries, and views.
- Every article must have at least one title (`title_en` or `title_ur`).
- A `PUBLISHED` article must have `published_at`.
- Indexes: `articles(status, published_at desc)`, `articles(category_id)`, `comments(article_id, status)`, and others.

---

## Roadmap

1. **Foundation** (done): setup, schema, auth, design system, layout shell
2. **Admin core** (done): Tiptap editor, articles, categories, image uploads (Supabase Storage), publish + share screen, preview
3. **Admin AI** (done): prompt-to-draft, English ⇄ Urdu translation, headline/excerpt/SEO/tag/slug suggestions, selected-text edits, AI review safeguard (Gemini, with a mock mode for development). Gated by `features.aiEnabled`
4. **Public site** (done): homepage, section, article, tag, search and About pages; one-language articles; share buttons and link-preview metadata with generated share images (incl. Urdu); static pages that update as soon as you publish
5. **Reader accounts:** profiles, bookmarks, comments with moderation
6. **Reader AI:** summaries (cached in `ai_summaries`), "ask this article" chat, text-to-speech
7. **Growth and launch:** newsletter (gated by `features.newsletterEnabled`), ads (`ad_slots`), SEO, analytics (`article_views`), Vercel deployment with a custom domain

---

## Troubleshooting

- **`npm run build` fails with `Cannot read properties of null (reading 'useContext')` on Windows.** The terminal's current path has the wrong letter-casing, e.g. `cd C:\Users\me\documents\...` when the folder is really `Documents`. Turbopack then sees two copies of React. `cd` again using the exact casing shown in File Explorer.
- **`Invalid environment variables` at startup.** The message lists each missing or malformed variable. Compare `.env.local` with `.env.example`.
- **`DIRECT_URL is not set`** when running `db:migrate`. Add the direct (port 5432) connection string to `.env.local`.
- **`prepared statement … does not exist`.** `DATABASE_URL` points at the transaction pooler but something created a client without `prepare: false`. Always import `db` from `@/db`.
- **Image buttons say "Storage not configured".** `NEXT_PUBLIC_SUPABASE_URL` and/or `SUPABASE_SERVICE_ROLE_KEY` are missing. See step 6.
- **"Couldn't start the upload. Check that the article-images bucket exists."** Run `npm run storage:setup`.
- **Uploaded images don't display (`next/image` error about an unconfigured host).** Restart the dev server or rebuild after setting `NEXT_PUBLIC_SUPABASE_URL`, because `next.config.ts` reads it at startup.
- **Saving says "Unsupported content was removed".** Pasted content contained something the editor doesn't support (see *Article content and safety*). Check the article, then save again.
- **AI buttons say "Coming soon".** No usable AI provider: set `GEMINI_API_KEY`, or `AI_PROVIDER=mock` in development, then restart. The dashboard's AI status card shows the exact reason. `AI_PROVIDER=mock` never works in a production build.
- **"The AI provider rejected the configuration".** The key is wrong or revoked, or `GEMINI_MODEL` names a model that doesn't exist or isn't available to your key. Use **Test connection** on the dashboard after fixing it.
- **"The AI quota for this API key is used up" / "Too many AI requests".** Google's limits or this app's per-admin limit (`AI_RATE_LIMIT_PER_MINUTE`, default 30/min) were hit. Wait and press **Retry**; your article is unchanged.
- **"The AI didn't answer in Urdu script".** The model replied in Hindi or Roman Urdu. Press **Retry**; nothing was inserted.
- **A story doesn't appear on the public site.** It must be **Published**, and it only shows on the language it has a title *and* body for. Archived and draft stories never appear.
- **WhatsApp/Facebook still show an old preview.** They cache previews per URL. Use Facebook's Sharing Debugger → *Scrape Again* (see *How to test link previews*).
- **`next build` fails reading the database.** The build prerenders published articles, so `DATABASE_URL` must work at build time (on Vercel: set it for the build environment too).
- **Local testing with PGlite: `unnamed prepared statement does not exist`.** PGlite is a single Postgres backend and can't run queries from several connections at once. Set `DATABASE_POOL_MAX=1` for the dev server. Real Postgres/Supabase doesn't need this.
- **Local testing with PGlite: `next build` fails with `bind message supplies N parameters`.** The build renders pages in parallel workers, and PGlite (one backend) mixes up their queries. Build against PGlite with one worker (temporarily add `cpus: 1` under `experimental` in `next.config.ts` and don't commit it). Real Postgres/Supabase doesn't need this.
