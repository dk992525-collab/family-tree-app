import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { token, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav style={styles.nav}>
      <Link to="/" style={styles.brand}>🌳 Family Tree</Link>
      <div style={styles.links}>
        {token ? (
          <>
            <Link to="/tree" style={styles.link}>My Tree</Link>
            <button onClick={handleLogout} style={styles.button}>Logout</button>
          </>
        ) : (
          <>
            <Link to="/login" style={styles.link}>Login</Link>
            <Link to="/register" style={styles.link}>Register</Link>
          </>
        )}
      </div>
    </nav>
  );
}

const styles = {
  nav: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1rem 2rem',
    backgroundColor: '#2c3e50',
    color: 'white'
  },
  brand: {
    color: 'white',
    textDecoration: 'none',
    fontSize: '1.4rem',
    fontWeight: 'bold'
  },
  links: {
    display: 'flex',
    gap: '1rem',
    alignItems: 'center'
  },
  link: {
    color: 'white',
    textDecoration: 'none',
    fontSize: '1rem'
  },
  button: {
    backgroundColor: '#e74c3c',
    color: 'white',
    border: 'none',
    padding: '0.4rem 1rem',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '1rem'
  }
};