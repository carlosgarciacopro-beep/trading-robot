export function runNCS(ctx) {
  const {
    close,
    ema20,
    ema50,
    ema200,
    rsi,
    macdHist,
    lastVol,
    avgVol,
    support,
    resistance,
    range
  } = ctx;

  let score = 0;
  const reasons = [];

  if (close > ema20 && close > ema50) {
    score += 2;
    reasons.push('Precio por encima de sus promedios de corto plazo');
  }

  if (close < ema20 && close < ema50) {
    score -= 2;
    reasons.push('Precio por debajo de sus promedios de corto plazo');
  }

  if (close > ema200) {
    score += 1;
    reasons.push('Tendencia de largo plazo favorable');
  } else {
    score -= 1;
    reasons.push('Tendencia de largo plazo débil');
  }

  if (rsi >= 52 && rsi <= 68) {
    score += 1;
    reasons.push('Impulso alcista saludable');
  }

  if (rsi <= 45) {
    score -= 1;
    reasons.push('Impulso bajista');
  }

  if (macdHist > 0) {
    score += 1;
    reasons.push('Momentum mejorando');
  } else {
    score -= 1;
    reasons.push('Momentum debilitándose');
  }

  if (close > resistance - range * 0.08) {
    score += 1;
    reasons.push('Precio cerca de romper resistencia');
  }

  if (close < support + range * 0.08) {
    score -= 1;
    reasons.push('Precio cerca de perder soporte');
  }

  if (lastVol > avgVol * 1.15) {
    score += score >= 0 ? 1 : -1;
    reasons.push('Volumen superior a lo normal');
  }

  const trendCall =
    close > ema20 &&
    close > ema50 &&
    macdHist > 0 &&
    rsi >= 50;

  const trendPut =
    close < ema20 &&
    close < ema50 &&
    macdHist < 0 &&
    rsi <= 50;

  let side = 'NEUTRAL';
  let status = '⚪ NO OPERAR';

  let quality = 50 + Math.abs(score) * 7;

  if (score >= 5 && trendCall && lastVol > avgVol) {
    side = 'CALL';
    status = '🟢 NCS CALL CONFIRMADO';
    quality += 10;
  } else if (score <= -5 && trendPut && lastVol > avgVol) {
    side = 'PUT';
    status = '🔴 NCS PUT CONFIRMADO';
    quality += 10;
  } else if (score >= 3 && close > ema20) {
    side = 'CALL';
    status = '🟡 NCS CALL · ESPERAR CONFIRMACIÓN';
  } else if (score <= -3 && close < ema20) {
    side = 'PUT';
    status = '🟡 NCS PUT · ESPERAR CONFIRMACIÓN';
  }

  quality = Math.max(0, Math.min(95, Math.round(quality)));

  return {
    id: 'NCS',
    name: 'NCS',
    fullName: 'Nexora Confluence Strategy',
    friendlyName: 'Tendencia y Confluencia',
    side,
    score,
    quality,
    isActionable:
      side !== 'NEUTRAL' &&
      quality >= 82 &&
      status.includes('CONFIRMADO'),
    status,
    reasons,
    plainExplanation:
      side === 'CALL'
        ? 'La tendencia, el impulso y el volumen favorecen un movimiento alcista.'
        : side === 'PUT'
        ? 'La tendencia, el impulso y el volumen favorecen un movimiento bajista.'
        : 'La estrategia de tendencia no encuentra suficiente confluencia para operar.',
    historicalProbability: null
  };
}
