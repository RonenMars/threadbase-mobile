const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '../..')
const SEARCH_DIRS = ['app', 'components']

const walk = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return walk(full)
    return /\.tsx$/.test(entry.name) ? [full] : []
  })

// Every screen that scans a pairing QR must also show the identity code, so the
// user can compare it against `tb-streamer identity` before trusting the server.
// Listing the screens here would not catch the failure this guards: app/settings.tsx
// shipped a scanner with no card because nobody remembered it was the fourth one.
describe('pair identity card wiring', () => {
  const scanners = SEARCH_DIRS.flatMap((dir) => walk(path.join(ROOT, dir))).filter((file) =>
    fs.readFileSync(file, 'utf8').includes('<PairScannerModal'),
  )

  it('finds the scan entry points', () => {
    expect(scanners.length).toBeGreaterThanOrEqual(4)
  })

  it.each(scanners.map((file) => [path.relative(ROOT, file), file]))(
    '%s renders the identity card',
    (_relative, file) => {
      expect(fs.readFileSync(file, 'utf8')).toContain('<PairCameraIdentityCard')
    },
  )
})
