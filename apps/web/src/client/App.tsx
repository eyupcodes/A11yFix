import type { AccessibilityReport } from '@a11yfix/core';
import { useMemo, useState } from 'react';

import { ExportActions } from './components/ExportActions.js';
import { FilterBar } from './components/FilterBar.js';
import { FindingCard } from './components/FindingCard.js';
import { Header } from './components/Header.js';
import { ScanForm } from './components/ScanForm.js';
import { ScoreOverview } from './components/ScoreOverview.js';

export function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [report, setReport] = useState<AccessibilityReport | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [severityFilter, setSeverityFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [liveStatus, setLiveStatus] = useState('Ready.');

  const toggleTheme = () => {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    if (next === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  };

  const handleScan = async (url: string, timeout?: number) => {
    setIsScanning(true);
    setErrorMessage(null);
    setLiveStatus(`Scanning ${url}…`);

    try {
      const res = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, timeout }),
      });

      const data = (await res.json()) as
        AccessibilityReport | { error?: string };

      if (!res.ok) {
        const errorText =
          'error' in data && typeof data.error === 'string'
            ? data.error
            : `Scan failed with status ${res.status}`;
        throw new Error(errorText);
      }

      const scannedReport = data as AccessibilityReport;
      setReport(scannedReport);
      setLiveStatus(
        `Audit complete. Score: ${scannedReport.score}, Grade: ${scannedReport.grade}. Found ${scannedReport.findings.length} issues.`,
      );
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Scanning failed unexpectedly.';
      setErrorMessage(msg);
      setLiveStatus(`Error: ${msg}`);
    } finally {
      setIsScanning(false);
    }
  };

  const filteredFindings = useMemo(() => {
    if (!report) return [];

    return report.findings.filter((f) => {
      if (severityFilter !== 'all' && f.severity !== severityFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesRule = f.ruleId.toLowerCase().includes(q);
        const matchesDesc = f.description.toLowerCase().includes(q);
        const matchesRemediation = f.remediation.summary
          .toLowerCase()
          .includes(q);
        const matchesWcag = f.wcag.criteria.some((c) =>
          c.toLowerCase().includes(q),
        );
        if (
          !matchesRule &&
          !matchesDesc &&
          !matchesRemediation &&
          !matchesWcag
        ) {
          return false;
        }
      }
      return true;
    });
  }, [report, severityFilter, searchQuery]);

  return (
    <>
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      <Header theme={theme} onToggleTheme={toggleTheme} />

      <main id="main-content" className="container" role="main">
        {/* Screen-reader live region */}
        <div
          className="sr-only"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          {liveStatus}
        </div>

        <ScanForm
          onScan={(url, timeout) => {
            void handleScan(url, timeout);
          }}
          isScanning={isScanning}
        />

        {errorMessage && (
          <div className="banner banner-error" role="alert">
            <strong>Scan Error:</strong> {errorMessage}
          </div>
        )}

        {report && (
          <>
            <ScoreOverview report={report} />
            <ExportActions report={report} />

            <h3 style={{ margin: '1.5rem 0 1rem 0', fontSize: '1.2rem' }}>
              Accessibility Findings
            </h3>

            <FilterBar
              severity={severityFilter}
              onSelectSeverity={setSeverityFilter}
              query={searchQuery}
              onQueryChange={setSearchQuery}
              totalCount={report.findings.length}
              filteredCount={filteredFindings.length}
            />

            {filteredFindings.length === 0 ? (
              <div
                className="card"
                style={{
                  textAlign: 'center',
                  padding: '3rem 1rem',
                  color: 'var(--text-muted)',
                }}
              >
                {report.findings.length === 0 ? (
                  <p
                    style={{
                      margin: 0,
                      fontSize: '1.1rem',
                      color: '#16a34a',
                      fontWeight: 600,
                    }}
                  >
                    🎉 No accessibility violations detected on this page!
                  </p>
                ) : (
                  <p style={{ margin: 0 }}>
                    No findings match the current filter criteria.
                  </p>
                )}
              </div>
            ) : (
              <div role="feed" aria-label="Accessibility violations list">
                {filteredFindings.map((finding) => (
                  <FindingCard key={finding.ruleId} finding={finding} />
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </>
  );
}
