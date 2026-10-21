# Fonts for generated share images

Used only by the share-image generator (`src/server/og/`), which runs on the
server and can't use `next/font`. The site itself loads its fonts with
`next/font` (`src/lib/fonts.ts`).

| File | Font | Source | Licence |
| --- | --- | --- | --- |
| `NotoNastaliqUrdu-Bold.ttf` | Noto Nastaliq Urdu Bold | github.com/notofonts/notofonts.github.io (hinted TTF) | SIL OFL 1.1 (`OFL.txt`) |
| `PlayfairDisplay-Bold.ttf` | Playfair Display 700, Latin subset | Fontsource (`@fontsource/playfair-display`) | SIL OFL 1.1 |
| `Inter-Medium.ttf` | Inter 500, Latin subset | Fontsource (`@fontsource/inter`) | SIL OFL 1.1 |

`OFL.txt` is the licence text shipped with Noto Nastaliq Urdu. Playfair Display
and Inter are released under the same licence (copyright their respective authors).
