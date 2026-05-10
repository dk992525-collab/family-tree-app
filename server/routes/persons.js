const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const auth = require('../middleware/authMiddleware');
const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

// GET all persons in user's tree
router.get('/', auth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM persons WHERE tree_id = $1 ORDER BY created_at ASC',
      [req.user.treeId]
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET single person
router.get('/:id', auth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM persons WHERE id = $1 AND tree_id = $2',
      [req.params.id, req.user.treeId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Person not found' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST create person
router.post('/', auth, upload.single('photo'), async (req, res) => {
  const { first_name, last_name, gender, birth_date, death_date, bio } = req.body;
  const photo_url = req.file ? `/uploads/${req.file.filename}` : null;

  if (!first_name) {
    return res.status(400).json({ success: false, error: 'First name is required' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO persons 
        (tree_id, first_name, last_name, gender, birth_date, death_date, bio, photo_url)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [req.user.treeId, first_name, last_name, gender,
       birth_date || null, death_date || null, bio, photo_url]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT update person
router.put('/:id', auth, upload.single('photo'), async (req, res) => {
  const { first_name, last_name, gender, birth_date, death_date, bio } = req.body;

  try {
    const existing = await pool.query(
      'SELECT * FROM persons WHERE id = $1 AND tree_id = $2',
      [req.params.id, req.user.treeId]
    );
    if (existing.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Person not found' });
    }

    const photo_url = req.file
      ? `/uploads/${req.file.filename}`
      : existing.rows[0].photo_url;

    const result = await pool.query(
      `UPDATE persons SET
        first_name = $1, last_name = $2, gender = $3,
        birth_date = $4, death_date = $5, bio = $6, photo_url = $7
       WHERE id = $8 AND tree_id = $9 RETURNING *`,
      [first_name, last_name, gender,
       birth_date || null, death_date || null, bio,
       photo_url, req.params.id, req.user.treeId]
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE person
router.delete('/:id', auth, async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM persons WHERE id = $1 AND tree_id = $2 RETURNING id',
      [req.params.id, req.user.treeId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Person not found' });
    }
    res.json({ success: true, data: { deleted: req.params.id } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;