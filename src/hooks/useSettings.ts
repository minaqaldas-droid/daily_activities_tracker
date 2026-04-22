import { useCallback, useEffect, useState } from 'react'
import { type Settings, getSettings } from '../supabaseClient'

const DEFAULT_SETTINGS: Settings = {
  webapp_name: 'Daily Activities Tracker',
  logo_url: '',
  browser_tab_name: 'Daily Activities Tracker',
  favicon_url: '',
  primary_color: '#667eea',
  performer_mode: 'manual',
  header_font_family: '',
  header_font_size: '2.5rem',
  subheader_font_family: '',
  subheader_font_size: '1.5rem',
  sidebar_font_family: '',
  sidebar_font_size: '0.95rem',
}

const DEFAULT_FAVICON_PATH = '/favicon.svg'
const FAVICON_LINK_ID = 'app-favicon'
const DEFAULT_PRIMARY_COLOR = DEFAULT_SETTINGS.primary_color || '#667eea'

type RgbColor = {
  r: number
  g: number
  b: number
}

function ensureFaviconLink() {
  let faviconLink = document.getElementById(FAVICON_LINK_ID) as HTMLLinkElement | null

  if (!faviconLink) {
    faviconLink = document.createElement('link')
    faviconLink.id = FAVICON_LINK_ID
    faviconLink.rel = 'icon'
    document.head.appendChild(faviconLink)
  }

  return faviconLink
}

function clampChannel(value: number) {
  return Math.max(0, Math.min(255, Math.round(value)))
}

function normalizeHexColor(input: string | undefined) {
  const value = input?.trim() || DEFAULT_PRIMARY_COLOR
  const shortHexMatch = /^#([\da-fA-F]{3})$/
  const fullHexMatch = /^#([\da-fA-F]{6})$/

  if (fullHexMatch.test(value)) {
    return value.toLowerCase()
  }

  const shortMatch = value.match(shortHexMatch)
  if (shortMatch) {
    const [, shortHex] = shortMatch
    return `#${shortHex
      .split('')
      .map((character) => `${character}${character}`)
      .join('')
      .toLowerCase()}`
  }

  return DEFAULT_PRIMARY_COLOR
}

function hexToRgb(hex: string): RgbColor {
  const normalizedHex = normalizeHexColor(hex).replace('#', '')

  return {
    r: Number.parseInt(normalizedHex.slice(0, 2), 16),
    g: Number.parseInt(normalizedHex.slice(2, 4), 16),
    b: Number.parseInt(normalizedHex.slice(4, 6), 16),
  }
}

function rgbToHex({ r, g, b }: RgbColor) {
  return `#${[r, g, b]
    .map((channel) => clampChannel(channel).toString(16).padStart(2, '0'))
    .join('')}`
}

function mixColors(firstHex: string, secondHex: string, secondWeight: number) {
  const firstRgb = hexToRgb(firstHex)
  const secondRgb = hexToRgb(secondHex)
  const weight = Math.max(0, Math.min(1, secondWeight))
  const firstWeight = 1 - weight

  return rgbToHex({
    r: firstRgb.r * firstWeight + secondRgb.r * weight,
    g: firstRgb.g * firstWeight + secondRgb.g * weight,
    b: firstRgb.b * firstWeight + secondRgb.b * weight,
  })
}

function toRgba(hex: string, alpha: number) {
  const rgb = hexToRgb(hex)
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${Math.max(0, Math.min(1, alpha))})`
}

function getRelativeLuminance(hex: string) {
  const rgb = hexToRgb(hex)
  const channels = [rgb.r, rgb.g, rgb.b].map((channel) => {
    const normalized = channel / 255
    return normalized <= 0.03928
      ? normalized / 12.92
      : Math.pow((normalized + 0.055) / 1.055, 2.4)
  })

  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
}

function getContrastColor(hex: string) {
  return getRelativeLuminance(hex) > 0.56 ? '#0f172a' : '#f8fafc'
}

function getThemeTokens(primaryColor: string) {
  const base = normalizeHexColor(primaryColor)
  const primaryDark = mixColors(base, '#0f172a', 0.34)
  const accentBright = mixColors(base, '#22d3ee', 0.24)
  const primaryContrast = getContrastColor(base)
  const sidebarText = '#eff6ff'
  const sidebarTextMuted = 'rgba(219, 234, 254, 0.78)'

  return {
    '--primary-color': base,
    '--primary-dark': primaryDark,
    '--primary-contrast': primaryContrast,
    '--primary-contrast-muted':
      primaryContrast === '#0f172a' ? 'rgba(15, 23, 42, 0.76)' : 'rgba(248, 250, 252, 0.82)',
    '--primary-soft': toRgba(base, 0.12),
    '--primary-soft-strong': toRgba(base, 0.18),
    '--primary-soft-heavy': toRgba(base, 0.26),
    '--primary-border': toRgba(base, 0.24),
    '--primary-ring': toRgba(base, 0.22),
    '--primary-shadow': toRgba(base, 0.28),
    '--primary-shadow-soft': toRgba(base, 0.18),
    '--accent-bright': accentBright,
    '--panel-border': toRgba(base, 0.16),
    '--sidebar-bg-start': mixColors(base, '#020617', 0.84),
    '--sidebar-bg-mid': mixColors(base, '#0f172a', 0.68),
    '--sidebar-bg-end': mixColors(base, '#1e293b', 0.44),
    '--sidebar-text': sidebarText,
    '--sidebar-text-muted': sidebarTextMuted,
    '--chart-color-1': '#2563eb',
    '--chart-color-2': '#7c3aed',
    '--chart-color-3': '#0ea5e9',
    '--chart-color-4': '#14b8a6',
    '--chart-color-5': '#22c55e',
    '--chart-color-6': '#f97316',
    '--chart-color-7': '#f59e0b',
    '--chart-color-8': '#ef4444',
    '--chart-color-9': '#ec4899',
    '--chart-color-10': '#334155',
  }
}

export function useSettings(isEnabled: boolean) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)

  const loadSettings = useCallback(async () => {
    const appSettings = await getSettings()
    setSettings(appSettings)
    return appSettings
  }, [])

  useEffect(() => {
    if (!isEnabled) {
      setSettings(DEFAULT_SETTINGS)
      return
    }

    void loadSettings().catch((error) => {
      console.error('Error loading settings:', error)
    })
  }, [isEnabled, loadSettings])

  useEffect(() => {
    const themeTokens = getThemeTokens(settings.primary_color || DEFAULT_PRIMARY_COLOR)

    Object.entries(themeTokens).forEach(([token, value]) => {
      document.documentElement.style.setProperty(token, value)
    })
  }, [settings.primary_color])

  useEffect(() => {
    document.title =
      settings.browser_tab_name?.trim() ||
      settings.webapp_name?.trim() ||
      DEFAULT_SETTINGS.browser_tab_name ||
      DEFAULT_SETTINGS.webapp_name
  }, [settings.browser_tab_name, settings.webapp_name])

  useEffect(() => {
    const faviconLink = ensureFaviconLink()
    const faviconHref = settings.favicon_url?.trim() || settings.logo_url?.trim() || DEFAULT_FAVICON_PATH

    faviconLink.href = faviconHref

    if (faviconHref.endsWith('.svg')) {
      faviconLink.type = 'image/svg+xml'
      return
    }

    faviconLink.removeAttribute('type')
  }, [settings.favicon_url, settings.logo_url])

  useEffect(() => {
    const root = document.documentElement

    root.style.setProperty('--font-header-family', settings.header_font_family?.trim() || 'inherit')
    root.style.setProperty('--font-subheader-family', settings.subheader_font_family?.trim() || 'inherit')
    root.style.setProperty('--font-sidebar-family', settings.sidebar_font_family?.trim() || 'inherit')
    root.style.setProperty('--font-header-size', settings.header_font_size?.trim() || '2.5rem')
    root.style.setProperty('--font-subheader-size', settings.subheader_font_size?.trim() || '1.5rem')
    root.style.setProperty('--font-sidebar-size', settings.sidebar_font_size?.trim() || '0.95rem')
  }, [
    settings.header_font_family,
    settings.header_font_size,
    settings.subheader_font_family,
    settings.subheader_font_size,
    settings.sidebar_font_family,
    settings.sidebar_font_size,
  ])

  return {
    settings,
    setSettings,
    loadSettings,
  }
}
