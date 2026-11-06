# CampusHub / MNHS School System

CampusHub is a role-based school information system. The API is an Express + TypeScript service backed by Prisma and Neon Postgres; the web application is Next.js.

## Requirements

- Node.js 22 or later and npm
- Three separate Neon branches/databases for development, test, and production
- A mail-delivery webhook for production password reset requests

Never point automated tests or local development at the production Neon branch.

## Local setup

1. Copy `backend/.env.example` to `backend/.env`.
2. Set `DATABASE_URL` to the development branch's pooled connection string and `DIRECT_URL` to its direct connection string. Use the direct URL for Prisma migrations.
3. Use a random `JWT_SECRET` of at least 32 characters locally. Configure the reset-delivery URL and secret to test password reset locally.
4. Install and migrate/seed the backend:

   ```powershell
   cd backend
   npm ci
   npm run prisma:generate
   npm run prisma:migrate
   npm run seed
   npm run dev
   ```

5. In another terminal, configure and run the web app:

   ```powershell
   cd frontend
   npm ci
   $env:API_ORIGIN = "http://localhost:4000"
   npm run dev
   ```

Open `http://localhost:3000`. Browser API requests use the Next.js `/api` rewrite. The API permits only exact origins listed in `CORS_ORIGIN`; write requests must include an allowed `Origin` or `Referer`.

The demo seed currently creates these accounts with `password123`; these are for isolated local/test data only. Log in using the listed ID (email also remains accepted for these seeded legacy accounts):

- Admin: `ADMIN-0001` (`admin@uni.edu`)
- Faculty: `TCH-0002` (Reyes), `TCH-0001` (Tan)
- Student: `STU-2025-0002` (Ben)
- Alumni: `iris.co@uni.edu`

Newly provisioned student accounts use their student number/LRN and the one-time starter password `student1234`; faculty use their employee ID and `faculty1234`. Both must change the starter password before accessing the rest of the system. New admin accounts use the custom Admin ID set during creation and a generated or admin-supplied temporary password, which must also be changed on first sign-in. Share all temporary credentials securely. `studentNo` is the current database field used as the student LRN/login ID.

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | Yes | Runtime Neon connection; use pooled URL for hosted services |
| `DIRECT_URL` | Yes | Direct Neon connection for Prisma migrations |
| `PORT` | No | API port; defaults to `4000` |
| `CORS_ORIGIN` | No | Comma-separated exact web origins; defaults to `http://localhost:3000` |
| `NODE_ENV` | No | `development`, `test`, or `production` |
| `JWT_SECRET` | Yes | JWT signing secret; production requires at least 48 non-placeholder characters |
| `JWT_EXPIRES_IN` | No | JWT lifetime; defaults to `8h` |
| `COOKIE_NAME` | No | Auth cookie name |
| `COOKIE_SAMESITE` | No | Must remain `lax` |
| `TRUST_PROXY` | No | Number of trusted reverse proxies; configure accurately for Render/Fly |
| `RATE_LIMIT_PER_MINUTE` | No | Per-IP API request limit |
| `PASSWORD_RESET_DELIVERY_URL` | Production | HTTPS webhook that sends the reset message |
| `PASSWORD_RESET_DELIVERY_SECRET` | Production | At least 32 characters; sent as a bearer credential to the configured webhook |
| `INTEGRATION_TEST_DATABASE_URL` | Tests only | Dedicated Neon test-branch URL; never production |

The reset webhook receives `POST` JSON `{ "to": "...", "resetUrl": "..." }` with `Authorization: Bearer <secret>`. It must deliver the link without logging or retaining it longer than needed. Requests time out after five seconds. Production startup fails if delivery is not configured.
The first entry in `CORS_ORIGIN` is used as the reset-link web origin. Keep it set to the canonical production frontend origin.

## Scripts

From `backend/`:

| Command | Description |
|---|---|
| `npm run dev` | Run the API with watch mode |
| `npm run build` | Type-check and compile to `dist/` |
| `npm run start` | Start the compiled API |
| `npm run prisma:generate` | Generate Prisma client |
| `npm run prisma:migrate` | Apply development migrations with `prisma migrate dev` |
| `npm run prisma:migrate:deploy` | Apply committed migrations to a deployment/test branch |
| `npm run seed` | Load deterministic demo data |
| `npm run test:unit` | Run backend unit/data-quality suites |
| `npm run test:security` | Run Vitest/Supertest security checks; API cases use `INTEGRATION_TEST_DATABASE_URL` |
| `npm run test:types` | Type-check the test suite and sync integration script |
| `npm run test:integrations` | Verify feed preview, unknown-student rejects, and repeat-commit idempotency |
| `npm run test:audit-integration` | Verify append-only audit and transaction rollback behavior |
| `npm run test:ci` | Build and run all backend unit and database integration tests |

`npm run test:ci` requires `INTEGRATION_TEST_DATABASE_URL` to point to a dedicated migrated and seeded test branch. The integration scripts override their Prisma URLs with this value. Never supply production credentials to a test process.

## Role access summary

| Resource | Admin | Faculty | Student | Alumni |
|---|---|---|---|---|
| Student directory and student administration | All | No | No | No |
| Own student profile, grades, attendance, and integration data | Yes | For current advisees/classes as applicable | Own only | Own only |
| Integration feeds for students | All | Current advisees only | Own only | Own only; alumni records require graduated status |
| Class, attendance, and grade operations | All | Assigned classes; server verifies assignment | No | No |
| Course/subject catalog | Read/write | Read | Read | Read |
| Sync, imports, users, and audit administration | Yes | No | No | No |
| Report cards | All | Students in advised sections for the selected year | Own released records | No |

The UI may hide unavailable actions for convenience, but the API performs authorization and record scoping in server middleware/services. Out-of-scope student integration records return 404. Changing a student ID in a URL must not expose another student's records.

## Tests and GitHub Actions

The CI workflow runs migrations, seeds, and backend tests against an isolated Neon test branch on pull requests and pushes to `main`. Configure these GitHub Actions secrets:

- `NEON_TEST_DATABASE_URL`: pooled URL for the dedicated test branch.
- `NEON_TEST_DIRECT_URL`: direct URL for that same branch.

Do not use production URLs for these secrets. Pull requests from forks do not receive repository secrets; configure CI access for trusted contributors or run the tests against a separately provisioned test branch before merge.

The API rate-limit counters use the built-in in-memory store. Run one API instance unless you configure a shared `express-rate-limit` store for all replicas; the database account lockout remains persistent across instances.

The database integration suite checks role restrictions, student ID substitution, integration-feed scoping for former advisees, rejected grade writes producing no audit row, reset-token single use, sync idempotency, and append-only audit behavior. The unit suite covers input normalization, role/security rules, grades, and feed DQ validation.

## Deployment

### API (Render or Fly.io)

1. Deploy the `backend/` directory using Node.js 22. Run `npm ci`, `npm run prisma:generate`, and `npm run build`; start with `npm run start`.
2. Set `NODE_ENV=production`, `PORT` to the platform's assigned port, a strong `JWT_SECRET`, exact `CORS_ORIGIN` for the Vercel web origin, and the production Neon `DATABASE_URL` (pooled) plus `DIRECT_URL` (direct).
3. Configure `TRUST_PROXY` to the actual trusted proxy hop count, `COOKIE_NAME`, and `JWT_EXPIRES_IN`. Keep `COOKIE_SAMESITE=lax`.
4. Configure the HTTPS `PASSWORD_RESET_DELIVERY_URL` and `PASSWORD_RESET_DELIVERY_SECRET`.
5. Apply migrations as a release/pre-deploy command: `npm run prisma:migrate:deploy`. Do not run `prisma migrate dev` against production.
6. Confirm `GET /api/health` returns HTTP 200 with `db: "connected"`.

### Web (Vercel)

1. Deploy `frontend/` as the Next.js project.
2. Set `API_ORIGIN` to the API's HTTPS origin. `frontend/next.config.ts` rewrites `/api/:path*` to `${API_ORIGIN}/api/:path*`, keeping browser requests same-origin with the web app.
3. Ensure the exact Vercel origin is in the API's `CORS_ORIGIN`, and use HTTPS for both services.
4. Configure production and preview environments separately; do not make previews point to the production database unless explicitly intended.

## Data privacy

CampusHub stores account email, password hashes, role, login/lockout timestamps and token version; student names, student number, status, date of birth, sex, address, guardian name/contact, school enrollment, attendance, grades, and class data; teacher names and employee/contact details; LMS events, library loans, alumni engagement, import/sync rejects, and audit entries. Audit entries can include actor and student IDs, change snapshots, and IP addresses. Password reset tokens are stored only as SHA-256 hashes with expiration and consumption timestamps. Passwords and reset tokens are excluded from audit snapshots and application logs.

Administrators can access system records and audit history. Faculty access is limited to assigned classes and the applicable advisee records. Students and alumni can access their own scoped information; alumni engagement data is restricted to graduated students. Keep Neon branches isolated, grant credentials only to services that need them, configure retention/backups consistent with school policy, and avoid using real student data in development/test branches.
