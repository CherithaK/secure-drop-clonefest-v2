/* Paper Trail direction: broad note canvas, editorial labels, coral decisions, and plain-language privacy cues. */
import { useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { encryptForShare } from "@/lib/fragmentCrypto";
import { createBrowserDemoUrl, isDatabaseFreeVercelDemo } from "@/lib/browserDemo";
import { toast } from "sonner";
import {
  Archive,
  ArrowUpRight,
  Check,
  ChevronDown,
  Clock3,
  Copy,
  FileLock2,
  FileText,
  Hash,
  HelpCircle,
  KeyRound,
  Layers3,
  Link2,
  Menu,
  MoreHorizontal,
  Plus,
  Redo2,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  Undo2,
  X,
  Moon,
  Sun,
} from "lucide-react";

const heroImage = "/manus-storage/securedrop-hero_7ac0ced3.png";
const paperImage = "/manus-storage/securedrop-paper-study_e8e91531.png";
const markImage = "/manus-storage/securedrop-mark_aa6aee5e.png";

const recentDrops = [
  { title: "Launch handoff notes", meta: "Opened 8 min ago", tag: "TEAM", tone: "coral" },
  { title: "Vendor access token", meta: "Expires in 2 days", tag: "SEALED", tone: "sage" },
  { title: "Incident timeline / 08.24", meta: "Never opened", tag: "UNOPENED", tone: "bone" },
];

export default function Home() {
  // The useAuth hook provides authentication state.
  // To implement login/logout, call logout(), or start login from an event
  // handler: onClick={() => startLogin()} (imported from "@/const"). Never call
  // startLogin() during render (no href={startLogin()}) — it mints a one-time
  // nonce cookie and must run only at the moment of navigation.
  let { user, loading, error, isAuthenticated, logout } = useAuth();

  const [, setLocation] = useLocation();
  const browserDemo = isDatabaseFreeVercelDemo();
  const { theme, toggleTheme } = useTheme();
  const [content, setContent] = useState("Paste a note, secret, or handoff here…");
  const [title, setTitle] = useState("");
  const [expiry, setExpiry] = useState("Burn after reading");
  const [access, setAccess] = useState("link");
  const [password, setPassword] = useState(!browserDemo);
  const [passphrase, setPassphrase] = useState("");
  const [viewLimit, setViewLimit] = useState(1);
  const [customExpiry, setCustomExpiry] = useState(60);
  const [customViewLimit, setCustomViewLimit] = useState(1);
  const [createdUrl, setCreatedUrl] = useState("");
  const createDrop = trpc.drops.create.useMutation();
  const dashboard = trpc.drops.dashboard.useQuery({ status: "ALL" }, { enabled: !browserDemo });
  const [showProtection, setShowProtection] = useState(false);
  const [published, setPublished] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [howItWorksOpen, setHowItWorksOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [focusedSetting, setFocusedSetting] = useState<"protection" | "expiry" | null>(null);
  const protectionControlRef = useRef<HTMLDivElement>(null);
  const expiryControlRef = useRef<HTMLDivElement>(null);

  function focusDefault(setting: "protection" | "expiry") {
    setFocusedSetting(setting);
    if (setting === "protection") {
      setPassword(true);
      setShowProtection(true);
    }
    window.setTimeout(() => {
      const target = setting === "protection" ? protectionControlRef.current : expiryControlRef.current;
      target?.scrollIntoView({ behavior: "smooth", block: "center" });
      (target?.querySelector("button, select, input") as HTMLElement | null)?.focus();
    }, 60);
    toast.success(setting === "protection" ? "Protection settings ready" : "Expiry rules ready", {
      description: setting === "protection" ? "Passphrase protection is enabled for this new drop." : "Choose how long this drop should remain available.",
    });
  }

  function loadSafeDemo() {
    setTitle("Demo — incident bridge handoff");
    setContent("DEMO CONTENT — SAFE FOR PRESENTATION\n\nIncident bridge: https://meet.example.test/secure-room\nRotation note: confirm the release owner before continuing.\n\nThis is clearly labeled fictional demo content. It does not contain credentials, customer data, or a live service link.");
    setExpiry("Burn after reading");
    setViewLimit(1);
    setPassword(!browserDemo);
    setPassphrase(browserDemo ? "" : "demo-boundary");
    setShowProtection(true);
    toast.success("Safe demo scenario loaded", { description: browserDemo ? "Fictional content only. This Vercel demo uses a self-contained encrypted link, not a database." : "Fictional content only. Create it to demonstrate the one-time flow." });
  }

  const chars = useMemo(() => content.length, [content]);

  async function publish() {
    if (!content.trim() || content.includes("Paste a note")) { toast.error("Add a note before creating a drop.", { description: "Your content stays local until you publish." }); return; }
    if (!browserDemo && password && passphrase.length < 8) { toast.error("Use a longer passphrase.", { description: "Passphrases need at least 8 characters." }); return; }
    if (browserDemo && content.length > 1200) { toast.error("Keep the Vercel demo note under 1,200 characters.", { description: "This database-free demonstration carries encrypted data in the link fragment." }); return; }
    const effectiveViewLimit = viewLimit === 0 ? customViewLimit : viewLimit;
    const effectiveExpiry = expiry === "Custom" ? customExpiry : expiry === "Burn after reading" ? 1440 : expiry === "In 1 hour" ? 60 : expiry === "In 24 hours" ? 1440 : expiry === "In 7 days" ? 10080 : 525600;
    if (effectiveExpiry < 1 || effectiveExpiry > 525600 || effectiveViewLimit < 1 || effectiveViewLimit > 100) { toast.error("Check the drop boundary.", { description: "Expiry must be 1–525,600 minutes and views must be 1–100." }); return; }
    try {
      const encrypted = await encryptForShare(content);
      if (browserDemo) {
        setCreatedUrl(createBrowserDemoUrl({ v: 1, title: title || "Untitled browser demo", ciphertext: encrypted.ciphertext, iv: encrypted.iv, authTag: encrypted.authTag, fragmentKey: encrypted.fragmentKey, burnAfterReading: expiry === "Burn after reading", expiresAt: Date.now() + effectiveExpiry * 60_000 }));
        setPublished(true);
        toast.success("Self-contained encrypted demo link created", { description: "Vercel demo mode: no server or database received this note." });
        return;
      }
      const result = await createDrop.mutateAsync({ title, ciphertext: encrypted.ciphertext, iv: encrypted.iv, authTag: encrypted.authTag, expirationMinutes: effectiveExpiry, viewLimit: effectiveViewLimit, passphrase: password ? passphrase : undefined, burnAfterReading: expiry === "Burn after reading" });
      setCreatedUrl(`${result.url}#k=${encrypted.fragmentKey}`);
      setPublished(true);
      dashboard.refetch();
      toast.success("Drop encrypted in this browser", { description: "Only the sharing URL carries the decryption key." });
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not create this drop."); }
  }

  function copyLink() {
    navigator.clipboard?.writeText(createdUrl || "https://securedrop.local/d/7K4-M9Q");
    toast.success("Link copied", { description: "Anyone with the link can open this drop." });
  }

  return (
    <div className="app-shell">
      <aside className={`utility-rail ${mobileNav ? "is-open" : ""}`}>
        <div className="rail-top">
          <div className="brand-lockup">
            <img src={markImage} alt="" className="brand-mark" />
            <span className="brand-name"><span className="brand-word">secure</span><span>drop</span></span>
          </div>
          <button className="icon-button rail-close" aria-label="Close navigation" onClick={() => setMobileNav(false)}><X size={18} /></button>
        </div>
        <div className="rail-section-label">Workspace</div>
        <nav className="rail-nav" aria-label="Workspace navigation">
          <button className="rail-item active"><Plus size={17} /><span>New drop</span><kbd>N</kbd></button>
          <button className="rail-item" onClick={() => setLocation("/dashboard")}><Archive size={17} /><span>My drops</span><em>{dashboard.data?.drops?.length ?? 0}</em></button>
          <button className="rail-item" onClick={() => setLocation("/collections")}><Layers3 size={17} /><span>Collections</span></button>
        </nav>
        <div className="rail-divider" />
        <div className="rail-section-label">Your defaults</div>
        <button className={`rail-item rail-subtle ${focusedSetting === "protection" ? "settings-active" : ""}`} onClick={() => focusDefault("protection")}><ShieldCheck size={17} /><span>Protection</span></button>
        <button className={`rail-item rail-subtle ${focusedSetting === "expiry" ? "settings-active" : ""}`} onClick={() => focusDefault("expiry")}><Clock3 size={17} /><span>Expiry rules</span></button>
        <div className="rail-footer">
          <div className="privacy-stamp"><ShieldCheck size={16} /><div><strong>Private by design</strong><span>Zero knowledge storage</span></div></div>
          <button className="account-row" onClick={() => setProfileMenuOpen(true)} aria-expanded={profileMenuOpen}><div className="avatar">U</div><div><strong>User</strong><span>Personal workspace</span></div><ChevronDown size={15} /></button>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <button className="mobile-menu icon-button" aria-label="Open navigation" onClick={() => setMobileNav(true)}><Menu size={20} /></button>
          <div className="breadcrumbs"><span>Workspace</span><span className="slash">/</span><strong>New drop</strong></div>
          <div className="top-actions">
            <button className="help-button" onClick={() => setHowItWorksOpen(true)}><HelpCircle size={16} /> <span>How it works</span></button><button className="theme-toggle icon-button" onClick={() => toggleTheme?.()} aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"} title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}>{theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}</button>
            <div className="more-wrap">
              <button className="icon-button" aria-label="More options" onClick={() => setMenuOpen(!menuOpen)}><MoreHorizontal size={19} /></button>
              {menuOpen && <div className="popover-menu"><button>Keyboard shortcuts</button><button>Export preferences</button><button>Privacy policy</button></div>}
            </div>
            <div className="profile-wrap"><button className="avatar top-avatar" onClick={() => setProfileMenuOpen((open) => !open)} aria-label="Open User profile menu" aria-expanded={profileMenuOpen}>U</button>{profileMenuOpen && <div className="profile-menu" role="menu"><div className="profile-menu-head"><div className="avatar">U</div><div><strong>User</strong><span>Browser session</span></div></div><button role="menuitem" onClick={() => { setProfileMenuOpen(false); setLocation("/dashboard"); }}>My drops <ArrowUpRight size={14} /></button><button role="menuitem" onClick={() => { setProfileMenuOpen(false); setLocation("/collections"); }}>Collections <ArrowUpRight size={14} /></button><button role="menuitem" className="profile-menu-muted" onClick={() => { setProfileMenuOpen(false); void logout(); toast.success("Signed out"); }}>Sign out <ArrowUpRight size={14} /></button></div>}</div>
          </div>
        </header>

        <div className="workspace-content">
          <section className="intro-row">
            <div>
              <div className="eyebrow"><span className="eyebrow-dot" /> NEW DROP / PRIVATE COMPOSER</div>
              <h1>Share the note.<br /><i>Keep the boundary.</i></h1>
              <p className="intro-copy">A secure place for the things that should not live in a chat log, inbox, or permanent document.</p><button className="demo-button" onClick={loadSafeDemo}><Sparkles size={15} /> Load safe demo scenario</button>
            </div>
            <div className="intro-art" style={{ backgroundImage: `url(${heroImage})` }} aria-hidden="true"><span>01</span><span className="art-caption">ONE-TIME / ENCRYPTED</span></div>
          </section>

          <section className="composer-grid">
            <div className="editor-card">
              <div className="editor-meta"><span className="object-label"><FileText size={14} /> NOTE / UNTITLED</span><span className="save-state"><span className="status-dot" /> Saved locally</span></div>
              <input className="title-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Give this drop a name" aria-label="Drop title" />
              <div className="editor-tools"><button aria-label="Undo"><Undo2 size={16} /></button><button aria-label="Redo"><Redo2 size={16} /></button><span className="tool-separator" /><button className="format-active">Aa</button><button>Code</button><button>Link</button><span className="tool-hint">Markdown supported</span></div>
              <textarea className="note-editor" value={content} onChange={(e) => setContent(e.target.value)} aria-label="Secure note content" spellCheck="false" />
              <div className="editor-footer"><span>{chars.toLocaleString()} characters</span><span className="encryption-note"><KeyRound size={14} /> Encrypted in your browser</span></div>
            </div>

            <aside className={`protection-card ${showProtection ? "expanded" : ""} ${focusedSetting ? "settings-emphasis" : ""}`}>
              <div className="protection-heading"><div><div className="object-label"><ShieldCheck size={14} /> PROTECTION</div><h2>Set the boundary.</h2></div><div className="shield-seal"><ShieldCheck size={18} /></div></div>
              <p className="protection-copy">Choose how this note leaves your hands. Every setting below names the boundary it creates.</p>
              <div className="control-group"><label>Access mode</label><div className="segmented"><button className={access === "link" ? "selected" : ""} onClick={() => setAccess("link")}><Link2 size={15} /> Private link</button><button className={access === "team" ? "selected" : ""} onClick={() => setAccess("team")}><Layers3 size={15} /> Team</button></div></div>
              <div className="control-group" ref={expiryControlRef}><label>Self-destruct</label><div className="select-wrap"><select value={expiry} onChange={(e) => setExpiry(e.target.value)}><option>Burn after reading</option><option>In 1 hour</option><option>In 24 hours</option><option>In 7 days</option><option>Custom</option><option>Never</option></select><ChevronDown size={15} /></div>{expiry === "Custom" && <input className="custom-number-input" type="number" min={1} max={525600} value={customExpiry} onChange={(e) => setCustomExpiry(Number(e.target.value))} placeholder="Minutes" />}</div>
              {browserDemo ? <div className="drop-safe-note"><ShieldCheck size={15} /> Vercel contest demo: the encrypted payload and key stay in the URL fragment. Passphrase checks, global view limits, revocation, and audit logs require a server-backed deployment.</div> : <><div className="toggle-row" ref={protectionControlRef}><div><strong>Require a passphrase</strong><span>Extra layer for the link</span></div><button className={`switch ${password ? "on" : ""}`} role="switch" aria-checked={password} onClick={() => setPassword(!password)}><span /></button></div>{password && <input className="passphrase-input" type="password" minLength={8} value={passphrase} onChange={(e) => setPassphrase(e.target.value)} placeholder="Passphrase · 8+ characters" aria-label="Passphrase" />}<div className="view-limit-row"><label>View limit</label><select value={viewLimit} onChange={(e) => setViewLimit(Number(e.target.value))}><option value={1}>1 view</option><option value={3}>3 views</option><option value={5}>5 views</option><option value={10}>10 views</option><option value={0}>Custom</option></select>{viewLimit === 0 && <input className="custom-number-input" type="number" min={1} max={100} value={customViewLimit} onChange={(e) => setCustomViewLimit(Number(e.target.value))} placeholder="Views" />}</div></>}
              <button className="advanced-toggle" onClick={() => setShowProtection(!showProtection)}>{showProtection ? "Hide" : "Show"} advanced controls <ChevronDown size={14} className={showProtection ? "rotate" : ""} /></button>
              {showProtection && <div className="advanced-panel"><label><input type="checkbox" defaultChecked /> Disable indexing</label><label><input type="checkbox" /> Allow anonymous replies</label><label><input type="checkbox" defaultChecked /> Notify me before expiry</label></div>}
              <button className="publish-button" onClick={publish}><span>Create drop & set its boundary</span><ArrowUpRight size={18} /></button>
              <div className="publish-footnote"><ShieldCheck size={14} /> {browserDemo ? "Vercel contest demo · encrypted link only · no database persistence" : "No account required · Your content is encrypted before upload"}</div>
            </aside>
          </section>

          <section className="recent-section"><div className="section-heading"><div><div className="object-label"><Clock3 size={14} /> {browserDemo ? "CONTEST DEMO MODE" : "RECENTLY HANDLED"}</div><h2>{browserDemo ? "A self-contained boundary." : "Your drops"}</h2></div><button className="text-button" onClick={() => setLocation("/dashboard")}>{browserDemo ? "Demo limitations" : "Open the ledger"} <ArrowUpRight size={15} /></button></div><div className="artifact-note"><div className="artifact-thumb" style={{ backgroundImage: `url(${paperImage})` }}><span>DROP<br />INDEX</span></div><div><div className="object-label">{browserDemo ? "BROWSER-ONLY / NO PERSISTENCE" : "THE PAPER TRAIL / YOUR LIFECYCLE"}</div><p>{browserDemo ? "For this Vercel submission, the encrypted payload is embedded in the sharing link fragment. It demonstrates local encryption and local reveal without a database." : "Every note has a boundary. Track what is waiting, what was opened, and what is about to disappear."}</p></div><ArrowUpRight size={17} /></div><div className="recent-grid">{!browserDemo && dashboard.data?.drops?.slice(0, 3).map((drop) => <button className="drop-row" key={drop.slug} aria-label={`Open ${drop.title}; ${drop.status}`}><div className="drop-icon"><FileLock2 size={17} /></div><div className="drop-info"><strong>{drop.title}</strong><span>{new Date(drop.expiresAt).toLocaleString()}</span></div><span className={`drop-tag ${drop.status === "ACTIVE" ? "sage" : "bone"}`}>{drop.status}</span><ArrowUpRight className="row-arrow" size={16} /></button>)}{(browserDemo || !dashboard.data?.drops?.length) && recentDrops.map((drop) => <button className="drop-row" key={drop.title} aria-label={`Demo reference: ${drop.title}; ${drop.meta}`}><div className="drop-icon"><FileLock2 size={17} /></div><div className="drop-info"><strong>{drop.title}</strong><span>{browserDemo ? "Reference interface content — not a stored drop" : drop.meta}</span></div><span className={`drop-tag ${drop.tone}`}>{browserDemo ? "DEMO" : drop.tag}</span><ArrowUpRight className="row-arrow" size={16} /></button>)}</div></section>
          <footer className="page-footer"><span>SECUREDROP / A SMALLER SURFACE FOR SENSITIVE THINGS</span><span><Hash size={13} /> v0.8.4 · End-to-end encrypted</span></footer>
        </div>
      </main>

      {howItWorksOpen && <div className="modal-backdrop" onClick={() => setHowItWorksOpen(false)}><section className="how-modal" role="dialog" aria-modal="true" aria-labelledby="how-title" onClick={(e) => e.stopPropagation()}><button className="modal-close icon-button" aria-label="Close how it works" onClick={() => setHowItWorksOpen(false)}><X size={18} /></button><div className="modal-mark"><ShieldCheck size={22} /></div><div className="object-label">SECUREDROP / THE SHORT VERSION</div><h2 id="how-title">A note with an edge.</h2><p>SecureDrop turns sensitive text into a temporary, controlled handoff. The boundary is decided before the link leaves your hands.</p><div className="how-steps"><div className="how-step"><span>01</span><div><strong>Write</strong><p>Paste the note. It can be up to 100,000 characters.</p></div><FileText size={18} /></div><div className="how-step"><span>02</span><div><strong>Set the boundary</strong><p>Choose expiry, view limits, a passphrase, or burn-after-reading.</p></div><KeyRound size={18} /></div><div className="how-step"><span>03</span><div><strong>Share, then let go</strong><p>Once opened or revoked, the ciphertext is destroyed and the link closes.</p></div><Trash2 size={18} /></div></div><button className="done-button" onClick={() => setHowItWorksOpen(false)}>Back to the workspace</button></section></div>}

      {published && <div className="modal-backdrop" onClick={() => setPublished(false)}><div className="share-modal" onClick={(e) => e.stopPropagation()}><button className="modal-close icon-button" onClick={() => setPublished(false)}><X size={18} /></button><div className="modal-mark"><Check size={22} /></div><div className="object-label">DROP CREATED / READY TO SHARE</div><h2>Your boundary is set.</h2><p>{browserDemo ? "This Vercel submission link is self-contained: ciphertext and a browser-only key live in its URL fragment. It demonstrates local encryption and reveal, but not durable server-side one-time enforcement." : "This link can be opened once, then it disappears. Anyone with the link can access this drop."}</p><div className="share-link"><span>{createdUrl || "securedrop.local/d/7K4-M9Q"}</span><button onClick={copyLink}><Copy size={16} /> Copy</button></div><div className="modal-details"><span><Clock3 size={14} /> {expiry}</span><span><KeyRound size={14} /> {browserDemo ? "Browser-only demo" : password ? "Passphrase protected" : "Link only"}</span></div><button className="done-button" onClick={() => setPublished(false)}>Done</button></div></div>}
    </div>
  );
}
