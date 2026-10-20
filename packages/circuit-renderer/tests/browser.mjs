import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
const output = new URL('../verification/', import.meta.url);
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
  args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({viewport:{width:1600,height:1000},deviceScaleFactor:1});
const errors=[];
const externalRequests=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
page.on('request',r=>{if(!r.url().startsWith('http://127.0.0.1:4173')&&!r.url().startsWith('data:'))externalRequests.push(r.url());});
await page.goto('http://127.0.0.1:4173');
await page.getByText('Renderer online').waitFor({timeout:45000});
await page.waitForFunction(()=>window.rendererPreview?.getStats().triangles>0);
await page.screenshot({path:fileURLToPath(new URL('workbench.png',output))});
const initialStats=await page.evaluate(()=>window.rendererPreview.getStats());
console.log('Initial scene rendered',initialStats);
const downloadPromise=page.waitForEvent('download');
await page.getByRole('button',{name:'Export view'}).click();
const download=await downloadPromise;
await download.saveAs(fileURLToPath(new URL('scene-2x.png',output)));
const png=await fs.readFile(new URL('scene-2x.png',output));
assert.ok(png.readUInt32BE(16)>2000,'PNG exported at increased resolution');
await page.getByLabel('Rendering quality').selectOption('draft');
await page.getByRole('button',{name:'Top view',exact:true}).click();
const point=async pin=>{
  const p=await page.evaluate(pin=>window.rendererPreview.projectPin(pin),pin);
  const box=await page.locator('canvas').boundingBox();
  return {x:box.x+p.x,y:box.y+p.y};
};
// Wiring uses real raycasts against pin instances, not a direct state mutation.
await page.getByRole('button',{name:'Wire',exact:true}).click();
let p=await point({partId:'uno',pinId:'12'});await page.mouse.click(p.x,p.y);
await page.getByText('From uno / 12',{exact:false}).waitFor();
p=await point({partId:'uno',pinId:'A0'});await page.mouse.click(p.x,p.y);
await page.waitForFunction(()=>window.rendererPreview.getCircuit().wires.length===8);
const added=await page.evaluate(()=>window.rendererPreview.getCircuit().wires.at(-1));
assert.deepEqual(added.from,{partId:'uno',pinId:'12'});assert.deepEqual(added.to,{partId:'uno',pinId:'A0'});
// Pointer movement commits once, only on release, and leaves original Y unchanged.
await page.getByRole('button',{name:'Move',exact:true}).click();
const original=await page.evaluate(()=>window.rendererPreview.getCircuit().parts.find(p=>p.id==='uno').position);
p=await point({partId:'uno',pinId:'8'});await page.mouse.move(p.x,p.y);await page.mouse.down();
await page.mouse.move(p.x+30,p.y+20,{steps:5});
assert.deepEqual(await page.evaluate(()=>window.rendererPreview.getCircuit().parts.find(p=>p.id==='uno').position),original);
await page.mouse.up();
await page.waitForFunction(x=>window.rendererPreview.getCircuit().parts.find(p=>p.id==='uno').position[0]!==x,original[0]);
const moved=await page.evaluate(()=>window.rendererPreview.getCircuit().parts.find(p=>p.id==='uno').position);
assert.equal(moved[1],original[1]);assert.ok(Math.abs(moved[0]/2.54-Math.round(moved[0]/2.54))<1e-8);
// Escape cancels an in-progress move without committing it.
p=await point({partId:'uno',pinId:'8'});await page.mouse.move(p.x,p.y);await page.mouse.down();await page.mouse.move(p.x+30,p.y,{steps:3});
await page.keyboard.press('Escape');await page.mouse.up();
assert.deepEqual(await page.evaluate(()=>window.rendererPreview.getCircuit().parts.find(p=>p.id==='uno').position),moved);
// Keyboard path supports the same move contract and rotation callback.
await page.getByRole('button',{name:'Arduino Uno 01'}).click();
await page.getByRole('region',{name:'Interactive 3D circuit workspace'}).focus();
await page.keyboard.press('ArrowRight');
await page.waitForFunction(x=>window.rendererPreview.getCircuit().parts.find(p=>p.id==='uno').position[0]>x,moved[0]);
await page.keyboard.press('r');
assert.equal(await page.evaluate(()=>window.rendererPreview.getCircuit().parts.find(p=>p.id==='uno').rotation),Math.PI/2);
// A momentary button emits both press and release through the public callbacks.
await page.getByRole('button',{name:'Interact',exact:true}).click();
const a=await point({partId:'button',pinId:'1.l'}),b=await point({partId:'button',pinId:'2.r'});
await page.mouse.move((a.x+b.x)/2,(a.y+b.y)/2);await page.mouse.down();
await page.waitForFunction(()=>window.rendererPreview.getSnapshot().parts.button?.pressed===true);
await page.mouse.up();
await page.waitForFunction(()=>window.rendererPreview.getSnapshot().parts.button?.pressed===false);
// Theme, camera, labels and quality changes render without external resources.
await page.getByLabel('Porcelain theme').check();
await page.getByLabel('Component labels').check();
await page.getByRole('button',{name:'Isometric view'}).click();
await page.screenshot({path:fileURLToPath(new URL('porcelain.png',output))});
await page.setViewportSize({width:390,height:844});
await page.screenshot({path:fileURLToPath(new URL('mobile.png',output)),fullPage:true});
assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth),false,'No horizontal overflow on mobile');
assert.equal(externalRequests.length,0,'All rendering assets are local');
const report={errors,externalRequests,initialStats,exportPixels:[png.readUInt32BE(16),png.readUInt32BE(20)],checks:['scene renders','2x PNG export','pin wiring','drag commit','snap and elevation','escape cancel','keyboard movement','rotation','button press and release','theme and labels','mobile layout']};
await fs.writeFile(new URL('browser-report.json',output),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
await browser.close();
assert.equal(errors.length,0,errors.join('\n'));
