# 🍽 QR Scanner Business — Pani Puri Free Plate Offer

A secure QR-code-based free offer campaign app with 4 layers of fraud protection.

---

## ⚡ Quick Start

### 1. Install dependencies (first time only)
```bash
npm install
```

### 2. Start the project
```bash
npm run dev
```

This starts **both** servers at once:
| Server | URL |
|---|---|
| 🌐 Frontend (Vite) | http://localhost:5173 |
| 🔧 Backend (Express API) | http://localhost:4000 |

---

## 🛠 How to Use

### Step 1 — Open the Admin Panel
```
http://localhost:5173/admin.html
```
Login with admin key: **`admin-secret-2024`**

### Step 2 — Generate a QR Code
- Set **Max Claims** (how many people can use this QR)
- Click **Generate QR Code**
- You'll get a unique URL + scannable QR image

### Step 3 — Customer Scans QR
- Customer scans → lands on `/?token=...`
- Fills in Name + Mobile → clicks **Claim Offer**

### Step 4 — View Claims
- Go back to Admin Panel → see all claims in the table

---

## 🔒 Security Layers

| Protection | What It Blocks |
|---|---|
| **QR Token** | Direct access without scanning the real QR |
| **Device Fingerprint** | Same phone/browser claiming twice |
| **Database Record** | Same mobile number used again |
| **IP Rate Limit** | Max 3 attempts per IP per 15 minutes |

---

## 📁 Project Structure

```
QrScaneer_business-master/
├── index.html          ← Customer claim page
├── admin.html          ← Admin panel (generate QR, view claims)
├── script.js           ← Frontend logic + device fingerprint
├── style.css           ← Styles
├── vite.config.js      ← Vite config (proxies /api → Express)
├── package.json        ← npm scripts & dependencies
├── server/
│   ├── index.js        ← Express API (all 4 security checks)
│   └── db.js           ← JSON file database (lowdb)
└── data/
    └── offers.json     ← Database file (auto-created)
```

---

## 📜 Available Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start frontend + backend together ✅ |
| `npm run server` | Start backend only (port 4000) |
| `npm run build` | Build frontend for production |
| `npm run preview` | Preview production build |

---

## ⚙️ Configuration

### Change the Admin Key
Set the `ADMIN_KEY` environment variable before starting:
```bash
# Windows (PowerShell)
$env:ADMIN_KEY="your-secret-key"; npm run dev

# Linux / Mac
ADMIN_KEY=your-secret-key npm run dev
```

### Change the Port
Edit `vite.config.js` to change the frontend port (default: 5173).  
Edit `server/index.js` to change the API port (default: 4000).

---

## 🚀 Production Deployment

1. Build the frontend:
   ```bash
   npm run build
   ```
2. Set a strong `ADMIN_KEY` environment variable
3. Serve the `dist/` folder via Nginx / Apache
4. Run `node server/index.js` as a background service (e.g. with PM2)
