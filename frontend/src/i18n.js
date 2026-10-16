import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import en from './locales/en.json';
import ig from './locales/ig.json';
import yo from './locales/yo.json';
import ha from './locales/ha.json';
import sw from './locales/sw.json';
import fr from './locales/fr.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      ig: { translation: ig },
      yo: { translation: yo },
      ha: { translation: ha },
      sw: { translation: sw },
      fr: { translation: fr },
    },
    fallbackLng: 'en',
    supportedLngs: ['en', 'ig', 'yo', 'ha', 'sw', 'fr'],
    nonExplicitSupportedLngs: true,
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'ftLanguage',
    },
  });

export default i18n;
