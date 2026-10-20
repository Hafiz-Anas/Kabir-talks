import { Inter, Noto_Nastaliq_Urdu, Playfair_Display } from "next/font/google";

import { cn } from "@/lib/utils";

/** English body text. */
export const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

/** English headings. */
export const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  display: "swap",
});

/**
 * Urdu (all text). Large file, so it is not preloaded on every page; the
 * browser fetches the Arabic-script subset only when Urdu glyphs render.
 */
export const nastaliq = Noto_Nastaliq_Urdu({
  subsets: ["arabic"],
  variable: "--font-nastaliq",
  display: "swap",
  preload: false,
});

export const fontVariables = cn(inter.variable, playfair.variable, nastaliq.variable);
