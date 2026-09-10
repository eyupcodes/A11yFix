import { useState } from 'react';

import type {
  Finding,
  RemediationFramework,
  RemediationPatch,
} from '@a11yfix/core';
import { generateRemediationPatch } from '@a11yfix/core';

export interface FindingCardProps {
  readonly finding: Finding;
}

const FRAMEWORKS: readonly {
  readonly id: RemediationFramework;
  readonly label: string;
}[] = [
  { id: 'html', label: 'HTML' },
  { id: 'react', label: 'React' },
  { id: 'vue', label: 'Vue' },
  { id: 'svelte', label: 'Svelte' },
];

export function FindingCard({ finding }: FindingCardProps) {
  const { ruleId, description, severity, remediation, nodes, wcag } = finding;

  const [showFix, setShowFix] = useState(false);
  const [framework, setFramework] = useState<RemediationFramework>('html');
  const [showDiff, setShowDiff] = useState(false);
  const [patch, setPatch] = useState<RemediationPatch | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const severityClass = `badge badge-${severity}`;

  const handleToggleFix = async () => {
    const nextShow = !showFix;
    setShowFix(nextShow);
    if (nextShow && !patch) {
      setIsLoading(true);
      try {
        const p = await generateRemediationPatch(finding, 0, { framework });
        setPatch(p);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleFrameworkChange = async (fw: RemediationFramework) => {
    setFramework(fw);
    setIsLoading(true);
    try {
      const p = await generateRemediationPatch(finding, 0, { framework: fw });
      setPatch(p);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!patch) return;
    const textToCopy = showDiff ? patch.diff : patch.fixedCode;
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

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
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '0.5rem',
            }}
          >
            <div>
              <strong>Recommended Fix:</strong>
              <span>{remediation.summary}</span>
            </div>
            <button
              type="button"
              className="btn-chip"
              onClick={() => void handleToggleFix()}
              aria-expanded={showFix}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              ✨ {showFix ? 'Hide Fix' : 'Suggest Fix'}
            </button>
          </div>

          {remediation.details && (
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem' }}>
              {remediation.details}
            </p>
          )}

          {showFix && (
            <div
              style={{
                marginTop: '0.75rem',
                paddingTop: '0.75rem',
                borderTop: '1px solid var(--border)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '0.5rem',
                  marginBottom: '0.5rem',
                }}
              >
                <div
                  role="group"
                  aria-label="Framework selection"
                  style={{ display: 'flex', gap: '0.25rem' }}
                >
                  {FRAMEWORKS.map((fw) => (
                    <button
                      key={fw.id}
                      type="button"
                      className={`btn-chip ${framework === fw.id ? 'active' : ''}`}
                      onClick={() => void handleFrameworkChange(fw.id)}
                      style={{
                        background:
                          framework === fw.id
                            ? 'var(--primary)'
                            : 'transparent',
                        color:
                          framework === fw.id
                            ? 'var(--primary-text)'
                            : 'var(--link)',
                        borderColor:
                          framework === fw.id
                            ? 'var(--primary)'
                            : 'var(--border)',
                      }}
                    >
                      {fw.label}
                    </button>
                  ))}
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                  }}
                >
                  {patch && (
                    <span
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        padding: '0.15rem 0.4rem',
                        borderRadius: '4px',
                        background:
                          patch.confidence === 'high'
                            ? 'var(--sev-minor-bg)'
                            : 'var(--sev-moderate-bg)',
                        color:
                          patch.confidence === 'high'
                            ? 'var(--sev-minor-text)'
                            : 'var(--sev-moderate-text)',
                      }}
                    >
                      {patch.confidence.toUpperCase()} CONFIDENCE
                    </span>
                  )}
                  <button
                    type="button"
                    className="btn-chip"
                    onClick={() => setShowDiff(!showDiff)}
                    style={{ fontSize: '0.75rem' }}
                  >
                    {showDiff ? 'Show Code' : 'Show Diff'}
                  </button>
                  <button
                    type="button"
                    className="btn-chip"
                    onClick={() => void handleCopy()}
                    style={{ fontSize: '0.75rem', fontWeight: 600 }}
                  >
                    {copied ? '✓ Copied' : 'Copy'}
                  </button>
                </div>
              </div>

              {isLoading ? (
                <div
                  style={{
                    fontSize: '0.85rem',
                    color: 'var(--text-muted)',
                    padding: '0.5rem 0',
                  }}
                >
                  Generating fix…
                </div>
              ) : patch ? (
                <div>
                  <p
                    style={{
                      fontSize: '0.85rem',
                      color: 'var(--text-main)',
                      marginBottom: '0.4rem',
                    }}
                  >
                    {patch.explanation}
                  </p>
                  <pre
                    className="code-block"
                    style={{
                      margin: 0,
                      maxHeight: '240px',
                      overflowX: 'auto',
                    }}
                  >
                    {showDiff ? patch.diff : patch.fixedCode}
                  </pre>
                </div>
              ) : null}
            </div>
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
