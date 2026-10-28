// The logins (run on the server by the administrator). Staff do not log in here: they use the staff site with their faculty code.
// On the first start the site makes one login per HoD and role with a one-time password (auth.js DEFAULT_LOGINS); this command adds more,
// replaces them or resets a forgotten password:
//     node accounts.js add hod <DEPT> <username> "<Full name>"          e.g.  node accounts.js add hod CSE hodcse "Dr. A. Kumar"
//     node accounts.js add <role> <username> "<Full name>"              role: vp, principal, secretary, po (Placement Officer),
//                                                                       pc (Placement Co-ordinator), librarian, pd (Physical Director)
//     node accounts.js list
//     node accounts.js reset <username>          give a new one-time password (forgotten password)
//     node accounts.js disable <username>        the login stops working (enable <username> to undo)
// The password is typed at a hidden prompt (at least 8 characters) and stored only as a scrypt hash. It is a one-time password: the owner
// must choose their own at the first login. One active HoD login per department.
const readline = require('readline');
const C = require('./public/config.js'), db = require('./db.js'), A = require('./auth.js');
const USER_RE = /^[A-Za-z0-9._-]{3,40}$/;
const [cmd, ...args] = process.argv.slice(2);
const fail = m => { console.log(m); process.exitCode = 1; };
const usage = () => fail('usage:\n  node accounts.js add hod <DEPT> <username> "<Full name>"\n  node accounts.js add vp|principal|secretary|po|pc|librarian|pd <username> "<Full name>"\n  node accounts.js list | reset <username> | disable <username> | enable <username>');

// hidden typing on a terminal; from a pipe the lines are read in order (scripts, tests)
let piped;
const ask = prompt => new Promise(resolve => {
  if (!process.stdin.isTTY) {
    const next = () => resolve(piped.shift() || '');
    if (piped) return next();
    let s = ''; process.stdin.on('data', c => { s += c; }); process.stdin.on('end', () => { piped = s.split(/\r?\n/); next(); }); return;
  }
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  process.stdout.write(prompt); rl._writeToOutput = () => {};                      // nothing is echoed while typing
  rl.question('', a => { rl.close(); process.stdout.write('\n'); resolve(a); });
});
async function newPassword() {
  const pw = await ask('One-time password (at least 8 characters): ');
  if (pw.length < 8 || pw.length > 100) throw Object.assign(new Error('The password must have 8 to 100 characters.'), { plain: true });
  if (process.stdin.isTTY && await ask('Type it again: ') !== pw) throw Object.assign(new Error('The two passwords do not match.'), { plain: true });
  return pw;
}

(async () => {
  try {
    if (cmd === 'add') {
      const role = args[0]; if (!A.ROLES.includes(role)) return usage();
      const dept = role === 'hod' ? C.deptOf(args[1]) : null, [username, name = ''] = args.slice(role === 'hod' ? 2 : 1);
      if (role === 'hod' && !dept) return fail(`The department must be one of: ${C.DEPARTMENTS.join(', ')}`);
      if (!USER_RE.test(username || '')) return fail('The username must have 3 to 40 letters, numbers, dots, dashes or underscores.');
      if (!name.trim()) return fail('Give the full name in quotes, e.g. "Dr. A. Kumar".');
      await db.setup();
      if (await db.findAccount(username)) return fail(`The username "${username}" already exists.`);
      const other = role === 'hod' && await db.activeHod(dept);
      if (other) return fail(`${dept} already has an active HoD login (${other.username}). Disable it first: node accounts.js disable ${other.username}`);
      await db.addAccount({ username, name: name.trim().slice(0, 100), role, dept, passwordHash: await A.hash(await newPassword()) });
      await db.audit('administrator', 'account added', null, `${username}: ${A.ROLE_NAME[role]}${dept ? ' ' + dept : ''}`);
      console.log(`Added: ${A.ROLE_NAME[role]}${dept ? ' of ' + dept : ''}, ${name.trim()} (username ${username}). They choose their own password at the first login.`);
    } else if (cmd === 'list') {
      await db.setup();
      const rows = await db.listAccounts();
      if (!rows.length) return console.log('No logins yet. Add one with: node accounts.js add ...');
      for (const r of rows) console.log(`${r.username.padEnd(16)} ${(A.ROLE_NAME[r.role] + (r.dept ? ' ' + r.dept : '')).padEnd(16)} ${r.name}${r.active ? '' : '   (disabled)'}${r.must_change ? '   (one-time password not changed yet)' : ''}`);
    } else if (cmd === 'reset' || cmd === 'disable' || cmd === 'enable') {
      const acc = args[0] && await db.findAccount(args[0]); if (!acc) return fail(`No login with the username "${args[0] || ''}".`);
      if (cmd === 'reset') { await db.setPassword(acc.username, await A.hash(await newPassword()), true); console.log(`New one-time password set for ${acc.username}.`); }
      else {
        const other = cmd === 'enable' && acc.role === 'hod' && await db.activeHod(acc.dept);
        if (other && other.username !== acc.username) return fail(`${acc.dept} already has an active HoD login (${other.username}). Disable it first.`);
        await db.setActive(acc.username, cmd === 'enable'); console.log(`${acc.username}: login ${cmd === 'enable' ? 'enabled' : 'disabled'}.`);
      }
      await db.audit('administrator', 'account ' + cmd, null, acc.username);
    } else usage();
  } catch (e) { if (e.plain) fail(e.message); else { console.error('Could not reach the database:', e.message); process.exitCode = 1; } }
  finally { await db.close(); }
})();
