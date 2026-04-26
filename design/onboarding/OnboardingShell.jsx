// OnboardingShell.jsx — single-phone swipeable onboarding shell.
// Provides navigation context (step, next, back, goto) and renders pager dots.
// Each variation supplies its own array of step components.

const { useState: useStateOB, useEffect: useEffectOB, useRef: useRefOB, useMemo: useMemoOB, createContext: createCtxOB, useContext: useCtxOB } = React;

const OBCtx = createCtxOB(null);
window.useOB = () => useCtxOB(OBCtx);

// ─────────────────────────── Tiny SVG icon set ───────────────────────────
const OBI = {
  arrow: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>,
  back: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>,
  check: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
  bell: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10 21a2 2 0 0 0 4 0"/></svg>,
  globe: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>,
  zap: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>,
  layers: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>,
  list: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><circle cx="4" cy="6" r="1.4" fill="currentColor"/><circle cx="4" cy="12" r="1.4" fill="currentColor"/><circle cx="4" cy="18" r="1.4" fill="currentColor"/></svg>,
  terminal: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>,
  link: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/></svg>,
  shield: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2 4 6v6c0 5 3.5 9 8 10 4.5-1 8-5 8-10V6l-8-4z"/></svg>,
};
window.OBI = OBI;

// ─────────────────────────── Buttons ───────────────────────────
function PrimaryBtn({ children, onClick, disabled, icon = OBI.arrow }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      width:"100%", height:50, borderRadius:12,
      background: disabled ? "var(--tb-ink-3)" : "var(--tb-blue-500)",
      color: disabled ? "var(--tb-fg-3)" : "#0a1424",
      border:0, font:"600 15px/1 var(--font-sans)", letterSpacing:"-0.01em",
      display:"flex", alignItems:"center", justifyContent:"center", gap:8,
      cursor: disabled ? "default" : "pointer",
      boxShadow: disabled ? "none" : "0 0 0 1px rgba(99,179,255,0.3), 0 8px 24px -8px rgba(99,179,255,0.55)",
    }}>
      <span>{children}</span>
      {icon && <span style={{display:"inline-flex"}}>{icon}</span>}
    </button>
  );
}
function GhostBtn({ children, onClick }) {
  return (
    <button onClick={onClick} style={{
      width:"100%", height:44, borderRadius:10, background:"transparent",
      border:"1px solid var(--tb-ink-6)", color:"var(--tb-fg-2)",
      font:"500 13px/1 var(--font-sans)", cursor:"pointer",
    }}>{children}</button>
  );
}
window.OBPrimaryBtn = PrimaryBtn;
window.OBGhostBtn   = GhostBtn;

// ─────────────────────────── Pager dots ───────────────────────────
function PagerDots({ count, index }) {
  return (
    <div style={{display:"flex", justifyContent:"center", gap:6, padding:"0 0 4px"}}>
      {Array.from({length: count}).map((_, i) => (
        <span key={i} style={{
          height:6, borderRadius:3,
          width: i === index ? 22 : 6,
          background: i === index ? "var(--tb-blue-400)" : "var(--tb-ink-6)",
          transition:"width .25s ease, background .25s ease",
        }}/>
      ))}
    </div>
  );
}
window.OBPagerDots = PagerDots;

// ─────────────────────────── Shell ───────────────────────────
function OnboardingShell({ steps, accent = "blue", showBack = true, onDone }) {
  const [i, setI] = useStateOB(0);
  const [dir, setDir] = useStateOB(1);  // 1 forward, -1 back, 0 init
  const total = steps.length;

  const goto = (n) => { setDir(n > i ? 1 : -1); setI(Math.max(0, Math.min(total-1, n))); };
  const next = () => i < total - 1 ? goto(i + 1) : (onDone && onDone());
  const back = () => goto(Math.max(0, i - 1));

  // Touch swipe — left/right nav.
  const startX = useRefOB(null);
  const onTouchStart = (e) => { startX.current = e.touches[0].clientX; };
  const onTouchEnd = (e) => {
    if (startX.current == null) return;
    const dx = e.changedTouches[0].clientX - startX.current;
    if (Math.abs(dx) > 50) (dx < 0 ? next() : back());
    startX.current = null;
  };

  const Step = steps[i];

  return (
    <OBCtx.Provider value={{ i, total, next, back, goto, accent }}>
      <div
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        style={{
          height:"100%", minHeight:"100%",
          display:"flex", flexDirection:"column",
          background:"var(--tb-ink-1)", color:"var(--tb-fg-0)",
          fontFamily:"var(--font-sans)",
          position:"relative", overflow:"hidden",
        }}
      >
        {/* Top chrome — back + skip */}
        <div style={{
          paddingTop:54, padding:"54px 16px 8px",
          display:"flex", alignItems:"center", justifyContent:"space-between",
          minHeight: 36,
        }}>
          {showBack && i > 0 ? (
            <button onClick={back} style={{
              background:"transparent", border:0, color:"var(--tb-fg-2)",
              font:"500 13px/1 var(--font-sans)", cursor:"pointer",
              display:"flex", alignItems:"center", gap:4, padding:"6px 8px 6px 0",
            }}>{OBI.back}<span>Back</span></button>
          ) : <span/>}

          {i < total - 1 ? (
            <button onClick={() => goto(total - 1)} style={{
              background:"transparent", border:0, color:"var(--tb-fg-3)",
              font:"500 13px/1 var(--font-sans)", cursor:"pointer", padding:"6px 0 6px 8px",
            }}>Skip</button>
          ) : <span/>}
        </div>

        {/* Step content — keyed remount so transitions reset */}
        <div key={i} style={{
          flex:1, display:"flex", flexDirection:"column",
          animation: dir === -1 ? "ob-in-l .35s ease both" : "ob-in-r .35s ease both",
        }}>
          <Step/>
        </div>

        {/* Bottom: pager dots */}
        <div style={{padding:"10px 16px 18px"}}>
          <PagerDots count={total} index={i}/>
        </div>
      </div>
    </OBCtx.Provider>
  );
}

window.OnboardingShell = OnboardingShell;

// Inject keyframes once.
(() => {
  if (document.getElementById("ob-anim")) return;
  const s = document.createElement("style");
  s.id = "ob-anim";
  s.textContent = `
    @keyframes ob-in-r { from { opacity:0; transform: translateX(18px) } to { opacity:1; transform: none } }
    @keyframes ob-in-l { from { opacity:0; transform: translateX(-18px) } to { opacity:1; transform: none } }
    @keyframes ob-fade { from { opacity:0 } to { opacity:1 } }
    @keyframes ob-glow { 0%,100% { opacity:.55 } 50% { opacity:1 } }
    @keyframes ob-thread { 0% { stroke-dashoffset: 800 } 100% { stroke-dashoffset: 0 } }
    @keyframes ob-thread-pulse {
      0%   { stroke-dashoffset: 0;   opacity:.95 }
      50%  { stroke-dashoffset: 120; opacity:.7 }
      100% { stroke-dashoffset: 0;   opacity:.95 }
    }
    @keyframes ob-spinner { to { transform: rotate(360deg) } }
    @keyframes ob-cursor  { 50% { opacity: 0 } }
    @keyframes ob-typeIn  { from { width: 0 } to { width: var(--end, 100%) } }
    @keyframes ob-pop     { 0% { transform: scale(.8); opacity:0 } 60% { transform: scale(1.08); opacity:1 } 100% { transform: scale(1) } }
  `;
  document.head.appendChild(s);
})();
