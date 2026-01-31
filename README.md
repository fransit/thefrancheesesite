# 🧀 FranCheese Secure - Roblox Licensing Platform

A modern licensing platform for Roblox developers to protect and track their scripts/assets.

## Features

- **User Authentication** - Register/Login system with JWT tokens
- **Product Management** - Create and manage multiple products
- **Whitelist System** - Control which games can use your scripts
  - 🟠 Orange = Pending (not yet confirmed)
  - 🟢 Green = Whitelisted
  - 🔴 Red = Unwhitelisted
- **Usage Tracking** - See which games are using your scripts
- **ON/OFF Toggle** - Enable/disable scripts for specific games
- **Auto-generated Lua Scripts** - Ready-to-use scripts for Roblox

## Installation

### Prerequisites
- Node.js 18+ installed
- npm or yarn

### Setup

1. **Navigate to project folder**
   ```bash
   cd francheese-secret
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the server**
   ```bash
   npm start
   ```

4. **Open in browser**
   ```
   http://localhost:3000
   ```

## Deployment to Vercel

### Database Setup (Required)
This app requires a PostgreSQL database. We recommend using [Neon](https://neon.tech):

1. Create a Neon account and project
2. Get your database connection string
3. Add `DATABASE_URL` environment variable in Vercel settings

See [NEON_SETUP.md](NEON_SETUP.md) for detailed instructions.

### Deploy Steps
1. Push code to GitHub
2. Connect repository to Vercel
3. Add `DATABASE_URL` environment variable
4. Deploy!

## Usage

### For Sellers/Developers

1. **Register** an account at `/register`
2. **Login** at `/` (or `/login`)
3. **Go to Dashboard** at `/panel`
4. **Create a Product** - Click "Add Product" and enter a name
5. **Copy the Lua Script** - The script will be shown after creating a product
6. **Share with Customers** - Give them the script to use in their games

### For Roblox Studio

1. **Enable HTTP Requests**
   - Go to Game Settings > Security
   - Enable "Allow HTTP Requests"

2. **Add the Script**
   - Create a new Script in `ServerScriptService`
   - Paste the provided Lua script

3. **Update the API URL**
   - Change `API_URL` in the script to your server URL
   - For local testing: `http://localhost:3000/api/tracking`
   - For production: `https://your-domain.com/api/tracking`

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user

### Products
- `GET /api/products` - Get all products
- `POST /api/products` - Create product
- `GET /api/products/:id` - Get single product
- `DELETE /api/products/:id` - Delete product
- `GET /api/products/:id/script` - Get Lua script
- `GET /api/products/:id/users` - Get product users

### Whitelist
- `GET /api/whitelist/product/:productId` - Get whitelist
- `POST /api/whitelist/product/:productId` - Add to whitelist
- `PATCH /api/whitelist/toggle/:productId/:placeId` - Toggle ON/OFF
- `PATCH /api/whitelist/status/:productId/:placeId` - Update status

### Tracking (For Roblox Scripts)
- `POST /api/tracking/log` - Log usage (from Roblox)
- `GET /api/tracking/check/:productKey/:placeId` - Check license

## Production Deployment

### Option 1: Railway/Render/Heroku

1. Push to GitHub
2. Connect to Railway/Render/Heroku
3. Set environment variables:
   ```
   JWT_SECRET=your-super-secret-key
   PORT=3000
   ```
4. Deploy!

### Option 2: VPS (DigitalOcean, Linode, etc.)

1. Install Node.js on server
2. Clone/upload project
3. Install PM2: `npm install -g pm2`
4. Start server: `pm2 start server/index.js --name francheese`
5. Setup Nginx as reverse proxy (optional)

### Important for Production

1. **Change JWT_SECRET** - Set a strong secret key
2. **Use HTTPS** - Required for secure connections
3. **Update Lua Script** - Change API_URL to your production URL
4. **Backup Database** - The `francheese.db` file is your database

## File Structure

```
francheese-secret/
├── server/
│   ├── index.js          # Main server
│   ├── database.js       # SQLite setup
│   ├── routes/
│   │   ├── auth.js       # Authentication
│   │   ├── products.js   # Products CRUD
│   │   ├── whitelist.js  # Whitelist management
│   │   └── tracking.js   # Roblox tracking
│   └── middleware/
│       └── auth.js       # JWT middleware
├── public/
│   ├── index.html        # Login page
│   ├── register.html     # Register page
│   ├── panel.html        # Dashboard
│   ├── css/
│   │   └── style.css     # Styles
│   └── js/
│       ├── auth.js       # Auth helpers
│       └── panel.js      # Dashboard logic
├── package.json
└── README.md
```

## How the Licensing Works

1. **Product Creation** → Generates unique product key
2. **Script Distribution** → Customer adds script to their game
3. **Script Execution** → Script sends Place ID + Game Name to API
4. **Auto-Registration** → New games appear as "Pending" (orange)
5. **Manual Review** → Seller can whitelist/unwhitelist
6. **ON/OFF Control** → Seller can disable specific games

### Whitelist Status Flow

```
New Game Uses Script → Pending (Orange)
                           ↓
        Seller Reviews → Whitelisted (Green) or Unwhitelisted (Red)
                           ↓
        Seller can also → Toggle ON/OFF for any game
```

## Support

If you have issues:
1. Make sure HTTP requests are enabled in Roblox
2. Check the server URL in the Lua script
3. Look at the browser console for errors
4. Check server logs for API errors

---

Made with 🧀 by FranCheese Secret
