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

test('admin reports response includes booking usage ranking data', () => {
  assert.match(serverJs, /const \[bookingUsage\] = await pool\.execute/);
  assert.match(serverJs, /bookingUsage/);
  assert.match(serverJs, /b\.title/);
  assert.match(serverJs, /r\.room_type/);
  assert.match(serverJs, /u\.region/);
  assert.match(serverJs, /u\.group_name/);
});
