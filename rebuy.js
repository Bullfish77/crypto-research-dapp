/* ===== 🔁 REBUY: Rücksetzer bei bereits gemeldeten Coins (Backtest 13.10.: 3sKao/hellop/PUTBACK/SAMM ja, Rugs nein) =====
   Bedingungen (1m-Kerzen GeckoTerminal seit erstem Alert): Hoch ≥ 1,5× Alert-Preis, Rücksetzer 30–60 % vom Hoch (≥ 3 min nach Hoch),
   Kurs ≥ Alert-Preis (Support), höchstens 10× seit Alert, letzte 3 Tiefs steigend, grüne Kerze über Vorkerze, Abverkaufsspitze vorbei,
   kein Rug-/Liquiditätsfilter. Max 2 pro Coin, 20 min Abstand. Max 4 GeckoTerminal-Calls pro Minute. */
const RB_KEY="otc_rebuy";let rbBusy=false;
function rbEval(S,pa,c){const n=S.length;if(n<6)return null;let ih=0;for(let j=0;j<n;j++)if(S[j][2]>S[ih][2])ih=j;const H=S[ih][2],i=n-1,cc=S[i];
 if(H<(c.rbRun??1.5)*pa||i-ih<3)return null;const dd=1-cc[4]/H;if(dd<(c.rbDdMin??0.3)||dd>(c.rbDdMax??0.6)||cc[4]<pa||cc[4]>(c.rbMaxX??10)*pa)return null;
 const w=S.slice(i-2);const seg=S.slice(ih,i-2);const hl=(w[0][3]<=w[1][3]&&w[1][3]<=w[2][3])||Math.min(...w.map(x=>x[3]))>Math.min(...(seg.length?seg:w).map(x=>x[3]));
 const green=cc[4]>cc[1]&&cc[4]>S[i-1][4];const spike=Math.max(...S.slice(ih,i).map(x=>x[5]));const sellx=w.reduce((a,x)=>a+x[5],0)/3<=spike;
 return hl&&green&&sellx?{H,dd,x:cc[4]/pa,price:cc[4],sup:Math.max(pa,Math.min(...S.slice(ih).map(x=>x[3])))}:null}
async function rbTick(){const c=runCfg();if(c.rb===false||!c.on||rbBusy)return;rbBusy=true;try{const T=rLs(TRIG,{}),RB=rLs(RB_KEY,{}),now=Date.now();
 const list=Object.entries(T).filter(([m,g])=>g.price&&now-g.t<6*3600e3&&runData[m]?.p&&(RB[m]?.n||0)<(c.rbMax??2)&&now-(RB[m]?.at||0)>=(c.rbCool??20)*6e4).sort((a,b)=>(RB[a[0]]?.chk||0)-(RB[b[0]]?.chk||0)).slice(0,4);
 for(const [m,g] of list){const x=runData[m],p=x.p;(RB[m]=RB[m]||{n:0,at:0}).chk=now;if(rfBlock(p,c))continue;const h1=p.txns?.h1||{};if((h1.sells||0)>2*(h1.buys||1))continue;
  const sup=(p.marketCap||p.fdv||0)/(+p.priceUsd||1)||1e9;try{const r=await rfetch(`https://api.geckoterminal.com/api/v2/networks/solana/pools/${p.pairAddress}/ohlcv/minute?aggregate=1&limit=400&currency=usd`);if(!r.ok)continue;const j=await r.json();
  const L=(j.data?.attributes?.ohlcv_list||[]).slice().sort((a,b)=>a[0]-b[0]).filter(k=>k[0]*1000>=g.t-60e3);const S=candles(L);const e=rbEval(S,g.price,c);if(!e)continue;
  RB[m].n++;RB[m].at=now;rLsSet(RB_KEY,RB);const t=p.baseToken,mc=e.price*sup;
  const text=`🔁 <b>REBUY-Chance: ${esc(t.name)} ($${esc(t.symbol)})</b> (${RB[m].n}/${c.rbMax??2})\n📋 <b>CA:</b> <code>${m}</code>\n💰 MCap jetzt: ${kfmt(mc)} · Liquidität: ${p.dexId==="pumpfun"?"Bonding Curve":kfmt(p.liquidity?.usd)}\n📉 −${Math.round(e.dd*100)}% vom Hoch (${kfmt(e.H*sup)})\n🧱 Support: ${kfmt(e.sup*sup)} · erster Alert ${g.type||""} bei ${kfmt(g.price*sup)}\n📈 ${e.x.toFixed(1)}× seit erstem Alert\n• steigende Tiefs, grüne Kerze, Abverkauf ausgelaufen\n<a href="https://dexscreener.com/solana/${m}">DexScreener</a> · <a href="https://pump.fun/coin/${m}">pump.fun</a>\n<i>Rücksetzer können weiterfallen – Stop unter Support. Keine Finanzberatung.</i>`;
  await followSend(x,text,"🔁 REBUY")}catch(err){}}rLsSet(RB_KEY,RB)}finally{rbBusy=false}}
setInterval(()=>rbTick().catch(()=>{}),60000);
