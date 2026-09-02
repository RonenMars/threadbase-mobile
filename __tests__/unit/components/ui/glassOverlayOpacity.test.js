const fs = require('fs')
const path = require('path')

const overlayComponents = [
  'components/pair/PairCameraIdentityCard.tsx',
  'components/quick-access/QuickAccessActionSheet.tsx',
  'components/shared/InfoModal.tsx',
  'components/servers/CacheAlertModal.tsx',
  'components/servers/ServersStatusModal.tsx',
  'components/ui/Banner.tsx',
]

describe('blocking Glass overlays', () => {
  it.each(overlayComponents)('%s keeps its content background opaque', (file) => {
    const source = fs.readFileSync(path.resolve(process.cwd(), file), 'utf8')

    expect(source).not.toContain("backgroundColor: 'transparent'")
  })
})
