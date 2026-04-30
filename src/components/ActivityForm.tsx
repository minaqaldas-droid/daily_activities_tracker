import React, { useEffect, useState } from 'react'
import { ACTIVITY_TYPE_OPTIONS } from '../constants/activityTypes'
import { type Activity, type Settings, type Team } from '../supabaseClient'
import {
  type ActivityFieldDefinition,
  type ConfigurableActivityFieldKey,
  getEnabledActivityFields,
  isActivityFieldRequired,
} from '../utils/activityFields'
import { buildCommentWithPrefixes, parseCommentPrefixes } from '../utils/comments'
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
})

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
  const [isMocActivity, setIsMocActivity] = useState(false)
  const systemFieldOptions = getSystemFieldOptions(activeTeam)
  const visibleFields = getEnabledActivityFields(settings)
  const commentsFieldVisible = visibleFields.some((field) => field.key === 'comments')

  useEffect(() => {
    if (initialData) {
      const parsedComment = parseCommentPrefixes(initialData.comments)
      setFormData({
        ...initialData,
        activityType: initialData.activityType ?? '',
        comments: parsedComment.commentBody,
      })
      setIsMocActivity(parsedComment.hasMoc)
      return
    }

    const nextFormData = getInitialFormData()
    if (performerMode === 'auto' && currentUserName) {
      nextFormData.performer = currentUserName
    }

    setIsMocActivity(false)
    setFormData(nextFormData)
  }, [currentUserName, initialData, performerMode])

  const handleChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = event.target

    setFormData((previous) => ({
      ...previous,
      [name]: value,
    }))
  }

  const handleReset = () => {
    if (initialData) {
      const parsedComment = parseCommentPrefixes(initialData.comments)
      setFormData({
        ...initialData,
        activityType: initialData.activityType ?? '',
        comments: parsedComment.commentBody,
      })
      setIsMocActivity(parsedComment.hasMoc)
      return
    }

    const nextFormData = getInitialFormData()
    if (performerMode === 'auto' && currentUserName) {
      nextFormData.performer = currentUserName
    }

    setIsMocActivity(false)
    setFormData(nextFormData)
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    const prefixedComments = buildCommentWithPrefixes({
      comment: formData.comments,
      hasMoc: commentsFieldVisible ? isMocActivity : false,
      otherPerformerName: '',
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

    if (field.key === 'performer') {
      return (
        <div className="form-group" key={field.key}>
          <label htmlFor="performer">
            Performer
            {required ? ' *' : ''}
          </label>
          {performerMode === 'auto' ? (
            <>
              <input
                type="text"
                id="performer"
                name="performer"
                value={formData.performer}
                onChange={handleChange}
                disabled
                placeholder="Enter performer name"
                required={required}
              />
              <small className="form-hint">Auto-filled from your signed-in account.</small>
            </>
          ) : (
            <input
              type="text"
              id="performer"
              name="performer"
              value={formData.performer}
              onChange={handleChange}
              placeholder="Enter performer name"
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
            System
            {required ? ' *' : ''}
          </label>
          <select id="system" name="system" value={formData.system} onChange={handleChange} required={required}>
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
            Activity Type
            {required ? ' *' : ''}
          </label>
          <select
            id="activityType"
            name="activityType"
            value={formData.activityType}
            onChange={handleChange}
            required={required}
          >
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
          <input
            type="date"
            id={field.key}
            name={field.key}
            value={formData.date}
            onChange={handleChange}
            required={required}
          />
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
          <select
            id={field.key}
            name={field.key}
            value={String(formData[field.key] || '')}
            onChange={handleChange}
            required={required}
          >
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
            value={String(formData[field.key] || '')}
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
          value={String(formData[field.key] || '')}
          onChange={handleChange}
          placeholder={field.placeholder}
          required={required}
        />
      </div>
    )
  }

  const mainGridFields = visibleFields.filter((field) => !['problem', 'action', 'comments'].includes(field.key))
  const textAreaFields = visibleFields.filter((field) => ['problem', 'action', 'comments'].includes(field.key))
  const problemField = textAreaFields.find((field) => field.key === 'problem')
  const actionField = textAreaFields.find((field) => field.key === 'action')
  const extraTextAreaFields = textAreaFields.filter((field) => !['problem', 'action'].includes(field.key))

  return (
    <form onSubmit={handleSubmit} className="activity-form-compact">
      <div className="form-row form-row-three-up activity-main-grid">
        {mainGridFields.map((field) => renderField(field))}

        {commentsFieldVisible && (
          <div className="form-group form-group-inline-checkbox moc-inline-cell">
            <div className="moc-inline-control">
              <span className="moc-inline-title">MOC Activity</span>
              <input
                type="checkbox"
                checked={isMocActivity}
                onChange={(event) => setIsMocActivity(event.target.checked)}
                aria-label="MOC Activity"
              />
            </div>
            <small className="form-hint">
              When checked, comments are prefixed with <code>{'{MOC}'}</code>.
            </small>
          </div>
        )}
      </div>

      {(problemField || actionField) && (
        <div className="form-row form-row-two-up">
          {problemField ? renderField(problemField) : <div />}
          {actionField ? renderField(actionField) : <div />}
        </div>
      )}

      {extraTextAreaFields.map((field) => (
        <div className="form-row" key={field.key}>
          {renderField(field)}
        </div>
      ))}

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
