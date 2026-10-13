/* ===== On-Chain-Recherche: Token, Wallet, Kauf-Analyse (statisch, ohne API-Keys) ===== */
const EP={pn:"https://solana-rpc.publicnode.com",mb:"https://api.mainnet-beta.solana.com",tt:"https://solana-mainnet.gateway.tatum.io"};
const HKEY=()=>{try{return localStorage.getItem("helius_key")||""}catch(e){return""}};
Object.defineProperty(EP,"he",{get:()=>"https://mainnet.helius-rpc.com/?api-key="+encodeURIComponent(HKEY())});
let publicFailed=false;function noteFail(){if(HKEY())return;publicFailed=true;const h=document.getElementById("keyHint");if(h)h.hidden=false}
const CAP=()=>HKEY()?{early:120,cand:40,pages:30,fpages:5,buyers:30,holders:15}:{early:40,cand:20,pages:8,fpages:2,buyers:12,holders:8};
async function heAsc(addr,limit=100,extra=""){if(!HKEY())return null;await throttle("he");const r=await fetch(`https://api.helius.xyz/v0/addresses/${addr}/transactions?api-key=${encodeURIComponent(HKEY())}&sort-order=asc&limit=${limit}${extra}`);if(!r.ok)throw new Error("Helius HTTP "+r.status);return r.json()}
async function heAsset(id){if(!HKEY())return null;try{return await sol("getAsset",{id},true,["he"])}catch(e){return null}}
const ROUTE={getTokenLargestAccounts:["tt","mb"],getTokenAccountsByOwner:["mb","pn"]};
const GAP={pn:120,mb:280,tt:450,he:40};const lastCall={};const rcache=new Map();
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const SYS="11111111111111111111111111111111";
const KNOWN_POOL=new Set(["5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1","GpMZbSM2GgvTKHJirzeGfMFoaZ8UR2X7F4v8vHTvxFbL","WLHv2UAZm6z4KyaaELi5pjdbJh6RESMva1Rnn8pJVVh","39azUYFWPz3VHgKCf3VChUwbpURdCHRxjWVowf5jUJjg"]);
async function throttle(e){for(;;){const n=Date.now(),t=(lastCall[e]||0)+GAP[e];if(n>=t){lastCall[e]=n;return}await sleep(t-n)}}
function sol(method,params,useCache=true,eps){const key=(eps||"")+method+JSON.stringify(params);if(useCache&&rcache.has(key))return rcache.get(key);
const p=(async()=>{let err;for(const e of (eps||(HKEY()?["he",...(ROUTE[method]||["pn","mb","tt"])]:(ROUTE[method]||["pn","mb","tt"])))){for(let a=0;a<3;a++){await throttle(e);try{const r=await fetch(EP[e],{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({jsonrpc:"2.0",id:1,method,params})});
if(r.status===429){await sleep(700*(a+1));continue}const j=await r.json();if(j.error){if(/429|too many/i.test(j.error.code+" "+j.error.message)){await sleep(700*(a+1));continue}throw new Error(j.error.message)}return j.result}catch(x){err=x;if(x instanceof TypeError&&a<2){await sleep(900*(a+1));continue}break}}}noteFail();throw err||new Error("RPC-Limit erreicht")})();
if(useCache){rcache.set(key,p);p.catch(()=>rcache.delete(key))}return p}
const getTx=async s=>{for(let a=0;a<3;a++){try{return await getTx0(s)}catch(e){if(a==2)throw e;rcache.delete('getTransaction'+JSON.stringify([s,{maxSupportedTransactionVersion:1,encoding:'jsonParsed',commitment:'confirmed'}]));await sleep(1500)}}};
const getTx0=async s=>{const P=[s,{maxSupportedTransactionVersion:1,encoding:"jsonParsed",commitment:"confirmed"}];return (await sol("getTransaction",P))||(await sol("getTransaction",P,true,["mb"]))};
async function pool(items,n,fn,prog){const out=[];let i=0,d=0;await Promise.all(Array.from({length:Math.min(n,items.length)},async()=>{while(i<items.length){const k=i++;try{out[k]=await fn(items[k],k)}catch(e){out[k]=null}d++;prog&&prog(d,items.length)}}));return out}
async function jget(u){const r=await fetch(u);if(!r.ok)throw new Error("HTTP "+r.status);return r.json()}
const B58=/^[1-9A-HJ-NP-Za-km-z]{32,44}$/,EVM=/^0x[0-9a-fA-F]{40}$/,BTCA=/^(bc1[a-z0-9]{20,80}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})$/;
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]);
const sh=a=>a?a.slice(0,4)+"…"+a.slice(-4):"–";
const usd=n=>n==null||isNaN(n)?"–":"$"+Number(n).toLocaleString("de-DE",{maximumFractionDigits:Number(n)<1?8:0});
const num=n=>Number(n).toLocaleString("de-DE",{maximumFractionDigits:2});
const tme=s=>s?new Date(s*1000).toLocaleString("de-DE"):"–";
const XURL={SOL:{a:a=>"https://solscan.io/account/"+a,t:a=>"https://solscan.io/token/"+a,tx:s=>"https://solscan.io/tx/"+s},ETH:{a:a=>"https://etherscan.io/address/"+a,t:a=>"https://etherscan.io/token/"+a,tx:s=>"https://etherscan.io/tx/"+s},BTC:{a:a=>"https://mempool.space/address/"+a,tx:s=>"https://mempool.space/tx/"+s}};
const wl=(a,c="SOL",full)=>a?`<a href="#" data-wallet="${esc(a)}" title="Wallet im Tool ansehen">${esc(full?a:sh(a))}</a> <a class="ext" href="${XURL[c].a(a)}" target="_blank" rel="noopener" title="Explorer">↗</a>`:"–";
const tl=(s,c="SOL")=>`<a href="#" data-tx="${esc(s)}">${esc(sh(s))}</a> <a class="ext" href="${XURL[c].tx(s)}" target="_blank" rel="noopener">↗</a>`;
const DISC=`<p class="disc">⚠️ Hinweis: Alle Bundle-, Cluster- und Rug-Signale sind heuristische Indizien aus öffentlichen Daten – <b>kein Beweis</b> für Betrug oder Absprachen. Börsen-Wallets finanzieren z. B. oft viele unabhängige Nutzer. Keine Anlageberatung.</p>`;
function keysOf(tx){return tx.transaction.message.accountKeys.map(k=>typeof k==="string"?k:k.pubkey)}
function allIx(tx){return[...tx.transaction.message.instructions,...((tx.meta&&tx.meta.innerInstructions)||[]).flatMap(i=>i.instructions)]}
function tokDeltas(tx,mint){const m=tx.meta||{},o={};const add=(b,s)=>{if(b.mint!==mint)return;const w=b.owner||"?";o[w]=(o[w]||0)+s*(+b.uiTokenAmount.uiAmountString||0)};(m.preTokenBalances||[]).forEach(b=>add(b,-1));(m.postTokenBalances||[]).forEach(b=>add(b,1));for(const k in o)if(Math.abs(o[k])<1e-9)delete o[k];return o}
function solIncoming(tx,w){for(const i of allIx(tx)){const p=i.parsed;if(i.program==="system"&&p&&p.info){const d=p.info.destination||p.info.newAccount,s=p.info.source;if(d===w&&s&&s!==w&&p.info.lamports>0)return{from:s,lamports:p.info.lamports}}}
const k=keysOf(tx),ix=k.indexOf(w),m=tx.meta;if(ix>0&&m&&m.postBalances[ix]>m.preBalances[ix])return{from:k[0],lamports:m.postBalances[ix]-m.preBalances[ix],guess:1};return null}
async function sigsBack(addr,maxPages,opts={}){let all=[],before=opts.before,complete=false,eps;for(let p=0;p<maxPages;p++){const q=[addr,{limit:1000,...(before?{before}:{}),...(opts.until?{until:opts.until}:{})}];let r=await sol("getSignaturesForAddress",q,true,eps);
if(r.length<1000&&!eps&&!HKEY()){/* publicnode hat begrenzte Historie -> mit mainnet-beta weiter prüfen */try{const before2=r.length?r[r.length-1].signature:before;const r2=await sol("getSignaturesForAddress",[addr,{limit:1000,...(before2?{before:before2}:{}),...(opts.until?{until:opts.until}:{})}],true,["mb"]);all=all.concat(r);eps=["mb"];r=r2;if(r.length){before=r[r.length-1].signature}}catch(e){all=all.concat(r);return{sigs:all,complete:false,truncated:true}}}
all=all.concat(r);if(r.length<1000){complete=true;break}before=r[r.length-1].signature;opts.prog&&opts.prog(all.length)}return{sigs:all,complete}}
async function funding(w){try{if(HKEY()){try{const h=await heAsc(w,25);for(const t of h||[]){const n=(t.nativeTransfers||[]).find(x=>x.toUserAccount===w&&x.fromUserAccount&&x.fromUserAccount!==w&&x.amount>0);if(n)return{from:n.fromUserAccount,lamports:n.amount,time:t.timestamp,sig:t.signature,complete:true}}}catch(e){}}const {sigs,complete}=await sigsBack(w,CAP().fpages);if(!sigs.length)return{none:1};const old=sigs.slice(-3).reverse();for(const s of old){const t=await getTx(s.signature);const f=t&&solIncoming(t,w);if(f)return{...f,time:t.blockTime,sig:s.signature,complete}}return{complete,unknown:1}}catch(e){return{err:e.message}}}
async function isPoolOwners(owners,pairs){const res={};const list=[...new Set(owners)];for(let i=0;i<list.length;i+=100){const ch=list.slice(i,i+100);const r=await sol("getMultipleAccounts",[ch,{encoding:"base64",dataSlice:{offset:0,length:0}}]);r.value.forEach((a,j)=>{const o=ch[j];res[o]=pairs.has(o)||KNOWN_POOL.has(o)||(a&&a.owner!==SYS)})}return res}
async function dex(addrs){const out={};for(let i=0;i<addrs.length;i+=30){try{const j=await jget("https://api.dexscreener.com/latest/dex/tokens/"+addrs.slice(i,i+30).join(","));(j.pairs||[]).sort((a,b)=>(b.liquidity?.usd||0)-(a.liquidity?.usd||0)).forEach(p=>{const k=p.baseToken.address;(out[k]=out[k]||[]).push(p)})}catch(e){}}return out}
function progress(el){const box=document.createElement("div");box.className="prog";box.innerHTML=`<div class="bar"><i></i></div><span></span>`;el.prepend(box);return{set(t,f){box.querySelector("span").textContent=t;if(f!=null)box.querySelector("i").style.width=Math.round(f*100)+"%"},done(){box.remove()}}}
const sect=(el,title,html,id)=>{let s=id&&el.querySelector("#"+id);if(!s){s=document.createElement("div");s.className="panel sub";if(id)s.id=id;el.appendChild(s)}s.innerHTML=`<h3 class="glow-s">${title}</h3>${html}`;return s};
/* ---------- Token-Analyse ---------- */
let lastAnalysis=null;
async function analyzeToken(mint,out){out.innerHTML="";if(EVM.test(mint))return analyzeEvmToken(mint,out);
const pr=progress(out);const R={mint,flags:[],sus:{}};const sus=(w,why)=>{if(!w)return;(R.sus[w]=R.sus[w]||new Set()).add(why)};
try{pr.set("Lade Token-Daten …",.05);
const [acc,dx]=await Promise.all([sol("getAccountInfo",[mint,{encoding:"jsonParsed"}]),dex([mint])]);
const info=acc&&acc.value&&acc.value.data&&acc.value.data.parsed;if(!info||info.type!=="mint")throw new Error("Das ist keine SPL-Token-Mint-Adresse.");
const mi=info.info,dec=mi.decimals,supply=Number(mi.supply)/10**dec;const meta=(mi.extensions||[]).find(e=>e.extension==="tokenMetadata");
const pairs=dx[mint]||[];const P=pairs[0];const pairSet=new Set(pairs.map(p=>p.pairAddress));
const asset=await heAsset(mint);const am=asset?.content?.metadata||{};const img=asset?.content?.links?.image;
const name=P?.baseToken.name||am.name||meta?.state.name||"Unbekannt",sym=P?.baseToken.symbol||am.symbol||meta?.state.symbol||"?";R.name=name;R.sym=sym;
const liq=pairs.reduce((a,p)=>a+(p.liquidity?.usd||0),0);
sect(out,`${img&&/^https:/.test(img)?`<img class="tokimg" src="${esc(img)}" alt="">`:""}${esc(name)} <span class="sym">($${esc(sym)})</span>`,`<div class="grid">
<div class="k">Mint</div><div class="v">${esc(mint)} <a class="ext" href="${XURL.SOL.t(mint)}" target="_blank" rel="noopener">Solscan ↗</a>${P?` <a class="ext" href="${P.url}" target="_blank" rel="noopener">DexScreener ↗</a>`:""}</div>
<div class="k">Preis</div><div class="v">${usd(P?.priceUsd)} ${P?.priceChange?.h24!=null?`(24h: ${P.priceChange.h24}%)`:""}</div>
<div class="k">Marktkap.</div><div class="v">${usd(P?.marketCap??P?.fdv)}</div>
<div class="k">Liquidität</div><div class="v">${pairs.length&&pairs.every(p=>p.dexId==="pumpfun")?"Bonding Curve":usd(liq)} · ${pairs.length} Pair(s): ${esc([...new Set(pairs.map(p=>p.dexId))].join(", ")||"–")}</div>
<div class="k">Volumen 24h</div><div class="v">${usd(pairs.reduce((a,p)=>a+(p.volume?.h24||0),0))}</div>
<div class="k">Supply</div><div class="v">${num(supply)} (Decimals ${dec})</div>
<div class="k">Mint-Authority</div><div class="v">${mi.mintAuthority?"⚠️ aktiv: "+esc(sh(mi.mintAuthority)):"✅ widerrufen"}</div>
<div class="k">Freeze-Authority</div><div class="v">${mi.freezeAuthority?"⚠️ aktiv: "+esc(sh(mi.freezeAuthority)):"✅ widerrufen"}</div>
<div class="k">Pair erstellt</div><div class="v">${P?.pairCreatedAt?new Date(P.pairCreatedAt).toLocaleString("de-DE"):"–"}</div></div>`,"t-info");
if(mi.mintAuthority)R.flags.push([3,"Mint-Authority nicht widerrufen – es können neue Token erzeugt werden."]);
if(mi.freezeAuthority)R.flags.push([2,"Freeze-Authority aktiv – Token-Konten können eingefroren werden."]);
const curve=pairs.length&&pairs.every(p=>p.dexId==="pumpfun");if(curve)R.flags.push([0,"Token handelt noch auf der pump.fun Bonding Curve (keine klassische LP, die entfernt werden kann)."]);if(!pairs.length)R.flags.push([2,"Kein DEX-Pair auf DexScreener gefunden."]);else if(!curve&&liq<1000)R.flags.push([3,`Liquidität sehr gering (${usd(liq)}) – evtl. LP entfernt / Liquidität kollabiert.`]);
if(P?.priceChange?.h24<=-80)R.flags.push([2,`Preis-Kollaps: ${P.priceChange.h24}% in 24h.`]);
// Top-Holder
pr.set("Lade Top-Holder …",.15);let holders=[];
try{const la=await sol("getTokenLargestAccounts",[mint]);const accs=la.value.slice(0,20);const ai=await sol("getMultipleAccounts",[accs.map(a=>a.address),{encoding:"jsonParsed"}]);
holders=accs.map((a,i)=>({acc:a.address,owner:ai.value[i]?.data?.parsed?.info?.owner,amt:+a.uiAmountString}));const pools=await isPoolOwners(holders.map(h=>h.owner).filter(Boolean),pairSet);holders.forEach(h=>h.pool=!!pools[h.owner])}catch(e){R.holdErr=e.message}
const realH=holders.filter(h=>!h.pool);const top10=realH.slice(0,10).reduce((a,h)=>a+h.amt,0)/supply*100;
if(holders.length){if(top10>50)R.flags.push([3,`Top-10-Holder (ohne Pools) halten ${num(top10)} % der Supply.`]);else if(top10>25)R.flags.push([2,`Top-10-Holder (ohne Pools) halten ${num(top10)} % der Supply.`])}
R.holders=holders;R.top10=top10;
// Erstellung
pr.set("Suche Erstellungs-Transaktion (älteste Signatur) …",.25);
let hs=null;try{hs=await heAsc(mint,100)}catch(e){}
const {sigs,complete,truncated}=hs&&hs.length?{sigs:hs.map(t=>({signature:t.signature,slot:t.slot,err:t.transactionError||null})).reverse(),complete:true}:await sigsBack(mint,CAP().pages,{prog:n=>pr.set(`Suche Erstellung … ${n.toLocaleString("de-DE")} Signaturen durchsucht`,.25)});
let creator=null,cSlot=null,cTime=null,cSig=null,early=[];
let cOk=false;if((complete||truncated)&&sigs.length){if(truncated)R.flags.push([0,"Die kostenlose RPC liefert nicht die komplette Historie (Fallback-RPC gesperrt/limitiert) – älteste verfügbare Tx wird verwendet, Creator & frühe Käufe evtl. ungenau."]);const chron=sigs.slice().reverse().filter(s=>!s.err);cSig=chron[0].signature;cSlot=chron[0].slot;
const N=Math.min(CAP().early,chron.length);pr.set(`Analysiere die ersten ${N} Transaktionen …`,.35);
const txs=await pool(chron.slice(0,N),HKEY()?8:3,s=>getTx(s.signature),(d,t)=>pr.set(`Analysiere frühe Transaktionen ${d}/${t} …`,.35+.3*d/t));
let ct=txs[0];if(!ct)try{ct=await getTx(cSig)}catch(e){}if(ct){creator=keysOf(ct)[0];cTime=ct.blockTime;txs[0]=ct;cOk=(ct.meta.logMessages||[]).some(l=>/Instruction: (Create|InitializeMint)/.test(l))}
txs.forEach((t,i)=>{if(!t)return;const d=tokDeltas(t,mint);for(const w in d)early.push({w,d:d[w],slot:t.slot,sig:chron[i].signature,time:t.blockTime,payer:keysOf(t)[0]})})}
else R.flags.push([0,`Token hat mehr als ${sigs.length.toLocaleString("de-DE")} Transaktionen – Erstellung & frühe Käufe wurden aus Limit-Gründen nicht vollständig analysiert.`]);
if(cOk)R.flags=R.flags.filter(f=>!/komplette Historie/.test(f[1]));if(creator&&!cOk){R.flags.push([0,"Älteste gefundene Tx enthält keine Mint-Erstellung – angezeigter Creator ist nur der früheste bekannte Akteur."]);creator=null;cSlot=null;}R.creator=creator;
// Pools in early ausfiltern
const eOwners=[...new Set(early.map(e=>e.w))];let ePool={};try{ePool=await isPoolOwners(eOwners.filter(w=>w!=="?"),pairSet)}catch(e){eOwners.forEach(w=>ePool[w]=pairSet.has(w)||KNOWN_POOL.has(w))}holders.forEach(h=>{if(h.pool)ePool[h.owner]=true})
const buys=early.filter(e=>e.d>0&&!ePool[e.w]),sells=early.filter(e=>e.d<0&&!ePool[e.w]);
const firstBuy={};buys.forEach(b=>{if(!firstBuy[b.w])firstBuy[b.w]=b});const buyers=Object.values(firstBuy);
// Bundle-Heuristiken
const bySlot={};buyers.forEach(b=>(bySlot[b.slot]=bySlot[b.slot]||[]).push(b));
buyers.forEach(b=>{if(b.w===creator)return;if(b.slot===cSlot)sus(b.w,"Kauf im selben Slot wie die Erstellung (Bundle)");else if(cSlot&&b.slot-cSlot<=2)sus(b.w,`Sniper: Kauf ${b.slot-cSlot} Slot(s) nach Erstellung`);if(bySlot[b.slot].length>=2&&b.slot!==cSlot)sus(b.w,`${bySlot[b.slot].length} frühe Käufer im selben Slot ${b.slot}`);if(b.payer!==b.w&&b.payer!==creator)sus(b.w,"Kauf von fremder Wallet bezahlt (Fee-Payer "+sh(b.payer)+")");if(b.payer===creator)sus(b.w,"Kauf vom Creator bezahlt/signiert")});
const bundleSlot=buyers.filter(b=>b.w!==creator&&b.slot===cSlot);if(bundleSlot.length)R.flags.push([3,`Bundle: ${bundleSlot.length} Wallet(s) kauften im Erstellungs-Slot.`]);
const crowded=Object.entries(bySlot).filter(([s,l])=>l.length>=3&&+s!==cSlot);if(crowded.length)R.flags.push([2,`${crowded.length} Slot(s) mit ≥3 gleichzeitigen frühen Käufern.`]);
// Funding-Cluster
const cand=[...new Set([creator,...buyers.slice(0,CAP().buyers).map(b=>b.w),...realH.slice(0,CAP().holders).map(h=>h.owner)].filter(w=>w&&w!=="?"))].slice(0,CAP().cand);
const fund={};await pool(cand,HKEY()?6:2,async w=>{fund[w]=await funding(w)},(d,t)=>pr.set(`Prüfe Finanzierungsquellen ${d}/${t} …`,.65+.25*d/t));
const byF={};for(const w in fund){const f=fund[w];if(f&&f.from)(byF[f.from]=byF[f.from]||[]).push(w)}
for(const f in byF){const l=byF[f];if(f===creator)l.forEach(w=>w!==creator&&sus(w,"Vom Creator mit SOL finanziert"));if(l.length>=2)l.forEach(w=>sus(w,`Cluster: ${l.length} Wallets von derselben Quelle ${sh(f)} finanziert`));if(cand.includes(f)&&f!==creator)l.forEach(w=>sus(w,`Finanziert von anderer verdächtiger/früher Wallet ${sh(f)}`))}
const clusters=Object.entries(byF).filter(([f,l])=>l.length>=2);if(clusters.length)R.flags.push([2,`${clusters.length} Funding-Cluster (mehrere frühe Käufer/Holder von gleicher Quelle finanziert).`]);
if(fund[creator]&&fund[creator].from&&byF[creator])R.flags.push([2,"Creator hat selbst frühe Käufer/Holder finanziert."]);
// Creator verkauft?
pr.set("Prüfe Creator-Bestand …",.92);let cNow=null;
if(creator){try{const r=await sol("getTokenAccountsByOwner",[creator,{mint},{encoding:"jsonParsed"}]);cNow=r.value.reduce((a,x)=>a+(+x.account.data.parsed.info.tokenAmount.uiAmountString||0),0)}catch(e){}
const cBought=buys.filter(b=>b.w===creator).reduce((a,b)=>a+b.d,0),cSold=-sells.filter(s=>s.w===creator).reduce((a,b)=>a+b.d,0);
R.cBought=cBought;R.cNow=cNow;if(cBought>0&&cNow!=null&&cNow<cBought*.1){R.flags.push([3,`Creator hat verkauft: ${num(cBought)} gekauft, jetzt ${num(cNow)} (${num(cBought/supply*100)} % der Supply).`]);sus(creator,"Creator – hat seinen Bestand abgestoßen")}
else if(cSold>0)R.flags.push([2,`Creator hat in den ersten Transaktionen ${num(cSold)} Token verkauft.`]);sus(creator,"Creator/Deployer")}
// Darstellung
const susList=Object.entries(R.sus);const curPct=w=>{const h=holders.find(h=>h.owner===w);return h?num(h.amt/supply*100)+" %":""};
const score=R.flags.reduce((a,f)=>a+f[0],0)+Math.min(4,susList.length/3);const level=score>=8?["HOCH","hi"]:score>=4?["MITTEL","mid"]:["NIEDRIG","lo"];
sect(out,"Risiko-Zusammenfassung",`<div class="risk ${level[1]}">Risiko: ${level[0]} <small>(Score ${num(score)})</small></div><ul class="flags">${R.flags.length?R.flags.map(f=>`<li class="w${f[0]}">${esc(f[1])}</li>`).join(""):"<li>Keine auffälligen Signale gefunden.</li>"}</ul>${DISC}`,"t-risk");
sect(out,"Creator / Deployer",creator?`<div class="grid"><div class="k">Wallet</div><div>${wl(creator,"SOL",1)}</div><div class="k">Erstellt</div><div class="v">${tme(cTime)} · Slot ${cSlot}</div><div class="k">Erstell-Tx</div><div>${tl(cSig)}</div><div class="k">Finanziert von</div><div>${fund[creator]?.from?wl(fund[creator].from)+" ("+num(fund[creator].lamports/1e9)+" SOL, "+tme(fund[creator].time)+")":"unbekannt"}</div><div class="k">Dev-Kauf / jetzt</div><div class="v">${num(R.cBought||0)} / ${cNow==null?"–":num(cNow)}</div></div>`:`<p>Creator konnte nicht sicher ermittelt werden (Historie über die kostenlose RPC unvollständig oder zu viele Transaktionen). Prüfe ggf. auf Solscan.</p>`,"t-creator");
sect(out,`Verdächtige Wallets (${susList.length})`,susList.length?`<div class="tbl"><table><tr><th>Wallet</th><th>Hält</th><th>Gründe</th></tr>${susList.sort((a,b)=>b[1].size-a[1].size).map(([w,r])=>`<tr><td>${wl(w)}</td><td>${curPct(w)}</td><td>${[...r].map(esc).join("<br>")}</td></tr>`).join("")}</table></div>`:"<p>Keine.</p>","t-sus");
sect(out,"Top-Holder",holders.length?`<p class="muted">Top-10 ohne Pools: <b>${num(top10)} %</b></p><div class="tbl"><table><tr><th>#</th><th>Besitzer</th><th>Menge</th><th>%</th><th></th></tr>${holders.map((h,i)=>`<tr><td>${i+1}</td><td>${wl(h.owner)}</td><td>${num(h.amt)}</td><td>${num(h.amt/supply*100)} %</td><td>${h.pool?"🏊 Pool/Programm":R.sus[h.owner]?"⚠️":""}</td></tr>`).join("")}</table></div>`:`<p>Top-Holder nicht verfügbar (${esc(R.holdErr||"")}).</p>`,"t-hold");
sect(out,`Frühe Käufe (erste ${buyers.length} Käufer)`,buyers.length?`<div class="tbl"><table><tr><th>Slot</th><th>Zeit</th><th>Wallet</th><th>Menge</th><th>Funder</th><th>Tx</th></tr>${buyers.map(b=>`<tr><td>${b.slot}${b.slot===cSlot?" 🎯":""}</td><td>${tme(b.time)}</td><td>${wl(b.w)}${b.w===creator?" (Creator)":""}</td><td>${num(b.d)}</td><td>${fund[b.w]?.from?wl(fund[b.w].from):"–"}</td><td>${tl(b.sig)}</td></tr>`).join("")}</table></div>`:"<p>Keine Daten.</p>","t-early");
R.fund=fund;R.supply=supply;R.buyers=buyers;R.byF=byF;R.cSlot=cSlot;R.cTime=cTime;R.name=name;R.sym=sym;lastAnalysis=R;pr.done();if(window.onTokenAnalyzed)onTokenAnalyzed(R,out);return R}
catch(e){pr.done();sect(out,"Fehler",`<p class="err">${esc(e.message)}</p>`);return R}}
async function analyzeEvmToken(a,out){const pr=progress(out);const R={flags:[],sus:{}};try{pr.set("Lade Token (Ethereum) …",.2);
const [dx,t,ad,h]=await Promise.all([dex([a]),jget("https://eth.blockscout.com/api/v2/tokens/"+a).catch(()=>null),jget("https://eth.blockscout.com/api/v2/addresses/"+a).catch(()=>null),jget("https://eth.blockscout.com/api/v2/tokens/"+a+"/holders").catch(()=>null)]);
const key=Object.keys(dx).find(k=>k.toLowerCase()===a.toLowerCase());const pairs=dx[key]||[],P=pairs[0];const dec=+(t?.decimals||18),sup=Number(t?.total_supply||0)/10**dec;const liq=pairs.reduce((s,p)=>s+(p.liquidity?.usd||0),0);
const hs=(h?.items||[]).slice(0,15).map(x=>({o:x.address.hash,c:x.address.is_contract,amt:Number(x.value)/10**dec}));const t10=hs.filter(x=>!x.c).slice(0,10).reduce((s,x)=>s+x.amt,0)/sup*100;
if(!pairs.length)R.flags.push([2,"Kein DEX-Pair gefunden."]);else if(liq<1000)R.flags.push([3,"Liquidität sehr gering ("+usd(liq)+")."]);if(t10>50)R.flags.push([3,`Top-10 (ohne Contracts) halten ${num(t10)} %.`]);else if(t10>25)R.flags.push([2,`Top-10 (ohne Contracts) halten ${num(t10)} %.`]);
const sc=R.flags.reduce((s,f)=>s+f[0],0),lv=sc>=6?["HOCH","hi"]:sc>=3?["MITTEL","mid"]:["NIEDRIG","lo"];
sect(out,`${esc(t?.name||P?.baseToken.name||"Token")} <span class="sym">($${esc(t?.symbol||P?.baseToken.symbol||"?")})</span>`,`<div class="grid"><div class="k">Contract</div><div class="v">${esc(a)} <a class="ext" href="${XURL.ETH.t(a)}" target="_blank">Etherscan ↗</a></div><div class="k">Preis</div><div class="v">${usd(P?.priceUsd)}</div><div class="k">Marktkap.</div><div class="v">${usd(P?.marketCap??P?.fdv)}</div><div class="k">Liquidität</div><div class="v">${pairs.length&&pairs.every(p=>p.dexId==="pumpfun")?"Bonding Curve":usd(liq)} · ${pairs.length} Pair(s)</div><div class="k">Holder</div><div class="v">${esc(t?.holders_count||t?.holders||"–")}</div><div class="k">Deployer</div><div>${wl(ad?.creator_address_hash,"ETH",1)}</div><div class="k">Deploy-Tx</div><div>${ad?.creation_transaction_hash?tl(ad.creation_transaction_hash,"ETH"):"–"}</div></div>`);
sect(out,"Risiko-Zusammenfassung",`<div class="risk ${lv[1]}">Risiko: ${lv[0]}</div><ul class="flags">${R.flags.map(f=>`<li class="w${f[0]}">${esc(f[1])}</li>`).join("")||"<li>Keine auffälligen Signale.</li>"}</ul><p class="muted">Bundle-/Funding-Analyse ist derzeit nur für Solana verfügbar.</p>${DISC}`);
sect(out,"Top-Holder",`<div class="tbl"><table><tr><th>#</th><th>Adresse</th><th>Menge</th><th>%</th><th></th></tr>${hs.map((x,i)=>`<tr><td>${i+1}</td><td>${wl(x.o,"ETH")}</td><td>${num(x.amt)}</td><td>${sup?num(x.amt/sup*100):"–"} %</td><td>${x.c?"📜 Contract":""}</td></tr>`).join("")}</table></div>`)}catch(e){sect(out,"Fehler",`<p class="err">${esc(e.message)}</p>`)}pr.done();return R}
/* ---------- Wallet ---------- */
const chainOf=a=>EVM.test(a)?"ETH":BTCA.test(a)?"BTC":B58.test(a)?"SOL":null;
async function walletView(a,out){out.innerHTML="";const c=chainOf(a);if(!c){sect(out,"Fehler",`<p class="err">Unbekanntes Adressformat.</p>`);return}const pr=progress(out);
try{const head=(bal,extra="")=>sect(out,`Wallet <span class="sym">${c}</span>`,`<div class="grid"><div class="k">Adresse</div><div class="v">${esc(a)} <a class="ext" href="${XURL[c].a(a)}" target="_blank" rel="noopener">Explorer ↗</a></div><div class="k">Guthaben</div><div class="v">${bal}</div>${extra}</div><button class="btn small" id="watchBtn">${isWatched(a)?"✓ Wird beobachtet":"👁 Wallet beobachten"}</button>`,"w-head");
if(c==="SOL"){pr.set("Lade Guthaben …",.1);const b=await sol("getBalance",[a]);head(num(b.value/1e9)+" SOL");
pr.set("Lade Token-Bestände …",.25);let toks=[];try{for(const pid of["TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA","TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"]){const r=await sol("getTokenAccountsByOwner",[a,{programId:pid},{encoding:"jsonParsed"}]);r.value.forEach(x=>{const i=x.account.data.parsed.info;const u=+i.tokenAmount.uiAmountString;if(u>0)toks.push({mint:i.mint,amt:u})})}}catch(e){toks.err=e.message}
const px=await dex(toks.slice(0,60).map(t=>t.mint));if(HKEY())await pool(toks.filter(t=>!px[t.mint]).slice(0,30),6,async t=>{const a=await heAsset(t.mint);t.dsym=a?.content?.metadata?.symbol;t.dpx=a?.token_info?.price_info?.price_per_token});toks.forEach(t=>{const p=px[t.mint]?.[0];t.sym=p?.baseToken.symbol||t.dsym;t.val=p?t.amt*p.priceUsd:t.dpx?t.amt*t.dpx:null});toks.sort((x,y)=>(y.val||0)-(x.val||0));
sect(out,`Token-Bestände (${toks.length})`,toks.err?`<p class="err">Token-Bestände gerade nicht abrufbar (öffentliche RPC limitiert/blockiert: ${esc(toks.err)}) – bitte später erneut versuchen.</p>`:toks.length?`<div class="tbl"><table><tr><th>Token</th><th>Menge</th><th>Wert</th><th></th></tr>${toks.slice(0,50).map(t=>`<tr><td>${esc(t.sym||sh(t.mint))}</td><td>${num(t.amt)}</td><td>${usd(t.val)}</td><td><a href="#" data-token="${t.mint}">Analysieren</a></td></tr>`).join("")}</table></div>`:"<p>Keine Token.</p>");
pr.set("Lade Transaktionen …",.5);const s=await sol("getSignaturesForAddress",[a,{limit:20}],false);
sect(out,"Letzte Transaktionen",`<div class="tbl"><table><tr><th>Zeit</th><th>Signatur</th><th>Status</th></tr>${s.map(x=>`<tr><td>${tme(x.blockTime)}</td><td>${tl(x.signature)}</td><td>${x.err?"❌ Fehler":"✅"}</td></tr>`).join("")}</table></div>`);
pr.set("Suche Finanzierungsquelle (älteste eingehende Überweisung) …",.75);const f=await funding(a);
sect(out,"Finanzierungsquelle",f.from?`<p>Erste eingehende SOL-Überweisung: <b>${num(f.lamports/1e9)} SOL</b> von ${wl(f.from,"SOL",1)} am ${tme(f.time)} ${tl(f.sig)}${f.guess?" (abgeleitet über Fee-Payer)":""}${f.complete?"":"<br><small>Hinweis: Wallet hat >2000 Transaktionen – Ergebnis ist die älteste geprüfte, nicht zwingend die erste.</small>"}</p>`:`<p>Nicht ermittelbar${f.err?" ("+esc(f.err)+")":""}.</p>`)}
else if(c==="ETH"){const B="https://eth.blockscout.com/api/v2/addresses/"+a;const [i,tb,tx,first]=await Promise.all([jget(B),jget(B+"/token-balances").catch(()=>[]),jget(B+"/transactions").catch(()=>({items:[]})),jget(`https://eth.blockscout.com/api?module=account&action=txlist&address=${a}&sort=asc&page=1&offset=10`).catch(()=>null)]);
head(wei(BigInt(i.coin_balance||0).toString(16).replace(/^/,"0x"))+" ETH",i.is_contract?`<div class="k">Typ</div><div class="v">Contract</div>`:"");
sect(out,"Token-Bestände",`<div class="tbl"><table><tr><th>Token</th><th>Menge</th><th>Wert</th></tr>${tb.filter(t=>t.token.type==="ERC-20").slice(0,40).map(t=>{const v=Number(t.value)/10**(+t.token.decimals||18);return`<tr><td>${esc(t.token.symbol||sh(t.token.address_hash))}</td><td>${num(v)}</td><td>${t.token.exchange_rate?usd(v*t.token.exchange_rate):"–"}</td></tr>`}).join("")}</table></div>`);
sect(out,"Letzte Transaktionen",`<div class="tbl"><table><tr><th>Zeit</th><th>Hash</th><th>Von → An</th><th>ETH</th></tr>${(tx.items||[]).slice(0,20).map(t=>`<tr><td>${t.timestamp?new Date(t.timestamp).toLocaleString("de-DE"):"–"}</td><td>${tl(t.hash,"ETH")}</td><td>${wl(t.from?.hash,"ETH")} → ${wl(t.to?.hash,"ETH")}</td><td>${num(Number(t.value)/1e18)}</td></tr>`).join("")}</table></div>`);
const fi=(first?.result||[]).find(t=>t.to?.toLowerCase()===a.toLowerCase()&&t.value!=="0");sect(out,"Finanzierungsquelle",fi?`<p>Erste eingehende Überweisung: <b>${num(fi.value/1e18)} ETH</b> von ${wl(fi.from,"ETH",1)} am ${tme(+fi.timeStamp)} ${tl(fi.hash,"ETH")}</p>`:"<p>Nicht ermittelbar.</p>")}
else{const B="https://mempool.space/api/address/"+a;const i=await jget(B);const cs=i.chain_stats,ms=i.mempool_stats;head(num((cs.funded_txo_sum-cs.spent_txo_sum)/1e8)+" BTC",`<div class="k">Transaktionen</div><div class="v">${cs.tx_count}${ms.tx_count?" (+"+ms.tx_count+" unbestätigt)":""}</div>`);
const tx=await jget(B+"/txs");sect(out,"Letzte Transaktionen",`<div class="tbl"><table><tr><th>Zeit</th><th>TxID</th><th>Status</th></tr>${tx.slice(0,20).map(t=>`<tr><td>${tme(t.status.block_time)}</td><td>${tl(t.txid,"BTC")}</td><td>${t.status.confirmed?"✅":"⏳"}</td></tr>`).join("")}</table></div>`);
pr.set("Suche Finanzierungsquelle …",.7);let page=tx.filter(t=>t.status.confirmed),oldest=page[page.length-1];for(let k=0;k<6&&page.length>=25;k++){page=await jget(B+"/txs/chain/"+oldest.txid);if(page.length)oldest=page[page.length-1]}
const src=oldest&&oldest.vin[0]?.prevout?.scriptpubkey_address;sect(out,"Finanzierungsquelle",oldest?`<p>Älteste gefundene Transaktion ${tl(oldest.txid,"BTC")} (${tme(oldest.status.block_time)}), Absender: ${src?wl(src,"BTC",1):"Coinbase/unbekannt"}${page.length>=25?"<br><small>Limit erreicht – evtl. nicht die erste.</small>":""}</p>`:"<p>–</p>")}
$("#watchBtn").onclick=()=>{toggleWatch(a,c);walletView(a,out)}}catch(e){sect(out,"Fehler",`<p class="err">${esc(e.message)}</p>`)}pr.done()}
/* ---------- Watchlist ---------- */
const WK="otc_watch";const getW=()=>{try{return JSON.parse(localStorage.getItem(WK))||[]}catch(e){return[]}};const setW=l=>{localStorage.setItem(WK,JSON.stringify(l));renderWatch()};
const isWatched=a=>getW().some(w=>w.addr===a);
async function latestId(a,c){if(c==="SOL")return(await sol("getSignaturesForAddress",[a,{limit:1}],false))[0]?.signature||"";if(c==="ETH")return(await jget(`https://eth.blockscout.com/api/v2/addresses/${a}/transactions`)).items?.[0]?.hash||"";return(await jget(`https://mempool.space/api/address/${a}/txs`))[0]?.txid||""}
async function toggleWatch(a,c){let l=getW();if(l.some(w=>w.addr===a))l=l.filter(w=>w.addr!==a);else{let id="";try{id=await latestId(a,c)}catch(e){}l.push({addr:a,chain:c,seen:id,last:id,checked:Date.now()})}setW(l)}
function renderWatch(){const l=getW(),el=$("#watchlist");if(!el)return;el.innerHTML=l.length?l.map(w=>`<div class="wrow ${w.last&&w.last!==w.seen?"new":""}"><span class="sym">${w.chain}</span>${w.label?`<b>${esc(w.label)}</b>`:""} ${wl(w.addr,w.chain)} ${w.last&&w.last!==w.seen?`<b class="badge">NEUE TX</b> ${tl(w.last,w.chain)}`:""}<small>geprüft ${new Date(w.checked).toLocaleTimeString("de-DE")}</small> <a href="#" data-label="${esc(w.addr)}">Label</a> <a href="#" data-unwatch="${esc(w.addr)}">entfernen</a></div>`).join(""):"<p class='muted'>Noch keine Wallets beobachtet.</p>";const n=l.filter(w=>w.last!==w.seen).length;document.title=(n?`(${n}) `:"")+"OTC TX Tracker"}
document.addEventListener("click",e=>{const a=e.target.closest("a[data-label]");if(!a)return;e.preventDefault();e.stopPropagation();const l=getW(),w=l.find(x=>x.addr===a.dataset.label);if(!w)return;const v=prompt("Label für diese Wallet (leer = keins):",w.label||"");if(v===null)return;w.label=v.trim().slice(0,40);setW(l)},true);
/* neue Tx seit Cursor holen (neueste zuerst) */
async function recentIds(a,c){if(c==="SOL")return(await sol("getSignaturesForAddress",[a,{limit:15}],false)).filter(x=>!x.err).map(x=>({id:x.signature,time:x.blockTime}));
if(c==="ETH")return((await jget(`https://eth.blockscout.com/api/v2/addresses/${a}/transactions`)).items||[]).slice(0,15).map(t=>({id:t.hash,time:t.timestamp?Date.parse(t.timestamp)/1000:null,eth:t}));
return(await jget(`https://mempool.space/api/address/${a}/txs`)).slice(0,15).map(t=>({id:t.txid,time:t.status.block_time||Date.now()/1000,btc:t}))}
async function txDetail(w,x){try{if(w.chain==="SOL"){const t=await getTx(x.id);if(!t)return{};const k=keysOf(t),i=k.indexOf(w.addr),m=t.meta;let parts=[],dir="";
if(i>=0){const d=(m.postBalances[i]-m.preBalances[i]+(i===0?m.fee:0))/1e9;if(Math.abs(d)>=0.000001){parts.push((d>0?"+":"")+fmt(d)+" SOL");dir=d>0?"in":"out"}}
const tok={};(m.preTokenBalances||[]).forEach(b=>{if(b.owner===w.addr)tok[b.mint]=(tok[b.mint]||0)-(+b.uiTokenAmount.uiAmountString||0)});(m.postTokenBalances||[]).forEach(b=>{if(b.owner===w.addr)tok[b.mint]=(tok[b.mint]||0)+(+b.uiTokenAmount.uiAmountString||0)});
const mints=Object.keys(tok).filter(k=>Math.abs(tok[k])>1e-9);let names={};if(mints.length){const px=await dex(mints);mints.forEach(k=>names[k]=px[k]?.[0]?.baseToken.symbol||sh(k))}
mints.forEach(k=>{parts.push((tok[k]>0?"+":"")+num(tok[k])+" "+names[k]);if(!dir)dir=tok[k]>0?"in":"out"});return{dir,amt:parts.join(", "),time:t.blockTime}}
if(w.chain==="ETH"){const t=x.eth;const out=t.from?.hash?.toLowerCase()===w.addr.toLowerCase();return{dir:out?"out":"in",amt:num(Number(t.value)/1e18)+" ETH",time:x.time}}
const t=x.btc;const inn=t.vout.filter(o=>o.scriptpubkey_address===w.addr).reduce((a,o)=>a+o.value,0),outv=t.vin.filter(v=>v.prevout?.scriptpubkey_address===w.addr).reduce((a,v)=>a+v.prevout.value,0);const d=(inn-outv)/1e8;return{dir:d>=0?"in":"out",amt:(d>0?"+":"")+d+" BTC",time:x.time}}catch(e){return{}}}
/* ---------- Telegram ---------- */
const TG=()=>{try{return JSON.parse(localStorage.getItem("otc_tg"))||{}}catch(e){return{}}};const setTG=o=>localStorage.setItem("otc_tg",JSON.stringify(o));
const SENT=()=>{try{return JSON.parse(localStorage.getItem("otc_tg_sent"))||[]}catch(e){return[]}};const addSent=ids=>{const s=[...SENT(),...ids].slice(-800);localStorage.setItem("otc_tg_sent",JSON.stringify(s))};
async function tgCall(token,method,body){const r=await fetch(`https://api.telegram.org/bot${encodeURIComponent(token).replace(/%3A/i,":")}/${method}`,{method:"POST",body:new URLSearchParams(Object.entries(body||{}).map(([k,v])=>[k,String(v)]))});/* form-encoded = kein CORS-Preflight (Telegram beantwortet OPTIONS nicht) */let j;try{j=await r.json()}catch(e){j={ok:false,description:"HTTP "+r.status}}if(!j.ok)throw new Error((j.error_code?j.error_code+" ":"")+(j.description||"Fehler")+(j.error_code===401?" – Bot-Token ungültig":""));return j.result}
const appUrl=q=>location.origin+location.pathname+"?"+q;
function tgText(w,x,d){const ch={SOL:"Solana",ETH:"Ethereum",BTC:"Bitcoin"}[w.chain];const dir=d.dir==="in"?"⬇️ Eingang":d.dir==="out"?"⬆️ Ausgang":"🔄 Transaktion";
return `🔔 <b>${esc(w.label||sh(w.addr))}</b> (${ch})\n${dir}${d.amt?": <b>"+esc(d.amt)+"</b>":""}\n🕒 ${esc(tme(d.time||x.time))}\n<a href="${XURL[w.chain].tx(x.id)}">Explorer</a> · <a href="${appUrl("tx="+encodeURIComponent(x.id))}">Im Tool ansehen</a> · <a href="${appUrl("wallet="+encodeURIComponent(w.addr))}">Wallet</a>`}
async function tgNotify(items){const c=TG();if(!c.on||!c.token||!c.chat||!items.length)return;const sent=new Set(SENT());items=items.filter(i=>!sent.has(i.x.id));if(!items.length)return;
try{if(items.length>5){for(const i of items.slice(0,3))await tgCall(c.token,"sendMessage",{chat_id:c.chat,text:tgText(i.w,i.x,i.d),parse_mode:"HTML",disable_web_page_preview:true});
const by={};items.slice(3).forEach(i=>{const k=i.w.label||sh(i.w.addr);by[k]=(by[k]||0)+1});await tgCall(c.token,"sendMessage",{chat_id:c.chat,parse_mode:"HTML",text:`📦 <b>+${items.length-3} weitere neue Transaktionen</b>\n`+Object.entries(by).map(([k,n])=>`• ${esc(k)}: ${n}`).join("\n")+`\n<a href="${appUrl("tab=wallet")}">Watchlist öffnen</a>`})}
else for(const i of items)await tgCall(c.token,"sendMessage",{chat_id:c.chat,text:tgText(i.w,i.x,i.d),parse_mode:"HTML",disable_web_page_preview:true});
addSent(items.map(i=>i.x.id));tgStatus("Letzter Alert gesendet: "+new Date().toLocaleTimeString("de-DE"))}catch(e){tgStatus("❌ Telegram-Fehler: "+e.message,1)}}
function tgStatus(t,err){const m=$("#tgMsg");if(m){m.textContent=t;m.className=err?"err":"ok"}}
let checking=false;
async function checkWatch(){if(checking)return;checking=true;const l=getW(),alerts=[];
for(const w of l){try{const ids=await recentIds(w.addr,w.chain);if(ids.length){const k=w.last?ids.findIndex(x=>x.id===w.last):-1;const fresh=w.last?(k<0?ids:ids.slice(0,k)):[];
for(const x of fresh.slice(0,10))alerts.push({w,x,d:await txDetail(w,x)});w.last=ids[0].id;if(!w.seen&&!fresh.length)w.seen=w.last}w.checked=Date.now()}catch(e){}await sleep(400)}
setW(l);checking=false;await tgNotify(alerts.reverse())}
/* ---------- Kauf-Analyse ---------- */
async function boughtFlow(mint,buySig,out){out.innerHTML="";const top=document.createElement("div");out.appendChild(top);const tok=document.createElement("div");out.appendChild(tok);
const pr=progress(top);try{let after=[],me=null,from=[];
if(buySig){pr.set("Lade deinen Kauf …",.1);const t=await getTx(buySig);if(!t)throw new Error("Kauf-Transaktion nicht gefunden.");const d=tokDeltas(t,mint);if(!Object.keys(d).length)throw new Error("Diese Transaktion bewegt den angegebenen Token nicht.");
const payer=keysOf(t)[0];me=d[payer]>0?payer:Object.keys(d).find(w=>d[w]>0);from=Object.keys(d).filter(w=>d[w]<0);
sect(top,"Dein Kauf",`<div class="grid"><div class="k">Tx</div><div>${tl(buySig)}</div><div class="k">Zeit</div><div class="v">${tme(t.blockTime)}</div><div class="k">Deine Wallet</div><div>${wl(me,"SOL",1)}</div><div class="k">Erhalten</div><div class="v">${num(d[me]||0)}</div><div class="k">Verkauft hat dir</div><div>${from.map(w=>wl(w)+" ("+num(-d[w])+")").join("<br>")||"–"}<br><small class="muted">Bei DEX-/pump.fun-Käufen ist das in der Regel der Liquiditätspool bzw. die Bonding Curve, nicht eine einzelne Person.</small></div></div>`)}
pr.set("Token-Analyse läuft …",.2);const R=await analyzeToken(mint,tok);
pr.set("Suche Verkäufer nach deinem Kauf …",.9);let sigs;if(buySig){sigs=(await sigsBack(mint,3,{until:buySig})).sigs.filter(s=>!s.err);sigs=sigs.slice(-40)}else sigs=(await sol("getSignaturesForAddress",[mint,{limit:40}],false)).filter(s=>!s.err);
const pairs=new Set();const txs=await pool(sigs,3,s=>getTx(s.signature),(d,n)=>pr.set(`Analysiere Verkäufe ${d}/${n} …`,.9));const agg={};
txs.forEach((t,i)=>{if(!t)return;const d=tokDeltas(t,mint);for(const w in d)if(d[w]<0){(agg[w]=agg[w]||{amt:0,n:0,sig:sigs[i].signature,time:t.blockTime});agg[w].amt-=d[w];agg[w].n++}});
let pools={};try{pools=await isPoolOwners(Object.keys(agg).filter(w=>w!=="?"),new Set((R.holders||[]).filter(h=>h.pool).map(h=>h.owner)))}catch(e){}
const rows=Object.entries(agg).filter(([w])=>!pools[w]).sort((a,b)=>b[1].amt-a[1].amt);
sect(top,buySig?"Wer hat nach deinem Kauf verkauft? (erste 40 Tx danach)":"Letzte Verkäufer (letzte 40 Tx)",rows.length?`<div class="tbl"><table><tr><th>Wallet</th><th>Verkauft</th><th>% Supply</th><th>Hinweis</th><th>Tx</th></tr>${rows.map(([w,v])=>`<tr><td>${wl(w)}</td><td>${num(v.amt)}</td><td>${R.supply?num(v.amt/R.supply*100)+" %":""}</td><td>${w===R.creator?"🚨 Creator":R.sus&&R.sus[w]?"⚠️ "+esc([...R.sus[w]][0]):""}</td><td>${tl(v.sig)}</td></tr>`).join("")}</table></div>`:"<p>Keine Verkäufe von Einzel-Wallets gefunden.</p>");
}catch(e){sect(top,"Fehler",`<p class="err">${esc(e.message)}</p>`)}pr.done()}
/* ---------- Tabs & Routing ---------- */
function setTab(t,q){document.querySelectorAll(".tabs button").forEach(b=>b.classList.toggle("on",b.dataset.tab===t));document.querySelectorAll(".tab").forEach(s=>s.hidden=s.id!=="tab-"+t);const u=new URLSearchParams(location.search);["tx","token","wallet","bought","buytx"].forEach(k=>u.delete(k));if(q)for(const k in q)if(q[k])u.set(k,q[k]);history.replaceState(null,"","?"+u.toString().replace(/=(&|$)/g,"$1"))}
async function openToken(m){setTab("token",{token:m});$("#tokIn").value=m;await analyzeToken(m,$("#tokOut"))}
async function openWallet(a){setTab("wallet",{wallet:a});$("#walIn").value=a;await walletView(a,$("#walOut"))}
function openTx(s){setTab("tx",{tx:s});$("#h").value=s;$("#f").requestSubmit()}
async function routeAddress(h){if(EVM.test(h)){let tok=false;try{const i=await jget("https://eth.blockscout.com/api/v2/addresses/"+h);tok=!!i.token}catch(e){}tok?openToken(h):openWallet(h);return true}
if(BTCA.test(h)){openWallet(h);return true}
if(B58.test(h)){let mint=false;try{const r=await sol("getAccountInfo",[h,{encoding:"jsonParsed"}]);mint=r?.value?.data?.parsed?.type==="mint"}catch(e){}mint?openToken(h):openWallet(h);return true}return false}
window.routeAddress=routeAddress;
document.addEventListener("click",e=>{const a=e.target.closest("a[data-wallet],a[data-tx],a[data-token],a[data-unwatch]");if(!a)return;e.preventDefault();if(a.dataset.wallet)openWallet(a.dataset.wallet);else if(a.dataset.tx)openTx(a.dataset.tx);else if(a.dataset.token)openToken(a.dataset.token);else{setW(getW().filter(w=>w.addr!==a.dataset.unwatch))}window.scrollTo({top:0,behavior:"smooth"})});
document.querySelectorAll(".tabs button").forEach(b=>b.onclick=()=>setTab(b.dataset.tab));
$("#tokF").onsubmit=e=>{e.preventDefault();const v=$("#tokIn").value.trim();if(!B58.test(v)&&!EVM.test(v))return $("#tokOut").innerHTML=`<p class="err panel">Ungültige Token-Adresse.</p>`;openToken(v)};
$("#walF").onsubmit=e=>{e.preventDefault();const v=$("#walIn").value.trim();if(B58.test(v)||EVM.test(v)||BTCA.test(v))return routeAddress(v);$("#walOut").innerHTML=`<p class="err panel">Ungültige Wallet-Adresse.</p>`};
$("#buyF").onsubmit=e=>{e.preventDefault();const m=$("#buyTok").value.trim(),s=$("#buyTx").value.trim();if(!B58.test(m))return $("#buyOut").innerHTML=`<p class="err panel">Bitte eine gültige Solana-Token-Mint eingeben.</p>`;if(s&&!/^[1-9A-HJ-NP-Za-km-z]{80,90}$/.test(s))return $("#buyOut").innerHTML=`<p class="err panel">Ungültige Kauf-Signatur.</p>`;setTab("bought",{bought:m,buytx:s});boughtFlow(m,s||null,$("#buyOut"))};
renderWatch();setInterval(()=>{if(getW().length&&!document.hidden)checkWatch()},60000);if(getW().length)checkWatch();
{const p=new URLSearchParams(location.search);if(p.get("tx")){setTab("tx");$("#h").value=p.get("tx");$("#f").requestSubmit()}else if(p.get("token"))openToken(p.get("token"));else if(p.get("wallet"))openWallet(p.get("wallet"));else if(p.get("bought")){$("#buyTok").value=p.get("bought");$("#buyTx").value=p.get("buytx")||"";setTab("bought");$("#buyF").requestSubmit()}else if(p.get("tab"))setTab(p.get("tab"))}

/* ---------- Einstellungen / Helius ---------- */
function renderKeyState(){const k=HKEY();const b=$("#rpcBadge");b.textContent=k?"Helius aktiv":"Öffentliches RPC";b.className="badge2 "+(k?"on":"off");$("#keyStatus").textContent=k?"Gespeicherter Key: "+k.slice(0,4)+"…"+k.slice(-4):"Kein Key gespeichert.";const h=$("#keyHint");if(h&&k)h.hidden=true}
$("#gear").onclick=()=>{$("#settings").hidden=!$("#settings").hidden};$("#setClose").onclick=()=>$("#settings").hidden=true;
$("#keySave").onclick=async()=>{const k=$("#keyIn").value.trim();const m=$("#keyMsg");if(!/^[A-Za-z0-9-]{20,64}$/.test(k)){m.className="err";m.textContent="Ungültiges Key-Format.";return}m.className="";m.textContent="Prüfe Key …";
try{const r=await fetch("https://mainnet.helius-rpc.com/?api-key="+encodeURIComponent(k),{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({jsonrpc:"2.0",id:1,method:"getSlot"})});const j=await r.json().catch(()=>({}));if(!r.ok||j.error||typeof j.result!=="number")throw new Error(j.error?.message||("HTTP "+r.status));
localStorage.setItem("helius_key",k);rcache.clear();$("#keyIn").value="";m.className="ok";m.textContent="✅ Key gültig und gespeichert (Slot "+j.result.toLocaleString("de-DE")+").";renderKeyState()}catch(e){m.className="err";m.textContent="❌ Key konnte nicht verifiziert werden: "+e.message}};
$("#keyDel").onclick=()=>{localStorage.removeItem("helius_key");rcache.clear();$("#keyMsg").className="";$("#keyMsg").textContent="Key gelöscht.";renderKeyState()};
renderKeyState();

/* Telegram-Einstellungen UI */
function renderTG(){const c=TG();$("#tgOn").checked=!!c.on;$("#tgChat").value=c.chat||"";$("#tgState").textContent=c.token?"Bot-Token gespeichert ("+c.token.split(":")[0]+":…) · Alerts "+(c.on?"AN":"AUS"):"Kein Bot-Token gespeichert."}
const tgTok=()=>$("#tgToken").value.trim()||TG().token||"";
$("#tgFind").onclick=async()=>{const t=tgTok();if(!t)return tgStatus("Bitte zuerst Bot-Token eingeben.",1);tgStatus("Suche Chat-ID …");try{const u=await tgCall(t,"getUpdates",{limit:50});const m=u.map(x=>x.message||x.edited_message).filter(m=>m&&m.chat&&m.chat.type==="private").pop();if(!m)return tgStatus("Keine private Nachricht gefunden – schreibe deinem Bot zuerst „Hallo“ und versuche es erneut.",1);$("#tgChat").value=m.chat.id;tgStatus("✅ Chat-ID gefunden: "+m.chat.id+(m.chat.first_name?" ("+m.chat.first_name+")":""))}catch(e){tgStatus("❌ "+e.message,1)}};
$("#tgTest").onclick=async()=>{const t=tgTok(),c=$("#tgChat").value.trim();if(!t||!c)return tgStatus("Bot-Token und Chat-ID benötigt.",1);try{await tgCall(t,"sendMessage",{chat_id:c,parse_mode:"HTML",text:"✅ <b>OTC TX Tracker</b>\nTestnachricht – Telegram-Alerts funktionieren."});tgStatus("✅ Testnachricht gesendet.")}catch(e){tgStatus("❌ "+e.message,1)}};
$("#tgSave").onclick=async()=>{const t=tgTok(),c=$("#tgChat").value.trim();if(!/^\d{5,}:[A-Za-z0-9_-]{20,}$/.test(t))return tgStatus("Ungültiges Bot-Token-Format (z. B. 123456:ABC…).",1);if(!/^-?\d{3,}$/.test(c))return tgStatus("Ungültige Chat-ID.",1);try{const me=await tgCall(t,"getMe");setTG({token:t,chat:c,on:$("#tgOn").checked});$("#tgToken").value="";tgStatus("✅ Gespeichert – Bot @"+me.username);renderTG()}catch(e){tgStatus("❌ "+e.message,1)}};
$("#tgDel").onclick=()=>{localStorage.removeItem("otc_tg");$("#tgToken").value="";tgStatus("Telegram-Daten gelöscht.");renderTG()};
$("#tgOn").onchange=()=>{const c=TG();if(!c.token){tgStatus("Erst Bot-Token & Chat-ID speichern.",1);$("#tgOn").checked=false;return}c.on=$("#tgOn").checked;setTG(c);renderTG()};
renderTG();
