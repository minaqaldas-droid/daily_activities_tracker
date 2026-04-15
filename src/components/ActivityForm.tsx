import React, { useState, useEffect } from 'react'
import { Activity, getUsers } from '../supabaseClient'

const SYSTEMS = [
  'DCS',
  'ESD',
  'FGS',
  'ACCS',
  'LCS',
  '200K1A',
  '200K1B',
  '200K2A',
  '200K2B',
  '400K1',
  '923K1A',
  '923K1B',
  '923K1C',
  'Demi',
  'Sanitary',
  'Steam Boiler',
  'Air Dryer A/B',
  'Air Dryer C/D',
  '400CEMS',
]

interface ActivityFormProps {
  onSubmit: (activity: Activity) => Promise<void>
  initialData?: Activity
  isLoading?: boolean
  performerMode?: 'manual' | 'auto'
  currentUserName?: string
}

export const ActivityForm: React.FC<ActivityFormProps> = ({
  onSubmit,
  initialData,
  isLoading = false,
  performerMode = 'manual',
  currentUserName = '',
}) => {
  const [formData, setFormData] = useState<Activity>({
    date: new Date().toISOString().split('T')[0],
    performer: '',
    system: '',
    instrument: '',
    problem: '',
    action: '',
    comments: '',
  })
  const [usersList, setUsersList] = useState<Array<{ id: string; name: string; email: string }>>([])
  const [isLoadingUsers, setIsLoadingUsers] = useState(false)
  const [performerIsOther, setPerformerIsOther] = useState(false)

  useEffect(() => {
    if (initialData) {
      setFormData(initialData)
      // Check if performer is in the users list
      const isUserInList = usersList.some((u) => u.name === initialData.performer)
      if (!isUserInList && initialData.performer) {
        setPerformerIsOther(true)
      }
    } else if (performerMode === 'auto' && currentUserName && !formData.performer) {
      // Auto-fill performer name when in auto mode
      setFormData((prev) => ({
        ...prev,
        performer: currentUserName,
      }))
    }
  }, [initialData, performerMode, currentUserName])

  useEffect(() => {
    // Load users list for manual mode dropdown
    if (performerMode === 'manual') {
      loadUsers()
    }
  }, [performerMode])

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

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await onSubmit(formData)
    // Only reset form when adding new activity (not editing)
    if (!initialData) {
      setFormData({
        date: new Date().toISOString().split('T')[0],
        performer: '',
        system: '',
        instrument: '',
        problem: '',
        action: '',
        comments: '',
      })
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="form-group">
        <label htmlFor="date">Date *</label>
        <input
          type="date"
          id="date"
          name="date"
          value={formData.date}
          onChange={handleChange}
          required
        />
      </div>

      <div className="form-group">
        <label htmlFor="performer">Performer *</label>
        {performerMode === 'manual' ? (
          <>
            <select
              id="performer"
              name="performer"
              value={performerIsOther ? 'OTHER' : formData.performer}
              onChange={(e) => {
                if (e.target.value === 'OTHER') {
                  setPerformerIsOther(true)
                  setFormData((prev) => ({
                    ...prev,
                    performer: '',
                  }))
                } else {
                  setPerformerIsOther(false)
                  setFormData((prev) => ({
                    ...prev,
                    performer: e.target.value,
                  }))
                }
              }}
              required={!performerIsOther}
              disabled={isLoadingUsers}
            >
              <option value="">-- Select Performer --</option>
              {usersList.map((user) => (
                <option key={user.id} value={user.name}>
                  {user.name}
                </option>
              ))}
              <option value="OTHER">Other</option>
            </select>
            <small className="form-hint">Select a user or choose "Other"</small>

            {performerIsOther && (
              <>
                <input
                  type="text"
                  id="performer-other"
                  name="performer-other"
                  value={formData.performer}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      performer: e.target.value,
                    }))
                  }
                  placeholder="Enter performer name"
                  required
                  style={{ marginTop: '10px' }}
                />
              </>
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
              disabled={performerMode === 'auto'}
              placeholder="Enter performer name"
              required
            />
            <small className="form-hint">🔐 Auto-filled from your account</small>
          </>
        )}
      </div>

      <div className="form-group">
        <label htmlFor="system">System *</label>
        <select
          id="system"
          name="system"
          value={formData.system}
          onChange={handleChange}
          required
        >
          <option value="">-- Select System --</option>
          {SYSTEMS.map((sys) => (
            <option key={sys} value={sys}>
              {sys}
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
          placeholder="e.g., Machine A, Tool #123, Device X"
          required
        />
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
            ? '💡 Please identify who the "Other" performer is in this section'
            : 'Additional notes about this activity'}
        </small>
      </div>

      <div className="form-actions">
        <button
          type="submit"
          className="btn btn-primary"
          disabled={isLoading}
        >
          {isLoading ? 'Saving...' : initialData ? 'Update Activity' : 'Add Activity'}
        </button>
        {initialData && (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              setFormData({
                date: new Date().toISOString().split('T')[0],
                performer: '',
                system: '',
                instrument: '',
                problem: '',
                action: '',
                comments: '',
              })
            }}
          >
            Clear
          </button>
        )}
      </div>
    </form>
  )
}
