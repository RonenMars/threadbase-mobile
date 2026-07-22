import { useSessionsStore } from '@/stores/sessions'
import type { QueuedPrompt } from '@/types/api'

const SERVER = 'server-1'
const SESSION = 'session-1'
const SESSION_2 = 'session-2'
const KEY = `${SERVER}::${SESSION}`
const KEY_2 = `${SERVER}::${SESSION_2}`

const makePrompt = (id: string): QueuedPrompt => ({
  id,
  text: `Prompt ${id}`,
  addedAt: new Date().toISOString(),
  status: 'pending',
})

beforeEach(() => {
  useSessionsStore.setState({ promptQueues: {} })
})

describe('SessionsStore – prompt queue', () => {
  it('addToQueue appends a prompt', () => {
    useSessionsStore.getState().addToQueue(SERVER, SESSION, makePrompt('p1'))
    expect(useSessionsStore.getState().promptQueues[KEY]).toHaveLength(1)
  })

  it('addToQueue appends multiple prompts in order', () => {
    useSessionsStore.getState().addToQueue(SERVER, SESSION, makePrompt('p1'))
    useSessionsStore.getState().addToQueue(SERVER, SESSION, makePrompt('p2'))
    const queue = useSessionsStore.getState().promptQueues[KEY]
    expect(queue[0].id).toBe('p1')
    expect(queue[1].id).toBe('p2')
  })

  it('removeFromQueue removes by id', () => {
    useSessionsStore.getState().setQueue(SERVER, SESSION, [makePrompt('p1'), makePrompt('p2')])
    useSessionsStore.getState().removeFromQueue(SERVER, SESSION, 'p1')
    const queue = useSessionsStore.getState().promptQueues[KEY]
    expect(queue).toHaveLength(1)
    expect(queue[0].id).toBe('p2')
  })

  it('setQueue replaces queue', () => {
    useSessionsStore.getState().addToQueue(SERVER, SESSION, makePrompt('old'))
    useSessionsStore.getState().setQueue(SERVER, SESSION, [makePrompt('new1'), makePrompt('new2')])
    const queue = useSessionsStore.getState().promptQueues[KEY]
    expect(queue).toHaveLength(2)
    expect(queue[0].id).toBe('new1')
  })

  it('reorderQueue replaces queue in new order', () => {
    const prompts = [makePrompt('p1'), makePrompt('p2'), makePrompt('p3')]
    useSessionsStore.getState().setQueue(SERVER, SESSION, prompts)
    useSessionsStore.getState().reorderQueue(SERVER, SESSION, [prompts[2], prompts[0], prompts[1]])
    const queue = useSessionsStore.getState().promptQueues[KEY]
    expect(queue[0].id).toBe('p3')
    expect(queue[1].id).toBe('p1')
  })

  it('queues are isolated per session', () => {
    useSessionsStore.getState().addToQueue(SERVER, SESSION, makePrompt('p1'))
    useSessionsStore.getState().addToQueue(SERVER, SESSION_2, makePrompt('p2'))
    expect(useSessionsStore.getState().promptQueues[KEY]).toHaveLength(1)
    expect(useSessionsStore.getState().promptQueues[KEY_2]).toHaveLength(1)
  })

  it('clears only queues belonging to one server', () => {
    useSessionsStore.getState().addToQueue(SERVER, SESSION, makePrompt('p1'))
    useSessionsStore.getState().addToQueue('srv_other', SESSION, makePrompt('p2'))

    useSessionsStore.getState().clearServer(SERVER)

    expect(useSessionsStore.getState().promptQueues[KEY]).toBeUndefined()
    expect(useSessionsStore.getState().promptQueues[`srv_other::${SESSION}`]).toHaveLength(1)
  })
})
