const fs = require('fs')
const path = require('path')

const fixtures = (name) => fs.readFileSync(path.join(__dirname, '..', '..', '..', 'e2e', 'fixtures', name), 'utf8')

describe('store capture fixtures', () => {
  it('uses varied fictional project and release-work context', () => {
    const captureContent = [
      fixtures('sessions.json'),
      fixtures('conversations.json'),
      fixtures('session-external.json'),
      fixtures('search-results.json'),
      fixtures('conv-search-anchor.json'),
      fs.readFileSync(path.join(__dirname, '..', '..', '..', 'e2e', 'mock-server.js'), 'utf8'),
    ].join('\n')

    expect(captureContent).toContain('/workspace/northstar-commerce/apps/storefront')
    expect(captureContent).toContain('/workspace/helios-payments/services/ledger-api')
    expect(captureContent).toContain('idempotency')
    expect(captureContent).not.toMatch(/\b(my-project|other-project|mock-machine|wombat)\b/)
  })
})
