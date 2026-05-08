# Meeting Room V2 Core Design

## Goal

Build the first production-ready V2 upgrade for the meeting room and training room booking system while keeping the current Express, MySQL, and single-page frontend architecture. This phase focuses on the core business rules from `会议室预订系统需求列表V2.docx`: Hong Kong phone login, Utopia branding, room-type permissions, user import and management, daily booking limits, conflict prevention, booking visibility, and reports.

## Confirmed Product Decisions

- Users can still self-register.
- Admins can also create or import users.
- Imported users use their Hong Kong phone number as both login name and initial password.
- Login uses Hong Kong mobile numbers with the `+852` cue; WeChat login is removed from the UI.
- Self-registered users are active by default and can book only normal meeting rooms until an admin grants more permissions.
- Room permissions are controlled by room type: `training`, `vip`, and `normal`.
- A user may have one or more room-type permissions.
- The old `role` field remains for system role and admin access, but it no longer controls VIP booking by itself.
- Each user has a configurable daily booking limit. The default is 180 minutes across all rooms combined.
- A user cannot book two rooms at overlapping times.
- Bookings can be made 24 hours a day and up to 365 days in advance.
- A disabled user cannot make new bookings, and disabling a user cancels their future confirmed bookings while preserving historical records.
- The Utopia logo image provided by the user will replace the current AIA logo.

## Scope

### In Scope

- Update login and registration for Hong Kong phone numbers.
- Replace login title with `会议室、培训室预订系统`.
- Add the address line `尖沙咀 港威大廈 5座26樓2601室` to the login page.
- Replace AIA branding assets in the app chrome with the supplied Utopia logo.
- Add room type management for Training room, VIP meeting room, and normal meeting room.
- Add per-user room-type booking permissions.
- Add per-user daily booking limit in minutes.
- Add user profile fields: English name, last name, region, group name, and phone.
- Add user search by name, phone, region, and group name.
- Add user edit, enable/disable, reset password, CSV upload import, and pasted table import.
- Show booker details on occupied slots: region, group name, English name, and last name.
- Change booking purpose from free-text meeting title to a single-choice purpose: `见客`, `招募`, `培训`, `讲座`, `会议`, `其他`.
- Change attendee count to a 1-200 slider.
- Enforce daily total booking limit, overlapping personal booking prevention, room occupancy prevention, room capacity, valid purpose, valid attendee count, active user status, room-type permission, and 365-day booking horizon on the server.
- Keep all booking history and enhance reports for room usage, employee usage, detail export, and visual ranking.

### Out of Scope For This Phase

- Rebuilding the frontend as a new framework application.
- Replacing MySQL with another database.
- Building a full audit dashboard beyond the existing operation log and report exports.
- Implementing email or SMS password recovery. Password recovery remains admin reset.
- Complex Excel parsing with formulas or multi-sheet import. The first implementation supports CSV upload and pasted tabular text.

## Architecture

The project keeps its current structure:

- `server.js` remains the Express API and database initialization entrypoint.
- `public/index.html` remains the main UI shell and CSS source.
- `public/app.js` remains the single-page frontend controller.
- `database/schema.sql` is updated to document the V2 schema for fresh installs.
- A supplied Utopia logo is copied into `public/img/utopia-logo.png`.
- A focused test layer is added around backend business rules using a test runner that can exercise extracted validation helpers without needing a live MySQL server for every rule.

This approach deliberately avoids a large rewrite. The existing app is small enough that a targeted upgrade is safer and faster than splitting the whole codebase in this phase.

## Data Model

### `users`

Add these columns while preserving current rows:

- `english_name VARCHAR(100)`
- `last_name VARCHAR(100)`
- `region VARCHAR(100)`
- `group_name VARCHAR(100)`
- `booking_permissions JSON`
- `daily_booking_limit_minutes INT DEFAULT 180`
- `is_active BOOLEAN DEFAULT TRUE` when missing from older schemas

`booking_permissions` stores an array of room-type strings. A self-registered user defaults to `["normal"]`. Admins can grant any combination of `normal`, `training`, and `vip`.

### `meeting_rooms`

Add:

- `room_type ENUM('normal', 'training', 'vip') DEFAULT 'normal'`

The legacy `is_vip` column remains for compatibility. When reading old rows, `is_vip = TRUE` maps to `room_type = 'vip'`; otherwise it maps to `normal`.

### `bookings`

Reuse existing columns:

- `title` stores booking purpose.
- `attendee_count` stores the slider value from 1 to 200.

The server validates that `title` is one of the allowed purpose values and `attendee_count` is within range.

### `system_config`

Store defaults:

- `default_daily_booking_limit_minutes = 180`
- `booking_max_days = 365`
- `booking_purposes = ["见客","招募","培训","讲座","会议","其他"]`

## Backend Behavior

### Authentication

- Login and registration accept normalized Hong Kong phone numbers.
- UI displays `+852`; server stores a consistent phone value and rejects unsupported formats.
- WeChat auth routes may remain unused for compatibility, but the frontend no longer exposes WeChat login.
- Login rejects inactive users.

### User Management

Admins can:

- Search users by English name, last name, display name, phone, region, and group name.
- Edit user profile fields, room-type permissions, role, active status, and daily limit.
- Disable a user. Disabling cancels future confirmed bookings by that user and records who performed the action.
- Reset password. Resetting to a phone number is allowed for imported users, but the reset endpoint also supports an explicit new password.
- Import users by CSV file upload or pasted tabular text.

Import columns:

- `english_name`
- `last_name`
- `region`
- `group_name`
- `phone`
- `level`

The import maps `level` to booking permissions using a simple default mapping:

- `normal`: `["normal"]`
- `training`: `["normal","training"]`
- `vip`: `["normal","vip"]`
- `all` or `admin`: `["normal","training","vip"]`

Rows with existing phone numbers update the existing user profile instead of creating duplicates.

### Room Management

Admins can set:

- Name
- Capacity
- Location
- Equipment
- Active status
- Room type

Room type drives booking permission checks and frontend filtering.

### Booking Rules

The server enforces all core rules:

- User must be active.
- Room must be active.
- User must have permission for the room type.
- Booking date must be today or later.
- Booking date must be no more than 365 days from today.
- Start time must be before end time.
- Booking may be any time from `00:00` through `24:00` in 30-minute increments.
- Room cannot have a confirmed overlapping booking.
- User cannot have a confirmed overlapping booking in another room.
- User cannot exceed their daily total booking limit across all rooms.
- Purpose must be one of the allowed values.
- Attendee count must be from 1 to 200 and cannot exceed room capacity.

### Reports

Reports include:

- Room booking count and total hours.
- Employee booking count and total hours.
- Daily trend for the selected month.
- Historical booking detail export.

Reports use retained booking history and do not delete cancelled or completed records. Exports include room type and user region/group fields where useful.

## Frontend Behavior

### Login Page

- Display supplied Utopia logo.
- Title: `会议室、培训室预订系统`.
- Subtitle/address: `尖沙咀 港威大廈 5座26樓2601室`.
- Phone input visually cues `+852`.
- Remove WeChat login button and WeChat modal entry points.
- Keep self-registration entry.

### Main App

- After login, default tab is booking.
- Navigation can still include rooms, my bookings, and admin for discoverability.
- Labels use `预订` as the primary action.

### Booking Page

- Add room-type segmented control.
- Show only rooms the current user may book as selectable; locked rooms may be visible but clearly disabled if useful.
- Date selector allows up to one year.
- Time grid covers 24 hours.
- Occupied slots show booker details: region, group, English name, last name.
- Booking form uses purpose radio buttons and attendee-count slider.
- Submit button remains disabled until room, date, time, purpose, and attendee count are valid.

### Admin Page

Room management shows and edits room type.

User management adds:

- Search field.
- Profile columns for region and group.
- Permission checkboxes.
- Daily limit input.
- Enable/disable action.
- Reset password action.
- Import panel for CSV upload and pasted table content.

Reports show visual bar rankings for rooms and employees, with export buttons for room, user, and booking-detail CSV files.

## Error Handling

- API responses continue using `{ code, message, data }`.
- Validation errors return `400`.
- Permission errors return `403`.
- Missing records return `404`.
- Server errors return `500` with a concise message.
- Import returns row-level failures so admins can fix bad data without guessing.
- Frontend toasts and modals surface actionable messages, such as `该用户今日预订总时长已超过 3 小时`.

## Testing Strategy

Add backend-focused tests first, then implement to satisfy them. Tests cover:

- Hong Kong phone normalization and validation.
- Default permissions for self-registration.
- Import parsing for CSV and pasted tables.
- Room-type permission checks.
- Inactive user login and booking rejection.
- Disabling a user cancels future confirmed bookings and preserves past bookings.
- Daily total booking limit across all rooms.
- User overlapping booking prevention.
- Room overlapping booking prevention.
- 365-day booking horizon.
- Purpose and attendee-count validation.
- Report aggregation shape for room and user usage.

Manual frontend verification covers:

- Login page branding and phone UI.
- Booking tab as post-login default.
- Room type filtering and locked-room behavior.
- 24-hour time grid.
- Purpose radio buttons and attendee slider.
- Admin user search, edit, import, disable, and reset password flows.
- Admin room type editing.
- Report visual rankings and exports.

## Acceptance Criteria

- A new user can self-register with a Hong Kong phone number and book only normal rooms by default.
- An admin can import users from CSV and pasted tabular data.
- An admin can grant room-type permissions and set a daily booking limit per user.
- A user without permission cannot book training or VIP rooms.
- A user cannot exceed their daily total booking limit across all rooms.
- A user cannot book overlapping times in different rooms.
- Occupied slots show booker region, group, English name, and last name.
- Disabling a user cancels future confirmed bookings and frees those rooms.
- Historical bookings remain available for reports and export.
- The login page and app chrome no longer show AIA branding.
- The Utopia logo, required title, and address appear on the login page.
- Reports show room and employee booking counts visually and export CSV data.
