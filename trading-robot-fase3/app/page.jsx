'use client';
import {useEffect,useRef,useState} from 'react';

const DEFAULT='SPY,QQQ,NVDA,TSLA,AAPL,META,BAC,PLTR,AMZN';

function cardText(a){
  return `${a.symbol} - ${a.signal}
Precio: ${a.close}
Puntaje: ${a.score}
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
  }catch(e){
   setChat(p=>[...p,{text:'❌ '+e.message}]);
  }finally{setLoading(false)}
 }

 async function scanner(){
  setLoading(true);setAnalysis(null);
  try{
   const r=await fetch('/api/scan?symbols='+encodeURIComponent(watch));
   const d=await r.json();
   if(!r.ok)throw new Error(d.error);
   setScan(d);
   setChat(p=>[...p,{text:`🏆 Mejor activo del scanner: ${d.best?.symbol||'N/A'} — ${d.best?.signal||''}`}]);
  }catch(e){
   setChat(p=>[...p,{text:'❌ '+e.message}]);
  }finally{setLoading(false)}
 }

 async function alertWhatsApp(){
  const a=analysis||scan?.best;if(!a)return;
  const r=await fetch('/api/alert',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:'ALERTA TRADING IA\n'+cardText(a)})});
  const d=await r.json();
  setChat(p=>[...p,{text:d.ok?'📲 Alerta enviada':'⚠️ WhatsApp no configurado: '+d.error}]);
 }

 function Box({children}){return <div style={{background:'rgba(0,35,18,.85)',border:'1px solid #17452b',borderRadius:12,padding:14,margin:'12px 0',lineHeight:1.55}}>{children}</div>}
 function Analysis({a}){return <Box><h2 style={{color:'#00ff50'}}>{a.symbol} — {a.signal}</h2><p><b>Precio:</b> {a.close} | <b>Puntaje:</b> {a.score}</p><p><b>Estado:</b> {a.estado || '⚪ NO OPERAR'}</p><p><b>Entrada CALL:</b> arriba de {a.levels.entryCall} | <b>Entrada PUT:</b> abajo de {a.levels.entryPut}</p><p><b>Stop CALL:</b> {a.levels.stopCall} | <b>Stop PUT:</b> {a.levels.stopPut}</p><p><b>RSI:</b> {a.indicators.rsi} | <b>MACD:</b> {a.indicators.macdHist}</p><p><b>Razones:</b> {a.reasons.join(' · ')}</p><button onClick={alertWhatsApp} style={btn}>MANDAR ALERTA WHATSAPP</button></Box>}

 const btn={background:'#00ff50',color:'#001000',border:0,borderRadius:8,padding:'10px 14px',fontWeight:800,marginTop:8};
 const inp={flex:1,background:'#061109',border:'1px solid #17452b',borderRadius:8,color:'#c8ffd4',padding:12,fontSize:15};

 return <main style={{fontFamily:'monospace',background:'#050d14',minHeight:'100vh',color:'#c8ffd4'}}><div style={{minHeight:'100vh',padding:18}}><div style={{maxWidth:960,margin:'0 auto'}}><h1 style={{color:'#00ff50'}}>TRADING.AI // OPTIONS DESK</h1><Box><b>Modo:</b> <button onClick={()=>setMode('swing')} style={btn}>Swing</button> <button onClick={()=>setMode('intraday')} style={btn}>Intradía</button> <span>Actual: {mode}</span></Box><Box><h3>1) Analizar un solo ticker</h3><div style={{display:'flex',gap:8}}><input value={ticker} onChange={e=>setTicker(e.target.value.toUpperCase())} placeholder='Ej: NVDA, TSLA, SPY...' style={inp}/><button onClick={()=>analyze()} style={btn}>ANALIZAR</button></div></Box><Box><h3>2) Scanner</h3><textarea value={watch} onChange={e=>setWatch(e.target.value.toUpperCase())} style={{...inp,width:'100%',minHeight:58}}/><button onClick={scanner} style={btn}>ESCANEAR Y RANKEAR</button></Box>{loading&&<p>Analizando...</p>}{analysis&&<Analysis a={analysis}/>} {scan&&<Box><h2>Ranking de mejores setups</h2>{scan.results.map((r,i)=>r.error?<p key={r.symbol}>{r.symbol}: sin datos</p>:<div key={r.symbol} style={{borderTop:'1px solid #17452b',padding:'10px 0'}}><b>{i+1}. {r.symbol}</b> — {r.signal} — score {r.score}<br/><b>Estado:</b> {r.estado || '⚪ NO OPERAR'}<br/>Entrada: CALL &gt; {r.levels.entryCall} / PUT &lt; {r.levels.entryPut}<br/>Stop: CALL {r.levels.stopCall} / PUT {r.levels.stopPut}<br/>RSI {r.indicators.rsi} · MACD {r.indicators.macdHist}</div>)}<button onClick={alertWhatsApp} style={btn}>MANDAR MEJOR SETUP A WHATSAPP</button></Box>}{chat.slice(-3).map((m,i)=><Box key={i}>{m.text}</Box>)}<div ref={bottom}/><p style={{textAlign:'center',color:'#5f9970',fontSize:12}}>⚠️ Solo educativo. No compra ni vende automáticamente.</p></div></div></main>
}
