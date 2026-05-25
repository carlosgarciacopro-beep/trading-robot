export async function POST(req){
  try{
    const {message}=await req.json();
    const sid=process.env.TWILIO_ACCOUNT_SID, token=process.env.TWILIO_AUTH_TOKEN, from=process.env.TWILIO_WHATSAPP_FROM, to=process.env.MY_WHATSAPP_TO;
    if(!sid||!token||!from||!to) return Response.json({ok:false,error:'Faltan variables de WhatsApp/Twilio. La app funciona sin alertas.'},{status:400});
    const body=new URLSearchParams({From:from,To:to,Body:message});
    const r=await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,{method:'POST',headers:{Authorization:'Basic '+Buffer.from(`${sid}:${token}`).toString('base64'),'Content-Type':'application/x-www-form-urlencoded'},body});
    const data=await r.json();
    if(!r.ok) return Response.json({ok:false,error:data.message||'Error enviando WhatsApp'},{status:400});
    return Response.json({ok:true});
  }catch(e){return Response.json({ok:false,error:e.message},{status:500})}
}
