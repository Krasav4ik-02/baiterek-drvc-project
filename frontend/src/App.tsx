import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import PlanForm from './pages/PlanForm';
import PlanItemForm from './pages/PlanItemForm';

// Приватный роут для защиты страниц
const PrivateRoute = ({ children }: { children: JSX.Element }) => {
  const isAuthenticated = !!localStorage.getItem('token');
  return isAuthenticated ? children : <Navigate to="/login" />;
};

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));

  useEffect(() => {
    const handleStorageChange = () => {
      setToken(localStorage.getItem('token'));
    };
    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const handleSetToken = (newToken: string) => {
    localStorage.setItem('token', newToken);
    setToken(newToken);
  };

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login setToken={handleSetToken} />} />
        
        {/* Защищенные маршруты */}
        <Route 
          path="/" 
          element={<PrivateRoute><Dashboard /></PrivateRoute>} 
        />
        <Route 
          path="/plans/:planId" 
          element={<PrivateRoute><PlanForm /></PrivateRoute>} 
        />
        <Route 
          path="/plans/:planId/items/new" 
          element={<PrivateRoute><PlanItemForm /></PrivateRoute>} 
        />
        <Route 
          path="/items/:itemId/edit" 
          element={<PrivateRoute><PlanItemForm /></PrivateRoute>} 
        />

        {/* Редирект на главную для всех остальных путей */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
