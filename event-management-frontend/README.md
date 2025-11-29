# UniPal MIT – MAHE Manipal Institute of Technology

UniPal MIT is the internal event management platform tailored for MAHE's Manipal Institute of Technology. The platform models the real-world hierarchy on campus:

- **Deans (super admins)** plan departmental events, assign coordinating faculty, and receive automated reports.
- **Coordinators** handle event execution, invite attendees, generate secure QR codes for attendance, and submit post-event notes.
- **Students and faculty attendees** accept invitations, scan QR codes to mark attendance, and provide feedback.

The project is split into a React + Vite frontend (`event-management-frontend`) and an Express + MongoDB backend (`event-management-backend`).

---

## Project Structure

```
PDC-main/
├── event-management-backend/   # Express API and MongoDB models
└── event-management-frontend/  # React (Vite) client
```

---

## Quick Start

1. **Install dependencies**
   ```bash
   cd event-management-backend
   npm install

   cd ../event-management-frontend
   npm install
   ```

2. **Configure backend environment**
   - Copy `event-management-backend/ENV.EXAMPLE` to `.env` and update MongoDB credentials plus `JWT_SECRET`.

3. **Run the backend API**
   ```bash
   cd event-management-backend
   npm run dev
   ```
   The API defaults to `http://localhost:5050`.

4. **Run the frontend**
   ```bash
   cd event-management-frontend
   npm run dev
   ```
   Vite serves the client at `http://localhost:5173` and proxies API calls to the backend via `VITE_API_URL` (default `http://localhost:5050`).

---

## Role-Based Workflow

### Deans (Super Admins)
- Create and manage user accounts for coordinators, admins, and other deans.
- Schedule events with school/department metadata, format, delivery mode, and assign multiple coordinators during creation.
- Review and disposition pending event approvals with contextual notes for coordinating teams.
- Monitor live invitation status, attendance, and top-performing departments through dean analytics.
- Finalise events with optional notes. A consolidated attendance and feedback report is automatically emailed to all deans.

### Coordinators
- View a dashboard summarising assigned events, attendance counts, and outstanding approval items.
- Manage invitations: paste a list of campus email addresses, choose invite role (attendee or co-coordinator), and send invitations directly from the app.
- Regenerate secure, short-lived attendance QR codes only after dean approval to avoid premature circulation.
- Review attendee lists in real time as scans/check-ins happen.

### Students & Invitees
- View pending invitations, accept or decline them, and see confirmed attendance in their dashboard.
- Scan QR codes (or paste the URL) to mark attendance. A valid attendance code is required to prevent spoofing.
- Provide feedback after attending; only attendees that successfully checked in can submit ratings/comments.

---

## Attendance & Reporting

1. Coordinators click **QR Code** to generate a new check-in code (valid for 5 minutes). The QR encodes `/attendance/:eventId?code=...`.
2. Students scan the QR (camera or manual entry). The frontend calls `POST /api/events/:id/attendance/check-in` with the code, validating they were invited or pre-registered.
3. Feedback submission is restricted to users recorded in the attendance list.
4. When the event concludes, coordinators (or deans) open **Finalize & Report** to add closing notes. Attendance totals, unique check-ins, and average feedback rating are emailed to all deans.

## Analytics & Insights

- Dean overview surfaces pending approvals, upcoming approved events, cumulative attendance, and a leaderboard of departments by engagement.
- Recent events feed provides quick access to the latest submissions with their approval status.
- Coordinators receive inline alerts for events awaiting approval so they know when QR tooling unlocks.

---

## API Highlights

- `POST /api/events` (admin/dean): create events with invitation mode, check-in policy, and coordinator assignments.
- `POST /api/events/:id/invitations` (coordinator/admin/dean): invite users by `userId` or `email`.
- `POST /api/events/:id/attendance/code` (event managers): issue a time-bound QR token.
- `POST /api/events/:id/attendance/check-in` (authenticated users): validate QR scans and mark attendance.
- `POST /api/events/:id/finalize` (event managers): close out an event and trigger dean report emails.

Refer to the backend source for the full set of routes and validation logic.

---

## Development Commands

Frontend:

```bash
cd event-management-frontend
npm run dev      # start Vite dev server
npm run build    # production build
npm run lint     # lint (if configured)
```

Backend:

```bash
cd event-management-backend
npm run dev      # start Express with nodemon
npm start        # run with Node
```

---

## Next Steps

- Configure MongoDB Atlas or local MongoDB and update `.env` accordingly.
- Provision dean/coordinator accounts via the Dean Dashboard once logged in as an existing dean.
- Extend the invitation view to include RSVP responses or seat limits if needed for larger events.

Happy organising across MAHE's Manipal Institute of Technology! 🎓
