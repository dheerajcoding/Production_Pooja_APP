# Saral Pooja – Deployment Guide (Ubuntu VPS)

## Prerequisites

- Ubuntu 22.04 VPS (min 2GB RAM, 20GB disk)
- Domain pointed to server IP
- Node.js 20+ installed
- PM2 installed globally: `npm install -g pm2`
- Nginx installed
- MongoDB Atlas cluster ready
- Razorpay account (live or test keys)

---

## Step 1 – Clone & Configure

```bash
cd /var/www
git clone <your-repo-url> saral-pooja
cd saral-pooja

# Copy and fill in your env vars
cp backend/.env.example backend/.env
nano backend/.env
```

Fill in all values in `backend/.env`:
- `MONGO_URI` – MongoDB Atlas connection string
- `JWT_SECRET` – Random 64-char string (generate: `openssl rand -hex 32`)
- `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` – From Razorpay dashboard
- `SMTP_*` – Gmail App Password or any SMTP provider
- `FRONTEND_URL` – https://yourdomain.com

---

## Step 2 – Install Backend Dependencies

```bash
cd /var/www/saral-pooja/backend
npm install --production
```

---

## Step 3 – Create Uploads Folder & Set Permissions

```bash
mkdir -p /var/www/saral-pooja/backend/uploads/profiles
mkdir -p /var/www/saral-pooja/backend/uploads/poojas

# Give Nginx read access to serve images directly
chmod -R 755 /var/www/saral-pooja/backend/uploads
chown -R www-data:www-data /var/www/saral-pooja/backend/uploads
```

---

## Step 4 – Build Frontend

```bash
cd /var/www/saral-pooja/frontend

# Create frontend env
echo "VITE_API_URL=/api" > .env.production

npm install
npm run build
```

---

## Step 5 – Seed Admin User

```bash
cd /var/www/saral-pooja/backend
node utils/seedAdmin.js
```

This creates the admin using `ADMIN_EMAIL` and `ADMIN_PASSWORD` from `.env`.

---

## Step 6 – Start with PM2

```bash
cd /var/www/saral-pooja
mkdir -p /var/log/pm2

pm2 start ecosystem.config.js
pm2 save
pm2 startup   # follow the printed command to enable auto-start on reboot

# View logs
pm2 logs saral-pooja-api
```

---

## Step 7 – Configure Nginx

```bash
# Edit domain name in nginx.conf
nano /var/www/saral-pooja/nginx.conf
# Replace "yourdomain.com" with your actual domain

sudo cp /var/www/saral-pooja/nginx.conf /etc/nginx/sites-available/saral-pooja
sudo ln -s /etc/nginx/sites-available/saral-pooja /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

sudo nginx -t
sudo systemctl reload nginx
```

---

## Step 8 – SSL with Let's Encrypt

```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
sudo systemctl reload nginx
```

---

## Image Storage Info

Images are stored on the VPS at:
```
/var/www/saral-pooja/backend/uploads/
├── profiles/   ← user & pandit profile photos
└── poojas/     ← pooja listing images
```

They are served directly by Nginx (fast) at:
```
https://yourdomain.com/uploads/profiles/<filename>
https://yourdomain.com/uploads/poojas/<filename>
```

### Backup Images (Important!)
Add a cron job to backup images regularly:
```bash
# Daily backup to a backup folder
crontab -e
# Add this line:
0 2 * * * tar -czf /var/backups/saral-pooja-uploads-$(date +\%F).tar.gz /var/www/saral-pooja/backend/uploads/
```

---

## Useful Commands

```bash
# View backend logs
pm2 logs saral-pooja-api

# Restart backend
pm2 restart saral-pooja-api

# Deploy updates (after git push)
cd /var/www/saral-pooja
git pull
cd backend && npm install --production
cd ../frontend && npm run build
pm2 restart saral-pooja-api

# Monitor memory/CPU
pm2 monit
```

---

## Disk Space Monitoring

```bash
# Check disk usage
df -h

# Check uploads folder size
du -sh /var/www/saral-pooja/backend/uploads/
```

For 100 users, expect uploads folder to grow ~50-200MB over time (profile photos + pooja images).

---

## Environment Variables Reference

| Variable | Description |
|---|---|
| `MONGO_URI` | MongoDB Atlas connection string |
| `JWT_SECRET` | Min 32-char random string |
| `JWT_EXPIRES_IN` | Token expiry (default: 7d) |
| `RAZORPAY_KEY_ID` | Razorpay live key ID |
| `RAZORPAY_KEY_SECRET` | Razorpay key secret |
| `SMTP_HOST` | SMTP server (e.g. smtp.gmail.com) |
| `SMTP_PORT` | 587 for TLS, 465 for SSL |
| `SMTP_USER` | SMTP username/email |
| `SMTP_PASS` | App Password (Gmail: Settings → Security → App Passwords) |
| `FROM_EMAIL` | From email address |
| `FROM_NAME` | Display name for emails |
| `FRONTEND_URL` | https://yourdomain.com |
| `ADMIN_EMAIL` | Admin email (for seeding) |
| `ADMIN_PASSWORD` | Admin initial password |

---

## Firewall Setup

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
sudo ufw status
```

---

## Post-Deployment Checklist

- [ ] Admin logs in at `/login`
- [ ] Admin creates poojas at `/admin/poojas` (with image upload)
- [ ] User registers, browses, and books a pooja
- [ ] Razorpay payment completes successfully
- [ ] Pandit registration + admin approval works
- [ ] Profile photo upload works and image is visible
- [ ] Forgot password email is received
- [ ] SSL certificate active (https padlock)
- [ ] PM2 restarts backend on server reboot
- [ ] Uploads folder backup cron is set
