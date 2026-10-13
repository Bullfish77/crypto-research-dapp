/* ===== Bundle-Netzwerk: Speichern, Erweitern, Graph, Monitoring (Solana) ===== */
const NK="otc_nets",NOTES="otc_net_notes",ALERTED="otc_net_alerted";
const lsGet=(k,d)=>{try{return JSON.parse(localStorage.getItem(k))??d}catch(e){return d}};const lsSet=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
const nets=()=>lsGet(NK,{});const saveNets=n=>{lsSet(NK,n);renderNet()};
let curNet=localStorage.getItem("otc_net_cur")||"";
const ROLE_C={creator:"#ff5c8a",funder:"#ffc65c",bundler:"#b18cff",sniper:"#5cffb0",funded:"#5fb8ff",member:"#5fb8ff",token:"#3aa8ff"};
const ROLE_DE={creator:"Creator",funder:"Funder",bundler:"Bundler",sniper:"Sniper",funded:"Finanziert",member:"Mitglied"};
const IGNORE_MINT=new Set(["So11111111111111111111111111111111111111112","EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v","Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB"]);
function rolesFromReasons(rs){const r=new Set();for(const x of rs){if(/Creator/.test(x))r.add("creator");else if(/Sniper/.test(x))r.add("sniper");else if(/Bundle|selben Slot|Fee-Payer|bezahlt/.test(x))r.add("bundler");else if(/Cluster|finanziert/i.test(x))r.add("bundler")}if(!r.size)r.add("member");return[...r]}
function addMember(n,a,roles,reason){const m=n.wallets[a]=n.wallets[a]||{roles:[],reasons:[],added:Date.now()};roles.forEach(r=>{if(!m.roles.includes(r))m.roles.push(r)});if(reason&&!m.reasons.includes(reason))m.reasons.push(reason);m.reasons=m.reasons.slice(-8)}
function addEdge(n,a,b,t){if(a===b)return;if(!n.edges.some(e=>e.a===a&&e.b===b&&e.t===t))n.edges.push({a,b,t})}
function newNet(name){const n=nets();if(!n[name])n[name]={wallets:{},edges:[],tokens:{},suggest:[],history:[],mon:{},created:Date.now()};saveNets(n);return n}
/* --- aus Token-Analyse speichern --- */
window.onTokenAnalyzed=(R,out)=>{if(!R||!R.mint||EVM.test(R.mint))return;const s=document.createElement("div");s.className="panel sub";s.innerHTML=`<h3 class="glow-s">Bundle-Netzwerk</h3><div class="row"><input id="netNameIn" list="netNames" placeholder="Netzwerk-Name (neu oder vorhanden)" value="${esc(curNet||("Netz "+(R.sym||sh(R.mint))))}"><datalist id="netNames">${Object.keys(nets()).map(k=>`<option value="${esc(k)}">`).join("")}</datalist><button class="btn" id="netSaveBtn">Bundle-Netzwerk speichern/erweitern</button></div><p class="muted">Speichert Creator, markierte Bundle-/Sniper-/Cluster-Wallets und gemeinsame Funder (lokal im Browser). Bestehende Netzwerke werden zusammengeführt.</p><p id="netSaveMsg"></p>`;out.appendChild(s);
s.querySelector("#netSaveBtn").onclick=()=>{const name=s.querySelector("#netNameIn").value.trim();if(!name)return;const k=saveFromAnalysis(name,R);s.querySelector("#netSaveMsg").innerHTML=`✅ ${k} Wallets in „${esc(name)}“ gespeichert. <a href="#" id="netGo">Zum Netzwerk →</a>`;s.querySelector("#netGo").onclick=e=>{e.preventDefault();openNet(name)}}};
function saveFromAnalysis(name,R){newNet(name);const all=nets(),n=all[name];let k=0;const tok=R.mint;n.tokens[tok]={name:R.name,sym:R.sym,origin:true,time:R.cTime,creator:R.creator};
if(R.creator){addMember(n,R.creator,["creator"],`Creator von ${R.sym||sh(tok)}`);addEdge(n,R.creator,tok,"create");k++}
for(const [w,rs] of Object.entries(R.sus||{})){if(w===R.creator)continue;const roles=rolesFromReasons([...rs]);addMember(n,w,roles,`${R.sym||sh(tok)}: ${[...rs][0]}`);addEdge(n,w,tok,"buy");k++}
const fund=R.fund||{};const cnt={};for(const w in fund){const f=fund[w]?.from;if(f)cnt[f]=(cnt[f]||0)+1}
for(const w in n.wallets){const f=fund[w]?.from;if(f&&(cnt[f]>=2||f===R.creator||n.wallets[f])){if(!n.wallets[f]){addMember(n,f,["funder"],`Finanzierte ${cnt[f]} Wallet(s) bei ${R.sym||sh(tok)}`);k++}else addMember(n,f,["funder"],"");addEdge(n,f,w,"fund")}}
const bySlot={};(R.buyers||[]).forEach(b=>{if(n.wallets[b.w])(bySlot[b.slot]=bySlot[b.slot]||[]).push(b.w)});Object.values(bySlot).forEach(l=>{for(let i=1;i<l.length;i++)addEdge(n,l[0],l[i],"slot")});
all[name]=n;curNet=name;localStorage.setItem("otc_net_cur",name);saveNets(all);return k}
/* --- Wallet-Scanner (gemeinsam für Erweitern, Historie, Monitoring, Replay) --- */
function parseTx(w,t,sig){const out={creates:[],buys:[],outSol:[],slot:t.slot,time:t.blockTime,sig};const k=keysOf(t),payer=k[0],m=t.meta||{};
for(const i of allIx(t)){const p=i.parsed;if(!p||!p.info)continue;if(/^initializeMint2?$/.test(p.type)&&p.info.mint&&payer===w)out.creates.push({mint:p.info.mint,slot:t.slot,time:t.blockTime,sig,creator:payer});
if(i.program==="system"&&p.type==="transfer"&&p.info.source===w&&p.info.lamports>=1e7)out.outSol.push({to:p.info.destination,lamports:p.info.lamports,sig,time:t.blockTime})}
const d={};(m.preTokenBalances||[]).forEach(b=>{if(b.owner===w)d[b.mint]=(d[b.mint]||0)-(+b.uiTokenAmount.uiAmountString||0)});(m.postTokenBalances||[]).forEach(b=>{if(b.owner===w)d[b.mint]=(d[b.mint]||0)+(+b.uiTokenAmount.uiAmountString||0)});
for(const mi in d)if(d[mi]>0&&!IGNORE_MINT.has(mi)&&!out.creates.some(c=>c.mint===mi))out.buys.push({mint:mi,amt:d[mi],slot:t.slot,time:t.blockTime,sig,w});return out}
async function scanWallet(w,{limit=25,until}={}){const sigs=(await sol("getSignaturesForAddress",[w,{limit,...(until?{until}:{})}],false)).filter(s=>!s.err);
const txs=await pool(sigs,HKEY()?6:2,s=>getTx(s.signature));const res={creates:[],buys:[],outSol:[],newest:sigs[0]?.signature||until,count:sigs.length};
txs.forEach((t,i)=>{if(!t)return;const p=parseTx(w,t,sigs[i].signature);res.creates.push(...p.creates);res.buys.push(...p.buys);res.outSol.push(...p.outSol)});return res}
const tokCache={};
async function tokInfo(mints){mints=mints.filter(m=>!tokCache[m]);if(mints.length){const px=await dex(mints);for(const m of mints){const p=(px[m]||[])[0];let name=p?.baseToken.name,sym=p?.baseToken.symbol;
if(!name){const a=await heAsset(m);name=a?.content?.metadata?.name;sym=a?.content?.metadata?.symbol}
if(!name){try{const r=await sol("getAccountInfo",[m,{encoding:"jsonParsed"}]);const md=(r?.value?.data?.parsed?.info?.extensions||[]).find(e=>e.extension==="tokenMetadata");name=md?.state.name;sym=md?.state.symbol}catch(e){}}
const pairs=px[m]||[];const liq=pairs.reduce((a,x)=>a+(x.liquidity?.usd||0),0),curve=pairs.length&&pairs.every(x=>x.dexId==="pumpfun");const mc=p?.marketCap??p?.fdv;
const rug=!pairs.length?"unbekannt (kein Pair)":(!curve&&liq<1000)||(mc!=null&&mc<4000)||(p?.priceChange?.h24<=-85)?"⚠️ wahrscheinlich ja":"nein (aktiv)";
tokCache[m]={name:name||"?",sym:sym||"?",mc,liq,curve,rug,created:p?.pairCreatedAt?p.pairCreatedAt/1000:null}}}return tokCache}
/* --- 1-Hop-Erweiterung + Token-Historie --- */
async function expandNet(name,box){const all=nets(),n=all[name];if(!n)return;const pr=progress(box);const keyed=!!HKEY();const members=Object.keys(n.wallets).slice(0,keyed?40:10);const sug={};const S=(a,role,why)=>{if(n.wallets[a])return;const s=sug[a]=sug[a]||{addr:a,roles:new Set(),why:new Set(),links:[]};s.roles.add(role);s.why.add(why)};
const hist={};let fc=0;const fcap=keyed?40:12;
try{await pool(members,keyed?4:1,async(w,i)=>{pr.set(`Analysiere Mitglied ${i+1}/${members.length} …`,(i+1)/members.length*.85);
const f=await funding(w);if(f&&f.from){S(f.from,"funder",`Finanzierte ${sh(w)} (${num(f.lamports/1e9)} SOL)`);sug[f.from]&&sug[f.from].links.push([f.from,w])}
const sc=await scanWallet(w,{limit:keyed?100:40});
sc.creates.forEach(c=>{(hist[c.mint]=hist[c.mint]||{mint:c.mint,by:new Set(),kind:new Set(),time:c.time,slots:[]}).by.add(w);hist[c.mint].kind.add("erstellt")});
sc.buys.forEach(b=>{const h=hist[b.mint]=hist[b.mint]||{mint:b.mint,by:new Set(),kind:new Set(),time:b.time,slots:[]};h.by.add(w);h.slots.push(b.slot);h.time=Math.min(h.time||1e12,b.time||1e12)});
const rec=[...new Set(sc.outSol.map(o=>o.to))].filter(r=>!n.wallets[r]).slice(0,6);for(const r of rec){if(fc>=fcap)break;fc++;const rf=await funding(r);if(rf&&rf.from===w){S(r,"funded",`Frische Wallet – erste Finanzierung von ${sh(w)}`);sug[r].links.push([w,r])}}});
for(const [a,s] of Object.entries(sug)){const k=Object.values(sug).length;if(s.roles.has("funder")&&s.why.size<2&&!s.roles.has("funded"))s.weak=true}
n.suggest=Object.values(sug).map(s=>({addr:s.addr,roles:[...s.roles],why:[...s.why],links:s.links,weak:!!s.weak})).sort((a,b)=>b.why.length-a.why.length);
const H=Object.values(hist).filter(h=>h.kind.has("erstellt")||h.by.size>=2&&(Math.max(...h.slots)-Math.min(...h.slots)<=5));pr.set("Lade Token-Infos …",.92);await tokInfo(H.map(h=>h.mint));
n.history=H.map(h=>({mint:h.mint,by:[...h.by],kind:h.kind.has("erstellt")?"erstellt":"gemeinsamer Früh-Kauf (≤5 Slots)",time:h.time,...tokCache[h.mint]}));
H.forEach(h=>{if(!n.tokens[h.mint])n.tokens[h.mint]={name:tokCache[h.mint]?.name,sym:tokCache[h.mint]?.sym,time:h.time};h.by.forEach(w=>addEdge(n,w,h.mint,h.kind.has("erstellt")?"create":"buy"))});
all[name]=n;saveNets(all)}catch(e){box.insertAdjacentHTML("beforeend",`<p class="err">${esc(e.message)}</p>`)}pr.done()}
/* --- Graph (Canvas, Force-Layout, Touch) --- */
const G={nodes:[],edges:[],scale:1,ox:0,oy:0,sel:null};
const LAYOUT={};
function buildGraph(n){const ids={};const nodes=[];const toks=Object.keys(n.tokens||{});const tAng={};toks.forEach((t,i)=>tAng[t]=i/Math.max(1,toks.length)*Math.PI*2);const big=Object.keys(n.wallets).length+toks.length>40;const R0=big?Math.max(300,toks.length*40):200;
const home={};for(const e of n.edges){if(tAng[e.b]!=null&&home[e.a]==null)home[e.a]=e.b;if(tAng[e.a]!=null&&home[e.b]==null)home[e.b]=e.a}for(const [a,m] of Object.entries(n.wallets))if(home[a]==null&&m.src?.[0]){const t=toks.find(t=>n.tokens[t].sym===m.src[0]);if(t)home[a]=t}
const add=(id,type,roles,label)=>{if(ids[id])return ids[id];let x=Math.random()*400-200,y=Math.random()*400-200;const t=type==="token"?id:home[id];if(big&&t!=null&&tAng[t]!=null){const a=tAng[t];x=Math.cos(a)*R0+(type==="token"?0:Math.random()*160-80);y=Math.sin(a)*R0+(type==="token"?0:Math.random()*160-80)}const o={id,type,roles,label,x,y,vx:0,vy:0};ids[id]=o;nodes.push(o);return o};
for(const [a,m] of Object.entries(n.wallets))add(a,"wallet",m.roles,sh(a));for(const [t,i] of Object.entries(n.tokens||{}))add(t,"token",["token"],"$"+(i.sym||sh(t)));
const edges=n.edges.filter(e=>ids[e.a]&&ids[e.b]).map(e=>({a:ids[e.a],b:ids[e.b],t:e.t}));
const key=nodes.length+":"+edges.length+":"+(n.created||0);const L=LAYOUT[key];if(L){nodes.forEach(o=>{if(L[o.id]){o.x=L[o.id][0];o.y=L[o.id][1]}})}else{
const N=nodes.length,IT=N>300?120:N>120?200:500,cut=big?250*250:1e12,grav=big?.0015:.004;
for(let it=0;it<IT;it++){const k=1-it/IT;for(let i=0;i<N;i++){const A=nodes[i];for(let j=i+1;j<N;j++){const B=nodes[j];let dx=A.x-B.x,dy=A.y-B.y,d2=dx*dx+dy*dy+.01;if(d2>cut)continue;const f=3000/d2,d=Math.sqrt(d2);dx*=f/d;dy*=f/d;A.vx+=dx;A.vy+=dy;B.vx-=dx;B.vy-=dy}}
for(const e of edges){const dx=e.b.x-e.a.x,dy=e.b.y-e.a.y,d=Math.sqrt(dx*dx+dy*dy)+.01,f=(d-90)*.02;e.a.vx+=dx/d*f;e.a.vy+=dy/d*f;e.b.vx-=dx/d*f;e.b.vy-=dy/d*f}
for(const o of nodes){o.vx-=o.x*grav;o.vy-=o.y*grav;o.x+=Math.max(-20,Math.min(20,o.vx))*k;o.y+=Math.max(-20,Math.min(20,o.vy))*k;o.vx*=.6;o.vy*=.6}}
const C={};nodes.forEach(o=>C[o.id]=[o.x,o.y]);LAYOUT[key]=C}
G.big=big;G.nodes=nodes;G.edges=edges;fitGraph()}
function fitGraph(){const c=$("#netCanvas");if(!c||!G.nodes.length)return;const w=c.clientWidth,h=c.clientHeight;const xs=G.nodes.map(n=>n.x),ys=G.nodes.map(n=>n.y);const bw=Math.max(...xs)-Math.min(...xs)+80,bh=Math.max(...ys)-Math.min(...ys)+80;G.scale=Math.min(2,Math.min(w/bw,h/bh));G.ox=w/2-(Math.max(...xs)+Math.min(...xs))/2*G.scale;G.oy=h/2-(Math.max(...ys)+Math.min(...ys))/2*G.scale;drawGraph()}
function drawGraph(){const c=$("#netCanvas");if(!c)return;const dpr=devicePixelRatio||1,w=c.clientWidth,h=c.clientHeight;c.width=w*dpr;c.height=h*dpr;const x=c.getContext("2d");x.setTransform(dpr,0,0,dpr,0,0);x.clearRect(0,0,w,h);
const P=o=>[o.x*G.scale+G.ox,o.y*G.scale+G.oy];
for(const e of G.edges){const [ax,ay]=P(e.a),[bx,by]=P(e.b);x.beginPath();x.moveTo(ax,ay);x.lineTo(bx,by);x.setLineDash(e.t==="slot"?[4,4]:[]);x.strokeStyle=e.t==="fund"?"rgba(255,198,92,.7)":e.t==="create"?"rgba(255,92,138,.8)":e.t==="slot"?"rgba(177,140,255,.7)":"rgba(95,184,255,.55)";x.lineWidth=e.t==="fund"?2:1.4;x.shadowColor=x.strokeStyle;x.shadowBlur=G.big?0:6;x.stroke()}x.setLineDash([]);
for(const o of G.nodes){const [px,py]=P(o);const r=(o.type==="token"?13:9)*Math.max(.7,Math.min(1.4,G.scale));x.save();x.translate(px,py);x.beginPath();if(o.type==="token")for(let i=0;i<6;i++){const a=i*Math.PI/3;x.lineTo(Math.cos(a)*r,Math.sin(a)*r)}else x.arc(0,0,r,0,7);x.closePath();
const col=ROLE_C[o.roles[0]]||"#5fb8ff";x.fillStyle=col;x.shadowColor=col;x.shadowBlur=o===G.sel?30:G.big?0:14;x.fill();if(o.roles.length>1){x.lineWidth=3;x.strokeStyle=ROLE_C[o.roles[1]]||"#fff";x.stroke()}if(o===G.sel){x.lineWidth=2;x.strokeStyle="#fff";x.stroke()}x.restore();
x.font=`${o.type==="token"?"bold ":""}11px monospace`;x.fillStyle="#cfeaff";x.textAlign="center";if(!G.big||o.type==="token"||o===G.sel||G.scale>1.2)x.fillText(o.label,px,py+r+12)}}
function hit(mx,my){let best=null,bd=22*22;for(const o of G.nodes){const px=o.x*G.scale+G.ox,py=o.y*G.scale+G.oy,d=(px-mx)**2+(py-my)**2;if(d<bd){bd=d;best=o}}return best}
function initGraphUI(){const c=$("#netCanvas");if(!c||c._init)return;c._init=1;let pts=new Map(),moved=false,start=null,pinch=null;
c.addEventListener("pointerdown",e=>{c.setPointerCapture(e.pointerId);pts.set(e.pointerId,[e.offsetX,e.offsetY]);moved=false;start=[e.offsetX,e.offsetY,G.ox,G.oy];if(pts.size===2){const [a,b]=[...pts.values()];pinch={d:Math.hypot(a[0]-b[0],a[1]-b[1]),s:G.scale,ox:G.ox,oy:G.oy,cx:(a[0]+b[0])/2,cy:(a[1]+b[1])/2}}});
c.addEventListener("pointermove",e=>{if(!pts.has(e.pointerId))return;pts.set(e.pointerId,[e.offsetX,e.offsetY]);if(pts.size===2&&pinch){const [a,b]=[...pts.values()];const ns=Math.max(.2,Math.min(5,pinch.s*Math.hypot(a[0]-b[0],a[1]-b[1])/pinch.d));G.ox=pinch.cx-(pinch.cx-pinch.ox)*ns/pinch.s;G.oy=pinch.cy-(pinch.cy-pinch.oy)*ns/pinch.s;G.scale=ns;moved=true;drawGraph();return}
const dx=e.offsetX-start[0],dy=e.offsetY-start[1];if(Math.abs(dx)+Math.abs(dy)>5)moved=true;if(moved){G.ox=start[2]+dx;G.oy=start[3]+dy;drawGraph()}});
const up=e=>{pts.delete(e.pointerId);if(pts.size<2)pinch=null;if(!moved&&e.type==="pointerup"){const o=hit(e.offsetX,e.offsetY);G.sel=o;drawGraph();showNode(o)}};c.addEventListener("pointerup",up);c.addEventListener("pointercancel",up);
c.addEventListener("wheel",e=>{e.preventDefault();const f=e.deltaY<0?1.15:1/1.15,ns=Math.max(.2,Math.min(5,G.scale*f));G.ox=e.offsetX-(e.offsetX-G.ox)*ns/G.scale;G.oy=e.offsetY-(e.offsetY-G.oy)*ns/G.scale;G.scale=ns;drawGraph()},{passive:false});
$("#gIn").onclick=()=>{G.scale*=1.25;drawGraph()};$("#gOut").onclick=()=>{G.scale/=1.25;drawGraph()};$("#gFit").onclick=fitGraph;addEventListener("resize",()=>drawGraph())}
function showNode(o){const el=$("#gInfo");if(!o){el.innerHTML="<span class='muted'>Tippe auf einen Knoten für Details.</span>";return}const n=nets()[curNet];
if(o.type==="token"){const t=n.tokens[o.id]||{};el.innerHTML=`<b>Token $${esc(t.sym||"?")}</b> ${esc(t.name||"")} · <a href="#" data-token="${o.id}">Analysieren</a> · <a class="ext" href="https://solscan.io/token/${o.id}" target="_blank" rel="noopener">Solscan ↗</a>`}
else{const m=n.wallets[o.id];el.innerHTML=`<b>${m.roles.map(r=>ROLE_DE[r]||r).join(", ")}</b> ${wl(o.id,"SOL",1)}<br><small>${m.reasons.map(esc).join(" · ")}</small>`}}
/* --- Monitoring --- */
let monTimer=null,monBusy=false;const recentBuys={};const cInfoCache={};
async function creationInfo(mint){if(cInfoCache[mint])return cInfoCache[mint];const r=await sigsBack(mint,1);if(!r.complete||!r.sigs.length)return cInfoCache[mint]={unknown:true};const o=r.sigs[r.sigs.length-1];let creator=null;try{const t=await getTx(o.signature);creator=keysOf(t)[0]}catch(e){}return cInfoCache[mint]={slot:o.slot,time:o.blockTime,creator,sig:o.signature}}
async function evaluate(name,n,w,p,{replay}={}){const hits=[];const now=Date.now()/1000;const maxAge=replay?1e12:3600;
for(const c of p.creates){if(now-(c.time||now)>maxAge)continue;hits.push({mint:c.mint,creator:c.creator,time:c.time,inv:[{w,what:"hat erstellt"}]})}
for(const b of p.buys){const rb=recentBuys[b.mint]=recentBuys[b.mint]||{};rb[b.w]=b;const ci=await creationInfo(b.mint);if(ci.unknown||now-ci.time>maxAge)continue;const inv=Object.values(rb).filter(x=>n.wallets[x.w]);const early=inv.filter(x=>x.slot-ci.slot<=20);
if(inv.length>=2||early.length>=1||n.wallets[ci.creator])hits.push({mint:b.mint,creator:ci.creator,time:ci.time,inv:inv.map(x=>({w:x.w,what:`kaufte ${x.slot-ci.slot} Slot(s) nach Erstellung`})).concat(n.wallets[ci.creator]&&!inv.some(x=>x.w===ci.creator)?[{w:ci.creator,what:"hat erstellt"}]:[])})}
for(const h of hits)await alertNew(name,n,h)}
async function alertNew(name,n,h){const al=lsGet(ALERTED,[]);if(al.includes(h.mint))return false;lsSet(ALERTED,[...al,h.mint].slice(-500));await tokInfo([h.mint]);const t=tokCache[h.mint]||{};
const invTxt=h.inv.map(i=>`• <code>${esc(sh(i.w))}</code> (${esc((n.wallets[i.w]?.roles||["?"]).map(r=>ROLE_DE[r]||r).join("/"))}) – ${esc(i.what)}`).join("\n");
const base=location.origin+location.pathname;
const text=`🚨 <b>Neuer Coin aus Bundle-Netzwerk ${esc(name)}</b>\n<b>${esc(t.name||"?")}</b> ($${esc(t.sym||"?")})\nMint: <code>${h.mint}</code>\nCreator: <code>${esc(h.creator||"?")}</code>\nBeteiligt:\n${invTxt}\n🕒 Erstellt: ${esc(tme(h.time))}\n💰 MCap: ${esc(usd(t.mc))} · Liquidität: ${t.curve?"Bonding Curve":esc(usd(t.liq))}\n<a href="https://pump.fun/coin/${h.mint}">pump.fun</a> · <a href="https://dexscreener.com/solana/${h.mint}">DexScreener</a> · <a href="https://solscan.io/token/${h.mint}">Solscan</a> · <a href="${base}?token=${h.mint}">Im Tool analysieren</a>`;
const notes=lsGet(NOTES,[]);notes.unshift({at:Date.now(),net:name,mint:h.mint,name:t.name,sym:t.sym,creator:h.creator,inv:h.inv,time:h.time,mc:t.mc,tg:"–"});
const c=TG();if(c.on&&c.token&&c.chat){try{await tgCall(c.token,"sendMessage",{chat_id:c.chat,text,parse_mode:"HTML",disable_web_page_preview:true});notes[0].tg="✅ gesendet"}catch(e){notes[0].tg="❌ "+e.message}}else notes[0].tg="Telegram aus";
lsSet(NOTES,notes.slice(0,50));renderNotes();return true}
async function monTick(){if(monBusy||document.hidden&&!HKEY())return;monBusy=true;const all=nets();const cap=HKEY()?30:8;
try{for(const [name,n] of Object.entries(all)){if(!n.monitor)continue;const allW=Object.keys(n.wallets);const st=(n.rr||0)%Math.max(1,allW.length);const ws=allW.length<=cap?allW:[...allW.slice(st),...allW].slice(0,cap);n.rr=st+ws.length;for(const w of ws){try{const last=n.mon[w];if(!last){const s=await sol("getSignaturesForAddress",[w,{limit:1}],false);n.mon[w]=s[0]?.signature||"none";continue}
const sc=await scanWallet(w,{limit:15,until:last==="none"?undefined:last});if(sc.newest)n.mon[w]=sc.newest;if(sc.creates.length||sc.buys.length)await evaluate(name,n,w,sc)}catch(e){}}n.lastPoll=Date.now()}lsSet(NK,all)}finally{monBusy=false;const st=$("#monState");if(st)st.textContent=monStatus()}}
function monStatus(){const on=Object.entries(nets()).filter(([k,n])=>n.monitor);return on.length?`🟢 Überwachung aktiv für ${on.map(([k])=>k).join(", ")} · Intervall ${HKEY()?30:90}s · ${on.map(([k,n])=>{const c=Object.keys(n.wallets).length,cap=HKEY()?30:8;return c>cap?k+': '+c+' Wallets rotierend ('+cap+'/Runde, voller Durchlauf ≈ '+Math.ceil(c/cap)*(HKEY()?30:90)/60+' min)':''}).filter(Boolean).join(', ')} · letzte Prüfung ${on[0][1].lastPoll?new Date(on[0][1].lastPoll).toLocaleTimeString("de-DE"):"–"}`:"⚪ Überwachung aus"}
function startMon(){clearInterval(monTimer);if(Object.values(nets()).some(n=>n.monitor)){monTimer=setInterval(monTick,(HKEY()?30:90)*1000);monTick()}}
/* Replay-Test: historische Tx als „neu“ behandeln */
async function replayTest(name,wallet,sig){const n=nets()[name];const t=await getTx(sig);const p=parseTx(wallet,t,sig);p.creates.forEach(c=>{const al=lsGet(ALERTED,[]).filter(m=>m!==c.mint);lsSet(ALERTED,al)});p.buys.forEach(b=>{lsSet(ALERTED,lsGet(ALERTED,[]).filter(m=>m!==b.mint))});await evaluate(name,n,wallet,p,{replay:true});return p}
window.NET={replayTest,parseTx,scanWallet,nets,evaluate};
/* --- Rendering Tab --- */
function renderNotes(){const el=$("#netNotes");if(!el)return;const l=lsGet(NOTES,[]);el.innerHTML=l.length?l.map(x=>`<div class="note"><b>🚨 ${esc(x.name||"?")} ($${esc(x.sym||"?")})</b> · Netz ${esc(x.net)} · ${new Date(x.at).toLocaleString("de-DE")}<br><code>${esc(x.mint)}</code> · <a href="#" data-token="${x.mint}">Analysieren</a> · <a class="ext" href="https://pump.fun/coin/${x.mint}" target="_blank" rel="noopener">pump.fun ↗</a><br><small>${x.inv.map(i=>esc(sh(i.w))+" "+esc(i.what)).join(" · ")} · MCap ${usd(x.mc)} · Telegram: ${esc(x.tg)}</small></div>`).join(""):"<p class='muted'>Noch keine Funde.</p>"}
function openNet(name){if(name){curNet=name;localStorage.setItem("otc_net_cur",name)}setTab("network",{});renderNet()}
function renderNet(){const el=$("#netBody");if(!el)return;const all=nets();const names=Object.keys(all);if(!curNet||!all[curNet])curNet=names[0]||"";const sel=$("#netSel");sel.innerHTML=names.map(k=>`<option ${k===curNet?"selected":""}>${esc(k)}</option>`).join("")||"<option value=''>– kein Netzwerk –</option>";
const n=all[curNet];$("#monState").textContent=monStatus();renderNotes();if(!n){el.innerHTML="<p class='muted'>Noch kein Netzwerk. Analysiere einen Token und klicke „Bundle-Netzwerk speichern/erweitern“ – oder lege eines an.</p>";G.nodes=[];drawGraph();return}
$("#monBtn").textContent=n.monitor?"⏸ Überwachung stoppen":"▶ Überwachung starten";
const W=Object.entries(n.wallets);el.innerHTML=`
<div class="legend">${Object.entries(ROLE_DE).filter(([k])=>k!=="member").map(([k,v])=>`<span><i style="background:${ROLE_C[k]}"></i>${v}</span>`).join("")}<span><i class="hexi"></i>Token</span><span>— Funding · ┄ gleicher Slot</span></div>
<div class="gwrap"><canvas id="netCanvas"></canvas><div class="gbtn"><button class="btn small" id="gIn">+</button><button class="btn small" id="gOut">−</button><button class="btn small" id="gFit">⤢</button></div></div><div id="gInfo" class="ginfo"></div>
<div class="panel sub"><h3 class="glow-s">Mitglieder (${W.length})</h3><div class="tbl"><table><tr><th>Wallet</th><th>Rolle</th><th>Gründe</th><th></th></tr>${W.map(([a,m])=>`<tr><td>${wl(a)}</td><td>${m.roles.map(r=>`<span class="rtag" style="border-color:${ROLE_C[r]};color:${ROLE_C[r]}">${ROLE_DE[r]||r}</span>`).join(" ")}</td><td><small>${m.reasons.map(esc).join("<br>")}</small></td><td><a href="#" data-rm="${a}">✕</a></td></tr>`).join("")}</table></div></div>
<div class="panel sub"><h3 class="glow-s">Vorschläge (1-Hop)</h3><div id="expBox"></div>${n.suggest?.length?`<div class="tbl"><table><tr><th>Wallet</th><th>Rolle</th><th>Gründe</th><th></th></tr>${n.suggest.map((s,i)=>`<tr><td>${wl(s.addr)}</td><td>${s.roles.map(r=>ROLE_DE[r]||r).join(", ")}${s.weak?" <small class='muted'>(schwach)</small>":""}</td><td><small>${s.why.map(esc).join("<br>")}</small></td><td><a href="#" data-acc="${i}">＋ Übernehmen</a></td></tr>`).join("")}</table></div><a href="#" data-accall="1">Alle starken übernehmen</a>`:"<p class='muted'>Noch keine – „Netzwerk erweitern“ klicken.</p>"}</div>
<div class="panel sub"><h3 class="glow-s">Token-Historie des Netzwerks</h3>${n.history?.length?`<div class="tbl"><table><tr><th>Token</th><th>Art</th><th>Datum</th><th>MCap</th><th>Liquidität</th><th>Rug?</th><th>Mitglieder</th></tr>${n.history.map(h=>`<tr><td><a href="#" data-token="${h.mint}">${esc(h.sym||sh(h.mint))}</a> <small>${esc(h.name||"")}</small></td><td>${esc(h.kind)}</td><td>${tme(h.time)}</td><td>${usd(h.mc)}</td><td>${h.curve?"Bonding Curve":usd(h.liq)}</td><td>${esc(h.rug||"?")}</td><td>${h.by.map(w=>esc(sh(w))).join(", ")}</td></tr>`).join("")}</table></div>`:"<p class='muted'>Wird beim Erweitern ermittelt (Tokens, die Mitglieder erstellt oder gemeinsam früh gekauft haben – in den zuletzt geprüften Transaktionen).</p>"}</div>`;
initGraphUI();buildGraph(n);showNode(null);requestAnimationFrame(()=>setTimeout(fitGraph,30));const cv=$("#netCanvas");if(window.ResizeObserver&&cv){let lw=0;new ResizeObserver(()=>{if(cv.clientWidth!==lw){lw=cv.clientWidth;fitGraph()}}).observe(cv)}}
document.addEventListener("click",e=>{const a=e.target.closest("a[data-rm],a[data-acc],a[data-accall]");if(!a)return;e.preventDefault();const all=nets(),n=all[curNet];if(!n)return;
if(a.dataset.rm){delete n.wallets[a.dataset.rm];delete n.mon[a.dataset.rm];n.edges=n.edges.filter(x=>x.a!==a.dataset.rm&&x.b!==a.dataset.rm)}
const acc=s=>{addMember(n,s.addr,s.roles,s.why[0]);(s.links||[]).forEach(([x,y])=>addEdge(n,x,y,"fund"))};
if(a.dataset.acc){const s=n.suggest[+a.dataset.acc];if(s){acc(s);n.suggest.splice(+a.dataset.acc,1)}}if(a.dataset.accall){n.suggest.filter(s=>!s.weak).forEach(acc);n.suggest=n.suggest.filter(s=>s.weak)}saveNets(all)});
$("#netSel").onchange=e=>{curNet=e.target.value;localStorage.setItem("otc_net_cur",curNet);renderNet()};
$("#netNew").onclick=()=>{const v=prompt("Name des neuen Netzwerks:");if(v&&v.trim()){curNet=v.trim();newNet(curNet);localStorage.setItem("otc_net_cur",curNet);renderNet()}};
$("#netDel").onclick=()=>{if(!curNet||!confirm(`Netzwerk „${curNet}“ löschen?`))return;const all=nets();delete all[curNet];curNet="";saveNets(all)};
$("#netAdd").onclick=()=>{const v=$("#netAddIn").value.trim();if(!B58.test(v)||!curNet)return;const all=nets();addMember(all[curNet],v,["member"],"manuell hinzugefügt");$("#netAddIn").value="";saveNets(all)};
$("#netExp").onclick=async()=>{if(!curNet)return;$("#netExp").disabled=true;await expandNet(curNet,$("#expBox")||$("#netBody"));$("#netExp").disabled=false};
$("#monBtn").onclick=()=>{const all=nets(),n=all[curNet];if(!n)return;n.monitor=!n.monitor;n.autoMon=n.monitor;saveNets(all);startMon()};
document.querySelector('.tabs button[data-tab="network"]').addEventListener("click",()=>setTimeout(renderNet,0));
/* --- Preset-Netzwerke (mitgeliefert) --- */
const PRESETS=[{file:"networks/runner-net-2026-10-13.json",name:"Läufer-Netzwerk (3 Tage)"}];
async function importPreset(pr,force){try{const r=await fetch(pr.file,{cache:"no-cache"});if(!r.ok)return;const d=await r.json();const all=nets();const ex=all[pr.name];const pv=lsGet("otc_preset_ver",{});if(ex&&!force&&pv[pr.name]===d.version)return;
const n=ex||{wallets:{},edges:[],tokens:{},suggest:[],history:[],mon:{},created:Date.now()};n.preset=pr.file;for(const [a,m] of Object.entries(d.wallets||{})){const o=n.wallets[a]=n.wallets[a]||{roles:[],reasons:[],added:Date.now()};m.roles.forEach(x=>{if(!o.roles.includes(x))o.roles.push(x)});m.reasons.forEach(x=>{if(!o.reasons.includes(x))o.reasons.push(x)});o.src=[...new Set([...(o.src||[]),...(m.src||[])])]}
(d.edges||[]).forEach(e=>addEdge(n,e.a,e.b,e.t));Object.assign(n.tokens,d.tokens||{});if(n.autoMon!==false){const c=TG();if(c.token&&c.chat){n.monitor=true;n.autoMon=true}}all[pr.name]=n;pv[pr.name]=d.version;lsSet("otc_preset_ver",pv);if(!curNet){curNet=pr.name;localStorage.setItem("otc_net_cur",pr.name)}saveNets(all);startMon();return Object.keys(d.wallets||{}).length}catch(e){console.warn("Preset",e)}}
async function presetsOnLoad(){for(const pr of PRESETS)await importPreset(pr,false);const all=nets();let ch=false;for(const pr of PRESETS){const n=all[pr.name];if(n&&!n.monitor&&n.autoMon!==false){const c=TG();if(c.token&&c.chat){n.monitor=true;n.autoMon=true;ch=true}}}if(ch){saveNets(all);startMon()}}
$("#presetBtn").onclick=async()=>{$("#presetBtn").disabled=true;let k=0;for(const pr of PRESETS)k+=await importPreset(pr,true)||0;$("#presetBtn").disabled=false;$("#monState").textContent=`✅ ${k} Wallets aus Preset importiert/aktualisiert. `+monStatus()};
renderNet();startMon();presetsOnLoad();
{const p=new URLSearchParams(location.search);if(p.get("tab")==="network")setTimeout(renderNet,50)}
