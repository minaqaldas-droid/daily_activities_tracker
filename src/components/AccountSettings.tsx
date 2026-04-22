import React, { useEffect, useState } from 'react'
import { type User, updateUserDetails, uploadUserPhoto } from '../supabaseClient'

interface AccountSettingsProps {
  user: User
  onUpdateSuccess: (user: User) => void
  onClose: () => void
  isLoading?: boolean
  currentPrimaryColor: string
}

export const AccountSettings: React.FC<AccountSettingsProps> = ({
  user,
  onUpdateSuccess,
  onClose,
  isLoading = false,
  currentPrimaryColor,
}) => {
  const [name, setName] = useState(user.name)
  const [email, setEmail] = useState(user.email)
  const [avatarUrl, setAvatarUrl] = useState(user.avatar_url || '')
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(user.avatar_url || null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [primaryColor, setPrimaryColor] = useState(currentPrimaryColor || '#667eea')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    setName(user.name)
    setEmail(user.email)
    setAvatarUrl(user.avatar_url || '')
    setAvatarFile(null)
    setPreviewUrl(user.avatar_url || null)
    setUploadProgress(0)
    setNewPassword('')
    setConfirmPassword('')
    setPrimaryColor(currentPrimaryColor || '#667eea')
    setError('')
    setSuccess('')
  }, [user, currentPrimaryColor])

  useEffect(() => {
    if (!previewUrl || !previewUrl.startsWith('blob:')) {
      return
    }

    return () => {
      URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const handleAvatarFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) {
      return
    }

    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/webp']
    if (!validTypes.includes(file.type)) {
      setError('Please select a valid image file (PNG, JPG, SVG, or WebP).')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('File size must be less than 5MB.')
      return
    }

    setError('')
    setUploadProgress(0)

    const objectUrl = URL.createObjectURL(file)
    setAvatarFile(file)
    setPreviewUrl(objectUrl)
    setUploadProgress(100)
    window.setTimeout(() => setUploadProgress(0), 1000)
  }

  const handleRemoveAvatar = () => {
    setAvatarUrl('')
    setAvatarFile(null)
    setPreviewUrl(null)
    setUploadProgress(0)
    setError('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!name.trim() || !email.trim()) {
      setError('Name and email are required.')
      return
    }

    if (newPassword && newPassword !== confirmPassword) {
      setError('New passwords do not match.')
      return
    }

    try {
      setIsSubmitting(true)
      let nextAvatarUrl = avatarUrl

      if (avatarFile) {
        setUploadProgress(30)
        nextAvatarUrl = await uploadUserPhoto(user.id, avatarFile)
        setUploadProgress(100)
      }

      const result = await updateUserDetails(user.id, {
        name,
        email,
        password: newPassword || undefined,
        avatarUrl: nextAvatarUrl,
        preferredPrimaryColor: primaryColor,
      })

      onUpdateSuccess(result.user)

      setSuccess(
        result.emailChangePending
          ? `Profile updated. Confirm the email change sent to ${result.pendingEmail}.`
          : 'Account details updated successfully.'
      )
      setNewPassword('')
      setConfirmPassword('')
      setAvatarFile(null)

      setTimeout(onClose, 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update account.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const avatarInitial = name.trim().charAt(0).toUpperCase() || user.name.trim().charAt(0).toUpperCase() || 'U'

  return (
    <div className="modal-overlay">
      <div className="settings-modal account-settings-modal">
        <div className="modal-header">
          <h2>Account Settings</h2>
          <button type="button" className="modal-close" onClick={onClose}>
            &times;
          </button>
        </div>

        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message">{success}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Profile Picture</label>
            <div className="avatar-editor">
              <div className="avatar-preview-card">
                {previewUrl ? (
                  <img
                    src={previewUrl}
                    alt="Profile preview"
                    className="avatar-preview-image"
                    onError={() => {
                      setError('Could not load the selected profile picture.')
                      setPreviewUrl(null)
                    }}
                  />
                ) : (
                  <div className="avatar-preview-placeholder">{avatarInitial}</div>
                )}
              </div>

              <div className="avatar-editor-fields">
                <label className="file-input-label">
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp"
                    onChange={handleAvatarFileSelect}
                    disabled={isSubmitting || isLoading}
                  />
                  <span className="file-input-button">
                    {uploadProgress > 0 && uploadProgress < 100
                      ? `Uploading... ${uploadProgress}%`
                      : 'Choose Profile Picture'}
                  </span>
                </label>
                <span className="form-hint">Upload only. PNG, JPG, SVG, or WebP. Max 5MB.</span>

                <div className="avatar-editor-actions">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleRemoveAvatar}
                    disabled={isSubmitting || isLoading || (!avatarUrl && !previewUrl)}
                  >
                    Remove Picture
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="name">Full Name *</label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isSubmitting || isLoading}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="email">Email *</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isSubmitting || isLoading}
              required
            />
            <small className="form-hint">Changing the email may require confirmation through Supabase Auth.</small>
          </div>

          <hr style={{ margin: '20px 0', border: 'none', borderTop: '1px solid #ddd' }} />

          <div className="form-group">
            <label htmlFor="primaryColor">Primary Color</label>
            <div className="color-input-group">
              <input
                id="primaryColor"
                type="color"
                value={primaryColor}
                onChange={(event) => setPrimaryColor(event.target.value)}
                disabled={isSubmitting || isLoading}
              />
              <input
                type="text"
                value={primaryColor}
                onChange={(event) => setPrimaryColor(event.target.value)}
                placeholder="#667eea"
                disabled={isSubmitting || isLoading}
                className="color-hex-input"
              />
            </div>
            <small className="form-hint">Applies to your own app theme.</small>
          </div>

          <div className="form-group">
            <label htmlFor="newPassword">New Password</label>
            <input
              type="password"
              id="newPassword"
              name="newPassword"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Leave blank to keep your current password"
              disabled={isSubmitting || isLoading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">Confirm New Password</label>
            <input
              type="password"
              id="confirmPassword"
              name="confirmPassword"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
              disabled={isSubmitting || isLoading}
            />
          </div>

          <div className="modal-actions">
            <button type="submit" className="btn btn-primary" disabled={isSubmitting || isLoading}>
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={isSubmitting || isLoading}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
