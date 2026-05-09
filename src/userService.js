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
