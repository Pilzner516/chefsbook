export interface Language {
  code: string;
  name: string;
  flag: string;
  nativeName: string;
}

export const LANGUAGES: Language[] = [
  { code: 'en', name: 'English',    flag: '🇺🇸', nativeName: 'English' },
  { code: 'fr', name: 'French',     flag: '🇫🇷', nativeName: 'Français' },
  { code: 'es', name: 'Spanish',    flag: '🇪🇸', nativeName: 'Español' },
  { code: 'ar', name: 'Arabic',     flag: '🇸🇦', nativeName: 'العربية' },
  { code: 'zh', name: 'Chinese',    flag: '🇨🇳', nativeName: '中文' },
  { code: 'da', name: 'Danish',     flag: '🇩🇰', nativeName: 'Dansk' },
  { code: 'nl', name: 'Dutch',      flag: '🇳🇱', nativeName: 'Nederlands' },
  { code: 'fi', name: 'Finnish',    flag: '🇫🇮', nativeName: 'Suomi' },
  { code: 'de', name: 'German',     flag: '🇩🇪', nativeName: 'Deutsch' },
  { code: 'el', name: 'Greek',      flag: '🇬🇷', nativeName: 'Ελληνικά' },
  { code: 'he', name: 'Hebrew',     flag: '🇮🇱', nativeName: 'עברית' },
  { code: 'hi', name: 'Hindi',      flag: '🇮🇳', nativeName: 'हिन्दी' },
  { code: 'hu', name: 'Hungarian',  flag: '🇭🇺', nativeName: 'Magyar' },
  { code: 'id', name: 'Indonesian', flag: '🇮🇩', nativeName: 'Bahasa Indonesia' },
  { code: 'it', name: 'Italian',    flag: '🇮🇹', nativeName: 'Italiano' },
  { code: 'ja', name: 'Japanese',   flag: '🇯🇵', nativeName: '日本語' },
  { code: 'ko', name: 'Korean',     flag: '🇰🇷', nativeName: '한국어' },
  { code: 'ms', name: 'Malay',      flag: '🇲🇾', nativeName: 'Bahasa Melayu' },
  { code: 'no', name: 'Norwegian',  flag: '🇳🇴', nativeName: 'Norsk' },
  { code: 'pl', name: 'Polish',     flag: '🇵🇱', nativeName: 'Polski' },
  { code: 'pt', name: 'Portuguese', flag: '🇵🇹', nativeName: 'Português' },
  { code: 'ro', name: 'Romanian',   flag: '🇷🇴', nativeName: 'Română' },
  { code: 'ru', name: 'Russian',    flag: '🇷🇺', nativeName: 'Русский' },
  { code: 'sv', name: 'Swedish',    flag: '🇸🇪', nativeName: 'Svenska' },
  { code: 'th', name: 'Thai',       flag: '🇹🇭', nativeName: 'ภาษาไทย' },
  { code: 'tr', name: 'Turkish',    flag: '🇹🇷', nativeName: 'Türkçe' },
  { code: 'uk', name: 'Ukrainian',  flag: '🇺🇦', nativeName: 'Українська' },
  { code: 'vi', name: 'Vietnamese', flag: '🇻🇳', nativeName: 'Tiếng Việt' },
];

export const PRIORITY_LANGUAGES = ['en', 'fr', 'es'];

export type UnitSystem = 'metric' | 'imperial';
