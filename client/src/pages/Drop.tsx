import { useState } from "react";
import { useRoute } from "wouter";
import { Copy, KeyRound, QrCode, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { decryptFromShare, fragmentKeyFromLocation } from "@/lib/fragmentCrypto";

export default function Drop() {
  const [, params] = useRoute("/drop/:slug");
  const [passphrase, setPassphrase] = useState("");
  const [secret, setSecret] = useState<string | null>(null);
  const [destroyedAfterView, setDestroyedAfterView] = useState(false);
  const [lifecycle, setLifecycle] = useState<"EXPIRED" | "REVOKED" | "DESTROYED" | "LOCKED" | null>(null);
  const access = trpc.drops.access.useMutation();
  const slug = params?.slug || "";
  const shareUrl = typeof window === "undefined" ? `https://securedrop.local/drop/${slug}` : window.location.href;

  async function unlock() {
    try {
      const fragmentKey = fragmentKeyFromLocation();
      if (!fragmentKey) throw new Error("This link is missing its browser-only decryption key.");
      const result = await access.mutateAsync({ slug, passphrase: passphrase || undefined });
      const plaintext = await decryptFromShare({ ciphertext: result.ciphertext, iv: result.iv, authTag: result.authTag, fragmentKey });
      setSecret(plaintext);
      setDestroyedAfterView(result.destroyedAfterView);
      toast.success(result.destroyedAfterView ? "Opened once, then destroyed" : "Secret decrypted");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not open this drop";
      if (/too many/i.test(message)) setLifecycle("LOCKED"); else if (/expired/i.test(message)) setLifecycle("EXPIRED"); else if (/revoked/i.test(message)) setLifecycle("REVOKED"); else if (/destroyed/i.test(message)) setLifecycle("DESTROYED");
      toast.error(message);
    }
  }

  function copy() {
    if (secret) {
      navigator.clipboard?.writeText(secret);
      toast.success("Secret copied", { description: "It remains visible only in this browser tab." });
    }
  }

  return (
    <main className="drop-page">
      <div className="drop-panel">
        <div className="brand-lockup"><div className="brand-mark-fallback">S</div><span className="brand-name dark-name"><span className="brand-word">secure</span><span>drop</span></span></div>
        <div className="object-label"><ShieldCheck size={14} /> PRIVATE DROP / {slug.toUpperCase()}</div>
        {secret ? (
          <>
            <h1>Decrypted for you.</h1>
            <p className="drop-lead">This content was decrypted locally in this browser. The server only ever handled ciphertext; the decryption key stays in this link fragment.</p>
            <div className="secret-reveal"><pre>{secret}</pre><button onClick={copy}><Copy size={16} /> Copy secret</button></div>
            {destroyedAfterView && <div className="drop-safe-note"><ShieldCheck size={15} /> This was the permitted reveal. The encrypted payload has now been destroyed.</div>}
            <div className="qr-card"><div><QrCode size={22} /><strong>Continue on mobile</strong><span>Scan to open this same boundary on another device.</span></div><img alt="QR code for this secure drop" src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&color=10242b&bgcolor=f4f0e8&data=${encodeURIComponent(shareUrl)}`} /></div>
          </>
        ) : lifecycle ? (
          <>
            <div className="lifecycle-mark"><ShieldCheck size={22} /></div>
            <h1>{lifecycle === "LOCKED" ? "Boundary temporarily sealed." : lifecycle === "EXPIRED" ? "This drop has expired." : lifecycle === "REVOKED" ? "This drop was revoked." : "This drop was destroyed."}</h1>
            <p className="drop-lead">{lifecycle === "LOCKED" ? "Five incorrect passphrases paused access for 15 minutes. Try again later." : lifecycle === "EXPIRED" ? "The creator’s expiry window has closed, so this link can no longer reveal content." : lifecycle === "REVOKED" ? "The creator revoked this link and its ciphertext was deleted instantly." : "This drop has already been viewed or destroyed, so no plaintext remains to reveal."}</p>
            <div className="drop-safe-note"><ShieldCheck size={15} /> No plaintext was returned. The ciphertext remains protected.</div>
          </>
        ) : (
          <>
            <h1>Someone shared a boundary with you.</h1>
            <p className="drop-lead">This drop is protected. Authenticate to reveal the secret; nothing is returned before the passphrase is accepted.</p>
            <div className="auth-box"><label><KeyRound size={16} /> Passphrase</label><input type="password" value={passphrase} onChange={(e) => setPassphrase(e.target.value)} onKeyDown={(e) => e.key === "Enter" && unlock()} placeholder="Enter the passphrase" autoFocus /><button className="publish-button" onClick={unlock} disabled={access.isPending}><span>{access.isPending ? "Checking boundary…" : "Unlock secret"}</span><ShieldCheck size={17} /></button></div>
            <div className="drop-safe-note"><ShieldCheck size={15} /> Zero plaintext is returned until authentication succeeds.</div>
          </>
        )}
      </div>
    </main>
  );
}
