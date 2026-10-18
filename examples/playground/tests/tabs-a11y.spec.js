import { test, expect } from '@playwright/test';

test('tabs with stale bound state still expose a focusable selected tab and keyboard navigation', async ({ page }) => {
  await page.goto('/');
  const editor = page.getByRole('textbox', {name:'JSON document editor'});
  const document = {
    version:'1.0',
    state:{activeTab:'removed'},
    root:{type:'tabs',bind:'activeTab',props:{label:'Details',options:[
      {label:'Overview',value:'overview'},
      {label:'Settings',value:'settings'}
    ]},children:[
      {type:'tab-panel',props:{value:'overview'},children:[{type:'text',props:{text:'Overview panel'}}]},
      {type:'tab-panel',props:{value:'settings'},children:[{type:'text',props:{text:'Settings panel'}}]}
    ]}
  };
  await editor.fill(JSON.stringify(document));
  await page.getByRole('button', {name:/Apply JSON/}).click();
  const overview = page.getByRole('tab', {name:'Overview'});
  const settings = page.getByRole('tab', {name:'Settings'});
  await expect(overview).toHaveAttribute('aria-selected','true');
  await expect(overview).toHaveAttribute('tabindex','0');
  await expect(settings).toHaveAttribute('tabindex','-1');
  await expect(page.getByRole('tabpanel', {name:'Overview'})).toContainText('Overview panel');
  await overview.focus();
  await overview.press('ArrowRight');
  await expect(settings).toBeFocused();
  await expect(settings).toHaveAttribute('aria-selected','true');
  await expect(page.getByRole('tabpanel', {name:'Settings'})).toContainText('Settings panel');
  await settings.press('Home');
  await expect(overview).toBeFocused();
  await expect(overview).toHaveAttribute('aria-selected','true');
});
