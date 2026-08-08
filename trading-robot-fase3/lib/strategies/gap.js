export function runGapHunter(ctx) {
  const {
    rows,
    index,
    close,
    lastVol,
    avgVol,
    rsi,
    macdHist
  } = ctx;

  if (index < 1) {
    return {
      id: 'GHS',
      name: 'GHS',
      fullName: 'Gap Hunter Strategy',
      friendlyName: 'Gaps y Continuación',
      side: 'NEUTRAL',
      quality: 45,
      isActionable: false,
      status: '⚪ SIN GAP',
      reasons: [],
      plainExplanation: 'No hay suficientes datos para evaluar un gap.',
      historicalProbability: null
    };
  }

  const today = rows[index];
  const prev = rows[index - 1];

  const gapPct = ((today.open - prev.close) / prev.close) * 100;
  const absGap = Math.abs(gapPct);

  let side = 'NEUTRAL';
  let quality = 45;
  let status = '⚪ SIN GAP RELEVANTE';
  const reasons = [];

  const bullishContinuation =
    gapPct >= 0.6 &&
    close > today.open &&
    close > prev.close &&
    lastVol > avgVol * 1.15 &&
    macdHist >= 0 &&
    rsi < 75;

  const bearishContinuation =
    gapPct <= -0.6 &&
    close < today.open &&
    close < prev.close &&
    lastVol > avgVol * 1.15 &&
    macdHist <= 0 &&
    rsi > 25;

  if (bullishContinuation) {
    side = 'CALL';
    quality = 72 + Math.min(12, absGap * 4);
    if (lastVol > avgVol * 1.4) quality += 7;

    reasons.push(`Gap alcista de ${gapPct.toFixed(2)}%`);
    reasons.push('El precio mantiene el gap y continúa arriba');
    reasons.push('El volumen acompaña el movimiento');

    status =
      quality >= 84
        ? '🟢 GAP CALL CONFIRMADO'
        : '🟡 GAP CALL · ESPERAR CONFIRMACIÓN';
  }

  if (bearishContinuation) {
    side = 'PUT';
    quality = 72 + Math.min(12, absGap * 4);
    if (lastVol > avgVol * 1.4) quality += 7;

    reasons.push(`Gap bajista de ${gapPct.toFixed(2)}%`);
    reasons.push('El precio mantiene el gap y continúa abajo');
    reasons.push('El volumen acompaña el movimiento');

    status =
      quality >= 84
        ? '🔴 GAP PUT CONFIRMADO'
        : '🟡 GAP PUT · ESPERAR CONFIRMACIÓN';
  }

  quality = Math.max(0, Math.min(95, Math.round(quality)));

  return {
    id: 'GHS',
    name: 'GHS',
    fullName: 'Gap Hunter Strategy',
    friendlyName: 'Gaps y Continuación',
    side,
    score: 0,
    gapPct: Number(gapPct.toFixed(2)),
    quality,
    isActionable:
      side !== 'NEUTRAL' &&
      quality >= 84 &&
      status.includes('CONFIRMADO'),
    status,
    reasons,
    plainExplanation:
      side === 'CALL'
        ? 'El activo abrió con un gap alcista y está mostrando continuación con volumen.'
        : side === 'PUT'
        ? 'El activo abrió con un gap bajista y está mostrando continuación con volumen.'
        : 'No existe un gap suficientemente fuerte y confirmado para operar.',
    historicalProbability: null
  };
}
