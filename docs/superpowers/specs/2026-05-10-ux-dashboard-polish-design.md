# UX Dashboard Polish Design

## Goal

Improve the meeting room system after the white crystal theme by fixing the PMagic footer, narrowing booking time to normal office hours, polishing admin actions, and turning data reports into a responsive dashboard.

## Scope

- The booking window is 08:00 to 20:00, in 30-minute slots. Users can select a final 19:30 slot ending at 20:00. Frontend and backend must reject anything outside this window.
- The desktop booking page should avoid long stretched booking information. The layout should show room/date on the left and time/info/submit on the right, with compact form controls.
- Admin room and user tables keep the existing data model, but actions become a consistent button group with visual priorities for edit, enable/disable, reset, and delete.
- Reports become a dashboard inside the existing admin reports tab. It must support month navigation, core KPI cards, room/user/purpose rankings, daily trend, export controls, and responsive desktop/mobile layouts.
- PMagic footer uses a compact mark plus text so the logo no longer appears cramped or broken.

## Architecture

Keep the current static HTML/CSS/JavaScript frontend and Express backend. Add shared booking-hour constants to `src/constants.js` and use them in `src/bookingRules.js`, `public/app.js`, and static tests. Extend the existing `/api/admin/reports` response with dashboard summary fields derived from the already queried report data.

## Acceptance Checks

- Tests cover the 08:00-20:00 booking window and reject 07:30, 20:00-20:30, and 19:30-20:30.
- Frontend static tests find the dashboard containers, export toolbar, action button classes, and improved PMagic footer.
- Full `node --run test` passes.
- Browser preview shows desktop reports/dashboard and booking page without stretched form layout.
