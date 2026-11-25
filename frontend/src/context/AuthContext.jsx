import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { authApi } from '../api/endpoints'
import { authStorage } from '../api/client'
import { ROLE_HOME } from '../utils'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => authStorage.getToken())
  const [user, setUser] = useState(() => authStorage.getUser())
  const [loading, setLoading] = useState(() => Boolean(authStorage.getToken()))

  // Restore the session from the token on a full page reload.
  useEffect(() => {
    let active = true
    async function restore() {
      if (!authStorage.getToken()) {
        setLoading(false)
        return
      }
      try {
        const { data } = await authApi.me()
        if (!active) return
        authStorage.setUser(data)
        setUser(data)
        setToken(authStorage.getToken())
      } catch {
        if (!active) return
        authStorage.clear()
        setUser(null)
        setToken(null)
      } finally {
        if (active) setLoading(false)
      }
    }
    restore()
    return () => {
      active = false
    }
  }, [])

  // The axios interceptor dispatches this event on any 401.
  useEffect(() => {
    const onUnauthorized = () => {
      authStorage.clear()
      setToken(null)
      setUser(null)
    }
    window.addEventListener('helpdesk:unauthorized', onUnauthorized)
    return () => window.removeEventListener('helpdesk:unauthorized', onUnauthorized)
  }, [])

  async function login(email, password) {
    const { data } = await authApi.login({ email, password })
    authStorage.setSession(data.token, data.user)
    setToken(data.token)
    // The login payload is intentionally small; /auth/me adds the profile ids.
    const me = await authApi.me()
    authStorage.setUser(me.data)
    setUser(me.data)
    return me.data
  }

  async function register(payload) {
    await authApi.register(payload)
    return login(payload.email, payload.password)
  }

  function logout() {
    authStorage.clear()
    setToken(null)
    setUser(null)
  }

  async function refreshUser() {
    const { data } = await authApi.me()
    authStorage.setUser(data)
    setUser(data)
    return data
  }

  const value = useMemo(
    () => ({
      token,
      user,
      loading,
      isAuthenticated: Boolean(token && user),
      home: user ? ROLE_HOME[user.role] : '/login',
      login,
      register,
      logout,
      refreshUser,
    }),
    [token, user, loading],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}
