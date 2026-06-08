import { formatAmount } from "@/lib/format";
import { categoryColor } from "@/lib/categories";
import type { Insights } from "@/lib/insights";
import type { Dict } from "@/lib/i18n/dictionaries";

// Dashboard surfacing of the deterministic insights engine: month-end forecast,
// budget runway, category anomalies, and recurring charges. Server component;
// receives the precomputed insights and the active dictionary.
export default function InsightsCard({
  insights,
  t,
}: {
  insights: Insights;
  t: Dict;
}) {
  const { forecast, anomalies, recurring } = insights;
  const i = t.insights;
  const overBudget =
    forecast.budget != null && forecast.projectedMonth > forecast.budget;

  return (
    <div className="section">
      <div className="section-head">
        <h2>{i.title}</h2>
      </div>
      <div className="card space-y-3 p-4 text-sm">
        {/* Forecast + runway */}
        <div className="flex items-center justify-between">
          <span className="text-muted">{i.forecast}</span>
          <span className="mono font-semibold text-foreground">
            {formatAmount(forecast.projectedMonth)}
          </span>
        </div>
        {forecast.budget != null && (
          <div className="flex items-center justify-between">
            <span className="text-muted">{i.runway}</span>
            {overBudget ? (
              <span className="font-medium text-negative">{i.overBudget}</span>
            ) : (
              <span className="font-medium text-foreground">
                {forecast.runwayDays ?? "—"} {i.days}
              </span>
            )}
          </div>
        )}

        {anomalies.length > 0 && (
          <div className="border-t border-border pt-3">
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
              {i.anomalies}
            </div>
            <ul className="space-y-1.5">
              {anomalies.map((a) => (
                <li
                  key={a.category}
                  className="flex items-center justify-between gap-2"
                >
                  <span className="flex items-center gap-2 text-foreground">
                    <span
                      aria-hidden
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ background: categoryColor(a.category) }}
                    />
                    {a.category} · {a.ratio}× {i.vsTypical}
                  </span>
                  <span className="mono shrink-0 text-muted">
                    {formatAmount(a.thisWeek)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {recurring.length > 0 && (
          <div className="border-t border-border pt-3">
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
              {i.recurring}
            </div>
            <ul className="space-y-1.5">
              {recurring.map((r) => (
                <li
                  key={r.label}
                  className="flex items-center justify-between gap-2"
                >
                  <span className="flex items-center gap-2 text-foreground">
                    {r.label}
                    {r.dueSoon && (
                      <span className="rounded-full bg-[var(--accent-weak)] px-2 py-0.5 text-[11px] font-medium text-accent">
                        {i.dueSoon}
                      </span>
                    )}
                  </span>
                  <span className="mono shrink-0 text-muted">
                    {formatAmount(r.typicalAmount)} {i.perMonth}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
