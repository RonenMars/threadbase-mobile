import { normalizeResumeResponse } from '@/utils/normalizeResumeResponse'

const fullSession = {
  id: 'sess-1',
  sessionId: 'sess-1',
  status: 'running',
  ptyAttached: true,
  projectPath: '/Users/foo/bar',
  projectName: 'bar',
  branch: 'main',
  lastOutput: '',
  elapsedMs: 100,
  promptCount: 0,
  startedAt: '2026-06-19T00:00:00.000Z',
  conversationId: 'conv-1',
  projectId: 'proj-1',
}

const legacyShape = { id: 'sess-2' }

describe('normalizeResumeResponse', () => {
  it('returns a Session snapshot when the response has projectPath, projectName, and startedAt', () => {
    const result = normalizeResumeResponse(fullSession as Record<string, unknown>)
    expect(result).not.toBeNull()
    expect(result?.projectPath).toBe('/Users/foo/bar')
    expect(result?.projectName).toBe('bar')
    expect(result?.startedAt).toBe('2026-06-19T00:00:00.000Z')
  })

  it('returns null for the legacy {id} shape', () => {
    expect(normalizeResumeResponse(legacyShape as Record<string, unknown>)).toBeNull()
  })

  it('returns null when projectName is missing', () => {
    const { projectName: _, ...partial } = fullSession
    expect(normalizeResumeResponse(partial as Record<string, unknown>)).toBeNull()
  })

  it('returns null when startedAt is missing', () => {
    const { startedAt: _, ...partial } = fullSession
    expect(normalizeResumeResponse(partial as Record<string, unknown>)).toBeNull()
  })
})
