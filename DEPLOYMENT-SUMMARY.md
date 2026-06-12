# Production Threadbase Deployment Summary

## Deployment Details

**Production Server:** configured via `PROD_SERVER_URL` in `.env.prod`  
**Platform:** Fly.io  
**Region:** configured in `fly.prod.toml`

## Credentials

- **Production API Key:** Stored in `.env.prod` (gitignored, never committed)
- **Claude API Key:** Stored in Fly secrets as `CLAUDE_API_KEY`
- **Credentials File:** `.env.prod` (gitignored)

**Security Note:** Credentials are injected at test runtime via environment variables. The E2E test file does not contain hardcoded secrets.

## Fly.io Configuration

### Secrets Set
```bash
fly secrets set PROD_API_KEY="<generated-api-key>" -a <your-app-name>
fly secrets set CLAUDE_API_KEY="<key-from-1password>" -a <your-app-name>
```

### Volume
- **Name:** `prod_data`
- **Size:** 1GB
- **Purpose:** Persistent storage for SQLite cache and conversation history

### Docker Configuration
The production deployment uses the same Docker setup as demo but with:
- `PROD_API_KEY` environment variable (takes precedence over `DEMO_API_KEY`)
- `CLAUDE_API_KEY` exported as `ANTHROPIC_API_KEY` for real Claude API calls
- Separate volume mount (`prod_data` vs `demo_data`)

## Mobile E2E Tests

### New Test File
`e2e/prod-server-connect-only.yaml` - Tests connection to production server with real Claude API

### NPM Scripts Added
```bash
npm run test:e2e:prod         # Run with HTML report + debug artifacts
npm run test:e2e:prod:watch   # Run in watch mode (faster iteration)
npm run test:e2e:prod:debug   # Manual Metro server mode
```

### Test Coverage
The production E2E test validates:
1. ✓ Connection to production server
2. ✓ Session creation with real Claude API
3. ✓ Message sending and response streaming
4. ✓ Terminal output rendering
5. ✓ Session persistence and history
6. ✓ Full onboarding flow with production credentials

## Files Modified

### tb-streamer/
- **New:** `fly.prod.toml` - Production Fly.io configuration
- **Modified:** `docker/entrypoint.sh` - Added support for `PROD_API_KEY` and `CLAUDE_API_KEY`

### tb-mobile/
- **New:** `.env.prod` - Production credentials (gitignored)
- **New:** `e2e/prod-server-connect-only.yaml` - Production E2E test
- **Modified:** `package.json` - Added `test:e2e:prod` scripts

## Deployment Commands

### Deploy Production Server
```bash
cd tb-streamer
fly deploy --config fly.prod.toml --remote-only
```

### Run Production E2E Test
```bash
cd tb-mobile
npm run test:e2e:prod  # Loads credentials from .env.prod automatically
```

**Manual Run (without npm script):**
```bash
source .env.prod
maestro test -e PROD_SERVER_URL=$PROD_SERVER_URL -e PROD_API_KEY=$PROD_API_KEY \
  e2e/prod-server-connect-only.yaml
```

### Check Server Health
```bash
# Source credentials from .env.prod first
source .env.prod
curl -H "Authorization: Bearer $PROD_API_KEY" $PROD_SERVER_URL/healthz
```

Expected response:
```json
{"ok":true,"version":"1.2.1+source"}
```

## Next Steps

1. Run the production E2E test to validate end-to-end flow
2. Monitor Fly.io logs during test execution: `fly logs -a <your-app-name>`
3. Consider setting up monitoring/alerting for the production instance
4. Document any production-specific behaviors or quirks
