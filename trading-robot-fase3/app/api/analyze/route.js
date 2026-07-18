import { getYahooRows } from "../../../lib/yahoo";
function ema(a,p){const k=2/(p+1),out=[];let prev=a[0];for(let i=0;i<a.length;i++){prev=i===0?a[i]:a[i]*k+prev*(1-k);out.push(prev)}return out}

function rsi(c,p=14){let out=Array(c.length).fill(null);for(let i=p;i<c.length;i++){let g=0,l=0;for(let j=i-p+1;j<=i;j++){let d=c[j]-c[j-1];if(d>=0)g+=d;else l-=d}let rs=l===0?100:g/l;out[i]=100-(100/(1+rs))}return out}

function macd(c){const e12=ema(c,12),e26=ema(c,26);const line=c.map((_,i)=>e12[i]-e26[i]);const sig=ema(line,9);return {line,signal:sig,hist:line.map((v,i)=>v-sig[i])}}

function atr(rows,p=14){const out=[];for(let i=0;i<rows.length;i++){if(i===0){out.push(rows[i].high-rows[i].low);continue}const tr=Math.max(rows[i].high-rows[i].low,Math.abs(rows[i].high-rows[i-1].close),Math.abs(rows[i].low-rows[i-1].close));out.push(tr)}return out.map((_,i)=>i+1<p?null:out.slice(i+1-p,i+1).reduce((a,b)=>a+b,0)/p)}

function getProbability(score, estado, side) {
  let probability = 50 + Math.abs(score) * 6;
  if (estado.includes('ENTRAR AHORA')) probability += 8;
  if (estado.includes('ESPERAR')) probability -= 3;
  if (side === 'NEUTRAL') probability = 50;
  probability = Math.max(45, Math.min(probability, 88));
  return Math.round(probability);
}

function getOptionStrike(close, side){
  if(side === 'CALL'){
  const base = Math.ceil(close / 5) * 5;
  const strike1 = base > close ? base : base + 5;
  const strike2 = strike1 + 5;

    return {
      primary: strike1,
      secondary: strike2,
      range: `${strike1} / ${strike2}`,
      type: 'OTM'
    };
  }

  if(side === 'PUT'){
  const base = Math.floor(close / 5) * 5;
  const strike1 = base < close ? base : base - 5;
  const strike2 = strike1 - 5;

    return {
      primary: strike1,
      secondary: strike2,
      range: `${strike1} / ${strike2}`,
      type: 'OTM'
    };
  }

  return null;
}

function getExpiration(mode){
  if(mode === 'intraday') return '0DTE / 1DTE solo con alta confirmación';
  return '7 a 14 días para swing';
}

function analyzeRows(symbol, rows, mode='swing'){
  const closes=rows.map(x=>x.close), vols=rows.map(x=>x.volume);
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

  let signal='ESPERAR', side='NEUTRAL', estado='⚪ NO OPERAR';

  const trendCall = close > e20[i] && close > e50[i] && m.hist[i] > 0 && rs[i] >= 50;
  const trendPut = close < e20[i] && close < e50[i] && m.hist[i] < 0 && rs[i] <= 50;

  const strongCall = score >= 4 && trendCall && lastVol > avgVol;
  const strongPut = score <= -4 && trendPut && lastVol > avgVol;

  const weakCall = score >= 3 && close > e20[i] && rs[i] >= 50;
  const weakPut = score <= -3 && close < e20[i] && rs[i] <= 50;

  if(strongCall){
    signal='COMPRAR CALL';
    side='CALL';
    estado='🟢 ENTRAR AHORA';
    reasons.push('CALL con tendencia, momentum y volumen');
  }else if(strongPut){
    signal='COMPRAR PUT';
    side='PUT';
    estado='🟢 ENTRAR AHORA';
    reasons.push('PUT con tendencia, momentum y volumen');
  }else if(weakCall){
    signal='COMPRAR CALL';
    side='CALL';
    estado='🟡 ESPERAR CONFIRMACIÓN';
    reasons.push('CALL posible, falta confirmación fuerte');
  }else if(weakPut){
    signal='COMPRAR PUT';
    side='PUT';
    estado='🟡 ESPERAR CONFIRMACIÓN';
    reasons.push('PUT posible, falta confirmación fuerte');
  }

  const entryCall=+(resistance+0.02).toFixed(2), entryPut=+(support-0.02).toFixed(2);
  const stopCall=+(Math.max(support, close-(at[i]||range*.35)).toFixed(2));
  const stopPut=+(Math.min(resistance, close+(at[i]||range*.35)).toFixed(2));
  const targetCall=+(close+(at[i]||range*.5)*1.5).toFixed(2);
  const targetPut=+(close-(at[i]||range*.5)*1.5).toFixed(2);

  let confidence = 50 + Math.abs(score) * 10;
  if(estado.includes('ENTRAR AHORA')) confidence += 10;
  confidence = Math.min(confidence,100);

  const probability = getProbability(score,estado,side);
  const strike = getOptionStrike(close,side);

  return {
    symbol,
    mode,
    time:rows[i].time,
    close:+close.toFixed(2),
    currentPrice:+close.toFixed(2),
    lastUpdate:rows[i].time,
    priceSource: mode === 'intraday' ? 'INTRADÍA 5MIN' : 'CIERRE DIARIO',
    score,
    confidence,
    probability,
    signal,
    side,
    estado,
    reasons,
    indicators:{
  rsi:+(rs[i]||0).toFixed(2),
  ema20:+(e20[i]||close||0).toFixed(2),
  ema50:+(e50[i]||close||0).toFixed(2),
  ema200:+(e200[i]||close||0).toFixed(2),
  macdHist:+(m.hist[i]||0).toFixed(4),
  atr:+(at[i]||0).toFixed(2),
  volume:lastVol || 0,
  avgVolume:Math.round(avgVol || 0)
},
    levels:{
      support:+support.toFixed(2),
      resistance:+resistance.toFixed(2),
      entryCall,
      entryPut,
      stopCall,
      stopPut,
      targetCall,
      targetPut,
      target1:side==='CALL'?targetCall:side==='PUT'?targetPut:null,
      target2:side==='CALL'?+(targetCall+Math.abs(targetCall-entryCall)).toFixed(2):side==='PUT'?+(targetPut-Math.abs(entryPut-targetPut)).toFixed(2):null,
      riskReward:side==='CALL'?+(Math.abs(targetCall-entryCall)/Math.abs(entryCall-stopCall)).toFixed(2):side==='PUT'?+(Math.abs(entryPut-targetPut)/Math.abs(stopPut-entryPut)).toFixed(2):null
    },
   optionIdea:{
  type:side,

  strike: strike?.primary || null,

  secondaryStrike: strike?.secondary || null,

  strikeRange: strike?.range || null,

  strikeStyle: strike?.type || null,

  contract:
    side==='CALL'
      ? `${strike?.primary} CALL`
      : side==='PUT'
      ? `${strike?.primary} PUT`
      : null,

  alternativeContract:
    side==='CALL'
      ? `${strike?.secondary} CALL`
      : side==='PUT'
      ? `${strike?.secondary} PUT`
      : null,

  expiration:getExpiration(mode),

  premiumTarget:
    mode==='swing'
      ? '$0.80 - $1.50'
      : 'Depende de 0DTE / 1DTE y volatilidad',

  maxPremiumRisk:'Stop sugerido: -20% a -30% de la prima',

  profitTarget:'Objetivo sugerido: +50% a +80%',

  avoid:'Evitar si spread bid/ask está muy abierto, bajo volumen o noticia fuerte sin confirmar'
}
  };
}

async function fetchYahooRows(symbol, interval = '1d', range = '6mo') {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=${interval}&range=${range}`;

  const res = await fetch(url, {
    cache: 'no-store',
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });

  const data = await res.json();
  const result = data?.chart?.result?.[0];

  if (!result) throw new Error("Yahoo Finance no devolvió datos para " + symbol);

  const meta = result.meta || {};
  const timestamps = result.timestamp || [];
  const quote = result.indicators?.quote?.[0];

  if (!quote || !timestamps.length) {
    throw new Error("Datos incompletos de Yahoo Finance para " + symbol);
  }

  const rows = timestamps
    .map((t, i) => ({
      time: new Date(t * 1000).toLocaleString('en-US', {
        timeZone: 'America/New_York',
        hour12: false
      }),
      open: quote.open[i],
      high: quote.high[i],
      low: quote.low[i],
      close: quote.close[i],
      volume: quote.volume[i] || 0
    }))
    .filter(x =>
      x.open != null &&
      x.high != null &&
      x.low != null &&
      x.close != null
    );

  const lastRow = rows[rows.length - 1];

  if (lastRow) {
    const livePrice =
      meta.postMarketPrice ??
      meta.preMarketPrice ??
      meta.regularMarketPrice ??
      lastRow.close;

    const liveTime =
      meta.postMarketTime ??
      meta.preMarketTime ??
      meta.regularMarketTime ??
      null;

    lastRow.close = livePrice;
    lastRow.high = Math.max(lastRow.high, livePrice);
    lastRow.low = Math.min(lastRow.low, livePrice);
    lastRow.livePrice = livePrice;
    lastRow.marketState = meta.marketState || 'UNKNOWN';

    if (liveTime) {
      lastRow.time = new Date(liveTime * 1000).toLocaleString('en-US', {
        timeZone: 'America/New_York',
        hour12: false
      });
    }
  }

  return rows;
}

async function fetchRows(symbol, _key = null, mode = 'swing') {
  const daily = await fetchYahooRows(symbol, '1d', '6mo');

  let h1 = null;
  let m15 = null;
  let m5 = null;

  try {
    m5 = await fetchYahooRows(symbol, '5m', '5d');
  } catch (e) {
    console.log('No se pudo cargar 5M:', e.message);
  }

  try {
    m15 = await fetchYahooRows(symbol, '15m', '10d');
  } catch (e) {
    console.log('No se pudo cargar 15M:', e.message);
  }

  try {
    h1 = await fetchYahooRows(symbol, '60m', '1mo');
  } catch (e) {
    console.log('No se pudo cargar 1H:', e.message);
  }

  return {
    main: mode === 'intraday' && m5 ? m5 : daily,
    daily,
    h1,
    m15,
    m5
  };
}

function getTimeframeLabel(a) {
  if (!a) return '⚪ Sin datos';

  const score = Number(a.score || 0);

  if (score >= 2) {
    return `🟢 Alcista (+${score})`;
  }

  if (score <= -2) {
    return `🔴 Bajista (${score})`;
  }

  return `🟡 Neutral (${score})`;
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);

    const symbol = (
      searchParams.get('symbol') || 'SPY'
    ).toUpperCase();

    const mode = (
      searchParams.get('mode') || 'swing'
    ).toLowerCase();

    const data = await fetchRows(
      symbol,
      null,
      mode
    );

    const analysis = analyzeRows(
      symbol,
      data.main,
      mode
    );

    const dailyAnalysis = data.daily
      ? analyzeRows(symbol, data.daily, 'swing')
      : null;

    const h1Analysis = data.h1
      ? analyzeRows(symbol, data.h1, 'intraday')
      : null;

    const m15Analysis = data.m15
      ? analyzeRows(symbol, data.m15, 'intraday')
      : null;

    const m5Analysis = data.m5
      ? analyzeRows(symbol, data.m5, 'intraday')
      : null;

    analysis.multiTimeframe = {
      daily: getTimeframeLabel(dailyAnalysis),
      h1: getTimeframeLabel(h1Analysis),
      m15: getTimeframeLabel(m15Analysis),
      m5: getTimeframeLabel(m5Analysis)
    };

    analysis.multiTimeframeRaw = {
      daily: dailyAnalysis,
      h1: h1Analysis,
      m15: m15Analysis,
      m5: m5Analysis
    };

    if (mode === 'intraday') {
      analysis.priceSource =
        'INTRADÍA 5MIN + confirmación 15MIN / 1H / Diario';
    } else {
      analysis.priceSource =
        'SWING Diario + confirmación 1H / 15MIN / 5MIN';
    }

    return Response.json({
      analysis,
      disclaimer:
        'Solo educativo; no es consejo financiero oficial.'
    });

  } catch (e) {
    return Response.json(
      { error: e.message },
      { status: 400 }
    );
  }
}
export { analyzeRows, fetchRows };
