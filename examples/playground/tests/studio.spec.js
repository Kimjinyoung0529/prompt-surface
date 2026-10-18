import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', {name:'Pasta for 2 people'})).toBeVisible();
});

test('renders and operates live interactive state', async ({ page }) => {
  await page.getByLabel('Your name').fill('Alex');
  await expect(page.getByText('Hi Alex!')).toBeVisible();
  await page.getByRole('checkbox', {name:'I finished cooking'}).check();
  await expect(page.locator('.ps-badge').getByText('Dinner is ready!', {exact:true})).toBeVisible();
  await page.getByRole('button', {name:'Submit recipe'}).click();
  await expect(page.getByText('recipe.submit')).toBeVisible();
  await page.getByRole('button', {name:'Reset state'}).click();
  await expect(page.getByText('Hi Chef!')).toBeVisible();
  await expect(page.locator('.ps-badge').getByText('Dinner is ready!', {exact:true})).toHaveCount(0);
});

test('switches presets, validates malformed JSON and streams updates', async ({ page }) => {
  await page.getByRole('button', {name:'Dashboard'}).click();
  await expect(page.getByRole('heading', {name:'Weekly analytics'})).toBeVisible();
  await expect(page.getByRole('img', {name:'Daily orders'})).toBeVisible();
  const editor = page.getByRole('textbox',{name:'JSON document editor'});
  await editor.fill('{');
  await expect(page.getByText('✕ Invalid')).toBeVisible();
  await expect(page.getByRole('button', {name:/Apply JSON/})).toBeDisabled();
  await page.getByRole('button', {name:'Recipe planner'}).click();
  await page.getByRole('button', {name:'Simulate JSONL stream'}).click();
  await expect(page.getByRole('heading', {name:'Pasta for 4 people'})).toBeVisible();
  await expect(page.getByRole('status')).toContainText('Processed 3 stream events');
});

test('maintains viewport width and captures actual rendered React UI', async ({ page }, testInfo) => {
  const width = await page.evaluate(() => ({viewport: window.innerWidth, doc:document.documentElement.scrollWidth}));
  expect(width.doc).toBeLessThanOrEqual(width.viewport + 1);
  const shot = await page.screenshot({path: testInfo.outputPath(`${testInfo.project.name}.png`), fullPage:true, animations:'disabled'});
  await testInfo.attach('actual-react-studio', {body: shot, contentType:'image/png'});
});
