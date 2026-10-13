/* ===== 📦 Bundle-Erkennung (nur mit eigenem Helius-Key, nur für Coins mit Alert) =====
   Frühe Swaps über Helius Enhanced Transactions (1 Abruf pro Coin, dauerhaft gecacht), Cluster = Käufer im selben Slot
   (Erstellungs-Slot bzw. ≥3 Käufer pro Slot in den ersten Slots) + gemeinsamer Fee-Payer. Bestand per RPC (≈1 Credit/Wallet),
   Neuprüfung höchstens alle 10 min, max. 25 Wallets, max. 6 h nach Alert. Ohne Key: komplett aus, keine Abrufe. */
const BD_KEY="otc_bundles",BD_Q=[];let BD_BUSY=false;
const bdKey=()=>{try{return localStorage.getItem("helius_key")||""}catch(e){return ""}};
const bdAll=()=>rLs(BD_KEY,{}),bdGet=m=>bdAll()[m];
function bdPut(m,v){const a=bdAll();a[m]={...(a[m]||{}),...v};const k=Object.keys(a);if(k.length>80)k.sort((x,y)=>(a[x].at||0)-(a[y].at||0)).slice(0,k.length-80).forEach(x=>delete a[x]);rLsSet(BD_KEY,a)}
async function bdRpc(method,params){const r=await fetch("https://mainnet.helius-rpc.com/?api-key="+encodeURIComponent(bdKey()),{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({jsonrpc:"2.0",id:1,method,params}),signal:AbortSignal.timeout(15000)});if(r.status===429)throw Error("Helius 429 (Credits/Limit)");if(r.status===401||r.status===403)throw Error("Helius-Key ungültig");const j=await r.json();if(j.error)throw Error(j.error.message);return j.result}
function bdFind(m,txs){/* Käufe des Coins aus Token-Transfers */const buys=[];for(const t of txs||[]){for(const x of t.tokenTransfers||[]){if(x.mint===m&&x.toUserAccount&&x.toUserAccount!==x.fromUserAccount&&+x.tokenAmount>0)buys.push({w:x.toUserAccount,slot:t.slot,fp:t.feePayer,amt:+x.tokenAmount})}}
 if(!buys.length)return null;const slots=[...new Set(buys.map(b=>b.slot))].sort((a,b)=>a-b);const s0=slots[0],early=new Set(slots.slice(0,4));const per={};buys.forEach(b=>{(per[b.slot]=per[b.slot]||new Set()).add(b.w)});
 const W=new Map();const add=b=>{W.set(b.w,(W.get(b.w)||0)+b.amt)};buys.forEach(b=>{if(b.slot===s0||(early.has(b.slot)&&per[b.slot].size>=3))add(b)});
 /* gemeinsamer Fee-Payer (fremder Signer zahlt für mehrere Käufer) */const fp={};buys.forEach(b=>{if(b.fp&&b.fp!==b.w)(fp[b.fp]=fp[b.fp]||new Set()).add(b.w)});Object.values(fp).forEach(s=>{if(s.size>=2)buys.filter(b=>s.has(b.w)).forEach(add)});
 if(W.size<2)return {wallets:[],bought:0,slots:slots.length};const top=[...W.entries()].sort((a,b)=>b[1]-a[1]).slice(0,25);return {wallets:top.map(x=>x[0]),bought:top.reduce((a,x)=>a+x[1],0),slots:slots.length}}
async function bdHold(m,wallets){let sum=0;for(const w of wallets){try{const r=await bdRpc("getTokenAccountsByOwner",[w,{mint:m},{encoding:"jsonParsed"}]);(r?.value||[]).forEach(v=>sum+=+(v.account.data.parsed.info.tokenAmount.uiAmount||0))}catch(e){if(/429|ungültig/.test(e.message))throw e}await new Promise(z=>setTimeout(z,120))}return sum}
async function bdRun(m){const k=bdKey();if(!k)return;let b=bdGet(m)||{};const now=Date.now();
 try{if(!b.found){const r=await fetch(`https://api.helius.xyz/v0/addresses/${m}/transactions?api-key=${encodeURIComponent(k)}&sort-order=asc&limit=100`,{signal:AbortSignal.timeout(20000)});if(r.status===429)throw Error("Helius 429 (Credits/Limit)");if(!r.ok)throw Error("Helius "+r.status);const f=bdFind(m,await r.json());b={...b,found:true,...(f||{wallets:[],bought:0})};
   const s=await bdRpc("getTokenSupply",[m]);b.supply=+(s?.value?.uiAmount||0)||1e9}
  if(b.wallets.length){const h=await bdHold(m,b.wallets);const prev=b.held;b.held=h;b.pct=h/b.supply*100;b.pctBought=b.bought/b.supply*100;b.selling=prev!=null&&h<prev*0.95;b.sold=b.bought>0&&h<b.bought*0.5}
  b.at=now;b.err="";bdPut(m,b)}catch(e){bdPut(m,{err:e.message,at:now});console.warn("Bundle",m.slice(0,6),e.message)}}
async function bdPump(){if(BD_BUSY||!BD_Q.length||!bdKey())return;BD_BUSY=true;try{const m=BD_Q.shift();await bdRun(m)}finally{BD_BUSY=false;if(typeof runRender==="function")try{runRender()}catch(e){}}}
function bdCheck(m){if(!m||/^0x/.test(m)||!bdKey())return;const b=bdGet(m);if(b&&Date.now()-(b.at||0)<10*6e4)return;if(!BD_Q.includes(m))BD_Q.push(m)}
/* Neuprüfung der Alert-Coins (max. 6 h) alle 10 min */
setInterval(()=>{if(!bdKey()||typeof stLoad!=="function")return;stLoad().filter(r=>r.src==="Live"&&Date.now()-r.at<6*36e5).slice(0,15).forEach(r=>bdCheck(r.mint))},60e3);setInterval(bdPump,20e3);
function bdText(m){const b=bdGet(m);if(!b||!b.found)return "";if(!b.wallets?.length)return "📦 Keine Bundles erkannt";if(b.pct==null)return "";const p=Math.round(b.pct);return `📦 Bundles: ${p} % halten noch`+(b.selling?", ⚠️ verkaufen gerade":b.sold?" (Großteil verkauft)":"")}
function bdDump(m,maxPct){const b=bdGet(m);return !!(b&&b.wallets?.length&&b.pct!=null&&b.pct>=(maxPct||10)&&b.selling)}
function bdBadge(m){const t=bdText(m);if(!t)return "";const b=bdGet(m);return ` <span class="bd${bdDump(m)?" red":""}" title="Helius: ${b.wallets.length} Bundle-Wallets, gekauft ${Math.round(b.pctBought||0)} %">${esc(t)}</span>`}
