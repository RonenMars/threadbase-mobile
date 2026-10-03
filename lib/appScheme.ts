import * as Application from 'expo-application'

// TbDev (scripts/ship-qa.sh) is the only build whose id ends in `.dev`; its
// Info.plist / manifest register `threadbase-dev` instead of `threadbase`.
export const APP_SCHEME = Application.applicationId?.endsWith('.dev')
  ? 'threadbase-dev'
  : 'threadbase'
