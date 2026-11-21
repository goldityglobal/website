import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

// Pull the nonce-floor and run-lock helpers out of worker.js and run them with mocks.
const src = readFileSync(new URL("../worker.js", import.meta.url), "utf8");
const a = src.indexOf("var payoutNonceFloor");
const b = src.indexOf('__name(withPayoutRunLock, "withPayoutRunLock");');
assert.ok(a > 0 && b > a, "helpers not found in worker.js");
const code = src.slice(a, b) + "\n;({ getNonce, noteNonceUsed, withPayoutRunLock, reset(){ payoutNonceFloor = { n: -1, at: 0 }; } })";

function makeEnv(pendingNonceRef) {
  const row = { value_int: undefined };
  const db = {
    prepare(sql) {
      return {
        bind(...args) {
          return {
            async run() {
              if (/INSERT INTO airdrop_state/.test(sql)) {
                if (row.value_int === undefined) row.value_int = 0;
                return { meta: { changes: 1 } };
              }
              if (/value_int<=\?/.test(sql)) {
                const [until, , nowS] = args;
                if (row.value_int <= nowS) { row.value_int = until; return { meta: { changes: 1 } }; }
                return { meta: { changes: 0 } };
              }
              if (/SET value_int=0/.test(sql)) { row.value_int = 0; return { meta: { changes: 1 } }; }
              throw new Error("unexpected sql " + sql);
            }
          };
        }
      };
    }
  };
  return { DB: db, row, pending: pendingNonceRef };
}

function load(env) {
  const ctx = {
    rpc: async () => "0x" + env.pending.n.toString(16),
    nowIso: () => new Date().toISOString(),
    __name: (f) => f,
    console, Date, Number, parseInt, Math
  };
  return vm.runInNewContext(code, ctx);
}

test("nonce floor skips a lagging pending count right after a broadcast", async () => {
  const env = makeEnv({ n: 10 });
  const h = load(env);
  assert.equal(await h.getNonce(env, "0xabc"), 10);
  h.noteNonceUsed(10);
  assert.equal(await h.getNonce(env, "0xabc"), 11, "node still reports 10, must use 11");
  env.pending.n = 12;
  assert.equal(await h.getNonce(env, "0xabc"), 12, "node moved ahead, trust the node");
});

test("run lock lets only one payout run at a time and releases afterwards", async () => {
  const env = makeEnv({ n: 0 });
  const h = load(env);
  let inner = 0, skipped = false;
  const first = h.withPayoutRunLock(env, async () => {
    inner++;
    skipped = (await h.withPayoutRunLock(env, async () => { inner++; })) === false;
  });
  assert.equal(await first, true);
  assert.equal(inner, 1, "second run must not execute while the first holds the lock");
  assert.ok(skipped);
  assert.equal(env.row.value_int, 0, "lock released");
  assert.equal(await h.withPayoutRunLock(env, async () => { inner++; }), true);
  assert.equal(inner, 2);
});

test("run lock is released even when the payout run throws", async () => {
  const env = makeEnv({ n: 0 });
  const h = load(env);
  await assert.rejects(h.withPayoutRunLock(env, async () => { throw new Error("boom"); }), /boom/);
  assert.equal(env.row.value_int, 0);
});
