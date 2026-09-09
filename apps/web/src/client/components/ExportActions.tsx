import type { AccessibilityReport } from '@a11yfix/core';
import { useState } from 'react';

export interface ExportActionsProps {
  readonly report: AccessibilityReport;
}

export function ExportActions({ report }: ExportActionsProps) {
  const [isExporting, setIsExporting] = useState(false);

  const handleDownload = async (format: 'html' | 'json') => {
    setIsExporting(true);
    try {
      const res = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ report, format }),
      });

      if (!res.ok) {
        throw new Error(`Export failed with HTTP ${res.status}`);
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const date = new Date().toISOString().slice(0, 10);
      a.download = `a11yfix-report-${date}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Export failed.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        gap: '0.75rem',
        alignItems: 'center',
        margin: '1rem 0 2rem 0',
        flexWrap: 'wrap',
      }}
      role="group"
      aria-label="Export audit reports"
    >
      <button
        type="button"
        className="btn-secondary"
        onClick={() => {
          void handleDownload('html');
        }}
        disabled={isExporting}
        aria-busy={isExporting}
      >
        📥 Export HTML Report
      </button>
      <button
        type="button"
        className="btn-secondary"
        onClick={() => {
          void handleDownload('json');
        }}
        disabled={isExporting}
        aria-busy={isExporting}
      >
        📥 Export JSON Report
      </button>
    </div>
  );
}
