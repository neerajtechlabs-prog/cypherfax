# CypherFax NestJS Project State

## Current Status

- NestJS 11 project scaffolded as a separate repository from the original Next.js app.
- Prisma 6 and PostgreSQL configuration added.
- Original `prisma/schema.prisma` copied without changes.
- Plans and 30-day rolling usage enforcement implemented.
- OTP, Google login, access tokens, refresh tokens, and logout implemented.
- Protected routes use a bearer access-token guard.
- Upload validation and local file storage implemented.
- Fax upload-and-send and direct fax-send orchestration implemented.
- Mock/Telnyx dispatch selection preserved through `MOCK_TELNYX`.
- Global API configuration, validation, and throttling added.
- Upload interceptors use in-memory storage so the service writes the received buffer once.
- TypeScript verification and the production build pass.
- `GET /api/health` verified at runtime on port 3001.
- Prisma Client generated successfully for the Nest project.

## Project Tree

```text
.
├── ARCHITECTURE.md
├── README.md
├── package.json
├── prisma/
│   └── schema.prisma
├── src/
│   ├── app.module.ts
│   ├── main.ts
│   ├── auth/
│   ├── fax/
│   │   └── fax-dispatch/
│   ├── health/
│   ├── plans/
│   ├── prisma/
│   ├── upload/
│   └── usage/
└── public/
    └── uploads/
```

Generated and dependency directories such as `node_modules/` and `dist/` are excluded.

## Implemented API Surface

- `POST /api/auth/send-otp`
- `POST /api/auth/verify-otp`
- `POST /api/auth/google-login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `POST /api/upload`
- `POST /api/fax/send`
- `POST /api/fax/upload-and-send`
- `GET /api/health`

## Verification Status

Completed:

- Nest project dependency installation.
- Prisma schema placement.
- Strict TypeScript compilation.
- Production build with `npm run build`.
- Health endpoint smoke test against the compiled Nest app.
- Auth, upload, fax, usage/plan, and refresh behavior reviewed against the original routes.

Pending:

- Validate database-backed flows with PostgreSQL running.
- Compare response bodies and status codes against the original Next.js routes.
- Verify mock and live Telnyx configuration paths.
- Add focused Jest coverage for the Nest services and controllers.

## Environment Contract

The Nest app retains the original environment variable names:

`DATABASE_URL`, `MOCK_TELNYX`, `TELNYX_API_KEY`, `TELNYX_FAX_CONNECTION_ID`, `TELNYX_FROM_NUMBER`, `GOOGLE_CLIENT_ID`, `RSA_PRIVATE_KEY_PATH`, `RSA_PUBLIC_KEY_PATH`, `EMAIL_USER`, and `EMAIL_APP_PASSWORD`.

## Next Work Items

1. Add focused Jest coverage for the Nest services and controllers.
2. Start PostgreSQL and execute database-backed route checks.
3. Compare all error responses and success payloads with the original implementation.
4. Review operational concerns: durable file storage, centralized rate limiting, and dispatch/usage consistency.

---

**Last Updated**: 2026-08-27
