import { test, expect } from '@playwright/test';

test('checkbox, switch, and slider keep predictable accessible names', async ({ page }) => {
  await page.goto('/');
  const editor = page.getByRole('textbox', {name:'JSON document editor'});
  const document = {
    version:'1.0',
    state:{enabled:false,quiet:false,volume:25,speed:10},
    root:{type:'column',children:[
      {type:'checkbox',bind:'enabled'},
      {type:'switch',bind:'quiet',props:{ariaLabel:'Quiet mode'}},
      {type:'slider',bind:'volume',props:{label:'Volume',min:0,max:100}},
      {type:'slider',bind:'speed',props:{min:0,max:100}}
    ]}
  };
  await editor.fill(JSON.stringify(document));
  await page.getByRole('button', {name:/Apply JSON/}).click();

  await expect(page.getByRole('checkbox', {name:'enabled'})).toBeVisible();
  await expect(page.getByRole('switch', {name:'Quiet mode'})).toBeVisible();
  const volume = page.getByRole('slider', {name:'Volume',exact:true});
  await expect(volume).toBeVisible();
  await volume.focus();
  await volume.press('ArrowRight');
  await expect(page.getByRole('slider', {name:'Volume',exact:true})).toBeVisible();
  await expect(page.getByRole('slider', {name:'Volume: 26'})).toHaveCount(0);
  await expect(page.getByRole('slider', {name:'speed'})).toBeVisible();
});
