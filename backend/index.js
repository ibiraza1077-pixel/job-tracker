const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// JWT secret
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 32) {
  throw new Error('Set JWT_SECRET to a random secret of at least 32 characters.');
}
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');

const validateAuth = (req, res, next) => {
  const { email, password } = req.body || {};
  if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      typeof password !== 'string' || password.length < 6 || Buffer.byteLength(password) > 72) {
    return res.status(400).json({ error: 'Provide a valid email and a password of 6–72 bytes.' });
  }
  next();
};
const validateJob = (req, res, next) => {
  const { company, role, status, date_applied, notes } = req.body || {};
  if (typeof company !== 'string' || !company.trim() || company.length > 200 ||
      typeof role !== 'string' || !role.trim() || role.length > 200 ||
      (status != null && !['Applied', 'Interview', 'Offer', 'Rejected'].includes(status)) ||
      (date_applied != null && (!/^\d{4}-\d{2}-\d{2}$/.test(date_applied) ||
        Number.isNaN(Date.parse(date_applied)) || new Date(date_applied).toISOString().slice(0, 10) !== date_applied)) ||
      (notes != null && (typeof notes !== 'string' || notes.length > 10000))) {
    return res.status(400).json({ error: 'Provide a company, role, valid status and date, and notes under 10000 characters.' });
  }
  req.body.company = company.trim(); req.body.role = role.trim();
  req.body.status = status || 'Applied';
  req.body.date_applied = date_applied || new Date().toISOString().slice(0, 10);
  next();
};

// Auth middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }
  
  try {
    const verified = jwt.verify(token, JWT_SECRET);
    req.user = verified;
    next();
  } catch (error) {
    res.status(403).json({ error: 'Invalid token.' });
  }
};

// Test route
app.get('/', (req, res) => {
  res.json({ message: 'Job Tracker API is running' });
});

// AUTH ROUTES

// Signup
app.post('/auth/signup', validateAuth, async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Check if user exists
    const userExists = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (userExists.rows.length > 0) {
      return res.status(400).json({ error: 'Email already registered' });
    }
    
    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    // Create user
    const result = await pool.query(
      'INSERT INTO users (email, password) VALUES ($1, $2) RETURNING id, email, created_at',
      [email, hashedPassword]
    );
    
    // Create token
    const token = jwt.sign({ id: result.rows[0].id, email: result.rows[0].email }, JWT_SECRET, { expiresIn: '7d' });
    
    res.status(201).json({ user: result.rows[0], token });
  } catch (error) {
    console.error('Request failed:', error);
    res.status(500).json({ error: 'Unable to complete the request.' });
  }
});

// Login
app.post('/auth/login', validateAuth, async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Find user
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Email or password is incorrect' });
    }
    
    const user = result.rows[0];
    
    // Check password
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(400).json({ error: 'Email or password is incorrect' });
    }
    
    // Create token
    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
    
    res.json({ user: { id: user.id, email: user.email }, token });
  } catch (error) {
    console.error('Request failed:', error);
    res.status(500).json({ error: 'Unable to complete the request.' });
  }
});

// JOB ROUTES (now protected)

// GET all jobs for logged-in user
app.get('/jobs', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM jobs WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Request failed:', error);
    res.status(500).json({ error: 'Unable to complete the request.' });
  }
});

// GET single job by ID
app.get('/jobs/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'SELECT * FROM jobs WHERE id = $1 AND user_id = $2',
      [id, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Job not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Request failed:', error);
    res.status(500).json({ error: 'Unable to complete the request.' });
  }
});

// POST create new job
app.post('/jobs', authenticateToken, validateJob, async (req, res) => {
  try {
    const { company, role, status, date_applied, notes } = req.body;
    const result = await pool.query(
      'INSERT INTO jobs (company, role, status, date_applied, notes, user_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [company, role, status || 'Applied', date_applied || new Date(), notes, req.user.id]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Request failed:', error);
    res.status(500).json({ error: 'Unable to complete the request.' });
  }
});

// PUT update job
app.put('/jobs/:id', authenticateToken, validateJob, async (req, res) => {
  try {
    const { id } = req.params;
    const { company, role, status, date_applied, notes } = req.body;
    const result = await pool.query(
      'UPDATE jobs SET company = $1, role = $2, status = $3, date_applied = $4, notes = $5 WHERE id = $6 AND user_id = $7 RETURNING *',
      [company, role, status, date_applied, notes, id, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Job not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Request failed:', error);
    res.status(500).json({ error: 'Unable to complete the request.' });
  }
});

// DELETE job
app.delete('/jobs/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'DELETE FROM jobs WHERE id = $1 AND user_id = $2 RETURNING *',
      [id, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Job not found' });
    }
    res.json({ message: 'Job deleted successfully' });
  } catch (error) {
    console.error('Request failed:', error);
    res.status(500).json({ error: 'Unable to complete the request.' });
  }
});

// Start server
if (require.main === module) {
  app.listen(port, () => console.log(`Server running on http://localhost:${port}`));
}
module.exports = { app, pool };