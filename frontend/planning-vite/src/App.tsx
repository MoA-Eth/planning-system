import { Routes, Route, Navigate } from 'react-router-dom'

import Login from './pages/Login'
import Home from './pages/Home'

import ProtectedRoute from './routes/ProtectedRoute'

import SuperuserRoute from './routes/SuperuserRoute'

import StateMinisterRoute from './routes/StateMinisterRoute'

import StrategicStaffRoute from './routes/StrategicStaffRoute'

import ExecutiveRoute from './routes/ExecutiveRoute'

import MinisterRoute from './routes/MinisterRoute'

import ActivityLogRoute from './routes/ActivityLogRoute'

import DashboardLayout from './layouts/DashboardLayout'

import Sectors from './pages/Sectors'

import Departments from './pages/Departments'

import Indicators from './pages/Indicators'

import IndicatorGroups from './pages/IndicatorGroups'

import AnnualPlans from './pages/AnnualPlans'

import QuarterlyBreakdowns from './pages/QuarterlyBreakdowns'

import Performances from './pages/Performances'

import Users from './pages/Users'

import Reviews from './pages/Reviews'

import Validations from './pages/Validations'

import EntryPeriods from './pages/EntryPeriods'

import FinalApprovals from './pages/FinalApprovals'

import MinisterView from './pages/MinisterView'

import StateMinisterView from './pages/StateMinisterView'

import ActivityLogs from './pages/ActivityLogs'

import ProfilePage from './pages/Profile'

import AdvisorCommentSubmit from './pages/AdvisorCommentSubmit'

import AdvisorCommentsView from './pages/AdvisorCommentsView'

import DocumentUpload from './pages/DocumentUpload'

import DocumentsView from './pages/DocumentsView'

import DocumentUploadRoute from './routes/DocumentUploadRoute'

import OverallDashboard from './pages/OverallDashboard'

import DetailAnalysis from './pages/DetailAnalysis'

import HierarchicalSpreadsheet from './pages/HierarchicalSpreadsheet'

import SuperAdminQuarterlyManager from './pages/SuperAdminQuarterlyManager'

import { useAuth } from './context/AuthContext'



// Role-based redirect component

const RoleBasedRedirect = () => {

  const { user } = useAuth();

  const role = (user?.role || '').toUpperCase();

  

  // Wait for user data to load

  if (!user) {

    return <div className="flex items-center justify-center h-64">

      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>

    </div>;

  }

  

  if (role === 'MINISTER_VIEW') {

    return <Navigate to="/minister-view" replace />;

  }

  return <Home />;

};



function App() {

  return (

    <Routes>

      <Route path="/login" element={<Login />} />

      <Route

        path="/"

        element={

          <ProtectedRoute>

            <DashboardLayout>

              <RoleBasedRedirect />

            </DashboardLayout>

          </ProtectedRoute>

        }

      />

      <Route

        path="/sectors"

        element={

          <SuperuserRoute>

            <DashboardLayout>

              <Sectors />

            </DashboardLayout>

          </SuperuserRoute>

        }

      />

      <Route

        path="/departments"

        element={

          <SuperuserRoute>

            <DashboardLayout>

              <Departments />

            </DashboardLayout>

          </SuperuserRoute>

        }

      />

      <Route

        path="/indicators"

        element={

          <SuperuserRoute>

            <DashboardLayout>

              <Indicators />

            </DashboardLayout>

          </SuperuserRoute>

        }

      />

      <Route

        path="/indicator-groups"

        element={

          <SuperuserRoute>

            <DashboardLayout>

              <IndicatorGroups />

            </DashboardLayout>

          </SuperuserRoute>

        }

      />

      <Route

        path="/annual-plans"

        element={

          <SuperuserRoute>

            <DashboardLayout>

              <AnnualPlans />

            </DashboardLayout>

          </SuperuserRoute>

        }

      />

      <Route

        path="/activity-logs"

        element={

          <ActivityLogRoute>

            <DashboardLayout>

              <ActivityLogs />

            </DashboardLayout>

          </ActivityLogRoute>

        }

      />

      <Route

        path="/quarterly-breakdowns"

        element={

          <ProtectedRoute>

            <DashboardLayout>

              <QuarterlyBreakdowns />

            </DashboardLayout>

          </ProtectedRoute>

        }

      />

      <Route

        path="/performances"

        element={

          <ProtectedRoute>

            <DashboardLayout>

              <Performances />

            </DashboardLayout>

          </ProtectedRoute>

        }

      />

      <Route

        path="/advisor-comment"

        element={

          <ProtectedRoute>

            <DashboardLayout>

              <AdvisorCommentSubmit />

            </DashboardLayout>

          </ProtectedRoute>

        }

      />

      <Route

        path="/advisor-comments"

        element={

          <ProtectedRoute>

            <DashboardLayout>

              <AdvisorCommentsView />

            </DashboardLayout>

          </ProtectedRoute>

        }

      />

      <Route

        path="/reviews"

        element={

          <StateMinisterRoute>

            <DashboardLayout>

              <Reviews />

            </DashboardLayout>

          </StateMinisterRoute>

        }

      />

      <Route

        path="/users"

        element={

          <SuperuserRoute>

            <DashboardLayout>

              <Users />

            </DashboardLayout>

          </SuperuserRoute>

        }

      />

      <Route

        path="/entry-periods"

        element={

          <SuperuserRoute>

            <DashboardLayout>

              <EntryPeriods />

            </DashboardLayout>

          </SuperuserRoute>

        }

      />

      <Route

        path="/validations"

        element={

          <StrategicStaffRoute>

            <DashboardLayout>

              <Validations />

            </DashboardLayout>

          </StrategicStaffRoute>

        }

      />

      <Route

        path="/final-approvals"

        element={

          <ExecutiveRoute>

            <DashboardLayout>

              <FinalApprovals />

            </DashboardLayout>

          </ExecutiveRoute>

        }

      />

      <Route

        path="/minister-view"

        element={

          <MinisterRoute>

            <DashboardLayout>

              <MinisterView />

            </DashboardLayout>

          </MinisterRoute>

        }

      />

      <Route

        path="/executive-minister-view"

        element={

          <ExecutiveRoute>

            <DashboardLayout>

              <MinisterView />

            </DashboardLayout>

          </ExecutiveRoute>

        }

      />

      <Route

        path="/strategic-minister-view"

        element={

          <StrategicStaffRoute>

            <DashboardLayout>

              <MinisterView />

            </DashboardLayout>

          </StrategicStaffRoute>

        }

      />

      <Route

        path="/state-minister-dashboard"

        element={

          <StateMinisterRoute>

            <DashboardLayout>

              <StateMinisterView />

            </DashboardLayout>

          </StateMinisterRoute>

        }

      />

      <Route

        path="/overall-dashboard"

        element={

          <ProtectedRoute>

            <DashboardLayout>

              <OverallDashboard />

            </DashboardLayout>

          </ProtectedRoute>

        }

      />

      <Route

        path="/profile"

        element={

          <ProtectedRoute>

            <DashboardLayout>

              <ProfilePage />

            </DashboardLayout>

          </ProtectedRoute>

        }

      />

      <Route

        path="/superadmin-quarterly"

        element={

          <SuperuserRoute>

            <DashboardLayout>

              <SuperAdminQuarterlyManager />

            </DashboardLayout>

          </SuperuserRoute>

        }

      />

      <Route

        path="/spreadsheet"

        element={

          <ProtectedRoute>

            <DashboardLayout>

              <HierarchicalSpreadsheet />

            </DashboardLayout>

          </ProtectedRoute>

        }

      />

      <Route

        path="/detail-analysis"

        element={

          <MinisterRoute>

            <DetailAnalysis />

          </MinisterRoute>

        }

      />

      <Route

        path="/document-upload"

        element={

          <DocumentUploadRoute>

            <DashboardLayout>

              <DocumentUpload />

            </DashboardLayout>

          </DocumentUploadRoute>

        }

      />

      <Route

        path="/documents"

        element={

          <ProtectedRoute>

            <DashboardLayout>

              <DocumentsView />

            </DashboardLayout>

          </ProtectedRoute>

        }

      />

    </Routes>

  )

}



export default App

