import React, { useEffect, useState } from "react";

/**
 * Progress display for a running model call.
 *
 * The server answers a generation in one request, so there is no real progress to
 * report — only an estimate. The bar therefore walks towards a cap and completes
 * when the answer arrives.
 *
 * Measured on the live deployment (2026-10-08, build 91460db): generating ten
 * questions takes 128-158 s; the quality pass adds 120-180 s, but it runs only when a
 * hard finding is present, so the estimate describes the common case. A run that
 * repairs shows "still working" past the estimate.
 */
export const quizEstimateMs = (count: number): number => (160 + count * 6) * 1000;

/** Estimate for the performance analysis after a quiz (measured ~10-20 s, generous margin). */
export const ANALYSIS_ESTIMATE_MS = 45_000;

/**
 * Estimates for the other artifacts. Measured on the live deployment 2026-10-08
 * (real package, no token limit): 10 flashcards 27-30 s, study guide 61 s (9952
 * characters), topic synthesis 83 s (12499 characters). Each value runs above its
 * measurement, so a slow call shows "still working" instead of a passed deadline.
 */
export const FLASHCARDS_ESTIMATE_MS = 45_000;
export const STUDY_GUIDE_ESTIMATE_MS = 80_000;
export const TOPIC_ESTIMATE_MS = 100_000;

const format = (ms: number): string => {
  const total = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
};

interface LoadingOverlayProps {
  message: string;
  /** Expected duration in milliseconds; 0 shows the spinner without a bar. */
  estimateMs: number;
  /** "panel" draws the standalone tile used by the modal overlay, "plain" drops the chrome
   *  so the block sits inside an existing card or dialog. */
  variant?: "panel" | "plain";
}

export default function LoadingOverlay({ message, estimateMs: expected, variant = "panel" }: LoadingOverlayProps) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const started = Date.now();
    setElapsed(0);
    const timer = setInterval(() => setElapsed(Date.now() - started), 500);
    return () => clearInterval(timer);
  }, [message, expected]);

  const ratio = expected > 0 ? elapsed / expected : 0;
  // The bar never reaches the end on its own: only the answer completes it.
  const percent = Math.min(96, ratio * 100);
  const overdue = expected > 0 && elapsed > expected;

  return (
    <div
      className={
        variant === "panel"
          ? "bg-[var(--cds-layer-01)] border border-[var(--cds-border-subtle-01)] p-8 max-w-sm w-full flex flex-col items-center text-center"
          : "w-full flex flex-col items-center text-center"
      }
    >
      <div className="w-12 h-12 border-4 border-[var(--cds-border-subtle-01)] border-t-[#0f62fe] rounded-full animate-spin mb-4" />
      <h3 className="text-base font-semibold text-[var(--cds-text-primary)] mb-1">{message}</h3>
      <p className="text-xs text-[var(--cds-text-secondary)]">KI-Verarbeitung läuft...</p>

      {expected > 0 && (
        <div className="w-full mt-5 space-y-2">
          <div className="h-1.5 w-full bg-[var(--cds-layer-02)] border border-[var(--cds-border-subtle-01)] overflow-hidden">
            <div
              className="h-full bg-[#0f62fe] transition-[width] duration-500 ease-linear"
              style={{ width: `${percent}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] font-mono text-[var(--cds-text-helper)]">
            <span>verstrichen {format(elapsed)}</span>
            <span>geschätzt ≈ {format(expected)}</span>
          </div>

          <p className="text-[11px] text-[var(--cds-text-secondary)] leading-tight">
            {overdue
              ? "Das Modell rechnet noch — bei viel Material dauert es länger."
              : `${Math.round(percent)} % der geschätzten Zeit`}
          </p>
        </div>
      )}
    </div>
  );
}
