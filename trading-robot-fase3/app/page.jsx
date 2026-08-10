'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

const DEFAULT = 'SPY,QQQ,NVDA,TSLA,AAPL,META,BAC,PLTR,AMZN';

const ASSET_DOMAINS = {
  QQQ: 'invesco.com',
  SPY: 'ssga.com',
  NVDA: 'nvidia.com',
  TSLA: 'tesla.com',
  AAPL: 'apple.com',
  META: 'meta.com',
  AMZN: 'amazon.com',
  MSFT: 'microsoft.com',
  GOOG: 'google.com',
  GOOGL: 'google.com',
  NFLX: 'netflix.com',
  AMD: 'amd.com',
  BAC: 'bankofamerica.com',
  PLTR: 'palantir.com'
};

const STRATEGY_INFO = {
  NCS: {
    fullName: 'Nexora Confluence Strategy',
    friendlyName: 'Tendencia y Confluencia',
    shortDescription:
      'Busca operaciones cuando tendencia, impulso, volumen y niveles técnicos apuntan en la misma dirección.',
    details: [
      'Tendencia principal con EMA 20, 50 y 200',
      'Momentum con MACD',
      'Fuerza del mercado con RSI',
      'Volumen relativo',
      'Soportes y resistencias',
      'Confirmación multi-timeframe'
    ]
  },
  MRBB: {
    fullName: 'Mean Reversion Bollinger Bands',
    friendlyName: 'Reversión a la Media',
    shortDescription:
      'Busca activos que se alejaron demasiado de su rango normal y podrían regresar hacia su promedio.',
    details: [
      'Bandas de Bollinger 20,2',
      'RSI para sobreventa o sobrecompra',
      'Distancia fuera de la banda',
      'Volumen relativo',
      'Señal inicial de reversión',
      'Objetivo hacia la media'
    ]
  },
  BREAKOUT: {
    fullName: 'Breakout Precision Strategy',
    friendlyName: 'Rompimiento con Confirmación',
    shortDescription:
      'Busca rupturas de soportes o resistencias con fuerza suficiente para reducir falsos rompimientos.',
    details: ['Soporte/resistencia', 'Volumen', 'Momentum', 'Confirmación']
  },
  GAP: {
    fullName: 'Gap Hunter Strategy',
    friendlyName: 'Gaps y Continuación',
    shortDescription:
      'Analiza gaps de apertura para estimar si tienen mayor probabilidad de continuar o cerrarse.',
    details: ['Tamaño del gap', 'Volumen', 'Tendencia previa', 'Reacción de apertura']
  }
};

const PANEL = 'rgba(15,23,42,.88)';

function Card({ children, style = {} }) {
  return (
    <div
      style={{
        background: PANEL,
        border: '1px solid rgba(148,163,184,.22)',
        borderRadius: 22,
        padding: 20,
        boxShadow: '0 20px 50px rgba(0,0,0,.35)',
        minWidth: 0,
        overflow: 'hidden',
        boxSizing: 'border-box',
        ...style
      }}
    >
      {children}
    </div>
  );
}

function AssetLogo({ symbol, size = 42 }) {
  const domain = ASSET_DOMAINS[String(symbol || '').toUpperCase()];
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [symbol, domain]);

  if (!domain || failed) {
    return (
      <div
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          display: 'grid',
          placeItems: 'center',
          background: '#111827',
          border: '1px solid #334155',
          fontWeight: 900,
          fontSize: Math.max(10, size * 0.28),
          flex: '0 0 auto'
        }}
      >
        {String(symbol || '?').slice(0, 4)}
      </div>
    );
  }

  return (
    <img
      src={`https://logo.clearbit.com/${domain}`}
      alt={symbol}
      width={size}
      height={size}
      loading="eager"
      decoding="async"
      onError={() => setFailed(true)}
      style={{
        borderRadius: '50%',
        objectFit: 'contain',
        background: '#fff',
        padding: 3,
        boxSizing: 'border-box',
        flex: '0 0 auto'
      }}
    />
  );
}

function AnimatedStrategyChart({ strategy }) {
  const [step, setStep] = useState(0);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setStep((s) => (s + 1) % 12);
    }, 850);

    return () => clearInterval(timer);
  }, []);

  const datasets = {
    NCS: [
      [92, 96, 90, 95], [95, 99, 93, 98], [98, 101, 96, 99],
      [99, 104, 98, 103], [103, 108, 102, 107], [107, 111, 105, 110],
      [110, 114, 108, 113], [113, 118, 111, 117], [117, 121, 115, 119],
      [119, 124, 118, 123], [123, 128, 121, 127], [127, 132, 125, 131]
    ],
    MRBB: [
      [116, 119, 113, 118], [118, 120, 114, 115], [115, 117, 109, 111],
      [111, 113, 104, 106], [106, 108, 99, 101], [101, 104, 94, 96],
      [96, 100, 91, 93], [93, 99, 92, 98], [98, 104, 96, 103],
      [103, 109, 101, 108], [108, 114, 106, 112], [112, 118, 110, 116]
    ],
    BREAKOUT: [
      [100, 104, 98, 102], [102, 106, 100, 104], [104, 107, 101, 103],
      [103, 107, 101, 106], [106, 108, 103, 105], [105, 108, 102, 107],
      [107, 109, 104, 106], [106, 110, 105, 109], [109, 116, 108, 115],
      [115, 122, 113, 120], [120, 126, 118, 124], [124, 130, 122, 128]
    ],
    GAP: [
      [102, 105, 99, 103], [103, 107, 101, 106], [106, 109, 104, 108],
      [108, 111, 105, 107], [107, 110, 104, 109], [109, 112, 107, 111],
      [111, 114, 109, 113], [124, 128, 122, 127], [127, 132, 125, 130],
      [130, 134, 128, 132], [132, 137, 130, 135], [135, 139, 133, 138]
    ]
  };

  const key = strategy === 'BPS' ? 'BREAKOUT' : strategy === 'GHS' ? 'GAP' : strategy;
  const candles = datasets[key] || datasets.NCS;
  const visible = candles.slice(0, Math.max(2, step + 1));
  const allValues = candles.flat();
  const min = Math.min(...allValues) - 4;
  const max = Math.max(...allValues) + 4;
  const W = 520;
  const H = 220;
  const pad = 24;
  const chartH = H - pad * 2;
  const scaleY = (v) => pad + ((max - v) / (max - min)) * chartH;
  const candleW = 17;
  const gap = 19;

  const emaFast = candles.map((c, i) => {
    const start = Math.max(0, i - 2);
    const arr = candles.slice(start, i + 1).map((x) => x[3]);
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  });

  const emaSlow = candles.map((c, i) => {
    const start = Math.max(0, i - 4);
    const arr = candles.slice(start, i + 1).map((x) => x[3]);
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  });

  const mid = candles.map((c, i) => {
    const start = Math.max(0, i - 4);
    const arr = candles.slice(start, i + 1).map((x) => x[3]);
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  });

  const upper = mid.map((m) => m + 10);
  const lower = mid.map((m) => m - 10);

  function pathFrom(values, count = visible.length) {
    return values
      .slice(0, count)
      .map((v, i) => `${i === 0 ? 'M' : 'L'} ${pad + i * (candleW + gap) + candleW / 2} ${scaleY(v)}`)
      .join(' ');
  }

  const selectedIndex =
    key === 'MRBB' ? 7 :
    key === 'BREAKOUT' ? 8 :
    key === 'GAP' ? 7 :
    8;

  const selectedVisible = visible.length > selectedIndex;

  const entryLevel =
    key === 'MRBB' ? 100 :
    key === 'BREAKOUT' ? 112 :
    key === 'GAP' ? 124 :
    116;

  const stopLevel =
    key === 'MRBB' ? 92 :
    key === 'BREAKOUT' ? 106 :
    key === 'GAP' ? 119 :
    109;

  const targetLevel =
    key === 'MRBB' ? 114 :
    key === 'BREAKOUT' ? 126 :
    key === 'GAP' ? 136 :
    129;

  const volumes = candles.map((_, i) =>
    key === 'BREAKOUT' && i >= 8 ? 28 + i * 2 :
    key === 'GAP' && i >= 7 ? 26 + i * 2 :
    key === 'MRBB' && i >= 6 ? 22 + i :
    12 + (i % 4) * 3
  );

  return (
    <div
      style={{
        marginTop: 12,
        background: '#020617',
        border: '1px solid #334155',
        borderRadius: 16,
        padding: 10,
        overflow: 'hidden'
      }}
    >
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Ejemplo animado de la estrategia ${strategy}`}
        style={{ width: '100%', height: 'auto', display: 'block' }}
      >
        {[0, 1, 2, 3, 4].map((i) => (
          <line
            key={`grid-${i}`}
            x1={pad}
            x2={W - pad}
            y1={pad + i * (chartH / 4)}
            y2={pad + i * (chartH / 4)}
            stroke="rgba(148,163,184,.14)"
            strokeWidth="1"
          />
        ))}

        {key === 'NCS' && (
          <>
            <path
              d={pathFrom(emaFast)}
              fill="none"
              stroke="#22c55e"
              strokeWidth="2.5"
              opacity=".95"
            />
            <path
              d={pathFrom(emaSlow)}
              fill="none"
              stroke="#38bdf8"
              strokeWidth="2.2"
              opacity=".9"
            />
          </>
        )}

        {key === 'MRBB' && (
          <>
            <path
              d={pathFrom(upper)}
              fill="none"
              stroke="#22d3ee"
              strokeWidth="1.8"
              opacity=".9"
            />
            <path
              d={pathFrom(mid)}
              fill="none"
              stroke="#94a3b8"
              strokeWidth="1.5"
              opacity=".8"
            />
            <path
              d={pathFrom(lower)}
              fill="none"
              stroke="#22d3ee"
              strokeWidth="1.8"
              opacity=".9"
            />
          </>
        )}

        {key === 'BREAKOUT' && (
          <line
            x1={pad}
            x2={W - pad}
            y1={scaleY(111)}
            y2={scaleY(111)}
            stroke="#facc15"
            strokeWidth="2"
            strokeDasharray="8 6"
          />
        )}

        {key === 'GAP' && (
          <>
            <line
              x1={pad + 6 * (candleW + gap)}
              x2={pad + 7 * (candleW + gap)}
              y1={scaleY(116)}
              y2={scaleY(116)}
              stroke="#facc15"
              strokeWidth="2"
              strokeDasharray="6 5"
            />
            {selectedVisible && (
              <text
                x={pad + 6.4 * (candleW + gap)}
                y={scaleY(118)}
                fill="#facc15"
                fontSize="11"
                textAnchor="middle"
              >
                GAP
              </text>
            )}
          </>
        )}

        {selectedVisible && (
          <>
            <line
              x1={pad}
              x2={W - 54}
              y1={scaleY(entryLevel)}
              y2={scaleY(entryLevel)}
              stroke="#22c55e"
              strokeWidth="1.4"
              strokeDasharray="5 5"
              opacity=".9"
            />
            <line
              x1={pad}
              x2={W - 54}
              y1={scaleY(stopLevel)}
              y2={scaleY(stopLevel)}
              stroke="#ef4444"
              strokeWidth="1.2"
              strokeDasharray="4 5"
              opacity=".75"
            />
            <line
              x1={pad}
              x2={W - 54}
              y1={scaleY(targetLevel)}
              y2={scaleY(targetLevel)}
              stroke="#38bdf8"
              strokeWidth="1.2"
              strokeDasharray="4 5"
              opacity=".75"
            />

            <text x={W - 49} y={scaleY(entryLevel) + 4} fill="#22c55e" fontSize="10">
              Entrada
            </text>
            <text x={W - 49} y={scaleY(stopLevel) + 4} fill="#ef4444" fontSize="10">
              Stop
            </text>
            <text x={W - 49} y={scaleY(targetLevel) + 4} fill="#38bdf8" fontSize="10">
              Target
            </text>
          </>
        )}

        {[max - 5, (max + min) / 2, min + 5].map((price, i) => (
          <text
            key={`price-${i}`}
            x={W - 42}
            y={scaleY(price) + 4}
            fill="rgba(148,163,184,.75)"
            fontSize="9"
          >
            {price.toFixed(0)}
          </text>
        ))}

        {visible.map((c, i) => {
          const [open, high, low, close] = c;
          const x = pad + i * (candleW + gap);
          const up = close >= open;
          const top = scaleY(Math.max(open, close));
          const bottom = scaleY(Math.min(open, close));
          const bodyH = Math.max(3, bottom - top);

          return (
            <g key={`candle-${i}`}>
              <line
                x1={x + candleW / 2}
                x2={x + candleW / 2}
                y1={scaleY(high)}
                y2={scaleY(low)}
                stroke={up ? '#22c55e' : '#ef4444'}
                strokeWidth="2"
              />
              <rect
                x={x}
                y={top}
                width={candleW}
                height={bodyH}
                rx="2"
                fill={up ? '#22c55e' : '#ef4444'}
                opacity=".95"
              />
            </g>
          );
        })}

        {visible.map((_, i) => {
          const x = pad + i * (candleW + gap);
          const v = volumes[i];
          const maxV = Math.max(...volumes);
          const h = 22 * (v / maxV);

          return (
            <rect
              key={`vol-${i}`}
              x={x + 3}
              y={H - 8 - h}
              width={candleW - 6}
              height={h}
              rx="1"
              fill="rgba(148,163,184,.28)"
            />
          );
        })}

        {selectedVisible && (
          <>
            <circle
              cx={pad + selectedIndex * (candleW + gap) + candleW / 2}
              cy={scaleY(candles[selectedIndex][3])}
              r="6"
              fill="#facc15"
            />
            <text
              x={pad + selectedIndex * (candleW + gap) + candleW / 2}
              y={scaleY(candles[selectedIndex][3]) - 14}
              fill="#facc15"
              fontSize="12"
              textAnchor="middle"
              fontWeight="700"
            >
              {key === 'MRBB'
                ? 'REBOUNCE'
                : key === 'BREAKOUT'
                ? 'BREAKOUT'
                : key === 'GAP'
                ? 'GAP'
                : 'CONFIRMACIÓN'}
            </text>
          </>
        )}
      </svg>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 8,
          flexWrap: 'wrap',
          color: '#94a3b8',
          fontSize: 12,
          marginTop: 6
        }}
      >
        <span>Velas educativas animadas</span>
        <span>
          {key === 'NCS'
            ? 'EMA + momentum'
            : key === 'MRBB'
            ? 'Bollinger + reversión'
            : key === 'BREAKOUT'
            ? 'Resistencia + ruptura'
            : 'Gap + continuación'}
        </span>
      </div>

      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        style={{
          width: '100%',
          marginTop: 10,
          background: '#0f172a',
          color: '#cbd5e1',
          border: '1px solid #334155',
          borderRadius: 10,
          padding: '9px 10px',
          cursor: 'pointer',
          fontWeight: 800
        }}
      >
        {expanded ? 'Ocultar ejemplo completo' : 'Ver ejemplo completo'}
      </button>

      {expanded && (
        <div
          style={{
            marginTop: 10,
            padding: 12,
            borderRadius: 12,
            background: '#0f172a',
            color: '#cbd5e1',
            lineHeight: 1.6,
            fontSize: 13
          }}
        >
          <div><b>Entrada:</b> línea verde.</div>
          <div><b>Stop:</b> línea roja.</div>
          <div><b>Target:</b> línea azul.</div>
          <div style={{ marginTop: 6, color: '#94a3b8' }}>
            El ejemplo es educativo y simulado. Sirve para visualizar cómo Nexora
            reconoce el patrón antes de aplicar la estrategia a datos reales.
          </div>
        </div>
      )}
    </div>
  );
}

export default function Page() {
  const [ticker, setTicker] = useState('');
  const [watch, setWatch] = useState(DEFAULT);
  const [mode, setMode] = useState('swing');

  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState('');
  const [progress, setProgress] = useState(0);

  const [analysis, setAnalysis] = useState(null);
  const [scan, setScan] = useState(null);
  const [history, setHistory] = useState([]);

  const [isMobile, setIsMobile] = useState(false);
  const [isNarrowDesktop, setIsNarrowDesktop] = useState(false);
  const [currentTime, setCurrentTime] = useState('');
  const [mobileTab, setMobileTab] = useState('inicio');
  const [showTechnical, setShowTechnical] = useState(false);
  const [showStrategyHelp, setShowStrategyHelp] = useState(false);

  const [quantSymbol, setQuantSymbol] = useState('QQQ');
  const [backtest, setBacktest] = useState(null);
  const [backtestLoading, setBacktestLoading] = useState(false);

  const bottom = useRef(null);

  const green = '#22c55e';
  const red = '#ef4444';
  const yellow = '#facc15';
  const cyan = '#19e6c2';

  const btn = {
    background: green,
    color: '#03150a',
    border: 0,
    borderRadius: 12,
    padding: '11px 16px',
    fontWeight: 900,
    cursor: 'pointer'
  };

  const secondaryBtn = {
    background: '#0f172a',
    color: '#cbd5e1',
    border: '1px solid #334155',
    borderRadius: 12,
    padding: '11px 16px',
    fontWeight: 800,
    cursor: 'pointer'
  };

  const inp = {
    width: '100%',
    background: '#020617',
    border: '1px solid #334155',
    borderRadius: 14,
    color: '#e2e8f0',
    padding: 14,
    fontSize: 16,
    outline: 'none',
    boxSizing: 'border-box',
    minWidth: 0,
    maxWidth: '100%'
  };

  useEffect(() => {
    const updateTime = () => {
      try {
        setCurrentTime(
          new Date().toLocaleTimeString('en-US', {
            timeZone: 'America/New_York',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
          })
        );
      } catch {
        setCurrentTime('');
      }
    };

    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const check = () => {
      setIsMobile(window.innerWidth <= 768);
      setIsNarrowDesktop(window.innerWidth > 768 && window.innerWidth <= 1180);
    };

    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('nexoraHistory');
      if (!saved) return setHistory([]);
      const parsed = JSON.parse(saved);
      setHistory(Array.isArray(parsed) ? parsed : []);
    } catch {
      setHistory([]);
    }
  }, []);

  useEffect(() => {
    if (bottom.current && (analysis || scan)) {
      bottom.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [analysis, scan]);

  function safeNumber(value, fallback = 0) {
    const num = Number(value);
    return Number.isFinite(num) ? num : fallback;
  }

  function saveHistory(items) {
    const safe = Array.isArray(items) ? items : [];
    setHistory(safe);

    try {
      localStorage.setItem('nexoraHistory', JSON.stringify(safe));
    } catch (error) {
      console.log('No se pudo guardar historial:', error);
    }
  }

  function getColorFromSide(side) {
    if (side === 'CALL') return green;
    if (side === 'PUT') return red;
    return yellow;
  }

  function getQualityColor(q) {
    const n = safeNumber(q, 50);
    if (n >= 80) return green;
    if (n >= 65) return yellow;
    return '#94a3b8';
  }

  function humanSignal(a) {
    if (!a) return 'Sin análisis';

    if (a.strategy === 'MRBB') {
      if (a.side === 'CALL') return '🟢 POSIBLE REBOTE ALCISTA';
      if (a.side === 'PUT') return '🔴 POSIBLE CORRECCIÓN BAJISTA';
    }

    if (a.strategy === 'NCS') {
      if (a.side === 'CALL') return '🟢 TENDENCIA ALCISTA';
      if (a.side === 'PUT') return '🔴 TENDENCIA BAJISTA';
    }

    return '⚪ NO OPERAR';
  }

  function strategyName(a) {
    if (!a) return 'Sin estrategia';
    const info = STRATEGY_INFO[a.strategy];
    if (!info) return 'Sin estrategia válida';
    return `${a.strategy} · ${info.friendlyName}`;
  }

  function strategyFullName(a) {
    if (!a) return 'Sin estrategia';
    const info = STRATEGY_INFO[a.strategy];
    return info ? `${a.strategy} – ${info.fullName}` : 'Sin estrategia válida';
  }

  function getStrategyInfo(strategy) {
    return STRATEGY_INFO[strategy] || null;
  }

  function riskLabel(a) {
    const q = safeNumber(a?.qualityScore, 50);
    if (q >= 85) return 'Bajo a moderado';
    if (q >= 70) return 'Moderado';
    return 'Alto / esperar';
  }

  function qualityGrade(value) {
    const q = safeNumber(value, 0);
    if (q >= 92) return 'A+';
    if (q >= 86) return 'A';
    if (q >= 80) return 'B+';
    if (q >= 72) return 'B';
    if (q >= 65) return 'C';
    return 'D';
  }

  function riskScoreLabel(a) {
    const q = safeNumber(a?.qualityScore, 50);
    const rr = safeNumber(a?.levels?.riskReward, 0);

    if (q >= 88 && rr >= 1.8) return 'BAJO';
    if (q >= 76 && rr >= 1.2) return 'MODERADO';
    return 'ALTO';
  }

  function finalActionLabel(a) {
    if (!a) return 'ESPERAR';

    if (!a.isActionable) return 'ESPERAR CONFIRMACIÓN';
    if (a.side === 'CALL') return 'CONSIDERAR CALL';
    if (a.side === 'PUT') return 'CONSIDERAR PUT';

    return 'ESPERAR';
  }

  function strategyVerdict(s, selectedId) {
    if (!s) return 'Sin datos';
    if (s.id === selectedId) return '🏆 Seleccionada';
    if (s.side === 'NEUTRAL') return 'No aplica';
    if (s.isActionable) return 'Alternativa válida';
    return 'Sin confirmación';
  }

  function contractLabel(contract) {
    if (contract == null) return null;

    if (typeof contract === 'string' || typeof contract === 'number') {
      return String(contract);
    }

    if (typeof contract !== 'object') return null;

    const symbol = contract.symbol || contract.contractSymbol || '';
    const expiration = contract.expiration || '';
    const strike = contract.strike != null ? String(contract.strike) : '';
    const side = contract.side || contract.type || '';

    const strikeSide = [strike, side].filter(Boolean).join(' ');
    const parts = [symbol, expiration, strikeSide].filter(Boolean);

    return parts.length ? parts.join(' · ') : 'Contrato seleccionado';
  }

  function formatContractNumber(value, decimals = 2) {
    const n = Number(value);
    if (!Number.isFinite(n)) return '-';
    return n.toFixed(decimals);
  }

  function formatContractIv(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return '-';
    const pct = Math.abs(n) <= 3 ? n * 100 : n;
    return `${pct.toFixed(1)}%`;
  }

  function operationPlan(best) {
    if (!best) return null;

    if (best.tradePlan && typeof best.tradePlan === 'object') {
      const tp = best.tradePlan;
      const primaryContract = tp.contracts?.primary || null;
      const alternativeContract = tp.contracts?.alternative || null;

      return {
        ...tp,
        rr: tp.riskReward1 ?? tp.riskReward ?? null,

        // IMPORTANTE: React no puede renderizar directamente el objeto
        // completo del contrato. Guardamos una etiqueta segura para UI y
        // conservamos el objeto real por separado para mostrar sus campos.
        contract: contractLabel(primaryContract),
        alternativeContract: contractLabel(alternativeContract),
        contractData:
          primaryContract && typeof primaryContract === 'object'
            ? primaryContract
            : null,
        alternativeContractData:
          alternativeContract && typeof alternativeContract === 'object'
            ? alternativeContract
            : null,

        expiration:
          tp.contracts?.expiration ||
          primaryContract?.expiration ||
          null,

        premiumTarget:
          tp.contracts?.premiumTarget ??
          primaryContract?.mid ??
          primaryContract?.ask ??
          primaryContract?.last ??
          null,

        maxPremiumRisk: tp.premiumRisk?.stop || null,
        profitTarget: tp.premiumRisk?.profitTarget || null,
        avoid: tp.note || null
      };
    }

    const side = best.side;
    const levels = best.levels || {};
    const optionIdea = best.optionIdea || {};

    const entry =
      side === 'CALL'
        ? levels.entryCall
        : side === 'PUT'
        ? levels.entryPut
        : null;

    const stop =
      side === 'CALL'
        ? levels.stopCall
        : side === 'PUT'
        ? levels.stopPut
        : null;

    const target1 = levels.target1 ?? null;
    const target2 = levels.target2 ?? null;

    const risk =
      entry != null && stop != null
        ? Math.abs(Number(entry) - Number(stop))
        : null;

    const reward1 =
      entry != null && target1 != null
        ? Math.abs(Number(target1) - Number(entry))
        : null;

    const rr =
      risk && reward1
        ? Number((reward1 / Math.max(0.01, risk)).toFixed(2))
        : levels.riskReward ?? null;

    return {
      side,
      entry,
      stop,
      target1,
      target2,
      risk,
      reward1,
      rr,
      contract: optionIdea.contract || null,
      alternativeContract: optionIdea.alternativeContract || null,
      expiration: optionIdea.expiration || null,
      premiumTarget: optionIdea.premiumTarget || null,
      maxPremiumRisk: optionIdea.maxPremiumRisk || null,
      profitTarget: optionIdea.profitTarget || null,
      avoid: optionIdea.avoid || null,
      checklist: [],
      invalidationRules: [],
      statusLabel: null,
      difficulty: null,
      entryZone: null
    };
  }

  function planRating(plan, best) {
    if (!plan || !best) return 'NO DISPONIBLE';

    if (plan.status === 'LISTO_PARA_ENTRAR') return 'EXCELENTE';
    if (plan.status === 'ESPERAR_CONFIRMACION') return 'VIGILAR';
    if (plan.status === 'NO_OPERAR') return 'NO RECOMENDABLE';

    const q = safeNumber(best.qualityScore, 0);
    const rr = safeNumber(plan.rr, 0);

    if (best.isActionable && q >= 88 && rr >= 1.8) return 'EXCELENTE';
    if (q >= 80 && rr >= 1.3) return 'BUENA';
    if (q >= 70) return 'VIGILAR';
    return 'NO RECOMENDABLE';
  }

  function timeEstimate(best) {
    if (!best) return '-';
    return best.mode === 'intraday'
      ? 'Misma sesión / 1 día'
      : '2 a 5 días como referencia';
  }

  function historyLesson(h) {
    if (!h) return 'Sin explicación disponible.';
    const result = h.validationStatus || h.status;

    if (result === 'GANADA') {
      return `La señal ${h.strategy || ''} alcanzó el objetivo definido. Conviene revisar qué condiciones coincidieron para repetir configuraciones de calidad similar.`;
    }

    if (result === 'PERDIDA') {
      return `La señal no alcanzó el objetivo y activó el criterio de pérdida. Conviene revisar si faltó confirmación, volumen o si el mercado cambió de contexto.`;
    }

    if (result === 'ACERTO_DIRECCION') {
      return 'La dirección fue correcta, pero la operación no cumplió completamente el objetivo. Es útil para ajustar entrada, stop o target.';
    }

    return 'La señal sigue pendiente de validación.';
  }

  function formatProb(value) {
    if (value === null || value === undefined || value === '') return 'Pendiente de backtest';
    return `${Math.round(Number(value))}%`;
  }

  function maybeSaveActionableSignal(a) {
    if (!a?.isActionable || !['CALL', 'PUT'].includes(a?.side)) return;

    let saved = [];
    try {
      const raw = localStorage.getItem('nexoraHistory');
      saved = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(saved)) saved = [];
    } catch {
      saved = [];
    }

    const duplicate = saved.some(
      (h) =>
        h.symbol === a.symbol &&
        h.strategy === a.strategy &&
        h.side === a.side &&
        h.signalTime === a.time
    );

    if (duplicate) return;

    const levels = a.levels || {};

    const item = {
      id: `${Date.now()}-${a.symbol}-${a.strategy}`,
      date: new Date().toLocaleString(),
      createdAt: new Date().toISOString(),
      signalTime: a.time,
      symbol: a.symbol,
      strategy: a.strategy,
      strategyLabel: a.strategyLabel,
      side: a.side,
      mode: a.mode,
      price: a.close,
      close: a.close,
      currentPrice: a.currentPrice ?? a.close,
      entry:
        a.side === 'CALL'
          ? levels.entryCall ?? a.close
          : levels.entryPut ?? a.close,
      entryPrice:
        a.side === 'CALL'
          ? levels.entryCall ?? a.close
          : levels.entryPut ?? a.close,
      stop:
        a.side === 'CALL'
          ? levels.stopCall ?? null
          : levels.stopPut ?? null,
      target1: levels.target1 ?? null,
      target2: levels.target2 ?? null,
      historicalProbability: a.historicalProbability ?? null,
      confidence: a.confidence ?? null,
      qualityScore: a.qualityScore ?? null,
      score: a.score ?? 0,
      validationStatus: 'PENDIENTE',
      status: 'PENDIENTE',
      result: '⏳ PENDIENTE'
    };

    saveHistory([item, ...saved].slice(0, 150));
  }

  async function analyze(symbolInput) {
    const sym = String(symbolInput || ticker).trim().toUpperCase();
    if (!sym || loading) return;

    setLoading(true);
    setProgress(20);
    setLoadingStep('Conectando con Yahoo Finance...');
    setScan(null);

    try {
      const response = await fetch(
        `/api/analyze?symbol=${encodeURIComponent(sym)}&mode=${encodeURIComponent(mode)}`
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || 'Error en análisis');
      }

      const a = data?.analysis || data;
      setAnalysis(a);
      setProgress(85);
      setLoadingStep('Evaluando estrategias Nexora...');

      maybeSaveActionableSignal(a);

      setProgress(100);
      setLoadingStep(a?.isActionable ? 'Señal operable detectada' : 'Análisis completado');
    } catch (error) {
      alert(`Error: ${error?.message || 'No se pudo analizar el activo'}`);
    } finally {
      setTimeout(() => {
        setLoading(false);
        setProgress(0);
        setLoadingStep('');
      }, 450);
    }
  }

  async function scanner() {
    if (loading) return;

    const cleanWatch = String(watch || '')
      .split(',')
      .map((item) => item.trim().toUpperCase())
      .filter(Boolean)
      .join(',');

    if (!cleanWatch) {
      alert('Agrega al menos un ticker.');
      return;
    }

    setLoading(true);
    setProgress(20);
    setLoadingStep('Escaneando estrategias...');
    setAnalysis(null);
    setScan(null);

    try {
      const response = await fetch(
        `/api/scan?symbols=${encodeURIComponent(cleanWatch)}&mode=${encodeURIComponent(mode)}`
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || 'Error en scanner');
      }

      setScan({
        ...data,
        results: Array.isArray(data?.results) ? data.results : []
      });

      setProgress(100);
      setLoadingStep('Scanner completado');
    } catch (error) {
      alert(`Error: ${error?.message || 'No se pudo ejecutar el scanner'}`);
    } finally {
      setTimeout(() => {
        setLoading(false);
        setProgress(0);
        setLoadingStep('');
      }, 450);
    }
  }

  async function runBacktest() {
    const sym = String(quantSymbol || 'QQQ').trim().toUpperCase();
    if (!sym || backtestLoading) return;

    setBacktestLoading(true);
    setBacktest(null);

    try {
      const response = await fetch(
        `/api/backtest?symbol=${encodeURIComponent(sym)}&years=10`
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || 'Error ejecutando backtest');
      }

      setBacktest(data);
    } catch (error) {
      alert(`Backtest: ${error?.message || 'Error desconocido'}`);
    } finally {
      setBacktestLoading(false);
    }
  }

  async function validateHistory() {
    if (!history.length) {
      alert('Todavía no hay señales operables guardadas.');
      return;
    }

    try {
      setLoading(true);
      setLoadingStep('Validando historial...');
      setProgress(50);

      const response = await fetch('/api/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signals: history })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || 'Error validando historial');
      }

      const validated = Array.isArray(data?.results) ? data.results : history;
      saveHistory(validated);

      setProgress(100);
      setLoadingStep('Historial validado');
    } catch (error) {
      alert(
        `Error validando historial: ${error?.message || 'Error desconocido'}`
      );
    } finally {
      setTimeout(() => {
        setLoading(false);
        setProgress(0);
        setLoadingStep('');
      }, 450);
    }
  }

  const best = analysis || scan?.best || null;
  const scanResults = Array.isArray(scan?.results) ? scan.results : [];
  const safeHistory = Array.isArray(history) ? history : [];

  const stats = useMemo(() => {
    const ganadas = safeHistory.filter((h) => h?.validationStatus === 'GANADA').length;
    const perdidas = safeHistory.filter((h) => h?.validationStatus === 'PERDIDA').length;
    const direccion = safeHistory.filter(
      (h) => h?.validationStatus === 'ACERTO_DIRECCION'
    ).length;
    const pendientes = safeHistory.filter(
      (h) => !h?.validationStatus || h?.validationStatus === 'PENDIENTE'
    ).length;

    const efectividad =
      ganadas + perdidas > 0
        ? Math.round((ganadas / (ganadas + perdidas)) * 100)
        : 0;

    const precision =
      ganadas + perdidas + direccion > 0
        ? Math.round(
            ((ganadas + direccion) / (ganadas + perdidas + direccion)) * 100
          )
        : 0;

    return { ganadas, perdidas, direccion, pendientes, efectividad, precision };
  }, [safeHistory]);

  const showMain = !isMobile || mobileTab === 'inicio';
  const showAnalyze = !isMobile || mobileTab === 'analizar';
  const showPerformance = !isMobile || mobileTab === 'rendimiento';
  const showIA = !isMobile || mobileTab === 'inteligencia';
  const showAcademy = !isMobile || mobileTab === 'academia';

  return (
    <main
      style={{
        fontFamily: 'Inter, system-ui, Arial',
        background:
          'radial-gradient(circle at top left,#0f766e 0,#020617 34%,#020617 100%)',
        minHeight: '100vh',
        color: '#e2e8f0',
        padding: 20
      }}
    >
      <div style={{ maxWidth: 1500, margin: '0 auto' }}>
        <header
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 16,
            marginBottom: 20,
            flexWrap: 'wrap'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <img
              src="/nexora-logo.png"
              alt="Nexora"
              style={{
                width: isMobile ? 78 : 100,
                height: isMobile ? 52 : 66,
                objectFit: 'cover',
                objectPosition: 'center top',
                borderRadius: 14,
                border: '1px solid rgba(25,230,194,.25)'
              }}
            />

            <div>
              <h1
                style={{
                  margin: 0,
                  fontSize: isMobile ? 27 : 34,
                  letterSpacing: 2
                }}
              >
                NEXORA
              </h1>

              <div style={{ color: cyan, fontWeight: 800, marginTop: 3 }}>
                Trading Intelligence Platform
              </div>

              <div style={{ color: '#64748b', fontSize: 12, marginTop: 3 }}>
                Ventaja. Decisión. Resultados. · v2.0 Quant
              </div>
            </div>
          </div>

          <div style={{ textAlign: 'right', color: '#94a3b8' }}>
            <div style={{ color: green, fontWeight: 900 }}>● EN LÍNEA</div>
            <div>{currentTime || '--:--:--'} NY</div>
          </div>
        </header>

        <section
          style={{
            display: 'grid',
            gridTemplateColumns: isMobile
              ? '1fr'
              : isNarrowDesktop
              ? '205px minmax(0,1fr) 230px'
              : '235px minmax(0,1fr) 265px',
            gap: 18
          }}
        >
          {!isMobile && (
            <aside
              style={{
                display: 'grid',
                gap: 14,
                alignContent: 'start',
                minWidth: 0
              }}
            >
              <Card>
                <h3 style={{ marginTop: 0 }}>Menú Nexora</h3>
                <p>🏠 Dashboard</p>
                <p>🔎 Scanner IA</p>
                <p>📈 Estrategias</p>
                <p>🧪 Quant Lab</p>
                <p>📊 Rendimiento</p>
                <p>🎓 Academia</p>
              </Card>

              <Card>
                <h3 style={{ marginTop: 0 }}>Modo</h3>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button
                    onClick={() => setMode('swing')}
                    style={{ ...btn, opacity: mode === 'swing' ? 1 : 0.42 }}
                  >
                    Swing
                  </button>

                  <button
                    onClick={() => setMode('intraday')}
                    style={{ ...btn, opacity: mode === 'intraday' ? 1 : 0.42 }}
                  >
                    Intradía
                  </button>
                </div>

                <p style={{ color: '#94a3b8', marginBottom: 0 }}>
                  Actual: <b>{mode}</b>
                </p>
              </Card>
            </aside>
          )}

          <div style={{ display: 'grid', gap: 18, minWidth: 0 }}>
            {showMain && (
              <Card>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 12,
                    alignItems: 'flex-start',
                    flexWrap: 'wrap'
                  }}
                >
                  <div>
                    <div style={{ color: '#94a3b8', fontSize: 13 }}>
                      🧠 DECISIÓN IA
                    </div>
                    <h2 style={{ margin: '5px 0 0' }}>
                      {best ? humanSignal(best) : 'Sin análisis todavía'}
                    </h2>
                  </div>

                  {best && (
                    <span
                      style={{
                        border: `1px solid ${getQualityColor(best.qualityScore)}`,
                        color: getQualityColor(best.qualityScore),
                        borderRadius: 999,
                        padding: '7px 12px',
                        fontWeight: 900
                      }}
                    >
                      Calidad {safeNumber(best.qualityScore, 50)}/100
                    </span>
                  )}
                </div>

                {best ? (
                  <>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: isMobile ? '1fr' : '1.1fr .9fr',
                        gap: 18,
                        marginTop: 18
                      }}
                    >
                      <div>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12
                          }}
                        >
                          <AssetLogo symbol={best.symbol} size={56} />

                          <div>
                            <div
                              style={{
                                fontSize: 38,
                                fontWeight: 900,
                                lineHeight: 1
                              }}
                            >
                              {best.symbol}
                            </div>

                            <div style={{ color: '#94a3b8', marginTop: 5 }}>
                              Precio actual: ${best.currentPrice ?? best.close ?? '-'}
                            </div>
                          </div>
                        </div>

                        <div
                          style={{
                            marginTop: 18,
                            padding: 16,
                            borderRadius: 16,
                            background: 'rgba(2,6,23,.72)',
                            border: '1px solid #334155'
                          }}
                        >
                          <div
                            style={{
                              color: getColorFromSide(best.side),
                              fontWeight: 900,
                              fontSize: 18
                            }}
                          >
                            🏆 {strategyFullName(best)}
                          </div>

                          {getStrategyInfo(best.strategy) && (
                            <div
                              style={{
                                color: '#94a3b8',
                                fontSize: 13,
                                marginTop: 4
                              }}
                            >
                              {getStrategyInfo(best.strategy).friendlyName}
                            </div>
                          )}

                          <p style={{ lineHeight: 1.6, color: '#cbd5e1' }}>
                            {best.plainExplanation ||
                              'Nexora está evaluando la situación del mercado.'}
                          </p>

                          <div
                            style={{
                              display: 'grid',
                              gridTemplateColumns: isMobile
                                ? '1fr 1fr'
                                : 'repeat(4,1fr)',
                              gap: 10
                            }}
                          >
                            <div
                              style={{
                                background: '#0f172a',
                                padding: 12,
                                borderRadius: 12
                              }}
                            >
                              <div style={{ color: '#94a3b8', fontSize: 12 }}>
                                CONFIANZA
                              </div>
                              <b style={{ fontSize: 22 }}>
                                {safeNumber(best.confidence, 50)}%
                              </b>
                            </div>

                            <div
                              style={{
                                background: '#0f172a',
                                padding: 12,
                                borderRadius: 12
                              }}
                            >
                              <div style={{ color: '#94a3b8', fontSize: 12 }}>
                                CONSENSO IA
                              </div>
                              <b style={{ fontSize: 22 }}>
                                {safeNumber(best.metaEngine?.consensus, 50)}%
                              </b>
                            </div>

                            <div
                              style={{
                                background: '#0f172a',
                                padding: 12,
                                borderRadius: 12
                              }}
                            >
                              <div style={{ color: '#94a3b8', fontSize: 12 }}>
                                RIESGO
                              </div>
                              <b style={{ fontSize: 16 }}>
                                {riskScoreLabel(best)}
                              </b>
                            </div>

                            <div
                              style={{
                                background: '#0f172a',
                                padding: 12,
                                borderRadius: 12
                              }}
                            >
                              <div style={{ color: '#94a3b8', fontSize: 12 }}>
                                CALIDAD
                              </div>
                              <b style={{ fontSize: 22 }}>
                                {qualityGrade(best.qualityScore)}
                              </b>
                            </div>
                          </div>

                          <div
                            style={{
                              marginTop: 14,
                              padding: 14,
                              borderRadius: 14,
                              background: best.isActionable
                                ? 'rgba(34,197,94,.10)'
                                : 'rgba(250,204,21,.08)',
                              border: `1px solid ${
                                best.isActionable ? '#22c55e' : '#facc15'
                              }`
                            }}
                          >
                            <div
                              style={{
                                color: '#94a3b8',
                                fontSize: 12,
                                marginBottom: 4
                              }}
                            >
                              RECOMENDACIÓN NEXORA
                            </div>

                            <div
                              style={{
                                fontWeight: 900,
                                fontSize: 22,
                                color: best.isActionable ? green : yellow
                              }}
                            >
                              {finalActionLabel(best)}
                            </div>

                            <div
                              style={{
                                marginTop: 6,
                                color: '#cbd5e1',
                                fontSize: 13
                              }}
                            >
                              {best.isActionable
                                ? 'La estrategia seleccionada alcanzó el nivel mínimo de calidad del Meta-Motor.'
                                : 'La mejor estrategia todavía no cumple todos los requisitos para abrir operación.'}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div>
                        <h3 style={{ marginTop: 0 }}>¿Por qué tomó esta decisión?</h3>

                        <div style={{ display: 'grid', gap: 10 }}>
                          {(Array.isArray(best.reasons) ? best.reasons : []).map(
                            (reason, i) => (
                              <div
                                key={i}
                                style={{
                                  padding: 12,
                                  borderRadius: 12,
                                  background: '#0f172a',
                                  border: '1px solid #1e293b'
                                }}
                              >
                                ✓ {reason}
                              </div>
                            )
                          )}
                        </div>

                        <div
                          style={{
                            marginTop: 14,
                            padding: 14,
                            borderRadius: 14,
                            background: '#020617',
                            border: '1px solid #334155'
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              gap: 10,
                              marginBottom: 8
                            }}
                          >
                            <span style={{ color: '#94a3b8' }}>
                              Confianza general
                            </span>
                            <b>{safeNumber(best.confidence, 50)}%</b>
                          </div>

                          <div
                            style={{
                              height: 10,
                              background: '#1e293b',
                              borderRadius: 999,
                              overflow: 'hidden'
                            }}
                          >
                            <div
                              style={{
                                width: `${safeNumber(best.confidence, 50)}%`,
                                height: '100%',
                                background: '#22c55e'
                              }}
                            />
                          </div>

                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              gap: 10,
                              marginTop: 14,
                              marginBottom: 8
                            }}
                          >
                            <span style={{ color: '#94a3b8' }}>
                              Consenso entre estrategias
                            </span>
                            <b>{safeNumber(best.metaEngine?.consensus, 50)}%</b>
                          </div>

                          <div
                            style={{
                              height: 10,
                              background: '#1e293b',
                              borderRadius: 999,
                              overflow: 'hidden'
                            }}
                          >
                            <div
                              style={{
                                width: `${safeNumber(
                                  best.metaEngine?.consensus,
                                  50
                                )}%`,
                                height: '100%',
                                background: '#19e6c2'
                              }}
                            />
                          </div>
                        </div>

                        {getStrategyInfo(best.strategy) && (
                          <>
                            <button
                              onClick={() => setShowStrategyHelp((v) => !v)}
                              style={{
                                ...secondaryBtn,
                                width: '100%',
                                marginTop: 14
                              }}
                            >
                              {showStrategyHelp
                                ? 'Ocultar cómo funciona la estrategia'
                                : `¿Qué significa ${best.strategy}?`}
                            </button>

                            {showStrategyHelp && (
                              <div
                                style={{
                                  marginTop: 12,
                                  padding: 14,
                                  borderRadius: 14,
                                  background: '#020617',
                                  border: '1px solid #334155'
                                }}
                              >
                                <div
                                  style={{
                                    fontWeight: 900,
                                    color: '#19e6c2'
                                  }}
                                >
                                  {strategyFullName(best)}
                                </div>

                                <p
                                  style={{
                                    lineHeight: 1.6,
                                    color: '#cbd5e1'
                                  }}
                                >
                                  {getStrategyInfo(best.strategy).shortDescription}
                                </p>

                                <div style={{ display: 'grid', gap: 7 }}>
                                  {getStrategyInfo(best.strategy).details.map((d) => (
                                    <div key={d}>✓ {d}</div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </>
                        )}

                        <button
                          onClick={() => setShowTechnical((v) => !v)}
                          style={{
                            ...secondaryBtn,
                            width: '100%',
                            marginTop: 14
                          }}
                        >
                          {showTechnical
                            ? 'Ocultar detalles técnicos'
                            : 'Ver detalles técnicos'}
                        </button>

                        {showTechnical && (
                          <div
                            style={{
                              marginTop: 12,
                              padding: 14,
                              borderRadius: 14,
                              background: '#020617',
                              border: '1px solid #334155',
                              lineHeight: 1.8
                            }}
                          >
                            <div>RSI: {best.indicators?.rsi ?? '-'}</div>
                            <div>EMA20: {best.indicators?.ema20 ?? '-'}</div>
                            <div>EMA50: {best.indicators?.ema50 ?? '-'}</div>
                            <div>EMA200: {best.indicators?.ema200 ?? '-'}</div>
                            <div>MACD: {best.indicators?.macdHist ?? '-'}</div>
                            <div>
                              Volumen relativo:{' '}
                              {best.indicators?.relativeVolume ?? '-'}x
                            </div>
                            <div>
                              Bollinger inferior:{' '}
                              {best.indicators?.bollingerLower ?? '-'}
                            </div>
                            <div>
                              Bollinger media:{' '}
                              {best.indicators?.bollingerMiddle ?? '-'}
                            </div>
                            <div>
                              Bollinger superior:{' '}
                              {best.indicators?.bollingerUpper ?? '-'}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div
                      style={{
                        marginTop: 18,
                        paddingTop: 18,
                        borderTop: '1px solid #334155'
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: 10,
                          flexWrap: 'wrap'
                        }}
                      >
                        <div>
                          <h3 style={{ margin: 0 }}>Estrategias evaluadas</h3>
                          <p
                            style={{
                              color: '#94a3b8',
                              margin: '5px 0 0',
                              fontSize: 13
                            }}
                          >
                            Nexora comparó{' '}
                            {safeNumber(best.metaEngine?.evaluated, 4)} estrategias
                            y seleccionó automáticamente la de mayor calidad.
                          </p>
                        </div>

                        <span
                          style={{
                            color: '#19e6c2',
                            border: '1px solid #19e6c2',
                            borderRadius: 999,
                            padding: '6px 10px',
                            fontSize: 12,
                            fontWeight: 900
                          }}
                        >
                          Consenso {safeNumber(best.metaEngine?.consensus, 50)}%
                        </span>
                      </div>

                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: isMobile
                            ? '1fr'
                            : 'repeat(2, minmax(0,1fr))',
                          gap: 12,
                          marginTop: 14
                        }}
                      >
                        {(Array.isArray(best.strategyRanking)
                          ? best.strategyRanking
                          : []
                        ).map((s) => (
                          <div
                            key={s.id}
                            style={{
                              padding: 14,
                              borderRadius: 14,
                              background: '#020617',
                              border:
                                s.id === best.strategy
                                  ? '1px solid #19e6c2'
                                  : '1px solid #334155'
                            }}
                          >
                            <div
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                gap: 10,
                                alignItems: 'center'
                              }}
                            >
                              <div>
                                <div style={{ fontWeight: 900 }}>
                                  {s.id} – {s.friendlyName}
                                </div>
                                <div
                                  style={{
                                    color: '#94a3b8',
                                    fontSize: 12,
                                    marginTop: 3
                                  }}
                                >
                                  {s.fullName}
                                </div>
                              </div>

                              <b
                                style={{
                                  color:
                                    s.id === best.strategy
                                      ? '#19e6c2'
                                      : '#e2e8f0'
                                }}
                              >
                                {safeNumber(
                                  s.engineQuality ?? s.quality,
                                  0
                                )}
                                /100
                              </b>
                            </div>

                            <div
                              style={{
                                height: 9,
                                background: '#1e293b',
                                borderRadius: 999,
                                overflow: 'hidden',
                                marginTop: 10
                              }}
                            >
                              <div
                                style={{
                                  width: `${safeNumber(
                                    s.engineQuality ?? s.quality,
                                    0
                                  )}%`,
                                  height: '100%',
                                  background:
                                    s.id === best.strategy
                                      ? '#19e6c2'
                                      : '#64748b'
                                }}
                              />
                            </div>

                            <div
                              style={{
                                marginTop: 9,
                                fontSize: 12,
                                color:
                                  s.id === best.strategy
                                    ? '#22c55e'
                                    : '#94a3b8'
                              }}
                            >
                              {strategyVerdict(s, best.strategy)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div
                      style={{
                        marginTop: 18,
                        padding: 16,
                        borderRadius: 16,
                        background: '#020617',
                        border: '1px solid #334155'
                      }}
                    >
                      <h3 style={{ marginTop: 0 }}>🧠 Decisión de la IA</h3>

                      <p
                        style={{
                          lineHeight: 1.7,
                          color: '#cbd5e1',
                          marginBottom: 0
                        }}
                      >
                        Nexora evaluó{' '}
                        <b>{safeNumber(best.metaEngine?.evaluated, 4)}</b>{' '}
                        estrategias. <b>{best.strategy}</b> obtuvo la mejor
                        calificación con{' '}
                        <b>{safeNumber(best.qualityScore, 50)}/100</b>. El consenso
                        direccional es de{' '}
                        <b>{safeNumber(best.metaEngine?.consensus, 50)}%</b>.{' '}
                        {best.isActionable
                          ? `La configuración alcanzó el umbral mínimo y Nexora considera ${best.side} como la mejor oportunidad actual.`
                          : 'La estrategia ganadora todavía necesita confirmación, por lo que Nexora recomienda esperar antes de abrir una posición.'}
                      </p>
                    </div>


                    {(() => {
                      const plan = operationPlan(best);
                      const rating = planRating(plan, best);

                      return (
                        <div
                          style={{
                            marginTop: 18,
                            padding: 18,
                            borderRadius: 18,
                            background: 'rgba(2,6,23,.82)',
                            border: '1px solid #334155'
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              gap: 12,
                              alignItems: 'flex-start',
                              flexWrap: 'wrap'
                            }}
                          >
                            <div>
                              <div style={{ color: '#94a3b8', fontSize: 13 }}>
                                📈 SIMULACIÓN PROFESIONAL
                              </div>
                              <h3 style={{ margin: '5px 0 0' }}>
                                Plan de operación
                              </h3>
                            </div>

                            <span
                              style={{
                                border: `1px solid ${
                                  rating === 'EXCELENTE'
                                    ? '#22c55e'
                                    : rating === 'BUENA'
                                    ? '#19e6c2'
                                    : rating === 'VIGILAR'
                                    ? '#facc15'
                                    : '#ef4444'
                                }`,
                                color:
                                  rating === 'EXCELENTE'
                                    ? '#22c55e'
                                    : rating === 'BUENA'
                                    ? '#19e6c2'
                                    : rating === 'VIGILAR'
                                    ? '#facc15'
                                    : '#ef4444',
                                borderRadius: 999,
                                padding: '7px 11px',
                                fontWeight: 900,
                                fontSize: 12
                              }}
                            >
                              {rating}
                            </span>
                          </div>

                          <div
                            style={{
                              marginTop: 14,
                              padding: 12,
                              borderRadius: 12,
                              background:
                                plan?.status === 'LISTO_PARA_ENTRAR'
                                  ? 'rgba(34,197,94,.08)'
                                  : plan?.status === 'NO_OPERAR'
                                  ? 'rgba(239,68,68,.08)'
                                  : 'rgba(250,204,21,.08)',
                              border: `1px solid ${
                                plan?.status === 'LISTO_PARA_ENTRAR'
                                  ? 'rgba(34,197,94,.55)'
                                  : plan?.status === 'NO_OPERAR'
                                  ? 'rgba(239,68,68,.55)'
                                  : 'rgba(250,204,21,.45)'
                              }`,
                              color:
                                plan?.status === 'LISTO_PARA_ENTRAR'
                                  ? '#22c55e'
                                  : plan?.status === 'NO_OPERAR'
                                  ? '#ef4444'
                                  : '#facc15',
                              fontWeight: 900
                            }}
                          >
                            {plan?.statusLabel ||
                              (best.isActionable
                                ? '🟢 LISTO PARA ENTRAR'
                                : '🟡 ESPERAR CONFIRMACIÓN')}
                          </div>

                          <div
                            style={{
                              display: 'grid',
                              gridTemplateColumns: isMobile
                                ? '1fr 1fr'
                                : 'repeat(4,minmax(0,1fr))',
                              gap: 10,
                              marginTop: 14
                            }}
                          >
                            {[
                              ['Entrada ideal', plan?.entry ?? '-'],
                              [
                                'Zona válida',
                                plan?.entryZone?.min != null &&
                                plan?.entryZone?.max != null
                                  ? `${plan.entryZone.min} - ${plan.entryZone.max}`
                                  : '-'
                              ],
                              ['Stop Loss', plan?.stop ?? '-'],
                              ['Target 1', plan?.target1 ?? '-'],
                              ['Target 2', plan?.target2 ?? '-'],
                              ['Riesgo/Beneficio', plan?.rr ? `${plan.rr}:1` : '-'],
                              [
                                'Tiempo estimado',
                                plan?.timeEstimate || timeEstimate(best)
                              ],
                              ['Dificultad', plan?.difficulty || '-'],
                              [
                                'Prob. histórica',
                                best.historicalProbability != null
                                  ? `${best.historicalProbability}%`
                                  : 'Pendiente de backtest'
                              ],
                              ['Dirección', best.side || 'NEUTRAL']
                            ].map(([label, value]) => (
                              <div
                                key={label}
                                style={{
                                  background: '#0f172a',
                                  border: '1px solid #1e293b',
                                  borderRadius: 12,
                                  padding: 12
                                }}
                              >
                                <div
                                  style={{
                                    color: '#94a3b8',
                                    fontSize: 11,
                                    marginBottom: 5
                                  }}
                                >
                                  {label.toUpperCase()}
                                </div>
                                <div style={{ fontWeight: 900 }}>{value}</div>
                              </div>
                            ))}
                          </div>

                          <div
                            style={{
                              display: 'grid',
                              gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
                              gap: 12,
                              marginTop: 14
                            }}
                          >
                            <div
                              style={{
                                background: '#0f172a',
                                borderRadius: 14,
                                border: '1px solid #334155',
                                padding: 14
                              }}
                            >
                              <div
                                style={{
                                  color: '#19e6c2',
                                  fontWeight: 900,
                                  marginBottom: 10
                                }}
                              >
                                🎯 Contrato sugerido
                              </div>

                              <div>
                                <b>Principal:</b> {plan?.contract || 'Sin contrato todavía'}
                              </div>
                              <div style={{ marginTop: 6 }}>
                                <b>Alternativa:</b>{' '}
                                {plan?.alternativeContract || 'Sin alternativa'}
                              </div>
                              <div style={{ marginTop: 6 }}>
                                <b>Vencimiento:</b> {plan?.expiration || '-'}
                              </div>
                              <div style={{ marginTop: 6 }}>
                                <b>Prima objetivo:</b>{' '}
                                {plan?.premiumTarget != null
                                  ? `$${formatContractNumber(plan.premiumTarget)}`
                                  : '-'}
                              </div>

                              {plan?.contractData && (
                                <div
                                  style={{
                                    display: 'grid',
                                    gridTemplateColumns: isMobile
                                      ? '1fr 1fr'
                                      : 'repeat(4, minmax(0, 1fr))',
                                    gap: 8,
                                    marginTop: 12
                                  }}
                                >
                                  {[
                                    ['Bid',
                                      plan.contractData.bid != null
                                        ? `$${formatContractNumber(plan.contractData.bid)}`
                                        : '-'],
                                    ['Ask',
                                      plan.contractData.ask != null
                                        ? `$${formatContractNumber(plan.contractData.ask)}`
                                        : '-'],
                                    ['Spread',
                                      plan.contractData.spreadPct != null
                                        ? `${formatContractNumber(plan.contractData.spreadPct)}%`
                                        : '-'],
                                    ['Volumen',
                                      plan.contractData.volume ?? '-'],
                                    ['Open Interest',
                                      plan.contractData.openInterest ?? '-'],
                                    ['IV',
                                      formatContractIv(plan.contractData.impliedVolatility)],
                                    ['Delta',
                                      formatContractNumber(plan.contractData.delta, 3)],
                                    ['Theta',
                                      formatContractNumber(plan.contractData.theta, 3)]
                                  ].map(([label, value]) => (
                                    <div
                                      key={label}
                                      style={{
                                        background: '#020617',
                                        border: '1px solid #1e293b',
                                        borderRadius: 9,
                                        padding: 8
                                      }}
                                    >
                                      <div
                                        style={{
                                          color: '#64748b',
                                          fontSize: 10,
                                          fontWeight: 800
                                        }}
                                      >
                                        {label}
                                      </div>
                                      <div
                                        style={{
                                          marginTop: 3,
                                          fontSize: 12,
                                          fontWeight: 900
                                        }}
                                      >
                                        {String(value)}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}

                              <div
                                style={{
                                  marginTop: 10,
                                  color: '#94a3b8',
                                  fontSize: 12,
                                  lineHeight: 1.6
                                }}
                              >
                                {plan?.contractData
                                  ? 'Contrato real validado por Nexora con datos de Option Chain. Revisa spread, volumen, open interest, IV y griegas antes de ejecutar.'
                                  : 'El contrato es una referencia técnica. Antes de comprar, Nexora debe confirmar spread, volumen, open interest y volatilidad implícita.'}
                              </div>
                            </div>

                            <div
                              style={{
                                background: '#0f172a',
                                borderRadius: 14,
                                border: '1px solid #334155',
                                padding: 14
                              }}
                            >
                              <div
                                style={{
                                  color: '#19e6c2',
                                  fontWeight: 900,
                                  marginBottom: 10
                                }}
                              >
                                ⚖️ Gestión de riesgo
                              </div>

                              <div>
                                <b>Stop de la prima:</b>{' '}
                                {plan?.maxPremiumRisk ||
                                  'Stop sugerido -20% a -30%'}
                              </div>

                              <div style={{ marginTop: 6 }}>
                                <b>Objetivo de ganancia:</b>{' '}
                                {plan?.profitTarget || '+50% a +80%'}
                              </div>

                              <div style={{ marginTop: 6 }}>
                                <b>Filtro:</b>{' '}
                                {plan?.avoid ||
                                  'Evitar baja liquidez y spreads muy abiertos'}
                              </div>

                              <div
                                style={{
                                  marginTop: 10,
                                  color: '#94a3b8',
                                  fontSize: 12,
                                  lineHeight: 1.6
                                }}
                              >
                                Nexora separa el stop del activo del stop de la prima:
                                el precio del subyacente define invalidez técnica y la
                                prima limita el riesgo monetario.
                              </div>
                            </div>
                          </div>

                          <div
                            style={{
                              display: 'grid',
                              gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
                              gap: 12,
                              marginTop: 14
                            }}
                          >
                            <div
                              style={{
                                background: '#020617',
                                borderRadius: 14,
                                border: '1px solid #334155',
                                padding: 14
                              }}
                            >
                              <div
                                style={{
                                  fontWeight: 900,
                                  color: '#19e6c2',
                                  marginBottom: 10
                                }}
                              >
                                ✅ Validación antes de entrar
                              </div>

                              <div style={{ display: 'grid', gap: 8 }}>
                                {(Array.isArray(plan?.checklist)
                                  ? plan.checklist
                                  : []
                                ).map((item) => (
                                  <div
                                    key={item.key}
                                    style={{
                                      padding: 10,
                                      borderRadius: 10,
                                      background: '#0f172a'
                                    }}
                                  >
                                    <div style={{ fontWeight: 800 }}>
                                      {item.status === 'PASS'
                                        ? '✅'
                                        : item.status === 'FAIL'
                                        ? '❌'
                                        : item.status === 'CAUTION'
                                        ? '⚠️'
                                        : '⬜'}{' '}
                                      {item.label}
                                    </div>
                                    <div
                                      style={{
                                        color: '#94a3b8',
                                        fontSize: 12,
                                        marginTop: 3
                                      }}
                                    >
                                      {item.note}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>

                            <div
                              style={{
                                background: '#020617',
                                borderRadius: 14,
                                border: '1px solid #334155',
                                padding: 14
                              }}
                            >
                              <div
                                style={{
                                  fontWeight: 900,
                                  color: '#ef4444',
                                  marginBottom: 10
                                }}
                              >
                                ❌ ¿Qué invalida la operación?
                              </div>

                              <div style={{ display: 'grid', gap: 8 }}>
                                {(Array.isArray(plan?.invalidationRules)
                                  ? plan.invalidationRules
                                  : []
                                ).map((rule, i) => (
                                  <div
                                    key={`${rule}-${i}`}
                                    style={{
                                      padding: 10,
                                      borderRadius: 10,
                                      background: '#0f172a',
                                      color: '#cbd5e1'
                                    }}
                                  >
                                    • {rule}
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>

                          <div
                            style={{
                              marginTop: 14,
                              padding: 14,
                              borderRadius: 14,
                              background: '#020617',
                              border: '1px solid #334155'
                            }}
                          >
                            <div
                              style={{
                                fontWeight: 900,
                                marginBottom: 8
                              }}
                            >
                              ¿Qué significa este plan?
                            </div>

                            {plan?.whyThisPlan && (
                              <p
                                style={{
                                  margin: '0 0 10px',
                                  color: '#19e6c2',
                                  lineHeight: 1.7,
                                  fontWeight: 800
                                }}
                              >
                                {plan.whyThisPlan}
                              </p>
                            )}

                            <p
                              style={{
                                margin: 0,
                                color: '#cbd5e1',
                                lineHeight: 1.7
                              }}
                            >
                              {best.side === 'CALL'
                                ? `Nexora buscaría una entrada alcista cerca de ${plan?.entry ?? 'la zona indicada'}, invalidaría la idea si el activo cae hacia ${plan?.stop ?? 'el stop'} y tomaría como referencias ${plan?.target1 ?? 'Target 1'} y ${plan?.target2 ?? 'Target 2'}.`
                                : best.side === 'PUT'
                                ? `Nexora buscaría una entrada bajista cerca de ${plan?.entry ?? 'la zona indicada'}, invalidaría la idea si el activo sube hacia ${plan?.stop ?? 'el stop'} y tomaría como referencias ${plan?.target1 ?? 'Target 1'} y ${plan?.target2 ?? 'Target 2'}.`
                                : 'No existe una dirección operable todavía. El plan se activará cuando alguna estrategia supere los filtros del Meta-Motor.'}
                            </p>
                          </div>
                        </div>
                      );
                    })()}
                  </>
                ) : (
                  <div
                    style={{
                      marginTop: 18,
                      padding: 18,
                      borderRadius: 16,
                      background: '#020617',
                      border: '1px solid #334155'
                    }}
                  >
                    <h3 style={{ marginTop: 0, color: '#19e6c2' }}>
                      🎯 Bienvenido a Nexora
                    </h3>

                    <p style={{ color: '#cbd5e1', lineHeight: 1.7 }}>
                      Escribe un ticker o ejecuta el Scanner IA. Nexora evaluará
                      todas las estrategias activas y seleccionará automáticamente
                      la configuración con mejor calidad.
                    </p>

                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
                        gap: 10
                      }}
                    >
                      {[
                        'Tendencia y medias móviles',
                        'Momentum y RSI',
                        'Volumen y liquidez',
                        'Soportes y resistencias',
                        'Reversión con Bollinger',
                        'Confirmación multi-timeframe'
                      ].map((item) => (
                        <div
                          key={item}
                          style={{
                            padding: 11,
                            borderRadius: 12,
                            background: '#0f172a'
                          }}
                        >
                          ✓ {item}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            )}

            {showAnalyze && (
              <>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
                    gap: 18
                  }}
                >
                  <Card>
                    <h3 style={{ marginTop: 0 }}>Analizar ticker</h3>

                    <div
                      style={{
                        display: 'flex',
                        gap: 10,
                        flexDirection: isMobile ? 'column' : 'row'
                      }}
                    >
                      <input
                        id="nexora-ticker-input"
                        name="nexora-ticker-input"
                        value={ticker}
                        onChange={(e) => {
                          const clean = e.target.value
                            .toUpperCase()
                            .replace(/[^A-Z.\-]/g, '');
                          setTicker(clean);
                        }}
                        onKeyDown={(e) => {
                          e.stopPropagation();
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            if (!loading) analyze(e.currentTarget.value);
                          }
                        }}
                        autoComplete="off"
                        autoCorrect="off"
                        autoCapitalize="characters"
                        spellCheck={false}
                        inputMode="text"
                        placeholder="Escribe QQQ, NVDA, TSLA..."
                        style={inp}
                      />

                      <button
                        onClick={() => analyze(ticker)}
                        disabled={loading}
                        style={{ ...btn, opacity: loading ? 0.5 : 1 }}
                      >
                        ANALIZAR
                      </button>
                    </div>

                    <p
                      style={{
                        color: '#64748b',
                        fontSize: 12,
                        marginBottom: 0
                      }}
                    >
                      Escribe el ticker completo de corrido. Enter se usa solo al
                      terminar.
                    </p>
                  </Card>

                  <Card>
                    <h3 style={{ marginTop: 0 }}>Scanner IA</h3>

                    <textarea
                      value={watch}
                      onChange={(e) => setWatch(e.target.value.toUpperCase())}
                      style={{ ...inp, minHeight: 76, resize: 'vertical' }}
                    />

                    <button
                      onClick={scanner}
                      disabled={loading}
                      style={{
                        ...btn,
                        marginTop: 12,
                        width: '100%',
                        opacity: loading ? 0.5 : 1
                      }}
                    >
                      ESCANEAR Y RANKEAR
                    </button>
                  </Card>
                </div>

                {scan && (
                  <Card>
                    <h2 style={{ marginTop: 0 }}>Ranking de oportunidades</h2>

                    <div style={{ overflowX: 'auto' }}>
                      <table
                        style={{
                          width: '100%',
                          borderCollapse: 'collapse',
                          minWidth: 980
                        }}
                      >
                        <thead>
                          <tr style={{ color: '#94a3b8', textAlign: 'left' }}>
                            <th>Activo</th>
                            <th>Estrategia</th>
                            <th>Nombre completo</th>
                            <th>Lectura sencilla</th>
                            <th>Calidad</th>
                            <th>Prob. histórica</th>
                            <th>Riesgo</th>
                            <th>RSI</th>
                            <th>Volumen</th>
                            <th>Estado</th>
                          </tr>
                        </thead>

                        <tbody>
                          {scanResults.map((r, i) => (
                            <tr
                              key={`${r.symbol || 'item'}-${i}`}
                              style={{ borderTop: '1px solid #334155' }}
                            >
                              <td style={{ padding: 12 }}>
                                <div
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 8
                                  }}
                                >
                                  <AssetLogo symbol={r.symbol} size={30} />
                                  <b>{r.symbol}</b>
                                </div>
                              </td>

                              <td>{r.error ? 'Sin datos' : r.strategy || '-'}</td>
                              <td>
                                {r.error
                                  ? '-'
                                  : getStrategyInfo(r.strategy)
                                  ? getStrategyInfo(r.strategy).fullName
                                  : 'Sin estrategia válida'}
                              </td>
                              <td>{r.error ? r.error : humanSignal(r)}</td>
                              <td
                                style={{
                                  color: getQualityColor(r.qualityScore),
                                  fontWeight: 900
                                }}
                              >
                                {r.qualityScore ?? 0}/100
                              </td>
                              <td>{formatProb(r.historicalProbability)}</td>
                              <td>{r.error ? '-' : riskLabel(r)}</td>
                              <td>{r.indicators?.rsi ?? '-'}</td>
                              <td>
                                {r.indicators?.relativeVolume
                                  ? `${r.indicators.relativeVolume}x`
                                  : '-'}
                              </td>
                              <td
                                style={{
                                  color: r.isActionable ? green : yellow,
                                  fontWeight: 900
                                }}
                              >
                                {r.estado || r.signal || '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                )}
              </>
            )}

            {loading && (
              <Card>
                <h3 style={{ marginTop: 0 }}>🧠 Nexora IA</h3>
                <div style={{ color: cyan, fontWeight: 900, marginBottom: 10 }}>
                  {loadingStep || 'Analizando...'}
                </div>
                <div
                  style={{
                    height: 14,
                    background: '#23314a',
                    borderRadius: 999,
                    overflow: 'hidden'
                  }}
                >
                  <div
                    style={{
                      width: `${Math.max(progress, 15)}%`,
                      height: '100%',
                      background: 'linear-gradient(90deg,#19e6c2,#22c55e)',
                      transition: 'width .3s'
                    }}
                  />
                </div>
              </Card>
            )}

            {showIA && (
              <Card>
                <h2 style={{ marginTop: 0 }}>🧪 Quant Lab · MRBB</h2>

                <p style={{ color: '#cbd5e1', lineHeight: 1.6 }}>
                  Aquí Nexora comprueba con datos históricos si las salidas de
                  Bollinger realmente tienden a regresar a su rango normal. La
                  primera versión mide el activo subyacente; todavía no simula
                  primas históricas de opciones.
                </p>

                <div
                  style={{
                    display: 'flex',
                    gap: 10,
                    flexDirection: isMobile ? 'column' : 'row'
                  }}
                >
                  <input
                    value={quantSymbol}
                    onChange={(e) =>
                      setQuantSymbol(
                        e.target.value.toUpperCase().replace(/[^A-Z.\-]/g, '')
                      )
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        runBacktest();
                      }
                    }}
                    style={inp}
                  />

                  <button
                    onClick={runBacktest}
                    disabled={backtestLoading}
                    style={{
                      ...btn,
                      opacity: backtestLoading ? 0.5 : 1,
                      minWidth: 190
                    }}
                  >
                    {backtestLoading ? 'CALCULANDO...' : 'BACKTEST 10 AÑOS'}
                  </button>
                </div>

                {backtest && (
                  <div style={{ marginTop: 18 }}>
                    <h3>
                      {backtest.symbol} · {backtest.strategy}
                    </h3>

                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: isMobile
                          ? '1fr 1fr'
                          : 'repeat(4,1fr)',
                        gap: 12
                      }}
                    >
                      <Metric
                        label="Señales"
                        value={backtest.summary?.total?.signals ?? 0}
                      />
                      <Metric
                        label="Regresó a Bollinger ≤10d"
                        value={`${backtest.summary?.total?.returnInsideRate ?? 0}%`}
                      />
                      <Metric
                        label="Dirección correcta a 10d"
                        value={`${backtest.summary?.total?.directionWinRate ?? 0}%`}
                      />
                      <Metric
                        label="Retorno medio dirección"
                        value={`${backtest.summary?.total?.avgDirectionalReturn ?? 0}%`}
                      />
                    </div>

                    <div
                      style={{
                        marginTop: 16,
                        padding: 16,
                        borderRadius: 16,
                        background: '#020617',
                        border: '1px solid #334155'
                      }}
                    >
                      <h3 style={{ marginTop: 0 }}>Lectura sencilla</h3>

                      <p style={{ lineHeight: 1.7 }}>
                        Cuando {backtest.symbol} cerró fuera de Bollinger y además
                        mostró sobreventa/sobrecompra, volvió a entrar a su rango
                        normal dentro de 10 sesiones en{' '}
                        <b>{backtest.summary?.total?.returnInsideRate ?? 0}%</b>{' '}
                        de los casos históricos encontrados.
                      </p>

                      <p style={{ lineHeight: 1.7 }}>
                        Cuando además hubo volumen al menos 20% mayor de lo normal,
                        la tasa fue{' '}
                        <b>{backtest.summary?.volume120?.returnInsideRate ?? 0}%</b>.
                      </p>

                      <div
                        style={{
                          marginTop: 14,
                          padding: 14,
                          borderRadius: 14,
                          background: '#0f172a',
                          border: '1px solid #334155'
                        }}
                      >
                        <b style={{ color: '#19e6c2' }}>¿Qué descubrió Nexora?</b>
                        <p style={{ lineHeight: 1.7, marginBottom: 0 }}>
                          La ventaja no se mide por una sola señal. Nexora compara
                          cuántas veces el precio regresó a su rango normal, cuántas
                          veces acertó la dirección y si el volumen mejoró o empeoró
                          el resultado. Solo después de tener una muestra suficiente
                          usamos esa cifra como probabilidad histórica.
                        </p>
                      </div>
                    </div>

                    <div style={{ overflowX: 'auto', marginTop: 16 }}>
                      <table
                        style={{
                          width: '100%',
                          borderCollapse: 'collapse',
                          minWidth: 720
                        }}
                      >
                        <thead>
                          <tr style={{ color: '#94a3b8', textAlign: 'left' }}>
                            <th>Extensión</th>
                            <th>Casos</th>
                            <th>Regresó ≤10d</th>
                            <th>Con volumen fuerte</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(backtest.buckets || {}).map(
                            ([bucket, values]) => (
                              <tr
                                key={bucket}
                                style={{ borderTop: '1px solid #334155' }}
                              >
                                <td style={{ padding: 10 }}>{bucket}</td>
                                <td>{values?.all?.signals ?? 0}</td>
                                <td>{values?.all?.returnInsideRate ?? 0}%</td>
                                <td>
                                  {values?.withVolume120?.signals
                                    ? `${values.withVolume120.returnInsideRate}%`
                                    : 'Sin muestra'}
                                </td>
                              </tr>
                            )
                          )}
                        </tbody>
                      </table>
                    </div>

                    <p style={{ color: '#94a3b8', fontSize: 12 }}>
                      {backtest.note}
                    </p>
                  </div>
                )}
              </Card>
            )}

            {showPerformance && (
              <>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: isMobile
                      ? '1fr 1fr'
                      : 'repeat(4,1fr)',
                    gap: 14
                  }}
                >
                  <Metric label="Señales reales" value={safeHistory.length} />
                  <Metric label="Ganadas" value={stats.ganadas} />
                  <Metric label="Perdidas" value={stats.perdidas} />
                  <Metric label="Efectividad" value={`${stats.efectividad}%`} />
                </div>

                <Card>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 12,
                      alignItems: 'center',
                      flexWrap: 'wrap'
                    }}
                  >
                    <div>
                      <h2 style={{ margin: 0 }}>Historial Nexora</h2>
                      <p style={{ color: '#94a3b8' }}>
                        Solo se guardan señales que Nexora marca como operables.
                      </p>
                    </div>

                    <button
                      onClick={validateHistory}
                      disabled={loading}
                      style={{ ...btn, opacity: loading ? 0.5 : 1 }}
                    >
                      VALIDAR HISTORIAL
                    </button>
                  </div>

                  <div style={{ overflowX: 'auto' }}>
                    <table
                      style={{
                        width: '100%',
                        borderCollapse: 'collapse',
                        minWidth: 920
                      }}
                    >
                      <thead>
                        <tr style={{ color: '#94a3b8', textAlign: 'left' }}>
                          <th>Fecha</th>
                          <th>Activo</th>
                          <th>Estrategia</th>
                          <th>Señal</th>
                          <th>Entrada</th>
                          <th>Stop</th>
                          <th>Target</th>
                          <th>Calidad</th>
                          <th>Resultado</th>
                          <th>Aprendizaje</th>
                        </tr>
                      </thead>

                      <tbody>
                        {safeHistory.slice(0, 30).map((h, i) => (
                          <tr
                            key={h.id || `${h.symbol}-${i}`}
                            style={{ borderTop: '1px solid #334155' }}
                          >
                            <td style={{ padding: 10 }}>{h.date || '-'}</td>
                            <td>
                              <b>{h.symbol || '-'}</b>
                            </td>
                            <td>{h.strategy || 'NCS antiguo'}</td>
                            <td>{h.side || '-'}</td>
                            <td>{h.entry ?? h.entryPrice ?? '-'}</td>
                            <td>{h.stop ?? '-'}</td>
                            <td>{h.target1 ?? '-'}</td>
                            <td>{h.qualityScore ?? h.confidence ?? '-'}</td>
                            <td>
                              {h.result ||
                                h.validationStatus ||
                                h.status ||
                                '⏳ PENDIENTE'}
                            </td>
                            <td style={{ minWidth: 300, color: '#cbd5e1' }}>
                              {historyLesson(h)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </>
            )}

            {showAcademy && (
              <Card>
                <h2 style={{ marginTop: 0 }}>🎓 Academia Nexora</h2>
                <p style={{ lineHeight: 1.7 }}>
                  La vista sencilla explica qué está ocurriendo sin exigir que el
                  usuario conozca RSI, MACD o Bollinger. Cada estrategia incluye
                  ahora una mini gráfica animada con velas, similar a la lectura que
                  verías en una plataforma de trading, para visualizar dónde aparece
                  la oportunidad.
                </p>
                <p>
                  <b>Sobreventa:</b> el precio cayó con mucha fuerza y puede estar
                  demasiado alejado de su comportamiento normal.
                </p>
                <p>
                  <b>Sobrecompra:</b> el precio subió con mucha fuerza y puede
                  estar demasiado extendido.
                </p>
                <p>
                  <b>Reversión a la media:</b> búsqueda de regreso hacia un precio
                  más normal después de una extensión extrema.
                </p>

                <div
                  style={{
                    marginTop: 18,
                    display: 'grid',
                    gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
                    gap: 12
                  }}
                >
                  {Object.entries(STRATEGY_INFO).map(([key, info]) => (
                    <div
                      key={key}
                      style={{
                        padding: 14,
                        borderRadius: 14,
                        background: '#020617',
                        border: '1px solid #334155'
                      }}
                    >
                      <div style={{ fontWeight: 900, color: '#19e6c2' }}>
                        {key} – {info.fullName}
                      </div>
                      <div style={{ color: '#94a3b8', marginTop: 4 }}>
                        {info.friendlyName}
                      </div>
                      <p style={{ lineHeight: 1.6 }}>{info.shortDescription}</p>
                      <AnimatedStrategyChart strategy={key} />
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>

          {!isMobile && (
            <aside
              style={{
                display: 'grid',
                gap: 14,
                alignContent: 'start',
                minWidth: 0
              }}
            >
              <Card>
                <h3 style={{ marginTop: 0 }}>Estrategias</h3>

                <div style={{ display: 'grid', gap: 10 }}>
                  <StrategyBadge
                    name="NCS"
                    subtitle="Nexora Confluence Strategy · Tendencia y Confluencia"
                    active
                  />
                  <StrategyBadge
                    name="MRBB"
                    subtitle="Mean Reversion Bollinger Bands · Reversión a la Media"
                    active
                  />
                  <StrategyBadge
                    name="BPS"
                    subtitle="Breakout Precision Strategy · Próximamente"
                  />
                  <StrategyBadge
                    name="GHS"
                    subtitle="Gap Hunter Strategy · Próximamente"
                  />
                </div>
              </Card>

              <Card>
                <h3 style={{ marginTop: 0 }}>Regla Nexora</h3>
                <p style={{ color: '#cbd5e1', lineHeight: 1.6 }}>
                  Analizar no significa operar. Solo una configuración con calidad
                  suficiente entra al historial como señal.
                </p>
              </Card>

              <Card>
                <h3 style={{ marginTop: 0 }}>Estadísticas</h3>
                <p>Ganadas: {stats.ganadas}</p>
                <p>Perdidas: {stats.perdidas}</p>
                <p>Pendientes: {stats.pendientes}</p>
                <p>Acertó dirección: {stats.direccion}</p>
                <p>Efectividad: {stats.efectividad}%</p>
                <p>Precisión: {stats.precision}%</p>
              </Card>
            </aside>
          )}
        </section>

        {isMobile && (
          <div
            style={{
              position: 'fixed',
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 999,
              background: 'rgba(2,6,23,.97)',
              borderTop: '1px solid #334155',
              display: 'grid',
              gridTemplateColumns: 'repeat(5,1fr)',
              padding: '8px 6px calc(8px + env(safe-area-inset-bottom))',
              backdropFilter: 'blur(14px)'
            }}
          >
            {[
              ['inicio', '🏠', 'Inicio'],
              ['analizar', '🔍', 'Analizar'],
              ['rendimiento', '📊', 'Resultados'],
              ['inteligencia', '🧪', 'Quant'],
              ['academia', '🎓', 'Academia']
            ].map(([key, icon, label]) => (
              <button
                key={key}
                onClick={() => setMobileTab(key)}
                style={{
                  background: 'transparent',
                  border: 0,
                  color: mobileTab === key ? cyan : '#94a3b8',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 3,
                  fontSize: 11,
                  fontWeight: 800,
                  cursor: 'pointer',
                  padding: '5px 2px'
                }}
              >
                <span style={{ fontSize: 21 }}>{icon}</span>
                <span>{label}</span>
              </button>
            ))}
          </div>
        )}

        <div ref={bottom} />

        <p
          style={{
            textAlign: 'center',
            color: '#64748b',
            fontSize: 12,
            marginTop: 25,
            marginBottom: isMobile ? 90 : 0
          }}
        >
          ⚠️ Herramienta educativa de análisis. No compra ni vende automáticamente.
        </p>
      </div>
    </main>
  );
}

function Metric({ label, value }) {
  return (
    <div
      style={{
        background: 'rgba(15,23,42,.88)',
        border: '1px solid rgba(148,163,184,.22)',
        borderRadius: 18,
        padding: 16
      }}
    >
      <div style={{ color: '#94a3b8', fontSize: 12 }}>{label}</div>
      <div style={{ fontSize: 27, fontWeight: 900, marginTop: 5 }}>{value}</div>
    </div>
  );
}

function StrategyBadge({ name, subtitle, active = false }) {
  return (
    <div
      style={{
        padding: 12,
        borderRadius: 14,
        background: '#020617',
        border: `1px solid ${active ? '#19e6c2' : '#334155'}`
      }}
    >
      <div style={{ fontWeight: 900 }}>{name}</div>
      <div
        style={{
          color: active ? '#19e6c2' : '#64748b',
          fontSize: 12,
          marginTop: 3
        }}
      >
        {subtitle} · {active ? 'ACTIVA' : 'EN DESARROLLO'}
      </div>
    </div>
  );
}
