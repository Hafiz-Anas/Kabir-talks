import { type JsonLd, serializeJsonLd } from "@/lib/structured-data";

/** Structured data for search engines. Safe: serializeJsonLd escapes "<", and the data is our own. */
export function JsonLdScript({ nodes }: { nodes: JsonLd[] }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(nodes) }} />;
}
