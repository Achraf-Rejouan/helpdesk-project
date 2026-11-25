import { test, expect } from '@playwright/test'
import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  apiRequest,
  assertStatus,
  createTechnician,
  createTicket,
  getMe,
  listCategories,
  loginApi,
  loginViaUI,
  logoutViaUI,
  registerEmployee,
  setSession,
  ticketTitles,
  uniqueSuffix,
  waitForTicketResponse,
} from './helpers'

test.describe.configure({ mode: 'serial' })

const state = {
  stamp: uniqueSuffix(),
  password: 'Password123',
  tickets: [],
  categories: [],
  uiRegisterEmail: '',
  uiRegisterName: '',
  createdTechnicianEmail: '',
  createdTechnicianName: '',
}

test.beforeAll(async ({ request }) => {
  const { stamp, password } = state

  const adminLogin = await loginApi(request, ADMIN_EMAIL, ADMIN_PASSWORD)
  state.admin = { token: adminLogin.token, user: await getMe(request, adminLogin.token) }

  state.categories = await listCategories(request, state.admin.token)
  if (state.categories.length < 2) {
    throw new Error('E2E setup requires at least two seeded categories')
  }

  const tech1 = await createTechnician(request, state.admin.token, {
    fullName: `Tech One ${stamp}`,
    email: `tech.one.${stamp}@example.com`,
    password,
    specialization: 'Network Support',
    availability: true,
  })
  const tech2 = await createTechnician(request, state.admin.token, {
    fullName: `Tech Two ${stamp}`,
    email: `tech.two.${stamp}@example.com`,
    password,
    specialization: 'Hardware Support',
    availability: true,
  })
  const tech3 = await createTechnician(request, state.admin.token, {
    fullName: `Tech Three ${stamp}`,
    email: `tech.three.${stamp}@example.com`,
    password,
    specialization: 'Printer Support',
    availability: false,
  })

  async function makeEmployee(label, email) {
    const registered = await registerEmployee(request, {
      fullName: `Employee ${label} ${stamp}`,
      email,
      password,
      department: 'IT',
      phone: '+216 20 000 000',
    })
    const login = await loginApi(request, email, password)
    const user = await getMe(request, login.token)
    return { token: login.token, user, employeeId: registered.employee.id, email }
  }

  state.empA = await makeEmployee('A', `employee.a.${stamp}@example.com`)
  state.empB = await makeEmployee('B', `employee.b.${stamp}@example.com`)
  state.empC = await makeEmployee('C', `employee.c.${stamp}@example.com`)

  state.tech1 = {
    ...tech1,
    token: (await loginApi(request, tech1.user.email, password)).token,
  }
  state.tech1.user = await getMe(request, state.tech1.token)
  state.tech2 = tech2
  state.tech3 = tech3

  for (let index = 1; index <= 12; index += 1) {
    const priority = index <= 3 ? 'HIGH' : index <= 7 ? 'MEDIUM' : 'LOW'
    const title = `Alpha ${String(index).padStart(2, '0')} ${stamp}${index === 5 ? ' SearchProbe' : ''}`
    const ticket = await createTicket(request, state.empA.token, {
      title,
      description: `Description for pagination and filter test ticket ${index} ${stamp}.`,
      priority,
      category: { id: state.categories[(index - 1) % 2].id },
    })
    state.tickets.push(ticket)
  }

  const statuses = [
    [0, 'IN_PROGRESS'],
    [1, 'WAITING_FOR_RESPONSE'],
    [2, 'RESOLVED'],
  ]
  for (const [index, status] of statuses) {
    const result = await apiRequest(
      request,
      'PATCH',
      `/tickets/${state.tickets[index].id}/status`,
      { token: state.admin.token, data: { status } },
    )
    assertStatus(result, 200, `set status ${status}`)
  }

  for (const index of [0, 1]) {
    const result = await apiRequest(
      request,
      'PATCH',
      `/tickets/${state.tickets[index].id}/assign/${tech1.id}`,
      { token: state.admin.token },
    )
    assertStatus(result, 200, 'assign setup ticket to technician one')
  }

  state.empBTicket = await createTicket(request, state.empB.token, {
    title: `Bravo private ${stamp}`,
    description: `Employee B private ticket used for access control checks ${stamp}.`,
    priority: 'LOW',
    category: { id: state.categories[0].id },
  })

  state.uiRegisterName = `UI Register ${stamp}`
  state.uiRegisterEmail = `ui.register.${stamp}@example.com`
  state.createdTechnicianName = `UI Technician ${stamp}`
  state.createdTechnicianEmail = `ui.technician.${stamp}@example.com`
})

test('public registration validates fields, rejects duplicates, and logs in', async ({ page }) => {
  await page.goto('/register')
  await page.getByTestId('register-submit').click()

  await expect(page.getByText('Full name must be between 3 and 100 characters.')).toBeVisible()
  await expect(page.getByText('Enter a valid email address.')).toBeVisible()
  await expect(page.getByText('Password must be between 8 and 72 characters.')).toBeVisible()
  await expect(page.getByText('Department must be between 2 and 100 characters.')).toBeVisible()

  await page.getByTestId('register-fullname').fill(state.uiRegisterName)
  await page.getByTestId('register-email').fill(state.uiRegisterEmail)
  await page.getByTestId('register-password').fill(state.password)
  await page.getByTestId('register-department').fill('Finance')
  await page.getByTestId('register-phone').fill('+216 22 333 444')
  await page.getByTestId('register-submit').click()

  await expect(page).toHaveURL(/\/employee\/dashboard/)
  await expect(page.getByTestId('current-user')).toContainText(state.uiRegisterName)
  await expect(page.getByTestId('count-total')).toHaveText('0')

  await logoutViaUI(page)

  await page.goto('/register')
  await page.getByTestId('register-fullname').fill(`${state.uiRegisterName} Duplicate`)
  await page.getByTestId('register-email').fill(state.uiRegisterEmail.toUpperCase())
  await page.getByTestId('register-password').fill(state.password)
  await page.getByTestId('register-department').fill('Finance')
  await page.getByTestId('register-submit').click()

  await expect(page.getByText('Email is already registered')).toBeVisible()
  await expect(page).toHaveURL(/\/register/)
})

test('login rejects a wrong password, accepts valid credentials, restores the session, and logs out', async ({ page }) => {
  await page.goto('/login')
  await page.getByTestId('login-email').fill(state.uiRegisterEmail)
  await page.getByTestId('login-password').fill('DefinitelyWrong123')
  await page.getByTestId('login-submit').click()
  await expect(page.getByTestId('error-banner')).toContainText('Invalid email or password')

  await page.getByTestId('login-password').fill(state.password)
  await page.getByTestId('login-submit').click()
  await expect(page).toHaveURL(/\/employee\/dashboard/)
  await expect(page.getByTestId('current-user')).toContainText(state.uiRegisterName)

  await page.reload()
  await expect(page).toHaveURL(/\/employee\/dashboard/)
  await expect(page.getByTestId('current-user')).toContainText(state.uiRegisterName)
  await expect(page.getByTestId('count-total')).toBeVisible()

  await logoutViaUI(page)
  await page.goto('/employee/dashboard')
  await expect(page).toHaveURL(/\/login/)
})

test('missing or invalid tokens redirect protected pages to login', async ({ browser }) => {
  const anonymousContext = await browser.newContext()
  const anonymousPage = await anonymousContext.newPage()
  await anonymousPage.goto('/employee/dashboard')
  await expect(anonymousPage).toHaveURL(/\/login/)
  await anonymousContext.close()

  const invalidContext = await browser.newContext()
  const invalidPage = await invalidContext.newPage()
  await invalidPage.addInitScript(() => {
    localStorage.setItem('helpdesk_token', 'not.a.valid.jwt')
    localStorage.setItem(
      'helpdesk_user',
      JSON.stringify({ id: 'fake', fullName: 'Fake User', role: 'EMPLOYEE' }),
    )
  })
  await invalidPage.goto('/employee/dashboard')
  await expect(invalidPage).toHaveURL(/\/login/)
  await invalidContext.close()
})

test('login redirects by role and role guards block other areas', async ({ page }) => {
  await loginViaUI(page, ADMIN_EMAIL, ADMIN_PASSWORD)
  await expect(page).toHaveURL(/\/admin\/dashboard/)
  await page.goto('/employee/dashboard')
  await expect(page.getByTestId('forbidden-page')).toBeVisible()
  await logoutViaUI(page)

  await loginViaUI(page, state.tech1.user.email, state.password)
  await expect(page).toHaveURL(/\/technician\/dashboard/)
  await page.goto('/admin/dashboard')
  await expect(page.getByTestId('forbidden-page')).toBeVisible()
  await logoutViaUI(page)

  await loginViaUI(page, state.empA.email, state.password)
  await expect(page).toHaveURL(/\/employee\/dashboard/)
  await page.goto('/admin/technicians')
  await expect(page.getByTestId('forbidden-page')).toBeVisible()
})

test('employee dashboard shows role-scoped ticket counts', async ({ page }) => {
  await loginViaUI(page, state.empA.email, state.password)
  await expect(page.getByTestId('count-total')).toHaveText('12')
  await expect(page.getByTestId('count-status-OPEN')).toHaveText('9')
  await expect(page.getByTestId('count-status-IN_PROGRESS')).toHaveText('1')
  await expect(page.getByTestId('count-status-WAITING_FOR_RESPONSE')).toHaveText('1')
  await expect(page.getByTestId('count-status-RESOLVED')).toHaveText('1')
  await expect(page.getByTestId('count-status-CLOSED')).toHaveText('0')
  await expect(page.getByTestId('count-priority-HIGH')).toHaveText('3')
  await expect(page.getByTestId('count-priority-MEDIUM')).toHaveText('4')
  await expect(page.getByTestId('count-priority-LOW')).toHaveText('5')
  await expect(page.getByTestId('ticket-table')).not.toContainText(state.empBTicket.title)
})

test('employee ticket list is scoped and supports pagination, sorting, search, and filters', async ({ page }) => {
  await loginViaUI(page, state.empA.email, state.password)
  await page.goto('/employee/tickets')
  await expect(page.getByTestId('ticket-row')).toHaveCount(10)
  await expect(page.getByTestId('pagination')).toContainText('Page 1 of 2')
  await expect(page.getByTestId('pagination')).toContainText('12 results')
  await expect(page.getByTestId('ticket-table')).not.toContainText(state.empBTicket.title)
  await expect(page.getByTestId('filter-technician')).toHaveCount(0)
  await expect(page.getByTestId('filter-employee')).toHaveCount(0)

  await waitForTicketResponse(page, () => page.getByTestId('page-size').selectOption('5'))
  await expect(page.getByTestId('pagination')).toContainText('Page 1 of 3')
  await expect(page.getByTestId('ticket-row')).toHaveCount(5)

  await waitForTicketResponse(page, () => page.getByTestId('page-next').click())
  await expect(page.getByTestId('pagination')).toContainText('Page 2 of 3')

  await waitForTicketResponse(page, () => page.getByTestId('page-size').selectOption('20'))
  await expect(page.getByTestId('pagination')).toContainText('Page 1 of 1')

  await waitForTicketResponse(page, () => page.getByTestId('sort-select').selectOption('title,asc'))
  await expect
    .poll(async () => {
      const titles = await ticketTitles(page)
      return JSON.stringify(titles) === JSON.stringify([...titles].sort())
    })
    .toBe(true)

  await page.getByTestId('search-input').fill('SearchProbe')
  await waitForTicketResponse(page, () => page.getByTestId('search-submit').click(), '/tickets/search')
  await expect(page.getByTestId('ticket-row')).toHaveCount(1)
  await expect(page.getByTestId('ticket-title')).toContainText('SearchProbe')

  await waitForTicketResponse(page, () => page.getByTestId('clear-filters').click())
  await expect(page.getByTestId('ticket-row')).toHaveCount(12)

  await waitForTicketResponse(
    page,
    () => page.getByTestId('filter-status').selectOption('IN_PROGRESS'),
    '/tickets/status/IN_PROGRESS',
  )
  await expect(page.getByTestId('ticket-row')).toHaveCount(1)
  await expect(page.getByTestId('ticket-row')).toContainText('In progress')

  await waitForTicketResponse(
    page,
    () => page.getByTestId('filter-priority').selectOption('HIGH'),
    '/tickets/priority/HIGH',
  )
  await expect(page.getByTestId('ticket-row')).toHaveCount(3)

  await waitForTicketResponse(
    page,
    () => page.getByTestId('filter-category').selectOption(state.categories[0].id),
    `/tickets/category/${state.categories[0].id}`,
  )
  await expect(page.getByTestId('ticket-row')).toHaveCount(6)
})

test('employee creates and edits a ticket, manages own comments, and cannot open another employee ticket', async ({ page }) => {
  await loginViaUI(page, state.empA.email, state.password)
  await page.goto('/employee/tickets/new')
  await page.getByTestId('ticket-title-input').fill(`UI created ticket ${state.stamp}`)
  await page
    .getByTestId('ticket-description-input')
    .fill(`A detailed description created from the browser ${state.stamp}.`)
  await page.getByTestId('ticket-priority-input').selectOption('CRITICAL')
  await page.getByTestId('ticket-category-input').selectOption(state.categories[0].id)
  await page.getByTestId('create-ticket-submit').click()

  await expect(page).toHaveURL(/\/tickets\/[0-9a-f-]+$/)
  const ticketUrl = page.url()
  await expect(page.getByTestId('ticket-title')).toHaveText(`UI created ticket ${state.stamp}`)
  await expect(page.getByTestId('ticket-status')).toHaveText('Open')
  await expect(page.getByTestId('ticket-priority')).toHaveText('Critical')
  await expect(page.getByTestId('ticket-technician')).toHaveText('Unassigned')
  await expect(page.getByTestId('ticket-employee')).toHaveText(state.empA.user.fullName)
  await expect(page.getByTestId('status-select')).toHaveCount(0)
  await expect(page.getByTestId('admin-controls')).toHaveCount(0)
  await expect(page.getByTestId('technician-controls')).toHaveCount(0)

  await page.getByTestId('edit-ticket-button').click()
  await page.getByTestId('edit-ticket-title').fill(`UI edited ticket ${state.stamp}`)
  await page.getByTestId('edit-ticket-priority').selectOption('HIGH')
  const ticketId = ticketUrl.split('/').pop()
  const saveResponse = page.waitForResponse(
    (response) =>
      response.url().includes(`/api/tickets/${ticketId}`) &&
      response.request().method() === 'PUT' &&
      response.status() === 200,
  )
  await page.getByTestId('save-ticket-button').click()
  await saveResponse
  await expect(page.getByTestId('ticket-title')).toHaveText(`UI edited ticket ${state.stamp}`)
  await expect(page.getByTestId('ticket-priority')).toHaveText('High')

  await page.getByTestId('add-comment-input').fill(`First employee comment ${state.stamp}`)
  await page.getByTestId('add-comment-submit').click()
  const commentItem = page.getByTestId('comment-item').filter({ hasText: `First employee comment ${state.stamp}` })
  await expect(commentItem).toBeVisible()

  await commentItem.getByTestId('edit-comment-button').click()
  const editingItem = page.getByTestId('comment-item').filter({
    has: page.getByTestId('comment-edit-input'),
  })
  await editingItem.getByTestId('comment-edit-input').fill(`Edited employee comment ${state.stamp}`)
  await editingItem.getByTestId('save-comment-button').click()
  const editedComment = page.getByTestId('comment-item').filter({ hasText: `Edited employee comment ${state.stamp}` })
  await expect(editedComment).toBeVisible()

  await editedComment.getByTestId('delete-comment-button').click()
  await page.getByTestId('confirm-action').click()
  await expect(page.getByTestId('comment-item').filter({ hasText: `Edited employee comment ${state.stamp}` })).toHaveCount(0)

  await page.goto(`/tickets/${state.empBTicket.id}`)
  await expect(page.getByTestId('ticket-not-found')).toBeVisible()
  await expect(page.getByText('This ticket does not exist, or your account cannot view it.')).toBeVisible()
})

test('technician sees only assigned tickets, updates status, comments, and cannot assign', async ({ page }) => {
  await loginViaUI(page, state.tech1.user.email, state.password)
  await expect(page.getByTestId('count-total')).toHaveText('2')

  await page.goto('/technician/tickets')
  await expect(page.getByTestId('ticket-row')).toHaveCount(2)
  await expect(page.getByTestId('ticket-table')).not.toContainText(state.empBTicket.title)
  await expect(page.getByTestId('filter-technician')).toHaveCount(0)

  await page.goto(`/tickets/${state.tickets[0].id}`)
  await expect(page.getByTestId('ticket-technician')).toHaveText(state.tech1.user.fullName)
  await expect(page.getByTestId('technician-controls')).toBeVisible()
  await expect(page.getByTestId('admin-controls')).toHaveCount(0)
  await expect(page.getByTestId('assign-select')).toHaveCount(0)

  await page.getByTestId('status-select').selectOption('RESOLVED')
  await page.getByTestId('update-status-button').click()
  await expect(page.getByTestId('ticket-status')).toHaveText('Resolved')

  await page.getByTestId('add-comment-input').fill(`Technician comment ${state.stamp}`)
  await page.getByTestId('add-comment-submit').click()
  await expect(
    page.getByTestId('comment-item').filter({ hasText: `Technician comment ${state.stamp}` }),
  ).toBeVisible()

  await page.goto(`/tickets/${state.empBTicket.id}`)
  await expect(page.getByTestId('ticket-not-found')).toBeVisible()

  await page.goto('/admin/dashboard')
  await expect(page.getByTestId('forbidden-page')).toBeVisible()
})

test('admin dashboard counts match the real role-scoped data', async ({ page, request }) => {
  await loginViaUI(page, ADMIN_EMAIL, ADMIN_PASSWORD)
  await expect(page).toHaveURL(/\/admin\/dashboard/)

  const statuses = ['OPEN', 'IN_PROGRESS', 'WAITING_FOR_RESPONSE', 'RESOLVED', 'CLOSED']
  const priorities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']
  const total = (await apiRequest(request, 'GET', '/tickets?page=0&size=1', { token: state.admin.token })).body
    .totalElements

  await expect(page.getByTestId('count-total')).toHaveText(String(total))
  for (const status of statuses) {
    const body = (
      await apiRequest(request, 'GET', `/tickets/status/${status}?page=0&size=1`, {
        token: state.admin.token,
      })
    ).body
    await expect(page.getByTestId(`count-status-${status}`)).toHaveText(String(body.totalElements))
  }
  for (const priority of priorities) {
    const body = (
      await apiRequest(request, 'GET', `/tickets/priority/${priority}?page=0&size=1`, {
        token: state.admin.token,
      })
    ).body
    await expect(page.getByTestId(`count-priority-${priority}`)).toHaveText(String(body.totalElements))
  }
})

test('admin sees all tickets, filters by employee/technician, assigns, unassigns, updates status, and cannot comment', async ({ page, request }) => {
  await loginViaUI(page, ADMIN_EMAIL, ADMIN_PASSWORD)
  await page.goto('/admin/tickets')
  await expect(page.getByTestId('ticket-table')).toContainText(state.empBTicket.title)

  const employeeTotal = (
    await apiRequest(request, 'GET', `/tickets/employee/${state.empA.employeeId}?page=0&size=1`, {
      token: state.admin.token,
    })
  ).body.totalElements
  await waitForTicketResponse(
    page,
    () => page.getByTestId('filter-employee').selectOption(state.empA.employeeId),
    `/tickets/employee/${state.empA.employeeId}`,
  )
  await expect(page.getByTestId('pagination')).toContainText(`${employeeTotal} results`)
  await expect(page.getByTestId('ticket-row').first()).toContainText(state.empA.user.fullName)

  await waitForTicketResponse(
    page,
    () => page.getByTestId('filter-technician').selectOption(state.tech1.id),
    `/tickets/technician/${state.tech1.id}`,
  )
  await expect(page.getByTestId('ticket-row')).toHaveCount(2)

  await waitForTicketResponse(page, () => page.getByTestId('clear-filters').click())

  const targetTicket = state.tickets[11]
  await page.goto(`/tickets/${targetTicket.id}`)
  await expect(page.getByTestId('admin-controls')).toBeVisible()
  await expect(page.getByTestId('add-comment-input')).toHaveCount(0)
  await expect(page.getByTestId('comment-unavailable')).toContainText('Administrators can read comments')

  const options = await page.getByTestId('assign-select').locator('option').allTextContents()
  expect(options.some((option) => option.includes(state.tech3.user.fullName))).toBe(false)

  await page.getByTestId('assign-select').selectOption(state.tech2.id)
  await page.getByTestId('assign-button').click()
  await expect(page.getByTestId('ticket-technician')).toHaveText(state.tech2.user.fullName)

  await page.getByTestId('unassign-button').click()
  await expect(page.getByTestId('ticket-technician')).toHaveText('Unassigned')

  await page.getByTestId('status-select').selectOption('CLOSED')
  await page.getByTestId('update-status-button').click()
  await expect(page.getByTestId('ticket-status')).toHaveText('Closed')
})

test('admin deletes a ticket with a confirmation dialog', async ({ page, request }) => {
  const ticket = await createTicket(request, state.empA.token, {
    title: `DeleteProbe ${state.stamp}`,
    description: `Ticket created only to verify admin deletion ${state.stamp}.`,
    priority: 'LOW',
    category: { id: state.categories[0].id },
  })

  await loginViaUI(page, ADMIN_EMAIL, ADMIN_PASSWORD)
  await page.goto(`/tickets/${ticket.id}`)
  await page.getByTestId('delete-ticket-button').click()
  await expect(page.getByText('Delete ticket?')).toBeVisible()
  await page.getByTestId('confirm-action').click()
  await expect(page).toHaveURL(/\/admin\/tickets/)

  const result = await apiRequest(request, 'GET', `/tickets/${ticket.id}`, {
    token: state.admin.token,
  })
  expect(result.status).toBe(404)
})

test('admin manages categories, including duplicate and in-use conflicts', async ({ page }) => {
  await loginViaUI(page, ADMIN_EMAIL, ADMIN_PASSWORD)
  await page.goto('/admin/categories')

  const categoryName = `E2E Category ${state.stamp}`
  await page.getByTestId('create-category-button').click()
  await page.getByTestId('category-name-input').fill(categoryName)
  await page.getByTestId('category-description-input').fill('Created by the E2E suite')
  await page.getByTestId('save-category-button').click()
  const categoryRow = page.getByTestId('category-row').filter({ hasText: categoryName })
  await expect(categoryRow).toBeVisible()

  await page.getByTestId('create-category-button').click()
  await page.getByTestId('category-name-input').fill(categoryName)
  await page.getByTestId('save-category-button').click()
  await expect(page.locator('.modal').getByTestId('error-banner')).toContainText('Category name already exists')
  await page.locator('.modal').getByRole('button', { name: 'Cancel' }).click()

  await categoryRow.getByRole('button', { name: 'Edit' }).click()
  await page.getByTestId('category-description-input').fill('Updated by the E2E suite')
  await page.getByTestId('save-category-button').click()
  await expect(categoryRow).toContainText('Updated by the E2E suite')

  await categoryRow.getByTestId('delete-category').click()
  await page.getByTestId('confirm-action').click()
  await expect(page.getByTestId('category-row').filter({ hasText: categoryName })).toHaveCount(0)

  const usedCategoryRow = page.getByTestId('category-row').filter({ hasText: state.categories[0].name })
  await usedCategoryRow.getByTestId('delete-category').click()
  await page.getByTestId('confirm-action').click()
  await expect(page.getByTestId('error-banner')).toContainText('Cannot delete category')
  await expect(usedCategoryRow).toBeVisible()
})

test('admin manages employees: edit, disable/enable, and delete blocked by tickets', async ({ page }) => {
  await loginViaUI(page, ADMIN_EMAIL, ADMIN_PASSWORD)
  await page.goto('/admin/employees')

  const employeeBRow = page.getByTestId('employee-row').filter({ hasText: state.empB.email })
  await employeeBRow.getByRole('button', { name: 'Edit' }).click()
  await page.getByTestId('employee-name-input').fill(`Employee B Updated ${state.stamp}`)
  await page.getByTestId('save-employee-button').click()
  await expect(page.getByTestId('employee-row').filter({ hasText: `Employee B Updated ${state.stamp}` })).toBeVisible()

  const employeeCRow = page.getByTestId('employee-row').filter({ hasText: state.empC.email })
  await employeeCRow.getByTestId('toggle-employee').click()
  await page.getByTestId('confirm-action').click()
  await expect(employeeCRow).toContainText('Disabled')
  await employeeCRow.getByTestId('toggle-employee').click()
  await page.getByTestId('confirm-action').click()
  await expect(employeeCRow).toContainText('Enabled')

  await page.getByTestId('employee-row').filter({ hasText: state.empB.email }).getByTestId('delete-employee').click()
  await page.getByTestId('confirm-action').click()
  await expect(page.getByTestId('error-banner')).toContainText('Cannot delete employee')
  await expect(page.getByTestId('employee-row').filter({ hasText: state.empB.email })).toBeVisible()
})

test('admin manages technicians: create, edit, availability, disable/enable, search, and delete rules', async ({ page }) => {
  await loginViaUI(page, ADMIN_EMAIL, ADMIN_PASSWORD)
  await page.goto('/admin/technicians')

  await page.getByTestId('create-technician-button').click()
  await page.getByTestId('technician-name-input').fill(state.createdTechnicianName)
  await page.getByTestId('technician-email-input').fill(state.createdTechnicianEmail)
  await page.getByTestId('technician-password-input').fill(state.password)
  await page.getByTestId('technician-specialization-input').fill(`Specialty ${state.stamp}`)
  await page.getByTestId('save-technician-button').click()

  const techRow = page.getByTestId('technician-row').filter({ hasText: state.createdTechnicianEmail })
  await expect(techRow).toBeVisible()

  await techRow.getByRole('button', { name: 'Edit' }).click()
  await page.getByTestId('technician-specialization-input').fill(`Updated Specialty ${state.stamp}`)
  await page.getByTestId('save-technician-button').click()
  await expect(techRow).toContainText(`Updated Specialty ${state.stamp}`)

  await techRow.getByTestId('toggle-availability').click()
  await expect(techRow.getByText('Unavailable', { exact: true })).toBeVisible()
  await techRow.getByTestId('toggle-availability').click()
  await expect(techRow.getByText('Available', { exact: true })).toBeVisible()

  await techRow.getByTestId('toggle-technician').click()
  await page.getByTestId('confirm-action').click()
  await expect(techRow).toContainText('Disabled')
  await techRow.getByTestId('toggle-technician').click()
  await page.getByTestId('confirm-action').click()
  await expect(techRow).toContainText('Enabled')

  await page.getByTestId('specialization-search').fill(`Updated Specialty ${state.stamp}`)
  await page.getByRole('button', { name: 'Search' }).click()
  await expect(page.getByTestId('technician-row').filter({ hasText: state.createdTechnicianEmail })).toBeVisible()
  await page.locator('form').getByRole('button', { name: 'Clear' }).click()

  await page.getByTestId('technician-row').filter({ hasText: state.createdTechnicianEmail }).getByTestId('delete-technician').click()
  await page.getByTestId('confirm-action').click()
  await expect(page.getByTestId('technician-row').filter({ hasText: state.createdTechnicianEmail })).toHaveCount(0)

  const tech1Row = page.getByTestId('technician-row').filter({ hasText: state.tech1.user.email })
  await tech1Row.getByTestId('delete-technician').click()
  await page.getByTestId('confirm-action').click()
  await expect(page.getByTestId('error-banner')).toContainText('Cannot delete technician')
  await expect(tech1Row).toBeVisible()
})

test('a disabled user is logged out on the next request', async ({ browser, request }) => {
  const context = await browser.newContext()
  const userPage = await context.newPage()
  await setSession(userPage, state.empC.token, state.empC.user)
  await userPage.goto('/employee/dashboard')
  await expect(userPage.getByTestId('count-total')).toBeVisible()

  const disable = await apiRequest(request, 'PUT', `/employees/${state.empC.employeeId}`, {
    token: state.admin.token,
    data: { enabled: false },
  })
  assertStatus(disable, 200, 'disable employee C')

  await userPage.reload()
  await expect(userPage).toHaveURL(/\/login/)

  const enable = await apiRequest(request, 'PUT', `/employees/${state.empC.employeeId}`, {
    token: state.admin.token,
    data: { enabled: true },
  })
  assertStatus(enable, 200, 're-enable employee C')
  await context.close()
})
