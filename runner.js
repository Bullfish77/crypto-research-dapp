/* Läufer-Signale: erkennt Coins, die "laufen" (Volumen-/Käufer-Momentum) – separat von Launch-Alerts. Keine Finanzberatung. */
const RUN_CFG="otc_run_cfg",RUN_LIST="otc_run_list",RUN_STATE="otc_run_state",RUN_ANA="otc_run_ana",RUN_LOG="otc_run_log";
const RUN_DEF={on:true,minLvl:2,cooldownMin:30,interval:45,minLiq:10000,minMc:15000,lvl:[40,55,70,85],gateMc:[15000,40000,100000,250000],turn5:0.05,turn1h:0.5,minTx5:40,buyRatio:0.6,maxAvgTrade:1500,feed:true,feedAlert:true,feedMax:60};
const LVL_TXT=["–","🟢","🟢🟢","🟢🟢🟢","🟢🟢🟢🟢"];
const LVL_DESC=["Kein Signal","🟢 Erwacht: Score ≥ {0}, MCap ≥ {g0} – erstes Momentum","🟢🟢 Momentum: Score ≥ {1}, MCap ≥ {g1} – Volumen + Käuferdruck steigen","🟢🟢🟢 Läuft: Score ≥ {2}, MCap ≥ {g2}, Liquidität ≥ 25k $ oder graduiert","🟢🟢🟢🟢 Runner: Score ≥ {3}, MCap ≥ {g3}, Liquidität ≥ 50k $ – starkes, beschleunigendes Volumen"];
const rLs=(k,d)=>{try{return JSON.parse(localStorage.getItem(k))??d}catch(e){return d}},rLsSet=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
const runCfg=()=>({...RUN_DEF,...rLs(RUN_CFG,{})});
const kfmt=v=>v==null||isNaN(v)?"?":"$"+(v>=1e6?(v/1e6).toFixed(2)+"M":v>=1e3?(v/1e3).toFixed(1)+"k":Math.round(v));
const pfmt=v=>v==null?"?":(v>0?"+":"")+Number(v).toFixed(1)+"%";
const ageTxt=ms=>{if(!ms)return"?";const m=(Date.now()-ms)/6e4;return m<60?Math.round(m)+" min":m<2880?(m/60).toFixed(1)+" h":Math.round(m/1440)+" d"};
/* Bewertung eines DexScreener-Pairs (reine Funktion, testbar) */
function runScore(p,c,ana){c=c||RUN_DEF;const mc=p.marketCap||p.fdv||0,liq=p.liquidity?.usd||0,v5=p.volume?.m5||0,v1=p.volume?.h1||0,v24=p.volume?.h24||0;
const t5=p.txns?.m5||{},t1=p.txns?.h1||{},b5=t5.buys||0,s5=t5.sells||0,n5=b5+s5,b1=t1.buys||0,s1=t1.sells||0,n1=b1+s1;
const pc5=p.priceChange?.m5||0,pc1=p.priceChange?.h1||0;const pts=[],warn=[];let s=0;const add=(v,why)=>{if(v){s+=v;pts.push((v>0?"+":"")+v+" "+why)}};
if(mc>0){const r5=v5/mc,r1=v1/mc;add(Math.round(Math.min(20,r5/c.turn5*12)),"Vol 5m/MCap "+(r5*100).toFixed(1)+"%");add(Math.round(Math.min(15,r1/c.turn1h*10)),"Vol 1h/MCap "+(r1*100).toFixed(0)+"%")}
if(liq>0&&p.dexId!=="pumpfun"){const lt=v1/liq;add(Math.round(Math.min(10,lt*8)),"Vol 1h/Liquidität ×"+lt.toFixed(1))}
const acc=v1>0?v5*12/v1:0;if(v5>500){if(acc>=2)add(12,"Volumen beschleunigt ×"+acc.toFixed(1));else if(acc>=1.2)add(7,"Volumen steigt ×"+acc.toFixed(1));else if(acc<0.5)add(-6,"Volumen flacht ab")}
const avg5=n5?v5/n5:0;const txAcc=n1>0?n5*12/n1:0;if(n5>=20&&avg5<5){add(-15,"Mikro-Trades Ø "+kfmt(avg5)+" (Bot-Spam)");warn.push("Fake-Txns (Mikro-Trades)")}else if(n5>=c.minTx5)add(Math.min(12,Math.round(6+n5/c.minTx5*2)),n5+" Txns/5m");else if(n5>=c.minTx5/3)add(3,n5+" Txns/5m");if(txAcc>=1.5&&n5>=10)add(5,"Txn-Zahl wächst ×"+txAcc.toFixed(1));
const br5=n5?b5/n5:0,br1=n1?b1/n1:0;if(n5>=10){if(br5>=c.buyRatio)add(Math.round(Math.min(12,(br5-0.5)*40)),"Käufe "+Math.round(br5*100)+"% (5m)");else if(br5<0.42)add(-8,"Verkaufsdruck "+Math.round((1-br5)*100)+"% Sells")}
if(n1>=30&&br1>=0.55)add(5,"Käufe "+Math.round(br1*100)+"% (1h)");
if(pc5>3)add(Math.min(8,Math.round(pc5/3)),"Preis 5m "+pfmt(pc5));else if(pc5<-15)add(-6,"Preis 5m "+pfmt(pc5));
if(pc1>10)add(Math.min(10,Math.round(pc1/15)+2),"Preis 1h "+pfmt(pc1));else if(pc1<-30)add(-8,"Preis 1h "+pfmt(pc1));
if(liq>=c.minLiq){add(liq>=50000?6:3,"Liquidität "+kfmt(liq))}else if(p.dexId!=="pumpfun"){add(-10,"Liquidität < "+kfmt(c.minLiq));warn.push("geringe Liquidität")}
const grad=/pump$/.test(p.baseToken?.address||"")&&p.dexId!=="pumpfun";if(grad)add(5,"pump.fun graduiert ("+p.dexId+")");if(p.dexId==="pumpfun")pts.push("auf Bonding Curve");
if(p.boosts?.active)pts.push("DexScreener-Boost "+p.boosts.active+" (bezahlt, kein Qualitätsmerkmal)");
if(p.info?.socials?.length)add(2,"Socials vorhanden");
/* Wash-Trading / Manipulation */
const avg1=n1?v1/n1:0;if(v1>20000&&n1<60){add(-15,"hohes Volumen bei wenigen Txns");warn.push("Wash-Trading-Verdacht")}else if(avg1>c.maxAvgTrade&&mc<1e6){add(-8,"Ø Trade "+kfmt(avg1)+" (wenige große Trades)");warn.push("Ø Trade ungewöhnlich groß")}
if(n5>=40&&br5>0.97){add(-6,"fast nur Käufe (Bot-Verdacht)");warn.push("Bot-Käufe")}
if(mc>0&&v24/mc>40){add(-8,"24h-Volumen "+Math.round(v24/mc)+"× MCap");warn.push("Volumen unplausibel hoch")}
if(liq>0&&mc>0&&liq/mc<0.03&&p.dexId!=="pumpfun"){add(-6,"Liquidität nur "+(liq/mc*100).toFixed(1)+"% der MCap");warn.push("dünne Liquidität")}
if(ana){if(ana.top10>50){add(-10,"Top-10 halten "+Math.round(ana.top10)+"%");warn.push("Top-10 "+Math.round(ana.top10)+"%")}else if(ana.top10>0&&ana.top10<25)add(4,"Top-10 nur "+Math.round(ana.top10)+"%");(ana.flags||[]).forEach(f=>{if(/bundle|selben slot/i.test(f))warn.push("Bundle");if(/creator.*verkauf|verkauft/i.test(f))warn.push("Creator verkauft")})}
s=Math.max(0,Math.min(100,Math.round(s)));let lvl=0;c.lvl.forEach((t,i)=>{if(s>=t)lvl=i+1});let g=0;c.gateMc.forEach((t,i)=>{if(mc>=t)g=i+1});if(g>=3&&!(liq>=25000||grad))g=2;if(g>=4&&liq<50000)g=3;if(liq<c.minLiq&&p.dexId!=="pumpfun")g=Math.min(g,1);
return{score:s,lvl:Math.min(lvl,g),mc,liq,v5,v1,b5,s5,pc5,pc1,grad,pts,warn:[...new Set(warn)]}}
/* Quellen: Netzwerk-Funde + manuelle Liste + analysierte Coins */
function runSources(){const m={};const put=(mint,src,extra)=>{if(!mint||/^0x/.test(mint))return;(m[mint]=m[mint]||{mint,src:new Set(),inv:[]}).src.add(src);if(extra)Object.assign(m[mint],extra)};
rLs("otc_net_notes",[]).forEach(n=>put(n.mint,"Netzwerk "+(n.net||""),{inv:n.inv||[],net:n.net}));rLs(RUN_LIST,[]).forEach(x=>put(x,"manuell"));Object.keys(rLs(RUN_ANA,{})).forEach(x=>put(x,"analysiert"));
Object.entries(rLs("otc_nets",{})).forEach(([nm,n])=>{Object.keys(n.tokens||{}).forEach(x=>put(x,"Netzwerk "+nm,{net:nm}));(n.history||[]).forEach(h=>put(h.mint,"Netzwerk "+nm,{net:nm,inv:(h.by||[]).map(w=>({w,what:h.kind||"Mitglied"}))}))});
const hide=new Set(rLs("otc_run_hide",[]));if(runCfg().feed)runFeedList.forEach(x=>{if(!m[x]&&!hide.has(x))put(x,"Auto-Feed",{feed:true})});return Object.values(m)}
let runFeedList=[],runFeedAt=0,runGeckoAt=0,runLoading=true;
async function runFeedLoad(){const c=runCfg();if(!c.feed)return;const set=new Set(),add=a=>{if(a&&!/^0x/.test(a)&&a!=="So11111111111111111111111111111111111111112")set.add(a)};const j=u=>fetch(u).then(r=>r.ok?r.json():null).catch(()=>null);
const ds=await Promise.all(["token-boosts/top/v1","token-boosts/latest/v1","token-profiles/latest/v1"].map(x=>j("https://api.dexscreener.com/"+x)));ds.forEach(l=>(l||[]).forEach(x=>x.chainId==="solana"&&add(x.tokenAddress)));
if(Date.now()-runGeckoAt>120000){runGeckoAt=Date.now();const g=await Promise.all(["trending_pools","new_pools"].map(x=>j("https://api.geckoterminal.com/api/v2/networks/solana/"+x)));runFeedGecko=[];g.forEach(r=>(r?.data||[]).forEach(p=>{const id=p.relationships?.base_token?.data?.id||"";runFeedGecko.push(id.replace(/^solana_/,""))}))}
runFeedGecko.forEach(add);runFeedList=[...set].slice(0,c.feedMax);runFeedAt=Date.now()}
let runFeedGecko=[];
/* Analyse-Ergebnisse (Top-10, Flags) mitschneiden */
if(typeof analyzeToken==="function"){const _at=analyzeToken;analyzeToken=async function(mint,out){const R=await _at(mint,out);try{if(R&&R.mint&&!/^0x/.test(R.mint)){const a=rLs(RUN_ANA,{});a[R.mint]={top10:R.top10,flags:(R.flags||[]).filter(f=>f[0]>=2).map(f=>String(f[1])).slice(0,8),at:Date.now()};const k=Object.keys(a);if(k.length>60)delete a[k[0]];rLsSet(RUN_ANA,a)}}catch(e){}return R}}
let runData={},runTimer=null,runBusy=false,runLast=0;
async function runFetch(mints){const out={};for(let i=0;i<mints.length;i+=30){const b=mints.slice(i,i+30);try{const r=await fetch("https://api.dexscreener.com/latest/dex/tokens/"+b.join(","));const j=await r.json();(j.pairs||[]).filter(p=>p.chainId==="solana").forEach(p=>{const a=p.baseToken.address;if(!b.includes(a))return;if(!out[a]||(p.liquidity?.usd||0)>(out[a].liquidity?.usd||0))out[a]=p})}catch(e){}if(i+30<mints.length)await new Promise(r=>setTimeout(r,400))}return out}
async function runTick(force){if(runBusy)return;runBusy=true;try{const c=runCfg();await runFeedLoad();const src=runSources();const mints=src.map(s=>s.mint).slice(0,300);if(!mints.length){runLoading=false;runRender();return}
const pairs=await runFetch(mints);const ana=rLs(RUN_ANA,{});const st=rLs(RUN_STATE,{});runLast=Date.now();
for(const s of src){const p=pairs[s.mint];if(!p){runData[s.mint]={...s,none:true};continue}const r=runScore(p,c,ana[s.mint]);if(s.inv?.length)r.warn.push("aus Bundle-Netzwerk");runData[s.mint]={...s,p,r};
const o=st[s.mint]||{max:0,at:0};if(r.lvl>o.max&&r.lvl>=c.minLvl&&(!s.feed||c.feedAlert)&&Date.now()-o.at>c.cooldownMin*6e4*(o.max?1:0)){const ok=await runAlert(s,p,r);st[s.mint]={max:r.lvl,at:Date.now(),tg:ok}}else if(r.lvl>o.max&&r.lvl<c.minLvl){st[s.mint]={...o,max:o.max}}}
rLsSet(RUN_STATE,st);runLoading=false;runRender()}finally{runBusy=false;runLoading=false}}
async function runAlert(s,p,r){const c=TG();const t=p.baseToken,m=t.address,base=location.origin+location.pathname;
const inv=(s.inv||[]).slice(0,6).map(i=>`• <code>${esc(i.w)}</code> – ${esc(i.what||"")}`).join("\n");
const risk=r.warn.length?"⚠️ "+r.warn.map(esc).join(" · "):"keine Auffälligkeiten erkannt";
const text=`${LVL_TXT[r.lvl]} <b>LÄUFER: ${esc(t.name)} ($${esc(t.symbol)})</b>\nMint: <code>${m}</code>\n💰 MCap: ${kfmt(r.mc)} · Liquidität: ${p.dexId==="pumpfun"?"Bonding Curve":kfmt(r.liq)}\n📊 Vol 5m: ${kfmt(r.v5)} · 1h: ${kfmt(r.v1)}\n🛒 5m: ${r.b5} Buys / ${r.s5} Sells\n📈 Preis 5m: ${pfmt(r.pc5)} · 1h: ${pfmt(r.pc1)}\n🕒 Alter: ${ageTxt(p.pairCreatedAt)} · DEX: ${esc(p.dexId)}${r.grad?" (graduiert)":""}\n⭐ Score: ${r.score}/100\nQuelle: ${esc([...s.src].join(", "))}${inv?"\nNetzwerk-Wallets:\n"+inv:""}\n${risk}\n<a href="https://pump.fun/coin/${m}">pump.fun</a> · <a href="https://dexscreener.com/solana/${m}">DexScreener</a> · <a href="https://solscan.io/token/${m}">Solscan</a> · <a href="${base}?token=${m}">Im Tool</a>\n<i>Keine Finanzberatung.</i>`;
const log=rLs(RUN_LOG,[]);let ok="Telegram aus";if(c.on&&c.token&&c.chat){try{await tgCall(c.token,"sendMessage",{chat_id:c.chat,text,parse_mode:"HTML",disable_web_page_preview:true});ok="✅ gesendet"}catch(e){ok="❌ "+e.message}}
log.unshift({at:Date.now(),mint:m,name:t.name,sym:t.symbol,lvl:r.lvl,score:r.score,tg:ok});rLsSet(RUN_LOG,log.slice(0,40));return ok}
function runRender(){const el=$("#runBody");if(!el)return;const c=runCfg();const srcSet=new Set(runSources().map(s=>s.mint));const rows=Object.values(runData).filter(x=>srcSet.has(x.mint)&&!(x.feed&&(x.none||!x.r||x.r.score<15))).sort((a,b)=>(b.r?.score??-1)-(a.r?.score??-1));
$("#runState").textContent=(runTimer?"▶ aktiv":"⏸ pausiert")+` · ${rows.length} Coins · Intervall ${c.interval}s`+(runLast?" · zuletzt "+new Date(runLast).toLocaleTimeString("de-DE"):"");
el.innerHTML=!rows.length&&runLoading?'<p class="muted">⏳ Lade Coins von DexScreener &amp; GeckoTerminal …</p>':rows.length?rows.map(x=>{if(x.none)return`<div class="runrow"><div><b>${esc(x.mint.slice(0,6))}…</b> <span class="muted">keine DexScreener-Daten</span></div><button class="btn small" data-rdel="${x.mint}">✕</button></div>`;const r=x.r,t=x.p.baseToken;
return`<div class="runrow lv${r.lvl}"><div class="runmain"><div><span class="lvl">${LVL_TXT[r.lvl]}</span> <b>${esc(t.name)}</b> ($${esc(t.symbol)}) <span class="score">${r.score}</span></div>
<div class="small muted">MCap ${kfmt(r.mc)} · Liq ${x.p.dexId==="pumpfun"?"Curve":kfmt(r.liq)} · Vol 5m ${kfmt(r.v5)} / 1h ${kfmt(r.v1)} · ${r.b5}B/${r.s5}S · 5m ${pfmt(r.pc5)} · 1h ${pfmt(r.pc1)} · ${ageTxt(x.p.pairCreatedAt)} · ${esc([...x.src].join(", "))}</div>
${r.warn.length?`<div class="small warn">⚠️ ${r.warn.map(esc).join(" · ")}</div>`:""}<details class="small"><summary>Score-Details</summary>${r.pts.map(esc).join("<br>")}</details></div>
<div class="runbtn"><a class="btn small" href="?token=${t.address}">Analyse</a><a class="btn small" target="_blank" rel="noopener" href="https://dexscreener.com/solana/${t.address}">DS</a><button class="btn small" data-rdel="${t.address}">✕</button></div></div>`}).join(""):'<p class="muted">Noch keine Coins. Quellen: Auto-Feed (DexScreener Boosts/Profile, GeckoTerminal Trending/Neu – unter ⚙ Läufer-Einstellungen aktivierbar), Bundle-Netzwerke, analysierte Coins und deine Liste „Token beobachten“.</p>';
el.querySelectorAll("[data-rdel]").forEach(b=>b.onclick=()=>{const m=b.dataset.rdel;rLsSet(RUN_LIST,rLs(RUN_LIST,[]).filter(x=>x!==m));const a=rLs(RUN_ANA,{});delete a[m];rLsSet(RUN_ANA,a);delete runData[m];if(runFeedList.includes(m))rLsSet("otc_run_hide",[...rLs("otc_run_hide",[]),m].slice(-300));runRender()});
const log=rLs(RUN_LOG,[]);$("#runLog").innerHTML=log.length?log.map(l=>`<div class="small">${new Date(l.at).toLocaleString("de-DE")} · ${LVL_TXT[l.lvl]} <b>${esc(l.name)}</b> ($${esc(l.sym)}) · Score ${l.score} · ${esc(l.tg)}</div>`).join(""):'<p class="muted small">Noch keine Läufer-Alerts.</p>';
$("#runLevels").innerHTML=LVL_DESC.slice(1).map(d=>"<li>"+esc(d.replace(/\{(\d)\}/g,(_,i)=>c.lvl[i]).replace(/\{g(\d)\}/g,(_,i)=>kfmt(c.gateMc[i])))+"</li>").join("")}
function runStart(){runStop();const c=runCfg();if(!c.on)return runRender();runTick();runTimer=setInterval(runTick,Math.max(30,c.interval)*1000);runRender()}
function runStop(){if(runTimer)clearInterval(runTimer);runTimer=null}
function runCfgUI(){const c=runCfg();const f=$("#runCfg");f.querySelector("[name=on]").checked=c.on;f.querySelector("[name=feed]").checked=c.feed;f.querySelector("[name=feedAlert]").checked=c.feedAlert;["minLvl","cooldownMin","interval","minLiq","minMc","turn5","turn1h","minTx5","buyRatio","maxAvgTrade"].forEach(k=>f.querySelector(`[name=${k}]`).value=c[k]);f.querySelector("[name=lvl]").value=c.lvl.join(",");f.querySelector("[name=gateMc]").value=c.gateMc.join(",")}
$("#runCfg").onsubmit=e=>{e.preventDefault();const f=e.target,o={on:f.on.checked,feed:f.feed.checked,feedAlert:f.feedAlert.checked};["minLvl","cooldownMin","interval","minLiq","minMc","turn5","turn1h","minTx5","buyRatio","maxAvgTrade"].forEach(k=>{const v=parseFloat(f[k].value);if(!isNaN(v))o[k]=v});
const l=f.lvl.value.split(",").map(Number);if(l.length===4&&l.every(x=>!isNaN(x)))o.lvl=l;const g=f.gateMc.value.split(",").map(Number);if(g.length===4&&g.every(x=>!isNaN(x)))o.gateMc=g;o.gateMc&&(o.gateMc[0]=Math.max(o.gateMc[0],o.minMc||0));rLsSet(RUN_CFG,o);$("#runCfgMsg").textContent="✅ Gespeichert.";runStart()};
$("#runReset").onclick=()=>{localStorage.removeItem(RUN_CFG);runCfgUI();$("#runCfgMsg").textContent="Standardwerte wiederhergestellt.";runStart()};
$("#runAddF").onsubmit=e=>{e.preventDefault();const v=$("#runAdd").value.trim();if(!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(v)){$("#runAdd").value="";return alert("Bitte eine gültige Solana-Mint-Adresse eingeben.")}const l=rLs(RUN_LIST,[]);if(!l.includes(v))rLsSet(RUN_LIST,[...l,v]);$("#runAdd").value="";runTick(true)};
$("#runNow").onclick=()=>runTick(true);$("#runToggle").onclick=()=>{const c=rLs(RUN_CFG,{});c.on=!runTimer;rLsSet(RUN_CFG,c);runCfgUI();c.on?runStart():(runStop(),runRender())};
runCfgUI();runStart();
