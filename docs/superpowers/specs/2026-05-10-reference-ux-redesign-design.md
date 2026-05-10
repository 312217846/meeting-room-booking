# Reference UX Redesign Design

## Goal

Redesign the meeting room booking system to closely follow the provided white crystal UTOPIA reference image while preserving the existing business behavior. The visual direction is option A from the brainstorm preview: a premium Apple-like white glass interface, restrained gold accents, strong UTOPIA/ISO branding, and a Hong Kong city harbor login background.

## Confirmed Direction

- Use the reference image as the primary UX and visual guide.
- Keep the current static `public/index.html` and `public/app.js` single-page app architecture.
- Keep the local/file preview behavior where clicking login immediately enters as the default administrator.
- Keep booking hours at 08:00-20:00 in 30-minute increments.
- Keep purpose selection as gold-accented choices.
- Keep attendee count as a direct numeric input.
- Keep the existing PMagic AI powered footer, but ensure it remains visually integrated with the new white crystal style.

## Scope

### Login Page

- Replace the current centered login layout with a full-viewport brand login scene.
- Use a Hong Kong city harbor or city sea-view image as the background. Prefer a generated local asset to avoid copyright, hotlinking, or image disappearance.
- Add a top brand bar with the UTOPIA logo and a language selector.
- Make the ISO/UTOPIA seal a clear first-screen visual anchor.
- Use a glass login card with phone and password inputs, remember-me, forgot-password copy, a gold login button, and an alternate verification-code login button.
- Remove or de-emphasize self-registration in favor of an admin-opened account message, matching the current product decision that public self-registration should not be prominent.
- Keep the login input IDs and login button behavior compatible with `app.handleLogin()`.

### Booking Page

- Restructure the booking tab into a reference-style booking workspace:
  - top product navigation remains available for desktop and mobile;
  - a segmented room-type switch for meeting room, training room, and VIP room;
  - a calendar block for date selection;
  - a time-slot grid from 08:00 to 20:00;
  - room cards with image-like thumbnails, capacity, equipment, and selected state;
  - a compact booking summary bar with selected date, time range, room, purpose, attendee count, and primary action.
- Avoid the current desktop problem where booking information stretches too long.
- Preserve contiguous time-slot selection and disabled occupied/past slot behavior.
- Preserve existing element IDs used by the JavaScript controller where possible.

### Admin And Reports

- Reframe admin as a white crystal management console:
  - clearer admin header;
  - glass KPI cards;
  - left or tab-like management navigation that feels close to the reference design;
  - lighter, icon-like action buttons for edit, delete, reset, enable, and disable;
  - mobile cards for room and user management with large touch targets.
- Keep the reports tab as the data-dashboard entry point.
- Make report charts thinner and more refined:
  - translucent glass chart cards;
  - thin daily trend curve;
  - donut/pie-style room type and purpose charts;
  - ranking rows with subtle bars;
  - export controls that match the same gold-accented UI language.
- Preserve existing report data keys and preview report data.

## Architecture

The implementation should remain a targeted frontend upgrade:

- `public/index.html` owns the new markup anchors and CSS polish.
- `public/app.js` continues to own data rendering, login flow, booking rules, and report rendering.
- `public/img/` stores the generated Hong Kong harbor background and any new local visual assets.
- `test/frontend-markup.test.js` is extended first to lock in the new UX anchors and prevent regressions.

No database schema changes are required for this redesign.

## Component Boundaries

### Login Shell

The login shell contains the background image layer, brand bar, ISO hero block, login glass card, and powered footer. It must work before app state is initialized and must not depend on authenticated data.

### Booking Workspace

The booking workspace contains room type, calendar, room choices, time slots, booking information, and the sticky/compact summary. It consumes existing app state:

- `selectedRoom`
- `selectedDate`
- `selectedTimeSlots`
- selected purpose radio value
- `bookingAttendeeCount`

The existing submit path remains `app.submitBooking()`.

### Admin Console

The admin console wraps existing admin tabs and data tables in a more refined layout. It should not change API payload shapes. Mobile cards remain generated from `renderAdminRoomCards()` and `renderAdminUserCards()`.

### Report Dashboard

The report dashboard remains rendered from `renderReportDashboard()` and helper chart methods. Styling and markup can improve, but data aggregation should continue to use the existing report response and preview data.

## Data Flow

Login flow stays unchanged:

1. User clicks login.
2. Local/file preview calls the default admin preview path.
3. Normal environments call the existing API login flow.
4. On success, `handleLoginSuccess()` shows the main app and initializes rooms, bookings, admin data, and reports as needed.

Booking flow stays unchanged:

1. User selects room type, room, date, and time slots.
2. UI updates the summary and submit disabled state.
3. `submitBooking()` validates purpose, attendee count, permissions, room, and contiguous slots.
4. API or preview data handles booking creation.

Report flow stays unchanged:

1. Admin opens reports.
2. `loadReportData()` fetches or builds preview data.
3. Dashboard helpers render cards, charts, rankings, and export actions.

## Error Handling

- If the generated background image fails to load, the login page should still show a soft city-harbor-like gradient fallback.
- If no room is selected, time slots continue to show an instructional placeholder.
- If report data is empty, chart cards should show an empty state instead of broken shapes.
- If mobile viewport is narrow, admin table content should prefer card interactions over horizontal scrolling where practical.

## Testing

Tests should be updated before implementation to cover:

- login reference-layout anchors, including brand bar, language selector, ISO hero, glass login card, and local harbor background asset reference;
- absence of a prominent public registration CTA on the login card;
- booking workspace anchors for calendar/time/room-card/summary layout;
- continued 08:00-20:00 booking-hour hooks;
- admin console anchors for white crystal KPI cards, management navigation, refined action buttons, and mobile card lists;
- report dashboard anchors for thin trend, donut charts, rankings, and export controls;
- preview login still creates an admin user.

Manual verification should include:

- desktop browser check around 1440px wide;
- mobile browser check around 390px wide;
- login click enters default administrator in local/file preview;
- booking page remains usable after selecting room, date, time, purpose, and attendee count;
- admin reports render charts without overlap.

## Acceptance Criteria

- The UI clearly resembles the provided white crystal UTOPIA reference across login, booking, and admin pages.
- The login page uses a local Hong Kong harbor/city sea-view visual asset or equivalent generated asset.
- Login preview remains one-click accessible for local/file testing.
- Booking only exposes the 08:00-20:00 office-hour slot range.
- Desktop booking no longer has a long stretched booking-information form.
- Mobile admin room and user management are comfortable to operate with touch.
- Data reports feel visually integrated with the same glass/gold style and include daily trend, donut charts, rankings, and exports.
- Static tests and the project test command pass.
- Browser verification confirms desktop and mobile layouts do not have obvious overlap or broken empty areas.
