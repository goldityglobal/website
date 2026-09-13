import * as secp from "@noble/secp256k1";

 

import { keccak_256 } from "@noble/hashes/sha3.js";

 

 

const A = {

 

  G: "0x76D89e26502d0aA9bf83DA222cfCF12a27Ead801".toLowerCase(),

 

  U: "0x55d398326f99059fF775485246999027B3197955".toLowerCase(),

 

  UNI: "0x779fcD915CD293266676B81f9503EBE8CE751a6".toLowerCase(),

 

  PF: "0xca143ce32fe78f1f7019d7d551a6402fc5350c73".toLowerCase()

 

};

 

const Z = "0x0000000000000000000000000000000000000000";

 

const S = {

 

  t0: "0x0dfe1681",

 

  t1: "0xd21220a7",

 

  r: "0x0902f1ac",

 

  pair: "0xe6a43905",

 

  dec: "0x313ce567",

 

  balanceOf: "0x70a08231",

 

  blockNumber: "0x"

 

};

 

const TOPIC_TRANSFER = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

const TOPIC_SWAP = "0xd78ad95fa46c994b6551d0da85fc275fe6139e3c0f2e909f7b2e2e7f0c4e2b7";

 

const enc = new TextEncoder();

 

const TERMS_VERSION = "2026-09-09";

 

const PRIVACY_VERSION = "2026-09-09";

 

const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

 

const walletRe = /^0x[a-fA-F0-9]{40}$/;

 

const txRe = /^0x[a-fA-F0-9]{64}$/;

 

const ranges = {

 

  "1H": {tf:"minute", aggregate:5, limit:100},

 

  "4H": {tf:"minute", aggregate:15, limit:100},

 

  "1D": {tf:"hour", aggregate:1, limit:100},

 

  "1W": {tf:"hour", aggregate:6, limit:100},

 

  "1M": {tf:"day", aggregate:1, limit:100},

 

  "ALL": {tf:"day", aggregate:1, limit:1000}

 

};

 

 

const addr = x => "0x" + String(x).slice(-40).toLowerCase();

 

const clean = (v, max=120) => String(v ?? "").trim().slice(0, max);

 

const normalizeEmail = v => clean(v,160).toLowerCase();

 

const uint = x => BigInt(x);

 

const pad = a => a.slice(2).padStart(64,"0");

 

const token = () => [...crypto.getRandomValues(new Uint8Array(32))].map(x=>x.toString(16).padStart(2,"0")).join("");

 

const id = () => crypto.randomUUID();

 

const nowIso = () => new Date().toISOString();

 

 

function out(data, status=200, ttl=0, extra={}) {

 

  const h = {

 

    "content-type":"application/json; charset=utf-8",

 

    "cache-control":ttl ? `public, max-age=${ttl}` : "no-store",

 

    "x-content-type-options":"nosniff",

 

    "x-frame-options":"DENY",

 

    "referrer-policy":"strict-origin-when-cross-origin",

 

    "permissions-policy":"camera=(), microphone=(), geolocation=()",

 

    "strict-transport-security":"max-age=31536000; includeSubDomains",

 

    "content-security-policy":"default-src 'none'; frame-ancestors 'none'",

 

    ...extra

 

  };

 

  return new Response(JSON.stringify(data), {status, headers:h});

 

}

 

 

function htmlEscape(v) {

 

  return String(v ?? "").replace(/[&<>"']/g, c => ({

 

    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"

 

  }[c]));

 

}

 

 

function cookie(name, value, maxAge) {

 

  return `${name}=${value}; Max-Age=${maxAge}; Path=/; HttpOnly; Secure; SameSite=Strict`;

 

}

 

 

function cors(e) {

 

  return {

 

    "access-control-allow-origin": e.PUBLIC_ORIGIN || "https://goldityglobal.com",

 

    "access-control-allow-credentials":"true"

 

  };

 

}

 

 

const RPC_FALLBACKS = [

 

  "https://bsc-dataseed.bnbchain.org",

 

  "https://bsc-dataseed-public.bnbchain.org",

 

  "https://bsc-dataseed.nariox.org",

 

  "https://bsc-dataseed.defibit.io"

 

];

 

const RPC_TIMEOUT_MS = 5000;

 

 

function rpcEndpoints(e) {

 

  return [...new Set([

 

    String(e.BSC_RPC_URL||"").trim(),

 

    ...RPC_FALLBACKS

 

  ].filter(Boolean))];

 

}

 

 

async function rpc(e, method, params=[]) {

 

  const endpoints=rpcEndpoints(e);

 

  if(!endpoints.length)throw new Error("rpc_unavailable");

 

  let lastError=null;

 

 

  for(const endpoint of endpoints){

 

    const controller=new AbortController();

 

    const timer=setTimeout(()=>controller.abort(),RPC_TIMEOUT_MS);

 

    try{

 

      const r=await fetch(endpoint,{

 

        method:"POST",

 

        headers:{"content-type":"application/json"},

 

        body:JSON.stringify({jsonrpc:"2.0",id:1,method,params}),

 

        signal:controller.signal

 

      });

 

      if(!r.ok){

 

        lastError=new Error("rpc_http_error");

 

        continue;

 

      }

 

      const j=await r.json();

 

      if(j?.error){

 

        lastError=new Error("rpc_error");

 

        continue;

 

      }

 

      if(typeof j?.result==="undefined"){

 

        lastError=new Error("rpc_invalid_response");

 

        continue;

 

      }

 

      return j.result;

 

    }catch(err){

 

      lastError=err?.name==="AbortError"?new Error("rpc_timeout"):(err instanceof Error?err:new Error("rpc_unavailable"));

 

    }finally{

 

      clearTimeout(timer);

 

    }

 

  }

 

 

  throw lastError||new Error("rpc_unavailable");

 

}

 

 

async function call(e,to,data) {

 

  return rpc(e,"eth_call",[{to,data},"latest"]);

 

}

 

 

async function pair(e) {

 

  return addr(await call(e,A.PF,S.pair + pad(A.G) + pad(A.U)));

 

}

 

 

async function safePair(e) {

 

  try{

 

    const p=await pair(e);

 

    return {address:p&&p!==Z?p:null,reason:p&&p!==Z?null:"pair_not_found"};

 

  }catch(err){

 

    return {address:null,reason:marketErrorReason(err)};

 

  }

 

}

 

 

function marketErrorReason(err) {

 

  const code=String(err?.message||"");

 

  if(["rpc_http_error","rpc_error","rpc_invalid_response","rpc_unavailable"].includes(code))return code;

 

  return "market_data_error";

 

}

 

 

async function inspect(e,p,dex) {

 

  if(!p || p===Z)return {dex,status:"unavailable",reason:"pair_not_found",pair:p||null};

 

  const [x0,x1]=await Promise.all([call(e,p,S.t0),call(e,p,S.t1)]);

 

  const t0=addr(x0),t1=addr(x1);

 

  if(!((t0===A.G&&t1===A.U)||(t0===A.U&&t1===A.G)))

 

    return {dex,status:"unavailable",reason:"token_mismatch",pair:p};

 

  const [rr,d0x,d1x]=await Promise.all([call(e,p,S.r),call(e,t0,S.dec),call(e,t1,S.dec)]);

 

  const r0=Number(uint("0x"+rr.slice(2,66)))/10**Number(uint(d0x));

 

  const r1=Number(uint("0x"+rr.slice(66,130)))/10**Number(uint(d1x));

 

  const g=t0===A.G?r0:r1,u=t0===A.U?r0:r1;

 

  if(!Number.isFinite(g)||!Number.isFinite(u)||g<=0||u<0)

 

    return {dex,status:"unavailable",reason:"invalid_reserves",pair:p};

 

  const price=u/g;

 

  if(!Number.isFinite(price)||price<=0)

 

    return {dex,status:"unavailable",reason:"invalid_price",pair:p};

 

  return {dex,status:"live",pair:p,gdtyReserve:g,usdtReserve:u,price,liquidityUsd:2*u};

 

}

 

 

async function safeInspect(e,p,dex) {

 

  try{return await inspect(e,p,dex);}

 

  catch(err){return {dex,status:"unavailable",reason:marketErrorReason(err),pair:p||null};}

 

}

 

 

const mean=(a,b)=>{

 

  const v=[a,b].filter(Number.isFinite);

 

  return v.length?v.reduce((x,y)=>x+y,0)/v.length:null;

 

};

 

 

async function geckoOHLCV(e,pool,cfg) {

 

  if (!pool || pool===Z) return [];

 

  const base=e.GECKO_API_BASE||"https://api.geckoterminal.com/api/v2";

 

  const url=`${base}/networks/bsc/pools/${pool}/ohlcv/${cfg.tf}?aggregate=${cfg.aggregate}&limit=${cfg.limit}&currency=usd`;

 

  const r=await fetch(url,{headers:{accept:"application/json;version=20230203"}});

 

  if(!r.ok) throw new Error("chart_provider_error");

 

  const j=await r.json();

 

  return j?.data?.attributes?.ohlcv_list||[];

 

}

 

 

function normalize(list,dex) {

 

  return list.map(x=>({

 

    ts:Number(x[0]),open:Number(x[1]),high:Number(x[2]),low:Number(x[3]),

 

    close:Number(x[4]),volume:Number(x[5]||0),dex

 

  })).filter(x=>x.ts&&[x.open,x.high,x.low,x.close].every(Number.isFinite));

 

}

 

 

function mergeReference(a,b) {

 

  const am=new Map(a.map(x=>[x.ts,x])), bm=new Map(b.map(x=>[x.ts,x]));

 

  const keys=[...new Set([...am.keys(),...bm.keys()])].sort((x,y)=>x-y);

 

  return keys.map(ts=>{

 

    const v=[am.get(ts),bm.get(ts)].filter(Boolean);

 

    const avg=k=>{

 

      const q=v.map(z=>z[k]).filter(Number.isFinite);

 

      return q.length?q.reduce((m,n)=>m+n,0)/q.length:null;

 

    };

 

    return {

 

      time:ts,open:avg("open"),high:avg("high"),low:avg("low"),close:avg("close"),

 

      volume:v.reduce((s,z)=>s+(z.volume||0),0),sources:v.map(z=>z.dex)

 

    };

 

  }).filter(x=>[x.open,x.high,x.low,x.close].every(Number.isFinite));

 

}

 

 

function b64(bytes) {

 

  let s="";

 

  for(const x of new Uint8Array(bytes)) s+=String.fromCharCode(x);

 

  return btoa(s);

 

}

 

 

async function sha256Text(v) {

 

  const h=await crypto.subtle.digest("SHA-256",enc.encode(v));

 

  return [...new Uint8Array(h)].map(x=>x.toString(16).padStart(2,"0")).join("");

 

}

 

 

const PASSWORD_ITERATIONS = 310000;

 

async function hashPassword(password,saltBytes,iterations=PASSWORD_ITERATIONS) {

 

  const key=await crypto.subtle.importKey("raw",enc.encode(password),"PBKDF2",false,["deriveBits"]);

 

  const bits=await crypto.subtle.deriveBits(

 

    {name:"PBKDF2",salt:saltBytes,iterations,hash:"SHA-256"},key,256

 

  );

 

  return `pbkdf2$${iterations}$${b64(saltBytes)}$${b64(bits)}`;

 

}

 

 

function validPassword(p){return typeof p==="string"&&p.length>=10&&p.length<=128;}

 

 

async function currentUser(e,req) {

 

  if(!e.DB)return null;

 

  const m=req.headers.get("Cookie")||"";

 

  const hit=m.match(/(?:^|;\s*)GDTY_SESSION=([^;]+)/);

 

  if(!hit)return null;

 

  const h=await sha256Text(hit[1]);

 

  return e.DB.prepare(`

 

    SELECT u.id,u.email,u.first_name,u.last_name,u.country,u.phone,u.wallet_address,

 

           u.referral_code,u.referred_by,u.email_verified,u.marketing_consent,

 

           u.role,u.created_at

 

    FROM sessions s JOIN users u ON u.id=s.user_id

 

    WHERE s.token_hash=? AND s.expires_at>? AND u.email_verified=1

 

  `).bind(h,nowIso()).first();

 

}

 

 

async function requireOrigin(e,req) {

 

  const origin=req.headers.get("Origin");

 

  if(origin !== (e.PUBLIC_ORIGIN || "https://goldityglobal.com")) return false;

 

  return true;

 

}

 

 

async function rateLimit(e,key,limit=12,windowMs=60000) {

 

  if(!e.DB)return true;

 

  const now=Math.floor(Date.now()/1000);

 

  const start=now-Math.floor(windowMs/1000);

 

  const row=await e.DB.prepare("SELECT attempts,window_start FROM rate_limits WHERE key=?").bind(key).first();

 

  if(!row || Number(row.window_start)<start) {

 

    await e.DB.prepare(`

 

      INSERT INTO rate_limits(key,attempts,window_start,updated_at)

 

      VALUES(?,?,?,?)

 

      ON CONFLICT(key) DO UPDATE SET attempts=1,window_start=excluded.window_start,updated_at=excluded.updated_at

 

    `).bind(key,1,now,now).run();

 

    return true;

 

  }

 

  if(Number(row.attempts)>=limit)return false;

 

  await e.DB.prepare("UPDATE rate_limits SET attempts=attempts+1,updated_at=? WHERE key=?").bind(now,key).run();

 

  return true;

 

}

 

 

function ip(req){return req.headers.get("CF-Connecting-IP")||"unknown";}

 

 

async function loginUser(e,req) {

 

  if(!e.DB)return out({ok:false,error:"registration_not_configured"},503,cors(e));

 

  if(!await requireOrigin(e,req))return out({ok:false,error:"forbidden"},403,cors(e));

 

  if(!await rateLimit(e,`login:${ip(req)}`,8,60000))return out({ok:false,error:"rate_limited",message:"Too many attempts. Please try again shortly."},429,cors(e));

 

  const d=await req.json().catch(()=>({}));

 

  const email=normalizeEmail(d.email), password=String(d.password||"");

 

  const row=await e.DB.prepare("SELECT * FROM users WHERE email=?").bind(email).first();

 

  if(!row)return out({ok:false,error:"invalid_credentials",message:"Email or password is incorrect."},401,cors(e));

 

  if(!row.email_verified)return out({ok:false,error:"email_not_verified",message:"Please verify your email before signing in."},403,cors(e));

 

  const p=String(row.password_hash||"").split("$");

 

  if(p.length!==4)return out({ok:false,error:"invalid_credentials",message:"Email or password is incorrect."},401,cors(e));

 

  const iterations=Number(p[1])||120000;

 

  const salt=Uint8Array.from(atob(p[2]),c=>c.charCodeAt(0));

 

  const expected=await hashPassword(password,salt,iterations);

 

  if(expected!==row.password_hash)return out({ok:false,error:"invalid_credentials",message:"Email or password is incorrect."},401,cors(e));

 

  // Transparently upgrade legacy password hashes after a successful login.

  if(iterations<PASSWORD_ITERATIONS){

    const newSalt=crypto.getRandomValues(new Uint8Array(16));

    const upgraded=await hashPassword(password,newSalt,PASSWORD_ITERATIONS);

    await e.DB.prepare("UPDATE users SET password_hash=?,updated_at=? WHERE id=?")

      .bind(upgraded,nowIso(),row.id).run();

  }

 

  const raw=token(), hash=await sha256Text(raw), now=nowIso();

 

  const exp=new Date(Date.now()+7*86400000).toISOString();

 

  await e.DB.batch([

 

    e.DB.prepare("INSERT INTO sessions(token_hash,user_id,expires_at,created_at) VALUES(?,?,?,?)").bind(hash,row.id,exp,now),

 

    e.DB.prepare("DELETE FROM sessions WHERE user_id=? AND expires_at<=?").bind(row.id,now)

 

  ]);

 

  return out({

 

    ok:true,user:{id:row.id,email:row.email,firstName:row.first_name,lastName:row.last_name,

 

    country:row.country,referralCode:row.referral_code,referredBy:row.referred_by}

 

  },200,0,{...cors(e),"set-cookie":cookie("GDTY_SESSION",raw,7*86400)});

 

}

 

 

async function registerUser(e,req) {

 

  if(!e.DB)return out({ok:false,error:"registration_not_configured"},503,cors(e));

 

  if(!await requireOrigin(e,req))return out({ok:false,error:"forbidden"},403,cors(e));

 

  if(!await rateLimit(e,`register:${ip(req)}`,5,3600000))return out({ok:false,error:"rate_limited"},429,cors(e));

 

  const d=await req.json().catch(()=>({}));

 

  const first=clean(d.firstName,80),last=clean(d.lastName,80),email=normalizeEmail(d.email);

 

  const country=clean(d.country,80),phone=clean(d.phone,40)||null;

 

  const password=String(d.password||""),ref=clean(d.referralCode,32).toUpperCase()||null;

 

  if(!first||!last||!emailRe.test(email)||!country||!validPassword(password)||!d.ageConfirmed||!d.termsAccepted||!d.privacyAccepted)

 

    return out({ok:false,error:"validation_failed",message:"Please complete the required registration fields and accept the required terms."},400,cors(e));

 

  if(await e.DB.prepare("SELECT id FROM users WHERE email=?").bind(email).first())

 

    return out({ok:false,error:"email_exists",message:"An account with this email already exists."},409,cors(e));

 

  let referredBy=null;

 

  if(ref){

 

    const r=await e.DB.prepare("SELECT referral_code FROM users WHERE referral_code=?").bind(ref).first();

 

    if(!r)return out({ok:false,error:"invalid_referral",message:"The referral code is not valid."},400,cors(e));

 

    referredBy=r.referral_code;

 

  }

 

  let code=await makeReferralCode(e);

 

  const salt=crypto.getRandomValues(new Uint8Array(16));

 

  const hash=await hashPassword(password,salt);

 

  const uid=id(), now=nowIso();

 

  try{

 

    await e.DB.prepare(`

 

      INSERT INTO users(id,email,password_hash,first_name,last_name,country,phone,referral_code,referred_by,

 

      email_verified,terms_version,privacy_version,age_confirmed,marketing_consent,created_at,updated_at)

 

      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)

 

    `).bind(uid,email,hash,first,last,country,phone,code,referredBy,0,TERMS_VERSION,PRIVACY_VERSION,1,d.marketingConsent?1:0,now,now).run();

 

  }catch{

 

    return out({ok:false,error:"registration_failed",message:"Account creation failed. Please try again."},500,cors(e));

 

  }

 

  const raw=token(), tokenHash=await sha256Text(raw), exp=new Date(Date.now()+86400000).toISOString();

 

  await e.DB.prepare("INSERT INTO email_verification_tokens(token_hash,user_id,expires_at,created_at) VALUES(?,?,?,?)")

 

    .bind(tokenHash,uid,exp,now).run();

 

  let emailSent=false;

 

  if(e.RESEND_API_KEY&&e.FROM_EMAIL){

 

    const link=`${e.PUBLIC_ORIGIN||"https://goldityglobal.com"}/verify-email.html?token=${encodeURIComponent(raw)}`;

 

    const r=await fetch("https://api.resend.com/emails",{

 

      method:"POST",

 

      headers:{authorization:`Bearer ${e.RESEND_API_KEY}`,"content-type":"application/json"},

 

      body:JSON.stringify({

 

        from:e.FROM_EMAIL,to:[email],subject:"Verify your GOLDITY account",

 

        html:`<div style="font-family:Arial;background:#080808;color:#f5f0e6;padding:32px"><h2>Welcome to GOLDITY</h2><p>Hello ${htmlEscape(first)},</p><p>Verify your email to activate your account.</p><p><a href="${htmlEscape(link)}">Verify Email</a></p></div>`

 

      })

 

    }).catch(()=>null);

 

    emailSent=!!r?.ok;

 

  }

 

  return out({ok:true,status:"pending_email_verification",emailSent,user:{id:uid,email,firstName:first,lastName:last,country,referralCode:code,referredBy,createdAt:now}},201,cors(e));

 

}

 

 

async function makeReferralCode(e) {

 

  for(let i=0;i<8;i++){

 

    const c="GDTY-"+crypto.randomUUID().replace(/-/g,"").slice(0,8).toUpperCase();

 

    if(!await e.DB.prepare("SELECT id FROM users WHERE referral_code=?").bind(c).first())return c;

 

  }

 

  throw new Error("referral_code_generation_failed");

 

}

 

 

async function verifyEmail(e,req) {

 

  if(!e.DB)return out({ok:false,error:"registration_not_configured"},503,cors(e));

 

  const raw=new URL(req.url).searchParams.get("token")||"";

 

  if(!raw)return out({ok:false,error:"invalid_token"},400,cors(e));

 

  const h=await sha256Text(raw);

 

  const row=await e.DB.prepare("SELECT * FROM email_verification_tokens WHERE token_hash=? AND used_at IS NULL").bind(h).first();

 

  if(!row||new Date(row.expires_at)<=new Date())return out({ok:false,error:"expired_or_invalid_token",message:"This verification link is invalid or expired."},400,cors(e));

 

  const now=nowIso();

 

  await e.DB.batch([

 

    e.DB.prepare("UPDATE users SET email_verified=1,updated_at=? WHERE id=?").bind(now,row.user_id),

 

    e.DB.prepare("UPDATE email_verification_tokens SET used_at=? WHERE token_hash=?").bind(now,h)

 

  ]);

 

  return out({ok:true,message:"Email verified. Your GOLDITY account is now active."},200,0,cors(e));

 

}

 

 

function bytes(hexString) {

 

  const h=hexString.replace(/^0x/,"");

 

  const a=new Uint8Array(h.length/2);

 

  for(let i=0;i<a.length;i++)a[i]=parseInt(h.slice(i*2,i*2+2),16);

 

  return a;

 

}

 

 

function eip191Digest(message) {

 

  const m=enc.encode(message);

 

  return keccak_256(enc.encode(`\x19Ethereum Signed Message:\n${m.length}${message}`));

 

}

 

 

function recoveredAddress(signatureHex,message) {

 

  const raw=bytes(signatureHex);

 

  if(raw.length!==65)throw new Error("invalid_signature");

 

  let v=raw[64];

 

  if(v>=27)v-=27;

 

  if(v>1)throw new Error("invalid_signature");

 

  const sig=new Uint8Array(65);

 

  sig.set(raw.slice(0,64));sig[64]=v;

 

  const pub=secp.recoverPublicKey(sig,eip191Digest(message),{prehash:false});

 

  const uncompressed=pub.length===65?pub.slice(1):pub;

 

  const h=keccak_256(uncompressed);

 

  return "0x"+[...h.slice(-20)].map(x=>x.toString(16).padStart(2,"0")).join("");

 

}

 

 

async function walletChallenge(e,req) {

 

  const u=await currentUser(e,req);

 

  if(!u)return out({ok:false,error:"unauthorized"},401,cors(e));

 

  if(!await requireOrigin(e,req))return out({ok:false,error:"forbidden"},403,cors(e));

 

  const d=await req.json().catch(()=>({})), address=String(d.address||"").toLowerCase();

 

  if(!walletRe.test(address))return out({ok:false,error:"invalid_wallet"},400,cors(e));

 

  const existing=await e.DB.prepare("SELECT user_id FROM wallets WHERE address=?").bind(address).first();

 

  if(existing&&existing.user_id!==u.id)return out({ok:false,error:"wallet_already_bound"},409,cors(e));

 

  const challengeId=id(), nonce=token(), message=[

 

    "GOLDITY Wallet Verification",

 

    `Domain: ${e.PUBLIC_ORIGIN||"https://goldityglobal.com"}`,

 

    `Wallet: ${address}`,

 

    `Nonce: ${nonce}`,

 

    "Chain ID: 56",

 

    "Purpose: Link this wallet to your GOLDITY account.",

 

    "This signature does not authorize a blockchain transaction."

 

  ].join("\n");

 

  const exp=new Date(Date.now()+10*60*1000).toISOString();

 

  await e.DB.prepare("DELETE FROM wallet_challenges WHERE user_id=? AND used_at IS NULL").bind(u.id).run();

 

  await e.DB.prepare(`

 

    INSERT INTO wallet_challenges(id,user_id,wallet_address,nonce,message,expires_at,created_at)

 

    VALUES(?,?,?,?,?,?,?)

 

  `).bind(challengeId,u.id,address,nonce,message,exp,nowIso()).run();

 

  return out({ok:true,challengeId,message,expiresAt:exp},200,0,cors(e));

 

}

 

 

async function walletVerify(e,req) {

 

  const u=await currentUser(e,req);

 

  if(!u)return out({ok:false,error:"unauthorized"},401,cors(e));

 

  if(!await requireOrigin(e,req))return out({ok:false,error:"forbidden"},403,cors(e));

 

  const d=await req.json().catch(()=>({}));

 

  const ch=await e.DB.prepare("SELECT * FROM wallet_challenges WHERE id=? AND user_id=? AND used_at IS NULL").bind(d.challengeId,u.id).first();

 

  if(!ch||new Date(ch.expires_at)<=new Date())return out({ok:false,error:"challenge_expired"},400,cors(e));

 

  const recovered=recoveredAddress(String(d.signature||""),ch.message);

 

  if(recovered!==String(ch.wallet_address).toLowerCase())return out({ok:false,error:"signature_mismatch"},401,cors(e));

 

  const bound=await e.DB.prepare("SELECT user_id FROM wallets WHERE address=?").bind(recovered).first();

 

  if(bound&&bound.user_id!==u.id)return out({ok:false,error:"wallet_already_bound"},409,cors(e));

 

  const now=nowIso();

 

  await e.DB.batch([

 

    e.DB.prepare(`

 

      INSERT INTO wallets(id,user_id,address,chain_id,verified,verified_at,created_at,updated_at)

 

      VALUES(?,?,?,?,?,?,?,?)

 

      ON CONFLICT(address) DO UPDATE SET user_id=excluded.user_id,verified=1,verified_at=excluded.verified_at,updated_at=excluded.updated_at

 

    `).bind(id(),u.id,recovered,56,1,now,now,now),

 

    e.DB.prepare("UPDATE users SET wallet_address=?,updated_at=? WHERE id=?").bind(recovered,now,u.id),

 

    e.DB.prepare("UPDATE wallet_challenges SET used_at=? WHERE id=?").bind(now,ch.id)

 

  ]);

 

  return out({ok:true,address:recovered},200,0,cors(e));

 

}

 

 

async function tokenBalance(e,tokenAddress,account) {

 

  const raw=await call(e,tokenAddress,S.balanceOf+pad(account));

 

  return raw ? BigInt(raw) : 0n;

 

}

 

 

async function walletData(e,u) {

 

  const address=u.wallet_address;

 

  if(!address||!walletRe.test(address))return {connected:false};

 

  const [gdty,usdt,bnb] = await Promise.all([

 

    tokenBalance(e,A.G,address),

 

    tokenBalance(e,A.U,address),

 

    rpc(e,"eth_getBalance",[address,"latest"]).then(BigInt)

 

  ]);

 

  return {

 

    connected:true,address,

 

    gdtyWei:gdty.toString(),usdtWei:usdt.toString(),bnbWei:bnb.toString()

 

  };

 

}

 

 

function parseTransfer(log) {

 

  if(String(log.topics?.[0]).toLowerCase()!==TOPIC_TRANSFER)return null;

 

  if(!log.topics?.[1]||!log.topics?.[2]||!log.data)return null;

 

  return {

 

    token:String(log.address).toLowerCase(),

 

    from:addr(log.topics[1]),

 

    to:addr(log.topics[2]),

 

    amount:BigInt(log.data).toString()

 

  };

 

}

 

 

function parseSwap(log) {

 

  if(String(log.topics?.[0]).toLowerCase()!==TOPIC_SWAP)return null;

 

  if(!log.address||!log.topics?.[1]||!log.topics?.[2]||!log.data)return null;

 

  const data=String(log.data).replace(/^0x/,"");

 

  if(data.length!==256)return null;

 

  return {

    pair:String(log.address).toLowerCase(),

    sender:addr(log.topics[1]),

    to:addr(log.topics[2]),

    amount0In:BigInt("0x"+data.slice(0,64)),

    amount1In:BigInt("0x"+data.slice(64,128)),

    amount0Out:BigInt("0x"+data.slice(128,192)),

    amount1Out:BigInt("0x"+data.slice(192,256))

  };

 

}

 

 

async function isValidGdtyUsdtPair(e,pairAddress) {

 

  const p=String(pairAddress||"").toLowerCase();

 

  if(!/^0x[a-f0-9]{40}$/.test(p)||p===Z)return false;

 

  const [t0,t1]=await Promise.all([

    call(e,p,S.t0).then(addr),

    call(e,p,S.t1).then(addr)

  ]);

 

  return (t0===A.G&&t1===A.U)||(t0===A.U&&t1===A.G);

 

}

 

 

async function verifyTrade(e,u,txHash) {

 

  if(!u.wallet_address)return {ok:false,error:"wallet_not_connected"};

 

  const tx=await rpc(e,"eth_getTransactionByHash",[txHash]);

  const receipt=await rpc(e,"eth_getTransactionReceipt",[txHash]);

 

  if(!tx||!receipt)return {ok:false,error:"transaction_not_found"};

  if(String(tx.from).toLowerCase()!==u.wallet_address.toLowerCase())return {ok:false,error:"transaction_wallet_mismatch"};

  if(receipt.status!=="0x1")return {ok:false,error:"transaction_failed"};

 

  const pp=await pair(e);

  const pools=new Map([[A.UNI,"Uniswap V2"],[pp,"PancakeSwap V2"]]);

  const logs=(receipt.logs||[]).map(parseTransfer).filter(Boolean);

  const swaps=(receipt.logs||[]).map(parseSwap).filter(Boolean);

  const user=u.wallet_address.toLowerCase();

 

  for(const [p,name] of pools){

    if(!/^0x[a-f0-9]{40}$/.test(p)||p===Z)continue;

    if(!await isValidGdtyUsdtPair(e,p))continue;

 

    const swap=swaps.find(s=>s.pair===p);

    if(!swap)continue;

 

    const [t0,t1]=await Promise.all([

      call(e,p,S.t0).then(addr),

      call(e,p,S.t1).then(addr)

    ]);

 

    const gdtyIs0=t0===A.G&&t1===A.U;

    const gdtyIs1=t1===A.G&&t0===A.U;

    if(!gdtyIs0&&!gdtyIs1)continue;

 

    const gdtyIn=gdtyIs0?swap.amount0In:swap.amount1In;

    const usdtIn=gdtyIs0?swap.amount1In:swap.amount0In;

    const gdtyOut=gdtyIs0?swap.amount0Out:swap.amount1Out;

    const usdtOut=gdtyIs0?swap.amount1Out:swap.amount0Out;

 

    const gBuy=logs.find(l=>l.token===A.G&&l.from===p&&l.to===user);

    const uBuy=logs.find(l=>l.token===A.U&&l.from===user&&l.to===p);

 

    if(gBuy&&uBuy&&BigInt(gBuy.amount)===gdtyOut&&BigInt(uBuy.amount)===usdtIn&&gdtyOut>0n&&usdtIn>0n){

      return {ok:true,side:"buy",pair:p,dex:name,gdty:gBuy.amount,usdt:uBuy.amount,block:parseInt(receipt.blockNumber,16)};

    }

 

    const gSell=logs.find(l=>l.token===A.G&&l.from===user&&l.to===p);

    const uSell=logs.find(l=>l.token===A.U&&l.from===p&&l.to===user);

 

    if(gSell&&uSell&&BigInt(gSell.amount)===gdtyIn&&BigInt(uSell.amount)===usdtOut&&gdtyIn>0n&&usdtOut>0n){

      return {ok:true,side:"sell",pair:p,dex:name,gdty:gSell.amount,usdt:uSell.amount,block:parseInt(receipt.blockNumber,16)};

    }

  }

 

  return {ok:false,error:"unsupported_trade"};

 

}

 

function formatWeiRatio(numerator,denominator,decimals=18){

  if(denominator<=0n)return "";

  const scale=10n**BigInt(decimals);

  const scaled=(numerator*scale)/denominator;

  const whole=scaled/scale;

  const frac=scaled%scale;

  if(frac===0n)return whole.toString();

  return `${whole}.${frac.toString().padStart(decimals,"0").replace(/0+$/,"")}`;

}

 

async function blockTimestamp(e,blockNumber,fallback){

  try{

    const b=await rpc(e,"eth_getBlockByNumber",["0x"+Number(blockNumber).toString(16),false]);

    if(b?.timestamp)return new Date(parseInt(b.timestamp,16)*1000).toISOString();

  }catch{}

  return fallback;

}

 

async function applyTradeAccounting(e,u,trade){

  const g=BigInt(trade.gdty), uAmt=BigInt(trade.usdt);

  if(g<=0n||uAmt<=0n)throw new Error("invalid_trade_amount");

  const now=nowIso();

  const accountingId=id();

 

  if(trade.side==="buy"){

    const reward=g/20n;

    const refUser=u.referred_by

      ?await e.DB.prepare("SELECT id FROM users WHERE referral_code=?").bind(u.referred_by).first()

      :null;

 

    const statements=[

      e.DB.prepare("INSERT INTO trade_accounting(id,trade_id,created_at) VALUES(?,?,?)").bind(accountingId,trade.id,now),

      e.DB.prepare(`

        INSERT INTO portfolio_accounts(user_id,gdty_bought_wei,gdty_sold_wei,usdt_spent_wei,usdt_received_wei,cost_basis_wei,realized_pnl_wei,updated_at)

        VALUES(?,?,?,?,?,?,?,?)

        ON CONFLICT(user_id) DO UPDATE SET

          gdty_bought_wei=portfolio_accounts.gdty_bought_wei + excluded.gdty_bought_wei,

          usdt_spent_wei=portfolio_accounts.usdt_spent_wei + excluded.usdt_spent_wei,

          cost_basis_wei=portfolio_accounts.cost_basis_wei + excluded.cost_basis_wei,

          updated_at=excluded.updated_at

      `).bind(u.id,g,0,uAmt,0,uAmt,0,now),

      e.DB.prepare("UPDATE trades SET accounted_at=? WHERE id=? AND accounted_at IS NULL").bind(now,trade.id)

    ];

 

    if(refUser&&reward>0n){

      statements.push(e.DB.prepare(`

        INSERT OR IGNORE INTO referral_rewards(id,referrer_user_id,referred_user_id,trade_id,source_tx_hash,gdty_amount_wei,reward_amount_wei,reward_rate_bps,status,created_at,available_at)

        VALUES(?,?,?,?,?,?,?,?,?,?,?)

      `).bind(id(),refUser.id,u.id,trade.id,trade.tx_hash,g.toString(),reward.toString(),500,"available",now,now));

      statements.push(e.DB.prepare(`

        INSERT INTO notifications(id,user_id,type,title,message,created_at)

        VALUES(?,?,?,?,?,?)

      `).bind(id(),refUser.id,"referral_reward","Referral reward","A verified GOLDITY purchase generated a 5% website referral reward.",now));

    }

 

    await e.DB.batch(statements);

    return;

  }

 

  if(trade.side!=="sell")throw new Error("invalid_trade_side");

 

  // The conditional UPDATE is the concurrency guard: a sell can only be

  // accounted when the current confirmed net GDTY balance covers it.

  const statements=[

    e.DB.prepare("INSERT INTO trade_accounting(id,trade_id,created_at) VALUES(?,?,?)").bind(accountingId,trade.id,now),

    e.DB.prepare(`

      UPDATE portfolio_accounts

      SET gdty_sold_wei=gdty_sold_wei + ?,

          usdt_received_wei=usdt_received_wei + ?,

          realized_pnl_wei=realized_pnl_wei + ? -

            CASE WHEN (gdty_bought_wei-gdty_sold_wei)>0

                 THEN (? * cost_basis_wei) / (gdty_bought_wei-gdty_sold_wei)

                 ELSE 0 END,

          cost_basis_wei=CASE

            WHEN cost_basis_wei > CASE WHEN (gdty_bought_wei-gdty_sold_wei)>0

              THEN (? * cost_basis_wei) / (gdty_bought_wei-gdty_sold_wei) ELSE 0 END

            THEN cost_basis_wei - CASE WHEN (gdty_bought_wei-gdty_sold_wei)>0

              THEN (? * cost_basis_wei) / (gdty_bought_wei-gdty_sold_wei) ELSE 0 END

            ELSE 0 END,

          updated_at=?

      WHERE user_id=? AND (gdty_bought_wei-gdty_sold_wei)>=?

    `).bind(g,uAmt,uAmt,g,g,g,now,u.id,g),

    e.DB.prepare("UPDATE trades SET accounted_at=? WHERE id=? AND accounted_at IS NULL").bind(now,trade.id)

  ];

 

  const results=await e.DB.batch(statements);

  const updateResult=results[1];

  if(!Number(updateResult?.meta?.changes||0)){

    await e.DB.prepare("DELETE FROM trade_accounting WHERE trade_id=?").bind(trade.id).run();

    throw new Error("insufficient_verified_gdty_balance");

  }

}

 

 

async function reconcilePendingTrades(e,u){

  const rows=await e.DB.prepare("SELECT * FROM trades WHERE user_id=? AND ((status='pending') OR (status='confirmed' AND accounted_at IS NULL)) ORDER BY created_at ASC LIMIT 50").bind(u.id).all();

  for(const row of (rows.results||[])){

    try{

      const latest=parseInt(await rpc(e,"eth_blockNumber"),16);

      const confirmations=Math.max(0,latest-Number(row.block_number));

      if(row.status==='pending' && confirmations<12)continue;

      const receipt=await rpc(e,"eth_getTransactionReceipt",[row.tx_hash]);

      if(!receipt||receipt.status!=="0x1")continue;

      const timestamp=await blockTimestamp(e,row.block_number,row.block_timestamp);

      if(row.status==='pending'){

        await e.DB.prepare("UPDATE trades SET status='confirmed',confirmations=?,block_timestamp=?,verified_at=? WHERE id=? AND status='pending'")

          .bind(confirmations,timestamp,nowIso(),row.id).run();

      }

      const trade={

        id:row.id,tx_hash:row.tx_hash,side:row.side,gdty:row.gdty_amount_wei,usdt:row.usdt_amount_wei

      };

      await applyTradeAccounting(e,u,trade);

    }catch(err){

      console.error("GOLDITY pending trade reconciliation error",err);

    }

  }

}

 

 

async function recordTrade(e,u,trade) {

  const existing=await e.DB.prepare("SELECT id,status FROM trades WHERE tx_hash=?").bind(trade.txHash).first();

  if(existing)return {ok:false,error:"transaction_already_recorded"};

 

  const latest=parseInt(await rpc(e,"eth_blockNumber"),16);

  const confirmations=Math.max(0,latest-trade.block);

  const status=confirmations>=12?"confirmed":"pending";

  const tradeId=id(),now=nowIso();

  const timestamp=await blockTimestamp(e,trade.block,now);

  const price=formatWeiRatio(BigInt(trade.usdt),BigInt(trade.gdty),18);

 

  try{

    await e.DB.prepare(`

      INSERT INTO trades(id,user_id,wallet_address,tx_hash,block_number,block_timestamp,dex,pair_address,side,

      gdty_amount_wei,usdt_amount_wei,price_usdt_per_gdty,confirmations,status,created_at,verified_at,accounted_at)

      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)

    `).bind(

      tradeId,u.id,u.wallet_address,trade.txHash,trade.block,timestamp,trade.dex,trade.pair,trade.side,

      trade.gdty,trade.usdt,price,confirmations,status,now,status==="confirmed"?now:null,null

    ).run();

  }catch(err){

    if(String(err?.message||"").toLowerCase().includes("unique"))return {ok:false,error:"transaction_already_recorded"};

    throw err;

  }

 

  const stored={id:tradeId,tx_hash:trade.txHash,side:trade.side,gdty:trade.gdty,usdt:trade.usdt};

  if(status==="confirmed")await applyTradeAccounting(e,u,stored);

 

  return {ok:true,tradeId,status,confirmations,price};

}

 

 

async function dashboard(e,req) {

 

  const u=await currentUser(e,req);

 

  if(!u)return out({ok:false,error:"unauthorized"},401,cors(e));

 

  await reconcilePendingTrades(e,u);

 

  const refs=await e.DB.prepare("SELECT COUNT(*) AS count FROM users WHERE referred_by=?").bind(u.referral_code).first();

 

  const rewardRows=await e.DB.prepare(`

 

    SELECT reward_amount_wei,status FROM referral_rewards

 

    WHERE referrer_user_id=?

 

  `).bind(u.id).all();

 

  let rewardAvailable=0n,rewardTotal=0n;

 

  for(const r of (rewardRows.results||[])){

 

    const amount=BigInt(r.reward_amount_wei||"0");

 

    rewardTotal+=amount;

 

    if(r.status==="available")rewardAvailable+=amount;

 

  }

 

  const p=await e.DB.prepare("SELECT * FROM portfolio_accounts WHERE user_id=?").bind(u.id).first();

 

  const trades=await e.DB.prepare(`

 

    SELECT tx_hash AS txHash,dex,side,gdty_amount_wei AS gdtyAmountWei,usdt_amount_wei AS usdtAmountWei,

 

           status,confirmations,created_at AS createdAt

 

    FROM trades WHERE user_id=? ORDER BY created_at DESC LIMIT 50

 

  `).bind(u.id).all();

 

  const notifications=await e.DB.prepare(`

 

    SELECT id,type,title,message,read_at AS readAt,created_at AS createdAt

 

    FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 30

 

  `).bind(u.id).all();

 

  let wallet={connected:false};

 

  try{wallet=await walletData(e,u)}catch{}

 

  return out({

 

    ok:true,

 

    user:{

 

      id:u.id,email:u.email,firstName:u.first_name,lastName:u.last_name,country:u.country,

 

      phone:u.phone,walletAddress:u.wallet_address,referralCode:u.referral_code,referredBy:u.referred_by,

 

      role:u.role,createdAt:u.created_at,referrals:Number(refs?.count||0)

 

    },

 

    wallet,

 

    portfolio:{

 

      gdtyBoughtWei:p?.gdty_bought_wei||"0",gdtySoldWei:p?.gdty_sold_wei||"0",

 

      usdtSpentWei:p?.usdt_spent_wei||"0",usdtReceivedWei:p?.usdt_received_wei||"0",

 

      costBasisWei:p?.cost_basis_wei||"0",realizedPnlWei:p?.realized_pnl_wei||"0"

 

    },

 

    referralRewards:{availableWei:rewardAvailable.toString(),totalWei:rewardTotal.toString()},

    referralWithdrawal:{enabled:false,reason:"payout_not_configured"},

 

    trades:trades.results||[],

 

    notifications:notifications.results||[]

 

  },200,0,cors(e));

 

}

 

 

async function referralWithdrawalStatus(e,req){

  const u=await currentUser(e,req);

  if(!u)return out({ok:false,error:"unauthorized"},401,cors(e));

  const payout=await e.DB.prepare(`

    SELECT id,status,tx_hash AS txHash,amount_wei AS amountWei,created_at AS createdAt,

           broadcast_at AS broadcastAt,paid_at AS paidAt,error_message AS errorMessage

    FROM referral_payouts WHERE user_id=? ORDER BY created_at DESC LIMIT 1

  `).bind(u.id).first();

  return out({ok:true,payout:payout||null,enabled:false},200,0,cors(e));

}

 

async function referralWithdrawal(e,req){

  const u=await currentUser(e,req);

  if(!u)return out({ok:false,error:"unauthorized"},401,cors(e));

  if(!await requireOrigin(e,req))return out({ok:false,error:"forbidden"},403,cors(e));

  if(!await rateLimit(e,`withdraw:${u.id}`,3,60000))return out({ok:false,error:"rate_limited"},429,cors(e));

  // No signing key is bundled with the site. Until an independently secured

  // payout signer is configured in the Worker secret store, withdrawals stay

  // disabled rather than creating an unsafe or unverifiable payout flow.

  return out({ok:false,error:"payout_not_configured",message:"Referral withdrawals are temporarily unavailable."},503,cors(e));

}

 

 

async function logout(e,req) {

 

  if(!await requireOrigin(e,req))return out({ok:false,error:"forbidden"},403,cors(e));

 

  const m=req.headers.get("Cookie")||"", hit=m.match(/(?:^|;\s*)GDTY_SESSION=([^;]+)/);

 

  if(hit&&e.DB){

 

    const h=await sha256Text(hit[1]);

 

    await e.DB.prepare("DELETE FROM sessions WHERE token_hash=?").bind(h).run();

 

  }

 

  return out({ok:true},200,0,{...cors(e),"set-cookie":cookie("GDTY_SESSION","",0)});

 

}

 

 

async function createTicket(e,req) {

 

  const u=await currentUser(e,req);if(!u)return out({ok:false,error:"unauthorized"},401,cors(e));

 

  if(!await requireOrigin(e,req))return out({ok:false,error:"forbidden"},403,cors(e));

 

  const d=await req.json().catch(()=>({}));

 

  const category=clean(d.category,40),subject=clean(d.subject,160),message=clean(d.message,4000);

 

  const allowed=["Account","Wallet","Referral","Purchase","Technical","Security","Other"];

 

  if(!allowed.includes(category)||!subject||!message)return out({ok:false,error:"validation_failed"},400,cors(e));

 

  const tid=id(), number=`GDTY-${Date.now().toString(36).toUpperCase()}-${crypto.randomUUID().slice(0,6).toUpperCase()}`,now=nowIso();

 

  await e.DB.batch([

 

    e.DB.prepare("INSERT INTO support_tickets(id,ticket_number,user_id,category,subject,status,priority,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)").bind(tid,number,u.id,category,subject,"open","normal",now,now),

 

    e.DB.prepare("INSERT INTO support_messages(id,ticket_id,sender_user_id,sender_role,message,created_at) VALUES(?,?,?,?,?,?)").bind(id(),tid,u.id,"user",message,now)

 

  ]);

 

  return out({ok:true,ticket:{id:tid,ticketNumber:number,status:"open"}},201,cors(e));

 

}

 

 

async function ticketList(e,req) {

 

  const u=await currentUser(e,req);if(!u)return out({ok:false,error:"unauthorized"},401,cors(e));

 

  const rows=await e.DB.prepare("SELECT id,ticket_number AS ticketNumber,category,subject,status,priority,created_at AS createdAt,updated_at AS updatedAt FROM support_tickets WHERE user_id=? ORDER BY created_at DESC").bind(u.id).all();

 

  return out({ok:true,tickets:rows.results||[]},200,0,cors(e));

 

}

 

 

async function ticketMessages(e,req) {

 

  const u=await currentUser(e,req);if(!u)return out({ok:false,error:"unauthorized"},401,cors(e));

 

  const ticketId=clean(new URL(req.url).searchParams.get("ticket"),80);

 

  const t=await e.DB.prepare("SELECT id FROM support_tickets WHERE id=? AND user_id=?").bind(ticketId,u.id).first();

 

  if(!t)return out({ok:false,error:"not_found"},404,cors(e));

 

  const rows=await e.DB.prepare("SELECT id,sender_role AS senderRole,message,created_at AS createdAt,read_at AS readAt FROM support_messages WHERE ticket_id=? ORDER BY created_at ASC").bind(ticketId).all();

 

  return out({ok:true,messages:rows.results||[]},200,0,cors(e));

 

}

 

 

export default {

 

  async fetch(req,e) {

 

    const u=new URL(req.url);

 

    const baseHeaders=cors(e);

 

    if(req.method==="OPTIONS")return new Response(null,{status:204,headers:{

 

      ...baseHeaders,"access-control-allow-methods":"GET,POST,OPTIONS",

 

      "access-control-allow-headers":"content-type","access-control-max-age":"86400"

 

    }});

 

    try{

 

      if(u.pathname==="/api/register"&&req.method==="POST")return await registerUser(e,req);

 

      if(u.pathname==="/api/login"&&req.method==="POST")return await loginUser(e,req);

 

      if(u.pathname==="/api/verify-email"&&req.method==="GET")return await verifyEmail(e,req);

 

      if(u.pathname==="/api/logout"&&req.method==="POST")return await logout(e,req);

 

      if(u.pathname==="/api/me"&&req.method==="GET")return await dashboard(e,req);

 

      if(u.pathname==="/api/wallet/challenge"&&req.method==="POST")return await walletChallenge(e,req);

 

      if(u.pathname==="/api/wallet/verify"&&req.method==="POST")return await walletVerify(e,req);

 

      if(u.pathname==="/api/trade/verify"&&req.method==="POST"){

 

        const user=await currentUser(e,req);if(!user)return out({ok:false,error:"unauthorized"},401,baseHeaders);

 

        if(!await requireOrigin(e,req))return out({ok:false,error:"forbidden"},403,baseHeaders);

 

        if(!await rateLimit(e,`trade:${user.id}`,20,60000))return out({ok:false,error:"rate_limited"},429,baseHeaders);

 

        const d=await req.json().catch(()=>({})),txHash=String(d.txHash||"").toLowerCase();

 

        if(!txRe.test(txHash))return out({ok:false,error:"invalid_tx_hash"},400,baseHeaders);

 

        const trade=await verifyTrade(e,user,txHash);

 

        if(!trade.ok)return out(trade,400,baseHeaders);

 

        trade.txHash=txHash;

 

        return out(await recordTrade(e,user,trade),200,0,baseHeaders);

 

      }

 

      if(u.pathname==="/api/referral/withdraw"&&req.method==="POST")return await referralWithdrawal(e,req);

 

      if(u.pathname==="/api/referral/withdraw/status"&&req.method==="GET")return await referralWithdrawalStatus(e,req);

 

      if(u.pathname==="/api/referral/check"&&req.method==="GET"){

 

        const code=clean(u.searchParams.get("code"),32).toUpperCase();

 

        const row=code&&e.DB?await e.DB.prepare("SELECT referral_code FROM users WHERE referral_code=?").bind(code).first():null;

 

        return out({ok:true,valid:!!row,referralCode:row?.referral_code||null},200,30,baseHeaders);

 

      }

 

      if(u.pathname==="/api/support/tickets"&&req.method==="POST")return await createTicket(e,req);

 

      if(u.pathname==="/api/support/tickets"&&req.method==="GET")return await ticketList(e,req);

 

      if(u.pathname==="/api/support/messages"&&req.method==="GET")return await ticketMessages(e,req);

 

      if(u.pathname==="/api/market"){

 

        const pairResult=await safePair(e);

 

        const pp=pairResult.address;

 

        const [uni,pcs]=await Promise.all([

 

          safeInspect(e,A.UNI,"Uniswap V2"),

 

          pp

 

            ?safeInspect(e,pp,"PancakeSwap V2")

 

            :Promise.resolve({dex:"PancakeSwap V2",status:"unavailable",reason:pairResult.reason||"pair_not_found",pair:null})

 

        ]);

 

        const ref=mean(uni.price,pcs.price);

 

        const live=[uni,pcs].filter(x=>x.status==="live");

 

        return out({

 

          ok:true,

 

          network:"BNB Smart Chain",

 

          chainId:56,

 

          token:{name:"GOLDITY",symbol:"GDTY",address:A.G,decimals:18},

 

          quoteToken:{symbol:"USDT",address:A.U,decimals:18},

 

          referencePrice:ref,

 

          priceMethod:"Arithmetic mean of valid GDTY/USDT V2 pool prices",

 

          liquidityUsd:live.reduce((s,x)=>s+(x.liquidityUsd||0),0)||null,

          totalUsdtReserve:
  uni.status==="live" && pcs.status==="live"
    ? (uni.usdtReserve||0) + (pcs.usdtReserve||0)
    : null,

totalGdtyReserve:
  uni.status==="live" && pcs.status==="live"
    ? (uni.gdtyReserve||0) + (pcs.gdtyReserve||0)
    : null,

reserveMethod:"Sum of Uniswap V2 + PancakeSwap V2 pool reserves",

          markets:{uniswap:uni,pancakeswap:pcs},

 

          lastUpdated:nowIso(),

 

          dataStatus:ref===null?"unavailable":"live"

 

        },200,10,baseHeaders);

 

      }

 

      if(u.pathname==="/api/chart"){

 

        const pairResult=await safePair(e),pp=pairResult.address,range=(u.searchParams.get("range")||"1D").toUpperCase(),cfg=ranges[range];

 

        if(!cfg)return out({ok:false,error:"invalid_range",allowed:Object.keys(ranges)},400,0,baseHeaders);

 

        const [uni,pcs]=await Promise.allSettled([geckoOHLCV(e,A.UNI,cfg),geckoOHLCV(e,pp,cfg)]);

 

        const a=uni.status==="fulfilled"?normalize(uni.value,"Uniswap V2"):[],b=pcs.status==="fulfilled"?normalize(pcs.value,"PancakeSwap V2"):[];

 

        const candles=mergeReference(a,b);

 

        return out({ok:true,range,method:"Arithmetic mean of valid pool OHLC values by timestamp",candles,

 

          sources:{uniswap:{status:a.length?"live":"unavailable",pool:A.UNI,count:a.length},

 

          pancakeswap:{status:b.length?"live":"unavailable",pool:pp,count:b.length,reason:b.length?null:(pairResult.reason||"chart_provider_error")}},

 

          historyStatus:candles.length?"live":"unavailable",

 

          note:"Candles use indexed market data. No synthetic history is generated."

 

        },200,30,baseHeaders);

 

      }

 

      if(u.pathname==="/api/news"&&req.method==="GET"){

 

        if(!e.DB)return out({ok:true,items:[]},200,60,baseHeaders);

 

        const rows=await e.DB.prepare("SELECT slug,title,excerpt,category,published_at AS publishedAt FROM news WHERE status='published' ORDER BY published_at DESC LIMIT 50").all();

 

        return out({ok:true,items:rows.results||[]},200,60,baseHeaders);

 

      }

 

      if(u.pathname==="/api/resources"&&req.method==="GET"){

 

        if(!e.DB)return out({ok:true,items:[]},200,60,baseHeaders);

 

        const rows=await e.DB.prepare("SELECT slug,title,description,category,published_at AS publishedAt FROM resources WHERE status='published' ORDER BY published_at DESC LIMIT 100").all();

 

        return out({ok:true,items:rows.results||[]},200,60,baseHeaders);

 

      }

 

      if(e.ASSETS){

        const response=await e.ASSETS.fetch(req);

        const headers=new Headers(response.headers);

        headers.set("x-content-type-options","nosniff");

        headers.set("x-frame-options","DENY");

        headers.set("referrer-policy","strict-origin-when-cross-origin");

        headers.set("permissions-policy","camera=(), microphone=(), geolocation=()");

        headers.set("strict-transport-security","max-age=31536000; includeSubDomains");

        headers.set("cross-origin-opener-policy","same-origin");

        headers.set("content-security-policy","default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; form-action 'self'; upgrade-insecure-requests");

        return new Response(response.body,{status:response.status,statusText:response.statusText,headers});

      }

 

      return out({ok:false,error:"not_found"},404,0,baseHeaders);

 

    }catch(err){

 

      console.error("GOLDITY worker error",err);

 

      return out({ok:false,error:"internal_error"},500,0,baseHeaders);

 

    }

 

  }

 

};
