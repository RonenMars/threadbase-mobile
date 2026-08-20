export const ONBOARDING_RESUME_KEY = 'threadbase_onboarding_resume'

export type OnboardingResume = {
  step: 'welcome'
  mode?: 'review'
}

export function parseOnboardingResume(raw: string | null): OnboardingResume | null {
  if (raw === 'welcome') return { step: 'welcome' }
  if (raw === null) return null

  try {
    const value = JSON.parse(raw) as Partial<OnboardingResume>
    if (value.step !== 'welcome') return null
    return value.mode === 'review'
      ? { step: 'welcome', mode: 'review' }
      : { step: 'welcome' }
  } catch {
    return null
  }
}
