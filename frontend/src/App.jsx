import { Route, Routes } from 'react-router-dom'
import AppLayout from './components/AppLayout'
import ProtectedRoute, { HomeRedirect, PublicOnly, RoleGate } from './components/ProtectedRoute'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import DashboardPage from './pages/DashboardPage'
import TicketListPage from './pages/TicketListPage'
import CreateTicketPage from './pages/CreateTicketPage'
import TicketDetailsPage from './pages/TicketDetailsPage'
import AdminEmployeesPage from './pages/AdminEmployeesPage'
import AdminTechniciansPage from './pages/AdminTechniciansPage'
import AdminCategoriesPage from './pages/AdminCategoriesPage'
import ForbiddenPage from './pages/ForbiddenPage'
import NotFoundPage from './pages/NotFoundPage'

export default function App() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <PublicOnly>
            <LoginPage />
          </PublicOnly>
        }
      />
      <Route
        path="/register"
        element={
          <PublicOnly>
            <RegisterPage />
          </PublicOnly>
        }
      />
      <Route path="/" element={<HomeRedirect />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route
            path="/employee/dashboard"
            element={
              <RoleGate roles={['EMPLOYEE']}>
                <DashboardPage />
              </RoleGate>
            }
          />
          <Route
            path="/employee/tickets"
            element={
              <RoleGate roles={['EMPLOYEE']}>
                <TicketListPage />
              </RoleGate>
            }
          />
          <Route
            path="/employee/tickets/new"
            element={
              <RoleGate roles={['EMPLOYEE']}>
                <CreateTicketPage />
              </RoleGate>
            }
          />

          <Route
            path="/technician/dashboard"
            element={
              <RoleGate roles={['TECHNICIAN']}>
                <DashboardPage />
              </RoleGate>
            }
          />
          <Route
            path="/technician/tickets"
            element={
              <RoleGate roles={['TECHNICIAN']}>
                <TicketListPage />
              </RoleGate>
            }
          />

          <Route
            path="/admin/dashboard"
            element={
              <RoleGate roles={['ADMIN']}>
                <DashboardPage />
              </RoleGate>
            }
          />
          <Route
            path="/admin/tickets"
            element={
              <RoleGate roles={['ADMIN']}>
                <TicketListPage />
              </RoleGate>
            }
          />
          <Route
            path="/admin/employees"
            element={
              <RoleGate roles={['ADMIN']}>
                <AdminEmployeesPage />
              </RoleGate>
            }
          />
          <Route
            path="/admin/technicians"
            element={
              <RoleGate roles={['ADMIN']}>
                <AdminTechniciansPage />
              </RoleGate>
            }
          />
          <Route
            path="/admin/categories"
            element={
              <RoleGate roles={['ADMIN']}>
                <AdminCategoriesPage />
              </RoleGate>
            }
          />

          <Route path="/tickets/:id" element={<TicketDetailsPage />} />
          <Route path="/forbidden" element={<ForbiddenPage />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
