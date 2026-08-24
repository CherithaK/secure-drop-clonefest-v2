# SecureDrop

> **Share the note. Keep the boundary.**

SecureDrop is a modern, privacy-first platform for sharing sensitive text without turning it into a permanent chat message, inbox artifact, or document. It preserves the essential purpose of PrivateBin, controlled, temporary information sharing, while rethinking the experience around explicit boundaries, clear lifecycle states, and a calm editorial interface.

This repository is the CloneFest 2.0 submission for the **Legacy Modernisation: PrivateBin** challenge. The implementation is intentionally independent rather than a visual clone: it combines a tactile “Paper Trail” product language with real server-side persistence, authenticated decryption, revocation, destruction, session history, and scheduled cleanup.

## Product highlights

| Capability | What SecureDrop does |
| --- | --- |
| Secure creation | Accepts secrets up to **100,000 characters**, with title, custom expiry, view limit, passphrase protection, and burn-after-reading behavior. |
| Encrypted persistence | Encrypts secret content with AES-256-GCM before database persistence. Dashboard responses never include ciphertext, IV, auth tag, or plaintext. |
| Controlled access | Requires the passphrase before decryption. Wrong attempts are throttled and lock the drop for 15 minutes after five failures. |
| Lifecycle safety | Supports `ACTIVE`, `EXPIRED`, `REVOKED`, and `DESTROYED` states. Expired links are rejected, revocation deletes ciphertext immediately, and burn-after-reading destroys content after a successful reveal. |
| Session dashboard | Uses an HTTP-only creator cookie to show drops created in the current browser context, including status, expiry, view count, search, filtering, copy, and revoke actions. |
| Sharing UX | Provides copy-to-clipboard feedback and a high-contrast QR code generated through a zero-dependency QR image endpoint. |
| Collections | Provides a functional workspace for creating local organizational collections without weakening each drop’s individual security boundary. |
| Operations | Includes a cron-authenticated cleanup endpoint and a registered nightly heartbeat for removing expired, revoked, and destroyed rows. |

## Why this is a modernization

The reference problem is not merely “put text in a textarea and generate a URL.” The difficult product problem is helping a sender understand what happens after the note leaves their hands. SecureDrop makes the consequences visible: expiry is a named boundary, access limits are explicit, destructive actions are reflected in the UI, and the status page explains why content is no longer available.

The experience uses an asymmetric workspace instead of a generic dashboard. A dark trust rail anchors navigation and privacy status; the warm canvas makes the note feel like a deliberate artifact; coral is reserved for creation, risk, and irreversible actions. The same vocabulary appears in the composer, recipient page, session ledger, and collection workspace.

## Architecture

SecureDrop is a full-stack React application built on a managed tRPC and Express template.

```text
Browser
  │
  ├── React 19 + Wouter + Tailwind 4
  │       └── tRPC React hooks
  │
  └── HTTPS /api/trpc
          │
          ├── Express 4 request context
          ├── tRPC 11 procedures
          ├── AES-256-GCM crypto helpers
          └── Drizzle ORM
                  └── MySQL / TiDB database

Scheduled heartbeat
  └── POST /api/scheduled/cleanup
          └── Deletes expired, revoked, and destroyed rows
```

### Repository map

| Path | Responsibility |
| --- | --- |
| `client/src/pages/Home.tsx` | Secure drop composer, browser-side encryption handoff, safe demo scenario, and recent-drop surface. |
| `client/src/pages/Dashboard.tsx` | Session-scoped dashboard with search, filters, statuses, copy, revocation, and metadata-only audit trail. |
| `client/src/pages/Drop.tsx` | Recipient authentication, browser-side decryption, lifecycle outcomes, copy, and QR sharing. |
| `client/src/lib/fragmentCrypto.ts` | Browser Web Crypto helpers for random AES-GCM keys, ciphertext, and URL-fragment key handling. |
| `client/src/pages/Collections.tsx` | Collection workspace and collection creation flow. |
| `client/src/App.tsx` | Route registration for `/`, `/dashboard`, `/collections`, and `/drop/:slug`. |
| `client/src/index.css` | Paper Trail design system, responsive layout, states, and motion. |
| `server/routers.ts` | Typed tRPC contracts for creation, dashboard, access, and revocation. |
| `server/dropCrypto.ts` | Passphrase hashing, creator-session primitives, and share URLs; it has no plaintext encryption or decryption function. |
| `server/db.ts` | Drizzle query helpers for lifecycle operations and private audit events. |
| `server/_core/index.ts` | Express server entrypoint and scheduled cleanup route. |
| `drizzle/schema.ts` | `users`, `secure_drops`, and `secure_drop_events` database models. |
| `server/drop.security.test.ts`, `client/src/lib/fragmentCrypto.test.ts` | Session/passphrase and browser-encryption tests. |
| `todo.md` | Implementation history and completion checklist. |

## Security model

### Confidentiality boundary

The browser creates a random 256-bit AES-GCM key for every new drop, encrypts the note locally, and sends only `ciphertext`, `iv`, and `authTag` to the server. The decryption key is encoded only in the URL fragment as `#k=…`; fragments are not included in HTTP requests. The `secure_drops` row does not store plaintext or a decryption key, and dashboard procedures return metadata only.

The access procedure validates lifecycle state and, when configured, verifies the passphrase before returning the encrypted payload. The recipient page then decrypts it locally with the fragment key. A rejected request returns a lifecycle or authentication error, never plaintext; the server has no capability to decrypt the payload.

### Passphrase protection

Passphrases are stored as one-way scrypt-derived verifiers using managed server secret material. The access procedure tracks failed attempts. Five incorrect attempts set `lockedUntil` to 15 minutes in the future and subsequent attempts are rejected until the lock expires. Successful authentication clears the failure counter.

### Destructive lifecycle operations

A burn-after-reading drop releases its encrypted payload for the authenticated recipient request and then destroys the stored ciphertext through the lifecycle update path. The recipient can decrypt only with the browser-held fragment key. A drop also destroys itself when its configured view limit is reached. Owner revocation is restricted to the creator-session hash and removes the ciphertext immediately. Expiration is enforced both by the cleanup handler and at access time, so stale rows do not remain readable while waiting for pruning.

### Creator history

Dashboard history is intentionally scoped to an HTTP-only creator cookie rather than a permanent account. Clearing the cookie removes the browser’s ability to list its history, but it does not invalidate already-created recipient links. The dashboard explains this trade-off explicitly.

### Important deployment notes

Secrets are supplied through managed environment variables and must not be committed to the repository. Production must use HTTPS so secure cookies and OAuth redirects behave correctly. The scheduled cleanup endpoint is cron-authenticated by the platform heartbeat layer and must not be exposed as an unauthenticated maintenance route.

## Data model

The primary feature table is `secure_drops`:

| Field | Purpose |
| --- | --- |
| `slug` | Short, public, unguessable recipient identifier. |
| `ownerSessionHash` | Hash of the HTTP-only creator session; used to authorize owner operations without storing the raw cookie value. |
| `ciphertext`, `iv`, `authTag` | Authenticated-encryption payload components. |
| `passphraseHash` | Salted one-way passphrase digest, when protection is enabled. |
| `status` | Lifecycle enum: `ACTIVE`, `EXPIRED`, `REVOKED`, or `DESTROYED`. |
| `burnAfterReading` | Destructive single-view flag. |
| `viewLimit`, `viewCount` | Access budget and current usage. |
| `failedAttempts`, `lockedUntil` | Brute-force protection state. |
| `expiresAt` | UTC expiration timestamp. |
| `lastViewedAt` | Latest successful reveal timestamp. |

The schema includes indexes for owner-session lookup and lifecycle pruning.

`secure_drop_events` stores the owner-session hash, drop slug, lifecycle event type, and timestamp. It deliberately excludes plaintext, decryption keys, IP addresses, and recipient identity. The dashboard shows this trail as a creator-only audit view.

## Contest demo mode

The composer includes a **Load safe demo scenario** action. It fills the form with clearly labeled fictional handoff text, a burn-after-reading boundary, one permitted view, and the visible passphrase `demo-boundary`. The data does not include credentials, customer information, or live service links. Use it to demonstrate creation, fragment-key sharing, recipient authentication, local decryption, destruction, and the owner audit trail in a reliable sequence.

## Local development

### Prerequisites

Install Node.js 22 or a compatible current LTS release, pnpm, and access to a MySQL-compatible database such as MySQL or TiDB. The managed project environment provides these dependencies and runtime variables automatically.

### Install

```bash
pnpm install
```

### Environment

Do not commit `.env` files. The managed environment supplies the following values:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | MySQL/TiDB connection string. |
| `JWT_SECRET` | Session cookie signing secret. |
| `VITE_APP_ID` | OAuth application identifier. |
| `OAUTH_SERVER_URL` | OAuth backend base URL. |
| `VITE_OAUTH_PORTAL_URL` | Frontend login portal URL. |
| `BUILT_IN_FORGE_API_URL` / `BUILT_IN_FORGE_API_KEY` | Managed API and storage integrations. |
| `VITE_FRONTEND_FORGE_API_URL` / `VITE_FRONTEND_FORGE_API_KEY` | Browser-safe managed API access. |

### Database migration

Schema changes follow the Drizzle-first workflow:

```bash
pnpm drizzle-kit generate
# Review the generated SQL migration.
# Apply it through the managed project SQL execution workflow.
```

The current schema creates the `secure_drops` table and the lifecycle indexes without storing file bytes or plaintext secrets.

### Run the application

```bash
pnpm dev
```

The server starts the Express API and Vite development frontend together. Do not hardcode a production port; the runtime uses the injected `PORT` value when available.

## Quality checks

Run the same checks before submitting to a contest evaluator:

```bash
pnpm check
pnpm test -- --runInBand
pnpm build
```

The current test suite covers authenticated logout behavior plus cryptographic round trips, passphrase verification, and deterministic session hashing. Browser verification should cover:

1. Create a protected drop with a custom expiry and view limit.
2. Copy the link and open it at `/drop/:slug`.
3. Confirm wrong passphrases are rejected and the fifth failure produces a 15-minute lockout.
4. Confirm successful access reveals plaintext only after authentication.
5. Confirm burn-after-reading or view-limit exhaustion destroys the ciphertext.
6. Open `/dashboard`, filter by lifecycle status, copy a link, and revoke an active drop.
7. Open `/collections`, create a collection, and confirm the empty state transitions to a collection card.
8. Confirm `/api/scheduled/cleanup` is protected by the cron authentication layer.

## Production operations

The cleanup route is:

```text
POST /api/scheduled/cleanup
```

It authenticates the platform heartbeat request and calls `pruneDrops()` to delete rows where the expiry has passed or the lifecycle status is `REVOKED` or `DESTROYED`. The production heartbeat is registered as a nightly job under task UID `Ke4eEtwAxyevqkQ9zuRJcw`.

For monitoring, inspect server logs for API errors and scheduled cleanup responses. If the application is migrated to a new hosting provider, preserve secure-cookie behavior, the injected secrets, the database migration workflow, and an authenticated scheduler before switching traffic.

## Contest demo script

A strong five-minute walkthrough is:

1. Start on **New drop** and explain that the note is a temporary object with an explicit boundary.
2. Paste a sensitive-looking sample, set a custom expiry, choose a one-view limit, and enable a passphrase.
3. Create the drop, copy the sharing link, and point out that the sender receives metadata rather than plaintext history.
4. Open the recipient route, demonstrate the authentication gate, reveal the text, copy it, and show the QR handoff.
5. Return to **My drops**, show the status ledger, then revoke an active drop and reopen the link to demonstrate the closed-boundary state.
6. Visit **Collections** to show the organizational workspace and explain that collections do not override a drop’s security rules.

Never use real credentials, API keys, customer data, or production secrets during the presentation.

## Known trade-offs and next extensions

The current creator dashboard is intentionally browser-session scoped. Clearing cookies removes local history while leaving recipient links valid. Collections are currently a polished local workspace and are ready for database persistence in a follow-up iteration. The next high-value additions would be database-backed collections, optional passwordless account linking for cross-device history, and deeper disposable-database integration tests for every lifecycle transition.

## License and attribution

SecureDrop is an independent modernization project for the CloneFest 2.0 challenge. It is inspired by the secure-text-sharing problem represented by PrivateBin, but it does not reproduce the reference project’s interface or implementation.

## References

[1]: https://react.dev/ "React documentation"
[2]: https://trpc.io/docs "tRPC documentation"
[3]: https://orm.drizzle.team/docs/overview "Drizzle ORM documentation"
[4]: https://nodejs.org/api/crypto.html "Node.js Crypto documentation"
[5]: https://vitest.dev/guide/ "Vitest documentation"
[6]: https://github.com/PrivateBin/PrivateBin "PrivateBin reference repository"

## Dark mode

The application includes a persistent dark-mode toggle in the Home header. It uses the shared `ThemeProvider`, stores the preference in `localStorage`, applies the `dark` class to the document root, and keeps the coral action color reserved for consequential actions. The dark palette preserves the same Paper Trail hierarchy with ink-navy navigation, deep blue-green surfaces, warm light text, and accessible focus rings.

## Vercel deployment

This repository includes a `vercel.json` configuration and a Vercel serverless entrypoint for teams that prefer Vercel. The frontend is built with the existing `pnpm build` command into `dist/public`. That same build bundles the Express/tRPC server into `api/index.js`, so the Vercel runtime does not need to resolve the repository's internal TypeScript modules at invocation time. All `/api/*` requests are routed to this self-contained function.

> Manus WebDev remains the supported primary deployment because it already provides the managed database, secrets, OAuth, custom domain, and heartbeat infrastructure. Vercel is an optional export path and may require additional platform configuration for MySQL/TiDB networking, OAuth callback URLs, secure cookies, and scheduled jobs.

### Vercel setup

1. Import the repository into Vercel and select the branch containing the finished SecureDrop implementation.
2. Keep the framework preset as **Other** or let the committed `vercel.json` provide the build settings.
3. Configure the production environment variables from the environment table above, including `DATABASE_URL`, `JWT_SECRET`, `VITE_APP_ID`, `OAUTH_SERVER_URL`, and `VITE_OAUTH_PORTAL_URL`.
4. Update the OAuth provider’s callback URL to the Vercel deployment origin plus `/api/oauth/callback`.
5. Confirm that the Vercel project can reach the configured MySQL/TiDB instance over TLS and that its firewall allows Vercel egress.
6. Configure a Vercel Cron or external scheduler to `POST /api/scheduled/cleanup`. The endpoint still requires the platform heartbeat authentication contract; if Vercel Cron is used instead, adapt the route to a Vercel-specific secret header before enabling destructive cleanup.
7. Test a complete create → access → burn-after-reading → revoke flow against the Vercel URL before using it with real data.

The Vercel adapter is intentionally isolated in `server/vercel.ts`, and `scripts/vercel-entry.ts` is the dedicated bundle entrypoint, so the existing Manus Express server and scheduled heartbeat remain unchanged. Do not commit production secrets, and do not treat a successful frontend build as proof that database connectivity, OAuth, or scheduled cleanup are configured correctly.
