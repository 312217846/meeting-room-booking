# Reference UX Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the login, booking, admin, and report UX to closely match the approved white crystal UTOPIA reference design while preserving existing meeting-room behavior.

**Architecture:** Keep the current single-page static frontend. Use `public/index.html` for markup/CSS anchors and `public/app.js` for rendering state, booking summary updates, and report/chart behavior. Add a local Hong Kong harbor background asset under `public/img/` so the login page does not depend on remote images.

**Tech Stack:** Vanilla HTML/CSS/JavaScript, Node `node:test`, existing Express/MySQL app and static frontend tests.

---

## File Structure

- Modify `test/frontend-markup.test.js`: add failing tests for reference-layout anchors and behavior hooks before UI changes.
- Modify `public/index.html`: update login, booking, admin, reports markup and the white crystal CSS system.
- Modify `public/app.js`: update booking summary rendering, selected-room visual metadata, admin card action markup, and report chart output where markup classes change.
- Create `public/img/hong-kong-harbor-login-v2.png`: generated local login background asset.
- Keep `docs/superpowers/specs/2026-05-10-reference-ux-redesign-design.md`: approved design source.

---

### Task 1: Lock Reference UX Anchors With Tests

**Files:**
- Modify: `test/frontend-markup.test.js`

- [ ] **Step 1: Add login reference layout assertions**

Insert this test after `login page uses Utopia V2 branding and no WeChat login button`:

```javascript
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
```

- [ ] **Step 2: Add booking workspace assertions**

Insert this test after `booking page exposes room type filters and office-hour behavior hooks`:

```javascript
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
```

- [ ] **Step 3: Add admin and report shell assertions**

Insert this test after `admin room and user management expose mobile card interactions`:

```javascript
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
```

- [ ] **Step 4: Run frontend static tests and verify the new tests fail**

Run:

```bash
node --test test/frontend-markup.test.js
```

Expected: FAIL. The failure messages should mention missing anchors such as `login-brand-bar`, `booking-command-center`, and `admin-reference-console`.

- [ ] **Step 5: Commit the failing tests**

Run:

```bash
git add test/frontend-markup.test.js
git commit -m "test: lock reference ux redesign anchors"
```

Expected: commit succeeds with only `test/frontend-markup.test.js`.

---

### Task 2: Generate And Install Hong Kong Harbor Login Asset

**Files:**
- Create: `public/img/hong-kong-harbor-login-v2.png`
- Modify: `public/index.html`

- [ ] **Step 1: Generate the background image**

Use the image generation skill/tool with this prompt:

```text
Premium Hong Kong harbor city sea-view background for a luxury meeting room booking system login page. Soft daylight, Victoria Harbour skyline, clean modern towers, bright white and pale blue atmosphere, subtle gold warmth, elegant Apple-like glass aesthetic, no text, no logos, no people, no watermark, wide 16:9 composition, enough negative space in the center for a translucent login card.
```

Expected: a local PNG is generated by the tool.

- [ ] **Step 2: Copy the generated file into the app asset folder**

Run a copy command using the generated image path returned by the tool:

```bash
cp "/absolute/path/from/image/tool.png" public/img/hong-kong-harbor-login-v2.png
```

Expected: `public/img/hong-kong-harbor-login-v2.png` exists and is a PNG image.

- [ ] **Step 3: Update the login background reference**

In `public/index.html`, update the login background CSS to use the new file:

```css
/* 香港维港城市海景背景 */
.login-page::before {
    content: "";
    position: absolute;
    inset: 0;
    z-index: -2;
    background-image:
        linear-gradient(135deg, rgba(247,251,255,0.18), rgba(247,251,255,0.42)),
        url('img/hong-kong-harbor-login-v2.png');
    background-size: cover;
    background-position: center;
    transform: scale(1.02);
}
```

- [ ] **Step 4: Run the image existence test**

Run:

```bash
node --test test/frontend-markup.test.js
```

Expected: tests still fail on layout anchors from Task 1, but the asset existence assertion for `hong-kong-harbor-login-v2.png` passes.

- [ ] **Step 5: Commit the login asset**

Run:

```bash
git add public/img/hong-kong-harbor-login-v2.png public/index.html
git commit -m "style: add hong kong harbor login background"
```

Expected: commit succeeds with the generated PNG and the CSS reference.

---

### Task 3: Rebuild The Login Page Into Reference-Style Glass UX

**Files:**
- Modify: `public/index.html`
- Modify: `test/frontend-markup.test.js`

- [ ] **Step 1: Replace the login markup while preserving IDs**

In `public/index.html`, replace the `#loginPage` contents with this structure. Keep the existing `id="loginPage"`, `id="loginForm"`, `id="loginPhone"`, `id="loginPassword"`, and `onclick="app.handleLogin()"` hooks:

```html
<div id="loginPage" class="login-page login-reference-shell">
    <div class="login-brand-bar">
        <div class="login-brand-lockup">
            <img src="img/utopia-logo.png" alt="UTOPIA" class="login-brand-logo">
            <span class="login-brand-name">UTOPIA</span>
        </div>
        <button class="login-language-select" type="button">繁體中文⌄</button>
    </div>

    <section class="login-hero-content" aria-label="会议室、培训室预订系统登录">
        <div class="login-iso-hero">
            <img src="img/utopia-logo.png" alt="UTOPIA ISO" class="login-iso-logo">
        </div>
        <h1 class="login-title">会议室、培训室预订系统</h1>
        <p class="login-subtitle">尖沙咀 港威大廈 5座26樓2601室</p>

        <div class="login-card login-glass-card">
            <div id="loginForm">
                <div class="login-card-title">用户登录</div>
                <div class="login-form-row phone-row">
                    <span class="login-input-icon">□</span>
                    <button class="login-country-code" type="button">+852⌄</button>
                    <input type="tel" id="loginPhone" class="form-input login-input" placeholder="输入手机号码">
                </div>
                <div class="login-form-row">
                    <span class="login-input-icon">◇</span>
                    <input type="password" id="loginPassword" class="form-input login-input" placeholder="输入密码">
                    <span class="login-input-eye">◎</span>
                </div>
                <div class="login-card-options">
                    <label class="login-remember"><input type="checkbox"> 记住我</label>
                    <button type="button" class="login-link-button">忘记密码?</button>
                </div>
                <button class="wechat-login-btn login-primary-action" onclick="app.handleLogin()">登录</button>
                <div class="login-divider"><span>或</span></div>
                <button class="login-alt-action" type="button">使用验证码登录</button>
                <div class="login-admin-note">首次使用？联系管理员开通账号</div>
            </div>
            <div id="registerForm" class="login-register-panel" style="display:none;">
                <div class="login-card-title">账号申请</div>
                <p class="login-admin-note">请联系管理员开通账号后登录。</p>
                <button class="login-alt-action" type="button" onclick="app.showLoginForm()">返回登录</button>
            </div>
        </div>
    </section>

    <div class="login-legal-bar">
        <span>© UTOPIA 2026 保留所有权利</span>
        <span>隐私政策</span>
        <span>使用条款</span>
    </div>

    <div class="pmagic-powered" aria-label="Powered by PMagic AI">
        <span class="powered-text">Powered by</span>
        <span class="pmagic-brand-lockup" aria-hidden="true">
            <svg class="pmagic-source-lockup" viewBox="332 858 314 80" focusable="false">
                <use href="#pmagic-source-lockup-symbol"></use>
            </svg>
        </span>
    </div>
</div>
```

- [ ] **Step 2: Add login glass CSS**

Add these CSS rules near the existing login page theme rules:

```css
.login-reference-shell {
    min-height: 100vh;
    display: grid;
    grid-template-rows: auto 1fr auto auto;
    align-items: center;
    padding: 28px;
}

.login-brand-bar,
.login-legal-bar {
    width: min(100%, 1280px);
    margin: 0 auto;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
}

.login-brand-lockup {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    color: #31BFA6;
    font-size: 26px;
    font-weight: 860;
}

.login-brand-logo {
    width: 42px;
    height: 42px;
    border-radius: 999px;
    object-fit: cover;
    box-shadow: 0 10px 28px rgba(49, 191, 166, 0.18);
}

.login-language-select,
.login-link-button,
.login-country-code {
    border: 0;
    background: rgba(255,255,255,0.48);
    color: var(--text-primary);
    border-radius: 999px;
    min-height: 34px;
    padding: 0 12px;
    font-weight: 760;
}

.login-hero-content {
    width: min(100%, 520px);
    margin: 0 auto;
    display: grid;
    justify-items: center;
    text-align: center;
}

.login-iso-hero {
    width: 190px;
    height: 190px;
    border-radius: 999px;
    display: grid;
    place-items: center;
    background: rgba(255,255,255,0.42);
    border: 1px solid rgba(255,255,255,0.72);
    box-shadow: 0 26px 70px rgba(31, 55, 70, 0.12);
    -webkit-backdrop-filter: blur(18px) saturate(160%);
    backdrop-filter: blur(18px) saturate(160%);
}

.login-iso-logo {
    width: 168px;
    height: 168px;
    border-radius: 999px;
    object-fit: cover;
}

.login-glass-card {
    width: min(100%, 430px);
    margin-top: 28px;
    padding: 24px;
    border-radius: 28px;
}

.login-card-title {
    margin-bottom: 16px;
    text-align: left;
    color: var(--text-primary);
    font-size: 18px;
    font-weight: 850;
}

.login-form-row {
    min-height: 54px;
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 12px;
    padding: 0 14px;
    border: 1px solid rgba(255,255,255,0.72);
    border-radius: 14px;
    background: rgba(255,255,255,0.62);
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.86);
}

.login-input {
    min-width: 0;
    flex: 1;
    border: 0 !important;
    box-shadow: none !important;
    background: transparent !important;
    padding: 0 !important;
}

.login-input-icon,
.login-input-eye {
    color: var(--text-secondary);
    font-weight: 800;
}

.login-card-options {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    margin: 6px 0 18px;
    color: var(--text-secondary);
    font-size: 13px;
}

.login-primary-action,
.login-alt-action {
    width: 100%;
    min-height: 48px;
    border-radius: 12px;
    font-weight: 820;
}

.login-alt-action {
    border: 1px solid rgba(191,204,218,0.48);
    background: rgba(255,255,255,0.52);
    color: var(--text-primary);
}

.login-divider {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    gap: 12px;
    margin: 18px 0;
    color: var(--text-secondary);
    font-size: 12px;
}

.login-divider::before,
.login-divider::after {
    content: "";
    height: 1px;
    background: rgba(191,204,218,0.42);
}

.login-admin-note,
.login-legal-bar {
    color: rgba(45, 56, 68, 0.72);
    font-size: 12px;
}

.login-admin-note {
    margin-top: 16px;
}
```

- [ ] **Step 3: Run frontend static tests**

Run:

```bash
node --test test/frontend-markup.test.js
```

Expected: login reference tests pass; booking/admin reference tests still fail.

- [ ] **Step 4: Commit login redesign**

Run:

```bash
git add public/index.html test/frontend-markup.test.js
git commit -m "style: redesign login as crystal harbor experience"
```

Expected: commit succeeds.

---

### Task 4: Rebuild Booking Into Calendar, Slot, Room Gallery, And Summary Workspace

**Files:**
- Modify: `public/index.html`
- Modify: `public/app.js`

- [ ] **Step 1: Replace booking page markup with reference workspace anchors**

In `public/index.html`, replace the inner content of `#bookingPage` with this structure:

```html
<div id="bookingPage" class="page">
    <div class="booking-command-center booking-page">
        <div class="booking-workspace-header">
            <div>
                <div class="section-eyebrow">新建预订</div>
                <h1 class="page-title">选择会议空间</h1>
            </div>
            <div class="booking-hours-note">可预订时间：08:00-20:00，每次以30分钟为单位。</div>
        </div>

        <div class="room-type-filter booking-type-segment" id="roomTypeFilter" role="group" aria-label="会议室类型">
            <button class="tab-btn active" type="button" data-room-type="normal" onclick="app.setRoomTypeFilter('normal')">会议室</button>
            <button class="tab-btn" type="button" data-room-type="training" onclick="app.setRoomTypeFilter('training')">培训室</button>
            <button class="tab-btn" type="button" data-room-type="vip" onclick="app.setRoomTypeFilter('vip')">VIP室</button>
        </div>

        <div class="booking-workspace-grid">
            <section class="booking-section booking-calendar-panel">
                <div class="booking-section-title"><span>📆</span> 选择日期</div>
                <div class="date-selector" id="dateSelector"></div>
            </section>

            <section class="booking-section booking-time-panel time-selection-area">
                <div class="booking-section-title"><span>⏰</span> 选择时间</div>
                <div class="time-slots-grid time-grid" id="timeGrid"></div>
            </section>
        </div>

        <section class="booking-section booking-room-panel">
            <div class="booking-section-title"><span>🏢</span> 选择会议室</div>
            <div class="room-select-container booking-room-gallery" id="roomSelectContainer">
                <div id="roomSelectList"></div>
            </div>
        </section>

        <section class="booking-section booking-info-panel">
            <div class="booking-section-title"><span>📝</span> 预订信息</div>
            <div class="booking-info-grid">
                <div class="form-group">
                    <label class="form-label">预订用途 *</label>
                    <div class="purpose-options" role="radiogroup" aria-label="预订用途">
                        <label class="purpose-option"><input type="radio" name="bookingPurpose" value="见客" checked><span>见客</span></label>
                        <label class="purpose-option"><input type="radio" name="bookingPurpose" value="招募"><span>招募</span></label>
                        <label class="purpose-option"><input type="radio" name="bookingPurpose" value="培训"><span>培训</span></label>
                        <label class="purpose-option"><input type="radio" name="bookingPurpose" value="讲座"><span>讲座</span></label>
                        <label class="purpose-option"><input type="radio" name="bookingPurpose" value="会议"><span>会议</span></label>
                        <label class="purpose-option"><input type="radio" name="bookingPurpose" value="其他"><span>其他</span></label>
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label" for="bookingAttendeeCount">预计人数 *</label>
                    <input type="number" class="form-input attendee-count-input" id="bookingAttendeeCount" min="1" max="200" value="1" inputmode="numeric" step="1" placeholder="填写人数">
                    <div class="attendee-helper">当前填写：<span id="bookingAttendeeCountValue">1</span> 人</div>
                </div>
            </div>
        </section>

        <div class="booking-summary-bar">
            <div class="booking-summary-item"><span>日期</span><strong id="bookingSummaryDate">请选择日期</strong></div>
            <div class="booking-summary-item"><span>时间</span><strong id="bookingSummaryTime">请选择时间</strong></div>
            <div class="booking-summary-item"><span>会议室</span><strong id="bookingSummaryRoom">请选择会议室</strong></div>
            <div class="booking-summary-item"><span>用途</span><strong id="bookingSummaryPurpose">见客</strong></div>
            <div class="booking-summary-item"><span>人数</span><strong id="bookingSummaryAttendees">1 人</strong></div>
            <button class="submit-btn booking-summary-action" id="submitBookingBtn" onclick="app.submitBooking()" disabled>下一步</button>
        </div>
    </div>
</div>
```

- [ ] **Step 2: Add booking workspace CSS**

Add these rules near the current booking CSS:

```css
.booking-command-center {
    display: grid;
    gap: 18px;
    padding: 28px;
}

.booking-workspace-header {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 16px;
}

.section-eyebrow {
    color: var(--gold-deep);
    font-size: 12px;
    font-weight: 850;
}

.booking-type-segment {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    max-width: 650px;
    margin: 0 auto;
    padding: 6px;
    border-radius: 16px;
}

.booking-workspace-grid {
    display: grid;
    grid-template-columns: minmax(280px, 0.95fr) minmax(420px, 1.25fr);
    gap: 16px;
}

.booking-calendar-panel,
.booking-time-panel,
.booking-room-panel,
.booking-info-panel {
    min-width: 0;
}

.booking-room-gallery .room-select-list,
#roomSelectList {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
    gap: 14px;
}

.room-select-item {
    display: grid;
    gap: 10px;
    overflow: hidden;
}

.room-select-thumbnail {
    height: 118px;
    border-radius: 16px;
    background:
        linear-gradient(145deg, rgba(255,255,255,0.28), rgba(255,255,255,0)),
        linear-gradient(135deg, #d8d2c8, #f7f1e5 48%, #becbd3);
    border: 1px solid rgba(255,255,255,0.68);
}

.booking-info-grid {
    display: grid;
    grid-template-columns: minmax(0, 1.35fr) minmax(220px, 0.65fr);
    gap: 16px;
}

.booking-summary-bar {
    position: sticky;
    bottom: 18px;
    z-index: 20;
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr)) auto;
    gap: 12px;
    align-items: center;
    padding: 14px;
    border-radius: 22px;
    background: rgba(255,255,255,0.78);
    border: 1px solid rgba(255,255,255,0.82);
    box-shadow: 0 22px 58px rgba(84,100,116,0.16), inset 0 1px 0 rgba(255,255,255,0.9);
    -webkit-backdrop-filter: blur(24px) saturate(175%);
    backdrop-filter: blur(24px) saturate(175%);
}

.booking-summary-item {
    min-width: 0;
    display: grid;
    gap: 4px;
}

.booking-summary-item span {
    color: var(--text-secondary);
    font-size: 11px;
    font-weight: 760;
}

.booking-summary-item strong {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--text-primary);
    font-size: 13px;
}

.booking-summary-action {
    min-width: 112px;
}
```

- [ ] **Step 3: Update room selection rendering to include thumbnails**

In `public/app.js`, update `renderRoomSelectList()` item markup to include the thumbnail class required by the test:

```javascript
item.innerHTML = `<div class="room-select-thumbnail" aria-hidden="true"></div><div class="room-select-info"><div class="room-select-name">${room.name} <span style="color:${isVip ? 'var(--vip-gold)' : 'var(--primary-dark)'}">${roomTypeLabel}</span></div><div class="room-select-meta">${room.location || room.floor || ''} · ${room.capacity}人</div></div>${isLocked ? '<span style="color:var(--text-secondary)">🔒</span>' : ''}`;
```

- [ ] **Step 4: Add booking summary helpers**

Add these methods near `updateSubmitButtonState()` in `public/app.js`:

```javascript
getSelectedTimeRangeLabel() {
    if (!this.selectedTimeSlots || this.selectedTimeSlots.length === 0) return '请选择时间';
    const sorted = this.getSortedTimeSlots(this.selectedTimeSlots);
    return `${sorted[0]} - ${this.getEndTime(sorted[sorted.length - 1])}`;
},

updateBookingSummary() {
    const dateEl = document.getElementById('bookingSummaryDate');
    const timeEl = document.getElementById('bookingSummaryTime');
    const roomEl = document.getElementById('bookingSummaryRoom');
    const purposeEl = document.getElementById('bookingSummaryPurpose');
    const attendeesEl = document.getElementById('bookingSummaryAttendees');
    if (dateEl) dateEl.textContent = this.selectedDate || '请选择日期';
    if (timeEl) timeEl.textContent = this.getSelectedTimeRangeLabel();
    if (roomEl) roomEl.textContent = this.selectedRoom?.name || '请选择会议室';
    const purpose = document.querySelector('input[name="bookingPurpose"]:checked')?.value || '见客';
    if (purposeEl) purposeEl.textContent = purpose;
    const attendeeCount = document.getElementById('bookingAttendeeCount')?.value || '1';
    if (attendeesEl) attendeesEl.textContent = `${attendeeCount} 人`;
},
```

- [ ] **Step 5: Wire summary updates into existing state changes**

Update these existing methods in `public/app.js`:

```javascript
updateSubmitButtonState() {
    const btn = document.getElementById('submitBookingBtn');
    if (!btn) return;
    btn.disabled = !(this.selectedRoom && this.selectedDate && this.selectedTimeSlots.length > 0);
    this.updateBookingSummary();
},
```

In `setupBookingAttendeeCountControl()`, replace `const syncValue = () => { value.textContent = input.value; };` with:

```javascript
const syncValue = () => {
    value.textContent = input.value;
    this.updateBookingSummary();
};
```

In `setupBookingAttendeeCountControl()`, add this listener after the input listener:

```javascript
document.querySelectorAll('input[name="bookingPurpose"]').forEach(inputEl => {
    if (inputEl.dataset.summaryBound === 'true') return;
    inputEl.addEventListener('change', () => this.updateBookingSummary());
    inputEl.dataset.summaryBound = 'true';
});
```

- [ ] **Step 6: Add mobile booking CSS**

Add these rules inside the existing `@media (max-width: 768px)` block:

```css
.booking-command-center {
    padding: 16px;
}

.booking-workspace-header,
.booking-info-grid {
    grid-template-columns: 1fr;
    display: grid;
    align-items: start;
}

.booking-workspace-grid {
    grid-template-columns: 1fr;
}

.booking-summary-bar {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    bottom: 84px;
}

.booking-summary-action {
    grid-column: 1 / -1;
    width: 100%;
}
```

- [ ] **Step 7: Run tests**

Run:

```bash
node --test test/frontend-markup.test.js
node --check public/app.js
```

Expected: booking reference tests pass; admin reference tests still fail.

- [ ] **Step 8: Commit booking workspace**

Run:

```bash
git add public/index.html public/app.js
git commit -m "style: rebuild booking workspace with glass summary"
```

Expected: commit succeeds.

---

### Task 5: Reframe Admin Console And Mobile Management Cards

**Files:**
- Modify: `public/index.html`
- Modify: `public/app.js`

- [ ] **Step 1: Add admin console wrapper classes in markup**

In `public/index.html`, change the admin page wrapper from:

```html
<div class="admin-page">
```

to:

```html
<div class="admin-page admin-reference-console">
```

Add a console header before the first admin section:

```html
<div class="admin-console-header">
    <div>
        <div class="section-eyebrow">管理后台</div>
        <h1 class="page-title">空间与用户运营</h1>
    </div>
    <div class="admin-console-status">默认管理员 · 本地预览</div>
</div>
```

Change the stats section opening tag:

```html
<div class="admin-section admin-kpi-strip">
```

Change the tab section opening tag:

```html
<div class="admin-section admin-management-card">
```

Change the admin tabs container:

```html
<div class="admin-tabs admin-console-nav">
```

- [ ] **Step 2: Add admin console CSS**

Add these rules near current admin CSS:

```css
.admin-reference-console {
    display: grid;
    gap: 18px;
}

.admin-console-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    gap: 16px;
}

.admin-console-status {
    padding: 8px 12px;
    border-radius: 999px;
    background: rgba(255,255,255,0.58);
    border: 1px solid rgba(255,255,255,0.72);
    color: var(--text-secondary);
    font-size: 12px;
    font-weight: 760;
}

.admin-kpi-strip {
    padding: 18px;
}

.admin-management-card {
    padding: 18px;
}

.admin-console-nav {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
    padding: 6px;
    border: 1px solid rgba(255,255,255,0.72);
    border-radius: 16px;
    background: rgba(255,255,255,0.42);
}

.admin-console-nav .admin-tab {
    min-height: 42px;
    border-radius: 12px;
}

.admin-action-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
}
```

- [ ] **Step 3: Update admin action button markup in room table and room cards**

In `public/app.js`, update room action button classes in `renderAdminRoomTable()` and `renderAdminRoomCards()`:

```javascript
<button class="admin-action-btn admin-action-icon admin-action-edit" onclick="app.editRoom(${room.id})">编辑</button>
<button class="admin-action-btn admin-action-icon admin-action-danger" onclick="app.confirmDeleteRoom(${room.id})">删除</button>
```

- [ ] **Step 4: Update admin action button markup in user table and user cards**

In `public/app.js`, update user action button classes in `renderAdminUserTable()` and `renderAdminUserCards()`:

```javascript
<button class="admin-action-btn admin-action-icon admin-action-reset" onclick="app.resetUserPassword(${user.id})">重置</button>
<button class="admin-action-btn admin-action-icon admin-action-edit" onclick="app.editUser(${user.id})">编辑</button>
<button class="admin-action-btn admin-action-icon admin-action-toggle" onclick="app.toggleUserActive(${user.id})">${isActive ? '禁用' : '启用'}</button>
${canDelete ? `<button class="admin-action-btn admin-action-icon admin-action-danger" onclick="app.confirmDeleteUser(${user.id})">删除</button>` : ''}
```

- [ ] **Step 5: Add mobile admin console CSS**

Add these rules inside the existing `@media (max-width: 768px)` block:

```css
.admin-console-header {
    display: grid;
    align-items: start;
}

.admin-console-nav {
    grid-template-columns: 1fr;
}

.admin-kpi-strip,
.admin-management-card {
    padding: 14px;
}

.mobile-admin-card {
    border-radius: 20px;
    padding: 16px;
}

.mobile-card-actions {
    grid-template-columns: 1fr 1fr;
}
```

- [ ] **Step 6: Run tests**

Run:

```bash
node --test test/frontend-markup.test.js
node --check public/app.js
```

Expected: admin reference tests pass except any report-specific assertions if Task 6 is not complete.

- [ ] **Step 7: Commit admin console**

Run:

```bash
git add public/index.html public/app.js
git commit -m "style: reframe admin console interactions"
```

Expected: commit succeeds.

---

### Task 6: Refine Reports To Match Glass Reference Style

**Files:**
- Modify: `public/index.html`
- Modify: `public/app.js`

- [ ] **Step 1: Add report glass classes to report markup**

In `public/index.html`, update the reports tab containers:

```html
<div class="report-crystal-hero report-apple-dashboard report-glass-orbit">
```

Update chart cards so key cards include `report-chart-soft`:

```html
<div class="report-card report-card-feature report-card-line report-chart-soft" id="reportDailyTrendChart"></div>
<div class="report-card report-card-donut report-chart-soft" id="reportRoomTypeChart"></div>
<div class="report-card report-card-donut report-chart-soft" id="reportPurposeChart"></div>
```

Update the export toolbar:

```html
<div class="report-export-toolbar report-export-glass" id="reportExportToolbar">
```

- [ ] **Step 2: Add report refinement CSS**

Add these rules near current report CSS:

```css
.report-glass-orbit {
    position: relative;
    overflow: hidden;
}

.report-glass-orbit::after {
    content: "";
    position: absolute;
    right: -90px;
    top: -120px;
    width: 280px;
    height: 280px;
    border-radius: 999px;
    background: radial-gradient(circle, rgba(229,201,131,0.24), rgba(229,201,131,0));
    pointer-events: none;
}

.report-chart-soft {
    background: rgba(255,255,255,0.58);
    border-color: rgba(255,255,255,0.74);
}

.report-export-glass {
    padding: 14px;
    border-radius: 18px;
    background: rgba(255,255,255,0.58);
    border: 1px solid rgba(255,255,255,0.74);
    box-shadow: var(--crystal-shadow-soft);
}

.report-donut-segment {
    stroke-width: 4.8;
    filter: drop-shadow(0 5px 9px rgba(156,123,60,0.1));
}

.report-line-path {
    stroke-width: 2.2;
}

.report-line-point {
    r: 2.5px;
}
```

- [ ] **Step 3: Add `report-chart-soft` to dynamic empty-state report cards**

In `public/app.js`, make sure dynamic ranking/card wrappers do not remove the static `report-chart-soft` class. Do not replace the container element itself. Keep `container.innerHTML = ...` only.

Expected code remains:

```javascript
container.innerHTML = `<div class="report-card-title">${title}</div>...`;
```

- [ ] **Step 4: Ensure line chart points stay thin in generated SVG**

In `public/app.js`, keep point radius small:

```javascript
<circle class="report-line-point" cx="${point.x.toFixed(1)}" cy="${point.y.toFixed(1)}" r="3">
```

Expected: this remains compatible with the existing test and the CSS keeps the chart visually light.

- [ ] **Step 5: Run tests**

Run:

```bash
node --test test/frontend-markup.test.js
node --check public/app.js
```

Expected: all frontend static tests pass.

- [ ] **Step 6: Commit report refinement**

Run:

```bash
git add public/index.html public/app.js
git commit -m "style: refine report dashboard glass visuals"
```

Expected: commit succeeds.

---

### Task 7: Full Verification And Browser Checks

**Files:**
- No planned source edits unless verification reveals a defect.

- [ ] **Step 1: Run full project tests**

Run:

```bash
node --run test
```

Expected: PASS.

- [ ] **Step 2: Run syntax and whitespace checks**

Run:

```bash
node --check public/app.js
git diff --check
```

Expected: both commands exit with code 0.

- [ ] **Step 3: Verify desktop layout in browser**

Open the local file URL:

```text
file:///Users/todd/Documents/New%20project/aia%E4%BC%9A%E8%AE%AE%E5%AE%A4/.worktrees/meeting-room-v2-core/public/index.html
```

Use a desktop viewport around `1440x960`. Click login. Verify:

```text
登录页: Hong Kong harbor background visible, UTOPIA brand bar visible, ISO hero centered, login card glassy.
预订页: calendar and time grid are side by side, room gallery appears, bottom summary is compact.
后台页: KPI cards and management tabs look like the reference, action buttons are compact.
报表页: line/donut/ranking cards are thin glass style with no overlap.
```

- [ ] **Step 4: Verify mobile layout in browser**

Use a mobile viewport around `390x844`. Click login. Verify:

```text
登录页: card fits without horizontal scrolling.
预订页: sections stack vertically and sticky summary does not cover the bottom navigation.
后台页: room and user management show mobile cards and action buttons are easy to tap.
报表页: charts stack vertically and text does not overlap.
```

- [ ] **Step 5: Capture final status**

Run:

```bash
git status --short --branch
git log --oneline -6
```

Expected: working tree is clean after any final fixes are committed.

- [ ] **Step 6: Push branch**

Run:

```bash
TOKEN=$(tr -d '\r\n' < ~/.config/codex/github_token)
AUTH=$(printf 'x-access-token:%s' "$TOKEN" | base64)
git -c http.extraHeader="Authorization: Basic $AUTH" -c http.version=HTTP/1.1 -c http.postBuffer=157286400 push origin HEAD:codex/meeting-room-v2-core
```

Expected: push succeeds without printing the token.
