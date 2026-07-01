export async function fetchYahooChart(symbol, interval = '1d', range = '6mo') {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=${interval}&range=${range}`;

  const res = await fetch(url, {
    cache: 'no-store',
    headers: {
      'User-Agent': 'Mozilla/5.0'
    }
  });

  const data = await res.json();
  const result = data?.chart?.result?.[0];

  if (!result) {
    throw new Error("Yahoo Finance no devolvió datos para " + symbol);
  }

  return result;
}
export function yahooRowsFromChart(result) {
  const meta = result.meta || {};
  const timestamps = result.timestamp || [];
  const quote = result.indicators?.quote?.[0];

  if (!quote || !timestamps.length) {
    throw new Error("Datos incompletos de Yahoo Finance");
  }

  const rows = timestamps
    .map((t, i) => ({
      time: new Date(t * 1000).toLocaleString("en-US", {
        timeZone: "America/New_York",
        hour12: false,
      }),
      open: quote.open[i],
      high: quote.high[i],
      low: quote.low[i],
      close: quote.close[i],
      volume: quote.volume[i] || 0,
    }))
    .filter(
      (x) =>
        x.open != null &&
        x.high != null &&
        x.low != null &&
        x.close != null
    );

  return rows;
}
export function applyLivePriceToRows(result, rows) {
  const meta = result.meta || {};
  const lastRow = rows[rows.length - 1];

  if (!lastRow) return rows;

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
  lastRow.marketState = meta.marketState || "UNKNOWN";

  if (liveTime) {
    lastRow.time = new Date(liveTime * 1000).toLocaleString("en-US", {
      timeZone: "America/New_York",
      hour12: false,
    });
  }

  return rows;
}
export async function getYahooRows(symbol, interval = "1d", range = "6mo") {
  const chart = await fetchYahooChart(symbol, interval, range);
  const rows = yahooRowsFromChart(chart);
  return applyLivePriceToRows(chart, rows);
}

export async function getYahooLiveQuote(symbol) {
  const chart = await fetchYahooChart(symbol, "1m", "1d");
  const meta = chart.meta || {};

  return {
    price:
      meta.postMarketPrice ??
      meta.preMarketPrice ??
      meta.regularMarketPrice ??
      null,
    marketState: meta.marketState || "UNKNOWN",
    regularMarketPrice: meta.regularMarketPrice ?? null,
    postMarketPrice: meta.postMarketPrice ?? null,
    preMarketPrice: meta.preMarketPrice ?? null,
  };
}
