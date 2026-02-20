import './index.css';
import './firebase';  // Phase 18.2 Step 6: Firebase初期化を確実に実行（React マウント前）
import React, { Suspense, lazy } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './src/contexts/AuthContext';
import { ToastProvider, ToastContainer } from './src/contexts/ToastContext';
import { NotificationProvider } from './src/contexts/NotificationContext';
import { LoadingProvider, LoadingOverlay } from './src/contexts/LoadingContext';
import { ProtectedRoute } from './src/components/ProtectedRoute';
import { AdminProtectedRoute } from './src/components/AdminProtectedRoute';
import { PageLoadingFallback } from './src/components/LoadingFallback';
import { ChunkLoadErrorBoundary } from './src/components/ChunkLoadErrorBoundary';
import { reportWebVitals } from './src/utils/webVitals';  // Phase 19.1.1: Web Vitals測定

// Phase 19.1.4: Code Splitting - 動的インポート
const App = lazy(() => import('./App'));
const Forbidden = lazy(() => import('./src/pages/Forbidden'));
const InviteAccept = lazy(() => import('./src/pages/InviteAccept'));
const AdminLayout = lazy(() => import('./src/pages/admin/AdminLayout').then(m => ({ default: m.AdminLayout })));
const AdminDashboard = lazy(() => import('./src/pages/admin/AdminDashboard').then(m => ({ default: m.AdminDashboard })));
const FacilityManagement = lazy(() => import('./src/pages/admin/FacilityManagement').then(m => ({ default: m.FacilityManagement })));
const FacilityDetail = lazy(() => import('./src/pages/admin/FacilityDetail').then(m => ({ default: m.FacilityDetail })));
const UserManagement = lazy(() => import('./src/pages/admin/UserManagement').then(m => ({ default: m.UserManagement })));
const UserDetail = lazy(() => import('./src/pages/admin/UserDetail').then(m => ({ default: m.UserDetail })));
const AuditLogs = lazy(() => import('./src/pages/admin/AuditLogs').then(m => ({ default: m.AuditLogs })));
const SecurityAlerts = lazy(() => import('./src/pages/admin/SecurityAlerts').then(m => ({ default: m.SecurityAlerts })));
const BackupManagement = lazy(() => import('./src/pages/admin/BackupManagement').then(m => ({ default: m.BackupManagement })));
const UsageReports = lazy(() => import('./src/pages/admin/UsageReports').then(m => ({ default: m.UsageReports })));
const ReportPage = lazy(() => import('./src/pages/reports/ReportPage').then(m => ({ default: m.ReportPage })));
const HelpPage = lazy(() => import('./src/pages/HelpPage').then(m => ({ default: m.HelpPage })));

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <AuthProvider>
      <NotificationProvider>
      <ToastProvider>
        <LoadingProvider>
          <BrowserRouter>
            {/* Phase 19.1.4: ErrorBoundary + Suspense でラッピング */}
            <ChunkLoadErrorBoundary>
              <Suspense fallback={<PageLoadingFallback />}>
                <Routes>
                  {/* メインアプリケーション */}
                  <Route
                    path="/"
                    element={
                      <ProtectedRoute>
                        <App />
                      </ProtectedRoute>
                    }
                  />

                  {/* 月次レポートページ */}
                  <Route
                    path="/reports"
                    element={
                      <ProtectedRoute>
                        <ReportPage />
                      </ProtectedRoute>
                    }
                  />

                  {/* ヘルプページ */}
                  <Route
                    path="/help"
                    element={
                      <ProtectedRoute>
                        <HelpPage />
                      </ProtectedRoute>
                    }
                  />

                  {/* 403エラーページ */}
                  <Route path="/forbidden" element={<Forbidden />} />

                  {/* 招待受け入れページ（認証不要） */}
                  <Route path="/invite" element={<InviteAccept />} />

                  {/* 管理画面（super-admin専用） */}
                  <Route
                    path="/admin"
                    element={
                      <ProtectedRoute>
                        <AdminProtectedRoute>
                          <AdminLayout />
                        </AdminProtectedRoute>
                      </ProtectedRoute>
                    }
                  >
                    <Route index element={<AdminDashboard />} />
                    <Route path="facilities" element={<FacilityManagement />} />
                    <Route path="facilities/:facilityId" element={<FacilityDetail />} />
                    <Route path="users" element={<UserManagement />} />
                    <Route path="users/:userId" element={<UserDetail />} />
                    <Route path="audit-logs" element={<AuditLogs />} />
                    <Route path="security-alerts" element={<SecurityAlerts />} />
                    <Route path="backup" element={<BackupManagement />} />
                    <Route path="usage-reports" element={<UsageReports />} />
                  </Route>
                </Routes>
              </Suspense>
            </ChunkLoadErrorBoundary>

            {/* グローバルコンポーネント */}
            <ToastContainer />
            <LoadingOverlay />
          </BrowserRouter>
        </LoadingProvider>
      </ToastProvider>
      </NotificationProvider>
    </AuthProvider>
  </React.StrictMode>
);

// Phase 19.1.1: Web Vitals測定を開始（本番環境でもパフォーマンス測定）
reportWebVitals();
