const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),{chromium}=require('playwright');
const sourceDir=process.env.DEEP_DIG_GAME_SOURCES || require('node:os').tmpdir();
const source=fs.readFileSync(path.join(sourceDir,'deep-dig-hookrush.js'),'utf8');
const line=source.slice(source.indexOf('function rushLine('),source.indexOf('/** número grande'));
const hook=source.slice(source.indexOf('  drawHook(c, s) {'),source.indexOf('  /** roda do guincho'));
const fixture=fs.readFileSync(path.join(sourceDir,'deep-dig-mgcore.js'),'utf8')+'\n'+line+'\nconst HR_Q=64;window.painter={'+hook+'};';
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_BIN || chromium.executablePath()});
 try {
  const results=[];
  for(const version of (process.env.DEEP_DIG_OLD_CONTENT ? ['old','fixed'] : ['fixed']))for(const order of ['game-first','helper-first']){
   const page=await browser.newPage({viewport:{width:1100,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.setContent('<style>body{margin:0;padding:30px;background:#201b28}.stage{margin:17px 21px}canvas{width:768px;height:576px;image-rendering:pixelated}</style><div id="rushModal"><div class="rush playing stage"><canvas id="rushCanvas" width="256" height="192"></canvas></div></div>');
   await page.addScriptTag({content:fixture});
   await page.evaluate(()=>{
    window.chrome={runtime:{sendMessage:async()=>({ok:true,tabId:null,running:false}),onMessage:{addListener(){}}},storage:{local:{get:async defaults=>defaults,set:async()=>{}},onChanged:{addListener(){}}}};
    window.pose={phase:0,frame:0,line:null,visible:true,clearFrame:-1};window.samples=[];
    const lineTo=CanvasRenderingContext2D.prototype.lineTo,clear=CanvasRenderingContext2D.prototype.clearRect;
    CanvasRenderingContext2D.prototype.lineTo=function(x,y){if(this.canvas.getRootNode().host?.id==='deep-dig-visual-helper')pose.line={dx:(x-128)/280,dy:(y-27)/280,frame:pose.frame};return lineTo.call(this,x,y);};
    CanvasRenderingContext2D.prototype.clearRect=function(...args){if(this.canvas.getRootNode().host?.id==='deep-dig-visual-helper'){pose.clearFrame=pose.frame;pose.line=null;}return clear.apply(this,args);};
    const attach=Element.prototype.attachShadow;Element.prototype.attachShadow=function(options){const shadow=attach.call(this,options);if(this.id==='deep-dig-visual-helper')window.helperShadow=shadow;return shadow;};
    const cv=document.getElementById('rushCanvas'),ctx=cv.getContext('2d');
    window.renderFrame=()=>{ctx.fillStyle='#5b3e2b';ctx.fillRect(0,0,256,192);painter.drawHook(ctx,{swing:pose.phase,hook:{state:pose.visible?'idle':'out',len:pose.visible?0:64*40,dx:-600,dy:830,item:null}});};
    renderFrame();
    window.startGame=()=>new Promise(resolve=>{
      function step(){
        pose.frame++;pose.phase=pose.frame%72;pose.visible=!(pose.frame>=80&&pose.frame<95);
        if(pose.frame===110){cv.style.width='640px';cv.style.height='480px';document.querySelector('.stage').style.marginLeft='76px';}
        renderFrame();
        setTimeout(()=>{
          if(pose.frame>3){const expected=MGCore.SWING[pose.phase],ray=pose.line,actualRect=cv.getBoundingClientRect(),overlayRect=helperShadow?.querySelector('canvas').getBoundingClientRect();
           samples.push({frame:pose.frame,visible:pose.visible,stale:pose.visible?ray?.frame!==pose.frame:pose.clearFrame!==pose.frame,angle:pose.visible&&ray?Math.abs(Math.atan2(ray.dx,ray.dy)-Math.atan2(expected.dx,expected.dy)):null,hiddenRay:!pose.visible&&!!ray,position:overlayRect?Math.max(Math.abs(overlayRect.left-actualRect.left),Math.abs(overlayRect.top-actualRect.top),Math.abs(overlayRect.width-actualRect.width),Math.abs(overlayRect.height-actualRect.height)):null});}
          if(pose.frame>=155)resolve(samples);
        },0);
        if(pose.frame<155)requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    });
   });
   let run;
   if(order==='game-first')run=page.evaluate(()=>startGame());
   await page.addScriptTag({path:path.join(root,'vision.js')});
   await page.addScriptTag({path:version==='old'?process.env.DEEP_DIG_OLD_CONTENT:path.join(root,'content.js')});
   if(order==='helper-first'){await page.waitForTimeout(100);run=page.evaluate(()=>startGame());}
   const samples=await run;
   const summary={version,order,frames:samples.length,staleFrames:samples.filter(s=>s.stale).length,maxAngleDegrees:Math.max(...samples.filter(s=>s.angle!==null).map(s=>s.angle))*180/Math.PI,hiddenRayFrames:samples.filter(s=>s.hiddenRay).length,misplacedFrames:samples.filter(s=>s.position>0.1).length,pageErrors:errors};
   results.push(summary);
   if(version==='fixed'){assert.equal(summary.staleFrames,0,JSON.stringify(summary));assert(summary.maxAngleDegrees<1,JSON.stringify(summary));assert.equal(summary.hiddenRayFrames,0);assert.equal(summary.misplacedFrames,0);assert.deepEqual(errors,[]);}
   await page.close();
  }
  console.log(JSON.stringify(results,null,2));if(process.env.DEEP_DIG_LINE_RESULTS)fs.writeFileSync(process.env.DEEP_DIG_LINE_RESULTS,JSON.stringify(results));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
