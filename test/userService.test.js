const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildUserSearchQuery,
  buildImportedUserRecord,
  disableUserAndCancelFutureBookings
} = require('../src/userService');

test('builds user search across profile fields', () => {
  const query = buildUserSearchQuery('Ada');
  assert.match(query.sql, /english_name LIKE/);
  assert.match(query.sql, /last_name LIKE/);
  assert.match(query.sql, /phone LIKE/);
  assert.match(query.sql, /region LIKE/);
  assert.match(query.sql, /group_name LIKE/);
  assert.deepEqual(query.params, ['%Ada%', '%Ada%', '%Ada%', '%Ada%', '%Ada%']);
});

test('maps imported user to database record with phone as initial password source', () => {
  const record = buildImportedUserRecord({
    english_name: 'Ada',
    last_name: 'Lovelace',
    region: 'HK',
    group_name: 'Alpha',
    phone: '+85261234567',
    booking_permissions: ['normal', 'training']
  });

  assert.equal(record.name, 'Ada Lovelace');
  assert.equal(record.userid, '+85261234567');
  assert.equal(record.phone, '+85261234567');
  assert.deepEqual(record.booking_permissions, ['normal', 'training']);
  assert.equal(record.daily_booking_limit_minutes, 180);
});

test('disables user and cancels future confirmed bookings', async () => {
  const calls = [];
  const fakePool = {
    async execute(sql, params) {
      calls.push({ sql, params });
      if (sql.includes('SELECT id, userid')) return [[{ id: 7, userid: 'USER7', is_active: 1 }]];
      return [{ affectedRows: 1 }];
    }
  };

  const result = await disableUserAndCancelFutureBookings(fakePool, 7, 'ADMIN1', '2026-05-09');

  assert.equal(result.disabled, true);
  assert.equal(calls.some(call => call.sql.includes('UPDATE users SET is_active = FALSE')), true);
  assert.equal(calls.some(call => call.sql.includes('UPDATE bookings SET status = "cancelled"')), true);
});

test('rolls back and releases transactional disable when booking cancellation fails', async () => {
  const calls = [];
  const cancellationError = new Error('booking update failed');
  const fakeConnection = {
    async beginTransaction() {
      calls.push('begin');
    },
    async commit() {
      calls.push('commit');
    },
    async rollback() {
      calls.push('rollback');
    },
    release() {
      calls.push('release');
    },
    async execute(sql) {
      calls.push(sql);
      if (sql.includes('SELECT id, userid')) return [[{ id: 7, userid: 'USER7', is_active: 1 }]];
      if (sql.includes('UPDATE bookings SET status = "cancelled"')) throw cancellationError;
      return [{ affectedRows: 1 }];
    }
  };
  const fakePool = {
    async getConnection() {
      calls.push('getConnection');
      return fakeConnection;
    }
  };

  await assert.rejects(
    () => disableUserAndCancelFutureBookings(fakePool, 7, 'ADMIN1', '2026-05-09'),
    cancellationError
  );

  assert.equal(calls.includes('rollback'), true);
  assert.equal(calls.includes('release'), true);
  assert.equal(calls.includes('commit'), false);
});
