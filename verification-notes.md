# Verification notes

The profile menu was previously observed rendering above the editor and hero artwork at the default preview viewport after adding a dedicated header stacking context. The fix uses `position: relative`, `z-index`, and `isolation: isolate` on the top bar, a higher local stacking level on the profile wrapper/menu, and a mobile max-width rule. A dedicated 438px verification pass remains to confirm the open menu state is contained within the viewport.

The safe demo control successfully populated clearly labeled fictional content, a burn-after-reading boundary, one permitted view, and the documented demo passphrase. The browser creation attempt did not display the share confirmation immediately, so network and server logs are being checked before recipient-flow verification continues.

The safe demo drop was then created successfully with a share URL containing an opaque `#k=` fragment key. The recipient page required the configured passphrase, revealed the fictional content only after authentication, described local browser decryption, and showed the explicit destroyed-after-view outcome.

A second safe demo was created with a one-minute custom expiry. After the expiry window and a fresh dashboard query, it rendered as `EXPIRED` and the metadata-only audit timeline displayed the corresponding `Expired` event.

## Live Vercel mobile brand-mark verification — 2026-08-25

The deployed `https://secure-drop-clonefest-v3.vercel.app/` was captured with headless Chromium at a 375x812 viewport after the inline logo fix. The mobile header rendered the hamburger navigation, Workspace/New drop breadcrumb, help/theme/more actions, and User avatar without a broken-image placeholder. The live page used the responsive mobile layout, with the composer stacked below the intro content. The inline brand mark is present in the shared sidebar DOM and will render when the mobile navigation drawer is opened; no `.brand-lockup img` reference remains in the deployed build. Screenshot: `/home/ubuntu/live-v3-mobile-header.png`.

The live Vercel mobile drawer was then opened through Chrome DevTools at an emulated 375x812 viewport. The check returned `brandTag: SPAN`, `brokenLogoImages: 0`, `drawerOpen: true`, and `markVisible: true`; the captured drawer shows the dark navigation rail with the SecureDrop brand area rendered without a broken image placeholder. Screenshot: `/home/ubuntu/live-v3-mobile-nav.png`.
