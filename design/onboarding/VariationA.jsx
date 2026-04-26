// VariationA.jsx — Safe variation: 6 steps, clean cards, primary buttons.

const VAStep = ({ children, style }) => (
  <div style={{flex:1, display:"flex", flexDirection:"column", padding:"8px 24px 0", ...style}}>{children}</div>
);

const VATitle = ({ children }) => (
  <h1 style={{
    font:"600 28px/1.1 var(--font-sans)", color:"var(--tb-fg-0)",
    letterSpacing:"-0.02em", margin:"0 0 10px", textWrap:"balance",
  }}>{children}</h1>
);
const VABody = ({ children }) => (
  <p style={{
    font:"400 15px/1.45 var(--font-sans)", color:"var(--tb-fg-2)",
    margin:"0 0 20px", textWrap:"pretty",
  }}>{children}</p>
);

// 1 ── Welcome — animated thread/glow signature moment
function VA1_Welcome() {
  const ob = window.useOB();
  return (
    <VAStep>
      <div style={{
        flex:1, display:"flex", flexDirection:"column", alignItems:"center",
        justifyContent:"center", textAlign:"center", paddingBottom:40,
      }}>
        {/* Glowing icon + thread */}
        <div style={{position:"relative", width:170, height:170, marginBottom:28}}>
          <div style={{
            position:"absolute", inset:0, borderRadius:"50%",
            background:"radial-gradient(circle, rgba(99,179,255,0.45) 0%, rgba(99,179,255,0) 70%)",
            animation:"ob-glow 2.4s ease-in-out infinite",
          }}/>
          <svg viewBox="0 0 170 170" width="170" height="170" style={{position:"absolute", inset:0}}>
            <defs>
              <linearGradient id="va-thread" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#63b3ff"/>
                <stop offset="100%" stopColor="#f08a24"/>
              </linearGradient>
            </defs>
            {/* Thread weaving around the mark */}
            <path
              d="M20 85 Q50 30 85 85 T150 85 Q120 140 85 85 T20 85"
              fill="none" stroke="url(#va-thread)" strokeWidth="1.4"
              strokeLinecap="round" strokeDasharray="6 6"
              style={{ animation: "ob-thread-pulse 4s linear infinite" }}
            />
          </svg>
          <img src="../assets/threadbase-icon.svg" alt=""
               style={{
                 width:88, height:88, borderRadius:20, position:"absolute",
                 left:"50%", top:"50%", transform:"translate(-50%, -50%)",
                 boxShadow:"0 0 0 1px rgba(99,179,255,0.25), 0 12px 32px -8px rgba(99,179,255,0.45)",
               }}/>
        </div>
        <h1 style={{
          font:"600 32px/1.05 var(--font-sans)", color:"var(--tb-fg-0)",
          letterSpacing:"-0.025em", margin:"0 0 10px",
        }}>Threadbase</h1>
        <p style={{
          font:"400 15px/1.5 var(--font-sans)", color:"var(--tb-fg-2)",
          margin:0, maxWidth:280,
        }}>Run Claude Code from anywhere. Your laptop does the work.</p>
      </div>
      <window.OBPrimaryBtn onClick={ob.next}>Get started</window.OBPrimaryBtn>
      <div style={{height:14}}/>
    </VAStep>
  );
}

// 2 ── Value prop
function VA2_Value() {
  const ob = window.useOB();
  const items = [
    { icon: window.OBI.globe,    title: "Run from anywhere", body: "Phone, café, bed. Your laptop keeps doing the work." },
    { icon: window.OBI.layers,   title: "Parallel sessions", body: "Spin up agents on different branches. Watch them on a kanban." },
    { icon: window.OBI.list,     title: "Queue prompts",     body: "Drop the next instruction even while a plan is still cooking." },
  ];
  return (
    <VAStep>
      <VATitle>Built for ambient coding.</VATitle>
      <VABody>Your phone is the remote — your laptop is the runtime.</VABody>
      <div style={{display:"flex", flexDirection:"column", gap:12}}>
        {items.map((it, i) => (
          <div key={i} style={{
            display:"flex", gap:12, alignItems:"flex-start",
            padding:"14px 14px", borderRadius:14,
            background:"var(--tb-ink-2)", border:"1px solid var(--tb-ink-5)",
            animation: `ob-fade .4s ease both`, animationDelay: `${i*70}ms`,
          }}>
            <div style={{
              width:36, height:36, borderRadius:10, flexShrink:0,
              background:"var(--tb-ink-3)", color:"var(--tb-blue-400)",
              display:"flex", alignItems:"center", justifyContent:"center",
            }}>{it.icon}</div>
            <div style={{flex:1, minWidth:0}}>
              <div style={{font:"600 14px/1.2 var(--font-sans)", color:"var(--tb-fg-0)", marginBottom:3}}>{it.title}</div>
              <div style={{font:"400 12.5px/1.45 var(--font-sans)", color:"var(--tb-fg-3)"}}>{it.body}</div>
            </div>
          </div>
        ))}
      </div>
      <div style={{flex:1}}/>
      <window.OBPrimaryBtn onClick={ob.next}>Continue</window.OBPrimaryBtn>
      <div style={{height:14}}/>
    </VAStep>
  );
}

// 3 ── Connect (manual URL + token)
function VA3_Connect() {
  const ob = window.useOB();
  const [url, setUrl] = React.useState("https://threadbase.local:7331");
  const [tok, setTok] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [ok, setOk] = React.useState(false);

  const valid = url.startsWith("http") && tok.length >= 8;

  const connect = () => {
    if (!valid || busy) return;
    setBusy(true);
    setTimeout(() => { setBusy(false); setOk(true); setTimeout(ob.next, 650); }, 1100);
  };

  const Field = ({ label, value, onChange, placeholder, mono = true, secret }) => (
    <label style={{display:"flex", flexDirection:"column", gap:6}}>
      <span style={{font:"500 11px/1 var(--font-mono)", color:"var(--tb-fg-3)", letterSpacing:"0.04em", textTransform:"uppercase"}}>{label}</span>
      <input
        value={value} onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        type={secret ? "password" : "text"}
        autoCapitalize="none" autoCorrect="off" spellCheck={false}
        style={{
          height:46, borderRadius:10,
          background:"var(--tb-ink-2)", border:"1px solid var(--tb-ink-5)",
          color:"var(--tb-fg-0)", padding:"0 12px",
          font: mono ? "500 13px/1 var(--font-mono)" : "500 14px/1 var(--font-sans)",
          outline:"none",
        }}/>
    </label>
  );

  return (
    <VAStep>
      <VATitle>Connect a runtime.</VATitle>
      <VABody>Point at the Threadbase agent running on your laptop.</VABody>

      <div style={{display:"flex", flexDirection:"column", gap:14}}>
        <Field label="Server URL"  value={url} onChange={setUrl} placeholder="https://your-mac.local:7331"/>
        <Field label="Pairing token" value={tok} onChange={setTok} placeholder="paste from desktop" secret/>
      </div>

      {/* Status line */}
      <div style={{
        marginTop:14, font:"500 11.5px/1.4 var(--font-mono)", color:"var(--tb-fg-3)",
        display:"flex", alignItems:"center", gap:8, minHeight:18,
      }}>
        {busy && (
          <>
            <span style={{
              width:10, height:10, borderRadius:"50%",
              border:"1.5px solid var(--tb-blue-400)", borderTopColor:"transparent",
              animation:"ob-spinner .8s linear infinite",
            }}/>
            <span>handshake → {url.replace(/^https?:\/\//,"")}</span>
          </>
        )}
        {ok && !busy && (
          <span style={{color:"var(--tb-green-400)"}}>✓ paired · session token cached</span>
        )}
        {!busy && !ok && valid && <span>ready · tap connect</span>}
        {!busy && !ok && !valid && <span style={{color:"var(--tb-fg-4)"}}>enter url and token</span>}
      </div>

      <div style={{flex:1}}/>
      <window.OBPrimaryBtn onClick={connect} disabled={!valid || busy || ok}>
        {ok ? "Connected" : busy ? "Connecting…" : "Connect"}
      </window.OBPrimaryBtn>
      <div style={{height:14}}/>
    </VAStep>
  );
}

// 4 ── Notifications
function VA4_Notifs() {
  const ob = window.useOB();
  const [enabled, setEnabled] = React.useState(false);
  const events = [
    { c: "var(--tb-blue-400)",  l: "Plan ready",     d: "Agent is waiting for your call." },
    { c: "var(--tb-amber-400)", l: "Needs input",    d: "A tool wants confirmation." },
    { c: "var(--tb-red-400)",   l: "Run failed",     d: "Tests broke; check the trace." },
  ];
  return (
    <VAStep>
      <VATitle>Don't sit there refreshing.</VATitle>
      <VABody>Push notifications fire only on real events.</VABody>

      <div style={{
        background:"var(--tb-ink-2)", border:"1px solid var(--tb-ink-5)",
        borderRadius:14, padding:14, display:"flex", flexDirection:"column", gap:10,
      }}>
        {events.map((e, i) => (
          <div key={i} style={{display:"flex", alignItems:"center", gap:10}}>
            <span style={{width:8, height:8, borderRadius:"50%", background:e.c, flexShrink:0}}/>
            <div style={{flex:1}}>
              <div style={{font:"600 13px/1.2 var(--font-sans)", color:"var(--tb-fg-0)"}}>{e.l}</div>
              <div style={{font:"400 12px/1.3 var(--font-sans)", color:"var(--tb-fg-3)"}}>{e.d}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{
        marginTop:14, padding:"12px 14px", borderRadius:12,
        background:"var(--tb-ink-2)", border:"1px solid var(--tb-ink-5)",
        display:"flex", alignItems:"center", gap:10,
      }}>
        <span style={{color:"var(--tb-blue-400)"}}>{window.OBI.bell}</span>
        <div style={{flex:1, font:"500 12.5px/1.3 var(--font-sans)", color:"var(--tb-fg-1)"}}>
          Allow notifications
        </div>
        <button onClick={() => setEnabled(v => !v)} aria-pressed={enabled} style={{
          width:42, height:24, borderRadius:24, padding:0, border:0, cursor:"pointer",
          background: enabled ? "var(--tb-blue-500)" : "var(--tb-ink-5)",
          position:"relative", transition:"background .2s ease",
        }}>
          <span style={{
            position:"absolute", top:2, left: enabled ? 20 : 2,
            width:20, height:20, borderRadius:"50%", background:"#fff",
            transition:"left .2s ease",
          }}/>
        </button>
      </div>

      <div style={{flex:1}}/>
      <window.OBPrimaryBtn onClick={ob.next}>{enabled ? "Continue" : "Skip for now"}</window.OBPrimaryBtn>
      <div style={{height:14}}/>
    </VAStep>
  );
}

// 5 ── Tour: kanban / queue / terminal
function VA5_Tour() {
  const ob = window.useOB();
  const [n, setN] = React.useState(0);
  const slides = [
    {
      icon: window.OBI.layers, label: "Kanban",
      title: "Sessions, side by side.",
      body: "Each agent gets a card. Lanes track Running, Plan, Waiting, Done.",
      art: <KanbanArt/>,
    },
    {
      icon: window.OBI.list, label: "Queue",
      title: "Stack the next move.",
      body: "Drop prompts onto a session — they fire in order, even while you sleep.",
      art: <QueueArt/>,
    },
    {
      icon: window.OBI.terminal, label: "Terminal",
      title: "Watch it think.",
      body: "Streamed stdout with tool calls inlined. Tap to grep. Long-press to copy.",
      art: <TerminalArt/>,
    },
  ];
  const s = slides[n];
  return (
    <VAStep>
      <div style={{display:"flex", gap:6, marginBottom:14}}>
        {slides.map((sl, i) => (
          <button key={i} onClick={() => setN(i)} style={{
            flex:1, height:32, borderRadius:8,
            background: i === n ? "var(--tb-ink-3)" : "transparent",
            border:`1px solid ${i === n ? "var(--tb-ink-6)" : "var(--tb-ink-5)"}`,
            color: i === n ? "var(--tb-fg-0)" : "var(--tb-fg-3)",
            font:"600 11px/1 var(--font-sans)", cursor:"pointer",
            display:"flex", alignItems:"center", justifyContent:"center", gap:6,
          }}>
            <span style={{display:"inline-flex", transform:"scale(0.78)"}}>{sl.icon}</span>
            {sl.label}
          </button>
        ))}
      </div>

      <div key={n} style={{animation:"ob-fade .25s ease both"}}>
        <div style={{
          height:180, borderRadius:14, overflow:"hidden", marginBottom:14,
          background:"var(--tb-ink-0)", border:"1px solid var(--tb-ink-5)",
          position:"relative",
        }}>{s.art}</div>
        <h2 style={{font:"600 19px/1.2 var(--font-sans)", color:"var(--tb-fg-0)", letterSpacing:"-0.015em", margin:"0 0 6px"}}>{s.title}</h2>
        <p style={{font:"400 13.5px/1.45 var(--font-sans)", color:"var(--tb-fg-2)", margin:0}}>{s.body}</p>
      </div>

      <div style={{flex:1}}/>
      {n < slides.length - 1
        ? <window.OBPrimaryBtn onClick={() => setN(n + 1)}>Next concept</window.OBPrimaryBtn>
        : <window.OBPrimaryBtn onClick={ob.next}>I'm ready</window.OBPrimaryBtn>}
      <div style={{height:14}}/>
    </VAStep>
  );
}

// Tour artwork — small static illustrations
function KanbanArt() {
  const lanes = [
    { l:"running", c:"var(--tb-blue-400)", n:2 },
    { l:"plan",    c:"var(--tb-amber-400)", n:1 },
    { l:"waiting", c:"var(--tb-fg-4)", n:1 },
  ];
  return (
    <div style={{display:"flex", gap:8, padding:12, height:"100%"}}>
      {lanes.map((ln, i) => (
        <div key={i} style={{flex:1, display:"flex", flexDirection:"column", gap:6}}>
          <div style={{
            font:"600 9px/1 var(--font-mono)", color:ln.c, letterSpacing:"0.06em",
            textTransform:"uppercase", padding:"4px 0",
          }}>{ln.l}</div>
          {Array.from({length: ln.n}).map((_, k) => (
            <div key={k} style={{
              borderRadius:6, height:38,
              background:"var(--tb-ink-2)", border:`1px solid var(--tb-ink-5)`,
              borderLeft:`2px solid ${ln.c}`, padding:"5px 6px",
            }}>
              <div style={{height:5, width:"70%", background:"var(--tb-ink-5)", borderRadius:2, marginBottom:4}}/>
              <div style={{height:4, width:"40%", background:"var(--tb-ink-4)", borderRadius:2}}/>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
function QueueArt() {
  const items = ["fix flaky test in auth.spec", "add rate limit middleware", "deploy preview to staging"];
  return (
    <div style={{padding:12, display:"flex", flexDirection:"column", gap:6, height:"100%"}}>
      {items.map((t, i) => (
        <div key={i} style={{
          padding:"8px 10px", borderRadius:8,
          background: i === 0 ? "var(--tb-ink-3)" : "var(--tb-ink-2)",
          border:`1px solid ${i === 0 ? "var(--tb-blue-500)" : "var(--tb-ink-5)"}`,
          display:"flex", alignItems:"center", gap:8,
          opacity: 1 - i*0.18,
        }}>
          <span style={{
            font:"600 9px/1 var(--font-mono)",
            color: i === 0 ? "var(--tb-blue-400)" : "var(--tb-fg-4)",
            width:14,
          }}>{i+1}</span>
          <span style={{font:"500 11px/1.2 var(--font-sans)", color:"var(--tb-fg-1)", flex:1}}>{t}</span>
        </div>
      ))}
    </div>
  );
}
function TerminalArt() {
  return (
    <div style={{
      padding:12, font:"500 10.5px/1.5 var(--font-mono)",
      color:"var(--tb-fg-2)", height:"100%", overflow:"hidden",
    }}>
      <div><span style={{color:"var(--tb-blue-400)"}}>$</span> claude run --branch feat/queue</div>
      <div style={{color:"var(--tb-fg-3)"}}>→ scanning 412 files…</div>
      <div style={{color:"var(--tb-amber-400)"}}>● tool: Read src/queue/index.ts</div>
      <div style={{color:"var(--tb-fg-3)"}}>→ patch ready (3 files, +84/-12)</div>
      <div style={{color:"var(--tb-green-400)"}}>✓ tests passed (28)</div>
      <div><span style={{color:"var(--tb-fg-0)"}}>plan</span> <span style={{
        display:"inline-block", width:7, height:13, background:"var(--tb-fg-0)",
        verticalAlign:"middle", animation:"ob-cursor 1s steps(2) infinite",
      }}/></div>
    </div>
  );
}

// 6 ── Done
function VA6_Done() {
  const ob = window.useOB();
  return (
    <VAStep>
      <div style={{flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", textAlign:"center"}}>
        <div style={{
          width:88, height:88, borderRadius:"50%",
          background:"radial-gradient(circle, rgba(74,222,128,0.25) 0%, rgba(74,222,128,0) 70%)",
          display:"flex", alignItems:"center", justifyContent:"center", marginBottom:20,
          animation:"ob-pop .5s ease both",
        }}>
          <div style={{
            width:56, height:56, borderRadius:"50%",
            background:"var(--tb-green-500)", color:"#0a1424",
            display:"flex", alignItems:"center", justifyContent:"center",
          }}>{window.OBI.check}</div>
        </div>
        <h1 style={{font:"600 28px/1.1 var(--font-sans)", color:"var(--tb-fg-0)", letterSpacing:"-0.02em", margin:"0 0 8px"}}>
          You're wired up.
        </h1>
        <p style={{font:"400 14px/1.5 var(--font-sans)", color:"var(--tb-fg-2)", margin:"0 0 24px", maxWidth:280}}>
          Threadbase is paired with your laptop. Open a session whenever you want.
        </p>
        <div style={{
          padding:"10px 14px", borderRadius:10, background:"var(--tb-ink-2)",
          border:"1px solid var(--tb-ink-5)", font:"500 11.5px/1.4 var(--font-mono)",
          color:"var(--tb-fg-3)", display:"flex", alignItems:"center", gap:8,
        }}>
          <span style={{width:7, height:7, borderRadius:"50%", background:"var(--tb-green-500)"}}/>
          paired · work-laptop.local · 7331
        </div>
      </div>
      <window.OBPrimaryBtn onClick={() => ob.goto(0)} icon={null}>Open Threadbase</window.OBPrimaryBtn>
      <div style={{height:14}}/>
    </VAStep>
  );
}

window.VAStepsAll = [VA1_Welcome, VA2_Value, VA3_Connect, VA4_Notifs, VA5_Tour, VA6_Done];
