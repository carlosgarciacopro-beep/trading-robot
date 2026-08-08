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
      const d = values[j] - means[i];
      sumSq += d * d;
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
      middle[i] == null ? null : middle[i] + mult * sd[i]
    ),
    lower: values.map((_, i) =>
      middle[i] == null ? null : middle[i] - mult * sd[i]
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
    avgGain = (avgGain * (period - 1) + Math.max(d, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-d, 0)) / period;
    out[i] =
      avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }

  return out;
}

function round(n, d = 2) {
  return Number.isFinite(n) ? Number(n.toFixed(d)) : null;
}

async function fetchDaily(symbol, years = 10) {
  const range = years >= 10 ? "10y" : years >= 5 ? "5y" : "2y";

  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
      symbol
    )}?interval=1d&range=${range}`;

  const res = await fetch(url, {
    cache: "no-store",
    headers: { "User-Agent": "Mozilla/5.0" }
  });

  if (!res.ok) {
    throw new Error(`Yahoo Finance respondió ${res.status}`);
  }

  const data = await res.json();
  const result = data?.chart?.result?.[0];
  const timestamps = result?.timestamp || [];
  const quote = result?.indicators?.quote?.[0];

  if (!quote || !timestamps.length) {
    throw new Error("No se pudo obtener histórico diario.");
  }

  return timestamps
    .map((t, i) => ({
      timestamp: t,
      date: new Date(t * 1000).toISOString().slice(0, 10),
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
}

function extensionBucket(pct) {
  if (pct >= 1.5) return ">1.5%";
  if (pct >= 1) return "1.0-1.5%";
  if (pct >= 0.5) return "0.5-1.0%";
  return "0-0.5%";
}

function summarize(signals, horizon = 10) {
  const eligible = signals.filter((s) => s[`has${horizon}`]);

  if (!eligible.length) {
    return {
      signals: 0,
      returnInsideRate: 0,
      directionWinRate: 0,
      avgDirectionalReturn: 0
    };
  }

  const returned = eligible.filter((s) => s[`inside${horizon}`]).length;
  const directionWins = eligible.filter((s) => s[`win${horizon}`]).length;
  const avg =
    eligible.reduce((a, s) => a + (s[`dirReturn${horizon}`] || 0), 0) /
    eligible.length;

  return {
    signals: eligible.length,
    returnInsideRate: Math.round((returned / eligible.length) * 100),
    directionWinRate: Math.round((directionWins / eligible.length) * 100),
    avgDirectionalReturn: round(avg, 2)
  };
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);

    const symbol = (searchParams.get("symbol") || "QQQ")
      .trim()
      .toUpperCase();

    const years = Math.min(
      10,
      Math.max(2, Number(searchParams.get("years") || 10))
    );

    const rows = await fetchDaily(symbol, years);

    if (rows.length < 250) {
      throw new Error("Histórico insuficiente para un backtest confiable.");
    }

    const closes = rows.map((r) => Number(r.close));
    const volumes = rows.map((r) => Number(r.volume || 0));
    const bb = bollinger(closes, 20, 2);
    const rs = rsi(closes, 14);
    const avgVol = sma(volumes, 20);

    const signals = [];
    const horizons = [1, 3, 5, 7, 10];

    for (let i = 20; i < rows.length - 10; i++) {
      const close = closes[i];
      const lower = bb.lower[i];
      const upper = bb.upper[i];
      const rsiValue = rs[i];

      if (
        lower == null ||
        upper == null ||
        rsiValue == null ||
        avgVol[i] == null
      ) {
        continue;
      }

      let side = null;
      let extensionPct = 0;

      if (close < lower && rsiValue < 35) {
        side = "CALL";
        extensionPct = ((lower - close) / lower) * 100;
      } else if (close > upper && rsiValue > 65) {
        side = "PUT";
        extensionPct = ((close - upper) / upper) * 100;
      } else {
        continue;
      }

      const relativeVolume = avgVol[i] ? volumes[i] / avgVol[i] : 0;

      const sig = {
        date: rows[i].date,
        side,
        close: round(close),
        rsi: round(rsiValue, 1),
        extensionPct: round(extensionPct, 2),
        extensionBucket: extensionBucket(extensionPct),
        relativeVolume: round(relativeVolume, 2),
        volumeStrong: relativeVolume >= 1.2
      };

      for (const h of horizons) {
        const end = i + h;
        sig[`has${h}`] = end < rows.length;

        if (end >= rows.length) continue;

        let inside = false;

        for (let j = i + 1; j <= end; j++) {
          if (
            bb.lower[j] != null &&
            bb.upper[j] != null &&
            closes[j] >= bb.lower[j] &&
            closes[j] <= bb.upper[j]
          ) {
            inside = true;
            break;
          }
        }

        const rawReturn = ((closes[end] - close) / close) * 100;
        const directionalReturn = side === "CALL" ? rawReturn : -rawReturn;

        sig[`inside${h}`] = inside;
        sig[`dirReturn${h}`] = round(directionalReturn, 2);
        sig[`win${h}`] = directionalReturn > 0;
      }

      signals.push(sig);
    }

    const callSignals = signals.filter((s) => s.side === "CALL");
    const putSignals = signals.filter((s) => s.side === "PUT");
    const strongVolume = signals.filter((s) => s.volumeStrong);

    const buckets = {};
    for (const name of ["0-0.5%", "0.5-1.0%", "1.0-1.5%", ">1.5%"]) {
      const subset = signals.filter((s) => s.extensionBucket === name);
      buckets[name] = {
        all: summarize(subset, 10),
        withVolume120: summarize(
          subset.filter((s) => s.volumeStrong),
          10
        )
      };
    }

    return Response.json({
      symbol,
      years,
      rowsAnalyzed: rows.length,
      strategy: "MRBB v1.0",
      rules: {
        call: "Cierre bajo Bollinger inferior + RSI < 35",
        put: "Cierre sobre Bollinger superior + RSI > 65",
        bollinger: "20 periodos, 2 desviaciones estándar",
        volumeStudy: "Volumen >= 1.2x promedio de 20 días"
      },
      summary: {
        total: summarize(signals, 10),
        calls: summarize(callSignals, 10),
        puts: summarize(putSignals, 10),
        volume120: summarize(strongVolume, 10),
        horizons: Object.fromEntries(
          horizons.map((h) => [h, summarize(signals, h)])
        )
      },
      buckets,
      recentSignals: signals.slice(-20).reverse(),
      note:
        "Este backtest mide el movimiento del activo subyacente y el regreso dentro de Bollinger. Todavía no calcula primas históricas de opciones."
    });
  } catch (e) {
    return Response.json(
      { error: e?.message || "Error desconocido" },
      { status: 400 }
    );
  }
}
