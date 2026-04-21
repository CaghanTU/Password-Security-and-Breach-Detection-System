import { useState, useCallback } from 'react'
import { api } from '../services/api'
import { AuthContext } from './auth-context'

export function AuthProvider({ children }) {
  const [loggedIn, setLoggedIn] = useState(null) // null=unknown, true, false

  const checkSession = useCallback(async () => {
    try {
      await api.getScore()
      setLoggedIn(true)
    } catch {
      // 401 means no session; for other errors (network etc.) treat it as no session as well
      setLoggedIn(false)
    }
  }, [])

  const login = useCallback(async (username, password, totp, recoveryCode) => {
    await api.login(username, password, totp || undefined, recoveryCode || undefined)
    setLoggedIn(true)
  }, [])

  const logout = useCallback(async () => {
    await api.logout()
    setLoggedIn(false)
  }, [])

  return (
    <AuthContext.Provider value={{ loggedIn, setLoggedIn, checkSession, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}
