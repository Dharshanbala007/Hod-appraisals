// Settings, as KEY=value lines: `.env.local` (never committed: the database password, the session secret) and `.env` (the Google Sheet).
// Real environment variables win, then .env.local, then .env. Loaded once by everything that needs settings.
const fs = require('fs'), path = require('path');
for (const f of ['.env.local', '.env']) {
  try {
    for (const line of fs.readFileSync(path.join(__dirname, f), 'utf8').split(/\r?\n/)) {
      const m = /^\s*([A-Za-z_]\w*)\s*=\s*(.*?)\s*$/.exec(line);
      if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^(["'])(.*)\1$/, '$2');
    }
  } catch { /* no such file: use the real environment */ }
}
