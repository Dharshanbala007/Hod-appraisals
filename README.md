# NSCET Appraisal – HoD / VP / Principal / Officers

The appraisal site of the **HoD, Vice Principal, Principal, Secretary, Placement Officer, Placement Co-ordinator, Librarian and
Physical Director**, separate from the staff site (facultysa.nscet.org).

- Each role logs in and fills **its own appraisal** (HoD form per semester, VP / Principal per year, the four officer forms per semester).
  The HoD form has nothing compulsory: a section left empty gets 0 marks.
- **Staff appraisals** are read from the staff site's `UPLOADS` folder on the same server (`<Name> (<code>)/2025-26/form.json` and the
  proofs). This site only reads that folder; it never writes to it, and it never touches the Google Sheet.
- **Review**: HoD → Vice Principal / Principal → Secretary, with marks and remarks per section, the deviation, Proceed / Finalise, and an
  audit log. The HoD sees the submitted staff appraisals of their department.

Logins, own appraisals and review marks are kept in a database: **MySQL / MariaDB** on the server (see [Database](#database-on-the-server)),
or, without database settings, a file `UPLOADS/appraisal.sqlite` (needs Node 22.13 or newer; fine for trying it out).

## Install on the college server (beside the staff site)

```bash
cd /var/www && git clone https://github.com/Dharshanbala007/Hod-appraisals.git hod-appraisals
cd /var/www/hod-appraisals && npm install --omit=dev
```

Set up the [database](#database-on-the-server), then run `node server.js`. The first start creates any missing tables and prints the
logins it made. Stop it (Ctrl+C) and run it as a service, as the staff site is, for
example `pm2 start server.js --name hod-appraisals`. The user that runs it must be able to **read** `/var/www/appraisal-web/UPLOADS`.

Settings (environment variables, all optional):

| Setting | Default | |
|---|---|---|
| `STAFF_UPLOADS` | `../appraisal-web/UPLOADS` | the staff site's UPLOADS folder (read only) |
| `PORT` | `3001` | |
| `UPLOADS_DIR` | `./UPLOADS` | this site's own files: database, proofs of the HoD / VP / Principal / officer forms |

Check: `curl http://localhost:3001/healthz` must show `"ok":true` and `"staffFound":true`.

### The address: appraisal.nscet.org

It must be the **same server** as facultysa.nscet.org, because the staff appraisals are read from that site's folder.

1. DNS: add an `A` record `appraisal` → the server's public IP (the same IP as `facultysa`).
2. nginx: create `/etc/nginx/sites-available/appraisal.nscet.org` (port 3001, room for 10 MB proofs):
   ```nginx
   server {
       listen 80;
       server_name appraisal.nscet.org;
       client_max_body_size 12m;
       location / {
           proxy_pass http://127.0.0.1:3001;
           proxy_set_header Host $host;
           proxy_set_header X-Forwarded-Proto $scheme;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
       }
   }
   ```
   then switch it on:
   ```bash
   sudo ln -s /etc/nginx/sites-available/appraisal.nscet.org /etc/nginx/sites-enabled/ && sudo nginx -t && sudo systemctl reload nginx
   ```
3. HTTPS (once DNS points to the server): `sudo certbot --nginx -d appraisal.nscet.org`.

Open https://appraisal.nscet.org: the login page must appear. Logins then get a secure cookie over HTTPS by themselves.

## Database on the server

Do this once, before the first start. The tables are in [`schema.sql`](schema.sql): `accounts`, `appraisals`, `review_marks`,
`review_notes`, `audit_log` (the comments at its top say what each holds).

1. A database server. Check with `mysql --version`; if there is none, install MariaDB (MySQL-compatible):
   ```bash
   sudo apt update && sudo apt install -y mariadb-server && sudo systemctl enable --now mariadb
   ```
2. The database and a user for this site only. Open `sudo mysql` and run, with a strong password of your own instead of `CHANGE-ME`:
   ```sql
   CREATE DATABASE nscet_appraisal CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   CREATE USER 'appraisal'@'localhost' IDENTIFIED BY 'CHANGE-ME';
   GRANT ALL PRIVILEGES ON nscet_appraisal.* TO 'appraisal'@'localhost';
   FLUSH PRIVILEGES;
   EXIT;
   ```
3. The tables (the site also makes them itself on its first start; doing it here lets you check them first):
   ```bash
   cd /var/www/hod-appraisals && mysql -u appraisal -p nscet_appraisal < schema.sql
   ```
4. Tell the site where the database is: create `/var/www/hod-appraisals/.env.local` (never committed; keep it private with
   `chmod 600 .env.local`):
   ```
   DB_HOST=localhost
   DB_PORT=3306
   DB_USER=appraisal
   DB_PASSWORD=CHANGE-ME
   DB_NAME=nscet_appraisal
   ```
5. Start (or restart) the site. `curl http://localhost:3001/healthz` must now show `"storage":"mysql"`, and the first start prints the
   logins it made.

Backups: the database (`mysqldump -u appraisal -p nscet_appraisal > hod-appraisals-$(date +%F).sql`) and the folder
`/var/www/hod-appraisals/UPLOADS` (the proofs of the HoD / VP / Principal / officer forms). The staff files stay with the staff site.

If the tables in `db.js` change, make the file again with `node db-setup.js --sql > schema.sql` (`node test.js` fails until they match).

## Logins

The first start makes one login per HoD and role, each with a **one-time password**; everyone chooses their own password at the first login.

| Username | One-time password |
|---|---|
| `hodcse`, `hodaids`, `hodit`, `hodeee`, `hodece`, `hodmech`, `hodcivil`, `hodsh` | `hod@nscet` |
| `vp`, `principal`, `secretary`, `po`, `pc`, `librarian`, `pd` | `<username>@nscet` (e.g. `principal@nscet`) |

More logins, forgotten passwords:

```bash
node accounts.js list
node accounts.js add hod CSE hodcse2 "Dr. A. Kumar"
node accounts.js reset hodcse
node accounts.js disable hodcse
```

## Tests

`node test.js` – scoring rules, logins, staff appraisals read from a pretend staff folder (checked untouched), the review chain and the
own appraisals, on a temporary database.

While the forms are being validated, `FORMS_PREVIEW=1` (or a Render deploy) shows only the seven forms, filled in the browser and never saved.
