import { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = 'http://localhost:3000';

function JobTracker() {
  const [jobs, setJobs] = useState([]);
  const [form, setForm] = useState({
    company: '',
    role: '',
    status: 'Applied',
    date_applied: new Date().toISOString().split('T')[0],
    notes: ''
  });
  const [editingId, setEditingId] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [user, setUser] = useState(null);
  const [authForm, setAuthForm] = useState({ email: '', password: '' });
  const [isLogin, setIsLogin] = useState(true);
  const [authError, setAuthError] = useState('');

  // Set up axios default header when token changes
  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      fetchJobs();
    }
  }, [token]);

  // Fetch all jobs
  const fetchJobs = async () => {
    try {
      const response = await axios.get(`${API_URL}/jobs`);
      setJobs(response.data);
    } catch (error) {
      console.error('Error fetching jobs:', error);
      if (error.response?.status === 401 || error.response?.status === 403) {
        handleLogout();
      }
    }
  };

  // Handle auth form input changes
  const handleAuthChange = (e) => {
    setAuthForm({ ...authForm, [e.target.name]: e.target.value });
    setAuthError('');
  };

  // Handle login/signup
  const handleAuth = async (e) => {
    e.preventDefault();
    try {
      const endpoint = isLogin ? '/auth/login' : '/auth/signup';
      const response = await axios.post(`${API_URL}${endpoint}`, authForm);
      localStorage.setItem('token', response.data.token);
      setToken(response.data.token);
      setUser(response.data.user);
      setAuthForm({ email: '', password: '' });
      setAuthError('');
    } catch (error) {
      setAuthError(error.response?.data?.error || 'Authentication failed');
    }
  };

  // Handle logout
  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken('');
    setUser(null);
    setJobs([]);
    delete axios.defaults.headers.common['Authorization'];
  };

  // Handle form input changes
  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  // Handle form submit (create or update)
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        await axios.put(`${API_URL}/jobs/${editingId}`, form);
        setEditingId(null);
      } else {
        await axios.post(`${API_URL}/jobs`, form);
      }
      setForm({
        company: '',
        role: '',
        status: 'Applied',
        date_applied: new Date().toISOString().split('T')[0],
        notes: ''
      });
      fetchJobs();
    } catch (error) {
      console.error('Error saving job:', error);
    }
  };

  // Handle edit button
  const handleEdit = (job) => {
    setForm({
      company: job.company,
      role: job.role,
      status: job.status,
      date_applied: job.date_applied.split('T')[0],
      notes: job.notes || ''
    });
    setEditingId(job.id);
  };

  // Handle delete button
  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this application?')) {
      try {
        await axios.delete(`${API_URL}/jobs/${id}`);
        fetchJobs();
      } catch (error) {
        console.error('Error deleting job:', error);
      }
    }
  };

  // Get status color
  const getStatusColor = (status) => {
    switch (status) {
      case 'Applied': return '#3498db';
      case 'Interview': return '#f39c12';
      case 'Offer': return '#27ae60';
      case 'Rejected': return '#e74c3c';
      default: return '#95a5a6';
    }
  };

  // If not logged in, show auth form
  if (!token) {
    return (
      <div style={{ maxWidth: '400px', margin: '100px auto', padding: '20px', fontFamily: 'Arial, sans-serif' }}>
        <h1 style={{ textAlign: 'center', marginBottom: '30px' }}>Job Tracker</h1>
        <div style={{ background: '#f8f9fa', padding: '30px', borderRadius: '8px' }}>
          <h2 style={{ textAlign: 'center', marginBottom: '20px' }}>{isLogin ? 'Login' : 'Sign Up'}</h2>
          
          {authError && (
            <p style={{ color: '#e74c3c', textAlign: 'center', marginBottom: '15px' }}>{authError}</p>
          )}
          
          <form onSubmit={handleAuth}>
            <input
              type="email"
              name="email"
              placeholder="Email"
              value={authForm.email}
              onChange={handleAuthChange}
              required
              style={{ width: '100%', padding: '12px', marginBottom: '15px', borderRadius: '4px', border: '1px solid #ddd', fontSize: '14px', boxSizing: 'border-box' }}
            />
            <input
              type="password"
              name="password"
              placeholder="Password"
              value={authForm.password}
              onChange={handleAuthChange}
              required
              minLength="6"
              style={{ width: '100%', padding: '12px', marginBottom: '20px', borderRadius: '4px', border: '1px solid #ddd', fontSize: '14px', boxSizing: 'border-box' }}
            />
            <button
              type="submit"
              style={{ width: '100%', padding: '12px', background: '#2c3e50', color: 'white', border: 'none', borderRadius: '4px', fontSize: '16px', cursor: 'pointer' }}
            >
              {isLogin ? 'Login' : 'Sign Up'}
            </button>
          </form>
          
          <p style={{ textAlign: 'center', marginTop: '20px' }}>
            {isLogin ? "Don't have an account? " : "Already have an account? "}
            <button
              onClick={() => { setIsLogin(!isLogin); setAuthError(''); }}
              style={{ background: 'none', border: 'none', color: '#3498db', cursor: 'pointer', textDecoration: 'underline' }}
            >
              {isLogin ? 'Sign Up' : 'Login'}
            </button>
          </p>
        </div>
      </div>
    );
  }

  // Logged in - show job tracker
  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <h1 style={{ margin: 0 }}>Job Application Tracker</h1>
        <button
          onClick={handleLogout}
          style={{ padding: '8px 16px', background: '#e74c3c', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
        >
          Logout
        </button>
      </div>
      
      {/* Form */}
      <form onSubmit={handleSubmit} style={{ background: '#f8f9fa', padding: '20px', borderRadius: '8px', marginBottom: '30px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
          <input
            type="text"
            name="company"
            placeholder="Company"
            value={form.company}
            onChange={handleChange}
            required
            style={{ padding: '10px', borderRadius: '4px', border: '1px solid #ddd', fontSize: '14px' }}
          />
          <input
            type="text"
            name="role"
            placeholder="Role"
            value={form.role}
            onChange={handleChange}
            required
            style={{ padding: '10px', borderRadius: '4px', border: '1px solid #ddd', fontSize: '14px' }}
          />
          <select
            name="status"
            value={form.status}
            onChange={handleChange}
            style={{ padding: '10px', borderRadius: '4px', border: '1px solid #ddd', fontSize: '14px' }}
          >
            <option value="Applied">Applied</option>
            <option value="Interview">Interview</option>
            <option value="Offer">Offer</option>
            <option value="Rejected">Rejected</option>
          </select>
          <input
            type="date"
            name="date_applied"
            value={form.date_applied}
            onChange={handleChange}
            style={{ padding: '10px', borderRadius: '4px', border: '1px solid #ddd', fontSize: '14px' }}
          />
        </div>
        <textarea
          name="notes"
          placeholder="Notes (optional)"
          value={form.notes}
          onChange={handleChange}
          rows="2"
          style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #ddd', fontSize: '14px', marginBottom: '15px', boxSizing: 'border-box' }}
        />
        <button
          type="submit"
          style={{ width: '100%', padding: '12px', background: '#2c3e50', color: 'white', border: 'none', borderRadius: '4px', fontSize: '16px', cursor: 'pointer' }}
        >
          {editingId ? 'Update Application' : 'Add Application'}
        </button>
      </form>

      {/* Job List */}
      <div>
        {jobs.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#7f8c8d' }}>No applications yet. Add your first one above!</p>
        ) : (
          jobs.map((job) => (
            <div
              key={job.id}
              style={{ background: 'white', border: '1px solid #ddd', borderRadius: '8px', padding: '15px', marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
            >
              <div>
                <h3 style={{ margin: '0 0 5px 0' }}>{job.company}</h3>
                <p style={{ margin: '0 0 5px 0', color: '#555' }}>{job.role}</p>
                <span
                  style={{ display: 'inline-block', padding: '3px 10px', borderRadius: '12px', fontSize: '12px', color: 'white', background: getStatusColor(job.status) }}
                >
                  {job.status}
                </span>
                <span style={{ marginLeft: '10px', fontSize: '12px', color: '#7f8c8d' }}>
                  {new Date(job.date_applied).toLocaleDateString()}
                </span>
                {job.notes && <p style={{ margin: '10px 0 0 0', fontSize: '13px', color: '#666' }}>{job.notes}</p>}
              </div>
              <div>
                <button
                  onClick={() => handleEdit(job)}
                  style={{ padding: '8px 15px', marginRight: '5px', background: '#3498db', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(job.id)}
                  style={{ padding: '8px 15px', background: '#e74c3c', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default JobTracker;