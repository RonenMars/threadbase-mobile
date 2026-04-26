import { useEffect, useState } from 'react'
import { Redirect } from 'expo-router'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useServersStore } from '@/stores/servers'
import { ONBOARDED_KEY } from '@/components/onboarding/OnboardingNavigator'

export default function Index() {
  const activeServerIds = useServersStore((s) => s.activeServerIds)
  const isLoading = useServersStore((s) => s.isLoading)
  const [onboarded, setOnboarded] = useState<boolean | null>(null)

  useEffect(() => {
    let active = true
    AsyncStorage.getItem(ONBOARDED_KEY).then((value) => {
      if (active) setOnboarded(value === 'true')
    })
    return () => {
      active = false
    }
  }, [])

  if (isLoading || onboarded === null) return null
  const ready = activeServerIds.length > 0 || onboarded
  return <Redirect href={ready ? '/(tabs)/sessions' : '/onboarding'} />
}
