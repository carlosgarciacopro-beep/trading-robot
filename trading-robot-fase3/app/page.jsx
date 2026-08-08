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
  const [mobileTab, setMobileTab] = useState('inicio');
  const [showTechnical, setShowTechnical] = useState(false);

  const [quantSymbol, setQuantSymbol] = useState('QQQ');
  const [backtest, setBacktest] = useState(null);
  const [backtestLoading, setBacktestLoading] = useState(false);

  const bottom = useRef(null);

  const green = '#22c55e';
  const red = '#ef4444';
  const yellow = '#facc15';
  const cyan = '#19e6c2';
  const panel = 'rgba(15,23,42,.88)';

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
    boxSizing: 'border-box'
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
    const check = () => setIsMobile(window.innerWidth <= 768);
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

  function Card({ children, style = {} }) {
    return (
      <div
        style={{
          background: panel,
          border: '1px solid rgba(148,163,184,.22)',
          borderRadius: 22,
          padding: 20,
          boxShadow: '0 20px 50px rgba(0,0,0,.35)',
          ...style
        }}
      >
        {children}
      </div>
    );
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

  function AssetLogo({ symbol, size = 42 }) {
    const domain = ASSET_DOMAINS[String(symbol || '').toUpperCase()];
    const [failed, setFailed] = useState(false);

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
            fontSize: Math.max(10, size * 0.28)
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
        onError={() => setFailed(true)}
        style={{
          borderRadius: '50%',
          objectFit: 'contain',
          background: '#fff',
          padding: 3,
          boxSizing: 'border-box'
        }}
      />
    );
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
    if (a.strategy === 'MRBB') return 'MRBB · Reversión a la media';
    if (a.strategy === 'NCS') return 'NCS · Tendencia y confluencia';
    return 'Sin estrategia válida';
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
              : '245px minmax(0,1fr) 290px',
            gap: 18
          }}
        >
          {!isMobile && (
            <aside style={{ display: 'grid', gap: 14, alignContent: 'start' }}>
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
                      MEJOR SETUP
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
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
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
                        <AssetLogo symbol={best.symbol} size={52} />

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
                            Precio: ${best.currentPrice ?? best.close ?? '-'}
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
                          {strategyName(best)}
                        </div>

                        <p style={{ lineHeight: 1.6, color: '#cbd5e1' }}>
                          {best.plainExplanation ||
                            'Nexora está evaluando la situación del mercado.'}
                        </p>

                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 1fr',
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
                              CONFIANZA TÉCNICA
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
                              PROB. HISTÓRICA
                            </div>
                            <b style={{ fontSize: 16 }}>
                              {formatProb(best.historicalProbability)}
                            </b>
                          </div>
                        </div>

                        <div
                          style={{
                            marginTop: 12,
                            color: best.isActionable ? green : yellow,
                            fontWeight: 900
                          }}
                        >
                          {best.estado || '⚪ NO OPERAR'}
                        </div>
                      </div>
                    </div>

                    <div>
                      <h3 style={{ marginTop: 0 }}>¿Por qué lo detectó?</h3>

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

                      <button
                        onClick={() => setShowTechnical((v) => !v)}
                        style={{ ...secondaryBtn, width: '100%', marginTop: 14 }}
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
                          <div>MACD: {best.indicators?.macdHist ?? '-'}</div>
                          <div>
                            Volumen relativo: {best.indicators?.relativeVolume ?? '-'}x
                          </div>
                          <div>
                            Bollinger inferior: {best.indicators?.bollingerLower ?? '-'}
                          </div>
                          <div>
                            Bollinger media: {best.indicators?.bollingerMiddle ?? '-'}
                          </div>
                          <div>
                            Bollinger superior: {best.indicators?.bollingerUpper ?? '-'}
                          </div>
                          {best.mrbb?.extensionPct > 0 && (
                            <div>
                              Distancia fuera de banda: {best.mrbb.extensionPct}%
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <p style={{ color: '#94a3b8' }}>
                    Analiza un ticker o ejecuta el scanner para comenzar.
                  </p>
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
                        value={ticker}
                        onChange={(e) => {
                          const clean = e.target.value
                            .toUpperCase()
                            .replace(/[^A-Z.\-]/g, '');
                          setTicker(clean);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            if (!loading) analyze(ticker);
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
                            <th>Lectura sencilla</th>
                            <th>Calidad</th>
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

                              <td>{r.error ? 'Sin datos' : strategyName(r)}</td>
                              <td>{r.error ? r.error : humanSignal(r)}</td>
                              <td
                                style={{
                                  color: getQualityColor(r.qualityScore),
                                  fontWeight: 900
                                }}
                              >
                                {r.qualityScore ?? 0}/100
                              </td>
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
                  usuario conozca RSI, MACD o Bollinger. Los detalles técnicos
                  quedan disponibles para quien quiera profundizar.
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
              </Card>
            )}
          </div>

          {!isMobile && (
            <aside style={{ display: 'grid', gap: 14, alignContent: 'start' }}>
              <Card>
                <h3 style={{ marginTop: 0 }}>Estrategias</h3>

                <div style={{ display: 'grid', gap: 10 }}>
                  <StrategyBadge name="MRBB" subtitle="Reversión" active />
                  <StrategyBadge name="NCS" subtitle="Tendencia" active />
                  <StrategyBadge name="Breakout" subtitle="Próximamente" />
                  <StrategyBadge name="Gap Hunter" subtitle="Próximamente" />
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
