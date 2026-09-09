import type { AccessibilityReport } from '@a11yfix/core';

export interface ScoreOverviewProps {
  readonly report: AccessibilityReport;
}

export function ScoreOverview({ report }: ScoreOverviewProps) {
  const { score, grade, breakdown, ruleCounts, meta } = report;
  const { countsBySeverity } = breakdown;

  const scoreColor =
    score >= 90
      ? '#16a34a'
      : score >= 75
        ? '#ca8a04'
        : score >= 50
          ? '#ea580c'
          : '#dc2626';

  return (
    <section
      aria-labelledby="overview-heading"
      style={{ marginBottom: '1.5rem' }}
    >
      <h2 id="overview-heading" className="sr-only">
        Audit Overview and Score
      </h2>

      <div className="overview-grid">
        <div className="score-badge-card">
          <div className="score-number" style={{ color: scoreColor }}>
            {score}
          </div>
          <div className="score-grade" style={{ color: scoreColor }}>
            Grade {grade}
          </div>
          <div
            style={{
              fontSize: '0.8rem',
              color: 'var(--text-muted)',
              marginTop: '0.25rem',
            }}
          >
            {ruleCounts.violations} violations · {ruleCounts.passes} passed
          </div>
        </div>

        <div className="metric-card critical">
          <div className="metric-num">{countsBySeverity.critical}</div>
          <div className="metric-label">Critical</div>
        </div>

        <div className="metric-card serious">
          <div className="metric-num">{countsBySeverity.serious}</div>
          <div className="metric-label">Serious</div>
        </div>

        <div className="metric-card moderate">
          <div className="metric-num">{countsBySeverity.moderate}</div>
          <div className="metric-label">Moderate</div>
        </div>

        <div className="metric-card minor">
          <div className="metric-num">{countsBySeverity.minor}</div>
          <div className="metric-label">Minor</div>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.5rem',
          fontSize: '0.85rem',
          color: 'var(--text-muted)',
          padding: '0 0.25rem',
        }}
      >
        <span>
          Target: <strong>{meta.requestedUrl ?? 'Direct Scan'}</strong>
        </span>
        {meta.scannedAt && (
          <span>
            Scanned At:{' '}
            <strong>{new Date(meta.scannedAt).toLocaleTimeString()}</strong>
          </span>
        )}
      </div>
    </section>
  );
}
