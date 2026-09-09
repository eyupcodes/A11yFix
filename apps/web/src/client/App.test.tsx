import type { AccessibilityReport, Finding } from '@a11yfix/core';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

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
