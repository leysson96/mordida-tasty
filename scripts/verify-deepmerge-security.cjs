const assert = require('node:assert/strict');
const { resolve } = require('node:path');
const { createRequire } = require('node:module');
const packageRequire = createRequire(resolve(process.env.AUDIT_DEPENDENCY_ROOT || resolve(__dirname, '..'), 'package.json'));
const consumers = ['fork-ts-checker-webpack-plugin', '@jest/core', 'jest-cli', 'create-jest'];
const installed = () => consumers.map(name => {
  const load = createRequire(packageRequire.resolve(name + '/package.json'));
  const fn = load('deepmerge');
  const attacked = JSON.parse('{"__proto__":{"mordidaPoisoned":true}}');
  assert.equal(Object.getPrototypeOf(fn(attacked, {})), Object.prototype, name);
  console.log(name + ': patched merge resolves and rejects prototype poisoning');
  return fn;
});
const merge = process.argv[2] && process.argv[2] !== '--installed' ? require(resolve(process.argv[2])) : installed()[0];
const legacy = process.argv[3] ? require(resolve(process.argv[3])) : null;

assert.equal(typeof merge, 'function');
assert.equal(typeof merge.all, 'function');
const symbol = Symbol('option');
const cases = [
  () => [{ a: { b: 1 }, list: [1] }, { a: { c: 2 }, list: [2] }],
  () => [{ a: [1] }, { a: { b: 2 } }],
  () => [{ [symbol]: { a: 1 } }, { [symbol]: { b: 2 } }],
  () => [{ date: new Date(0), regex: /a/g }, { enabled: true }],
  () => [Object.assign(Object.create(null), { a: 1 }), { b: 2 }],
  () => [{ a: [1] }, { a: [2] }, { arrayMerge: (_a, b) => b }],
  () => [{ a: { x: 1 } }, { a: { y: 2 } }, { customMerge: key => key === 'a' ? (a, b) => ({ count: Object.keys(a).length + Object.keys(b).length }) : undefined }],
  () => [{ a: { x: 1 } }, { b: 2 }, { clone: false }],
  () => [{ a: { x: 1 } }, { a: { y: 2 } }, { isMergeableObject: value => Boolean(value) && Object.getPrototypeOf(value) === Object.prototype }],
];
for (let i = 0; i < 100; i++) cases.push(() => [{ globals: { ['key' + i]: [i, { enabled: true }] }, mode: 'test' }, { globals: { ['key' + i]: [i + 1], other: null }, mode: 'build' }]);
for (const create of cases) {
  if (legacy) assert.deepStrictEqual(merge(...create()), legacy(...create()));
  const [a, b] = create();
  assert.notEqual(merge(a, b), a);
}
assert.deepStrictEqual(merge.all([{ a: 1 }, { b: 2 }]), { a: 1, b: 2 });
const shared = { nested: true };
assert.equal(merge({}, { shared }, { clone: false }).shared, shared);
assert.notEqual(merge({}, { shared }).shared, shared);
assert.deepStrictEqual(merge({ items: [1] }, { items: [2] }), { items: [1, 2] });
assert.deepStrictEqual(merge({ items: [1] }, { items: [2] }, { arrayMerge: (_a, b, options) => b.map(x => options.cloneUnlessOtherwiseSpecified(x, options)) }), { items: [2] });
const payload = () => JSON.parse('{"__proto__":{"mordidaPoisoned":true}}');
if (legacy) assert.equal(Object.getPrototypeOf(legacy(payload(), {})).mordidaPoisoned, true, 'Old version should reproduce the reported bug');
for (const result of [merge(payload(), {}), merge(Object.create(null), payload()), merge({}, { nested: payload() }).nested, merge([], [payload()])[0]]) {
  assert.equal(Object.getPrototypeOf(result), Object.prototype);
  assert.equal(result.mordidaPoisoned, undefined);
  assert.equal(Object.hasOwn(result, '__proto__'), false);
}
const special = merge({}, JSON.parse('{"constructor":{"prototype":{"mordidaPoisoned":true}},"prototype":{"safe":1}}'));
assert.equal(Object.getPrototypeOf(special), Object.prototype);
assert.equal({}.mordidaPoisoned, undefined);
console.log(JSON.stringify({ security: 'PASS', differentialCases: legacy ? cases.length : 0, contract: 'PASS' }));
