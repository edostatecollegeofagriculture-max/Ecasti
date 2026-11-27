import { HeroSlide } from '../types';

export interface HeroColorFields {
  bgColor?: string;
  bgSecondaryColor?: string;
  textColor?: string;
  subtitleColor?: string;
  accentHex?: string;
  ctaBgColor?: string;
  ctaTextColor?: string;
  secondaryBtnBgColor?: string;
  secondaryBtnTextColor?: string;
  footerBarBgColor?: string;
}

export interface HeroColorPreset {
  id: string;
  name: string;
  swatch: [string, string, string];
  colors: HeroColorFields;
}

export const HERO_COLOR_PRESETS: HeroColorPreset[] = [
  {
    id: 'forest-gold',
    name: 'Forest & Gold (Default)',
    swatch: ['#022c22', '#0f172a', '#f59e0b'],
    colors: {
      bgColor: '#022c22',
      bgSecondaryColor: '#0f172a',
      textColor: '#ffffff',
      subtitleColor: '#d1fae5',
      accentHex: '#fbbf24',
      ctaBgColor: '#f59e0b',
      ctaTextColor: '#020617',
      secondaryBtnBgColor: '#064e3b',
      secondaryBtnTextColor: '#ffffff',
      footerBarBgColor: '#022c22',
    },
  },
  {
    id: 'royal-navy',
    name: 'Royal Navy & Amber',
    swatch: ['#0f172a', '#1e3a8a', '#f59e0b'],
    colors: {
      bgColor: '#0f172a',
      bgSecondaryColor: '#1e3a8a',
      textColor: '#ffffff',
      subtitleColor: '#dbeafe',
      accentHex: '#fbbf24',
      ctaBgColor: '#f59e0b',
      ctaTextColor: '#0f172a',
      secondaryBtnBgColor: '#1e293b',
      secondaryBtnTextColor: '#f8fafc',
      footerBarBgColor: '#0f172a',
    },
  },
  {
    id: 'clean-light',
    name: 'Clean Ivory & Emerald',
    swatch: ['#f8fafc', '#ecfdf5', '#047857'],
    colors: {
      bgColor: '#f8fafc',
      bgSecondaryColor: '#d1fae5',
      textColor: '#0f172a',
      subtitleColor: '#334155',
      accentHex: '#047857',
      ctaBgColor: '#065f46',
      ctaTextColor: '#ffffff',
      secondaryBtnBgColor: '#ffffff',
      secondaryBtnTextColor: '#064e3b',
      footerBarBgColor: '#ecfdf5',
    },
  },
  {
    id: 'crimson-cream',
    name: 'Crimson & Gold',
    swatch: ['#450a0a', '#7f1d1d', '#fbbf24'],
    colors: {
      bgColor: '#450a0a',
      bgSecondaryColor: '#7f1d1d',
      textColor: '#fff7ed',
      subtitleColor: '#fed7aa',
      accentHex: '#fbbf24',
      ctaBgColor: '#fbbf24',
      ctaTextColor: '#450a0a',
      secondaryBtnBgColor: '#7f1d1d',
      secondaryBtnTextColor: '#fff7ed',
      footerBarBgColor: '#450a0a',
    },
  },
  {
    id: 'obsidian-cyan',
    name: 'Obsidian & Teal',
    swatch: ['#09090b', '#134e4a', '#2dd4bf'],
    colors: {
      bgColor: '#09090b',
      bgSecondaryColor: '#134e4a',
      textColor: '#ffffff',
      subtitleColor: '#ccfbf1',
      accentHex: '#2dd4bf',
      ctaBgColor: '#14b8a6',
      ctaTextColor: '#042f2e',
      secondaryBtnBgColor: '#18181b',
      secondaryBtnTextColor: '#ccfbf1',
      footerBarBgColor: '#09090b',
    },
  },
];

export const EMPTY_HERO_COLORS: HeroColorFields = {
  bgColor: '',
  bgSecondaryColor: '',
  textColor: '',
  subtitleColor: '',
  accentHex: '',
  ctaBgColor: '',
  ctaTextColor: '',
  secondaryBtnBgColor: '',
  secondaryBtnTextColor: '',
  footerBarBgColor: '',
};

export const HERO_COLOR_CONTROLS: Array<{
  key: keyof HeroColorFields;
  label: string;
  fallback: string;
}> = [
  { key: 'bgColor', label: 'Background Start', fallback: '#022c22' },
  { key: 'bgSecondaryColor', label: 'Background End', fallback: '#0f172a' },
  { key: 'textColor', label: 'Headline Text', fallback: '#ffffff' },
  { key: 'subtitleColor', label: 'Subtitle Text', fallback: '#d1fae5' },
  { key: 'accentHex', label: 'Badge & Accent', fallback: '#fbbf24' },
  { key: 'ctaBgColor', label: 'Primary CTA Fill', fallback: '#f59e0b' },
  { key: 'ctaTextColor', label: 'Primary CTA Text', fallback: '#020617' },
  { key: 'secondaryBtnBgColor', label: 'Bulletin Btn Fill', fallback: '#064e3b' },
  { key: 'secondaryBtnTextColor', label: 'Bulletin Btn Text', fallback: '#ffffff' },
  { key: 'footerBarBgColor', label: 'Bottom & Notice Bar', fallback: '#022c22' },
];

export function hasCustomHeroBackground(slide?: Partial<HeroSlide>): boolean {
  return Boolean(slide?.bgColor || slide?.bgSecondaryColor);
}

export function getHeroSlideStyles(slide?: Partial<HeroSlide>) {
  const bgStart = slide?.bgColor || slide?.bgSecondaryColor || '';
  const bgEnd = slide?.bgSecondaryColor || slide?.bgColor || '';

  return {
    containerStyle: {
      borderColor: slide?.accentHex ? `${slide.accentHex}66` : undefined,
      backgroundColor: slide?.bgColor || undefined,
    } as React.CSSProperties,

    gradientLayerStyle:
      bgStart || bgEnd
        ? ({
            background: `linear-gradient(135deg, ${bgStart}, ${bgEnd})`,
          } as React.CSSProperties)
        : undefined,

    imageTintStyle:
      bgStart || bgEnd
        ? ({
            background: `linear-gradient(90deg, ${bgStart}d9 0%, ${bgEnd}a6 60%, ${bgEnd}73 100%)`,
          } as React.CSSProperties)
        : undefined,

    badgeStyle: slide?.accentHex
      ? ({
          backgroundColor: `${slide.accentHex}29`,
          color: slide.accentHex,
          borderColor: `${slide.accentHex}66`,
        } as React.CSSProperties)
      : undefined,

    dotAccentStyle: slide?.accentHex
      ? ({
          backgroundColor: slide.accentHex,
        } as React.CSSProperties)
      : undefined,

    iconBoxStyle: slide?.accentHex
      ? ({
          backgroundColor: `${slide.accentHex}29`,
          color: slide.accentHex,
          borderColor: `${slide.accentHex}55`,
        } as React.CSSProperties)
      : undefined,

    titleStyle: slide?.textColor ? ({ color: slide.textColor } as React.CSSProperties) : undefined,

    subtitleStyle: slide?.subtitleColor ? ({ color: slide.subtitleColor } as React.CSSProperties) : undefined,

    ctaStyle:
      slide?.ctaBgColor || slide?.ctaTextColor
        ? ({
            backgroundColor: slide?.ctaBgColor || undefined,
            color: slide?.ctaTextColor || undefined,
          } as React.CSSProperties)
        : undefined,

    secondaryBtnStyle:
      slide?.secondaryBtnBgColor || slide?.secondaryBtnTextColor
        ? ({
            backgroundColor: slide?.secondaryBtnBgColor || undefined,
            color: slide?.secondaryBtnTextColor || undefined,
            borderColor: slide?.accentHex ? `${slide.accentHex}55` : undefined,
          } as React.CSSProperties)
        : undefined,

    footerBarStyle:
      slide?.footerBarBgColor || slide?.accentHex
        ? ({
            backgroundColor: slide?.footerBarBgColor ? `${slide.footerBarBgColor}d9` : undefined,
            borderTopColor: slide?.accentHex ? `${slide.accentHex}33` : undefined,
          } as React.CSSProperties)
        : undefined,

    tickerBarStyle:
      slide?.footerBarBgColor || slide?.bgColor || slide?.accentHex
        ? ({
            backgroundColor: slide?.footerBarBgColor || slide?.bgColor || undefined,
            borderColor: slide?.accentHex ? `${slide.accentHex}66` : undefined,
            color: slide?.textColor || undefined,
          } as React.CSSProperties)
        : undefined,
  };
}
