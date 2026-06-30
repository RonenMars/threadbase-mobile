import React, { useEffect } from 'react'
import { useWindowDimensions } from 'react-native'
import { SharedValue, useSharedValue, withDelay, withTiming, Easing, runOnJS } from 'react-native-reanimated'
import { MatrixRain, generateMatrixChars } from './MatrixRain'
import { SweepBar } from './SweepBar'

export const P5_START = 3000
export const P5_DURATION = 2500

const FADE_OUT_DUR = 200

interface Props {
  dissolveOpacity: SharedValue<number>
  textFadeOut: SharedValue<number>
  onComplete: () => void
}

export function RainAndSweep({ dissolveOpacity, textFadeOut, onComplete }: Props) {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions()
  const NODE_SIZE = 14
  const nodeLeft = screenWidth * 0.32
  const lineLeft = nodeLeft + NODE_SIZE / 2 + 8
  const matrixDownShift = screenHeight * 0.5
  const matrixChars = React.useMemo(
    () => generateMatrixChars(screenWidth, nodeLeft, lineLeft),
    [screenWidth, nodeLeft, lineLeft]
  )

  const matrixProgress = useSharedValue(0)
  const doneSignal = useSharedValue(0)

  useEffect(() => {
    matrixProgress.value = withDelay(
      P5_START,
      withTiming(1, { duration: P5_DURATION, easing: Easing.linear })
    )
    dissolveOpacity.value = withDelay(
      P5_START,
      withTiming(0, { duration: 350, easing: Easing.out(Easing.cubic) })
    )
    textFadeOut.value = withDelay(
      P5_START,
      withTiming(0, { duration: 400, easing: Easing.out(Easing.cubic) })
    )
    doneSignal.value = withDelay(
      P5_START + P5_DURATION,
      withTiming(1, { duration: FADE_OUT_DUR }, (finished) => {
        if (finished) runOnJS(onComplete)()
      })
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <>
      <SweepBar />
      <MatrixRain
        matrixChars={matrixChars}
        matrixDownShift={matrixDownShift}
        trigger={matrixProgress}
        screenWidth={screenWidth}
      />
    </>
  )
}
