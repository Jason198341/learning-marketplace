import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastProvider } from '@/components/common/Toast';
import { MainLayout } from '@/components/layout';
import { AuthPage } from '@/pages';
import { useAuthStore } from '@/store';

// Lazy load pages for better performance
import { lazy, Suspense } from 'react';
import { Skeleton } from '@/components/common';

const HomePage = lazy(() => import('@/pages/HomePage'));
const WorksheetDetailPage = lazy(() => import('@/pages/WorksheetDetailPage'));
const UploadPage = lazy(() => import('@/pages/UploadPage'));
const MyPage = lazy(() => import('@/pages/MyPage'));

function PageLoader() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <Skeleton.Card className="h-64" />
      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(8)].map((_, i) => (
          <Skeleton.Card key={i} className="h-48" />
        ))}
      </div>
    </div>
  );
}

// Protected route wrapper
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) {
    return <PageLoader />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
}

// Guest only route (redirect if logged in)
function GuestRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) {
    return <PageLoader />;
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <Routes>
          {/* Auth route - guest only */}
          <Route
            path="/auth"
            element={
              <GuestRoute>
                <AuthPage />
              </GuestRoute>
            }
          />

          {/* Main layout routes */}
          <Route element={<MainLayout />}>
            {/* Public routes */}
            <Route
              path="/"
              element={
                <Suspense fallback={<PageLoader />}>
                  <HomePage />
                </Suspense>
              }
            />
            <Route
              path="/worksheet/:id"
              element={
                <Suspense fallback={<PageLoader />}>
                  <WorksheetDetailPage />
                </Suspense>
              }
            />

            {/* Protected routes */}
            <Route
              path="/upload"
              element={
                <ProtectedRoute>
                  <Suspense fallback={<PageLoader />}>
                    <UploadPage />
                  </Suspense>
                </ProtectedRoute>
              }
            />
            <Route
              path="/my/*"
              element={
                <ProtectedRoute>
                  <Suspense fallback={<PageLoader />}>
                    <MyPage />
                  </Suspense>
                </ProtectedRoute>
              }
            />
          </Route>

          {/* Catch all - redirect to home */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  );
}

export default App;
