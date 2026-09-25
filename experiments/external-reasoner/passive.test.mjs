import assert from 'node:assert/strict';
import { test } from 'node:test';
import { decode, snapshot } from './passive.mjs';

test('fixture ingress rejects JavaScript graphs without inspecting getters/proxies', () => {
  let touched = 0;
  const cyclic = {}; cyclic.self = cyclic;
  const revoked = Proxy.revocable({}, {}); revoked.revoke();
  const accessor = { get value() { touched++; return 1; } };
  const proxy = new Proxy({}, { ownKeys() { touched++; return []; } });
  for (const value of [undefined, NaN, Infinity, -Infinity, 1n, new Date(), Buffer.from([1]),
    new Uint8Array([1]), new Map(), new Set(), Symbol(), () => {}, new (class {})(),
    Object.create({}), accessor, proxy, revoked.proxy, cyclic, [, 1], { nested: undefined },
    { [Symbol()]: 1 }, {}, []]) assert.throws(() => decode(value));
  for (const text of ['undefined', 'NaN', '[,1]', '{"number":1e400}', '{"number":-1e400}']) {
    assert.throws(() => decode(text));
  }
  assert.equal(touched, 0);
});
test('fixture decoded trees are frozen; trusted output projections detach aliases', () => {
  const original = { values: [{ text: 'safe' }], nil: null, yes: true, count: 2 };
  const owned = snapshot(original);
  original.values[0].text = 'changed';
  assert.equal(owned.values[0].text, 'safe');
  assert.throws(() => { owned.values[0].text = 'mutate'; });
  assert.deepEqual(decode('{"__proto__":{"safe":true}}'), JSON.parse('{"__proto__":{"safe":true}}'));
  assert.throws(() => decode('['.repeat(30) + '0' + ']'.repeat(30)), /limit/);
});
