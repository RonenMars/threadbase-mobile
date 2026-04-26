// PromptQueueSheet.jsx — bottom sheet for queued prompts

const { useState: useStateQ } = React;
const SAMPLE_QUEUE = [
  { id:"q1", text:"Run pnpm typecheck across the monorepo and fix any errors." },
  { id:"q2", text:"Update the changelog with this session's work." },
  { id:"q3", text:"Push the branch and open a PR titled 'feat(scanner): two-tier index'." },
];

function PromptQueueSheet({ onClose }) {
  const [items, setItems] = useStateQ(SAMPLE_QUEUE);
  const [draft, setDraft] = useStateQ("");
  return (
    <div style={{position:"absolute", inset:0, zIndex:50}}>
      <div onClick={onClose} style={{
        position:"absolute", inset:0, background:"rgba(4,7,11,0.72)",
        backdropFilter:"blur(8px)", WebkitBackdropFilter:"blur(8px)",
      }}/>
      <div style={{
        position:"absolute", left:0, right:0, bottom:0,
        background:"var(--tb-ink-2)", borderTop:"1px solid var(--tb-ink-6)",
        borderRadius:"20px 20px 0 0", padding:"8px 16px 24px",
        display:"flex", flexDirection:"column", gap:10, maxHeight:"72%",
      }}>
        <div style={{width:36, height:4, borderRadius:2, background:"var(--tb-ink-6)", margin:"4px auto 6px"}}/>
        <div style={{display:"flex", alignItems:"center", gap:8}}>
          <div style={{font:"600 17px/1.2 var(--font-sans)", color:"var(--tb-fg-0)"}}>Prompt queue</div>
          <span style={{
            padding:"3px 7px", borderRadius:999, background:"var(--tb-ink-3)",
            font:"600 11px/1 var(--font-mono)", color:"var(--tb-fg-2)",
          }}>{items.length}</span>
          <button onClick={onClose} style={{
            marginLeft:"auto", background:"transparent", border:0, cursor:"pointer",
            color:"var(--tb-blue-400)", font:"600 13px/1 var(--font-sans)",
          }}>Done</button>
        </div>

        <div style={{flex:1, overflow:"auto", display:"flex", flexDirection:"column", gap:8, paddingTop:4}}>
          {items.map((it, i) => (
            <div key={it.id} style={{
              background:"var(--tb-ink-3)", border:"1px solid var(--tb-ink-5)",
              borderRadius:10, padding:"10px 12px", display:"flex", gap:10, alignItems:"flex-start",
            }}>
              <div style={{
                width:22, height:22, borderRadius:6, background:"var(--tb-ink-4)",
                display:"flex", alignItems:"center", justifyContent:"center", flex:"none",
                font:"700 11px/1 var(--font-mono)", color:"var(--tb-fg-2)",
              }}>{i+1}</div>
              <div style={{flex:1, font:"500 13px/1.45 var(--font-sans)", color:"var(--tb-fg-1)"}}>{it.text}</div>
              <button onClick={() => setItems(items.filter(x => x.id !== it.id))} style={{
                background:"transparent", border:0, cursor:"pointer",
                color:"var(--tb-fg-3)", font:"400 18px/1 var(--font-sans)", padding:"0 4px",
              }}>×</button>
            </div>
          ))}
          {items.length === 0 && (
            <div style={{textAlign:"center", padding:"20px", color:"var(--tb-fg-3)", font:"500 13px/1.5 var(--font-sans)"}}>
              No prompts queued.
            </div>
          )}
        </div>

        <div style={{
          background:"var(--tb-ink-3)", border:"1px solid var(--tb-ink-5)",
          borderRadius:10, padding:"8px 10px", display:"flex", gap:8, alignItems:"center",
        }}>
          <input
            value={draft} onChange={e => setDraft(e.target.value)}
            placeholder="Add a prompt to the queue…"
            style={{
              flex:1, background:"transparent", border:0, outline:0,
              color:"var(--tb-fg-0)", font:"400 14px/1 var(--font-sans)",
            }}
          />
          <button onClick={() => { if(draft.trim()) { setItems([...items, {id:Date.now()+"", text:draft}]); setDraft(""); }}}
            style={{
              background:"var(--tb-blue-400)", color:"var(--tb-ink-1)",
              border:0, borderRadius:8, padding:"7px 12px",
              font:"600 12px/1 var(--font-sans)", cursor:"pointer",
            }}>Add</button>
        </div>
      </div>
    </div>
  );
}
window.PromptQueueSheet = PromptQueueSheet;
