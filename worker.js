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
const canonicalEmailKey = email => {
  const at=email.indexOf("@");
  if(at===-1)return email;
  let local=email.slice(0,at);
  const domain=email.slice(at+1);
  const plus=local.indexOf("+");
  if(plus!==-1)local=local.slice(0,plus);
  if(domain==="gmail.com"||domain==="googlemail.com")local=local.replace(/\./g,"");
  return local+"@"+domain;
};
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

async function dexscreenerPair(e) {
  const cacheKey="dexscreener:"+A.G;
  if(e.DB){
    const cached=await e.DB.prepare("SELECT value,updated_at FROM scanner_state WHERE key=?").bind(cacheKey).first();
    if(cached&&Date.now()-new Date(cached.updated_at).getTime()<300000){
      return JSON.parse(cached.value);
    }
  }
  const res=await fetch(`https://api.dexscreener.com/latest/dex/tokens/${A.G}`);
  if(!res.ok)throw new Error("dexscreener_unavailable");
  const data=await res.json().catch(()=>null);
  const pairs=(data?.pairs||[]).filter(p=>p.chainId==="bsc");
  if(!pairs.length)throw new Error("no_pair_found");
  pairs.sort((a,b)=>(b.liquidity?.usd||0)-(a.liquidity?.usd||0));
  const best=pairs[0];
  const result={url:best.url,pairAddress:best.pairAddress,dex:best.dexId};
  if(e.DB){
    await e.DB.prepare(`
      INSERT INTO scanner_state(key,value,updated_at) VALUES(?,?,?)
      ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at
    `).bind(cacheKey,JSON.stringify(result),nowIso()).run();
  }
  return result;
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

// Hashes an IP address for storage in audit_log/airdrop_claims. Plain SHA-256
// of an IP is NOT effectively one-way - the entire IPv4 space (~4.3B
// addresses) can be hashed in minutes on commodity hardware, so anyone with a
// DB dump could recover the real IP. HMAC-SHA256 with a secret Worker key
// closes that: without IP_HASH_SECRET, the hash cannot be reversed by
// precomputation. Falls back to plain SHA-256 (with a warning) only if the
// secret hasn't been configured yet, so this never hard-fails registration.
async function hashIp(e,rawIp) {
  if(!e.IP_HASH_SECRET){
    console.error("GOLDITY IP_HASH_SECRET not configured - falling back to reversible plain SHA-256 for IP hashing");
    return sha256Text(rawIp);
  }
  const key=await crypto.subtle.importKey("raw",enc.encode(e.IP_HASH_SECRET),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
  const sig=await crypto.subtle.sign("HMAC",key,enc.encode(rawIp));
  return [...new Uint8Array(sig)].map(x=>x.toString(16).padStart(2,"0")).join("");
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
  await graduateReferralRewards(e,row.id).catch(err=>console.error("GOLDITY graduate error",err));
  return out({
    ok:true,user:{id:row.id,email:row.email,firstName:row.first_name,lastName:row.last_name,
    country:row.country}
  },200,0,{...cors(e),"set-cookie":cookie("GDTY_SESSION",raw,7*86400)});
}

function bytes(hexString) {
  const h=String(hexString||"").replace(/^0x/i,"");
  const clean=h.length%2?"0"+h:h;
  const out=new Uint8Array(clean.length/2);
  for(let i=0;i<out.length;i++)out[i]=parseInt(clean.substr(i*2,2),16);
  return out;
}
function concatBytes(arrays) {
  const total=arrays.reduce((n,a)=>n+a.length,0);
  const out=new Uint8Array(total);
  let off=0;
  for(const a of arrays){out.set(a,off);off+=a.length;}
  return out;
}
function bigIntToBytes(n) {
  if(n===0n)return new Uint8Array(0);
  let hex=n.toString(16);
  if(hex.length%2)hex="0"+hex;
  return bytes(hex);
}
function rlpEncodeLength(len,offset) {
  if(len<56)return new Uint8Array([offset+len]);
  let hex=len.toString(16);
  if(hex.length%2)hex="0"+hex;
  const lenBytes=bytes(hex);
  return concatBytes([new Uint8Array([offset+55+lenBytes.length]),lenBytes]);
}
function rlpEncode(input) {
  if(Array.isArray(input)){
    const parts=input.map(rlpEncode);
    const body=concatBytes(parts);
    return concatBytes([rlpEncodeLength(body.length,192),body]);
  }
  const b=input instanceof Uint8Array?input:bigIntToBytes(input);
  if(b.length===1&&b[0]<128)return b;
  return concatBytes([rlpEncodeLength(b.length,128),b]);
}
function addressFromPrivateKey(privHex) {
  const priv=bytes(privHex);
  const pub=secp.getPublicKey(priv,false);
  const uncompressed=pub.length===65?pub.slice(1):pub;
  const h=keccak_256(uncompressed);
  return "0x"+[...h.slice(-20)].map(x=>x.toString(16).padStart(2,"0")).join("");
}
function erc20TransferData(to,amountWei) {
  return "0xa9059cbb"+pad(to)+bigIntToBytes(amountWei).reduce((s,b)=>s+b.toString(16).padStart(2,"0"),"").padStart(64,"0");
}
async function signLegacyTx(privHex,{nonce,gasPrice,gasLimit,to,value,data}) {
  const chainId=56n;
  const build=fields=>fields;
  const msgFields=build([
    bigIntToBytes(BigInt(nonce)),bigIntToBytes(gasPrice),bigIntToBytes(BigInt(gasLimit)),
    bytes(to),bigIntToBytes(value),bytes(data),bigIntToBytes(chainId),new Uint8Array(0),new Uint8Array(0)
  ]);
  const unsignedRlp=rlpEncode(msgFields);
  const msgHash=keccak_256(unsignedRlp);
  const privKeyBytes=bytes(privHex);
  const sigBytes=await secp.signAsync(msgHash,privKeyBytes,{format:"recovered",prehash:false});
  const recovery=BigInt(sigBytes[0]);
  const rBig=uint("0x"+[...sigBytes.slice(1,33)].map(x=>x.toString(16).padStart(2,"0")).join(""));
  const sBig=uint("0x"+[...sigBytes.slice(33,65)].map(x=>x.toString(16).padStart(2,"0")).join(""));
  const v=chainId*2n+35n+recovery;
  // Rebuild the 9-field RLP list with v, r, s in place of the empty placeholders.
  const finalFields=[
    bigIntToBytes(BigInt(nonce)),bigIntToBytes(gasPrice),bigIntToBytes(BigInt(gasLimit)),
    bytes(to),bigIntToBytes(value),bytes(data),bigIntToBytes(v),bigIntToBytes(rBig),bigIntToBytes(sBig)
  ];
  const finalRlp=rlpEncode(finalFields);
  return "0x"+[...finalRlp].map(x=>x.toString(16).padStart(2,"0")).join("");
}
async function getNonce(e,address) {
  return parseInt(await rpc(e,"eth_getTransactionCount",[address,"latest"]),16);
}
async function getGasPrice(e) {
  return BigInt(await rpc(e,"eth_gasPrice",[]));
}
function eip191Digest(message) {
  const msgBytes=enc.encode(message);
  const prefix=enc.encode(`\x19Ethereum Signed Message:\n${msgBytes.length}`);
  return keccak_256(concatBytes([prefix,msgBytes]));
}
function recoveredAddress(signatureHex,message) {
  const raw=bytes(signatureHex);
  if(raw.length!==65)throw new Error("invalid_signature");
  let v=raw[64];
  if(v>=27)v-=27;
  if(v>1)throw new Error("invalid_signature");
  const sig=new Uint8Array(65);
  sig[0]=v;sig.set(raw.slice(0,64),1);
  const pub=secp.recoverPublicKey(sig,eip191Digest(message),{prehash:false,isCompressed:false});
  const uncompressed=pub.length===65?pub.slice(1):pub;
  const h=keccak_256(uncompressed);
  return "0x"+[...h.slice(-20)].map(x=>x.toString(16).padStart(2,"0")).join("");
}
async function tokenBalance(e,tokenAddress,account) {
  const raw=await call(e,tokenAddress,S.balanceOf+pad(account));
  return BigInt(raw);
}

// Always produces an 8-character suffix: one alphabet character per random
// byte (mod alphabet length), unlike byte.toString(36) which yields a
// variable-length string (about 2.3% of codes ended up 6-7 chars).
async function makeReferralCode(e) {
  const alphabet="ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  for(let i=0;i<8;i++){
    const bytes=crypto.getRandomValues(new Uint8Array(8));
    const code="GDTY-"+[...bytes].map(b=>alphabet[b%alphabet.length]).join("");
    const existing=await e.DB.prepare("SELECT id FROM users WHERE referral_code=?").bind(code).first();
    if(!existing)return code;
  }
  return "GDTY-"+crypto.randomUUID().replace(/-/g,"").slice(0,8).toUpperCase();
}

async function walletChallenge(e,req) {
  const u=await currentUser(e,req);
  if(!u)return out({ok:false,error:"unauthorized"},401,cors(e));
  if(!await requireOrigin(e,req))return out({ok:false,error:"forbidden"},403,cors(e));
  const d=await req.json().catch(()=>({})), address=String(d.address||"").toLowerCase();
  if(!walletRe.test(address))return out({ok:false,error:"invalid_wallet"},400,cors(e));
  const existing=await e.DB.prepare("SELECT user_id FROM wallets WHERE address=?").bind(address).first();
  if(existing&&existing.user_id!==u.id)return out({ok:false,error:"wallet_already_bound"},409,cors(e));
  const challengeId=id(), nonce=token();
  const message=[
    "GOLDITY wallet verification",
    `Address: ${address}`,
    `Nonce: ${nonce}`,
    "This signature does not authorize any blockchain transaction."
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
  const ch=await e.DB.prepare("SELECT * FROM wallet_challenges WHERE id=? AND user_id=? AND used_at IS NULL")
    .bind(d.challengeId,u.id).first();
  if(!ch||new Date(ch.expires_at)<=new Date())return out({ok:false,error:"challenge_expired"},400,cors(e));
  let recovered;
  try{recovered=recoveredAddress(String(d.signature||""),ch.message);}
  catch{return out({ok:false,error:"invalid_signature"},400,cors(e));}
  if(recovered!==ch.wallet_address)return out({ok:false,error:"signature_mismatch"},400,cors(e));
  const existing=await e.DB.prepare("SELECT user_id FROM wallets WHERE address=?").bind(ch.wallet_address).first();
  if(existing&&existing.user_id!==u.id)return out({ok:false,error:"wallet_already_bound"},409,cors(e));
  const now=nowIso();
  await e.DB.batch([
    e.DB.prepare("UPDATE wallet_challenges SET used_at=? WHERE id=?").bind(now,ch.id),
    e.DB.prepare(`
      INSERT INTO wallets(id,user_id,address,chain_id,verified,verified_at,created_at,updated_at)
      VALUES(?,?,?,56,1,?,?,?)
      ON CONFLICT(address) DO UPDATE SET user_id=excluded.user_id,verified=1,verified_at=excluded.verified_at,updated_at=excluded.updated_at
    `).bind(id(),u.id,ch.wallet_address,now,now,now),
    e.DB.prepare("UPDATE users SET wallet_address=?,updated_at=? WHERE id=?").bind(ch.wallet_address,now,u.id)
  ]);
  return out({ok:true,walletAddress:ch.wallet_address},200,0,cors(e));
}

async function registerUser(e,req) {
  if(!e.DB)return out({ok:false,error:"registration_not_configured"},503,cors(e));
  if(!await requireOrigin(e,req))return out({ok:false,error:"forbidden"},403,cors(e));
  if(!await rateLimit(e,`register:${ip(req)}`,5,3600000))return out({ok:false,error:"rate_limited"},429,cors(e));
  const d=await req.json().catch(()=>({}));
  const first=clean(d.firstName,80),last=clean(d.lastName,80),email=normalizeEmail(d.email);
  const country=clean(d.country,80),phone=clean(d.phone,40)||null;
  const password=String(d.password||"");
  if(!emailRe.test(email)||!validPassword(password)||!d.ageConfirmed||!d.termsAccepted||!d.privacyAccepted)
    return out({ok:false,error:"validation_failed",message:"Please complete the required registration fields and accept the required terms."},400,cors(e));
  if(await e.DB.prepare("SELECT id FROM users WHERE email=?").bind(email).first())
    return out({ok:false,error:"email_exists",message:"An account with this email already exists."},409,cors(e));
  // canonical_email lets us catch a duplicate regardless of which alias
  // variant (plus-tag, gmail dots) was registered first - checking
  // "canonical!==email" only (the old approach) was order-dependent: it
  // missed the case where a plain address registers AFTER an aliased
  // variant of the same inbox already exists, since a plain address's own
  // canonical form equals itself and skipped the alias lookup entirely.
  const canonical=canonicalEmailKey(email);
  if(await e.DB.prepare("SELECT id FROM users WHERE canonical_email=? OR email=?").bind(canonical,canonical).first())
    return out({ok:false,error:"email_exists",message:"An account with this email already exists."},409,cors(e));
  if(canonical!==email){
    const localPrefix=canonical.slice(0,canonical.indexOf("@"));
    const domain=canonical.slice(canonical.indexOf("@")+1);
    const aliasMatch=await e.DB.prepare("SELECT id FROM users WHERE email LIKE ? AND email LIKE ?")
      .bind(`${localPrefix}+%`,`%@${domain}`).first();
    if(aliasMatch)return out({ok:false,error:"email_exists",message:"An account with this email already exists."},409,cors(e));
  }
  const salt=crypto.getRandomValues(new Uint8Array(16));
  const hash=await hashPassword(password,salt);
  const uid=id(), now=nowIso();
  let referredBy=null;
  const refInput=clean(d.referralCode,32).toUpperCase();
  if(refInput){
    const refRow=await e.DB.prepare("SELECT referral_code FROM users WHERE referral_code=?").bind(refInput).first();
    if(!refRow)return out({ok:false,error:"invalid_referral",message:"The referral code is not valid."},400,cors(e));
    referredBy=refRow.referral_code;
  }
  const myCode=await makeReferralCode(e);
  try{
    await e.DB.prepare(`
      INSERT INTO users(id,email,canonical_email,password_hash,first_name,last_name,country,phone,referral_code,referred_by,
      email_verified,terms_version,privacy_version,age_confirmed,marketing_consent,created_at,updated_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).bind(uid,email,canonical,hash,first,last,country,phone,myCode,referredBy,0,TERMS_VERSION,PRIVACY_VERSION,1,d.marketingConsent?1:0,now,now).run();
  }catch{
    return out({ok:false,error:"registration_failed",message:"Account creation failed. Please try again."},500,cors(e));
  }
  try{
    const ipHash=await hashIp(e,ip(req));
    await e.DB.prepare("INSERT INTO audit_log(id,user_id,event_type,ip_hash,created_at) VALUES(?,?,?,?,?)")
      .bind(id(),uid,"register",ipHash,now).run();
  }catch{}
  const raw=token(), tokenHash=await sha256Text(raw), exp=new Date(Date.now()+86400000).toISOString();
  await e.DB.prepare("INSERT INTO email_verification_tokens(token_hash,user_id,expires_at,created_at) VALUES(?,?,?,?)")
    .bind(tokenHash,uid,exp,now).run();
  let emailSent=false;
  if(e.RESEND_API_KEY&&e.FROM_EMAIL){
    const link=`${e.PUBLIC_ORIGIN||"https://goldityglobal.com"}/verify-email.html?token=${encodeURIComponent(raw)}`;
    try{
      const r=await fetch("https://api.resend.com/emails",{
        method:"POST",
        headers:{authorization:`Bearer ${e.RESEND_API_KEY}`,"content-type":"application/json"},
        signal:AbortSignal.timeout(8000),
        body:JSON.stringify({
          from:e.FROM_EMAIL,to:[email],subject:"Verify your GOLDITY account",
          html:`<div style="font-family:Arial;background:#080808;color:#f5f0e6;padding:32px"><h2>Welcome to GOLDITY</h2><p>Hello ${htmlEscape(first)},</p><p>Verify your email to activate your account.</p><p><a href="${htmlEscape(link)}">Verify Email</a></p></div>`
        })
      });
      emailSent=r.ok;
      if(!r.ok)console.error("GOLDITY Resend error (verify-email)",r.status,await r.text().catch(()=>""));
    }catch(err){
      console.error("GOLDITY Resend request failed (verify-email)",err);
    }
  }else{
    console.error("GOLDITY email not configured: RESEND_API_KEY or FROM_EMAIL missing");
  }
  return out({ok:true,status:"pending_email_verification",emailSent,user:{id:uid,email,firstName:first,lastName:last,country,createdAt:now}},201,cors(e));
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

async function requestPasswordReset(e,req) {
  if(!e.DB)return out({ok:false,error:"registration_not_configured"},503,cors(e));
  if(!await requireOrigin(e,req))return out({ok:false,error:"forbidden"},403,cors(e));
  if(!await rateLimit(e,`forgot:${ip(req)}`,5,3600000))return out({ok:false,error:"rate_limited"},429,cors(e));

  const d=await req.json().catch(()=>({}));
  const email=normalizeEmail(d.email);
  // Always respond the same way whether or not the account exists, so this
  // endpoint can't be used to discover which emails have a GOLDITY account.
  const genericResponse={ok:true,message:"If that email has a GOLDITY account, a reset link has been sent."};

  const row=await e.DB.prepare("SELECT * FROM users WHERE email=?").bind(email).first();
  if(!row)return out(genericResponse,200,0,cors(e));

  const raw=token(),tokenHash=await sha256Text(raw),now=nowIso(),exp=new Date(Date.now()+3600000).toISOString();
  await e.DB.prepare("DELETE FROM password_reset_tokens WHERE user_id=? AND used_at IS NULL").bind(row.id).run();
  await e.DB.prepare("INSERT INTO password_reset_tokens(token_hash,user_id,expires_at,created_at) VALUES(?,?,?,?)")
    .bind(tokenHash,row.id,exp,now).run();

  if(e.RESEND_API_KEY&&e.FROM_EMAIL){
    const link=`${e.PUBLIC_ORIGIN||"https://goldityglobal.com"}/reset-password.html?token=${encodeURIComponent(raw)}`;
    try{
      const r=await fetch("https://api.resend.com/emails",{
        method:"POST",
        headers:{authorization:`Bearer ${e.RESEND_API_KEY}`,"content-type":"application/json"},
        signal:AbortSignal.timeout(8000),
        body:JSON.stringify({
          from:e.FROM_EMAIL,to:[email],subject:"Reset your GOLDITY password",
          html:`<div style="font-family:Arial;background:#080808;color:#f5f0e6;padding:32px"><h2>Reset your password</h2><p>Hello ${htmlEscape(row.first_name||"")},</p><p>Click the link below to set a new password. This link expires in 1 hour and can only be used once.</p><p><a href="${htmlEscape(link)}">Reset Password</a></p><p>If you didn't request this, you can safely ignore this email.</p></div>`
        })
      });
      if(!r.ok)console.error("GOLDITY Resend error (reset-password)",r.status,await r.text().catch(()=>""));
    }catch(err){
      console.error("GOLDITY Resend request failed (reset-password)",err);
    }
  }else{
    console.error("GOLDITY email not configured: RESEND_API_KEY or FROM_EMAIL missing (reset-password)");
  }
  return out(genericResponse,200,0,cors(e));
}

async function resetPassword(e,req) {
  if(!e.DB)return out({ok:false,error:"registration_not_configured"},503,cors(e));
  if(!await requireOrigin(e,req))return out({ok:false,error:"forbidden"},403,cors(e));

  const d=await req.json().catch(()=>({}));
  const raw=String(d.token||""),password=String(d.password||"");
  if(password.length<10)return out({ok:false,error:"weak_password",message:"Password must be at least 10 characters."},400,cors(e));

  const tokenHash=await sha256Text(raw);
  const row=await e.DB.prepare("SELECT * FROM password_reset_tokens WHERE token_hash=? AND used_at IS NULL").bind(tokenHash).first();
  if(!row||new Date(row.expires_at)<=new Date())return out({ok:false,error:"expired_or_invalid_token",message:"This reset link is invalid or expired."},400,cors(e));

  const salt=crypto.getRandomValues(new Uint8Array(16));
  const hash=await hashPassword(password,salt);
  const now=nowIso();
  await e.DB.batch([
    e.DB.prepare("UPDATE users SET password_hash=?,updated_at=? WHERE id=?").bind(hash,now,row.user_id),
    e.DB.prepare("UPDATE password_reset_tokens SET used_at=? WHERE token_hash=?").bind(now,tokenHash),
    // Invalidate every existing session, in case the account (not just the
    // password) was compromised - this signs the person out everywhere.
    e.DB.prepare("DELETE FROM sessions WHERE user_id=?").bind(row.user_id)
  ]);
  return out({ok:true,message:"Password updated. You can now sign in with your new password."},200,0,cors(e));
}

function parseTransfer(log) {
  if(String(log.topics?.[0]).toLowerCase()!==TOPIC_TRANSFER)return null;
  if(!log.topics?.[1]||!log.topics?.[2])return null;
  return {token:String(log.address).toLowerCase(),from:addr(log.topics[1]),to:addr(log.topics[2]),amount:BigInt(log.data||"0x0").toString()};
}

async function verifyTrade(e,u,txHash) {
  if(!u.wallet_address)return {ok:false,error:"wallet_not_connected"};
  const wallet=u.wallet_address.toLowerCase();
  const tx=await rpc(e,"eth_getTransactionByHash",[txHash]);
  const receipt=await rpc(e,"eth_getTransactionReceipt",[txHash]);
  if(!tx||!receipt)return {ok:false,error:"transaction_not_found"};
  if(String(tx.from).toLowerCase()!==wallet)return {ok:false,error:"transaction_wallet_mismatch"};
  if(receipt.status!=="0x1")return {ok:false,error:"transaction_failed"};

  const logs=(receipt.logs||[]).map(parseTransfer).filter(Boolean);

  // Net GDTY movement for this wallet - works for any pool, DEX, aggregator or router, not
  // just a hardcoded pair address, since we only care about the net result on the wallet.
  let gdtyIn=0n,gdtyOut=0n;
  for(const l of logs){
    if(l.token!==A.G)continue;
    if(l.to===wallet)gdtyIn+=BigInt(l.amount);
    if(l.from===wallet)gdtyOut+=BigInt(l.amount);
  }
  const gdtyNet=gdtyIn-gdtyOut;
  if(gdtyNet===0n)return {ok:false,error:"unsupported_trade"};
  const side=gdtyNet>0n?"buy":"sell";

  let usdtIn=0n,usdtOut=0n;
  for(const l of logs){
    if(l.token!==A.U)continue;
    if(l.to===wallet)usdtIn+=BigInt(l.amount);
    if(l.from===wallet)usdtOut+=BigInt(l.amount);
  }

  // Proof real value left/entered the wallet - stops a plain "someone sent me GDTY for free"
  // transfer from counting as a purchase. Covers USDT, any other ERC20, or native BNB.
  const otherTokenOut=logs.some(l=>l.token!==A.G&&l.from===wallet);
  const otherTokenIn=logs.some(l=>l.token!==A.G&&l.to===wallet);
  const bnbSent=BigInt(tx.value||"0x0")>0n;
  if(side==="buy"&&!(usdtOut>0n||otherTokenOut||bnbSent))return {ok:false,error:"unsupported_trade"};
  if(side==="sell"&&!(usdtIn>0n||otherTokenIn))return {ok:false,error:"unsupported_trade"};

  const pp=await pair(e);
  const dexMap=new Map([[A.UNI,"Uniswap V2"],[pp,"PancakeSwap V2"]]);
  const dex=dexMap.get(String(tx.to||"").toLowerCase())||"On-chain";

  return {
    ok:true,side,dex,pair:String(tx.to||"").toLowerCase(),
    gdty:(side==="buy"?gdtyNet:-gdtyNet).toString(),
    usdt:(side==="buy"?usdtOut:usdtIn).toString(),
    block:parseInt(receipt.blockNumber,16)
  };
}

const MIN_QUALIFYING_GDTY_WEI = 50n * 10n**18n;
const REFERRAL_RATE_BPS = 300n; // 3%
const DAILY_CAP_MILLIGDTY = 200000; // 200 GDTY, in milli-GDTY (GDTY * 1000)
const PENDING_DAYS = 7;
const GIVE_UP_AFTER_DAYS = 3; // stop retrying a graduation check this long past its due date

function todayUtc() {
  return new Date().toISOString().slice(0,10);
}
function weiToMilliGdty(wei) {
  // 1 GDTY = 10^18 wei, 1 milli-GDTY = 10^15 wei. Safe as a plain Number since
  // realistic reward amounts stay far below Number.MAX_SAFE_INTEGER at this scale.
  return Number(wei / 10n**15n);
}
function milliGdtyToWei(milli) {
  return BigInt(milli) * 10n**15n;
}

async function referralCapGroup(e,refUser) {
  // Normally each referrer has their own cap. But if several "referrer" accounts
  // were registered from the same IP, fold them into one shared cap group keyed
  // by that IP hash instead, so the 200 GDTY/day limit cannot be multiplied just
  // by creating more referrer accounts from the same network.
  const ipRow=await e.DB.prepare("SELECT ip_hash FROM audit_log WHERE user_id=? AND event_type='register' ORDER BY created_at ASC LIMIT 1").bind(refUser.id).first();
  if(!ipRow?.ip_hash)return "user:"+refUser.id;
  const siblingCount=await e.DB.prepare(`
    SELECT COUNT(DISTINCT u.id) AS c FROM audit_log a JOIN users u ON u.id=a.user_id
    WHERE a.event_type='register' AND a.ip_hash=? AND u.id!=?
  `).bind(ipRow.ip_hash,refUser.id).first();
  if(Number(siblingCount?.c||0)>0)return "ip:"+ipRow.ip_hash;
  return "user:"+refUser.id;
}

// Atomically reserves up to `desiredMilli` milli-GDTY of today's cap for the given
// group, returning however much was actually reserved (0 if the cap is already
// full). A single UPDATE...WHERE statement is atomic in SQLite/D1, and the retry
// loop makes this safe even if two purchases are recorded at almost the same time.
async function reserveDailyCap(e,capGroup,desiredMilli) {
  if(desiredMilli<=0)return 0;
  const day=todayUtc(),now=nowIso();
  await e.DB.prepare("INSERT INTO referral_daily_caps(cap_group,day,total_milligdty,updated_at) VALUES(?,?,0,?) ON CONFLICT(cap_group,day) DO NOTHING")
    .bind(capGroup,day,now).run();
  for(let attempt=0;attempt<4;attempt++){
    const row=await e.DB.prepare("SELECT total_milligdty FROM referral_daily_caps WHERE cap_group=? AND day=?").bind(capGroup,day).first();
    const current=Number(row?.total_milligdty||0);
    const remaining=DAILY_CAP_MILLIGDTY-current;
    if(remaining<=0)return 0;
    const grant=Math.min(desiredMilli,remaining);
    const res=await e.DB.prepare("UPDATE referral_daily_caps SET total_milligdty=total_milligdty+?,updated_at=? WHERE cap_group=? AND day=? AND total_milligdty+?<=?")
      .bind(grant,now,capGroup,day,grant,DAILY_CAP_MILLIGDTY).run();
    if(res?.meta?.changes)return grant;
    // Someone else changed the total between our read and write - retry with fresh data.
  }
  return 0;
}

async function getFundingAddress(e,walletAddress) {
  const wallet=walletAddress.toLowerCase();
  const cacheKey="funding:"+wallet;
  const cached=await e.DB.prepare("SELECT value FROM scanner_state WHERE key=?").bind(cacheKey).first();
  if(cached)return cached.value||null;
  if(!e.ETHERSCAN_API_KEY)return null;
  try{
    const url=`https://api.etherscan.io/v2/api?chainid=56&module=account&action=txlist&address=${wallet}&startblock=0&endblock=99999999&page=1&offset=10&sort=asc&apikey=${e.ETHERSCAN_API_KEY}`;
    const res=await fetch(url);
    if(!res.ok)return null;
    const data=await res.json().catch(()=>null);
    const first=(data?.result||[]).find(tx=>String(tx.to).toLowerCase()===wallet);
    const funder=first?String(first.from).toLowerCase():null;
    await e.DB.prepare(`
      INSERT INTO scanner_state(key,value,updated_at) VALUES(?,?,?)
      ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at
    `).bind(cacheKey,funder||"",nowIso()).run();
    return funder;
  }catch{return null;}
}

async function fundingClusterRisk(e,walletAddress) {
  const funder=await getFundingAddress(e,walletAddress);
  if(!funder)return {hit:false};
  const ownKey="funding:"+walletAddress.toLowerCase();
  const siblings=await e.DB.prepare("SELECT key FROM scanner_state WHERE key LIKE 'funding:%' AND value=? AND key!=? LIMIT 1")
    .bind(funder,ownKey).first();
  return {hit:!!siblings};
}

async function computeReferralRisk(e,refUser,referredUser) {
  let score=0;const reasons=[];
  const [refIp,ownIp]=await Promise.all([
    e.DB.prepare("SELECT ip_hash FROM audit_log WHERE user_id=? AND event_type='register' ORDER BY created_at ASC LIMIT 1").bind(refUser.id).first(),
    e.DB.prepare("SELECT ip_hash FROM audit_log WHERE user_id=? AND event_type='register' ORDER BY created_at ASC LIMIT 1").bind(referredUser.id).first()
  ]);
  if(refIp?.ip_hash&&ownIp?.ip_hash&&refIp.ip_hash===ownIp.ip_hash){score+=5;reasons.push("same_registration_ip");}
  if(referredUser.wallet_address){
    try{
      const funding=await fundingClusterRisk(e,referredUser.wallet_address);
      if(funding.hit){score+=5;reasons.push("shared_funding_wallet");}
    }catch{}
  }
  if(refUser.wallet_address){
    try{
      const refFunding=await fundingClusterRisk(e,refUser.wallet_address);
      if(refFunding.hit){score+=5;reasons.push("referrer_shared_funding_wallet");}
    }catch{}
  }
  const dayAgo=new Date(Date.now()-86400000).toISOString();
  const recentRow=await e.DB.prepare("SELECT COUNT(DISTINCT referred_user_id) AS c FROM referral_rewards WHERE referrer_user_id=? AND created_at>=?")
    .bind(refUser.id,dayAgo).first();
  if(Number(recentRow?.c||0)>=3){score+=3;reasons.push("referral_velocity");}
  return {score,reasons,highRisk:score>=5};
}

async function maybeCreateReferralReward(e,u,tradeId,trade,gdtyAmount) {
  if(!u.referred_by)return;
  if(gdtyAmount<MIN_QUALIFYING_GDTY_WEI)return;
  const refUser=await e.DB.prepare("SELECT * FROM users WHERE referral_code=?").bind(u.referred_by).first();
  if(!refUser)return;
  if(refUser.id===u.id)return;
  if(refUser.wallet_address&&u.wallet_address&&refUser.wallet_address.toLowerCase()===u.wallet_address.toLowerCase())return;

  const rawReward=gdtyAmount*REFERRAL_RATE_BPS/10000n;
  if(rawReward<=0n)return;

  const capGroup=await referralCapGroup(e,refUser);
  const desiredMilli=weiToMilliGdty(rawReward);
  const grantedMilli=await reserveDailyCap(e,capGroup,desiredMilli);
  if(grantedMilli<=0)return; // hard cap already hit today for this referrer/IP group - excess is lost
  const reward=milliGdtyToWei(grantedMilli);

  const risk=await computeReferralRisk(e,refUser,u);
  const now=nowIso();
  const pendingUntil=new Date(Date.now()+PENDING_DAYS*86400000).toISOString();
  const status=risk.highRisk?"frozen":"pending";

  try{
    await e.DB.prepare(`
      INSERT INTO referral_rewards(id,referrer_user_id,referred_user_id,trade_id,source_tx_hash,gdty_amount_wei,reward_amount_wei,reward_rate_bps,status,created_at,available_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?)
    `).bind(id(),refUser.id,u.id,tradeId,trade.txHash,gdtyAmount.toString(),reward.toString(),300,status,now,status==="frozen"?null:pendingUntil).run();
    await e.DB.prepare(`INSERT INTO notifications(id,user_id,type,title,message,created_at) VALUES(?,?,?,?,?,?)`).bind(
      id(),refUser.id,"referral_reward",
      status==="frozen"?"Referral reward under review":"Referral reward pending",
      status==="frozen"
        ?"A referred purchase looked unusual and was flagged for manual review before any reward is paid."
        :"A verified GOLDITY purchase qualified for a 3% referral reward. It becomes payable in 7 days if the purchase still looks genuine.",
      now
    ).run();
  }catch(err){
    console.error("GOLDITY referral reward insert error",err);
  }
}

async function recordTrade(e,u,trade) {
  const existing=await e.DB.prepare("SELECT id FROM trades WHERE tx_hash=?").bind(trade.txHash).first();
  if(existing)return {ok:false,error:"transaction_already_recorded"};

  const latest=parseInt(await rpc(e,"eth_blockNumber"),16);
  const confirmations=Math.max(0,latest-trade.block);
  const status=confirmations>=12?"confirmed":"pending";
  const now=nowIso();
  const tradeId=id();
  const g=BigInt(trade.gdty);
  const uAmt=BigInt(trade.usdt||"0");
  const price=g>0n&&uAmt>0n?(Number(uAmt)/1e18/(Number(g)/1e18)).toString():"0";

  await e.DB.prepare(`
    INSERT INTO trades(id,user_id,wallet_address,tx_hash,block_number,block_timestamp,dex,pair_address,side,gdty_amount_wei,usdt_amount_wei,price_usdt_per_gdty,confirmations,status,created_at,verified_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).bind(tradeId,u.id,u.wallet_address,trade.txHash,trade.block,now,trade.dex,trade.pair,trade.side,g.toString(),uAmt.toString(),price,confirmations,status,now,status==="confirmed"?now:null).run();

  if(trade.side==="buy"){
    await maybeCreateReferralReward(e,u,tradeId,trade,g);
  }

  return {ok:true,tradeId,status,confirmations};
}

async function tryPayReferralReward(e,reward) {
  const referred=await e.DB.prepare("SELECT * FROM users WHERE id=?").bind(reward.referred_user_id).first();
  const refUser=await e.DB.prepare("SELECT * FROM users WHERE id=?").bind(reward.referrer_user_id).first();
  if(!referred||!refUser)return false;

  const overdue=Date.now()-new Date(reward.available_at||reward.created_at).getTime() > GIVE_UP_AFTER_DAYS*86400000;

  // Re-evaluate risk right now, combined with a sell-off check - a quick sell is
  // one signal among several, not an automatic disqualifier by itself.
  let riskScore=0;
  try{
    const base=await computeReferralRisk(e,refUser,referred);
    riskScore=base.score;
  }catch{}
  if(referred.wallet_address){
    try{
      const heldWei=await tokenBalance(e,A.G,referred.wallet_address);
      const purchasedWei=BigInt(reward.gdty_amount_wei||"0");
      if(heldWei*2n<purchasedWei)riskScore+=3; // sold off more than half - contributes to risk, doesn't freeze alone
    }catch{
      if(!overdue)return false; // RPC hiccup - retry later, unless we've already given up too many times
    }
  }
  if(riskScore>=5){
    await e.DB.prepare("UPDATE referral_rewards SET status='frozen' WHERE id=?").bind(reward.id).run();
    return false;
  }
  if(overdue){
    // Couldn't confirm this reward cleanly within a reasonable window - stop
    // retrying forever and park it for manual review instead.
    await e.DB.prepare("UPDATE referral_rewards SET status='frozen' WHERE id=?").bind(reward.id).run();
    return false;
  }

  if(!e.REFERRAL_PAYOUT_PRIVATE_KEY)return false;
  if(String(e.REFERRAL_PAUSED).toLowerCase()==="true")return false;
  if(!refUser.wallet_address||!walletRe.test(refUser.wallet_address)){
    await e.DB.prepare("UPDATE referral_rewards SET status='payout_failed' WHERE id=?").bind(reward.id).run();
    return false;
  }
  const amountWei=BigInt(reward.reward_amount_wei||"0");
  if(amountWei<=0n)return false;

  let payoutAddress;
  try{payoutAddress=addressFromPrivateKey(e.REFERRAL_PAYOUT_PRIVATE_KEY);}catch{return false;}

  let gdtyBal,bnbBal;
  try{
    const [g,b]=await Promise.all([tokenBalance(e,A.G,payoutAddress),rpc(e,"eth_getBalance",[payoutAddress,"latest"])]);
    gdtyBal=g;bnbBal=BigInt(b);
  }catch{return false;}
  if(gdtyBal<amountWei||bnbBal<2000000000000000n)return false;

  const guard=await e.DB.prepare("UPDATE referral_rewards SET status='processing' WHERE id=? AND status='pending'").bind(reward.id).run();
  if(!guard?.meta||guard.meta.changes===0)return false;

  const payoutId=id(),now=nowIso();

  // Stage A: everything up to and including the broadcast. If anything here
  // throws, the transaction was never (successfully) sent, so it is still
  // safe to revert the reward to 'pending' for a later retry.
  let txHash,nonce,gasPrice,gasLimit;
  try{
    await e.DB.prepare("INSERT INTO referral_payouts(id,user_id,wallet_address,amount_wei,status,created_at) VALUES(?,?,?,?,?,?)")
      .bind(payoutId,refUser.id,refUser.wallet_address,amountWei.toString(),"processing",now).run();
    nonce=await getNonce(e,payoutAddress);
    gasPrice=await getGasPrice(e);
    gasLimit=100000;
    const data=erc20TransferData(refUser.wallet_address,amountWei);
    const signedTx=await signLegacyTx(e.REFERRAL_PAYOUT_PRIVATE_KEY,{nonce,gasPrice,gasLimit,to:A.G,value:0n,data});
    txHash=await rpc(e,"eth_sendRawTransaction",[signedTx]);
  }catch(err){
    console.error("GOLDITY payout broadcast error",err);
    await e.DB.prepare("UPDATE referral_rewards SET status='pending' WHERE id=?").bind(reward.id).run().catch(()=>{});
    await e.DB.prepare("UPDATE referral_payouts SET status='failed' WHERE id=?").bind(payoutId).run().catch(()=>{});
    return false;
  }

  // Stage B: the transaction is on-chain now (we have a txHash). From this
  // point on we NEVER revert the reward back to 'pending' or retry the
  // broadcast - doing so risks paying the same reward twice. A failure here
  // only means our own bookkeeping write failed; it is recorded for manual
  // reconciliation instead, keyed by the on-chain txHash.
  try{
    await e.DB.batch([
      e.DB.prepare("UPDATE referral_payouts SET status='broadcast',tx_hash=?,nonce=?,gas_price_wei=?,gas_limit=? WHERE id=?")
        .bind(txHash,nonce,gasPrice.toString(),gasLimit,payoutId),
      e.DB.prepare("UPDATE referral_rewards SET status='paid',paid_at=?,payout_tx_hash=? WHERE id=?").bind(now,txHash,reward.id)
    ]);
    await e.DB.prepare("INSERT INTO notifications(id,user_id,type,title,message,created_at) VALUES(?,?,?,?,?,?)")
      .bind(id(),refUser.id,"referral_paid","Referral reward sent","Your 3% referral reward was sent on-chain to your wallet.",now).run();
  }catch(err){
    console.error("GOLDITY CRITICAL: referral payout broadcast succeeded but DB recording failed - manual reconciliation required",txHash,reward.id,payoutId,err);
    await e.DB.prepare("UPDATE referral_rewards SET status='paid',paid_at=?,payout_tx_hash=? WHERE id=?").bind(now,txHash,reward.id).run().catch(()=>{});
  }
  return true;
}

async function graduateReferralRewards(e,userId) {
  // Runs for whichever user is active right now - checks rewards where they are
  // either the referrer (the one who'll get paid) or the referred buyer (whose
  // purchase created someone else's reward), so a reward can still progress even
  // if the referrer themselves rarely logs back in.
  const now=nowIso();
  const rows=await e.DB.prepare(`
    SELECT * FROM referral_rewards
    WHERE (referrer_user_id=? OR referred_user_id=?) AND status='pending' AND available_at IS NOT NULL AND available_at<=?
    LIMIT 5
  `).bind(userId,userId,now).all();
  for(const reward of (rows.results||[])){
    await tryPayReferralReward(e,reward);
  }
}

// Same idea as graduateReferralRewards, but with no user filter - run from
// the cron so a reward whose pending window closed still gets paid even if
// neither the referrer nor the referred buyer ever logs back in. Without
// this, a reward could sit in 'pending' forever, since the login/dashboard
// paths only check rewards tied to whichever user is currently active.
async function graduateOverdueRewardsGlobal(e) {
  const now=nowIso();
  const rows=await e.DB.prepare(`
    SELECT * FROM referral_rewards
    WHERE status='pending' AND available_at IS NOT NULL AND available_at<=?
    LIMIT 20
  `).bind(now).all();
  for(const reward of (rows.results||[])){
    await tryPayReferralReward(e,reward).catch(err=>console.error("GOLDITY global graduate error",reward.id,err));
  }
}

async function scanForNewTrades(e) {
  // Automatically detects GDTY purchases for any bound (signature-verified) wallet,
  // so users don't have to find and paste a transaction hash themselves. Only scans
  // up to 12 blocks behind the chain tip, so anything it finds is already safely
  // confirmed - no separate "pending" reorg-safety window is needed for these.
  const latest=parseInt(await rpc(e,"eth_blockNumber"),16);
  const safeBlock=latest-12;
  if(safeBlock<1)return;

  const stateRow=await e.DB.prepare("SELECT value FROM scanner_state WHERE key='last_block'").first();
  let fromBlock=stateRow?parseInt(stateRow.value,10)+1:safeBlock;
  if(fromBlock>safeBlock)return;

  const MAX_RANGE=2000;
  const toBlock=Math.min(safeBlock,fromBlock+MAX_RANGE);

  const logs=await rpc(e,"eth_getLogs",[{
    fromBlock:"0x"+fromBlock.toString(16),
    toBlock:"0x"+toBlock.toString(16),
    address:A.G,
    topics:[TOPIC_TRANSFER]
  }]);

  const txHashes=[...new Set((logs||[]).map(l=>l.transactionHash))];

  for(const txHash of txHashes){
    try{
      const existing=await e.DB.prepare("SELECT id FROM trades WHERE tx_hash=?").bind(txHash).first();
      if(existing)continue;
      const tx=await rpc(e,"eth_getTransactionByHash",[txHash]);
      if(!tx)continue;
      const boundWallet=await e.DB.prepare("SELECT user_id FROM wallets WHERE address=?").bind(String(tx.from).toLowerCase()).first();
      if(!boundWallet)continue;
      const user=await e.DB.prepare("SELECT * FROM users WHERE id=?").bind(boundWallet.user_id).first();
      if(!user)continue;
      const trade=await verifyTrade(e,user,txHash);
      if(!trade.ok)continue;
      trade.txHash=txHash;
      await recordTrade(e,user,trade);
    }catch(err){
      console.error("GOLDITY scanner trade error",txHash,err);
    }
  }

  await e.DB.prepare(`
    INSERT INTO scanner_state(key,value,updated_at) VALUES('last_block',?,?)
    ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at
  `).bind(toBlock.toString(),nowIso()).run();
}

const AIRDROP_REWARD_WEI=3n*10n**16n; // 0.03 GDTY
const AIRDROP_MAX_CLAIMS=10000;
const AIRDROP_MAX_CLAIMS_PER_IP=100;
const AIRDROP_CONTRACT="0xb34b0a10386b559093a0324bfd2c401e0063d4d5";
const AIRDROP_CONTRACT_OWNER="0x4908ab7fcceb4d762b71c765c17dea4456cbf22d";

// selector for singleAirdrop(address,uint256) = 0x95647ebd
function singleAirdropData(recipient,amountWei) {
  return "0x95647ebd"+pad(recipient)+bigIntToBytes(amountWei).reduce((s,b)=>s+b.toString(16).padStart(2,"0"),"").padStart(64,"0");
}

async function airdropIsPaused(e) {
  const row=await e.DB.prepare("SELECT value_int FROM airdrop_state WHERE key='paused'").first();
  return !!row?.value_int;
}

async function airdropClaimedCount(e) {
  const row=await e.DB.prepare("SELECT value_int FROM airdrop_state WHERE key='claimed_count'").first();
  return Number(row?.value_int||0);
}

// Atomically reserves one of the 10,000 claim slots. A single UPDATE...WHERE
// statement is atomic in SQLite/D1, so this is safe even if two claims land
// at almost the same moment - the count can never be pushed past the cap.
async function reserveAirdropSlot(e) {
  const now=nowIso();
  await e.DB.prepare("INSERT INTO airdrop_state(key,value_int,updated_at) VALUES('claimed_count',0,?) ON CONFLICT(key) DO NOTHING").bind(now).run();
  const res=await e.DB.prepare("UPDATE airdrop_state SET value_int=value_int+1,updated_at=? WHERE key='claimed_count' AND value_int<?")
    .bind(now,AIRDROP_MAX_CLAIMS).run();
  return !!res?.meta?.changes;
}
async function releaseAirdropSlot(e) {
  await e.DB.prepare("UPDATE airdrop_state SET value_int=MAX(0,value_int-1) WHERE key='claimed_count'").run();
}

// Atomically reserves one of the AIRDROP_MAX_CLAIMS_PER_IP claim slots for a
// given IP, using the same UPDATE...WHERE pattern as reserveAirdropSlot above.
// This closes the check-then-write race window that a plain
// "SELECT COUNT(*) ... WHERE ip_hash=?" then "if(count>=cap)reject" has under
// concurrent requests from the same IP.
async function reserveAirdropIpSlot(e,ipHash) {
  const now=nowIso();
  await e.DB.prepare("INSERT INTO airdrop_ip_state(ip_hash,claim_count,updated_at) VALUES(?,0,?) ON CONFLICT(ip_hash) DO NOTHING").bind(ipHash,now).run();
  const res=await e.DB.prepare("UPDATE airdrop_ip_state SET claim_count=claim_count+1,updated_at=? WHERE ip_hash=? AND claim_count<?")
    .bind(now,ipHash,AIRDROP_MAX_CLAIMS_PER_IP).run();
  return !!res?.meta?.changes;
}
async function releaseAirdropIpSlot(e,ipHash) {
  await e.DB.prepare("UPDATE airdrop_ip_state SET claim_count=MAX(0,claim_count-1) WHERE ip_hash=?").bind(ipHash).run();
}

async function airdropStatus(e) {
  const claimed=await airdropClaimedCount(e);
  const paused=await airdropIsPaused(e);
  return {
    ok:true,claimed,max:AIRDROP_MAX_CLAIMS,remaining:Math.max(0,AIRDROP_MAX_CLAIMS-claimed),
    rewardWei:AIRDROP_REWARD_WEI.toString(),paused
  };
}

async function claimAirdrop(e,req) {
  if(!await requireOrigin(e,req))return {ok:false,error:"forbidden"};
  if(await airdropIsPaused(e))return {ok:false,error:"airdrop_paused"};

  const d=await req.json().catch(()=>({}));
  const address=String(d.address||"").toLowerCase();
  if(!walletRe.test(address))return {ok:false,error:"invalid_wallet"};

  const ipHash=await hashIp(e,ip(req));
  if(!await rateLimit(e,`airdrop:${ipHash}`,20,3600000))return {ok:false,error:"rate_limited"};

  const byWallet=await e.DB.prepare("SELECT id FROM airdrop_claims WHERE wallet_address=?").bind(address).first();
  if(byWallet)return {ok:false,error:"wallet_already_claimed"};

  // Both reservations below are atomic single UPDATE...WHERE statements (see
  // reserveAirdropSlot/reserveAirdropIpSlot), so neither the global 10,000 cap
  // nor the per-IP cap can be pushed past its limit by concurrent requests.
  if(!await reserveAirdropIpSlot(e,ipHash))return {ok:false,error:"ip_limit_reached"};
  if(!await reserveAirdropSlot(e)){
    await releaseAirdropIpSlot(e,ipHash);
    return {ok:false,error:"airdrop_full"};
  }

  const claimId=id(),now=nowIso();
  const failBeforeBroadcast=async(error)=>{
    await releaseAirdropSlot(e);
    await releaseAirdropIpSlot(e,ipHash);
    await e.DB.prepare("DELETE FROM airdrop_claims WHERE id=?").bind(claimId).run().catch(()=>{});
    return {ok:false,error};
  };

  try{
    await e.DB.prepare(`
      INSERT INTO airdrop_claims(id,wallet_address,ip_hash,amount_wei,status,created_at)
      VALUES(?,?,?,?,?,?)
    `).bind(claimId,address,ipHash,AIRDROP_REWARD_WEI.toString(),"processing",now).run();
  }catch{
    await releaseAirdropSlot(e);
    await releaseAirdropIpSlot(e,ipHash);
    return {ok:false,error:"wallet_already_claimed"};
  }

  if(!e.REFERRAL_PAYOUT_PRIVATE_KEY)return await failBeforeBroadcast("airdrop_not_configured");

  let payoutAddress;
  try{payoutAddress=addressFromPrivateKey(e.REFERRAL_PAYOUT_PRIVATE_KEY);}catch{
    return await failBeforeBroadcast("airdrop_not_configured");
  }
  if(payoutAddress.toLowerCase()!==AIRDROP_CONTRACT_OWNER){
    console.error("GOLDITY airdrop owner mismatch - configured key does not control the airdrop contract");
    return await failBeforeBroadcast("airdrop_not_configured");
  }

  // Stage A: everything up to and including the broadcast. If anything here
  // throws, the transaction was never (successfully) sent, so it is still
  // safe to release the reserved slots and delete the claim row.
  let txHash;
  try{
    const [gdtyBal,bnbRaw]=await Promise.all([
      tokenBalance(e,A.G,AIRDROP_CONTRACT),
      rpc(e,"eth_getBalance",[payoutAddress,"latest"])
    ]);
    if(BigInt(gdtyBal)<AIRDROP_REWARD_WEI||BigInt(bnbRaw)<2000000000000000n){
      return await failBeforeBroadcast("airdrop_treasury_empty");
    }
    const nonce=await getNonce(e,payoutAddress);
    const gasPrice=await getGasPrice(e);
    const gasLimit=150000;
    const data=singleAirdropData(address,AIRDROP_REWARD_WEI);
    const signedTx=await signLegacyTx(e.REFERRAL_PAYOUT_PRIVATE_KEY,{nonce,gasPrice,gasLimit,to:AIRDROP_CONTRACT,value:0n,data});
    txHash=await rpc(e,"eth_sendRawTransaction",[signedTx]);
  }catch(err){
    console.error("GOLDITY airdrop broadcast error",err);
    return await failBeforeBroadcast("airdrop_send_failed");
  }

  // Stage B: the transaction is on-chain now (we have a txHash). From this
  // point on we NEVER release the slot, delete the claim, or allow a retry -
  // doing so could let the same wallet claim again and double the payout.
  // A failure here only means our own bookkeeping write failed; it is
  // recorded for manual reconciliation instead.
  try{
    await e.DB.prepare("UPDATE airdrop_claims SET status='sent',tx_hash=? WHERE id=?").bind(txHash,claimId).run();
  }catch(err){
    console.error("GOLDITY CRITICAL: airdrop broadcast succeeded but DB recording failed - manual reconciliation required",txHash,claimId,err);
  }
  return {ok:true,txHash,amountWei:AIRDROP_REWARD_WEI.toString()};
}


async function dashboard(e,req) {
  const u=await currentUser(e,req);
  if(!u)return out({ok:false,error:"unauthorized"},401,cors(e));

  if(!u.referral_code){
    const newCode=await makeReferralCode(e);
    await e.DB.prepare("UPDATE users SET referral_code=?,updated_at=? WHERE id=?").bind(newCode,nowIso(),u.id).run();
    u.referral_code=newCode;
  }

  await graduateReferralRewards(e,u.id).catch(err=>console.error("GOLDITY graduate error",err));

  const refs=await e.DB.prepare("SELECT COUNT(*) AS count FROM users WHERE referred_by=?").bind(u.referral_code).first();
  const rewardRows=await e.DB.prepare(`
    SELECT reward_amount_wei,status FROM referral_rewards WHERE referrer_user_id=?
  `).bind(u.id).all();
  let rewardPaid=0n,rewardPending=0n,rewardFrozen=0n,rewardTotal=0n;
  for(const r of (rewardRows.results||[])){
    const amount=BigInt(r.reward_amount_wei||"0");
    if(r.status==="paid"){rewardPaid+=amount;rewardTotal+=amount;}
    else if(r.status==="frozen"||r.status==="payout_failed"){rewardFrozen+=amount;}
    else{rewardPending+=amount;rewardTotal+=amount;}
  }

  let wallet={connected:false};
  if(u.wallet_address){
    try{
      const [g,usdt,bnbRaw]=await Promise.all([
        tokenBalance(e,A.G,u.wallet_address),
        tokenBalance(e,A.U,u.wallet_address),
        rpc(e,"eth_getBalance",[u.wallet_address,"latest"])
      ]);
      wallet={connected:true,address:u.wallet_address,gdtyWei:g.toString(),usdtWei:usdt.toString(),bnbWei:BigInt(bnbRaw).toString()};
    }catch{
      wallet={connected:true,address:u.wallet_address,gdtyWei:null,usdtWei:null,bnbWei:null};
    }
  }

  const trades=await e.DB.prepare(`
    SELECT tx_hash AS txHash,dex,side,gdty_amount_wei AS gdtyAmountWei,usdt_amount_wei AS usdtAmountWei,
           status,confirmations,created_at AS createdAt
    FROM trades WHERE user_id=? ORDER BY created_at DESC LIMIT 50
  `).bind(u.id).all();

  const notifications=await e.DB.prepare(`
    SELECT id,type,title,message,read_at AS readAt,created_at AS createdAt
    FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 30
  `).bind(u.id).all();

  let airdropAdmin=null;
  if(u.role==="admin"){
    const status=await airdropStatus(e);
    const distributedWei=(BigInt(status.claimed)*AIRDROP_REWARD_WEI).toString();
    airdropAdmin={...status,distributedWei};
  }

  return out({
    ok:true,
    user:{
      id:u.id,email:u.email,firstName:u.first_name,lastName:u.last_name,country:u.country,
      phone:u.phone,walletAddress:u.wallet_address,referralCode:u.referral_code,referredBy:u.referred_by,
      role:u.role,createdAt:u.created_at,referrals:Number(refs?.count||0)
    },
    wallet,
    referralRewards:{paidWei:rewardPaid.toString(),pendingWei:rewardPending.toString(),frozenWei:rewardFrozen.toString(),totalWei:rewardTotal.toString()},
    trades:trades.results||[],
    notifications:notifications.results||[],
    airdropAdmin
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

// Admin-only: list referral rewards stuck in 'frozen' (flagged as high-risk)
// or 'payout_failed' (referrer had no valid wallet at payout time), so a
// human can review and decide whether to release one back into the normal
// payout flow. There is otherwise no path out of these two states.
async function adminListFlaggedRewards(e,req) {
  const admin=await currentUser(e,req);
  if(!admin||admin.role!=="admin")return out({ok:false,error:"unauthorized"},401,cors(e));
  const rows=await e.DB.prepare(`
    SELECT r.id,r.status,r.gdty_amount_wei AS gdtyAmountWei,r.reward_amount_wei AS rewardAmountWei,
           r.source_tx_hash AS sourceTxHash,r.created_at AS createdAt,
           ru.email AS referrerEmail,ru.wallet_address AS referrerWallet,
           du.email AS referredEmail
    FROM referral_rewards r
    JOIN users ru ON ru.id=r.referrer_user_id
    JOIN users du ON du.id=r.referred_user_id
    WHERE r.status IN ('frozen','payout_failed')
    ORDER BY r.created_at DESC LIMIT 100
  `).all();
  return out({ok:true,rewards:rows.results||[]},200,0,cors(e));
}

// Admin-only: manually move one flagged reward back to 'pending' with
// available_at set to now, so the next login/dashboard visit or cron sweep
// picks it up and re-runs the normal risk check before paying it.
async function adminReleaseReward(e,req) {
  const admin=await currentUser(e,req);
  if(!admin||admin.role!=="admin")return out({ok:false,error:"unauthorized"},401,cors(e));
  if(!await requireOrigin(e,req))return out({ok:false,error:"forbidden"},403,cors(e));
  const d=await req.json().catch(()=>({}));
  const rewardId=clean(d.rewardId,80);
  if(!rewardId)return out({ok:false,error:"validation_failed"},400,cors(e));
  const res=await e.DB.prepare(`
    UPDATE referral_rewards SET status='pending',available_at=? WHERE id=? AND status IN ('frozen','payout_failed')
  `).bind(nowIso(),rewardId).run();
  if(!res?.meta?.changes)return out({ok:false,error:"not_found"},404,cors(e));
  return out({ok:true},200,0,cors(e));
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
      if(u.pathname==="/api/forgot-password"&&req.method==="POST")return await requestPasswordReset(e,req);
      if(u.pathname==="/api/reset-password"&&req.method==="POST")return await resetPassword(e,req);
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
      if(u.pathname==="/api/referral/check"&&req.method==="GET"){
        const code=clean(u.searchParams.get("code"),32).toUpperCase();
        const row=code&&e.DB?await e.DB.prepare("SELECT referral_code FROM users WHERE referral_code=?").bind(code).first():null;
        return out({ok:true,valid:!!row,referralCode:row?.referral_code||null},200,30,baseHeaders);
      }
      if(u.pathname==="/api/support/tickets"&&req.method==="POST")return await createTicket(e,req);
      if(u.pathname==="/api/support/tickets"&&req.method==="GET")return await ticketList(e,req);
      if(u.pathname==="/api/support/messages"&&req.method==="GET")return await ticketMessages(e,req);
      if(u.pathname==="/api/admin/referral-rewards"&&req.method==="GET")return await adminListFlaggedRewards(e,req);
      if(u.pathname==="/api/admin/referral-rewards/release"&&req.method==="POST")return await adminReleaseReward(e,req);
      if(u.pathname==="/api/airdrop/status"&&req.method==="GET"){
        return out(await airdropStatus(e),200,10,baseHeaders);
      }
      if(u.pathname==="/api/airdrop/claim"&&req.method==="POST"){
        const result=await claimAirdrop(e,req);
        return out(result,result.ok?200:400,0,baseHeaders);
      }
      if(u.pathname==="/api/airdrop/toggle-pause"&&req.method==="POST"){
        const user=await currentUser(e,req);
        if(!user||user.role!=="admin")return out({ok:false,error:"unauthorized"},401,baseHeaders);
        const paused=await airdropIsPaused(e);
        await e.DB.prepare(`
          INSERT INTO airdrop_state(key,value_int,updated_at) VALUES('paused',?,?)
          ON CONFLICT(key) DO UPDATE SET value_int=excluded.value_int,updated_at=excluded.updated_at
        `).bind(paused?0:1,nowIso()).run();
        return out({ok:true,paused:!paused},200,0,baseHeaders);
      }
      if(u.pathname==="/api/dexscreener-pair"&&req.method==="GET"){
        try{
          const p=await dexscreenerPair(e);
          return out({ok:true,...p},200,60,baseHeaders);
        }catch{
          return out({ok:false,error:"pair_lookup_failed"},502,baseHeaders);
        }
      }
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
  },

  async scheduled(event,e,ctx) {
    if(!e.DB)return;
    try{await scanForNewTrades(e);}catch(err){console.error("GOLDITY scanner error",err);}
    try{await graduateOverdueRewardsGlobal(e);}catch(err){console.error("GOLDITY global graduate error",err);}
  }
};
