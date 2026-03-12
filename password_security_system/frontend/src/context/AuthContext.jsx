import { createContext, useContext, useState, useCallback } from 'react'
import { api } from '../services/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [loggedIn, setLoggedIn] = useState(null) // null=unknown, true, false

  const checkSession = useCallback(async () => {
    try {
      await api.getScore()
      setLoggedIn(true)
    } catch (e) {
      // 401 → oturum yok; diğer hatalar (network vb.) → yine oturum yok
      setLoggedIn(false)
    }
  }, [])

  const login = useCallback(async (username, password, totp) => {
    await api.login(username, password, totp || undefined)
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

export const useAuth = () => useContext(AuthContext)
