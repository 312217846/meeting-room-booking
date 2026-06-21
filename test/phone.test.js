const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeHongKongPhone, isValidHongKongPhone } = require('../src/phone');

test('normalizes Hong Kong mobile numbers to +852XXXXXXXX', () => {
  assert.equal(normalizeHongKongPhone('6123 4567'), '+85261234567');
  assert.equal(normalizeHongKongPhone('+852 6123 4567'), '+85261234567');
  assert.equal(normalizeHongKongPhone('852-6123-4567'), '+85261234567');
});

test('rejects unsupported phone formats', () => {
  assert.equal(isValidHongKongPhone('13800138000'), false);
  assert.equal(isValidHongKongPhone('+85212345678'), false);
  assert.equal(isValidHongKongPhone('+85291234567'), true);
});
