import { useSessionsStore } from '@/stores/sessions'
import type { Session, QueuedPrompt } from '@/types/api'

const makeSession = (id: string, status: Session['status'] = 'running'): Session => ({
  id,
  status,
  projectPath: `/projects/${id}`,
  projectName: id,
  lastOutput: '',
  elapsedMs: 0,
  promptCount: 0,
  startedAt: new Date().toISOString(),
})

const makePrompt = (id: string): QueuedPrompt => ({
  id,
  text: `Prompt ${id}`,
  addedAt: new Date().toISOString(),
  status: 'pending',
})

beforeEach(() => {
  useSessionsStore.setState({ sessions: [], promptQueues: {} })
})

describe('SessionsStore – setSessions / updateSession', () => {
  it('replaces sessions list', () => {
    useSessionsStore.getState().setSessions([makeSession('a'), makeSession('b')])
    expect(useSessionsStore.getState().sessions).toHaveLength(2)
  })

  it('patches a single session by id', () => {
    useSessionsStore.getState().setSessions([makeSession('a', 'running')])
    useSessionsStore.getState().updateSession('a', { status: 'completed' })
    expect(useSessionsStore.getState().sessions[0].status).toBe('completed')
  })

  it('ignores updates for unknown ids', () => {
    useSessionsStore.getState().setSessions([makeSession('a')])
    useSessionsStore.getState().updateSession('unknown', { status: 'failed' })
    expect(useSessionsStore.getState().sessions[0].status).toBe('running')
  })
})

describe('SessionsStore – sessionsByStatus', () => {
  it('groups sessions into correct status buckets', () => {
    useSessionsStore.getState().setSessions([
      makeSession('a', 'running'),
      makeSession('b', 'running'),
      makeSession('c', 'waiting_input'),
      makeSession('d', 'completed'),
      makeSession('e', 'failed'),
    ])
    const grouped = useSessionsStore.getState().sessionsByStatus()
    expect(grouped.running).toHaveLength(2)
    expect(grouped.waiting_input).toHaveLength(1)
    expect(grouped.completed).toHaveLength(1)
    expect(grouped.failed).toHaveLength(1)
    expect(grouped.idle).toHaveLength(0)
  })

  it('returns empty arrays when no sessions', () => {
    const grouped = useSessionsStore.getState().sessionsByStatus()
    expect(grouped.running).toHaveLength(0)
    expect(grouped.waiting_input).toHaveLength(0)
    expect(grouped.completed).toHaveLength(0)
    expect(grouped.failed).toHaveLength(0)
  })
})

describe('SessionsStore – prompt queue', () => {
  it('addToQueue appends a prompt', () => {
    useSessionsStore.getState().addToQueue('session-1', makePrompt('p1'))
    expect(useSessionsStore.getState().promptQueues['session-1']).toHaveLength(1)
  })

  it('addToQueue appends multiple prompts in order', () => {
    useSessionsStore.getState().addToQueue('session-1', makePrompt('p1'))
    useSessionsStore.getState().addToQueue('session-1', makePrompt('p2'))
    const queue = useSessionsStore.getState().promptQueues['session-1']
    expect(queue[0].id).toBe('p1')
    expect(queue[1].id).toBe('p2')
  })

  it('removeFromQueue removes by id', () => {
    useSessionsStore.getState().setQueue('session-1', [makePrompt('p1'), makePrompt('p2')])
    useSessionsStore.getState().removeFromQueue('session-1', 'p1')
    const queue = useSessionsStore.getState().promptQueues['session-1']
    expect(queue).toHaveLength(1)
    expect(queue[0].id).toBe('p2')
  })

  it('setQueue replaces queue', () => {
    useSessionsStore.getState().addToQueue('session-1', makePrompt('old'))
    useSessionsStore.getState().setQueue('session-1', [makePrompt('new1'), makePrompt('new2')])
    const queue = useSessionsStore.getState().promptQueues['session-1']
    expect(queue).toHaveLength(2)
    expect(queue[0].id).toBe('new1')
  })

  it('reorderQueue replaces queue in new order', () => {
    const prompts = [makePrompt('p1'), makePrompt('p2'), makePrompt('p3')]
    useSessionsStore.getState().setQueue('session-1', prompts)
    useSessionsStore.getState().reorderQueue('session-1', [prompts[2], prompts[0], prompts[1]])
    const queue = useSessionsStore.getState().promptQueues['session-1']
    expect(queue[0].id).toBe('p3')
    expect(queue[1].id).toBe('p1')
  })

  it('queues are isolated per session', () => {
    useSessionsStore.getState().addToQueue('session-1', makePrompt('p1'))
    useSessionsStore.getState().addToQueue('session-2', makePrompt('p2'))
    expect(useSessionsStore.getState().promptQueues['session-1']).toHaveLength(1)
    expect(useSessionsStore.getState().promptQueues['session-2']).toHaveLength(1)
  })
})
