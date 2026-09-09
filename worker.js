const A={
  G:"0x76D89e26502d0aA9bf83DA222cfCF12a27Ead801".toLowerCase(),
  U:"0x55d398326f99059fF775485246999027B3197955".toLowerCase(),
  UNI:"0x779fcD915CD293266676B81f9503EB8E3CE751a6".toLowerCase(),
  PF:"0xca143ce32fe78f1f7019d7d551a6402fc5350c73".toLowerCase()
};
const Z="0x0000000000000000000000000000000000000000";
const S={t0:"0x0dfe1681",t1:"0xd21220a7",r:"0x0902f1ac",pair:"0xe6a43905",dec:"0x313ce567"};
const addr=x=>"0x"+x.slice(-40).toLowerCase();
const uint=x=>BigInt(x);
const pad=a=>"0x.slice(2).padStart(64,"0");

async function rpc(e,m,p){
  if(!e.BSC_RPC_URL) throw Error("BSC_RPC_URL is not configured");
  const r=await fetch(e.BSC_RPC_URL,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({jsonrpc:"2.0",id:1,method:m,params:p})});
  const j=await r.json();
  if(j.error) throw Error(j.error.message||"RPC error");
  return j.result;
}
async function call(e,to,data){return rpc(e,"eth_call",[{to,data},"latest"])}
async function pair(e){return addr(await call(e,A.PF,S.pair+pad(A.G)+pad(A.U)))}

async function inspect(e,p,dex){
  if(!p||p===Z)return{dex,status:"unavailable",reason:"pair_not_found"};
  const [x0,x1]=await Promise.all([call(e,p,S.t0),call(e,p,S.t1)]);
  const t0=addr(x0),t1=addr(x1);
  if(!((t0===A.G&&t1===A.U)||(t0===A.U&&t1===A.G))) return {dex,status:"unavailable",reason:"token_mismatch",pair:p,token0:t0,token1:t1};
  const [rr,d0x,d1x]=await Promise.all([call(e,p,S.r),call(e,t0,S.dec),call(e,t1,S.dec)]);
  const r0=Number(uint("0x"+rr.slice(2,66)))/10**Number(uint(d0x));
  const r1=Number(uint("0x"+rr.slice(66,130)))/10**Number(uint(d1x));
  const g=t0===A.G?r0:r1,u=t0===A.U?r0:r1;
  return {dex,status:g>0?"live":"unavailable",pair:p,gdtyReserve:g,usdtReserve:u,price:g?u/g:null,liquidityUsd:g?2*u:null};
}
const mean=(a,b)=>{const v=[a,b].filter(Number.isFinite);return v.length?v.reduce((x,y)=>x+y,0)/v.length:null};
function out(o,s=200,ttl=0,extra={}){const h={"content-type":"application/json","access-control-allow-origin":"https://goldityglobal.com","access-control-allow-credentials":"true","cache-control":ttl?`public, max-age=${ttl}`:"no-store","x-content-type-options":"nosniff","referrer-policy":"strict-origin-when-cross-origin",...extra};return new Response(JSON.stringify(o),{status:s,headers:h})}

const chartConfig={
  "1H":{tf:"minute",aggregate:5,limit:100},
  "4H":{tf:"minute",aggregate:15,limit:100},
  "1D":{tf:"hour",aggregate:1,limit:100},
  "1W":{tf:"hour",aggregate:6,limit:100},
  "1M":{tf:"day",aggregate:1,limit:100},
  "ALL":{tf:"day",aggregate:1,limit:1000}
};

async function geckoOHLCV(e,pool,cfg){
  if(!pool||pool===Z) return [];
  const base=e.GECKO_API_BASE||"https://api.geckoterminal.com/api/v2";
  const url=`${base}/networks/bsc/pools/${pool}/ohlcv/${cfg.tf}?aggregate=${cfg.aggregate}&limit=${cfg.limit}&currency=usd`;
  const r=await fetch(url,{headers:{accept:"application/json;version=20230203"}});
  if(!r.ok) throw Error(`GeckoTerminal HTTP ${r.status}`);
  const j=await r.json();
  return j?.data?.attributes?.ohlcv_list||[];
}
function normalize(list,dex){
  return list.map(x=>({ts:Number(x[0]),open:Number(x[1]),high:Number(x[2]),low:Number(x[3]),close:Number(x[4]),volume:Number(x[5]||0),dex})).filter(x=>x.ts&&[x.open,x.high,x.low,x.close].every(Number.isFinite));
}
function mergeReference(a,b){
  const Amap=new Map(a.map(x=>[x.ts,x])), Bmap=new Map(b.map(x=>[x.ts,x]));
  const keys=[...new Set([...Amap.keys(),...Bmap.keys()])].sort((x,y)=>x-y);
  return keys.map(ts=>{
    const x=Amap.get(ts),y=Bmap.get(ts), v=[x,y].filter(Boolean);
    const avg=k=>{const q=v.map(z=>z[k]).filter(Number.isFinite);return q.length?q.reduce((m,n)=>m+n,0)/q.length:null};
    return {time:ts,open:avg("open"),high:avg("high"),low:avg("low"),close:avg("close"),volume:v.reduce((s,z)=>s+(z.volume||0),0),sources:v.map(z=>z.dex)};
  }).filter(x=>[x.open,x.high,x.low,x.close].every(Number.isFinite));
}


const TERMS_VERSION="2026-09-09";
const PRIVACY_VERSION="2026-09-09";
const emailRe=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function jsonBody(req){return req.json().catch(()=>({}));}
function normalizeEmail(v){return String(v||"").trim().toLowerCase();}
function cleanText(v,max=120){return String(v||"").trim().slice(0,max);}
function referralCode(){return "GDTY-"+crypto.randomUUID().replace(/-/g,"").slice(0,8).toUpperCase();}
function b64(bytes){let s="";for(const x of new Uint8Array(bytes))s+=String.fromCharCode(x);return btoa(s);}
async function hashPassword(password,saltBytes){
  const enc=new TextEncoder();
  const key=await crypto.subtle.importKey("raw",enc.encode(password),"PBKDF2",false,["deriveBits"]);
  const bits=await crypto.subtle.deriveBits({name:"PBKDF2",salt:saltBytes,iterations:120000,hash:"SHA-256"},key,256);
  return `pbkdf2$120000$${b64(saltBytes)}$${b64(bits)}`;
}
function validPassword(p){return typeof p==="string"&&p.length>=10&&p.length<=128;}

function hex(bytes){return [...new Uint8Array(bytes)].map(x=>x.toString(16).padStart(2,'0')).join('');}
async function sha256Text(v){const h=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v));return hex(h);}
function token(){return hex(crypto.getRandomValues(new Uint8Array(32)));}
async function sendVerificationEmail(e,email,first,rawToken){
  if(!e.RESEND_API_KEY||!e.FROM_EMAIL) return false;
  const origin=e.PUBLIC_ORIGIN||'https://goldityglobal.com';
  const link=`${origin}/verify-email.html?token=${encodeURIComponent(rawToken)}`;
  const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{authorization:`Bearer ${e.RESEND_API_KEY}`,'content-type':'application/json'},body:JSON.stringify({from:e.FROM_EMAIL,to:[email],subject:'Verify your GOLDITY account',html:`<div style="font-family:Arial,sans-serif;background:#080808;color:#f5f0e6;padding:32px"><h2>Welcome to GOLDITY</h2><p>Hello ${first},</p><p>Please verify your email address to activate your GOLDITY account.</p><p><a href="${link}" style="display:inline-block;padding:12px 18px;background:#c9a24d;color:#111;text-decoration:none;border-radius:6px">Verify Email</a></p><p>This link expires in 24 hours.</p></div>`})});
  return r.ok;
}
async function createVerification(e,user){
  const raw=token(), hash=await sha256Text(raw), now=new Date(), exp=new Date(now.getTime()+24*60*60*1000).toISOString();
  await e.DB.prepare('INSERT INTO email_verification_tokens (token_hash,user_id,expires_at,created_at) VALUES (?,?,?,?)').bind(hash,user.id,exp,now.toISOString()).run();
  return {raw,expiresAt:exp};
}
function cookie(name,value,maxAge){return `${name}=${value}; Max-Age=${maxAge}; Path=/; HttpOnly; Secure; SameSite=Lax`}
async function currentUser(e,req){
  if(!e.DB)return null;
  const m=req.headers.get('Cookie')||''; const hit=m.match(/(?:^|;\s*)GDTY_SESSION=([^;]+)/); if(!hit)return null;
  const h=await sha256Text(hit[1]);
  return await e.DB.prepare('SELECT u.id,u.email,u.first_name,u.last_name,u.country,u.phone,u.wallet_address,u.referral_code,u.referred_by,u.email_verified,u.marketing_consent,u.created_at FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>? AND u.email_verified=1').bind(h,new Date().toISOString()).first();
}
async function loginUser(e,req){
  const d=await jsonBody(req), email=normalizeEmail(d.email), password=String(d.password||'');
  const row=e.DB?await e.DB.prepare('SELECT * FROM users WHERE email=?').bind(email).first():null;
  if(!row)return out({ok:false,error:'invalid_credentials',message:'Email or password is incorrect.'},401);
  if(!row.email_verified)return out({ok:false,error:'email_not_verified',message:'Please verify your email before signing in.'},403);
  const stored=String(row.password_hash||'').split('$'); if(stored.length!==4)return out({ok:false,error:'invalid_credentials',message:'Email or password is incorrect.'},401);
  const salt=Uint8Array.from(atob(stored[2]),c=>c.charCodeAt(0)); const expected=await hashPassword(password,salt); if(expected!==row.password_hash)return out({ok:false,error:'invalid_credentials',message:'Email or password is incorrect.'},401);
  const raw=token(), hash=await sha256Text(raw), now=new Date(), exp=new Date(now.getTime()+7*24*60*60*1000).toISOString();
  await e.DB.prepare('INSERT INTO sessions (token_hash,user_id,expires_at,created_at) VALUES (?,?,?,?)').bind(hash,row.id,exp,now.toISOString()).run();
  return out({ok:true,user:{id:row.id,email:row.email,firstName:row.first_name,lastName:row.last_name,country:row.country,referralCode:row.referral_code,referredBy:row.referred_by}},200,0,{'set-cookie':cookie('GDTY_SESSION',raw,7*24*60*60)});
}
async function verifyEmail(e,req){
  if(!e.DB)return out({ok:false,error:'registration_not_configured'},503);
  const u=new URL(req.url), raw=u.searchParams.get('token')||''; if(!raw)return out({ok:false,error:'invalid_token'},400);
  const hash=await sha256Text(raw), row=await e.DB.prepare('SELECT * FROM email_verification_tokens WHERE token_hash=? AND used_at IS NULL').bind(hash).first();
  if(!row||new Date(row.expires_at)<=new Date())return out({ok:false,error:'expired_or_invalid_token',message:'This verification link is invalid or expired.'},400);
  const now=new Date().toISOString(); await e.DB.batch([e.DB.prepare('UPDATE users SET email_verified=1,updated_at=? WHERE id=?').bind(now,row.user_id),e.DB.prepare('UPDATE email_verification_tokens SET used_at=? WHERE token_hash=?').bind(now,hash)]);
  return out({ok:true,message:'Email verified. Your GOLDITY account is now active.'});
}
async function dashboard(e,req){const u=await currentUser(e,req);if(!u)return out({ok:false,error:'unauthorized'},401);const stats=await e.DB.prepare('SELECT COUNT(*) AS count FROM users WHERE referred_by=?').bind(u.referral_code).first();return out({ok:true,user:{...u,firstName:u.first_name,lastName:u.last_name,referralCode:u.referral_code,referredBy:u.referred_by,referrals:Number(stats?.count||0)}});}

async function registerUser(e,req){
  if(!e.DB) return out({ok:false,error:"registration_not_configured",message:"D1 database is not configured yet."},503);
  const d=await jsonBody(req);
  const first=cleanText(d.firstName,80), last=cleanText(d.lastName,80), email=normalizeEmail(d.email), country=cleanText(d.country,80), phone=cleanText(d.phone,40)||null;
  const password=String(d.password||""), ref=cleanText(d.referralCode,32).toUpperCase()||null;
  const age=!!d.ageConfirmed, terms=!!d.termsAccepted, privacy=!!d.privacyAccepted, marketing=!!d.marketingConsent;
  if(!first||!last||!emailRe.test(email)||!country||!validPassword(password)||!age||!terms||!privacy) return out({ok:false,error:"validation_failed",message:"Please complete the required registration fields and accept the required terms."},400);
  const existing=await e.DB.prepare("SELECT id FROM users WHERE email=?1").bind(email).first();
  if(existing) return out({ok:false,error:"email_exists",message:"An account with this email already exists."},409);
  let referredBy=null;
  if(ref){const r=await e.DB.prepare("SELECT referral_code FROM users WHERE referral_code=?1").bind(ref).first();if(!r)return out({ok:false,error:"invalid_referral",message:"The referral code is not valid."},400);referredBy=r.referral_code;}
  let code=referralCode();
  for(let i=0;i<3;i++){const c=await e.DB.prepare("SELECT id FROM users WHERE referral_code=?1").bind(code).first();if(!c)break;code=referralCode();}
  const salt=crypto.getRandomValues(new Uint8Array(16));
  const hash=await hashPassword(password,salt);
  const id=crypto.randomUUID(), now=new Date().toISOString();
  await e.DB.prepare(`INSERT INTO users (id,email,password_hash,first_name,last_name,country,phone,referral_code,referred_by,email_verified,terms_version,privacy_version,age_confirmed,marketing_consent,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .bind(id,email,hash,first,last,country,phone,code,referredBy,0,TERMS_VERSION,PRIVACY_VERSION,1,marketing?1:0,now,now).run();
  const verification=await createVerification(e,{id}); const sent=await sendVerificationEmail(e,email,first,verification.raw); return out({ok:true,status:"pending_email_verification",emailSent:sent,user:{id,email,firstName:first,lastName:last,country,referralCode:code,referredBy,createdAt:now},message:sent?"Registration saved. Check your email to verify the account.":"Registration saved. Email provider is not configured yet; verification link was created server-side."},201);
}

export default {async fetch(req,e){
  const u=new URL(req.url);
  if(req.method==="OPTIONS") return new Response(null,{headers:{"access-control-allow-origin":e.PUBLIC_ORIGIN||"https://goldityglobal.com","access-control-allow-methods":"GET,POST,OPTIONS","access-control-allow-headers":"content-type","access-control-allow-credentials":"true","access-control-max-age":"86400"}});
  try{
    if(u.pathname==="/api/register" && req.method==="POST") return await registerUser(e,req);
    if(u.pathname==="/api/login" && req.method==="POST") return await loginUser(e,req);
    if(u.pathname==="/api/verify-email" && req.method==="GET") return await verifyEmail(e,req);
    if(u.pathname==="/api/me" && req.method==="GET") return await dashboard(e,req);
    if(u.pathname==="/api/logout" && req.method==="POST") return new Response(JSON.stringify({ok:true}),{headers:{"content-type":"application/json","set-cookie":cookie('GDTY_SESSION','',0),"access-control-allow-origin":e.PUBLIC_ORIGIN||"https://goldityglobal.com","access-control-allow-credentials":"true"}});
    if(u.pathname==="/api/referral/check" && req.method==="GET"){
      if(!e.DB) return out({ok:false,error:"registration_not_configured"},503);
      const code=cleanText(u.searchParams.get("code"),32).toUpperCase();
      const row=code?await e.DB.prepare("SELECT first_name,referral_code FROM users WHERE referral_code=?1").bind(code).first():null;
      return out({ok:true,valid:!!row,referralCode:row?.referral_code||null});
    }
    if(u.pathname==="/api/market"){
      const pp=await pair(e);
      const [uni,pcs]=await Promise.all([inspect(e,A.UNI,"Uniswap V2"),inspect(e,pp,"PancakeSwap V2")]);
      const ref=mean(uni.price,pcs.price),live=[uni,pcs].filter(x=>x.status==="live");
      return out({ok:true,network:"BNB Smart Chain",chainId:56,token:{name:"GOLDITY",symbol:"GDTY",address:A.G,decimals:18},quoteToken:{symbol:"USDT",address:A.U,decimals:18},referencePrice:ref,priceMethod:"Arithmetic mean of valid GDTY/USDT V2 pool prices",liquidityUsd:live.reduce((s,x)=>s+(x.liquidityUsd||0),0)||null,markets:{uniswap:uni,pancakeswap:pcs},lastUpdated:new Date().toISOString(),dataStatus:ref===null?"unavailable":"live"},200,10);
    }
    if(u.pathname==="/api/chart"){
      const pp=await pair(e);
      const range=(u.searchParams.get("range")||"1D").toUpperCase();
      const cfg=chartConfig[range];
      if(!cfg) return out({ok:false,error:"invalid_range",allowed:Object.keys(chartConfig)},400);
      const [uni,pcs]=await Promise.allSettled([geckoOHLCV(e,A.UNI,cfg),geckoOHLCV(e,pp,cfg)]);
      const a=uni.status==="fulfilled"?normalize(uni.value,"Uniswap V2"):[];
      const b=pcs.status==="fulfilled"?normalize(pcs.value,"PancakeSwap V2"):[];
      const candles=mergeReference(a,b);
      return out({ok:true,range,method:"Arithmetic mean of valid pool OHLC values by timestamp",candles,sources:{uniswap:{status:uni.status==="fulfilled"&&a.length?"live":"unavailable",pool:A.UNI,count:a.length},pancakeswap:{status:pcs.status==="fulfilled"&&b.length?"live":"unavailable",pool:pp,count:b.length}},historyStatus:candles.length?"live":"unavailable",note:"Candles are based on indexed on-chain OHLCV data. No synthetic or decorative history is generated."},200,30);
    }
    if (e.ASSETS) return e.ASSETS.fetch(req);
    return out({ok:false,error:"not_found"},404);
  }catch(x){return out({ok:false,dataStatus:"unavailable",error:x.message},503)}
}};
