import React from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import IntersectObserver from '@/components/common/IntersectObserver';
import { DataProvider } from '@/components/common/DataProvider';
import { AuthProvider } from '@/contexts/AuthContext';
import { RouteGuard } from '@/components/common/RouteGuard';
import { Toaster } from '@/components/ui/sonner';

import { routes, childRoutes } from './routes';

const App: React.FC = () => {
  return (
    <Router>
      <AuthProvider>
        <DataProvider>
          <IntersectObserver />
          <RouteGuard routes={[...routes, ...childRoutes]}>
            <Routes>
              {routes.map((route, index) => (
                <Route key={index} path={route.path} element={route.element}>
                  {route.path === '/' && childRoutes.map((child, cIndex) => (
                    <Route key={cIndex} path={child.path === '/' ? undefined : child.path.slice(1)} element={child.element} index={child.path === '/'} />
                  ))}
                </Route>
              ))}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </RouteGuard>
          <Toaster />
        </DataProvider>
      </AuthProvider>
    </Router>
  );
};

export default App;
