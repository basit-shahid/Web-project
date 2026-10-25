// Optional browser acceptance check; requires Playwright and Chromium installed separately.
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({headless: true, ...(process.env.CHROMIUM_PATH ? {executablePath: process.env.CHROMIUM_PATH} : {}), args: ['--no-sandbox']});
  try {
    const page = await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
    const errors=[], apiRequests=[];
    page.on('pageerror', error=>errors.push(error.message));
    page.on('request', req=>{if(new URL(req.url()).pathname.startsWith('/api/'))apiRequests.push(req.url());});
    const base=process.env.DEMO_URL || 'http://127.0.0.1:4173';
    const login=async name=>{await page.locator('#email').fill(`${name}@novaworks.example`);await page.locator('#password').fill('Demo123!');await page.locator('form button').click();await page.getByRole('button',{name:'Sign out',exact:true}).waitFor();await page.locator('.loading').waitFor({state:'hidden'});};
    const nav=async name=>{const menu=page.getByRole('button',{name:'Menu',exact:true});if(await menu.isVisible()&&await menu.getAttribute('aria-expanded')!=='true')await menu.click();await page.locator('nav').getByRole('button',{name,exact:true}).click();await page.locator('.loading').waitFor({state:'hidden'});};
    const importSample=async()=>{await page.getByRole('button',{name:'Import sample plan',exact:true}).click();await page.getByRole('button',{name:'Load sample meeting',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#transcript').value.startsWith('Meeting: NovaWorks'));await page.getByRole('button',{name:'Import sample projects and tasks',exact:true}).click();await page.locator('.project-card').first().waitFor();};
    await page.goto(base);await login('admin');assert.equal(await page.locator('.project-card').count(),0);
    await importSample();assert.equal(await page.locator('.project-card').count(),3);
    await page.reload();await page.locator('.project-card').first().waitFor();assert.equal(await page.locator('.project-card').count(),3);
    await importSample();await page.getByText(/This meeting was already saved/).waitFor();assert.equal(await page.locator('.project-card').count(),3);
    await page.getByRole('button',{name:'Import sample plan',exact:true}).click();await page.locator('#transcript').fill('An arbitrary custom transcript');await page.getByRole('button',{name:'Import sample projects and tasks',exact:true}).click();await page.getByRole('alert').filter({hasText:'imports only the supplied sample'}).waitFor();await page.getByRole('button',{name:'Close transcript',exact:true}).click();
    for(const width of [320,375,683,800,1024,1440]){
      await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`project overflow at ${width}`);
      if(width<=1024){const menu=page.getByRole('button',{name:'Menu',exact:true});await menu.click();await page.keyboard.press('Escape');assert.equal(await menu.getAttribute('aria-expanded'),'false');assert.equal(await menu.evaluate(n=>n===document.activeElement),true);}
      await page.locator('.project-card').first().click();await page.locator('.task-row').first().waitFor();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`detail overflow at ${width}`);await nav('Team directory');await page.locator('#team-search').waitFor();assert.equal(await page.locator('.directory-row').count(),10);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`directory overflow at ${width}`);await nav('Projects');await page.locator('.project-card').first().waitFor();
    }
    await page.locator('#project-search').fill('UrbanCart');assert.equal(await page.locator('.project-card').count(),1);await page.locator('.project-card').click();await page.locator('#task-search').fill('no-match');await page.getByRole('heading',{name:'No matching tasks'}).waitFor();await page.getByRole('button',{name:'Clear filters',exact:true}).first().click();assert.equal(await page.locator('.task-row').count(),4);
    await page.getByRole('button',{name:'Sign out',exact:true}).click();await login('ayesha');assert.equal(await page.locator('.project-card').count(),1);assert.equal(await page.getByRole('button',{name:'Import sample plan',exact:true}).count(),0);
    await page.getByRole('button',{name:'Sign out',exact:true}).click();await login('ali');await page.locator('.task-row').first().waitFor();assert.equal(await page.locator('.task-row').count(),3);await nav('Team directory');await page.locator('#team-search').fill('no-match');await page.getByRole('heading',{name:'No matching people'}).waitFor();await page.getByRole('button',{name:'Clear filters',exact:true}).first().click();assert.equal(await page.locator('.directory-row').count(),10);
    await page.evaluate(()=>localStorage.setItem('novaworks.frontend.workspace.v1','{broken'));await nav('Projects');await page.getByRole('alert').filter({hasText:'Saved demo data could not be read'}).waitFor();page.once('dialog',dialog=>dialog.accept());await page.getByRole('button',{name:'Reset demo',exact:true}).click();await page.getByRole('heading',{name:'No assigned projects yet'}).waitFor();assert.equal(await page.evaluate(()=>localStorage.getItem('novaworks.frontend.workspace.v1')),null);
    assert.deepEqual(errors,[]);assert.deepEqual(apiRequests,[]);
    console.log('PASS: sample import, duplicate replay, persistence, unsupported transcript recovery, role views, project/task/directory filters, reset, corrupt storage recovery, keyboard menu, 6 responsive widths, zero API requests and browser errors.');
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
