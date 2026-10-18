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

test('interactive gallery supports tabs, stateful controls, accordion and carousel', async ({ page }) => {
  await page.getByRole('button', {name:'UI Gallery'}).click();
  await expect(page.getByRole('heading', {name:'An interface made of data.'})).toBeVisible();
  await page.getByRole('slider', {name:/Quantity/}).fill('7');
  await expect(page.getByText('Your choice: 7 × vanilla')).toBeVisible();
  await page.getByRole('button', {name:'chocolate'}).click();
  await expect(page.getByText('Your choice: 7 × chocolate')).toBeVisible();
  await page.getByRole('switch', {name:'Send me updates'}).uncheck();
  await page.getByRole('tab', {name:'Content'}).click();
  await expect(page.getByRole('table')).toBeVisible();
  await expect(page.getByText('Interactive', {exact:true})).toBeVisible();
  await page.getByRole('tab', {name:'Controls'}).click();
  await page.getByRole('button', {name:'Next slide'}).click();
  await expect(page.getByRole('heading', {name:'02 · Interact'})).toBeVisible();
  await page.getByRole('button', {name:'Can I use another model?'}).click();
  await expect(page.getByText('The protocol is a JSON document, independent from your model provider.')).toBeVisible();
  await page.getByRole('button', {name:'Send order'}).click();
  await expect(page.getByText('order.submit')).toBeVisible();
});

test('travel planner tabs, radio, accordion and theme are usable', async ({ page }) => {
  await page.getByRole('button',{name:'Travel planner'}).click();
  await expect(page.getByRole('heading',{name:'Your weekend in Seoul'})).toBeVisible();
  await page.getByRole('button',{name:'⚡ Active'}).click();
  await expect(page.getByText('Active pace selected')).toBeVisible();
  await page.getByRole('radio',{name:'🚕 Taxi'}).check();
  await page.getByRole('tab',{name:'Costs'}).click();
  await expect(page.getByRole('table')).toBeVisible();
  await expect(page.getByText('₩40,000')).toBeVisible();
  await page.getByRole('button',{name:'Is this an official reservation?'}).click();
  await expect(page.getByText('No. This is a sample itinerary UI with illustrative costs, not a real booking.')).toBeVisible();
  await page.getByRole('button',{name:'Toggle preview theme'}).click();
  await expect(page.locator('.ps-surface[data-ps-theme="dark"]')).toBeVisible();
  await page.getByRole('button',{name:'Save itinerary'}).click();
  await expect(page.getByText('trip.save')).toBeVisible();
});

test('knowledge quiz conditional content and controls', async ({ page }) => {
  await page.getByRole('button',{name:'Knowledge quiz'}).click();
  await expect(page.getByRole('heading',{name:'How do stars shine?'})).toBeVisible();
  await page.getByRole('radio',{name:'Nuclear fusion'}).check();
  await expect(page.getByText('Selected: Nuclear fusion')).toBeVisible();
  await page.getByRole('button',{name:'Check answer'}).click();
  await expect(page.getByText('Explanation')).toBeVisible();
  await page.getByRole('button',{name:'Start over'}).click();
  await expect(page.getByText('Explanation')).toHaveCount(0);
});

test('unsafe javascript links are not rendered', async ({ page }) => {
  const editor = page.getByRole('textbox',{name:'JSON document editor'});
  const document = {version:'1.0',state:{},root:{type:'link',props:{href:'javascript:alert(1)',label:'Unsafe'}}};
  await editor.fill(JSON.stringify(document));
  await page.getByRole('button',{name:/Apply JSON/}).click();
  await expect(page.getByRole('link',{name:'Unsafe'})).toHaveCount(0);
});
