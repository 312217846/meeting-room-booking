const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const repoRoot = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(repoRoot, 'public', 'index.html'), 'utf8');
const appJs = fs.readFileSync(path.join(repoRoot, 'public', 'app.js'), 'utf8');

function loadFrontendApp() {
    const sandbox = {
        console,
        fetch: async () => ({ json: async () => ({}) }),
        localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
        setTimeout: () => {},
        URLSearchParams,
        window: { open: () => {} },
        document: {
            body: { appendChild: () => {} },
            head: { appendChild: () => {} },
            addEventListener: () => {},
            createElement: () => ({
                style: {},
                dataset: {},
                classList: { add: () => {}, remove: () => {}, toggle: () => {} },
                appendChild: () => {},
                remove: () => {},
                setAttribute: () => {}
            }),
            getElementById: () => null,
            querySelector: () => null,
            querySelectorAll: () => []
        }
    };
    vm.runInNewContext(appJs, sandbox);
    return sandbox.window.app;
}

test('login page uses Utopia V2 branding and no WeChat login button', () => {
    assert.match(html, /utopia-logo\.png/);
    assert.match(html, /会议室、培训室预订系统/);
    assert.match(html, /尖沙咀 港威大廈 5座26樓2601室/);
    assert.doesNotMatch(html, /微信登录/);
});

test('pages include PMagic AI powered footer', () => {
    assert.match(html, /Powered by/);
    assert.match(html, /pmagic-powered/);
    assert.match(html, /pmagic-ai-logo-symbol/);
    assert.match(html, /class="pmagic-logo"/);
});

test('page includes white crystal luxury theme anchors', () => {
    assert.match(html, /白色水晶金色轻奢主题/);
    assert.match(html, /--crystal-glass/);
    assert.match(html, /backdrop-filter: blur\(24px\) saturate\(175%\)/);
    assert.match(html, /linear-gradient\(135deg, #E5C983 0%, #C9A96E 48%, #9C7B3C 100%\)/);
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
});

test('booking calendar follows the one-year booking horizon', () => {
    const app = loadFrontendApp();
    assert.equal(app.isDateWithinBookingHorizon(new Date('2026-06-15T00:00:00'), new Date('2026-05-09T00:00:00')), true);
    assert.equal(app.isDateWithinBookingHorizon(new Date('2027-05-09T00:00:00'), new Date('2026-05-09T00:00:00')), true);
    assert.equal(app.isDateWithinBookingHorizon(new Date('2027-05-10T00:00:00'), new Date('2026-05-09T00:00:00')), false);
});

test('admin page exposes V2 user and room administration anchors', () => {
    assert.match(html, /adminUserSearch/);
    assert.match(html, /userImportText/);
    assert.match(html, /userImportFile/);
    assert.match(html, /roomEditType/);
    assert.match(appJs, /importUsersFromText/);
    assert.match(appJs, /toggleUserActive/);
    assert.match(appJs, /resetUserPassword/);
});

test('admin controls normalize database boolean flags from MySQL values', () => {
    assert.match(appJs, /normalizeDbFlag/);
    assert.doesNotMatch(appJs, /is_active !== false/);

    const app = loadFrontendApp();
    assert.equal(app.normalizeDbFlag(false), false);
    assert.equal(app.normalizeDbFlag(0), false);
    assert.equal(app.normalizeDbFlag('0'), false);
    assert.equal(app.normalizeDbFlag('false'), false);
    assert.equal(app.normalizeDbFlag(undefined), true);
    assert.equal(app.normalizeDbFlag(1), true);
});

test('admin user daily booking limit labels distinguish unlimited from numeric limits', () => {
    const app = loadFrontendApp();
    assert.equal(app.formatDailyBookingLimit(null), '不限');
    assert.equal(app.formatDailyBookingLimit(''), '不限');
    assert.equal(app.formatDailyBookingLimit(0), '0分钟');
    assert.equal(app.formatDailyBookingLimit('180'), '180分钟');
});

test('booking controls normalize API time values and enforce contiguous slots', () => {
    assert.match(appJs, /timeToMinutes/);
    assert.match(appJs, /isSlotOccupied/);
    assert.match(appJs, /isContiguousSlotSelection/);
    assert.match(appJs, /canToggleTimeSlot/);

    const app = loadFrontendApp();
    assert.equal(app.timeToMinutes('08:30'), 510);
    assert.equal(app.timeToMinutes('08:30:00'), 510);
    assert.equal(app.timeToMinutes('08:30:30'), null);
    assert.equal(app.timeToMinutes('24:00'), 1440);
    assert.equal(app.timeToMinutes('24:00:00'), 1440);
    assert.equal(app.timeToMinutes('24:00:01'), null);
    assert.equal(app.getEndTime('23:30'), '24:00');
    assert.equal(app.isSlotOccupied('08:30', { startTime: '08:00:00', endTime: '09:00:00' }), true);
    assert.equal(app.isSlotOccupied('09:00', { startTime: '08:00:00', endTime: '09:00:00' }), false);
    assert.equal(app.isContiguousSlotSelection(['23:00', '23:30']), true);

    app.selectedTimeSlots = ['08:00', '08:30'];
    assert.equal(app.canToggleTimeSlot('09:00').allowed, true);
    assert.equal(app.canToggleTimeSlot('09:30').allowed, false);

    app.selectedTimeSlots = ['08:00', '08:30', '09:00'];
    assert.equal(app.canToggleTimeSlot('08:30').allowed, false);
    assert.equal(app.canToggleTimeSlot('09:00').allowed, true);
});
