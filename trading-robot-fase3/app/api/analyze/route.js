import { runNexoraEngine } from "../../../lib/nexoraEngine.js";
import { analyzeMarket } from "../../../lib/marketBrain.js";

function ema(values, period) {
  if (!Array.isArray(values) || !values.length) return [];
  const k = 2 / (period + 1);
  const out = [];
  let prev = values[0];

  for (let i = 0; i < values.length; i++) {
    prev = i === 0 ? values[i] : values[i] * k + prev * (1 - k);
    out.push(prev);
  }

  return out;
}

function sma(values, period) {
  const out = Array(values.length).fill(null);
  let sum = 0;

  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    if (i >= period - 1) out[i] = sum / period;
  }

  return out;
}

function stdev(values, period, means) {
  const out = Array(values.length).fill(null);

  for (let i = period - 1; i < values.length; i++) {
    let sumSq = 0;

    for (let j = i - period + 1; j <= i; j++) {
      const diff = values[j] - means[i];
      sumSq += diff * diff;
    }

    out[i] = Math.sqrt(sumSq / period);
  }

  return out;
}

function bollinger(values, period = 20, mult = 2) {
  const middle = sma(values, period);
  const sd = stdev(values, period, middle);

  return {
    middle,
    upper: values.map((_, i) =>
      middle[i] == null || sd[i] == null ? null : middle[i] + mult * sd[i]
    ),
    lower: values.map((_, i) =>
      middle[i] == null || sd[i] == null ? null : middle[i] - mult * sd[i]
    )
  };
}

function rsi(closes, period = 14) {
  const out = Array(closes.length).fill(null);

  if (closes.length <= period) return out;

  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i - 1];
    if (d >= 0) gains += d;
    else losses -= d;
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  out[period] =
    avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    const gain = d > 0 ? d : 0;
    const loss = d < 0 ? -d : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    out[i] =
      avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }

  return out;
}

function macd(closes) {
  const e12 = ema(closes, 12);
  const e26 = ema(closes, 26);
  const line = closes.map((_, i) => e12[i] - e26[i]);
  const signal = ema(line, 9);

  return {
    line,
    signal,
    hist: line.map((v, i) => v - signal[i])
  };
}

function atr(rows, period = 14) {
  const tr = [];

  for (let i = 0; i < rows.length; i++) {
    if (i === 0) {
      tr.push(rows[i].high - rows[i].low);
      continue;
    }

    tr.push(
      Math.max(
        rows[i].high - rows[i].low,
        Math.abs(rows[i].high - rows[i - 1].close),
        Math.abs(rows[i].low - rows[i - 1].close)
      )
    );
  }

  const out = Array(rows.length).fill(null);

  for (let i = period - 1; i < rows.length; i++) {
    const slice = tr.slice(i - period + 1, i + 1);
    out[i] = slice.reduce((a, b) => a + b, 0) / period;
  }

  return out;
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function round(n, d = 2) {
  if (!Number.isFinite(Number(n))) return null;
  return Number(Number(n).toFixed(d));
}

function candleReversal(rows, i, side) {
  if (i < 1) return false;

  const cur = rows[i];
  const prev = rows[i - 1];
  const body = Math.abs(cur.close - cur.open);
  const range = Math.max(0.01, cur.high - cur.low);
  const lowerWick = Math.min(cur.open, cur.close) - cur.low;
  const upperWick = cur.high - Math.max(cur.open, cur.close);

  if (side === "CALL") {
    const hammer = lowerWick > body * 1.8 && cur.close >= cur.open;
    const bullishEngulf =
      cur.close > cur.open &&
      prev.close < prev.open &&
      cur.open <= prev.close &&
      cur.close >= prev.open;

    return (
      hammer ||
      bullishEngulf ||
      (cur.close > cur.open && lowerWick / range > 0.45)
    );
  }

  if (side === "PUT") {
    const shootingStar = upperWick > body * 1.8 && cur.close <= cur.open;
    const bearishEngulf =
      cur.close < cur.open &&
      prev.close > prev.open &&
      cur.open >= prev.close &&
      cur.close <= prev.open;

    return (
      shootingStar ||
      bearishEngulf ||
      (cur.close < cur.open && upperWick / range > 0.45)
    );
  }

  return false;
}

function getOptionStrike(close, side) {
  if (side === "CALL") {
    const primary = Math.ceil(close) + 3;
    return {
      primary,
      secondary: primary + 3,
      range: `${primary} / ${primary + 3}`,
      type: "OTM"
    };
  }

  if (side === "PUT") {
    const primary = Math.floor(close) - 3;
    return {
      primary,
      secondary: primary - 3,
      range: `${primary} / ${primary - 3}`,
      type: "OTM"
    };
  }

  return null;
}

function getExpiration(mode) {
  return mode === "intraday"
    ? "0DTE / 1DTE solo con alta confirmación"
    : "7 a 14 días para swing";
}

function getTimeframeLabel(a) {
  if (!a) return "⚪ Sin datos";

  if (a.side === "CALL" && a.isActionable) {
    return `🟢 Alcista · ${a.strategy || "Nexora"} (${a.qualityScore || 0}/100)`;
  }

  if (a.side === "PUT" && a.isActionable) {
    return `🔴 Bajista · ${a.strategy || "Nexora"} (${a.qualityScore || 0}/100)`;
  }

  if (a.side === "CALL") return "🟡 Sesgo alcista · esperar";
  if (a.side === "PUT") return "🟡 Sesgo bajista · esperar";

  return "⚪ Neutral";
}

export function analyzeRows(symbol, rows, mode = "swing") {
  if (!Array.isArray(rows) || rows.length < 50) {
    throw new Error(`Datos insuficientes para analizar ${symbol}`);
  }

  const closes = rows.map((x) => Number(x.close));
  const volumes = rows.map((x) => Number(x.volume || 0));

  const e20 = ema(closes, 20);
  const e50 = ema(closes, 50);
  const e200 = ema(closes, 200);
  const rs = rsi(closes, 14);
  const m = macd(closes);
  const at = atr(rows, 14);
  const bb = bollinger(closes, 20, 2);

  const i = rows.length - 1;
  const recent = rows.slice(-20);
  const close = closes[i];
  const previousClose = closes[Math.max(0, i - 1)];
  const lastVol = volumes[i] || 0;

  const avgVol =
    volumes.slice(-20).reduce((a, b) => a + b, 0) /
    Math.max(1, Math.min(20, volumes.length));

  const support = Math.min(...recent.map((x) => Number(x.low)));
  const resistance = Math.max(...recent.map((x) => Number(x.high)));
  const range = Math.max(0.01, resistance - support);

  const engine = runNexoraEngine({
    symbol,
    mode,
    rows,
    index: i,
    close,
    previousClose,
    ema20: e20[i],
    ema50: e50[i],
    ema200: e200[i],
    rsi: rs[i] ?? 50,
    macdHist: m.hist[i] ?? 0,
    atr: at[i] ?? 0,
    lastVol,
    avgVol,
    support,
    resistance,
    range,
    bollingerLower: bb.lower[i],
    bollingerMiddle: bb.middle[i],
    bollingerUpper: bb.upper[i],
    candleReversal
  });

  const chosen = engine.selected;
  const side = chosen.side || "NEUTRAL";

  const entryCall = round(resistance + 0.02);
  const entryPut = round(support - 0.02);

  const stopCall = round(
    Math.max(support, close - (at[i] || range * 0.35))
  );

  const stopPut = round(
    Math.min(resistance, close + (at[i] || range * 0.35))
  );

  const targetCall = round(
    chosen.id === "MRBB" && bb.middle[i]
      ? bb.middle[i]
      : close + (at[i] || range * 0.5) * 1.5
  );

  const targetPut = round(
    chosen.id === "MRBB" && bb.middle[i]
      ? bb.middle[i]
      : close - (at[i] || range * 0.5) * 1.5
  );

  const strike = getOptionStrike(close, side);

  const qualityScore = clamp(
    Number(chosen.engineQuality ?? chosen.quality ?? 50),
    0,
    100
  );

  const signal =
    side === "CALL"
      ? chosen.isActionable
        ? "COMPRAR CALL"
        : "VIGILAR CALL"
      : side === "PUT"
      ? chosen.isActionable
        ? "COMPRAR PUT"
        : "VIGILAR PUT"
      : "ESPERAR";

  const strategyMap = Object.fromEntries(
    engine.strategies.map((s) => [s.id, s])
  );

  return {
    symbol,
    mode,
    time: rows[i].time,
    close: round(close),
    currentPrice: round(rows[i].livePrice ?? close),
    marketState: rows[i].marketState || "UNKNOWN",
    lastUpdate: rows[i].time,

    strategy: chosen.id,
    strategyLabel: chosen.friendlyName,
    strategyFullName: chosen.fullName,
    qualityScore,
    confidence: qualityScore,

    isActionable: Boolean(chosen.isActionable),
    score: Number(strategyMap.NCS?.score || 0),

    probability: chosen.historicalProbability ?? null,
    historicalProbability: chosen.historicalProbability ?? null,

    signal,
    side,
    estado: chosen.status || "⚪ NO OPERAR",
    plainExplanation: chosen.plainExplanation,
    reasons: Array.isArray(chosen.reasons) ? chosen.reasons : [],

    metaEngine: engine.meta,
    strategyRanking: engine.strategies,
    strategies: strategyMap,

    mrbb: strategyMap.MRBB || null,
    ncs: strategyMap.NCS || null,
    bps: strategyMap.BPS || null,
    ghs: strategyMap.GHS || null,

    indicators: {
      rsi: round(rs[i]),
      ema20: round(e20[i]),
      ema50: round(e50[i]),
      ema200: round(e200[i]),
      macdHist: round(m.hist[i], 4),
      atr: round(at[i]),
      volume: lastVol,
      avgVolume: Math.round(avgVol || 0),
      relativeVolume: round(avgVol ? lastVol / avgVol : 0, 2),
      bollingerMiddle: round(bb.middle[i]),
      bollingerUpper: round(bb.upper[i]),
      bollingerLower: round(bb.lower[i])
    },

    levels: {
      support: round(support),
      resistance: round(resistance),
      entryCall,
      entryPut,
      stopCall,
      stopPut,
      targetCall,
      targetPut,
      target1:
        side === "CALL" ? targetCall : side === "PUT" ? targetPut : null,
      target2:
        side === "CALL" && targetCall
          ? round(targetCall + Math.abs(targetCall - close))
          : side === "PUT" && targetPut
          ? round(targetPut - Math.abs(close - targetPut))
          : null,
      riskReward:
        side === "CALL" && entryCall && stopCall && targetCall
          ? round(
              Math.abs(targetCall - entryCall) /
                Math.max(0.01, Math.abs(entryCall - stopCall))
            )
          : side === "PUT" && entryPut && stopPut && targetPut
          ? round(
              Math.abs(entryPut - targetPut) /
                Math.max(0.01, Math.abs(stopPut - entryPut))
            )
          : null
    },

    optionIdea: {
      type: side,
      strike: strike?.primary || null,
      secondaryStrike: strike?.secondary || null,
      strikeRange: strike?.range || null,
      strikeStyle: strike?.type || null,
      contract:
        side === "CALL"
          ? `${strike?.primary} CALL`
          : side === "PUT"
          ? `${strike?.primary} PUT`
          : null,
      alternativeContract:
        side === "CALL"
          ? `${strike?.secondary} CALL`
          : side === "PUT"
          ? `${strike?.secondary} PUT`
          : null,
      expiration: getExpiration(mode),
      premiumTarget:
        mode === "swing"
          ? "$0.80 - $1.50 como filtro inicial; confirmar liquidez y griegas"
          : "Depende de 0DTE / 1DTE y volatilidad",
      maxPremiumRisk: "Stop sugerido: -20% a -30% de la prima",
      profitTarget: "Objetivo sugerido: +50% a +80%",
      avoid:
        "Evitar spreads bid/ask muy abiertos, poca liquidez o eventos extraordinarios sin confirmar"
    }
  };
}

export async function fetchYahooRows(
  symbol,
  interval = "1d",
  range = "6mo"
) {
  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
      symbol
    )}?interval=${interval}&range=${range}`;

  const res = await fetch(url, {
    cache: "no-store",
    headers: { "User-Agent": "Mozilla/5.0" }
  });

  if (!res.ok) {
    throw new Error(`Yahoo Finance respondió ${res.status} para ${symbol}`);
  }

  const data = await res.json();
  const result = data?.chart?.result?.[0];

  if (!result) {
    throw new Error("Yahoo Finance no devolvió datos para " + symbol);
  }

  const meta = result.meta || {};
  const timestamps = result.timestamp || [];
  const quote = result.indicators?.quote?.[0];

  if (!quote || !timestamps.length) {
    throw new Error("Datos incompletos de Yahoo Finance para " + symbol);
  }

  const rows = timestamps
    .map((t, i) => ({
      time: new Date(t * 1000).toLocaleString("en-US", {
        timeZone: "America/New_York",
        hour12: false
      }),
      timestamp: t,
      open: quote.open?.[i],
      high: quote.high?.[i],
      low: quote.low?.[i],
      close: quote.close?.[i],
      volume: quote.volume?.[i] || 0
    }))
    .filter(
      (x) =>
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

    lastRow.livePrice = livePrice;
    lastRow.marketState = meta.marketState || "UNKNOWN";

    if (liveTime) {
      lastRow.liveTime = new Date(liveTime * 1000).toLocaleString("en-US", {
        timeZone: "America/New_York",
        hour12: false
      });
    }
  }

  return rows;
}

export async function fetchRows(symbol, _key = null, mode = "swing") {
  const daily = await fetchYahooRows(symbol, "1d", "1y");

  let h1 = null;
  let m15 = null;
  let m5 = null;

  try {
    m5 = await fetchYahooRows(symbol, "5m", "5d");
  } catch (e) {
    console.log("No se pudo cargar 5M:", e.message);
  }

  try {
    m15 = await fetchYahooRows(symbol, "15m", "10d");
  } catch (e) {
    console.log("No se pudo cargar 15M:", e.message);
  }

  try {
    h1 = await fetchYahooRows(symbol, "60m", "1mo");
  } catch (e) {
    console.log("No se pudo cargar 1H:", e.message);
  }

  return {
    main: mode === "intraday" && m5 ? m5 : daily,
    daily,
    h1,
    m15,
    m5
  };
}

function applyMarketContext(analysis, market) {
  if (!analysis || !market) return analysis;

  const side = analysis.side;
  const marketTrend = market.marketTrend;
  const marketRisk = Number(market.risk || 0);
  const marketConfidence = Number(market.confidence || 0);

  let alignment = 'NEUTRAL';
  let adjustment = 0;
  const marketReasons = [];

  if (side === 'CALL') {
    if (marketTrend === 'BULLISH') {
      alignment = 'ALIGNED';
      adjustment += 4;
      marketReasons.push('El mercado general favorece operaciones alcistas');
    } else if (marketTrend === 'BEARISH') {
      alignment = 'CONTRARY';
      adjustment -= 8;
      marketReasons.push('El mercado general está en contra de una operación CALL');
    }
  }

  if (side === 'PUT') {
    if (marketTrend === 'BEARISH') {
      alignment = 'ALIGNED';
      adjustment += 4;
      marketReasons.push('El mercado general favorece operaciones bajistas');
    } else if (marketTrend === 'BULLISH') {
      alignment = 'CONTRARY';
      adjustment -= 8;
      marketReasons.push('El mercado general está en contra de una operación PUT');
    }
  }

  if (marketRisk >= 70) {
    adjustment -= 10;
    marketReasons.push('El riesgo general del mercado está elevado');
  } else if (marketRisk <= 35) {
    adjustment += 2;
    marketReasons.push('El riesgo general del mercado es contenido');
  }

  if (market.liquidity === 'LOW') {
    adjustment -= 4;
    marketReasons.push('La liquidez general está por debajo de lo deseable');
  }

  const originalQuality = Number(analysis.qualityScore || 50);
  const adjustedQuality = clamp(
    Math.round(originalQuality + adjustment),
    0,
    100
  );

  let marketGate = 'PASS';

  if (
    side !== 'NEUTRAL' &&
    (alignment === 'CONTRARY' || marketRisk >= 75)
  ) {
    marketGate = 'CAUTION';
  }

  let isActionable = Boolean(analysis.isActionable);

  // Market Brain funciona como filtro de contexto, no reemplaza la estrategia.
  // Si el mercado está claramente en contra o el riesgo es extremo,
  // Nexora exige esperar confirmación adicional.
  if (isActionable && marketGate === 'CAUTION') {
    isActionable = false;
  }

  let estado = analysis.estado;

  if (
    !isActionable &&
    analysis.side !== 'NEUTRAL' &&
    marketGate === 'CAUTION'
  ) {
    estado = '🟡 ESPERAR · CONTEXTO DE MERCADO DESFAVORABLE';
  }

  return {
    ...analysis,
    qualityScore: adjustedQuality,
    confidence: adjustedQuality,
    isActionable,
    estado,
    marketContext: {
      alignment,
      gate: marketGate,
      adjustment,
      originalQuality,
      adjustedQuality,
      trend: marketTrend,
      confidence: marketConfidence,
      risk: marketRisk,
      liquidity: market.liquidity,
      recommendation: market.recommendation,
      summary: market.summary,
      reasons: marketReasons
    },
    reasons: [
      ...(Array.isArray(analysis.reasons) ? analysis.reasons : []),
      ...marketReasons
    ]
  };
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);

    const symbol = (searchParams.get("symbol") || "SPY")
      .trim()
      .toUpperCase();

    const mode = (searchParams.get("mode") || "swing")
      .trim()
      .toLowerCase();

    const [data, market] = await Promise.all([
      fetchRows(symbol, null, mode),
      analyzeMarket()
    ]);

    let analysis = analyzeRows(symbol, data.main, mode);

    analysis = applyMarketContext(analysis, market);

    const dailyAnalysis = data.daily
      ? analyzeRows(symbol, data.daily, "swing")
      : null;

    const h1Analysis =
      data.h1 && data.h1.length >= 50
        ? analyzeRows(symbol, data.h1, "intraday")
        : null;

    const m15Analysis =
      data.m15 && data.m15.length >= 50
        ? analyzeRows(symbol, data.m15, "intraday")
        : null;

    const m5Analysis =
      data.m5 && data.m5.length >= 50
        ? analyzeRows(symbol, data.m5, "intraday")
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

    analysis.priceSource =
      mode === "intraday"
        ? "INTRADÍA 5MIN + confirmación 15MIN / 1H / Diario"
        : "SWING Diario + confirmación 1H / 15MIN / 5MIN";

    analysis.marketBrain = market;

    return Response.json({
      analysis,
      market,
      disclaimer: "Solo educativo; no es consejo financiero oficial."
    });
  } catch (e) {
    return Response.json(
      { error: e?.message || "Error desconocido" },
      { status: 400 }
    );
  }
}
