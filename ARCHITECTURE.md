# CypherFax NestJS Architecture

## Overview

CypherFax NestJS is a NestJS 11 reimplementation of the original CypherFax API. It preserves the existing PostgreSQL/Prisma schema, API prefix, environment variable names, authentication behavior, upload validation, usage limits, and mock/Telnyx fax dispatch modes.

The application is organized into Nest modules, controllers, services, guards, DTOs, and exception handling. The Nest project is maintained separately from the original Next.js project.

## Runtime Structure

- `src/main.ts` bootstraps the HTTP application and applies global validation and API configuration.
- `src/app.module.ts` composes the global configuration, throttling, Prisma, auth, upload, fax, usage, plans, and health modules.
- `src/prisma/` provides the Prisma client as a Nest provider.
- `src/auth/` implements OTP, Google login, access-token verification, refresh, and logout.
- `src/upload/` validates and stores uploaded files under `public/uploads/`.
- `src/fax/` coordinates page counting, usage checks, upload handling, and fax dispatch.
- `src/fax/fax-dispatch/` selects the mock or Telnyx transport using `MOCK_TELNYX`.
- `src/usage/` manages users, billing-cycle resets, quota checks, and usage recording.
- `src/plans/` contains the supported plan catalog and plan validation.
- `src/health/` exposes the health endpoint.
- `prisma/schema.prisma` is copied from the original project without schema changes.

## API Configuration

The application uses the `/api` global prefix. Request DTOs are validated through Nest's global `ValidationPipe` with transformation and whitelist behavior enabled. Throttling is configured globally for API requests at ten requests per 60-second window.

## Authentication Flow

The auth module provides these routes:

- `POST /api/auth/send-otp`: validates a contact and project, stores a hashed OTP, and sends it by email or SMS.
- `POST /api/auth/verify-otp`: verifies the latest matching six-digit OTP and returns access/refresh tokens.
- `POST /api/auth/google-login`: verifies a Google ID token, upserts the user, and returns tokens.
- `POST /api/auth/refresh`: validates an active refresh token and issues a new access token.
- `POST /api/auth/logout`: revokes a refresh token.

Protected endpoints use `AccessTokenGuard`. The guard reads the bearer token, verifies the RS256 JWT, and attaches the authenticated `userId` and `project` to the request.

## Upload and Fax Flow

`POST /api/fax/upload-and-send` follows the original combined workflow:

1. Authenticate the request with the access-token guard.
2. Read the multipart `file`, destination number, and optional plan ID.
3. Validate the file MIME type and maximum size.
4. Count pages for supported PDFs and images.
5. Create or update the user usage record.
6. Check the active plan quota.
7. Save the file under `public/uploads/`.
8. Dispatch through the mock or Telnyx fax service.
9. Record usage when dispatch does not fail.
10. Remove the local file after successful dispatch.
11. Return fax, upload, usage, and remaining-page information.

Additional routes:

- `POST /api/upload`: protected file validation and storage without dispatch.
- `POST /api/fax/send`: protected fax dispatch from a supplied `fileUrl` and `toNumber`.
- `GET /api/health`: service health check.

Invalid input returns HTTP 400. Plan exhaustion returns HTTP 402. Unexpected processing failures return HTTP 500.

## Fax Dispatch

`FaxDispatchService` preserves the original transport selection:

- `MOCK_TELNYX=true` uses a local mock sender that returns queued or failed results.
- Otherwise, the service calls the Telnyx fax API using `TELNYX_API_KEY`, `TELNYX_FAX_CONNECTION_ID`, and `TELNYX_FROM_NUMBER`.

Local file storage and post-dispatch cleanup are retained for behavioral compatibility. A production deployment should use durable object storage and delete files only after delivery confirmation.

## Data Layer

Prisma 6 connects to PostgreSQL through `DATABASE_URL`. The schema is intentionally unchanged from the original project and includes `User`, `UserUsage`, `RefreshToken`, `OtpCode`, and `AuditLog` models.

Usage is tracked per user with a 30-day rolling billing cycle. The current implementation performs dispatch and usage recording as separate operations, so external-service and database partial-failure cases remain possible.

## Plans

The supported plans are preserved:

- Basic: 2 pages per cycle, $5.99, no dedicated number.
- Standard: 4 pages per cycle, $9.99, dedicated number included.
- Pro: 6 pages per cycle, $19.99, dedicated number included.

## Environment Variables

The original environment names remain supported:

- `DATABASE_URL`
- `MOCK_TELNYX`
- `TELNYX_API_KEY`
- `TELNYX_FAX_CONNECTION_ID`
- `TELNYX_FROM_NUMBER`
- `GOOGLE_CLIENT_ID`
- `RSA_PRIVATE_KEY_PATH`
- `RSA_PUBLIC_KEY_PATH`
- `EMAIL_USER`
- `EMAIL_APP_PASSWORD`

## Known Limitations

1. Uploads are stored on the local filesystem and are not durable in serverless or multi-instance deployments.
2. Fax dispatch and usage recording are not atomic.
3. Throttling is process-local rather than shared through Redis or another centralized store.
4. End-to-end route verification still depends on a configured PostgreSQL database, RSA key pair, and provider settings.

---

**Last Updated**: 2026-08-27
