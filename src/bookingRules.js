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
  if (time === '24:00' || time === '24:00:00') return 24 * 60;
  const match = /^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/.exec(String(time || ''));
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

function isValidDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(`${value}T00:00:00`);
  return Number.isFinite(date.getTime())
    && date.getFullYear() === year
    && date.getMonth() + 1 === month
    && date.getDate() === day;
}

function validateBookingInput({ booking_date, start_time, end_time, title, attendee_count, today, roomCapacity }) {
  if (!BOOKING_PURPOSES.includes(title)) return { valid: false, message: '用途必须从固定选项中选择' };
  const count = Number(attendee_count);
  if (!Number.isInteger(count) || count < 1 || count > 200) return { valid: false, message: '参与人数必须在1-200之间' };
  if (roomCapacity && count > Number(roomCapacity)) return { valid: false, message: `超出会议室容量限制（最大${roomCapacity}人）` };
  const duration = minutesBetween(start_time, end_time);
  if (!Number.isFinite(duration) || duration <= 0) return { valid: false, message: '结束时间必须晚于开始时间' };
  if (!isValidDate(today) || !isValidDate(booking_date)) return { valid: false, message: '预订日期格式不正确' };
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
