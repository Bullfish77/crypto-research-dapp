/* ===== ⚡ Curve-Live: neue pump.fun-Coins sofort beim Erstellen (PumpPortal-WebSocket, kostenlos: nur subscribeNewToken),
   dann Bonding-Curve-Daten (MCap/Vol/Txns) über DexScreener /tokens in 30er-Paketen. Heiße Coins (≥ 12k MCap) gehen in den Läufer-Scan,
   damit FRÜH-LÄUFER schon vor der Graduierung feuern kann. (Trade-Streams von PumpPortal sind kostenpflichtig – nicht genutzt.) */
const CL={};let clWs=null,clOn=false,clRetry=0,clBusy=false;const CL_STAT={conn:false,news:0,checked:0};
function clStart(){const c=runCfg();if(c.cl===false||!c.on){clStop();return}if(clOn)return;clOn=true;clConnect()}
function clStop(){clOn=false;try{clWs&&clWs.close()}catch(e){}clWs=null;CL_STAT.conn=false}
function clConnect(){if(!clOn)return;try{clWs=new WebSocket("wss://pumpportal.fun/api/data")}catch(e){return setTimeout(clConnect,15000)}
clWs.onopen=()=>{clRetry=0;CL_STAT.conn=true;clWs.send(JSON.stringify({method:"subscribeNewToken"}));clWs.send(JSON.stringify({method:"subscribeMigration"}))};
clWs.onclose=()=>{CL_STAT.conn=false;if(clOn){clRetry=Math.min(clRetry+1,6);setTimeout(clConnect,2000*2**clRetry)}};clWs.onerror=()=>{};
clWs.onmessage=e=>{let d;try{d=JSON.parse(e.data)}catch(_){return}if(d.mint&&/^migrat/.test(d.txType||"")){CL_STAT.migs=(CL_STAT.migs||0)+1;CL_STAT.lastMig=d.mint;const o=CL[d.mint];if(o){o.mig=Date.now();o.chk=0}else CL[d.mint]={t0:Date.now()-36e5,mig:Date.now(),mc0s:0,name:d.name||"",sym:d.symbol||"",chk:0,mc:0,mx90:0,hot:false};return}if(d.txType!=="create"||!d.mint||CL[d.mint])return;if(d.pool&&d.pool!=="pump")return;CL_STAT.news++;CL[d.mint]={t0:Date.now(),mc0s:d.marketCapSol||28,name:d.name,sym:d.symbol,chk:0,mc:0,mx90:0,hot:false,dev:d.traderPublicKey}}}
async function clTick(){if(!clOn||clBusy)return;clBusy=true;try{const now=Date.now();
 for(const [m,s] of Object.entries(CL)){const age=now-s.t0;if(s.mig){const ma=now-s.mig;if(ma>6*3600e3||(ma>10*6e4&&!s.mc)||(ma>30*6e4&&(s.mc<15000||s.v5===0&&ma>60*6e4)))delete CL[m];continue}if((age>30*6e4&&s.mc<8000)||(age>10*6e4&&!s.mc)||age>6*3600e3)delete CL[m]}
 {const k=Object.keys(CL);if(k.length>800)k.sort((a,b)=>(CL[a].mc||0)-(CL[b].mc||0)).slice(0,k.length-800).forEach(m=>delete CL[m])}const all=Object.entries(CL);const hot=all.filter(([m,s])=>s.hot).map(x=>x[0]);
 const fresh=all.filter(([m,s])=>!s.hot&&(s.mig||now-s.t0>=45e3)).sort((a,b)=>(a[1].chk-(a[1].mig&&!a[1].chk?1e13:0))-(b[1].chk-(b[1].mig&&!b[1].chk?1e13:0))).map(x=>x[0]);
 const pick=[...hot.slice(0,60),...fresh].slice(0,150);
 for(let i=0;i<pick.length;i+=30){const b=pick.slice(i,i+30);try{const r=await rfetch("https://api.dexscreener.com/latest/dex/tokens/"+b.join(","));if(!r.ok)break;const j=await r.json();const best={};(j.pairs||[]).forEach(p=>{const a=p.baseToken?.address;if(!b.includes(a))return;if(!best[a]||(p.dexId!=="pumpfun"&&best[a].dexId==="pumpfun"))best[a]=p});
  b.forEach(a=>{const s=CL[a];if(!s)return;s.chk=Date.now();const p=best[a];if(!p)return;const mc=p.marketCap||p.fdv||0;s.mc=mc;s.dex=p.dexId;s.v5=p.volume?.m5||0;if(Date.now()-s.t0<=90e3)s.mx90=Math.max(s.mx90,mc);if(!s.mc0u&&p.priceNative&&p.priceUsd)s.mc0u=s.mc0s*(+p.priceUsd/ +p.priceNative);s.hot=(p.dexId==="pumpfun"||p.dexId==="pumpswap")&&mc>=12000&&mc<2e6&&((p.volume?.m5||0)>0||(p.txns?.m5?.buys||0)>0)});CL_STAT.checked+=b.length}catch(e){}}
}finally{clBusy=false}}
setInterval(clTick,10000);
function clHot(){return Object.entries(CL).filter(([m,s])=>s.hot).sort((a,b)=>b[1].mc-a[1].mc).slice(0,40).map(x=>x[0])}
function clMerge(m,p){return p}
/* Sniper vor Graduierung: in den ersten 90 s ≥ snX× der Start-MCap */
function clSniper(m){const s=CL[m];if(!s||!s.mc0u||!s.mx90)return 0;const x=s.mx90/s.mc0u;return x>=(runCfg().snX??10)?Math.round(x):0}
setInterval(()=>{const e=document.getElementById("clStat");if(e)e.textContent=CL_STAT.conn?` (verbunden · ${Object.keys(CL).length} Coins beobachtet · ${CL_STAT.migs||0} Graduierungen · ${clHot().length} heiß)`:(clOn?" (verbinde…)":" (aus)")},5000);
