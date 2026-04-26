// OnboardingScreen.jsx — server URL + API key setup

const { useState: useStateO } = React;

function OnboardingScreen({ onConnect }) {
  const [url, setUrl] = useStateO("https://threadbase.local:7331");
  const [key, setKey] = useStateO("tb_••••••••••••••••••");
  return (
    <div style={{flex:1, padding:"72px 24px 24px", display:"flex", flexDirection:"column", overflow:"auto"}}>
      <div style={{display:"flex", alignItems:"center", gap:10, marginBottom:24}}>
        <img src="../../assets/threadbase-icon.svg" alt="" style={{width:44, height:44, borderRadius:10}}/>
        <div>
          <div style={{font:"600 18px/1.2 var(--font-sans)", color:"var(--tb-fg-0)", letterSpacing:"-0.01em"}}>Threadbase</div>
          <div style={{font:"500 12px/1.3 var(--font-mono)", color:"var(--tb-fg-3)"}}>Remote control · Claude Code</div>
        </div>
      </div>

      <h1 style={{font:"600 26px/1.15 var(--font-sans)", color:"var(--tb-fg-0)", letterSpacing:"-0.02em", margin:"0 0 6px"}}>
        Connect to your server.
      </h1>
      <p style={{font:"400 14px/1.55 var(--font-sans)", color:"var(--tb-fg-2)", margin:"0 0 20px"}}>
        Threadbase reads sessions streamed from <span className="tb-code">@threadbase/streamer</span> running on your machine.
      </p>

      <label style={{font:"600 11px/1 var(--font-sans)", color:"var(--tb-fg-2)", letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:6}}>Server URL</label>
      <input value={url} onChange={e => setUrl(e.target.value)} style={{
        background:"var(--tb-ink-2)", border:"1px solid var(--tb-ink-5)", borderRadius:10,
        height:44, padding:"0 12px", color:"var(--tb-fg-0)", font:"400 14px/1 var(--font-mono)",
        marginBottom:16, outline:0,
      }}/>

      <label style={{font:"600 11px/1 var(--font-sans)", color:"var(--tb-fg-2)", letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:6}}>API key</label>
      <div style={{
        background:"var(--tb-ink-2)", border:"1px solid var(--tb-ink-5)", borderRadius:10,
        height:44, padding:"0 12px", display:"flex", alignItems:"center", gap:10, marginBottom:16,
      }}>
        <input value={key} onChange={e => setKey(e.target.value)} style={{
          flex:1, background:"transparent", border:0, outline:0,
          color:"var(--tb-fg-0)", font:"400 14px/1 var(--font-mono)",
        }}/>
        <button style={{
          background:"transparent", border:0, color:"var(--tb-blue-400)",
          cursor:"pointer", display:"inline-flex", alignItems:"center", gap:4,
          font:"600 12px/1 var(--font-sans)",
        }}>{window.MobileIcon.qr} Scan</button>
      </div>

      <div style={{
        background:"var(--tb-ink-2)", border:"1px solid var(--tb-ink-5)", borderRadius:10,
        padding:"10px 12px", marginBottom:24, display:"flex", gap:10, alignItems:"flex-start",
      }}>
        <div style={{width:6, height:6, borderRadius:3, background:"var(--tb-blue-400)", marginTop:6, flex:"none"}}/>
        <div style={{font:"500 12px/1.5 var(--font-mono)", color:"var(--tb-fg-2)"}}>
          Run <span style={{color:"var(--tb-blue-400)"}}>npx @threadbase/streamer pair</span> on your laptop to print a QR code.
        </div>
      </div>

      <button onClick={onConnect} style={{
        height:48, borderRadius:10, border:0,
        background:"var(--tb-amber-400)", color:"#2a1a04",
        font:"600 14px/1 var(--font-sans)", cursor:"pointer",
        boxShadow:"var(--shadow-glow-amber)",
      }}>Connect</button>

      <div style={{textAlign:"center", marginTop:14, font:"500 12px/1 var(--font-sans)", color:"var(--tb-fg-3)"}}>
        Credentials are stored in iOS Keychain.
      </div>
    </div>
  );
}
window.OnboardingScreen = OnboardingScreen;
