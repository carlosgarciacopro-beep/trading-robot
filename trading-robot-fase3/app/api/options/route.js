// NEXORA v3.7 DEFAULTS FIX + QUOTE RECOVERY
// PATCH IMPORTANTE PARA app/api/options/route.js
//
// En tu archivo v3.6, reemplaza SOLO la función toNumber por esta versión.
// Corrige el problema donde URLSearchParams.get() devuelve null y
// Number(null) lo convertía incorrectamente en 0.

const toNumber = (value, fallback = null) => {
  if (
    value === null ||
    value === undefined ||
    (typeof value === "string" && value.trim() === "")
  ) {
    return fallback;
  }

  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

// También cambia en las respuestas:
// version: "3.6-quote-recovery"
// por:
// version: "3.7-defaults-fix-quote-recovery"
//
// Después del deploy, una llamada sin reglas explícitas debe volver a mostrar
// defaults como:
// minLiquidityScore: 50
// minCombinedScore: 50
// minDte: 0
// maxDte: 60
// maxDistancePct: 15
// minDelta: 0.15
// idealDeltaLow: 0.20
// idealDeltaHigh: 0.45
// maxDelta: 0.70
// maxThetaAbs: 0.25
// maxIv: 2.5
//
// IMPORTANTE:
// Este TXT es el parche de v3.7. Conserva el resto del route.js v3.6
// exactamente igual y sustituye la función toNumber indicada arriba.
