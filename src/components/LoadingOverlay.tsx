import React, { useEffect, useState } from "react";

/**
 * Progress display for a running model call.
 *
 * The server answers a generation in one request, so there is no real progress to
 * report — only an estimate. The bar therefore walks towards a cap and completes
 * when the answer arrives.
 *
 * Measured on the live deployment (2026-10-08, CommandCode, DeepSeek V4.1 Flash, no
 * token limit): 10 questions 116 s, 25 questions 162 s; a small material with 2
 * questions answered in 10 s. The model's reasoning dominates and grows only slowly
 * with the number of questions, hence a base load plus a small share per question.
 * The estimate runs a little high on purpose: the display then reads "still working"
 * instead of promising an end that has already passed.
 */
export const quizEstimateMs = (count: number): number => (100 + count * 2.5) * 1000;

/** Estimate for the performance analysis after a quiz (measured ~10-20 s, generous margin). */
export const ANALYSIS_ESTIMATE_MS = 45_000;

const format = (ms: number): string => {
  const total = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
};

interface LoadingOverlayProps {
  message: string;
  /** Expected duration in milliseconds; 0 shows the spinner without a bar. */
  estimateMs: number;
}

export default function LoadingOverlay({ message, estimateMs: expected }: LoadingOverlayProps) {
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
    <div className="bg-[var(--cds-layer-01)] border border-[var(--cds-border-subtle-01)] p-8 max-w-sm w-full flex flex-col items-center text-center">
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
