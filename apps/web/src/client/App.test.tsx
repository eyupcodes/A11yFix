import type { AccessibilityReport, Finding } from '@a11yfix/core';
import { renderToStaticMarkup, renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { App } from './App.js';
import { FilterBar } from './components/FilterBar.js';
import { FindingCard } from './components/FindingCard.js';
import { Header } from './components/Header.js';
import { ScanForm } from './components/ScanForm.js';
import { ScoreOverview } from './components/ScoreOverview.js';

const mockFinding: Finding = {
  ruleId: 'image-alt',
  description: 'Images must have alternate text',
  help: 'Images must have alternate text',
  severity: 'critical',
  wcag: {
    criteria: ['1.1.1'],
    level: 'A',
    version: '2.0',
    isBestPractice: false,
  },
  remediation: {
    summary: 'Add an alt attribute to the <img> element.',
    details: 'Fix any of the following: Element does not have an alt attribute',
    helpUrl: 'https://dequeuniversity.com/rules/axe/4.10/image-alt',
  },
  nodes: [
    {
      target: ['img#hero-banner'],
      html: '<img id="hero-banner" src="hero.png">',
      failureSummary:
        'Fix any of the following: Element does not have an alt attribute',
    },
  ],
  nodeCount: 1,
};

const mockReport: AccessibilityReport = {
  score: 82,
  grade: 'B',
  findings: [mockFinding],
  breakdown: {
    totalPenalty: 18,
    countsBySeverity: { critical: 1, serious: 0, moderate: 0, minor: 0 },
    scoredFindings: 1,
    bestPracticeFindings: 0,
  },
  ruleCounts: { violations: 1, passes: 12, incomplete: 0, inapplicable: 5 },
  meta: {
    requestedUrl: 'https://example.com',
    finalUrl: 'https://example.com',
    title: 'Example Domain',
    scannedAt: '2026-09-09T12:00:00.000Z',
  },
};

describe('Web Client Components', () => {
  describe('Header', () => {
    it('renders branding and theme toggle', () => {
      const html = renderToString(
        <Header theme="light" onToggleTheme={() => {}} />,
      );
      expect(html).toContain('A11yFix');
      expect(html).toContain('WCAG 2.1 AA');
      expect(html).toContain('Switch to dark theme');
      expect(html).toContain('🌙 Dark');
    });

    it('renders light toggle label when theme is dark', () => {
      const html = renderToString(
        <Header theme="dark" onToggleTheme={() => {}} />,
      );
      expect(html).toContain('Switch to light theme');
      expect(html).toContain('☀️ Light');
    });
  });

  describe('ScanForm', () => {
    it('renders form inputs and accessibility attributes', () => {
      const html = renderToString(
        <ScanForm onScan={() => {}} isScanning={false} />,
      );
      expect(html).toContain('Run Accessibility Audit');
      expect(html).toContain('target-url-input');
      expect(html).toContain('placeholder="https://example.com"');
      expect(html).toContain('Scan Page');
      expect(html).toContain('Example.com');
    });

    it('displays scanning state on submit button when busy', () => {
      const html = renderToString(
        <ScanForm onScan={() => {}} isScanning={true} />,
      );
      expect(html).toContain('Scanning…');
      expect(html).toContain('disabled=""');
    });
  });

  describe('ScoreOverview', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('renders score, grade, and severity breakdown', () => {
      const html = renderToString(<ScoreOverview report={mockReport} />);
      expect(html).toContain('82');
      expect(html).toContain('Grade');
      expect(html).toContain('B');
      expect(html).toContain('violations');
      expect(html).toContain('Critical');
      expect(html).toContain('Serious');
      expect(html).toContain('https://example.com');
    });

    it.each([
      [0, '#dc2626'],
      [49, '#dc2626'],
      [50, '#ea580c'],
      [74, '#ea580c'],
      [75, '#ca8a04'],
      [89, '#ca8a04'],
      [90, '#16a34a'],
      [100, '#16a34a'],
    ])(
      'uses %s score color %s for both the score and grade',
      (score, color) => {
        const html = renderToString(
          <ScoreOverview report={{ ...mockReport, score }} />,
        );
        expect(html).toContain(`class="score-number" style="color:${color}"`);
        expect(html).toContain(`class="score-grade" style="color:${color}"`);
      },
    );

    it('keeps each severity count associated with its label', () => {
      const countsBySeverity = {
        critical: 2,
        serious: 3,
        moderate: 5,
        minor: 7,
      };
      const html = renderToString(
        <ScoreOverview
          report={{
            ...mockReport,
            breakdown: { ...mockReport.breakdown, countsBySeverity },
          }}
        />,
      );

      for (const [severity, count] of Object.entries(countsBySeverity)) {
        const label = severity.charAt(0).toUpperCase() + severity.slice(1);
        expect(html).toContain(
          `<div class="metric-card ${severity}"><div class="metric-num">${count}</div><div class="metric-label">${label}</div>`,
        );
      }
    });

    it('renders zero counts and fallback metadata for a direct scan', () => {
      const html = renderToStaticMarkup(
        <ScoreOverview
          report={{
            ...mockReport,
            score: 100,
            grade: 'A',
            findings: [],
            breakdown: {
              totalPenalty: 0,
              countsBySeverity: {
                critical: 0,
                serious: 0,
                moderate: 0,
                minor: 0,
              },
              scoredFindings: 0,
              bestPracticeFindings: 0,
            },
            ruleCounts: {
              violations: 0,
              passes: 0,
              incomplete: 0,
              inapplicable: 0,
            },
            meta: {} as AccessibilityReport['meta'],
          }}
        />,
      );

      expect(html).toContain('0 violations · 0 passed');
      expect(html.match(/class="metric-num">0<\/div>/g)).toHaveLength(4);
      expect(html).toContain('Target: <strong>Direct Scan</strong>');
      expect(html).not.toContain('Scanned At:');
    });

    it('formats the scan timestamp without assuming the local timezone', () => {
      const formatTime = vi
        .spyOn(Date.prototype, 'toLocaleTimeString')
        .mockReturnValue('12:34:56');
      const html = renderToStaticMarkup(<ScoreOverview report={mockReport} />);

      expect(html).toContain('Target: <strong>https://example.com</strong>');
      expect(html).toContain('Scanned At: <strong>12:34:56</strong>');
      expect(formatTime).toHaveBeenCalledOnce();
      expect(
        (formatTime.mock.instances[0] as Date | undefined)?.toISOString(),
      ).toBe(mockReport.meta.scannedAt);
    });
  });

  describe('FilterBar', () => {
    it('renders severity chips and filter counts', () => {
      const html = renderToString(
        <FilterBar
          severity="all"
          onSelectSeverity={() => {}}
          query=""
          onQueryChange={() => {}}
          totalCount={5}
          filteredCount={3}
        />,
      );
      expect(html).toContain('All');
      expect(html).toContain('Critical');
      expect(html).toContain('Showing <strong>3</strong> of');
    });
  });

  describe('FindingCard', () => {
    it('renders rule details, remediation, and code blocks', () => {
      const html = renderToString(<FindingCard finding={mockFinding} />);
      expect(html).toContain('image-alt');
      expect(html).toContain('critical');
      expect(html).toContain('1.1.1');
      expect(html).toContain(
        'Add an alt attribute to the &lt;img&gt; element.',
      );
      expect(html).toContain('img#hero-banner');
      expect(html).toContain(
        '&lt;img id=&quot;hero-banner&quot; src=&quot;hero.png&quot;&gt;',
      );
      expect(html).toContain('WCAG');
    });
  });

  describe('App', () => {
    it('renders skip link and main layout in initial state', () => {
      const html = renderToString(<App />);
      expect(html).toContain('Skip to main content');
      expect(html).toContain('A11yFix');
      expect(html).toContain('Run Accessibility Audit');
    });
  });
});
