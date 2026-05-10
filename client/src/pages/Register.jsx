import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from '../api/axios';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await axios.post('/auth/register', { email, password });
      login(res.data.data.token, { email: res.data.data.email, treeId: res.data.data.treeId });
      toast.success('Account created successfully');
      navigate('/tree');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h2 style={styles.title}>Create Account</h2>
        <div>
          <div style={styles.field}>
            <label style={styles.label}>Email</label>
            <input
              style={styles.input}
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Password</label>
            <input
              style={styles.input}
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          <button
            onClick={handleSubmit}
            style={styles.btn}
            disabled={loading}
          >
            {loading ? 'Creating account...' : 'Register'}
          </button>
        </div>
        <p style={styles.footer}>
          Already have an account? <Link to="/login">Login</Link>
        </p>
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
  card: {
    backgroundColor: 'white',
    padding: '2rem',
    borderRadius: '8px',
    boxShadow: '0 2px 12px rgba(0,0,0,0.1)',
    width: '100%',
    maxWidth: '400px'
  },
  title: {
    marginBottom: '1.5rem',
    color: '#2c3e50',
    textAlign: 'center'
  },
  field: {
    marginBottom: '1rem'
  },
  label: {
    display: 'block',
    marginBottom: '0.4rem',
    color: '#444',
    fontSize: '0.9rem'
  },
  input: {
    width: '100%',
    padding: '0.6rem',
    borderRadius: '4px',
    border: '1px solid #ccc',
    fontSize: '1rem',
    boxSizing: 'border-box'
  },
  btn: {
    width: '100%',
    padding: '0.8rem',
    backgroundColor: '#2c3e50',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    fontSize: '1rem',
    cursor: 'pointer',
    marginTop: '0.5rem'
  },
  footer: {
    textAlign: 'center',
    marginTop: '1rem',
    fontSize: '0.9rem'
  }
};