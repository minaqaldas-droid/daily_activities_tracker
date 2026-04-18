import { useCallback, useEffect, useState } from 'react'
import { type Settings, getSettings } from '../supabaseClient'

const DEFAULT_SETTINGS: Settings = {
  webapp_name: 'Daily Activities Tracker',
  logo_url: '',
  primary_color: '#667eea',
  performer_mode: 'manual',
}

const DEFAULT_FAVICON_PATH = '/favicon.svg'
const FAVICON_LINK_ID = 'app-favicon'

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
    document.documentElement.style.setProperty(
      '--primary-color',
      settings.primary_color || DEFAULT_SETTINGS.primary_color || '#667eea'
    )
  }, [settings.primary_color])

  useEffect(() => {
    document.title = settings.webapp_name?.trim() || DEFAULT_SETTINGS.webapp_name
  }, [settings.webapp_name])

  useEffect(() => {
    const faviconLink = ensureFaviconLink()
    const faviconHref = settings.logo_url?.trim() || DEFAULT_FAVICON_PATH

    faviconLink.href = faviconHref

    if (faviconHref.endsWith('.svg')) {
      faviconLink.type = 'image/svg+xml'
      return
    }

    faviconLink.removeAttribute('type')
  }, [settings.logo_url])

  return {
    settings,
    setSettings,
    loadSettings,
  }
}
