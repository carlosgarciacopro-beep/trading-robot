const MARKET_SYMBOLS = {
  SPY: 'SPY',
  QQQ: 'QQQ',
  VIX: '^VIX',
  DXY: 'DX-Y.NYB',
  TLT: 'TLT',
  USO: 'USO',
  GLD: 'GLD'
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function round(value, decimals = 2) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Number(n.toFixed(decimals));
}

function ema(values, period) {
  if (!Array.isArray(values) || values.length === 0) return [];

  const k = 2 / (period + 1);
  const out = [];
  let prev = values[0];

  for (let i = 0; i < values.length; i++) {
    prev = i === 0 ? values[i] : values[i] * k + prev * (1 - k);
    out.push(prev);
  }

  return out;
}

function rsi(values, period = 14) {
  const out = Array(values.length).fill(null);

  if (values.length <= period) return out;

  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const diff = values[i] - values[i - 1];

    if (diff >= 0) gains += diff;
    else losses -= diff;
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  out[period] =
    avgLoss === 0
      ? 100
      : 100 - 100 / (1 + avgGain / avgLoss);

  for (let i = period + 1; i < values.length; i++) {
    const diff = values[i] - values[i - 1];

    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    out[i] =
      avgLoss === 0
        ? 100
        : 100 - 100 / (1 + avgGain / avgLoss);
  }

  return out;
}

async function fetchDaily(symbol, range = '6mo') {
  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
      symbol
    )}?interval=1d&range=${range}`;

  const response = await fetch(url, {
    cache: 'no-store',
    headers: {
      'User-Agent': 'Mozilla/5.0'
    }
  });

  if (!response.ok) {
    throw new Error(`Yahoo Finance respondió ${response.status} para ${symbol}`);
  }

  const data = await response.json();
  const result = data?.chart?.result?.[0];

  if (!result) {
    throw new Error(`Yahoo Finance no devolvió datos para ${symbol}`);
  }

  const meta = result.meta || {};
  const timestamps = result.timestamp || [];
  const quote = result.indicators?.quote?.[0];

  if (!quote || timestamps.length === 0) {
    throw new Error(`Datos incompletos para ${symbol}`);
  }

  const rows = timestamps
    .map((timestamp, i) => ({
      timestamp,
      open: quote.open?.[i],
      high: quote.high?.[i],
      low: quote.low?.[i],
      close: quote.close?.[i],
      volume: quote.volume?.[i] || 0
    }))
    .filter(
      (row) =>
        row.open != null &&
        row.high != null &&
        row.low != null &&
        row.close != null
    );

  const last = rows[rows.length - 1];

  const livePrice =
    meta.postMarketPrice ??
    meta.preMarketPrice ??
    meta.regularMarketPrice ??
    last?.close ??
    null;

  return {
    rows,
    livePrice,
    marketState: meta.marketState || 'UNKNOWN'
  };
}

function analyzeAsset(key, marketData) {
  const rows = marketData?.rows || [];

  if (rows.length < 50) {
    return {
      key,
      symbol: MARKET_SYMBOLS[key],
      state: 'NO_DATA',
      score: 0,
      confidence: 0,
      price: marketData?.livePrice ?? null,
      reasons: ['Datos insuficientes']
    };
  }

  const closes = rows.map((row) => Number(row.close));
  const volumes = rows.map((row) => Number(row.volume || 0));

  const e20 = ema(closes, 20);
  const e50 = ema(closes, 50);
  const rs = rsi(closes, 14);

  const i = closes.length - 1;
  const close = closes[i];
  const previousClose = closes[Math.max(0, i - 1)];
  const changePct =
    previousClose > 0
      ? ((close - previousClose) / previousClose) * 100
      : 0;

  const avgVolume =
    volumes.slice(-20).reduce((a, b) => a + b, 0) /
    Math.max(1, Math.min(20, volumes.length));

  const relativeVolume =
    avgVolume > 0 ? volumes[i] / avgVolume : 0;

  let score = 0;
  const reasons = [];

  if (close > e20[i]) {
    score += 1;
    reasons.push('Precio arriba del promedio corto');
  } else {
    score -= 1;
    reasons.push('Precio debajo del promedio corto');
  }

  if (close > e50[i]) {
    score += 1;
    reasons.push('Precio arriba del promedio medio');
  } else {
    score -= 1;
    reasons.push('Precio debajo del promedio medio');
  }

  if (e20[i] > e50[i]) {
    score += 1;
    reasons.push('Tendencia corta favorece al alza');
  } else {
    score -= 1;
    reasons.push('Tendencia corta favorece a la baja');
  }

  if ((rs[i] ?? 50) >= 52) score += 1;
  if ((rs[i] ?? 50) <= 45) score -= 1;

  if (changePct > 0.35) score += 1;
  if (changePct < -0.35) score -= 1;

  if (relativeVolume >= 1.2) {
    score += score >= 0 ? 1 : -1;
    reasons.push('Volumen superior a lo normal');
  }

  let state = 'NEUTRAL';

  if (score >= 3) state = 'BULLISH';
  if (score <= -3) state = 'BEARISH';

  return {
    key,
    symbol: MARKET_SYMBOLS[key],
    state,
    score,
    confidence: clamp(50 + Math.abs(score) * 8, 50, 94),
    price: round(marketData.livePrice ?? close),
    close: round(close),
    changePct: round(changePct),
    rsi: round(rs[i]),
    ema20: round(e20[i]),
    ema50: round(e50[i]),
    relativeVolume: round(relativeVolume, 2),
    marketState: marketData.marketState,
    reasons
  };
}

function analyzeVix(asset) {
  const value = Number(asset?.price);

  if (!Number.isFinite(value)) {
    return {
      state: 'UNKNOWN',
      riskPoints: 0,
      label: 'Sin datos'
    };
  }

  if (value < 15) {
    return {
      state: 'LOW',
      riskPoints: -12,
      label: 'Volatilidad baja'
    };
  }

  if (value < 20) {
    return {
      state: 'NORMAL',
      riskPoints: -4,
      label: 'Volatilidad normal'
    };
  }

  if (value < 25) {
    return {
      state: 'ELEVATED',
      riskPoints: 8,
      label: 'Volatilidad elevada'
    };
  }

  if (value < 30) {
    return {
      state: 'HIGH',
      riskPoints: 18,
      label: 'Volatilidad alta'
    };
  }

  return {
    state: 'EXTREME',
    riskPoints: 28,
    label: 'Volatilidad extrema'
  };
}

function determineLiquidity(spy, qqq) {
  const rel = [
    Number(spy?.relativeVolume || 0),
    Number(qqq?.relativeVolume || 0)
  ].filter((n) => Number.isFinite(n) && n > 0);

  if (!rel.length) return 'UNKNOWN';

  const avg = rel.reduce((a, b) => a + b, 0) / rel.length;

  if (avg >= 1.2) return 'HIGH';
  if (avg >= 0.75) return 'NORMAL';
  return 'LOW';
}

function buildMarketDecision(assets, vixInfo) {
  const spy = assets.SPY;
  const qqq = assets.QQQ;
  const dxy = assets.DXY;
  const tlt = assets.TLT;

  let bullishPoints = 0;
  let bearishPoints = 0;

  if (spy?.state === 'BULLISH') bullishPoints += 3;
  if (spy?.state === 'BEARISH') bearishPoints += 3;

  if (qqq?.state === 'BULLISH') bullishPoints += 3;
  if (qqq?.state === 'BEARISH') bearishPoints += 3;

  // DXY fuerte puede actuar como viento en contra para activos de riesgo.
  if (dxy?.state === 'BEARISH') bullishPoints += 1;
  if (dxy?.state === 'BULLISH') bearishPoints += 1;

  // TLT fuerte suele reflejar demanda defensiva; se usa solo como filtro suave.
  if (tlt?.state === 'BULLISH') bearishPoints += 1;
  if (tlt?.state === 'BEARISH') bullishPoints += 1;

  if (vixInfo.state === 'LOW' || vixInfo.state === 'NORMAL') {
    bullishPoints += 1;
  }

  if (vixInfo.state === 'HIGH' || vixInfo.state === 'EXTREME') {
    bearishPoints += 2;
  }

  let marketTrend = 'NEUTRAL';
  let recommendation = 'WAIT';

  if (bullishPoints >= bearishPoints + 3) {
    marketTrend = 'BULLISH';
    recommendation = 'FAVOR_CALLS';
  } else if (bearishPoints >= bullishPoints + 3) {
    marketTrend = 'BEARISH';
    recommendation = 'FAVOR_PUTS';
  }

  const total = Math.max(1, bullishPoints + bearishPoints);
  const dominant = Math.max(bullishPoints, bearishPoints);

  const confidence =
    marketTrend === 'NEUTRAL'
      ? clamp(55 + Math.abs(bullishPoints - bearishPoints) * 5, 50, 70)
      : clamp(60 + (dominant / total) * 34, 60, 94);

  return {
    marketTrend,
    recommendation,
    confidence: Math.round(confidence),
    bullishPoints,
    bearishPoints
  };
}

export async function analyzeMarket() {
  const keys = Object.keys(MARKET_SYMBOLS);

  const settled = await Promise.allSettled(
    keys.map(async (key) => {
      const data = await fetchDaily(MARKET_SYMBOLS[key], '6mo');
      return [key, analyzeAsset(key, data)];
    })
  );

  const assets = {};

  settled.forEach((result, index) => {
    const key = keys[index];

    if (result.status === 'fulfilled') {
      const [assetKey, analysis] = result.value;
      assets[assetKey] = analysis;
    } else {
      assets[key] = {
        key,
        symbol: MARKET_SYMBOLS[key],
        state: 'NO_DATA',
        score: 0,
        confidence: 0,
        price: null,
        reasons: [result.reason?.message || 'No se pudo analizar']
      };
    }
  });

  const vixInfo = analyzeVix(assets.VIX);
  const decision = buildMarketDecision(assets, vixInfo);
  const liquidity = determineLiquidity(assets.SPY, assets.QQQ);

  let risk = 35;

  risk += vixInfo.riskPoints;

  if (assets.SPY?.state === 'NEUTRAL') risk += 5;
  if (assets.QQQ?.state === 'NEUTRAL') risk += 5;

  if (
    assets.SPY?.state !== 'NO_DATA' &&
    assets.QQQ?.state !== 'NO_DATA' &&
    assets.SPY?.state !== assets.QQQ?.state
  ) {
    risk += 10;
  }

  if (liquidity === 'LOW') risk += 10;
  if (liquidity === 'HIGH') risk -= 5;

  risk = clamp(Math.round(risk), 5, 95);

  const favorable =
    decision.marketTrend !== 'NEUTRAL' &&
    risk <= 55 &&
    vixInfo.state !== 'EXTREME';

  let summary = 'El mercado está mixto. Conviene esperar mejores confirmaciones.';

  if (decision.recommendation === 'FAVOR_CALLS' && favorable) {
    summary =
      'El contexto general favorece operaciones alcistas, siempre que el activo confirme su propio setup.';
  }

  if (decision.recommendation === 'FAVOR_PUTS' && favorable) {
    summary =
      'El contexto general favorece operaciones bajistas, siempre que el activo confirme su propio setup.';
  }

  if (risk >= 70) {
    summary =
      'El riesgo general está elevado. Nexora recomienda reducir exposición y exigir confirmaciones más fuertes.';
  }

  return {
    generatedAt: new Date().toISOString(),
    marketTrend: decision.marketTrend,
    confidence: decision.confidence,
    risk,
    liquidity,
    recommendation: decision.recommendation,
    favorable,
    summary,

    volatility: {
      symbol: '^VIX',
      value: assets.VIX?.price ?? null,
      state: vixInfo.state,
      label: vixInfo.label
    },

    assets: {
      SPY: assets.SPY,
      QQQ: assets.QQQ,
      VIX: assets.VIX,
      DXY: assets.DXY,
      TLT: assets.TLT,
      USO: assets.USO,
      GLD: assets.GLD
    },

    scores: {
      bullishPoints: decision.bullishPoints,
      bearishPoints: decision.bearishPoints
    },

    note:
      'Market Brain usa datos técnicos de mercado. Noticias, calendario macro, amplitud y datos de opciones se integrarán en fases posteriores.'
  };
}
