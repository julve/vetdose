// Screenshots for the user guide: synthetic data only, in a fresh browser profile.
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const port=4175;
const server=spawn(process.execPath,['scripts/serve.js'],{cwd:root,env:{...process.env,PORT:String(port),HOST:'127.0.0.1'},stdio:'ignore'});
let browser;
try {
  let ready=false;
  for(let n=0;n<80;n++) {
    try { if((await fetch(`http://127.0.0.1:${port}`)).ok) {ready=true;break;} } catch {}
    await new Promise(r=>setTimeout(r,100));
  }
  if(!ready) throw Error('Guide screenshot server did not start.');
  await mkdir(`${root}docs/guide-assets`,{recursive:true});
  browser=await chromium.launch({executablePath:process.env.BROWSER_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2,colorScheme:'light',reducedMotion:'reduce'});
  const page=await context.newPage();
  await page.goto(`http://127.0.0.1:${port}/docs/`);
  await page.locator('#weight').waitFor();
  await page.screenshot({path:`${root}docs/guide-assets/phone-start.png`});
  for(const [id,value] of Object.entries({weight:'4',name:'PRUEBA MATEMÁTICA',active:'Sustancia ficticia X',indication:'Ejercicio sin uso clínico',dose:'6',intervalHours:'8',durationDays:'2','cp-amount':'12','cp-perVolume':'1'})) await page.locator(`#${id}`).fill(value);
  await page.locator('.calculator-input > .card').nth(1).screenshot({path:`${root}docs/guide-assets/dose-fields.png`});
  await page.locator('[data-action="calculate"]').click();
  await page.locator('.result-card').screenshot({path:`${root}docs/guide-assets/result.png`});
  const sample={schemaVersion:1,drugs:[{id:'guide-example',name:'PRUEBA MATEMÁTICA',active:'Sustancia ficticia X',notes:'Ejercicio de aprendizaje, sin uso clínico.',precautions:'No usar estos datos para tratar pacientes.',reference:'Ejemplo numérico ficticio',reviewDate:'',regimens:[{id:'guide-regimen',species:'canine',indication:'Ejercicio sin uso clínico',dose:6,min:null,max:null,doseUnit:'mg/kg/dosis',route:'',intervalHours:8,durationDays:2}],presentations:[{id:'guide-form',name:'Solución ficticia',type:'liquid',amount:12,unit:'mg',perVolume:1,fractions:[]}]}]};
  await page.evaluate(data=>localStorage.setItem('vetdose.library.v1',JSON.stringify(data)),sample);
  await page.setViewportSize({width:1280,height:1000});
  await page.reload();
  await page.locator('[data-action="navigate"][data-page="library"]').click();
  await page.locator('.drug-card').screenshot({path:`${root}docs/guide-assets/library.png`});
  await page.locator('[data-action="navigate"][data-page="settings"]').click();
  await page.locator('.settings .card').nth(1).screenshot({path:`${root}docs/guide-assets/backup.png`});
  console.log('Five guide screenshots captured with synthetic data.');
} finally {await browser?.close();server.kill('SIGTERM');}
