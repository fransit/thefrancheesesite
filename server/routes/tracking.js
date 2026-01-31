const express = require('express');
const db = require('../database');
const util = require('util');
const https = require('https');
const crypto = require('crypto');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Helper function to fetch game details from Roblox API
async function fetchRobloxGameDetails(placeId) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'apis.roblox.com',
      path: `/universe/places/${placeId}`,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Roblox-API/1.0)',
        'Accept': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          if (res.statusCode === 200) {
            const gameData = JSON.parse(data);
            resolve({
              name: gameData.name || 'Unknown Game',
              description: gameData.description || '',
              creator: gameData.creator || {},
              price: gameData.price || 0,
              isActive: gameData.isActive || false
            });
          } else {
            resolve({
              name: 'Unknown Game',
              description: '',
              creator: {},
              price: 0,
              isActive: false
            });
          }
        } catch (error) {
          resolve({
            name: 'Unknown Game',
            description: '',
            creator: {},
            price: 0,
            isActive: false
          });
        }
      });
    });

    req.on('error', (error) => {
      resolve({
        name: 'Unknown Game',
        description: '',
        creator: {},
        price: 0,
        isActive: false
      });
    });

    req.setTimeout(5000, () => {
      req.destroy();
      resolve({
        name: 'Unknown Game',
        description: '',
        creator: {},
        price: 0,
        isActive: false
      });
    });

    req.end();
  });
}

// Helper function to fetch game player count from Roblox Presence API
async function fetchRobloxPlayerCount(universeId) {
  return new Promise((resolve, reject) => {
    // First get universe ID from place ID
    const universeOptions = {
      hostname: 'apis.roblox.com',
      path: `/universe/places/${universeId}`,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Roblox-API/1.0)',
        'Accept': 'application/json'
      }
    };

    const universeReq = https.request(universeOptions, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          if (res.statusCode === 200) {
            const universeData = JSON.parse(data);
            const actualUniverseId = universeData.universeId;

            if (!actualUniverseId) {
              resolve({ playing: 0, maxPlayers: 0 });
              return;
            }

            // Now fetch player count
            const presenceOptions = {
              hostname: 'presence.roblox.com',
              path: `/v1/presence/counts?universeIds=${actualUniverseId}`,
              method: 'GET',
              headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; Roblox-API/1.0)',
                'Accept': 'application/json'
              }
            };

            const presenceReq = https.request(presenceOptions, (presenceRes) => {
              let presenceData = '';

              presenceRes.on('data', (chunk) => {
                presenceData += chunk;
              });

              presenceRes.on('end', () => {
                try {
                  if (presenceRes.statusCode === 200) {
                    const presenceJson = JSON.parse(presenceData);
                    const gamePresence = presenceJson.data && presenceJson.data[0];
                    resolve({
                      playing: gamePresence ? gamePresence.playing : 0,
                      maxPlayers: gamePresence ? gamePresence.maxPlayers : 0
                    });
                  } else {
                    resolve({ playing: 0, maxPlayers: 0 });
                  }
                } catch (error) {
                  resolve({ playing: 0, maxPlayers: 0 });
                }
              });
            });

            presenceReq.on('error', (error) => {
              resolve({ playing: 0, maxPlayers: 0 });
            });

            presenceReq.setTimeout(5000, () => {
              presenceReq.destroy();
              resolve({ playing: 0, maxPlayers: 0 });
            });

            presenceReq.end();
          } else {
            resolve({ playing: 0, maxPlayers: 0 });
          }
        } catch (error) {
          resolve({ playing: 0, maxPlayers: 0 });
        }
      });
    });

    universeReq.on('error', (error) => {
      resolve({ playing: 0, maxPlayers: 0 });
    });

    universeReq.setTimeout(5000, () => {
      universeReq.destroy();
      resolve({ playing: 0, maxPlayers: 0 });
    });

    universeReq.end();
  });
}

// Helper function to fetch Roblox user details by ID
async function fetchRobloxUserDetails(userId) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'users.roblox.com',
      path: `/v1/users/${userId}`,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Roblox-API/1.0)',
        'Accept': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          if (res.statusCode === 200) {
            const userData = JSON.parse(data);
            resolve({
              id: userData.id,
              name: userData.name,
              displayName: userData.displayName,
              description: userData.description || '',
              created: userData.created,
              isBanned: userData.isBanned || false
            });
          } else {
            resolve(null);
          }
        } catch (error) {
          resolve(null);
        }
      });
    });

    req.on('error', (error) => {
      resolve(null);
    });

    req.setTimeout(5000, () => {
      req.destroy();
      resolve(null);
    });

    req.end();
  });
}

// Helper function to validate Roblox session token
async function validateRobloxSession(sessionToken) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM roblox_sessions WHERE session_token = ? AND expires_at > datetime("now")', [sessionToken], (err, session) => {
      if (err) {
        console.error(err);
        resolve(null);
        return;
      }

      if (session) {
        resolve({
          userId: session.user_id,
          username: session.username
        });
      } else {
        resolve(null);
      }
    });
  });
}

// Helper function to send analytics events (Google Analytics style)
function sendAnalyticsEvent(measurementId, eventName, parameters = {}) {
  if (!measurementId || !process.env.GA_MEASUREMENT_ID) return;

  const payload = {
    client_id: crypto.randomUUID(),
    events: [{
      name: eventName,
      params: {
        ...parameters,
        engagement_time_msec: 1000
      }
    }]
  };

  const options = {
    hostname: 'www.google-analytics.com',
    path: `/mp/collect?measurement_id=${measurementId}&api_secret=${process.env.GA_API_SECRET || ''}`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (compatible; Roblox-API/1.0)'
    }
  };

  const req = https.request(options, (res) => {
    // Analytics response - we don't need to handle it
  });

  req.on('error', (error) => {
    console.error('Analytics error:', error);
  });

  req.write(JSON.stringify(payload));
  req.end();
}

// Helper function to get geolocation data from IP
async function getGeolocation(ipAddress) {
  return new Promise((resolve, reject) => {
    if (!ipAddress || ipAddress === 'unknown' || ipAddress === '::1' || ipAddress.startsWith('127.')) {
      resolve({
        country: 'Unknown',
        country_code: 'XX',
        city: 'Unknown',
        region: 'Unknown',
        timezone: 'Unknown'
      });
      return;
    }

    // Remove IPv6 prefix if present
    const cleanIp = ipAddress.replace(/^::ffff:/, '');

    const options = {
      hostname: 'ipapi.co',
      path: `/${cleanIp}/json/`,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Roblox-API/1.0)',
        'Accept': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          if (res.statusCode === 200) {
            const geoData = JSON.parse(data);
            resolve({
              country: geoData.country_name || 'Unknown',
              country_code: geoData.country_code || 'XX',
              city: geoData.city || 'Unknown',
              region: geoData.region || 'Unknown',
              timezone: geoData.timezone || 'Unknown',
              latitude: geoData.latitude,
              longitude: geoData.longitude
            });
          } else {
            resolve({
              country: 'Unknown',
              country_code: 'XX',
              city: 'Unknown',
              region: 'Unknown',
              timezone: 'Unknown'
            });
          }
        } catch (error) {
          resolve({
            country: 'Unknown',
            country_code: 'XX',
            city: 'Unknown',
            region: 'Unknown',
            timezone: 'Unknown'
          });
        }
      });
    });

    req.on('error', (error) => {
      resolve({
        country: 'Unknown',
        country_code: 'XX',
        city: 'Unknown',
        region: 'Unknown',
        timezone: 'Unknown'
      });
    });

    req.setTimeout(3000, () => {
      req.destroy();
      resolve({
        country: 'Unknown',
        country_code: 'XX',
        city: 'Unknown',
        region: 'Unknown',
        timezone: 'Unknown'
      });
    });

    req.end();
  });
}

// Helper function to generate usage insights with geolocation
async function generateUsageInsights(productId) {
  return new Promise((resolve, reject) => {
    // Get usage patterns over time
    db.all(`
      SELECT
        DATE(timestamp) as date,
        COUNT(*) as total_uses,
        COUNT(DISTINCT place_id) as unique_games,
        COUNT(DISTINCT CASE WHEN roblox_user_id IS NOT NULL THEN roblox_user_id END) as verified_users
      FROM usage_logs
      WHERE product_id = ?
      GROUP BY DATE(timestamp)
      ORDER BY date DESC
      LIMIT 30
    `, [productId], (err, dailyStats) => {
      if (err) {
        console.error(err);
        resolve({});
        return;
      }

      // Get top games
      db.all(`
        SELECT
          place_id,
          game_name,
          COUNT(*) as usage_count,
          MAX(timestamp) as last_used
        FROM usage_logs
        WHERE product_id = ?
        GROUP BY place_id
        ORDER BY usage_count DESC
        LIMIT 10
      `, [productId], (err, topGames) => {
        if (err) {
          console.error(err);
          resolve({ daily_stats: dailyStats, top_games: [] });
          return;
        }

        // Get user engagement metrics
        db.get(`
          SELECT
            COUNT(DISTINCT place_id) as total_games,
            COUNT(DISTINCT CASE WHEN roblox_user_id IS NOT NULL THEN roblox_user_id END) as verified_users_count,
            AVG(CASE WHEN roblox_user_id IS NOT NULL THEN 1 ELSE 0 END) * 100 as verification_rate,
            COUNT(*) as total_uses,
            COUNT(DISTINCT ip_address) as unique_ips
          FROM usage_logs
          WHERE product_id = ?
        `, [productId], (err, engagement) => {
          if (err) {
            console.error(err);
            resolve({ daily_stats: dailyStats, top_games: topGames, engagement: {} });
            return;
          }

          // Get geolocation distribution
          db.all(`
            SELECT ip_address, COUNT(*) as usage_count
            FROM usage_logs
            WHERE product_id = ? AND ip_address IS NOT NULL AND ip_address != 'unknown'
            GROUP BY ip_address
            ORDER BY usage_count DESC
            LIMIT 20
          `, [productId], async (err, ipStats) => {
            if (err) {
              console.error(err);
              resolve({
                daily_stats: dailyStats,
                top_games: topGames,
                engagement: {
                  total_games: engagement.total_games || 0,
                  verified_users_count: engagement.verified_users_count || 0,
                  verification_rate: Math.round(engagement.verification_rate || 0),
                  total_uses: engagement.total_uses || 0,
                  unique_ips: engagement.unique_ips || 0
                },
                geolocation: []
              });
              return;
            }

            // Get geolocation for top IPs
            const geolocationData = await Promise.all(
              ipStats.slice(0, 10).map(async (stat) => {
                try {
                  const geo = await getGeolocation(stat.ip_address);
                  return {
                    ...geo,
                    usage_count: stat.usage_count,
                    ip_hash: crypto.createHash('md5').update(stat.ip_address).digest('hex').substring(0, 8)
                  };
                } catch (error) {
                  return {
                    country: 'Unknown',
                    country_code: 'XX',
                    city: 'Unknown',
                    usage_count: stat.usage_count,
                    ip_hash: crypto.createHash('md5').update(stat.ip_address).digest('hex').substring(0, 8)
                  };
                }
              })
            );

            resolve({
              daily_stats: dailyStats,
              top_games: topGames,
              engagement: {
                total_games: engagement.total_games || 0,
                verified_users_count: engagement.verified_users_count || 0,
                verification_rate: Math.round(engagement.verification_rate || 0),
                total_uses: engagement.total_uses || 0,
                unique_ips: engagement.unique_ips || 0
              },
              geolocation: geolocationData
            });
          });
        });
      });
    });
  });
}

// Create Roblox user session (simplified OAuth-like flow)
router.post('/roblox/session', async (req, res) => {
  try {
    const { user_id, username, session_token } = req.body;

    if (!user_id || !username || !session_token) {
      return res.status(400).json({ error: 'missing required fields' });
    }

    // Verify user exists on Roblox
    const userDetails = await fetchRobloxUserDetails(user_id);
    if (!userDetails) {
      return res.status(400).json({ error: 'invalid roblox user' });
    }

    // Create session (expires in 24 hours)
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    db.run('INSERT OR REPLACE INTO roblox_sessions (user_id, username, session_token, expires_at) VALUES (?, ?, ?, ?)',
      [user_id, username, session_token, expiresAt], (err) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'Server error' });
      }

      res.json({
        success: true,
        session_token: session_token,
        expires_at: expiresAt
      });
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Verify Roblox session
router.get('/roblox/verify/:sessionToken', async (req, res) => {
  try {
    const { sessionToken } = req.params;
    const session = await validateRobloxSession(sessionToken);

    if (session) {
      res.json({
        valid: true,
        user_id: session.userId,
        username: session.username
      });
    } else {
      res.json({ valid: false });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Log usage from Roblox script with enhanced tracking
router.post('/log', async (req, res) => {
  try {
    const { product_key, place_id, game_name: providedGameName, session_token, roblox_user_id, roblox_username } = req.body;

    if (!product_key || !place_id) {
      return res.status(400).json({ error: 'missing required fields' });
    }

    // Validate session if provided
    let robloxUser = null;
    if (session_token) {
      robloxUser = await validateRobloxSession(session_token);
    }

    // Get client IP and user agent
    const ipAddress = req.ip || req.connection.remoteAddress || req.socket.remoteAddress || 'unknown';
    const userAgent = req.get('User-Agent') || 'unknown';

    // Find product by key
    const products = await db`
      SELECT * FROM products WHERE product_key = ${product_key}
    `;

    if (products.length === 0) {
      return res.status(404).json({ error: 'invalid product key' });
    }

    const product = products[0];

      // Fetch real game details from Roblox API
      let gameDetails, realGameName, finalGameName;
      try {
        gameDetails = await fetchRobloxGameDetails(place_id);
        realGameName = gameDetails.name;
        finalGameName = realGameName !== 'Unknown Game' ? realGameName : (providedGameName || 'Unknown Game');
      } catch (error) {
        console.error('Error fetching game details:', error);
        // Fallback to provided game name or unknown
        finalGameName = providedGameName || 'Unknown Game';
      }

      // Log the usage with final game name (either from API or fallback)
      const logData = {
        product_id: product.id,
        place_id: place_id,
        game_name: finalGameName,
        roblox_user_id: robloxUser ? robloxUser.userId : (roblox_user_id || null),
        roblox_username: robloxUser ? robloxUser.username : (roblox_username || null),
        ip_address: ipAddress,
        user_agent: userAgent
      };

      // Send analytics event
      sendAnalyticsEvent(
        process.env.GA_MEASUREMENT_ID,
        process.env.GA_API_SECRET,
        'script_usage',
        {
          product_key: product_key,
          place_id: place_id,
          game_name: finalGameName,
          verified_user: !!robloxUser,
          custom_user_id: crypto.createHash('md5').update(ipAddress).digest('hex').substring(0, 8)
        }
      );

      await db`
        INSERT INTO usage_logs (product_id, place_id, game_name, roblox_user_id, roblox_username, ip_address, user_agent)
        VALUES (${logData.product_id}, ${logData.place_id}, ${logData.game_name}, ${logData.roblox_user_id},
         ${logData.roblox_username}, ${logData.ip_address}, ${logData.user_agent})
      `;

      // Check whitelist status
      const whitelists = await db`
        SELECT * FROM whitelist WHERE product_id = ${product.id} AND place_id = ${place_id}
      `;

      if (whitelists.length === 0) {
        // Auto-create pending entry with final game name
        await db`
          INSERT INTO whitelist (product_id, place_id, game_name, status, is_active)
          VALUES (${product.id}, ${place_id}, ${finalGameName}, 'pending', 1)
        `;

        res.json({
          success: true,
          whitelist_status: 'pending',
          is_active: true,
          game_name: finalGameName,
          roblox_verified: !!robloxUser
        });
      } else {
        // Update game name if it's still unknown or different
        const whitelistEntry = whitelists[0];
        if ((whitelistEntry.game_name === 'Unknown' || whitelistEntry.game_name === 'Unknown Game') && finalGameName !== 'Unknown Game') {
          await db`
            UPDATE whitelist SET game_name = ${finalGameName}
            WHERE product_id = ${product.id} AND place_id = ${place_id}
          `;
        }

        res.json({
          success: true,
          whitelist_status: whitelistEntry.status,
          is_active: whitelistEntry.is_active === 1,
          game_name: finalGameName,
          roblox_verified: !!robloxUser
        });
      }

      // Code removed - duplicate
        product_id: product.id,
        place_id: place_id,
        game_name: finalGameName,
        roblox_user_id: robloxUser ? robloxUser.userId : (roblox_user_id || null),
        roblox_username: robloxUser ? robloxUser.username : (roblox_username || null),
        ip_address: ipAddress,
        user_agent: userAgent
      };

        // Send analytics event
        sendAnalyticsEvent(
          process.env.GA_MEASUREMENT_ID,
          'script_usage',
          {
            product_key: product_key,
            place_id: place_id,
            game_name: finalGameName,
            verified_user: !!robloxUser,
            custom_user_id: crypto.createHash('md5').update(ipAddress).digest('hex').substring(0, 8)
          }
        );

        await db`
          INSERT INTO usage_logs (product_id, place_id, game_name, roblox_user_id, roblox_username, ip_address, user_agent)
          VALUES (${logData.product_id}, ${logData.place_id}, ${logData.game_name}, ${logData.roblox_user_id},
           ${logData.roblox_username}, ${logData.ip_address}, ${logData.user_agent})
        `;

        // Check whitelist status
        const whitelists = await db`
          SELECT * FROM whitelist WHERE product_id = ${product.id} AND place_id = ${place_id}
        `;

        if (whitelists.length === 0) {
          // Auto-create pending entry with real game name
          await db`
            INSERT INTO whitelist (product_id, place_id, game_name, status, is_active)
            VALUES (${product.id}, ${place_id}, ${finalGameName}, 'pending', 1)
          `;

          res.json({
            success: true,
            whitelist_status: 'pending',
            is_active: true,
            game_name: finalGameName,
            roblox_verified: !!robloxUser
          });
        } else {
          // Update game name if it's still unknown or different
          const whitelistEntry = whitelists[0];
          if ((whitelistEntry.game_name === 'Unknown' || whitelistEntry.game_name === 'Unknown Game') && finalGameName !== 'Unknown Game') {
            await db`
              UPDATE whitelist SET game_name = ${finalGameName}
              WHERE product_id = ${product.id} AND place_id = ${place_id}
            `;
          }

          res.json({
            success: true,
            whitelist_status: whitelistEntry.status,
            is_active: whitelistEntry.is_active === 1,
            game_name: finalGameName,
            roblox_verified: !!robloxUser
          });
        }
      } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Server error' });
    }
  });

// Check license status (can be called by Roblox script)
router.get('/check/:productKey/:placeId', (req, res) => {
  try {
    const { productKey, placeId } = req.params;

    // Find product
    db.get('SELECT * FROM products WHERE product_key = ?', [productKey], (err, product) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'Server error' });
      }

      if (!product) {
        return res.status(404).json({ valid: false, error: 'invalid product key' });
      }

      // Check whitelist
      db.get('SELECT * FROM whitelist WHERE product_id = ? AND place_id = ?', [product.id, placeId], (err, whitelist) => {
        if (err) {
          console.error(err);
          return res.status(500).json({ error: 'Server error' });
        }

        if (!whitelist) {
          return res.json({
            valid: true, // Allow by default (pending)
            status: 'pending',
            is_active: true
          });
        }

        res.json({
          valid: whitelist.is_active === 1,
          status: whitelist.status,
          is_active: whitelist.is_active === 1
        });
      });
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get game details from Roblox API
router.get('/game/:placeId', async (req, res) => {
  try {
    const { placeId } = req.params;

    if (!placeId || isNaN(placeId)) {
      return res.status(400).json({ error: 'invalid place id' });
    }

    const [gameDetails, playerCount] = await Promise.all([
      fetchRobloxGameDetails(placeId),
      fetchRobloxPlayerCount(placeId)
    ]);

    res.json({
      ...gameDetails,
      ...playerCount
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get basic analytics for a product
router.get('/analytics/:productKey', async (req, res) => {
  try {
    const { productKey } = req.params;

    db.get('SELECT * FROM products WHERE product_key = ?', [productKey], (err, product) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'Server error' });
      }

      if (!product) {
        return res.status(404).json({ error: 'product not found' });
      }

      // Get stats
      db.get('SELECT COUNT(DISTINCT place_id) as count FROM usage_logs WHERE product_id = ?', [product.id], (err, totalUsers) => {
        if (err) {
          console.error(err);
          return res.status(500).json({ error: 'Server error' });
        }

        db.get('SELECT COUNT(*) as count FROM usage_logs WHERE product_id = ?', [product.id], (err, totalLogs) => {
          if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Server error' });
          }

          db.all(`
            SELECT place_id, game_name, MAX(timestamp) as last_seen
            FROM usage_logs
            WHERE product_id = ?
            GROUP BY place_id
            ORDER BY last_seen DESC
            LIMIT 10
          `, [product.id], async (err, recentLogs) => {
            if (err) {
              console.error(err);
              return res.status(500).json({ error: 'Server error' });
            }

            // Fetch real-time player counts for recent games
            const enhancedRecentActivity = await Promise.all(
              recentLogs.map(async (log) => {
                try {
                  const playerCount = await fetchRobloxPlayerCount(log.place_id);
                  return {
                    ...log,
                    playing: playerCount.playing,
                    maxPlayers: playerCount.maxPlayers
                  };
                } catch (error) {
                  return {
                    ...log,
                    playing: 0,
                    maxPlayers: 0
                  };
                }
              })
            );

            res.json({
              total_users: totalUsers.count,
              total_logs: totalLogs.count,
              recent_activity: enhancedRecentActivity
            });
          });
        });
      });
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get detailed analytics and insights for a product
router.get('/analytics/:productKey/detailed', async (req, res) => {
  try {
    const { productKey } = req.params;

    db.get('SELECT * FROM products WHERE product_key = ?', [productKey], (err, product) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'Server error' });
      }

      if (!product) {
        return res.status(404).json({ error: 'product not found' });
      }

      generateUsageInsights(product.id).then(insights => {
        res.json({
          product: {
            id: product.id,
            name: product.name,
            product_key: product.product_key
          },
          insights: insights
        });
      }).catch(error => {
        console.error('Error generating insights:', error);
        res.status(500).json({ error: 'Server error' });
      });
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Export analytics data for external analysis
router.get('/analytics/:productKey/export', async (req, res) => {
  try {
    const { productKey, format = 'json' } = req.params;

    db.get('SELECT * FROM products WHERE product_key = ?', [productKey], (err, product) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'Server error' });
      }

      if (!product) {
        return res.status(404).json({ error: 'product not found' });
      }

      // Get all usage logs for export
      db.all(`
        SELECT
          timestamp,
          place_id,
          game_name,
          roblox_user_id,
          roblox_username,
          ip_address,
          user_agent
        FROM usage_logs
        WHERE product_id = ?
        ORDER BY timestamp DESC
        LIMIT 10000
      `, [product.id], async (err, logs) => {
        if (err) {
          console.error(err);
          return res.status(500).json({ error: 'Server error' });
        }

        if (format === 'csv') {
          // Convert to CSV
          const csvHeader = 'timestamp,place_id,game_name,roblox_user_id,roblox_username,ip_address,user_agent\n';
          const csvData = logs.map(log =>
            `${log.timestamp},${log.place_id},"${log.game_name}",${log.roblox_user_id || ''},${log.roblox_username || ''},${log.ip_address},"${log.user_agent || ''}"`
          ).join('\n');

          res.setHeader('Content-Type', 'text/csv');
          res.setHeader('Content-Disposition', `attachment; filename="${productKey}_analytics.csv"`);
          res.send(csvHeader + csvData);
        } else {
          // JSON format - enhance with geolocation for recent logs
          const enhancedLogs = await Promise.all(
            logs.slice(0, 100).map(async (log) => {
              try {
                const geo = await getGeolocation(log.ip_address);
                return { ...log, geolocation: geo };
              } catch (error) {
                return { ...log, geolocation: null };
              }
            })
          );

          res.json({
            product: {
              id: product.id,
              name: product.name,
              product_key: product.product_key
            },
            export_date: new Date().toISOString(),
            total_records: logs.length,
            data: enhancedLogs
          });
        }
      });
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get dev logs for all products (for admin/devlogs view)
router.get('/devlogs', authMiddleware, async (req, res) => {
  try {
    // Get all products for the current user
    db.all('SELECT id, name FROM products WHERE user_id = ?', [req.user.id], (err, products) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'Server error' });
      }

      if (products.length === 0) {
        return res.json({ logs: [], products: [] });
      }

      const productIds = products.map(p => p.id);

      // Get usage logs for all user's products
      db.all(`
        SELECT
          ul.*,
          p.name as product_name
        FROM usage_logs ul
        LEFT JOIN products p ON ul.product_id = p.id
        WHERE ul.product_id IN (${productIds.map(() => '?').join(',')})
        ORDER BY ul.timestamp DESC
        LIMIT 1000
      `, productIds, (err, logs) => {
        if (err) {
          console.error(err);
          return res.status(500).json({ error: 'Server error' });
        }

        res.json({
          logs: logs || [],
          products: products || []
        });
      });
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
