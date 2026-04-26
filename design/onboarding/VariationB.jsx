// VariationB.jsx — Novel variation: terminal-flavored, glow-heavy, signature motion.

const VBScreen = ({ children, style }) => (
  <div style={{flex:1, display:"flex", flexDirection:"column", padding:"4px 22px 0", ...style}}>{children}</div>
);

// 1 ── Welcome — heavy thread/glow signature moment, full-bleed
function VB1_Welcome() {
  const ob = window.useOB();
  return (
    <div style={{flex:1, display:"flex", flexDirection:"column", position:"relative"}}>
      {/* Background field of threads */}
      <svg viewBox="0 0 360 580" preserveAspectRatio="xMidYMid slice"
           style={{position:"absolute", inset:0, width:"100%", height:"100%", opacity:0.55}}>
        <defs>
          <linearGradient id="vb-thread-a" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#63b3ff" stopOpacity="0"/>
            <stop offset="50%" stopColor="#63b3ff" stopOpacity="0.9"/>
            <stop offset="100%" stopColor="#63b3ff" stopOpacity="0"/>
          </linearGradient>
          <linearGradient id="vb-thread-b" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#f08a24" stopOpacity="0"/>
            <stop offset="50%" stopColor="#f08a24" stopOpacity="0.7"/>
            <stop offset="100%" stopColor="#f08a24" stopOpacity="0"/>
          </linearGradient>
        </defs>
        {Array.from({length: 7}).map((_, i) => (
          <path key={i}
            d={`M-30 ${110 + i*55} Q 90 ${85 + i*55} 180 ${120 + i*55} T 400 ${110 + i*55}`}
            fill="none"
            stroke={i%2 ? "url(#vb-thread-b)" : "url(#vb-thread-a)"}
            strokeWidth={i%3 === 0 ? 1.4 : 0.8}
            strokeDasharray={i%2 ? "2 8" : "4 6"}
            style={{
              animation: `ob-thread-pulse ${5 + i*0.4}s linear infinite`,
              animationDelay: `${i*0.3}s`,
            }}
          />
        ))}
      </svg>

      {/* Center mark */}
      <div style={{
        flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
        position:"relative", padding:"0 24px",
      }}>
        <div style={{position:"relative", marginBottom:32}}>
          <div style={{
            position:"absolute", inset:-30, borderRadius:"50%",
            background:"radial-gradient(circle, rgba(99,179,255,0.4) 0%, rgba(99,179,255,0) 70%)",
            animation:"ob-glow 2.4s ease-in-out infinite",
          }}/>
          <img src="../assets/threadbase-icon.svg" alt="" style={{
            width:96, height:96, borderRadius:22, position:"relative",
            boxShadow:"0 0 0 1px rgba(99,179,255,0.3), 0 16px 40px -8px rgba(99,179,255,0.55)",
          }}/>
        </div>
        <div style={{
          font:"500 11px/1 var(--font-mono)", color:"var(--tb-fg-3)",
          letterSpacing:"0.18em", textTransform:"uppercase", marginBottom:14,
        }}>// ambient coding</div>
        <h1 style={{
          font:"600 36px/1.0 var(--font-sans)", color:"var(--tb-fg-0)",
          letterSpacing:"-0.03em", margin:"0 0 14px", textAlign:"center",
        }}>Pull a thread.<br/><span style={{color:"var(--tb-blue-400)"}}>Watch it weave.</span></h1>
        <p style={{
          font:"400 14.5px/1.5 var(--font-sans)", color:"var(--tb-fg-2)",
          margin:0, textAlign:"center", maxWidth:280,
        }}>A remote control for Claude Code, on the device you actually carry.</p>
      </div>

      <div style={{padding:"0 22px", position:"relative"}}>
        <window.OBPrimaryBtn onClick={ob.next}>Begin handshake</window.OBPrimaryBtn>
        <div style={{height:14}}/>
      </div>
    </div>
  );
}

// 2 ── Value prop — single hero, large
function VB2_Value() {
  const ob = window.useOB();
  return (
    <VBScreen>
      <div style={{
        font:"500 11px/1 var(--font-mono)", color:"var(--tb-amber-400)",
        letterSpacing:"0.18em", textTransform:"uppercase", marginBottom:18,
      }}>{">"} 01 / why</div>

      <h1 style={{
        font:"600 30px/1.1 var(--font-sans)", color:"var(--tb-fg-0)",
        letterSpacing:"-0.025em", margin:"0 0 18px", textWrap:"balance",
      }}>
        Your laptop is the runtime. <span style={{color:"var(--tb-fg-3)"}}>Your phone is the cockpit.</span>
      </h1>

      {/* Diagram: phone <—> laptop */}
      <div style={{
        background:"var(--tb-ink-0)", border:"1px solid var(--tb-ink-5)",
        borderRadius:14, padding:"22px 14px", marginBottom:18, position:"relative", overflow:"hidden",
      }}>
        <div style={{display:"flex", alignItems:"center", justifyContent:"space-between", gap:10}}>
          {/* Phone glyph */}
          <div style={{textAlign:"center", flex:"0 0 auto"}}>
            <div style={{
              width:46, height:74, borderRadius:8, border:"1.5px solid var(--tb-blue-400)",
              background:"var(--tb-ink-2)", margin:"0 auto 6px", position:"relative",
              boxShadow:"0 0 0 4px rgba(99,179,255,0.12)",
            }}>
              <div style={{position:"absolute", left:"50%", top:5, transform:"translateX(-50%)", width:14, height:2, borderRadius:1, background:"var(--tb-ink-5)"}}/>
              <div style={{position:"absolute", left:"50%", bottom:6, transform:"translateX(-50%)", width:18, height:18, borderRadius:5, background:"var(--tb-blue-500)"}}/>
            </div>
            <div style={{font:"600 10px/1 var(--font-mono)", color:"var(--tb-blue-400)", letterSpacing:"0.06em"}}>YOU</div>
          </div>

          {/* Connector */}
          <div style={{flex:1, position:"relative", height:36}}>
            <svg viewBox="0 0 200 36" preserveAspectRatio="none" style={{position:"absolute", inset:0, width:"100%", height:"100%"}}>
              <path d="M0 18 Q 100 -10 200 18" fill="none" stroke="var(--tb-blue-500)" strokeWidth="1.5" strokeDasharray="4 4"
                    style={{animation:"ob-thread-pulse 2.4s linear infinite"}}/>
              <path d="M200 18 Q 100 46 0 18" fill="none" stroke="var(--tb-amber-500)" strokeWidth="1.5" strokeDasharray="4 4"
                    style={{animation:"ob-thread-pulse 2.4s linear infinite", animationDelay:"1.2s"}}/>
            </svg>
            <div style={{
              position:"absolute", top:-2, left:"50%", transform:"translateX(-50%)",
              font:"500 9px/1 var(--font-mono)", color:"var(--tb-blue-400)",
              background:"var(--tb-ink-0)", padding:"0 6px",
            }}>prompts ▸</div>
            <div style={{
              position:"absolute", bottom:-2, left:"50%", transform:"translateX(-50%)",
              font:"500 9px/1 var(--font-mono)", color:"var(--tb-amber-400)",
              background:"var(--tb-ink-0)", padding:"0 6px",
            }}>◂ stdout</div>
          </div>

          {/* Laptop glyph */}
          <div style={{textAlign:"center", flex:"0 0 auto"}}>
            <div style={{
              width:78, height:50, borderRadius:5, border:"1.5px solid var(--tb-amber-400)",
              background:"var(--tb-ink-2)", margin:"0 auto 2px", position:"relative",
              boxShadow:"0 0 0 4px rgba(240,138,36,0.12)",
              display:"flex", alignItems:"center", justifyContent:"center",
              font:"500 8px/1 var(--font-mono)", color:"var(--tb-amber-400)",
            }}>claude run</div>
            <div style={{height:3, width:90, margin:"0 auto", background:"var(--tb-amber-500)", borderRadius:0, opacity:0.6}}/>
            <div style={{font:"600 10px/1 var(--font-mono)", color:"var(--tb-amber-400)", letterSpacing:"0.06em", marginTop:8}}>RUNTIME</div>
          </div>
        </div>
      </div>

      <p style={{
        font:"400 14px/1.5 var(--font-sans)", color:"var(--tb-fg-2)",
        margin:0, textWrap:"pretty",
      }}>
        Threadbase keeps your agents alive on the box that has the GPU, the keys, and the file tree —
        and gives you a calm surface to drive them from anywhere.
      </p>

      <div style={{flex:1}}/>
      <window.OBPrimaryBtn onClick={ob.next}>Pair my laptop</window.OBPrimaryBtn>
      <div style={{height:14}}/>
    </VBScreen>
  );
}

// 3 ── Connect — terminal-style pair screen with simulated typing
function VB3_Connect() {
  const ob = window.useOB();
  const [url, setUrl] = React.useState("https://threadbase.local:7331");
  const [tok, setTok] = React.useState("");
  const [phase, setPhase] = React.useState("idle"); // idle | dialing | resolving | handshake | ok | err
  const [log, setLog] = React.useState([]);

  const valid = url.startsWith("http") && tok.length >= 8;

  const append = (line) => setLog(prev => [...prev, line]);

  const connect = () => {
    if (!valid || phase !== "idle") return;
    setLog([]);
    setPhase("dialing");
    setTimeout(() => { append({ k:"i", t:`dial ${url}` });                          setPhase("resolving");  }, 200);
    setTimeout(() => { append({ k:"d", t:`mdns → 192.168.1.42:7331` });             setPhase("handshake");  }, 700);
    setTimeout(() => { append({ k:"d", t:`tls 1.3 · cert ok · token verifying…` }); }, 1100);
    setTimeout(() => { append({ k:"ok", t:`paired as iphone-15.local` });           setPhase("ok"); }, 1700);
    setTimeout(() => { ob.next(); }, 2400);
  };

  const colorFor = (k) => k === "ok" ? "var(--tb-green-400)"
    : k === "i" ? "var(--tb-blue-400)" : k === "err" ? "var(--tb-red-400)"
    : "var(--tb-fg-3)";

  return (
    <VBScreen>
      <div style={{
        font:"500 11px/1 var(--font-mono)", color:"var(--tb-amber-400)",
        letterSpacing:"0.18em", textTransform:"uppercase", marginBottom:14,
      }}>{">"} 02 / pair</div>

      <h1 style={{
        font:"600 26px/1.1 var(--font-sans)", color:"var(--tb-fg-0)",
        letterSpacing:"-0.022em", margin:"0 0 14px",
      }}>Connect a runtime.</h1>

      {/* Terminal-style stacked input */}
      <div style={{
        background:"var(--tb-ink-0)", border:"1px solid var(--tb-ink-5)",
        borderRadius:12, padding:12, font:"500 12px/1.5 var(--font-mono)",
      }}>
        <div style={{
          display:"flex", alignItems:"center", gap:8, paddingBottom:8,
          borderBottom:"1px solid var(--tb-ink-5)", marginBottom:8,
        }}>
          <span style={{width:8, height:8, borderRadius:"50%", background:"var(--tb-red-400)"}}/>
          <span style={{width:8, height:8, borderRadius:"50%", background:"var(--tb-amber-400)"}}/>
          <span style={{width:8, height:8, borderRadius:"50%", background:"var(--tb-green-400)"}}/>
          <span style={{flex:1}}/>
          <span style={{color:"var(--tb-fg-4)", font:"500 10px/1 var(--font-mono)"}}>~/threadbase pair</span>
        </div>

        <div style={{color:"var(--tb-fg-3)"}}>$ tb pair --server</div>
        <div style={{display:"flex", alignItems:"center", gap:6, marginTop:2}}>
          <span style={{color:"var(--tb-blue-400)"}}>›</span>
          <input
            value={url} onChange={e => setUrl(e.target.value)} spellCheck={false}
            autoCapitalize="none" autoCorrect="off"
            style={{
              flex:1, background:"transparent", border:0, color:"var(--tb-fg-0)",
              font:"500 12.5px/1.4 var(--font-mono)", outline:"none", padding:0,
            }}/>
        </div>

        <div style={{color:"var(--tb-fg-3)", marginTop:10}}>$ tb pair --token</div>
        <div style={{display:"flex", alignItems:"center", gap:6, marginTop:2}}>
          <span style={{color:"var(--tb-blue-400)"}}>›</span>
          <input
            value={tok} onChange={e => setTok(e.target.value)} spellCheck={false}
            autoCapitalize="none" autoCorrect="off" type="password"
            placeholder="paste from desktop"
            style={{
              flex:1, background:"transparent", border:0, color:"var(--tb-fg-0)",
              font:"500 12.5px/1.4 var(--font-mono)", outline:"none", padding:0,
            }}/>
        </div>

        {log.length > 0 && (
          <div style={{
            marginTop:10, paddingTop:8, borderTop:"1px solid var(--tb-ink-5)",
            display:"flex", flexDirection:"column", gap:2,
          }}>
            {log.map((ln, i) => (
              <div key={i} style={{color: colorFor(ln.k), animation:"ob-fade .2s ease both"}}>
                <span style={{color:"var(--tb-fg-4)"}}>[{String(i+1).padStart(2,"0")}]</span> {ln.t}
              </div>
            ))}
            {phase === "ok" && (
              <div style={{color:"var(--tb-green-400)", marginTop:4}}>✓ ready</div>
            )}
          </div>
        )}
      </div>

      {/* Help footnote */}
      <div style={{
        marginTop:12, font:"400 11.5px/1.5 var(--font-mono)", color:"var(--tb-fg-4)",
        display:"flex", alignItems:"flex-start", gap:6,
      }}>
        <span style={{color:"var(--tb-fg-3)"}}>{"//"}</span>
        <span>On your desktop, run <span style={{color:"var(--tb-fg-2)"}}>tb token --new</span> to mint one.</span>
      </div>

      <div style={{flex:1}}/>
      <window.OBPrimaryBtn onClick={connect} disabled={!valid || phase !== "idle"}>
        {phase === "idle" ? "Open handshake" : phase === "ok" ? "Connected" : "…handshake"}
      </window.OBPrimaryBtn>
      <div style={{height:14}}/>
    </VBScreen>
  );
}

// 4 ── Notifications — terminal-style permission card
function VB4_Notifs() {
  const ob = window.useOB();
  const [enabled, setEnabled] = React.useState(false);
  return (
    <VBScreen>
      <div style={{
        font:"500 11px/1 var(--font-mono)", color:"var(--tb-amber-400)",
        letterSpacing:"0.18em", textTransform:"uppercase", marginBottom:14,
      }}>{">"} 03 / notify</div>

      <h1 style={{
        font:"600 26px/1.1 var(--font-sans)", color:"var(--tb-fg-0)",
        letterSpacing:"-0.022em", margin:"0 0 6px",
      }}>Wake me only when it counts.</h1>
      <p style={{font:"400 13.5px/1.5 var(--font-sans)", color:"var(--tb-fg-2)", margin:"0 0 18px"}}>
        Push fires on plan-ready, tool-confirms, and run failures. That's it.
      </p>

      {/* Mock notification preview */}
      <div style={{
        position:"relative", padding:14, borderRadius:14,
        background:"linear-gradient(180deg, rgba(99,179,255,0.10), rgba(99,179,255,0.02))",
        border:"1px solid var(--tb-ink-5)", marginBottom:14,
      }}>
        <div style={{display:"flex", alignItems:"flex-start", gap:10}}>
          <img src="../assets/threadbase-icon.svg" alt="" style={{width:32, height:32, borderRadius:7}}/>
          <div style={{flex:1, minWidth:0}}>
            <div style={{display:"flex", justifyContent:"space-between", alignItems:"baseline"}}>
              <span style={{font:"600 11.5px/1 var(--font-sans)", color:"var(--tb-fg-0)"}}>THREADBASE</span>
              <span style={{font:"500 10.5px/1 var(--font-mono)", color:"var(--tb-fg-4)"}}>now</span>
            </div>
            <div style={{font:"600 13px/1.3 var(--font-sans)", color:"var(--tb-fg-0)", marginTop:4}}>Plan ready · feat/queue</div>
            <div style={{font:"400 12px/1.4 var(--font-sans)", color:"var(--tb-fg-2)", marginTop:2}}>
              3 files queued for edit. Tap to review.
            </div>
          </div>
        </div>
      </div>

      {/* Allow card */}
      <button onClick={() => setEnabled(v => !v)} style={{
        textAlign:"left", cursor:"pointer", width:"100%",
        background:"var(--tb-ink-2)", border:`1px solid ${enabled ? "var(--tb-blue-500)" : "var(--tb-ink-5)"}`,
        borderRadius:12, padding:"14px", display:"flex", alignItems:"center", gap:12,
        transition:"border-color .2s ease",
      }}>
        <div style={{
          width:42, height:42, borderRadius:11, flexShrink:0,
          background: enabled ? "rgba(99,179,255,0.15)" : "var(--tb-ink-3)",
          color: enabled ? "var(--tb-blue-400)" : "var(--tb-fg-3)",
          display:"flex", alignItems:"center", justifyContent:"center",
          transition:"all .2s ease",
        }}>{window.OBI.bell}</div>
        <div style={{flex:1}}>
          <div style={{font:"600 13.5px/1.2 var(--font-sans)", color:"var(--tb-fg-0)"}}>Push notifications</div>
          <div style={{font:"500 11px/1.3 var(--font-mono)", color:"var(--tb-fg-3)", marginTop:3}}>
            {enabled ? "ENABLED · alerts.threadbase.dev" : "TAP TO ALLOW"}
          </div>
        </div>
        <div style={{
          width:18, height:18, borderRadius:"50%",
          border:`2px solid ${enabled ? "var(--tb-blue-500)" : "var(--tb-ink-6)"}`,
          background: enabled ? "var(--tb-blue-500)" : "transparent",
          display:"flex", alignItems:"center", justifyContent:"center",
          color:"#0a1424",
          transition:"all .2s ease",
        }}>
          {enabled && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
        </div>
      </button>

      <div style={{flex:1}}/>
      <window.OBPrimaryBtn onClick={ob.next}>{enabled ? "Continue" : "Skip — I'll watch the kanban"}</window.OBPrimaryBtn>
      <div style={{height:14}}/>
    </VBScreen>
  );
}

// 5 ── Tour — single full-bleed scrollable storyboard with three concept blocks
function VB5_Tour() {
  const ob = window.useOB();
  const [n, setN] = React.useState(0);
  const concepts = [
    {
      tag:"kanban",
      title:"Sessions live on lanes.",
      body:"Running, plan, waiting, done. Cards stream their state in real time.",
      preview:<VBKanban/>,
    },
    {
      tag:"queue",
      title:"Stack moves like commits.",
      body:"Queue prompts in order. They fire one after the next, even while you sleep.",
      preview:<VBQueue/>,
    },
    {
      tag:"terminal",
      title:"Streamed stdout, distilled.",
      body:"Tool calls get inlined. Errors get a red lane. Plans get a blue lane.",
      preview:<VBTerminal/>,
    },
  ];
  const c = concepts[n];
  return (
    <VBScreen>
      <div style={{
        display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12,
      }}>
        <div style={{
          font:"500 11px/1 var(--font-mono)", color:"var(--tb-amber-400)",
          letterSpacing:"0.18em", textTransform:"uppercase",
        }}>{">"} 04 / tour · {String(n+1).padStart(2,"0")}/{String(concepts.length).padStart(2,"0")}</div>
        <div style={{
          font:"500 10px/1 var(--font-mono)", color:"var(--tb-fg-3)",
        }}>{c.tag}</div>
      </div>

      <div key={n} style={{
        flex:1, display:"flex", flexDirection:"column",
        animation:"ob-fade .3s ease both",
      }}>
        <div style={{
          height:200, borderRadius:14, overflow:"hidden", marginBottom:16,
          background:"var(--tb-ink-0)", border:"1px solid var(--tb-ink-5)", position:"relative",
        }}>{c.preview}</div>

        <h2 style={{
          font:"600 22px/1.15 var(--font-sans)", color:"var(--tb-fg-0)",
          letterSpacing:"-0.02em", margin:"0 0 8px",
        }}>{c.title}</h2>
        <p style={{font:"400 13.5px/1.5 var(--font-sans)", color:"var(--tb-fg-2)", margin:0}}>{c.body}</p>
      </div>

      {/* mini progress + nav */}
      <div style={{display:"flex", gap:6, padding:"14px 0"}}>
        {concepts.map((_, i) => (
          <span key={i} style={{
            flex:1, height:3, borderRadius:2,
            background: i <= n ? "var(--tb-blue-400)" : "var(--tb-ink-5)",
            transition:"background .25s ease",
          }}/>
        ))}
      </div>

      {n < concepts.length - 1
        ? <window.OBPrimaryBtn onClick={() => setN(n+1)}>Next concept</window.OBPrimaryBtn>
        : <window.OBPrimaryBtn onClick={ob.next}>Drop me in</window.OBPrimaryBtn>}
      <div style={{height:14}}/>
    </VBScreen>
  );
}

function VBKanban() {
  return (
    <div style={{padding:"12px 12px 0", display:"flex", gap:6, height:"100%"}}>
      {[
        { l:"running", c:"#63b3ff", n:2, live:true },
        { l:"plan",    c:"#f08a24", n:2, live:false },
        { l:"done",    c:"#9ba8c0", n:1, live:false },
      ].map((ln, i) => (
        <div key={i} style={{flex:1, display:"flex", flexDirection:"column", gap:5}}>
          <div style={{
            display:"flex", alignItems:"center", gap:4, padding:"3px 0",
          }}>
            <span style={{
              width:5, height:5, borderRadius:"50%", background:ln.c,
              animation: ln.live ? "ob-glow 1.4s ease-in-out infinite" : "none",
            }}/>
            <span style={{font:"600 8.5px/1 var(--font-mono)", color:ln.c, letterSpacing:"0.08em", textTransform:"uppercase"}}>{ln.l}</span>
          </div>
          {Array.from({length: ln.n}).map((_, k) => (
            <div key={k} style={{
              borderRadius:5, padding:"6px 7px",
              background:"var(--tb-ink-2)", border:"1px solid var(--tb-ink-5)",
              borderLeft:`2px solid ${ln.c}`,
            }}>
              <div style={{height:4, width:"75%", background:"var(--tb-ink-5)", borderRadius:2, marginBottom:3}}/>
              <div style={{height:3, width:"45%", background:"var(--tb-ink-4)", borderRadius:2, marginBottom:5}}/>
              <div style={{font:"500 7.5px/1 var(--font-mono)", color:"var(--tb-fg-4)"}}>⎇ feat/q-{k}</div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function VBQueue() {
  return (
    <div style={{padding:"14px 14px 0", display:"flex", flexDirection:"column", gap:5}}>
      <div style={{font:"500 9px/1 var(--font-mono)", color:"var(--tb-fg-3)", letterSpacing:"0.06em", textTransform:"uppercase", marginBottom:4}}>↓ queue · 4 prompts</div>
      {[
        { i:"now",  t:"fix flaky test in auth.spec",        c:"var(--tb-blue-400)", glow:true },
        { i:"next", t:"add rate limit middleware",          c:"var(--tb-fg-2)" },
        { i:"+2",   t:"deploy preview to staging",          c:"var(--tb-fg-3)" },
        { i:"+3",   t:"write changelog for v0.4",           c:"var(--tb-fg-4)" },
      ].map((it, i) => (
        <div key={i} style={{
          display:"flex", alignItems:"center", gap:8,
          padding:"6px 8px", borderRadius:6,
          background:"var(--tb-ink-2)", border:`1px solid var(--tb-ink-5)`,
          borderLeft: `2px solid ${it.glow ? it.c : "transparent"}`,
          opacity: 1 - i*0.12,
        }}>
          <span style={{
            font:"600 8.5px/1 var(--font-mono)", color:it.c, width:24,
            letterSpacing:"0.04em", textTransform:"uppercase",
          }}>{it.i}</span>
          <span style={{font:"500 10px/1.2 var(--font-sans)", color:"var(--tb-fg-1)", flex:1, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis"}}>{it.t}</span>
        </div>
      ))}
    </div>
  );
}

function VBTerminal() {
  return (
    <div style={{padding:14, font:"500 10px/1.55 var(--font-mono)", color:"var(--tb-fg-2)", height:"100%", overflow:"hidden"}}>
      <div><span style={{color:"var(--tb-fg-3)"}}>[01]</span> <span style={{color:"var(--tb-blue-400)"}}>$</span> claude run feat/queue</div>
      <div><span style={{color:"var(--tb-fg-3)"}}>[02]</span> <span style={{color:"var(--tb-amber-400)"}}>● tool</span> <span style={{color:"var(--tb-fg-2)"}}>Read src/queue/index.ts</span></div>
      <div><span style={{color:"var(--tb-fg-3)"}}>[03]</span> <span style={{color:"var(--tb-amber-400)"}}>● tool</span> <span style={{color:"var(--tb-fg-2)"}}>Edit src/queue/index.ts</span> <span style={{color:"var(--tb-green-400)"}}>+84/-12</span></div>
      <div><span style={{color:"var(--tb-fg-3)"}}>[04]</span> <span style={{color:"var(--tb-fg-3)"}}>→</span> running tests…</div>
      <div><span style={{color:"var(--tb-fg-3)"}}>[05]</span> <span style={{color:"var(--tb-green-400)"}}>✓ 28 passed</span> <span style={{color:"var(--tb-fg-4)"}}>· 0 failed · 1.4s</span></div>
      <div><span style={{color:"var(--tb-fg-3)"}}>[06]</span> <span style={{color:"var(--tb-blue-400)"}}>plan</span> ready · <span style={{color:"var(--tb-fg-0)"}}>review on phone</span><span style={{
        display:"inline-block", width:6, height:11, background:"var(--tb-fg-0)",
        verticalAlign:"middle", marginLeft:3, animation:"ob-cursor 1s steps(2) infinite",
      }}/></div>
    </div>
  );
}

// 6 ── Done — celebratory glow + paired status
function VB6_Done() {
  const ob = window.useOB();
  return (
    <div style={{flex:1, display:"flex", flexDirection:"column", padding:"4px 22px 0", position:"relative"}}>
      <svg viewBox="0 0 360 580" preserveAspectRatio="xMidYMid slice"
           style={{position:"absolute", inset:0, width:"100%", height:"100%", opacity:0.35, pointerEvents:"none"}}>
        <defs>
          <radialGradient id="vb-done-glow" cx="50%" cy="38%" r="50%">
            <stop offset="0%"  stopColor="#4ade80" stopOpacity="0.5"/>
            <stop offset="100%" stopColor="#4ade80" stopOpacity="0"/>
          </radialGradient>
        </defs>
        <rect width="360" height="580" fill="url(#vb-done-glow)"/>
      </svg>

      <div style={{flex:1, display:"flex", flexDirection:"column", justifyContent:"center", alignItems:"center", textAlign:"center", position:"relative"}}>
        <div style={{
          width:96, height:96, borderRadius:"50%",
          background:"radial-gradient(circle, rgba(74,222,128,0.35) 0%, rgba(74,222,128,0) 70%)",
          display:"flex", alignItems:"center", justifyContent:"center", marginBottom:24,
          animation:"ob-pop .55s ease both",
        }}>
          <div style={{
            width:64, height:64, borderRadius:"50%",
            background:"var(--tb-green-500)", color:"#0a1424",
            display:"flex", alignItems:"center", justifyContent:"center",
            boxShadow:"0 0 0 1px rgba(74,222,128,0.4), 0 16px 40px -10px rgba(74,222,128,0.65)",
          }}>{window.OBI.check}</div>
        </div>

        <div style={{
          font:"500 11px/1 var(--font-mono)", color:"var(--tb-green-400)",
          letterSpacing:"0.18em", textTransform:"uppercase", marginBottom:14,
        }}>handshake complete</div>
        <h1 style={{font:"600 32px/1.05 var(--font-sans)", color:"var(--tb-fg-0)", letterSpacing:"-0.025em", margin:"0 0 12px"}}>
          Thread is live.
        </h1>
        <p style={{font:"400 14px/1.5 var(--font-sans)", color:"var(--tb-fg-2)", margin:"0 0 22px", maxWidth:280}}>
          Your laptop is listening. Open a session whenever the mood strikes.
        </p>
        <div style={{
          padding:"10px 14px", borderRadius:10, background:"var(--tb-ink-2)",
          border:"1px solid var(--tb-ink-5)", font:"500 11px/1.4 var(--font-mono)",
          color:"var(--tb-fg-3)", display:"flex", alignItems:"center", gap:8,
        }}>
          <span style={{width:7, height:7, borderRadius:"50%", background:"var(--tb-green-500)", animation:"ob-glow 2s ease-in-out infinite"}}/>
          <span>paired · work-laptop.local · 7331</span>
        </div>
      </div>

      <window.OBPrimaryBtn onClick={() => ob.goto(0)} icon={null}>Enter Threadbase</window.OBPrimaryBtn>
      <div style={{height:14}}/>
    </div>
  );
}

window.VBStepsAll = [VB1_Welcome, VB2_Value, VB3_Connect, VB4_Notifs, VB5_Tour, VB6_Done];
