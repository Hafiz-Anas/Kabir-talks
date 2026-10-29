import Link from "next/link";

import { SocialLinksRow, type SocialLabels } from "@/components/social/social-icons";
import { fill, type Locale } from "@/i18n";
import { authorPath, type PublicAuthor } from "@/lib/authors";

import { AuthorPhoto } from "./author-photo";

export type AuthorBoxLabels = { aboutAuthor: string; moreFrom: string };

/** Phase 7C: "About the author" box at the end of an article. */
export function AuthorBox({
  author,
  locale,
  labels,
  socialLabels,
}: {
  author: PublicAuthor;
  locale: Locale;
  labels: AuthorBoxLabels;
  socialLabels: SocialLabels;
}) {
  const href = authorPath(locale, author.slug);
  const name = author.nameIsEnglish ? <bdi lang="en">{author.name}</bdi> : author.name;

  return (
    <section aria-labelledby="about-author" data-author-box className="flex gap-4 rounded-md border border-border bg-obsidian p-5 sm:gap-6 sm:p-6">
      <AuthorPhoto name={author.name} photoUrl={author.photoUrl} size={72} />
      <div className="min-w-0 space-y-2">
        <h2 id="about-author" className="text-xs font-medium tracking-[0.12em] text-gold uppercase">
          {labels.aboutAuthor}
        </h2>
        <p className="text-xl text-ivory">
          <Link href={href} className="hover:text-gold-soft focus-visible:underline focus-visible:outline-none">
            {name}
          </Link>
        </p>
        {author.title && <p className="text-sm text-grey">{author.title}</p>}
        {author.bio && <p className="text-ivory/90">{author.bio}</p>}
        <SocialLinksRow links={author.socialLinks} owner={author.name} labels={socialLabels} size="sm" className="pt-1" />
        <p className="pt-1 text-sm">
          <Link href={href} className="text-gold underline-offset-4 hover:text-gold-soft hover:underline">
            {fill(labels.moreFrom, { name: author.name })}
          </Link>
        </p>
      </div>
    </section>
  );
}
