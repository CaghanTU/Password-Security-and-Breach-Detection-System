import { useState, useCallback, useRef } from 'react'
import { api } from '../services/api'
import { AuthContext } from './auth-context'

export function AuthProvider({ children }) {
  const [loggedIn, setLoggedIn] = useState(null) // null=unknown, true, false
  const aiInsightsCacheRef = useRef({ data: null, promise: null })

  const invalidateAIInsights = useCallback(() => {
    aiInsightsCacheRef.current = { data: null, promise: null }
  }, [])

  const checkSession = useCallback(async () => {
    try {
      await api.getScore()
      setLoggedIn(true)
    } catch {
      // 401 means no session; for other errors (network etc.) treat it as no session as well
      setLoggedIn(false)
    }
  }, [])

  const getAIInsightsCached = useCallback(async ({ force = false } = {}) => {
    if (force) {
      invalidateAIInsights()
    }

    if (aiInsightsCacheRef.current.data) {
      return aiInsightsCacheRef.current.data
    }

    if (aiInsightsCacheRef.current.promise) {
      return aiInsightsCacheRef.current.promise
    }

    const request = api.getAIInsights()
      .then(data => {
        aiInsightsCacheRef.current = { data, promise: null }
        return data
      })
      .catch(error => {
        aiInsightsCacheRef.current = { data: null, promise: null }
        throw error
      })

    aiInsightsCacheRef.current = { data: null, promise: request }
    return request
  }, [invalidateAIInsights])

  const login = useCallback(async (username, password, totp, recoveryCode) => {
    await api.login(username, password, totp || undefined, recoveryCode || undefined)
    invalidateAIInsights()
    setLoggedIn(true)
  }, [invalidateAIInsights])

  const logout = useCallback(async () => {
    await api.logout()
    invalidateAIInsights()
    setLoggedIn(false)
  }, [invalidateAIInsights])

  return (
    <AuthContext.Provider
      value={{
        loggedIn,
        setLoggedIn,
        checkSession,
        login,
        logout,
        getAIInsightsCached,
        invalidateAIInsights,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
