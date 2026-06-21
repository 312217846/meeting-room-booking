# Meeting Room V2 Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the existing meeting room booking app to the approved V2 core design: Utopia branding, Hong Kong phone login, self-registration plus imports, room-type permissions, booking limits, stronger admin tools, and reports.

**Architecture:** Keep the current Express/MySQL/static frontend shape. Extract testable business rules into small CommonJS modules under `src/`, then wire those modules into `server.js`, `public/app.js`, and `public/index.html`. Use Node's built-in `node:test` runner so the first test layer does not require new external dev dependencies.

**Tech Stack:** Node.js, Express, MySQL via `mysql2/promise`, built-in `node:test`, static HTML/CSS/JavaScript.

---

## File Structure

- Create `/Users/todd/Documents/New project/aia会议室/src/constants.js`: shared room types, booking purposes, default permissions, and limits.
- Create `/Users/todd/Documents/New project/aia会议室/src/phone.js`: Hong Kong phone normalization and validation.
- Create `/Users/todd/Documents/New project/aia会议室/src/userImport.js`: parse CSV upload text and pasted table text into normalized user import rows.
- Create `/Users/todd/Documents/New project/aia会议室/src/bookingRules.js`: pure rule checks for purpose, attendee count, room type permission, time range, overlap, booking horizon, and daily duration.
- Create `/Users/todd/Documents/New project/aia会议室/src/schema.js`: V2 schema migration helper used during server startup.
- Create `/Users/todd/Documents/New project/aia会议室/src/userService.js`: admin user search query builder, imported-user mapping, and disable-user side effects.
- Create `/Users/todd/Documents/New project/aia会议室/test/phone.test.js`: phone rule tests.
- Create `/Users/todd/Documents/New project/aia会议室/test/userImport.test.js`: CSV and pasted-table import tests.
- Create `/Users/todd/Documents/New project/aia会议室/test/bookingRules.test.js`: core booking rule tests.
- Create `/Users/todd/Documents/New project/aia会议室/test/schema.test.js`: migration helper tests with a fake pool.
- Create `/Users/todd/Documents/New project/aia会议室/test/userService.test.js`: user service tests with a fake pool.
- Create `/Users/todd/Documents/New project/aia会议室/test/frontend-markup.test.js`: static checks for required V2 UI anchors.
- Modify `/Users/todd/Documents/New project/aia会议室/package.json`: add test scripts and update description.
- Modify `/Users/todd/Documents/New project/aia会议室/database/schema.sql`: document fresh-install V2 schema.
- Modify `/Users/todd/Documents/New project/aia会议室/server.js`: call migration helper, use new rule modules, add import/search/update routes, enforce booking rules, and enhance reports.
- Modify `/Users/todd/Documents/New project/aia会议室/public/index.html`: Utopia branding, login/register UI, booking form controls, admin import/search/edit UI, report controls.
- Modify `/Users/todd/Documents/New project/aia会议室/public/app.js`: frontend API methods, Hong Kong phone handling, default booking tab, room-type filters, 24-hour slots, purpose/attendee payload, admin user import/edit actions, report rendering.
- Add `/Users/todd/Documents/New project/aia会议室/public/img/utopia-logo.png`: supplied Utopia logo copied from `/Users/todd/Desktop/de9490df033d34a8b831be9193d08b47.png`.

## Task 1: Test Harness And Constants

**Files:**
- Modify: `/Users/todd/Documents/New project/aia会议室/package.json`
- Create: `/Users/todd/Documents/New project/aia会议室/src/constants.js`
- Test: `/Users/todd/Documents/New project/aia会议室/test/phone.test.js`

- [ ] **Step 1: Write the failing phone test**

Create `/Users/todd/Documents/New project/aia会议室/test/phone.test.js`:

```js
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
```

- [ ] **Step 2: Add the test script**

Modify `package.json` scripts to this exact block:

```json
"scripts": {
  "start": "node server.js",
  "dev": "nodemon server.js",
  "init-db": "mysql -u root -p < database/schema.sql",
  "test": "node --test",
  "test:unit": "node --test test/*.test.js"
}
```

- [ ] **Step 3: Run the test to verify it fails**

Run:

```bash
npm test -- test/phone.test.js
```

Expected: FAIL with `Cannot find module '../src/phone'`.

- [ ] **Step 4: Implement constants and phone helper**

Create `/Users/todd/Documents/New project/aia会议室/src/constants.js`:

```js
const ROOM_TYPES = ['normal', 'training', 'vip'];
const BOOKING_PURPOSES = ['见客', '招募', '培训', '讲座', '会议', '其他'];
const DEFAULT_BOOKING_PERMISSIONS = ['normal'];
const DEFAULT_DAILY_BOOKING_LIMIT_MINUTES = 180;
const MAX_BOOKING_DAYS = 365;

module.exports = {
  ROOM_TYPES,
  BOOKING_PURPOSES,
  DEFAULT_BOOKING_PERMISSIONS,
  DEFAULT_DAILY_BOOKING_LIMIT_MINUTES,
  MAX_BOOKING_DAYS
};
```

Create `/Users/todd/Documents/New project/aia会议室/src/phone.js`:

```js
function normalizeHongKongPhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  const local = digits.startsWith('852') ? digits.slice(3) : digits;
  if (!/^[569]\d{7}$/.test(local)) {
    return null;
  }
  return `+852${local}`;
}

function isValidHongKongPhone(value) {
  return normalizeHongKongPhone(value) !== null;
}

module.exports = { normalizeHongKongPhone, isValidHongKongPhone };
```

- [ ] **Step 5: Run the test to verify it passes**

Run:

```bash
npm test -- test/phone.test.js
```

Expected: PASS with both phone tests green.

- [ ] **Step 6: Commit**

```bash
git add package.json src/constants.js src/phone.js test/phone.test.js
git commit -m "test: add hong kong phone rules"
```

## Task 2: User Import Parser

**Files:**
- Create: `/Users/todd/Documents/New project/aia会议室/src/userImport.js`
- Test: `/Users/todd/Documents/New project/aia会议室/test/userImport.test.js`

- [ ] **Step 1: Write failing import parser tests**

Create `/Users/todd/Documents/New project/aia会议室/test/userImport.test.js`:

```js
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
  ].join('\\n');

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
    'english_name\\tlast_name\\tregion\\tgroup_name\\tphone\\tlevel',
    'Grace\\tHopper\\tHK\\tBeta\\t91234567\\ttraining',
    'Bad\\tUser\\tHK\\tBeta\\t123\\tnormal'
  ].join('\\n');

  const result = parseUserImportText(text);

  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].phone, '+85291234567');
  assert.deepEqual(result.rows[0].booking_permissions, ['normal', 'training']);
  assert.equal(result.errors.length, 1);
  assert.equal(result.errors[0].rowNumber, 3);
  assert.match(result.errors[0].message, /手机号/);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
npm test -- test/userImport.test.js
```

Expected: FAIL with `Cannot find module '../src/userImport'`.

- [ ] **Step 3: Implement import parsing**

Create `/Users/todd/Documents/New project/aia会议室/src/userImport.js`:

```js
const { ROOM_TYPES } = require('./constants');
const { normalizeHongKongPhone } = require('./phone');

const IMPORT_COLUMNS = ['english_name', 'last_name', 'region', 'group_name', 'phone', 'level'];

function splitLine(line, delimiter) {
  if (delimiter === '\\t') return line.split('\\t').map(cell => cell.trim());
  const cells = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];
    if (char === '"' && next === '"') {
      current += '"';
      i += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      cells.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  cells.push(current.trim());
  return cells;
}

function permissionsFromLevel(level) {
  const normalized = String(level || 'normal').trim().toLowerCase();
  if (normalized === 'training') return ['normal', 'training'];
  if (normalized === 'vip') return ['normal', 'vip'];
  if (normalized === 'all' || normalized === 'admin') return [...ROOM_TYPES];
  return ['normal'];
}

function parseUserImportText(text) {
  const lines = String(text || '').split(/\\r?\\n/).map(line => line.trim()).filter(Boolean);
  if (lines.length < 2) return { rows: [], errors: [{ rowNumber: 1, message: '导入内容至少需要表头和一行用户数据' }] };

  const delimiter = lines[0].includes('\\t') ? '\\t' : ',';
  const headers = splitLine(lines[0], delimiter).map(header => header.trim());
  const missing = IMPORT_COLUMNS.filter(column => !headers.includes(column));
  if (missing.length > 0) {
    return { rows: [], errors: [{ rowNumber: 1, message: `缺少字段: ${missing.join(', ')}` }] };
  }

  const rows = [];
  const errors = [];

  lines.slice(1).forEach((line, index) => {
    const rowNumber = index + 2;
    const values = splitLine(line, delimiter);
    const raw = Object.fromEntries(headers.map((header, i) => [header, values[i] || '']));
    const phone = normalizeHongKongPhone(raw.phone);

    if (!phone) {
      errors.push({ rowNumber, message: '手机号必须是香港手机号' });
      return;
    }

    rows.push({
      english_name: raw.english_name.trim(),
      last_name: raw.last_name.trim(),
      region: raw.region.trim(),
      group_name: raw.group_name.trim(),
      phone,
      level: String(raw.level || 'normal').trim().toLowerCase(),
      booking_permissions: permissionsFromLevel(raw.level)
    });
  });

  return { rows, errors };
}

module.exports = { parseUserImportText, permissionsFromLevel, IMPORT_COLUMNS };
```

- [ ] **Step 4: Run the import tests**

Run:

```bash
npm test -- test/userImport.test.js
```

Expected: PASS with all import tests green.

- [ ] **Step 5: Commit**

```bash
git add src/userImport.js test/userImport.test.js
git commit -m "test: add user import parsing"
```

## Task 3: Booking Rule Module

**Files:**
- Create: `/Users/todd/Documents/New project/aia会议室/src/bookingRules.js`
- Test: `/Users/todd/Documents/New project/aia会议室/test/bookingRules.test.js`

- [ ] **Step 1: Write failing booking rule tests**

Create `/Users/todd/Documents/New project/aia会议室/test/bookingRules.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  hasRoomTypePermission,
  minutesBetween,
  rangesOverlap,
  validateBookingInput,
  wouldExceedDailyLimit
} = require('../src/bookingRules');

test('checks room-type permissions independently from system role', () => {
  assert.equal(hasRoomTypePermission({ booking_permissions: ['normal'] }, { room_type: 'normal' }), true);
  assert.equal(hasRoomTypePermission({ booking_permissions: ['normal'] }, { room_type: 'vip' }), false);
  assert.equal(hasRoomTypePermission({ booking_permissions: ['normal', 'training'] }, { room_type: 'training' }), true);
});

test('calculates 24-hour booking minutes and detects overlaps', () => {
  assert.equal(minutesBetween('00:00', '01:30'), 90);
  assert.equal(minutesBetween('23:30', '24:00'), 30);
  assert.equal(rangesOverlap('09:00', '10:00', '10:00', '11:00'), false);
  assert.equal(rangesOverlap('09:00', '10:00', '09:30', '11:00'), true);
});

test('validates purpose, attendee count, horizon, and time range', () => {
  const ok = validateBookingInput({
    booking_date: '2026-05-10',
    start_time: '09:00',
    end_time: '10:00',
    title: '会议',
    attendee_count: 10,
    today: '2026-05-09',
    roomCapacity: 20
  });
  assert.equal(ok.valid, true);

  assert.match(validateBookingInput({
    booking_date: '2027-05-10',
    start_time: '09:00',
    end_time: '10:00',
    title: '会议',
    attendee_count: 10,
    today: '2026-05-09',
    roomCapacity: 20
  }).message, /一年/);

  assert.match(validateBookingInput({
    booking_date: '2026-05-10',
    start_time: '09:00',
    end_time: '10:00',
    title: '自由文本',
    attendee_count: 10,
    today: '2026-05-09',
    roomCapacity: 20
  }).message, /用途/);

  assert.match(validateBookingInput({
    booking_date: '2026-05-10',
    start_time: '09:00',
    end_time: '10:00',
    title: '会议',
    attendee_count: 201,
    today: '2026-05-09',
    roomCapacity: 300
  }).message, /参与人数/);
});

test('limits daily total booking duration across all rooms', () => {
  const existingBookings = [
    { start_time: '09:00', end_time: '10:30' },
    { start_time: '14:00', end_time: '15:00' }
  ];

  assert.equal(wouldExceedDailyLimit(existingBookings, '16:00', '16:30', 180), false);
  assert.equal(wouldExceedDailyLimit(existingBookings, '16:00', '17:00', 180), true);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
npm test -- test/bookingRules.test.js
```

Expected: FAIL with `Cannot find module '../src/bookingRules'`.

- [ ] **Step 3: Implement booking rules**

Create `/Users/todd/Documents/New project/aia会议室/src/bookingRules.js`:

```js
const { BOOKING_PURPOSES, MAX_BOOKING_DAYS } = require('./constants');

function parsePermissions(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return String(value).split(',').map(item => item.trim()).filter(Boolean);
  }
}

function normalizeRoomType(room) {
  if (room && room.room_type) return room.room_type;
  return room && room.is_vip ? 'vip' : 'normal';
}

function hasRoomTypePermission(user, room) {
  const permissions = parsePermissions(user && user.booking_permissions);
  return permissions.includes(normalizeRoomType(room));
}

function toMinutes(time) {
  if (time === '24:00') return 24 * 60;
  const match = /^([01]\\d|2[0-3]):([0-5]\\d)(?::[0-5]\\d)?$/.exec(String(time || ''));
  if (!match) return NaN;
  return Number(match[1]) * 60 + Number(match[2]);
}

function minutesBetween(startTime, endTime) {
  return toMinutes(endTime) - toMinutes(startTime);
}

function rangesOverlap(startA, endA, startB, endB) {
  return toMinutes(startA) < toMinutes(endB) && toMinutes(endA) > toMinutes(startB);
}

function daysBetween(startDate, endDate) {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  return Math.round((end - start) / 86400000);
}

function validateBookingInput({ booking_date, start_time, end_time, title, attendee_count, today, roomCapacity }) {
  if (!BOOKING_PURPOSES.includes(title)) return { valid: false, message: '用途必须从固定选项中选择' };
  const count = Number(attendee_count);
  if (!Number.isInteger(count) || count < 1 || count > 200) return { valid: false, message: '参与人数必须在1-200之间' };
  if (roomCapacity && count > Number(roomCapacity)) return { valid: false, message: `超出会议室容量限制（最大${roomCapacity}人）` };
  const duration = minutesBetween(start_time, end_time);
  if (!Number.isFinite(duration) || duration <= 0) return { valid: false, message: '结束时间必须晚于开始时间' };
  const horizon = daysBetween(today, booking_date);
  if (horizon < 0) return { valid: false, message: '不能预订过去日期' };
  if (horizon > MAX_BOOKING_DAYS) return { valid: false, message: '最多只能预订未来一年内的时段' };
  return { valid: true, message: '' };
}

function wouldExceedDailyLimit(existingBookings, startTime, endTime, limitMinutes) {
  const used = existingBookings.reduce((sum, booking) => sum + minutesBetween(booking.start_time, booking.end_time), 0);
  return used + minutesBetween(startTime, endTime) > Number(limitMinutes || 0);
}

module.exports = {
  parsePermissions,
  normalizeRoomType,
  hasRoomTypePermission,
  toMinutes,
  minutesBetween,
  rangesOverlap,
  validateBookingInput,
  wouldExceedDailyLimit
};
```

- [ ] **Step 4: Run the booking tests**

Run:

```bash
npm test -- test/bookingRules.test.js
```

Expected: PASS with all booking rule tests green.

- [ ] **Step 5: Commit**

```bash
git add src/bookingRules.js test/bookingRules.test.js
git commit -m "test: add booking rule coverage"
```

## Task 4: V2 Schema Migration Helper

**Files:**
- Create: `/Users/todd/Documents/New project/aia会议室/src/schema.js`
- Modify: `/Users/todd/Documents/New project/aia会议室/database/schema.sql`
- Test: `/Users/todd/Documents/New project/aia会议室/test/schema.test.js`

- [ ] **Step 1: Write failing schema helper tests**

Create `/Users/todd/Documents/New project/aia会议室/test/schema.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { getV2ColumnDefinitions, ensureV2Schema } = require('../src/schema');

test('declares required V2 columns for users and meeting rooms', () => {
  const definitions = getV2ColumnDefinitions();
  assert.ok(definitions.users.english_name.includes('VARCHAR(100)'));
  assert.ok(definitions.users.booking_permissions.includes('JSON'));
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
```

- [ ] **Step 2: Run the schema test to verify it fails**

Run:

```bash
npm test -- test/schema.test.js
```

Expected: FAIL with `Cannot find module '../src/schema'`.

- [ ] **Step 3: Implement the migration helper**

Create `/Users/todd/Documents/New project/aia会议室/src/schema.js`:

```js
function getV2ColumnDefinitions() {
  return {
    users: {
      english_name: 'VARCHAR(100) DEFAULT NULL',
      last_name: 'VARCHAR(100) DEFAULT NULL',
      region: 'VARCHAR(100) DEFAULT NULL',
      group_name: 'VARCHAR(100) DEFAULT NULL',
      booking_permissions: "JSON DEFAULT (JSON_ARRAY('normal'))",
      daily_booking_limit_minutes: 'INT DEFAULT 180',
      is_active: 'BOOLEAN DEFAULT TRUE'
    },
    meeting_rooms: {
      room_type: "ENUM('normal', 'training', 'vip') DEFAULT 'normal'"
    }
  };
}

async function columnExists(pool, tableName, columnName) {
  const [rows] = await pool.execute(`SHOW COLUMNS FROM ${tableName} LIKE ?`, [columnName]);
  return rows.length > 0;
}

async function ensureV2Schema(pool) {
  const definitions = getV2ColumnDefinitions();
  for (const [tableName, columns] of Object.entries(definitions)) {
    for (const [columnName, definition] of Object.entries(columns)) {
      if (!(await columnExists(pool, tableName, columnName))) {
        await pool.execute(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
      }
    }
  }
  await pool.execute("UPDATE meeting_rooms SET room_type = 'vip' WHERE is_vip = TRUE AND room_type = 'normal'");
  await pool.execute("INSERT IGNORE INTO system_config (config_key, config_value, description) VALUES ('default_daily_booking_limit_minutes', '180', '默认每日预订上限（分钟）'), ('booking_max_days', '365', '最大可提前预订天数'), ('booking_purposes', '[\"见客\",\"招募\",\"培训\",\"讲座\",\"会议\",\"其他\"]', '预订用途选项')");
}

module.exports = { getV2ColumnDefinitions, ensureV2Schema };
```

- [ ] **Step 4: Update fresh-install schema**

Modify `/Users/todd/Documents/New project/aia会议室/database/schema.sql` so:

- `users` includes `password_hash`, `gender`, `is_active`, `english_name`, `last_name`, `region`, `group_name`, `booking_permissions`, and `daily_booking_limit_minutes`.
- `meeting_rooms` includes `room_type`.
- `system_config` initializes `booking_max_days` to `365`, `default_daily_booking_limit_minutes` to `180`, and `booking_purposes` to the approved JSON list.
- Default rooms cover at least one `normal`, one `training`, and one `vip` room.

- [ ] **Step 5: Run schema tests**

Run:

```bash
npm test -- test/schema.test.js
```

Expected: PASS with both schema tests green.

- [ ] **Step 6: Commit**

```bash
git add src/schema.js test/schema.test.js database/schema.sql
git commit -m "feat: add v2 schema migration"
```

## Task 5: User Service And Admin User APIs

**Files:**
- Create: `/Users/todd/Documents/New project/aia会议室/src/userService.js`
- Modify: `/Users/todd/Documents/New project/aia会议室/server.js`
- Test: `/Users/todd/Documents/New project/aia会议室/test/userService.test.js`

- [ ] **Step 1: Write failing user service tests**

Create `/Users/todd/Documents/New project/aia会议室/test/userService.test.js`:

```js
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
  assert.equal(calls.some(call => call.sql.includes('UPDATE bookings SET status = \"cancelled\"')), true);
});
```

- [ ] **Step 2: Run the user service test to verify it fails**

Run:

```bash
npm test -- test/userService.test.js
```

Expected: FAIL with `Cannot find module '../src/userService'`.

- [ ] **Step 3: Implement user service**

Create `/Users/todd/Documents/New project/aia会议室/src/userService.js`:

```js
const { DEFAULT_DAILY_BOOKING_LIMIT_MINUTES } = require('./constants');

function buildUserSearchQuery(search) {
  const base = `SELECT id, userid, name, avatar, english_name, last_name, region, group_name, department, role, phone, email, gender, booking_permissions, daily_booking_limit_minutes, is_active, created_at, last_login_at FROM users`;
  const term = String(search || '').trim();
  if (!term) return { sql: `${base} ORDER BY created_at DESC`, params: [] };
  const sql = `${base} WHERE english_name LIKE ? OR last_name LIKE ? OR phone LIKE ? OR region LIKE ? OR group_name LIKE ? ORDER BY created_at DESC`;
  const like = `%${term}%`;
  return { sql, params: [like, like, like, like, like] };
}

function buildImportedUserRecord(row) {
  const english = String(row.english_name || '').trim();
  const last = String(row.last_name || '').trim();
  return {
    userid: row.phone,
    name: `${english} ${last}`.trim() || row.phone,
    avatar: (english || last || row.phone || '?').charAt(0).toUpperCase(),
    english_name: english,
    last_name: last,
    region: row.region || null,
    group_name: row.group_name || null,
    phone: row.phone,
    role: 'normal',
    booking_permissions: row.booking_permissions || ['normal'],
    daily_booking_limit_minutes: DEFAULT_DAILY_BOOKING_LIMIT_MINUTES
  };
}

async function disableUserAndCancelFutureBookings(pool, userId, actorUserid, today) {
  const [users] = await pool.execute('SELECT id, userid, is_active FROM users WHERE id = ?', [userId]);
  if (users.length === 0) return { disabled: false, message: '用户不存在' };
  if (!users[0].is_active) return { disabled: false, message: '用户已停用' };

  await pool.execute('UPDATE users SET is_active = FALSE WHERE id = ?', [userId]);
  await pool.execute(
    'UPDATE bookings SET status = "cancelled", cancelled_at = NOW(), cancelled_by = ? WHERE user_id = ? AND status = "confirmed" AND booking_date >= ?',
    [actorUserid, users[0].userid, today]
  );
  return { disabled: true, message: '已停用并释放未来预订' };
}

module.exports = { buildUserSearchQuery, buildImportedUserRecord, disableUserAndCancelFutureBookings };
```

- [ ] **Step 4: Wire user APIs in server**

Modify `/Users/todd/Documents/New project/aia会议室/server.js`:

- Import `normalizeHongKongPhone`, `parseUserImportText`, `buildUserSearchQuery`, `buildImportedUserRecord`, `disableUserAndCancelFutureBookings`, and `ensureV2Schema`.
- Call `await ensureV2Schema(pool)` after `await createTables()` in `initDatabase()`.
- Update register/login to normalize Hong Kong phones and reject inactive users.
- Update `/api/admin/users` to accept `?search=`.
- Update `/api/admin/users/:id` to save `english_name`, `last_name`, `region`, `group_name`, `role`, `phone`, `booking_permissions`, `daily_booking_limit_minutes`, and `is_active`.
- Add `POST /api/admin/users/import` accepting `{ text }`, using `parseUserImportText`, hashing each imported phone as the initial password, and upserting by phone.
- Update `/api/admin/users/:id/toggle-active` so disabling calls `disableUserAndCancelFutureBookings`.

- [ ] **Step 5: Run user service tests**

Run:

```bash
npm test -- test/userService.test.js
```

Expected: PASS with all user service tests green.

- [ ] **Step 6: Commit**

```bash
git add src/userService.js test/userService.test.js server.js
git commit -m "feat: add v2 user administration"
```

## Task 6: Booking API Enforcement And Reports

**Files:**
- Modify: `/Users/todd/Documents/New project/aia会议室/server.js`
- Modify: `/Users/todd/Documents/New project/aia会议室/test/bookingRules.test.js`

- [ ] **Step 1: Extend booking rule tests for overlap lists**

Append this test to `/Users/todd/Documents/New project/aia会议室/test/bookingRules.test.js`:

```js
test('detects user overlap against existing bookings', () => {
  const existing = [
    { start_time: '10:00', end_time: '11:00', room_id: 1 },
    { start_time: '14:00', end_time: '15:00', room_id: 2 }
  ];
  assert.equal(existing.some(booking => rangesOverlap('10:30', '11:30', booking.start_time, booking.end_time)), true);
  assert.equal(existing.some(booking => rangesOverlap('11:00', '12:00', booking.start_time, booking.end_time)), false);
});
```

- [ ] **Step 2: Run booking tests**

Run:

```bash
npm test -- test/bookingRules.test.js
```

Expected: PASS after Task 3 implementation, proving the helper supports the route work.

- [ ] **Step 3: Wire booking route rules**

Modify `app.post('/api/bookings')` in `/Users/todd/Documents/New project/aia会议室/server.js` so it:

- Reloads the current user from `users` by session user id to get latest active status, permissions, and daily limit.
- Loads the target room and normalizes `room_type`.
- Calls `validateBookingInput`.
- Calls `hasRoomTypePermission`.
- Checks room overlap with existing confirmed room bookings.
- Checks user overlap with existing confirmed user bookings across all rooms.
- Checks daily total with `wouldExceedDailyLimit`.
- Inserts `title` as purpose and `attendee_count` as a required number.

Use these error messages for consistency:

```js
'账号已停用，请联系管理员'
'没有权限预订该类型房间'
'该时间段已被预订'
'同一时间不能预订两间房'
'该用户今日预订总时长已超过上限'
```

- [ ] **Step 4: Update booking list queries**

Modify `/api/bookings`, `/api/bookings/today`, and report detail queries in `server.js` so selected user fields include:

```sql
u.english_name,
u.last_name,
u.region,
u.group_name
```

Also include `r.room_type` in room and booking responses.

- [ ] **Step 5: Update report aggregations and exports**

Modify `/api/admin/reports` and `/api/admin/reports/export` so:

- Room usage includes `r.room_type`.
- User usage includes `u.english_name`, `u.last_name`, `u.region`, and `u.group_name`.
- Booking detail export includes room type, region, group, English name, last name, purpose, attendee count, and status.
- Confirmed bookings count toward usage; cancelled records remain available in detail export.

- [ ] **Step 6: Run unit tests**

Run:

```bash
npm test
```

Expected: PASS for all unit tests created so far.

- [ ] **Step 7: Commit**

```bash
git add server.js test/bookingRules.test.js
git commit -m "feat: enforce v2 booking rules"
```

## Task 7: Utopia Branding And Login UI

**Files:**
- Add: `/Users/todd/Documents/New project/aia会议室/public/img/utopia-logo.png`
- Modify: `/Users/todd/Documents/New project/aia会议室/public/index.html`
- Modify: `/Users/todd/Documents/New project/aia会议室/public/app.js`
- Test: `/Users/todd/Documents/New project/aia会议室/test/frontend-markup.test.js`

- [ ] **Step 1: Write failing frontend markup tests**

Create `/Users/todd/Documents/New project/aia会议室/test/frontend-markup.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'public/index.html'), 'utf8');
const appJs = fs.readFileSync(path.join(root, 'public/app.js'), 'utf8');

test('login page uses Utopia V2 branding and no WeChat login button', () => {
  assert.match(html, /utopia-logo\\.png/);
  assert.match(html, /会议室、培训室预订系统/);
  assert.match(html, /尖沙咀 港威大廈 5座26樓2601室/);
  assert.doesNotMatch(html, /微信登录/);
});

test('booking page has V2 purpose and attendee controls', () => {
  assert.match(html, /bookingPurpose/);
  assert.match(html, /bookingAttendeeCount/);
  assert.match(appJs, /BOOKING_PURPOSES/);
});
```

- [ ] **Step 2: Run frontend markup test to verify it fails**

Run:

```bash
npm test -- test/frontend-markup.test.js
```

Expected: FAIL because current HTML still references AIA and WeChat login.

- [ ] **Step 3: Copy the Utopia logo**

Run:

```bash
cp /Users/todd/Desktop/de9490df033d34a8b831be9193d08b47.png /Users/todd/Documents/New\ project/aia会议室/public/img/utopia-logo.png
```

Expected: `public/img/utopia-logo.png` exists and is a PNG image.

- [ ] **Step 4: Update login markup**

Modify `/Users/todd/Documents/New project/aia会议室/public/index.html`:

- Replace `img/aia-logo-new.jpg` references with `img/utopia-logo.png`.
- Replace title text with `会议室、培训室预订系统`.
- Replace subtitle with `尖沙咀 港威大廈 5座26樓2601室`.
- Remove the WeChat login button from `#loginForm`.
- Hide or remove the WeChat login modal block.
- Change phone labels/placeholders to show `+852`.
- Keep self-registration link and register form.

- [ ] **Step 5: Update login JavaScript**

Modify `/Users/todd/Documents/New project/aia会议室/public/app.js`:

- Remove user-visible WeChat login entry points from normal flows.
- Keep unused functions harmless if the HTML no longer calls them.
- Send phone values as entered; server normalizes them.
- After login or registration, call `this.switchTab('booking')`.

- [ ] **Step 6: Run frontend markup test**

Run:

```bash
npm test -- test/frontend-markup.test.js
```

Expected: PASS with Utopia branding and V2 booking anchors present.

- [ ] **Step 7: Commit**

```bash
git add public/img/utopia-logo.png public/index.html public/app.js test/frontend-markup.test.js
git commit -m "feat: update utopia login experience"
```

## Task 8: Booking Frontend Controls

**Files:**
- Modify: `/Users/todd/Documents/New project/aia会议室/public/index.html`
- Modify: `/Users/todd/Documents/New project/aia会议室/public/app.js`
- Modify: `/Users/todd/Documents/New project/aia会议室/test/frontend-markup.test.js`

- [ ] **Step 1: Extend frontend markup test for booking controls**

Append to `/Users/todd/Documents/New project/aia会议室/test/frontend-markup.test.js`:

```js
test('booking page exposes room type filters and 24-hour behavior hooks', () => {
  assert.match(html, /roomTypeFilter/);
  assert.match(html, /data-room-type="normal"/);
  assert.match(html, /data-room-type="training"/);
  assert.match(html, /data-room-type="vip"/);
  assert.match(appJs, /generateTimeSlots/);
  assert.match(appJs, /24:00/);
});
```

- [ ] **Step 2: Run frontend markup test to verify it fails**

Run:

```bash
npm test -- test/frontend-markup.test.js
```

Expected: FAIL because room type filters and `generateTimeSlots` are not present.

- [ ] **Step 3: Update booking HTML**

Modify `/Users/todd/Documents/New project/aia会议室/public/index.html` inside `#bookingPage`:

- Add a segmented control with id `roomTypeFilter` and buttons with `data-room-type="normal"`, `data-room-type="training"`, and `data-room-type="vip"`.
- Replace `bookingTitle` text input with purpose radio inputs named `bookingPurpose`, values `见客`, `招募`, `培训`, `讲座`, `会议`, `其他`.
- Replace `bookingAttendees` textarea with a range input `id="bookingAttendeeCount" min="1" max="200" value="1"` and a text span `id="bookingAttendeeCountValue"`.

- [ ] **Step 4: Update booking JavaScript**

Modify `/Users/todd/Documents/New project/aia会议室/public/app.js`:

- Add `BOOKING_PURPOSES` and `ROOM_TYPE_LABELS` constants near the top.
- Add app state `roomTypeFilter: 'normal'`.
- Add `setRoomTypeFilter(type)` to update selected filter and re-render room selection.
- Add `generateTimeSlots()` returning 48 half-hour starts from `00:00` through `23:30`.
- Update `renderTimeSlots()` to use `generateTimeSlots()` and display labels through `24:00`.
- Update `renderRoomSelectList()` to filter by `room.room_type` and lock rooms without user permission.
- Update `submitBooking()` to read selected purpose and attendee count, then send `title` and `attendee_count`.
- Update occupied slot labels to show region, group name, English name, and last name when available.

- [ ] **Step 5: Run frontend markup tests**

Run:

```bash
npm test -- test/frontend-markup.test.js
```

Expected: PASS for branding and booking UI static checks.

- [ ] **Step 6: Commit**

```bash
git add public/index.html public/app.js test/frontend-markup.test.js
git commit -m "feat: add v2 booking controls"
```

## Task 9: Admin Room, User, Import, And Report UI

**Files:**
- Modify: `/Users/todd/Documents/New project/aia会议室/public/index.html`
- Modify: `/Users/todd/Documents/New project/aia会议室/public/app.js`
- Modify: `/Users/todd/Documents/New project/aia会议室/test/frontend-markup.test.js`

- [ ] **Step 1: Extend frontend markup test for admin tools**

Append to `/Users/todd/Documents/New project/aia会议室/test/frontend-markup.test.js`:

```js
test('admin page exposes V2 user and room administration anchors', () => {
  assert.match(html, /adminUserSearch/);
  assert.match(html, /userImportText/);
  assert.match(html, /userImportFile/);
  assert.match(html, /roomEditType/);
  assert.match(appJs, /importUsersFromText/);
  assert.match(appJs, /toggleUserActive/);
  assert.match(appJs, /resetUserPassword/);
});
```

- [ ] **Step 2: Run frontend markup test to verify it fails**

Run:

```bash
npm test -- test/frontend-markup.test.js
```

Expected: FAIL because the admin anchors are not present.

- [ ] **Step 3: Update admin HTML**

Modify `/Users/todd/Documents/New project/aia会议室/public/index.html`:

- Add search input `id="adminUserSearch"` above the user table.
- Add import file input `id="userImportFile"` and textarea `id="userImportText"` in the user admin tab.
- Add buttons that call `app.importUsersFromFile()` and `app.importUsersFromText()`.
- Expand user table headers to include region, group, permissions, daily limit, status, reset password, and actions.
- Add `select id="roomEditType"` to the room edit modal with options `normal`, `training`, and `vip`.

- [ ] **Step 4: Update admin JavaScript API methods**

Modify the `API` object in `/Users/todd/Documents/New project/aia会议室/public/app.js`:

```js
getUsers: (search = '') => API.request(`/api/admin/users${search ? '?' + new URLSearchParams({ search }).toString() : ''}`),
importUsers: (text) => API.request('/api/admin/users/import', { method: 'POST', body: JSON.stringify({ text }) }),
```

Keep existing update, toggle, and reset methods, and ensure update user payloads include V2 fields.

- [ ] **Step 5: Update admin JavaScript rendering and actions**

Modify `/Users/todd/Documents/New project/aia会议室/public/app.js`:

- `renderAdminUserTable()` reads `adminUserSearch` and passes it to `API.getUsers(search)`.
- User rows render editable permissions as compact labels or checkboxes.
- Add `editUser(userId)` and a modal or inline prompt sequence that updates user fields through `API.updateUser`.
- Add `toggleUserActive(userId)` calling `API.toggleUserActive`.
- Add `resetUserPassword(userId)` asking for a new password and calling `API.resetPassword`.
- Add `importUsersFromText()` that sends textarea content to `API.importUsers`.
- Add `importUsersFromFile()` that reads file text with `FileReader`, then sends it to `API.importUsers`.
- Room edit modal saves `room_type` from `roomEditType`.
- Reports render room and user rankings in the existing chart containers and export buttons call `exportReport('room')`, `exportReport('user')`, and `exportReport('booking')`.

- [ ] **Step 6: Run frontend markup tests**

Run:

```bash
npm test -- test/frontend-markup.test.js
```

Expected: PASS for branding, booking controls, and admin anchors.

- [ ] **Step 7: Commit**

```bash
git add public/index.html public/app.js test/frontend-markup.test.js
git commit -m "feat: add v2 admin controls"
```

## Task 10: End-To-End Smoke Verification

**Files:**
- Modify only if verification exposes a defect: `/Users/todd/Documents/New project/aia会议室/server.js`, `/Users/todd/Documents/New project/aia会议室/public/app.js`, `/Users/todd/Documents/New project/aia会议室/public/index.html`

- [ ] **Step 1: Run all unit/static tests**

Run:

```bash
npm test
```

Expected: PASS for all `test/*.test.js` files.

- [ ] **Step 2: Start the application**

Run:

```bash
npm start
```

Expected: server logs `服务器运行在 http://localhost:3000` or equivalent startup output. If MySQL is not running, record the database connection error and continue with static frontend verification.

- [ ] **Step 3: Open the app in the browser**

Open:

```text
http://localhost:3000
```

Verify:

- Login page shows the Utopia logo.
- Login title is `会议室、培训室预订系统`.
- Address is visible.
- WeChat login is not visible.
- Phone inputs show `+852`.

- [ ] **Step 4: Verify booking UI**

Using a test account or the first admin account:

- Log in or register.
- Confirm the default page is `预订`.
- Confirm room type filter buttons exist.
- Confirm time slots cover `00:00` through `23:30` and end labels include `24:00`.
- Confirm purpose choices exist.
- Move attendee slider and verify its displayed number changes.

- [ ] **Step 5: Verify admin UI**

With an admin account:

- Open `管理`.
- Search users by a visible term.
- Import one pasted row:

```text
english_name	last_name	region	group_name	phone	level
Test	User	HK	QA	91234567	all
```

- Confirm the imported user appears with normalized phone `+85291234567`.
- Edit room type on one room and save.
- Disable the imported user and confirm the status changes.
- Open reports and confirm room and employee ranking areas render.

- [ ] **Step 6: Stop the server**

Stop the `npm start` process with `Ctrl-C`.

Expected: no long-running app process remains.

- [ ] **Step 7: Commit verification fixes**

If verification required code changes:

```bash
git add server.js public/app.js public/index.html
git commit -m "fix: polish v2 smoke issues"
```

If verification required no code changes, do not create an empty commit.

## Self-Review

- Spec coverage: Tasks 1-6 cover backend validation, schema, imports, permissions, disabled-user release, limits, and reports. Tasks 7-9 cover branding, login, booking UI, admin UI, and report UI. Task 10 covers smoke verification.
- Placeholder scan: This plan contains concrete paths, test code, implementation code for new helper modules, exact commands, and expected results.
- Type consistency: Room types are consistently `normal`, `training`, and `vip`; booking permissions are consistently JSON arrays; daily limits use minutes; booking purpose reuses `title`.
