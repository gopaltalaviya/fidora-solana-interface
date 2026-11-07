import AxeBuilder from '@axe-core/playwright';
import {expect, test} from '@playwright/test';

/**
 * Every page through axe-core's WCAG 2.1 A/AA rules: contrast, names and
 * labels, ARIA use, landmarks, headings. A serious or critical violation
 * fails the build; the rest are reported so they are seen.
 *
 * Sections that fade in on scroll are forced visible first (reduced motion),
 * so axe measures their real colours rather than a half-faded frame.
 */
const PAGES = [
  '/',
  '/agents',
  '/agents/1',
  '/agents/6',
  '/activity',
  '/jobs/1',
  '/jobs/4',
  '/register',
  '/status',
  '/about',
  '/fees',
  '/risks',
  '/contact',
  '/terms',
  '/privacy',
  '/docs',
  '/docs/quickstart',
  '/docs/concepts',
  '/docs/guides',
  '/docs/build-an-agent',
  '/docs/api',
  '/docs/security',
  '/docs/faq',
];

for (const path of PAGES) {
  test(`accessibility: ${path}`, async ({page}) => {
    await page.emulateMedia({reducedMotion: 'reduce'});
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    const {violations} = await new AxeBuilder({page})
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    const blocking = violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    const summary = violations.map(
      (v) =>
        `${v.impact} ${v.id}: ${v.help} — ${v.nodes.length} node(s), e.g. ${v.nodes[0]?.target.join(' ')}`,
    );
    if (summary.length) console.warn(`${path}\n  ${summary.join('\n  ')}`);
    expect(blocking, summary.join('\n')).toEqual([]);
  });
}

/**
 * The same rules while the data is still loading. The landing page's figures
 * showed a skeleton with `aria-label` on a role-less span (aria-prohibited-attr)
 * — invisible to the test above whenever the API answered before axe ran, and
 * caught only when a stale build pointed the site at a dead API. Here the API
 * is held, so the loading state is what gets scanned.
 */
test('accessibility: / while the data is still loading', async ({page}) => {
  await page.emulateMedia({reducedMotion: 'reduce'});
  await page.route(/\/v1\/(agents|jobs)/, () => {
    // Never answered: the lists stay in their loading state.
  });
  await page.goto('/');
  await expect(page.locator('.skeleton').first()).toBeAttached();
  const {violations} = await new AxeBuilder({page})
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  const blocking = violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(blocking, blocking.map((v) => `${v.id}: ${v.help}`).join('\n')).toEqual([]);
});
