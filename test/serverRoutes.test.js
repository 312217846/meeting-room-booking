const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const serverJs = fs.readFileSync(path.resolve(__dirname, '..', 'server.js'), 'utf8');

test('room admin create and update persist normalized room_type with is_vip compatibility', () => {
  assert.match(serverJs, /const roomType = normalizeRoomType\(req\.body\)/);
  assert.match(serverJs, /const isVip = roomType === 'vip'/);
  assert.match(serverJs, /INSERT INTO meeting_rooms \([\s\S]*room_type[\s\S]*is_vip/);
  assert.match(serverJs, /UPDATE meeting_rooms SET[\s\S]*room_type = \?[\s\S]*is_vip = \?/);
});

test('room admin update preserves sort_order when omitted from the UI payload', () => {
  assert.match(serverJs, /const sortOrder = sort_order === undefined \|\| sort_order === null/);
  assert.match(serverJs, /oldRooms\[0\]\.sort_order \?\? 0/);
  assert.match(serverJs, /roomType, isVip, is_active, sortOrder, roomId/);
});

test('admin user delete deactivates and releases future bookings instead of hard deleting', () => {
  assert.doesNotMatch(serverJs, /DELETE FROM users WHERE id = \?/);
  assert.match(serverJs, /disableUserAndCancelFutureBookings\(\s*pool,\s*userId,/);
});

test('admin reports response includes booking usage ranking data', () => {
  assert.match(serverJs, /const \[bookingUsage\] = await pool\.execute/);
  assert.match(serverJs, /bookingUsage/);
  assert.match(serverJs, /b\.title/);
  assert.match(serverJs, /r\.room_type/);
  assert.match(serverJs, /u\.region/);
  assert.match(serverJs, /u\.group_name/);
});

test('admin reports response includes dashboard summary fields', () => {
    assert.match(serverJs, /activeUsers/);
    assert.match(serverJs, /activeRooms/);
    assert.match(serverJs, /peakDay/);
    assert.match(serverJs, /totalHours/);
});

test('admin reports response includes expanded dashboard dimensions', () => {
  assert.match(serverJs, /const \[roomTypeUsage\] = await pool\.execute/);
  assert.match(serverJs, /const \[regionUsage\] = await pool\.execute/);
  assert.match(serverJs, /const \[groupUsage\] = await pool\.execute/);
  assert.match(serverJs, /const \[hourlyUsage\] = await pool\.execute/);
  assert.match(serverJs, /const \[\[attendeeStats\]\] = await pool\.execute/);
  assert.match(serverJs, /SUM\(COALESCE\(b\.attendee_count, 0\)\)/);
  assert.match(serverJs, /HOUR\(b\.start_time\)/);
  assert.match(serverJs, /roomTypeUsage/);
  assert.match(serverJs, /regionUsage/);
  assert.match(serverJs, /groupUsage/);
  assert.match(serverJs, /hourlyUsage/);
  assert.match(serverJs, /attendeeStats/);
});
