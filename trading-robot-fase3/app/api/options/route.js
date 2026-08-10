// app/api/options/route.js
// NEXORA v3.3
// Option Chain API - Massive Smart Contract Search + Validator v2
//
// Mejora clave:
// - busca primero strikes cercanos al objetivo técnico,
// - recorre varias páginas de Massive,
// - descarta contratos sin bid/ask válido,
// - reconsulta snapshots individuales de candidatos cercanos,
// - selecciona automáticamente el siguiente contrato elegible.

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
      Math.round(toNumber(searchParams.get("refreshCandidates"), 10)),
      0,
      16
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
      Math.round(toNumber(bodyRules?.refreshCandidates, 10)),
      0,
      16
    ),
  };
}

function buildMassiveUrl({
  symbol,
  side,
  minDte = 0,
  maxDte = 60,
  underlyingPrice = null,
  targetStrike = null,
  maxDistancePct = 15,
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

  // Limita la búsqueda a la zona útil del precio. Esto evita gastar
  // el límite de 250 resultados en strikes muy alejados.
  const center =
    toNumber(targetStrike) ??
    toNumber(underlyingPrice);

  if (center !== null && center > 0) {
    const pct = clamp(toNumber(maxDistancePct, 15), 1, 20) / 100;
    const low = Math.max(0.01, center * (1 - pct));
    const high = center * (1 + pct);

    url.searchParams.set("strike_price.gte", String(round(low, 2)));
    url.searchParams.set("strike_price.lte", String(round(high, 2)));
  }

  url.searchParams.set("limit", "250");
  url.searchParams.set("sort", "expiration_date");
  url.searchParams.set("order", "asc");

  return url;
}

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
      // No sobreescribimos un dato útil con cero/null.
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

function sortForRefresh(contracts = [], targetStrike = null, underlyingPrice = null) {
  const center =
    toNumber(targetStrike) ??
    toNumber(underlyingPrice);

  return [...contracts].sort((a, b) => {
    const quoteA = hasValidQuote(a) ? 1 : 0;
    const quoteB = hasValidQuote(b) ? 1 : 0;

    // Los que no tienen cotización se refrescan primero.
    if (quoteA !== quoteB) return quoteA - quoteB;

    if (center !== null) {
      const da = Math.abs(toNumber(a?.strike, center) - center);
      const db = Math.abs(toNumber(b?.strike, center) - center);
      if (da !== db) return da - db;
    }

    const dteA = toNumber(a?.dte, 999);
    const dteB = toNumber(b?.dte, 999);
    if (dteA !== dteB) return dteA - dteB;

    return (
      toNumber(b?.openInterest, 0) -
      toNumber(a?.openInterest, 0)
    );
  });
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

async function readMassiveError(response) {
  try {
    const payload = await response.json();
    return payload?.error || payload?.message || payload?.status || "";
  } catch {
    return "";
  }
}

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

  const url = buildMassiveUrl({
    symbol,
    side,
    minDte: rules?.minDte ?? 0,
    maxDte: rules?.maxDte ?? 60,
    underlyingPrice,
    targetStrike,
    maxDistancePct: rules?.maxDistancePct ?? 15,
  });

  let pageResult;

  try {
    pageResult = await fetchMassivePages(
      url,
      apiKey,
      rules?.maxPages ?? 4
    );
  } catch (error) {
    return {
      provider: "massive",
      source: "massive",
      symbol,
      side,
      underlyingPrice,
      targetStrike,
      contracts: [],
      isRealData: false,
      message:
        error?.status === 401 || error?.status === 403
          ? "Massive rechazó la solicitud por autenticación o acceso del plan."
          : "No fue posible consultar la cadena de opciones en Massive.",
      errorCode:
        error?.status === 401 || error?.status === 403
          ? "MASSIVE_AUTH_OR_PLAN"
          : "MASSIVE_HTTP_ERROR",
      providerStatus: error?.status || null,
      providerDetail: error?.message || null,
    };
  }

  const rawResults = pageResult.results || [];

  let detectedUnderlyingPrice = toNumber(underlyingPrice);

  if (detectedUnderlyingPrice === null && rawResults.length > 0) {
    detectedUnderlyingPrice = toNumber(
      rawResults[0]?.underlying_asset?.price
    );
  }

  let contracts = rawResults
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

  const validQuotesBeforeRefresh =
    contracts.filter(hasValidQuote).length;

  // Segunda capa: si los contratos cercanos no traen una cotización usable,
  // Nexora reconsulta snapshots individuales empezando por los strikes
  // más cercanos al objetivo técnico.
  const refreshPool = sortForRefresh(
    contracts,
    targetStrike,
    detectedUnderlyingPrice
  )
    .filter((contract) => !hasValidQuote(contract))
    .slice(0, rules?.refreshCandidates ?? 10);

  let refreshedContracts = [];

  if (refreshPool.length > 0) {
    const refreshed = await Promise.all(
      refreshPool.map((contract) =>
        fetchSingleContractSnapshot({
          symbol,
          contractSymbol:
            contract.contractSymbol || contract.symbol,
          apiKey,
          fallbackUnderlyingPrice: detectedUnderlyingPrice,
        })
      )
    );

    refreshedContracts = refreshed.filter(Boolean);
    contracts = mergeContracts(contracts, refreshedContracts);
  }

  const validQuotesAfterRefresh =
    contracts.filter(hasValidQuote).length;

  return {
    provider: "massive",
    source: "massive",
    symbol,
    side,
    underlyingPrice: detectedUnderlyingPrice,
    targetStrike: toNumber(targetStrike),
    contracts,
    isRealData: true,
    message:
      contracts.length > 0
        ? validQuotesAfterRefresh > 0
          ? "Option Chain recibida y búsqueda automática de contratos completada."
          : "Massive devolvió contratos, pero ninguno tiene bid/ask utilizable con el acceso actual."
        : "Massive respondió correctamente, pero no devolvió contratos para los filtros solicitados.",
    requestId: pageResult.requestId || null,
    providerStatus: pageResult.status || "OK",
    hasMore: Boolean(pageResult.hasMore),
    diagnostics: {
      pagesRead: pageResult.pagesRead || 0,
      rawContracts: rawResults.length,
      mappedContracts: contracts.length,
      targetStrike: round(targetStrike, 2),
      validQuotesBeforeRefresh,
      individualSnapshotsRequested: refreshPool.length,
      individualSnapshotsReceived: refreshedContracts.length,
      validQuotesAfterRefresh,
    },
  };
}

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
    return providerResult?.message || "Option Chain real no disponible.";
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

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);

    const symbol = cleanSymbol(
      searchParams.get("symbol") || searchParams.get("ticker")
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

    const side = normalizeSide(searchParams.get("side"));

    const requestedUnderlyingPrice = toNumber(
      searchParams.get("price") ||
        searchParams.get("underlyingPrice")
    );

    const targetStrike = toNumber(
      searchParams.get("targetStrike") ||
        searchParams.get("strike")
    );

    const rules = getRulesFromParams(searchParams);

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

    const rankedContracts = rankOptionContracts(normalizedContracts, {
      side,
      ...rules,
    });

    const selection = selectOptionCandidates(
      providerResult.contracts || [],
      context,
      {
        side,
        ...rules,
      }
    );

    return NextResponse.json(
      {
        ok: providerResult.isRealData !== false,
        module: "NEXORA Option Chain Engine",
        version: "3.0-smart-contract-search",

        request: {
          symbol,
          side,
          requestedUnderlyingPrice: round(
            requestedUnderlyingPrice,
            2
          ),
          detectedUnderlyingPrice: round(
            context.underlyingPrice,
            2
          ),
          targetStrike: round(targetStrike, 2),
          rules,
        },

        provider: buildProviderPublicInfo(providerResult),

        summary: {
          totalRawContracts: providerResult.contracts?.length || 0,
          normalizedContracts: normalizedContracts.length,
          eligibleContracts: rankedContracts.length,
          primaryContract: selection.primary,
          alternativeContract: selection.alternative,
          status: selection.status,
          validationStatus:
            selection.primary?.validationStatus || selection.status,
        },

        contracts: rankedContracts,
        warning: buildWarning(providerResult, selection),

        nextStep: selection.primary
          ? "Usar contrato validado en Trade Planner y Decision IA."
          : "Esperar una cadena con mejor cotización, liquidez o griegas.",
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      }
    );
  } catch (error) {
    console.error("[NEXORA /api/options GET] Error:", error);

    return NextResponse.json(
      {
        ok: false,
        error: "No fue posible procesar Option Chain.",
        detail: error?.message || "Error desconocido",
      },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const body = await request.json();

    const symbol = cleanSymbol(body?.symbol || body?.ticker);

    if (!symbol) {
      return NextResponse.json(
        {
          ok: false,
          error: "Falta symbol o ticker en el body.",
        },
        { status: 400 }
      );
    }

    const side = normalizeSide(body?.side);

    const requestedUnderlyingPrice = toNumber(
      body?.underlyingPrice ?? body?.price
    );

    const targetStrike = toNumber(
      body?.targetStrike ?? body?.strike
    );

    const rules = normalizeRules(body?.rules || {});

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

    const rankedContracts = rankOptionContracts(normalizedContracts, {
      side,
      ...rules,
    });

    const selection = selectOptionCandidates(
      providerResult.contracts || [],
      context,
      {
        side,
        ...rules,
      }
    );

    return NextResponse.json(
      {
        ok: providerResult.isRealData !== false,
        module: "NEXORA Option Chain Engine",
        version: "3.0-smart-contract-search",

        request: {
          symbol,
          side,
          requestedUnderlyingPrice: round(
            requestedUnderlyingPrice,
            2
          ),
          detectedUnderlyingPrice: round(
            context.underlyingPrice,
            2
          ),
          targetStrike: round(targetStrike, 2),
          rules,
        },

        provider: buildProviderPublicInfo(providerResult),

        summary: {
          totalRawContracts: providerResult.contracts?.length || 0,
          normalizedContracts: normalizedContracts.length,
          eligibleContracts: rankedContracts.length,
          primaryContract: selection.primary,
          alternativeContract: selection.alternative,
          status: selection.status,
          validationStatus:
            selection.primary?.validationStatus || selection.status,
        },

        selection,
        contracts: rankedContracts,
        warning: buildWarning(providerResult, selection),

        nextStep: selection.primary
          ? "Usar contrato validado en Trade Planner y Decision IA."
          : "Esperar una cadena con mejor cotización, liquidez o griegas.",
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      }
    );
  } catch (error) {
    console.error("[NEXORA /api/options POST] Error:", error);

    return NextResponse.json(
      {
        ok: false,
        error: "No fue posible procesar la solicitud de opciones.",
        detail: error?.message || "Error desconocido",
      },
      { status: 500 }
    );
  }
}
