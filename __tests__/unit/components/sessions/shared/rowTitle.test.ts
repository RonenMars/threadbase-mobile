import { conversationRowTitle, sessionRowTitle } from '@/components/sessions/shared/rowTitle'

const session = {
  sessionName: undefined,
  projectName: 'tb-mobile',
  projectPath: '/Users/me/dev/tb-mobile',
  branch: 'main',
}

describe('sessionRowTitle', () => {
  it('lets a typed rename win over everything', () => {
    expect(
      sessionRowTitle(
        { ...session, sessionName: 'does the currently running session resume' },
        { name: 'Fix', origin: 'manual' },
      ),
    ).toBe('Fix')
  })

  it('repairs a stored 20-char auto slug instead of showing it', () => {
    expect(sessionRowTitle(session, { name: 'does-the-currently-r', origin: 'auto' })).toBe(
      'tb-mobile · main',
    )
  })

  it('cleans the server session name when nothing is stored', () => {
    expect(
      sessionRowTitle({ ...session, sessionName: '# check why the backgr is patchy' }, {}),
    ).toBe('Check why the backgr is patchy')
  })

  it('falls back to the project when the message is a greeting', () => {
    expect(sessionRowTitle({ ...session, sessionName: 'hey', branch: undefined }, {})).toBe(
      'tb-mobile',
    )
  })

  it('never renders blank when the project name is empty', () => {
    expect(
      sessionRowTitle({ sessionName: 'hi', projectName: '', projectPath: '/srv/app', branch: undefined }, {}),
    ).toBe('app')
  })
})

describe('conversationRowTitle', () => {
  const conv = {
    title: 'tb-mobile',
    sessionName: undefined,
    projectPath: '/Users/me/dev/tb-mobile',
    branch: 'main',
    firstMessage: undefined,
  }

  it('uses the first message when the server has no session name', () => {
    expect(
      conversationRowTitle(
        { ...conv, firstMessage: { text: '<image name=[Image #1] path="/var/x.png"> compare these screenshots', timestamp: '' } },
        {},
      ),
    ).toBe('Compare these screenshots')
  })

  it('keeps the server title when everything is rejected', () => {
    expect(conversationRowTitle({ ...conv, title: 'no git · 145h 30m', projectPath: '', branch: undefined, firstMessage: { text: 'hi', timestamp: '' } }, {})).toBe(
      'no git · 145h 30m',
    )
  })
})
