import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Home() {
  const { token } = useAuth();

  return (
    <div style={styles.container}>
      <div style={styles.hero}>
        <h1 style={styles.title}>🌳 Family Tree</h1>
        <p style={styles.subtitle}>
          Build, explore, and preserve your family history in one place.
        </p>
        {token ? (
          <Link to="/tree" style={styles.btn}>Go to My Tree</Link>
        ) : (
          <div style={styles.btnGroup}>
            <Link to="/register" style={styles.btn}>Get Started</Link>
            <Link to="/login" style={styles.btnOutline}>Login</Link>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '90vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0f4f8'
  },
  hero: {
    textAlign: 'center',
    padding: '2rem'
  },
  title: {
    fontSize: '3rem',
    color: '#2c3e50',
    marginBottom: '1rem'
  },
  subtitle: {
    fontSize: '1.2rem',
    color: '#555',
    marginBottom: '2rem'
  },
  btnGroup: {
    display: 'flex',
    gap: '1rem',
    justifyContent: 'center'
  },
  btn: {
    backgroundColor: '#2c3e50',
    color: 'white',
    padding: '0.8rem 2rem',
    borderRadius: '6px',
    textDecoration: 'none',
    fontSize: '1rem'
  },
  btnOutline: {
    backgroundColor: 'transparent',
    color: '#2c3e50',
    padding: '0.8rem 2rem',
    borderRadius: '6px',
    textDecoration: 'none',
    fontSize: '1rem',
    border: '2px solid #2c3e50'
  }
};