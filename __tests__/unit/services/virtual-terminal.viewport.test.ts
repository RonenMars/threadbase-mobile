import { VirtualTerminal } from '@/services/virtual-terminal'

/**
 * The viewport height a TUI's absolute row addressing resolves against.
 *
 * The streamer spawns every PTY at 40 rows and this client hardcoded that,
 * which was correct while nothing could change it. Something can now (a locally
 * attached terminal), and the server reports the real number — so decoding a
 * resized session at 40 rows lands every absolute cursor move on the wrong line.
 */
const ESC = '\x1b'
const CSI = `${ESC}[`

/** Fill the grid past any viewport, so viewportTop() is not simply 0. */
function filled(rows: number): VirtualTerminal {
  const vt = new VirtualTerminal()
  vt.feed(Array.from({ length: rows }, (_, i) => `line${i}`).join('\n'))
  return vt
}

describe('VirtualTerminal – viewport height', () => {
  // CSI H addresses a row within the viewport, so where row 1 lands is the
  // observable consequence of getting the height right.
  it('places an absolute row address against the default height', () => {
    const vt = filled(60)

    vt.feed(`${CSI}1;1HX`)

    // 60 lines, 40-row viewport: row 1 of the viewport is grid line 20.
    expect(vt.getLines()[20]).toMatch(/^X/)
  })

  it('places it against a taller viewport once the session reports one', () => {
    const vt = filled(60)

    vt.setViewportRows(50)
    vt.feed(`${CSI}1;1HX`)

    // The same address now resolves ten rows higher.
    expect(vt.getLines()[10]).toMatch(/^X/)
  })

  it('keeps the default when nothing reports a height', () => {
    const a = filled(60)
    const b = filled(60)

    b.setViewportRows(40)

    a.feed(`${CSI}1;1HX`)
    b.feed(`${CSI}1;1HX`)
    expect(a.getLines()).toEqual(b.getLines())
  })

  // A resize racing a session's exit, or a streamer sending something odd,
  // must not leave the decoder addressing rows against a nonsense height.
  it.each([
    ['zero', 0],
    ['negative', -5],
    ['fractional', 40.5],
    ['NaN', Number.NaN],
  ])('ignores a %s height', (_label, rows) => {
    const vt = filled(60)

    vt.setViewportRows(rows)
    vt.feed(`${CSI}1;1HX`)

    expect(vt.getLines()[20]).toMatch(/^X/)
  })
})
