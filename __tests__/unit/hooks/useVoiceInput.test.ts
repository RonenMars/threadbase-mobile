import { renderHook, act } from '@testing-library/react-native'
import * as Device from 'expo-device'
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition'
import { useVoiceInput } from '@/hooks/useVoiceInput'

const requestPermissions = ExpoSpeechRecognitionModule.requestPermissionsAsync as jest.Mock
const startModule = ExpoSpeechRecognitionModule.start as jest.Mock
const stopModule = ExpoSpeechRecognitionModule.stop as jest.Mock
const onEvent = useSpeechRecognitionEvent as jest.Mock

type Handler = (e: any) => void
let handlers: Record<string, Handler[]> = {}

function fireEvent(name: string, payload: any) {
  for (const h of handlers[name] ?? []) h(payload)
}

beforeEach(() => {
  handlers = {}
  onEvent.mockImplementation((name: string, handler: Handler) => {
    handlers[name] = handlers[name] ?? []
    handlers[name].push(handler)
  })
  requestPermissions.mockReset()
  startModule.mockReset()
  stopModule.mockReset()
})

describe('useVoiceInput', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('start() requests permission and sets listening=true on grant', async () => {
    requestPermissions.mockResolvedValue({ granted: true })
    const onTranscript = jest.fn()
    const { result } = await renderHook(() => useVoiceInput({ onTranscript }))

    expect(result.current.listening).toBe(false)
    await act(async () => {
      await result.current.start()
    })

    expect(requestPermissions).toHaveBeenCalledTimes(1)
    expect(startModule).toHaveBeenCalledTimes(1)
    expect(result.current.listening).toBe(true)
  })

  it('start() throws VOICE_UNAVAILABLE on a simulator without invoking native start', async () => {
    const isDeviceSpy = jest.spyOn(Device, 'isDevice', 'get').mockReturnValue(false)
    const onTranscript = jest.fn()
    const { result } = await renderHook(() => useVoiceInput({ onTranscript }))

    await act(async () => {
      await expect(result.current.start()).rejects.toThrow('VOICE_UNAVAILABLE')
    })

    expect(requestPermissions).not.toHaveBeenCalled()
    expect(startModule).not.toHaveBeenCalled()
    expect(result.current.listening).toBe(false)
    isDeviceSpy.mockRestore()
  })

  it('start() throws PERMISSION_DENIED when not granted', async () => {
    requestPermissions.mockResolvedValue({ granted: false })
    const onTranscript = jest.fn()
    const { result } = await renderHook(() => useVoiceInput({ onTranscript }))

    await act(async () => {
      await expect(result.current.start()).rejects.toThrow('PERMISSION_DENIED')
    })

    expect(startModule).not.toHaveBeenCalled()
    expect(result.current.listening).toBe(false)
  })

  it('stop() flips listening=false', async () => {
    requestPermissions.mockResolvedValue({ granted: true })
    const { result } = await renderHook(() => useVoiceInput({ onTranscript: jest.fn() }))

    await act(async () => {
      await result.current.start()
    })
    expect(result.current.listening).toBe(true)

    act(() => {
      result.current.stop()
    })

    expect(stopModule).toHaveBeenCalled()
    expect(result.current.listening).toBe(false)
  })

  it("'result' event invokes onTranscript with the first alternative's transcript", async () => {
    requestPermissions.mockResolvedValue({ granted: true })
    const onTranscript = jest.fn()
    const { result } = await renderHook(() => useVoiceInput({ onTranscript }))

    await act(async () => {
      await result.current.start()
    })

    act(() => {
      fireEvent('result', { results: [{ transcript: 'hello world' }] })
    })

    expect(onTranscript).toHaveBeenCalledWith('hello world')
  })

  it("'end' event flips listening=false", async () => {
    requestPermissions.mockResolvedValue({ granted: true })
    const { result } = await renderHook(() => useVoiceInput({ onTranscript: jest.fn() }))

    await act(async () => {
      await result.current.start()
    })
    expect(result.current.listening).toBe(true)

    act(() => {
      fireEvent('end', {})
    })
    expect(result.current.listening).toBe(false)
  })

  it('unmount calls ExpoSpeechRecognitionModule.stop() exactly once', async () => {
    const { unmount } = await renderHook(() => useVoiceInput({ onTranscript: jest.fn() }))
    stopModule.mockClear()
    unmount()
    expect(stopModule).toHaveBeenCalledTimes(1)
  })

  it('silence timer: 30s with no result auto-stops; listening goes false', async () => {
    requestPermissions.mockResolvedValue({ granted: true })
    const { result } = await renderHook(() => useVoiceInput({ onTranscript: jest.fn() }))

    await act(async () => {
      await result.current.start()
    })
    expect(result.current.listening).toBe(true)
    stopModule.mockClear()

    act(() => {
      jest.advanceTimersByTime(30_000)
    })

    expect(stopModule).toHaveBeenCalledTimes(1)
    expect(result.current.listening).toBe(false)
  })

  it('silence timer resets on each result event (29s + result + 29s → still listening)', async () => {
    requestPermissions.mockResolvedValue({ granted: true })
    const onTranscript = jest.fn()
    const { result } = await renderHook(() => useVoiceInput({ onTranscript }))

    await act(async () => {
      await result.current.start()
    })
    stopModule.mockClear()

    act(() => {
      jest.advanceTimersByTime(29_000)
    })
    expect(result.current.listening).toBe(true)

    act(() => {
      fireEvent('result', { results: [{ transcript: 'still here' }] })
    })

    act(() => {
      jest.advanceTimersByTime(29_000)
    })

    expect(stopModule).not.toHaveBeenCalled()
    expect(result.current.listening).toBe(true)
  })
})
