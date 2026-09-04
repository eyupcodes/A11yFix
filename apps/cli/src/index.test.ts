import { describe, expect, it } from 'vitest';

import { FOUNDATION_STATUS, PACKAGE_NAME } from './index.js';

describe('@a11yfix/cli foundation', () => {
  it('exposes the package boundary', () => {
    expect(PACKAGE_NAME).toBe('@a11yfix/cli');
    expect(FOUNDATION_STATUS).toBe('m1-foundation');
  });
});
