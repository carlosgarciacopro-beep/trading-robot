// app/api/options/route.js
// NEXORA v3.2
// Option Chain API - Massive real data integration + Validator v2

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
  };
}

function buildMassiveUrl({ symbol, side, minDte = 0, maxDte = 60 }) {
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
  });

  url.searchParams.set("apiKey", apiKey);

  let response;

  try {
    response = await fetch(url.toString(), {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
  } catch (error) {
    return {
      provider: "massive",
      source: "massive",
      symbol,
      side,
      underlyingPrice,
      contracts: [],
      isRealData: false,
      message: "No fue posible conectar con Massive.",
      errorCode: "PROVIDER_CONNECTION_ERROR",
      providerDetail: error?.message || "Error de conexión",
    };
  }

  if (!response.ok) {
    const detail = await readMassiveError(response);

    return {
      provider: "massive",
      source: "massive",
      symbol,
      side,
      underlyingPrice,
      contracts: [],
      isRealData: false,
      message: `Massive respondió HTTP ${response.status}.`,
      errorCode:
        response.status === 401 || response.status === 403
          ? "MASSIVE_AUTH_OR_PLAN"
          : "MASSIVE_HTTP_ERROR",
      providerStatus: response.status,
      providerDetail: detail || null,
    };
  }

  const payload = await response.json();
  const rawResults = Array.isArray(payload?.results) ? payload.results : [];

  let detectedUnderlyingPrice = toNumber(underlyingPrice);

  if (detectedUnderlyingPrice === null && rawResults.length > 0) {
    detectedUnderlyingPrice = toNumber(
      rawResults[0]?.underlying_asset?.price
    );
  }

  const contracts = rawResults
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

  return {
    provider: "massive",
    source: "massive",
    symbol,
    side,
    underlyingPrice: detectedUnderlyingPrice,
    contracts,
    isRealData: true,
    message:
      contracts.length > 0
        ? "Option Chain recibida desde Massive."
        : "Massive respondió correctamente, pero no devolvió contratos para los filtros solicitados.",
    requestId: payload?.request_id || null,
    providerStatus: payload?.status || "OK",
    hasMore: Boolean(payload?.next_url),
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

    const rules = getRulesFromParams(searchParams);

    const providerResult = await fetchProviderOptionChain({
      symbol,
      side,
      underlyingPrice: requestedUnderlyingPrice,
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
        version: "2.1-massive-validator-v2",

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

    const rules = normalizeRules(body?.rules || {});

    const providerResult = await fetchProviderOptionChain({
      symbol,
      side,
      underlyingPrice: requestedUnderlyingPrice,
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
        version: "2.1-massive-validator-v2",

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
