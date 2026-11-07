import {expect, test, type Page} from '@playwright/test';

/**
 * Every page in a real browser against the production build, with the API
 * answering from responses recorded off a real local chain (e2e/fixtures).
 * Fails on a page that throws, a route that 500s, or a console error — a
 * Content-Security-Policy that blocks the page's own requests shows up only
 * there.
 */

function watchConsole(page: Page) {
  const errors: string[] = [];
  page.on('console', (m) => {
    // Server-side metadata reads have no chain in e2e and fail by design; nothing else may.
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}

const PAGES: [string, RegExp][] = [
  ['/', /without trusting each other/],
  ['/agents', /Marketplace|agents/i],
  ['/activity', /Activity/],
  ['/status', /Is Fidora working\?/],
  ['/fees', /Fees and limits/],
  ['/register', /Register an agent/],
  ['/about', /Fidora/],
  ['/risks', /Risks/],
  ['/contact', /Contact/],
  ['/terms', /Terms/],
  ['/privacy', /Privacy/],
  ['/docs', /Fidora/],
  ['/docs/quickstart', /Quickstart/],
  ['/docs/concepts', /./],
  ['/docs/guides', /./],
  ['/docs/build-an-agent', /./],
  ['/docs/api', /HTTP API/],
  ['/docs/security', /./],
  ['/docs/faq', /./],
];

for (const [path, heading] of PAGES) {
  test(`${path} renders, with no console error`, async ({page}) => {
    const errors = watchConsole(page);
    const res = await page.goto(path);
    expect(res?.status()).toBe(200);
    await expect(page.locator('main')).toContainText(heading);
    await page.waitForLoadState('networkidle');
    expect(errors).toEqual([]);
  });
}

test('no page still says Pactora or NEAR', async ({page}) => {
  for (const [path] of PAGES) {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    const text = await page.locator('body').innerText();
    expect(text, path).not.toMatch(/Pactora|\bNEAR\b|yocto|nearblocks/);
  }
});

test('the home page shows the live figures from the chain', async ({page}) => {
  await page.goto('/');
  const live = page.getByRole('region', {name: 'Live from the chain'});
  await expect(live).toContainText('8');
  await expect(live).toContainText('holds');
});

test('the marketplace lists the demo workers by name, not the client agents', async ({page}) => {
  await page.goto('/agents');
  await expect(page.locator('main')).toContainText('MarketResearch');
  await expect(page.locator('main')).toContainText('TradeAnalysis');
  await expect(page.locator('main')).not.toContainText('happy-client');
});

test('the farm agent is read as self-funded, from the chain alone', async ({page}) => {
  await page.goto('/agents/6');
  await expect(page.locator('main')).toContainText('CheapResearch');
  await expect(page.locator('main')).toContainText('self-funded');
  await expect(page.getByRole('link', {name: 'Job #5'})).toHaveAttribute('href', '/jobs/5');
});

test('a settled job shows every escrow step with a transaction link and the result hash', async ({page}) => {
  await page.goto('/jobs/1');
  const main = page.locator('main');
  await expect(main).toContainText('orchestrator');
  await expect(main).toContainText('MarketResearch');
  await expect(main).toContainText('settled · paid');
  for (const step of ['Locked', 'Accepted', 'Delivered', 'Settled']) await expect(main).toContainText(step);
  const tx = page.getByRole('link', {name: /transaction/}).first();
  await expect(tx).toHaveAttribute('href', /^https:\/\/explorer\.solana\.com\/tx\//);
  await expect(main).toContainText(/[0-9a-f]{64}/);
});

test('the refunded job says so, and the worker never delivered', async ({page}) => {
  await page.goto('/jobs/4');
  const main = page.locator('main');
  await expect(main).toContainText('refunded');
  await expect(main).toContainText('no delivery recorded');
});

test('the status page shows invariant I1 holding', async ({page}) => {
  await page.goto('/status');
  await expect(page.locator('main')).toContainText('Vault = what is owed (I1)');
  await expect(page.locator('main')).toContainText('holds');
});

test('an unknown agent or job is a real 404 or a plain "not found"', async ({page}) => {
  expect((await page.goto('/agents/abc'))?.status()).toBe(404);
  expect((await page.goto('/jobs/abc'))?.status()).toBe(404);
  await page.goto('/jobs/999');
  await expect(page.locator('main')).toContainText('There is no job #999.');
});
