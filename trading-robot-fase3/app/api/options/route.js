// app/api/options/route.js
// NEXORA v3.5 DIAGNOSTICO
// Option Chain API
// Massive Dual Search Engine:
// 1) Option Chain Snapshot
// 2) Reference Contract Discovery + Individual Snapshots
//
// Objetivo:
// - no asumir que "0 contratos" significa que no existen;
// - comprobar primero la cadena;
// - si la cadena viene vacía, descubrir contratos reales en Reference API;
// - reconsultar snapshots individuales;
// - conservar Execution Gate: sin bid/ask real no hay contrato APTO.

import { NextResponse } from "next/server";
import {
  normalizeOptionChain,
  rankOptionContracts,
  selectOptionCandidates,
} from "../../../lib/options";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const MASSIVE_BASE_URL = "https://api.massive.com";

const cleanSymbol = (value) =>
  String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9.^-]/g, "");

const normalizeSide = (value) => {
  const side = String(value || "").trim().toUpperCase();
  if (side === "CALL" || side === "C") return "CALL";
  if (side === "PUT" || side === "P") return "PUT";
  return null;
};

const sideForMassive = (side) => {
  if (side === "CALL") return "call";
  if (side === "PUT") return "put";
  return null;
};

const toNumber = (value, fallback = null) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const clamp = (value, min, max) =>
  Math.min(max, Math.max(min, value));

const round = (value, decimals = 2) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const factor = 10 ** decimals;
  return Math.round(n * factor) / factor;
};

const isoDate = (date) => date.toISOString().slice(0, 10);

const addDays = (date, days) => {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
};

function getRulesFromParams(searchParams) {
  const minDte = Math.max(
    0,
    Math.round(toNumber(searchParams.get("minDte"), 0))
  );

  const maxDte = Math.max(
    minDte,
    Math.round(toNumber(searchParams.get("maxDte"), 60))
  );

  return {
    minLiquidityScore: clamp(
      toNumber(searchParams.get("minLiquidityScore"), 50),
      0,
      100
    ),
    minCombinedScore: clamp(
      toNumber(searchParams.get("minCombinedScore"), 50),
      0,
      100
    ),
    minDte,
    maxDte,
    maxDistancePct: Math.max(
      0,
      toNumber(searchParams.get("maxDistancePct"), 15)
    ),
    minDelta: Math.max(
      0,
      toNumber(searchParams.get("minDelta"), 0.15)
    ),
    idealDeltaLow: Math.max(
      0,
      toNumber(searchParams.get("idealDeltaLow"), 0.2)
    ),
    idealDeltaHigh: Math.max(
      0,
      toNumber(searchParams.get("idealDeltaHigh"), 0.45)
    ),
    maxDelta: Math.max(
      0,
      toNumber(searchParams.get("maxDelta"), 0.7)
    ),
    maxThetaAbs: Math.max(
      0,
      toNumber(searchParams.get("maxThetaAbs"), 0.25)
    ),
    maxIv: Math.max(
      0,
      toNumber(searchParams.get("maxIv"), 2.5)
    ),
    maxPages: clamp(
      Math.round(toNumber(searchParams.get("maxPages"), 4)),
      1,
      6
    ),
    refreshCandidates: clamp(
      Math.round(toNumber(searchParams.get("refreshCandidates"), 12)),
      0,
      20
    ),
    referenceCandidates: clamp(
      Math.round(toNumber(searchParams.get("referenceCandidates"), 16)),
      1,
      24
    ),
  };
}

function normalizeRules(bodyRules = {}) {
  const minDte = Math.max(
    0,
    Math.round(toNumber(bodyRules?.minDte, 0))
  );

  const maxDte = Math.max(
    minDte,
    Math.round(toNumber(bodyRules?.maxDte, 60))
  );

  return {
    minLiquidityScore: clamp(
      toNumber(bodyRules?.minLiquidityScore, 50),
      0,
      100
    ),
    minCombinedScore: clamp(
      toNumber(bodyRules?.minCombinedScore, 50),
      0,
      100
    ),
    minDte,
    maxDte,
    maxDistancePct: Math.max(
      0,
      toNumber(bodyRules?.maxDistancePct, 15)
    ),
    minDelta: Math.max(
      0,
      toNumber(bodyRules?.minDelta, 0.15)
    ),
    idealDeltaLow: Math.max(
      0,
      toNumber(bodyRules?.idealDeltaLow, 0.2)
    ),
    idealDeltaHigh: Math.max(
      0,
      toNumber(bodyRules?.idealDeltaHigh, 0.45)
    ),
    maxDelta: Math.max(
      0,
      toNumber(bodyRules?.maxDelta, 0.7)
    ),
    maxThetaAbs: Math.max(
      0,
      toNumber(bodyRules?.maxThetaAbs, 0.25)
    ),
    maxIv: Math.max(
      0,
      toNumber(bodyRules?.maxIv, 2.5)
    ),
    maxPages: clamp(
      Math.round(toNumber(bodyRules?.maxPages, 4)),
      1,
      6
    ),
    refreshCandidates: clamp(
      Math.round(toNumber(bodyRules?.refreshCandidates, 12)),
      0,
      20
    ),
    referenceCandidates: clamp(
      Math.round(toNumber(bodyRules?.referenceCandidates, 16)),
      1,
      24
    ),
  };
}

// ============================================================
// URL BUILDERS
// ============================================================

function buildSnapshotChainUrl({
  symbol,
  side,
  minDte = 0,
  maxDte = 60,
}) {
  const today = new Date();
  const startDate = isoDate(addDays(today, Math.max(0, minDte)));
  const endDate = isoDate(addDays(today, Math.max(minDte, maxDte)));

  const url = new URL(
    `/v3/snapshot/options/${encodeURIComponent(symbol)}`,
    MASSIVE_BASE_URL
  );

  const massiveSide = sideForMassive(side);
  if (massiveSide) url.searchParams.set("contract_type", massiveSide);

  url.searchParams.set("expiration_date.gte", startDate);
  url.searchParams.set("expiration_date.lte", endDate);
  url.searchParams.set("limit", "250");
  url.searchParams.set("sort", "expiration_date");
  url.searchParams.set("order", "asc");

  return url;
}

function buildReferenceContractsUrl({
  symbol,
  side,
  minDte = 0,
  maxDte = 60,
}) {
  const today = new Date();
  const startDate = isoDate(addDays(today, Math.max(0, minDte)));
  const endDate = isoDate(addDays(today, Math.max(minDte, maxDte)));

  const url = new URL(
    "/v3/reference/options/contracts",
    MASSIVE_BASE_URL
  );

  url.searchParams.set("underlying_ticker", symbol);

  const massiveSide = sideForMassive(side);
  if (massiveSide) url.searchParams.set("contract_type", massiveSide);

  url.searchParams.set("expiration_date.gte", startDate);
  url.searchParams.set("expiration_date.lte", endDate);
  url.searchParams.set("expired", "false");
  url.searchParams.set("limit", "1000");
  url.searchParams.set("sort", "expiration_date");
  url.searchParams.set("order", "asc");

  return url;
}

// ============================================================
// MAPPERS
// ============================================================

function mapMassiveContract(item = {}, fallback = {}) {
  const details = item?.details || {};
  const quote = item?.last_quote || {};
  const trade = item?.last_trade || {};
  const greeks = item?.greeks || {};
  const day = item?.day || {};
  const session = item?.session || {};
  const underlying = item?.underlying_asset || {};

  const contractSide =
    details?.contract_type === "call"
      ? "CALL"
      : details?.contract_type === "put"
      ? "PUT"
      : null;

  const strike = toNumber(details?.strike_price);

  const underlyingPrice =
    toNumber(underlying?.price) ??
    toNumber(fallback?.underlyingPrice);

  const volume =
    toNumber(day?.volume) ??
    toNumber(session?.volume) ??
    0;

  const last =
    toNumber(trade?.price) ??
    toNumber(day?.close) ??
    toNumber(session?.close) ??
    toNumber(quote?.midpoint) ??
    null;

  return {
    contractSymbol: details?.ticker || item?.ticker || null,
    underlying: underlying?.ticker || fallback?.symbol || null,
    side: contractSide,
    expiration: details?.expiration_date || null,
    strike,
    bid: toNumber(quote?.bid, 0),
    ask: toNumber(quote?.ask, 0),
    last,
    volume,
    openInterest: toNumber(item?.open_interest, 0),
    impliedVolatility: toNumber(item?.implied_volatility),
    delta: toNumber(greeks?.delta),
    gamma: toNumber(greeks?.gamma),
    theta: toNumber(greeks?.theta),
    vega: toNumber(greeks?.vega),
    rho: null,
    underlyingPrice,
    inTheMoney:
      contractSide === "CALL" &&
      underlyingPrice !== null &&
      strike !== null
        ? underlyingPrice > strike
        : contractSide === "PUT" &&
          underlyingPrice !== null &&
          strike !== null
        ? underlyingPrice < strike
        : false,
    currency: "USD",
    source: "massive",
  };
}

function mapReferenceContract(item = {}, fallback = {}) {
  const side =
    item?.contract_type === "call"
      ? "CALL"
      : item?.contract_type === "put"
      ? "PUT"
      : null;

  return {
    contractSymbol: item?.ticker || null,
    underlying: item?.underlying_ticker || fallback?.symbol || null,
    side,
    expiration: item?.expiration_date || null,
    strike: toNumber(item?.strike_price),
    bid: 0,
    ask: 0,
    last: null,
    volume: 0,
    openInterest: 0,
    impliedVolatility: null,
    delta: null,
    gamma: null,
    theta: null,
    vega: null,
    rho: null,
    underlyingPrice: toNumber(fallback?.underlyingPrice),
    inTheMoney: false,
    currency: "USD",
    source: "massive-reference",
  };
}

// ============================================================
// HELPERS
// ============================================================

function hasValidQuote(contract) {
  const bid = toNumber(contract?.bid, 0);
  const ask = toNumber(contract?.ask, 0);
  return bid > 0 && ask > 0 && ask >= bid;
}

function contractKey(contract) {
  return (
    contract?.contractSymbol ||
    contract?.symbol ||
    [
      contract?.expiration || "",
      contract?.strike ?? "",
      contract?.side || "",
    ].join("|")
  );
}

function mergeContracts(baseContracts = [], refreshedContracts = []) {
  const map = new Map();

  for (const contract of baseContracts) {
    map.set(contractKey(contract), contract);
  }

  for (const contract of refreshedContracts) {
    const key = contractKey(contract);
    if (!key) continue;

    const previous = map.get(key) || {};

    map.set(key, {
      ...previous,
      ...contract,
      bid: toNumber(contract?.bid, 0) > 0 ? contract.bid : previous.bid,
      ask: toNumber(contract?.ask, 0) > 0 ? contract.ask : previous.ask,
      last: toNumber(contract?.last) ?? previous.last ?? null,
      volume:
        toNumber(contract?.volume, 0) > 0
          ? contract.volume
          : previous.volume ?? 0,
      openInterest:
        toNumber(contract?.openInterest, 0) > 0
          ? contract.openInterest
          : previous.openInterest ?? 0,
      impliedVolatility:
        toNumber(contract?.impliedVolatility) ??
        previous.impliedVolatility ??
        null,
      delta: toNumber(contract?.delta) ?? previous.delta ?? null,
      gamma: toNumber(contract?.gamma) ?? previous.gamma ?? null,
      theta: toNumber(contract?.theta) ?? previous.theta ?? null,
      vega: toNumber(contract?.vega) ?? previous.vega ?? null,
      underlyingPrice:
        toNumber(contract?.underlyingPrice) ??
        previous.underlyingPrice ??
        null,
    });
  }

  return Array.from(map.values());
}

function sortNearTarget(
  contracts = [],
  targetStrike = null,
  underlyingPrice = null
) {
  const center =
    toNumber(targetStrike) ??
    toNumber(underlyingPrice);

  return [...contracts].sort((a, b) => {
    if (center !== null) {
      const da = Math.abs(toNumber(a?.strike, center) - center);
      const db = Math.abs(toNumber(b?.strike, center) - center);
      if (da !== db) return da - db;
    }

    const ea = String(a?.expiration || "");
    const eb = String(b?.expiration || "");
    if (ea !== eb) return ea.localeCompare(eb);

    return toNumber(a?.strike, 0) - toNumber(b?.strike, 0);
  });
}

function filterByDistance(
  contracts = [],
  targetStrike = null,
  underlyingPrice = null,
  maxDistancePct = 15
) {
  const center =
    toNumber(targetStrike) ??
    toNumber(underlyingPrice);

  if (center === null || center <= 0) return contracts;

  const maxPct = Math.max(0, toNumber(maxDistancePct, 15));

  return contracts.filter((contract) => {
    const strike = toNumber(contract?.strike);
    if (strike === null) return false;

    const distancePct =
      (Math.abs(strike - center) / center) * 100;

    return distancePct <= maxPct;
  });
}

async function readMassiveError(response) {
  try {
    const payload = await response.json();
    return payload?.error || payload?.message || payload?.status || "";
  } catch {
    return "";
  }
}

async function fetchMassiveJson(url, apiKey) {
  const requestUrl =
    url instanceof URL
      ? new URL(url.toString())
      : new URL(String(url), MASSIVE_BASE_URL);

  if (!requestUrl.searchParams.get("apiKey")) {
    requestUrl.searchParams.set("apiKey", apiKey);
  }

  const response = await fetch(requestUrl.toString(), {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await readMassiveError(response);
    const error = new Error(
      detail || `Massive respondió HTTP ${response.status}.`
    );
    error.status = response.status;
    throw error;
  }

  return response.json();
}

async function fetchMassivePages(initialUrl, apiKey, maxPages = 4) {
  const results = [];
  let nextUrl = initialUrl.toString();
  let requestId = null;
  let status = null;
  let pagesRead = 0;
  let hasMore = false;

  while (nextUrl && pagesRead < maxPages) {
    const payload = await fetchMassiveJson(nextUrl, apiKey);

    if (!requestId) requestId = payload?.request_id || null;
    status = payload?.status || status;

    if (Array.isArray(payload?.results)) {
      results.push(...payload.results);
    }

    pagesRead += 1;
    nextUrl = payload?.next_url || null;
    hasMore = Boolean(nextUrl);
  }

  return {
    results,
    requestId,
    status,
    pagesRead,
    hasMore,
  };
}

async function fetchSingleContractSnapshot({
  symbol,
  contractSymbol,
  apiKey,
  fallbackUnderlyingPrice,
}) {
  if (!contractSymbol) return null;

  const url = new URL(
    `/v3/snapshot/options/${encodeURIComponent(symbol)}/${encodeURIComponent(contractSymbol)}`,
    MASSIVE_BASE_URL
  );

  try {
    const payload = await fetchMassiveJson(url, apiKey);
    const result = payload?.results;

    if (!result || typeof result !== "object") return null;

    return mapMassiveContract(result, {
      symbol,
      underlyingPrice: fallbackUnderlyingPrice,
    });
  } catch (error) {
    console.warn(
      `[NEXORA Option Chain] Snapshot individual ${contractSymbol}:`,
      error?.message || error
    );
    return null;
  }
}

// ============================================================
// PROVIDER SEARCH
// ============================================================

async function fetchProviderOptionChain({
  symbol,
  side,
  underlyingPrice,
  targetStrike,
  rules,
}) {
  const apiKey = process.env.MASSIVE_API_KEY;

  if (!apiKey) {
    return {
      provider: "massive",
      source: "massive",
      symbol,
      side,
      underlyingPrice,
      targetStrike,
      contracts: [],
      isRealData: false,
      message: "MASSIVE_API_KEY no está disponible en el servidor.",
      errorCode: "MISSING_API_KEY",
    };
  }

  let chainResult = null;
  let chainError = null;

  // ----------------------------------------------------------
  // CAPA 1: Snapshot de cadena
  // ----------------------------------------------------------

  try {
    const chainUrl = buildSnapshotChainUrl({
      symbol,
      side,
      minDte: rules?.minDte ?? 0,
      maxDte: rules?.maxDte ?? 60,
    });

    chainResult = await fetchMassivePages(
      chainUrl,
      apiKey,
      rules?.maxPages ?? 4
    );
  } catch (error) {
    chainError = error;
  }

  let rawSnapshotResults = chainResult?.results || [];

  let detectedUnderlyingPrice = toNumber(underlyingPrice);

  if (
    detectedUnderlyingPrice === null &&
    rawSnapshotResults.length > 0
  ) {
    detectedUnderlyingPrice = toNumber(
      rawSnapshotResults[0]?.underlying_asset?.price
    );
  }

  let snapshotContracts = rawSnapshotResults
    .map((item) =>
      mapMassiveContract(item, {
        symbol,
        underlyingPrice: detectedUnderlyingPrice,
      })
    )
    .filter(
      (contract) =>
        contract.side &&
        contract.expiration &&
        contract.strike !== null
    );

  snapshotContracts = filterByDistance(
    snapshotContracts,
    targetStrike,
    detectedUnderlyingPrice,
    rules?.maxDistancePct ?? 15
  );

  const validQuotesBeforeRefresh =
    snapshotContracts.filter(hasValidQuote).length;

  // Refrescar cercanos sin cotización
  const refreshPool = sortNearTarget(
    snapshotContracts.filter((contract) => !hasValidQuote(contract)),
    targetStrike,
    detectedUnderlyingPrice
  ).slice(0, rules?.refreshCandidates ?? 12);

  let refreshedFromChain = [];

  if (refreshPool.length > 0) {
    const refreshed = await Promise.all(
      refreshPool.map((contract) =>
        fetchSingleContractSnapshot({
          symbol,
          contractSymbol: contract.contractSymbol,
          apiKey,
          fallbackUnderlyingPrice: detectedUnderlyingPrice,
        })
      )
    );

    refreshedFromChain = refreshed.filter(Boolean);
    snapshotContracts = mergeContracts(
      snapshotContracts,
      refreshedFromChain
    );
  }

  const validQuotesAfterRefresh =
    snapshotContracts.filter(hasValidQuote).length;

  // ----------------------------------------------------------
  // CAPA 2: Reference Contracts si Snapshot no encontró contratos
  // ----------------------------------------------------------

  let referenceResult = null;
  let referenceError = null;
  let referenceContracts = [];
  let referenceCandidates = [];
  let individualReferenceSnapshots = [];

  if (snapshotContracts.length === 0) {
    try {
      const referenceUrl = buildReferenceContractsUrl({
        symbol,
        side,
        minDte: rules?.minDte ?? 0,
        maxDte: rules?.maxDte ?? 60,
      });

      referenceResult = await fetchMassivePages(
        referenceUrl,
        apiKey,
        rules?.maxPages ?? 4
      );

      referenceContracts = (referenceResult?.results || [])
        .map((item) =>
          mapReferenceContract(item, {
            symbol,
            underlyingPrice: detectedUnderlyingPrice,
          })
        )
        .filter(
          (contract) =>
            contract.side &&
            contract.expiration &&
            contract.strike !== null
        );

      referenceContracts = filterByDistance(
        referenceContracts,
        targetStrike,
        detectedUnderlyingPrice,
        rules?.maxDistancePct ?? 15
      );

      referenceCandidates = sortNearTarget(
        referenceContracts,
        targetStrike,
        detectedUnderlyingPrice
      ).slice(0, rules?.referenceCandidates ?? 16);

      if (referenceCandidates.length > 0) {
        const snapshots = await Promise.all(
          referenceCandidates.map((contract) =>
            fetchSingleContractSnapshot({
              symbol,
              contractSymbol: contract.contractSymbol,
              apiKey,
              fallbackUnderlyingPrice: detectedUnderlyingPrice,
            })
          )
        );

        individualReferenceSnapshots =
          snapshots.filter(Boolean);

        snapshotContracts = mergeContracts(
          referenceCandidates,
          individualReferenceSnapshots
        );
      }
    } catch (error) {
      referenceError = error;
    }
  }

  const validQuotesFinal =
    snapshotContracts.filter(hasValidQuote).length;

  // v3.5 DIAGNOSTICO — solo inspección; no cambia filtros ni selección.
  const rawChainSample = rawSnapshotResults.slice(0, 5).map((item) => ({
    ticker: item?.details?.ticker || item?.ticker || null,
    contractType: item?.details?.contract_type || null,
    expiration: item?.details?.expiration_date || null,
    strike: toNumber(item?.details?.strike_price),
    lastQuote: item?.last_quote || null,
    lastTrade: item?.last_trade || null,
    day: item?.day || null,
    session: item?.session || null,
    greeks: item?.greeks || null,
    openInterest: toNumber(item?.open_interest, 0),
    impliedVolatility: toNumber(item?.implied_volatility),
    underlyingAsset: item?.underlying_asset || null,
  }));

  const referenceSample = (referenceResult?.results || []).slice(0, 5).map((item) => ({
    ticker: item?.ticker || null,
    contractType: item?.contract_type || null,
    expiration: item?.expiration_date || null,
    strike: toNumber(item?.strike_price),
    primaryExchange: item?.primary_exchange || null,
    sharesPerContract: item?.shares_per_contract || null,
  }));

  const individualSnapshotSample = individualReferenceSnapshots.slice(0, 5).map((item) => ({
    contractSymbol: item?.contractSymbol || null,
    side: item?.side || null,
    expiration: item?.expiration || null,
    strike: item?.strike ?? null,
    bid: item?.bid ?? null,
    ask: item?.ask ?? null,
    last: item?.last ?? null,
    volume: item?.volume ?? null,
    openInterest: item?.openInterest ?? null,
    impliedVolatility: item?.impliedVolatility ?? null,
    delta: item?.delta ?? null,
    gamma: item?.gamma ?? null,
    theta: item?.theta ?? null,
    vega: item?.vega ?? null,
    underlyingPrice: item?.underlyingPrice ?? null,
  }));

  // Si ambos endpoints fallaron por auth/plan
  if (
    snapshotContracts.length === 0 &&
    chainError &&
    referenceError
  ) {
    const status =
      chainError?.status ||
      referenceError?.status ||
      null;

    return {
      provider: "massive",
      source: "massive",
      symbol,
      side,
      underlyingPrice: detectedUnderlyingPrice,
      targetStrike,
      contracts: [],
      isRealData: false,
      message:
        status === 401 || status === 403
          ? "Massive rechazó la solicitud por autenticación o acceso del plan."
          : "No fue posible consultar Massive.",
      errorCode:
        status === 401 || status === 403
          ? "MASSIVE_AUTH_OR_PLAN"
          : "MASSIVE_HTTP_ERROR",
      providerStatus: status,
      providerDetail:
        chainError?.message ||
        referenceError?.message ||
        null,
    };
  }

  let message = "";

  if (snapshotContracts.length > 0) {
    message =
      validQuotesFinal > 0
        ? "Contratos encontrados y snapshots individuales procesados."
        : "Se encontraron contratos reales, pero ninguno tiene bid/ask utilizable con el acceso actual.";
  } else if (referenceContracts.length > 0) {
    message =
      "Massive Reference encontró contratos, pero no fue posible obtener snapshots utilizables.";
  } else {
    message =
      "Massive respondió, pero no se encontraron contratos activos para los filtros solicitados.";
  }

  return {
    provider: "massive",
    source: "massive",
    symbol,
    side,
    underlyingPrice: detectedUnderlyingPrice,
    targetStrike: toNumber(targetStrike),
    contracts: snapshotContracts,
    isRealData: true,
    message,

    requestId:
      chainResult?.requestId ||
      referenceResult?.requestId ||
      null,

    providerStatus:
      chainResult?.status ||
      referenceResult?.status ||
      "OK",

    hasMore:
      Boolean(chainResult?.hasMore) ||
      Boolean(referenceResult?.hasMore),

    diagnostics: {
      strategy:
        rawSnapshotResults.length > 0
          ? "SNAPSHOT_CHAIN"
          : referenceContracts.length > 0
          ? "REFERENCE_DISCOVERY"
          : "NO_CONTRACTS_FOUND",

      chain: {
        pagesRead: chainResult?.pagesRead || 0,
        rawContracts: rawSnapshotResults.length,
        mappedContracts: snapshotContracts.length,
        validQuotesBeforeRefresh,
        refreshRequested: refreshPool.length,
        refreshReceived: refreshedFromChain.length,
        validQuotesAfterRefresh,
        errorStatus: chainError?.status || null,
        errorMessage: chainError?.message || null,
      },

      reference: {
        pagesRead: referenceResult?.pagesRead || 0,
        rawContracts: referenceResult?.results?.length || 0,
        mappedContracts: referenceContracts.length,
        candidatesRequested: referenceCandidates.length,
        snapshotsReceived: individualReferenceSnapshots.length,
        errorStatus: referenceError?.status || null,
        errorMessage: referenceError?.message || null,
      },

      final: {
        contracts: snapshotContracts.length,
        validQuotes: validQuotesFinal,
        targetStrike: round(targetStrike, 2),
        underlyingPrice: round(detectedUnderlyingPrice, 2),
      },

      quoteDiagnostic: {
        rawChainSample,
        referenceSample,
        individualSnapshotSample,
      },
    },
  };
}

// ============================================================
// RESPONSE HELPERS
// ============================================================

function buildContext({
  symbol,
  requestedUnderlyingPrice,
  providerResult,
}) {
  return {
    symbol,
    underlyingPrice:
      toNumber(providerResult?.underlyingPrice) ??
      toNumber(requestedUnderlyingPrice),
    currency: "USD",
    source: providerResult?.source || "massive",
  };
}

function buildProviderPublicInfo(providerResult) {
  return {
    name: providerResult?.provider || "massive",
    source: providerResult?.source || "massive",
    isRealData: Boolean(providerResult?.isRealData),
    message: providerResult?.message || null,
    errorCode: providerResult?.errorCode || null,
    providerStatus: providerResult?.providerStatus || null,
    providerDetail: providerResult?.providerDetail || null,
    requestId: providerResult?.requestId || null,
    hasMore: Boolean(providerResult?.hasMore),
    diagnostics: providerResult?.diagnostics || null,
  };
}

function buildWarning(providerResult, selection) {
  if (!providerResult?.isRealData) {
    return (
      providerResult?.message ||
      "Option Chain real no disponible."
    );
  }

  if (!selection?.primary) {
    return (
      selection?.warning ||
      "Massive respondió con datos, pero ningún contrato cumplió los filtros mínimos actuales de Nexora."
    );
  }

  if (selection.status === "ESPERAR") {
    return selection.warning;
  }

  return null;
}

async function processOptionRequest({
  symbol,
  side,
  requestedUnderlyingPrice,
  targetStrike,
  rules,
}) {
  const providerResult = await fetchProviderOptionChain({
    symbol,
    side,
    underlyingPrice: requestedUnderlyingPrice,
    targetStrike,
    rules,
  });

  const context = buildContext({
    symbol,
    requestedUnderlyingPrice,
    providerResult,
  });

  const normalizedContracts = normalizeOptionChain(
    providerResult.contracts || [],
    context,
    rules
  );

  const rankedContracts = rankOptionContracts(
    normalizedContracts,
    {
      side,
      ...rules,
    }
  );

  const selection = selectOptionCandidates(
    providerResult.contracts || [],
    context,
    {
      side,
      ...rules,
    }
  );

  return {
    providerResult,
    context,
    normalizedContracts,
    rankedContracts,
    selection,
  };
}

// ============================================================
// GET
// ============================================================

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);

    const symbol = cleanSymbol(
      searchParams.get("symbol") ||
      searchParams.get("ticker")
    );

    if (!symbol) {
      return NextResponse.json(
        {
          ok: false,
          error: "Falta el parámetro symbol o ticker.",
          example: "/api/options?symbol=SPY&side=CALL",
        },
        { status: 400 }
      );
    }

    const side = normalizeSide(
      searchParams.get("side")
    );

    const requestedUnderlyingPrice = toNumber(
      searchParams.get("price") ||
      searchParams.get("underlyingPrice")
    );

    const targetStrike = toNumber(
      searchParams.get("targetStrike") ||
      searchParams.get("strike")
    );

    const rules = getRulesFromParams(searchParams);

    const {
      providerResult,
      context,
      normalizedContracts,
      rankedContracts,
      selection,
    } = await processOptionRequest({
      symbol,
      side,
      requestedUnderlyingPrice,
      targetStrike,
      rules,
    });

    return NextResponse.json(
      {
        ok: providerResult.isRealData !== false,
        module: "NEXORA Option Chain Engine",
        version: "3.5-quote-diagnostic",

        request: {
          symbol,
          side,
          requestedUnderlyingPrice:
            round(requestedUnderlyingPrice, 2),
          detectedUnderlyingPrice:
            round(context.underlyingPrice, 2),
          targetStrike: round(targetStrike, 2),
          rules,
        },

        provider:
          buildProviderPublicInfo(providerResult),

        summary: {
          totalRawContracts:
            providerResult.contracts?.length || 0,
          normalizedContracts:
            normalizedContracts.length,
          eligibleContracts:
            rankedContracts.length,
          primaryContract:
            selection.primary,
          alternativeContract:
            selection.alternative,
          status:
            selection.status,
          validationStatus:
            selection.primary?.validationStatus ||
            selection.status,
        },

        selection,
        contracts: rankedContracts,
        warning:
          buildWarning(providerResult, selection),

        nextStep: selection.primary
          ? "Usar contrato validado en Trade Planner y Decision IA."
          : "Revisar diagnostics: si Reference encontró contratos pero no hay bid/ask, el problema está en acceso a snapshots/quotes; si Reference también devuelve 0, revisar filtros o cobertura.",
      },
      {
        status: 200,
        headers: {
          "Cache-Control":
            "no-store, no-cache, must-revalidate",
        },
      }
    );
  } catch (error) {
    console.error(
      "[NEXORA /api/options GET] Error:",
      error
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          "No fue posible procesar Option Chain.",
        detail:
          error?.message || "Error desconocido",
      },
      { status: 500 }
    );
  }
}

// ============================================================
// POST
// ============================================================

export async function POST(request) {
  try {
    const body = await request.json();

    const symbol = cleanSymbol(
      body?.symbol || body?.ticker
    );

    if (!symbol) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Falta symbol o ticker en el body.",
        },
        { status: 400 }
      );
    }

    const side = normalizeSide(body?.side);

    const requestedUnderlyingPrice =
      toNumber(
        body?.underlyingPrice ??
        body?.price
      );

    const targetStrike = toNumber(
      body?.targetStrike ??
      body?.strike
    );

    const rules = normalizeRules(
      body?.rules || {}
    );

    const {
      providerResult,
      context,
      normalizedContracts,
      rankedContracts,
      selection,
    } = await processOptionRequest({
      symbol,
      side,
      requestedUnderlyingPrice,
      targetStrike,
      rules,
    });

    return NextResponse.json(
      {
        ok: providerResult.isRealData !== false,
        module: "NEXORA Option Chain Engine",
        version: "3.5-quote-diagnostic",

        request: {
          symbol,
          side,
          requestedUnderlyingPrice:
            round(requestedUnderlyingPrice, 2),
          detectedUnderlyingPrice:
            round(context.underlyingPrice, 2),
          targetStrike:
            round(targetStrike, 2),
          rules,
        },

        provider:
          buildProviderPublicInfo(providerResult),

        summary: {
          totalRawContracts:
            providerResult.contracts?.length || 0,
          normalizedContracts:
            normalizedContracts.length,
          eligibleContracts:
            rankedContracts.length,
          primaryContract:
            selection.primary,
          alternativeContract:
            selection.alternative,
          status:
            selection.status,
          validationStatus:
            selection.primary?.validationStatus ||
            selection.status,
        },

        selection,
        contracts: rankedContracts,
        warning:
          buildWarning(providerResult, selection),

        nextStep: selection.primary
          ? "Usar contrato validado en Trade Planner y Decision IA."
          : "Revisar diagnostics: si Reference encontró contratos pero no hay bid/ask, el problema está en acceso a snapshots/quotes; si Reference también devuelve 0, revisar filtros o cobertura.",
      },
      {
        status: 200,
        headers: {
          "Cache-Control":
            "no-store, no-cache, must-revalidate",
        },
      }
    );
  } catch (error) {
    console.error(
      "[NEXORA /api/options POST] Error:",
      error
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          "No fue posible procesar la solicitud de opciones.",
        detail:
          error?.message || "Error desconocido",
      },
      { status: 500 }
    );
  }
}
