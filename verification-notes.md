# Verification notes

The profile menu was previously observed rendering above the editor and hero artwork at the default preview viewport after adding a dedicated header stacking context. The fix uses `position: relative`, `z-index`, and `isolation: isolate` on the top bar, a higher local stacking level on the profile wrapper/menu, and a mobile max-width rule. A dedicated 438px verification pass remains to confirm the open menu state is contained within the viewport.
