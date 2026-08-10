// lib/options.js
// NEXORA v3.0
// Option Chain Engine - Capa de normalización y selección
//
// Este módulo NO depende todavía de un proveedor específico.
// Su función es recibir una Option Chain, normalizarla,
// evaluar liquidez y seleccionar contratos candidatos.

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

  if (bid > 0 && ask > 0) {
    score += 15;
    reasons.push("Bid/ask disponible");
  } else {
    reasons.push("Bid/ask incompleto");
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
    isLiquid: score >= 50,
  };
}

export function enrichOptionContract(raw = {}, context = {}) {
  const contract = normalizeOptionContract(raw, context);
  const liquidity = scoreOptionLiquidity(contract);

  return {
    ...contract,
    liquidity,
  };
}

export function normalizeOptionChain(rawContracts = [], context = {}) {
  if (!Array.isArray(rawContracts)) return [];

  return rawContracts
    .map((contract) => enrichOptionContract(contract, context))
    .filter((contract) => contract.side && contract.strike !== null);
}

export function rankOptionContracts(
  contracts = [],
  {
    side = null,
    minLiquidityScore = 50,
    minDte = 0,
    maxDte = 60,
    maxDistancePct = 15,
  } = {}
) {
  const wantedSide = normalizeSide(side);

  return [...contracts]
    .filter((contract) => {
      if (wantedSide && contract.side !== wantedSide) return false;

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

      return (
        num(contract?.liquidity?.score, 0) >= minLiquidityScore
      );
    })
    .sort((a, b) => {
      const liquidityDiff =
        num(b?.liquidity?.score, 0) -
        num(a?.liquidity?.score, 0);

      if (liquidityDiff !== 0) return liquidityDiff;

      const distanceA = num(a.distanceFromPricePct, 999);
      const distanceB = num(b.distanceFromPricePct, 999);

      if (distanceA !== distanceB) {
        return distanceA - distanceB;
      }

      return (
        num(b.openInterest, 0) -
        num(a.openInterest, 0)
      );
    });
}

export function selectOptionCandidates(
  rawContracts = [],
  context = {},
  rules = {}
) {
  const normalized = normalizeOptionChain(rawContracts, context);

  const ranked = rankOptionContracts(normalized, rules);

  const primary = ranked[0] ?? null;
  const alternative = ranked[1] ?? null;

  return {
    source: context.source ?? "unknown",
    underlying: context.symbol ?? null,
    underlyingPrice: round(context.underlyingPrice, 2),

    totalContracts: normalized.length,
    eligibleContracts: ranked.length,

    primary,
    alternative,

    status:
      primary
        ? "CONTRATO_CANDIDATO"
        : "SIN_CONTRATO_LIQUIDO",

    warning:
      primary
        ? null
        : "No se encontró un contrato que cumpla los filtros mínimos de liquidez.",

    contracts: ranked,
  };
}
