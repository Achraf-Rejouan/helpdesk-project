import axios from 'axios'

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api'

const TOKEN_KEY = 'helpdesk_token'
const USER_KEY = 'helpdesk_user'

export const authStorage = {
  getToken: () => localStorage.getItem(TOKEN_KEY),
  getUser: () => {
    try {
      const raw = localStorage.getItem(USER_KEY)
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  },
  setSession: (token, user) => {
    localStorage.setItem(TOKEN_KEY, token)
    localStorage.setItem(USER_KEY, JSON.stringify(user))
  },
  setUser: (user) => localStorage.setItem(USER_KEY, JSON.stringify(user)),
  clear: () => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
  },
}

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = authStorage.getToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

function isAuthRequest(url = '') {
  return url.includes('/auth/login') || url.includes('/auth/register')
}

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status
    if (status === 401 && !isAuthRequest(error.config?.url)) {
      authStorage.clear()
      window.dispatchEvent(new Event('helpdesk:unauthorized'))
      // A hard redirect guarantees every screen is cleared immediately.
      if (window.location.pathname !== '/login') {
        window.location.assign('/login')
      }
    }
    return Promise.reject(error)
  },
)

export function errorMessage(error) {
  return (
    error?.response?.data?.message ||
    error?.message ||
    'Something went wrong. Please try again.'
  )
}

export function fieldErrors(error) {
  return error?.response?.data?.fieldErrors || {}
}

export default api
