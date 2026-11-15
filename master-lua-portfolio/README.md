# Master Lua Portfolio

A responsive, editable portfolio website with a cinematic motion layer and a secure admin panel. Built with **plain HTML, CSS, JavaScript, and Node.js**, with **zero third-party dependencies**.

## Quick start

1. Install [Node.js 20+](https://nodejs.org/) if necessary.
2. Open a terminal in this folder.
3. Run `npm start`.
4. Open **http://localhost:3000** for your portfolio.
5. Open **http://localhost:3000/admin** for the administration dashboard.

**Initial admin password:** `abhinavks2010` (as requested). For safety, change it immediately through **Admin → Security**, particularly before publishing online. The password itself is **not present in client-side source code**; only a salted PBKDF2 password hash is stored in `data/auth.json`.

No `npm install` is needed because the project uses only Node's built-in libraries.

### Windows startup

```powershell
cd path\to\master-lua-portfolio
npm start
```

### Changing content

From `/admin`, you can edit all major text, colors, projects, featured tags, skills, services, social links, and email. You can upload project images up to 5 MB or paste an external image URL. Click **Save changes** to publish updates. The public site fetches your latest saved content automatically on page load.

### Motion effects (new)

The public website now includes a motion design layer that uses **no external JavaScript libraries**:

- Short cinematic progress-screen intro on the first visit per browser tab. Press **Escape** to skip it.
- Staggered, word-by-word hero and contact heading animation.
- Animated marquee reading **BUILD / PLAY / CREATE / REPEAT**, with hover-to-pause.
- Interactive depth and lighting on project images; pointer-responsive hero showcase.
- Magnetic action buttons, animated click ripples, and a decorative custom pointer halo on desktop.
- Scroll progress line, scroll-triggered section reveals, skill badge cascades, animated stars, and count-up stats.
- Mobile-friendly motion adjustments; **reduced-motion accessibility** support disables nonessential animation.

**Where to edit the effects:** `public/motion.css` contains the CSS animations and `public/motion.js` holds the interactive behavior. Disable the two files in `public/index.html` if you prefer the original static design. The admin dashboard and its authentication are unchanged.

### Security and deployment

- Login is verified on the **server**, not the browser.
- Passwords use salted **PBKDF2-SHA256**; sessions use unpredictable, HTTP-only cookies.
- Password update automatically revokes previous sessions; failed logins are rate-limited.
- Site updates and uploads require an authenticated session and CSRF token.
- Only PNG, JPEG, WebP, AVIF, and GIF image uploads are allowed (5 MB limit).
- Password and content are stored as files in `data/`; keep this folder writable and backed up.
- The initial password is known from the original request; **replace it before public deployment**.
- This simple JSON file store is suitable for a personal portfolio running as a **single Node process**, not serverless hosting or multi-instance clustering.
- For internet deployment, use **HTTPS with a reverse proxy**, set `COOKIE_SECURE=1`, and set `HOST=0.0.0.0` if your host requires it. Restrict access to the data directory.
- Do not commit `data/auth.json` to a public Git repository. It is listed in `.gitignore`.
- Production deployments should use a trusted platform that provides HTTPS and persistent disk storage.

Example with environment variables:

```bash
HOST=0.0.0.0 PORT=3000 COOKIE_SECURE=1 npm start
```

### Resetting the password if needed

Stop the server. Move `data/auth.json` somewhere safe, then start the app **once** with `ADMIN_PASSWORD` set to your chosen password (at least 12 characters). A new hash file will be created; unset `ADMIN_PASSWORD` afterward. Keep a backup of your previous hash if you want a rollback.

### Folder guide

- `public/index.html`, `styles.css`, `app.js` — public portfolio
- `public/motion.css`, `motion.js` — optional animation effects
- `public/admin.html`, `admin.css`, `admin.js` — admin dashboard
- `public/assets` — illustration assets and favicon
- `public/uploads` — uploaded project cover images
- `data/site.json` — editable website content
- `data/auth.json` — salted admin password hash (keep private)
- `server.mjs` — authenticated API and static file server

### Design reference

Inspired by the provided Pretzz Portfolio Figma Make link. That reference was not accessible for exact visual inspection, so this is an original, polished reinterpretation rather than a guaranteed pixel-perfect reproduction. Replace the placeholder email and social profile URLs in `/admin` before sharing.
