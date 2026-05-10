const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../db/pool');
require('dotenv').config();

// Register
router.post('/register', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, error: 'Email and password required' });
  }

  try {
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE email = $1', [email]
    );
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ success: false, error: 'Email already registered' });
    }

    const password_hash = await bcrypt.hash(password, 10);

    const newUser = await pool.query(
      'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email',
      [email, password_hash]
    );

    const tree = await pool.query(
      'INSERT INTO trees (name, owner_id) VALUES ($1, $2) RETURNING id',
      ['My Family Tree', newUser.rows[0].id]
    );

    const token = jwt.sign(
      { id: newUser.rows[0].id, treeId: tree.rows[0].id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      success: true,
      data: { token, email: newUser.rows[0].email, treeId: tree.rows[0].id }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, error: 'Email and password required' });
  }

  try {
    const user = await pool.query(
      'SELECT * FROM users WHERE email = $1', [email]
    );

    if (user.rows.length === 0) {
      return res.status(400).json({ success: false, error: 'Invalid credentials' });
    }

    const validPassword = await bcrypt.compare(password, user.rows[0].password_hash);
    if (!validPassword) {
      return res.status(400).json({ success: false, error: 'Invalid credentials' });
    }

    const tree = await pool.query(
      'SELECT id FROM trees WHERE owner_id = $1', [user.rows[0].id]
    );

    const token = jwt.sign(
      { id: user.rows[0].id, treeId: tree.rows[0].id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      data: { token, email: user.rows[0].email, treeId: tree.rows[0].id }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;