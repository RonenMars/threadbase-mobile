import { QueryClient } from '@tanstack/react-query'
import { invalidateProjectChats, projectChatKeys } from '@/hooks/useProjectChats'

describe('invalidateProjectChats — mutation hooks', () => {
  it('invalidates per-server list and the multi-server roll-up after create', () => {
    const qc = new QueryClient()
    const spy = jest.spyOn(qc, 'invalidateQueries')

    invalidateProjectChats(qc, 'srv1')

    expect(spy).toHaveBeenCalledWith({ queryKey: projectChatKeys.list('srv1') })
    expect(spy).toHaveBeenCalledWith({ queryKey: ['projectChats-all'], exact: false })
  })

  it('invalidates per-server list and the multi-server roll-up after resume', () => {
    const qc = new QueryClient()
    const spy = jest.spyOn(qc, 'invalidateQueries')

    invalidateProjectChats(qc, 'srv2')

    expect(spy).toHaveBeenCalledWith({ queryKey: projectChatKeys.list('srv2') })
    expect(spy).toHaveBeenCalledWith({ queryKey: ['projectChats-all'], exact: false })
  })

  it('only invalidates the multi-server roll-up when no serverId is given', () => {
    const qc = new QueryClient()
    const spy = jest.spyOn(qc, 'invalidateQueries')

    invalidateProjectChats(qc)

    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalledWith({ queryKey: ['projectChats-all'], exact: false })
  })
})
