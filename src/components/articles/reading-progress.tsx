"use client";

import { useEffect, useRef } from "react";

/**
 * Thin gold bar at the very top that fills as the reader moves through the
 * article (element `targetId`). Updates a CSS transform directly — no React
 * re-render per scroll event. Grows from the start edge, so it runs
 * right-to-left on Urdu pages.
 */
export function ReadingProgress({ targetId, label }: { targetId: string; label: string }) {
  const bar = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const target = document.getElementById(targetId);
    if (!target || !bar.current) return;
    let frame = 0;

    const update = () => {
      frame = 0;
      const rect = target.getBoundingClientRect();
      const total = rect.height - window.innerHeight;
      const progress = total <= 0 ? (rect.top < 0 ? 1 : 0) : Math.min(1, Math.max(0, -rect.top / total));
      bar.current?.style.setProperty("--kt-progress", progress.toFixed(4));
      bar.current?.setAttribute("aria-valuenow", String(Math.round(progress * 100)));
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [targetId]);

  return (
    <div
      ref={bar}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={0}
      className="pointer-events-none fixed inset-x-0 top-0 z-50 h-0.5 origin-left scale-x-[var(--kt-progress,0)] bg-gold rtl:origin-right"
    />
  );
}
