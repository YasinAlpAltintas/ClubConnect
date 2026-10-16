import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './locales/en.json'
import nlBE from './locales/nl-BE.json'

export const supportedLanguages = ['en', 'nl-BE'] as const
export type SupportedLanguage = (typeof supportedLanguages)[number]

const translations = {
  en: { translation: en },
  'nl-BE': { translation: nlBE },
}

if (!i18n.isInitialized) {
  await i18n.use(initReactI18next).init({
    resources: translations,
    lng: 'en',
    fallbackLng: 'en',
    supportedLngs: supportedLanguages,
    interpolation: { escapeValue: false },
  })
}

export default i18n
