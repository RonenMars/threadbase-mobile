// stripAnsi removes ANSI escape SEQUENCES (\x1b[...]) but NOT literal
// box-drawing / block Unicode (│ ╭ ╮ └ █ …), which survive and leak into the
// chat as visual noise. This strips those residual glyphs from an
// already-ANSI-stripped line, collapsing the leftover whitespace.
//
// Char ranges mirror the one in parseQuestionBlock / virtual-terminal:
//   U+2500–U+257F  box drawing
//   U+2580–U+259F  block elements
const BOX_DRAWING_RE = /[─-╿▀-▟]/g

export function stripBoxDrawing(s: string): string {
  return s.replace(BOX_DRAWING_RE, ' ').replace(/\s+/g, ' ').trim()
}
