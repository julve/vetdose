import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';
import { syntheticLibrary } from './fixtures.js';

const projectRoot=fileURLToPath(new URL('../',import.meta.url));
const testPort=4174;
const server=spawn(process.execPath,['scripts/serve.js'],{cwd:projectRoot,env:{...process.env,PORT:String(testPort),HOST:'127.0.0.1'},stdio:['ignore','pipe','pipe']});
let serverLog='';server.stdout.on('data',d=>serverLog+=d);server.stderr.on('data',d=>serverLog+=d);
let browser, passed=0;
const results=[],skipped=[];
const check = async(name,fn) => {await fn();passed++;results.push(name);console.log(`✓ ${name}`);};
const action = (page,name) => page.locator(`[data-action="${name}"]`);
const nav = (page,name) => page.locator(`[data-action="navigate"][data-page="${name}"]`).click();
async function expectText(locator,pattern) {
  let value='';
  for(let attempt=0;attempt<150;attempt++) {
    value=await locator.innerText();if(pattern.test(value)) return;
    await new Promise(resolve=>setTimeout(resolve,20));
  }
  assert.match(value,pattern);
}
try {
  let ready=false;
  for(let attempt=0;attempt<80;attempt++) {
    try {const response=await fetch(`http://127.0.0.1:${testPort}`);if(response.ok){ready=true;break;}} catch { /* wait for server */ }
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  assert.ok(ready,`Servidor no disponible: ${serverLog}`);
  browser=await chromium.launch({executablePath:process.env.BROWSER_PATH||'/usr/bin/chromium',headless:true,args:process.env.BROWSER_SANDBOX==='1'?[]:['--no-sandbox']});
  await mkdir(`${projectRoot}test-results`,{recursive:true});
  const context=await browser.newContext({viewport:{width:1440,height:1100},acceptDownloads:true});
  const page=await context.newPage(), errors=[], external=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('request',r=>{if(!r.url().startsWith(`http://127.0.0.1:${testPort}/`) && !r.url().startsWith('blob:')) external.push(r.url());});
  await page.goto(`http://127.0.0.1:${testPort}`);
  await check('inicio sin dosis ni medicamentos precargados',async()=>{
    await page.locator('#weight').waitFor();assert.equal(await page.locator('#dose').inputValue(),'');assert.equal(await page.locator('#drugId option').count(),1);
    await page.screenshot({path:`${projectRoot}test-results/calculadora-desktop.png`,fullPage:true});
  });
  await check('cálculo incompleto bloqueado',async()=>{await action(page,'calculate').click();await expectText(page.locator('#result'),/principio activo/);});
  await check('creación de medicamento con pauta y presentación',async()=>{
    await nav(page,'library');await action(page,'new-drug').click();
    await page.locator('#ed-name').fill('Producto ficticio de interfaz');await page.locator('#ed-active').fill('Sustancia matemática UI');
    await page.locator('#ed-precautions').fill('Solo prueba, sin validez terapéutica.');
    await action(page,'add-regimen').click();await page.locator('#r0-indication').fill('Caso sintético');await page.locator('#r0-dose').fill('6');await page.locator('#r0-intervalHours').fill('8');await page.locator('#r0-durationDays').fill('2');await page.locator('#r0-route').fill('Vía ficticia');
    await action(page,'add-presentation').click();await page.locator('#p0-name').fill('Solución sintética');await page.locator('#p0-amount').fill('12');await page.locator('#p0-perVolume').fill('1');
    await action(page,'save-drug').click();await page.locator('#search').waitFor();await expectText(page.locator('#drug-list'),/Producto ficticio de interfaz/);
  });
  await check('cálculo desde biblioteca: 2 mL por administración, 12 mL total',async()=>{
    await action(page,'use').click();await page.locator('#regimenId').selectOption({label:'Caso sintético · Canino'});await page.locator('#presentationId').selectOption({label:'Solución sintética'});
    await page.locator('#weight').fill('4');await page.locator('#patient').fill('PACIENTE-NO-PERSISTIR');await action(page,'calculate').click();
    await expectText(page.locator('#result .result-number'),/^2 mL$/);await expectText(page.locator('#result'),/12 mL · 6 administraciones/);
  });
  await check('los cambios temporales no modifican la biblioteca',async()=>{
    await page.locator('#dose').fill('3');assert.equal(await page.locator('#result .result-number').count(),0);await action(page,'calculate').click();await expectText(page.locator('#result .result-number'),/^1 mL$/);
    await nav(page,'library');await action(page,'edit').click();assert.equal(await page.locator('#r0-dose').inputValue(),'6');
    const dialog=page.waitForEvent('dialog').then(d=>d.accept());await action(page,'cancel-edit').click();await dialog;
  });
  await check('cambio de especie bloquea la pauta de otra especie',async()=>{
    await action(page,'use').click();await page.locator('#regimenId').selectOption({label:'Caso sintético · Canino'});await page.locator('#presentationId').selectOption({label:'Solución sintética'});
    await page.locator('[data-action="species"][data-value="feline"]').click();await action(page,'calculate').click();await expectText(page.locator('#result'),/otra especie/);
    assert.equal(await page.locator('#regimenId option').last().getAttribute('disabled'),'');await page.locator('[data-action="species"][data-value="canine"]').click();
  });
  await check('edición, pauta de intervalo y selección explícita',async()=>{
    await nav(page,'library');await action(page,'edit').click();await page.locator('#ed-reference').fill('Referencia ficticia actualizada');await page.locator('#r0-dose').fill('');await page.locator('#r0-min').fill('2');await page.locator('#r0-max').fill('8');await action(page,'save-drug').click();
    await action(page,'use').click();await page.locator('#regimenId').selectOption({label:'Caso sintético · Canino'});assert.equal(await page.locator('#dose').inputValue(),'');await page.locator('#presentationId').selectOption({label:'Solución sintética'});await action(page,'calculate').click();await expectText(page.locator('#result'),/dosis/i);
    await page.locator('#dose').fill('9');await action(page,'calculate').click();await expectText(page.locator('#result'),/intervalo registrado/);
    await page.locator('#dose').fill('6');await action(page,'calculate').click();await expectText(page.locator('#result .result-number'),/^2 mL$/);
  });
  let backup;
  await check('exportación descargable excluye identificador del paciente',async()=>{
    await nav(page,'settings');const downloadPromise=page.waitForEvent('download');await action(page,'export').click();const download=await downloadPromise;
    backup=await readFile(await download.path(),'utf8');assert.equal(JSON.parse(backup).schemaVersion,1);assert.ok(!backup.includes('PACIENTE-NO-PERSISTIR'));assert.ok(backup.includes('Referencia ficticia actualizada'));
  });
  await check('duplicación crea nuevos identificadores y eliminación pide confirmación',async()=>{
    await nav(page,'library');await action(page,'duplicate').click();await action(page,'save-drug').click();assert.equal(await page.locator('.drug-card').count(),2);
    const cancel=page.waitForEvent('dialog').then(d=>d.dismiss());await action(page,'delete').last().click();await cancel;assert.equal(await page.locator('.drug-card').count(),2);
    const accept=page.waitForEvent('dialog').then(d=>d.accept());await action(page,'delete').last().click();await accept;assert.equal(await page.locator('.drug-card').count(),1);
  });
  await check('fusión de respaldo idéntico conserva un solo registro',async()=>{
    await nav(page,'settings');await page.locator('#import-file').setInputFiles({name:'respaldo.json',mimeType:'application/json',buffer:Buffer.from(backup)});await action(page,'import').click();await expectText(page.locator('#import-status'),/1 medicamentos/);
  });
  await check('importación inválida no modifica almacenamiento',async()=>{
    const before=await page.evaluate(()=>localStorage.getItem('vetdose.library.v1'));
    await page.locator('#import-file').setInputFiles({name:'incorrecto.json',mimeType:'application/json',buffer:Buffer.from('{"schemaVersion":99,"drugs":[]}')});await action(page,'import').click();await expectText(page.locator('#import-status'),/inválida/);
    assert.equal(await page.evaluate(()=>localStorage.getItem('vetdose.library.v1')),before);
  });
  await check('reemplazo requiere confirmación y restaura el respaldo',async()=>{
    await page.locator('#import-file').setInputFiles({name:'respaldo.json',mimeType:'application/json',buffer:Buffer.from(backup)});await page.locator('#import-mode').selectOption('replace');
    const dismiss=page.waitForEvent('dialog').then(d=>d.dismiss());await action(page,'import').click();await dismiss;
    const accept=page.waitForEvent('dialog').then(d=>d.accept());await action(page,'import').click();await accept;await expectText(page.locator('#import-status'),/completada/);
  });
  await check('tema oscuro y biblioteca persisten tras recarga; paciente no persiste',async()=>{
    await page.locator('#theme').selectOption('dark');await page.reload();await page.locator('#weight').waitFor();assert.equal(await page.locator('#patient').inputValue(),'');assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');
    await nav(page,'library');assert.equal(await page.locator('.drug-card').count(),1);await page.screenshot({path:`${projectRoot}test-results/biblioteca-dark.png`,fullPage:true});
  });
  await check('tópico usa contenido medido y porcentajes v/v no se convierten a masa',async()=>{
    await nav(page,'calculator');await page.locator('#weight').fill('4');await page.locator('#active').fill('Sustancia ficticia');await page.locator('#cp-type').selectOption('topical');assert.equal(await page.locator('#mode').inputValue(),'content');
    await page.locator('#cp-amount').fill('2');await page.locator('#measuredQuantity').fill('3');await action(page,'calculate').click();await expectText(page.locator('#result .result-number'),/^6 mg$/);
    await page.locator('#cp-type').selectOption('percent');await page.locator('#cp-percentKind').selectOption('vv');await page.locator('#cp-amount').fill('20');await page.locator('#dose').fill('6');await action(page,'calculate').click();await expectText(page.locator('#result'),/incompatibles/);
    await page.locator('#mode').selectOption('content');await page.locator('#measuredQuantity').fill('3');await action(page,'calculate').click();await expectText(page.locator('#result .result-number'),/^0[.,]6 mL$/);
  });
  await check('diseño móvil de 390 px sin desbordamiento horizontal',async()=>{
    await page.setViewportSize({width:390,height:844});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:`${projectRoot}test-results/calculadora-mobile.png`,fullPage:true});
  });
  await check('sin errores JavaScript ni solicitudes a servicios externos',async()=>{assert.deepEqual(errors,[]);assert.deepEqual(external,[]);});
  await context.close();

  const fileContext=await browser.newContext();
  try {
    const p=await fileContext.newPage();
    await p.goto(pathToFileURL(`${projectRoot}dist/VetDose.html`).href);
    await p.locator('#weight').waitFor();
    await check('HTML autocontenido abre bajo file://',async()=>assert.equal(await p.locator('#dose').inputValue(),''));
  } catch(e) {
    if(!e.message.includes('ERR_BLOCKED_BY_ADMINISTRATOR')) throw e;
    skipped.push('Apertura file:// bloqueada por la política administrativa de Chromium en este entorno.');
    console.log(`○ OMITIDA: ${skipped.at(-1)}`);
  } finally {await fileContext.close();}
  await check('HTML autocontenido servido: calcula después de desconectar la red',async()=>{
    const offline=await browser.newContext();const p=await offline.newPage();const failures=[],requests=[];p.on('pageerror',e=>failures.push(e.message));p.on('request',r=>requests.push(r.url()));
    await p.goto(`http://127.0.0.1:${testPort}/dist/VetDose.html`);await p.locator('#weight').waitFor();assert.equal(requests.length,1);await offline.setOffline(true);
    await p.locator('#weight').fill('4');await p.locator('#active').fill('Prueba portable');await p.locator('#dose').fill('6');await p.locator('#cp-amount').fill('12');await p.locator('#cp-perVolume').fill('1');await action(p,'calculate').click();await expectText(p.locator('#result .result-number'),/^2 mL$/);assert.deepEqual(failures,[]);assert.equal(requests.length,1);await offline.close();
  });
  await check('almacenamiento denegado permite calcular y avisa del modo de memoria',async()=>{
    const c=await browser.newContext();await c.addInitScript(()=>Object.defineProperty(window,'localStorage',{get(){throw new DOMException('Acceso denegado','SecurityError');}}));
    const p=await c.newPage();await p.goto(`http://127.0.0.1:${testPort}`);await expectText(p.locator('.storage-banner'),/Almacenamiento no disponible/);
    await p.locator('#weight').fill('4');await p.locator('#active').fill('Prueba sin persistencia');await p.locator('#dose').fill('6');await p.locator('#cp-amount').fill('12');await p.locator('#cp-perVolume').fill('1');await action(p,'calculate').click();await expectText(p.locator('#result .result-number'),/^2 mL$/);await c.close();
  });
  await check('datos locales corruptos se conservan y ofrecen recuperación',async()=>{
    const c=await browser.newContext();await c.addInitScript(()=>localStorage.setItem('vetdose.library.v1','{datos-corruptos'));
    const p=await c.newPage();await p.goto(`http://127.0.0.1:${testPort}`);await nav(p,'settings');assert.equal(await action(p,'recover').count(),1);assert.equal(await p.evaluate(()=>localStorage.getItem('vetdose.library.v1')),'{datos-corruptos');await c.close();
  });
  await check('texto importado no ejecuta HTML ni scripts',async()=>{
    const c=await browser.newContext();const l=syntheticLibrary();l.drugs[0].name='<img src=x onerror="window.UNSAFE=true">';
    await c.addInitScript(data=>localStorage.setItem('vetdose.library.v1',JSON.stringify(data)),l);
    const p=await c.newPage();await p.goto(`http://127.0.0.1:${testPort}`);await nav(p,'library');assert.equal(await p.locator('.drug-card img').count(),0);assert.equal(await p.evaluate(()=>window.UNSAFE),undefined);await c.close();
  });
  await check('cambios de otra pestaña bloquean sobrescritura desde una copia anterior',async()=>{
    const c=await browser.newContext();const first=await c.newPage();await first.goto(`http://127.0.0.1:${testPort}`);await nav(first,'library');await action(first,'new-drug').click();await first.locator('#ed-name').fill('Copia anterior');await first.locator('#ed-active').fill('Sustancia ficticia');
    const second=await c.newPage();await second.goto(`http://127.0.0.1:${testPort}`);await second.evaluate(data=>localStorage.setItem('vetdose.library.v1',JSON.stringify(data)),syntheticLibrary());
    await action(first,'save-drug').click();await expectText(first.locator('#editor-error'),/otra pestaña/);assert.equal(await second.evaluate(()=>JSON.parse(localStorage.getItem('vetdose.library.v1')).drugs[0].name),'Producto ficticio de prueba');
    first.on('dialog',d=>d.accept());await c.close();
  });
  await writeFile(`${projectRoot}test-results/browser-report.json`,JSON.stringify({timestamp:new Date().toISOString(),browser:browser.version(),passed,skipped,results},null,2));
  console.log(`\n${passed} comprobaciones de interfaz superadas; ${skipped.length} omitidas (Chromium ${browser.version()}).`);
} finally {await browser?.close();server.kill('SIGTERM');}
