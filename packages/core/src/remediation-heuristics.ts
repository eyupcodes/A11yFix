import { generateUnifiedDiff } from './remediation-diff.js';
import type {
  Finding,
  FindingNode,
  RemediationConfidence,
  RemediationFramework,
  RemediationPatch,
} from './types.js';

interface FixDraft {
  readonly fixedCode: string;
  readonly explanation: string;
  readonly changes: readonly string[];
  readonly confidence: RemediationConfidence;
}

/**
 * Normalizes JSX / framework-specific attributes for React, Vue, Svelte.
 */
function applyFrameworkFormatting(
  code: string,
  framework: RemediationFramework,
): string {
  if (framework === 'react') {
    let formatted = code.replace(/\bclass="/g, 'className="');
    formatted = formatted.replace(/\bfor="/g, 'htmlFor="');
    // Ensure void tags close with self-closing slash if not already closed
    formatted = formatted.replace(
      /<(img|input|hr|br)([^>]*?)(?<!\/)>/gi,
      '<$1$2 />',
    );
    return formatted;
  }
  return code;
}

function fixImageAlt(html: string, framework: RemediationFramework): FixDraft {
  const srcMatch = /src=["']([^"']+)["']/i.exec(html);
  const src = srcMatch ? srcMatch[1]!.toLowerCase() : '';

  let altValue = 'Image description';
  if (src.includes('logo')) {
    altValue = 'Company logo';
  } else if (
    src.includes('avatar') ||
    src.includes('profile') ||
    src.includes('user')
  ) {
    altValue = 'User profile picture';
  } else if (src.includes('icon')) {
    altValue = 'Icon';
  } else if (src.includes('banner') || src.includes('hero')) {
    altValue = 'Hero banner';
  }

  let fixedCode: string;
  if (/alt=/i.test(html)) {
    fixedCode = html.replace(/alt=["'][^"']*["']/i, `alt="${altValue}"`);
  } else if (/<img\b/i.test(html)) {
    fixedCode = html.replace(/<img\b/i, `<img alt="${altValue}"`);
  } else if (/<input\b[^>]*type=["']image["']/i.test(html)) {
    fixedCode = html.replace(/<input\b/i, `<input alt="Submit"`);
    altValue = 'Submit';
  } else {
    fixedCode = `${html.trimEnd()} alt="${altValue}">`;
  }

  return {
    fixedCode: applyFrameworkFormatting(fixedCode, framework),
    explanation:
      'Images must have an alt attribute describing their content or purpose, or alt="" if purely decorative.',
    changes: [`Added descriptive alt="${altValue}" attribute`],
    confidence: 'high',
  };
}

function fixButtonName(
  html: string,
  framework: RemediationFramework,
): FixDraft {
  let fixedCode: string;
  if (/<button\b/i.test(html)) {
    if (/aria-label=/i.test(html)) {
      fixedCode = html.replace(
        /aria-label=["'][^"']*["']/i,
        'aria-label="Action description"',
      );
    } else {
      fixedCode = html.replace(
        /<button\b/i,
        '<button aria-label="Action description"',
      );
    }
  } else {
    fixedCode = `<button aria-label="Action description">${html}</button>`;
  }

  return {
    fixedCode: applyFrameworkFormatting(fixedCode, framework),
    explanation:
      'Interactive buttons require an accessible name discernible to screen readers via visible text or aria-label.',
    changes: ['Added aria-label="Action description" for assistive technology'],
    confidence: 'high',
  };
}

function fixLinkName(html: string, framework: RemediationFramework): FixDraft {
  let fixedCode: string;
  if (/<a\b/i.test(html)) {
    if (/aria-label=/i.test(html)) {
      fixedCode = html.replace(
        /aria-label=["'][^"']*["']/i,
        'aria-label="Destination description"',
      );
    } else {
      fixedCode = html.replace(
        /<a\b/i,
        '<a aria-label="Destination description"',
      );
    }
  } else {
    fixedCode = `<a aria-label="Destination description">${html}</a>`;
  }

  return {
    fixedCode: applyFrameworkFormatting(fixedCode, framework),
    explanation:
      'Hyperlinks must have clear accessible names to communicate their destination to assistive technologies.',
    changes: [
      'Added aria-label="Destination description" to accessible link element',
    ],
    confidence: 'high',
  };
}

function fixColorContrast(
  html: string,
  framework: RemediationFramework,
): FixDraft {
  let fixedCode: string;
  if (/style=["'][^"']*color:[^"']*["']/i.test(html)) {
    fixedCode = html.replace(/color:\s*#[0-9a-fA-F]{3,6}/i, 'color: #1a1a1a');
  } else if (/style=["']/i.test(html)) {
    fixedCode = html.replace(/style=["']/i, 'style="color: #1a1a1a; ');
  } else {
    fixedCode = html.replace(
      /<([a-zA-Z0-9]+)\b/i,
      '<$1 style="color: #1a1a1a;"',
    );
  }

  return {
    fixedCode: applyFrameworkFormatting(fixedCode, framework),
    explanation:
      'Text content must maintain a minimum contrast ratio of 4.5:1 against its background (WCAG AA).',
    changes: ['Adjusted foreground text color to #1a1a1a for 4.5:1+ contrast'],
    confidence: 'medium',
  };
}

function fixHtmlHasLang(
  html: string,
  framework: RemediationFramework,
): FixDraft {
  let fixedCode: string;
  if (/<html\b/i.test(html)) {
    if (/lang=/i.test(html)) {
      fixedCode = html.replace(/lang=["'][^"']*["']/i, 'lang="en"');
    } else {
      fixedCode = html.replace(/<html\b/i, '<html lang="en"');
    }
  } else {
    fixedCode = '<html lang="en">\n' + html;
  }

  return {
    fixedCode: applyFrameworkFormatting(fixedCode, framework),
    explanation:
      'The <html> root element must possess a valid lang attribute so screen readers pronounce text correctly.',
    changes: ['Added lang="en" attribute to the <html> document element'],
    confidence: 'high',
  };
}

function fixDocumentTitle(
  html: string,
  framework: RemediationFramework,
): FixDraft {
  let fixedCode: string;
  if (/<title>.*<\/title>/i.test(html)) {
    fixedCode = html.replace(
      /<title>.*<\/title>/i,
      '<title>Descriptive Page Title</title>',
    );
  } else if (/<head\b[^>]*>/i.test(html)) {
    fixedCode = html.replace(
      /<head\b[^>]*>/i,
      '<head>\n  <title>Descriptive Page Title</title>',
    );
  } else {
    fixedCode = '<title>Descriptive Page Title</title>\n' + html;
  }

  return {
    fixedCode: applyFrameworkFormatting(fixedCode, framework),
    explanation:
      'Documents must contain a descriptive <title> in <head> to identify the page topic or purpose.',
    changes: ['Added <title>Descriptive Page Title</title> tag'],
    confidence: 'high',
  };
}

function fixLabel(html: string, framework: RemediationFramework): FixDraft {
  let fixedCode: string;
  const idMatch = /id=["']([^"']+)["']/i.exec(html);

  if (idMatch) {
    const id = idMatch[1]!;
    const forAttr = framework === 'react' ? 'htmlFor' : 'for';
    fixedCode = `<label ${forAttr}="${id}">Input Label</label>\n${html}`;
  } else if (/aria-label=/i.test(html)) {
    fixedCode = html.replace(
      /aria-label=["'][^"']*["']/i,
      'aria-label="Input label"',
    );
  } else {
    fixedCode = html.replace(/<input\b/i, '<input aria-label="Input label"');
  }

  return {
    fixedCode: applyFrameworkFormatting(fixedCode, framework),
    explanation:
      'Form inputs require associated programmatic labels for screen reader identification and keyboard focus.',
    changes: [
      idMatch
        ? `Added <label> explicitly associated with id="${idMatch[1]}"`
        : 'Added aria-label="Input label" to input element',
    ],
    confidence: 'high',
  };
}

function fixFrameTitle(
  html: string,
  framework: RemediationFramework,
): FixDraft {
  let fixedCode: string;
  if (/<iframe\b/i.test(html)) {
    if (/title=/i.test(html)) {
      fixedCode = html.replace(
        /title=["'][^"']*["']/i,
        'title="Embedded content description"',
      );
    } else {
      fixedCode = html.replace(
        /<iframe\b/i,
        '<iframe title="Embedded content description"',
      );
    }
  } else {
    fixedCode = html;
  }

  return {
    fixedCode: applyFrameworkFormatting(fixedCode, framework),
    explanation:
      'Inline frames (<iframe>) must have an accessible title attribute describing their embedded content.',
    changes: ['Added title="Embedded content description" attribute to iframe'],
    confidence: 'high',
  };
}

function fixTargetBlank(
  html: string,
  framework: RemediationFramework,
): FixDraft {
  let fixedCode = html;
  if (/target=["']_blank["']/i.test(html)) {
    if (/rel=/i.test(html)) {
      fixedCode = html.replace(
        /rel=["']([^"']*)["']/i,
        'rel="noopener noreferrer $1"',
      );
    } else {
      fixedCode = html.replace(
        /target=["']_blank["']/i,
        'target="_blank" rel="noopener noreferrer"',
      );
    }
  }

  return {
    fixedCode: applyFrameworkFormatting(fixedCode, framework),
    explanation:
      'Links opening in a new window/tab must declare rel="noopener noreferrer" for security and announce new window opening.',
    changes: ['Added rel="noopener noreferrer" attribute'],
    confidence: 'high',
  };
}

function fixAriaHiddenFocus(
  html: string,
  framework: RemediationFramework,
): FixDraft {
  let fixedCode = html.replace(/\s*aria-hidden=["']true["']/gi, '');
  if (fixedCode === html) {
    fixedCode = html.replace(/<([a-zA-Z0-9]+)\b/i, '<$1 tabindex="-1"');
  }

  return {
    fixedCode: applyFrameworkFormatting(fixedCode, framework),
    explanation:
      'Focusable elements should not be hidden from screen readers using aria-hidden="true".',
    changes: [
      'Removed aria-hidden="true" or ensured element is removed from tab order',
    ],
    confidence: 'medium',
  };
}

function fixDuplicateId(
  html: string,
  framework: RemediationFramework,
): FixDraft {
  const fixedCode = html.replace(/\bid=["']([^"']+)["']/i, 'id="$1-unique"');

  return {
    fixedCode: applyFrameworkFormatting(fixedCode, framework),
    explanation:
      'Element IDs must be unique on the page to prevent invalid DOM queries and broken label/aria associations.',
    changes: ['Appended unique suffix to duplicate element ID attribute'],
    confidence: 'medium',
  };
}

function fixGenericFallback(
  finding: Finding,
  node: FindingNode,
  framework: RemediationFramework,
): FixDraft {
  const summary =
    node.failureSummary ?? finding.remediation.summary ?? finding.description;

  const comment =
    framework === 'react'
      ? `{/* a11yfix [${finding.ruleId}]: ${summary} */}\n${node.html}`
      : `<!-- a11yfix [${finding.ruleId}]: ${summary} -->\n${node.html}`;

  return {
    fixedCode: applyFrameworkFormatting(comment, framework),
    explanation: `${finding.help}. ${finding.description}`,
    changes: [`Guidance: ${summary}`],
    confidence: 'low',
  };
}

/**
 * Generates a deterministic code patch for an accessibility finding node.
 *
 * @param finding - The parent accessibility finding.
 * @param node - The specific failing DOM node.
 * @param framework - The target frontend framework syntax.
 * @returns Complete RemediationPatch with unified diff and explanation.
 */
export function generateHeuristicFix(
  finding: Finding,
  node: FindingNode,
  framework: RemediationFramework = 'html',
): RemediationPatch {
  const originalHtml = node.html;
  let draft: FixDraft;

  switch (finding.ruleId) {
    case 'image-alt':
    case 'input-image-alt':
      draft = fixImageAlt(originalHtml, framework);
      break;
    case 'button-name':
      draft = fixButtonName(originalHtml, framework);
      break;
    case 'link-name':
      draft = fixLinkName(originalHtml, framework);
      break;
    case 'color-contrast':
      draft = fixColorContrast(originalHtml, framework);
      break;
    case 'html-has-lang':
      draft = fixHtmlHasLang(originalHtml, framework);
      break;
    case 'document-title':
      draft = fixDocumentTitle(originalHtml, framework);
      break;
    case 'label':
      draft = fixLabel(originalHtml, framework);
      break;
    case 'frame-title':
      draft = fixFrameTitle(originalHtml, framework);
      break;
    case 'target-blank':
      draft = fixTargetBlank(originalHtml, framework);
      break;
    case 'aria-hidden-focus':
      draft = fixAriaHiddenFocus(originalHtml, framework);
      break;
    case 'duplicate-id':
    case 'duplicate-id-active':
    case 'duplicate-id-aria':
      draft = fixDuplicateId(originalHtml, framework);
      break;
    default:
      draft = fixGenericFallback(finding, node, framework);
      break;
  }

  const diff = generateUnifiedDiff(originalHtml, draft.fixedCode);

  return {
    ruleId: finding.ruleId,
    target: node.target,
    originalHtml,
    fixedCode: draft.fixedCode,
    explanation: draft.explanation,
    framework,
    confidence: draft.confidence,
    changes: draft.changes,
    diff,
  };
}
