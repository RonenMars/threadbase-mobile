import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { exportBackup, restoreBackup } from '@/services/backup'
import type { BackupArchive, RestorePathMapRule } from '@/types/backup'

export function useBackupExport(serverId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ['backup-export', serverId],
    queryFn: ({ signal }) => exportBackup(serverId!, signal),
    enabled: !!serverId && enabled,
    staleTime: 0,
    retry: 1,
  })
}

export function useBackupRestore(serverId: string | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (args: {
      archive: BackupArchive
      apply?: boolean
      pathMap?: RestorePathMapRule[]
    }) => restoreBackup(serverId!, args.archive, { apply: args.apply, pathMap: args.pathMap }),
    onSuccess: () => {
      if (serverId) {
        void qc.invalidateQueries({ queryKey: ['projects'] })
        void qc.invalidateQueries({ queryKey: ['sessions'] })
      }
    },
  })
}
