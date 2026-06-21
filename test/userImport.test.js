const test = require('node:test');
const assert = require('node:assert/strict');
const { parseUserImportText, permissionsFromLevel } = require('../src/userImport');

test('maps import levels to room-type permissions', () => {
  assert.deepEqual(permissionsFromLevel('normal'), ['normal']);
  assert.deepEqual(permissionsFromLevel('training'), ['normal', 'training']);
  assert.deepEqual(permissionsFromLevel('vip'), ['normal', 'vip']);
  assert.deepEqual(permissionsFromLevel('all'), ['normal', 'training', 'vip']);
  assert.deepEqual(permissionsFromLevel('admin'), ['normal', 'training', 'vip']);
});

test('parses CSV import text into normalized rows', () => {
  const text = [
    'english_name,last_name,region,group_name,phone,level',
    'Ada,Lovelace,HK,Alpha,+852 6123 4567,all'
  ].join('\n');

  const result = parseUserImportText(text);

  assert.equal(result.rows.length, 1);
  assert.equal(result.errors.length, 0);
  assert.deepEqual(result.rows[0], {
    english_name: 'Ada',
    last_name: 'Lovelace',
    region: 'HK',
    group_name: 'Alpha',
    phone: '+85261234567',
    level: 'all',
    booking_permissions: ['normal', 'training', 'vip']
  });
});

test('parses pasted tabular text and returns row-level errors', () => {
  const text = [
    'english_name\tlast_name\tregion\tgroup_name\tphone\tlevel',
    'Grace\tHopper\tHK\tBeta\t91234567\ttraining',
    'Bad\tUser\tHK\tBeta\t123\tnormal'
  ].join('\n');

  const result = parseUserImportText(text);

  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].phone, '+85291234567');
  assert.deepEqual(result.rows[0].booking_permissions, ['normal', 'training']);
  assert.equal(result.errors.length, 1);
  assert.equal(result.errors[0].rowNumber, 3);
  assert.match(result.errors[0].message, /手机号/);
});
