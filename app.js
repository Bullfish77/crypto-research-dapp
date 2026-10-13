const $=s=>document.querySelector(s);
const ETH_RPCS=["https://ethereum-rpc.publicnode.com","https://cloudflare-eth.com","https://eth.llamarpc.com"];
(()=>{const c=$("#bg"),x=c.getContext("2d");let st=[];function r(){c.width=innerWidth;c.height=innerHeight;st=Array.from({length:250},()=>[Math.random()*c.width,Math.random()*c.height,Math.random()*1.5,Math.random()*6])}r();onresize=r;
(function f(t){x.fillStyle="#02040c";x.fillRect(0,0,c.width,c.height);for(const s of st){x.globalAlpha=.4+.6*Math.abs(Math.sin(t/900+s[3]));x.fillStyle="#bfe3ff";x.fillRect(s[0],s[1],s[2],s[2])}x.globalAlpha=1;requestAnimationFrame(f)})(0)})();
const short=h=>h&&h.length>20?h.slice(0,10)+"…"+h.slice(-8):(h||"–");
function msg(t,err){const m=$("#msg");m.textContent=t;m.className=err?"err":""}
async function rpc(method,params){let last;for(const u of ETH_RPCS){try{const r=await fetch(u,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({jsonrpc:"2.0",id:1,method,params})});const j=await r.json();if(j.error)throw new Error(j.error.message);return j.result}catch(e){last=e}}throw last||new Error("RPC nicht erreichbar")}
const wei=(h,d=18)=>{const v=BigInt(h||0),b=10n**BigInt(d);const i=v/b,f=(v%b).toString().padStart(d,"0").slice(0,8).replace(/0+$/,"");return i+(f?"."+f:"")};
async function fetchEth(h){const tx=await rpc("eth_getTransactionByHash",[h]);if(!tx)throw new Error("Transaktion nicht gefunden (Ethereum Mainnet).");
const [rc,bn]=await Promise.all([rpc("eth_getTransactionReceipt",[h]),rpc("eth_blockNumber",[])]);let time=null,conf=0,status="Ausstehend (Mempool)";
if(tx.blockNumber){const b=await rpc("eth_getBlockByNumber",[tx.blockNumber,false]);time=new Date(parseInt(b.timestamp,16)*1000);conf=parseInt(bn,16)-parseInt(tx.blockNumber,16)+1;status=rc&&rc.status==="0x0"?"Fehlgeschlagen":"Bestätigt"}
let fee="–";if(rc){const gp=BigInt(rc.effectiveGasPrice||tx.gasPrice||0)*BigInt(rc.gasUsed);fee=wei("0x"+gp.toString(16))+" ETH"}
const to=tx.to||(rc&&rc.contractAddress);return{chain:"ETH",hash:h,amount:wei(tx.value)+" ETH",fee,status,conf,time,from:tx.from,to,
txUrl:"https://etherscan.io/tx/"+h,addr:a=>"https://etherscan.io/address/"+a,note:tx.to?"":"(Contract-Erstellung)"}}
async function fetchBtc(h){const B="https://mempool.space/api";const r=await fetch(`${B}/tx/${h}`);if(r.status===404||r.status===400)throw new Error("Transaktion nicht gefunden (Bitcoin).");if(!r.ok)throw new Error("mempool.space Fehler "+r.status);const tx=await r.json();
let conf=0;if(tx.status.confirmed){const tip=+(await (await fetch(`${B}/blocks/tip/height`)).text());conf=tip-tx.status.block_height+1}
const ad=o=>o&&(o.scriptpubkey_address||(o.scriptpubkey_type==="p2pk"?o.scriptpubkey.slice(2,-2):null));tx.vout.forEach(o=>o.scriptpubkey_address=ad(o));tx.vin.forEach(v=>v.prevout&&(v.prevout.scriptpubkey_address=ad(v.prevout)));const ins=new Set(tx.vin.map(v=>v.prevout&&v.prevout.scriptpubkey_address).filter(Boolean));
const outs=tx.vout.filter(o=>o.scriptpubkey_address);const cand=outs.filter(o=>!ins.has(o.scriptpubkey_address));const best=(cand.length?cand:outs).sort((a,b)=>b.value-a.value)[0];
const tot=tx.vout.reduce((s,o)=>s+o.value,0);const sender=tx.vin[0].is_coinbase?"Coinbase (neu geschürft)":(tx.vin[0].prevout?.scriptpubkey_address||"–");
return{chain:"BTC",hash:h,amount:(best?best.value/1e8:tot/1e8)+" BTC",total:tot/1e8+" BTC",fee:(tx.fee||0)/1e8+" BTC",status:tx.status.confirmed?"Bestätigt":"Ausstehend (Mempool)",conf,time:tx.status.block_time?new Date(tx.status.block_time*1000):null,
from:sender,to:best&&best.scriptpubkey_address,txUrl:"https://mempool.space/tx/"+h,addr:a=>"https://mempool.space/address/"+a}}
const SOL_RPCS=["https://solana-rpc.publicnode.com","https://api.mainnet-beta.solana.com"];
async function srpc(method,params){let last;for(const u of (localStorage.getItem("helius_key")?["https://mainnet.helius-rpc.com/?api-key="+encodeURIComponent(localStorage.getItem("helius_key")),...SOL_RPCS]:SOL_RPCS)){try{const r=await fetch(u,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({jsonrpc:"2.0",id:1,method,params})});const j=await r.json();if(j.error)throw new Error(j.error.message);return j.result}catch(e){last=e}}throw last||new Error("Solana-RPC nicht erreichbar")}
const fmt=n=>(+n.toFixed(9)).toLocaleString("en-US",{maximumFractionDigits:9}).replace(/,/g,"");
async function fetchSol(sig){const [tx,ss]=await Promise.all([srpc("getTransaction",[sig,{maxSupportedTransactionVersion:1,encoding:"jsonParsed",commitment:"confirmed"}]),srpc("getSignatureStatuses",[[sig],{searchTransactionHistory:true}]).catch(()=>null)]);
if(!tx)throw new Error("Transaktion nicht gefunden (Solana Mainnet).");const m=tx.meta||{},msg=tx.transaction.message;
const keys=msg.accountKeys.map(k=>typeof k==="string"?k:k.pubkey);const payer=keys[0];
const ins=[...msg.instructions,...(m.innerInstructions||[]).flatMap(i=>i.instructions)];
const tr=ins.filter(i=>i.program==="system"&&i.parsed&&/^transfer/.test(i.parsed.type));
let amount,from=payer,to=null,kind="";
const st=ss&&ss.value&&ss.value[0];const fin=st&&st.confirmationStatus==="finalized";
if(tr.length){const f=tr[0].parsed.info;from=f.source||f.from||payer;to=f.destination||f.to;const lam=tr.filter(i=>(i.parsed.info.destination)===to).reduce((a,i)=>a+i.parsed.info.lamports,0);amount=fmt(lam/1e9)+" SOL"}
else{const pre={},post={};(m.preTokenBalances||[]).forEach(b=>pre[b.accountIndex]=b);(m.postTokenBalances||[]).forEach(b=>post[b.accountIndex]=b);
const d=Object.keys({...pre,...post}).map(i=>{const a=post[i]||pre[i];const v=(+(post[i]?.uiTokenAmount.uiAmountString||0))-(+(pre[i]?.uiTokenAmount.uiAmountString||0));return{v,owner:a.owner,mint:a.mint}}).filter(x=>x.v);
if(d.length){d.sort((a,b)=>b.v-a.v);const rx=d[0],sx=d[d.length-1];to=rx.owner;if(sx.v<0)from=sx.owner;amount=fmt(rx.v)+" Token ("+rx.mint.slice(0,4)+"…"+rx.mint.slice(-4)+")";kind="SPL-Token-Transfer"}
else{amount="0 SOL";kind="kein Transfer erkannt"}}
return{chain:"SOL",hash:sig,amount,fee:fmt((m.fee||0)/1e9)+" SOL",status:m.err?"Fehlgeschlagen":"Bestätigt",conf:st?(st.confirmations??0):0,confText:fin?"finalized":st?(st.confirmations??0)+" Bestätigungen ("+st.confirmationStatus+")":"",
time:tx.blockTime?new Date(tx.blockTime*1000):null,from,to,txUrl:"https://solscan.io/tx/"+sig,addr:a=>"https://solscan.io/account/"+a,note:kind?"("+kind+")":""}}
let skip=false;
function play(d){if(new URLSearchParams(location.search).has("noanim")){document.body.classList.add("noanim");return Promise.resolve()}return new Promise(res=>{const st=$("#stage");st.hidden=false;const c=$("#anim");c.width=1280;c.height=720;const x=c.getContext("2d");skip=false;
const W=1280,H=720,cx=640,cy=380,R=230,D=9500,t0=performance.now();const stars=Array.from({length:300},()=>[Math.random()*W,Math.random()*H,Math.random()*1.6]);
const A={x:150,y:520},B={x:1130,y:520};
const glowText=(t,X,Y,s,al=1)=>{x.save();x.globalAlpha=al;x.font=`700 ${s}px "Segoe UI",Arial`;x.textAlign="center";const g=x.createLinearGradient(0,Y-s,0,Y);g.addColorStop(0,"#fff");g.addColorStop(.45,"#9fdcff");g.addColorStop(.6,"#2f8fff");g.addColorStop(1,"#cdeeff");x.shadowColor="#1e90ff";x.shadowBlur=22;x.fillStyle=g;x.fillText(t,X,Y);x.shadowBlur=6;x.fillText(t,X,Y);x.restore()};
const proj=(la,lon,rot)=>{const lo=lon+rot;return{x:cx+R*Math.cos(la)*Math.sin(lo),y:cy-R*Math.sin(la),z:Math.cos(la)*Math.cos(lo)}};
function line(pts){x.beginPath();let first=true;for(const p of pts){if(p.z<0){first=true;continue}first?x.moveTo(p.x,p.y):x.lineTo(p.x,p.y);first=false}x.stroke()}
function globe(rot){x.save();const g=x.createRadialGradient(cx,cy,R*.2,cx,cy,R*1.25);g.addColorStop(0,"rgba(10,40,110,.35)");g.addColorStop(.8,"rgba(10,60,180,.12)");g.addColorStop(1,"rgba(0,0,0,0)");x.fillStyle=g;x.beginPath();x.arc(cx,cy,R*1.25,0,7);x.fill();
x.lineWidth=1;x.strokeStyle="rgba(80,170,255,.55)";x.shadowColor="#1e90ff";x.shadowBlur=6;const rad=Math.PI/180;
for(let i=-75;i<=75;i+=15){const p=[];for(let j=0;j<=360;j+=5)p.push(proj(i*rad,j*rad,rot));line(p)}
for(let j=0;j<360;j+=15){const p=[];for(let i=-90;i<=90;i+=5)p.push(proj(i*rad,j*rad,rot));line(p)}
x.beginPath();x.arc(cx,cy,R,0,7);x.strokeStyle="#5fc0ff";x.lineWidth=2;x.shadowBlur=18;x.stroke();x.restore()}
function terminal(p,label,al){x.save();x.globalAlpha=al;x.shadowColor="#1e90ff";x.shadowBlur=20;x.strokeStyle="#6cc6ff";x.lineWidth=2;x.fillStyle="rgba(5,25,70,.8)";x.fillRect(p.x-70,p.y-60,140,90);x.strokeRect(p.x-70,p.y-60,140,90);x.fillRect(p.x-30,p.y+30,60,10);x.strokeRect(p.x-30,p.y+30,60,10);
x.fillStyle="#7fd0ff";x.font="11px monospace";for(let i=0;i<5;i++)x.fillText(Math.random().toString(16).slice(2,14),p.x-60,p.y-42+i*14);x.restore();glowText(label,p.x,p.y+75,22,al)}
function hex(px,py,s,rot,al){x.save();x.globalAlpha=al;x.translate(px,py);x.rotate(rot);x.beginPath();for(let i=0;i<6;i++){const a=i*Math.PI/3;x.lineTo(Math.cos(a)*s,Math.sin(a)*s)}x.closePath();const g=x.createRadialGradient(0,0,0,0,0,s);g.addColorStop(0,"#e8f8ff");g.addColorStop(.5,"#3aa0ff");g.addColorStop(1,"#0a3fb0");x.fillStyle=g;x.shadowColor="#4db2ff";x.shadowBlur=35;x.fill();x.strokeStyle="#fff";x.lineWidth=2;x.stroke();x.restore()}
const path=u=>{if(u<.12){const k=u/.12;return{x:A.x+(cx-R*1.15-A.x)*k,y:A.y-80+(cy-(A.y-80))*k*k}}if(u>.88){const k=(u-.88)/.12;return{x:cx+R*1.15+(B.x-(cx+R*1.15))*k,y:cy+(B.y-60-cy)*k}}
const k=(u-.12)/.76;const ang=Math.PI+k*Math.PI*3;return{x:cx+Math.cos(ang)*R*1.15,y:cy+Math.sin(ang)*R*.38,back:Math.sin(ang)<0}};
const trail=[];
function frame(now){const t=Math.min((now-t0)/D,1);if(skip){st.hidden=true;return res()}
x.fillStyle="#000208";x.fillRect(0,0,W,H);for(const s of stars){x.fillStyle=`rgba(190,225,255,${.4+.6*Math.random()})`;x.fillRect(s[0],s[1],s[2],s[2])}
globe(now/4000);const tAl=Math.min(1,t*8);terminal(A,"OTC DESK A",tAl);terminal(B,"OTC DESK B",tAl);
glowText(d.chain+" · "+short(d.hash),W/2,60,28,tAl);
const mv=Math.max(0,Math.min(1,(t-.1)/.62));const P=path(mv);
if(t>.1&&t<.74){trail.push(P);if(trail.length>90)trail.shift()}
if(trail.length>1){x.save();x.lineCap="round";for(let i=1;i<trail.length;i++){x.globalAlpha=i/trail.length;x.strokeStyle="#4db8ff";x.shadowColor="#1e90ff";x.shadowBlur=20;x.lineWidth=2+4*i/trail.length;x.beginPath();x.moveTo(trail[i-1].x,trail[i-1].y);x.lineTo(trail[i].x,trail[i].y);x.stroke()}x.restore()}
if(t<.1){const k=t/.1;hex(A.x,A.y-80,28*k,now/300,k);glowText("TRANSAKTION ERSTELLT",A.x,A.y-130,18,k)}
else if(t<.74){hex(P.x,P.y,28,now/300,P.back?.7:1);glowText(d.amount,P.x,P.y-42,20)}
else if(t<.86){const k=(t-.74)/.12;const vx=B.x,vy=B.y-60;x.save();x.translate(vx,vy);for(let i=0;i<5;i++){x.rotate(now/150+i);x.beginPath();x.ellipse(0,0,Math.max(5,60*(1-k*.3)-i*9),Math.max(2,22-i*3),0,0,7);x.strokeStyle=`rgba(90,190,255,${.8-i*.12})`;x.shadowColor="#1e90ff";x.shadowBlur=20;x.lineWidth=2;x.stroke()}x.restore();
const a=k*Math.PI*4;hex(vx+Math.cos(a)*45*(1-k),vy+Math.sin(a)*16*(1-k),28*(1-k)+.1,now/80,1-k);trail.splice(0,4)}
if(t>=.86){const k=Math.min(1,(t-.86)/.06);glowText(d.status==="Bestätigt"?"CONFIRMED":d.status==="Fehlgeschlagen"?"FAILED":"PENDING",W/2,H/2+20,90*(0.8+0.2*k),k);glowText(d.amount+" → "+short(d.to),W/2,H/2+80,24,k)}
if(t<1)requestAnimationFrame(frame);else setTimeout(()=>{st.hidden=true;res()},300)}
requestAnimationFrame(frame)})}
$("#skip").onclick=()=>skip=true;
function card(d){const a=v=>v&&(d.chain==="SOL"?/^[1-9A-HJ-NP-Za-km-z]{32,44}$/:/^(0x[0-9a-fA-F]{40}$|[13]|bc1|0[234]|04)/).test(v)&&!v.includes(" ")?`<a href="${d.addr(v)}" target="_blank" rel="noopener">${v}</a>`:`<span class="v">${v||"–"}</span>`;
const c=$("#card");c.hidden=false;c.innerHTML=`<h2>TRANSAKTION ${d.status==="Bestätigt"?"BESTÄTIGT":d.status.toUpperCase()}</h2><div class="grid">
<div class="k">Netzwerk</div><div class="v">${({ETH:"Ethereum Mainnet",BTC:"Bitcoin",SOL:"Solana Mainnet"})[d.chain]}</div>
<div class="k">Tx-Hash</div><div><a href="${d.txUrl}" target="_blank" rel="noopener">${d.hash}</a></div>
<div class="k">Status</div><div class="v">${d.status} · ${d.confText||d.conf.toLocaleString("de-DE")+" Bestätigungen"}</div>
<div class="k">Betrag</div><div class="v">${d.amount}${d.total?` (gesamt ${d.total})`:""}</div>
<div class="k">Gebühr</div><div class="v">${d.fee}</div>
<div class="k">Zeit</div><div class="v">${d.time?d.time.toLocaleString("de-DE"):"noch nicht im Block"}</div>
<div class="k">Absender</div><div>${a(d.from)}</div></div>
<div class="buyer"><div class="k">Käufer-Wallet (Empfänger) ${d.note||""}</div><div style="margin-top:6px;font-size:18px">${a(d.to)}</div></div>`}
$("#f").onsubmit=async e=>{e.preventDefault();let h=$("#h").value.trim();$("#card").hidden=true;let fn;
if(/^0x[0-9a-fA-F]{64}$/.test(h)){fn=fetchEth;h=h.toLowerCase()}else if(/^[0-9a-fA-F]{64}$/.test(h)){fn=fetchBtc;h=h.toLowerCase()}else if(/^[1-9A-HJ-NP-Za-km-z]{80,90}$/.test(h)){fn=fetchSol}else if(await routeAddress(h)){msg("");return}else return msg("Ungültiger Hash: Ethereum = 0x + 64 Hex-Zeichen, Bitcoin = 64 Hex-Zeichen, Solana = Base58-Signatur (87–88 Zeichen).",1);
msg("Lade Transaktion …");try{const d=await fn(h);msg("");await play(d);card(d)}catch(err){msg("Fehler: "+err.message,1)}};
$("#wallet").onclick=async()=>{if(!window.ethereum)return msg("Keine Browser-Wallet (z. B. MetaMask) gefunden – für die Suche nicht nötig.",1);try{const [acc]=await ethereum.request({method:"eth_requestAccounts"});$("#wallet").textContent=short(acc)}catch(e){msg("Verbindung abgelehnt.",1)}};

