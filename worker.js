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

async function rpc(e, method, params=[]) {
  if (!e.BSC_RPC_URL) throw new Error("rpc_unavailable");
  const r = await fetch(e.BSC_RPC_URL, {
    method:"POST",
    headers:{"content-type":"application/json"},
    body:JSON.stringify({jsonrpc:"2.0", id:1, method, params})
  });
  if (!r.ok) throw new Error("rpc_http_error");
  const j = await r.json();
  if (j.error) throw new Error("rpc_error");
  return j.result;
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

async function hashPassword(password,saltBytes,iterations=100000) {
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
  const iterations=Number(p[1])||100000;
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
  if(!emailRe.test(email)||!validPassword(password)||!d.ageConfirmed||!d.termsAccepted||!d.privacyAccepted)
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

function concatBytes(arrays) {
  let len=0; for(const a of arrays) len+=a.length;
  const out=new Uint8Array(len); let o=0;
  for(const a of arrays){out.set(a,o); o+=a.length;}
  return out;
}

function bigIntToBytes(n) {
  if (n===0n) return new Uint8Array(0);
  let hex=n.toString(16);
  if (hex.length%2) hex="0"+hex;
  return bytes("0x"+hex);
}

function rlpEncodeLength(len,offset) {
  if (len<56) return new Uint8Array([len+offset]);
  let hex=len.toString(16);
  if (hex.length%2) hex="0"+hex;
  const lenBytes=bytes("0x"+hex);
  return concatBytes([new Uint8Array([offset+55+lenBytes.length]),lenBytes]);
}

function rlpEncode(input) {
  if (Array.isArray(input)) {
    const payload=concatBytes(input.map(rlpEncode));
    return concatBytes([rlpEncodeLength(payload.length,192),payload]);
  }
  if (input.length===1 && input[0]<0x80) return input;
  return concatBytes([rlpEncodeLength(input.length,128),input]);
}

function addressFromPrivateKey(privHex) {
  const priv=bytes(privHex);
  const pub=secp.getPublicKey(priv,false);
  const uncompressed=pub.length===65?pub.slice(1):pub;
  const h=keccak_256(uncompressed);
  return "0x"+[...h.slice(-20)].map(x=>x.toString(16).padStart(2,"0")).join("");
}

function erc20TransferData(to,amountWei) {
  return "0xa9059cbb"+pad(to)+pad("0x"+amountWei.toString(16));
}

async function signLegacyTx(privHex,{nonce,gasPrice,gasLimit,to,value,data}) {
  const chainId=56n;
  const build=(v)=>[
    bigIntToBytes(BigInt(nonce)),
    bigIntToBytes(BigInt(gasPrice)),
    bigIntToBytes(BigInt(gasLimit)),
    bytes(to),
    bigIntToBytes(BigInt(value)),
    data?bytes(data):new Uint8Array(0),
    ...v
  ];
  const unsignedRlp=rlpEncode(build([bigIntToBytes(chainId),new Uint8Array(0),new Uint8Array(0)]));
  const msgHash=keccak_256(unsignedRlp);
  const privKeyBytes=bytes(privHex);
  const sig=await secp.signAsync(msgHash,privKeyBytes);
  const v=chainId*2n+35n+BigInt(sig.recovery);
  const signedRlp=rlpEncode(build([bigIntToBytes(v),bigIntToBytes(sig.r),bigIntToBytes(sig.s)]));
  return "0x"+[...signedRlp].map(x=>x.toString(16).padStart(2,"0")).join("");
}

async function getNonce(e,address) {
  return parseInt(await rpc(e,"eth_getTransactionCount",[address,"pending"]),16);
}

async function getGasPrice(e) {
  return BigInt(await rpc(e,"eth_gasPrice"));
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

async function verifyTrade(e,u,txHash) {
  if(!u.wallet_address)return {ok:false,error:"wallet_not_connected"};
  const tx=await rpc(e,"eth_getTransactionByHash",[txHash]);
  const receipt=await rpc(e,"eth_getTransactionReceipt",[txHash]);
  if(!tx||!receipt)return {ok:false,error:"transaction_not_found"};
  if(String(tx.from).toLowerCase()!==u.wallet_address.toLowerCase())return {ok:false,error:"transaction_wallet_mismatch"};
  if(receipt.status!=="0x1")return {ok:false,error:"transaction_failed"};
  const pp=await pair(e);
  const pools=new Map([[A.UNI,"Uniswap V2"],[pp,"PancakeSwap V2"]]);
  const pairAddress=String(tx.to||"").toLowerCase();
  let dex=pools.get(pairAddress);
  const logs=(receipt.logs||[]).map(parseTransfer).filter(Boolean);
  const relevantPools=[...pools.entries()].filter(([p])=>logs.some(l=>l.token===A.G||l.token===A.U)&&String(p).length===42);
  for(const [p,name] of relevantPools){
    const gBuy=logs.find(l=>l.token===A.G&&l.from===p&&l.to===u.wallet_address.toLowerCase());
    const uBuy=logs.find(l=>l.token===A.U&&l.from===u.wallet_address.toLowerCase()&&l.to===p);
    if(gBuy&&uBuy){dex=name;return {ok:true,side:"buy",pair:p,dex,gdty:gBuy.amount,usdt:uBuy.amount,block:parseInt(receipt.blockNumber,16)};}
    const gSell=logs.find(l=>l.token===A.G&&l.from===u.wallet_address.toLowerCase()&&l.to===p);
    const uSell=logs.find(l=>l.token===A.U&&l.from===p&&l.to===u.wallet_address.toLowerCase());
    if(gSell&&uSell){dex=name;return {ok:true,side:"sell",pair:p,dex,gdty:gSell.amount,usdt:uSell.amount,block:parseInt(receipt.blockNumber,16)};}
  }
  return {ok:false,error:"unsupported_trade"};
}

async function recordTrade(e,u,trade) {
  const existing=await e.DB.prepare("SELECT id FROM trades WHERE tx_hash=?").bind(trade.txHash).first();
  if(existing)return {ok:false,error:"transaction_already_recorded"};
  const latest=parseInt(await rpc(e,"eth_blockNumber"),16);
  const confirmations=Math.max(0,latest-trade.block);
  const status=confirmations>=12?"confirmed":"pending";
  const tradeId=id(),now=nowIso();
  await e.DB.prepare(`
    INSERT INTO trades(id,user_id,wallet_address,tx_hash,block_number,block_timestamp,dex,pair_address,side,
    gdty_amount_wei,usdt_amount_wei,price_usdt_per_gdty,confirmations,status,created_at,verified_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).bind(
    tradeId,u.id,u.wallet_address,trade.txHash,trade.block,now,trade.dex,trade.pair,trade.side,
    trade.gdty,trade.usdt,"",confirmations,status,now,status==="confirmed"?now:null
  ).run();

  const p=await e.DB.prepare("SELECT * FROM portfolio_accounts WHERE user_id=?").bind(u.id).first();
  const bought=BigInt(p?.gdty_bought_wei||"0"),sold=BigInt(p?.gdty_sold_wei||"0");
  const spent=BigInt(p?.usdt_spent_wei||"0"),received=BigInt(p?.usdt_received_wei||"0");
  let cost=BigInt(p?.cost_basis_wei||"0"),realized=BigInt(p?.realized_pnl_wei||"0");
  const g=BigInt(trade.gdty),uAmt=BigInt(trade.usdt);
  if(trade.side==="buy"){
    await e.DB.prepare(`
      INSERT INTO portfolio_accounts(user_id,gdty_bought_wei,gdty_sold_wei,usdt_spent_wei,usdt_received_wei,cost_basis_wei,realized_pnl_wei,updated_at)
      VALUES(?,?,?,?,?,?,?,?)
      ON CONFLICT(user_id) DO UPDATE SET
      gdty_bought_wei=excluded.gdty_bought_wei,
      usdt_spent_wei=excluded.usdt_spent_wei,
      cost_basis_wei=excluded.cost_basis_wei,
      updated_at=excluded.updated_at
    `).bind(u.id,(bought+g).toString(),sold.toString(),(spent+uAmt).toString(),received.toString(),(cost+uAmt).toString(),realized.toString(),now).run();
    const reward=g/20n;
    const refUser=u.referred_by?await e.DB.prepare("SELECT id FROM users WHERE referral_code=?").bind(u.referred_by).first():null;
    if(refUser&&reward>0n){
      await e.DB.prepare(`
        INSERT OR IGNORE INTO referral_rewards(id,referrer_user_id,referred_user_id,trade_id,source_tx_hash,gdty_amount_wei,reward_amount_wei,reward_rate_bps,status,created_at,available_at)
        VALUES(?,?,?,?,?,?,?,?,?,?,?)
      `).bind(id(),refUser.id,u.id,tradeId,trade.txHash,g.toString(),reward.toString(),500,status==="confirmed"?"available":"pending",now,status==="confirmed"?now:null).run();
      await e.DB.prepare(`
        INSERT INTO notifications(id,user_id,type,title,message,created_at)
        VALUES(?,?,?,?,?,?)
      `).bind(id(),refUser.id,"referral_reward","Referral reward","A verified GOLDITY purchase generated a 5% referral reward.",now).run();
    }
  }else{
    const qty=bought-sold;
    const costReduction=qty>0n?(g*cost/qty):0n;
    realized+=uAmt-costReduction;
    cost=Math.max(0n,cost-costReduction);
    await e.DB.prepare(`
      INSERT INTO portfolio_accounts(user_id,gdty_bought_wei,gdty_sold_wei,usdt_spent_wei,usdt_received_wei,cost_basis_wei,realized_pnl_wei,updated_at)
      VALUES(?,?,?,?,?,?,?,?)
      ON CONFLICT(user_id) DO UPDATE SET
      gdty_sold_wei=excluded.gdty_sold_wei,
      usdt_received_wei=excluded.usdt_received_wei,
      cost_basis_wei=excluded.cost_basis_wei,
      realized_pnl_wei=excluded.realized_pnl_wei,
      updated_at=excluded.updated_at
    `).bind(u.id,bought.toString(),(sold+g).toString(),spent.toString(),(received+uAmt).toString(),cost.toString(),realized.toString(),now).run();
  }
  return {ok:true,tradeId,status,confirmations};
}

async function referralWithdraw(e,req) {
  const u=await currentUser(e,req);
  if(!u)return out({ok:false,error:"unauthorized"},401,0,cors(e));
  if(!await requireOrigin(e,req))return out({ok:false,error:"forbidden"},403,0,cors(e));
  if(!await rateLimit(e,`withdraw:${u.id}`,5,3600000))return out({ok:false,error:"rate_limited",message:"Too many attempts. Please try again shortly."},429,0,cors(e));
  if(!e.REFERRAL_PAYOUT_PRIVATE_KEY)return out({ok:false,error:"payout_not_configured"},503,0,cors(e));
  if(!u.wallet_address||!walletRe.test(u.wallet_address))return out({ok:false,error:"wallet_not_connected"},400,0,cors(e));

  const existing=await e.DB.prepare("SELECT status,tx_hash FROM referral_payouts WHERE user_id=? AND status IN ('processing','broadcast') ORDER BY created_at DESC LIMIT 1").bind(u.id).first();
  if(existing)return out({ok:true,status:existing.status,txHash:existing.tx_hash||null,errorMessage:null},200,0,cors(e));

  const rewardRows=await e.DB.prepare("SELECT id,reward_amount_wei FROM referral_rewards WHERE referrer_user_id=? AND status='available'").bind(u.id).all();
  const rewards=rewardRows.results||[];
  const amountWei=rewards.reduce((s,r)=>s+BigInt(r.reward_amount_wei||"0"),0n);
  if(amountWei<=0n)return out({ok:false,error:"no_rewards_available"},400,0,cors(e));

  let payoutAddress;
  try{payoutAddress=addressFromPrivateKey(e.REFERRAL_PAYOUT_PRIVATE_KEY);}
  catch{return out({ok:false,error:"payout_not_configured"},503,0,cors(e));}

  let gdtyBal,bnbBal;
  try{
    const [g,b]=await Promise.all([
      tokenBalance(e,A.G,payoutAddress),
      rpc(e,"eth_getBalance",[payoutAddress,"latest"])
    ]);
    gdtyBal=g; bnbBal=BigInt(b);
  }catch{return out({ok:false,error:"payout_processing_error"},502,0,cors(e));}
  if(gdtyBal<amountWei)return out({ok:false,error:"insufficient_payout_gdty"},503,0,cors(e));
  if(bnbBal<2000000000000000n)return out({ok:false,error:"insufficient_payout_bnb"},503,0,cors(e));

  const payoutId=id(), now=nowIso();
  try{
    await e.DB.batch([
      e.DB.prepare("INSERT INTO referral_payouts(id,user_id,wallet_address,amount_wei,status,created_at) VALUES(?,?,?,?,?,?)")
        .bind(payoutId,u.id,u.wallet_address,amountWei.toString(),"processing",now),
      ...rewards.map(r=>e.DB.prepare("UPDATE referral_rewards SET status='processing',payout_id=? WHERE id=?").bind(payoutId,r.id))
    ]);
  }catch{
    return out({ok:false,error:"payout_reservation_failed"},500,0,cors(e));
  }

  try{
    const nonce=await getNonce(e,payoutAddress);
    const gasPrice=await getGasPrice(e);
    const gasLimit=100000;
    const data=erc20TransferData(u.wallet_address,amountWei);
    const signedTx=await signLegacyTx(e.REFERRAL_PAYOUT_PRIVATE_KEY,{nonce,gasPrice,gasLimit,to:A.G,value:0n,data});
    const txHash=await rpc(e,"eth_sendRawTransaction",[signedTx]);
    await e.DB.prepare("UPDATE referral_payouts SET status='broadcast',tx_hash=?,nonce=?,gas_price_wei=?,gas_limit=?,broadcast_at=? WHERE id=?")
      .bind(txHash,nonce,gasPrice.toString(),gasLimit,now,payoutId).run();
    return out({ok:true,status:"broadcast",txHash,errorMessage:null},200,0,cors(e));
  }catch(err){
    console.error("GOLDITY payout broadcast error",err);
    await e.DB.batch([
      e.DB.prepare("UPDATE referral_payouts SET status='failed',error_message=? WHERE id=?").bind("payout_transaction_failed",payoutId),
      e.DB.prepare("UPDATE referral_rewards SET status='available',payout_id=NULL WHERE payout_id=?").bind(payoutId)
    ]);
    return out({ok:false,error:"payout_transaction_failed"},502,0,cors(e));
  }
}

async function referralWithdrawStatus(e,req) {
  const u=await currentUser(e,req);
  if(!u)return out({ok:false,error:"unauthorized"},401,0,cors(e));
  const row=await e.DB.prepare("SELECT * FROM referral_payouts WHERE user_id=? ORDER BY created_at DESC LIMIT 1").bind(u.id).first();
  if(!row)return out({ok:true,payout:null},200,0,cors(e));
  let status=row.status, errorMessage=row.error_message||null;
  if(status==="broadcast"&&row.tx_hash){
    try{
      const receipt=await rpc(e,"eth_getTransactionReceipt",[row.tx_hash]);
      if(receipt){
        const now=nowIso();
        if(receipt.status==="0x1"){
          await e.DB.batch([
            e.DB.prepare("UPDATE referral_payouts SET status='paid',paid_at=? WHERE id=?").bind(now,row.id),
            e.DB.prepare("UPDATE referral_rewards SET status='paid' WHERE payout_id=?").bind(row.id)
          ]);
          status="paid";
        }else{
          await e.DB.batch([
            e.DB.prepare("UPDATE referral_payouts SET status='failed',error_message=? WHERE id=?").bind("payout_transaction_failed",row.id),
            e.DB.prepare("UPDATE referral_rewards SET status='available',payout_id=NULL WHERE payout_id=?").bind(row.id)
          ]);
          status="failed"; errorMessage="payout_transaction_failed";
        }
      }
    }catch{}
  }
  return out({ok:true,payout:{status,txHash:row.tx_hash||null,errorMessage}},200,0,cors(e));
}

async function dashboard(e,req) {
  const u=await currentUser(e,req);
  if(!u)return out({ok:false,error:"unauthorized"},401,cors(e));
  const refs=await e.DB.prepare("SELECT COUNT(*) AS count FROM users WHERE referred_by=?").bind(u.referral_code).first();
  const rewardRows=await e.DB.prepare(`
    SELECT reward_amount_wei,status FROM referral_rewards
    WHERE referrer_user_id=?
  `).bind(u.id).all();
  let rewardAvailable=0n,rewardTotal=0n;
  for(const r of (rewardRows.results||[])){
    const amount=BigInt(r.reward_amount_wei||"0");
    rewardTotal+=amount;
    if(r.status==="available"||r.status==="paid")rewardAvailable+=amount;
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
    referralWithdrawalEnabled:!!e.REFERRAL_PAYOUT_PRIVATE_KEY,
    trades:trades.results||[],
    notifications:notifications.results||[]
  },200,0,cors(e));
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
      if(u.pathname==="/api/referral/withdraw"&&req.method==="POST")return await referralWithdraw(e,req);
      if(u.pathname==="/api/referral/withdraw/status"&&req.method==="GET")return await referralWithdrawStatus(e,req);
      if(u.pathname==="/api/referral/check"&&req.method==="GET"){
        const code=clean(u.searchParams.get("code"),32).toUpperCase();
        const row=code&&e.DB?await e.DB.prepare("SELECT referral_code FROM users WHERE referral_code=?").bind(code).first():null;
        return out({ok:true,valid:!!row,referralCode:row?.referral_code||null},200,30,baseHeaders);
      }
      if(u.pathname==="/api/support/tickets"&&req.method==="POST")return await createTicket(e,req);
      if(u.pathname==="/api/support/tickets"&&req.method==="GET")return await ticketList(e,req);
      if(u.pathname==="/api/support/messages"&&req.method==="GET")return await ticketMessages(e,req);
      if(u.pathname==="/api/market"){
        const pp=await pair(e);
        const [uniR,pcsR]=await Promise.allSettled([inspect(e,A.UNI,"Uniswap V2"),inspect(e,pp,"PancakeSwap V2")]);
        const uni=uniR.status==="fulfilled"?uniR.value:{dex:"Uniswap V2",status:"unavailable",reason:"rpc_error"};
        const pcs=pcsR.status==="fulfilled"?pcsR.value:{dex:"PancakeSwap V2",status:"unavailable",reason:"rpc_error"};
        const ref=mean(uni.price,pcs.price),live=[uni,pcs].filter(x=>x.status==="live");
        return out({
          ok:true,network:"BNB Smart Chain",chainId:56,
          token:{name:"GOLDITY",symbol:"GDTY",address:A.G,decimals:18},
          quoteToken:{symbol:"USDT",address:A.U,decimals:18},
          referencePrice:ref,
          priceMethod:"Arithmetic mean of valid GDTY/USDT V2 pool prices",
          liquidityUsd:live.reduce((s,x)=>s+(x.liquidityUsd||0),0)||null,
          totalUsdtReserve:
            (uni.status==="live" ? (uni.usdtReserve||0) : 0) +
            (pcs.status==="live" ? (pcs.usdtReserve||0) : 0),
          totalGdtyReserve:
            (uni.status==="live" ? (uni.gdtyReserve||0) : 0) +
            (pcs.status==="live" ? (pcs.gdtyReserve||0) : 0),
          reserveMethod:"Sum of available Uniswap V2 + PancakeSwap V2 pool reserves",
          markets:{uniswap:uni,pancakeswap:pcs},
          lastUpdated:nowIso(),dataStatus:ref===null?"unavailable":"live"
        },200,10,baseHeaders);
      }
      if(u.pathname==="/api/chart"){
        const pp=await pair(e),range=(u.searchParams.get("range")||"1D").toUpperCase(),cfg=ranges[range];
        if(!cfg)return out({ok:false,error:"invalid_range",allowed:Object.keys(ranges)},400,0,baseHeaders);
        const [uni,pcs]=await Promise.allSettled([geckoOHLCV(e,A.UNI,cfg),geckoOHLCV(e,pp,cfg)]);
        const a=uni.status==="fulfilled"?normalize(uni.value,"Uniswap V2"):[],b=pcs.status==="fulfilled"?normalize(pcs.value,"PancakeSwap V2"):[];
        const candles=mergeReference(a,b);
        return out({ok:true,range,method:"Arithmetic mean of valid pool OHLC values by timestamp",candles,
          sources:{uniswap:{status:a.length?"live":"unavailable",pool:A.UNI,count:a.length},
          pancakeswap:{status:b.length?"live":"unavailable",pool:pp,count:b.length}},
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
      if(e.ASSETS)return e.ASSETS.fetch(req);
      return out({ok:false,error:"not_found"},404,0,baseHeaders);
    }catch(err){
      console.error("GOLDITY worker error",err);
      return out({ok:false,error:"internal_error"},500,0,baseHeaders);
    }
  }
};
