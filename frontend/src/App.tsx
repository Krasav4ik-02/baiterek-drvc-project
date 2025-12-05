import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useState } from 'react';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import SmetaForm from './pages/SmetaForm'; // Переименованный PlanForm
import SmetaItemForm from './pages/SmetaItemForm'; // Новая форма для позиций

function App() {
  const [token, setToken] = useState(localStorage.getItem('token') || '');

  const isAuthenticated = !!token;

  const handleSetToken = (newToken: string) => {
    setToken(newToken);
    localStorage.setItem('token', newToken);
  };

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login setToken={handleSetToken} />} />
        
        {/* Основные маршруты */}
        <Route 
          path="/" 
          element={isAuthenticated ? <Dashboard /> : <Navigate to="/login" />} 
        />
        <Route 
          path="/plans/:smetaId" 
          element={isAuthenticated ? <SmetaForm /> : <Navigate to="/login" />} 
        />
        
        {/* Маршруты для позиций сметы */}
        <Route 
          path="/plans/:smetaId/items/new" 
          element={isAuthenticated ? <SmetaItemForm /> : <Navigate to="/login" />} 
        />
        <Route 
          path="/items/:itemId/edit" 
          element={isAuthenticated ? <SmetaItemForm /> : <Navigate to="/login" />} 
        />

        {/* Redirect старых роутов */}
        <Route path="/application/*" element={<Navigate to="/" />} />
        <Route path="/plans/new" element={<Navigate to="/" />} /> {/* Создание сметы теперь в модалке */}

      </Routes>
    </BrowserRouter>
  );
}

export default App;
