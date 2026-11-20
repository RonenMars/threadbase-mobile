import React, { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { DateTimeFormatPicker } from './DateTimeFormatPicker'
import { DEFAULT_DATE_TIME_FORMAT, type DateFormat, type TimeFormat } from '@/lib/dateTimeFormat'

const meta: Meta<typeof DateTimeFormatPicker> = {
  title: 'settings/DateTimeFormatPicker',
  component: DateTimeFormatPicker,
}
export default meta

type Story = StoryObj<typeof DateTimeFormatPicker>

function Interactive({ initialDate, initialTime }: { initialDate: DateFormat; initialTime: TimeFormat }) {
  const [dateFormat, setDateFormat] = useState(initialDate)
  const [timeFormat, setTimeFormat] = useState(initialTime)
  return (
    <DateTimeFormatPicker
      dateFormat={dateFormat}
      timeFormat={timeFormat}
      onChangeDate={setDateFormat}
      onChangeTime={setTimeFormat}
    />
  )
}

export const Default: Story = {
  render: () => <Interactive initialDate={DEFAULT_DATE_TIME_FORMAT.date} initialTime={DEFAULT_DATE_TIME_FORMAT.time} />,
}

export const TwelveHourUS: Story = {
  render: () => <Interactive initialDate="mdy" initialTime="12h" />,
}
