# Job Tracker

Track job applications with a React interface and an Express/PostgreSQL API. Users register or sign in, then manage their own applications across Applied, Interview, Offer and Rejected statuses.

## Architecture

- `frontend/src/JobTracker.jsx`: React 19 interface, Axios requests and authentication state.
- `backend/index.js`: Express 5 API, bcrypt password hashing, JWT authentication and parameterised SQL.
- `backend/schema.sql`: users and applications, foreign keys and an index for each user's application history.

The backend is JavaScript. This repository does not implement a TypeScript backend, MVC layers or live multi-user updates.

## Run locally

Requires Node.js 22.12+ and PostgreSQL 16. Create a dedicated local database:

```sh
createdb job_tracker
psql -d job_tracker -v ON_ERROR_STOP=1 -f backend/schema.sql
cd backend
npm ci
cp .env.example .env
openssl rand -hex 32
```

Put the generated value in `JWT_SECRET` in `backend/.env`, and set `DATABASE_URL` to your local PostgreSQL connection. A signing secret of at least 32 characters is required; there is no shared fallback.

```sh
npm run dev
```

In a second terminal, from the repository root:

```sh
cd frontend
npm ci
cp .env.example .env
npm run dev
```

Open http://localhost:5173. The API defaults to http://localhost:3000. Set `VITE_API_URL` before building the frontend for another environment.

## API

| Method | Route | Purpose |
| --- | --- | --- |
| POST | `/auth/signup` | Register with email and password; returns a user and JWT |
| POST | `/auth/login` | Sign in; returns a user and JWT |
| GET/POST | `/jobs` | List or create the signed-in user's applications |
| GET/PUT/DELETE | `/jobs/:id` | Read, replace or delete an owned application |

Job requests use `company`, `role`, `status`, `date_applied` (YYYY-MM-DD), and optional `notes`. Protected routes require `Authorization: Bearer <token>` and filter by the authenticated user's ID.

## Checks

```sh
npm --prefix frontend run lint
npm --prefix frontend run build
npm --prefix backend test
```

For database integration tests, create a **separate disposable database**, apply `backend/schema.sql`, then set `TEST_DATABASE_URL` when running backend tests. These tests exercise signup/login, CRUD and cross-user isolation. CI supplies a temporary PostgreSQL service.

## Deployment and limitations

Build `frontend/` with `npm run build` and serve its `dist/` directory. Run the API with `npm start` from `backend/`, supplying `DATABASE_URL` and a secret `JWT_SECRET`. Apply the schema before first use; it is not a migration system for existing tables.

This is a portfolio application. Tokens are stored in browser local storage and expire after seven days. Password reset, email verification, rate limiting, server-side session revocation and automated production monitoring are not implemented. Do not describe this as production-grade without those operational controls and deployment verification.
