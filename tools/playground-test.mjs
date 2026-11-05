import assert from 'node:assert/strict';
import { chromium, firefox, webkit } from 'playwright';
import { readFileSync } from 'node:fs';
for (const [name, engine] of Object.entries({chromium,firefox,webkit})) {
const browser=await engine.launch(name==='chromium'?{executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']}:{});
try {
 const page=await browser.newPage();
 if(name==='chromium') await page.context().grantPermissions(['clipboard-read','clipboard-write']);
 const errors=[]; page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4174/veil/playground/');
 async function clickVisible(selector){const button=page.locator(selector);await button.scrollIntoViewIfNeeded();const target=await button.evaluate(b=>{const r=b.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2,hit=document.elementFromPoint(x,y);return {x,y,visible:r.width>0&&r.height>0&&x>=0&&x<innerWidth&&y>=0&&y<innerHeight,hitSame:hit===b||b.contains(hit)};});assert.equal(target.visible,true,`${selector} must be in the viewport before clicking`);assert.equal(target.hitSame,true,`${selector} must own its center hit target`);await page.mouse.click(target.x,target.y);}
 await page.waitForFunction(()=>document.querySelector('#feedback').textContent==='Rendered successfully.');
 for(const name of ['dashboard','form','workflow','ai','minimal']){await page.selectOption('#gallery',name);assert.equal(await page.locator('#feedback').textContent(),'Rendered successfully.');}
 await page.selectOption('#gallery','form');
 assert.match(await page.locator('#inspection').textContent(), /name/);
 await page.locator('#preview button').click(); assert.match(await page.locator('#feedback').textContent(), /validation/i);
 await page.getByLabel('Name', {exact:true}).fill('Amina'); await page.getByLabel('Topic').selectOption('support'); await page.getByLabel('Message').fill('Please contact me soon'); await page.getByLabel('Message').blur(); await page.waitForFunction(()=>document.querySelector('#inspection').textContent.includes('Please contact me soon')); await page.locator('#preview button').click(); assert.match(await page.locator('#history').textContent(), /demo/);
 await page.selectOption('#gallery','workflow'); await page.getByLabel('Your name').fill('Amina'); await page.getByLabel('Environment').selectOption('production'); await page.getByLabel('Production reason').fill('Urgent release'); await page.getByLabel('Production reason').blur(); await page.waitForFunction(()=>document.querySelector('#inspection').textContent.includes('Urgent release')); await clickVisible('#preview button:not([hidden])'); assert.equal(await page.getByRole('button',{name:'Confirm'}).isDisabled(),true); await page.getByLabel('I reviewed this request').check(); assert.equal(await page.getByRole('button',{name:'Confirm'}).isEnabled(),true); await clickVisible('#preview button:not([hidden])');
 await page.selectOption('#gallery','minimal'); await page.locator('#preview input').fill('Amina');await page.locator('#preview input').blur();await page.waitForFunction(()=>document.querySelector('#inspection').textContent.includes('Amina'));await clickVisible('#preview button');await page.waitForFunction(()=>document.querySelector('#preview').textContent.includes('Hello Amina'));
 const original=await page.locator('#editor').inputValue();
 for(const bad of ['{',JSON.stringify({id:'x',screen:{key:'root',component:'Script',text:'alert(1)'}}),' '.repeat(32769)]){await page.locator('#editor').fill(bad);await clickVisible('#render');assert.notEqual(await page.locator('#feedback').textContent(),'Rendered successfully.');assert.match(await page.locator('#preview').textContent(),/Hello/);}
 await clickVisible('#reset');assert.equal(await page.locator('#editor').inputValue(),original);assert.equal(await page.locator('#preview input').inputValue(),'');
 await clickVisible('#copy');if(name==='chromium') assert.deepEqual(JSON.parse(await page.evaluate(()=>navigator.clipboard.readText())),JSON.parse(original));
 else await page.waitForFunction(()=>/copied|copy manually/.test(document.querySelector('#feedback').textContent));
 const injection=JSON.parse(original);injection.screen.children[0].text='<img src=https://example.com onerror=alert(1)>';await page.locator('#editor').fill(JSON.stringify(injection));await clickVisible('#render');assert.equal(await page.locator('#preview img').count(),0);assert.match(await page.locator('#preview').textContent(),/<img/);
 await clickVisible('#reset');
 await page.locator('#render').focus();await page.keyboard.press('Enter');assert.equal(await page.locator('#feedback').textContent(),'Rendered successfully.');
 for(const width of [1440,390,195]){await page.setViewportSize({width,height:900});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:`/tmp/veil-playground-${name}-${width}.png`,fullPage:true});}
 const forbidden=JSON.parse(original);forbidden.actions=['fetch'];forbidden.screen.children[2].action='fetch';await page.locator('#editor').fill(JSON.stringify(forbidden));await clickVisible('#render');assert.notEqual(await page.locator('#feedback').textContent(),'Rendered successfully.');await clickVisible('#reset');
 const blocked=await page.evaluate(async()=>{window.probe=0;const s=document.createElement('script');s.textContent='window.probe=1';document.body.append(s);let network=false;try{await fetch('https://example.com/');network=true;}catch{}return {script:window.probe,network};});assert.deepEqual(blocked,{script:0,network:false});
 await page.locator('#editor').focus();await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.id),'render');
 if(process.env.AXE_PATH){await page.evaluate(readFileSync(process.env.AXE_PATH,'utf8'));const results=await page.evaluate(async()=>await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}}));assert.deepEqual(results.violations.map(v=>({id:v.id,impact:v.impact})),[]);console.log(name+' axe PASS; incomplete checks: '+JSON.stringify(results.incomplete.map(v=>v.id)));}
 console.log(name);assert.deepEqual(errors,[]);console.log('PASS gallery, real renderer actions, invalid JSON/schema/size, reset, copy, HTML escaping, desktop/mobile overflow and page errors');
} finally {await browser.close();}

}
