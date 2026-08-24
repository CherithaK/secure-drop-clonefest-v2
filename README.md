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
| `client/src/pages/Home.tsx` | Secure drop composer and recent-drop surface. |
| `client/src/pages/Dashboard.tsx` | Session-scoped dashboard with search, filters, statuses, copy, and revocation. |
| `client/src/pages/Drop.tsx` | Recipient authentication, lifecycle outcomes, decrypted reveal, copy, and QR sharing. |
| `client/src/pages/Collections.tsx` | Collection workspace and collection creation flow. |
| `client/src/App.tsx` | Route registration for `/`, `/dashboard`, `/collections`, and `/drop/:slug`. |
| `client/src/index.css` | Paper Trail design system, responsive layout, states, and motion. |
| `server/routers.ts` | Typed tRPC contracts for creation, dashboard, access, and revocation. |
| `server/dropCrypto.ts` | AES-GCM encryption, passphrase hashing, creator-session primitives, and share URLs. |
| `server/db.ts` | Drizzle query helpers for lifecycle operations. |
| `server/_core/index.ts` | Express server entrypoint and scheduled cleanup route. |
| `drizzle/schema.ts` | `users` and `secure_drops` database models. |
| `server/drop.security.test.ts` | Cryptography and session-hashing tests. |
| `todo.md` | Implementation history and completion checklist. |

## Security model

### Confidentiality boundary

The browser submits content to the server over HTTPS. The server encrypts the content using authenticated encryption before writing it to the database. The `secure_drops` row stores `ciphertext`, `iv`, and `authTag`; it does not store plaintext. Dashboard procedures return metadata only.

Decryption occurs only after the access procedure has validated the drop state and, when configured, verified the passphrase. The recipient page deliberately renders an authentication boundary before making a secret request. A rejected request returns a lifecycle or authentication error, never secret content.

### Passphrase protection

Passphrases are stored as one-way SHA-256 digests with a per-passphrase random salt. The access procedure tracks failed attempts. Five incorrect attempts set `lockedUntil` to 15 minutes in the future and subsequent attempts are rejected until the lock expires. Successful authentication clears the failure counter.

### Destructive lifecycle operations

A burn-after-reading drop is decrypted for the successful request and then destroyed through the lifecycle update path. A drop also destroys itself when its configured view limit is reached. Owner revocation is restricted to the creator-session hash and removes the ciphertext immediately. Expiration is enforced both by the cleanup handler and at access time, so stale rows do not remain readable while waiting for pruning.

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
