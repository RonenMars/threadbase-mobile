import React, { useEffect } from 'react'
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router'
import { OnboardingNavigator } from '@/components/onboarding/OnboardingNavigator'

export default function OnboardingScreen() {
  const router = useRouter()
  const navigation = useNavigation()
  const { mode } = useLocalSearchParams<{ mode?: string }>()

  useEffect(() => {
    navigation.setOptions({ headerShown: false })
  }, [navigation])

  return (
    <OnboardingNavigator
      onDone={() => router.replace('/')}
      mode={mode === 'review' ? 'review' : undefined}
    />
  )
}
