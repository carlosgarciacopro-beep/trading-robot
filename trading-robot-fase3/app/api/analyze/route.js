function ema(a,p){const k=2/(p+1),out=[];let prev=a[0];for(let i=0;i<a.length;i++){prev=i===0?a[i]:a[i]*k+prev*(1-k);out.push(prev)}return out}
function rsi(c,p=14){let out=Array(c.length).fill(null);for(let i=p;i<c.length;i++){let g=0,l=0;for(let j=i-p+1;j<=i;j++){let d=c[j]-c[j-1];if(d>=0)g+=d;else l-=d}let rs=l===0?100:g/l;out[i]=100-(100/(1+rs))}return out}
function macd(c){const e12=ema(c,12),e26=ema(c,26);const line=c.map((_,i)=>e12[i]-e26[i]);const sig=ema(line,9);return {line,signal:sig,hist:line.map((v,i)=>v-sig[i])}}
function atr(rows,p=14){const out=[];for(let i=0;i<rows.length;i++){if(i===0){out.push(rows[i].high-rows[i].low);continue}const tr=Math.max(rows[i].high-rows[i].low,Math.abs(rows[i].high-rows[i-1].close),Math.abs(rows[i].low-rows[i-1].close));out.push(tr)}return out.map((_,i)=>i+1<p?null:out.slice(i+1-p,i+1).reduce((a,b)=>a+b,0)/p)}
function analyzeRows(symbol, rows){
  const closes=rows.map(x=>x.close), highs=rows.map(x=>x.high), lows=rows.map(x=>x.low), vols=rows.map(x=>x.volume);
  const e20=ema(closes,20), e50=ema(closes,50), e200=ema(closes,200), rs=rsi(closes), m=macd(closes), at=atr(rows);
  const i=rows.length-1, recent=rows.slice(-20), lastVol=vols[i], avgVol=vols.slice(-20).reduce((a,b)=>a+b,0)/Math.max(1,Math.min(20,vols.length));
  const support=Math.min(...recent.map(x=>x.low)), resistance=Math.max(...recent.map(x=>x.high));
  const close=closes[i], range=Math.max(0.01,resistance-support); let score=0, reasons=[];
  if(close>e20[i]&&close>e50[i]){score+=2;reasons.push('Precio arriba de EMA20/EMA50')}
  if(close<e20[i]&&close<e50[i]){score-=2;reasons.push('Precio abajo de EMA20/EMA50')}
  if(rs[i]>=52&&rs[i]<=68){score+=1;reasons.push('RSI alcista sin sobrecompra extrema')}
  if(rs[i]<=45){score-=1;reasons.push('RSI débil')}
  if(m.hist[i]>0){score+=1;reasons.push('MACD positivo')} else {score-=1;reasons.push('MACD negativo')}
  if(close>resistance-range*.08){score+=1;reasons.push('Cerca de romper resistencia')}
  if(close<support+range*.08){score-=1;reasons.push('Cerca de perder soporte')}
  if(lastVol>avgVol*1.15){score+= score>=0?1:-1;reasons.push('Volumen superior al promedio')}
  let signal='ESPERAR', side='NEUTRAL'; if(score>=4){signal='COMPRAR CALL';side='CALL'} if(score<=-4){signal='COMPRAR PUT';side='PUT'}
  const entryCall=+(resistance+0.02).toFixed(2), entryPut=+(support-0.02).toFixed(2);
  const stopCall=+(Math.max(support, close-(at[i]||range*.35)).toFixed(2));
  const stopPut=+(Math.min(resistance, close+(at[i]||range*.35)).toFixed(2));
  const targetCall=+(close+(at[i]||range*.5)*1.5).toFixed(2), targetPut=+(close-(at[i]||range*.5)*1.5).toFixed(2);
  return {symbol, time:rows[i].time, close:+close.toFixed(2), score, signal, side, reasons, indicators:{rsi:+(rs[i]||0).toFixed(2), ema20:+e20[i].toFixed(2), ema50:+e50[i].toFixed(2), ema200:+e200[i].toFixed(2), macdHist:+m.hist[i].toFixed(4), atr:+(at[i]||0).toFixed(2), volume:lastVol, avgVolume:Math.round(avgVol)}, levels:{support:+support.toFixed(2), resistance:+resistance.toFixed(2), entryCall, entryPut, stopCall, stopPut, targetCall, targetPut}, optionIdea:{type:side, strike:side==='CALL'?Math.ceil(close):side==='PUT'?Math.floor(close):null, expiration:'7 a 14 días para swing; 0DTE solo con experiencia y stop estricto', maxPremiumRisk:'Riesgo máximo sugerido: 2% a 5% de la cuenta; práctica: stop -20% a -30% de la prima', avoid:'Evitar si spread bid/ask está muy abierto, bajo volumen, o hay noticia fuerte sin confirmar'}};
}
async function fetchRows(symbol,key){const url=`https://www.alphavantage.co/query?function=TIME_SERIES_INTRADAY&symbol=${symbol}&interval=15min&outputsize=compact&apikey=${key}`;const res=await fetch(url,{next:{revalidate:60}});const data=await res.json();const raw=data['Time Series (15min)'];if(!raw)throw new Error('Sin datos de Alpha Vantage para '+symbol);return Object.entries(raw).reverse().map(([time,v])=>({time,open:+v['1. open'],high:+v['2. high'],low:+v['3. low'],close:+v['4. close'],volume:+v['5. volume']}));}
export async function GET(req){try{const {searchParams}=new URL(req.url);const symbol=(searchParams.get('symbol')||'SPY').toUpperCase();const key=process.env.ALPHA_VANTAGE_API_KEY;if(!key)return Response.json({error:'Falta ALPHA_VANTAGE_API_KEY'},{status:500});const rows=await fetchRows(symbol,key);return Response.json({analysis:analyzeRows(symbol,rows), disclaimer:'Solo educativo; no es consejo financiero oficial.'});}catch(e){return Response.json({error:e.message},{status:400})}}
export { analyzeRows, fetchRows };
