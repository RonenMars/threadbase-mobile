// MobileApp.jsx — Threadbase mobile shell + screen router

const { useState } = React;

// ─────────────────────────── Icons (Lucide-style stroke) ───────────────────────────
const Icon = ({ d, size = 20, stroke = 2, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
       stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
    {d}
  </svg>
);
const I = {
  kanban: <Icon d={<><rect x="3" y="3" width="7" height="18" rx="1.5"/><rect x="14" y="3" width="7" height="11" rx="1.5"/></>}/>,
  history: <Icon d={<><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/><path d="M12 7v5l3 2"/></>}/>,
  terminal: <Icon d={<><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></>}/>,
  settings: <Icon d={<><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.65 1.65 0 0 0 15 19.4a1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09A1.65 1.65 0 0 0 15 4.6a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9c.36.36.59.86.6 1.42z"/></>}/>,
  search: <Icon d={<><circle cx="11" cy="11" r="7"/><line x1="20" y1="20" x2="16.5" y2="16.5"/></>}/>,
  plus: <Icon d={<><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>}/>,
  back: <Icon d={<><polyline points="15 18 9 12 15 6"/></>}/>,
  copy: <Icon d={<><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></>} size={16}/>,
  down: <Icon d={<><polyline points="6 9 12 15 18 9"/></>} size={16}/>,
  git: <Icon d={<><circle cx="6" cy="6" r="3"/><circle cx="18" cy="18" r="3"/><path d="M6 9v6a3 3 0 0 0 3 3h6"/></>} size={12}/>,
  qr: <Icon d={<><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><line x1="14" y1="14" x2="14" y2="17"/><line x1="17" y1="14" x2="20" y2="14"/><line x1="20" y1="17" x2="20" y2="20"/><line x1="14" y1="20" x2="17" y2="20"/></>} size={18}/>,
};

// ─────────────────────────── Tab bar ───────────────────────────
function TabBar({ tab, setTab }) {
  const items = [
    ["kanban", "Sessions", I.kanban],
    ["history", "History", I.history],
    ["terminal", "Terminal", I.terminal],
    ["settings", "Settings", I.settings],
  ];
  return (
    <div style={{
      position:"absolute", left:0, right:0, bottom:0,
      background:"var(--tb-ink-2)", borderTop:"1px solid var(--tb-ink-5)",
      display:"flex", padding:"6px 8px 24px",
    }}>
      {items.map(([id, label, ico]) => {
        const on = tab === id;
        return (
          <button key={id} onClick={() => setTab(id)} style={{
            flex:1, background:"transparent", border:0, padding:"6px 0",
            display:"flex", flexDirection:"column", alignItems:"center", gap:3,
            color: on ? "var(--tb-blue-400)" : "var(--tb-fg-3)", cursor:"pointer",
            fontFamily:"var(--font-sans)", fontSize:10, fontWeight:600,
          }}>
            {React.cloneElement(ico, { size: 22, stroke: on ? 2 : 1.7 })}
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ─────────────────────────── App header ───────────────────────────
function AppHeader({ title, sub, right, back }) {
  return (
    <div style={{
      padding:"54px 16px 12px", display:"flex", alignItems:"center", gap:10,
      borderBottom:"1px solid var(--color-divider)",
    }}>
      {back && (
        <button onClick={back} style={{
          background:"transparent", border:0, color:"var(--tb-blue-400)",
          padding:0, cursor:"pointer", display:"flex", alignItems:"center",
        }}>{I.back}</button>
      )}
      <div style={{flex:1, minWidth:0}}>
        <div style={{font:"600 17px/1.2 var(--font-sans)", color:"var(--tb-fg-0)", letterSpacing:"-0.01em"}}>{title}</div>
        {sub && <div style={{font:"500 11px/1.2 var(--font-mono)", color:"var(--tb-fg-3)", marginTop:3}}>{sub}</div>}
      </div>
      {right}
    </div>
  );
}

window.MobileIcon = I;
window.TabBar = TabBar;
window.AppHeader = AppHeader;
