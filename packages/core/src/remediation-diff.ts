/**
 * Generates a unified diff between original and modified code snippets.
 *
 * @param original - The original source code or HTML snippet.
 * @param modified - The proposed fixed code snippet.
 * @param filename - Optional pseudo-filename for the diff header.
 * @returns Standard unified diff string.
 */
export function generateUnifiedDiff(
  original: string,
  modified: string,
  filename = 'element',
): string {
  if (original === modified) {
    return '';
  }

  const originalLines = original.split('\n');
  const modifiedLines = modified.split('\n');

  // Find common leading lines
  let start = 0;
  while (
    start < originalLines.length &&
    start < modifiedLines.length &&
    originalLines[start] === modifiedLines[start]
  ) {
    start++;
  }

  // Find common trailing lines
  let endOriginal = originalLines.length - 1;
  let endModified = modifiedLines.length - 1;
  while (
    endOriginal >= start &&
    endModified >= start &&
    originalLines[endOriginal] === modifiedLines[endModified]
  ) {
    endOriginal--;
    endModified--;
  }

  const diffLines: string[] = [
    `--- a/${filename}`,
    `+++ b/${filename}`,
    `@@ -1,${originalLines.length} +1,${modifiedLines.length} @@`,
  ];

  // Context lines before change
  for (let i = 0; i < start; i++) {
    diffLines.push(` ${originalLines[i]}`);
  }

  // Removed lines
  for (let i = start; i <= endOriginal; i++) {
    diffLines.push(`-${originalLines[i]}`);
  }

  // Added lines
  for (let i = start; i <= endModified; i++) {
    diffLines.push(`+${modifiedLines[i]}`);
  }

  // Context lines after change
  for (let i = endOriginal + 1; i < originalLines.length; i++) {
    diffLines.push(` ${originalLines[i]}`);
  }

  return diffLines.join('\n');
}
