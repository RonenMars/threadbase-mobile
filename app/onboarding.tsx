import React, { useEffect } from 'react'
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router'
import { OnboardingNavigator } from '@/components/onboarding/OnboardingNavigator'
import { AddServerScreen } from '@/components/servers/AddServerScreen'

export default function OnboardingScreen() {
  const router = useRouter()
  const navigation = useNavigation()
  const { mode } = useLocalSearchParams<{ mode?: string }>()
  const isAddingServer = mode === 'add'

  useEffect(() => {
    if (isAddingServer) return
    navigation.setOptions({ headerShown: false })
  }, [isAddingServer, navigation])

  if (isAddingServer) {
    return <AddServerScreen isAddingServer />
  }

  return (
    <OnboardingNavigator onDone={() => router.replace('/(tabs)/sessions')} />
  )
}
