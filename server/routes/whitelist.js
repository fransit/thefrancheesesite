const express = require('express');
const db = require('../database');
const { authMiddleware } = require('../middleware/auth');
const util = require('util');

const router = express.Router();

// Get whitelist for product
router.get('/product/:productId', authMiddleware, (req, res) => {
  try {
    // Verify product belongs to user
    db.get('SELECT * FROM products WHERE id = ? AND user_id = ?', [req.params.productId, req.user.id], (err, product) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'Server error' });
      }

      if (!product) {
        return res.status(404).json({ error: 'product not found' });
      }

      db.all(`
        SELECT * FROM whitelist
        WHERE product_id = ?
        ORDER BY created_at DESC
      `, [req.params.productId], (err, whitelist) => {
        if (err) {
          console.error(err);
          return res.status(500).json({ error: 'Server error' });
        }

        res.json({ whitelist });
      });
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Add to whitelist
router.post('/product/:productId', authMiddleware, (req, res) => {
  try {
    const { place_id, game_name, discord_id, customer_name, description } = req.body;

    if (!place_id || !game_name) {
      return res.status(400).json({ error: 'place id and game name are required' });
    }

    // Verify product belongs to user
    db.get('SELECT * FROM products WHERE id = ? AND user_id = ?', [req.params.productId, req.user.id], (err, product) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'Server error' });
      }

      if (!product) {
        return res.status(404).json({ error: 'product not found' });
      }

      // Check if already exists
      db.get('SELECT * FROM whitelist WHERE product_id = ? AND place_id = ?', [req.params.productId, place_id], (err, existing) => {
        if (err) {
          console.error(err);
          return res.status(500).json({ error: 'Server error' });
        }

        if (existing) {
          // Update existing
          db.run('UPDATE whitelist SET game_name = ?, discord_id = ?, customer_name = ?, description = ?, status = ?, is_active = 1 WHERE id = ?', [game_name, discord_id || null, customer_name || null, description || null, 'whitelisted', existing.id], (err) => {
            if (err) {
              console.error(err);
              return res.status(500).json({ error: 'Server error' });
            }
            return res.json({ message: 'Whitelist updated', status: 'whitelisted' });
          });
        } else {
          // Insert new
          db.run('INSERT INTO whitelist (product_id, place_id, game_name, discord_id, customer_name, description, status, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, 1)', [req.params.productId, place_id, game_name, discord_id || null, customer_name || null, description || null, 'whitelisted'], function(err) {
            if (err) {
              console.error(err);
              return res.status(500).json({ error: 'Server error' });
            }

            res.json({
              message: 'Added to whitelist',
              whitelist: {
                id: this.lastID,
                place_id,
                game_name,
                discord_id,
                customer_name,
                description,
                status: 'whitelisted',
                is_active: 1
              }
            });
          });
        }
      });
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update whitelist status
router.patch('/:id', authMiddleware, (req, res) => {
  try {
    const { status, is_active } = req.body;

    // Get whitelist entry and verify ownership
    db.get(`
      SELECT w.*, p.user_id
      FROM whitelist w
      JOIN products p ON p.id = w.product_id
      WHERE w.id = ?
    `, [req.params.id], (err, entry) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'Server error' });
      }

      if (!entry) {
        return res.status(404).json({ error: 'whitelist entry not found' });
      }

      if (entry.user_id !== req.user.id) {
        return res.status(403).json({ error: 'not authorized' });
      }

      // Update
      let updates = [];
      if (status !== undefined) {
        updates.push(() => {
          db.run('UPDATE whitelist SET status = ? WHERE id = ?', [status, req.params.id], (err) => {
            if (err) {
              console.error(err);
              return res.status(500).json({ error: 'Server error' });
            }
          });
        });
      }

      if (is_active !== undefined) {
        updates.push(() => {
          db.run('UPDATE whitelist SET is_active = ? WHERE id = ?', [is_active ? 1 : 0, req.params.id], (err) => {
            if (err) {
              console.error(err);
              return res.status(500).json({ error: 'Server error' });
            }
          });
        });
      }

      // Execute all updates
      if (updates.length > 0) {
        updates.forEach(update => update());
        res.json({ message: 'Whitelist updated' });
      } else {
        res.json({ message: 'No updates made' });
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Toggle active status for a place
router.patch('/toggle/:productId/:placeId', authMiddleware, (req, res) => {
  try {
    // Verify product belongs to user
    db.get('SELECT * FROM products WHERE id = ? AND user_id = ?', [req.params.productId, req.user.id], (err, product) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'Server error' });
      }

      if (!product) {
        return res.status(404).json({ error: 'product not found' });
      }

      db.get('SELECT * FROM whitelist WHERE product_id = ? AND place_id = ?', [req.params.productId, req.params.placeId], (err, entry) => {
        if (err) {
          console.error(err);
          return res.status(500).json({ error: 'Server error' });
        }

        if (entry) {
          // Toggle existing
          const newActive = entry.is_active ? 0 : 1;
          db.run('UPDATE whitelist SET is_active = ? WHERE id = ?', [newActive, entry.id], (err) => {
            if (err) {
              console.error(err);
              return res.status(500).json({ error: 'Server error' });
            }
            res.json({ message: 'Status toggled', is_active: newActive === 1 });
          });
        } else {
          // Create new entry as unwhitelisted and inactive (OFF)
          db.run('INSERT INTO whitelist (product_id, place_id, game_name, status, is_active) VALUES (?, ?, ?, ?, 0)', [req.params.productId, req.params.placeId, 'Unknown', 'unwhitelisted'], (err) => {
            if (err) {
              console.error(err);
              return res.status(500).json({ error: 'Server error' });
            }
            res.json({ message: 'Marked as unwhitelisted and OFF', is_active: false });
          });
        }
      });
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update status (whitelist/unwhitelist)
router.patch('/status/:productId/:placeId', authMiddleware, (req, res) => {
  try {
    const { status } = req.body;

    if (!['whitelisted', 'unwhitelisted', 'pending'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    // Verify product belongs to user
    db.get('SELECT * FROM products WHERE id = ? AND user_id = ?', [req.params.productId, req.user.id], (err, product) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'Server error' });
      }

      if (!product) {
        return res.status(404).json({ error: 'product not found' });
      }

      db.get('SELECT * FROM whitelist WHERE product_id = ? AND place_id = ?', [req.params.productId, req.params.placeId], (err, entry) => {
        if (err) {
          console.error(err);
          return res.status(500).json({ error: 'Server error' });
        }

        // Determine is_active based on status
        const isActive = status === 'unwhitelisted' ? 0 : 1;

        if (entry) {
          db.run('UPDATE whitelist SET status = ?, is_active = ? WHERE id = ?', [status, isActive, entry.id], (err) => {
            if (err) {
              console.error(err);
              return res.status(500).json({ error: 'Server error' });
            }
            res.json({ message: 'Status updated', status, is_active: isActive });
          });
        } else {
          db.run('INSERT INTO whitelist (product_id, place_id, game_name, discord_id, customer_name, description, status, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [req.params.productId, req.params.placeId, 'Unknown', null, null, null, status, isActive], (err) => {
            if (err) {
              console.error(err);
              return res.status(500).json({ error: 'Server error' });
            }
            res.json({ message: 'Status updated', status, is_active: isActive });
          });
        }
      });
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete from whitelist
router.delete('/:id', authMiddleware, (req, res) => {
  try {
    // Get whitelist entry and verify ownership
    db.get(`
      SELECT w.*, p.user_id
      FROM whitelist w
      JOIN products p ON p.id = w.product_id
      WHERE w.id = ?
    `, [req.params.id], (err, entry) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'Server error' });
      }

      if (!entry) {
        return res.status(404).json({ error: 'whitelist entry not found' });
      }

      if (entry.user_id !== req.user.id) {
        return res.status(403).json({ error: 'not authorized' });
      }

      db.run('DELETE FROM whitelist WHERE id = ?', [req.params.id], (err) => {
        if (err) {
          console.error(err);
          return res.status(500).json({ error: 'Server error' });
        }
        res.json({ message: 'Removed from whitelist' });
      });
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
