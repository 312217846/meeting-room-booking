# UX Dashboard Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix PMagic footer rendering, limit booking hours to 08:00-20:00, polish admin actions, and add a responsive admin report dashboard.

**Architecture:** Keep the current Express/static frontend shape. Centralize business-hour constants in `src/constants.js`, enforce them in `src/bookingRules.js`, mirror them in `public/app.js`, and extend the current reports UI without adding database tables.

**Tech Stack:** Node.js, Express, MySQL queries, static HTML/CSS/JavaScript, Node built-in `node:test`.

---

### Task 1: Booking Hours

**Files:**
- Modify: `src/constants.js`
- Modify: `src/bookingRules.js`
- Modify: `public/app.js`
- Test: `test/bookingRules.test.js`
- Test: `test/frontend-markup.test.js`

- [ ] Add `BOOKING_START_MINUTES = 8 * 60`, `BOOKING_END_MINUTES = 20 * 60`, and `BOOKING_SLOT_MINUTES = 30`.
- [ ] Add `isWithinBookingHours(startTime, endTime)` and use it inside `validateBookingInput`.
- [ ] Update frontend `generateTimeSlots()` to generate only 08:00 through 19:30.
- [ ] Add tests for valid 08:00-20:00 bookings and invalid outside-hours bookings.

### Task 2: PMagic Footer And Booking Layout

**Files:**
- Modify: `public/index.html`
- Test: `test/frontend-markup.test.js`

- [ ] Replace the cramped full-logo footer with a compact `.pmagic-mark` plus text label.
- [ ] Add desktop booking layout classes so the first two booking sections sit in a left column and time/info/submit sit in a right column.
- [ ] Keep mobile as a single-column flow.

### Task 3: Admin Action Styling

**Files:**
- Modify: `public/index.html`
- Modify: `public/app.js`
- Test: `test/frontend-markup.test.js`

- [ ] Add `.admin-action-group`, `.admin-action-btn`, `.admin-action-edit`, `.admin-action-toggle`, `.admin-action-reset`, and `.admin-action-danger`.
- [ ] Render room and user table actions with the new classes.
- [ ] Keep dangerous delete actions visually distinct and easy to tap.

### Task 4: Reports Dashboard

**Files:**
- Modify: `server.js`
- Modify: `public/index.html`
- Modify: `public/app.js`
- Test: `test/serverRoutes.test.js`
- Test: `test/frontend-markup.test.js`

- [ ] Extend `/api/admin/reports` with `activeUsers`, `activeRooms`, `peakDay`, and normalized totals.
- [ ] Replace the simple report tab with a filter header, KPI cards, dashboard cards, trend bars, and export toolbar.
- [ ] Render rankings and empty states with existing report arrays.
- [ ] Add static tests for dashboard IDs and server tests for new response fields.

### Task 5: Verification And Publish

**Files:**
- No new code files.

- [ ] Run `node --run test`.
- [ ] Run `git diff --check`.
- [ ] Capture local browser screenshots for desktop and mobile-ish widths.
- [ ] Commit and push to `codex/meeting-room-v2-core`.
