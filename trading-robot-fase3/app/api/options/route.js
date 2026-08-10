// app/api/options/route.js
// NEXORA v3.0
// Option Chain API - primera capa funcional
//
// Este endpoint deja preparada la arquitectura para:
// 1) recibir ticker, dirección y reglas,
// 2) consultar un proveedor real de Option Chain,
// 3) normalizar contratos con lib/options.js,
// 4) seleccionar contrato principal y alternativo.
//
// En esta primera versión el proveedor real queda desacoplado.
// La respuesta deja explícito cuando aún no hay datos reales.

import { NextResponse } from "next/server";
import {
  normalizeOptionChain,
  rankOptionContracts,
  selectOptionCandidates,
} from "../../../lib/options";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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

const toNumber = (value, fallback = null) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const clamp = (value, min, max) =>
  Math.min(max, Math.max(min, value));

function getRulesFromParams(searchParams) {
  return {
    minLiquidityScore: clamp(
      toNumber(searchParams.get("minLiquidityScore"), 50),
      0,
      100
    ),

    minDte: Math.max(
      0,
      Math.round(
        toNumber(searchParams.get("minDte"), 0)
      )
    ),

    maxDte: Math.max(
      0,
      Math.round(
        toNumber(searchParams.get("maxDte"), 60)
      )
    ),

    maxDistancePct: Math.max(
      0,
      toNumber(searchParams.get("maxDistancePct"), 15)
    ),
  };
}

async function fetchProviderOptionChain({
  symbol,
  side,
  underlyingPrice,
}) {
  /*
    FASE SIGUIENTE:
    Aquí conectaremos el proveedor profesional de Option Chain.

    El proveedor deberá entregar, como mínimo:

    - expiration
    - strike
    - type / side
    - bid
    - ask
    - last
    - volume
    - openInterest
    - impliedVolatility
    - delta
    - gamma
    - theta
    - vega
    - rho

    Esta función permanece separada para poder cambiar de proveedor
    sin modificar el resto de Nexora.
  */

  return {
    provider: "not-configured",
    source: "none",
    symbol,
    side,
    underlyingPrice,
    contracts: [],
    isRealData: false,
    message:
      "Proveedor de Option Chain todavía no configurado.",
  };
}

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
          example:
            "/api/options?symbol=SPY&side=CALL",
        },
        { status: 400 }
      );
    }

    const side = normalizeSide(searchParams.get("side"));

    const underlyingPrice = toNumber(
      searchParams.get("price") ||
      searchParams.get("underlyingPrice")
    );

    const rules = getRulesFromParams(searchParams);

    const providerResult =
      await fetchProviderOptionChain({
        symbol,
        side,
        underlyingPrice,
      });

    const context = {
      symbol,
      underlyingPrice,
      currency: "USD",
      source: providerResult.source,
    };

    const normalizedContracts =
      normalizeOptionChain(
        providerResult.contracts || [],
        context
      );

    const rankedContracts =
      rankOptionContracts(
        normalizedContracts,
        {
          side,
          ...rules,
        }
      );

    const selection =
      selectOptionCandidates(
        providerResult.contracts || [],
        context,
        {
          side,
          ...rules,
        }
      );

    return NextResponse.json(
      {
        ok: true,

        module: "NEXORA Option Chain Engine",

        version: "1.0",

        request: {
          symbol,
          side,
          underlyingPrice,
          rules,
        },

        provider: {
          name: providerResult.provider,
          source: providerResult.source,
          isRealData: providerResult.isRealData,
          message: providerResult.message,
        },

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
        },

        contracts:
          rankedContracts,

        warning:
          providerResult.isRealData
            ? null
            : "Option Chain real aún no conectada. No usar esta respuesta como selección definitiva de contrato.",

        nextStep:
          "Configurar proveedor real y conectar esta API con Trade Planner.",
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
      "[NEXORA /api/options] Error:",
      error
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          "No fue posible procesar Option Chain.",
        detail:
          error?.message ||
          "Error desconocido",
      },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const body = await request.json();

    const symbol = cleanSymbol(
      body?.symbol ||
      body?.ticker
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

    const underlyingPrice =
      toNumber(
        body?.underlyingPrice ??
        body?.price
      );

    const rules = {
      minLiquidityScore: clamp(
        toNumber(
          body?.rules?.minLiquidityScore,
          50
        ),
        0,
        100
      ),

      minDte: Math.max(
        0,
        Math.round(
          toNumber(
            body?.rules?.minDte,
            0
          )
        )
      ),

      maxDte: Math.max(
        0,
        Math.round(
          toNumber(
            body?.rules?.maxDte,
            60
          )
        )
      ),

      maxDistancePct: Math.max(
        0,
        toNumber(
          body?.rules?.maxDistancePct,
          15
        )
      ),
    };

    const providerResult =
      await fetchProviderOptionChain({
        symbol,
        side,
        underlyingPrice,
      });

    const context = {
      symbol,
      underlyingPrice,
      currency: "USD",
      source: providerResult.source,
    };

    const selection =
      selectOptionCandidates(
        providerResult.contracts || [],
        context,
        {
          side,
          ...rules,
        }
      );

    return NextResponse.json(
      {
        ok: true,

        module:
          "NEXORA Option Chain Engine",

        version: "1.0",

        request: {
          symbol,
          side,
          underlyingPrice,
          rules,
        },

        provider: {
          name:
            providerResult.provider,

          source:
            providerResult.source,

          isRealData:
            providerResult.isRealData,

          message:
            providerResult.message,
        },

        selection,

        warning:
          providerResult.isRealData
            ? null
            : "Option Chain real aún no conectada. La arquitectura está lista, pero falta configurar el proveedor.",

        nextStep:
          "Conectar proveedor real de opciones.",
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
          error?.message ||
          "Error desconocido",
      },
      { status: 500 }
    );
  }
}
