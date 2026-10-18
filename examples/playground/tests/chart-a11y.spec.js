import { test, expect } from '@playwright/test';

test('bar and line charts expose live data values to assistive technology', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', {name:'Dashboard'}).click();
  const bar = page.getByRole('img', {name:'Daily orders'});
  const line = page.getByRole('img', {name:'Trend'});
  await expect(bar).toBeVisible();
  await expect(line).toBeVisible();
  const descriptions = await page.getByRole('img').evaluateAll(svgs => svgs.map(svg => {
    const id = svg.getAttribute('aria-describedby');
    return { id, text: id ? document.getElementById(id)?.textContent : null };
  }));
  expect(descriptions).toHaveLength(2);
  expect(descriptions[0].id).toBeTruthy();
  expect(descriptions[1].id).toBeTruthy();
  expect(descriptions[0].id).not.toBe(descriptions[1].id);
  for (const {text} of descriptions) {
    expect(text).toContain('Mon: 18');
    expect(text).toContain('Fri: 51');
  }
});
