# NSCET Appraisal – HoD / VP / Principal / Officers

The appraisal site of the **HoD, Vice Principal, Principal, Secretary, Placement Officer, Placement Co-ordinator, Librarian and
Physical Director**, separate from the staff site (facultysa.nscet.org).

- Each role logs in and fills **its own appraisal** (HoD form per semester, VP / Principal per year, the four officer forms per semester).
  The HoD form has nothing compulsory: a section left empty gets 0 marks.
- **Staff appraisals** are read from the staff site's `UPLOADS` folder on the same server (`<Name> (<code>)/2025-26/form.json` and the
  proofs). This site only reads that folder; it never writes to it, and it never touches the Google Sheet.
- **Review**: HoD → Vice Principal / Principal → Secretary, with marks and remarks per section, the deviation, Proceed / Finalise, and an
  audit log. The HoD sees the submitted staff appraisals of their department.

Logins, own appraisals and review marks are kept in a database: a file `UPLOADS/appraisal.sqlite` by default (Node 22.5 or newer), or the
college MySQL / MariaDB when `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` are set in `.env.local`.

## Install on the college server (beside the staff site)

```bash
cd /var/www && git clone https://github.com/Dharshanbala007/Hod-appraisals.git hod-appraisals
cd /var/www/hod-appraisals && npm install --omit=dev
node server.js
```

The first start creates the tables and prints the logins it made. Stop it (Ctrl+C) and run it as a service, as the staff site is, for
example `pm2 start server.js --name hod-appraisals`. The user that runs it must be able to **read** `/var/www/appraisal-web/UPLOADS`.

Settings (environment variables, all optional):

| Setting | Default | |
|---|---|---|
| `STAFF_UPLOADS` | `../appraisal-web/UPLOADS` | the staff site's UPLOADS folder (read only) |
| `PORT` | `3001` | |
| `UPLOADS_DIR` | `./UPLOADS` | this site's own files: database, proofs of the HoD / VP / Principal / officer forms |

Check: `curl http://localhost:3001/healthz` must show `"ok":true` and `"staffFound":true`.

nginx: give it its own address and pass it to port 3001, with room for 10 MB proofs:

```nginx
server {
    server_name hod.nscet.org;            # the address chosen for this site
    client_max_body_size 12m;
    location / { proxy_pass http://127.0.0.1:3001; proxy_set_header Host $host; proxy_set_header X-Forwarded-Proto $scheme; }
}
```

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
