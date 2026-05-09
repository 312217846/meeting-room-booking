const test = require('node:test');
const assert = require('node:assert/strict');
const { getV2ColumnDefinitions, ensureV2Schema } = require('../src/schema');

test('declares required V2 columns for users and meeting rooms', () => {
  const definitions = getV2ColumnDefinitions();
  assert.ok(definitions.users.password_hash.includes('VARCHAR(255)'));
  assert.ok(definitions.users.gender.includes('ENUM'));
  assert.ok(definitions.users.english_name.includes('VARCHAR(100)'));
  assert.ok(definitions.users.booking_permissions.includes('JSON'));
  assert.equal(definitions.users.booking_permissions.includes('DEFAULT (JSON_ARRAY'), false);
  assert.ok(definitions.users.daily_booking_limit_minutes.includes('INT'));
  assert.ok(definitions.meeting_rooms.room_type.includes("ENUM('normal', 'training', 'vip')"));
});

test('adds only missing columns with a fake pool', async () => {
  const executed = [];
  const fakePool = {
    async execute(sql, params) {
      executed.push({ sql, params });
      if (sql.includes('SHOW COLUMNS')) {
        const columnName = params[0];
        return [[columnName === 'english_name' ? { Field: 'english_name' } : null].filter(Boolean)];
      }
      return [[]];
    }
  };

  await ensureV2Schema(fakePool);

  assert.equal(executed.some(call => call.sql.includes('ADD COLUMN english_name')), false);
  assert.equal(executed.some(call => call.sql.includes('ADD COLUMN booking_permissions')), true);
  assert.equal(executed.some(call => call.sql.includes('ADD COLUMN room_type')), true);
});

test('backfills default booking permissions for existing users', async () => {
  const executed = [];
  const fakePool = {
    async execute(sql, params) {
      executed.push({ sql, params });
      if (sql.includes('SHOW COLUMNS')) {
        return [[{ Field: params[0] }]];
      }
      return [[]];
    }
  };

  await ensureV2Schema(fakePool);

  assert.equal(
    executed.some(call =>
      call.sql.includes('UPDATE users') &&
      call.sql.includes('booking_permissions = JSON_ARRAY') &&
      call.sql.includes('booking_permissions IS NULL')
    ),
    true
  );
});

test('backfills legacy VIP rooms to vip room type', async () => {
  const executed = [];
  const fakePool = {
    async execute(sql, params) {
      executed.push({ sql, params });
      if (sql.includes('SHOW COLUMNS')) {
        return [[{ Field: params[0] }]];
      }
      return [[]];
    }
  };

  await ensureV2Schema(fakePool);

  assert.equal(
    executed.some(call =>
      call.sql.includes("UPDATE meeting_rooms SET room_type = 'vip' WHERE is_vip = TRUE AND room_type = 'normal'")
    ),
    true
  );
});

test('upserts V2 config defaults instead of insert ignore', async () => {
  const executed = [];
  const fakePool = {
    async execute(sql, params) {
      executed.push({ sql, params });
      if (sql.includes('SHOW COLUMNS')) {
        return [[{ Field: params[0] }]];
      }
      return [[]];
    }
  };

  await ensureV2Schema(fakePool);

  assert.equal(executed.some(call => call.sql.includes('INSERT IGNORE')), false);
  assert.equal(executed.some(call => call.sql.includes('config_value = VALUES(config_value)')), false);
  assert.equal(
    executed.some(call =>
      call.sql.includes('INSERT INTO system_config') &&
      call.sql.includes('ON DUPLICATE KEY UPDATE') &&
      call.sql.includes('booking_max_days') &&
      call.sql.includes('365') &&
      call.sql.includes("config_key = 'booking_max_days'") &&
      call.sql.includes("config_value = '7'")
    ),
    true
  );
});
