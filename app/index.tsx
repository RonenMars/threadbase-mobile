import { Redirect } from 'expo-router'
import { useServersStore } from '@/stores/servers'

export default function Index() {
  const { activeServerIds, isLoading } = useServersStore()
  if (isLoading) return null
  return <Redirect href={activeServerIds.length > 0 ? '/(tabs)/sessions' : '/onboarding'} />
}
