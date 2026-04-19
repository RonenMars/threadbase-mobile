import { Redirect } from 'expo-router'
import { useServersStore } from '@/stores/servers'

export default function Index() {
  const activeServerIds = useServersStore((s) => s.activeServerIds)
  const isLoading = useServersStore((s) => s.isLoading)
  if (isLoading) return null
  return <Redirect href={activeServerIds.length > 0 ? '/(tabs)/sessions' : '/onboarding'} />
}
