export function runMRBB(ctx) {
  const {
    rows,
    index,
    close,
    bollingerLower,
    bollingerMiddle,
    bollingerUpper,
    rsi,
    lastVol,
    avgVol,
    candleReversal
  } = ctx;

  const belowPct =
    bollingerLower && close < bollingerLower
      ? ((bollingerLower - close) / bollingerLower) * 100
      : 0;

  const abovePct =
    bollingerUpper && close > bollingerUpper
      ? ((close - bollingerUpper) / bollingerUpper) * 100
      : 0;

  const callCandidate = belowPct > 0 && rsi < 35;
  const putCandidate = abovePct > 0 && rsi > 65;

  let side = 'NEUTRAL';
  let extensionPct = 0;
  let quality = 45;
  let status = '⚪ SIN SOBREEXTENSIÓN';
  let reasons = [];
  let level = 'NORMAL';

  if (callCandidate) {
    side = 'CALL';
    extensionPct = belowPct;

    const confirmed =
      candleReversal(rows, index, 'CALL') ||
      close > rows[Math.max(0, index - 1)].close;

    if (extensionPct >= 1.5) level = 'EXTREMO';
    else if (extensionPct >= 1) level = 'ALTO';
    else if (extensionPct >= 0.5) level = 'MEDIO';
    else level = 'LEVE';

    quality = 55;
    quality += Math.min(20, extensionPct * 12);
    quality += rsi < 30 ? 10 : 6;
    if (lastVol > avgVol * 1.2) quality += 8;
    if (confirmed) quality += 10;

    reasons = [
      `Precio ${extensionPct.toFixed(2)}% por debajo de su rango normal`,
      `RSI ${rsi.toFixed(1)}: mercado sobrevendido`,
      lastVol > avgVol * 1.2
        ? `Volumen ${Math.round((lastVol / avgVol - 1) * 100)}% superior a lo normal`
        : 'Volumen sin confirmación extraordinaria',
      confirmed
        ? 'Apareció una primera señal de rebote'
        : 'Todavía falta confirmación del rebote'
    ];

    status =
      confirmed && quality >= 80
        ? '🟢 MRBB CALL CONFIRMADO'
        : '🟡 MRBB CALL · ESPERAR CONFIRMACIÓN';
  }

  if (putCandidate) {
    side = 'PUT';
    extensionPct = abovePct;

    const confirmed =
      candleReversal(rows, index, 'PUT') ||
      close < rows[Math.max(0, index - 1)].close;

    if (extensionPct >= 1.5) level = 'EXTREMO';
    else if (extensionPct >= 1) level = 'ALTO';
    else if (extensionPct >= 0.5) level = 'MEDIO';
    else level = 'LEVE';

    quality = 55;
    quality += Math.min(20, extensionPct * 12);
    quality += rsi > 70 ? 10 : 6;
    if (lastVol > avgVol * 1.2) quality += 8;
    if (confirmed) quality += 10;

    reasons = [
      `Precio ${extensionPct.toFixed(2)}% por encima de su rango normal`,
      `RSI ${rsi.toFixed(1)}: mercado sobrecomprado`,
      lastVol > avgVol * 1.2
        ? `Volumen ${Math.round((lastVol / avgVol - 1) * 100)}% superior a lo normal`
        : 'Volumen sin confirmación extraordinaria',
      confirmed
        ? 'Apareció una primera señal de corrección'
        : 'Todavía falta confirmación de la corrección'
    ];

    status =
      confirmed && quality >= 80
        ? '🔴 MRBB PUT CONFIRMADO'
        : '🟡 MRBB PUT · ESPERAR CONFIRMACIÓN';
  }

  quality = Math.max(0, Math.min(95, Math.round(quality)));

  return {
    id: 'MRBB',
    name: 'MRBB',
    fullName: 'Mean Reversion Bollinger Bands',
    friendlyName: 'Reversión a la Media',
    side,
    score: 0,
    quality,
    isActionable:
      side !== 'NEUTRAL' &&
      quality >= 80 &&
      status.includes('CONFIRMADO'),
    status,
    level,
    extensionPct: Number(extensionPct.toFixed(2)),
    reasons,
    plainExplanation:
      side === 'CALL'
        ? 'El precio cayó más de lo habitual y está en una zona de sobreventa. Nexora detecta una posible reversión hacia su promedio.'
        : side === 'PUT'
        ? 'El precio subió más de lo habitual y está en una zona de sobrecompra. Nexora detecta una posible reversión hacia su promedio.'
        : 'No hay una sobreextensión suficiente para activar la estrategia de reversión.',
    historicalProbability: null,
    technical: {
      lower: bollingerLower,
      middle: bollingerMiddle,
      upper: bollingerUpper
    }
  };
}
