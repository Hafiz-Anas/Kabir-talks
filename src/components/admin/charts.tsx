import { formatDate } from "@/lib/format";

/**
 * Two small single-series charts for the admin dashboard, rendered on the
 * server as SVG (no chart library). One hue (the brand gold), thin marks,
 * a recessive baseline, a hover tooltip per mark (<title>) and a table view
 * for screen readers and exact numbers.
 */

type Point = { date: string; value: number };

const W = 600;
const H = 160;
const PAD = { top: 12, bottom: 22, left: 4, right: 4 };

const shortDate = (date: string) => formatDate(`${date}T12:00:00Z`).replace(/ \d{4}$/, "");

function niceMax(max: number) {
  if (max <= 4) return 4;
  const step = 10 ** Math.floor(Math.log10(max));
  return Math.ceil(max / step) * step;
}

function TableView({ caption, unit, points }: { caption: string; unit: string; points: Point[] }) {
  return (
    <details className="text-sm">
      <summary className="cursor-pointer text-grey hover:text-ivory">Show as a table</summary>
      <div className="mt-2 max-h-60 overflow-y-auto rounded-sm border border-border">
        <table className="w-full text-start">
          <caption className="sr-only">{caption}</caption>
          <thead className="bg-obsidian text-grey">
            <tr>
              <th scope="col" className="px-3 py-1.5 text-start font-normal">Day</th>
              <th scope="col" className="px-3 py-1.5 text-end font-normal">{unit}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {points.map((p) => (
              <tr key={p.date}>
                <td className="px-3 py-1 text-grey">{formatDate(`${p.date}T12:00:00Z`)}</td>
                <td className="px-3 py-1 text-end text-ivory tabular-nums">{p.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

function Frame({ max, points, children }: { max: number; points: Point[]; children: React.ReactNode }) {
  return (
    <>
      <line x1={PAD.left} x2={W - PAD.right} y1={H - PAD.bottom} y2={H - PAD.bottom} stroke="var(--border)" strokeWidth={1} />
      <text x={PAD.left} y={PAD.top - 2} fill="var(--kt-grey)" fontSize={11}>
        {max}
      </text>
      {children}
      {points.length > 0 && (
        <>
          <text x={PAD.left} y={H - 6} fill="var(--kt-grey)" fontSize={11}>
            {shortDate(points[0].date)}
          </text>
          <text x={W - PAD.right} y={H - 6} fill="var(--kt-grey)" fontSize={11} textAnchor="end">
            {shortDate(points.at(-1)!.date)}
          </text>
        </>
      )}
    </>
  );
}

export function DailyBarChart({ title, unit, points }: { title: string; unit: string; points: Point[] }) {
  const max = niceMax(Math.max(0, ...points.map((p) => p.value)));
  const plotH = H - PAD.top - PAD.bottom;
  const slot = (W - PAD.left - PAD.right) / Math.max(points.length, 1);
  const bar = Math.max(2, slot - 2); // 2px gap between bars
  return (
    <figure className="space-y-2">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${title}, last ${points.length} days`} className="h-auto w-full">
        <Frame max={max} points={points}>
          {points.map((p, i) => {
            const h = max ? (p.value / max) * plotH : 0;
            const x = PAD.left + i * slot + (slot - bar) / 2;
            return (
              <g key={p.date}>
                {/* Hit area taller than the bar, so short bars are easy to hover. */}
                <rect x={PAD.left + i * slot} y={PAD.top} width={slot} height={plotH} fill="transparent">
                  <title>{`${formatDate(`${p.date}T12:00:00Z`)}: ${p.value} ${unit.toLowerCase()}`}</title>
                </rect>
                {h > 0 && (
                  <path
                    d={`M${x},${H - PAD.bottom} v${-(h - Math.min(2, h))} q0,-2 2,-2 h${bar - 4} q2,0 2,2 v${h - Math.min(2, h)} z`}
                    fill="var(--kt-gold)"
                    pointerEvents="none"
                  />
                )}
              </g>
            );
          })}
        </Frame>
      </svg>
      <TableView caption={title} unit={unit} points={points} />
    </figure>
  );
}

export function DailyLineChart({ title, unit, points }: { title: string; unit: string; points: Point[] }) {
  const max = niceMax(Math.max(0, ...points.map((p) => p.value)));
  const plotH = H - PAD.top - PAD.bottom;
  const step = (W - PAD.left - PAD.right) / Math.max(points.length - 1, 1);
  const y = (v: number) => H - PAD.bottom - (max ? (v / max) * plotH : 0);
  const path = points.map((p, i) => `${i ? "L" : "M"}${PAD.left + i * step},${y(p.value)}`).join(" ");
  return (
    <figure className="space-y-2">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${title}, last ${points.length} days`} className="h-auto w-full">
        <Frame max={max} points={points}>
          <path d={path} fill="none" stroke="var(--kt-gold)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          {points.map((p, i) => (
            <rect key={p.date} x={PAD.left + i * step - step / 2} y={PAD.top} width={step} height={plotH} fill="transparent">
              <title>{`${formatDate(`${p.date}T12:00:00Z`)}: ${p.value} ${unit.toLowerCase()}`}</title>
            </rect>
          ))}
        </Frame>
      </svg>
      <TableView caption={title} unit={unit} points={points} />
    </figure>
  );
}
