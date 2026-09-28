# Backend API – UniPal MIT

This Express API powers the UniPal MIT platform for MAHE's Manipal Institute of Technology. It exposes role-aware routes for deans (super admins), administrators, coordinators, and attendees.

## Setup

1. Install dependencies
   ```bash
   npm install
   ```

2. Copy the sample environment file and update values:
   ```bash
   cp ENV.EXAMPLE .env
   ```
   | Variable        | Description                                                |
   |-----------------|------------------------------------------------------------|
   | `MONGO_URI`     | Connection string for MongoDB (Atlas or local instance).   |
   | `JWT_SECRET`    | Secret key for signing auth tokens.                        |
   | `PORT`          | Optional port override (defaults to `5050`).               |

3. Run the server
   ```bash
   npm run dev   # nodemon development server
   # or
   npm start     # production server
   ```

The API automatically enables CORS for Vite’s dev servers on `localhost:5173`/`5174`.

## Key Collections

- **User** – supports multiple super admins (deans), admins, coordinators, and students. Optional `school`, `department`, and `designation` fields tailor users to the MIT campus context.
- **Event** – stores invitation mode, self-check-in rules, assigned coordinators, approval metadata (status, reviewer, notes), agenda items, key contacts, and immutable reports when finalised.
- **EventInvitation** – tracks invitations, statuses (pending/accepted/declined/revoked), and the inviter for audit purposes.
- **Feedback** – captures post-event ratings with enforced attendance validation.

## Highlighted Endpoints

| Method & Path | Role Access | Purpose |
|---------------|-------------|---------|
| `POST /api/events` | Admins & Deans | Create events with coordinator assignments. |
| `POST /api/events/:id/invitations` | Coordinators/Admins/Deans | Invite participants by `userId` or email. |
| `POST /api/events/:id/attendance/code` | Event managers | Issue a 5-minute QR attendance code. |
| `POST /api/events/:id/attendance/check-in` | Authenticated users | Validate QR tokens and mark attendance. |
| `POST /api/events/:id/finalize` | Event managers | Close an event, persist report stats, and email deans. |
| `POST /api/events/:id/approval` | Deans | Approve or reject events with notes (auto-updates lifecycle). |
| `GET /api/events/stats/superadmin/overview` | Deans | Aggregated metrics for pending approvals, attendance, and department performance. |

For full implementation details explore `src/controllers/eventController.js` and the accompanying route files in `src/routes/`.

## Testing

This project currently relies on manual verification. Recommended checks:

1. **Invitation flow** – issue invites to a coordinator and a student. Accept/refuse via the frontend and confirm status updates via `GET /api/events/:id/invitations`.
2. **Attendance flow** – generate a QR code, perform a check-in using the token, and verify the attendee appears in the `attendance` list.
3. **Reporting** – finalise an event and confirm that dean accounts receive the stubbed email notification (console log while `emailService` is mocked).

Extend with automated tests (Jest / supertest) as the domain evolves.
