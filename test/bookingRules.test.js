const test = require('node:test');
const assert = require('node:assert/strict');
const {
  hasRoomTypePermission,
  minutesBetween,
  normalizeRoomType,
  rangesOverlap,
  validateBookingInput,
  wouldExceedDailyLimit
} = require('../src/bookingRules');

test('checks room-type permissions independently from system role', () => {
  assert.equal(hasRoomTypePermission({ booking_permissions: ['normal'] }, { room_type: 'normal' }), true);
  assert.equal(hasRoomTypePermission({ booking_permissions: ['normal'] }, { room_type: 'vip' }), false);
  assert.equal(hasRoomTypePermission({ booking_permissions: ['normal', 'training'] }, { room_type: 'training' }), true);
  assert.equal(hasRoomTypePermission({ role: 'admin', booking_permissions: ['normal'] }, { room_type: 'vip' }), true);
});

test('normalizes room type to supported values with legacy VIP fallback', () => {
  assert.equal(normalizeRoomType({ room_type: 'training', is_vip: true }), 'training');
  assert.equal(normalizeRoomType({ room_type: 'unsupported', is_vip: true }), 'vip');
  assert.equal(normalizeRoomType({ room_type: 'unsupported', is_vip: false }), 'normal');
  assert.equal(normalizeRoomType({ is_vip: true }), 'vip');
});

test('calculates 24-hour booking minutes and detects overlaps', () => {
  assert.equal(minutesBetween('00:00', '01:30'), 90);
  assert.equal(minutesBetween('23:30', '24:00'), 30);
  assert.equal(minutesBetween('23:30:00', '24:00:00'), 30);
  assert.equal(rangesOverlap('09:00', '10:00', '10:00', '11:00'), false);
  assert.equal(rangesOverlap('09:00', '10:00', '09:30', '11:00'), true);
  assert.equal(rangesOverlap('23:30:00', '24:00:00', '23:45:00', '24:00:00'), true);
});

test('detects overlaps across a booking list', () => {
  const existingBookings = [
    { room_id: 1, start_time: '10:00', end_time: '11:00' },
    { room_id: 2, start_time: '14:00', end_time: '15:00' }
  ];

  assert.equal(
    existingBookings.some(booking => rangesOverlap('10:30', '11:30', booking.start_time, booking.end_time)),
    true
  );
  assert.equal(
    existingBookings.every(booking => !rangesOverlap('11:00', '12:00', booking.start_time, booking.end_time)),
    true
  );
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

test('rejects invalid booking dates', () => {
  const validFields = {
    start_time: '09:00',
    end_time: '10:00',
    title: '会议',
    attendee_count: 10,
    today: '2026-05-09',
    roomCapacity: 20
  };

  assert.match(validateBookingInput({
    ...validFields,
    booking_date: 'not-a-date'
  }).message, /日期/);

  assert.match(validateBookingInput({
    ...validFields,
    booking_date: ''
  }).message, /日期/);

  assert.match(validateBookingInput({
    ...validFields,
    today: '2026-02-01',
    booking_date: '2026-02-30'
  }).message, /日期/);
});

test('limits daily total booking duration across all rooms', () => {
  const existingBookings = [
    { start_time: '09:00', end_time: '10:30' },
    { start_time: '14:00', end_time: '15:00' }
  ];

  assert.equal(wouldExceedDailyLimit(existingBookings, '16:00', '16:30', 180), false);
  assert.equal(wouldExceedDailyLimit(existingBookings, '16:00', '17:00', 180), true);
  assert.equal(wouldExceedDailyLimit(existingBookings, '16:00', '20:00', null), false);
  assert.equal(wouldExceedDailyLimit(existingBookings, '16:00', '20:00', ''), false);
});
