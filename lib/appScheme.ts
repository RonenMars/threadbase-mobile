import * as Application from 'expo-application'

// TbDev (scripts/ship-qa.sh) is the only build whose id ends in `.dev`.
export const IS_QA_APP = Application.applicationId?.endsWith('.dev') === true

// Its Info.plist / manifest register `threadbase-dev` instead of `threadbase`.
export const APP_SCHEME = IS_QA_APP ? 'threadbase-dev' : 'threadbase'
