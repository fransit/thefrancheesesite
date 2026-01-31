const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../database');
const { authMiddleware } = require('../middleware/auth');
const util = require('util');

const router = express.Router();

// Get all products for user
router.get('/', authMiddleware, (req, res) => {
  try {
    db.all(`
      SELECT
        p.*,
        (SELECT COUNT(DISTINCT place_id) FROM usage_logs WHERE product_id = p.id) as user_count
      FROM products p
      WHERE p.user_id = ?
      ORDER BY p.created_at DESC
    `, [req.user.id], (err, products) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'Server error' });
      }
      res.json({ products });
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create product
router.post('/', authMiddleware, (req, res) => {
  try {
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'product name is required' });
    }

    const productKey = uuidv4();

    db.run('INSERT INTO products (user_id, product_key, name) VALUES (?, ?, ?)', [req.user.id, productKey, name], function(err) {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'Server error' });
      }

      // Generate the Lua script
      const luaScript = generateLuaScript(productKey);

      res.json({
        message: 'Product created',
        product: {
          id: this.lastID,
          product_key: productKey,
          name,
          user_count: 0
        },
        luaScript
      });
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get Lua script for product
router.get('/:id/script', authMiddleware, (req, res) => {
  try {
    db.get('SELECT * FROM products WHERE id = ? AND user_id = ?', [req.params.id, req.user.id], (err, product) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'Server error' });
      }

      if (!product) {
        return res.status(404).json({ error: 'product not found' });
      }

      const luaScript = generateLuaScript(product.product_key);
      res.json({ luaScript });
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get users/logs for product
router.get('/:id/users', authMiddleware, (req, res) => {
  try {
    db.get('SELECT * FROM products WHERE id = ? AND user_id = ?', [req.params.id, req.user.id], (err, product) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'Server error' });
      }

      if (!product) {
        return res.status(404).json({ error: 'product not found' });
      }

      // Get unique place IDs with their latest log and whitelist status
      db.all(`
        SELECT
          ul.place_id,
          ul.game_name,
          MAX(ul.timestamp) as last_seen,
          w.status as whitelist_status,
          COALESCE(w.is_active, 1) as is_active,
          w.discord_id,
          w.customer_name,
          w.description
        FROM usage_logs ul
        LEFT JOIN whitelist w ON w.product_id = ul.product_id AND w.place_id = ul.place_id
        WHERE ul.product_id = ?
        GROUP BY ul.place_id
        ORDER BY last_seen DESC
      `, [req.params.id], (err, users) => {
        if (err) {
          console.error(err);
          return res.status(500).json({ error: 'Server error' });
        }

        res.json({ users });
      });
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update product
router.put('/:id', authMiddleware, (req, res) => {
  try {
    const { name } = req.body;

    if (!name || name.trim() === '') {
      return res.status(400).json({ error: 'product name is required' });
    }

    db.get('SELECT * FROM products WHERE id = ? AND user_id = ?', [req.params.id, req.user.id], (err, product) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'Server error' });
      }

      if (!product) {
        return res.status(404).json({ error: 'product not found' });
      }

      db.run('UPDATE products SET name = ? WHERE id = ? AND user_id = ?', [name.trim(), req.params.id, req.user.id], function(err) {
        if (err) {
          console.error(err);
          return res.status(500).json({ error: 'Server error' });
        }

        if (this.changes === 0) {
          return res.status(404).json({ error: 'product not found' });
        }

        res.json({
          message: 'Product updated',
          product: {
            id: req.params.id,
            name: name.trim(),
            product_key: product.product_key,
            user_count: product.user_count || 0
          }
        });
      });
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get single product
router.get('/:id', authMiddleware, (req, res) => {
  try {
    db.get(`
      SELECT
        p.*,
        (SELECT COUNT(DISTINCT place_id) FROM usage_logs WHERE product_id = p.id) as user_count
      FROM products p
      WHERE p.id = ? AND p.user_id = ?
    `, [req.params.id, req.user.id], (err, product) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'Server error' });
      }

      if (!product) {
        return res.status(404).json({ error: 'product not found' });
      }

      res.json({ product });
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete product
router.delete('/:id', authMiddleware, (req, res) => {
  try {
    // Delete related data first
    db.serialize(() => {
      db.run('DELETE FROM usage_logs WHERE product_id = ?', [req.params.id], (err) => {
        if (err) {
          console.error(err);
          return res.status(500).json({ error: 'Server error' });
        }

        db.run('DELETE FROM whitelist WHERE product_id = ?', [req.params.id], (err) => {
          if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Server error' });
          }

          db.run('DELETE FROM products WHERE id = ? AND user_id = ?', [req.params.id, req.user.id], function(err) {
            if (err) {
              console.error(err);
              return res.status(500).json({ error: 'Server error' });
            }

            if (this.changes === 0) {
              return res.status(404).json({ error: 'product not found' });
            }

            res.json({ message: 'Product deleted' });
          });
        });
      });
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Helper function to generate Lua script
function generateLuaScript(productKey) {
  return `--[[
    FranCheese Secure - License System
    Product Key: ${productKey}
    
    Place this script in ServerScriptService
    DO NOT share this script or your product key!
]]--

local HttpService = game:GetService("HttpService")
local Players = game:GetService("Players")

-- Configuration
local CONFIG = {
    API_URL = "http://localhost:3000/api/tracking", -- Change to your server URL
    PRODUCT_KEY = "${productKey}",
    CHECK_INTERVAL = 60, -- Check whitelist every 60 seconds
    KICK_MESSAGE = "This game is not authorized to use this product."
}

-- Get game info
local PLACE_ID = tostring(game.PlaceId)
local GAME_NAME = game:GetService("MarketplaceService"):GetProductInfo(game.PlaceId).Name or "Unknown Game"

-- License state
local isLicensed = true -- Default to true (ON)
local whitelistStatus = "pending" -- pending, whitelisted, unwhitelisted
local previousStatus = "pending" -- Track previous status to detect changes

-- Function to kick all players in the server
local function kickAllPlayers(reason)
    for _, player in pairs(Players:GetPlayers()) do
        player:Kick(reason or CONFIG.KICK_MESSAGE)
    end
end

-- Function to check if game is authorized
local function isAuthorized()
    -- Deny if unwhitelisted (always blocked, kick players)
    if whitelistStatus == "unwhitelisted" then
        return false
    end

    -- Allow if whitelisted and active
    if whitelistStatus == "whitelisted" and isLicensed then
        return true
    end

    -- Allow if pending (not yet decided)
    if whitelistStatus == "pending" then
        return true
    end

    -- Default: allow (fallback to pending behavior)
    return true
end

-- Function to send tracking data
local function sendTracking()
    local success, response = pcall(function()
        return HttpService:RequestAsync({
            Url = CONFIG.API_URL .. "/log",
            Method = "POST",
            Headers = {
                ["Content-Type"] = "application/json"
            },
            Body = HttpService:JSONEncode({
                product_key = CONFIG.PRODUCT_KEY,
                place_id = PLACE_ID,
                game_name = GAME_NAME
            })
        })
    end)

    if success and response.Success then
        local data = HttpService:JSONDecode(response.Body)
        previousStatus = whitelistStatus
        whitelistStatus = data.whitelist_status or "pending"
        isLicensed = data.is_active ~= false -- ON by default unless explicitly OFF

        -- Check if status changed to unwhitelisted
        local wasAuthorized = isAuthorized()
        if not wasAuthorized then
            warn("[FranCheese Secure] Game is unwhitelisted - Kicking all players")
            kickAllPlayers(CONFIG.KICK_MESSAGE)
            return false
        end
        
        -- If status changed from unwhitelisted to authorized, log it
        if previousStatus == "unwhitelisted" and wasAuthorized then
            print("[FranCheese Secure] Game status changed to authorized - Players can now join")
        end
        
        return true
    else
        -- If API fails, allow by default (pending state)
        warn("[FranCheese Secure] Failed to check license - Allowing by default (pending)")
        return true
    end
end

-- Function to check if script should run
local function checkLicense()
    return isAuthorized()
end

-- Handle player joining
Players.PlayerAdded:Connect(function(player)
    -- Check authorization when player joins
    if not isAuthorized() then
        player:Kick(CONFIG.KICK_MESSAGE)
        warn("[FranCheese Secure] Kicked " .. player.Name .. " - Game is not authorized")
    end
end)

-- Initial tracking
local canRun = sendTracking()

if not canRun then
    warn("[FranCheese Secure] This place is not authorized to use this product")
    kickAllPlayers(CONFIG.KICK_MESSAGE)
    return
end

print("[FranCheese Secure] License validated successfully!")
print("[FranCheese Secure] Place ID: " .. PLACE_ID)
print("[FranCheese Secure] Game: " .. GAME_NAME)
print("[FranCheese Secure] Status: " .. whitelistStatus)
print("[FranCheese Secure] Licensed: " .. tostring(isLicensed))

-- Periodic check
spawn(function()
    while true do
        wait(CONFIG.CHECK_INTERVAL)
        local wasAuthorized = isAuthorized()
        local checkResult = sendTracking()
        
        if not checkResult then
            warn("[FranCheese Secure] License check failed - Kicking all players")
            kickAllPlayers(CONFIG.KICK_MESSAGE)
            break
        end
        
        -- If status changed to unauthorized, kick all players
        if not isAuthorized() and wasAuthorized then
            warn("[FranCheese Secure] License revoked - Kicking all players")
            kickAllPlayers(CONFIG.KICK_MESSAGE)
            break
        end
    end
end)

-- ============================================
-- YOUR CODE BELOW THIS LINE
-- ============================================

-- Example: Only run your code if licensed
if checkLicense() then
    -- Put your protected code here
    print("[FranCheese Secure] Your protected code is now running!")
end
`;
}

module.exports = router;
