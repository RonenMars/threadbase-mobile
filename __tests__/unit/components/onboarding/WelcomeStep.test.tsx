import React from 'react'
import { render } from '@testing-library/react-native'
import i18n from '@/test-utils/i18n-setup'
import { WelcomeStep } from '@/components/onboarding/steps/WelcomeStep'

describe('WelcomeStep Hebrew copy', () => {
  it('uses natural plural copy and names both coding agents', async () => {
    await i18n.changeLanguage('he')

    const { getByText } = await render(<WelcomeStep onNext={jest.fn()} />)

    expect(getByText('// הקוד איתכם')).toBeTruthy()
    const accent = getByText('גם כשאתם בדרך.')
    expect(accent.parent?.props.children[0]).toBe('הקוד ממשיך לרוץ.')
    expect(getByText('שליטה מרחוק ב־Claude Code וב־Codex, ישירות מהטלפון.')).toBeTruthy()
    expect(getByText('בואו נתחיל')).toBeTruthy()
  })
})
