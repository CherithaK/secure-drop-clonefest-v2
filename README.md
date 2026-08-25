# SecureDrop

> **Share the note. Keep the boundary.**

SecureDrop is a modern, privacy-first platform for sharing sensitive text without turning it into a permanent chat message, inbox artifact, or document. It preserves the essential purpose of PrivateBin, controlled, temporary information sharing, while rethinking the experience around explicit boundaries, clear lifecycle states, and a calm editorial interface.

This repository is the CloneFest 2.0 submission for the **Legacy Modernisation: PrivateBin** challenge. The implementation is intentionally independent rather than a visual clone: it combines a tactile “Paper Trail” product language with a full server-backed SecureDrop product and a separately disclosed, database-free Vercel contest demonstration.

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

## Deployment modes

SecureDrop intentionally exposes two different operating modes. The managed application is the complete product implementation. The Vercel submission URL is a **database-free contest demonstration** so it remains reliable without third-party database credentials.

| Deployment | Data location | What is enforced | What is intentionally unavailable |
| --- | --- | --- | --- |
| Managed server-backed deployment | Encrypted payload in MySQL/TiDB; key only in the URL fragment | Passphrase verification, view budgets, expiry, owner revocation, audit events, and cleanup | Cross-device creator history without an optional account |
| Vercel contest demo | Ciphertext, IV, tag, and AES-GCM key in the URL fragment; no database write | Browser-local AES-GCM decryption, fragment-only transport, expiry display, and browser-local consumed marker | Durable recipient access, passphrase verification, global one-time enforcement, owner history, revocation, audit logs, and scheduled cleanup |

> **Important:** The Vercel mode is a transparent demonstration of browser-side encryption and local reveal. It is not a substitute for the full server-backed lifecycle model and should only be used with the clearly labeled fictional demo content.

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

Vercel contest demonstration
  └── React + Web Crypto
          └── Ciphertext + AES-GCM key stay in `#` URL fragment
                  └── Recipient decrypts locally; no database request
```

### Repository map

| Path | Responsibility |
| --- | --- |
| `client/src/pages/Home.tsx` | Secure drop composer, browser-side encryption handoff, safe demo scenario, and recent-drop surface. |
| `client/src/pages/Dashboard.tsx` | Session-scoped dashboard with search, filters, statuses, copy, revocation, and metadata-only audit trail. |
| `client/src/pages/Drop.tsx` | Recipient authentication, browser-side decryption, lifecycle outcomes, copy, and QR sharing. |
| `client/src/lib/fragmentCrypto.ts` | Browser Web Crypto helpers for random AES-GCM keys, ciphertext, and URL-fragment key handling. |
| `client/src/lib/browserDemo.ts` | Vercel-only self-contained contest-link format, fragment payload handling, and browser-local consumption marker. |
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

### Database-free Vercel contest demonstration

On `*.vercel.app`, SecureDrop detects contest-demo mode and does **not** call the database-backed create, access, dashboard, revoke, or audit APIs. Instead, the browser encrypts the fictional note with a fresh AES-GCM key and puts the ciphertext, IV, authentication tag, and decryption key in the URL fragment. URL fragments are handled client-side and are not included in HTTP requests.[7] The recipient page parses that fragment and performs AES-GCM decryption locally.

The trade-off is explicit in the interface and is fundamental: anyone who has the complete link has the encrypted payload and its decryption key. A browser-local `sessionStorage` marker can present a consumed state after reveal in that browser, but it cannot enforce a global one-time reveal, revoke a copied link, retain an audit trail, or provide server-side passphrase throttling. The Vercel demo therefore limits note size to 1,200 characters and uses only fictional content.

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

The composer includes a **Load safe demo scenario** action. It fills the form with clearly labeled fictional handoff text and never includes credentials, customer information, or live service links.

On the full server-backed deployment, the scenario uses a burn-after-reading boundary, one permitted view, and the visible passphrase `demo-boundary`; it can demonstrate the complete create → authenticate → decrypt → destroy → audit flow. On the Vercel submission, the same safe scenario creates a self-contained encrypted URL and demonstrates creation plus local decryption while visibly disclosing that one-time state is local to the browser and no audit history exists.

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

The current test suite covers authenticated logout behavior plus cryptographic round trips, self-contained browser-demo URL encoding, passphrase verification, and deterministic session hashing. Browser verification should cover the appropriate mode:

1. Create a protected drop with a custom expiry and view limit.
2. Copy the link and open it at `/drop/:slug`.
3. Confirm wrong passphrases are rejected and the fifth failure produces a 15-minute lockout.
4. Confirm successful access reveals plaintext only after authentication.
5. Confirm burn-after-reading or view-limit exhaustion destroys the ciphertext.
6. Open `/dashboard`, filter by lifecycle status, copy a link, and revoke an active drop.
7. Open `/collections`, create a collection, and confirm the empty state transitions to a collection card.
8. Confirm `/api/scheduled/cleanup` is protected by the cron authentication layer.

For the database-free Vercel contest demo, use **Load safe demo scenario**, create the self-contained link, open `/drop/browser-demo` with the generated fragment, decrypt locally, and confirm the browser-local consumed disclosure after reveal. Do not test it with real secrets.

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

### Vercel submission walkthrough

1. Open `https://secure-drop-clonefest-v3.vercel.app/` and point out the **Vercel contest demo** notice.
2. Select **Load safe demo scenario**. Explain that the content is fictional and that the Vercel mode performs no database write.
3. Create the drop and show the generated `#k=…&d=…` URL. Explain that the fragment carries ciphertext and the browser-only AES-GCM key; it is not sent as an HTTP request.[7]
4. Open the generated link, choose **Decrypt local demo**, and show the fictional plaintext reveal.
5. Explain the visible limitation statement: the consumed marker is local to this browser, while global one-time rules, revocation, passphrase protection, and audit history need the server-backed deployment.

## Known trade-offs and next extensions

The full creator dashboard is intentionally browser-session scoped. Clearing cookies removes local history while leaving recipient links valid. Collections are currently a polished local workspace and are ready for database persistence in a follow-up iteration. The Vercel contest demo is deliberately more constrained: it has no database, durable recipient payload, global one-time state, passphrase verifier, owner ledger, audit, or revocation. The next high-value additions are database-backed collections, optional passwordless account linking for cross-device history, and deeper disposable-database integration tests for every lifecycle transition.

## License and attribution

SecureDrop is an independent modernization project for the CloneFest 2.0 challenge. It is inspired by the secure-text-sharing problem represented by PrivateBin, but it does not reproduce the reference project’s interface or implementation.

## References

[1]: https://react.dev/ "React documentation"
[2]: https://trpc.io/docs "tRPC documentation"
[3]: https://orm.drizzle.team/docs/overview "Drizzle ORM documentation"
[4]: https://nodejs.org/api/crypto.html "Node.js Crypto documentation"
[5]: https://vitest.dev/guide/ "Vitest documentation"
[6]: https://github.com/PrivateBin/PrivateBin "PrivateBin reference repository"
[7]: https://developer.mozilla.org/en-US/docs/Web/API/URL/hash "MDN URL hash documentation"

## Dark mode

The application includes a persistent dark-mode toggle in the Home header. It uses the shared `ThemeProvider`, stores the preference in `localStorage`, applies the `dark` class to the document root, and keeps the coral action color reserved for consequential actions. The dark palette preserves the same Paper Trail hierarchy with ink-navy navigation, deep blue-green surfaces, warm light text, and accessible focus rings.

## Vercel deployment

This repository includes a `vercel.json` configuration and a Vercel serverless entrypoint. The frontend is built with `pnpm build` into `dist/public`. That build also bundles the Express/tRPC server into `api/index.js`, so the Vercel runtime does not need to resolve internal TypeScript modules at invocation time. The public contest URL uses the database-free client-side flow documented above and therefore does not depend on an external MySQL/TiDB credential.

> Manus WebDev remains the supported primary deployment because it already provides the managed database, secrets, OAuth, custom domain, and heartbeat infrastructure. Vercel is an optional export path and may require additional platform configuration for MySQL/TiDB networking, OAuth callback URLs, secure cookies, and scheduled jobs.

### Vercel setup

1. Import the repository into Vercel and select the branch containing the finished SecureDrop implementation.
2. Keep the framework preset as **Other** or let the committed `vercel.json` provide the build settings.
3. For the **database-free contest submission**, no `DATABASE_URL` is required. Use only the safe fictional demo content and present the limitations stated in the interface and this README.
4. For a future **full server-backed Vercel deployment**, configure `DATABASE_URL`, `JWT_SECRET`, `VITE_APP_ID`, `OAUTH_SERVER_URL`, and `VITE_OAUTH_PORTAL_URL`; update the OAuth callback URL; permit Vercel-to-database TLS; and adapt scheduled cleanup to a Vercel-specific secret before enabling it.
5. Do not describe the database-free URL as a production secure-storage service. Test the self-contained create → local decrypt walkthrough before submitting it.

The Vercel adapter is intentionally isolated in `server/vercel.ts`, and `scripts/vercel-entry.ts` is the dedicated bundle entrypoint, so the existing Manus Express server and scheduled heartbeat remain unchanged. Do not commit production secrets, and do not treat a successful frontend build as proof that database connectivity, OAuth, or scheduled cleanup are configured correctly.
