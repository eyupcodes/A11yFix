import type { Finding } from '@a11yfix/core';

export interface FindingCardProps {
  readonly finding: Finding;
}

export function FindingCard({ finding }: FindingCardProps) {
  const { ruleId, description, severity, remediation, nodes, wcag } = finding;

  const severityClass = `badge badge-${severity}`;

  return (
    <article className="finding-card" aria-labelledby={`rule-${ruleId}`}>
      <div className="finding-header">
        <div className="finding-title-group">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
              flexWrap: 'wrap',
            }}
          >
            <span id={`rule-${ruleId}`} className="finding-rule-id">
              {ruleId}
            </span>
            <span className={severityClass}>{severity}</span>
            {wcag.criteria.length > 0 && (
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                WCAG {wcag.criteria.join(', ')} ({wcag.level ?? 'A'})
              </span>
            )}
            {wcag.isBestPractice && (
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Best Practice
              </span>
            )}
          </div>
          <p className="finding-desc" style={{ margin: '0.25rem 0 0 0' }}>
            {description}
          </p>
        </div>

        {remediation.helpUrl && (
          <a
            href={remediation.helpUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: '0.85rem',
              color: 'var(--link)',
              textDecoration: 'none',
            }}
          >
            Docs ↗
          </a>
        )}
      </div>

      <div className="finding-body">
        <div className="remediation-box">
          <strong>Recommended Fix:</strong>
          <span>{remediation.summary}</span>
          {remediation.details && (
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem' }}>
              {remediation.details}
            </p>
          )}
        </div>

        {nodes.length > 0 && (
          <details className="nodes-details">
            <summary className="nodes-summary">
              Affected DOM Elements ({nodes.length})
            </summary>
            <div className="nodes-list">
              {nodes.map((node, idx) => (
                <div
                  key={`${node.target.join(',')}-${idx}`}
                  className="node-item"
                >
                  <div
                    style={{
                      fontWeight: 600,
                      fontSize: '0.8rem',
                      color: 'var(--text-muted)',
                    }}
                  >
                    Selector: {node.target.join(' > ') || '(root)'}
                  </div>
                  {node.html && <pre className="code-block">{node.html}</pre>}
                  {node.failureSummary && (
                    <div
                      style={{
                        fontSize: '0.8rem',
                        color: 'var(--sev-serious-text)',
                      }}
                    >
                      {node.failureSummary}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </details>
        )}
      </div>
    </article>
  );
}
