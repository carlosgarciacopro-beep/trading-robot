'use client';
import {useEffect,useRef,useState} from 'react';

const DEFAULT='SPY,QQQ,NVDA,TSLA,AAPL,META,BAC,PLTR,AMZN';

function cardText(a){
  return `${a.symbol} - ${a.signal}
Precio: ${a.close}
Puntaje: ${a.score}
Estado: ${a.estado || 'NO OPERAR'}
Entrada CALL arriba de: ${a.levels?.entryCall}
Entrada PUT abajo de: ${a.levels?.entryPut}
Stop CALL: ${a.levels?.stopCall} | Stop PUT: ${a.levels?.stopPut}`;
}

export default function Page(){
 const [ticker,setTicker]=useState('');
 const [watch,setWatch]=useState(DEFAULT);
 const [mode,setMode]=useState('swing');
 const [loading,setLoading]=useState(false);
 const [analysis,setAnalysis]=useState(null);
 const [scan,setScan]=useState(null);
 const [chat,setChat]=useState([]);
 const bottom=useRef(null);

 useEffect(()=>bottom.current?.scrollIntoView({behavior:'smooth'}),[chat,analysis,scan,loading]);

 async function analyze(sym){
  sym=(sym||ticker).trim().toUpperCase();
  if(!sym||loading)return;
  setLoading(true);setTicker('');setScan(null);
  try{
   const r=await fetch('/api/analyze?symbol='+sym+'&mode='+mode);
   const d=await r.json();
   if(!r.ok)throw new Error(d.error);
   setAnalysis(d.analysis);
   setChat(p=>[...p,{text:`✅ Análisis listo para ${sym}. Señal: ${d.analysis.signal}`}]);
  }catch(e){setChat(p=>[...p,{text:'❌ '+e.message}]);}
  finally{setLoading(false)}
 }

 async function scanner(){
  setLoading(true);setAnalysis(null);
  try{
   const r=await fetch('/api/scan?symbols='+encodeURIComponent(watch));
   const d=await r.json();
   if(!r.ok)throw new Error(d.error);
   setScan(d);
   setChat(p=>[...p,{text:`🏆 Mejor activo: ${d.best?.symbol||'N/A'} — ${d.best?.signal||''}`}]);
  }catch(e){setChat(p=>[...p,{text:'❌ '+e.message}]);}
  finally{setLoading(false)}
 }

 async function alertWhatsApp(){
  const a=analysis||scan?.best;if(!a)return;
  const r=await fetch('/api/alert',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:'ALERTA TRADING IA\n'+cardText(a)})});
  const d=await r.json();
  setChat(p=>[...p,{text:d.ok?'📲 Alerta enviada':'⚠️ WhatsApp no configurado: '+d.error}]);
 }

 const green='#22c55e', yellow='#facc15', red='#ef4444', panel='rgba(15,23,42,.82)';
 const btn={background:green,color:'#03150a',border:0,borderRadius:12,padding:'11px 16px',fontWeight:900,cursor:'pointer'};
 const inp={width:'100%',background:'#020617',border:'1px solid #334155',borderRadius:14,color:'#e2e8f0',padding:14,fontSize:15,outline:'none'};

 function statusColor(s){
  if((s||'').includes('ENTRAR'))return green;
  if((s||'').includes('ESPERAR'))return yellow;
  return '#94a3b8';
 }

 function Card({children}){return <div style={{background:panel,border:'1px solid rgba(148,163,184,.22)',borderRadius:22,padding:20,margin:'16px 0',boxShadow:'0 20px 50px rgba(0,0,0,.35)',backdropFilter:'blur(12px)'}}>{children}</div>}

 function Analysis({a}){return <Card><div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'center',flexWrap:'wrap'}}><h2 style={{margin:0,color:green}}>{a.symbol} — {a.signal}</h2><span style={{background:statusColor(a.estado),color:'#020617',padding:'8px 12px',borderRadius:999,fontWeight:900}}>{a.estado || '⚪ NO OPERAR'}</span></div><p><b>Precio:</b> {a.close} | <b>Puntaje:</b> {a.score}</p><p><b>CALL:</b> arriba de {a.levels.entryCall} | <b>PUT:</b> abajo de {a.levels.entryPut}</p><p><b>Stop CALL:</b> {a.levels.stopCall} | <b>Stop PUT:</b> {a.levels.stopPut}</p><p><b>RSI:</b> {a.indicators.rsi} | <b>MACD:</b> {a.indicators.macdHist}</p><p style={{color:'#cbd5e1'}}><b>Razones:</b> {a.reasons.join(' · ')}</p><button onClick={alertWhatsApp} style={btn}>MANDAR ALERTA WHATSAPP</button></Card>}

 return <main style={{fontFamily:'Inter, system-ui, Arial',background:'radial-gradient(circle at top left,#0f766e 0,#020617 35%,#020617 100%)',minHeight:'100vh',color:'#e2e8f0',padding:22}}>
  <div style={{maxWidth:1050,margin:'0 auto'}}>
   <div style={{margin:'18px 0 26px'}}><h1 style={{fontSize:34,margin:0,color:'#ecfeff'}}>Trading Robot IA</h1><p style={{color:'#94a3b8'}}>Scanner de opciones · Swing e intradía · Señales educativas</p></div>

   <Card><b>Modo:</b> <button onClick={()=>setMode('swing')} style={{...btn,opacity:mode==='swing'?1:.45,marginLeft:8}}>Swing</button> <button onClick={()=>setMode('intraday')} style={{...btn,opacity:mode==='intraday'?1:.45,marginLeft:8}}>Intradía</button> <span style={{marginLeft:12,color:'#94a3b8'}}>Actual: {mode}</span></Card>

   <Card><h3>Analizar ticker</h3><div style={{display:'flex',gap:10}}><input value={ticker} onChange={e=>setTicker(e.target.value.toUpperCase())} onKeyDown={e=>{if(e.key==='Enter')analyze()}} placeholder='Ej: NVDA, TSLA, SPY...' style={inp}/><button onClick={()=>analyze()} style={btn}>ANALIZAR</button></div></Card>

   <Card><h3>Scanner</h3><textarea value={watch} onChange={e=>setWatch(e.target.value.toUpperCase())} style={{...inp,minHeight:70}}/><button onClick={scanner} style={{...btn,marginTop:12}}>ESCANEAR Y RANKEAR</button></Card>

   {loading&&<Card>⏳ Analizando...</Card>}
   {analysis&&<Analysis a={analysis}/>}

   {scan&&<Card>
 <h2>🏆 Mejor Setup</h2>

 {scan.best&&<div style={{
   background:'linear-gradient(135deg,rgba(34,197,94,.25),rgba(15,23,42,.9))',
   border:'1px solid rgba(34,197,94,.5)',
   borderRadius:18,
   padding:18,
   marginBottom:18
 }}>
   <h2 style={{margin:'0 0 8px',color:green}}>
    {scan.best.symbol} — {scan.best.signal}
   </h2>
   <p style={{fontSize:18,margin:0}}>
    <b>Estado:</b> {scan.best.estado || '⚪ NO OPERAR'}
   </p>
   <p style={{fontSize:18,margin:'6px 0'}}>
    <b>Confianza IA:</b> {scan.best.confidence || (50 + Math.abs(scan.best.score||0)*10)}%
   </p>
   <p style={{color:'#94a3b8'}}>
    Score {scan.best.score} · RSI {scan.best.indicators?.rsi} · MACD {scan.best.indicators?.macdHist}
   </p>
 </div>}

 <h2>Ranking de mejores setups</h2>

 {scan.results.map((r,i)=>r.error?<p key={r.symbol}>{r.symbol}: sin datos</p>:<div key={r.symbol} style={{
   borderTop:'1px solid #334155',
   padding:'16px 0',
   display:'grid',
   gap:6
 }}>
   <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:10,flexWrap:'wrap'}}>
    <b style={{fontSize:18}}>
     {i===0?'🥇':i===1?'🥈':i===2?'🥉':i+1+'.'} {r.symbol} — {r.signal}
    </b>
    <span style={{
      background:statusColor(r.estado),
      color:'#020617',
      padding:'7px 12px',
      borderRadius:999,
      fontWeight:900
    }}>
     {r.estado || '⚪ NO OPERAR'}
    </span>
   </div>

   <div style={{display:'flex',gap:12,flexWrap:'wrap',color:'#cbd5e1'}}>
    <span><b>Confianza:</b> {r.confidence || (50 + Math.abs(r.score||0)*10)}%</span>
    <span><b>Score:</b> {r.score}</span>
    <span><b>RSI:</b> {r.indicators.rsi}</span>
    <span><b>MACD:</b> {r.indicators.macdHist}</span>
   </div>

   <div>CALL &gt; {r.levels.entryCall} / PUT &lt; {r.levels.entryPut}</div>
   <div style={{color:'#94a3b8'}}>Stop CALL {r.levels.stopCall} / Stop PUT {r.levels.stopPut}</div>
 </div>)}

 <button onClick={alertWhatsApp} style={btn}>MANDAR MEJOR SETUP A WHATSAPP</button>
</Card>}{scan.results.map((r,i)=>r.error?<p key={r.symbol}>{r.symbol}: sin datos</p>:<div key={r.symbol} style={{borderTop:'1px solid #334155',padding:'14px 0'}}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:10,flexWrap:'wrap'}}><b>{i+1}. {r.symbol} — {r.signal}</b><span style={{background:statusColor(r.estado),color:'#020617',padding:'6px 10px',borderRadius:999,fontWeight:900}}>{r.estado || '⚪ NO OPERAR'}</span></div><div style={{color:'#94a3b8'}}>Score {r.score} · RSI {r.indicators.rsi} · MACD {r.indicators.macdHist}</div><div>CALL &gt; {r.levels.entryCall} / PUT &lt; {r.levels.entryPut}</div><div>Stop CALL {r.levels.stopCall} / Stop PUT {r.levels.stopPut}</div></div>)}<button onClick={alertWhatsApp} style={btn}>
  MANDAR MEJOR SETUP A WHATSAPP
</button>

</Card>}

   {chat.slice(-3).map((m,i)=><Card key={i}>{m.text}</Card>)}
   <div ref={bottom}/>
   <p style={{textAlign:'center',color:'#64748b',fontSize:12}}>⚠️ Solo educativo. No compra ni vende automáticamente.</p>
  </div>
 </main>
}
