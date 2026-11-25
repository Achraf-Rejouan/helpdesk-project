import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

// Allow the E2E suite to use the same local admin credentials as the backend.
// Values are only read locally and never printed.
function loadBackendEnv() {
  const envPath = path.resolve(currentDir, '../../backend/.env')
  if (!fs.existsSync(envPath)) return
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const index = trimmed.indexOf('=')
    if (index < 1) continue
    const key = trimmed.slice(0, index).trim()
    let value = trimmed.slice(index + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (process.env[key] === undefined) process.env[key] = value
  }
}

loadBackendEnv()

export const API_URL = process.env.VITE_API_URL || 'http://localhost:8080/api'
export const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@helpdesk.com'
export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin12345'

export async function apiRequest(request, method, apiPath, { token, data } = {}) {
  const headers = {}
  if (token) headers.Authorization = `Bearer ${token}`
  const response = await request.fetch(`${API_URL}${apiPath}`, {
    method,
    headers,
    data,
  })
  const text = await response.text()
  let body = null
  if (text) {
    try {
      body = JSON.parse(text)
    } catch {
      body = text
    }
  }
  return { status: response.status(), body }
}

export function assertStatus(result, expected, label) {
  if (result.status !== expected) {
    throw new Error(
      `${label}: expected HTTP ${expected}, got ${result.status} (${JSON.stringify(result.body)})`,
    )
  }
}

export async function loginApi(request, email, password) {
  const result = await apiRequest(request, 'POST', '/auth/login', {
    data: { email, password },
  })
  assertStatus(result, 200, `login ${email}`)
  return result.body
}

export async function getMe(request, token) {
  const result = await apiRequest(request, 'GET', '/auth/me', { token })
  assertStatus(result, 200, 'get current user')
  return result.body
}

export async function registerEmployee(request, payload) {
  const result = await apiRequest(request, 'POST', '/auth/register', { data: payload })
  assertStatus(result, 201, `register ${payload.email}`)
  return result.body
}

export async function createTechnician(request, adminToken, payload) {
  const result = await apiRequest(request, 'POST', '/technicians', {
    token: adminToken,
    data: payload,
  })
  assertStatus(result, 201, `create technician ${payload.email}`)
  return result.body
}

export async function createTicket(request, token, payload) {
  const result = await apiRequest(request, 'POST', '/tickets', { token, data: payload })
  assertStatus(result, 201, `create ticket ${payload.title}`)
  return result.body
}

export async function listCategories(request, token) {
  const result = await apiRequest(request, 'GET', '/categories', { token })
  assertStatus(result, 200, 'list categories')
  return result.body
}

export async function setSession(page, token, user) {
  await page.addInitScript(
    ({ sessionToken, sessionUser }) => {
      localStorage.setItem('helpdesk_token', sessionToken)
      localStorage.setItem('helpdesk_user', JSON.stringify(sessionUser))
    },
    { sessionToken: token, sessionUser: user },
  )
}

export async function loginViaUI(page, email, password) {
  await page.goto('/login')
  await page.getByTestId('login-email').fill(email)
  await page.getByTestId('login-password').fill(password)
  await page.getByTestId('login-submit').click()
  await page.waitForURL(/\/(employee|technician|admin)\/dashboard/)
}

export async function logoutViaUI(page) {
  await page.getByTestId('logout-button').click()
  await page.waitForURL(/\/login/)
}

export async function waitForTicketResponse(page, action, urlPart = '/tickets') {
  const responsePromise = page.waitForResponse(
    (response) =>
      response.url().includes(`/api${urlPart}`) &&
      response.request().method() === 'GET' &&
      response.status() === 200,
  )
  await action()
  await responsePromise
}

export async function ticketTitles(page) {
  return page.getByTestId('ticket-title').allTextContents()
}

export function uniqueSuffix() {
  return `${Date.now()}-${Math.floor(Math.random() * 100000)}`
}
