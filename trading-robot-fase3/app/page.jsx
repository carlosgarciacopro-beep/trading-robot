'use client';

import { useEffect, useRef, useState } from 'react';

const DEFAULT = 'SPY,QQQ,NVDA,TSLA,AAPL,META,BAC,PLTR,AMZN';

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
  const [currentTime, setCurrentTime] = useState('');

  const bottom = useRef(null);

  const green = '#22c55e';
  const red = '#ef4444';
  const yellow = '#facc15';
  const panel = 'rgba(15,23,42,.86)';

  const btn = {
    background: green,
    color: '#03150a',
    border: 0,
    borderRadius: 12,
    padding: '11px 16px',
    fontWeight: 900,
    cursor: 'pointer'
  };

  const inp = {
    width: '100%',
    background: '#020617',
    border: '1px solid #334155',
    borderRadius: 14,
    color: '#e2e8f0',
    padding: 14,
    fontSize: 15,
    outline: 'none',
    boxSizing: 'border-box'
  };

  useEffect(() => {
    const updateTime = () => {
      try {
        setCurrentTime(
          new Date().toLocaleTimeString('en-US', {
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
      if (typeof window !== 'undefined') {
        setIsMobile(window.innerWidth <= 768);
      }
    };

    check();

    window.addEventListener('resize', check);

    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('nexoraHistory');

      if (!saved) {
        setHistory([]);
        return;
      }

      const parsed = JSON.parse(saved);

      setHistory(Array.isArray(parsed) ? parsed : []);
    } catch (error) {
      console.log('Error cargando historial:', error);
      setHistory([]);
    }
  }, []);

  useEffect(() => {
    if (bottom.current) {
      bottom.current.scrollIntoView({
        behavior: 'smooth',
        block: 'end'
      });
    }
  }, [analysis, scan]);

  function Card({ children }) {
    return (
      <div
        style={{
          background: panel,
          border: '1px solid rgba(148,163,184,.22)',
          borderRadius: 22,
          padding: 20,
          boxShadow: '0 20px 50px rgba(0,0,0,.35)'
        }}
      >
        {children}
      </div>
    );
  }

  function getColor(score) {
    const value = Number(score || 0);

    if (value >= 3) return green;
    if (value <= -3) return red;

    return yellow;
  }

  function getEstado(a) {
    if (!a) return 'NO OPERAR';

    const score = Number(a.score || 0);

    if (score >= 4) return 'CALL FUERTE';
    if (score >= 2) return 'CALL MODERADO';
    if (score <= -4) return 'PUT FUERTE';
    if (score <= -2) return 'PUT MODERADO';

    return 'NEUTRAL';
  }

  function getSideFromScore(score) {
    const value = Number(score || 0);

    if (value >= 2) return 'CALL';
    if (value <= -2) return 'PUT';

    return 'NEUTRAL';
  }

  function confidence(a) {
    if (!a) return 50;

    const direct = Number(a.confidence);

    if (Number.isFinite(direct) && direct > 0) {
      return Math.min(100, Math.max(0, Math.round(direct)));
    }

    const score = Number(a.score || 0);

    return Math.min(100, Math.max(45, 50 + Math.abs(score) * 10));
  }

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

  async function validateHistory(currentHistory = history) {
    if (!Array.isArray(currentHistory) || currentHistory.length === 0) {
      alert('Todavía no hay señales para validar.');
      return;
    }

    try {
      setLoading(true);
      setLoadingStep('Validando historial...');
      setProgress(50);

      const response = await fetch('/api/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          signals: currentHistory
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || 'Error validando historial');
      }

      const validated = Array.isArray(data?.results)
        ? data.results
        : currentHistory;

      saveHistory(validated);

      setProgress(100);
      setLoadingStep('Historial validado');
    } catch (error) {
      console.log('Error validando historial:', error);

      alert(
        'Error validando historial: ' +
          (error?.message || 'Error desconocido')
      );
    } finally {
      setTimeout(() => {
        setLoading(false);
        setProgress(0);
        setLoadingStep('');
      }, 500);
    }
  }

  async function analyze(symbolInput) {
    const sym = String(symbolInput || ticker)
      .trim()
      .toUpperCase();

    if (!sym || loading) return;

    setLoading(true);
    setProgress(20);
    setLoadingStep('Conectando con datos del mercado...');
    setScan(null);

    try {
      const response = await fetch(
        '/api/analyze?symbol=' +
          encodeURIComponent(sym) +
          '&mode=' +
          encodeURIComponent(mode)
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || 'Error en análisis');
      }

      const raw = data?.analysis || data || {};

      const safeAnalysis = {
        ...raw,

        symbol: raw?.symbol || sym,

        score: safeNumber(raw?.score, 0),

        close: safeNumber(
          raw?.close ??
            raw?.price ??
            raw?.currentPrice,
          0
        ),

        probability: safeNumber(
          raw?.probability ??
            raw?.bearishProbability,
          0
        ),

        confidence: safeNumber(
          raw?.confidence,
          50
        ),

        reasons: Array.isArray(raw?.reasons)
          ? raw.reasons
          : [],

        levels:
          raw?.levels &&
          typeof raw.levels === 'object'
            ? raw.levels
            : {},

        indicators:
          raw?.indicators &&
          typeof raw.indicators === 'object'
            ? raw.indicators
            : {},

        mode: raw?.mode || mode,

        time:
          raw?.time ||
          raw?.lastUpdate ||
          raw?.lastCandle ||
          '-'
      };

      setAnalysis(safeAnalysis);

      setProgress(80);
      setLoadingStep('Guardando señal...');

      let savedHistory = [];

      try {
        const saved = localStorage.getItem('nexoraHistory');

        savedHistory = saved
          ? JSON.parse(saved)
          : [];

        if (!Array.isArray(savedHistory)) {
          savedHistory = [];
        }
      } catch {
        savedHistory = [];
      }

      const score = safeNumber(
        safeAnalysis.score,
        0
      );

      const side = getSideFromScore(score);

      const isCall = side === 'CALL';
      const isPut = side === 'PUT';

      const levels = safeAnalysis.levels || {};

      const newSignal = {
        id:
          Date.now().toString() +
          '-' +
          safeAnalysis.symbol,

        date: new Date().toLocaleString(),

        createdAt: new Date().toISOString(),

        symbol: safeAnalysis.symbol,

        side,

        mode: safeAnalysis.mode,

        price: safeAnalysis.close,

        close: safeAnalysis.close,

        currentPrice: safeAnalysis.close,

        entry: isCall
          ? levels.entryCall ?? null
          : isPut
          ? levels.entryPut ?? null
          : null,

        entryPrice: isCall
          ? levels.entryCall ?? null
          : isPut
          ? levels.entryPut ?? null
          : null,

        stop: isCall
          ? levels.stopCall ?? null
          : isPut
          ? levels.stopPut ?? null
          : null,

        target1:
          levels.target1 ?? null,

        target:
          levels.target1 ?? null,

        target2:
          levels.target2 ?? null,

        probability:
          safeAnalysis.probability,

        score:
          safeAnalysis.score,

        status: 'PENDIENTE',

        validationStatus:
          'PENDIENTE',

        result:
          '⏳ PENDIENTE'
      };

      const updatedHistory = [
        newSignal,
        ...savedHistory
      ].slice(0, 100);

      saveHistory(updatedHistory);

      setProgress(100);
      setLoadingStep('Análisis completado');
    } catch (error) {
      console.log('Error análisis:', error);

      alert(
        'Error: ' +
          (error?.message ||
            'No se pudo analizar el activo')
      );
    } finally {
      setTimeout(() => {
        setLoading(false);
        setProgress(0);
        setLoadingStep('');
      }, 500);
    }
  }

  async function scanner() {
    if (loading) return;

    const cleanWatch = String(watch || '')
      .split(',')
      .map((item) =>
        item.trim().toUpperCase()
      )
      .filter(Boolean)
      .join(',');

    if (!cleanWatch) {
      alert(
        'Agrega al menos un ticker al scanner.'
      );
      return;
    }

    setLoading(true);
    setProgress(20);
    setLoadingStep(
      'Escaneando activos...'
    );
    setAnalysis(null);
    setScan(null);

    try {
      const response = await fetch(
        '/api/scan?symbols=' +
          encodeURIComponent(cleanWatch) +
          '&mode=' +
          encodeURIComponent(mode)
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error || 'Error en scanner'
        );
      }

      const results = Array.isArray(
        data?.results
      )
        ? data.results
        : [];

      let best = data?.best || null;

      if (!best && results.length > 0) {
        best =
          results.find((item) => !item?.error) ||
          null;
      }

      setScan({
        ...data,
        results,
        best
      });

      setProgress(100);
      setLoadingStep(
        'Scanner completado'
      );
    } catch (error) {
      console.log('Error scanner:', error);

      alert(
        'Error: ' +
          (error?.message ||
            'No se pudo ejecutar el scanner')
      );
    } finally {
      setTimeout(() => {
        setLoading(false);
        setProgress(0);
        setLoadingStep('');
      }, 500);
    }
  }

  const best =
    analysis || scan?.best || null;

  const safeHistory =
    Array.isArray(history)
      ? history
      : [];

  const ganadas = safeHistory.filter(
    (h) =>
      h?.validationStatus === 'GANADA'
  ).length;

  const perdidas = safeHistory.filter(
    (h) =>
      h?.validationStatus === 'PERDIDA'
  ).length;

  const pendientes = safeHistory.filter(
    (h) =>
      !h?.validationStatus ||
      h?.validationStatus === 'PENDIENTE'
  ).length;

  const direccion = safeHistory.filter(
    (h) =>
      h?.validationStatus ===
      'ACERTO_DIRECCION'
  ).length;

  const efectividad =
    ganadas + perdidas > 0
      ? Math.round(
          (ganadas /
            (ganadas + perdidas)) *
            100
        )
      : 0;

  const precision =
    ganadas + perdidas + direccion > 0
      ? Math.round(
          ((ganadas + direccion) /
            (ganadas +
              perdidas +
              direccion)) *
            100
        )
      : 0;

  const bearishProbability = best
    ? Math.min(
        100,
        Math.max(
          0,
          safeNumber(
            best.probability,
            0
          )
        )
      )
    : 0;

  const bullishProbability =
    100 - bearishProbability;

  const scanResults =
    Array.isArray(scan?.results)
      ? scan.results
      : [];

  return (
    <main
      style={{
        fontFamily:
          'Inter, system-ui, Arial',
        background:
          'radial-gradient(circle at top left,#0f766e 0,#020617 34%,#020617 100%)',
        minHeight: '100vh',
        color: '#e2e8f0',
        padding: 20
      }}
    >
      <div
        style={{
          maxWidth: 1450,
          margin: '0 auto'
        }}
      >
        <header
          style={{
            display: 'flex',
            justifyContent:
              'space-between',
            alignItems: 'center',
            gap: 15,
            marginBottom: 20,
            flexWrap: 'wrap'
          }}
        >
          <div>
            <h1
              style={{
                margin: 0,
                fontSize: isMobile
                  ? 25
                  : 32
              }}
            >
              🤖 TRADING ROBOT IA
            </h1>

            <p
              style={{
                margin: '6px 0',
                color: '#94a3b8'
              }}
            >
              Análisis técnico automatizado
              · Swing e intradía
            </p>
          </div>

          <div
            style={{
              textAlign: 'right',
              color: '#94a3b8'
            }}
          >
            <div
              style={{
                color: green,
                fontWeight: 900
              }}
            >
              ● EN LÍNEA
            </div>

            <div>
              {currentTime || '--:--:--'}
            </div>
          </div>
        </header>

        <section
          style={{
            display: 'grid',
            gridTemplateColumns:
              isMobile
                ? '1fr'
                : '260px minmax(0,1fr) 300px',
            gap: 18
          }}
        >
          <aside
            style={{
              display: 'grid',
              gap: 14,
              alignContent: 'start'
            }}
          >
            <Card>
              <h3>Dashboard</h3>
              <p>Scanner</p>
              <p>Análisis</p>
              <p>Alertas</p>
              <p>Watchlist</p>
            </Card>

            <Card>
              <h3>Modo</h3>

              <div
                style={{
                  display: 'flex',
                  gap: 8,
                  flexWrap: 'wrap'
                }}
              >
                <button
                  onClick={() =>
                    setMode('swing')
                  }
                  style={{
                    ...btn,
                    opacity:
                      mode === 'swing'
                        ? 1
                        : 0.45
                  }}
                >
                  Swing
                </button>

                <button
                  onClick={() =>
                    setMode('intraday')
                  }
                  style={{
                    ...btn,
                    opacity:
                      mode ===
                      'intraday'
                        ? 1
                        : 0.45
                  }}
                >
                  Intradía
                </button>
              </div>

              <p
                style={{
                  color: '#94a3b8'
                }}
              >
                Actual: {mode}
              </p>
            </Card>
          </aside>

          <div
            style={{
              display: 'grid',
              gap: 18,
              minWidth: 0
            }}
          >
            <Card>
              <h2
                style={{
                  marginTop: 0
                }}
              >
                MEJOR SETUP
              </h2>

              {best ? (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns:
                      isMobile
                        ? '1fr'
                        : '1.1fr .6fr .8fr 1.4fr',
                    gap: 18,
                    alignItems: 'center'
                  }}
                >
                  <div>
                    <h1
                      style={{
                        fontSize: 44,
                        margin: '0 0 10px'
                      }}
                    >
                      {best.symbol || '-'}
                    </h1>

                    <span
                      style={{
                        background:
                          getColor(best.score),
                        color: '#020617',
                        padding:
                          '8px 12px',
                        borderRadius: 10,
                        fontWeight: 900,
                        display:
                          'inline-block'
                      }}
                    >
                      {getEstado(best)}
                    </span>

                    <button
                      style={{
                        background:
                          getColor(best.score),
                        color: '#020617',
                        border: 0,
                        borderRadius: 14,
                        padding:
                          '14px 18px',
                        fontWeight: 900,
                        fontSize: 16,
                        width: '100%',
                        margin: '14px 0'
                      }}
                    >
                      {safeNumber(
                        best.score,
                        0
                      ) > 1
                        ? '🟢 ENTRAR CALL'
                        : safeNumber(
                            best.score,
                            0
                          ) < -1
                        ? '🔴 ENTRAR PUT'
                        : '🟡 ESPERAR'}
                    </button>

                    <p
                      style={{
                        color: '#94a3b8'
                      }}
                    >
                      Precio:{' '}
                      {best.close ?? '-'}
                    </p>

                    <p
                      style={{
                        color: '#94a3b8'
                      }}
                    >
                      Última vela:{' '}
                      {best.time || '-'}
                    </p>

                    <p
                      style={{
                        color: '#94a3b8'
                      }}
                    >
                      Modo análisis:{' '}
                      {best.mode || mode}
                    </p>

                    <p
                      style={{
                        color: green
                      }}
                    >
                      Entrada CALL:{' '}
                      {best.levels
                        ?.entryCall ?? '-'}
                    </p>

                    <p
                      style={{
                        color: red
                      }}
                    >
                      Entrada PUT:{' '}
                      {best.levels
                        ?.entryPut ?? '-'}
                    </p>

                    <p>
                      Stop CALL:{' '}
                      {best.levels
                        ?.stopCall ?? '-'}
                    </p>

                    <p>
                      Stop PUT:{' '}
                      {best.levels
                        ?.stopPut ?? '-'}
                    </p>

                    <p
                      style={{
                        color: green
                      }}
                    >
                      Target 1:{' '}
                      {best.levels
                        ?.target1 ?? '-'}
                    </p>

                    <p
                      style={{
                        color: green
                      }}
                    >
                      Target 2:{' '}
                      {best.levels
                        ?.target2 ?? '-'}
                    </p>
                  </div>

                  <div
                    style={{
                      textAlign: 'center'
                    }}
                  >
                    <div
                      style={{
                        color: '#94a3b8'
                      }}
                    >
                      SCORE
                    </div>

                    <div
                      style={{
                        fontSize: 58,
                        fontWeight: 900,
                        color:
                          getColor(best.score)
                      }}
                    >
                      {safeNumber(
                        best.score,
                        0
                      )}
                    </div>
                  </div>

                  <div
                    style={{
                      textAlign: 'center'
                    }}
                  >
                    <div
                      style={{
                        color: '#94a3b8'
                      }}
                    >
                      CONFIANZA IA
                    </div>

                    <div
                      style={{
                        width: 110,
                        height: 110,
                        borderRadius:
                          '50%',
                        border:
                          `12px solid ${getColor(
                            best.score
                          )}`,
                        display: 'grid',
                        placeItems:
                          'center',
                        fontSize: 28,
                        fontWeight: 900,
                        margin:
                          '8px auto',
                        boxSizing:
                          'border-box'
                      }}
                    >
                      {confidence(best)}%
                    </div>

                    <div
                      style={{
                        marginTop: 10
                      }}
                    >
                      <div
                        style={{
                          color: red,
                          fontWeight: 900,
                          fontSize: 17
                        }}
                      >
                        Probabilidad
                        Bajista:{' '}
                        {
                          bearishProbability
                        }
                        %
                      </div>

                      <div
                        style={{
                          color: green,
                          fontWeight: 900,
                          fontSize: 17,
                          marginTop: 4
                        }}
                      >
                        Probabilidad
                        Alcista:{' '}
                        {
                          bullishProbability
                        }
                        %
                      </div>
                    </div>

                    <div
                      style={{
                        width: '100%',
                        maxWidth: 220,
                        height: 14,
                        background:
                          '#1e293b',
                        borderRadius: 999,
                        margin:
                          '12px auto',
                        overflow: 'hidden'
                      }}
                    >
                      <div
                        style={{
                          width:
                            `${bearishProbability}%`,
                          height: '100%',
                          background: red,
                          borderRadius:
                            999,
                          transition:
                            'all .4s'
                        }}
                      />
                    </div>
                  </div>

                  <div
                    style={{
                      minHeight: 220,
                      border:
                        '1px solid #334155',
                      borderRadius: 18,
                      display: 'grid',
                      placeItems:
                        'center',
                      color: '#94a3b8',
                      background:
                        'linear-gradient(180deg,rgba(15,23,42,.9),rgba(2,6,23,.9))',
                      whiteSpace:
                        'pre-line',
                      textAlign: 'center',
                      padding: 15
                    }}
                  >
                    {`MULTI-TIMEFRAME

📅 Diario: ${
                      best.multiTimeframe
                        ?.daily ||
                      'Pendiente'
                    }

🕐 1H: ${
                      best.multiTimeframe
                        ?.h1 ||
                      'Pendiente'
                    }

⏱️ 15M: ${
                      best.multiTimeframe
                        ?.m15 ||
                      'Pendiente'
                    }

⚡ 5M: ${
                      best.multiTimeframe
                        ?.m5 ||
                      'Pendiente'
                    }`}
                  </div>
                </div>
              ) : (
                <p
                  style={{
                    color: '#94a3b8'
                  }}
                >
                  Escanea o analiza un
                  ticker para ver el mejor
                  setup.
                </p>
              )}
            </Card>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns:
                  isMobile
                    ? '1fr'
                    : '1fr 1fr',
                gap: 18
              }}
            >
              <Card>
                <h3>
                  Analizar ticker
                </h3>

                <div
                  style={{
                    display: 'flex',
                    gap: 10,
                    flexDirection:
                      isMobile
                        ? 'column'
                        : 'row'
                  }}
                >
                  <input
                    value={ticker}
                    onChange={(e) =>
                      setTicker(
                        e.target.value.toUpperCase()
                      )
                    }
                    onKeyDown={(e) => {
                      if (
                        e.key ===
                        'Enter'
                      ) {
                        analyze(ticker);
                      }
                    }}
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="characters"
                    spellCheck={false}
                    placeholder="Ej: NVDA, TSLA, SPY..."
                    style={inp}
                  />

                  <button
                    onClick={() =>
                      analyze(ticker)
                    }
                    disabled={loading}
                    style={{
                      ...btn,
                      opacity: loading
                        ? 0.5
                        : 1
                    }}
                  >
                    ANALIZAR
                  </button>
                </div>
              </Card>

              <Card>
                <h3>Scanner</h3>

                <textarea
                  value={watch}
                  onChange={(e) =>
                    setWatch(
                      e.target.value.toUpperCase()
                    )
                  }
                  style={{
                    ...inp,
                    minHeight: 70,
                    resize: 'vertical'
                  }}
                />

                <button
                  onClick={scanner}
                  disabled={loading}
                  style={{
                    ...btn,
                    marginTop: 12,
                    width: '100%',
                    opacity: loading
                      ? 0.5
                      : 1
                  }}
                >
                  ESCANEAR Y RANKEAR
                </button>
              </Card>
            </div>

            {loading && (
              <Card>
                <h3>🤖 IA Nexora</h3>

                <div
                  style={{
                    fontSize: 18,
                    fontWeight: 800,
                    color: green,
                    marginBottom: 10
                  }}
                >
                  {loadingStep ||
                    'Analizando mercado...'}
                </div>

                <div
                  style={{
                    height: 16,
                    background:
                      '#23314a',
                    borderRadius: 10,
                    overflow: 'hidden'
                  }}
                >
                  <div
                    style={{
                      width:
                        `${Math.max(
                          progress,
                          15
                        )}%`,
                      height: '100%',
                      background:
                        'linear-gradient(90deg,#38ef7d,#00c853)',
                      transition:
                        'width .3s'
                    }}
                  />
                </div>

                <p
                  style={{
                    marginTop: 10,
                    color: '#94a3b8'
                  }}
                >
                  Calculando EMA • RSI •
                  MACD • Volumen • Tendencia
                </p>
              </Card>
            )}

            {scan && (
              <Card>
                <h2>
                  RANKING DE MEJORES SETUPS
                </h2>

                {scanResults.length ===
                0 ? (
                  <p
                    style={{
                      color: '#94a3b8'
                    }}
                  >
                    El scanner no devolvió
                    resultados.
                  </p>
                ) : (
                  <div
                    style={{
                      overflowX:
                        'auto'
                    }}
                  >
                    <table
                      style={{
                        width: '100%',
                        borderCollapse:
                          'collapse',
                        minWidth: 1050
                      }}
                    >
                      <thead>
                        <tr
                          style={{
                            color:
                              '#94a3b8',
                            textAlign:
                              'left'
                          }}
                        >
                          <th>🏆</th>
                          <th>Activo</th>
                          <th>Señal</th>
                          <th>Entrada</th>
                          <th>Target 1</th>
                          <th>Target 2</th>
                          <th>R/R</th>
                          <th>Score</th>
                          <th>RSI</th>
                          <th>MACD</th>
                          <th>
                            Confianza
                          </th>
                          <th>Stop</th>
                          <th>Estado</th>
                        </tr>
                      </thead>

                      <tbody>
                        {scanResults.map(
                          (r, i) => {
                            if (
                              !r ||
                              r.error
                            ) {
                              return null;
                            }

                            const score =
                              safeNumber(
                                r.score,
                                0
                              );

                            return (
                              <tr
                                key={`${r.symbol || 'item'}-${i}`}
                                style={{
                                  borderTop:
                                    '1px solid #334155'
                                }}
                              >
                                <td
                                  style={{
                                    padding:
                                      14
                                  }}
                                >
                                  {i === 0
                                    ? '🥇'
                                    : i ===
                                      1
                                    ? '🥈'
                                    : i ===
                                      2
                                    ? '🥉'
                                    : i +
                                      1}
                                </td>

                                <td
                                  style={{
                                    fontWeight:
                                      900
                                  }}
                                >
                                  {r.symbol ||
                                    '-'}
                                </td>

                                <td>
                                  {r.signal ||
                                    getSideFromScore(
                                      score
                                    )}
                                </td>

                                <td>
                                  {score >
                                  1
                                    ? r
                                        .levels
                                        ?.entryCall ??
                                      '-'
                                    : score <
                                      -1
                                    ? r
                                        .levels
                                        ?.entryPut ??
                                      '-'
                                    : '-'}
                                </td>

                                <td>
                                  {r.levels
                                    ?.target1 ??
                                    '-'}
                                </td>

                                <td>
                                  {r.levels
                                    ?.target2 ??
                                    '-'}
                                </td>

                                <td>
                                  {r.levels
                                    ?.riskReward ??
                                    '-'}
                                </td>

                                <td
                                  style={{
                                    fontSize:
                                      28,
                                    fontWeight:
                                      900,
                                    color:
                                      getColor(
                                        score
                                      )
                                  }}
                                >
                                  {
                                    score
                                  }
                                </td>

                                <td>
                                  {r.indicators
                                    ?.rsi ??
                                    '-'}
                                </td>

                                <td>
                                  {r.indicators
                                    ?.macdHist ??
                                    '-'}
                                </td>

                                <td>
                                  {confidence(
                                    r
                                  )}
                                  %
                                </td>

                                <td>
                                  {score >
                                  1
                                    ? r
                                        .levels
                                        ?.stopCall ??
                                      '-'
                                    : score <
                                      -1
                                    ? r
                                        .levels
                                        ?.stopPut ??
                                      '-'
                                    : '-'}
                                </td>

                                <td
                                  style={{
                                    color:
                                      getColor(
                                        score
                                      ),
                                    fontWeight:
                                      900
                                  }}
                                >
                                  {getEstado(
                                    r
                                  )}
                                </td>
                              </tr>
                            );
                          }
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            )}

            {best && (
              <Card>
                <h2>EXPLICACIÓN IA</h2>

                <p
                  style={{
                    color: '#cbd5e1',
                    lineHeight: 1.6
                  }}
                >
                  {best.symbol || 'El activo'}{' '}
                  obtiene score{' '}
                  <b>
                    {safeNumber(
                      best.score,
                      0
                    )}
                  </b>{' '}
                  porque el sistema
                  detecta:{' '}
                  {Array.isArray(
                    best.reasons
                  ) &&
                  best.reasons.length >
                    0
                    ? best.reasons.join(
                        ' · '
                      )
                    : 'tendencia, momentum, volumen y niveles técnicos relevantes.'}
                </p>

                <p>
                  <b>Entrada CALL:</b>{' '}
                  arriba de{' '}
                  {best.levels
                    ?.entryCall ?? '-'}
                </p>

                <p>
                  <b>Entrada PUT:</b>{' '}
                  abajo de{' '}
                  {best.levels
                    ?.entryPut ?? '-'}
                </p>

                <p>
                  <b>Stop CALL:</b>{' '}
                  {best.levels
                    ?.stopCall ?? '-'}
                </p>

                <p>
                  <b>Stop PUT:</b>{' '}
                  {best.levels
                    ?.stopPut ?? '-'}
                </p>
              </Card>
            )}

            <div
              style={{
                display: 'grid',
                gridTemplateColumns:
                  isMobile
                    ? '1fr'
                    : 'repeat(4,1fr)',
                gap: 14
              }}
            >
              <Card>
                <h3>
                  Próximos Earnings
                </h3>
                <p>
                  Próximamente
                </p>
              </Card>

              <Card>
                <h3>
                  Eventos Económicos
                </h3>
                <p>
                  CPI · PPI · FOMC
                </p>
              </Card>

              <Card>
                <h3>Noticias</h3>
                <p>
                  Noticias relevantes
                  próximamente.
                </p>
              </Card>

              <Card>
                <h3>
                  Stats Robot Nexora ✅
                </h3>

                <p>
                  Señales:{' '}
                  {safeHistory.length}
                </p>

                <p>
                  Ganadas: {ganadas}
                </p>

                <p>
                  Perdidas: {perdidas}
                </p>

                <p>
                  Pendientes:{' '}
                  {pendientes}
                </p>

                <p>
                  Acertó dirección:{' '}
                  {direccion}
                </p>

                <p>
                  Efectividad:{' '}
                  {efectividad}%
                </p>

                <p>
                  Precisión:{' '}
                  {precision}%
                </p>

                <button
                  onClick={() =>
                    validateHistory(
                      safeHistory
                    )
                  }
                  disabled={loading}
                  style={{
                    ...btn,
                    width: '100%',
                    marginTop: 12,
                    opacity: loading
                      ? 0.5
                      : 1
                  }}
                >
                  VALIDAR HISTORIAL
                </button>
              </Card>
            </div>

            <Card>
              <h2>
                Historial Nexora
              </h2>

              {safeHistory.length ===
              0 ? (
                <p
                  style={{
                    color: '#94a3b8'
                  }}
                >
                  Todavía no hay señales
                  guardadas.
                </p>
              ) : (
                <div
                  style={{
                    overflowX: 'auto'
                  }}
                >
                  <table
                    style={{
                      width: '100%',
                      borderCollapse:
                        'collapse',
                      minWidth: 900
                    }}
                  >
                    <thead>
                      <tr
                        style={{
                          color:
                            '#94a3b8',
                          textAlign:
                            'left'
                        }}
                      >
                        <th>Fecha</th>
                        <th>Ticker</th>
                        <th>Señal</th>
                        <th>Modo</th>
                        <th>Entrada</th>
                        <th>Stop</th>
                        <th>Target</th>
                        <th>
                          Probabilidad
                        </th>
                        <th>Score</th>
                        <th>Estado</th>
                      </tr>
                    </thead>

                    <tbody>
                      {safeHistory
                        .slice(0, 10)
                        .map((h, i) => (
                          <tr
                            key={
                              h.id ||
                              `${h.symbol || 'signal'}-${i}`
                            }
                            style={{
                              borderTop:
                                '1px solid #334155'
                            }}
                          >
                            <td
                              style={{
                                padding:
                                  10
                              }}
                            >
                              {h.date ||
                                h.signalDate ||
                                '-'}
                            </td>

                            <td
                              style={{
                                fontWeight:
                                  900
                              }}
                            >
                              {h.symbol ||
                                '-'}
                            </td>

                            <td>
                              {h.side ||
                                '-'}
                            </td>

                            <td>
                              {h.mode ||
                                '-'}
                            </td>

                            <td>
                              {h.entry ??
                                h.entryPrice ??
                                '-'}
                            </td>

                            <td>
                              {h.stop ??
                                '-'}
                            </td>

                            <td>
                              {h.target1 ??
                                h.target ??
                                '-'}
                            </td>

                            <td>
                              {h.probability !==
                              undefined
                                ? `${h.probability}%`
                                : '-'}
                            </td>

                            <td
                              style={{
                                fontWeight:
                                  900,
                                color:
                                  getColor(
                                    h.score
                                  )
                              }}
                            >
                              {safeNumber(
                                h.score,
                                0
                              )}
                            </td>

                            <td>
                              {h.result ||
                                h.validationStatus ||
                                h.status ||
                                '-'}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>

          <aside
            style={{
              display: 'grid',
              gap: 14,
              alignContent: 'start'
            }}
          >
            <Card>
              <h3>GUÍA DEL SCORE</h3>

              <div
                style={{
                  display: 'flex',
                  flexDirection:
                    'column',
                  gap: 10
                }}
              >
                <div>
                  🟢 +4 a +5 CALL FUERTE
                </div>

                <div>
                  🟢 +2 a +3 CALL
                  MODERADO
                </div>

                <div>
                  🟡 -1 a +1 NEUTRAL
                </div>

                <div>
                  🟠 -2 a -3 PUT
                  MODERADO
                </div>

                <div>
                  🔴 -4 a -5 PUT FUERTE
                </div>
              </div>
            </Card>

            <Card>
              <h3>
                RESUMEN DEL MERCADO
              </h3>

              <p>
                El resumen automático del
                mercado se conectará
                posteriormente.
              </p>

              <p
                style={{
                  color: '#94a3b8'
                }}
              >
                El sistema no mostrará un
                sesgo falso cuando todavía
                no existan datos reales.
              </p>
            </Card>
          </aside>
        </section>

        <div ref={bottom} />

        <p
          style={{
            textAlign: 'center',
            color: '#64748b',
            fontSize: 12,
            marginTop: 25
          }}
        >
          ⚠️ Solo educativo. No compra ni
          vende automáticamente.
        </p>
      </div>
    </main>
  );
}
