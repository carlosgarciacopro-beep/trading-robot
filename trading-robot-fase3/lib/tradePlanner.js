// lib/tradePlanner.js
// NEXORA v3.1
// Trade Planner + Option Chain Real Integration

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function round(value, decimals = 2) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Number(n.toFixed(decimals));
}

function num(value, fallback = null) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function getEntryZone(entry, atr, side) {
  if (!Number.isFinite(Number(entry))) {
    return { min: null, max: null };
  }

  const e = Number(entry);
  const a = Math.max(0.01, Number(atr || 0));
  const width = Math.max(0.15, a * 0.15);

  if (side === 'CALL') {
    return { min: round(e), max: round(e + width) };
  }

  if (side === 'PUT') {
    return { min: round(e - width), max: round(e) };
  }

  return { min: null, max: null };
}

function getRealOptionContracts(analysis) {
  const optionChain = analysis?.optionChain || {};

  const primary =
    optionChain.primaryContract ||
    optionChain?.summary?.primaryContract ||
    optionChain?.selection?.primary ||
    null;

  const alternative =
    optionChain.alternativeContract ||
    optionChain?.summary?.alternativeContract ||
    optionChain?.selection?.alternative ||
    null;

  return {
    provider:
      optionChain?.provider?.name ||
      optionChain?.provider ||
      null,

    source:
      optionChain?.provider?.source ||
      optionChain?.source ||
      null,

    isRealData:
      optionChain?.provider?.isRealData ??
      optionChain?.isRealData ??
      Boolean(primary),

    status:
      optionChain?.summary?.status ||
      optionChain?.selection?.status ||
      optionChain?.status ||
      null,

    warning:
      optionChain?.warning ||
      null,

    primary,
    alternative
  };
}

function normalizeContractSummary(contract) {
  if (!contract) return null;

  return {
    symbol: contract.symbol || contract.contractSymbol || null,
    side: contract.side || null,
    expiration: contract.expiration || null,
    dte: num(contract.dte),
    strike: round(contract.strike),
    bid: round(contract.bid),
    ask: round(contract.ask),
    last: round(contract.last),
    mid: round(contract.mid),
    spread: round(contract.spread),
    spreadPct: round(contract.spreadPct),
    volume: num(contract.volume, 0),
    openInterest: num(contract.openInterest, 0),
    impliedVolatility: round(contract.impliedVolatility, 4),
    delta: round(contract.delta, 4),
    gamma: round(contract.gamma, 4),
    theta: round(contract.theta, 4),
    vega: round(contract.vega, 4),
    rho: round(contract.rho, 4),
    underlyingPrice: round(contract.underlyingPrice),
    distanceFromPricePct: round(contract.distanceFromPricePct),
    inTheMoney: Boolean(contract.inTheMoney),
    liquidityScore: num(contract?.liquidity?.score),
    liquidityStatus: contract?.liquidity?.status || null,
    liquidityReasons: Array.isArray(contract?.liquidity?.reasons)
      ? contract.liquidity.reasons
      : [],
    isLiquid: Boolean(contract?.liquidity?.isLiquid),
    source: contract.source || null
  };
}

function evaluateContract(contract) {
  if (!contract) {
    return {
      status: 'PENDING',
      score: 0,
      reasons: ['No hay contrato real seleccionado']
    };
  }

  let score = 0;
  const reasons = [];

  const spreadPct = num(contract.spreadPct);
  const volume = num(contract.volume, 0);
  const openInterest = num(contract.openInterest, 0);
  const delta = Math.abs(num(contract.delta, 0));
  const theta = Math.abs(num(contract.theta, 0));
  const liquidityScore = num(contract?.liquidity?.score, 0);

  if (spreadPct !== null) {
    if (spreadPct <= 10) {
      score += 25;
      reasons.push('Spread bueno');
    } else if (spreadPct <= 20) {
      score += 15;
      reasons.push('Spread aceptable');
    } else {
      reasons.push('Spread amplio');
    }
  } else {
    reasons.push('Spread no disponible');
  }

  if (volume >= 100) {
    score += 20;
    reasons.push('Volumen suficiente');
  } else if (volume >= 25) {
    score += 10;
    reasons.push('Volumen moderado');
  } else {
    reasons.push('Volumen bajo');
  }

  if (openInterest >= 500) {
    score += 20;
    reasons.push('Open Interest bueno');
  } else if (openInterest >= 100) {
    score += 10;
    reasons.push('Open Interest aceptable');
  } else {
    reasons.push('Open Interest bajo');
  }

  if (delta >= 0.20 && delta <= 0.70) {
    score += 15;
    reasons.push('Delta operable');
  } else if (delta > 0) {
    reasons.push('Delta fuera del rango preferido');
  } else {
    reasons.push('Delta no disponible');
  }

  if (theta > 0 && theta <= 0.30) {
    score += 10;
    reasons.push('Theta aceptable');
  } else if (theta > 0) {
    reasons.push('Theta elevado');
  } else {
    reasons.push('Theta no disponible');
  }

  if (liquidityScore >= 65) {
    score += 10;
    reasons.push('Liquidez general buena');
  } else if (liquidityScore >= 50) {
    score += 5;
    reasons.push('Liquidez general aceptable');
  } else {
    reasons.push('Liquidez general limitada');
  }

  score = clamp(score, 0, 100);

  return {
    status: score >= 75 ? 'APTO' : score >= 55 ? 'ESPERAR' : 'NO_APTO',
    score,
    reasons
  };
}

function buildInvalidationRules(analysis) {
  const side = analysis?.side;
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

  const contract = getRealOptionContracts(analysis).primary;

  if (contract?.liquidity?.isLiquid === false) {
    rules.push('La liquidez del contrato real es insuficiente');
  }

  if (
    contract?.spreadPct != null &&
    Number(contract.spreadPct) > 20
  ) {
    rules.push('El spread bid/ask del contrato supera 20%');
  }

  return rules;
}

function buildChecklist(analysis) {
  const indicators = analysis?.indicators || {};
  const side = analysis?.side;
  const contract = getRealOptionContracts(analysis).primary;
  const checklist = [];

  if (contract) {
    const spreadPct = num(contract.spreadPct);
    const volume = num(contract.volume, 0);
    const openInterest = num(contract.openInterest, 0);
    const delta = Math.abs(num(contract.delta, 0));
    const theta = Math.abs(num(contract.theta, 0));

    checklist.push({
      key: 'spread',
      label: 'Spread bid/ask pequeño',
      status:
        spreadPct !== null && spreadPct <= 15
          ? 'PASS'
          : spreadPct !== null && spreadPct <= 25
          ? 'CAUTION'
          : 'FAIL',
      note:
        spreadPct !== null
          ? `Spread ${round(spreadPct)}%`
          : 'Spread no disponible'
    });

    checklist.push({
      key: 'volume',
      label: 'Volumen suficiente',
      status:
        volume >= 100
          ? 'PASS'
          : volume >= 25
          ? 'CAUTION'
          : 'FAIL',
      note: `Volumen del contrato: ${volume}`
    });

    checklist.push({
      key: 'openInterest',
      label: 'Open Interest suficiente',
      status:
        openInterest >= 500
          ? 'PASS'
          : openInterest >= 100
          ? 'CAUTION'
          : 'FAIL',
      note: `Open Interest: ${openInterest}`
    });

    checklist.push({
      key: 'delta',
      label: 'Delta adecuada',
      status:
        delta >= 0.20 && delta <= 0.70
          ? 'PASS'
          : delta > 0
          ? 'CAUTION'
          : 'FAIL',
      note:
        delta > 0
          ? `Delta ${round(delta, 4)}`
          : 'Delta no disponible'
    });

    checklist.push({
      key: 'theta',
      label: 'Theta aceptable',
      status:
        theta > 0 && theta <= 0.30
          ? 'PASS'
          : theta > 0
          ? 'CAUTION'
          : 'FAIL',
      note:
        theta > 0
          ? `Theta ${round(theta, 4)}`
          : 'Theta no disponible'
    });
  } else {
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
  }

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

function getExecutionStatus(analysis, rr, contractEvaluation) {
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

  if (contractEvaluation?.status === 'NO_APTO') {
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
  const real = getRealOptionContracts(analysis);

  if (real.primary) {
    return {
      source: 'REAL_OPTION_CHAIN',
      provider: real.provider || 'massive',
      isRealData: true,
      primary: normalizeContractSummary(real.primary),
      alternative: normalizeContractSummary(real.alternative),
      expiration: real.primary?.expiration || null,
      premiumTarget:
        real.primary?.mid ||
        real.primary?.ask ||
        real.primary?.last ||
        null,
      strikeStyle:
        real.primary?.inTheMoney
          ? 'ITM'
          : 'ATM/OTM según distancia al precio'
    };
  }

  const optionIdea = analysis?.optionIdea || {};

  return {
    source: 'ESTIMATED_OPTION_IDEA',
    provider: null,
    isRealData: false,
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

  const realOptionContracts = getRealOptionContracts(analysis);
  const contractEvaluation = evaluateContract(realOptionContracts.primary);

  const executionStatus = getExecutionStatus(
    analysis,
    riskReward1,
    contractEvaluation
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
    Number(marketBrain.risk || 50) <= 35 &&
    contractEvaluation.status === 'APTO'
  ) {
    difficulty = 'BAJA';
  } else if (
    quality < 75 ||
    Number(marketBrain.risk || 50) >= 65 ||
    Number(riskReward1 || 0) < 1.2 ||
    contractEvaluation.status === 'NO_APTO'
  ) {
    difficulty = 'ALTA';
  }

  const contracts = getSuggestedContracts(analysis);

  return {
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
    contractEvaluation,

    optionChainStatus: {
      connected: Boolean(realOptionContracts.primary),
      provider: realOptionContracts.provider || null,
      isRealData: Boolean(realOptionContracts.isRealData),
      status: realOptionContracts.status || null,
      warning: realOptionContracts.warning || null
    },

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
      realOptionContracts.primary
        ? 'El plan ya incorpora datos reales de Option Chain. Antes de ejecutar, Nexora valida spread, volumen, open interest, delta, theta, IV y liquidez del contrato.'
        : 'El plan todavía usa una idea estimada de contrato. Falta adjuntar la Option Chain real al análisis principal.'
  };
}
