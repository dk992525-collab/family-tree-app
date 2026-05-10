import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Tree from './pages/Tree';
import PersonProfile from './pages/PersonProfile';
import NotFound from './pages/NotFound';

export default function App() {
  return (
    <BrowserRouter>
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/tree" element={
          <ProtectedRoute><Tree /></ProtectedRoute>
        } />
        <Route path="/person/:id" element={
          <ProtectedRoute><PersonProfile /></ProtectedRoute>
        } />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}