import React from 'react'
import { fireEvent } from '@testing-library/react-native'
import { renderWithI18n } from '@/test-utils/render'
import { ModelEffortSheet } from '@/components/sessions/ModelEffortSheet'
import { NetworkError, NotFoundError } from '@/services/api-client'
import { EFFORT_LEVELS, MODEL_ALIASES } from '@/constants/models'

function renderSheet(props: Partial<React.ComponentProps<typeof ModelEffortSheet>> = {}) {
  const onApply = jest.fn()
  const onClose = jest.fn()
  return {
    onApply,
    onClose,
    render: renderWithI18n(
      <ModelEffortSheet
        visible
        model="Opus 4.8 (1M context)"
        effort="medium"
        onApply={onApply}
        onClose={onClose}
        {...props}
      />,
    ),
  }
}

describe('ModelEffortSheet', () => {
  it('renders a chip for every pinned effort level', async () => {
    const { render } = renderSheet()
    const { getByTestId } = await render
    for (const level of EFFORT_LEVELS) {
      expect(getByTestId(`session-effort-${level}`)).toBeTruthy()
    }
  })

  it('shows the current model as read-only text rather than a preselected option', async () => {
    const { render } = renderSheet()
    const { getByTestId, getByText } = await render
    expect(getByTestId('session-model-current')).toBeTruthy()
    expect(getByText('Currently: Opus 4.8 (1M context)')).toBeTruthy()
  })

  it('applies the picked effort verbatim and leaves the model alone', async () => {
    const { render, onApply } = renderSheet()
    const { getByTestId } = await render
    await fireEvent.press(getByTestId('session-effort-xhigh'))
    await fireEvent.press(getByTestId('session-model-effort-apply'))
    expect(onApply).toHaveBeenCalledWith({ model: undefined, effort: 'xhigh' })
  })

  it('fills the model input from an alias chip', async () => {
    const { render, onApply } = renderSheet()
    const { getByTestId } = await render
    await fireEvent.press(getByTestId(`session-model-alias-${MODEL_ALIASES[0]}`))
    await fireEvent.press(getByTestId('session-model-effort-apply'))
    expect(onApply).toHaveBeenCalledWith({ model: MODEL_ALIASES[0], effort: undefined })
  })

  it('refuses to apply a model name the streamer would reject', async () => {
    const { render, onApply } = renderSheet()
    const { getByTestId, queryByTestId } = await render
    await fireEvent.changeText(getByTestId('session-model-input'), 'not a model')
    expect(queryByTestId('session-model-invalid')).toBeTruthy()
    await fireEvent.press(getByTestId('session-model-effort-apply'))
    expect(onApply).not.toHaveBeenCalled()
  })

  it('explains a 409 SESSION_BUSY instead of retrying it', async () => {
    const { render } = renderSheet({
      error: new NetworkError('Server returned 409', 'SESSION_BUSY', undefined, 409),
    })
    const { getByText } = await render
    expect(getByText('Wait for the current turn to finish, then try again.')).toBeTruthy()
  })

  it('explains a 409 SESSION_IDLE separately', async () => {
    const { render } = renderSheet({
      error: new NetworkError('Server returned 409', 'SESSION_IDLE', undefined, 409),
    })
    const { getByText } = await render
    expect(getByText('This session has no live terminal. Resume it first.')).toBeTruthy()
  })

  it('explains a route the server does not serve', async () => {
    const { render } = renderSheet({ error: new NotFoundError('/api/sessions/s/model') })
    const { getByText } = await render
    expect(getByText("This server can't change the model for this session.")).toBeTruthy()
  })

  it('blocks apply while a turn is running', async () => {
    const { render, onApply } = renderSheet({ busy: true })
    const { getByTestId } = await render
    expect(getByTestId('session-model-effort-busy')).toBeTruthy()
    await fireEvent.press(getByTestId('session-effort-max'))
    await fireEvent.press(getByTestId('session-model-effort-apply'))
    expect(onApply).not.toHaveBeenCalled()
  })
})
