import {
  applyMention,
  applyPeerMention,
  buildPeerEntries,
  escapeMentionPath,
  extraDirEntries,
  findMentionToken,
  findPeerMarks,
  rankMentionEntries,
  rankPeerEntries,
  type MentionEntry,
} from '@/lib/mentionToken'

describe('findMentionToken', () => {
  it('opens on a bare @ at the start', () => {
    expect(findMentionToken('@', 1)).toEqual({ start: 0, end: 1, dir: '', query: '' })
  })

  it('opens after whitespace and reads the query up to the cursor', () => {
    expect(findMentionToken('look at @Read', 13)).toEqual({ start: 8, end: 13, dir: '', query: 'Read' })
  })

  it('splits the directory from the query at the last slash', () => {
    expect(findMentionToken('@src/components/Chat', 20)).toEqual({
      start: 0,
      end: 20,
      dir: 'src/components',
      query: 'Chat',
    })
  })

  it('lists a directory with an empty query right after a slash', () => {
    expect(findMentionToken('@src/', 5)).toEqual({ start: 0, end: 5, dir: 'src', query: '' })
  })

  it('ignores an @ inside a word', () => {
    expect(findMentionToken('mail me@example.com', 19)).toBeNull()
    expect(findMentionToken('npm i pkg@1', 11)).toBeNull()
  })

  it('closes once whitespace follows the token', () => {
    expect(findMentionToken('@README.md ', 11)).toBeNull()
    expect(findMentionToken('@src\nnext', 9)).toBeNull()
  })

  it('keeps an escaped space inside the token', () => {
    expect(findMentionToken('@My\\ Docs/no', 12)).toEqual({ start: 0, end: 12, dir: 'My Docs', query: 'no' })
  })

  it('covers the rest of the token when the cursor sits inside it', () => {
    expect(findMentionToken('see @src/app.ts now', 9)).toEqual({ start: 4, end: 15, dir: 'src', query: '' })
  })

  it('finds the token under the cursor when the message has several', () => {
    expect(findMentionToken('@a.ts and @b', 12)).toEqual({ start: 10, end: 12, dir: '', query: 'b' })
  })

  it('refuses absolute, other-user home and empty-segment paths', () => {
    expect(findMentionToken('@/etc/pa', 8)).toBeNull()
    expect(findMentionToken('@~bob/x', 7)).toBeNull()
    expect(findMentionToken('@src//x', 7)).toBeNull()
  })

  // The streamer expands `~` and refuses what lands outside its browse root.
  it('starts from the home directory with ~/', () => {
    expect(findMentionToken('@~/dev/ap', 9)).toEqual({ start: 0, end: 9, dir: '~/dev', query: 'ap' })
    expect(findMentionToken('@~/', 3)).toEqual({ start: 0, end: 3, dir: '~', query: '' })
    expect(findMentionToken('@~', 2)).toEqual({ start: 0, end: 2, dir: '~', query: '' })
  })

  // The streamer resolves `..` and refuses what lands outside its browse root.
  it('walks up with parent segments', () => {
    expect(findMentionToken('@../sec', 7)).toEqual({ start: 0, end: 7, dir: '..', query: 'sec' })
    expect(findMentionToken('@../../', 7)).toEqual({ start: 0, end: 7, dir: '../..', query: '' })
    expect(findMentionToken('@src/../x', 9)).toEqual({ start: 0, end: 9, dir: 'src/..', query: 'x' })
    expect(findMentionToken('@./src/a', 8)).toEqual({ start: 0, end: 8, dir: './src', query: 'a' })
  })

  it('lists the parent for a bare .. with no slash yet', () => {
    expect(findMentionToken('@..', 3)).toEqual({ start: 0, end: 3, dir: '..', query: '' })
    expect(findMentionToken('@../..', 6)).toEqual({ start: 0, end: 6, dir: '../..', query: '' })
  })

  it('keeps a single dot as a dotfile query', () => {
    expect(findMentionToken('@.', 2)).toEqual({ start: 0, end: 2, dir: '', query: '.' })
  })

  it('returns null with no @ before the cursor', () => {
    expect(findMentionToken('hello', 5)).toBeNull()
    expect(findMentionToken('', 0)).toBeNull()
  })

  it('clamps a cursor past the end of the text', () => {
    expect(findMentionToken('@a', 10)).toEqual({ start: 0, end: 2, dir: '', query: 'a' })
  })
})

describe('rankMentionEntries', () => {
  const entries: MentionEntry[] = [
    { name: '.env', kind: 'file' },
    { name: '.github', kind: 'dir' },
    { name: 'app', kind: 'dir' },
    { name: 'App.tsx', kind: 'file' },
    { name: 'snapshot', kind: 'dir' },
    { name: 'package.json', kind: 'file' },
  ]

  it('hides dotfiles unless the query starts with a dot', () => {
    expect(rankMentionEntries(entries, '').map((e) => e.name)).toEqual(['app', 'snapshot', 'App.tsx', 'package.json'])
    expect(rankMentionEntries(entries, '.').map((e) => e.name)).toEqual(['.github', '.env', 'App.tsx', 'package.json'])
  })

  it('puts prefix matches before substring matches, directories first in each', () => {
    expect(rankMentionEntries(entries, 'ap').map((e) => e.name)).toEqual(['app', 'App.tsx', 'snapshot'])
  })

  it('caps the result count', () => {
    expect(rankMentionEntries(entries, '', 2)).toHaveLength(2)
  })
})

describe('applyMention', () => {
  it('writes a file and closes the token with a space', () => {
    const text = 'fix @Rea please'
    const token = findMentionToken(text, 8)!
    expect(applyMention(text, token, { name: 'README.md', kind: 'file' })).toEqual({
      text: 'fix @README.md please',
      cursor: 15,
    })
  })

  it('adds a space when nothing follows', () => {
    const token = findMentionToken('@sr', 3)!
    expect(applyMention('@sr', token, { name: 'main.ts', kind: 'file' })).toEqual({ text: '@main.ts ', cursor: 9 })
  })

  it('keeps a directory open with a trailing slash', () => {
    const token = findMentionToken('@sr', 3)!
    expect(applyMention('@sr', token, { name: 'src', kind: 'dir' })).toEqual({ text: '@src/', cursor: 5 })
  })

  it('prefixes the directory part and escapes spaces', () => {
    const token = findMentionToken('@My\\ Docs/', 10)!
    expect(applyMention('@My\\ Docs/', token, { name: 'a b.txt', kind: 'file' })).toEqual({
      text: '@My\\ Docs/a\\ b.txt ',
      cursor: 19,
    })
  })
})

describe('escapeMentionPath', () => {
  it('backslash-escapes spaces only', () => {
    expect(escapeMentionPath('a b/c d.png')).toBe('a\\ b/c\\ d.png')
  })
})

describe('extraDirEntries', () => {
  const cwd = '/home/u/dev/app'

  it('offers each extra directory as a folder relative to the cwd', () => {
    expect(extraDirEntries(cwd, ['/home/u/dev/lib', '/home/u/other/docs'], '')).toEqual([
      { name: '../lib', kind: 'dir' },
      { name: '../../other/docs', kind: 'dir' },
    ])
  })

  it('filters by the folder name, ignoring case', () => {
    expect(extraDirEntries(cwd, ['/home/u/dev/lib', '/home/u/other/Docs'], 'do')).toEqual([
      { name: '../../other/Docs', kind: 'dir' },
    ])
  })

  it('handles a trailing slash and the filesystem root', () => {
    expect(extraDirEntries('/a/b/', ['/a/c/'], '')).toEqual([{ name: '../c', kind: 'dir' }])
    expect(extraDirEntries('/a', ['/'], '')).toEqual([{ name: '..', kind: 'dir' }])
  })

  it('skips paths it cannot express relative to the cwd', () => {
    expect(extraDirEntries('C:\\proj', ['C:\\lib'], '')).toEqual([])
    expect(extraDirEntries(cwd, ['relative/x', cwd], '')).toEqual([])
    })
  })

describe('peer entries', () => {
  const base = { projectName: 'tb-mobile', name: 'alpha' }
  const a = { ...base, id: 'aaaaaaaa-1', peerMention: '@alpha', peerAddress: 'uds:/tmp/cc-socks/1.sock' }
  const b = { ...base, id: 'bbbbbbbb-2', peerMention: '@"name slug"', peerAddress: 'uds:/tmp/cc-socks/2.sock', projectName: 'tb-streamer' }

  it('inserts the picker token and shows the name, project and short id', () => {
    expect(buildPeerEntries([a, b], 'self')).toEqual([
      { id: 'aaaaaaaa-1', name: 'alpha', projectName: 'tb-mobile', shortId: 'aaaaaaaa', insert: '@alpha' },
      { id: 'bbbbbbbb-2', name: 'name slug', projectName: 'tb-streamer', shortId: 'bbbbbbbb', insert: '@"name slug"' },
    ])
  })

  it('leaves out the current session and rows with neither a mention nor an address', () => {
    const rows = [{ ...a, id: 'self' }, { ...base, id: 'c', peerMention: '@c' }, { ...base, id: 'd' }]
    expect(buildPeerEntries(rows, 'self').map((p) => p.id)).toEqual(['c'])
  })

  it('appends the bare address when two peers share a name, and uses it alone when there is no token', () => {
    const twin = { ...a, id: 'cccccccc-3', peerAddress: 'uds:/tmp/cc-socks/3.sock' }
    const noMention = { ...base, id: 'dddddddd-4', name: 'odd "name"', peerAddress: 'uds:/tmp/cc-socks/4.sock' }
    const out = buildPeerEntries([a, twin, noMention], 'self')
    expect(out.map((p) => p.insert)).toEqual([
      '@alpha uds:/tmp/cc-socks/1.sock',
      '@alpha uds:/tmp/cc-socks/3.sock',
      'uds:/tmp/cc-socks/4.sock',
    ])
    expect(out[2].name).toBe('odd "name"')
  })

  it('ignores a malformed field instead of throwing', () => {
    const bad = { ...a, peerMention: 42 as unknown as string, peerAddress: undefined }
    expect(buildPeerEntries([bad], 'self')).toEqual([])
  })

  it('ranks by name, then project or short id', () => {
    const peers = buildPeerEntries([a, b], 'self')
    expect(rankPeerEntries(peers, 'al').map((p) => p.id)).toEqual(['aaaaaaaa-1'])
    expect(rankPeerEntries(peers, 'streamer').map((p) => p.id)).toEqual(['bbbbbbbb-2'])
    expect(rankPeerEntries(peers, 'bbbb').map((p) => p.id)).toEqual(['bbbbbbbb-2'])
    expect(rankPeerEntries(peers, '')).toHaveLength(2)
  })

  it('replaces the token with the insert text and a space', () => {
    const [peer] = buildPeerEntries([a], 'self')
    expect(applyPeerMention('tell @al now', { start: 5, end: 8, dir: '', query: 'al' }, peer)).toEqual({
      text: 'tell @alpha now',
      cursor: 12,
    })
    expect(applyPeerMention('@al', { start: 0, end: 3, dir: '', query: 'al' }, peer)).toEqual({ text: '@alpha ', cursor: 7 })
  })
})

describe('quoted peer names with spaces or tabs', () => {
  it('keeps one token open across spaces and tabs until the quote closes', () => {
    const text = 'ask @"picker test\tto mo'
    expect(findMentionToken(text, text.length)).toEqual({ start: 4, end: text.length, dir: '', query: 'picker test\tto mo' })
  })

  it('spans to the closing quote when the caret is inside it', () => {
    const text = 'ask @"picker test" now'
    expect(findMentionToken(text, 14)).toEqual({ start: 4, end: 18, dir: '', query: 'picker t' })
  })

  it('is closed once the quote is, and never crosses a newline or an in-word @', () => {
    expect(findMentionToken('@"picker test" ', 15)).toBeNull()
    expect(findMentionToken('@"picker\ntest', 14)).toBeNull()
    expect(findMentionToken('a@"picker te', 12)).toBeNull()
  })

  it('finds and inserts a spaced name end to end', () => {
    const [peer] = buildPeerEntries(
      [{ id: 'eeeeeeee-5', name: 'picker test to mobile', projectName: 'dev', peerMention: '@"picker test to mobile"', peerAddress: 'uds:/s/5.sock' }],
      'self',
    )
    const typed = 'ask @"picker te'
    const token = findMentionToken(typed, typed.length)!
    expect(rankPeerEntries([peer], token.query).map((p) => p.id)).toEqual(['eeeeeeee-5'])
    expect(applyPeerMention(typed, token, peer).text).toBe('ask @"picker test to mobile" ')
  })
})

describe('findPeerMarks', () => {
  const insert = '@"picker test to mobile"'

  it('marks the inserted words while they stand whole', () => {
    expect(findPeerMarks(`ask ${insert} now`, [insert])).toEqual([{ start: 4, end: 4 + insert.length }])
    expect(findPeerMarks(insert, [insert])).toEqual([{ start: 0, end: insert.length }])
  })

  it('drops the mark when characters are added to or removed from the name', () => {
    expect(findPeerMarks(`ask ${insert}s now`, [insert])).toEqual([])
    expect(findPeerMarks(`ask x${insert} now`, [insert])).toEqual([])
    expect(findPeerMarks('ask @"picker test to mobil" now', [insert])).toEqual([])
    expect(findPeerMarks('ask @"picker test to mobile now', [insert])).toEqual([])
  })

  it('marks every picked peer and each repeat', () => {
    expect(findPeerMarks('@a @b @a', ['@a', '@b'])).toEqual([
      { start: 0, end: 2 },
      { start: 3, end: 5 },
      { start: 6, end: 8 },
    ])
  })
})
