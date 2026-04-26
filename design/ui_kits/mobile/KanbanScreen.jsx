// KanbanScreen.jsx — Threadbase mobile · Sessions Kanban
const { useState: useStateK } = React;

const SESSIONS = [
  { id:"s1", lane:"running", title:"Refactor scanner two-tier index", project:"threadbase/scanner", branch:"feat/scanner-v2", msgs:23, time:"now", live:true },
  { id:"s2", lane:"running", title:"VS Code TreeView watcher debounce", project:"threadbase/vscode", branch:"main", msgs:11, time:"4m" },
  { id:"s3", lane:"running", title:"JCEF bridge token metadata", project:"threadbase/intellij", branch:"feat/jcef-tokens", msgs:7, time:"12m" },
  { id:"s4", lane:"waiting", title:"Awaiting plan approval — push notif redesign", project:"threadbase/mobile", branch:"feat/push-v2", msgs:14, time:"22m" },
  { id:"s5", lane:"waiting", title:"Codex provider auto-discovery", project:"threadbase/core", branch:"feat/providers", msgs:6, time:"1h" },
  { id:"s6", lane:"completed", title:"Add Conventional Commits hook", project:"threadbase/scanner", branch:"chore/commits", msgs:4, time:"3h" },
  { id:"s7", lane:"completed", title:"Document multi-profile setup", project:"threadbase/docs", branch:"docs/profiles", msgs:9, time:"5h" },
  { id:"s8", lane:"failed", title:"Lucene index build on Windows", project:"threadbase/intellij", branch:"fix/win-lucene", msgs:18, time:"1d", err:"exit 137" },
];

const LANES = [
  { id:"running",   label:"Running",   color:"var(--tb-blue-400)",    soft:"rgba(99,179,255,0.14)"  },
  { id:"waiting",   label:"Waiting",   color:"var(--tb-amber-400)",   soft:"rgba(240,138,36,0.14)"  },
  { id:"completed", label:"Completed", color:"var(--tb-success-400)", soft:"rgba(74,222,128,0.14)"  },
  { id:"failed",    label:"Failed",    color:"var(--tb-danger-400)",  soft:"rgba(255,107,107,0.14)" },
];

function Pill({ color, soft, dot, pulse, children }) {
  return (
    <span style={{
      display:"inline-flex", alignItems:"center", gap:6,
      padding:"4px 8px", borderRadius:999, background:soft, color,
      font:"600 10px/1 var(--font-sans)", letterSpacing:"0.06em", textTransform:"uppercase",
    }}>
      {dot && <span style={{
        width:6, height:6, borderRadius:"50%", background:color,
        boxShadow: pulse ? `0 0 8px ${color}` : "none",
        animation: pulse ? "tb-pulse 1.6s ease-in-out infinite" : "none",
      }}/>}
      {children}
    </span>
  );
}

function SessionCard({ s, onTap }) {
  const lane = LANES.find(l => l.id === s.lane);
  return (
    <button onClick={onTap} style={{
      width:"100%", textAlign:"left",
      background:"var(--tb-ink-2)", border:"1px solid var(--tb-ink-5)",
      borderRadius:12, padding:12, marginBottom:10,
      display:"flex", flexDirection:"column", gap:8, cursor:"pointer",
      borderLeft:`3px solid ${lane.color}`,
    }}>
      <div style={{display:"flex", alignItems:"center", gap:8}}>
        <Pill color={lane.color} soft={lane.soft} dot pulse={s.live}>
          {s.live ? "Live" : lane.label}
        </Pill>
        <span style={{marginLeft:"auto", font:"500 10px/1 var(--font-mono)", color:"var(--tb-fg-3)"}}>{s.time}</span>
      </div>
      <div style={{font:"600 14px/1.35 var(--font-sans)", color:"var(--tb-fg-0)", letterSpacing:"-0.005em"}}>{s.title}</div>
      <div style={{display:"flex", alignItems:"center", gap:8, font:"500 11px/1 var(--font-mono)", color:"var(--tb-fg-3)"}}>
        <span style={{display:"inline-flex", alignItems:"center", gap:4}}>{window.MobileIcon.git} {s.branch}</span>
        <span style={{opacity:.4}}>·</span>
        <span>{s.msgs} msgs</span>
        {s.err && <><span style={{opacity:.4}}>·</span><span style={{color:"var(--tb-danger-400)"}}>{s.err}</span></>}
      </div>
    </button>
  );
}

function KanbanScreen({ openSession, openQueue }) {
  const [lane, setLane] = useStateK("running");
  const items = SESSIONS.filter(s => s.lane === lane);
  return (
    <div style={{flex:1, display:"flex", flexDirection:"column", overflow:"hidden"}}>
      {/* Lane chips */}
      <div style={{display:"flex", gap:6, padding:"10px 16px 14px", overflowX:"auto"}}>
        {LANES.map(l => {
          const active = l.id === lane;
          const count = SESSIONS.filter(s => s.lane === l.id).length;
          return (
            <button key={l.id} onClick={() => setLane(l.id)} style={{
              flex:"none", display:"inline-flex", alignItems:"center", gap:6,
              padding:"7px 12px", borderRadius:999, cursor:"pointer",
              background: active ? l.soft : "var(--tb-ink-2)",
              border:`1px solid ${active ? l.color : "var(--tb-ink-5)"}`,
              color: active ? l.color : "var(--tb-fg-2)",
              font:"600 12px/1 var(--font-sans)",
            }}>
              <span style={{width:6, height:6, borderRadius:"50%", background:l.color}}/>
              {l.label}
              <span style={{
                background: active ? l.color : "var(--tb-ink-4)",
                color: active ? "var(--tb-ink-1)" : "var(--tb-fg-2)",
                padding:"1px 6px", borderRadius:999,
                font:"700 10px/1 var(--font-mono)",
              }}>{count}</span>
            </button>
          );
        })}
      </div>
      {/* Cards list */}
      <div style={{flex:1, overflow:"auto", padding:"0 16px 16px"}}>
        {items.map(s => <SessionCard key={s.id} s={s} onTap={() => openSession(s)}/>)}
        {items.length === 0 && (
          <div style={{textAlign:"center", padding:"40px 20px", color:"var(--tb-fg-3)", font:"500 13px/1.5 var(--font-sans)"}}>
            No sessions in this lane.
          </div>
        )}
      </div>
      {/* FAB */}
      <button onClick={openQueue} style={{
        position:"absolute", right:18, bottom:96, width:52, height:52, borderRadius:26,
        background:"var(--tb-amber-400)", color:"#2a1a04", border:0, cursor:"pointer",
        display:"flex", alignItems:"center", justifyContent:"center",
        boxShadow:"var(--shadow-glow-amber)",
      }}>{window.MobileIcon.plus}</button>
    </div>
  );
}

window.KanbanScreen = KanbanScreen;
window.SESSIONS = SESSIONS;
window.LANES = LANES;
window.Pill = Pill;
