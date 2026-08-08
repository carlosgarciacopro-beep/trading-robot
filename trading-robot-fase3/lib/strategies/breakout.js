export function runBreakout(ctx) {
  const {
    close,
    previousClose,
    resistance,
    support,
    range,
    lastVol,
    avgVol,
    rsi,
    macdHist,
    atr
  } = ctx;

  const buffer = Math.max(0.02, (atr || range * 0.2) * 0.15);

  const bullishBreak =
    close > resistance - buffer &&
    close > previousClose &&
    lastVol > avgVol * 1.25 &&
    macdHist > 0 &&
    rsi >= 52 &&
    rsi <= 75;

  const bearishBreak =
    close < support + buffer &&
    close < previousClose &&
    lastVol > avgVol * 1.25 &&
    macdHist < 0 &&
    rsi <= 48 &&
    rsi >= 25;

  let side = 'NEUTRAL';
  let quality = 45;
  let status = '⚪ SIN BREAKOUT';
  const reasons = [];

  if (bullishBreak) {
    side = 'CALL';
    quality = 78;
    if (lastVol > avgVol * 1.5) quality += 8;
    if (rsi >= 58 && rsi <= 68) quality += 5;
    if (close > resistance) quality += 5;

    reasons.push('Precio atacando o superando resistencia');
    reasons.push('Volumen fuerte confirma el rompimiento');
    reasons.push('Momentum acompaña la ruptura');

    status =
      quality >= 84
        ? '🟢 BREAKOUT CALL CONFIRMADO'
        : '🟡 BREAKOUT CALL · ESPERAR CONFIRMACIÓN';
  }

  if (bearishBreak) {
    side = 'PUT';
    quality = 78;
    if (lastVol > avgVol * 1.5) quality += 8;
    if (rsi <= 42 && rsi >= 32) quality += 5;
    if (close < support) quality += 5;

    reasons.push('Precio atacando o perdiendo soporte');
    reasons.push('Volumen fuerte confirma el rompimiento');
    reasons.push('Momentum acompaña la ruptura');

    status =
      quality >= 84
        ? '🔴 BREAKOUT PUT CONFIRMADO'
        : '🟡 BREAKOUT PUT · ESPERAR CONFIRMACIÓN';
  }

  quality = Math.max(0, Math.min(95, Math.round(quality)));

  return {
    id: 'BPS',
    name: 'BPS',
    fullName: 'Breakout Precision Strategy',
    friendlyName: 'Rompimiento con Confirmación',
    side,
    score: 0,
    quality,
    isActionable:
      side !== 'NEUTRAL' &&
      quality >= 84 &&
      status.includes('CONFIRMADO'),
    status,
    reasons,
    plainExplanation:
      side === 'CALL'
        ? 'El precio está rompiendo una resistencia con volumen y momentum suficientes para considerar continuación alcista.'
        : side === 'PUT'
        ? 'El precio está perdiendo un soporte con volumen y momentum suficientes para considerar continuación bajista.'
        : 'No hay un rompimiento suficientemente confirmado.',
    historicalProbability: null
  };
}
