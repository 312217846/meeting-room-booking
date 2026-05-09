const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repoRoot = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(repoRoot, 'public', 'index.html'), 'utf8');
const appJs = fs.readFileSync(path.join(repoRoot, 'public', 'app.js'), 'utf8');

test('login page uses Utopia V2 branding and no WeChat login button', () => {
    assert.match(html, /utopia-logo\.png/);
    assert.match(html, /会议室、培训室预订系统/);
    assert.match(html, /尖沙咀 港威大廈 5座26樓2601室/);
    assert.doesNotMatch(html, /微信登录/);
});

test('booking page has V2 purpose and attendee controls', () => {
    assert.match(html, /name="bookingPurpose"/);
    assert.match(html, /id="bookingAttendeeCount"/);
    assert.match(html, /id="bookingAttendeeCountValue"/);
    assert.match(appJs, /BOOKING_PURPOSES/);
});

test('booking page exposes room type filters and 24-hour behavior hooks', () => {
    assert.match(html, /roomTypeFilter/);
    assert.match(html, /data-room-type="normal"/);
    assert.match(html, /data-room-type="training"/);
    assert.match(html, /data-room-type="vip"/);
    assert.match(appJs, /generateTimeSlots/);
    assert.match(appJs, /24:00/);
});
