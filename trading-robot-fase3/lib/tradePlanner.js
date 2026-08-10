// lib/tradePlanner.js
// NEXORA v3.3
// Trade Planner + Smart Option Chain Execution Gate

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
    validationStatus: contract?.validationStatus || null,
    combinedScore: num(contract?.combinedScore),
    executionScore: num(contract?.execution?.score),
    executionReasons: Array.isArray(contract?.execution?.reasons)
      ? contract.execution.reasons
      : [],
    executionHardFails: Array.isArray(contract?.execution?.hardFails)
      ? contract.execution.hardFails
      : [],
    source: contract.source || null
  };
}

function evaluateContract(contract) {
  if (!contract) {
    return {
      status: 'PENDING',
      score: 0,
      reasons: ['No hay contrato real validado']
    };
  }

  const providerStatus = contract?.validationStatus || null;

  if (providerStatus === 'SIN_COTIZACION') {
    return {
      status: 'NO_APTO',
      score: num(contract?.combinedScore, 0),
      reasons: ['El contrato no tiene bid/ask válido']
    };
  }

  if (providerStatus === 'NO_APTO') {
    return {
      status: 'NO_APTO',
      score: num(contract?.combinedScore, 0),
      reasons: [
        ...(Array.isArray(contract?.execution?.hardFails)
          ? contract.execution.hardFails
          : []),
        ...(Array.isArray(contract?.execution?.reasons)
          ? contract.execution.reasons
          : [])
      ]
    };
  }

  if (providerStatus === 'ESPERAR') {
    return {
      status: 'ESPERAR',
      score: num(contract?.combinedScore, 0),
      reasons: Array.isArray(contract?.execution?.reasons)
        ? contract.execution.reasons
        : ['Contrato real todavía en revisión']
    };
  }

  if (providerStatus === 'APTO') {
    return {
      status: 'APTO',
      score: num(contract?.combinedScore, 100),
      reasons: [
        ...(Array.isArray(contract?.liquidity?.reasons)
          ? contract.liquidity.reasons
          : []),
        ...(Array.isArray(contract?.execution?.reasons)
          ? contract.execution.reasons
          : [])
      ]
    };
  }

  // Compatibilidad con respuestas antiguas: nunca permite entrar si no
  // puede confirmar bid/ask real y métricas mínimas.
  const bid = num(contract.bid, 0);
  const ask = num(contract.ask, 0);

  if (!(bid > 0 && ask > 0 && ask >= bid)) {
    return {
      status: 'NO_APTO',
      score: 0,
      reasons: ['Bid/ask real no disponible']
    };
  }

  return {
    status: 'ESPERAR',
    score: num(contract?.liquidity?.score, 0),
    reasons: ['Contrato real recibido, pero falta estado APTO del validador']
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

  // La señal técnica por sí sola nunca autoriza ejecución.
  // El contrato real debe estar explícitamente APTO.
  if (contractEvaluation?.status !== 'APTO') {
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
    const primarySummary = normalizeContractSummary(real.primary);
    const alternativeSummary = normalizeContractSummary(real.alternative);

    const primaryIsApto =
      real.primary?.validationStatus === 'APTO';

    const alternativeIsApto =
      real.alternative?.validationStatus === 'APTO';

    return {
      source: 'REAL_OPTION_CHAIN',
      provider: real.provider || 'massive',
      isRealData: Boolean(real.isRealData),

      // Solo un contrato APTO puede presentarse como contrato definitivo.
      primary: primaryIsApto ? primarySummary : null,
      alternative:
        primaryIsApto && alternativeIsApto
          ? alternativeSummary
          : null,

      // Los candidatos quedan visibles para diagnóstico, no para ejecución.
      candidatePrimary: primarySummary,
      candidateAlternative: alternativeSummary,
      validationStatus:
        real.primary?.validationStatus ||
        real.status ||
        null,

      expiration:
        primaryIsApto
          ? real.primary?.expiration || null
          : null,

      premiumTarget:
        primaryIsApto
          ? real.primary?.mid ||
            real.primary?.ask ||
            real.primary?.last ||
            null
          : null,

      strikeStyle:
        primaryIsApto
          ? real.primary?.inTheMoney
            ? 'ITM'
            : 'ATM/OTM según distancia al precio'
          : null
    };
  }

  const optionIdea = analysis?.optionIdea || {};

  return {
    source: 'TECHNICAL_REFERENCE_ONLY',
    provider: null,
    isRealData: false,
    primary: null,
    alternative: null,
    candidatePrimary: null,
    candidateAlternative: null,
    technicalPrimary: optionIdea.contract || null,
    technicalAlternative: optionIdea.alternativeContract || null,
    validationStatus: 'PENDING',
    expiration: null,
    premiumTarget: null,
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
      connected: Boolean(realOptionContracts.isRealData),
      hasCandidate: Boolean(realOptionContracts.primary),
      hasAptoContract:
        realOptionContracts.primary?.validationStatus === 'APTO',
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
      realOptionContracts.primary?.validationStatus === 'APTO'
        ? 'El plan incorpora un contrato real APTO. La ejecución todavía depende de que la señal técnica y el precio de entrada sigan confirmados.'
        : realOptionContracts.primary
        ? 'Massive entregó un candidato real, pero Nexora no lo presenta como contrato definitivo hasta que el Validator lo marque APTO.'
        : 'No existe un contrato real validado. La idea de strike técnico queda únicamente como referencia y no autoriza ejecución.'
  };
}
