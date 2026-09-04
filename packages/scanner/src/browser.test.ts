import { describe, expect, it } from 'vitest';

import { withChromiumPage } from './browser.js';

describe('withChromiumPage', () => {
  it('provides a usable page and closes the browser afterwards', async () => {
    const page = await withChromiumPage(async (created) => {
      await created.setContent('<!doctype html><title>ok</title><h1>ok</h1>');
      expect(await created.title()).toBe('ok');
      return created;
    });

    expect(page.isClosed()).toBe(true);
  }, 120_000);

  it('closes the browser when the callback throws', async () => {
    const failure = new Error('callback exploded');
    let leaked: { isClosed: () => boolean } | undefined;

    await expect(
      withChromiumPage(async (page) => {
        leaked = page;
        await Promise.resolve();
        throw failure;
      }),
    ).rejects.toBe(failure);

    expect(leaked?.isClosed()).toBe(true);
  }, 120_000);
});
