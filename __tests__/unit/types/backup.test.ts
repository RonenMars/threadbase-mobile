import {
  parseBackupArchive,
  parseRestoreConflictBody,
  parseRestoreResponse,
} from '@/types/backup'

const sampleArchive = {
  manifest: {
    formatVersion: 1,
    createdAt: '2026-07-24T00:00:00.000Z',
    streamerVersion: '1.33.0',
    sourceHost: 'mac.local',
    includesSecrets: false,
    counts: { projects: 1 },
  },
  projects: [
    {
      id: 'proj-1',
      path: '/Users/a/code/app',
      name: 'app',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
    },
  ],
}

describe('parseBackupArchive', () => {
  it('parses a valid archive', () => {
    expect(parseBackupArchive(sampleArchive)).toEqual(sampleArchive)
  })

  it('rejects bad shapes', () => {
    expect(parseBackupArchive({})).toBeNull()
    expect(parseBackupArchive({ ...sampleArchive, projects: [{ id: 1 }] })).toBeNull()
  })
})

describe('parseRestoreResponse', () => {
  it('parses dry-run', () => {
    const body = {
      applied: false,
      summary: { create: 1, update: 0, conflict: 0 },
      plan: {
        create: sampleArchive.projects,
        update: [],
        conflict: [],
      },
    }
    expect(parseRestoreResponse(body)).toEqual(body)
  })

  it('parses applied', () => {
    expect(
      parseRestoreResponse({
        applied: true,
        summary: { create: 1, update: 0, conflict: 0 },
        appliedCount: 1,
      }),
    ).toEqual({
      applied: true,
      summary: { create: 1, update: 0, conflict: 0 },
      appliedCount: 1,
    })
  })
})

describe('parseRestoreConflictBody', () => {
  it('parses 409 payload', () => {
    const body = {
      error: 'Restore has unresolved conflicts',
      code: 'RESTORE_CONFLICT',
      summary: { create: 0, update: 0, conflict: 1 },
      plan: {
        create: [],
        update: [],
        conflict: [
          {
            incoming: sampleArchive.projects[0],
            existingId: 'other',
          },
        ],
      },
    }
    expect(parseRestoreConflictBody(body)?.message).toBe('Restore has unresolved conflicts')
  })
})
