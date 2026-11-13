const { test, expect } = require('@playwright/test');

const trackPath = '/tracks/longmont-potion-castle-8/tough-shed/';
const taxonomyLinks = [
  {
    type: 'aliases',
    value: 'Monroe',
    input: '#aliases-search-input',
    results: '#aliases-search-results',
    href: '/aliases/?search=Monroe'
  },
  {
    type: 'establishments',
    value: 'Tough Shed',
    input: '#establishments-search-input',
    results: '#establishments-search-results',
    href: '/establishments/?search=Tough%20Shed'
  }
];

for (const taxonomy of taxonomyLinks) {
  test(`${taxonomy.type} track details link to filtered results`, async ({ page }) => {
    await page.goto(trackPath);

    const detailLink = page
      .locator(`.track-fact-${taxonomy.type} .track-fact-link`)
      .filter({ hasText: taxonomy.value });
    await expect(detailLink).toHaveAttribute('href', taxonomy.href);
    await detailLink.click();

    await expect(page).toHaveURL(new RegExp(taxonomy.href.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$'));
    await expect(page.locator(taxonomy.input)).toHaveValue(taxonomy.value);
    await expect(page.locator(taxonomy.results)).toContainText('Tough Shed');
    await expect(
      page.locator(taxonomy.results).getByRole('link', { name: /Track 5: Tough Shed/ })
    ).toHaveAttribute('href', trackPath);
  });
}

test('subtitle mentions link to their alias and establishment indexes', async ({ page }) => {
  await page.goto(trackPath);

  const subtitle = page.locator('.subtitle-line').filter({
    hasText: 'Yeah, this is Monroe at Tough Shed'
  });
  await expect(subtitle.locator('.subtitle-alias-link', { hasText: 'Monroe' }))
    .toHaveAttribute('href', '/aliases/?search=Monroe');
  await expect(subtitle.locator('.subtitle-establishment-link', { hasText: 'Tough Shed' }))
    .toHaveAttribute('href', '/establishments/?search=Tough%20Shed');
});

test('speaker search links curated speakers to Wikipedia', async ({ page }) => {
  await page.goto('/speakers/');
  await page.locator('#speakers-search-input').fill('Alex Trebek');

  await expect(page.getByRole('link', { name: 'Alex Trebek on Wikipedia' }))
    .toHaveAttribute('href', 'https://en.wikipedia.org/wiki/Alex_Trebek');
});
