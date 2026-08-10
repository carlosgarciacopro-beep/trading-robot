// lib/options.js
// NEXORA v3.2
// Option Chain Validator v2 - ejecución, liquidez y selección profesional

const clamp = (value, min, max) =>
  Math.min(max, Math.max(min, Number(value) || 0));

const num = (value, fallback = null) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const round = (value, decimals = 2) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const factor = 10 ** decimals;
  return Math.round(n * factor) / factor;
};

const normalizeSide = (value) => {
  const side = String(value || "").toUpperCase();
  if (side === "CALL" || side === "C") return "CALL";
  if (side === "PUT" || side === "P") return "PUT";
  return null;
};

const normalizeExpiration = (value) => {
  if (!value) return null;

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  if (typeof value === "number") {
    const date = new Date(value > 10_000_000_000 ? value : value * 1000);
    if (!Number.isNaN(date.getTime())) return date.toISOString().slice(0, 10);
  }

  const text = String(value).trim();
  const date = new Date(text);

  if (!Number.isNaN(date.getTime())) {
    return date.toISOString().slice(0, 10);
  }

  return text || null;
};

export function daysToExpiration(expiration, now = new Date()) {
  if (!expiration) return null;

  const exp = new Date(`${expiration}T16:00:00`);
  if (Number.isNaN(exp.getTime())) return null;

  const milliseconds = exp.getTime() - now.getTime();

  return Math.max(
    0,
    Math.ceil(milliseconds / (1000 * 60 * 60 * 24))
  );
}

export function normalizeOptionContract(raw = {}, context = {}) {
  const bid = num(raw.bid, 0);
  const ask = num(raw.ask, 0);
  const last = num(
    raw.last ?? raw.lastPrice ?? raw.mark ?? raw.regularMarketPrice,
    0
  );

  let mid = null;

  if (bid > 0 && ask > 0 && ask >= bid) {
    mid = (bid + ask) / 2;
  } else if (last > 0) {
    mid = last;
  }

  const spread =
    bid > 0 && ask > 0 && ask >= bid
      ? ask - bid
      : null;

  const spreadPct =
    spread !== null && mid > 0
      ? (spread / mid) * 100
      : null;

  const strike = num(raw.strike);

  const underlyingPrice = num(
    context.underlyingPrice ??
      raw.underlyingPrice ??
      raw.underlying_price
  );

  let distanceFromPricePct = null;

  if (
    strike !== null &&
    underlyingPrice !== null &&
    underlyingPrice > 0
  ) {
    distanceFromPricePct =
      (Math.abs(strike - underlyingPrice) / underlyingPrice) * 100;
  }

  const expiration = normalizeExpiration(
    raw.expiration ?? raw.expirationDate ?? raw.expiry
  );

  const side = normalizeSide(
    raw.side ?? raw.type ?? raw.optionType ?? raw.contractType
  );

  return {
    symbol:
      raw.contractSymbol ??
      raw.symbol ??
      raw.ticker ??
      null,

    underlying:
      context.symbol ??
      raw.underlying ??
      raw.underlyingSymbol ??
      null,

    side,
    expiration,
    dte: daysToExpiration(expiration),
    strike: round(strike, 2),

    bid: round(bid, 2),
    ask: round(ask, 2),
    last: round(last, 2),
    mid: round(mid, 2),

    spread: round(spread, 2),
    spreadPct: round(spreadPct, 2),

    volume: Math.max(0, Math.round(num(raw.volume, 0))),

    openInterest: Math.max(
      0,
      Math.round(
        num(raw.openInterest ?? raw.open_interest ?? raw.oi, 0)
      )
    ),

    impliedVolatility: round(
      num(
        raw.impliedVolatility ??
          raw.implied_volatility ??
          raw.iv
      ),
      4
    ),

    delta: round(num(raw.delta), 4),
    gamma: round(num(raw.gamma), 4),
    theta: round(num(raw.theta), 4),
    vega: round(num(raw.vega), 4),
    rho: round(num(raw.rho), 4),

    underlyingPrice: round(underlyingPrice, 2),
    distanceFromPricePct: round(distanceFromPricePct, 2),

    inTheMoney: Boolean(
      raw.inTheMoney ?? raw.in_the_money ?? false
    ),

    currency: raw.currency ?? context.currency ?? "USD",
    source: context.source ?? raw.source ?? "unknown",
  };
}

export function scoreOptionLiquidity(contract = {}) {
  let score = 0;
  const reasons = [];

  const bid = num(contract.bid, 0);
  const ask = num(contract.ask, 0);
  const spreadPct = num(contract.spreadPct);
  const volume = num(contract.volume, 0);
  const openInterest = num(contract.openInterest, 0);

  const hasValidQuote = bid > 0 && ask > 0 && ask >= bid;

  if (hasValidQuote) {
    score += 15;
    reasons.push("Bid/ask válido");
  } else {
    reasons.push("Sin cotización bid/ask válida");
  }

  if (spreadPct !== null) {
    if (spreadPct <= 5) {
      score += 30;
      reasons.push("Spread excelente");
    } else if (spreadPct <= 10) {
      score += 24;
      reasons.push("Spread bueno");
    } else if (spreadPct <= 15) {
      score += 16;
      reasons.push("Spread aceptable");
    } else if (spreadPct <= 25) {
      score += 7;
      reasons.push("Spread amplio");
    } else {
      reasons.push("Spread excesivo");
    }
  } else {
    reasons.push("Spread no evaluable");
  }

  if (volume >= 1000) {
    score += 25;
    reasons.push("Volumen muy alto");
  } else if (volume >= 500) {
    score += 21;
    reasons.push("Volumen alto");
  } else if (volume >= 100) {
    score += 15;
    reasons.push("Volumen suficiente");
  } else if (volume >= 25) {
    score += 8;
    reasons.push("Volumen moderado");
  } else {
    reasons.push("Volumen bajo");
  }

  if (openInterest >= 2000) {
    score += 30;
    reasons.push("Open Interest muy alto");
  } else if (openInterest >= 1000) {
    score += 25;
    reasons.push("Open Interest alto");
  } else if (openInterest >= 500) {
    score += 20;
    reasons.push("Open Interest bueno");
  } else if (openInterest >= 100) {
    score += 12;
    reasons.push("Open Interest aceptable");
  } else {
    reasons.push("Open Interest bajo");
  }

  score = clamp(score, 0, 100);

  let status = "BAJA";

  if (score >= 80) status = "EXCELENTE";
  else if (score >= 65) status = "BUENA";
  else if (score >= 50) status = "ACEPTABLE";
  else if (score >= 35) status = "LIMITADA";

  return {
    score,
    status,
    reasons,
    hasValidQuote,
    isLiquid: hasValidQuote && score >= 50,
  };
}

export function scoreOptionExecution(contract = {}, rules = {}) {
  const side = normalizeSide(contract.side);
  const absDelta =
    contract.delta == null ? null : Math.abs(num(contract.delta, 0));
  const absTheta =
    contract.theta == null ? null : Math.abs(num(contract.theta, 0));
  const iv = num(contract.impliedVolatility);
  const dte = num(contract.dte);
  const distance = num(contract.distanceFromPricePct);

  const minDelta = num(rules.minDelta, 0.15);
  const idealDeltaLow = num(rules.idealDeltaLow, 0.2);
  const idealDeltaHigh = num(rules.idealDeltaHigh, 0.45);
  const maxDelta = num(rules.maxDelta, 0.7);
  const maxThetaAbs = num(rules.maxThetaAbs, 0.25);
  const maxIv = num(rules.maxIv, 2.5);
  const minDte = num(rules.minDte, 0);
  const maxDte = num(rules.maxDte, 60);
  const maxDistancePct = num(rules.maxDistancePct, 15);

  let score = 0;
  const reasons = [];
  const hardFails = [];

  if (!(contract.bid > 0 && contract.ask > 0 && contract.ask >= contract.bid)) {
    hardFails.push("Sin cotización bid/ask válida");
  }

  if (dte !== null && (dte < minDte || dte > maxDte)) {
    hardFails.push(`DTE fuera de rango (${dte})`);
  }

  if (distance !== null && distance > maxDistancePct) {
    hardFails.push(`Strike demasiado alejado (${round(distance, 2)}%)`);
  }

  if (absDelta === null) {
    reasons.push("Delta no disponible");
  } else if (absDelta < minDelta) {
    hardFails.push(`Delta demasiado baja (${round(absDelta, 3)})`);
  } else if (absDelta <= idealDeltaHigh && absDelta >= idealDeltaLow) {
    score += 30;
    reasons.push(`Delta en rango ideal (${round(absDelta, 3)})`);
  } else if (absDelta <= maxDelta) {
    score += 20;
    reasons.push(`Delta operable (${round(absDelta, 3)})`);
  } else {
    score += 8;
    reasons.push(`Delta alta (${round(absDelta, 3)})`);
  }

  if (absTheta === null) {
    reasons.push("Theta no disponible");
  } else if (absTheta <= 0.05) {
    score += 15;
    reasons.push("Theta favorable");
  } else if (absTheta <= 0.12) {
    score += 10;
    reasons.push("Theta aceptable");
  } else if (absTheta <= maxThetaAbs) {
    score += 5;
    reasons.push("Theta elevado pero tolerable");
  } else {
    hardFails.push(`Theta demasiado alto (${round(absTheta, 3)})`);
  }

  if (iv === null) {
    reasons.push("IV no disponible");
  } else if (iv <= 0.8) {
    score += 15;
    reasons.push("IV contenida");
  } else if (iv <= 1.5) {
    score += 10;
    reasons.push("IV moderada");
  } else if (iv <= maxIv) {
    score += 5;
    reasons.push("IV elevada");
  } else {
    hardFails.push(`IV excesiva (${round(iv, 3)})`);
  }

  if (dte !== null) {
    if (dte >= 7 && dte <= 21) {
      score += 20;
      reasons.push(`DTE adecuado para swing (${dte})`);
    } else if (dte >= 2 && dte <= 45) {
      score += 12;
      reasons.push(`DTE operable (${dte})`);
    } else {
      score += 4;
      reasons.push(`DTE menos favorable (${dte})`);
    }
  }

  if (distance !== null) {
    if (distance <= 2) {
      score += 20;
      reasons.push("Strike cercano al precio");
    } else if (distance <= 5) {
      score += 14;
      reasons.push("Strike razonablemente cercano");
    } else if (distance <= 10) {
      score += 8;
      reasons.push("Strike algo alejado");
    } else {
      score += 2;
      reasons.push("Strike lejano");
    }
  }

  // Penalización si el signo de delta no coincide con CALL/PUT.
  if (contract.delta != null && side === "CALL" && contract.delta < 0) {
    hardFails.push("Delta inconsistente para CALL");
  }
  if (contract.delta != null && side === "PUT" && contract.delta > 0) {
    hardFails.push("Delta inconsistente para PUT");
  }

  score = clamp(score, 0, 100);

  return {
    score,
    reasons,
    hardFails,
    isExecutable: hardFails.length === 0 && score >= 45,
  };
}

export function enrichOptionContract(raw = {}, context = {}, rules = {}) {
  const contract = normalizeOptionContract(raw, context);
  const liquidity = scoreOptionLiquidity(contract);
  const execution = scoreOptionExecution(contract, rules);

  const combinedScore = clamp(
    liquidity.score * 0.55 + execution.score * 0.45,
    0,
    100
  );

  let validationStatus = "NO_APTO";

  if (!liquidity.hasValidQuote) {
    validationStatus = "SIN_COTIZACION";
  } else if (
    liquidity.isLiquid &&
    execution.isExecutable &&
    combinedScore >= 70
  ) {
    validationStatus = "APTO";
  } else if (
    liquidity.score >= 45 &&
    execution.hardFails.length === 0 &&
    combinedScore >= 50
  ) {
    validationStatus = "ESPERAR";
  }

  return {
    ...contract,
    liquidity,
    execution,
    combinedScore: round(combinedScore, 1),
    validationStatus,
    isEligible:
      validationStatus === "APTO" ||
      validationStatus === "ESPERAR",
  };
}

export function normalizeOptionChain(
  rawContracts = [],
  context = {},
  rules = {}
) {
  if (!Array.isArray(rawContracts)) return [];

  return rawContracts
    .map((contract) => enrichOptionContract(contract, context, rules))
    .filter((contract) => contract.side && contract.strike !== null);
}

export function rankOptionContracts(
  contracts = [],
  {
    side = null,
    minLiquidityScore = 50,
    minCombinedScore = 50,
    minDte = 0,
    maxDte = 60,
    maxDistancePct = 15,
    minDelta = 0.15,
    idealDeltaLow = 0.2,
    idealDeltaHigh = 0.45,
    maxDelta = 0.7,
    maxThetaAbs = 0.25,
    maxIv = 2.5,
  } = {}
) {
  const wantedSide = normalizeSide(side);

  return [...contracts]
    .filter((contract) => {
      if (wantedSide && contract.side !== wantedSide) return false;

      if (!(contract.bid > 0 && contract.ask > 0 && contract.ask >= contract.bid)) {
        return false;
      }

      if (
        contract.dte !== null &&
        (contract.dte < minDte || contract.dte > maxDte)
      ) {
        return false;
      }

      if (
        contract.distanceFromPricePct !== null &&
        contract.distanceFromPricePct > maxDistancePct
      ) {
        return false;
      }

      const absDelta =
        contract.delta == null ? null : Math.abs(num(contract.delta, 0));

      if (absDelta !== null) {
        if (absDelta < minDelta || absDelta > maxDelta) return false;
      }

      const absTheta =
        contract.theta == null ? null : Math.abs(num(contract.theta, 0));

      if (absTheta !== null && absTheta > maxThetaAbs) {
        return false;
      }

      const iv = num(contract.impliedVolatility);
      if (iv !== null && iv > maxIv) {
        return false;
      }

      if (num(contract?.liquidity?.score, 0) < minLiquidityScore) {
        return false;
      }

      if (num(contract?.combinedScore, 0) < minCombinedScore) {
        return false;
      }

      return contract.validationStatus !== "NO_APTO";
    })
    .sort((a, b) => {
      // 1) APTO siempre gana a ESPERAR
      const statusRank = { APTO: 2, ESPERAR: 1 };
      const statusDiff =
        (statusRank[b.validationStatus] || 0) -
        (statusRank[a.validationStatus] || 0);
      if (statusDiff !== 0) return statusDiff;

      // 2) Score combinado
      const combinedDiff =
        num(b.combinedScore, 0) - num(a.combinedScore, 0);
      if (combinedDiff !== 0) return combinedDiff;

      // 3) Delta más cercana a 0.30
      const deltaTarget = 0.3;
      const deltaA =
        a.delta == null ? 999 : Math.abs(Math.abs(a.delta) - deltaTarget);
      const deltaB =
        b.delta == null ? 999 : Math.abs(Math.abs(b.delta) - deltaTarget);
      if (deltaA !== deltaB) return deltaA - deltaB;

      // 4) Menor spread
      const spreadA = num(a.spreadPct, 999);
      const spreadB = num(b.spreadPct, 999);
      if (spreadA !== spreadB) return spreadA - spreadB;

      // 5) Menor distancia al precio
      const distanceA = num(a.distanceFromPricePct, 999);
      const distanceB = num(b.distanceFromPricePct, 999);
      if (distanceA !== distanceB) return distanceA - distanceB;

      // 6) Mayor OI
      return num(b.openInterest, 0) - num(a.openInterest, 0);
    });
}

export function selectOptionCandidates(
  rawContracts = [],
  context = {},
  rules = {}
) {
  const normalized = normalizeOptionChain(rawContracts, context, rules);
  const ranked = rankOptionContracts(normalized, rules);

  const primary = ranked[0] ?? null;
  const alternative = ranked[1] ?? null;

  let status = "NO_APTO";
  let warning =
    "No se encontró un contrato que cumpla los filtros mínimos de ejecución.";

  if (primary?.validationStatus === "APTO") {
    status = "APTO";
    warning = null;
  } else if (primary?.validationStatus === "ESPERAR") {
    status = "ESPERAR";
    warning =
      "Existe un contrato candidato, pero todavía no cumple calidad suficiente para ejecución directa.";
  } else if (
    normalized.some((contract) => contract.validationStatus === "SIN_COTIZACION")
  ) {
    status = "SIN_COTIZACION";
    warning =
      "La cadena contiene contratos sin bid/ask válido; Nexora no los usa como candidatos.";
  }

  return {
    source: context.source ?? "unknown",
    underlying: context.symbol ?? null,
    underlyingPrice: round(context.underlyingPrice, 2),

    totalContracts: normalized.length,
    eligibleContracts: ranked.length,

    primary,
    alternative,

    status,
    warning,

    contracts: ranked,
  };
}
