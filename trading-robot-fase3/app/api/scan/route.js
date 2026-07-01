import { analyzeRows, fetchRows } from '../analyze/route.js';

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);

    const list = (searchParams.get('symbols') || 'SPY,QQQ,NVDA,TSLA,AAPL,META,BAC,PLTR,AMZN')
      .split(',')
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean)
      .slice(0, 5);

    const key = process.env.ALPHA_VANTAGE_API_KEY;

    if (!key) {
      return Response.json({ error: 'Falta ALPHA_VANTAGE_API_KEY' }, { status: 500 });
    }

    const results = [];

    for (const sym of list) {
      try {
        const data = await fetchRows(sym, key, 'swing');
const rows = data.main;

if (!rows || rows.length < 20) {
  results.push({
    symbol: sym,
    error: 'Datos insuficientes o límite de Alpha Vantage',
    score: 0,
    signal: 'SIN DATOS',
  });
} else {
  results.push(analyzeRows(sym, rows, 'swing'));
}

        await wait(15000);
      } catch (e) {
        results.push({
          symbol: sym,
          error: e.message,
          score: 0,
          signal: 'SIN DATOS',
        });
      }
    }

    results.sort((a, b) => Math.abs(b.score || 0) - Math.abs(a.score || 0));

    return Response.json({
      results,
      best:
        results.find((r) => !r.error && r.signal !== 'ESPERAR') ||
        results.find((r) => !r.error) ||
        null,
      disclaimer: 'Solo educativo; no es consejo financiero oficial.',
    });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 400 });
  }
}
