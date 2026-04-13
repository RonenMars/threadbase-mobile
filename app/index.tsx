import { Redirect } from 'expo-router'
import { useConnectionStore } from '@/stores/connection'

export default function Index() {
  const { apiKey, isLoading } = useConnectionStore()
  if (isLoading) return null
  return <Redirect href={apiKey ? '/(tabs)/sessions' : '/onboarding'} />
}
