import React, { useEffect, useState } from 'react'
import { ACTIVITY_TYPE_OPTIONS } from '../constants/activityTypes'
import { SYSTEM_OPTIONS } from '../constants/systems'
import { type Activity, type Team, getEditors } from '../supabaseClient'
import { buildCommentWithPrefixes, parseCommentPrefixes } from '../utils/comments'

interface ActivityFormProps {
  onSubmit: (activity: Activity) => Promise<void>
  initialData?: Activity
  isLoading?: boolean
  performerMode?: 'manual' | 'auto'
  currentUserName?: string
  activeTeam?: Team | null
}

const getTodayDate = () => {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const MONTH_SHORT_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const formatSelectedDateLabel = (value: string) => {
  if (!value) {
    return ''
  }

  const [year, month, day] = value.split('-')
  const monthIndex = Number(month) - 1
  const dayNumber = Number(day)

  if (!year || Number.isNaN(monthIndex) || Number.isNaN(dayNumber) || monthIndex < 0 || monthIndex > 11) {
    return value
  }

  return `${dayNumber}-${MONTH_SHORT_NAMES[monthIndex]}-${year}`
}

const getInitialFormData = (): Activity => ({
  date: getTodayDate(),
  performer: '',
  system: '',
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
}) => {
  const [formData, setFormData] = useState<Activity>(getInitialFormData())
  const [usersList, setUsersList] = useState<Array<{ id: string; name: string; email: string }>>([])
  const [isLoadingUsers, setIsLoadingUsers] = useState(false)
  const [performerIsOther, setPerformerIsOther] = useState(false)
  const [isMocActivity, setIsMocActivity] = useState(false)
  const [otherPerformerName, setOtherPerformerName] = useState('')

  useEffect(() => {
    if (initialData) {
      const parsedComment = parseCommentPrefixes(initialData.comments)
      setFormData({
        ...initialData,
        activityType: initialData.activityType ?? '',
        comments: parsedComment.commentBody,
      })
      setPerformerIsOther(initialData.performer === 'Other')
      setIsMocActivity(parsedComment.hasMoc)
      setOtherPerformerName(parsedComment.otherPerformerName)
      return
    }

    const nextFormData = getInitialFormData()
    if (performerMode === 'auto' && currentUserName) {
      nextFormData.performer = currentUserName
    }

    setPerformerIsOther(nextFormData.performer === 'Other')
    setIsMocActivity(false)
    setOtherPerformerName('')
    setFormData(nextFormData)
  }, [currentUserName, initialData, performerMode])

  useEffect(() => {
    if (performerMode !== 'manual') {
      setPerformerIsOther(false)
      return
    }

    setPerformerIsOther(formData.performer === 'Other')
  }, [formData.performer, performerMode])

  useEffect(() => {
    if (performerMode !== 'manual') {
      return
    }

    const loadUsers = async () => {
      try {
        setIsLoadingUsers(true)
        const users = await getEditors(activeTeam)
        setUsersList(users || [])
      } catch (error) {
        console.error('Failed to load editors:', error)
      } finally {
        setIsLoadingUsers(false)
      }
    }

    void loadUsers()
  }, [activeTeam, performerMode])

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target

    setFormData((prev) => ({
      ...prev,
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
      setPerformerIsOther(initialData.performer === 'Other')
      setIsMocActivity(parsedComment.hasMoc)
      setOtherPerformerName(parsedComment.otherPerformerName)
      return
    }

    const nextFormData = getInitialFormData()
    if (performerMode === 'auto' && currentUserName) {
      nextFormData.performer = currentUserName
    }

    setPerformerIsOther(false)
    setIsMocActivity(false)
    setOtherPerformerName('')
    setFormData(nextFormData)
  }

  const showLegacyPerformerOption =
    performerMode === 'manual' &&
    !isLoadingUsers &&
    Boolean(formData.performer) &&
    formData.performer !== 'Other' &&
    !usersList.some((user) => user.name === formData.performer)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const prefixedComments = buildCommentWithPrefixes({
      comment: formData.comments,
      hasMoc: isMocActivity,
      otherPerformerName: performerIsOther ? otherPerformerName : '',
    })

    await onSubmit({
      ...formData,
      comments: prefixedComments,
    })

    if (!initialData) {
      handleReset()
    }
  }

  return (
    <form onSubmit={handleSubmit} className="activity-form-compact">
      <div className="form-row form-row-three-up activity-main-grid">
        <div className="form-group">
          <label htmlFor="date">Date *</label>
          <input type="date" id="date" name="date" value={formData.date} onChange={handleChange} required />
        </div>

        <div className="form-group">
          <label htmlFor="performer">Performer *</label>
          {performerMode === 'manual' ? (
            <>
              <select
                id="performer"
                name="performer"
                value={formData.performer}
                onChange={(e) => {
                  if (e.target.value === 'Other') {
                    setPerformerIsOther(true)
                    setFormData((prev) => ({
                      ...prev,
                      performer: 'Other',
                    }))
                    return
                  }

                  setPerformerIsOther(false)
                  setFormData((prev) => ({
                    ...prev,
                    performer: e.target.value,
                  }))
                }}
                required
                disabled={isLoadingUsers}
              >
                <option value="">-- Select Performer --</option>
                {showLegacyPerformerOption && <option value={formData.performer}>{formData.performer}</option>}
                {usersList.map((user) => (
                  <option key={user.id} value={user.name}>
                    {user.name}
                  </option>
                ))}
                <option value="Other">Other</option>
              </select>
              {performerIsOther && (
                <div className="activity-other-performer-inline">
                  <label htmlFor="otherPerformerName">Other Performer Name *</label>
                  <input
                    type="text"
                    id="otherPerformerName"
                    name="otherPerformerName"
                    value={otherPerformerName}
                    onChange={(e) => setOtherPerformerName(e.target.value)}
                    placeholder="Enter performer name"
                    required
                  />
                  <small className="form-hint">
                    Added to comments as <code>[Name]</code>.
                  </small>
                </div>
              )}
            </>
          ) : (
            <>
              <input
                type="text"
                id="performer"
                name="performer"
                value={formData.performer}
                onChange={handleChange}
                disabled
                placeholder="Enter performer name"
                required
              />
              <small className="form-hint">Auto-filled from your signed-in account.</small>
            </>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="system">System *</label>
          <select id="system" name="system" value={formData.system} onChange={handleChange} required>
            <option value="">-- Select System --</option>
            {SYSTEM_OPTIONS.map((system) => (
              <option key={system} value={system}>
                {system}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="activityType">Activity Type *</label>
          <select
            id="activityType"
            name="activityType"
            value={formData.activityType}
            onChange={handleChange}
            required
          >
            <option value="">-- Select Activity Type --</option>
            {ACTIVITY_TYPE_OPTIONS.map((activityTypeOption) => (
              <option key={activityTypeOption.value} value={activityTypeOption.value}>
                {activityTypeOption.label}
              </option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label htmlFor="tag">Tag *</label>
          <input
            type="text"
            id="tag"
            name="tag"
            value={formData.tag}
            onChange={handleChange}
            placeholder="e.g. 920TT305, PLC Panel, or any relevant tag"
            required
          />
        </div>

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
      </div>

      <div className="form-row form-row-two-up">
        <div className="form-group">
          <label htmlFor="problem">Problem *</label>
          <textarea
            id="problem"
            name="problem"
            value={formData.problem}
            onChange={handleChange}
            placeholder="Describe the problem encountered"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="action">Action Taken *</label>
          <textarea
            id="action"
            name="action"
            value={formData.action}
            onChange={handleChange}
            placeholder="Describe the action taken"
            required
          />
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="comments">Comments</label>
          <textarea
            id="comments"
            name="comments"
            value={formData.comments}
            onChange={handleChange}
            placeholder="Any additional comments (optional)"
          />
        </div>
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
