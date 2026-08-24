import { useState } from "react";
import { ArrowLeft, FolderPlus, Layers3, Plus, ShieldCheck } from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";

export default function Collections() {
  const [collections, setCollections] = useState<string[]>([]);
  function createCollection() {
    const name = window.prompt("Name this collection");
    if (!name?.trim()) return;
    setCollections((current) => [...current, name.trim()]);
    toast.success("Collection created", { description: "You can organize new drops here." });
  }
  return <main className="collections-page"><div className="collections-inner"><div className="dashboard-nav"><Link href="/" className="back-link"><ArrowLeft size={16} /> New drop</Link><div className="object-label"><Layers3 size={14} /> WORKSPACE INDEX</div></div><div className="collections-head"><div><div className="eyebrow"><span className="eyebrow-dot" /> ORGANIZE THE PAPER TRAIL</div><h1>Collections.</h1><p>Group related drops without changing their individual expiry, access, or destruction rules.</p></div><button className="collection-create" onClick={createCollection}><Plus size={16} /> New collection</button></div><div className="collection-grid">{collections.map((collection) => <button className="collection-card" key={collection}><div className="collection-icon"><FolderPlus size={19} /></div><strong>{collection}</strong><span>0 drops · ready for a boundary</span></button>)}{!collections.length && <div className="collections-empty"><div className="empty-art"><ShieldCheck size={24} /></div><strong>No collections yet</strong><span>Create a collection when you want a shared index for a project, handoff, or incident.</span><button onClick={createCollection}><Plus size={15} /> Create the first collection</button></div>}</div></div></main>;
}
