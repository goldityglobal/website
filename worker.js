import * as secp from "@noble/secp256k1";

import { keccak_256 } from "@noble/hashes/sha3.js";


const A = {

  G: "0x76D89e26502d0aA9bf83DA222cfCF12a27Ead801".toLowerCase(),

  U: "0x55d398326f99059fF775485246999027B3197955".toLowerCase(),

  UNI: "0x779fcD915CD293266676B81f9503EBE8CE751a6".toLowerCase(),

  PF: "0xca143ce32fe78f1f7019d7d551a6402fc5350c73".toLowerCase()

};

const REFERRAL_PAYOUT_WALLET = "0x4908aB7FCceb4D762B71C765c17dEa4456cbF22d".toLowerCase();

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


async function rpc(e, method, params = []) {

  const endpoints = [

    e.BSC_RPC_URL,

    "https://bsc-dataseed-public.bnbchain.org",

    "https://bsc-dataseed.nariox.org"

  ].filter(Boolean);


  let lastError = null;


  for (const endpoint of endpoints) {

    try {

      const r = await fetch(endpoint, {

        method: "POST",

        headers: {

          "content-type": "application/json"

        },

        body: JSON.stringify({

          jsonrpc: "2.0",

          id: 1,

          method,

          params

        })

      });


      const text = await r.text();


      if (!r.ok) {

        throw new Error(`rpc_http_${r.status}`);

      }


      let j;

      try {

        j = JSON.parse(text);

      } catch {

        throw new Error("rpc_invalid_json");

      }


      if (j.error) {

        throw new Error(

          `rpc_error_${j.error.code ?? "unknown"}`

        );

      }


      if (!("result" in j)) {

        throw new Error("rpc_missing_result");

      }


      return j.result;

    } catch (err) {

      lastError = err;


      console.error("GOLDITY RPC endpoint failed", {

        endpoint,

        method,

        error: err instanceof Error ? err.message : String(err)

      });

    }

  }


  throw lastError || new Error("rpc_unavailable");

}


async function call(e,to,data) {

  return rpc(e,"eth_call",[{to,data},"latest"]);

}


async function pair(e) {

  return addr(await call(e,A.PF,S.pair + pad(A.G) + pad(A.U)));

}


async function inspect(e,p,dex) {

  if (!p || p===Z) return {dex,status:"unavailable",reason:"pair_not_found"};

  const [x0,x1] = await Promise.all([call(e,p,S.t0),call(e,p,S.t1)]);

  const t0=addr(x0), t1=addr(x1);

  if (!((t0===A.G&&t1===A.U)||(t0===A.U&&t1===A.G)))

    return {dex,status:"unavailable",reason:"token_mismatch",pair:p};

  const [rr,d0x,d1x] = await Promise.all([call(e,p,S.r),call(e,t0,S.dec),call(e,t1,S.dec)]);

  const r0=Number(uint("0x"+rr.slice(2,66)))/10**Number(uint(d0x));

  const r1=Number(uint("0x"+rr.slice(66,130)))/10**Number(uint(d1x));

  const g=t0===A.G?r0:r1, u=t0===A.U?r0:r1;

  return {dex,status:g>0?"live":"unavailable",pair:p,gdtyReserve:g,usdtReserve:u,price:g?u/g:null,liquidityUsd:g?2*u:null};

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


async function hashPassword(password,saltBytes,iterations=120000) {

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

  if(origin && origin!==(e.PUBLIC_ORIGIN||"https://goldityglobal.com")) return false;

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


    if(!r)

      return out({ok:false,error:"invalid_referral",message:"The referral code is not valid."},400,cors(e));


    referredBy=r.referral_code;

  }


  let code=await makeReferralCode(e);

  const salt=crypto.getRandomValues(new Uint8Array(16));

  const hash=await hashPassword(password,salt);

  const uid=id(), now=nowIso();


  try{

    await e.DB.prepare(`

      INSERT INTO users(

        id,email,password_hash,first_name,last_name,country,phone,referral_code,referred_by,

        email_verified,terms_version,privacy_version,age_confirmed,marketing_consent,

        created_at,updated_at

      )

      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)

    `).bind(

      uid,email,hash,first,last,country,phone,code,referredBy,

      0,TERMS_VERSION,PRIVACY_VERSION,1,d.marketingConsent?1:0,now,now

    ).run();

  }catch{

    return out({ok:false,error:"registration_failed",message:"Account creation failed. Please try again."},500,cors(e));

  }


  const raw=token(), tokenHash=await sha256Text(raw), exp=new Date(Date.now()+86400000).toISOString();


  await e.DB.prepare(`

    INSERT INTO email_verification_tokens(token_hash,user_id,expires_at,created_at)

    VALUES(?,?,?,?)

  `).bind(tokenHash,uid,exp,now).run();


  let emailSent=false;


  if(e.RESEND_API_KEY&&e.FROM_EMAIL){

    const link=`${e.PUBLIC_ORIGIN||"https://goldityglobal.com"}/verify-email.html?token=${encodeURIComponent(raw)}`;


    const r=await fetch("https://api.resend.com/emails",{

      method:"POST",

      headers:{

        authorization:`Bearer ${e.RESEND_API_KEY}`,

        "content-type":"application/json"

      },

      body:JSON.stringify({

        from:e.FROM_EMAIL,

        to:[email],

        subject:"Verify your GOLDITY account",

        html:`<div style="font-family:Arial;background:#080808;color:#f5f0e6;padding:32px"><h2>Welcome to GOLDITY</h2><p>Hello ${htmlEscape(first)},</p><p>Verify your email to activate your account.</p><p><a href="${htmlEscape(link)}">Verify Email</a></p></div>`

      })

    }).catch(()=>null);


    emailSent=!!r?.ok;

  }


  return out({

    ok:true,

    status:"pending_email_verification",

    emailSent,

    user:{

      id:uid,

      email,

      firstName:first,

      lastName:last,

      country,

      referralCode:code,

      referredBy,

      createdAt:now

    }

  },201,cors(e));

}


async function makeReferralCode(e) {

  for(let i=0;i<8;i++){

    const c="GDTY-"+crypto.randomUUID().replace(/-/g,"").slice(0,8).toUpperCase();


    if(!await e.DB.prepare(

      "SELECT id FROM users WHERE referral_code=?"

    ).bind(c).first())return c;

  }


  throw new Error("referral_code_generation_failed");

}


async function verifyEmail(e,req) {

  if(!e.DB)return out({ok:false,error:"registration_not_configured"},503,cors(e));


  const raw=new URL(req.url).searchParams.get("token")||"";


  if(!raw)

    return out({ok:false,error:"invalid_token"},400,cors(e));


  const h=await sha256Text(raw);


  const row=await e.DB.prepare(`

    SELECT *

    FROM email_verification_tokens

    WHERE token_hash=?

      AND used_at IS NULL

  `).bind(h).first();


  if(!row||new Date(row.expires_at)<=new Date())

    return out({

      ok:false,

      error:"expired_or_invalid_token",

      message:"This verification link is invalid or expired."

    },400,cors(e));


  const now=nowIso();


  await e.DB.batch([

    e.DB.prepare(`

      UPDATE users

      SET email_verified=1,updated_at=?

      WHERE id=?

    `).bind(now,row.user_id),


    e.DB.prepare(`

      UPDATE email_verification_tokens

      SET used_at=?

      WHERE token_hash=?

    `).bind(now,h)

  ]);


  return out({

    ok:true,

    message:"Email verified. Your GOLDITY account is now active."

  },200,0,cors(e));

}


function bytes(hexString) {

  const h=hexString.replace(/^0x/i,"");

  const a=new Uint8Array(h.length/2);


  for(let i=0;i<a.length;i++)

    a[i]=parseInt(h.slice(i*2,i*2+2),16);


  return a;

}


function eip191Digest(message) {

  const m=enc.encode(message);


  return keccak_256(

    enc.encode(

      `\x19Ethereum Signed Message:\n${m.length}${message}`

    )

  );

}


function recoveredAddress(signatureHex,message) {

  const raw=bytes(signatureHex);


  if(raw.length!==65)

    throw new Error("invalid_signature");


  let v=raw[64];


  if(v>=27)v-=27;

  if(v>1)throw new Error("invalid_signature");


  const sig=new Uint8Array(65);

  sig.set(raw.slice(0,64));

  sig[64]=v;


  const pub=secp.recoverPublicKey(

    sig,

    eip191Digest(message),

    {prehash:false}

  );


  const uncompressed=pub.length===65?pub.slice(1):pub;

  const h=keccak_256(uncompressed);


  return "0x"+

    [...h.slice(-20)]

      .map(x=>x.toString(16).padStart(2,"0"))

      .join("");

}


function bytesToHex(a) {

  return "0x"+[...new Uint8Array(a)]

    .map(x=>x.toString(16).padStart(2,"0"))

    .join("");

}


function concatBytes(...parts) {

  const total=parts.reduce((n,p)=>n+p.length,0);

  const out=new Uint8Array(total);

  let offset=0;

  for(const part of parts){

    out.set(part,offset);

    offset+=part.length;

  }

  return out;

}


function bigIntBytes(v) {

  const n=BigInt(v);

  if(n<0n)throw new Error("negative_integer");

  if(n===0n)return new Uint8Array();

  let h=n.toString(16);

  if(h.length%2)h="0"+h;

  return bytes("0x"+h);

}


function rlpLengthPrefix(length,offset) {

  if(length<=55)

    return new Uint8Array([offset+length]);


  const lenBytes=bigIntBytes(BigInt(length));

  return concatBytes(

    new Uint8Array([offset+55+lenBytes.length]),

    lenBytes

  );

}


function rlpEncode(value) {

  if(value instanceof Uint8Array){

    if(value.length===1&&value[0]<0x80)

      return value;


    return concatBytes(

      rlpLengthPrefix(value.length,0x80),

      value

    );

  }


  if(Array.isArray(value)){

    const payload=concatBytes(...value.map(rlpEncode));

    return concatBytes(

      rlpLengthPrefix(payload.length,0xc0),

      payload

    );

  }


  throw new Error("invalid_rlp_value");

}


function referralTransferData(recipient,amountWei) {

  if(!walletRe.test(recipient))

    throw new Error("invalid_wallet");


  const amount=BigInt(amountWei);

  if(amount<=0n)

    throw new Error("invalid_payout_amount");


  return "0xa9059cbb"+

    pad(recipient)+

    amount.toString(16).padStart(64,"0");

}


function getReferralPayoutPrivateKey(e) {

  const raw=String(e.REFERRAL_PAYOUT_PRIVATE_KEY||"")

    .trim()

    .replace(/^0x/i,"");


  if(!/^[0-9a-fA-F]{64}$/.test(raw))

    throw new Error("payout_key_not_configured");


  const priv=bytes("0x"+raw);

  const pub=secp.getPublicKey(priv,false);

  const derived="0x"+[...keccak_256(pub.slice(1)).slice(-20)].map(x=>x.toString(16).padStart(2,"0")).join("").toLowerCase();


  if(derived!==REFERRAL_PAYOUT_WALLET)

    throw new Error("payout_key_wallet_mismatch");


  return priv;

}


async function buildReferralPayoutTx(payout,privateKey) {

  const nonce=BigInt(payout.nonce);

  const gasPrice=BigInt(payout.gas_price_wei);

  const gasLimit=BigInt(payout.gas_limit);

  const amount=BigInt(payout.amount_wei);

  const data=bytes(referralTransferData(payout.wallet_address,amount));


  const signing=rlpEncode([

    bigIntBytes(nonce),

    bigIntBytes(gasPrice),

    bigIntBytes(gasLimit),

    bytes(A.G),

    bigIntBytes(0n),

    data,

    bigIntBytes(56n),

    new Uint8Array(),

    new Uint8Array()

  ]);


  const digest=keccak_256(signing);

  const sigBytes=await secp.signAsync(

    digest,

    privateKey,

    {prehash:false,format:"recovered"}

  );


  const recovery=Number(sigBytes[0]);

  if(recovery!==0&&recovery!==1)

    throw new Error("invalid_signature_recovery");


  const sigR=BigInt("0x"+Array.from(sigBytes.slice(1,33))

    .map(x=>x.toString(16).padStart(2,"0")).join(""));

  const sigS=BigInt("0x"+Array.from(sigBytes.slice(33,65))

    .map(x=>x.toString(16).padStart(2,"0")).join(""));


  const v=35n+(56n*2n)+BigInt(recovery);


  const raw=bytesToHex(

    rlpEncode([

      bigIntBytes(nonce),

      bigIntBytes(gasPrice),

      bigIntBytes(gasLimit),

      bytes(A.G),

      bigIntBytes(0n),

      data,

      bigIntBytes(v),

      bigIntBytes(sigR),

      bigIntBytes(sigS)

    ])

  );


  return {

    raw,

    hash:bytesToHex(keccak_256(bytes(raw))),

    nonce,

    gasPrice,

    gasLimit

  };

}


async function referralGasPlan(e,wallet,amountWei) {

  const data=referralTransferData(wallet,amountWei);


  const gasPrice=BigInt(await rpc(e,"eth_gasPrice"));

  let gasEstimate;


  try{

    gasEstimate=BigInt(

      await rpc(e,"eth_estimateGas",[{

        from:REFERRAL_PAYOUT_WALLET,

        to:A.G,

        value:"0x0",

        data

      },"latest"])

    );

  }catch{

    gasEstimate=65000n;

  }


  const gasLimit=

    gasEstimate>0n

      ?(gasEstimate*120n+99n)/100n

      :65000n;


  return {

    gasPrice,

    gasLimit

  };

}


async function nextReferralPayoutNonce(e) {

  const [chainHex,maxRow]=await Promise.all([

    rpc(e,"eth_getTransactionCount",[REFERRAL_PAYOUT_WALLET,"pending"]),

    e.DB.prepare(

      "SELECT MAX(nonce) AS max_nonce FROM referral_payouts WHERE nonce IS NOT NULL"

    ).first()

  ]);


  const chainNonce=BigInt(chainHex);

  const maxDbNonce=

    maxRow?.max_nonce===null||

    maxRow?.max_nonce===undefined

      ?-1n

      :BigInt(maxRow.max_nonce);


  return chainNonce>maxDbNonce

    ?chainNonce

    :maxDbNonce+1n;

}


async function reserveReferralPayout(e,u,wallet,amountWei,gasPrice,gasLimit) {

  for(let attempt=0;attempt<6;attempt++){

    const nonce=await nextReferralPayoutNonce(e);

    const payoutId=id();

    const now=nowIso();


    try{

      const results=await e.DB.batch([

        e.DB.prepare(`

          INSERT INTO referral_payouts(

            id,user_id,wallet_address,amount_wei,status,tx_hash,

            created_at,broadcast_at,paid_at,error_message,

            nonce,gas_price_wei,gas_limit

          )

          VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)

        `).bind(

          payoutId,

          u.id,

          wallet,

          amountWei.toString(),

          "processing",

          null,

          now,

          null,

          null,

          null,

          nonce.toString(),

          gasPrice.toString(),

          gasLimit.toString()

        ),

        e.DB.prepare(`

          UPDATE referral_rewards

          SET status='processing',payout_id=?

          WHERE referrer_user_id=?

            AND status='available'

            AND payout_id IS NULL

        `).bind(payoutId,u.id)

      ]);


      const changes=Number(results?.[1]?.meta?.changes||0);

      if(changes>0){

        const payout=await e.DB.prepare(

          "SELECT * FROM referral_payouts WHERE id=?"

        ).bind(payoutId).first();


        if(!payout)

          throw new Error("payout_reservation_missing");


        return payout;

      }


      await e.DB.prepare(`

        UPDATE referral_payouts

        SET status='failed',

            error_message='No available referral rewards remained during reservation.'

        WHERE id=? AND status='processing'

      `).bind(payoutId).run();


      throw new Error("no_rewards_available");

    }catch(err){

      const active=await e.DB.prepare(`

        SELECT *

        FROM referral_payouts

        WHERE user_id=?

          AND status IN ('processing','broadcast')

        ORDER BY created_at DESC

        LIMIT 1

      `).bind(u.id).first();


      if(active)

        return {existing:true,payout:active};


      const message=err instanceof Error?err.message:String(err);


      if(

        message.includes("UNIQUE")||

        message.includes("unique constraint")||

        message.includes("idx_referral_payouts_nonce")||

        message.includes("idx_referral_payouts_active_user")

      )

        continue;


      throw err;

    }

  }


  throw new Error("payout_nonce_reservation_failed");

}


async function failReferralPayoutBeforeBroadcast(e,payout,errorMessage) {

  await e.DB.batch([

    e.DB.prepare(`

      UPDATE referral_rewards

      SET status='available',

          payout_id=NULL,

          paid_at=NULL,

          payout_tx_hash=NULL

      WHERE payout_id=? AND status='processing'

    `).bind(payout.id),


    e.DB.prepare(`

      UPDATE referral_payouts

      SET status='failed',

          nonce=NULL,

          gas_price_wei=NULL,

          gas_limit=NULL,

          tx_hash=NULL,

          error_message=?

      WHERE id=? AND status='processing'

    `).bind(

      clean(errorMessage,500),

      payout.id

    )

  ]);

}


async function finalizeReferralPayout(e,payout,receipt) {

  const now=nowIso();

  const success=String(receipt?.status||"").toLowerCase()==="0x1";


  if(success){

    await e.DB.batch([

      e.DB.prepare(`

        UPDATE referral_rewards

        SET status='paid',

            paid_at=?,

            payout_tx_hash=?

        WHERE payout_id=? AND status='processing'

      `).bind(now,payout.tx_hash,payout.id),


      e.DB.prepare(`

        UPDATE referral_payouts

        SET status='paid',

            paid_at=?,

            error_message=NULL

        WHERE id=? AND status IN ('processing','broadcast')

      `).bind(now,payout.id)

    ]);


    return {

      ok:true,

      status:"paid",

      payoutId:payout.id,

      amountWei:payout.amount_wei,

      txHash:payout.tx_hash

    };

  }


  await e.DB.batch([

    e.DB.prepare(`

      UPDATE referral_rewards

      SET status='available',

          payout_id=NULL,

          paid_at=NULL,

          payout_tx_hash=NULL

      WHERE payout_id=? AND status='processing'

    `).bind(payout.id),


    e.DB.prepare(`

      UPDATE referral_payouts

      SET status='failed',

          paid_at=NULL,

          error_message=?

      WHERE id=? AND status IN ('processing','broadcast')

    `).bind(

      "The BSC payout transaction failed on-chain.",

      payout.id

    )

  ]);


  return {

    ok:false,

    status:"failed",

    payoutId:payout.id,

    amountWei:payout.amount_wei,

    txHash:payout.tx_hash,

    error:"payout_transaction_failed"

  };

}


async function processReferralPayout(e,payout,privateKey) {

  let txHash=String(payout.tx_hash||"").toLowerCase();

  let receipt=null;

  let tx=null;


  try{

    if(txHash){

      tx=await rpc(

        e,

        "eth_getTransactionByHash",

        [txHash]

      );


      receipt=await rpc(

        e,

        "eth_getTransactionReceipt",

        [txHash]

      );


      if(receipt)

        return await finalizeReferralPayout(e,payout,receipt);


      if(tx){

        if(payout.status!=="broadcast"){

          await e.DB.prepare(`

            UPDATE referral_payouts

            SET status='broadcast',broadcast_at=COALESCE(broadcast_at,?)

            WHERE id=? AND status='processing'

          `).bind(nowIso(),payout.id).run();

        }


        return {

          ok:true,

          status:"broadcast",

          payoutId:payout.id,

          amountWei:payout.amount_wei,

          txHash

        };

      }

    }


    if(

      payout.nonce===null||

      payout.nonce===undefined||

      payout.gas_price_wei===null||

      payout.gas_price_wei===undefined||

      payout.gas_limit===null||

      payout.gas_limit===undefined

    ){

      return {

        ok:false,

        status:payout.status,

        payoutId:payout.id,

        amountWei:payout.amount_wei,

        txHash:txHash||null,

        error:"payout_recovery_data_missing"

      };

    }


    const built=await buildReferralPayoutTx(payout,privateKey);


    if(txHash&&txHash!==built.hash.toLowerCase())

      return {

        ok:false,

        status:"processing",

        payoutId:payout.id,

        amountWei:payout.amount_wei,

        txHash,

        error:"payout_transaction_integrity_mismatch"

      };


    txHash=built.hash.toLowerCase();


    if(!payout.tx_hash){

      await e.DB.prepare(`

        UPDATE referral_payouts

        SET tx_hash=?

        WHERE id=? AND status='processing' AND tx_hash IS NULL

      `).bind(txHash,payout.id).run();

    }


    const [gdty,bnb]=await Promise.all([

      tokenBalance(e,A.G,REFERRAL_PAYOUT_WALLET),

      rpc(e,"eth_getBalance",[REFERRAL_PAYOUT_WALLET,"latest"]).then(BigInt)

    ]);


    const amount=BigInt(payout.amount_wei);

    const gasCost=built.gasPrice*built.gasLimit;


    if(gdty<amount){

      await failReferralPayoutBeforeBroadcast(

        e,

        payout,

        "Referral payout wallet has insufficient GDTY balance."

      );


      return {

        ok:false,

        status:"failed",

        payoutId:payout.id,

        amountWei:payout.amount_wei,

        txHash:null,

        error:"insufficient_payout_gdty"

      };

    }


    if(bnb<gasCost){

      await failReferralPayoutBeforeBroadcast(

        e,

        payout,

        "Referral payout wallet has insufficient BNB for network fees."

      );


      return {

        ok:false,

        status:"failed",

        payoutId:payout.id,

        amountWei:payout.amount_wei,

        txHash:null,

        error:"insufficient_payout_bnb"

      };

    }


    try{

      const sent=String(

        await rpc(e,"eth_sendRawTransaction",[built.raw])

      ).toLowerCase();


      if(sent!==txHash){

        const seen=await rpc(

          e,

          "eth_getTransactionByHash",

          [txHash]

        );


        if(!seen)

          return {

            ok:false,

            status:"processing",

            payoutId:payout.id,

            amountWei:payout.amount_wei,

            txHash,

            error:"payout_hash_mismatch"

          };

      }

    }catch(err){

      const seen=await rpc(

        e,

        "eth_getTransactionByHash",

        [txHash]

      ).catch(()=>null);


      if(!seen){

        return {

          ok:false,

          status:"processing",

          payoutId:payout.id,

          amountWei:payout.amount_wei,

          txHash,

          error:"payout_broadcast_pending_retry"

        };

      }

    }


    await e.DB.prepare(`

      UPDATE referral_payouts

      SET status='broadcast',

          broadcast_at=COALESCE(broadcast_at,?),

          error_message=NULL

      WHERE id=? AND status='processing'

    `).bind(nowIso(),payout.id).run();


    const immediateReceipt=await rpc(

      e,

      "eth_getTransactionReceipt",

      [txHash]

    );


    if(immediateReceipt)

      return await finalizeReferralPayout(

        e,

        {...payout,tx_hash:txHash},

        immediateReceipt

      );


    return {

      ok:true,

      status:"broadcast",

      payoutId:payout.id,

      amountWei:payout.amount_wei,

      txHash

    };

  }catch(err){

    console.error(

      "GOLDITY referral payout processing error",

      err instanceof Error?err.message:String(err)

    );


    const current=await e.DB.prepare(

      "SELECT status FROM referral_payouts WHERE id=?"

    ).bind(payout.id).first().catch(()=>null);


    const status=String(

      current?.status||payout.status||"processing"

    );


    return {

      ok:status==="broadcast",

      status,

      payoutId:payout.id,

      amountWei:payout.amount_wei,

      txHash:txHash||null,

      error:"payout_processing_error"

    };

  }

}


async function referralActiveGasCommitment(e) {

  const rows=await e.DB.prepare(`

    SELECT gas_price_wei,gas_limit

    FROM referral_payouts

    WHERE status IN ('processing','broadcast')

      AND gas_price_wei IS NOT NULL

      AND gas_limit IS NOT NULL

  `).all();


  let total=0n;


  for(const row of (rows.results||[])){

    try{

      const gasPrice=BigInt(row.gas_price_wei);

      const gasLimit=BigInt(row.gas_limit);


      if(gasPrice>0n&&gasLimit>0n)

        total+=gasPrice*gasLimit;

    }catch{

      // Ignore malformed historical commitment rows; processing will fail safely.

    }

  }


  return total;

}


async function referralWithdraw(e,req) {

  const u=await currentUser(e,req);


  if(!u)

    return out(

      {ok:false,error:"unauthorized"},

      401,

      0,

      cors(e)

    );


  if(!await requireOrigin(e,req))

    return out(

      {ok:false,error:"forbidden"},

      403,

      0,

      cors(e)

    );


  if(!await rateLimit(

    e,

    `referral_withdraw:${u.id}`,

    3,

    60000

  ))

    return out(

      {ok:false,error:"rate_limited"},

      429,

      0,

      cors(e)

    );


  if(!e.DB)

    return out(

      {ok:false,error:"database_not_configured"},

      503,

      0,

      cors(e)

    );


  if(!u.wallet_address||!walletRe.test(u.wallet_address))

    return out(

      {ok:false,error:"wallet_not_connected",message:"Please connect and verify your BNB Smart Chain wallet before withdrawing."},

      400,

      0,

      cors(e)

    );


  const wallet=String(u.wallet_address).toLowerCase();


  const verified=await e.DB.prepare(`

    SELECT address

    FROM wallets

    WHERE user_id=?

      AND address=?

      AND chain_id=56

      AND verified=1

    LIMIT 1

  `).bind(u.id,wallet).first();


  if(!verified)

    return out(

      {ok:false,error:"wallet_not_verified",message:"Your wallet must be verified before withdrawing referral rewards."},

      403,

      0,

      cors(e)

    );


  let privateKey;

  try{

    privateKey=getReferralPayoutPrivateKey(e);

  }catch(err){

    const code=err instanceof Error?err.message:"payout_key_not_configured";


    console.error("GOLDITY referral payout key error",code);


    return out(

      {ok:false,error:code==="payout_key_wallet_mismatch"?"payout_wallet_mismatch":"payout_not_configured"},

      503,

      0,

      cors(e)

    );

  }


  const active=await e.DB.prepare(`

    SELECT *

    FROM referral_payouts

    WHERE user_id=?

      AND status IN ('processing','broadcast')

    ORDER BY created_at DESC

    LIMIT 1

  `).bind(u.id).first();


  if(active){

    const result=await processReferralPayout(

      e,

      active,

      privateKey

    );


    return out(

      result,

      result.status==="failed"?502:200,

      0,

      cors(e)

    );

  }


  const rewardRows=await e.DB.prepare(`

    SELECT id,reward_amount_wei

    FROM referral_rewards

    WHERE referrer_user_id=?

      AND status='available'

      AND payout_id IS NULL

    ORDER BY created_at ASC

  `).bind(u.id).all();


  const rewards=rewardRows.results||[];

  let amount=0n;


  for(const r of rewards)

    amount+=BigInt(r.reward_amount_wei||"0");


  if(amount<=0n)

    return out(

      {ok:false,error:"no_rewards_available",message:"There are no referral rewards available for withdrawal."},

      400,

      0,

      cors(e)

    );


  const [gdty,bnb,gas]=await Promise.all([

    tokenBalance(e,A.G,REFERRAL_PAYOUT_WALLET),

    rpc(e,"eth_getBalance",[REFERRAL_PAYOUT_WALLET,"latest"]).then(BigInt),

    referralGasPlan(e,wallet,amount)

  ]);


  if(gdty<amount)

    return out(

      {ok:false,error:"insufficient_payout_gdty",message:"The referral payout wallet does not currently have enough GDTY to complete this withdrawal."},

      400,

      0,

      cors(e)

    );


  const gasCost=gas.gasPrice*gas.gasLimit;

  const activeGasCommitment=await referralActiveGasCommitment(e);


  if(bnb<activeGasCommitment+gasCost)

    return out(

      {ok:false,error:"insufficient_payout_bnb",message:"The referral payout wallet does not currently have enough BNB to cover this withdrawal and the network fees already reserved for other payouts."},

      400,

      0,

      cors(e)

    );


  let reserved;


  try{

    reserved=await reserveReferralPayout(

      e,

      u,

      wallet,

      amount,

      gas.gasPrice,

      gas.gasLimit

    );

  }catch(err){

    const code=err instanceof Error?err.message:"payout_reservation_failed";


    console.error(

      "GOLDITY referral payout reservation error",

      code

    );


    if(code==="no_rewards_available")

      return out(

        {ok:false,error:"no_rewards_available"},

        400,

        0,

        cors(e)

      );


    return out(

      {ok:false,error:"payout_reservation_failed"},

      503,

      0,

      cors(e)

    );

  }


  if(!reserved?.existing){

    const postReserveBnb=BigInt(await rpc(

      e,

      "eth_getBalance",

      [REFERRAL_PAYOUT_WALLET,"latest"]

    ));

    const postReserveCommitment=await referralActiveGasCommitment(e);


    if(postReserveBnb<postReserveCommitment){

      await failReferralPayoutBeforeBroadcast(

        e,

        reserved,

        "insufficient_payout_bnb_after_reservation"

      );


      return out(

        {ok:false,error:"insufficient_payout_bnb",message:"The referral payout wallet does not currently have enough BNB to cover all reserved payout network fees."},

        400,

        0,

        cors(e)

      );

    }

  }


  if(reserved?.existing){

    const result=await processReferralPayout(

      e,

      reserved.payout,

      privateKey

    );


    return out(

      result,

      result.status==="failed"?502:200,

      0,

      cors(e)

    );

  }


  const result=await processReferralPayout(

    e,

    reserved,

    privateKey

  );


  return out(

    result,

    result.status==="failed"?502:200,

    0,

    cors(e)

  );

}


async function referralWithdrawStatus(e,req) {

  const u=await currentUser(e,req);


  if(!u)

    return out(

      {ok:false,error:"unauthorized"},

      401,

      0,

      cors(e)

    );


  if(!await requireOrigin(e,req))

    return out(

      {ok:false,error:"forbidden"},

      403,

      0,

      cors(e)

    );


  const latest=await e.DB.prepare(`

    SELECT *

    FROM referral_payouts

    WHERE user_id=?

    ORDER BY created_at DESC

    LIMIT 1

  `).bind(u.id).first();


  let payout=latest;


  if(

    payout &&

    (payout.status==='processing'||payout.status==='broadcast')

  ){

    try{

      const privateKey=getReferralPayoutPrivateKey(e);

      await processReferralPayout(e,payout,privateKey);


      payout=await e.DB.prepare(`

        SELECT *

        FROM referral_payouts

        WHERE id=?

        LIMIT 1

      `).bind(payout.id).first();

    }catch(err){

      console.error(

        "GOLDITY referral payout status recovery error",

        err instanceof Error?err.message:String(err)

      );

    }

  }


  const responsePayout=payout

    ?{

      id:payout.id,

      amountWei:payout.amount_wei,

      status:payout.status,

      txHash:payout.tx_hash,

      createdAt:payout.created_at,

      broadcastAt:payout.broadcast_at,

      paidAt:payout.paid_at,

      errorMessage:payout.error_message

    }

    :null;


  return out(

    {

      ok:true,

      payout:responsePayout

    },

    200,

    0,

    cors(e)

  );

}


async function walletChallenge(e,req) {

  const u=await currentUser(e,req);


  if(!u)

    return out({ok:false,error:"unauthorized"},401,cors(e));


  if(!await requireOrigin(e,req))

    return out({ok:false,error:"forbidden"},403,cors(e));


  const d=await req.json().catch(()=>({}));

  const address=String(d.address||"").toLowerCase();


  if(!walletRe.test(address))

    return out({ok:false,error:"invalid_wallet"},400,cors(e));


  const existing=await e.DB.prepare(

    "SELECT user_id FROM wallets WHERE address=?"

  ).bind(address).first();


  if(existing&&existing.user_id!==u.id)

    return out({ok:false,error:"wallet_already_bound"},409,cors(e));


  const challengeId=id();

  const nonce=token();


  const message=[

    "GOLDITY Wallet Verification",

    `Domain: ${e.PUBLIC_ORIGIN||"https://goldityglobal.com"}`,

    `Wallet: ${address}`,

    `Nonce: ${nonce}`,

    "Purpose: Link this wallet to your GOLDITY account.",

    "This signature does not authorize a blockchain transaction."

  ].join("\n");


  const exp=new Date(

    Date.now()+10*60*1000

  ).toISOString();


  await e.DB.prepare(`

    DELETE FROM wallet_challenges

    WHERE user_id=?

      AND used_at IS NULL

  `).bind(u.id).run();


  await e.DB.prepare(`

    INSERT INTO wallet_challenges(

      id,user_id,wallet_address,nonce,message,expires_at,created_at

    )

    VALUES(?,?,?,?,?,?,?)

  `).bind(

    challengeId,

    u.id,

    address,

    nonce,

    message,

    exp,

    nowIso()

  ).run();


  return out({

    ok:true,

    challengeId,

    message,

    expiresAt:exp

  },200,0,cors(e));

}


async function walletVerify(e,req) {

  const u=await currentUser(e,req);


  if(!u)

    return out({ok:false,error:"unauthorized"},401,cors(e));


  if(!await requireOrigin(e,req))

    return out({ok:false,error:"forbidden"},403,cors(e));


  const d=await req.json().catch(()=>({}));


  const ch=await e.DB.prepare(`

    SELECT *

    FROM wallet_challenges

    WHERE id=?

      AND user_id=?

      AND used_at IS NULL

  `).bind(d.challengeId,u.id).first();


  if(!ch||new Date(ch.expires_at)<=new Date())

    return out({ok:false,error:"challenge_expired"},400,cors(e));


  const recovered=recoveredAddress(

    String(d.signature||""),

    ch.message

  );


  if(recovered!==String(ch.wallet_address).toLowerCase())

    return out({ok:false,error:"signature_mismatch"},401,cors(e));


  const bound=await e.DB.prepare(

    "SELECT user_id FROM wallets WHERE address=?"

  ).bind(recovered).first();


  if(bound&&bound.user_id!==u.id)

    return out({ok:false,error:"wallet_already_bound"},409,cors(e));


  const now=nowIso();


  await e.DB.batch([

    e.DB.prepare(`

      INSERT INTO wallets(

        id,user_id,address,chain_id,verified,verified_at,created_at,updated_at

      )

      VALUES(?,?,?,?,?,?,?,?)

      ON CONFLICT(address) DO UPDATE SET

        user_id=excluded.user_id,

        verified=1,

        verified_at=excluded.verified_at,

        updated_at=excluded.updated_at

    `).bind(

      id(),u.id,recovered,56,1,now,now,now

    ),


    e.DB.prepare(`

      UPDATE users

      SET wallet_address=?,updated_at=?

      WHERE id=?

    `).bind(recovered,now,u.id),


    e.DB.prepare(`

      UPDATE wallet_challenges

      SET used_at=?

      WHERE id=?

    `).bind(now,ch.id)

  ]);


  return out({

    ok:true,

    address:recovered

  },200,0,cors(e));

}


async function tokenBalance(e,tokenAddress,account) {

  const raw=await call(

    e,

    tokenAddress,

    S.balanceOf+pad(account)

  );


  return raw ? BigInt(raw) : 0n;

}


async function walletData(e,u) {

  const address=u.wallet_address;


  if(!address||!walletRe.test(address))

    return {connected:false};


  const [gdty,usdt,bnb]=await Promise.all([

    tokenBalance(e,A.G,address),

    tokenBalance(e,A.U,address),

    rpc(e,"eth_getBalance",[address,"latest"]).then(BigInt)

  ]);


  return {

    connected:true,

    address,

    gdtyWei:gdty.toString(),

    usdtWei:usdt.toString(),

    bnbWei:bnb.toString()

  };

}


function parseTransfer(log) {

  if(

    String(log.topics?.[0]).toLowerCase()!==TOPIC_TRANSFER

  )return null;


  if(

    !log.topics?.[1]||

    !log.topics?.[2]||

    !log.data

  )return null;


  return {

    token:String(log.address).toLowerCase(),

    from:addr(log.topics[1]),

    to:addr(log.topics[2]),

    amount:BigInt(log.data).toString()

  };

}


async function verifyTrade(e,u,txHash) {

  if(!u.wallet_address)

    return {

      ok:false,

      error:"wallet_not_connected"

    };


  const tx=await rpc(

    e,

    "eth_getTransactionByHash",

    [txHash]

  );


  const receipt=await rpc(

    e,

    "eth_getTransactionReceipt",

    [txHash]

  );


  if(!tx||!receipt)

    return {

      ok:false,

      error:"transaction_not_found"

    };


  if(

    String(tx.from).toLowerCase()!==

    u.wallet_address.toLowerCase()

  )

    return {

      ok:false,

      error:"transaction_wallet_mismatch"

    };


  if(receipt.status!=="0x1")

    return {

      ok:false,

      error:"transaction_failed"

    };


  const pp=await pair(e);


  const pools=new Map([

    [A.UNI,"Uniswap V2"],

    [pp,"PancakeSwap V2"]

  ]);


  const logs=(receipt.logs||[])

    .map(parseTransfer)

    .filter(Boolean);


  for(const [p,name] of pools){


    const gBuy=logs.find(l=>

      l.token===A.G &&

      l.from===p &&

      l.to===u.wallet_address.toLowerCase()

    );


    const uBuy=logs.find(l=>

      l.token===A.U &&

      l.from===u.wallet_address.toLowerCase() &&

      l.to===p

    );


    if(gBuy&&uBuy){

      return {

        ok:true,

        side:"buy",

        pair:p,

        dex:name,

        gdty:gBuy.amount,

        usdt:uBuy.amount,

        block:parseInt(

          receipt.blockNumber,

          16

        )

      };

    }


    const gSell=logs.find(l=>

      l.token===A.G &&

      l.from===u.wallet_address.toLowerCase() &&

      l.to===p

    );


    const uSell=logs.find(l=>

      l.token===A.U &&

      l.from===p &&

      l.to===u.wallet_address.toLowerCase()

    );


    if(gSell&&uSell){

      return {

        ok:true,

        side:"sell",

        pair:p,

        dex:name,

        gdty:gSell.amount,

        usdt:uSell.amount,

        block:parseInt(

          receipt.blockNumber,

          16

        )

      };

    }

  }


  return {

    ok:false,

    error:"unsupported_trade"

  };

}

async function recordTrade(e,u,trade) {

  const existing=await e.DB.prepare("SELECT id FROM trades WHERE tx_hash=?").bind(trade.txHash).first();

  if(existing)return {ok:false,error:"transaction_already_recorded"};


  const latest=parseInt(await rpc(e,"eth_blockNumber"),16);

  const confirmations=Math.max(0,latest-trade.block);

  const status=confirmations>=12?"confirmed":"pending";

  const tradeId=id(),now=nowIso();


  await e.DB.prepare(`

    INSERT INTO trades(

      id,user_id,wallet_address,tx_hash,block_number,block_timestamp,dex,pair_address,side,

      gdty_amount_wei,usdt_amount_wei,price_usdt_per_gdty,confirmations,status,created_at,verified_at

    )

    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)

  `).bind(

    tradeId,

    u.id,

    u.wallet_address,

    trade.txHash,

    trade.block,

    now,

    trade.dex,

    trade.pair,

    trade.side,

    trade.gdty,

    trade.usdt,

    "",

    confirmations,

    status,

    now,

    status==="confirmed"?now:null

  ).run();


  const p=await e.DB.prepare(

    "SELECT * FROM portfolio_accounts WHERE user_id=?"

  ).bind(u.id).first();


  const bought=BigInt(p?.gdty_bought_wei||"0");

  const sold=BigInt(p?.gdty_sold_wei||"0");

  const spent=BigInt(p?.usdt_spent_wei||"0");

  const received=BigInt(p?.usdt_received_wei||"0");


  let cost=BigInt(p?.cost_basis_wei||"0");

  let realized=BigInt(p?.realized_pnl_wei||"0");


  const g=BigInt(trade.gdty);

  const uAmt=BigInt(trade.usdt);


  if(trade.side==="buy"){


    await e.DB.prepare(`

      INSERT INTO portfolio_accounts(

        user_id,

        gdty_bought_wei,

        gdty_sold_wei,

        usdt_spent_wei,

        usdt_received_wei,

        cost_basis_wei,

        realized_pnl_wei,

        updated_at

      )

      VALUES(?,?,?,?,?,?,?,?)

      ON CONFLICT(user_id) DO UPDATE SET

        gdty_bought_wei=excluded.gdty_bought_wei,

        usdt_spent_wei=excluded.usdt_spent_wei,

        cost_basis_wei=excluded.cost_basis_wei,

        updated_at=excluded.updated_at

    `).bind(

      u.id,

      (bought+g).toString(),

      sold.toString(),

      (spent+uAmt).toString(),

      received.toString(),

      (cost+uAmt).toString(),

      realized.toString(),

      now

    ).run();


    const reward=g/20n;


    const refUser=u.referred_by

      ?await e.DB.prepare(

        "SELECT id FROM users WHERE referral_code=?"

      ).bind(u.referred_by).first()

      :null;


    if(refUser&&reward>0n){


      await e.DB.prepare(`

        INSERT OR IGNORE INTO referral_rewards(

          id,

          referrer_user_id,

          referred_user_id,

          trade_id,

          source_tx_hash,

          gdty_amount_wei,

          reward_amount_wei,

          reward_rate_bps,

          status,

          created_at,

          available_at

        )

        VALUES(?,?,?,?,?,?,?,?,?,?,?)

      `).bind(

        id(),

        refUser.id,

        u.id,

        tradeId,

        trade.txHash,

        g.toString(),

        reward.toString(),

        500,

        status==="confirmed"?"available":"pending",

        now,

        status==="confirmed"?now:null

      ).run();


      await e.DB.prepare(`

        INSERT INTO notifications(

          id,

          user_id,

          type,

          title,

          message,

          created_at

        )

        VALUES(?,?,?,?,?,?)

      `).bind(

        id(),

        refUser.id,

        "referral_reward",

        "Referral reward",

        "A verified GOLDITY purchase generated a 5% referral reward.",

        now

      ).run();

    }


  }else{


    const qty=bought-sold;

    const costReduction=qty>0n

      ?(g*cost/qty)

      :0n;


    realized+=uAmt-costReduction;

    cost=Math.max(0n,cost-costReduction);


    await e.DB.prepare(`

      INSERT INTO portfolio_accounts(

        user_id,

        gdty_bought_wei,

        gdty_sold_wei,

        usdt_spent_wei,

        usdt_received_wei,

        cost_basis_wei,

        realized_pnl_wei,

        updated_at

      )

      VALUES(?,?,?,?,?,?,?,?)

      ON CONFLICT(user_id) DO UPDATE SET

        gdty_sold_wei=excluded.gdty_sold_wei,

        usdt_received_wei=excluded.usdt_received_wei,

        cost_basis_wei=excluded.cost_basis_wei,

        realized_pnl_wei=excluded.realized_pnl_wei,

        updated_at=excluded.updated_at

    `).bind(

      u.id,

      bought.toString(),

      (sold+g).toString(),

      spent.toString(),

      (received+uAmt).toString(),

      cost.toString(),

      realized.toString(),

      now

    ).run();

  }


  return {

    ok:true,

    tradeId,

    status,

    confirmations

  };

}


async function dashboard(e,req) {

  const u=await currentUser(e,req);


  if(!u)

    return out(

      {ok:false,error:"unauthorized"},

      401,

      0,

      cors(e)

    );


  const refs=await e.DB.prepare(

    "SELECT COUNT(*) AS count FROM users WHERE referred_by=?"

  ).bind(u.referral_code).first();


  const rewardRows=await e.DB.prepare(`

    SELECT reward_amount_wei,status

    FROM referral_rewards

    WHERE referrer_user_id=?

  `).bind(u.id).all();


  let rewardAvailable=0n;

  let rewardTotal=0n;


  for(const r of (rewardRows.results||[])){

    const amount=BigInt(r.reward_amount_wei||"0");


    rewardTotal+=amount;


    if(r.status==="available"){

      rewardAvailable+=amount;

    }

  }


  const p=await e.DB.prepare(

    "SELECT * FROM portfolio_accounts WHERE user_id=?"

  ).bind(u.id).first();


  const trades=await e.DB.prepare(`

    SELECT

      tx_hash AS txHash,

      dex,

      side,

      gdty_amount_wei AS gdtyAmountWei,

      usdt_amount_wei AS usdtAmountWei,

      status,

      confirmations,

      created_at AS createdAt

    FROM trades

    WHERE user_id=?

    ORDER BY created_at DESC

    LIMIT 50

  `).bind(u.id).all();


  const notifications=await e.DB.prepare(`

    SELECT

      id,

      type,

      title,

      message,

      read_at AS readAt,

      created_at AS createdAt

    FROM notifications

    WHERE user_id=?

    ORDER BY created_at DESC

    LIMIT 30

  `).bind(u.id).all();


  let wallet={connected:false};


  try{

    wallet=await walletData(e,u);

  }catch{}


  return out({

    ok:true,


    user:{

      id:u.id,

      email:u.email,

      firstName:u.first_name,

      lastName:u.last_name,

      country:u.country,

      phone:u.phone,

      walletAddress:u.wallet_address,

      referralCode:u.referral_code,

      referredBy:u.referred_by,

      role:u.role,

      createdAt:u.created_at,

      referrals:Number(refs?.count||0)

    },


    wallet,


    portfolio:{

      gdtyBoughtWei:p?.gdty_bought_wei||"0",

      gdtySoldWei:p?.gdty_sold_wei||"0",

      usdtSpentWei:p?.usdt_spent_wei||"0",

      usdtReceivedWei:p?.usdt_received_wei||"0",

      costBasisWei:p?.cost_basis_wei||"0",

      realizedPnlWei:p?.realized_pnl_wei||"0"

    },


    referralRewards:{

      availableWei:rewardAvailable.toString(),

      totalWei:rewardTotal.toString()

    },


    trades:trades.results||[],

    notifications:notifications.results||[]


  },200,0,cors(e));

}


async function logout(e,req) {


  if(!await requireOrigin(e,req))

    return out(

      {ok:false,error:"forbidden"},

      403,

      0,

      cors(e)

    );


  const m=req.headers.get("Cookie")||"";

  const hit=m.match(

    /(?:^|;\s*)GDTY_SESSION=([^;]+)/

  );


  if(hit&&e.DB){

    const h=await sha256Text(hit[1]);


    await e.DB.prepare(

      "DELETE FROM sessions WHERE token_hash=?"

    ).bind(h).run();

  }


  return out(

    {ok:true},

    200,

    0,

    {

      ...cors(e),

      "set-cookie":cookie(

        "GDTY_SESSION",

        "",

        0

      )

    }

  );

}


async function createTicket(e,req) {


  const u=await currentUser(e,req);


  if(!u)

    return out(

      {ok:false,error:"unauthorized"},

      401,

      0,

      cors(e)

    );


  if(!await requireOrigin(e,req))

    return out(

      {ok:false,error:"forbidden"},

      403,

      0,

      cors(e)

    );


  const d=await req.json().catch(()=>({}));


  const category=clean(d.category,40);

  const subject=clean(d.subject,160);

  const message=clean(d.message,4000);


  const allowed=[

    "Account",

    "Wallet",

    "Referral",

    "Purchase",

    "Technical",

    "Security",

    "Other"

  ];


  if(

    !allowed.includes(category)||

    !subject||

    !message

  ){

    return out(

      {ok:false,error:"validation_failed"},

      400,

      0,

      cors(e)

    );

  }


  const tid=id();


  const number=

    `GDTY-${Date.now().toString(36).toUpperCase()}-`+

    `${crypto.randomUUID().slice(0,6).toUpperCase()}`;


  const now=nowIso();


  await e.DB.batch([


    e.DB.prepare(`

      INSERT INTO support_tickets(

        id,

        ticket_number,

        user_id,

        category,

        subject,

        status,

        priority,

        created_at,

        updated_at

      )

      VALUES(?,?,?,?,?,?,?,?,?)

    `).bind(

      tid,

      number,

      u.id,

      category,

      subject,

      "open",

      "normal",

      now,

      now

    ),


    e.DB.prepare(`

      INSERT INTO support_messages(

        id,

        ticket_id,

        sender_user_id,

        sender_role,

        message,

        created_at

      )

      VALUES(?,?,?,?,?,?)

    `).bind(

      id(),

      tid,

      u.id,

      "user",

      message,

      now

    )

  ]);


  return out({

    ok:true,

    ticket:{

      id:tid,

      ticketNumber:number,

      status:"open"

    }

  },201,cors(e));

}


async function ticketList(e,req) {


  const u=await currentUser(e,req);


  if(!u)

    return out(

      {ok:false,error:"unauthorized"},

      401,

      0,

      cors(e)

    );


  const rows=await e.DB.prepare(`

    SELECT

      id,

      ticket_number AS ticketNumber,

      category,

      subject,

      status,

      priority,

      created_at AS createdAt,

      updated_at AS updatedAt

    FROM support_tickets

    WHERE user_id=?

    ORDER BY created_at DESC

  `).bind(u.id).all();


  return out({

    ok:true,

    tickets:rows.results||[]

  },200,0,cors(e));

}


async function ticketMessages(e,req) {


  const u=await currentUser(e,req);


  if(!u)

    return out(

      {ok:false,error:"unauthorized"},

      401,

      0,

      cors(e)

    );


  const ticketId=clean(

    new URL(req.url).searchParams.get("ticket"),

    80

  );


  const t=await e.DB.prepare(`

    SELECT id

    FROM support_tickets

    WHERE id=? AND user_id=?

  `).bind(

    ticketId,

    u.id

  ).first();


  if(!t)

    return out(

      {ok:false,error:"not_found"},

      404,

      0,

      cors(e)

    );


  const rows=await e.DB.prepare(`

    SELECT

      id,

      sender_role AS senderRole,

      message,

      created_at AS createdAt,

      read_at AS readAt

    FROM support_messages

    WHERE ticket_id=?

    ORDER BY created_at ASC

  `).bind(ticketId).all();


  return out({

    ok:true,

    messages:rows.results||[]

  },200,0,cors(e));

}


export default {

  async fetch(req,e) {


    const u=new URL(req.url);

    const baseHeaders=cors(e);


    if(req.method==="OPTIONS"){

      return new Response(null,{

        status:204,

        headers:{

          ...baseHeaders,

          "access-control-allow-methods":

            "GET,POST,OPTIONS",

          "access-control-allow-headers":

            "content-type",

          "access-control-max-age":

            "86400"

        }

      });

    }


    try{


      if(

        u.pathname==="/api/register"&&

        req.method==="POST"

      )

        return await registerUser(e,req);


      if(

        u.pathname==="/api/login"&&

        req.method==="POST"

      )

        return await loginUser(e,req);


      if(

        u.pathname==="/api/verify-email"&&

        req.method==="GET"

      )

        return await verifyEmail(e,req);


      if(

        u.pathname==="/api/logout"&&

        req.method==="POST"

      )

        return await logout(e,req);


      if(

        u.pathname==="/api/me"&&

        req.method==="GET"

      )

        return await dashboard(e,req);


      if(

        u.pathname==="/api/wallet/challenge"&&

        req.method==="POST"

      )

        return await walletChallenge(e,req);


      if(

        u.pathname==="/api/wallet/verify"&&

        req.method==="POST"

      )

        return await walletVerify(e,req);


      if(

        u.pathname==="/api/trade/verify"&&

        req.method==="POST"

      ){


        const user=await currentUser(e,req);


        if(!user)

          return out(

            {ok:false,error:"unauthorized"},

            401,

            0,

            baseHeaders

          );


        if(!await requireOrigin(e,req))

          return out(

            {ok:false,error:"forbidden"},

            403,

            0,

            baseHeaders

          );


        if(!await rateLimit(

          e,

          `trade:${user.id}`,

          20,

          60000

        ))

          return out(

            {ok:false,error:"rate_limited"},

            429,

            0,

            baseHeaders

          );


        const d=await req.json().catch(()=>({}));

        const txHash=String(

          d.txHash||""

        ).toLowerCase();


        if(!txRe.test(txHash))

          return out(

            {ok:false,error:"invalid_tx_hash"},

            400,

            0,

            baseHeaders

          );


        const trade=await verifyTrade(

          e,

          user,

          txHash

        );


        if(!trade.ok)

          return out(

            trade,

            400,

            0,

            baseHeaders

          );


        trade.txHash=txHash;


        return out(

          await recordTrade(

            e,

            user,

            trade

          ),

          200,

          0,

          baseHeaders

        );

      }


      if(

        u.pathname==="/api/referral/withdraw"&&

        req.method==="POST"

      )

        return await referralWithdraw(e,req);


      if(

        u.pathname==="/api/referral/withdraw/status"&&

        req.method==="GET"

      )

        return await referralWithdrawStatus(e,req);


      if(

        u.pathname==="/api/referral/check"&&

        req.method==="GET"

      ){


        const code=clean(

          u.searchParams.get("code"),

          32

        ).toUpperCase();


        const row=

          code&&e.DB

            ?await e.DB.prepare(

              "SELECT referral_code FROM users WHERE referral_code=?"

            ).bind(code).first()

            :null;


        return out({

          ok:true,

          valid:!!row,

          referralCode:

            row?.referral_code||null

        },200,30,baseHeaders);

      }


      if(

        u.pathname==="/api/support/tickets"&&

        req.method==="POST"

      )

        return await createTicket(e,req);


      if(

        u.pathname==="/api/support/tickets"&&

        req.method==="GET"

      )

        return await ticketList(e,req);


      if(

        u.pathname==="/api/support/messages"&&

        req.method==="GET"

      )

        return await ticketMessages(e,req);


      if(u.pathname==="/api/market"){


        const pp=await pair(e);


        const [uni,pcs]=await Promise.all([

          inspect(

            e,

            A.UNI,

            "Uniswap V2"

          ),

          inspect(

            e,

            pp,

            "PancakeSwap V2"

          )

        ]);


        const ref=mean(

          uni.price,

          pcs.price

        );


        const live=[

          uni,

          pcs

        ].filter(

          x=>x.status==="live"

        );


        return out({


          ok:true,


          network:"BNB Smart Chain",


          chainId:56,


          token:{

            name:"GOLDITY",

            symbol:"GDTY",

            address:A.G,

            decimals:18

          },


          quoteToken:{

            symbol:"USDT",

            address:A.U,

            decimals:18

          },


          referencePrice:ref,


          priceMethod:

            "Arithmetic mean of valid GDTY/USDT V2 pool prices",


          liquidityUsd:

            live.reduce(

              (s,x)=>

                s+(x.liquidityUsd||0),

              0

            )||null,


          markets:{

            uniswap:uni,

            pancakeswap:pcs

          },


          lastUpdated:nowIso(),


          dataStatus:

            ref===null

              ?"unavailable"

              :"live"


        },200,10,baseHeaders);

      }


      if(u.pathname==="/api/chart"){


        const pp=await pair(e);


        const range=

          (

            u.searchParams.get("range")||

            "1D"

          ).toUpperCase();


        const cfg=ranges[range];


        if(!cfg)

          return out({

            ok:false,

            error:"invalid_range",

            allowed:Object.keys(ranges)

          },400,0,baseHeaders);


        const [uni,pcs]=await Promise.allSettled([

          geckoOHLCV(

            e,

            A.UNI,

            cfg

          ),

          geckoOHLCV(

            e,

            pp,

            cfg

          )

        ]);


        const a=

          uni.status==="fulfilled"

            ?normalize(

              uni.value,

              "Uniswap V2"

            )

            :[];


        const b=

          pcs.status==="fulfilled"

            ?normalize(

              pcs.value,

              "PancakeSwap V2"

            )

            :[];


        const candles=

          mergeReference(a,b);


        return out({


          ok:true,


          range,


          method:

            "Arithmetic mean of valid pool OHLC values by timestamp",


          candles,


          sources:{

            uniswap:{

              status:

                a.length

                  ?"live"

                  :"unavailable",

              pool:A.UNI,

              count:a.length

            },


            pancakeswap:{

              status:

                b.length

                  ?"live"

                  :"unavailable",

              pool:pp,

              count:b.length

            }

          },


          historyStatus:

            candles.length

              ?"live"

              :"unavailable",


          note:

            "Candles use indexed market data. No synthetic history is generated."


        },200,30,baseHeaders);

      }


      if(

        u.pathname==="/api/news"&&

        req.method==="GET"

      ){


        if(!e.DB)

          return out(

            {ok:true,items:[]},

            200,

            60,

            baseHeaders

          );


        const rows=await e.DB.prepare(`

          SELECT

            slug,

            title,

            excerpt,

            category,

            published_at AS publishedAt

          FROM news

          WHERE status='published'

          ORDER BY published_at DESC

          LIMIT 50

        `).all();


        return out({

          ok:true,

          items:rows.results||[]

        },200,60,baseHeaders);

      }


      if(

        u.pathname==="/api/resources"&&

        req.method==="GET"

      ){


        if(!e.DB)

          return out(

            {ok:true,items:[]},

            200,

            60,

            baseHeaders

          );


        const rows=await e.DB.prepare(`

          SELECT

            slug,

            title,

            description,

            category,

            published_at AS publishedAt

          FROM resources

          WHERE status='published'

          ORDER BY published_at DESC

          LIMIT 100

        `).all();


        return out({

          ok:true,

          items:rows.results||[]

        },200,60,baseHeaders);

      }


      if(e.ASSETS)

        return e.ASSETS.fetch(req);


      return out(

        {ok:false,error:"not_found"},

        404,

        0,

        baseHeaders

      );


    }catch(err){


      console.error(

        "GOLDITY worker error",

        err

      );


      return out(

        {

          ok:false,

          error:"internal_error"

        },

        500,

        0,

        baseHeaders

      );

    }

  }

};
