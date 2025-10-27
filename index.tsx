import './index.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './src/contexts/AuthContext';
import { ProtectedRoute } from './src/components/ProtectedRoute';
import { AdminProtectedRoute } from './src/components/AdminProtectedRoute';
import { Forbidden } from './src/pages/Forbidden';
import { AdminLayout } from './src/pages/admin/AdminLayout';
import { AdminDashboard } from './src/pages/admin/AdminDashboard';
import { FacilityManagement } from './src/pages/admin/FacilityManagement';
import { FacilityDetail } from './src/pages/admin/FacilityDetail';
import { UserManagement } from './src/pages/admin/UserManagement';
import { AuditLogs } from './src/pages/admin/AuditLogs';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <AuthProvider>
      <BrowserRouter>
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

          {/* 403エラーページ */}
          <Route path="/forbidden" element={<Forbidden />} />

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
            <Route path="audit-logs" element={<AuditLogs />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  </React.StrictMode>
);
