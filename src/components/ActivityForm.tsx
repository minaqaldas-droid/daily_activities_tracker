import React, { useEffect, useState } from 'react'
import { SYSTEM_OPTIONS } from '../constants/systems'
import { type Activity, getUsers } from '../supabaseClient'

interface ActivityFormProps {
  onSubmit: (activity: Activity) => Promise<void>
  initialData?: Activity
  isLoading?: boolean
  performerMode?: 'manual' | 'auto'
  currentUserName?: string
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
  instrument: '',
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
}) => {
  const [formData, setFormData] = useState<Activity>(getInitialFormData())
  const [usersList, setUsersList] = useState<Array<{ id: string; name: string; email: string }>>([])
  const [isLoadingUsers, setIsLoadingUsers] = useState(false)
  const [performerIsOther, setPerformerIsOther] = useState(false)

  useEffect(() => {
    if (initialData) {
      setFormData({
        ...initialData,
        comments: initialData.comments ?? '',
      })
      return
    }

    const nextFormData = getInitialFormData()
    if (performerMode === 'auto' && currentUserName) {
      nextFormData.performer = currentUserName
    }

    setFormData(nextFormData)
  }, [currentUserName, initialData, performerMode])

  useEffect(() => {
    if (performerMode !== 'manual') {
      setPerformerIsOther(false)
      return
    }

    const isKnownUser = usersList.some((user) => user.name === formData.performer)
    const shouldNormalizeToOther =
      Boolean(formData.performer) && formData.performer !== 'Other' && !isKnownUser

    if (shouldNormalizeToOther) {
      setFormData((prev) => ({
        ...prev,
        performer: 'Other',
      }))
      setPerformerIsOther(true)
      return
    }

    setPerformerIsOther(formData.performer === 'Other')
  }, [formData.performer, performerMode, usersList])

  useEffect(() => {
    if (performerMode !== 'manual') {
      return
    }

    const loadUsers = async () => {
      try {
        setIsLoadingUsers(true)
        const users = await getUsers()
        setUsersList(users || [])
      } catch (error) {
        console.error('Failed to load users:', error)
      } finally {
        setIsLoadingUsers(false)
      }
    }

    void loadUsers()
  }, [performerMode])

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
      setFormData({
        ...initialData,
        comments: initialData.comments ?? '',
      })
      return
    }

    const nextFormData = getInitialFormData()
    if (performerMode === 'auto' && currentUserName) {
      nextFormData.performer = currentUserName
    }

    setPerformerIsOther(false)
    setFormData(nextFormData)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await onSubmit(formData)

    if (!initialData) {
      handleReset()
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="form-row form-row-two-up">
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
                {usersList.map((user) => (
                  <option key={user.id} value={user.name}>
                    {user.name}
                  </option>
                ))}
                <option value="Other">Other</option>
              </select>
              <small className="form-hint">Select a team member or choose "Other".</small>
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
      </div>

      <div className="form-row form-row-two-up">
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
          <label htmlFor="instrument">Instrument/Tag *</label>
          <input
            type="text"
            id="instrument"
            name="instrument"
            value={formData.instrument}
            onChange={handleChange}
            placeholder="e.g. 920TT305, or any relevant tag, PLC Panel, etc."
            required
          />
        </div>
      </div>

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

      <div className="form-group">
        <label htmlFor="comments">Comments</label>
        <textarea
          id="comments"
          name="comments"
          value={formData.comments}
          onChange={handleChange}
          placeholder="Any additional comments (optional)"
        />
        <small className="form-hint">
          {performerIsOther && performerMode === 'manual'
            ? 'Please add any extra context about the custom performer entry here.'
            : 'Additional notes about this activity.'}
        </small>
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
