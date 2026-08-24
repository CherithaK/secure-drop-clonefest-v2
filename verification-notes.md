# Verification notes

The profile menu was previously observed rendering above the editor and hero artwork at the default preview viewport after adding a dedicated header stacking context. The fix uses `position: relative`, `z-index`, and `isolation: isolate` on the top bar, a higher local stacking level on the profile wrapper/menu, and a mobile max-width rule. A dedicated 438px verification pass remains to confirm the open menu state is contained within the viewport.

The safe demo control successfully populated clearly labeled fictional content, a burn-after-reading boundary, one permitted view, and the documented demo passphrase. The browser creation attempt did not display the share confirmation immediately, so network and server logs are being checked before recipient-flow verification continues.

The safe demo drop was then created successfully with a share URL containing an opaque `#k=` fragment key. The recipient page required the configured passphrase, revealed the fictional content only after authentication, described local browser decryption, and showed the explicit destroyed-after-view outcome.

A second safe demo was created with a one-minute custom expiry. After the expiry window and a fresh dashboard query, it rendered as `EXPIRED` and the metadata-only audit timeline displayed the corresponding `Expired` event.
