import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div style={styles.container}>
      <h1 style={styles.code}>404</h1>
      <p style={styles.msg}>Page not found</p>
      <Link to="/" style={styles.link}>Go Home</Link>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0f4f8'
  },
  code: {
    fontSize: '5rem',
    color: '#2c3e50',
    margin: 0
  },
  msg: {
    fontSize: '1.2rem',
    color: '#555',
    marginBottom: '1.5rem'
  },
  link: {
    backgroundColor: '#2c3e50',
    color: 'white',
    padding: '0.8rem 2rem',
    borderRadius: '6px',
    textDecoration: 'none'
  }
};