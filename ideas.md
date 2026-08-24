# SecureDrop design direction

## Three possible approaches

### Theme Name: Signal Room
Very dark operational interface with crisp telemetry, terminal cues, and restrained coral status lighting. It makes secure sharing feel like a calm control room.

**Probability:** 0.04

### Theme Name: Paper Trail
Warm editorial workspace built around tactile paper, ink, and deliberate typography. It makes sensitive information feel considered, human, and easy to handle.

**Probability:** 0.07

### Theme Name: Quiet Vault
A pale, architectural product surface with deep navy panels, generous whitespace, and museum-like object labels. It makes privacy feel legible and quietly premium.

**Probability:** 0.03

## Chosen approach: Paper Trail

### Design Movement
Contemporary editorial brutalism softened by analogue stationery: hard edges, visible structure, strong type contrast, and tactile material cues without decorative excess.

### Core Principles
1. **Make privacy legible.** Every meaningful action explains what is protected, when it expires, and who can access it.
2. **Treat content as an artifact.** Notes feel like deliberate objects with a title, lifecycle, access mode, and audit trail.
3. **Use contrast with restraint.** Ink navy establishes trust, coral marks decisions, and bone surfaces keep long-form content readable.
4. **Prefer useful density.** The interface is compact enough for real work but gives primary actions generous breathing room.

### Color Philosophy
Warm bone (#f4f0e8) is the working surface: calm, human, and legible for text. Ink navy (#10242b) is the trust layer, used for navigation and high-consequence actions. Signal coral (#ee6b55) is reserved for creation, alerts, and irreversible moments. Sage (#b8cbbf) marks healthy protection states. The palette intentionally avoids generic blue SaaS gradients and makes security feel tangible rather than theatrical.

### Layout Paradigm
An asymmetric split workspace: a narrow utility rail anchors identity and navigation, while the main canvas is a broad note studio with a sidecar for protection settings. On smaller screens the rail becomes a compact header and the sidecar stacks beneath the editor.

### Signature Elements
- A redacted-paper motif: fine horizontal rules and clipped blocks suggest sensitive text without hiding functionality.
- Object labels in small uppercase mono type, used for lifecycle, encryption, and access metadata.
- A coral “drop” mark that echoes a folded sheet and appears in the brand mark, empty states, and publish confirmation.

### Interaction Philosophy
Interactions should feel like handling a physical document: focus reveals the next decision, toggles state their consequence in plain language, and publishing produces a clear handoff artifact. Use snappy transitions for controls and slightly slower, spring-like reveals for the protection sidecar and confirmation state. Nothing important relies on color alone.

### Animation
Use 160–220ms ease-out transitions for buttons, tabs, and inputs. On load, stagger the rail, editor, and sidecar by 50ms with opacity plus a 6px upward translate. Settings drawer opens from the right with a 220ms transform/opacity transition. Publish confirmation uses a brief coral drop pulse, but respects prefers-reduced-motion.

### Typography System
Use **DM Sans** for interface copy and **Space Grotesk** for display headings. Use **IBM Plex Mono** for object labels, secrets, timestamps, and short IDs. Headings are tight and slightly oversized; body copy stays at 14–16px with generous line-height. Mono is never used for long prose.

### Brand Essence
SecureDrop is the calm, modern place to share sensitive text when links should have a lifecycle — built for teams, operators, and thoughtful individuals who value control over convenience.

**Personality:** considered, precise, quietly bold.

### Brand Voice
Headlines are concise and editorial. CTAs describe the action and its consequence. Microcopy is direct, reassuring, and never alarmist.

- “Share the note. Keep the boundary.”
- “This drop expires after it is opened once.”

### Wordmark & Logo
The wordmark uses a custom geometric lockup: “Secure” in Space Grotesk medium and “Drop” in Space Grotesk bold with the final letter cropped by a small coral paper-fold notch. The standalone mark is a folded sheet whose negative space forms a shield.

### Signature Brand Color
**Signal coral — #EE6B55.** It is warm enough to feel human and distinct enough to own the moment a note becomes a deliberate drop.

## Style Decisions
- The product should feel like a secure editorial workspace, not a hacker dashboard.
- Avoid generic rounded card grids; use a structured rail, broad canvas, and strong type hierarchy.
- Coral is for action and risk, sage for protected states, and navy for trust and navigation.
- Use generated paper/signal imagery only as restrained supporting texture, never as decoration behind critical text.
