const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const repoRoot = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(repoRoot, 'public', 'index.html'), 'utf8');
const appJs = fs.readFileSync(path.join(repoRoot, 'public', 'app.js'), 'utf8');

function loadFrontendApp(windowOverrides = {}, sandboxOverrides = {}) {
    const sandbox = {
        console,
        fetch: async () => ({ json: async () => ({}) }),
        localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
        setTimeout: () => {},
        URLSearchParams,
        window: { open: () => {}, location: { protocol: 'https:', search: '' }, ...windowOverrides },
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
        },
        ...sandboxOverrides
    };
    vm.runInNewContext(appJs, sandbox);
    return sandbox.window.app;
}

test('login page uses Utopia V2 branding and no WeChat login button', () => {
    assert.match(html, /utopia-logo\.png/);
    assert.match(html, /hong-kong-harbor-login-v2\.png/);
    assert.match(html, /login-page::before/);
    assert.match(html, /香港维港城市海景背景/);
    assert.match(html, /会议室、培训室预订系统/);
    assert.match(html, /尖沙咀 港威大廈 5座26樓2601室/);
    assert.doesNotMatch(html, /微信登录/);
    assert.equal(fs.existsSync(path.join(repoRoot, 'public', 'img', 'hong-kong-harbor-login-v2.png')), true);
});

test('login page exposes reference-style glass city harbor layout anchors', () => {
    assert.match(html, /hong-kong-harbor-login-v2\.png/);
    assert.match(html, /login-brand-bar/);
    assert.match(html, /login-language-select/);
    assert.match(html, /login-iso-hero/);
    assert.match(html, /login-glass-card/);
    assert.match(html, /login-form-row phone-row/);
    assert.match(html, /login-card-options/);
    assert.match(html, /login-alt-action/);
    assert.match(html, /联系管理员开通账号/);
    assert.doesNotMatch(html, /立即注册/);
    assert.equal(fs.existsSync(path.join(repoRoot, 'public', 'img', 'hong-kong-harbor-login-v2.png')), true);
});

test('file preview login enters the app without credentials', async () => {
    const app = loadFrontendApp({ location: { protocol: 'file:', search: '' } });
    let previewUser = null;
    app.handleLoginSuccess = async user => { previewUser = user; };

    await app.handleLogin();

    assert.equal(previewUser.role, 'admin');
    assert.equal(previewUser.name, '默认管理员');
    assert.equal(previewUser.phone, '+852 0000 0000');
});

test('local preview initializes without backend requests before login', async () => {
    const app = loadFrontendApp(
        { location: { protocol: 'file:', search: '' } },
        { fetch: async () => { throw new Error('preview should not request backend'); } }
    );

    await app.loadData();

    assert.equal(app.previewMode, true);
    assert.equal(app.currentUser, null);
});

test('localhost login also enters the default admin preview without credentials', async () => {
    const app = loadFrontendApp({ location: { protocol: 'http:', hostname: 'localhost', search: '' } });
    let previewUser = null;
    app.handleLoginSuccess = async user => { previewUser = user; };

    await app.handleLogin();

    assert.equal(previewUser.role, 'admin');
    assert.equal(previewUser.name, '默认管理员');
});

test('preview reports render local dashboard data without backend requests', async () => {
    const app = loadFrontendApp(
        { location: { protocol: 'file:', search: '' } },
        { fetch: async () => { throw new Error('preview reports should not request backend'); } }
    );
    app.previewMode = true;

    await app.loadReports();

    assert.equal(app.reportData.totalStats.totalBookings > 0, true);
    assert.equal(app.reportData.roomUsage.length > 0, true);
    assert.equal(app.reportData.dailyTrend.length > 0, true);
});

test('pages include PMagic AI powered footer', () => {
    assert.match(html, /Powered by/);
    assert.match(html, /pmagic-powered/);
    assert.match(html, /Powered by[\s\S]*pmagic-brand-lockup[\s\S]*pmagic-source-lockup/);
    assert.match(html, /pmagic-source-lockup-symbol/);
    assert.match(html, /pmagic-source-lockup/);
    assert.match(html, /M521\.553 885\.537/);
    assert.match(html, /viewBox="0 0 800 800"/);
    assert.match(html, /#6B4FFF/);
    assert.match(html, /#FF66D4/);
    assert.match(html, /PMagic AI/);
    assert.doesNotMatch(html, /class="pmagic-name">PMagic AI<\/span>/);
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
    assert.match(html, /purpose-options/);
    assert.match(html, /purpose-option/);
    assert.match(html, /type="number"[^>]*id="bookingAttendeeCount"/);
    assert.doesNotMatch(html, /type="range"[^>]*id="bookingAttendeeCount"/);
    assert.match(appJs, /BOOKING_PURPOSES/);
});

test('booking page exposes room type filters and office-hour behavior hooks', () => {
    assert.match(html, /roomTypeFilter/);
    assert.match(html, /data-room-type="normal"/);
    assert.match(html, /data-room-type="training"/);
    assert.match(html, /data-room-type="vip"/);
    assert.match(appJs, /generateTimeSlots/);
    assert.match(appJs, /BOOKING_START_MINUTES/);
    assert.match(appJs, /BOOKING_END_MINUTES/);
    assert.match(html, /booking-left-column/);
    assert.match(html, /booking-right-column/);
});

test('room list availability filter is callable from inline buttons', () => {
    const app = loadFrontendApp();
    let renderCount = 0;
    app.renderRooms = () => { renderCount += 1; };

    app.filterRooms('available');

    assert.equal(app.roomFilter, 'available');
    assert.equal(renderCount, 1);
});

test('room list renders today bookings as an office-hour timeline', () => {
    const app = loadFrontendApp();
    const timeline = app.buildRoomDailyTimeline([
        {
            start_time: '09:00:00',
            end_time: '10:30:00',
            title: '晨会',
            user_name: '张小明'
        },
        {
            startTime: '14:00',
            endTime: '15:00',
            title: '培训'
        }
    ], 9 * 60 + 45);

    assert.equal(timeline.occupiedMinutes, 150);
    assert.equal(timeline.isBusy, true);
    assert.match(timeline.html, /room-day-timeline/);
    assert.match(timeline.html, /room-timeline-booking/);
    assert.match(timeline.html, /room-timeline-now/);
    assert.match(timeline.html, /room-timeline-axis/);
    assert.match(timeline.html, /08:00/);
    assert.match(timeline.html, /20:00/);
    assert.match(timeline.html, /09:00-10:30/);
    assert.match(html, /--silver-accent: #B8C2CC/);
    assert.match(html, /room-day-timeline/);
    assert.match(html, /room-timeline-track/);
    assert.match(html, /room-timeline-now/);
    assert.match(html, /rgba\(184,194,204,0\.95\)/);
});

test('booking page exposes reference-style workspace and summary anchors', () => {
    assert.match(html, /booking-command-center/);
    assert.match(html, /booking-workspace-grid/);
    assert.match(html, /booking-calendar-panel/);
    assert.match(html, /booking-time-panel/);
    assert.match(html, /booking-room-gallery/);
    assert.match(html, /booking-summary-bar/);
    assert.match(html, /bookingSummaryDate/);
    assert.match(html, /bookingSummaryTime/);
    assert.match(html, /bookingSummaryRoom/);
    assert.match(html, /bookingSummaryPurpose/);
    assert.match(html, /bookingSummaryAttendees/);
    assert.match(appJs, /updateBookingSummary/);
    assert.match(appJs, /getSelectedTimeRangeLabel/);
    assert.match(appJs, /room-select-thumbnail/);
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
    assert.match(html, /admin-action-group/);
    assert.match(html, /admin-action-danger/);
    assert.match(appJs, /importUsersFromText/);
    assert.match(appJs, /toggleUserActive/);
    assert.match(appJs, /resetUserPassword/);
});

test('admin reports expose responsive dashboard anchors and export controls', () => {
    assert.match(html, /reportDashboardGrid/);
    assert.match(html, /reportKpiGrid/);
    assert.match(html, /reportInsightStrip/);
    assert.match(html, /reportExportToolbar/);
    assert.match(html, /reportDailyTrendChart/);
    assert.match(html, /reportPurposeChart/);
    assert.match(html, /reportRoomTypeChart/);
    assert.match(html, /reportRegionChart/);
    assert.match(html, /reportGroupChart/);
    assert.match(html, /reportTimeHeatmapChart/);
    assert.match(html, /reportAttendeeInsight/);
    assert.match(html, /report-crystal-hero/);
    assert.match(html, /report-apple-dashboard/);
    assert.match(html, /reportHeroMetrics/);
    assert.match(html, /report-primary-grid/);
    assert.match(html, /report-support-grid/);
    assert.match(html, /report-chip/);
    assert.match(html, /report-donut-chart/);
    assert.match(html, /report-line-chart/);
    assert.match(appJs, /roomTypeUsage/);
    assert.match(appJs, /regionUsage/);
    assert.match(appJs, /groupUsage/);
    assert.match(appJs, /hourlyUsage/);
    assert.match(appJs, /attendeeStats/);
    assert.match(appJs, /renderReportKpis/);
    assert.match(appJs, /renderReportHeroMetrics/);
    assert.match(appJs, /renderReportTrend/);
    assert.match(appJs, /renderReportDonut/);
    assert.match(appJs, /renderReportLineChart/);
    assert.match(appJs, /report-donut-ring/);
    assert.match(appJs, /report-line-path/);
    assert.match(appJs, /report-line-area/);
    assert.match(html, /report-ranking-glass/);
    assert.match(html, /report-line-chart::before/);
    assert.match(html, /report-donut-wrap::before/);
    assert.match(html, /transform:\s*perspective\(640px\) rotateX\(3deg\)/);
    assert.match(html, /conic-gradient\(from 140deg/);
    assert.match(appJs, /reportLineGlow/);
    assert.match(appJs, /feDropShadow/);
    assert.match(appJs, /#B8C2CC/);
    assert.doesNotMatch(appJs, /#31BFA6/);
    assert.match(appJs, /report-line-depth-rail/);
    assert.match(appJs, /report-line-point-halo/);
    assert.match(html, /rgba\(184,194,204,0\.18\)/);
    assert.match(html, /rgba\(184,194,204,0\.22\)/);
    assert.match(html, /stroke-width:\s*1\.6/);
    assert.match(html, /stroke-width:\s*1\.45/);
    assert.match(html, /height:\s*8px/);
    assert.match(appJs, /class="chart-row report-ranking-glass"/);
    assert.match(appJs, /class="chart-bar-fill"/);
    assert.match(appJs, /r="2\.4"/);
});

test('admin room and user management expose mobile card interactions', () => {
    assert.match(html, /adminRoomCards/);
    assert.match(html, /adminUserCards/);
    assert.match(html, /admin-mobile-card-list/);
    assert.match(html, /admin-table-wrap/);
    assert.match(appJs, /renderAdminRoomCards/);
    assert.match(appJs, /renderAdminUserCards/);
    assert.match(appJs, /mobile-admin-card/);
    assert.match(appJs, /mobile-card-actions/);
});

test('admin console exposes reference-style glass management shell', () => {
    assert.match(html, /admin-reference-console/);
    assert.match(html, /admin-console-header/);
    assert.match(html, /admin-console-nav/);
    assert.match(html, /admin-kpi-strip/);
    assert.match(html, /admin-management-card/);
    assert.match(html, /admin-action-icon/);
    assert.match(html, /report-glass-orbit/);
    assert.match(html, /report-chart-soft/);
    assert.match(html, /report-export-glass/);
    assert.match(appJs, /report-chart-soft/);
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
    assert.equal(app.getEndTime('19:30'), '20:00');
    assert.equal(app.generateTimeSlots().slice(0, 2).join(','), '08:00,08:30');
    assert.equal(app.generateTimeSlots().at(-1), '19:30');
    assert.equal(app.generateTimeSlots().includes('20:00'), false);
    assert.equal(app.isSlotOccupied('08:30', { startTime: '08:00:00', endTime: '09:00:00' }), true);
    assert.equal(app.isSlotOccupied('09:00', { startTime: '08:00:00', endTime: '09:00:00' }), false);
    assert.equal(app.isContiguousSlotSelection(['19:00', '19:30']), true);

    app.selectedTimeSlots = ['08:00', '08:30'];
    assert.equal(app.canToggleTimeSlot('09:00').allowed, true);
    assert.equal(app.canToggleTimeSlot('09:30').allowed, false);

    app.selectedTimeSlots = ['08:00', '08:30', '09:00'];
    assert.equal(app.canToggleTimeSlot('08:30').allowed, false);
    assert.equal(app.canToggleTimeSlot('09:00').allowed, true);
});
