import {
  applyMention,
  applyPeerMention,
  buildPeerEntries,
  escapeMentionPath,
  findMentionToken,
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

  it('refuses absolute, home-relative and parent paths', () => {
    expect(findMentionToken('@/etc/pa', 8)).toBeNull()
    expect(findMentionToken('@~/x', 4)).toBeNull()
    expect(findMentionToken('@../sec', 7)).toBeNull()
    expect(findMentionToken('@src/../x', 9)).toBeNull()
    expect(findMentionToken('@src//x', 7)).toBeNull()
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

describe('peer entries', () => {
  const base = { projectName: 'tb-mobile', canMessage: true }
  const a = { ...base, id: 'aaaaaaaa-1', peerMention: '@alpha', peerAddress: 'uds:/tmp/cc-socks/1.sock' }
  const b = { ...base, id: 'bbbbbbbb-2', peerMention: '@"name slug"', peerAddress: 'uds:/tmp/cc-socks/2.sock', projectName: 'tb-streamer' }

  it('inserts the picker token and shows the name, project and short id', () => {
    expect(buildPeerEntries([a, b], 'self')).toEqual([
      { id: 'aaaaaaaa-1', name: 'alpha', projectName: 'tb-mobile', shortId: 'aaaaaaaa', insert: '@alpha' },
      { id: 'bbbbbbbb-2', name: 'name slug', projectName: 'tb-streamer', shortId: 'bbbbbbbb', insert: '@"name slug"' },
    ])
  })

  it('leaves out rows without canMessage and the current session', () => {
    const rows = [
      { ...a, canMessage: false },
      { ...b, canMessage: undefined },
      { ...a, id: 'self' },
      { ...base, id: 'c', peerMention: '@c' },
    ]
    expect(buildPeerEntries(rows, 'self').map((p) => p.id)).toEqual(['c'])
    expect(buildPeerEntries([{ ...base, id: 'd', canMessage: true }], 'self')).toEqual([])
  })

  it('appends the bare address when two peers share a name, and uses it alone when there is no token', () => {
    const twin = { ...a, id: 'cccccccc-3', peerAddress: 'uds:/tmp/cc-socks/3.sock' }
    const noMention = { ...base, id: 'dddddddd-4', sessionName: 'odd "name"', peerAddress: 'uds:/tmp/cc-socks/4.sock' }
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
