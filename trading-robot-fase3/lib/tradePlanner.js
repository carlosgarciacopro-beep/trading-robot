function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function round(value, decimals = 2) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Number(n.toFixed(decimals));
}

function getEntryZone(entry, atr, side) {
  if (!Number.isFinite(Number(entry))) {
    return { min: null, max: null };
  }

  const e = Number(entry);
  const a = Math.max(0.01, Number(atr || 0));
  const width = Math.max(0.15, a * 0.15);

  if (side === 'CALL') {
    return {
      min: round(e),
      max: round(e + width)
    };
  }

  if (side === 'PUT') {
    return {
      min: round(e - width),
      max: round(e)
    };
  }

  return { min: null, max: null };
}

function buildInvalidationRules(analysis) {
  const side = analysis?.side;
  const indicators = analysis?.indicators || {};
  const levels = analysis?.levels || {};
  const rules = [];

  if (side === 'CALL') {
    if (levels.stopCall != null) {
      rules.push(`El activo pierde ${levels.stopCall}`);
    }

    rules.push('RSI pierde fuerza y cae por debajo de 48');
    rules.push('MACD cambia a negativo');
    rules.push('Aparece volumen vendedor fuerte');
  }

  if (side === 'PUT') {
    if (levels.stopPut != null) {
      rules.push(`El activo supera ${levels.stopPut}`);
    }

    rules.push('RSI recupera fuerza por encima de 52');
    rules.push('MACD cambia a positivo');
    rules.push('Aparece volumen comprador fuerte');
  }

  if (analysis?.marketContext?.gate === 'CAUTION') {
    rules.push('El contexto general del mercado sigue en contra de la operación');
  }

  if (analysis?.marketBrain?.risk >= 70) {
    rules.push('El riesgo general del mercado permanece elevado');
  }

  return rules;
}

function buildChecklist(analysis) {
  const indicators = analysis?.indicators || {};
  const side = analysis?.side;
  const checklist = [];

  checklist.push({
    key: 'spread',
    label: 'Spread bid/ask pequeño',
    status: 'PENDING',
    note: 'Requiere datos reales de la cadena de opciones'
  });

  checklist.push({
    key: 'volume',
    label: 'Volumen suficiente',
    status:
      Number(indicators.relativeVolume || 0) >= 1
        ? 'PASS'
        : 'CAUTION',
    note:
      Number(indicators.relativeVolume || 0) >= 1
        ? `Volumen relativo ${indicators.relativeVolume}x`
        : `Volumen relativo ${indicators.relativeVolume || 0}x`
  });

  checklist.push({
    key: 'openInterest',
    label: 'Open Interest suficiente',
    status: 'PENDING',
    note: 'Se validará cuando Nexora lea la cadena real'
  });

  checklist.push({
    key: 'delta',
    label: 'Delta adecuada',
    status: 'PENDING',
    note: 'Se validará con la opción seleccionada'
  });

  checklist.push({
    key: 'theta',
    label: 'Theta aceptable',
    status: 'PENDING',
    note: 'Se validará con la opción seleccionada'
  });

  checklist.push({
    key: 'direction',
    label: 'Dirección técnica alineada',
    status:
      side === 'CALL' || side === 'PUT'
        ? 'PASS'
        : 'FAIL',
    note:
      side === 'CALL'
        ? 'Sesgo alcista'
        : side === 'PUT'
        ? 'Sesgo bajista'
        : 'Sin dirección operable'
  });

  return checklist;
}

function getExecutionStatus(analysis, rr) {
  if (!analysis) return 'NO_OPERAR';

  if (analysis.side === 'NEUTRAL') {
    return 'NO_OPERAR';
  }

  if (
    analysis.marketContext?.gate === 'CAUTION' ||
    Number(analysis.marketBrain?.risk || 0) >= 75
  ) {
    return 'ESPERAR_CONFIRMACION';
  }

  if (!analysis.isActionable) {
    return 'ESPERAR_CONFIRMACION';
  }

  if (Number(rr || 0) < 1.2) {
    return 'ESPERAR_CONFIRMACION';
  }

  return 'LISTO_PARA_ENTRAR';
}

function getExecutionLabel(status) {
  if (status === 'LISTO_PARA_ENTRAR') return '🟢 LISTO PARA ENTRAR';
  if (status === 'ESPERAR_CONFIRMACION') return '🟡 ESPERAR CONFIRMACIÓN';
  return '🔴 NO OPERAR';
}

function getSuggestedContracts(analysis) {
  const optionIdea = analysis?.optionIdea || {};

  return {
    primary: optionIdea.contract || null,
    alternative: optionIdea.alternativeContract || null,
    expiration: optionIdea.expiration || null,
    premiumTarget: optionIdea.premiumTarget || null,
    strikeStyle: optionIdea.strikeStyle || null
  };
}

export function buildTradePlan(analysis) {
  if (!analysis) {
    return {
      status: 'NO_OPERAR',
      statusLabel: '🔴 NO OPERAR',
      reason: 'No existe un análisis válido.'
    };
  }

  const side = analysis.side;
  const levels = analysis.levels || {};
  const indicators = analysis.indicators || {};
  const marketBrain = analysis.marketBrain || {};

  const entry =
    side === 'CALL'
      ? Number(levels.entryCall)
      : side === 'PUT'
      ? Number(levels.entryPut)
      : null;

  const stop =
    side === 'CALL'
      ? Number(levels.stopCall)
      : side === 'PUT'
      ? Number(levels.stopPut)
      : null;

  const target1 =
    Number(levels.target1 ?? (
      side === 'CALL'
        ? levels.targetCall
        : side === 'PUT'
        ? levels.targetPut
        : null
    ));

  const target2 = Number(levels.target2);

  const atr = Number(indicators.atr || 0);

  const entryZone = getEntryZone(entry, atr, side);

  const riskPerShare =
    Number.isFinite(entry) && Number.isFinite(stop)
      ? Math.abs(entry - stop)
      : null;

  const rewardToTarget1 =
    Number.isFinite(entry) && Number.isFinite(target1)
      ? Math.abs(target1 - entry)
      : null;

  const rewardToTarget2 =
    Number.isFinite(entry) && Number.isFinite(target2)
      ? Math.abs(target2 - entry)
      : null;

  const riskReward1 =
    riskPerShare && rewardToTarget1
      ? round(rewardToTarget1 / Math.max(0.01, riskPerShare), 2)
      : null;

  const riskReward2 =
    riskPerShare && rewardToTarget2
      ? round(rewardToTarget2 / Math.max(0.01, riskPerShare), 2)
      : null;

  const executionStatus = getExecutionStatus(
    analysis,
    riskReward1
  );

  const quality = clamp(
    Number(analysis.qualityScore || analysis.confidence || 50),
    0,
    100
  );

  let difficulty = 'MEDIA';

  if (
    quality >= 90 &&
    Number(riskReward1 || 0) >= 1.8 &&
    Number(marketBrain.risk || 50) <= 35
  ) {
    difficulty = 'BAJA';
  } else if (
    quality < 75 ||
    Number(marketBrain.risk || 50) >= 65 ||
    Number(riskReward1 || 0) < 1.2
  ) {
    difficulty = 'ALTA';
  }

  const contracts = getSuggestedContracts(analysis);

  const plan = {
    symbol: analysis.symbol,
    mode: analysis.mode,
    side,

    status: executionStatus,
    statusLabel: getExecutionLabel(executionStatus),

    quality,
    confidence: Number(analysis.confidence || quality),
    consensus: Number(analysis.metaEngine?.consensus || 50),

    marketAlignment:
      analysis.marketContext?.alignment || 'NEUTRAL',

    marketTrend:
      marketBrain.marketTrend || 'NEUTRAL',

    marketRisk:
      Number(marketBrain.risk || 0),

    liquidity:
      marketBrain.liquidity || 'UNKNOWN',

    difficulty,

    entry: round(entry),
    entryZone,
    stop: round(stop),
    target1: round(target1),
    target2: round(target2),

    riskPerShare: round(riskPerShare),
    rewardToTarget1: round(rewardToTarget1),
    rewardToTarget2: round(rewardToTarget2),

    riskReward1,
    riskReward2,

    timeEstimate:
      analysis.mode === 'intraday'
        ? 'Misma sesión / 1 día'
        : '2 a 5 días como referencia',

    contracts,

    premiumRisk: {
      stop:
        analysis.optionIdea?.maxPremiumRisk ||
        'Stop sugerido: -20% a -30% de la prima',

      profitTarget:
        analysis.optionIdea?.profitTarget ||
        'Objetivo sugerido: +50% a +80%',

      moveToBreakeven:
        'Mover stop hacia break-even cuando la prima tenga una ganancia suficiente y el setup siga confirmado'
    },

    checklist: buildChecklist(analysis),

    invalidationRules:
      buildInvalidationRules(analysis),

    whyThisPlan:
      side === 'CALL'
        ? `Nexora busca una entrada alcista cerca de ${round(entry)} y utiliza ${round(stop)} como referencia técnica de invalidación.`
        : side === 'PUT'
        ? `Nexora busca una entrada bajista cerca de ${round(entry)} y utiliza ${round(stop)} como referencia técnica de invalidación.`
        : 'Nexora no encontró una dirección operable.',

    note:
      'El plan usa niveles técnicos del activo. Spread, open interest, delta, theta e IV requieren datos reales de la cadena de opciones antes de ejecutar.'
  };

  return plan;
}
