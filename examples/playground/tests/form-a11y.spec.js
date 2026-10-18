import { test, expect } from '@playwright/test';

test('unlabeled form controls have stable, state-aware accessible names', async ({ page }) => {
  await page.goto('/');
  const editor = page.getByRole('textbox', {name:'JSON document editor'});
  const document = {
    version:'1.0',
    state:{name:'',notes:'',country:'KR',email:''},
    root:{type:'column',children:[
      {type:'input',bind:'name',props:{placeholder:'Your name'}},
      {type:'textarea',bind:'notes',props:{ariaLabel:'Notes for {{name}}'}},
      {type:'select',bind:'country',props:{options:['KR','US']}},
      {type:'input',bind:'email',props:{label:'Email',ariaLabel:'Ignored override',placeholder:'Email address'}}
    ]}
  };
  await editor.fill(JSON.stringify(document));
  await page.getByRole('button', {name:/Apply JSON/}).click();
  await page.getByRole('textbox', {name:'Your name'}).fill('Ada');
  await expect(page.getByRole('textbox', {name:'Notes for Ada'})).toBeVisible();
  await expect(page.getByRole('combobox', {name:'country'})).toBeVisible();
  await expect(page.getByRole('textbox', {name:'Email',exact:true})).toBeVisible();
  await expect(page.getByRole('textbox', {name:'Ignored override'})).toHaveCount(0);
});
