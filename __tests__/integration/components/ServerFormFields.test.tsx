import React from 'react'
import { StyleSheet } from 'react-native'
import { render, fireEvent, waitFor } from '@testing-library/react-native'
import * as Clipboard from 'expo-clipboard'
import { ServerFormFields, splitUrl } from '@/components/servers/ServerFormFields'
import i18n from '@/test-utils/i18n-setup'

const getStringAsync = Clipboard.getStringAsync as jest.Mock

async function renderFields(overrides: Partial<React.ComponentProps<typeof ServerFormFields>> = {}) {
  const onProtocolChange = jest.fn()
  const onUrlHostChange = jest.fn()
  const onApiKeyChange = jest.fn()
  const utils = await render(
    <ServerFormFields
      protocol="http"
      onProtocolChange={onProtocolChange}
      urlHost="old-host:1234"
      onUrlHostChange={onUrlHostChange}
      apiKey="old-key"
      onApiKeyChange={onApiKeyChange}
      urlInputTestID="url-input"
      keyInputTestID="key-input"
      {...overrides}
    />
  )
  return { ...utils, onProtocolChange, onUrlHostChange, onApiKeyChange }
}

describe('ServerFormFields', () => {
  beforeEach(() => {
    getStringAsync.mockReset().mockResolvedValue('')
  })

  afterEach(async () => {
    await i18n.changeLanguage('en')
  })

  describe('paste URL', () => {
    it('clears the field first, then pastes the clipboard value', async () => {
      getStringAsync.mockResolvedValue('https://my-server:9099/')
      const { getByTestId, onUrlHostChange, onProtocolChange } = await renderFields()

      await fireEvent.press(getByTestId('server-form-paste-url'))

      await waitFor(() => expect(onUrlHostChange).toHaveBeenCalledWith('my-server:9099'))
      expect(onUrlHostChange.mock.calls[0][0]).toBe('')
      expect(onProtocolChange).toHaveBeenCalledWith('https')
    })

    it('leaves the field cleared when the clipboard is empty', async () => {
      const { getByTestId, onUrlHostChange, onProtocolChange } = await renderFields()

      await fireEvent.press(getByTestId('server-form-paste-url'))

      await waitFor(() => expect(getStringAsync).toHaveBeenCalled())
      expect(onUrlHostChange).toHaveBeenCalledTimes(1)
      expect(onUrlHostChange).toHaveBeenCalledWith('')
      expect(onProtocolChange).not.toHaveBeenCalled()
    })
  })

  describe('paste API key', () => {
    it('clears the field first, then pastes the trimmed clipboard value', async () => {
      getStringAsync.mockResolvedValue('  secret-token  ')
      const { getByTestId, onApiKeyChange } = await renderFields()

      await fireEvent.press(getByTestId('server-form-paste-key'))

      await waitFor(() => expect(onApiKeyChange).toHaveBeenCalledWith('secret-token'))
      expect(onApiKeyChange.mock.calls[0][0]).toBe('')
    })

    it('leaves the field cleared when the clipboard is empty', async () => {
      const { getByTestId, onApiKeyChange } = await renderFields()

      await fireEvent.press(getByTestId('server-form-paste-key'))

      await waitFor(() => expect(getStringAsync).toHaveBeenCalled())
      expect(onApiKeyChange).toHaveBeenCalledTimes(1)
      expect(onApiKeyChange).toHaveBeenCalledWith('')
    })
  })

  it('auto-splits a full URL typed into the host field', async () => {
    const { getByTestId, onUrlHostChange, onProtocolChange } = await renderFields()

    await fireEvent.changeText(getByTestId('url-input'), 'http://localhost:7071')

    expect(onProtocolChange).toHaveBeenCalledWith('http')
    expect(onUrlHostChange).toHaveBeenCalledWith('localhost:7071')
  })

  it('hides the label field when onLabelChange is not provided', async () => {
    const { queryByText } = await renderFields()
    expect(queryByText('Label (optional)')).toBeNull()
  })

  it('shows the label field when onLabelChange is provided', async () => {
    const { getByText } = await renderFields({ onLabelChange: jest.fn() })
    expect(getByText('Label (optional)')).toBeTruthy()
  })

  it('keeps translated labels in the locale direction and URL/API-key fields LTR', async () => {
    await i18n.changeLanguage('he')
    const { getByText, getByTestId } = await renderFields({
      onLabelChange: jest.fn(),
      label: 'Work Mac',
    })

    expect(StyleSheet.flatten(getByText('תווית (אופציונלי)').props.style)).toEqual(
      expect.objectContaining({ direction: 'rtl', writingDirection: 'rtl', textAlign: 'auto' }),
    )
    expect(StyleSheet.flatten(getByTestId('url-input').props.style)).toEqual(
      expect.objectContaining({ direction: 'ltr', writingDirection: 'ltr' }),
    )
    expect(StyleSheet.flatten(getByTestId('key-input').props.style)).toEqual(
      expect.objectContaining({ direction: 'ltr', writingDirection: 'ltr' }),
    )
  })
})

describe('splitUrl', () => {
  it('splits https URLs and strips trailing slashes', async () => {
    expect(splitUrl('https://host:1/')).toEqual({ protocol: 'https', host: 'host:1' })
  })

  it('defaults to http for bare hosts', async () => {
    expect(splitUrl('host:1')).toEqual({ protocol: 'http', host: 'host:1' })
  })
})
