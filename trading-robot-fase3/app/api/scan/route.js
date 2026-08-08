import { analyzeRows, fetchRows } from "../analyze/route.js";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);

    const mode = (searchParams.get("mode") || "swing")
      .trim()
      .toLowerCase();

    const list = (
      searchParams.get("symbols") ||
      "SPY,QQQ,NVDA,TSLA,AAPL,META,BAC,PLTR,AMZN"
    )
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean)
      .slice(0, 12);

    const results = [];

    // Yahoo permite hacerlo secuencial sin la espera de 15 s de Alpha Vantage.
    for (const sym of list) {
      try {
        const data = await fetchRows(sym, null, mode);
        const rows = data.main;

        if (!rows || rows.length < 50) {
          results.push({
            symbol: sym,
            error: "Datos insuficientes",
            score: 0,
            qualityScore: 0,
            signal: "SIN DATOS"
          });
          continue;
        }

        results.push(analyzeRows(sym, rows, mode));
      } catch (e) {
        results.push({
          symbol: sym,
          error: e?.message || "Error desconocido",
          score: 0,
          qualityScore: 0,
          signal: "SIN DATOS"
        });
      }
    }

    results.sort((a, b) => {
      // Primero señales realmente operables.
      if (Boolean(b.isActionable) !== Boolean(a.isActionable)) {
        return Number(Boolean(b.isActionable)) - Number(Boolean(a.isActionable));
      }

      // Después calidad de estrategia.
      return Number(b.qualityScore || 0) - Number(a.qualityScore || 0);
    });

    const best =
      results.find((r) => !r.error && r.isActionable) ||
      results.find((r) => !r.error && r.side !== "NEUTRAL") ||
      results.find((r) => !r.error) ||
      null;

    return Response.json({
      mode,
      results,
      best,
      disclaimer: "Solo educativo; no es consejo financiero oficial."
    });
  } catch (e) {
    return Response.json(
      { error: e?.message || "Error desconocido" },
      { status: 400 }
    );
  }
}
