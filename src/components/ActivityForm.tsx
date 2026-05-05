import React, { useEffect, useMemo, useState } from 'react'
import { ACTIVITY_TYPE_OPTIONS } from '../constants/activityTypes'
import { type Activity, type Settings, type Team } from '../supabaseClient'
import {
  type ActivityFieldDefinition,
  getActivityFieldValue,
  getEnabledActivityFields,
  isActivityFieldRequired,
  setActivityFieldValue,
} from '../utils/activityFields'
import { buildCommentWithPrefixes, parseCommentPrefixes } from '../utils/comments'
import { getLayoutConfig } from '../utils/layoutConfig'
import { getSystemFieldOptions } from '../utils/teamActivityField'

interface ActivityFormProps {
  onSubmit: (activity: Activity) => Promise<void>
  initialData?: Activity
  isLoading?: boolean
  performerMode?: 'manual' | 'auto'
  currentUserName?: string
  activeTeam?: Team | null
  settings?: Settings
}

const getTodayDate = () => {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const getInitialFormData = (): Activity => ({
  date: getTodayDate(),
  performer: '',
  system: '',
  shift: '',
  permitNumber: '',
  instrumentType: '',
  activityType: '',
  tag: '',
  problem: '',
  action: '',
  comments: '',
  customFields: {},
})

function useResponsiveColumns(baseColumns: { mobile: number; tablet: number; desktop: number }) {
  const [columns, setColumns] = useState(baseColumns.desktop)

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const updateColumns = () => {
      if (window.innerWidth <= 640) {
        setColumns(baseColumns.mobile)
        return
      }

      if (window.innerWidth <= 1024) {
        setColumns(baseColumns.tablet)
        return
      }

      setColumns(baseColumns.desktop)
    }

    updateColumns()
    window.addEventListener('resize', updateColumns)
    return () => window.removeEventListener('resize', updateColumns)
  }, [baseColumns.desktop, baseColumns.mobile, baseColumns.tablet])

  return columns
}

export const ActivityForm: React.FC<ActivityFormProps> = ({
  onSubmit,
  initialData,
  isLoading = false,
  performerMode = 'manual',
  currentUserName = '',
  activeTeam,
  settings,
}) => {
  const [formData, setFormData] = useState<Activity>(getInitialFormData())
  const systemFieldOptions = getSystemFieldOptions(activeTeam)
  const visibleFields = useMemo(() => getEnabledActivityFields(settings), [settings])
  const checkboxFields = useMemo(() => visibleFields.filter((field) => field.type === 'checkbox'), [visibleFields])
  const layoutConfig = getLayoutConfig(settings)
  const mainGridColumns = useResponsiveColumns(layoutConfig.activityFormColumns)

  const applyParsedCommentToActivity = useMemo(
    () => (activity: Activity) => {
      const parsedComment = parseCommentPrefixes(activity.comments)
      const checkboxFieldMap = new Map(checkboxFields.map((field) => [field.label.trim().toLowerCase(), field.key]))
      const nextCustomFields = { ...(activity.customFields || {}) }
      if (parsedComment.hasMoc || String(nextCustomFields.mocActivity || '').toLowerCase() === 'true') {
        nextCustomFields.mocActivity = 'true'
      } else {
        delete nextCustomFields.mocActivity
      }

      checkboxFields.forEach((field) => {
        if (field.key === 'mocActivity') {
          return
        }
        const hasMatchingToken = parsedComment.checkboxLabels.some((label) => label.toLowerCase() === field.label.trim().toLowerCase())
        if (hasMatchingToken || String(nextCustomFields[field.key] || '').toLowerCase() === 'true') {
          nextCustomFields[field.key] = 'true'
        } else {
          delete nextCustomFields[field.key]
        }
      })

      parsedComment.checkboxLabels.forEach((label) => {
        const matchingFieldKey = checkboxFieldMap.get(label.toLowerCase())
        if (matchingFieldKey) {
          nextCustomFields[matchingFieldKey] = 'true'
        }
      })

      return {
        parsedComment,
        normalizedActivity: {
          ...activity,
          activityType: activity.activityType ?? '',
          comments: parsedComment.commentBody,
          customFields: nextCustomFields,
        },
      }
    },
    [checkboxFields]
  )

  useEffect(() => {

    if (initialData) {
      const { parsedComment, normalizedActivity } = applyParsedCommentToActivity(initialData)
      setFormData({
        ...normalizedActivity,
      })
      return
    }

    const nextFormData = getInitialFormData()
    if (performerMode === 'auto' && currentUserName) {
      nextFormData.performer = currentUserName
    }

    setFormData(nextFormData)
  }, [applyParsedCommentToActivity, currentUserName, initialData, performerMode])

  const handleChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name } = event.target
    if (event.target instanceof HTMLInputElement && event.target.type === 'checkbox') {
      const input = event.target as HTMLInputElement
      setFormData((previous) => setActivityFieldValue(previous, name, input.checked))
      return
    }

    setFormData((previous) => setActivityFieldValue(previous, name, event.target.value))
  }

  const handleReset = () => {
    if (initialData) {
      const { parsedComment, normalizedActivity } = applyParsedCommentToActivity(initialData)
      setFormData({
        ...normalizedActivity,
      })
      return
    }

    const nextFormData = getInitialFormData()
    if (performerMode === 'auto' && currentUserName) {
      nextFormData.performer = currentUserName
    }

    setFormData(nextFormData)
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    const checkboxLabels = checkboxFields
      .filter((field) => field.key !== 'mocActivity')
      .filter((field) => String(getActivityFieldValue(formData, field.key)).toLowerCase() === 'true')
      .map((field) => field.label)
    const prefixedComments = buildCommentWithPrefixes({
      comment: formData.comments,
      hasMoc: String(getActivityFieldValue(formData, 'mocActivity')).toLowerCase() === 'true',
      otherPerformerName: '',
      checkboxLabels,
    })

    await onSubmit({
      ...formData,
      comments: prefixedComments,
    })

    if (!initialData) {
      handleReset()
    }
  }

  const renderField = (field: ActivityFieldDefinition) => {
    const required = isActivityFieldRequired(settings, field.key)
    const value = getActivityFieldValue(formData, field.key)

    if (field.key === 'performer') {
      return (
        <div className="form-group" key={field.key}>
          <label htmlFor="performer">
            {field.label}
            {required ? ' *' : ''}
          </label>
          {performerMode === 'auto' ? (
            <>
              <input
                type="text"
                id="performer"
                name="performer"
                value={value}
                onChange={handleChange}
                disabled
                placeholder={field.placeholder}
                required={required}
              />
              <small className="form-hint">Auto-filled from your signed-in account.</small>
            </>
          ) : (
            <input
              type="text"
              id="performer"
              name="performer"
              value={value}
              onChange={handleChange}
              placeholder={field.placeholder}
              required={required}
            />
          )}
        </div>
      )
    }

    if (field.key === 'system') {
      return (
        <div className="form-group" key={field.key}>
          <label htmlFor="system">
            {field.label}
            {required ? ' *' : ''}
          </label>
          <select id="system" name="system" value={value} onChange={handleChange} required={required}>
            <option value="">-- Select System --</option>
            {systemFieldOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
      )
    }

    if (field.key === 'activityType') {
      return (
        <div className="form-group" key={field.key}>
          <label htmlFor="activityType">
            {field.label}
            {required ? ' *' : ''}
          </label>
          <select id="activityType" name="activityType" value={value} onChange={handleChange} required={required}>
            <option value="">-- Select Activity Type --</option>
            {ACTIVITY_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      )
    }

    if (field.type === 'date') {
      return (
        <div className="form-group" key={field.key}>
          <label htmlFor={field.key}>
            {field.label}
            {required ? ' *' : ''}
          </label>
          <input type="date" id={field.key} name={field.key} value={value} onChange={handleChange} required={required} />
        </div>
      )
    }

    if (field.type === 'select') {
      return (
        <div className="form-group" key={field.key}>
          <label htmlFor={field.key}>
            {field.label}
            {required ? ' *' : ''}
          </label>
          <select id={field.key} name={field.key} value={value} onChange={handleChange} required={required}>
            <option value="">{`-- ${field.placeholder} --`}</option>
            {(field.options || []).map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
      )
    }

    if (field.type === 'checkbox') {
      const checked = value.toLowerCase() === 'true'
      const checkboxPrefixHint =
        field.key === 'mocActivity'
          ? <>When checked, comments are prefixed with <code>{'{MOC}'}</code>.</>
          : <>When checked, comments are prefixed with <code>{`{${field.label}}`}</code>.</>
      const placeholderText = field.placeholder?.trim()

      return (
        <div className="form-group form-group-inline-checkbox" key={field.key}>
          <div className="moc-inline-control">
            <span className="moc-inline-title">
              {field.label}
              {required ? ' *' : ''}
            </span>
            <input
              type="checkbox"
              id={field.key}
              name={field.key}
              checked={checked}
              onChange={handleChange}
              required={required && !checked}
            />
          </div>
          {placeholderText && placeholderText !== field.label ? (
            <small className="form-hint checkbox-placeholder-hint">{placeholderText}</small>
          ) : null}
          <small className="form-hint checkbox-prefix-hint">{checkboxPrefixHint}</small>
        </div>
      )
    }

    if (field.type === 'textarea') {
      return (
        <div className="form-group" key={field.key}>
          <label htmlFor={field.key}>
            {field.label}
            {required ? ' *' : ''}
          </label>
          <textarea
            id={field.key}
            name={field.key}
            value={value}
            onChange={handleChange}
            placeholder={field.placeholder}
            required={required}
          />
        </div>
      )
    }

    return (
      <div className="form-group" key={field.key}>
        <label htmlFor={field.key}>
          {field.label}
          {required ? ' *' : ''}
        </label>
        <input
          type="text"
          id={field.key}
          name={field.key}
          value={value}
          onChange={handleChange}
          placeholder={field.placeholder}
          required={required}
        />
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="activity-form-compact">
      <div
        className="form-row activity-main-grid"
        style={{ display: 'grid', gridTemplateColumns: `repeat(${mainGridColumns}, minmax(0, 1fr))`, gap: '1rem' }}
      >
        {visibleFields.map((field) => renderField(field))}
      </div>

      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={isLoading}>
          {isLoading ? 'Saving...' : initialData ? 'Update Activity' : 'Add Activity'}
        </button>
        <button type="button" className="btn btn-secondary" onClick={handleReset}>
          {initialData ? 'Reset Changes' : 'Clear'}
        </button>
      </div>
    </form>
  )
}
