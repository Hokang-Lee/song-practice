const {chromium}=require('playwright');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.join(__dirname,'dist');const methods=[];
const server=http.createServer((req,res)=>{methods.push(req.method);const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);const file=path.resolve(root,'.'+(name==='/'?'/index.html':name));if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}fs.readFile(file,(err,data)=>{if(err){res.writeHead(404).end();return;}res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html','.m4a':'audio/mp4'})[path.extname(file)]||'application/octet-stream');res.end(data);});});
(async()=>{
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH}:{})});
try{

 for(const viewport of [{width:1280,height:800},{width:390,height:844}]){
 const context=await browser.newContext({viewport,reducedMotion:'reduce'});const page=await context.newPage();
 await page.goto('http://127.0.0.1:'+server.address().port+'/');
 await page.waitForFunction(()=>!document.querySelector('#play').disabled);
 await page.evaluate(()=>{const a=document.querySelector('audio');a.currentTime=60;});
 await page.locator('#play').click();
 await page.waitForFunction(()=>{const el=document.querySelector('#lyrics .active');if(!el)return false;const r=el.getBoundingClientRect();return Math.abs(r.top+r.height/2-innerHeight/2)<12;});
 await page.evaluate(()=>{window.dispatchEvent(new Event('touchstart'));window.scrollTo(0,0);});
 await page.waitForTimeout(600);assert.ok(await page.evaluate(()=>scrollY<10));assert.equal(await page.evaluate(()=>document.querySelector('audio').paused),false);
 await page.waitForFunction(()=>scrollY>100,{},{timeout:7000});
 await page.evaluate(()=>{const t=document.querySelector('#follow-lyrics');t.checked=false;t.dispatchEvent(new Event('change'));window.scrollTo(0,0);document.querySelector('audio').currentTime=100;});
 await page.waitForTimeout(600);assert.ok(await page.evaluate(()=>scrollY<10));
 await page.reload();assert.equal(await page.locator('#follow-lyrics').isChecked(),false);
 await context.close();
 }
 console.log('PASS: desktop/mobile center following, touch grace period, playback continues, follow off and preference restore');

}finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
