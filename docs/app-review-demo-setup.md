# App Review Demo Setup

## Issue

Apple App Review rejected the app (June 8, 2026) because they couldn't sign in. They tried:
- **API key:** `demo-12345678` 
- **Result:** "Api key was not accepted"

## Required Actions

To pass App Review, you need to provide a working demo environment. Choose one of the options below:

### Option 1: Public Demo Server (Recommended)

Set up a publicly accessible tb-streamer instance with a demo API key that reviewers can use:

1. **Deploy tb-streamer to a public server**
   - Use a cloud provider (DigitalOcean, AWS, Fly.io, etc.)
   - Ensure it's accessible via HTTPS
   - Example: `https://demo.threadbase.app`

2. **Create a dedicated demo API key**
   ```bash
   tb set-key demo-apple-review-2026
   ```

3. **Add to App Review Information in App Store Connect**
   ```
   Server URL: https://demo.threadbase.app
   API Key: demo-apple-review-2026
   
   Instructions:
   1. Open Threadbase
   2. Tap "Manual setup"
   3. Enter the Server URL above
   4. Paste the API Key above
   5. Tap "Connect"
   ```

### Option 2: Demo Mode in App

Add a built-in demo mode to the app that doesn't require a real server:

1. Add a "Demo Mode" button on the onboarding screen
2. Mock all API responses to show realistic data
3. Allow reviewers to explore all features without needing a real server

## Update App Store Connect

After setting up the demo:

1. Go to App Store Connect → Threadbase → App Review
2. Edit the rejected version (1.0 build 121)
3. Update "App Review Information" section:
   - Sign-in required: Yes
   - Username: (leave blank, not applicable)
   - Password: (leave blank, not applicable)
   - Notes: Add the server URL and API key with clear instructions
4. Resubmit to App Review

## Testing

Before resubmitting, test the demo credentials yourself:
1. Delete the Threadbase app completely
2. Reinstall from TestFlight
3. Follow the exact instructions you'll give to reviewers
4. Verify you can successfully:
   - Connect to the server
   - Create a new session
   - Send messages
   - Attach photos (to test the camera permission fix)

## Related

- Rejection details: App Store Connect submission 8a1ca8a6-527b-4449-aac3-fce0ddeb357e
- Rejection date: June 8, 2026
