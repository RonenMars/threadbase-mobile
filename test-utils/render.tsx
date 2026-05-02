import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react-native';
import { I18nextProvider } from 'react-i18next';
import i18n from './i18n-setup';

export function renderWithI18n(ui: ReactElement, options?: RenderOptions) {
  return render(
    <I18nextProvider i18n={i18n}>{ui}</I18nextProvider>,
    options
  );
}
