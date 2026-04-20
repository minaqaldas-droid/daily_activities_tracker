import React, { useState } from 'react'
import { type AuthActionResult } from '../supabaseClient'

interface LoginProps {
  onLogin: (email: string, password: string) => Promise<void>
  onSignUp: (email: string, name: string, password: string) => Promise<AuthActionResult>
}

export const Login: React.FC<LoginProps> = ({ onLogin, onSignUp }) => {
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const resetForm = () => {
    setEmail('')
    setName('')
    setPassword('')
    setConfirmPassword('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage(null)

    if (!email || !password) {
      setMessage({ type: 'error', text: 'Email and password are required.' })
      return
    }

    if (!isLogin && !name.trim()) {
      setMessage({ type: 'error', text: 'Name is required for signup.' })
      return
    }

    if (!isLogin && password !== confirmPassword) {
      setMessage({ type: 'error', text: 'Passwords do not match.' })
      return
    }

    try {
      setIsLoading(true)

      if (isLogin) {
        await onLogin(email.trim(), password)
        return
      }

      const result = await onSignUp(email.trim(), name.trim(), password)

      if (result.requiresEmailConfirmation) {
        setMessage({
          type: 'success',
          text: result.message || 'Account created. Check your email to confirm your account.',
        })
        setIsLogin(true)
        setPassword('')
        setConfirmPassword('')
        return
      }

      resetForm()
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Authentication failed.',
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1>Daily Activities Tracker</h1>
        <p className="auth-subtitle">
          {isLogin ? 'Sign in with your account' : 'Create a new account'}
        </p>

        {message && <div className={message.type === 'error' ? 'error-message' : 'success-message'}>{message.text}</div>}

        <form onSubmit={handleSubmit}>
          {!isLogin && (
            <div className="form-group">
              <label htmlFor="name">Full Name *</label>
              <input
                type="text"
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your full name"
                disabled={isLoading}
              />
            </div>
          )}

          <div className="form-group">
            <label htmlFor="email">Email *</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              disabled={isLoading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password *</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={isLogin ? 'Enter your password' : 'Create a password'}
              disabled={isLoading}
            />
          </div>

          {!isLogin && (
            <div className="form-group">
              <label htmlFor="confirmPassword">Confirm Password *</label>
              <input
                type="password"
                id="confirmPassword"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm your password"
                disabled={isLoading}
              />
            </div>
          )}

          <button type="submit" className="btn btn-primary btn-full" disabled={isLoading}>
            {isLoading ? 'Loading...' : isLogin ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <div className="auth-toggle">
          <p>{isLogin ? "Don't have an account?" : 'Already have an account?'}</p>
          <button
            type="button"
            className="btn btn-text"
            onClick={() => {
              setIsLogin(!isLogin)
              setMessage(null)
              resetForm()
            }}
          >
            {isLogin ? 'Sign Up' : 'Sign In'}
          </button>
        </div>
      </div>
    </div>
  )
}
