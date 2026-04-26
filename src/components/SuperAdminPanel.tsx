import React, { useEffect, useState } from 'react'
import { type Settings, type Team, type User, updateSettings, uploadBrandingAsset } from '../supabaseClient'
import { getActivityFieldConfig, getOrderedActivityFields, type ConfigurableActivityFieldKey } from '../utils/activityFields'

interface AdminPanelProps {
  user: User
  activeTeam?: Team | null
  currentSettings: Settings
  onClose: () => void
  onSettingsUpdate: (settings: Settings) => void
  onOpenUserManagement: () => void
  isLoading?: boolean
}

const ACCEPTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/webp']
const MAX_FILE_SIZE = 5 * 1024 * 1024

function isValidImageFile(file: File) {
  return ACCEPTED_IMAGE_TYPES.includes(file.type) && file.size <= MAX_FILE_SIZE
}

function normalizeSequentialOrder(settings: Settings) {
  const normalizedConfig = getActivityFieldConfig(settings)
  const orderedFields = getOrderedActivityFields({ ...settings, activity_field_config: normalizedConfig })

  return orderedFields.reduce<typeof normalizedConfig>((accumulator, field, index) => {
    accumulator[field.key] = {
      ...normalizedConfig[field.key],
      order: index + 1,
    }
    return accumulator
  }, { ...normalizedConfig })
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  user,
  activeTeam,
  currentSettings,
  onClose,
  onSettingsUpdate,
  onOpenUserManagement,
  isLoading = false,
}) => {
  const [webappName, setWebappName] = useState('')
  const [browserTabName, setBrowserTabName] = useState('')
  const [performerMode, setPerformerMode] = useState<'manual' | 'auto'>('manual')
  const [headerFontFamily, setHeaderFontFamily] = useState('')
  const [headerFontSize, setHeaderFontSize] = useState('2.5rem')
  const [subheaderFontFamily, setSubheaderFontFamily] = useState('')
  const [subheaderFontSize, setSubheaderFontSize] = useState('1.5rem')
  const [sidebarFontFamily, setSidebarFontFamily] = useState('')
  const [sidebarFontSize, setSidebarFontSize] = useState('0.95rem')
  const [activityFieldConfig, setActivityFieldConfig] = useState(normalizeSequentialOrder(currentSettings))
  const [logoPreview, setLogoPreview] = useState('')
  const [faviconPreview, setFaviconPreview] = useState('')
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [faviconFile, setFaviconFile] = useState<File | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const orderedFields = getOrderedActivityFields({ ...currentSettings, activity_field_config: activityFieldConfig })

  useEffect(() => {
    setWebappName(currentSettings.webapp_name || 'Daily Activities Tracker')
    setBrowserTabName(currentSettings.browser_tab_name || currentSettings.webapp_name || 'Daily Activities Tracker')
    setPerformerMode(currentSettings.performer_mode || 'manual')
    setHeaderFontFamily(currentSettings.header_font_family || '')
    setHeaderFontSize(currentSettings.header_font_size || '2.5rem')
    setSubheaderFontFamily(currentSettings.subheader_font_family || '')
    setSubheaderFontSize(currentSettings.subheader_font_size || '1.5rem')
    setSidebarFontFamily(currentSettings.sidebar_font_family || '')
    setSidebarFontSize(currentSettings.sidebar_font_size || '0.95rem')
    setActivityFieldConfig(normalizeSequentialOrder(currentSettings))
    setLogoPreview(currentSettings.logo_url || '')
    setFaviconPreview(currentSettings.favicon_url || currentSettings.logo_url || '')
    setLogoFile(null)
    setFaviconFile(null)
  }, [currentSettings])

  const handleLogoSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    if (!isValidImageFile(file)) {
      setError('Logo must be PNG/JPG/SVG/WebP and under 5MB.')
      return
    }

    setError('')
    setLogoFile(file)
    setLogoPreview(URL.createObjectURL(file))
  }

  const handleFaviconSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    if (!isValidImageFile(file)) {
      setError('Favicon must be PNG/JPG/SVG/WebP and under 5MB.')
      return
    }

    setError('')
    setFaviconFile(file)
    setFaviconPreview(URL.createObjectURL(file))
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    setSuccess('')

    if (!webappName.trim()) {
      setError('In-App Name is required.')
      return
    }

    try {
      setIsSubmitting(true)

      let nextLogoUrl = currentSettings.logo_url || ''
      let nextFaviconUrl = currentSettings.favicon_url || currentSettings.logo_url || ''

      if (logoFile) {
        nextLogoUrl = await uploadBrandingAsset(user.id, 'logo', logoFile)
      }

      if (faviconFile) {
        nextFaviconUrl = await uploadBrandingAsset(user.id, 'favicon', faviconFile)
      }

      const updatedSettings = await updateSettings(
        {
          webapp_name: webappName.trim(),
          logo_url: nextLogoUrl,
          browser_tab_name: browserTabName.trim(),
          favicon_url: nextFaviconUrl,
          performer_mode: performerMode,
          header_font_family: headerFontFamily.trim(),
          header_font_size: headerFontSize.trim(),
          subheader_font_family: subheaderFontFamily.trim(),
          subheader_font_size: subheaderFontSize.trim(),
          sidebar_font_family: sidebarFontFamily.trim(),
          sidebar_font_size: sidebarFontSize.trim(),
          activity_field_config: activityFieldConfig,
        },
        user.id,
        activeTeam
      )

      if (updatedSettings) {
        onSettingsUpdate(updatedSettings)
        setSuccess('Admin settings saved.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save admin settings.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleFieldEnabledChange = (fieldKey: ConfigurableActivityFieldKey, enabled: boolean) => {
    setActivityFieldConfig((previous) => ({
      ...previous,
      [fieldKey]: {
        enabled,
        required: enabled ? previous[fieldKey].required : false,
        order: previous[fieldKey].order,
      },
    }))
  }

  const handleFieldRequiredChange = (fieldKey: ConfigurableActivityFieldKey, required: boolean) => {
    setActivityFieldConfig((previous) => ({
      ...previous,
      [fieldKey]: {
        enabled: previous[fieldKey].enabled,
        required: previous[fieldKey].enabled ? required : false,
        order: previous[fieldKey].order,
      },
    }))
  }

  const moveField = (fieldKey: ConfigurableActivityFieldKey, direction: -1 | 1) => {
    const currentIndex = orderedFields.findIndex((field) => field.key === fieldKey)
    const targetIndex = currentIndex + direction

    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= orderedFields.length) {
      return
    }

    const currentField = orderedFields[currentIndex]
    const targetField = orderedFields[targetIndex]

    setActivityFieldConfig((previous) => ({
      ...previous,
      [currentField.key]: {
        ...previous[currentField.key],
        order: previous[targetField.key].order,
      },
      [targetField.key]: {
        ...previous[targetField.key],
        order: previous[currentField.key].order,
      },
    }))
  }

  return (
    <div className="modal-overlay">
      <div className="settings-modal admin-settings-modal">
        <div className="modal-header">
          <h2>{user.is_superadmin ? 'Super Admin Settings' : 'Admin Settings'}</h2>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {error && <div className="error-message">{error}</div>}
          {success && <div className="success-message">{success}</div>}

          <div className="form-row form-row-two-up">
            <div className="form-group">
              <label htmlFor="webapp-name">In-App Name</label>
              <input
                id="webapp-name"
                type="text"
                value={webappName}
                onChange={(e) => setWebappName(e.target.value)}
                placeholder="Enter in-app name"
                disabled={isSubmitting || isLoading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="browser-tab-name">Browser Tab Name</label>
              <input
                id="browser-tab-name"
                type="text"
                value={browserTabName}
                onChange={(e) => setBrowserTabName(e.target.value)}
                placeholder="Browser tab title"
                disabled={isSubmitting || isLoading}
              />
            </div>
          </div>

          <div className="form-row form-row-two-up">
            <div className="form-group">
              <label>In-App Logo</label>
              <input
                type="file"
                accept={ACCEPTED_IMAGE_TYPES.join(',')}
                onChange={handleLogoSelect}
                disabled={isSubmitting || isLoading}
              />
              {logoPreview && (
                <div className="logo-preview">
                  <img src={logoPreview} alt="Logo preview" />
                </div>
              )}
            </div>

            <div className="form-group">
              <label>Favicon</label>
              <input
                type="file"
                accept={ACCEPTED_IMAGE_TYPES.join(',')}
                onChange={handleFaviconSelect}
                disabled={isSubmitting || isLoading}
              />
              {faviconPreview && (
                <div className="logo-preview">
                  <img src={faviconPreview} alt="Favicon preview" />
                </div>
              )}
            </div>
          </div>

          <div className="form-group">
            <label>Performer Handling</label>
            <div className="radio-group admin-performer-row">
              <label className="radio-option">
                <input
                  type="radio"
                  name="performer-mode"
                  value="manual"
                  checked={performerMode === 'manual'}
                  onChange={() => setPerformerMode('manual')}
                  disabled={isSubmitting || isLoading}
                />
                <span className="radio-label admin-performer-option-label">
                  <span className="performer-option-icon" aria-hidden="true">✍️</span>
                  <span>Manual Entry</span>
                </span>
              </label>
              <label className="radio-option">
                <input
                  type="radio"
                  name="performer-mode"
                  value="auto"
                  checked={performerMode === 'auto'}
                  onChange={() => setPerformerMode('auto')}
                  disabled={isSubmitting || isLoading}
                />
                <span className="radio-label admin-performer-option-label">
                  <span className="performer-option-icon" aria-hidden="true">🔒</span>
                  <span>Auto-assign</span>
                </span>
              </label>
            </div>
          </div>

          <div className="form-group">
            <label>Headers (font + size)</label>
            <div className="form-row form-row-two-up">
              <input
                type="text"
                value={headerFontFamily}
                onChange={(e) => setHeaderFontFamily(e.target.value)}
                placeholder="Font family"
                disabled={isSubmitting || isLoading}
              />
              <input
                type="text"
                value={headerFontSize}
                onChange={(e) => setHeaderFontSize(e.target.value)}
                placeholder="Size"
                disabled={isSubmitting || isLoading}
              />
            </div>
          </div>

          <div className="form-group">
            <label>Subheaders (font + size)</label>
            <div className="form-row form-row-two-up">
              <input
                type="text"
                value={subheaderFontFamily}
                onChange={(e) => setSubheaderFontFamily(e.target.value)}
                placeholder="Font family"
                disabled={isSubmitting || isLoading}
              />
              <input
                type="text"
                value={subheaderFontSize}
                onChange={(e) => setSubheaderFontSize(e.target.value)}
                placeholder="Size"
                disabled={isSubmitting || isLoading}
              />
            </div>
          </div>

          <div className="form-group">
            <label>Sidebar (font + size)</label>
            <div className="form-row form-row-two-up">
              <input
                type="text"
                value={sidebarFontFamily}
                onChange={(e) => setSidebarFontFamily(e.target.value)}
                placeholder="Font family"
                disabled={isSubmitting || isLoading}
              />
              <input
                type="text"
                value={sidebarFontSize}
                onChange={(e) => setSidebarFontSize(e.target.value)}
                placeholder="Size"
                disabled={isSubmitting || isLoading}
              />
            </div>
          </div>

          {user.is_superadmin && (
            <div className="form-group">
              <label>Team Activity Fields</label>
              <div className="team-activity-fields-grid">
                {orderedFields.map((field, index) => (
                  <div key={field.key} className="team-activity-field-card">
                    <strong className="team-activity-field-title">{field.label}</strong>
                    <div className="radio-group admin-performer-row">
                      <label className="radio-option">
                        <input
                          type="checkbox"
                          checked={activityFieldConfig[field.key].enabled}
                          onChange={(event) => handleFieldEnabledChange(field.key, event.target.checked)}
                          disabled={isSubmitting || isLoading}
                        />
                        <span className="radio-label admin-performer-option-label">
                          <span>Available for this team</span>
                        </span>
                      </label>
                      <label className="radio-option">
                        <input
                          type="checkbox"
                          checked={activityFieldConfig[field.key].required}
                          onChange={(event) => handleFieldRequiredChange(field.key, event.target.checked)}
                          disabled={isSubmitting || isLoading || !activityFieldConfig[field.key].enabled}
                        />
                        <span className="radio-label admin-performer-option-label">
                          <span>Required when shown</span>
                        </span>
                      </label>
                    </div>
                    <div className="team-activity-field-order-row">
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={index + 1}
                        readOnly
                        disabled={isSubmitting || isLoading}
                        className="team-activity-field-order-input"
                      />
                      <div className="team-activity-field-move-buttons">
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => moveField(field.key, -1)}
                          disabled={isSubmitting || isLoading || index === 0}
                        >
                          Move Up
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => moveField(field.key, 1)}
                          disabled={isSubmitting || isLoading || index === orderedFields.length - 1}
                        >
                          Move Down
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="modal-actions">
            <button type="submit" className="btn btn-primary" disabled={isSubmitting || isLoading}>
              {isSubmitting ? 'Saving...' : 'Save Settings'}
            </button>
            {user.is_superadmin && (
              <button type="button" className="btn btn-user-management" onClick={onOpenUserManagement}>
                Open User Management
              </button>
            )}
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={isSubmitting || isLoading}>
              Close
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export const SuperAdminPanel = AdminPanel
