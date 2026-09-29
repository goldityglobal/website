var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// node_modules/@noble/secp256k1/index.js
var freeze = Object.freeze;
var P = 0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffefffffc2fn;
var N = 0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n;
var Gx = 0x79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798n;
var Gy = 0x483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8n;
var secp256k1_CURVE = freeze({
  p: P,
  n: N,
  h: 1n,
  a: 0n,
  b: 7n,
  Gx,
  Gy
});
var L = 32;
var isBytes = /* @__PURE__ */ __name((a) => {
  return a instanceof Uint8Array || ArrayBuffer.isView(a) && a.constructor.name === "Uint8Array" && a.BYTES_PER_ELEMENT === 1;
}, "isBytes");
var abytes = /* @__PURE__ */ __name((value, length, title = "") => {
  if (isBytes(value) && (length === void 0 || value.length === length))
    return value;
  const bytes2 = isBytes(value);
  const ofLen = length !== void 0 ? ` of length ${length}` : "";
  const got = bytes2 ? `length=${value.length}` : `type=${typeof value}`;
  const message = (title ? `"${title}" ` : "") + "expected Uint8Array" + ofLen + ", got " + got;
  if (!bytes2)
    throw new TypeError(message);
  throw new RangeError(message);
}, "abytes");
var cloneBytes = /* @__PURE__ */ __name((value) => Uint8Array.from(value), "cloneBytes");
var snapshotBytes = /* @__PURE__ */ __name((value, title, length) => cloneBytes(abytes(value, length, title)), "snapshotBytes");
var padh = /* @__PURE__ */ __name((n, pad2) => n.toString(16).padStart(pad2, "0"), "padh");
var bytesToHex = /* @__PURE__ */ __name((bytes2) => {
  let hex = "";
  for (const byte of abytes(bytes2))
    hex += padh(byte, 2);
  return hex;
}, "bytesToHex");
var hexToBytes = /* @__PURE__ */ __name((hex) => {
  const e = "hex invalid";
  if (typeof hex !== "string")
    throw new TypeError(e);
  if (hex.length % 2 || !/^[\da-f]*$/i.test(hex))
    throw new RangeError(e);
  const array = new Uint8Array(hex.length / 2);
  for (let ai = 0, hi = 0; ai < array.length; ai++, hi += 2) {
    const n1 = hex.charCodeAt(hi);
    const n2 = hex.charCodeAt(hi + 1);
    array[ai] = ((n1 & 15) + (n1 >> 6) * 9) * 16 + (n2 & 15) + (n2 >> 6) * 9;
  }
  return array;
}, "hexToBytes");
var subtle = /* @__PURE__ */ __name(() => {
  const s = globalThis?.crypto?.subtle;
  if (s)
    return s;
  throw new Error("crypto.subtle must be defined, consider polyfill");
}, "subtle");
var concatBytes = /* @__PURE__ */ __name((...arrays) => {
  let sum = 0;
  for (const a of arrays)
    sum += abytes(a).length;
  const res = new Uint8Array(sum);
  let pad2 = 0;
  for (const a of arrays) {
    res.set(a, pad2);
    pad2 += a.length;
  }
  return res;
}, "concatBytes");
var randomBytes = /* @__PURE__ */ __name((len = L) => {
  const c = globalThis?.crypto;
  if (typeof c?.getRandomValues !== "function")
    throw new Error("crypto.getRandomValues must be defined, consider polyfill");
  return c.getRandomValues(new Uint8Array(len));
}, "randomBytes");
var big = BigInt;
var arange = /* @__PURE__ */ __name((n, min, max, msg = "bad number: out of range") => {
  if (typeof n !== "bigint")
    throw new TypeError(msg);
  if (min <= n && n < max)
    return n;
  throw new RangeError(msg);
}, "arange");
var M = /* @__PURE__ */ __name((a, b = P) => (a %= b) >= 0n ? a : b + a, "M");
var modN = /* @__PURE__ */ __name((a) => M(a, N), "modN");
var invert = /* @__PURE__ */ __name((number, modulo) => {
  if (number === 0n)
    throw new Error("invert: expected non-zero number");
  if (modulo <= 1n)
    throw new Error("invert: expected modulus > 1, got " + modulo);
  let a = M(number, modulo);
  let b = modulo;
  let x = 0n, u = 1n;
  while (a !== 0n) {
    const q = b / a;
    const r = b - a * q;
    const m = x - u * q;
    b = a, a = r, x = u, u = m;
  }
  const gcd = b;
  if (gcd !== 1n)
    throw new Error("invert: does not exist");
  return M(x, modulo);
}, "invert");
var _hash = /* @__PURE__ */ __name((name) => {
  const fn = hashes[name];
  if (typeof fn !== "function")
    throw new Error("hashes." + name + " not set");
  return fn;
}, "_hash");
var callHash = /* @__PURE__ */ __name((name, a, b) => abytes(_hash(name)(a, b), L, "digest"), "callHash");
var callHashAsync = /* @__PURE__ */ __name(async (name, a, b) => abytes(await _hash(name)(a, b), L, "digest"), "callHashAsync");
var apoint = /* @__PURE__ */ __name((p) => {
  if (p instanceof Point)
    return p;
  throw new TypeError("Point expected");
}, "apoint");
var E_BADPOINT = "bad point: not on curve";
var koblitz = /* @__PURE__ */ __name((x) => M(M(x * x) * x + 7n), "koblitz");
var FpIsValid = /* @__PURE__ */ __name((n) => arange(n, 0n, P), "FpIsValid");
var FpIsValidNot0 = /* @__PURE__ */ __name((n) => arange(n, 1n, P), "FpIsValidNot0");
var FnIsValidNot0 = /* @__PURE__ */ __name((n) => arange(n, 1n, N), "FnIsValidNot0");
var isEven = /* @__PURE__ */ __name((y) => !(y & 1n), "isEven");
var getPrefix = /* @__PURE__ */ __name((y) => Uint8Array.of(isEven(y) ? 2 : 3), "getPrefix");
var lift_x = /* @__PURE__ */ __name((x) => {
  const c = koblitz(FpIsValidNot0(x));
  let r = 1n;
  for (let num = c, e = (P + 1n) / 4n; e > 0n; e >>= 1n) {
    if (e & 1n)
      r = r * num % P;
    num = num * num % P;
  }
  if (M(r * r) !== c)
    throw new Error("sqrt invalid");
  return new Point(x, isEven(r) ? r : M(-r), 1n);
}, "lift_x");
var Point = class _Point {
  static {
    __name(this, "Point");
  }
  static BASE;
  static ZERO;
  X;
  Y;
  Z;
  constructor(X, Y, Z2) {
    this.X = FpIsValid(X);
    this.Y = FpIsValidNot0(Y);
    this.Z = FpIsValid(Z2);
    freeze(this);
  }
  /** Returns the shared curve metadata object by reference.
   * It is readonly only at type level, and mutating it won't retarget arithmetic,
   * which already uses module-load snapshots. */
  static CURVE() {
    return secp256k1_CURVE;
  }
  /** Create 3d xyz point from 2d xy. (0, 0) => (0, 1, 0), not (0, 0, 1) */
  static fromAffine(ap) {
    const { x, y } = ap;
    return x === 0n && y === 0n ? I : new _Point(x, y, 1n);
  }
  /** Convert Uint8Array or hex string to Point. */
  static fromBytes(bytes2) {
    abytes(bytes2);
    const length = bytes2.length;
    const head = bytes2[0];
    const x = sliceBytesNumBE(bytes2, 1, 33);
    try {
      if (length === 33 && (head === 2 || head === 3)) {
        const p = lift_x(x);
        return head === 3 ? p.negate() : p;
      }
      if (length === 65 && head === 4)
        return new _Point(x, sliceBytesNumBE(bytes2, 33, 65), 1n).assertValidity();
    } catch (error) {
      throw new Error(E_BADPOINT);
    }
    throw new Error(E_BADPOINT);
  }
  static fromHex(hex) {
    return _Point.fromBytes(hexToBytes(hex));
  }
  get x() {
    return this.toAffine().x;
  }
  get y() {
    return this.toAffine().y;
  }
  /** Equality check: compare points P&Q. */
  equals(other) {
    const { X: X1, Y: Y1, Z: Z1 } = this;
    const { X: X2, Y: Y2, Z: Z2 } = apoint(other);
    return M(X1 * Z2) === M(X2 * Z1) && M(Y1 * Z2) === M(Y2 * Z1);
  }
  is0() {
    return this.Z === 0n;
  }
  /** Flip point over y coordinate. */
  negate() {
    return new _Point(this.X, M(-this.Y), this.Z);
  }
  /** Point doubling: P+P, complete formula. */
  double() {
    return this.add(this);
  }
  /**
   * Point addition: P+Q, complete, exception-free formula
   * (Renes-Costello-Batina, algo 1 of [2015/1060](https://eprint.iacr.org/2015/1060)).
   * Cost: `12M + 0S + 3*a + 3*b3 + 23add`.
   */
  // prettier-ignore
  add(other) {
    const { X: X1, Y: Y1, Z: Z1 } = this;
    const { X: X2, Y: Y2, Z: Z2 } = apoint(other);
    const a = 0n;
    const b = 7n;
    let X3 = 0n, Y3 = 0n, Z3 = 0n;
    const b3 = M(b * 3n);
    let t0 = M(X1 * X2), t1 = M(Y1 * Y2), t2 = M(Z1 * Z2), t3 = M(X1 + Y1);
    let t4 = M(X2 + Y2);
    t3 = M(t3 * t4);
    t4 = M(t0 + t1);
    t3 = M(t3 - t4);
    t4 = M(X1 + Z1);
    let t5 = M(X2 + Z2);
    t4 = M(t4 * t5);
    t5 = M(t0 + t2);
    t4 = M(t4 - t5);
    t5 = M(Y1 + Z1);
    X3 = M(Y2 + Z2);
    t5 = M(t5 * X3);
    X3 = M(t1 + t2);
    t5 = M(t5 - X3);
    Z3 = M(a * t4);
    X3 = M(b3 * t2);
    Z3 = M(X3 + Z3);
    X3 = M(t1 - Z3);
    Z3 = M(t1 + Z3);
    Y3 = M(X3 * Z3);
    t1 = M(t0 + t0);
    t1 = M(t1 + t0);
    t2 = M(a * t2);
    t4 = M(b3 * t4);
    t1 = M(t1 + t2);
    t2 = M(t0 - t2);
    t2 = M(a * t2);
    t4 = M(t4 + t2);
    t0 = M(t1 * t4);
    Y3 = M(Y3 + t0);
    t0 = M(t5 * t4);
    X3 = M(t3 * X3);
    X3 = M(X3 - t0);
    t0 = M(t3 * t1);
    Z3 = M(t5 * Z3);
    Z3 = M(Z3 + t0);
    return new _Point(X3, Y3, Z3);
  }
  subtract(other) {
    return this.add(apoint(other).negate());
  }
  /**
   * Point-by-scalar multiplication. Scalar must be in range 1 <= n < CURVE.n.
   * Uses {@link wNAF} for base point.
   * Uses fake point to mitigate leakage shape in JS, not as a hard constant-time guarantee.
   * @param n scalar by which point is multiplied
   * @param safe safe mode guards against timing attacks; unsafe mode is faster
   */
  multiply(n, safe = true) {
    if (!safe && n === 0n)
      return I;
    FnIsValidNot0(n);
    if (n === 1n)
      return this;
    if (this.equals(G))
      return wNAF(n).p;
    let p = I;
    let f = G;
    let d = this;
    for (let i = 0; safe ? i < 256 : n > 0n; i++) {
      if (n & 1n)
        p = p.add(d);
      else if (safe)
        f = f.add(d);
      d = d.double();
      n >>= 1n;
    }
    return p;
  }
  multiplyUnsafe(scalar) {
    return this.multiply(scalar, false);
  }
  /** Convert point to 2d xy affine point. (X, Y, Z) ∋ (x=X/Z, y=Y/Z) */
  toAffine() {
    const { X: x, Y: y, Z: z } = this;
    if (z === 0n)
      return { x: 0n, y: 0n };
    if (z === 1n)
      return { x, y };
    const iz = invert(z, P);
    if (M(z * iz) !== 1n)
      throw new Error("inverse invalid");
    return { x: M(x * iz), y: M(y * iz) };
  }
  /** Checks if the point is valid and on-curve. */
  assertValidity() {
    const { x, y } = this.toAffine();
    FpIsValidNot0(x);
    FpIsValidNot0(y);
    if (M(y * y) !== koblitz(x))
      throw new Error(E_BADPOINT);
    return this;
  }
  /** Converts point to 33/65-byte Uint8Array. */
  toBytes(isCompressed = true) {
    const { x, y } = this.assertValidity().toAffine();
    const x32b = numTo32b(x);
    if (isCompressed)
      return concatBytes(getPrefix(y), x32b);
    return concatBytes(Uint8Array.of(4), x32b, numTo32b(y));
  }
  toHex(isCompressed) {
    return bytesToHex(this.toBytes(isCompressed));
  }
};
var G = new Point(Gx, Gy, 1n);
var I = new Point(0n, 1n, 0n);
Point.BASE = G;
Point.ZERO = I;
var doubleScalarMulUns = /* @__PURE__ */ __name((R, u1, u2) => {
  return G.multiply(u1, false).add(R.multiply(u2, false)).assertValidity();
}, "doubleScalarMulUns");
var bytesToNumBE = /* @__PURE__ */ __name((b) => big("0x" + (bytesToHex(b) || "0")), "bytesToNumBE");
var sliceBytesNumBE = /* @__PURE__ */ __name((b, from, to) => bytesToNumBE(b.subarray(from, to)), "sliceBytesNumBE");
var numTo32b = /* @__PURE__ */ __name((num) => hexToBytes(padh(arange(num, 0n, 2n ** 256n), L * 2)), "numTo32b");
var secretKeyToScalar = /* @__PURE__ */ __name((secretKey) => {
  const num = bytesToNumBE(abytes(secretKey, L, "secret key"));
  return arange(num, 1n, N, "invalid secret key: outside of range");
}, "secretKeyToScalar");
var highS = /* @__PURE__ */ __name((n) => n > N >> 1n, "highS");
var getRecoveryBit = /* @__PURE__ */ __name((x, y, r) => (x === r ? 0 : 2) | Number(y & 1n), "getRecoveryBit");
var getPublicKey = /* @__PURE__ */ __name((privKey, isCompressed = true) => {
  return G.multiply(secretKeyToScalar(privKey)).toBytes(isCompressed);
}, "getPublicKey");
var assertRecoveryBit = /* @__PURE__ */ __name((recovery) => {
  if (recovery != null && [0, 1, 2, 3].includes(recovery))
    return recovery;
  throw new Error("invalid recovery id");
}, "assertRecoveryBit");
var assertSigFormat = /* @__PURE__ */ __name((format) => {
  if (format === "der")
    throw new Error('Signature format "der" is not supported: switch to noble-curves');
  if (format != null && format !== SIG_COMPACT && format !== SIG_RECOVERED)
    throw new Error("Signature format must be one of: compact, recovered, der");
}, "assertSigFormat");
var assertSigLength = /* @__PURE__ */ __name((sig, format = SIG_COMPACT) => {
  assertSigFormat(format);
  const bytes2 = abytes(sig, void 0, "signature");
  const len = 64 + Number(format === SIG_RECOVERED);
  if (bytes2.length !== len)
    throw new Error(`Signature format "${format}" expects Uint8Array with length ${len}`);
  return bytes2;
}, "assertSigLength");
var Signature = class _Signature {
  static {
    __name(this, "Signature");
  }
  r;
  s;
  recovery;
  constructor(r, s, recovery) {
    this.r = FnIsValidNot0(r);
    this.s = FnIsValidNot0(s);
    if (recovery != null)
      this.recovery = assertRecoveryBit(recovery);
    freeze(this);
  }
  static fromBytes(b, format = SIG_COMPACT) {
    b = assertSigLength(b, format);
    let rec;
    if (format === SIG_RECOVERED) {
      rec = b[0];
      b = b.subarray(1);
    }
    const r = sliceBytesNumBE(b, 0, L);
    const s = sliceBytesNumBE(b, L, 64);
    return new _Signature(r, s, rec);
  }
  addRecoveryBit(bit) {
    return new _Signature(this.r, this.s, bit);
  }
  hasHighS() {
    return highS(this.s);
  }
  toBytes(format = SIG_COMPACT) {
    assertSigFormat(format);
    const { r, s, recovery } = this;
    const res = concatBytes(numTo32b(r), numTo32b(s));
    if (format === SIG_RECOVERED) {
      return concatBytes(Uint8Array.of(assertRecoveryBit(recovery)), res);
    }
    return res;
  }
};
var MAX_PREHASHED_BYTES = 8192;
var E_MSGBIG = "input is too large";
var oversizedMsg = /* @__PURE__ */ __name((bytes2, prehash) => !prehash && bytes2.length > MAX_PREHASHED_BYTES, "oversizedMsg");
var bits2int = /* @__PURE__ */ __name((bytes2) => {
  if (oversizedMsg(bytes2))
    throw new Error(E_MSGBIG);
  const delta = bytes2.length * 8 - 256;
  const num = bytesToNumBE(bytes2);
  return delta > 0 ? num >> big(delta) : num;
}, "bits2int");
var bits2int_modN = /* @__PURE__ */ __name((bytes2) => modN(bits2int(abytes(bytes2))), "bits2int_modN");
var snapshotMsg = /* @__PURE__ */ __name((message, prehash) => {
  const view = abytes(message, void 0, "message");
  if (oversizedMsg(view, prehash))
    throw new Error(E_MSGBIG);
  return cloneBytes(view);
}, "snapshotMsg");
var SIG_COMPACT = "compact";
var SIG_RECOVERED = "recovered";
var _sha = "SHA-256";
var hashes = {
  hmacSha256Async: /* @__PURE__ */ __name(async (key, message) => {
    const s = subtle();
    const k = await s.importKey("raw", key, { name: "HMAC", hash: _sha }, false, ["sign"]);
    return new Uint8Array(await s.sign("HMAC", k, message));
  }, "hmacSha256Async"),
  hmacSha256: void 0,
  sha256Async: /* @__PURE__ */ __name(async (msg) => new Uint8Array(await subtle().digest(_sha, msg)), "sha256Async"),
  sha256: void 0
};
var prepMsg = /* @__PURE__ */ __name((msg, prehash, async_) => {
  const message = abytes(msg, void 0, "message");
  if (!prehash)
    return message;
  return async_ ? callHashAsync("sha256Async", message) : callHash("sha256", message);
}, "prepMsg");
var NULL = /* @__PURE__ */ new Uint8Array(0);
var byte0 = /* @__PURE__ */ Uint8Array.of(0);
var byte1 = /* @__PURE__ */ Uint8Array.of(1);
var _drbgErr = "drbg: tried max amount of iterations";
var hmacDrbgAsync = /* @__PURE__ */ __name(async (seed, pred) => {
  let v = new Uint8Array(L);
  let k = new Uint8Array(L);
  let i = 0;
  const reset = /* @__PURE__ */ __name(() => {
    v.fill(1);
    k.fill(0);
  }, "reset");
  const h = /* @__PURE__ */ __name((...b) => callHashAsync("hmacSha256Async", k, concatBytes(v, ...b)), "h");
  const reseed = /* @__PURE__ */ __name(async (seed2 = NULL) => {
    k = await h(byte0, seed2);
    v = await h();
    if (seed2.length === 0)
      return;
    k = await h(byte1, seed2);
    v = await h();
  }, "reseed");
  const gen = /* @__PURE__ */ __name(async () => {
    if (i++ >= 1e3)
      throw new Error(_drbgErr);
    v = await h();
    return v;
  }, "gen");
  reset();
  await reseed(seed);
  let res = void 0;
  while (!(res = pred(await gen())))
    await reseed();
  reset();
  return res;
}, "hmacDrbgAsync");
var _sign = /* @__PURE__ */ __name((messageHash, secretKey, opts, drbg) => {
  const [lowS, , format, extraEntropy] = opts;
  const h1i = bits2int_modN(messageHash);
  const d = secretKeyToScalar(secretKey);
  const seedArgs = [numTo32b(d), numTo32b(h1i)];
  if (extraEntropy != null && extraEntropy !== false) {
    seedArgs.push(abytes(extraEntropy === true ? randomBytes(L) : extraEntropy, void 0, "extraEntropy"));
  }
  const k2sig = /* @__PURE__ */ __name((kBytes) => {
    const k = bits2int(kBytes);
    if (!(1n <= k && k < N))
      return;
    const ik = invert(k, N);
    const q = G.multiply(k).toAffine();
    const r = modN(q.x);
    if (r === 0n)
      return;
    const s = modN(ik * (h1i + r * d));
    if (s === 0n)
      return;
    let recovery = getRecoveryBit(q.x, q.y, r);
    let normS = s;
    if (lowS && highS(s)) {
      normS = N - s;
      recovery ^= 1;
    }
    const sig = new Signature(r, normS, recovery);
    return sig.toBytes(format);
  }, "k2sig");
  return drbg(concatBytes(...seedArgs), k2sig);
}, "_sign");
var setDefaults = /* @__PURE__ */ __name((opts, own = false) => {
  const e = opts.extraEntropy;
  return [
    opts.lowS ?? true,
    opts.prehash ?? true,
    opts.format ?? SIG_COMPACT,
    own && e != null && typeof e !== "boolean" ? snapshotBytes(e, "extraEntropy") : e
  ];
}, "setDefaults");
var signAsync = /* @__PURE__ */ __name(async (message, secretKey, opts = {}) => {
  const o = setDefaults(opts, true);
  assertSigFormat(o[2]);
  const msgBytes = snapshotMsg(message, o[1]);
  const secretBytes = snapshotBytes(secretKey, "secret key", L);
  const msg = await prepMsg(msgBytes, o[1], true);
  return _sign(msg, secretBytes, o, hmacDrbgAsync);
}, "signAsync");
var _recover = /* @__PURE__ */ __name((signature, messageHash, isCompressed) => {
  const { r, s, recovery: rec } = Signature.fromBytes(signature, "recovered");
  const recovery = assertRecoveryBit(rec);
  const h = bits2int_modN(messageHash);
  const radj = recovery > 1 ? r + N : r;
  FpIsValidNot0(radj);
  const ir = invert(radj, N);
  const R = Point.fromBytes(concatBytes(getPrefix(big(recovery)), numTo32b(radj)));
  return doubleScalarMulUns(R, modN(-h * ir), modN(s * ir)).toBytes(isCompressed);
}, "_recover");
var recoverPublicKey = /* @__PURE__ */ __name((signature, message, opts = {}) => {
  const msg = prepMsg(message, setDefaults(opts)[1], false);
  return _recover(signature, msg, opts.isCompressed ?? true);
}, "recoverPublicKey");
var precompute = /* @__PURE__ */ __name(() => {
  const points = [];
  let p = G;
  let b = p;
  for (let w = 0; w < 33; w++) {
    b = p;
    points.push(b);
    for (let i = 1; i < 128; i++) {
      b = b.add(p);
      points.push(b);
    }
    p = b.double();
  }
  return points;
}, "precompute");
var Gpows = void 0;
var ctneg = /* @__PURE__ */ __name((cnd, p) => {
  const n = p.negate();
  return cnd ? n : p;
}, "ctneg");
var wNAF = /* @__PURE__ */ __name((n) => {
  const comp = Gpows || (Gpows = precompute());
  let p = I;
  let f = G;
  for (let w = 0; w < 33; w++) {
    let wbits = Number(n & 255n);
    n >>= 8n;
    if (wbits > 128) {
      wbits -= 256;
      n += 1n;
    }
    const off = w * 128;
    const offP = off + Math.abs(wbits) - 1;
    const isOddW = w % 2 !== 0;
    const isNeg = wbits < 0;
    if (wbits === 0) {
      f = f.add(ctneg(isOddW, comp[off]));
    } else {
      p = p.add(ctneg(isNeg, comp[offP]));
    }
  }
  if (n !== 0n)
    throw new Error("invalid wnaf");
  return { p, f };
}, "wNAF");

// node_modules/@noble/hashes/_u64.js
var U32_MASK64 = /* @__PURE__ */ (() => BigInt(2 ** 32 - 1))();
var _32n = /* @__PURE__ */ BigInt(32);
function fromBig(n, le = false) {
  if (le)
    return { h: Number(n & U32_MASK64), l: Number(n >> _32n & U32_MASK64) };
  return { h: Number(n >> _32n & U32_MASK64) | 0, l: Number(n & U32_MASK64) | 0 };
}
__name(fromBig, "fromBig");
function split(lst, le = false) {
  const len = lst.length;
  let Ah = new Uint32Array(len);
  let Al = new Uint32Array(len);
  for (let i = 0; i < len; i++) {
    const { h, l } = fromBig(lst[i], le);
    [Ah[i], Al[i]] = [h, l];
  }
  return [Ah, Al];
}
__name(split, "split");

// node_modules/@noble/hashes/utils.js
function isBytes2(a) {
  return a instanceof Uint8Array || ArrayBuffer.isView(a) && a.constructor.name === "Uint8Array" && "BYTES_PER_ELEMENT" in a && a.BYTES_PER_ELEMENT === 1;
}
__name(isBytes2, "isBytes");
var atitle = /* @__PURE__ */ __name((title) => title ? `"${title}" ` : "", "atitle");
function anumber(n, title = "") {
  if (typeof n !== "number")
    throw new TypeError(atitle(title) + "expected number, got " + typeof n);
  if (!Number.isSafeInteger(n) || n < 0)
    throw new RangeError(atitle(title) + "expected integer >= 0, got " + n);
  return n;
}
__name(anumber, "anumber");
function abool(value, title = "") {
  if (typeof value !== "boolean")
    throw new TypeError(atitle(title) + "expected boolean, got type=" + typeof value);
  return value;
}
__name(abool, "abool");
function abytes2(value, length, title = "") {
  if (isBytes2(value) && (length === void 0 || value.length === length))
    return value;
  if (length !== void 0)
    anumber(length, "length");
  const bytes2 = isBytes2(value);
  const ofLen = length !== void 0 ? ` of length ${length}` : "";
  const got = bytes2 ? `length=${value.length}` : `type=${typeof value}`;
  const message = atitle(title) + "expected Uint8Array" + ofLen + ", got " + got;
  if (!bytes2)
    throw new TypeError(message);
  throw new RangeError(message);
}
__name(abytes2, "abytes");
var aobject = /* @__PURE__ */ __name((value, label) => {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    throw new TypeError((label === "object" ? "" : `"${label}" `) + "expected object, got type=" + typeof value);
}, "aobject");
var aopts = /* @__PURE__ */ __name((value, label) => {
  aobject(value, label);
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null)
    throw new TypeError(`"${label}" expected plain object`);
  if (Object.hasOwn(value, "__proto__"))
    throw new TypeError(`"${label}.__proto__" is not allowed`);
}, "aopts");
function aexists(instance, checkFinished = true) {
  if (instance.destroyed)
    throw new Error("hash was destroyed");
  if (checkFinished && instance.finished)
    throw new Error("digest() was already called");
}
__name(aexists, "aexists");
function aoutput(out2, instance) {
  abytes2(out2, void 0, "output");
  const min = instance.outputLen;
  if (!(out2.length >= min)) {
    throw new RangeError('"output" expected length >= ' + min);
  }
}
__name(aoutput, "aoutput");
function u32(arr) {
  return new Uint32Array(arr.buffer, arr.byteOffset, Math.floor(arr.byteLength / 4));
}
__name(u32, "u32");
function clean(...arrays) {
  for (let i = 0; i < arrays.length; i++) {
    arrays[i].fill(0);
  }
}
__name(clean, "clean");
var isLE = /* @__PURE__ */ (() => new Uint8Array(new Uint32Array([287454020]).buffer)[0] === 68)();
function byteSwap(word) {
  return word << 24 & 4278190080 | word << 8 & 16711680 | word >>> 8 & 65280 | word >>> 24 & 255;
}
__name(byteSwap, "byteSwap");
function byteSwap32(arr) {
  for (let i = 0; i < arr.length; i++) {
    arr[i] = byteSwap(arr[i]);
  }
  return arr;
}
__name(byteSwap32, "byteSwap32");
var swap32IfBE = isLE ? (u) => u : byteSwap32;
function checkOpts(defaults, opts, title = "opts") {
  aopts(defaults, "defaults");
  if (opts !== void 0)
    aopts(opts, title);
  const merged = Object.assign(/* @__PURE__ */ Object.create(null), defaults, opts);
  return merged;
}
__name(checkOpts, "checkOpts");
function createHasher(hashCons, info = {}) {
  if (typeof hashCons !== "function")
    throw new TypeError('"hashCons" expected function, got type=' + typeof hashCons);
  info = checkOpts({}, info, "info");
  const hashC = /* @__PURE__ */ __name((msg, opts) => hashCons(opts).update(msg).digest(), "hashC");
  const tmp = hashCons(void 0);
  hashC.outputLen = tmp.outputLen;
  hashC.blockLen = tmp.blockLen;
  hashC.canXOF = tmp.canXOF;
  hashC.create = (opts) => hashCons(opts);
  Object.assign(hashC, info);
  return Object.freeze(hashC);
}
__name(createHasher, "createHasher");

// node_modules/@noble/hashes/sha3.js
var _0n = BigInt(0);
var _1n = BigInt(1);
var _2n = BigInt(2);
var _7n = BigInt(7);
var _256n = BigInt(256);
var _0x71n = BigInt(113);
var SHA3_PI = [];
var SHA3_ROTL = [];
var _SHA3_IOTA = [];
for (let round = 0, R = _1n, x = 1, y = 0; round < 24; round++) {
  [x, y] = [y, (2 * x + 3 * y) % 5];
  SHA3_PI.push(2 * (5 * y + x));
  SHA3_ROTL.push((round + 1) * (round + 2) / 2 % 64);
  let t = _0n;
  for (let j = 0; j < 7; j++) {
    R = (R << _1n ^ (R >> _7n) * _0x71n) % _256n;
    if (R & _2n)
      t ^= _1n << (_1n << BigInt(j)) - _1n;
  }
  _SHA3_IOTA.push(t);
}
var IOTAS = split(_SHA3_IOTA, true);
var SHA3_IOTA_H = IOTAS[0];
var SHA3_IOTA_L = IOTAS[1];
var rotlSH = /* @__PURE__ */ __name((h, l, s) => h << s | l >>> 32 - s, "rotlSH");
var rotlSL = /* @__PURE__ */ __name((h, l, s) => l << s | h >>> 32 - s, "rotlSL");
var rotlBH = /* @__PURE__ */ __name((h, l, s) => l << s - 32 | h >>> 64 - s, "rotlBH");
var rotlBL = /* @__PURE__ */ __name((h, l, s) => h << s - 32 | l >>> 64 - s, "rotlBL");
var rotlH = /* @__PURE__ */ __name((h, l, s) => s > 32 ? rotlBH(h, l, s) : rotlSH(h, l, s), "rotlH");
var rotlL = /* @__PURE__ */ __name((h, l, s) => s > 32 ? rotlBL(h, l, s) : rotlSL(h, l, s), "rotlL");
var B = new Uint32Array(5 * 2);
function keccakP(s, rounds = 24) {
  if (!(s instanceof Uint32Array))
    throw new TypeError('"s" expected Uint32Array(50), got type=' + typeof s);
  if (s.length !== 50)
    throw new RangeError('"s" expected Uint32Array(50), got length=' + s.length);
  anumber(rounds, "rounds");
  if (rounds < 1 || rounds > 24)
    throw new Error('"rounds" expected integer 1..24');
  for (let round = 24 - rounds; round < 24; round++) {
    for (let x = 0; x < 10; x++)
      B[x] = s[x] ^ s[x + 10] ^ s[x + 20] ^ s[x + 30] ^ s[x + 40];
    for (let x = 0; x < 10; x += 2) {
      const idx1 = (x + 8) % 10;
      const idx0 = (x + 2) % 10;
      const B0 = B[idx0];
      const B1 = B[idx0 + 1];
      const Th = rotlH(B0, B1, 1) ^ B[idx1];
      const Tl = rotlL(B0, B1, 1) ^ B[idx1 + 1];
      for (let y = 0; y < 50; y += 10) {
        s[x + y] ^= Th;
        s[x + y + 1] ^= Tl;
      }
    }
    let curH = s[2];
    let curL = s[3];
    for (let t = 0; t < 24; t++) {
      const shift = SHA3_ROTL[t];
      const Th = rotlH(curH, curL, shift);
      const Tl = rotlL(curH, curL, shift);
      const PI = SHA3_PI[t];
      curH = s[PI];
      curL = s[PI + 1];
      s[PI] = Th;
      s[PI + 1] = Tl;
    }
    for (let y = 0; y < 50; y += 10) {
      const b0 = s[y], b1 = s[y + 1], b2 = s[y + 2], b3 = s[y + 3];
      s[y] ^= ~s[y + 2] & s[y + 4];
      s[y + 1] ^= ~s[y + 3] & s[y + 5];
      s[y + 2] ^= ~s[y + 4] & s[y + 6];
      s[y + 3] ^= ~s[y + 5] & s[y + 7];
      s[y + 4] ^= ~s[y + 6] & s[y + 8];
      s[y + 5] ^= ~s[y + 7] & s[y + 9];
      s[y + 6] ^= ~s[y + 8] & b0;
      s[y + 7] ^= ~s[y + 9] & b1;
      s[y + 8] ^= ~b0 & b2;
      s[y + 9] ^= ~b1 & b3;
    }
    s[0] ^= SHA3_IOTA_H[round];
    s[1] ^= SHA3_IOTA_L[round];
  }
  clean(B);
}
__name(keccakP, "keccakP");
var Keccak = class _Keccak {
  static {
    __name(this, "Keccak");
  }
  state;
  pos = 0;
  posOut = 0;
  finished = false;
  state32;
  destroyed = false;
  blockLen;
  suffix;
  outputLen;
  canXOF;
  enableXOF = false;
  rounds;
  // NOTE: we accept arguments in bytes instead of bits here.
  constructor(blockLen, suffix, outputLen, enableXOF = false, rounds = 24) {
    anumber(blockLen, "blockLen");
    anumber(suffix, "suffix");
    anumber(rounds, "rounds");
    abool(enableXOF, "enableXOF");
    this.blockLen = blockLen;
    this.suffix = suffix;
    this.outputLen = outputLen;
    this.enableXOF = enableXOF;
    this.canXOF = enableXOF;
    this.rounds = rounds;
    anumber(outputLen, "outputLen");
    if (!(0 < blockLen && blockLen < 200))
      throw new Error('"blockLen" must be 1..199');
    this.state = new Uint8Array(200);
    this.state32 = u32(this.state);
  }
  clone() {
    return this._cloneInto();
  }
  keccak() {
    swap32IfBE(this.state32);
    keccakP(this.state32, this.rounds);
    swap32IfBE(this.state32);
    this.posOut = 0;
    this.pos = 0;
  }
  update(data) {
    aexists(this);
    abytes2(data);
    const { blockLen, state, state32 } = this;
    const len = data.length;
    const canUseU32 = blockLen % 4 === 0 && data.byteOffset % 4 === 0;
    const blockLen32 = blockLen / 4;
    const data32 = canUseU32 && len >= blockLen ? u32(data) : void 0;
    for (let pos = 0; pos < len; ) {
      if (data32 !== void 0 && this.pos === 0 && pos % 4 === 0 && len - pos >= blockLen) {
        for (let i = 0, o = pos / 4; i < blockLen32; i++)
          state32[i] ^= data32[o + i];
        pos += blockLen;
        this.pos = blockLen;
        this.keccak();
        continue;
      }
      const take = Math.min(blockLen - this.pos, len - pos);
      for (let i = 0; i < take; i++)
        state[this.pos++] ^= data[pos++];
      if (this.pos === blockLen)
        this.keccak();
    }
    return this;
  }
  finish() {
    if (this.finished)
      return;
    this.finished = true;
    const { state, suffix, pos, blockLen } = this;
    state[pos] ^= suffix;
    if ((suffix & 128) !== 0 && pos === blockLen - 1)
      this.keccak();
    state[blockLen - 1] ^= 128;
    this.keccak();
  }
  writeInto(out2) {
    aexists(this, false);
    abytes2(out2);
    this.finish();
    const bufferOut = this.state;
    const { blockLen } = this;
    for (let pos = 0, len = out2.length; pos < len; ) {
      if (this.posOut >= blockLen)
        this.keccak();
      const take = Math.min(blockLen - this.posOut, len - pos);
      out2.set(bufferOut.subarray(this.posOut, this.posOut + take), pos);
      this.posOut += take;
      pos += take;
    }
    return out2;
  }
  xofInto(out2) {
    if (!this.enableXOF)
      throw new Error("XOF is not enabled");
    return this.writeInto(out2);
  }
  xof(bytes2) {
    anumber(bytes2);
    return this.xofInto(new Uint8Array(bytes2));
  }
  digestInto(out2) {
    aoutput(out2, this);
    if (this.finished)
      throw new Error("digest() was already called");
    this.writeInto(out2.length === this.outputLen ? out2 : out2.subarray(0, this.outputLen));
    this.destroy();
  }
  digest() {
    const out2 = new Uint8Array(this.outputLen);
    this.digestInto(out2);
    return out2;
  }
  destroy() {
    this.destroyed = true;
    clean(this.state);
  }
  _cloneInto(to) {
    const { blockLen, suffix, outputLen, rounds, enableXOF } = this;
    to ||= new _Keccak(blockLen, suffix, outputLen, enableXOF, rounds);
    to.blockLen = blockLen;
    to.state32.set(this.state32);
    to.pos = this.pos;
    to.posOut = this.posOut;
    to.finished = this.finished;
    to.rounds = rounds;
    to.suffix = suffix;
    to.outputLen = outputLen;
    to.enableXOF = enableXOF;
    to.canXOF = this.canXOF;
    to.destroyed = this.destroyed;
    return to;
  }
};
var genKeccak = /* @__PURE__ */ __name((suffix, blockLen, outputLen, info = {}) => createHasher(() => new Keccak(blockLen, suffix, outputLen), info), "genKeccak");
var keccak_256 = /* @__PURE__ */ genKeccak(1, 136, 32);

// worker.js
var A = {
  G: "0x76D89e26502d0aA9bf83DA222cfCF12a27Ead801".toLowerCase(),
  U: "0x55d398326f99059fF775485246999027B3197955".toLowerCase(),
  UNI: "0x779fcD915CD293266676B81f9503EBE8CE751a6".toLowerCase(),
  PF: "0xca143ce32fe78f1f7019d7d551a6402fc5350c73".toLowerCase()
};
var Z = "0x0000000000000000000000000000000000000000";
var S = {
  t0: "0x0dfe1681",
  t1: "0xd21220a7",
  r: "0x0902f1ac",
  pair: "0xe6a43905",
  dec: "0x313ce567",
  balanceOf: "0x70a08231",
  blockNumber: "0x"
};
var TOPIC_TRANSFER = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
var enc = new TextEncoder();
var TERMS_VERSION = "2026-09-09";
var PRIVACY_VERSION = "2026-09-09";
var emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
var walletRe = /^0x[a-fA-F0-9]{40}$/;
var txRe = /^0x[a-fA-F0-9]{64}$/;
var ranges = {
  "1H": { tf: "minute", aggregate: 5, limit: 100 },
  "4H": { tf: "minute", aggregate: 15, limit: 100 },
  "1D": { tf: "hour", aggregate: 1, limit: 100 },
  "1W": { tf: "hour", aggregate: 6, limit: 100 },
  "1M": { tf: "day", aggregate: 1, limit: 100 },
  "ALL": { tf: "day", aggregate: 1, limit: 1e3 }
};
var addr = /* @__PURE__ */ __name((x) => "0x" + String(x).slice(-40).toLowerCase(), "addr");
var clean2 = /* @__PURE__ */ __name((v, max = 120) => String(v ?? "").trim().slice(0, max), "clean");
var normalizeEmail = /* @__PURE__ */ __name((v) => clean2(v, 160).toLowerCase(), "normalizeEmail");
var canonicalEmailKey = /* @__PURE__ */ __name((email) => {
  const at = email.indexOf("@");
  if (at === -1) return email;
  let local = email.slice(0, at);
  const domain = email.slice(at + 1);
  const plus = local.indexOf("+");
  if (plus !== -1) local = local.slice(0, plus);
  if (domain === "gmail.com" || domain === "googlemail.com") local = local.replace(/\./g, "");
  return local + "@" + domain;
}, "canonicalEmailKey");
var uint = /* @__PURE__ */ __name((x) => BigInt(x), "uint");
var pad = /* @__PURE__ */ __name((a) => a.slice(2).padStart(64, "0"), "pad");
var token = /* @__PURE__ */ __name(() => [...crypto.getRandomValues(new Uint8Array(32))].map((x) => x.toString(16).padStart(2, "0")).join(""), "token");
var id = /* @__PURE__ */ __name(() => crypto.randomUUID(), "id");
var nowIso = /* @__PURE__ */ __name(() => (/* @__PURE__ */ new Date()).toISOString(), "nowIso");
function out(data, status = 200, ttl = 0, extra = {}) {
  if (ttl && typeof ttl === "object") {
    extra = ttl;
    ttl = 0;
  }
  const h = {
    "content-type": "application/json; charset=utf-8",
    "cache-control": ttl ? `public, max-age=${ttl}` : "no-store",
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
    "referrer-policy": "strict-origin-when-cross-origin",
    "permissions-policy": "camera=(), microphone=(), geolocation=()",
    "strict-transport-security": "max-age=31536000; includeSubDomains",
    "content-security-policy": "default-src 'none'; frame-ancestors 'none'",
    ...extra
  };
  return new Response(JSON.stringify(data), { status, headers: h });
}
__name(out, "out");
function htmlEscape(v) {
  return String(v ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[c]);
}
__name(htmlEscape, "htmlEscape");
function cookie(name, value, maxAge) {
  return `${name}=${value}; Max-Age=${maxAge}; Path=/; HttpOnly; Secure; SameSite=Strict`;
}
__name(cookie, "cookie");
function cors(e) {
  return {
    "access-control-allow-origin": e.PUBLIC_ORIGIN || "https://goldityglobal.com",
    "access-control-allow-credentials": "true"
  };
}
__name(cors, "cors");
async function rpc(e, method, params = []) {
  if (!e.BSC_RPC_URL) throw new Error("rpc_unavailable");
  const r = await fetch(e.BSC_RPC_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params })
  });
  if (!r.ok) throw new Error("rpc_http_error");
  const j = await r.json();
  if (j.error) {
    const err = new Error("rpc_error");
    err.rpcMessage = String(j.error.message || "");
    throw err;
  }
  return j.result;
}
__name(rpc, "rpc");
async function call(e, to, data) {
  return rpc(e, "eth_call", [{ to, data }, "latest"]);
}
__name(call, "call");
async function pair(e) {
  return addr(await call(e, A.PF, S.pair + pad(A.G) + pad(A.U)));
}
__name(pair, "pair");
async function dexscreenerPair(e) {
  const cacheKey = "dexscreener:" + A.G;
  if (e.DB) {
    const cached = await e.DB.prepare("SELECT value,updated_at FROM scanner_state WHERE key=?").bind(cacheKey).first();
    if (cached && Date.now() - new Date(cached.updated_at).getTime() < 3e5) {
      return JSON.parse(cached.value);
    }
  }
  const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${A.G}`);
  if (!res.ok) throw new Error("dexscreener_unavailable");
  const data = await res.json().catch(() => null);
  const pairs = (data?.pairs || []).filter((p) => p.chainId === "bsc");
  if (!pairs.length) throw new Error("no_pair_found");
  pairs.sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0));
  const best = pairs[0];
  const result = { url: best.url, pairAddress: best.pairAddress, dex: best.dexId };
  if (e.DB) {
    await e.DB.prepare(`
      INSERT INTO scanner_state(key,value,updated_at) VALUES(?,?,?)
      ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at
    `).bind(cacheKey, JSON.stringify(result), nowIso()).run();
  }
  return result;
}
__name(dexscreenerPair, "dexscreenerPair");
async function inspect(e, p, dex) {
  if (!p || p === Z) return { dex, status: "unavailable", reason: "pair_not_found" };
  const [x0, x1] = await Promise.all([call(e, p, S.t0), call(e, p, S.t1)]);
  const t0 = addr(x0), t1 = addr(x1);
  if (!(t0 === A.G && t1 === A.U || t0 === A.U && t1 === A.G))
    return { dex, status: "unavailable", reason: "token_mismatch", pair: p };
  const [rr, d0x, d1x] = await Promise.all([call(e, p, S.r), call(e, t0, S.dec), call(e, t1, S.dec)]);
  const r0 = Number(uint("0x" + rr.slice(2, 66))) / 10 ** Number(uint(d0x));
  const r1 = Number(uint("0x" + rr.slice(66, 130))) / 10 ** Number(uint(d1x));
  const g = t0 === A.G ? r0 : r1, u = t0 === A.U ? r0 : r1;
  return { dex, status: g > 0 ? "live" : "unavailable", pair: p, gdtyReserve: g, usdtReserve: u, price: g ? u / g : null, liquidityUsd: g ? 2 * u : null };
}
__name(inspect, "inspect");
var mean = /* @__PURE__ */ __name((a, b) => {
  const v = [a, b].filter(Number.isFinite);
  return v.length ? v.reduce((x, y) => x + y, 0) / v.length : null;
}, "mean");
async function geckoOHLCV(e, pool, cfg) {
  if (!pool || pool === Z) return [];
  const base = e.GECKO_API_BASE || "https://api.geckoterminal.com/api/v2";
  const url = `${base}/networks/bsc/pools/${pool}/ohlcv/${cfg.tf}?aggregate=${cfg.aggregate}&limit=${cfg.limit}&currency=usd`;
  const r = await fetch(url, { headers: { accept: "application/json;version=20230203" } });
  if (!r.ok) throw new Error("chart_provider_error");
  const j = await r.json();
  return j?.data?.attributes?.ohlcv_list || [];
}
__name(geckoOHLCV, "geckoOHLCV");
function normalize(list, dex) {
  return list.map((x) => ({
    ts: Number(x[0]),
    open: Number(x[1]),
    high: Number(x[2]),
    low: Number(x[3]),
    close: Number(x[4]),
    volume: Number(x[5] || 0),
    dex
  })).filter((x) => x.ts && [x.open, x.high, x.low, x.close].every(Number.isFinite));
}
__name(normalize, "normalize");
function mergeReference(a, b) {
  const am = new Map(a.map((x) => [x.ts, x])), bm = new Map(b.map((x) => [x.ts, x]));
  const keys = [.../* @__PURE__ */ new Set([...am.keys(), ...bm.keys()])].sort((x, y) => x - y);
  return keys.map((ts) => {
    const v = [am.get(ts), bm.get(ts)].filter(Boolean);
    const avg = /* @__PURE__ */ __name((k) => {
      const q = v.map((z) => z[k]).filter(Number.isFinite);
      return q.length ? q.reduce((m, n) => m + n, 0) / q.length : null;
    }, "avg");
    return {
      time: ts,
      open: avg("open"),
      high: avg("high"),
      low: avg("low"),
      close: avg("close"),
      volume: v.reduce((s, z) => s + (z.volume || 0), 0),
      sources: v.map((z) => z.dex)
    };
  }).filter((x) => [x.open, x.high, x.low, x.close].every(Number.isFinite));
}
__name(mergeReference, "mergeReference");
function b64(bytes2) {
  let s = "";
  for (const x of new Uint8Array(bytes2)) s += String.fromCharCode(x);
  return btoa(s);
}
__name(b64, "b64");
async function sha256Text(v) {
  const h = await crypto.subtle.digest("SHA-256", enc.encode(v));
  return [...new Uint8Array(h)].map((x) => x.toString(16).padStart(2, "0")).join("");
}
__name(sha256Text, "sha256Text");
async function hashIp(e, rawIp) {
  if (!e.IP_HASH_SECRET) {
    console.error("GOLDITY IP_HASH_SECRET not configured - falling back to reversible plain SHA-256 for IP hashing");
    return sha256Text(rawIp);
  }
  const key = await crypto.subtle.importKey("raw", enc.encode(e.IP_HASH_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(rawIp));
  return [...new Uint8Array(sig)].map((x) => x.toString(16).padStart(2, "0")).join("");
}
__name(hashIp, "hashIp");
async function hashPassword(password, saltBytes, iterations = 1e5) {
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: saltBytes, iterations, hash: "SHA-256" },
    key,
    256
  );
  return `pbkdf2$${iterations}$${b64(saltBytes)}$${b64(bits)}`;
}
__name(hashPassword, "hashPassword");
function validPassword(p) {
  return typeof p === "string" && p.length >= 10 && p.length <= 128;
}
__name(validPassword, "validPassword");
async function currentUser(e, req) {
  if (!e.DB) return null;
  const m = req.headers.get("Cookie") || "";
  const hit = m.match(/(?:^|;\s*)GDTY_SESSION=([^;]+)/);
  if (!hit) return null;
  const h = await sha256Text(hit[1]);
  return e.DB.prepare(`
    SELECT u.id,u.email,u.first_name,u.last_name,u.country,u.phone,u.wallet_address,
           u.referral_code,u.referred_by,u.email_verified,u.marketing_consent,
           u.role,u.created_at
    FROM sessions s JOIN users u ON u.id=s.user_id
    WHERE s.token_hash=? AND s.expires_at>? AND u.email_verified=1
  `).bind(h, nowIso()).first();
}
__name(currentUser, "currentUser");
async function requireOrigin(e, req, opts) {
  const origin = req.headers.get("Origin");
  if (!origin) return true;
  if (origin === "null" && opts?.allowNullOrigin) return true;
  if (origin !== (e.PUBLIC_ORIGIN || "https://goldityglobal.com")) return false;
  return true;
}
__name(requireOrigin, "requireOrigin");
async function verifyTurnstile(e, token2, remoteIp) {
  if (!e.TURNSTILE_SECRET_KEY) {
    console.error("GOLDITY: TURNSTILE_SECRET_KEY not set - rejecting airdrop claims until it is configured");
    return false;
  }
  if (!token2 || typeof token2 !== "string") return false;
  try {
    const body = new URLSearchParams();
    body.append("secret", e.TURNSTILE_SECRET_KEY);
    body.append("response", token2);
    if (remoteIp) body.append("remoteip", remoteIp);
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: body.toString(),
      signal: AbortSignal.timeout(8e3)
    });
    const data = await res.json().catch(() => ({}));
    if (data?.success !== true) return false;
    const expectedHost = new URL(e.PUBLIC_ORIGIN || "https://goldityglobal.com").hostname;
    if (data.hostname && data.hostname !== expectedHost && data.hostname !== "www." + expectedHost) return false;
    return true;
  } catch (err) {
    console.error("GOLDITY turnstile verify error", err);
    return false;
  }
}
__name(verifyTurnstile, "verifyTurnstile");
async function rateLimit(e, key, limit = 12, windowMs = 6e4) {
  if (!e.DB) return true;
  const windowSec = Math.max(1, Math.floor(windowMs / 1e3));
  for (let attempt = 0; attempt < 3; attempt++) {
    const now = Math.floor(Date.now() / 1e3);
    const start = now - windowSec;
    await e.DB.prepare("INSERT INTO rate_limits(key,attempts,window_start,updated_at) VALUES(?,0,?,?) ON CONFLICT(key) DO NOTHING").bind(key, now, now).run();
    const inc = await e.DB.prepare("UPDATE rate_limits SET attempts=attempts+1,updated_at=? WHERE key=? AND window_start>=? AND attempts<?").bind(now, key, start, limit).run();
    if (inc?.meta?.changes) return true;
    const row = await e.DB.prepare("SELECT attempts,window_start FROM rate_limits WHERE key=?").bind(key).first();
    if (!row) continue;
    if (Number(row.window_start) >= start) return false;
    const reset = await e.DB.prepare("UPDATE rate_limits SET attempts=1,window_start=?,updated_at=? WHERE key=? AND window_start<?").bind(now, now, key, start).run();
    if (reset?.meta?.changes) return true;
  }
  return false;
}
__name(rateLimit, "rateLimit");
function ip(req) {
  return req.headers.get("CF-Connecting-IP") || "unknown";
}
__name(ip, "ip");
function ipBucket(rawIp) {
  if (!rawIp || !rawIp.includes(":")) return rawIp || "unknown";
  const mapped = rawIp.match(/(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (mapped) return mapped[1];
  let parts = rawIp.toLowerCase().split("%")[0].split(":");
  const gap = parts.indexOf("");
  if (gap !== -1) {
    const head = parts.slice(0, gap).filter(Boolean), tail = parts.slice(gap + 1).filter(Boolean);
    parts = [...head, ...Array(Math.max(0, 8 - head.length - tail.length)).fill("0"), ...tail];
  }
  return "v6:" + parts.slice(0, 4).map((x) => x.padStart(4, "0")).join(":") + "::/64";
}
__name(ipBucket, "ipBucket");
async function loginUser(e, req) {
  if (!e.DB) return out({ ok: false, error: "registration_not_configured" }, 503, cors(e));
  if (!await requireOrigin(e, req)) return out({ ok: false, error: "forbidden" }, 403, cors(e));
  if (!await rateLimit(e, `login:${ip(req)}`, 8, 6e4)) return out({ ok: false, error: "rate_limited", message: "Too many attempts. Please try again shortly." }, 429, cors(e));
  const d = await req.json().catch(() => ({}));
  const email = normalizeEmail(d.email), password = String(d.password || "");
  if (!await rateLimit(e, `login-acct:${await sha256Text(email)}`, 10, 9e5)) return out({ ok: false, error: "rate_limited", message: "Too many attempts. Please try again shortly." }, 429, cors(e));
  const row = await e.DB.prepare("SELECT * FROM users WHERE email=?").bind(email).first();
  if (!row) return out({ ok: false, error: "invalid_credentials", message: "Email or password is incorrect." }, 401, cors(e));
  const p = String(row.password_hash || "").split("$");
  if (p.length !== 4) return out({ ok: false, error: "invalid_credentials", message: "Email or password is incorrect." }, 401, cors(e));
  const iterations = Number(p[1]) || 1e5;
  const salt = Uint8Array.from(atob(p[2]), (c) => c.charCodeAt(0));
  const expected = await hashPassword(password, salt, iterations);
  if (expected !== row.password_hash) return out({ ok: false, error: "invalid_credentials", message: "Email or password is incorrect." }, 401, cors(e));
  if (!row.email_verified) return out({ ok: false, error: "email_not_verified", message: "Please verify your email before signing in." }, 403, cors(e));
  const raw = token(), hash = await sha256Text(raw), now = nowIso();
  const exp = new Date(Date.now() + 7 * 864e5).toISOString();
  await e.DB.batch([
    e.DB.prepare("INSERT INTO sessions(token_hash,user_id,expires_at,created_at) VALUES(?,?,?,?)").bind(hash, row.id, exp, now),
    e.DB.prepare("DELETE FROM sessions WHERE user_id=? AND expires_at<=?").bind(row.id, now)
  ]);
  await graduateReferralRewards(e, row.id).catch((err) => console.error("GOLDITY graduate error", err));
  return out({
    ok: true,
    user: {
      id: row.id,
      email: row.email,
      firstName: row.first_name,
      lastName: row.last_name,
      country: row.country
    }
  }, 200, 0, { ...cors(e), "set-cookie": cookie("GDTY_SESSION", raw, 7 * 86400) });
}
__name(loginUser, "loginUser");
function bytes(hexString) {
  const h = String(hexString || "").replace(/^0x/i, "");
  const clean3 = h.length % 2 ? "0" + h : h;
  const out2 = new Uint8Array(clean3.length / 2);
  for (let i = 0; i < out2.length; i++) out2[i] = parseInt(clean3.substr(i * 2, 2), 16);
  return out2;
}
__name(bytes, "bytes");
function concatBytes2(arrays) {
  const total = arrays.reduce((n, a) => n + a.length, 0);
  const out2 = new Uint8Array(total);
  let off = 0;
  for (const a of arrays) {
    out2.set(a, off);
    off += a.length;
  }
  return out2;
}
__name(concatBytes2, "concatBytes");
function bigIntToBytes(n) {
  if (n === 0n) return new Uint8Array(0);
  let hex = n.toString(16);
  if (hex.length % 2) hex = "0" + hex;
  return bytes(hex);
}
__name(bigIntToBytes, "bigIntToBytes");
function rlpEncodeLength(len, offset) {
  if (len < 56) return new Uint8Array([offset + len]);
  let hex = len.toString(16);
  if (hex.length % 2) hex = "0" + hex;
  const lenBytes = bytes(hex);
  return concatBytes2([new Uint8Array([offset + 55 + lenBytes.length]), lenBytes]);
}
__name(rlpEncodeLength, "rlpEncodeLength");
function rlpEncode(input) {
  if (Array.isArray(input)) {
    const parts = input.map(rlpEncode);
    const body = concatBytes2(parts);
    return concatBytes2([rlpEncodeLength(body.length, 192), body]);
  }
  const b = input instanceof Uint8Array ? input : bigIntToBytes(input);
  if (b.length === 1 && b[0] < 128) return b;
  return concatBytes2([rlpEncodeLength(b.length, 128), b]);
}
__name(rlpEncode, "rlpEncode");
function addressFromPrivateKey(privHex) {
  const priv = bytes(privHex);
  const pub = getPublicKey(priv, false);
  const uncompressed = pub.length === 65 ? pub.slice(1) : pub;
  const h = keccak_256(uncompressed);
  return "0x" + [...h.slice(-20)].map((x) => x.toString(16).padStart(2, "0")).join("");
}
__name(addressFromPrivateKey, "addressFromPrivateKey");
function erc20TransferData(to, amountWei) {
  return "0xa9059cbb" + pad(to) + bigIntToBytes(amountWei).reduce((s, b) => s + b.toString(16).padStart(2, "0"), "").padStart(64, "0");
}
__name(erc20TransferData, "erc20TransferData");
async function signLegacyTx(privHex, { nonce, gasPrice, gasLimit, to, value, data }) {
  const chainId = 56n;
  const build = /* @__PURE__ */ __name((fields) => fields, "build");
  const msgFields = build([
    bigIntToBytes(BigInt(nonce)),
    bigIntToBytes(gasPrice),
    bigIntToBytes(BigInt(gasLimit)),
    bytes(to),
    bigIntToBytes(value),
    bytes(data),
    bigIntToBytes(chainId),
    new Uint8Array(0),
    new Uint8Array(0)
  ]);
  const unsignedRlp = rlpEncode(msgFields);
  const msgHash = keccak_256(unsignedRlp);
  const privKeyBytes = bytes(privHex);
  const sigBytes = await signAsync(msgHash, privKeyBytes, { format: "recovered", prehash: false });
  const recovery = BigInt(sigBytes[0]);
  const rBig = uint("0x" + [...sigBytes.slice(1, 33)].map((x) => x.toString(16).padStart(2, "0")).join(""));
  const sBig = uint("0x" + [...sigBytes.slice(33, 65)].map((x) => x.toString(16).padStart(2, "0")).join(""));
  const v = chainId * 2n + 35n + recovery;
  const finalFields = [
    bigIntToBytes(BigInt(nonce)),
    bigIntToBytes(gasPrice),
    bigIntToBytes(BigInt(gasLimit)),
    bytes(to),
    bigIntToBytes(value),
    bytes(data),
    bigIntToBytes(v),
    bigIntToBytes(rBig),
    bigIntToBytes(sBig)
  ];
  const finalRlp = rlpEncode(finalFields);
  return "0x" + [...finalRlp].map((x) => x.toString(16).padStart(2, "0")).join("");
}
__name(signLegacyTx, "signLegacyTx");
function localTxHash(signedTx) {
  return "0x" + [...keccak_256(bytes(signedTx))].map((x) => x.toString(16).padStart(2, "0")).join("");
}
__name(localTxHash, "localTxHash");
async function safeBroadcast(e, signedTx) {
  const expectedHash = localTxHash(signedTx);
  try {
    return { sent: true, txHash: await rpc(e, "eth_sendRawTransaction", [signedTx]) };
  } catch (err) {
    if (String(err?.rpcMessage || "").toLowerCase().includes("already known")) return { sent: true, txHash: expectedHash };
    if (err?.message === "rpc_error") return { sent: false, err };
    await new Promise((r) => setTimeout(r, 2500));
    const seen = await rpc(e, "eth_getTransactionByHash", [expectedHash]).catch(() => void 0);
    if (seen) return { sent: true, txHash: expectedHash };
    if (seen === null) return { sent: false, err };
    return { sent: "unknown", txHash: expectedHash };
  }
}
__name(safeBroadcast, "safeBroadcast");
async function getNonce(e, address) {
  return parseInt(await rpc(e, "eth_getTransactionCount", [address, "pending"]), 16);
}
__name(getNonce, "getNonce");
async function getGasPrice(e) {
  return BigInt(await rpc(e, "eth_gasPrice", []));
}
__name(getGasPrice, "getGasPrice");
function eip191Digest(message) {
  const msgBytes = enc.encode(message);
  const prefix = enc.encode(`Ethereum Signed Message:
${msgBytes.length}`);
  return keccak_256(concatBytes2([prefix, msgBytes]));
}
__name(eip191Digest, "eip191Digest");
function recoveredAddress(signatureHex, message) {
  const raw = bytes(signatureHex);
  if (raw.length !== 65) throw new Error("invalid_signature");
  let v = raw[64];
  if (v >= 27) v -= 27;
  if (v > 1) throw new Error("invalid_signature");
  const sig = new Uint8Array(65);
  sig[0] = v;
  sig.set(raw.slice(0, 64), 1);
  const pub = recoverPublicKey(sig, eip191Digest(message), { prehash: false, isCompressed: false });
  const uncompressed = pub.length === 65 ? pub.slice(1) : pub;
  const h = keccak_256(uncompressed);
  return "0x" + [...h.slice(-20)].map((x) => x.toString(16).padStart(2, "0")).join("");
}
__name(recoveredAddress, "recoveredAddress");
async function tokenBalance(e, tokenAddress, account) {
  const raw = await call(e, tokenAddress, S.balanceOf + pad(account));
  return BigInt(raw);
}
__name(tokenBalance, "tokenBalance");
async function makeReferralCode(e) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  for (let i = 0; i < 8; i++) {
    const bytes2 = crypto.getRandomValues(new Uint8Array(8));
    const code = "GDTY-" + [...bytes2].map((b) => alphabet[b % alphabet.length]).join("");
    const existing = await e.DB.prepare("SELECT id FROM users WHERE referral_code=?").bind(code).first();
    if (!existing) return code;
  }
  return "GDTY-" + crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
}
__name(makeReferralCode, "makeReferralCode");
async function walletChallenge(e, req) {
  const u = await currentUser(e, req);
  if (!u) return out({ ok: false, error: "unauthorized" }, 401, cors(e));
  if (!await requireOrigin(e, req)) return out({ ok: false, error: "forbidden" }, 403, cors(e));
  const d = await req.json().catch(() => ({})), address = String(d.address || "").toLowerCase();
  if (!walletRe.test(address)) return out({ ok: false, error: "invalid_wallet" }, 400, cors(e));
  const existing = await e.DB.prepare("SELECT user_id FROM wallets WHERE address=?").bind(address).first();
  if (existing && existing.user_id !== u.id) return out({ ok: false, error: "wallet_already_bound" }, 409, cors(e));
  const challengeId = id(), nonce = token();
  const message = [
    "GOLDITY wallet verification",
    `Address: ${address}`,
    `Nonce: ${nonce}`,
    "This signature does not authorize any blockchain transaction."
  ].join("\n");
  const exp = new Date(Date.now() + 10 * 60 * 1e3).toISOString();
  await e.DB.prepare("DELETE FROM wallet_challenges WHERE user_id=? AND used_at IS NULL").bind(u.id).run();
  await e.DB.prepare(`
    INSERT INTO wallet_challenges(id,user_id,wallet_address,nonce,message,expires_at,created_at)
    VALUES(?,?,?,?,?,?,?)
  `).bind(challengeId, u.id, address, nonce, message, exp, nowIso()).run();
  return out({ ok: true, challengeId, message, expiresAt: exp }, 200, 0, cors(e));
}
__name(walletChallenge, "walletChallenge");
async function walletVerify(e, req) {
  const u = await currentUser(e, req);
  if (!u) return out({ ok: false, error: "unauthorized" }, 401, cors(e));
  if (!await requireOrigin(e, req)) return out({ ok: false, error: "forbidden" }, 403, cors(e));
  const d = await req.json().catch(() => ({}));
  const ch = await e.DB.prepare("SELECT * FROM wallet_challenges WHERE id=? AND user_id=? AND used_at IS NULL").bind(d.challengeId, u.id).first();
  if (!ch || new Date(ch.expires_at) <= /* @__PURE__ */ new Date()) return out({ ok: false, error: "challenge_expired" }, 400, cors(e));
  let recovered;
  try {
    recovered = recoveredAddress(String(d.signature || ""), ch.message);
  } catch {
    return out({ ok: false, error: "invalid_signature" }, 400, cors(e));
  }
  if (recovered !== ch.wallet_address) return out({ ok: false, error: "signature_mismatch" }, 400, cors(e));
  const existing = await e.DB.prepare("SELECT user_id FROM wallets WHERE address=?").bind(ch.wallet_address).first();
  if (existing && existing.user_id !== u.id) return out({ ok: false, error: "wallet_already_bound" }, 409, cors(e));
  const now = nowIso();
  await e.DB.batch([
    e.DB.prepare("UPDATE wallet_challenges SET used_at=? WHERE id=?").bind(now, ch.id),
    e.DB.prepare(`
      INSERT INTO wallets(id,user_id,address,chain_id,verified,verified_at,created_at,updated_at)
      VALUES(?,?,?,56,1,?,?,?)
      ON CONFLICT(address) DO UPDATE SET user_id=excluded.user_id,verified=1,verified_at=excluded.verified_at,updated_at=excluded.updated_at
    `).bind(id(), u.id, ch.wallet_address, now, now, now),
    e.DB.prepare("UPDATE users SET wallet_address=?,updated_at=? WHERE id=?").bind(ch.wallet_address, now, u.id)
  ]);
  return out({ ok: true, walletAddress: ch.wallet_address }, 200, 0, cors(e));
}
__name(walletVerify, "walletVerify");
var DISPOSABLE_EMAIL_DOMAINS = /* @__PURE__ */ new Set([
  "mailinator.com", "guerrillamail.com", "guerrillamail.net", "guerrillamail.org", "guerrillamail.biz", "guerrillamail.de", "sharklasers.com", "grr.la",
  "10minutemail.com", "10minutemail.net", "tempmail.com", "temp-mail.org", "temp-mail.io", "tempmail.net", "tempmailo.com", "tempr.email",
  "yopmail.com", "yopmail.net", "yopmail.fr", "trashmail.com", "trashmail.net", "getnada.com", "nada.email", "dispostable.com", "maildrop.cc",
  "throwawaymail.com", "fakeinbox.com", "mailnesia.com", "mintemail.com", "mohmal.com", "emailondeck.com", "burnermail.io", "spamgourmet.com",
  "mytemp.email", "tmpmail.org", "tmpmail.net", "moakt.com", "discard.email", "mailcatch.com", "inboxkitten.com", "harakirimail.com", "spambox.us",
  "1secmail.com", "1secmail.net", "1secmail.org"
]);
async function registerUser(e, req) {
  if (!e.DB) return out({ ok: false, error: "registration_not_configured" }, 503, cors(e));
  if (!await requireOrigin(e, req)) return out({ ok: false, error: "forbidden" }, 403, cors(e));
  if (!await rateLimit(e, `register:${ipBucket(ip(req))}`, 5, 36e5)) return out({ ok: false, error: "rate_limited" }, 429, cors(e));
  const d = await req.json().catch(() => ({}));
  if (String(e.REGISTER_REQUIRE_CAPTCHA).toLowerCase() !== "false" && !await verifyTurnstile(e, d.turnstileToken, ip(req)))
    return out({ ok: false, error: "captcha_failed", message: "Please complete the security check and try again." }, 400, cors(e));
  const first = clean2(d.firstName, 80), last = clean2(d.lastName, 80), email = normalizeEmail(d.email);
  const country = clean2(d.country, 80), phone = clean2(d.phone, 40) || null;
  const password = String(d.password || "");
  if (!emailRe.test(email) || !validPassword(password) || !d.ageConfirmed || !d.termsAccepted || !d.privacyAccepted)
    return out({ ok: false, error: "validation_failed", message: "Please complete the required registration fields and accept the required terms." }, 400, cors(e));
  if (clean2(d.referralCode, 32) && DISPOSABLE_EMAIL_DOMAINS.has(email.slice(email.indexOf("@") + 1)))
    return out({ ok: false, error: "email_not_allowed", message: "Please use a permanent email address when registering with a referral code." }, 400, cors(e));
  if (await e.DB.prepare("SELECT id FROM users WHERE email=?").bind(email).first())
    return out({ ok: false, error: "email_exists", message: "An account with this email already exists." }, 409, cors(e));
  const canonical = canonicalEmailKey(email);
  if (await e.DB.prepare("SELECT id FROM users WHERE canonical_email=? OR email=?").bind(canonical, canonical).first())
    return out({ ok: false, error: "email_exists", message: "An account with this email already exists." }, 409, cors(e));
  if (canonical !== email) {
    const localPrefix = canonical.slice(0, canonical.indexOf("@"));
    const domain = canonical.slice(canonical.indexOf("@") + 1);
    const likeEsc = /* @__PURE__ */ __name((s) => s.replace(/[\\%_]/g, (m) => "\\" + m), "likeEsc");
    const aliasMatch = await e.DB.prepare("SELECT id FROM users WHERE email LIKE ? ESCAPE '\\' AND email LIKE ? ESCAPE '\\'").bind(`${likeEsc(localPrefix)}+%`, `%@${likeEsc(domain)}`).first();
    if (aliasMatch) return out({ ok: false, error: "email_exists", message: "An account with this email already exists." }, 409, cors(e));
  }
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await hashPassword(password, salt);
  const uid = id(), now = nowIso();
  let referredBy = null;
  const refInput = clean2(d.referralCode, 32).toUpperCase();
  if (refInput) {
    const refRow = await e.DB.prepare("SELECT referral_code FROM users WHERE referral_code=?").bind(refInput).first();
    if (!refRow) return out({ ok: false, error: "invalid_referral", message: "The referral code is not valid." }, 400, cors(e));
    referredBy = refRow.referral_code;
  }
  const myCode = await makeReferralCode(e);
  try {
    await e.DB.prepare(`
      INSERT INTO users(id,email,canonical_email,password_hash,first_name,last_name,country,phone,referral_code,referred_by,
      email_verified,terms_version,privacy_version,age_confirmed,marketing_consent,created_at,updated_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).bind(uid, email, canonical, hash, first, last, country, phone, myCode, referredBy, 0, TERMS_VERSION, PRIVACY_VERSION, 1, d.marketingConsent ? 1 : 0, now, now).run();
  } catch {
    return out({ ok: false, error: "registration_failed", message: "Account creation failed. Please try again." }, 500, cors(e));
  }
  try {
    const ipHash = await hashIp(e, ipBucket(ip(req)));
    await e.DB.prepare("INSERT INTO audit_log(id,user_id,event_type,ip_hash,created_at) VALUES(?,?,?,?,?)").bind(id(), uid, "register", ipHash, now).run();
  } catch {
  }
  const raw = token(), tokenHash = await sha256Text(raw), exp = new Date(Date.now() + 864e5).toISOString();
  await e.DB.prepare("INSERT INTO email_verification_tokens(token_hash,user_id,expires_at,created_at) VALUES(?,?,?,?)").bind(tokenHash, uid, exp, now).run();
  let emailSent = false;
  if (e.RESEND_API_KEY && e.FROM_EMAIL) {
    const link = `${e.PUBLIC_ORIGIN || "https://goldityglobal.com"}/verify-email.html?token=${encodeURIComponent(raw)}`;
    try {
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { authorization: `Bearer ${e.RESEND_API_KEY}`, "content-type": "application/json" },
        signal: AbortSignal.timeout(8e3),
        body: JSON.stringify({
          from: e.FROM_EMAIL,
          to: [email],
          subject: "Verify your GOLDITY account",
          html: `<div style="font-family:Arial;background:#080808;color:#f5f0e6;padding:32px"><h2>Welcome to GOLDITY</h2><p>Hello ${htmlEscape(first)},</p><p>Verify your email to activate your account.</p><p><a href="${htmlEscape(link)}">Verify Email</a></p></div>`
        })
      });
      emailSent = r.ok;
      if (!r.ok) console.error("GOLDITY Resend error (verify-email)", r.status, await r.text().catch(() => ""));
    } catch (err) {
      console.error("GOLDITY Resend request failed (verify-email)", err);
    }
  } else {
    console.error("GOLDITY email not configured: RESEND_API_KEY or FROM_EMAIL missing");
  }
  return out({ ok: true, status: "pending_email_verification", emailSent, user: { id: uid, email, firstName: first, lastName: last, country, createdAt: now } }, 201, cors(e));
}
__name(registerUser, "registerUser");
async function verifyEmail(e, req) {
  if (!e.DB) return out({ ok: false, error: "registration_not_configured" }, 503, cors(e));
  const raw = new URL(req.url).searchParams.get("token") || "";
  if (!raw) return out({ ok: false, error: "invalid_token" }, 400, cors(e));
  const h = await sha256Text(raw);
  const row = await e.DB.prepare("SELECT * FROM email_verification_tokens WHERE token_hash=? AND used_at IS NULL").bind(h).first();
  if (!row || new Date(row.expires_at) <= /* @__PURE__ */ new Date()) return out({ ok: false, error: "expired_or_invalid_token", message: "This verification link is invalid or expired." }, 400, cors(e));
  const now = nowIso();
  await e.DB.batch([
    e.DB.prepare("UPDATE users SET email_verified=1,updated_at=? WHERE id=?").bind(now, row.user_id),
    e.DB.prepare("UPDATE email_verification_tokens SET used_at=? WHERE token_hash=?").bind(now, h)
  ]);
  return out({ ok: true, message: "Email verified. Your GOLDITY account is now active." }, 200, 0, cors(e));
}
__name(verifyEmail, "verifyEmail");
async function requestPasswordReset(e, req) {
  if (!e.DB) return out({ ok: false, error: "registration_not_configured" }, 503, cors(e));
  if (!await requireOrigin(e, req)) return out({ ok: false, error: "forbidden" }, 403, cors(e));
  if (!await rateLimit(e, `forgot:${ip(req)}`, 5, 36e5)) return out({ ok: false, error: "rate_limited" }, 429, cors(e));
  const d = await req.json().catch(() => ({}));
  const email = normalizeEmail(d.email);
  const genericResponse = { ok: true, message: "If that email has a GOLDITY account, a reset link has been sent." };
  const row = await e.DB.prepare("SELECT * FROM users WHERE email=?").bind(email).first();
  if (!row) return out(genericResponse, 200, 0, cors(e));
  const raw = token(), tokenHash = await sha256Text(raw), now = nowIso(), exp = new Date(Date.now() + 36e5).toISOString();
  await e.DB.prepare("DELETE FROM password_reset_tokens WHERE user_id=? AND used_at IS NULL").bind(row.id).run();
  await e.DB.prepare("INSERT INTO password_reset_tokens(token_hash,user_id,expires_at,created_at) VALUES(?,?,?,?)").bind(tokenHash, row.id, exp, now).run();
  if (e.RESEND_API_KEY && e.FROM_EMAIL) {
    const link = `${e.PUBLIC_ORIGIN || "https://goldityglobal.com"}/reset-password.html?token=${encodeURIComponent(raw)}`;
    try {
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { authorization: `Bearer ${e.RESEND_API_KEY}`, "content-type": "application/json" },
        signal: AbortSignal.timeout(8e3),
        body: JSON.stringify({
          from: e.FROM_EMAIL,
          to: [email],
          subject: "Reset your GOLDITY password",
          html: `<div style="font-family:Arial;background:#080808;color:#f5f0e6;padding:32px"><h2>Reset your password</h2><p>Hello ${htmlEscape(row.first_name || "")},</p><p>Click the link below to set a new password. This link expires in 1 hour and can only be used once.</p><p><a href="${htmlEscape(link)}">Reset Password</a></p><p>If you didn't request this, you can safely ignore this email.</p></div>`
        })
      });
      if (!r.ok) console.error("GOLDITY Resend error (reset-password)", r.status, await r.text().catch(() => ""));
    } catch (err) {
      console.error("GOLDITY Resend request failed (reset-password)", err);
    }
  } else {
    console.error("GOLDITY email not configured: RESEND_API_KEY or FROM_EMAIL missing (reset-password)");
  }
  return out(genericResponse, 200, 0, cors(e));
}
__name(requestPasswordReset, "requestPasswordReset");
async function resetPassword(e, req) {
  if (!e.DB) return out({ ok: false, error: "registration_not_configured" }, 503, cors(e));
  if (!await requireOrigin(e, req)) return out({ ok: false, error: "forbidden" }, 403, cors(e));
  const d = await req.json().catch(() => ({}));
  const raw = String(d.token || ""), password = String(d.password || "");
  if (password.length < 10) return out({ ok: false, error: "weak_password", message: "Password must be at least 10 characters." }, 400, cors(e));
  const tokenHash = await sha256Text(raw);
  const row = await e.DB.prepare("SELECT * FROM password_reset_tokens WHERE token_hash=? AND used_at IS NULL").bind(tokenHash).first();
  if (!row || new Date(row.expires_at) <= /* @__PURE__ */ new Date()) return out({ ok: false, error: "expired_or_invalid_token", message: "This reset link is invalid or expired." }, 400, cors(e));
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await hashPassword(password, salt);
  const now = nowIso();
  await e.DB.batch([
    e.DB.prepare("UPDATE users SET password_hash=?,updated_at=? WHERE id=?").bind(hash, now, row.user_id),
    e.DB.prepare("UPDATE password_reset_tokens SET used_at=? WHERE token_hash=?").bind(now, tokenHash),
    // Invalidate every existing session, in case the account (not just the
    // password) was compromised - this signs the person out everywhere.
    e.DB.prepare("DELETE FROM sessions WHERE user_id=?").bind(row.user_id)
  ]);
  return out({ ok: true, message: "Password updated. You can now sign in with your new password." }, 200, 0, cors(e));
}
__name(resetPassword, "resetPassword");
function parseTransfer(log) {
  if (String(log.topics?.[0]).toLowerCase() !== TOPIC_TRANSFER) return null;
  if (!log.topics?.[1] || !log.topics?.[2]) return null;
  return { token: String(log.address).toLowerCase(), from: addr(log.topics[1]), to: addr(log.topics[2]), amount: BigInt(log.data || "0x0").toString() };
}
__name(parseTransfer, "parseTransfer");
async function verifyTrade(e, u, txHash) {
  if (!u.wallet_address) return { ok: false, error: "wallet_not_connected" };
  const wallet = u.wallet_address.toLowerCase();
  const tx = await rpc(e, "eth_getTransactionByHash", [txHash]);
  const receipt = await rpc(e, "eth_getTransactionReceipt", [txHash]);
  if (!tx || !receipt) return { ok: false, error: "transaction_not_found" };
  if (String(tx.from).toLowerCase() !== wallet) return { ok: false, error: "transaction_wallet_mismatch" };
  if (receipt.status !== "0x1") return { ok: false, error: "transaction_failed" };
  const logs = (receipt.logs || []).map(parseTransfer).filter(Boolean);
  let gdtyIn = 0n, gdtyOut = 0n;
  for (const l of logs) {
    if (l.token !== A.G) continue;
    if (l.to === wallet) gdtyIn += BigInt(l.amount);
    if (l.from === wallet) gdtyOut += BigInt(l.amount);
  }
  const gdtyNet = gdtyIn - gdtyOut;
  if (gdtyNet === 0n) return { ok: false, error: "unsupported_trade" };
  const side = gdtyNet > 0n ? "buy" : "sell";
  let usdtIn = 0n, usdtOut = 0n;
  for (const l of logs) {
    if (l.token !== A.U) continue;
    if (l.to === wallet) usdtIn += BigInt(l.amount);
    if (l.from === wallet) usdtOut += BigInt(l.amount);
  }
  const otherTokenOut = logs.some((l) => l.token !== A.G && l.from === wallet);
  const otherTokenIn = logs.some((l) => l.token !== A.G && l.to === wallet);
  const bnbSent = BigInt(tx.value || "0x0") > 0n;
  if (side === "buy" && !(usdtOut > 0n || otherTokenOut || bnbSent)) return { ok: false, error: "unsupported_trade" };
  if (side === "sell" && !(usdtIn > 0n || otherTokenIn)) return { ok: false, error: "unsupported_trade" };
  const pp = await pair(e);
  let rewardEligible = false;
  if (side === "buy") {
    const pools = /* @__PURE__ */ new Set([pp]);
    try {
      const wbnbPair = addr(await call(e, A.PF, S.pair + pad(A.G) + pad("0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c")));
      if (wbnbPair !== Z) pools.add(wbnbPair);
    } catch {
    }
    pools.delete(Z);
    let fromPools = 0n;
    for (const l of logs) if (l.token === A.G && pools.has(l.from)) fromPools += BigInt(l.amount);
    rewardEligible = fromPools >= gdtyNet;
  }
  const dexMap = /* @__PURE__ */ new Map([[A.UNI, "Uniswap V2"], [pp, "PancakeSwap V2"]]);
  const dex = dexMap.get(String(tx.to || "").toLowerCase()) || "On-chain";
  return {
    ok: true,
    side,
    dex,
    pair: String(tx.to || "").toLowerCase(),
    gdty: (side === "buy" ? gdtyNet : -gdtyNet).toString(),
    usdt: (side === "buy" ? usdtOut : usdtIn).toString(),
    block: parseInt(receipt.blockNumber, 16),
    rewardEligible
  };
}
__name(verifyTrade, "verifyTrade");
var MIN_QUALIFYING_GDTY_WEI = 50n * 10n ** 18n;
var REFERRAL_RATE_BPS = 300n;
var DAILY_CAP_MILLIGDTY = 2e5;
var PENDING_DAYS = 7;
var GIVE_UP_AFTER_DAYS = 3;
var DAILY_PAYOUT_LIMIT_MILLIGDTY = 2e6;
var RISK_FREEZE_SCORE = 5;
function todayUtc() {
  return (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
}
__name(todayUtc, "todayUtc");
function weiToMilliGdty(wei) {
  return Number(wei / 10n ** 15n);
}
__name(weiToMilliGdty, "weiToMilliGdty");
function milliGdtyToWei(milli) {
  return BigInt(milli) * 10n ** 15n;
}
__name(milliGdtyToWei, "milliGdtyToWei");
function formatMilliGdty(milli) {
  return (milli / 1e3).toLocaleString("en-US", { maximumFractionDigits: 3 });
}
__name(formatMilliGdty, "formatMilliGdty");
async function notifyCapForfeited(e, referrerId, forfeitedMilli) {
  if (forfeitedMilli <= 0) return;
  await e.DB.prepare(`INSERT INTO notifications(id,user_id,type,title,message,created_at) VALUES(?,?,?,?,?,?)`).bind(
    id(),
    referrerId,
    "referral_cap_forfeited",
    "Part of a referral reward was forfeited",
    `The daily referral reward cap (200 GDTY) had already been reached, so ${formatMilliGdty(forfeitedMilli)} GDTY of a qualifying referral reward could not be granted. This amount is forfeited and will not be paid later.`,
    nowIso()
  ).run().catch((err) => console.error("GOLDITY cap-forfeited notification error", err));
}
__name(notifyCapForfeited, "notifyCapForfeited");
async function referralCapGroup(e, refUser) {
  const ipRow = await e.DB.prepare("SELECT ip_hash FROM audit_log WHERE user_id=? AND event_type='register' ORDER BY created_at ASC LIMIT 1").bind(refUser.id).first();
  if (!ipRow?.ip_hash) return "user:" + refUser.id;
  const siblingCount = await e.DB.prepare(`
    SELECT COUNT(DISTINCT u.id) AS c FROM audit_log a JOIN users u ON u.id=a.user_id
    WHERE a.event_type='register' AND a.ip_hash=? AND u.id!=?
  `).bind(ipRow.ip_hash, refUser.id).first();
  if (Number(siblingCount?.c || 0) > 0) return "ip:" + ipRow.ip_hash;
  return "user:" + refUser.id;
}
__name(referralCapGroup, "referralCapGroup");
async function reserveDailyCap(e, capGroup, desiredMilli) {
  if (desiredMilli <= 0) return 0;
  const day = todayUtc(), now = nowIso();
  await e.DB.prepare("INSERT INTO referral_daily_caps(cap_group,day,total_milligdty,updated_at) VALUES(?,?,0,?) ON CONFLICT(cap_group,day) DO NOTHING").bind(capGroup, day, now).run();
  for (let attempt = 0; attempt < 4; attempt++) {
    const row = await e.DB.prepare("SELECT total_milligdty FROM referral_daily_caps WHERE cap_group=? AND day=?").bind(capGroup, day).first();
    const current = Number(row?.total_milligdty || 0);
    const remaining = DAILY_CAP_MILLIGDTY - current;
    if (remaining <= 0) return 0;
    const grant = Math.min(desiredMilli, remaining);
    const res = await e.DB.prepare("UPDATE referral_daily_caps SET total_milligdty=total_milligdty+?,updated_at=? WHERE cap_group=? AND day=? AND total_milligdty+?<=?").bind(grant, now, capGroup, day, grant, DAILY_CAP_MILLIGDTY).run();
    if (res?.meta?.changes) return grant;
  }
  return 0;
}
__name(reserveDailyCap, "reserveDailyCap");
async function releaseDailyCap(e, capGroup, milli) {
  await e.DB.prepare("UPDATE referral_daily_caps SET total_milligdty=MAX(0,total_milligdty-?),updated_at=? WHERE cap_group=? AND day=?").bind(milli, nowIso(), capGroup, todayUtc()).run().catch(() => {
  });
}
__name(releaseDailyCap, "releaseDailyCap");
async function reservePayoutBudget(e, milli) {
  const day = todayUtc(), now = nowIso();
  await e.DB.prepare("INSERT INTO referral_daily_caps(cap_group,day,total_milligdty,updated_at) VALUES('__payout__',?,0,?) ON CONFLICT(cap_group,day) DO NOTHING").bind(day, now).run();
  const res = await e.DB.prepare("UPDATE referral_daily_caps SET total_milligdty=total_milligdty+?,updated_at=? WHERE cap_group='__payout__' AND day=? AND total_milligdty+?<=?").bind(milli, now, day, milli, DAILY_PAYOUT_LIMIT_MILLIGDTY).run();
  return !!res?.meta?.changes;
}
__name(reservePayoutBudget, "reservePayoutBudget");
var HOLD_GRACE_MS = 2 * 36e5;
var SCANNER_MAX_LAG_BLOCKS = 1500;
async function recordWalletOutflows(e, logs) {
  const parsed = [];
  for (const l of logs || []) {
    if (!l.topics || l.topics.length < 3 || String(l.topics[0]).toLowerCase() !== TOPIC_TRANSFER) continue;
    parsed.push({
      from: addr(l.topics[1]),
      to: addr(l.topics[2]),
      amount: BigInt(l.data || "0x0"),
      block: parseInt(l.blockNumber, 16),
      tx: String(l.transactionHash).toLowerCase(),
      idx: parseInt(l.logIndex || "0x0", 16)
    });
  }
  if (!parsed.length) return;
  const addrs = [...new Set(parsed.flatMap((p) => [p.from, p.to]))];
  const owner = /* @__PURE__ */ new Map();
  for (let i = 0; i < addrs.length; i += 80) {
    const chunk = addrs.slice(i, i + 80);
    const rows = await e.DB.prepare(`SELECT address,user_id FROM wallets WHERE address IN (${chunk.map(() => "?").join(",")})`).bind(...chunk).all();
    for (const r of rows.results || []) owner.set(String(r.address).toLowerCase(), r.user_id);
  }
  const relevant = parsed.filter((p) => owner.has(p.from) && p.amount > 0n);
  if (!relevant.length) return;
  const tsByBlock = /* @__PURE__ */ new Map();
  for (const p of relevant) {
    if (tsByBlock.has(p.block)) continue;
    const blk = await rpc(e, "eth_getBlockByNumber", ["0x" + p.block.toString(16), false]);
    tsByBlock.set(p.block, parseInt(blk.timestamp, 16));
  }
  const now = nowIso();
  const stmts = relevant.map((p) => {
    const self = owner.get(p.to) === owner.get(p.from) ? 1 : 0;
    return e.DB.prepare("INSERT INTO scanner_state(key,value,updated_at) VALUES(?,?,?) ON CONFLICT(key) DO NOTHING").bind(`out:${p.from}:${p.tx}:${p.idx}`, `${p.block}:${p.amount}:${self}:${p.to}:${tsByBlock.get(p.block)}`, now);
  });
  for (let i = 0; i < stmts.length; i += 50) await e.DB.batch(stmts.slice(i, i + 50));
}
__name(recordWalletOutflows, "recordWalletOutflows");
async function checkHoldPeriod(e, reward, referred) {
  const trade = await e.DB.prepare("SELECT block_number FROM trades WHERE id=?").bind(reward.trade_id).first();
  if (!trade) return "review";
  const purchaseBlock = Number(trade.block_number);
  const wl = await e.DB.prepare("SELECT address FROM wallets WHERE user_id=? LIMIT 50").bind(referred.id).all();
  const addrs = new Set((wl.results || []).map((r) => String(r.address).toLowerCase()));
  if (referred.wallet_address) addrs.add(String(referred.wallet_address).toLowerCase());
  const since = await e.DB.prepare("SELECT value FROM scanner_state WHERE key='outflow_since_block'").first();
  if (!since || purchaseBlock < Number(since.value)) {
    const sold = await e.DB.prepare("SELECT COUNT(*) AS c FROM trades WHERE user_id=? AND side='sell' AND block_number>=?").bind(referred.id, purchaseBlock).first();
    if (Number(sold?.c || 0) > 0) return "violated";
    let held = 0n;
    for (const a of addrs) held += await tokenBalance(e, A.G, a);
    return held >= BigInt(reward.gdty_amount_wei || "0") ? "ok" : "review";
  }
  const latest = parseInt(await rpc(e, "eth_blockNumber"), 16);
  const cur = await e.DB.prepare("SELECT value FROM scanner_state WHERE key='last_block'").first();
  if (!cur || latest - Number(cur.value) > SCANNER_MAX_LAG_BLOCKS) return "unknown";
  const windowEndSec = Math.floor(new Date(reward.available_at || reward.created_at).getTime() / 1e3);
  const sourceTx = String(reward.source_tx_hash || "").toLowerCase();
  for (const a of addrs) {
    const rows = await e.DB.prepare("SELECT key,value FROM scanner_state WHERE key>=? AND key<?").bind(`out:${a}:`, `out:${a};`).all();
    for (const r of rows.results || []) {
      const [blk, amt, self, , ts] = String(r.value).split(":");
      if (self === "1") continue;
      if (Number(blk) < purchaseBlock) continue;
      if (sourceTx && String(r.key).includes(`:${sourceTx}:`)) continue;
      if (Number(ts) > windowEndSec) continue;
      if (BigInt(amt || "0") <= 0n) continue;
      return "violated";
    }
  }
  return "ok";
}
__name(checkHoldPeriod, "checkHoldPeriod");
var FUNDING_CACHE_TTL_MS = 30 * 864e5;
async function getFundingAddress(e, walletAddress) {
  const wallet = walletAddress.toLowerCase();
  const cacheKey = "funding:" + wallet;
  const cached = await e.DB.prepare("SELECT value,updated_at FROM scanner_state WHERE key=?").bind(cacheKey).first();
  if (cached && Date.now() - new Date(cached.updated_at).getTime() < FUNDING_CACHE_TTL_MS) return cached.value || null;
  if (!e.ETHERSCAN_API_KEY) return cached ? cached.value || null : null;
  try {
    const url = `https://api.etherscan.io/v2/api?chainid=56&module=account&action=txlist&address=${wallet}&startblock=0&endblock=99999999&page=1&offset=10&sort=asc&apikey=${e.ETHERSCAN_API_KEY}`;
    const res = await fetch(url);
    if (!res.ok) return cached ? cached.value || null : null;
    const data = await res.json().catch(() => null);
    const first = (data?.result || []).find((tx) => String(tx.to).toLowerCase() === wallet);
    const funder = first ? String(first.from).toLowerCase() : null;
    await e.DB.prepare(`
      INSERT INTO scanner_state(key,value,updated_at) VALUES(?,?,?)
      ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at
    `).bind(cacheKey, funder || "", nowIso()).run();
    return funder;
  } catch {
    return cached ? cached.value || null : null;
  }
}
__name(getFundingAddress, "getFundingAddress");
async function fundingClusterRisk(e, walletAddress, refUser) {
  const funder = await getFundingAddress(e, walletAddress);
  if (!funder) return { hit: false, funder: null };
  const ownKey = "funding:" + walletAddress.toLowerCase();
  // Only wallets inside this referral tree (the referrer and everyone they referred) count.
  // Unrelated users who merely withdrew from the same exchange hot wallet are NOT a signal.
  const siblings = await e.DB.prepare(`
    SELECT s.key FROM scanner_state s
    WHERE s.key LIKE 'funding:%' AND s.value=? AND s.key!=?
      AND substr(s.key,9) IN (
        SELECT lower(w.address) FROM wallets w JOIN users u ON u.id=w.user_id WHERE u.id=? OR u.referred_by=?
        UNION
        SELECT lower(u.wallet_address) FROM users u WHERE (u.id=? OR u.referred_by=?) AND u.wallet_address IS NOT NULL
      )
    LIMIT 1
  `).bind(funder, ownKey, refUser.id, refUser.referral_code, refUser.id, refUser.referral_code).first();
  return { hit: !!siblings, funder };
}
__name(fundingClusterRisk, "fundingClusterRisk");
async function computeReferralRisk(e, refUser, referredUser) {
  let score = 0;
  const reasons = [];
  const [refIp, ownIp] = await Promise.all([
    e.DB.prepare("SELECT ip_hash FROM audit_log WHERE user_id=? AND event_type='register' ORDER BY created_at ASC LIMIT 1").bind(refUser.id).first(),
    e.DB.prepare("SELECT ip_hash FROM audit_log WHERE user_id=? AND event_type='register' ORDER BY created_at ASC LIMIT 1").bind(referredUser.id).first()
  ]);
  if (refIp?.ip_hash && ownIp?.ip_hash && refIp.ip_hash === ownIp.ip_hash) {
    score += 3;
    reasons.push("same_registration_ip");
  }
  let referredFunding = { hit: false, funder: null }, refFunding = { hit: false, funder: null };
  try {
    await Promise.all([
      referredUser.wallet_address ? getFundingAddress(e, referredUser.wallet_address) : null,
      refUser.wallet_address ? getFundingAddress(e, refUser.wallet_address) : null
    ]);
  } catch {
  }
  if (referredUser.wallet_address) {
    try {
      referredFunding = await fundingClusterRisk(e, referredUser.wallet_address, refUser);
    } catch {
    }
  }
  if (refUser.wallet_address) {
    try {
      refFunding = await fundingClusterRisk(e, refUser.wallet_address, refUser);
    } catch {
    }
  }
  if (referredFunding.hit) {
    score += 2;
    reasons.push("shared_funding_wallet");
  }
  if (refFunding.hit) {
    score += 1;
    reasons.push("referrer_shared_funding_wallet");
  }
  const refWallet = String(refUser.wallet_address || "").toLowerCase();
  const referredWallet = String(referredUser.wallet_address || "").toLowerCase();
  if (refWallet && referredFunding.funder === refWallet || referredWallet && refFunding.funder === referredWallet) {
    score += 5;
    reasons.push("direct_wallet_link");
  }
  if (referredWallet && !referredFunding.funder || refWallet && !refFunding.funder) {
    score += 1;
    reasons.push("funding_source_unknown");
  }
  const dayAgo = new Date(Date.now() - 864e5).toISOString();
  const recentRow = await e.DB.prepare("SELECT COUNT(DISTINCT referred_user_id) AS c FROM referral_rewards WHERE referrer_user_id=? AND created_at>=?").bind(refUser.id, dayAgo).first();
  const recent = Number(recentRow?.c || 0);
  if (recent >= 8) {
    score += 2;
    reasons.push("referral_velocity_high");
  } else if (recent >= 3) {
    score += 1;
    reasons.push("referral_velocity");
  }
  return { score, reasons, highRisk: score >= RISK_FREEZE_SCORE };
}
__name(computeReferralRisk, "computeReferralRisk");
async function maybeCreateReferralReward(e, u, tradeId, trade, gdtyAmount) {
  if (!u.referred_by) return;
  if (gdtyAmount < MIN_QUALIFYING_GDTY_WEI) return;
  const refUser = await e.DB.prepare("SELECT * FROM users WHERE referral_code=?").bind(u.referred_by).first();
  if (!refUser) return;
  if (refUser.id === u.id) return;
  if (refUser.wallet_address && u.wallet_address && refUser.wallet_address.toLowerCase() === u.wallet_address.toLowerCase()) return;
  const rawReward = gdtyAmount * REFERRAL_RATE_BPS / 10000n;
  if (rawReward <= 0n) return;
  const desiredMilli = weiToMilliGdty(rawReward);
  if (desiredMilli <= 0) return;
  const capGroup = await referralCapGroup(e, refUser);
  const risk = await computeReferralRisk(e, refUser, u);
  const now = nowIso();
  const pendingUntil = new Date(Date.now() + PENDING_DAYS * 864e5).toISOString();
  let status = risk.highRisk ? "frozen" : "pending";
  let grantedMilli = 0, forfeitedMilli = 0;
  if (risk.highRisk) {
    grantedMilli = Math.min(desiredMilli, DAILY_CAP_MILLIGDTY);
  } else {
    grantedMilli = await reserveDailyCap(e, capGroup, desiredMilli);
    forfeitedMilli = desiredMilli - grantedMilli;
    if (grantedMilli <= 0) {
      await notifyCapForfeited(e, refUser.id, forfeitedMilli);
      return;
    }
  }
  const reward = milliGdtyToWei(grantedMilli);
  try {
    await e.DB.prepare(`
      INSERT INTO referral_rewards(id,referrer_user_id,referred_user_id,trade_id,source_tx_hash,gdty_amount_wei,reward_amount_wei,reward_rate_bps,status,created_at,available_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?)
    `).bind(id(), refUser.id, u.id, tradeId, trade.txHash, gdtyAmount.toString(), reward.toString(), 300, status, now, status === "frozen" ? null : pendingUntil).run();
    await e.DB.prepare(`INSERT INTO notifications(id,user_id,type,title,message,created_at) VALUES(?,?,?,?,?,?)`).bind(
      id(),
      refUser.id,
      "referral_reward",
      status === "frozen" ? "Referral reward under review" : "Referral reward pending",
      status === "frozen" ? "A referred purchase was flagged for manual review before any reward is paid." : "A verified GOLDITY purchase qualified for a 3% referral reward. It becomes payable after 7 days only if the purchased GDTY stays in the referred user's connected wallets for the whole period.",
      now
    ).run();
  } catch (err) {
    console.error("GOLDITY referral reward insert error", err);
    if (!risk.highRisk) await releaseDailyCap(e, capGroup, grantedMilli);
    return;
  }
  if (forfeitedMilli > 0) await notifyCapForfeited(e, refUser.id, forfeitedMilli);
}
__name(maybeCreateReferralReward, "maybeCreateReferralReward");
async function recordTrade(e, u, trade, opts = {}) {
  const existing = await e.DB.prepare("SELECT id FROM trades WHERE tx_hash=?").bind(trade.txHash).first();
  if (existing) return { ok: false, error: "transaction_already_recorded" };
  const latest = parseInt(await rpc(e, "eth_blockNumber"), 16);
  const confirmations = Math.max(0, latest - trade.block);
  const status = confirmations >= 12 ? "confirmed" : "pending";
  const now = nowIso();
  const tradeId = id();
  const g = BigInt(trade.gdty);
  const uAmt = BigInt(trade.usdt || "0");
  const price = g > 0n && uAmt > 0n ? (Number(uAmt) / 1e18 / (Number(g) / 1e18)).toString() : "0";
  await e.DB.prepare(`
    INSERT INTO trades(id,user_id,wallet_address,tx_hash,block_number,block_timestamp,dex,pair_address,side,gdty_amount_wei,usdt_amount_wei,price_usdt_per_gdty,confirmations,status,created_at,verified_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).bind(tradeId, u.id, u.wallet_address, trade.txHash, trade.block, now, trade.dex, trade.pair, trade.side, g.toString(), uAmt.toString(), price, confirmations, status, now, status === "confirmed" ? now : null).run();
  if (!opts.manual && trade.side === "buy" && trade.rewardEligible) {
    await maybeCreateReferralReward(e, u, tradeId, trade, g);
  }
  return { ok: true, tradeId, status, confirmations };
}
__name(recordTrade, "recordTrade");
async function tryPayReferralReward(e, reward) {
  const referred = await e.DB.prepare("SELECT * FROM users WHERE id=?").bind(reward.referred_user_id).first();
  const refUser = await e.DB.prepare("SELECT * FROM users WHERE id=?").bind(reward.referrer_user_id).first();
  if (!referred || !refUser) return false;
  const approved = reward.status === "approved";
  const overdue = Date.now() - new Date(reward.available_at || reward.created_at).getTime() > GIVE_UP_AFTER_DAYS * 864e5;
  const amountWei = BigInt(reward.reward_amount_wei || "0");
  if (!approved) {
    if (Date.now() < new Date(reward.available_at || reward.created_at).getTime() + HOLD_GRACE_MS) return false;
    let riskScore = 0, hold = "unknown", checksFailed = false;
    try {
      riskScore = (await computeReferralRisk(e, refUser, referred)).score;
      hold = await checkHoldPeriod(e, reward, referred);
    } catch {
      checksFailed = true;
    }
    if (!checksFailed && hold === "violated") {
      const v = await e.DB.prepare("UPDATE referral_rewards SET status='void' WHERE id=? AND status='pending'").bind(reward.id).run();
      if (v?.meta?.changes) {
        await e.DB.prepare("INSERT INTO notifications(id,user_id,type,title,message,created_at) VALUES(?,?,?,?,?,?)").bind(id(), refUser.id, "referral_void", "Referral reward not paid", "The purchased GDTY did not stay in the referred user's connected wallets for the full 7 days, so no reward is due for this purchase.", nowIso()).run().catch(() => {
        });
      }
      return false;
    }
    if (checksFailed || hold === "unknown") {
      if (!overdue) return false;
      await e.DB.prepare("UPDATE referral_rewards SET status='frozen' WHERE id=? AND status='pending'").bind(reward.id).run();
      return false;
    }
    if (hold === "review" || riskScore >= RISK_FREEZE_SCORE) {
      await e.DB.prepare("UPDATE referral_rewards SET status='frozen' WHERE id=? AND status='pending'").bind(reward.id).run();
      return false;
    }
  }
  if (!e.REFERRAL_PAYOUT_PRIVATE_KEY) return false;
  if (String(e.REFERRAL_PAUSED).toLowerCase() === "true") return false;
  if (!refUser.wallet_address || !walletRe.test(refUser.wallet_address)) {
    await e.DB.prepare("UPDATE referral_rewards SET status='payout_failed' WHERE id=?").bind(reward.id).run();
    return false;
  }
  if (amountWei <= 0n) return false;
  let payoutAddress;
  try {
    payoutAddress = addressFromPrivateKey(e.REFERRAL_PAYOUT_PRIVATE_KEY);
  } catch {
    return false;
  }
  let gdtyBal, bnbBal;
  try {
    const [g, b] = await Promise.all([tokenBalance(e, A.G, payoutAddress), rpc(e, "eth_getBalance", [payoutAddress, "latest"])]);
    gdtyBal = g;
    bnbBal = BigInt(b);
  } catch {
    return false;
  }
  if (gdtyBal < amountWei || bnbBal < 2000000000000000n) return false;
  let budgetReserved = 0;
  if (!approved) {
    const milli = weiToMilliGdty(amountWei);
    if (!await reservePayoutBudget(e, milli)) {
      const held = await e.DB.prepare("UPDATE referral_rewards SET status='frozen' WHERE id=? AND status='pending'").bind(reward.id).run();
      if (held?.meta?.changes) {
        console.error("GOLDITY referral daily payout limit reached - reward held for admin approval", reward.id);
        await e.DB.prepare("INSERT INTO notifications(id,user_id,type,title,message,created_at) VALUES(?,?,?,?,?,?)").bind(id(), refUser.id, "referral_reward", "Referral reward awaiting approval", "The daily referral payout limit was reached, so this reward is waiting for manual approval. It has not been cancelled.", nowIso()).run().catch(() => {
        });
      }
      return false;
    }
    budgetReserved = milli;
  }
  const guard = await e.DB.prepare("UPDATE referral_rewards SET status='processing' WHERE id=? AND status IN ('pending','approved')").bind(reward.id).run();
  if (!guard?.meta || guard.meta.changes === 0) {
    if (budgetReserved) await releaseDailyCap(e, "__payout__", budgetReserved);
    return false;
  }
  const payoutId = id(), now = nowIso();
  let txHash, nonce, gasPrice, gasLimit;
  try {
    await e.DB.prepare("INSERT INTO referral_payouts(id,user_id,wallet_address,amount_wei,status,created_at) VALUES(?,?,?,?,?,?)").bind(payoutId, refUser.id, refUser.wallet_address, amountWei.toString(), "processing", now).run();
    nonce = await getNonce(e, payoutAddress);
    gasPrice = await getGasPrice(e);
    gasLimit = 1e5;
    const data = erc20TransferData(refUser.wallet_address, amountWei);
    const signedTx = await signLegacyTx(e.REFERRAL_PAYOUT_PRIVATE_KEY, { nonce, gasPrice, gasLimit, to: A.G, value: 0n, data });
    const b = await safeBroadcast(e, signedTx);
    if (b.sent === "unknown") {
      console.error("GOLDITY CRITICAL: referral payout outcome unknown - check on BscScan before any retry", b.txHash, reward.id, payoutId);
      await e.DB.prepare("UPDATE referral_payouts SET tx_hash=? WHERE id=?").bind(b.txHash, payoutId).run().catch(() => {
      });
      return false;
    }
    if (!b.sent) throw b.err;
    txHash = b.txHash;
  } catch (err) {
    console.error("GOLDITY payout broadcast error", err);
    if (budgetReserved) await releaseDailyCap(e, "__payout__", budgetReserved);
    await e.DB.prepare("UPDATE referral_rewards SET status=? WHERE id=?").bind(approved ? "approved" : "pending", reward.id).run().catch(() => {
    });
    await e.DB.prepare("UPDATE referral_payouts SET status='failed' WHERE id=?").bind(payoutId).run().catch(() => {
    });
    return false;
  }
  try {
    await e.DB.batch([
      e.DB.prepare("UPDATE referral_payouts SET status='paid',tx_hash=?,nonce=?,gas_price_wei=?,gas_limit=?,paid_at=? WHERE id=?").bind(txHash, nonce, gasPrice.toString(), gasLimit, now, payoutId),
      e.DB.prepare("UPDATE referral_rewards SET status='paid',paid_at=?,payout_tx_hash=?,reward_amount_wei=? WHERE id=?").bind(now, txHash, amountWei.toString(), reward.id)
    ]);
    await e.DB.prepare("INSERT INTO notifications(id,user_id,type,title,message,created_at) VALUES(?,?,?,?,?,?)").bind(id(), refUser.id, "referral_paid", "Referral reward sent", "Your 3% referral reward was sent on-chain to your wallet.", now).run();
  } catch (err) {
    console.error("GOLDITY CRITICAL: referral payout broadcast succeeded but DB recording failed - manual reconciliation required", txHash, reward.id, payoutId, err);
    await e.DB.prepare("UPDATE referral_rewards SET status='paid',paid_at=?,payout_tx_hash=?,reward_amount_wei=? WHERE id=?").bind(now, txHash, amountWei.toString(), reward.id).run().catch(() => {
    });
    await e.DB.prepare("UPDATE referral_payouts SET status='paid',tx_hash=?,paid_at=? WHERE id=?").bind(txHash, now, payoutId).run().catch(() => {
    });
  }
  return true;
}
__name(tryPayReferralReward, "tryPayReferralReward");
async function graduateReferralRewards(e, userId) {
  const now = nowIso();
  const rows = await e.DB.prepare(`
    SELECT * FROM referral_rewards
    WHERE (referrer_user_id=? OR referred_user_id=?) AND status IN ('pending','approved') AND available_at IS NOT NULL AND available_at<=?
    LIMIT 5
  `).bind(userId, userId, now).all();
  for (const reward of rows.results || []) {
    await tryPayReferralReward(e, reward);
  }
}
__name(graduateReferralRewards, "graduateReferralRewards");
async function graduateOverdueRewardsGlobal(e) {
  const now = nowIso();
  const rows = await e.DB.prepare(`
    SELECT * FROM referral_rewards
    WHERE status IN ('pending','approved') AND available_at IS NOT NULL AND available_at<=?
    LIMIT 20
  `).bind(now).all();
  for (const reward of rows.results || []) {
    await tryPayReferralReward(e, reward).catch((err) => console.error("GOLDITY global graduate error", reward.id, err));
  }
}
__name(graduateOverdueRewardsGlobal, "graduateOverdueRewardsGlobal");
async function scanForNewTrades(e) {
  const latest = parseInt(await rpc(e, "eth_blockNumber"), 16);
  const safeBlock = latest - 12;
  if (safeBlock < 1) return;
  const stateRow = await e.DB.prepare("SELECT value FROM scanner_state WHERE key='last_block'").first();
  let fromBlock = stateRow ? parseInt(stateRow.value, 10) + 1 : safeBlock;
  if (fromBlock > safeBlock) return;
  const MAX_RANGE = 2e3;
  const toBlock = Math.min(safeBlock, fromBlock + MAX_RANGE);
  const logs = await rpc(e, "eth_getLogs", [{
    fromBlock: "0x" + fromBlock.toString(16),
    toBlock: "0x" + toBlock.toString(16),
    address: A.G,
    topics: [TOPIC_TRANSFER]
  }]);
  const txHashes = [...new Set((logs || []).map((l) => l.transactionHash))];
  let failedTxs = 0;
  try {
    await recordWalletOutflows(e, logs);
    await e.DB.prepare("INSERT INTO scanner_state(key,value,updated_at) VALUES('outflow_since_block',?,?) ON CONFLICT(key) DO NOTHING").bind(String(fromBlock), nowIso()).run();
  } catch (err) {
    failedTxs++;
    console.error("GOLDITY scanner outflow ledger error", err);
  }
  for (const txHash of txHashes) {
    try {
      const existing = await e.DB.prepare("SELECT id FROM trades WHERE tx_hash=?").bind(txHash).first();
      if (existing) continue;
      const tx = await rpc(e, "eth_getTransactionByHash", [txHash]);
      if (!tx) continue;
      const boundWallet = await e.DB.prepare("SELECT user_id FROM wallets WHERE address=?").bind(String(tx.from).toLowerCase()).first();
      if (!boundWallet) continue;
      const account = await e.DB.prepare("SELECT * FROM users WHERE id=?").bind(boundWallet.user_id).first();
      if (!account) continue;
      const user = { ...account, wallet_address: String(tx.from).toLowerCase() };
      const trade = await verifyTrade(e, user, txHash);
      if (!trade.ok) continue;
      trade.txHash = txHash;
      await recordTrade(e, user, trade);
    } catch (err) {
      failedTxs++;
      console.error("GOLDITY scanner trade error", txHash, err);
    }
  }
  if (failedTxs > 0) {
    // A transient RPC/DB error must not make a real buyer permanently miss their referral reward
    // (manual submission no longer creates rewards), so retry the same block range a few times.
    const retryKey = "scan_retry:" + fromBlock;
    const retryRow = await e.DB.prepare("SELECT value FROM scanner_state WHERE key=?").bind(retryKey).first();
    const attempts = Number(retryRow?.value || 0) + 1;
    await e.DB.prepare(`
      INSERT INTO scanner_state(key,value,updated_at) VALUES(?,?,?)
      ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at
    `).bind(retryKey, String(attempts), nowIso()).run();
    if (attempts < 5) return;
    console.error("GOLDITY scanner giving up on block range after retries", fromBlock, toBlock);
  }
  await e.DB.prepare(`
    INSERT INTO scanner_state(key,value,updated_at) VALUES('last_block',?,?)
    ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at
  `).bind(toBlock.toString(), nowIso()).run();
}
__name(scanForNewTrades, "scanForNewTrades");
var AIRDROP_REWARD_WEI = 3n * 10n ** 16n;
var AIRDROP_MAX_CLAIMS = 1e4;
var AIRDROP_GLOBAL_PER_MINUTE = 20;
var AIRDROP_MIN_WALLET_AGE_DAYS = 0;
var AIRDROP_MIN_ASSET_TYPES = 2;
var AIRDROP_MIN_WALLET_USD = 1;
var AIRDROP_CONTRACT = "0xb34b0a10386b559093a0324bfd2c401e0063d4d5";
var AIRDROP_CONTRACT_OWNER = "0x4908ab7fcceb4d762b71c765c17dea4456cbf22d";
function singleAirdropData(recipient, amountWei) {
  return "0x95647ebd" + pad(recipient) + bigIntToBytes(amountWei).reduce((s, b) => s + b.toString(16).padStart(2, "0"), "").padStart(64, "0");
}
__name(singleAirdropData, "singleAirdropData");
async function airdropIsPaused(e) {
  const row = await e.DB.prepare("SELECT value_int FROM airdrop_state WHERE key='paused'").first();
  return !!row?.value_int;
}
__name(airdropIsPaused, "airdropIsPaused");
async function airdropClaimedCount(e) {
  const row = await e.DB.prepare("SELECT value_int FROM airdrop_state WHERE key='claimed_count'").first();
  return Number(row?.value_int || 0);
}
__name(airdropClaimedCount, "airdropClaimedCount");
async function reserveAirdropSlot(e) {
  const now = nowIso();
  await e.DB.prepare("INSERT INTO airdrop_state(key,value_int,updated_at) VALUES('claimed_count',0,?) ON CONFLICT(key) DO NOTHING").bind(now).run();
  const res = await e.DB.prepare("UPDATE airdrop_state SET value_int=value_int+1,updated_at=? WHERE key='claimed_count' AND value_int<?").bind(now, AIRDROP_MAX_CLAIMS).run();
  return !!res?.meta?.changes;
}
__name(reserveAirdropSlot, "reserveAirdropSlot");
async function releaseAirdropSlot(e) {
  await e.DB.prepare("UPDATE airdrop_state SET value_int=MAX(0,value_int-1) WHERE key='claimed_count'").run();
}
__name(releaseAirdropSlot, "releaseAirdropSlot");
var AIRDROP_CLAIMS_PER_IP_PER_HOUR = 1;
var AIRDROP_HOLD_HOURS = 24;
var AIRDROP_HOLD_MAX_HOURS = 24;
var AIRDROP_PAY_PER_RUN = 8;
async function airdropPayoutDelayMs(e, claimId) {
  const h = await hashIp(e, "payout-delay:" + claimId);
  const frac = parseInt(h.slice(0, 8), 16) / 4294967295;
  return Math.round((AIRDROP_HOLD_HOURS + frac * (AIRDROP_HOLD_MAX_HOURS - AIRDROP_HOLD_HOURS)) * 36e5);
}
__name(airdropPayoutDelayMs, "airdropPayoutDelayMs");
async function airdropSentOutSince(e, address, sinceSec) {
  const me = String(address).toLowerCase();
  const q = { address: [address], blockchain: ANKR_CHAINS, fromTimestamp: sinceSec, descOrder: true, pageSize: 100 };
  const [txs, tr] = await Promise.all([
    ankrCall(e, "ankr_getTransactionsByAddress", q),
    ankrCall(e, "ankr_getTokenTransfers", q)
  ]);
  const nonZero = /* @__PURE__ */ __name((v) => {
    const x = String(v ?? "0").trim();
    if (x === "" || x === "0" || /^0x0*$/i.test(x)) return false;
    const n = Number(x.startsWith("0x") ? parseInt(x, 16) : x);
    return !(Number.isFinite(n) && n === 0);
  }, "nonZero");
  const since = /* @__PURE__ */ __name((t) => {
    const ts = ankrTs(t.timestamp);
    return ts === null || ts >= sinceSec;
  }, "since");
  const out2 = (txs.transactions || []).some((t) => String(t.from || "").toLowerCase() === me && nonZero(t.value) && since(t)) || (tr.transfers || []).some((t) => String(t.fromAddress || "").toLowerCase() === me && nonZero(t.value ?? t.valueRawInteger) && since(t));
  return out2;
}
__name(airdropSentOutSince, "airdropSentOutSince");
async function reserveAirdropIpSlot(e, ipHash) {
  return rateLimit(e, `airdrop:ip-hour:${ipHash}`, AIRDROP_CLAIMS_PER_IP_PER_HOUR, 36e5);
}
__name(reserveAirdropIpSlot, "reserveAirdropIpSlot");
async function releaseAirdropIpSlot(e, ipHash) {
  await e.DB.prepare("UPDATE rate_limits SET attempts=MAX(0,attempts-1) WHERE key=?").bind(`airdrop:ip-hour:${ipHash}`).run();
}
__name(releaseAirdropIpSlot, "releaseAirdropIpSlot");
var ANKR_CHAINS = ["eth", "bsc", "polygon", "arbitrum", "optimism", "base", "avalanche"];
async function ankrCall(e, method, params) {
  const r = await fetch(`https://rpc.ankr.com/multichain/${e.ANKR_API_KEY}/?${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    signal: AbortSignal.timeout(8e3),
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params })
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error || !j.result) throw new Error(`ankr_${method}: ${j.error?.message || r.status}`);
  return j.result;
}
__name(ankrCall, "ankrCall");
async function ankrWalletSummary(e, address) {
  const res = await ankrCall(e, "ankr_getAccountBalance", { walletAddress: address, onlyWhitelisted: true });
  const types = /* @__PURE__ */ new Set();
  let usd = 0;
  for (const a of res.assets || []) {
    if (String(a.balanceRawInteger || "0") === "0") continue;
    const sym = String(a.tokenSymbol || "").trim().toUpperCase();
    types.add(sym || `${a.blockchain}:${a.contractAddress || "native"}`);
    const v = Number(a.balanceUsd);
    if (Number.isFinite(v) && v > 0) usd += v;
  }
  return { types: types.size, usd };
}
__name(ankrWalletSummary, "ankrWalletSummary");
function ankrTs(v) {
  if (typeof v === "number") return v;
  const s = String(v ?? "");
  const n = s.startsWith("0x") ? parseInt(s, 16) : Number(s);
  return Number.isFinite(n) && n > 0 ? n : null;
}
__name(ankrTs, "ankrTs");
async function ankrHasTxBefore(e, address, beforeSec) {
  const me = String(address).toLowerCase();
  const q = { address: [address], blockchain: ANKR_CHAINS, toTimestamp: beforeSec, descOrder: false, pageSize: 20 };
  const counts = /* @__PURE__ */ __name((list, fromKey, toKey) => (list || []).some((t) => {
    const mine = String(t[fromKey] || "").toLowerCase() === me;
    const ts = ankrTs(t.timestamp);
    const ok = mine && ts !== null && ts <= beforeSec;
    if (ok) console.log("GOLDITY_DIAG old_tx", me, t.blockchain, t.hash || t.transactionHash, t.timestamp, t[fromKey], t[toKey]);
    return ok;
  }), "counts");
  const txs = await ankrCall(e, "ankr_getTransactionsByAddress", q);
  if (counts(txs.transactions, "from", "to")) return true;
  const tr = await ankrCall(e, "ankr_getTokenTransfers", q);
  if (counts(tr.transfers, "fromAddress", "toAddress")) return true;
  const foreign = [...txs.transactions || [], ...tr.transfers || []].filter((t) => ![t.from, t.to, t.fromAddress, t.toAddress].some((x) => String(x || "").toLowerCase() === me)).length;
  if (foreign) console.warn("GOLDITY ankr_history: returned", foreign, "items not belonging to", me);
  return false;
}
__name(ankrHasTxBefore, "ankrHasTxBefore");
var AIRDROP_LINK_DAYS = 7;
var AIRDROP_BLOCKED_ADDRESSES = /* @__PURE__ */ new Set([
  "0xdffc1b24b5ac219f73feed7017721819d0315649"
  // collector seen 2026-09-26
]);
async function airdropLinkedToFarm(e, address) {
  const me = String(address).toLowerCase();
  const q = { address: [address], blockchain: ANKR_CHAINS, fromTimestamp: Math.floor(Date.now() / 1e3) - AIRDROP_LINK_DAYS * 86400, descOrder: true, pageSize: 100 };
  const [txs, tr] = await Promise.all([
    ankrCall(e, "ankr_getTransactionsByAddress", q),
    ankrCall(e, "ankr_getTokenTransfers", q)
  ]);
  const peers = /* @__PURE__ */ new Set();
  const add = /* @__PURE__ */ __name((a, b) => {
    a = String(a || "").toLowerCase();
    b = String(b || "").toLowerCase();
    if (a === me && walletRe.test(b)) peers.add(b);
    else if (b === me && walletRe.test(a)) peers.add(a);
  }, "add");
  for (const t of txs.transactions || []) add(t.from, t.to);
  for (const t of tr.transfers || []) add(t.fromAddress, t.toAddress);
  peers.delete(me);
  const list = [...peers];
  if (list.some((a) => AIRDROP_BLOCKED_ADDRESSES.has(a))) {
    console.log("GOLDITY_DIAG farm_link", me, "collector");
    return true;
  }
  for (let i = 0; i < list.length; i += 50) {
    const part = list.slice(i, i + 50);
    const row = await e.DB.prepare(`SELECT wallet_address FROM airdrop_claims WHERE wallet_address IN (${part.map(() => "?").join(",")}) LIMIT 1`).bind(...part).first();
    if (row) {
      console.log("GOLDITY_DIAG farm_link", me, row.wallet_address);
      return true;
    }
  }
  return false;
}
__name(airdropLinkedToFarm, "airdropLinkedToFarm");
async function airdropWalletEligible(e, address) {
  const code = await rpc(e, "eth_getCode", [address, "latest"]).catch(() => "0x");
  if (code && code !== "0x" && !String(code).toLowerCase().startsWith("0xef0100")) return false;
  if (!e.ANKR_API_KEY) {
    console.error("GOLDITY: ANKR_API_KEY not set - airdrop eligibility can't be checked");
    throw new Error("ankr_not_configured");
  }
  const { types, usd } = await ankrWalletSummary(e, address);
  console.log("GOLDITY_DIAG summary", address, "types", types, "usd", usd);
  if (types < AIRDROP_MIN_ASSET_TYPES || usd < AIRDROP_MIN_WALLET_USD) return false;
  const cutoff = Math.floor(Date.now() / 1e3) - AIRDROP_MIN_WALLET_AGE_DAYS * 86400;
  if (!await ankrHasTxBefore(e, address, cutoff)) return false;
  return !await airdropLinkedToFarm(e, address);
}
__name(airdropWalletEligible, "airdropWalletEligible");
async function airdropStatus(e) {
  const claimed = await airdropClaimedCount(e);
  const paused = await airdropIsPaused(e);
  return {
    ok: true,
    claimed,
    max: AIRDROP_MAX_CLAIMS,
    remaining: Math.max(0, AIRDROP_MAX_CLAIMS - claimed),
    rewardWei: AIRDROP_REWARD_WEI.toString(),
    paused
  };
}
__name(airdropStatus, "airdropStatus");
async function claimAirdrop(e, req) {
  if (!await requireOrigin(e, req, { allowNullOrigin: true })) return { ok: false, error: "forbidden" };
  let ipHash, address, d;
  try {
    if (await airdropIsPaused(e)) return { ok: false, error: "airdrop_paused" };
    d = await req.json().catch(() => ({}));
    address = String(d.address || "").toLowerCase();
    if (!walletRe.test(address)) return { ok: false, error: "invalid_wallet" };
    if (!await verifyTurnstile(e, d.turnstileToken, ip(req), "airdrop")) return { ok: false, error: "captcha_failed" };
    ipHash = await hashIp(e, ipBucket(ip(req)));
    const byWallet = await e.DB.prepare("SELECT id FROM airdrop_claims WHERE wallet_address=?").bind(address).first();
    if (byWallet) return { ok: false, error: "wallet_already_claimed" };
    let eligible;
    try {
      eligible = await airdropWalletEligible(e, address);
    } catch (err) {
      console.error("GOLDITY airdrop eligibility RPC error", err);
      return { ok: false, error: "eligibility_check_failed" };
    }
    console.log("GOLDITY_DIAG v4 claim", address, "eligible", eligible);
    if (!eligible) return { ok: false, error: "wallet_not_eligible" };
    if (!await rateLimit(e, "airdrop:global", AIRDROP_GLOBAL_PER_MINUTE, 6e4)) return { ok: false, error: "airdrop_busy" };
    if (!await reserveAirdropIpSlot(e, ipHash)) return { ok: false, error: "ip_limit_reached" };
    if (!await reserveAirdropSlot(e)) {
      await releaseAirdropIpSlot(e, ipHash);
      return { ok: false, error: "airdrop_full" };
    }
  } catch (err) {
    console.error("GOLDITY claimAirdrop pre-check error (likely D1 under heavy load)", err);
    return { ok: false, error: "db_busy" };
  }
  const claimId = id(), now = nowIso();
  try {
    await e.DB.prepare(`
      INSERT INTO airdrop_claims(id,wallet_address,ip_hash,amount_wei,status,created_at)
      VALUES(?,?,?,?,?,?)
    `).bind(claimId, address, ipHash, AIRDROP_REWARD_WEI.toString(), "queued", now).run();
  } catch {
    await releaseAirdropSlot(e);
    await releaseAirdropIpSlot(e, ipHash);
    return { ok: false, error: "wallet_already_claimed" };
  }
  return { ok: true, queued: true, holdHours: AIRDROP_HOLD_MAX_HOURS, amountWei: AIRDROP_REWARD_WEI.toString() };
}
__name(claimAirdrop, "claimAirdrop");
async function payAirdropClaim(e, claim) {
  const back = /* @__PURE__ */ __name(async () => {
    await e.DB.prepare("UPDATE airdrop_claims SET status='queued' WHERE id=? AND status='paying'").bind(claim.id).run().catch(() => {
    });
    return "retry";
  }, "back");
  if (!e.REFERRAL_PAYOUT_PRIVATE_KEY) return back();
  let payoutAddress;
  try {
    payoutAddress = addressFromPrivateKey(e.REFERRAL_PAYOUT_PRIVATE_KEY);
  } catch {
    return back();
  }
  if (payoutAddress.toLowerCase() !== AIRDROP_CONTRACT_OWNER) {
    console.error("GOLDITY airdrop owner mismatch - configured key does not control the airdrop contract");
    return back();
  }
  let txHash;
  try {
    const [gdtyBal, bnbRaw] = await Promise.all([
      tokenBalance(e, A.G, AIRDROP_CONTRACT),
      rpc(e, "eth_getBalance", [payoutAddress, "latest"])
    ]);
    if (BigInt(gdtyBal) < AIRDROP_REWARD_WEI || BigInt(bnbRaw) < 2000000000000000n) {
      console.error("GOLDITY airdrop treasury empty - queued claims wait");
      return back();
    }
    const gasPrice = await getGasPrice(e);
    const data = singleAirdropData(claim.wallet_address, AIRDROP_REWARD_WEI);
    const nonce = await getNonce(e, payoutAddress);
    const signedTx = await signLegacyTx(e.REFERRAL_PAYOUT_PRIVATE_KEY, { nonce, gasPrice, gasLimit: 15e4, to: AIRDROP_CONTRACT, value: 0n, data });
    const b = await safeBroadcast(e, signedTx);
    if (b.sent === "unknown") {
      await e.DB.prepare("UPDATE airdrop_claims SET status='processing',tx_hash=? WHERE id=?").bind(b.txHash, claim.id).run().catch(() => {
      });
      console.error("GOLDITY airdrop broadcast outcome unknown - check on BscScan", b.txHash, claim.id);
      return "unknown";
    }
    if (!b.sent) throw b.err;
    txHash = b.txHash;
  } catch (err) {
    console.error("GOLDITY airdrop broadcast error", err);
    return back();
  }
  try {
    await e.DB.prepare("UPDATE airdrop_claims SET status='sent',tx_hash=? WHERE id=?").bind(txHash, claim.id).run();
  } catch (err) {
    console.error("GOLDITY CRITICAL: airdrop broadcast succeeded but DB recording failed - manual reconciliation required", txHash, claim.id, err);
  }
  return "sent";
}
__name(payAirdropClaim, "payAirdropClaim");
async function processQueuedAirdrops(e) {
  if (await airdropIsPaused(e)) return;
  const earliest = new Date(Date.now() - AIRDROP_HOLD_HOURS * 36e5).toISOString();
  const { results } = await e.DB.prepare("SELECT * FROM airdrop_claims WHERE status='queued' AND created_at<=? ORDER BY created_at LIMIT 200").bind(earliest).all();
  let done = 0;
  for (const claim of results || []) {
    if (done >= AIRDROP_PAY_PER_RUN) break;
    const createdMs = Date.parse(claim.created_at);
    if (Date.now() < createdMs + await airdropPayoutDelayMs(e, claim.id)) continue;
    done++;
    const lock = await e.DB.prepare("UPDATE airdrop_claims SET status='paying' WHERE id=? AND status='queued'").bind(claim.id).run();
    if (!lock?.meta?.changes) continue;
    let ok;
    try {
      const { types, usd } = await ankrWalletSummary(e, claim.wallet_address);
      ok = types >= AIRDROP_MIN_ASSET_TYPES && usd >= AIRDROP_MIN_WALLET_USD && !await airdropLinkedToFarm(e, claim.wallet_address);
      console.log("GOLDITY_DIAG payout_check", claim.wallet_address, "types", types, "usd", usd, "ok", ok);
    } catch (err) {
      console.error("GOLDITY payout re-check error - will retry", claim.wallet_address, err);
      await e.DB.prepare("UPDATE airdrop_claims SET status='queued' WHERE id=? AND status='paying'").bind(claim.id).run();
      continue;
    }
    if (!ok) {
      await e.DB.prepare("UPDATE airdrop_claims SET status='rejected' WHERE id=? AND status='paying'").bind(claim.id).run();
      await releaseAirdropSlot(e);
      continue;
    }
    await payAirdropClaim(e, claim);
  }
}
__name(processQueuedAirdrops, "processQueuedAirdrops");
async function dashboard(e, req) {
  const u = await currentUser(e, req);
  if (!u) return out({ ok: false, error: "unauthorized" }, 401, cors(e));
  if (!u.referral_code) {
    const newCode = await makeReferralCode(e);
    await e.DB.prepare("UPDATE users SET referral_code=?,updated_at=? WHERE id=?").bind(newCode, nowIso(), u.id).run();
    u.referral_code = newCode;
  }
  await graduateReferralRewards(e, u.id).catch((err) => console.error("GOLDITY graduate error", err));
  const refs = await e.DB.prepare("SELECT COUNT(*) AS count FROM users WHERE referred_by=?").bind(u.referral_code).first();
  const rewardRows = await e.DB.prepare(`
    SELECT reward_amount_wei,status FROM referral_rewards WHERE referrer_user_id=?
  `).bind(u.id).all();
  let rewardPaid = 0n, rewardPending = 0n, rewardFrozen = 0n, rewardTotal = 0n;
  for (const r of rewardRows.results || []) {
    const amount = BigInt(r.reward_amount_wei || "0");
    if (r.status === "paid") {
      rewardPaid += amount;
      rewardTotal += amount;
    } else if (r.status === "frozen" || r.status === "payout_failed") {
      rewardFrozen += amount;
    } else if (r.status === "void") {
    } else {
      rewardPending += amount;
      rewardTotal += amount;
    }
  }
  let wallet = { connected: false };
  if (u.wallet_address) {
    try {
      const [g, usdt, bnbRaw] = await Promise.all([
        tokenBalance(e, A.G, u.wallet_address),
        tokenBalance(e, A.U, u.wallet_address),
        rpc(e, "eth_getBalance", [u.wallet_address, "latest"])
      ]);
      wallet = { connected: true, address: u.wallet_address, gdtyWei: g.toString(), usdtWei: usdt.toString(), bnbWei: BigInt(bnbRaw).toString() };
    } catch {
      wallet = { connected: true, address: u.wallet_address, gdtyWei: null, usdtWei: null, bnbWei: null };
    }
  }
  const trades = await e.DB.prepare(`
    SELECT tx_hash AS txHash,dex,side,gdty_amount_wei AS gdtyAmountWei,usdt_amount_wei AS usdtAmountWei,
           status,confirmations,created_at AS createdAt
    FROM trades WHERE user_id=? ORDER BY created_at DESC LIMIT 50
  `).bind(u.id).all();
  const notifications = await e.DB.prepare(`
    SELECT id,type,title,message,read_at AS readAt,created_at AS createdAt
    FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 30
  `).bind(u.id).all();
  let airdropAdmin = null;
  if (u.role === "admin") {
    const status = await airdropStatus(e);
    const distributedWei = (BigInt(status.claimed) * AIRDROP_REWARD_WEI).toString();
    airdropAdmin = { ...status, distributedWei };
  }
  return out({
    ok: true,
    user: {
      id: u.id,
      email: u.email,
      firstName: u.first_name,
      lastName: u.last_name,
      country: u.country,
      phone: u.phone,
      walletAddress: u.wallet_address,
      referralCode: u.referral_code,
      referredBy: u.referred_by,
      role: u.role,
      createdAt: u.created_at,
      referrals: Number(refs?.count || 0)
    },
    wallet,
    referralRewards: { paidWei: rewardPaid.toString(), pendingWei: rewardPending.toString(), frozenWei: rewardFrozen.toString(), totalWei: rewardTotal.toString() },
    trades: trades.results || [],
    notifications: notifications.results || [],
    airdropAdmin
  }, 200, 0, cors(e));
}
__name(dashboard, "dashboard");
async function logout(e, req) {
  if (!await requireOrigin(e, req)) return out({ ok: false, error: "forbidden" }, 403, cors(e));
  const m = req.headers.get("Cookie") || "", hit = m.match(/(?:^|;\s*)GDTY_SESSION=([^;]+)/);
  if (hit && e.DB) {
    const h = await sha256Text(hit[1]);
    await e.DB.prepare("DELETE FROM sessions WHERE token_hash=?").bind(h).run();
  }
  return out({ ok: true }, 200, 0, { ...cors(e), "set-cookie": cookie("GDTY_SESSION", "", 0) });
}
__name(logout, "logout");
async function createTicket(e, req) {
  const u = await currentUser(e, req);
  if (!u) return out({ ok: false, error: "unauthorized" }, 401, cors(e));
  if (!await requireOrigin(e, req)) return out({ ok: false, error: "forbidden" }, 403, cors(e));
  if (!await rateLimit(e, `ticket:${u.id}`, 10, 36e5)) return out({ ok: false, error: "rate_limited" }, 429, cors(e));
  const d = await req.json().catch(() => ({}));
  const category = clean2(d.category, 40), subject = clean2(d.subject, 160), message = clean2(d.message, 4e3);
  const allowed = ["Account", "Wallet", "Referral", "Purchase", "Technical", "Security", "Other"];
  if (!allowed.includes(category) || !subject || !message) return out({ ok: false, error: "validation_failed" }, 400, cors(e));
  const tid = id(), number = `GDTY-${Date.now().toString(36).toUpperCase()}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`, now = nowIso();
  await e.DB.batch([
    e.DB.prepare("INSERT INTO support_tickets(id,ticket_number,user_id,category,subject,status,priority,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)").bind(tid, number, u.id, category, subject, "open", "normal", now, now),
    e.DB.prepare("INSERT INTO support_messages(id,ticket_id,sender_user_id,sender_role,message,created_at) VALUES(?,?,?,?,?,?)").bind(id(), tid, u.id, "user", message, now)
  ]);
  return out({ ok: true, ticket: { id: tid, ticketNumber: number, status: "open" } }, 201, cors(e));
}
__name(createTicket, "createTicket");
async function ticketList(e, req) {
  const u = await currentUser(e, req);
  if (!u) return out({ ok: false, error: "unauthorized" }, 401, cors(e));
  const rows = await e.DB.prepare("SELECT id,ticket_number AS ticketNumber,category,subject,status,priority,created_at AS createdAt,updated_at AS updatedAt FROM support_tickets WHERE user_id=? ORDER BY created_at DESC").bind(u.id).all();
  return out({ ok: true, tickets: rows.results || [] }, 200, 0, cors(e));
}
__name(ticketList, "ticketList");
async function ticketMessages(e, req) {
  const u = await currentUser(e, req);
  if (!u) return out({ ok: false, error: "unauthorized" }, 401, cors(e));
  const ticketId = clean2(new URL(req.url).searchParams.get("ticket"), 80);
  const t = await e.DB.prepare("SELECT id FROM support_tickets WHERE id=? AND user_id=?").bind(ticketId, u.id).first();
  if (!t) return out({ ok: false, error: "not_found" }, 404, cors(e));
  const rows = await e.DB.prepare("SELECT id,sender_role AS senderRole,message,created_at AS createdAt,read_at AS readAt FROM support_messages WHERE ticket_id=? ORDER BY created_at ASC").bind(ticketId).all();
  return out({ ok: true, messages: rows.results || [] }, 200, 0, cors(e));
}
__name(ticketMessages, "ticketMessages");
async function sendTicketMessage(e, req) {
  const u = await currentUser(e, req);
  if (!u) return out({ ok: false, error: "unauthorized" }, 401, cors(e));
  if (!await requireOrigin(e, req)) return out({ ok: false, error: "forbidden" }, 403, cors(e));
  if (!await rateLimit(e, `ticketmsg:${u.id}`, 20, 36e5)) return out({ ok: false, error: "rate_limited" }, 429, cors(e));
  const d = await req.json().catch(() => ({}));
  const ticketId = clean2(d.ticketId, 80), message = clean2(d.message, 4e3);
  if (!ticketId || !message) return out({ ok: false, error: "validation_failed" }, 400, cors(e));
  const t = await e.DB.prepare("SELECT id FROM support_tickets WHERE id=? AND user_id=?").bind(ticketId, u.id).first();
  if (!t) return out({ ok: false, error: "not_found" }, 404, cors(e));
  const now = nowIso();
  await e.DB.batch([
    e.DB.prepare("INSERT INTO support_messages(id,ticket_id,sender_user_id,sender_role,message,created_at) VALUES(?,?,?,?,?,?)").bind(id(), ticketId, u.id, "user", message, now),
    e.DB.prepare("UPDATE support_tickets SET updated_at=? WHERE id=?").bind(now, ticketId)
  ]);
  return out({ ok: true }, 201, cors(e));
}
__name(sendTicketMessage, "sendTicketMessage");
async function adminListFlaggedRewards(e, req) {
  const admin = await currentUser(e, req);
  if (!admin || admin.role !== "admin") return out({ ok: false, error: "unauthorized" }, 401, cors(e));
  const rows = await e.DB.prepare(`
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
  return out({ ok: true, rewards: rows.results || [] }, 200, 0, cors(e));
}
__name(adminListFlaggedRewards, "adminListFlaggedRewards");
async function adminReleaseReward(e, req) {
  const admin = await currentUser(e, req);
  if (!admin || admin.role !== "admin") return out({ ok: false, error: "unauthorized" }, 401, cors(e));
  if (!await requireOrigin(e, req)) return out({ ok: false, error: "forbidden" }, 403, cors(e));
  const d = await req.json().catch(() => ({}));
  const rewardId = clean2(d.rewardId, 80);
  if (!rewardId) return out({ ok: false, error: "validation_failed" }, 400, cors(e));
  const res = await e.DB.prepare(`
    UPDATE referral_rewards SET status='approved',available_at=? WHERE id=? AND status IN ('frozen','payout_failed')
  `).bind(nowIso(), rewardId).run();
  if (!res?.meta?.changes) return out({ ok: false, error: "not_found" }, 404, cors(e));
  return out({ ok: true }, 200, 0, cors(e));
}
__name(adminReleaseReward, "adminReleaseReward");
var worker_default = {
  async fetch(req, e) {
    const u = new URL(req.url);
    const baseHeaders = cors(e);
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: {
      ...baseHeaders,
      "access-control-allow-methods": "GET,POST,OPTIONS",
      "access-control-allow-headers": "content-type",
      "access-control-max-age": "86400"
    } });
    try {
      if (u.pathname === "/api/register" && req.method === "POST") return await registerUser(e, req);
      if (u.pathname === "/api/login" && req.method === "POST") return await loginUser(e, req);
      if (u.pathname === "/api/verify-email" && req.method === "GET") return await verifyEmail(e, req);
      if (u.pathname === "/api/forgot-password" && req.method === "POST") return await requestPasswordReset(e, req);
      if (u.pathname === "/api/reset-password" && req.method === "POST") return await resetPassword(e, req);
      if (u.pathname === "/api/logout" && req.method === "POST") return await logout(e, req);
      if (u.pathname === "/api/me" && req.method === "GET") return await dashboard(e, req);
      if (u.pathname === "/api/wallet/challenge" && req.method === "POST") return await walletChallenge(e, req);
      if (u.pathname === "/api/wallet/verify" && req.method === "POST") return await walletVerify(e, req);
      if (u.pathname === "/api/trade/verify" && req.method === "POST") {
        const user = await currentUser(e, req);
        if (!user) return out({ ok: false, error: "unauthorized" }, 401, baseHeaders);
        if (!await requireOrigin(e, req)) return out({ ok: false, error: "forbidden" }, 403, baseHeaders);
        if (!await rateLimit(e, `trade:${user.id}`, 20, 6e4)) return out({ ok: false, error: "rate_limited" }, 429, baseHeaders);
        const d = await req.json().catch(() => ({})), txHash = String(d.txHash || "").toLowerCase();
        if (!txRe.test(txHash)) return out({ ok: false, error: "invalid_tx_hash" }, 400, baseHeaders);
        const trade = await verifyTrade(e, user, txHash);
        if (!trade.ok) return out(trade, 400, baseHeaders);
        trade.txHash = txHash;
        const cursor = await e.DB.prepare("SELECT value FROM scanner_state WHERE key='last_block'").first();
        if (cursor && trade.block > parseInt(cursor.value, 10)) {
          return out({ ok: true, status: "pending_detection", message: "This purchase is recent and will be detected automatically within a few minutes." }, 200, 0, baseHeaders);
        }
        return out(await recordTrade(e, user, trade, { manual: true }), 200, 0, baseHeaders);
      }
      if (u.pathname === "/api/referral/check" && req.method === "GET") {
        if (!await rateLimit(e, `refcheck:${ipBucket(ip(req))}`, 30, 6e4)) return out({ ok: false, error: "rate_limited" }, 429, 0, baseHeaders);
        const code = clean2(u.searchParams.get("code"), 32).toUpperCase();
        const row = code && e.DB ? await e.DB.prepare("SELECT referral_code FROM users WHERE referral_code=?").bind(code).first() : null;
        return out({ ok: true, valid: !!row, referralCode: row?.referral_code || null }, 200, 30, baseHeaders);
      }
      if (u.pathname === "/api/support/tickets" && req.method === "POST") return await createTicket(e, req);
      if (u.pathname === "/api/support/tickets" && req.method === "GET") return await ticketList(e, req);
      if (u.pathname === "/api/support/messages" && req.method === "GET") return await ticketMessages(e, req);
      if (u.pathname === "/api/support/messages" && req.method === "POST") return await sendTicketMessage(e, req);
      if (u.pathname === "/api/admin/referral-rewards" && req.method === "GET") return await adminListFlaggedRewards(e, req);
      if (u.pathname === "/api/admin/referral-rewards/release" && req.method === "POST") return await adminReleaseReward(e, req);
      if (u.pathname === "/api/wallet-icon" && req.method === "GET") {
        const allowed = ["trustwallet.com", "metamask.io", "okx.com", "walletconnect.com"];
        const d = u.searchParams.get("d") || "";
        if (!allowed.includes(d)) return new Response("not found", { status: 404 });
        try {
          const r = await fetch(`https://www.google.com/s2/favicons?domain=${encodeURIComponent(d)}&sz=64`, { cf: { cacheTtl: 604800, cacheEverything: true } });
          const type = r.headers.get("content-type") || "";
          if (!r.ok || !type.startsWith("image/")) return new Response("not found", { status: 404 });
          return new Response(r.body, { status: 200, headers: { "content-type": type, "cache-control": "public, max-age=604800" } });
        } catch {
          return new Response("not found", { status: 404 });
        }
      }
      if (u.pathname === "/api/airdrop/status" && req.method === "GET") {
        return out(await airdropStatus(e), 200, 10, baseHeaders);
      }
      if (u.pathname === "/api/airdrop/claim" && req.method === "POST") {
        const result = await claimAirdrop(e, req);
        return out(result, result.ok ? 200 : 400, 0, baseHeaders);
      }
      if (u.pathname === "/api/airdrop/toggle-pause" && req.method === "POST") {
        const user = await currentUser(e, req);
        if (!user || user.role !== "admin") return out({ ok: false, error: "unauthorized" }, 401, baseHeaders);
        if (!await requireOrigin(e, req)) return out({ ok: false, error: "forbidden" }, 403, baseHeaders);
        const paused = await airdropIsPaused(e);
        await e.DB.prepare(`
          INSERT INTO airdrop_state(key,value_int,updated_at) VALUES('paused',?,?)
          ON CONFLICT(key) DO UPDATE SET value_int=excluded.value_int,updated_at=excluded.updated_at
        `).bind(paused ? 0 : 1, nowIso()).run();
        return out({ ok: true, paused: !paused }, 200, 0, baseHeaders);
      }
      if (u.pathname === "/api/dexscreener-pair" && req.method === "GET") {
        try {
          const p = await dexscreenerPair(e);
          return out({ ok: true, ...p }, 200, 60, baseHeaders);
        } catch {
          return out({ ok: false, error: "pair_lookup_failed" }, 502, baseHeaders);
        }
      }
      if (u.pathname === "/api/market") {
        const pp = await pair(e);
        const [uniR, pcsR] = await Promise.allSettled([inspect(e, A.UNI, "Uniswap V2"), inspect(e, pp, "PancakeSwap V2")]);
        const uni = uniR.status === "fulfilled" ? uniR.value : { dex: "Uniswap V2", status: "unavailable", reason: "rpc_error" };
        const pcs = pcsR.status === "fulfilled" ? pcsR.value : { dex: "PancakeSwap V2", status: "unavailable", reason: "rpc_error" };
        const ref = mean(uni.price, pcs.price), live = [uni, pcs].filter((x) => x.status === "live");
        return out({
          ok: true,
          network: "BNB Smart Chain",
          chainId: 56,
          token: { name: "GOLDITY", symbol: "GDTY", address: A.G, decimals: 18 },
          quoteToken: { symbol: "USDT", address: A.U, decimals: 18 },
          referencePrice: ref,
          priceMethod: "Arithmetic mean of valid GDTY/USDT V2 pool prices",
          liquidityUsd: live.reduce((s, x) => s + (x.liquidityUsd || 0), 0) || null,
          totalUsdtReserve: (uni.status === "live" ? uni.usdtReserve || 0 : 0) + (pcs.status === "live" ? pcs.usdtReserve || 0 : 0),
          totalGdtyReserve: (uni.status === "live" ? uni.gdtyReserve || 0 : 0) + (pcs.status === "live" ? pcs.gdtyReserve || 0 : 0),
          reserveMethod: "Sum of available Uniswap V2 + PancakeSwap V2 pool reserves",
          markets: { uniswap: uni, pancakeswap: pcs },
          lastUpdated: nowIso(),
          dataStatus: ref === null ? "unavailable" : "live"
        }, 200, 10, baseHeaders);
      }
      if (u.pathname === "/api/chart") {
        const pp = await pair(e), range = (u.searchParams.get("range") || "1D").toUpperCase(), cfg = ranges[range];
        if (!cfg) return out({ ok: false, error: "invalid_range", allowed: Object.keys(ranges) }, 400, 0, baseHeaders);
        const [uni, pcs] = await Promise.allSettled([geckoOHLCV(e, A.UNI, cfg), geckoOHLCV(e, pp, cfg)]);
        const a = uni.status === "fulfilled" ? normalize(uni.value, "Uniswap V2") : [], b = pcs.status === "fulfilled" ? normalize(pcs.value, "PancakeSwap V2") : [];
        const candles = mergeReference(a, b);
        return out({
          ok: true,
          range,
          method: "Arithmetic mean of valid pool OHLC values by timestamp",
          candles,
          sources: {
            uniswap: { status: a.length ? "live" : "unavailable", pool: A.UNI, count: a.length },
            pancakeswap: { status: b.length ? "live" : "unavailable", pool: pp, count: b.length }
          },
          historyStatus: candles.length ? "live" : "unavailable",
          note: "Candles use indexed market data. No synthetic history is generated."
        }, 200, 30, baseHeaders);
      }
      if (u.pathname === "/api/news" && req.method === "GET") {
        if (!e.DB) return out({ ok: true, items: [] }, 200, 60, baseHeaders);
        const rows = await e.DB.prepare("SELECT slug,title,excerpt,category,published_at AS publishedAt FROM news WHERE status='published' ORDER BY published_at DESC LIMIT 50").all();
        return out({ ok: true, items: rows.results || [] }, 200, 60, baseHeaders);
      }
      if (u.pathname === "/api/resources" && req.method === "GET") {
        if (!e.DB) return out({ ok: true, items: [] }, 200, 60, baseHeaders);
        const rows = await e.DB.prepare("SELECT slug,title,description,category,published_at AS publishedAt FROM resources WHERE status='published' ORDER BY published_at DESC LIMIT 100").all();
        return out({ ok: true, items: rows.results || [] }, 200, 60, baseHeaders);
      }
      if (e.ASSETS) return e.ASSETS.fetch(req);
      return out({ ok: false, error: "not_found" }, 404, 0, baseHeaders);
    } catch (err) {
      console.error("GOLDITY worker error", err);
      return out({ ok: false, error: "internal_error" }, 500, 0, baseHeaders);
    }
  },
  async scheduled(event, e, ctx) {
    if (!e.DB) return;
    try {
      await scanForNewTrades(e);
    } catch (err) {
      console.error("GOLDITY scanner error", err);
    }
    try {
      await graduateOverdueRewardsGlobal(e);
    } catch (err) {
      console.error("GOLDITY global graduate error", err);
    }
    try {
      await processQueuedAirdrops(e);
    } catch (err) {
      console.error("GOLDITY airdrop payout error", err);
    }
  }
};
export {
  worker_default as default
};
/*! Bundled license information:

@noble/secp256k1/index.js:
  (*! noble-secp256k1 - MIT License (c) 2019 Paul Miller (paulmillr.com) *)
*/
//# sourceMappingURL=worker.js.map
