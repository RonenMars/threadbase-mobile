// SessionDetailScreen.jsx — streamed terminal output

function SessionDetailScreen({ session, back, openQueue }) {
  const lane = window.LANES.find(l => l.id === session.lane);
  return (
    <div style={{flex:1, display:"flex", flexDirection:"column", overflow:"hidden"}}>
      <window.AppHeader
        back={back}
        title={session.title}
        sub={`${session.project} · ⎇ ${session.branch}`}
        right={
          <window.Pill color={lane.color} soft={lane.soft} dot pulse={session.live}>
            {session.live ? "Live" : lane.label}
          </window.Pill>
        }
      />
      {/* Terminal */}
      <div style={{
        flex:1, margin:"12px 16px", borderRadius:10, overflow:"hidden",
        background:"var(--tb-code-bg)", border:"1px solid var(--tb-code-border)",
        display:"flex", flexDirection:"column",
      }}>
        <div style={{
          padding:"8px 10px", borderBottom:"1px solid var(--tb-code-border)",
          display:"flex", alignItems:"center", gap:8,
          font:"600 11px/1 var(--font-mono)", color:"var(--tb-fg-2)",
        }}>
          <span style={{width:8, height:8, borderRadius:"50%", background:"#ff5f57"}}/>
          <span style={{width:8, height:8, borderRadius:"50%", background:"#febc2e"}}/>
          <span style={{width:8, height:8, borderRadius:"50%", background:"#28c840"}}/>
          <span style={{marginLeft:6}}>claude · {session.branch}</span>
          <button style={{
            marginLeft:"auto", background:"transparent", border:0, color:"var(--tb-fg-2)",
            cursor:"pointer", display:"inline-flex", alignItems:"center", gap:4, font:"inherit",
          }}>{window.MobileIcon.copy} Copy</button>
        </div>
        <div style={{
          flex:1, padding:"10px 12px", overflow:"auto",
          font:"500 12px/1.55 var(--font-mono)", color:"var(--tb-code-text)",
          whiteSpace:"pre-wrap",
        }}>
          <span style={{color:"var(--tb-blue-400)"}}>$</span> claude --resume {session.id}{"\n"}
          <span style={{color:"var(--tb-fg-3)"}}>Loading session… 23 messages restored.</span>{"\n\n"}
          <span style={{color:"var(--tb-amber-400)"}}>● Refactoring src/scanner/index.ts</span>{"\n"}
          {"  "}Reading existing implementation…{"\n"}
          {"  "}Found 3 cache patterns to consolidate.{"\n\n"}
          <span style={{color:"var(--tb-blue-400)"}}>→ Edit</span> scanner/src/index.ts{"\n"}
          <span style={{color:"var(--tb-success-400)"}}>{"  +12"}</span> <span style={{color:"var(--tb-danger-400)"}}>{"-3"}</span>{"\n\n"}
          <span style={{color:"var(--tb-blue-400)"}}>→ Bash</span> pnpm test --filter scanner{"\n"}
          <span style={{color:"var(--tb-success-400)"}}>  ✓ 24 tests passed (2.43s)</span>{"\n\n"}
          <span style={{color:"var(--tb-fg-2)"}}>The two-tier index is in place. Next: wire it to the FlexSearch metadata layer.</span>{"\n"}
          <span style={{color:"var(--tb-blue-400)", animation:"tb-blink 1s steps(2) infinite"}}>▊</span>
        </div>
      </div>
      {/* Footer actions */}
      <div style={{padding:"8px 16px 12px", display:"flex", gap:8}}>
        <button style={{
          flex:1, height:44, borderRadius:10, border:"1px solid var(--tb-ink-6)",
          background:"var(--tb-ink-3)", color:"var(--tb-fg-0)",
          font:"600 13px/1 var(--font-sans)", cursor:"pointer",
          display:"inline-flex", alignItems:"center", justifyContent:"center", gap:6,
        }}>
          {window.MobileIcon.down} Jump to bottom
        </button>
        <button onClick={openQueue} style={{
          flex:1, height:44, borderRadius:10, border:0,
          background:"var(--tb-amber-400)", color:"#2a1a04",
          font:"600 13px/1 var(--font-sans)", cursor:"pointer",
          boxShadow:"var(--shadow-glow-amber)",
        }}>
          Queue prompt
        </button>
      </div>
    </div>
  );
}

window.SessionDetailScreen = SessionDetailScreen;
