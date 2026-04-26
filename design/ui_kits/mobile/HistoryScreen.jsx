// HistoryScreen.jsx — searchable conversation history

const { useState: useStateH } = React;
const HISTORY = [
  { id:"h1", title:"Refactor JSONL scanner to two-tier index", project:"scanner", time:"now",  msgs:23, live:true },
  { id:"h2", title:"VS Code TreeView watcher debounce",          project:"vscode",  time:"4m",   msgs:11 },
  { id:"h3", title:"JCEF bridge token & model metadata",          project:"intellij",time:"12m",  msgs:7 },
  { id:"h4", title:"Plan approval — push notification redesign",  project:"mobile",  time:"22m",  msgs:14 },
  { id:"h5", title:"Codex CLI provider auto-discovery",           project:"core",    time:"1h",   msgs:6 },
  { id:"h6", title:"Add Conventional Commits hook",               project:"scanner", time:"3h",   msgs:4 },
  { id:"h7", title:"Document multi-profile setup",                project:"docs",    time:"5h",   msgs:9 },
  { id:"h8", title:"Lucene index build on Windows",               project:"intellij",time:"1d",   msgs:18 },
  { id:"h9", title:"Migrate cli to streamer package",             project:"streamer",time:"2d",   msgs:42 },
];

function HistoryScreen({ openSession }) {
  const [q, setQ] = useStateH("");
  const items = HISTORY.filter(h => h.title.toLowerCase().includes(q.toLowerCase()) || h.project.includes(q.toLowerCase()));
  return (
    <div style={{flex:1, display:"flex", flexDirection:"column", overflow:"hidden"}}>
      <div style={{padding:"4px 16px 12px"}}>
        <div style={{
          background:"var(--tb-ink-2)", border:"1px solid var(--tb-ink-5)",
          borderRadius:10, height:40, padding:"0 12px",
          display:"flex", alignItems:"center", gap:10,
        }}>
          <span style={{color:"var(--tb-fg-3)", display:"inline-flex"}}>{window.MobileIcon.search}</span>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search conversations…" style={{
            flex:1, background:"transparent", border:0, outline:0,
            color:"var(--tb-fg-0)", font:"400 14px/1 var(--font-sans)",
          }}/>
          {q && <button onClick={() => setQ("")} style={{
            background:"transparent", border:0, cursor:"pointer",
            color:"var(--tb-fg-3)", font:"400 16px/1 var(--font-sans)",
          }}>×</button>}
        </div>
        <div style={{display:"flex", gap:6, marginTop:10, overflowX:"auto"}}>
          {["All","Today","7d","30d"].map((c,i) => (
            <button key={c} style={{
              flex:"none", padding:"6px 12px", borderRadius:999, cursor:"pointer",
              background: i===0 ? "var(--color-accent-soft)" : "var(--tb-ink-2)",
              border:`1px solid ${i===0 ? "var(--tb-blue-400)" : "var(--tb-ink-5)"}`,
              color: i===0 ? "var(--tb-blue-400)" : "var(--tb-fg-2)",
              font:"600 11px/1 var(--font-sans)",
            }}>{c}</button>
          ))}
        </div>
      </div>
      <div style={{flex:1, overflow:"auto"}}>
        {items.map(h => (
          <button key={h.id} onClick={() => openSession({...h, lane:h.live?"running":"completed", branch:"main"})} style={{
            width:"100%", textAlign:"left", background:"transparent",
            border:0, borderBottom:"1px solid var(--color-divider)",
            padding:"12px 16px", cursor:"pointer",
            display:"flex", alignItems:"center", gap:12,
          }}>
            <div style={{
              width:28, height:28, borderRadius:6, background:"var(--tb-ink-3)",
              display:"flex", alignItems:"center", justifyContent:"center", flex:"none",
              font:"700 11px/1 var(--font-mono)", color:"var(--tb-fg-2)",
            }}>{h.project.slice(0,2)}</div>
            <div style={{flex:1, minWidth:0}}>
              <div style={{font:"600 13px/1.3 var(--font-sans)", color:"var(--tb-fg-0)",
                overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{h.title}</div>
              <div style={{font:"500 11px/1.3 var(--font-mono)", color:"var(--tb-fg-3)", marginTop:3}}>
                {h.project} · {h.msgs} msgs
              </div>
            </div>
            <div style={{display:"flex", flexDirection:"column", alignItems:"flex-end", gap:4, flex:"none"}}>
              {h.live && <window.Pill color="var(--tb-amber-400)" soft="rgba(240,138,36,0.14)" dot pulse>Live</window.Pill>}
              <span style={{font:"500 10px/1 var(--font-mono)", color:"var(--tb-fg-3)"}}>{h.time}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
window.HistoryScreen = HistoryScreen;
