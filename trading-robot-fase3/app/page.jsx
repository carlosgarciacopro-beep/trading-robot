'use client';
import {useEffect,useRef,useState} from 'react';

const DEFAULT='SPY,QQQ,NVDA,TSLA,AAPL,META,BAC,PLTR,AMZN';

export default function Page(){
 const [ticker,setTicker]=useState('');
 const [watch,setWatch]=useState(DEFAULT);
 const [mode,setMode]=useState('swing');
 const [loading,setLoading]=useState(false);
 const [analysis,setAnalysis]=useState(null);
 const [scan,setScan]=useState(null);
 const [history,setHistory]=useState([]);
 const bottom=useRef(null);
 const [isMobile,setIsMobile]=useState(false);

 useEffect(()=>{
  const check=()=>setIsMobile(window.innerWidth<=768);
  check();
  window.addEventListener('resize',check);
  return()=>window.removeEventListener('resize',check);
 },[]);

 useEffect(()=>{
  const saved=JSON.parse(localStorage.getItem('nexoraHistory') || '[]');
  setHistory(saved);
  validateHistory(saved);
 },[]);

 useEffect(()=>bottom.current?.scrollIntoView({behavior:'smooth'}),[analysis,scan,loading]);

 const green='#22c55e', red='#ef4444', yellow='#facc15';
 const panel='rgba(15,23,42,.86)';

 const btn={
  background:green,color:'#03150a',border:0,borderRadius:12,
  padding:'11px 16px',fontWeight:900,cursor:'pointer'
 };

 const inp={
  width:'100%',background:'#020617',border:'1px solid #334155',
  borderRadius:14,color:'#e2e8f0',padding:14,fontSize:15,outline:'none'
 };

 function Card({children}) {
  return <div style={{
   background:panel,border:'1px solid rgba(148,163,184,.22)',
   borderRadius:22,padding:20,boxShadow:'0 20px 50px rgba(0,0,0,.35)'
  }}>{children}</div>
 }

 function getColor(score){
  if(score>=3)return green;
  if(score<=-3)return red;
  return yellow;
 }

 function getEstado(a){
  if(!a)return 'NO OPERAR';
  if(a.score>=4)return 'CALL FUERTE';
  if(a.score>=2)return 'CALL MODERADO';
  if(a.score<=-4)return 'PUT FUERTE';
  if(a.score<=-2)return 'PUT MODERADO';
  return 'NEUTRAL';
 }

 function confidence(a){
  if(!a)return 50;
  return Math.min(100, Math.max(45, a.confidence || (50 + Math.abs(a.score||0)*10)));
 }

 async function validateHistory(currentHistory){
  if(!currentHistory || currentHistory.length===0)return currentHistory;

  try{
   const r=await fetch('/api/validate',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({signals:currentHistory})
   });

   const d=await r.json();
   if(!r.ok)throw new Error(d.error);

   const validated=d.results || currentHistory;
   localStorage.setItem('nexoraHistory',JSON.stringify(validated));
   setHistory(validated);

   return validated;
  }catch(e){
   console.log('Error validando historial:',e.message);
   return currentHistory;
  }
 }

 async function analyze(sym){
  sym=(sym||ticker).trim().toUpperCase();
  if(!sym||loading)return;
  setLoading(true); 
  setScan(null);

  try{
   const r=await fetch('/api/analyze?symbol='+sym+'&mode='+mode);
   const d=await r.json();
   if(!r.ok)throw new Error(d.error);

   setAnalysis(d.analysis);

   const savedHistory=JSON.parse(localStorage.getItem('nexoraHistory') || '[]');

   const isCall=d.analysis.side==='CALL';
   const isPut=d.analysis.side==='PUT';

   const newSignal={
    date:new Date().toLocaleString(),
    symbol:d.analysis.symbol,
    side:d.analysis.side,
    mode:d.analysis.mode || mode,
    price:d.analysis.close,
    entry:isCall ? d.analysis.levels?.entryCall : isPut ? d.analysis.levels?.entryPut : null,
    stop:isCall ? d.analysis.levels?.stopCall : isPut ? d.analysis.levels?.stopPut : null,
    target1:d.analysis.levels?.target1,
    target2:d.analysis.levels?.target2,
    probability:d.analysis.probability,
    score:d.analysis.score,
    status:'PENDIENTE'
   };

   const updatedHistory=[newSignal,...savedHistory].slice(0,100);

   localStorage.setItem('nexoraHistory',JSON.stringify(updatedHistory));
   setHistory(updatedHistory);
   validateHistory(updatedHistory);

  }catch(e){
   alert('Error: '+e.message)
  }finally{
   setLoading(false)
  }
 }

 async function scanner(){
  setLoading(true); 
  setAnalysis(null);

  try{
   const r=await fetch('/api/scan?symbols='+encodeURIComponent(watch));
   const d=await r.json();
   if(!r.ok)throw new Error(d.error);
   setScan(d);
  }catch(e){
   alert('Error: '+e.message)
  }finally{
   setLoading(false)
  }
 }

 const best = analysis || scan?.best;

 const ganadas=history.filter(h=>h.validationStatus==='GANADA' || h.status==='GANADA').length;
 const perdidas=history.filter(h=>h.validationStatus==='PERDIDA' || h.status==='PERDIDA').length;
 const pendientes=history.filter(h=>h.validationStatus==='PENDIENTE' || h.status==='PENDIENTE').length;
 const efectividad=ganadas+perdidas>0 ? Math.round((ganadas/(ganadas+perdidas))*100) : 0;

 return <main style={{
  fontFamily:'Inter, system-ui, Arial',
  background:'radial-gradient(circle at top left,#0f766e 0,#020617 34%,#020617 100%)',
  minHeight:'100vh',color:'#e2e8f0',padding:20
 }}>
  <div style={{maxWidth:1450,margin:'0 auto'}}>

   <header style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
    <div>
     <h1 style={{margin:0,fontSize:32}}>🤖 TRADING ROBOT IA</h1>
     <p style={{margin:'6px 0',color:'#94a3b8'}}>Análisis técnico automatizado · Swing e intradía</p>
    </div>
    <div style={{textAlign:'right',color:'#94a3b8'}}>
     <div style={{color:green,fontWeight:900}}>● EN LÍNEA</div>
     <div>{new Date().toLocaleTimeString()}</div>
    </div>
   </header>

   <section style={{display:'grid',gridTemplateColumns:isMobile?'1fr':'260px 1fr 300px',gap:18}}>
    
    <aside style={{display:'grid',gap:14,alignContent:'start'}}>
     <Card>
      <h3>Dashboard</h3>
      <p>Scanner</p>
      <p>Análisis</p>
      <p>Alertas</p>
      <p>Watchlist</p>
     </Card>

     <Card>
      <h3>Modo</h3>
      <button onClick={()=>setMode('swing')} style={{...btn,opacity:mode==='swing'?1:.45}}>Swing</button>
      <button onClick={()=>setMode('intraday')} style={{...btn,opacity:mode==='intraday'?1:.45,marginLeft:8}}>Intradía</button>
      <p style={{color:'#94a3b8'}}>Actual: {mode}</p>
     </Card>
    </aside>

    <main style={{display:'grid',gap:18}}>
     
     <Card>
      <h2 style={{marginTop:0}}>MEJOR SETUP</h2>

      {best ? <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr':'1.1fr .6fr .8fr 1.4fr',gap:18,alignItems:'center'}}>
       <div>
        <h1 style={{fontSize:44,margin:'0 0 6px'}}>{best.symbol}</h1>

        <span style={{
         background:getColor(best.score),color:'#020617',
         padding:'8px 12px',borderRadius:10,fontWeight:900
        }}>{getEstado(best)}</span>

        <button style={{
         background:getColor(best.score),
         color:'#020617',
         border:0,
         borderRadius:14,
         padding:'14px 18px',
         fontWeight:900,
         fontSize:16,
         width:'100%',
         margin:'14px 0',
         boxShadow:`0 0 25px ${getColor(best.score)}55`
        }}>
         {best.score > 1 ? '🟢 ENTRAR CALL' : best.score < -1 ? '🔴 ENTRAR PUT' : '🟡 ESPERAR'}
        </button>

        <p style={{color:'#94a3b8',marginTop:15}}>Precio: {best.close}</p>
        <p style={{color:'#94a3b8'}}>Última vela: {best.time}</p>
        <p style={{color:'#94a3b8'}}>Modo análisis: {best.mode || mode}</p>

        <p style={{color:'#22c55e'}}>Entrada CALL: {best.levels?.entryCall}</p>
        <p style={{color:'#ef4444'}}>Entrada PUT: {best.levels?.entryPut}</p>
        <p>Stop CALL: {best.levels?.stopCall}</p>
        <p>Stop PUT: {best.levels?.stopPut}</p>

        <p style={{color:'#22c55e'}}>Target 1: {best.levels?.target1 || '-'}</p>
        <p style={{color:'#22c55e'}}>Target 2: {best.levels?.target2 || '-'}</p>
       </div>

       <div style={{textAlign:'center'}}>
        <div style={{color:'#94a3b8'}}>SCORE</div>
        <div style={{fontSize:58,fontWeight:900,color:getColor(best.score)}}>{best.score}</div>
       </div>

       <div style={{textAlign:'center'}}>
        <div style={{color:'#94a3b8'}}>CONFIANZA IA</div>
        <div style={{
         width:110,height:110,borderRadius:'50%',border:`12px solid ${getColor(best.score)}`,
         display:'grid',placeItems:'center',fontSize:28,fontWeight:900,margin:'8px auto'
        }}>{confidence(best)}%</div>

        <div style={{textAlign:'center',marginTop:10,color:'#22c55e',fontWeight:800,fontSize:18}}>
         Probabilidad: {best?.probability || 0}%
        </div>
       </div>

       <div style={{
        height:220,border:'1px solid #334155',borderRadius:18,
        display:'grid',placeItems:'center',color:'#94a3b8',
        background:'linear-gradient(180deg,rgba(15,23,42,.9),rgba(2,6,23,.9))',
        whiteSpace:'pre-line',textAlign:'center',padding:15
       }}>
{`MULTI-TIMEFRAME

📅 Diario: 🟢 Alcista
🕐 1H: 🟢 Alcista
⏱️ 15M: 🟢 Alcista
⚡ 5M: 🟡 Neutral

Consenso: 75%`}
       </div>
      </div> : <p style={{color:'#94a3b8'}}>Escanea o analiza un ticker para ver el mejor setup.</p>}
     </Card>

     <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr':'1fr 1fr',gap:18}}>
      <Card>
       <h3>Analizar ticker</h3>
       <div style={{display:'flex',gap:10}}>
        <input value={ticker} onChange={e=>setTicker(e.target.value.toUpperCase().replace(/\s/g,''))} placeholder='Ej: NVDA, TSLA, SPY...' style={inp}/>
        <button onClick={()=>analyze(ticker)} style={btn}>ANALIZAR</button>
       </div>
      </Card>

      <Card>
       <h3>Scanner</h3>
       <textarea value={watch} onChange={e=>setWatch(e.target.value.toUpperCase())} style={{...inp,minHeight:70}}/>
       <button onClick={scanner} style={{...btn,marginTop:12}}>ESCANEAR Y RANKEAR</button>
      </Card>
     </div>

     {loading && <Card>⏳ Analizando...</Card>}

     {scan && <Card>
      <h2>RANKING DE MEJORES SETUPS</h2>
      <div style={{overflowX:'auto'}}>
       <table style={{width:'100%',borderCollapse:'collapse'}}>
        <thead>
         <tr style={{color:'#94a3b8',textAlign:'left'}}>
          <th>🏆</th><th>Activo</th><th>Señal</th><th>Entrada</th><th>Target 1</th><th>Target 2</th><th>R/R</th><th>Score</th><th>RSI</th><th>MACD</th><th>Confianza</th><th>Stop</th><th>Estado</th>
         </tr>
        </thead>
        <tbody>
         {scan.results.map((r,i)=>!r.error && <tr key={r.symbol} style={{borderTop:'1px solid #334155'}}>
          <td style={{padding:14}}>{i===0 ? '🥇' : i===1 ? '🥈' : i===2 ? '🥉' : i+1}</td> 
          <td style={{fontWeight:900}}>{r.symbol}</td>
          <td>{r.signal}</td>
          <td>{r.score > 1 ? r.levels?.entryCall : r.score < -1 ? r.levels?.entryPut : '-'}</td>
          <td>{r.levels?.target1 || "-"}</td>
          <td>{r.levels?.target2 || "-"}</td>
          <td>{r.levels?.riskReward || "-"}</td>
          <td style={{fontSize:28,fontWeight:900,color:getColor(r.score)}}>{r.score}</td>
          <td>{r.indicators?.rsi}</td>
          <td>{r.indicators?.macdHist}</td>
          <td>{confidence(r)}%</td>
          <td>{r.score > 1 ? r.levels?.stopCall : r.score < -1 ? r.levels?.stopPut : '-'}</td>
          <td style={{color:getColor(r.score),fontWeight:900}}>{getEstado(r)}</td>
         </tr>)}
        </tbody>
       </table>
      </div>
     </Card>}

     {best && <Card>
      <h2>EXPLICACIÓN IA</h2>
      <p style={{color:'#cbd5e1'}}>
       {best.symbol} obtiene score <b>{best.score}</b> porque el sistema detecta:
       {' '}{best.reasons?.join(' · ') || 'tendencia, momentum, volumen y niveles técnicos relevantes.'}
      </p>
      <p><b>Entrada CALL:</b> arriba de {best.levels?.entryCall} · <b> Entrada PUT:</b> abajo de {best.levels?.entryPut}</p>
      <p><b>Stop CALL:</b> {best.levels?.stopCall} · <b> Stop PUT:</b> {best.levels?.stopPut}</p>
     </Card>}

     <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr':'repeat(4,1fr)',gap:14}}>
      <Card><h3>Próximos Earnings</h3><p>TSLA · NVDA · AAPL</p></Card>
      <Card><h3>Eventos Económicos</h3><p>CPI · PPI · FOMC</p></Card>
      <Card><h3>Noticias</h3><p>Noticias relevantes próximamente.</p></Card>
      <Card>
       <Card>
 <Card>
 <h3>Stats Robot Nexora</h3>

 <p>Señales guardadas: {history.length}</p>
 <p>Ganadas: {ganadas}</p>
 <p>Perdidas: {perdidas}</p>
 <p>Pendientes: {pendientes}</p>
 <p>Efectividad: {efectividad}%</p>

 <button
  onClick={()=>validateHistory(history)}
  style={{
   marginTop:12,
   background:'#22c55e',
   color:'#03150a',
   border:0,
   borderRadius:10,
   padding:'10px 14px',
   fontWeight:900,
   cursor:'pointer',
   width:'100%'
  }}
 >
  VALIDAR HISTORIAL
 </button>

</Card>
     </div>

     <Card>
      <h2>Historial Nexora</h2>
      {history.length===0 ? (
       <p style={{color:'#94a3b8'}}>Todavía no hay señales guardadas.</p>
      ) : (
       <div style={{overflowX:'auto'}}>
        <table style={{width:'100%',borderCollapse:'collapse'}}>
         <thead>
          <tr style={{color:'#94a3b8',textAlign:'left'}}>
           <th>Fecha</th><th>Ticker</th><th>Señal</th><th>Modo</th><th>Entrada</th><th>Stop</th><th>Target</th><th>Probabilidad</th><th>Score</th><th>Estado</th>
          </tr>
         </thead>
         <tbody>
          {history.slice(0,10).map((h,i)=>(
           <tr key={i} style={{borderTop:'1px solid #334155'}}>
            <td style={{padding:10}}>{h.date || h.signalDate}</td>
            <td style={{fontWeight:900}}>{h.symbol}</td>
            <td>{h.side}</td>
            <td>{h.mode}</td>
            <td>{h.entry || h.entryPrice || '-'}</td>
            <td>{h.stop || '-'}</td>
            <td>{h.target1 || h.target || '-'}</td>
            <td>{h.probability}%</td>
            <td style={{fontWeight:900,color:getColor(h.score)}}>{h.score}</td>
            <td>{h.result || h.validationStatus || h.status}</td>
           </tr>
          ))}
         </tbody>
        </table>
       </div>
      )}
     </Card>

    </main>

    <aside style={{display:'grid',gap:14,alignContent:'start'}}>
     <Card>
      <h3>GUÍA DEL SCORE</h3>
      <div style={{display:'flex',flexDirection:'column',gap:10}}>
       <div style={{display:'flex',alignItems:'center',gap:10}}><div style={{width:18,height:18,borderRadius:'50%',background:'#22c55e'}}></div><span>+4 a +5 CALL FUERTE</span></div>
       <div style={{display:'flex',alignItems:'center',gap:10}}><div style={{width:18,height:18,borderRadius:'50%',background:'#84cc16'}}></div><span>+2 a +3 CALL MODERADO</span></div>
       <div style={{display:'flex',alignItems:'center',gap:10}}><div style={{width:18,height:18,borderRadius:'50%',background:'#eab308'}}></div><span>-1 a +1 NEUTRAL</span></div>
       <div style={{display:'flex',alignItems:'center',gap:10}}><div style={{width:18,height:18,borderRadius:'50%',background:'#f97316'}}></div><span>-2 a -3 PUT MODERADO</span></div>
       <div style={{display:'flex',alignItems:'center',gap:10}}><div style={{width:18,height:18,borderRadius:'50%',background:'#ef4444'}}></div><span>-4 a -5 PUT FUERTE</span></div>
      </div>
     </Card>

     <Card>
      <h3>RESUMEN DEL MERCADO</h3>
      <p>SPY 🟢 Alcista</p>
      <p>QQQ 🟢 Alcista</p>
      <p>VIX 🔴 Bajo</p>
      <h3 style={{color:'#22c55e'}}>Sesgo: CALLS</h3>
     </Card>
    </aside>
   </section>

   <div ref={bottom}/>
   <p style={{textAlign:'center',color:'#64748b',fontSize:12,marginTop:25}}>
    ⚠️ Solo educativo. No compra ni vende automáticamente.
   </p>
  </div>
 </main>
}
