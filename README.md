# UniPal MIT Event Management Platform

UniPal MIT is a role-aware event management suite for MAHE's Manipal Institute of Technology. The monorepo couples a React (Vite) client with an Express + MongoDB API to help deans, coordinators, and students orchestrate campus events, attendance, and follow-up reporting.

## Repository Layout

| Path | Description |
| --- | --- |
| `event-management-backend/` | Express API, MongoDB models, and role-based REST endpoints. |
| `event-management-frontend/` | Vite + React application with shadcn/ui components and React Query. |

Both subdirectories ship with their own `README.md` files for deeper dives into implementation details.

## Tech Stack

- **Frontend:** React 18, Vite, TypeScript, shadcn/ui (Radix primitives), Tailwind CSS, React Query.
- **Backend:** Node.js, Express 5, MongoDB with Mongoose, JWT auth, Google OAuth (optional).
- **Tooling:** ESLint, Tailwind, nodemon, lucide-react icons.

## Prerequisites

- Node.js 18 or later (tested with modern LTS releases).
- npm (bundled with Node) or a compatible package manager.
- MongoDB instance (local or Atlas) reachable from your development machine.

## Initial Setup

1. Clone or unzip the repository and `cd` into the project root (`PDC-main`).
2. Install dependencies for both workspaces:

   ```bash
   cd event-management-backend
   npm install

   cd ../event-management-frontend
   npm install
   ```

3. Configure backend environment variables:

   ```bash
   cp event-management-backend/ENV.EXAMPLE event-management-backend/.env
   ```

   | Variable | Purpose |
   | --- | --- |
   | `MONGO_URI` | Connection string for your MongoDB deployment. |
   | `JWT_SECRET` | Secret for signing JSON Web Tokens. |
   | `PORT` | Optional port override (defaults to `5050`). |
   | `GOOGLE_CLIENT_ID` | Needed only if enabling Google OAuth login. |

4. (Optional) Bootstrap a dean account so you can sign in immediately:

   ```bash
   cd event-management-backend
   node src/scripts/createSuperAdmin.js
   ```

   The script creates a dean user (`admin@unievents.com / superadmin123`). Change the password after first login.

## Running the Project Locally

Launch the API and frontend in separate terminals from the repository root:

```bash
# Terminal 1 – backend API on http://localhost:5050
cd event-management-backend
npm run dev

# Terminal 2 – frontend on http://localhost:5173
cd event-management-frontend
npm run dev
```

Set `VITE_API_URL` in `event-management-frontend/.env` if the backend runs on a non-default host/port.

## Useful npm Scripts

| Location | Script | Description |
| --- | --- | --- |
| `event-management-backend` | `npm run dev` | Start Express with nodemon reloads. |
|  | `npm start` | Launch API in production mode. |
| `event-management-frontend` | `npm run dev` | Vite dev server with hot module reloading. |
|  | `npm run build` | Production bundle output to `dist/`. |
|  | `npm run preview` | Preview the production build locally. |
|  | `npm run lint` | Lint the frontend codebase. |

## Feature Highlights

- **Deans / Super Admins** approve events, manage users, review invitations, and finalise reports that summarise attendance plus feedback metrics.
- **Coordinators** create events, invite students or co-coordinators, and generate short-lived QR codes for attendance tracking and Google Form distribution.
- **Students and general attendees** accept invitations, mark attendance via QR scan or manual code entry, and submit feedback once participation is verified.
- **Admins** gain visibility into global events and can seed new coordinators when needed.

Role-specific dashboards in the frontend surface the workflows above while the backend enforces access through middleware such as `authMiddleware` and `roleMiddleware`.

## Testing & Verification Tips

- Use the **Coordinator Dashboard** to invite yourself (or a second account) to an event, then accept via the **Student Dashboard** to validate the invitation lifecycle.
- Generate an attendance QR code and use the built-in scanner to simulate check-ins; the backend prevents duplicate marking and enforces invitation rules.
- Finalise an event from the dean view to confirm that summary emails (logged by the mock `emailService`) and report metadata are populated.

Automated tests are not yet included; consider adding Jest + supertest (backend) and React Testing Library (frontend) as future work.

## Additional Documentation

- Backend reference: [`event-management-backend/README.md`](event-management-backend/README.md)
- Frontend reference: [`event-management-frontend/README.md`](event-management-frontend/README.md)

These files drill deeper into API endpoints, UI flows, and directory structures for their respective halves of the project.

