const path = require('path');
const crypto = require('crypto');
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 8080;
// 关键：JWT_SECRET 必须固定！否则每次重启/部署 token 全部失效
// 环境变量优先，否则用内置固定密钥（保证部署重启后登录态不丢）
const JWT_SECRET = process.env.JWT_SECRET || 'admin-workbench-v1-secret-2026-do-not-leak';

// 数据库路径：优先用环境变量，否则用项目目录下的 data/
// 云端部署时建议设置 DB_PATH=/var/data/workbench.sqlite 并挂载持久盘
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'workbench.sqlite');
// 备份路径：始终在项目目录下，防止SQLite文件丢失
const BACKUP_DIR = path.join(__dirname, 'data', 'backups');
const BACKUP_JSON = path.join(BACKUP_DIR, 'latest-backup.json');

// 确保目录存在
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
fs.mkdirSync(BACKUP_DIR, { recursive: true });

const db = new sqlite3.Database(DB_PATH);

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS module_data (
      user_id INTEGER NOT NULL,
      module TEXT NOT NULL,
      data_json TEXT NOT NULL DEFAULT '[]',
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, module),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
});

// ========== 数据持久化保险：JSON 备份/恢复 ==========
// 作用：即使 SQLite 文件丢了（Render 免费版磁盘是临时的），数据也能从 JSON 恢复
function backupToJson() {
  return new Promise((resolve) => {
    const data = { users: {}, modules: {}, backupAt: new Date().toISOString() };
    db.all('SELECT id, username, password_hash, created_at FROM users', (e, users) => {
      if (e || !users.length) { resolve(false); return; }
      users.forEach(u => { data.users[u.username] = u; });
      db.all('SELECT user_id, username, module, data_json, updated_at FROM module_data md JOIN users u ON md.user_id = u.id', (e2, rows) => {
        if (e2 || !rows) { resolve(false); return; }
        rows.forEach(r => {
          if (!data.modules[r.username]) data.modules[r.username] = {};
          data.modules[r.username][r.module] = { data_json: r.data_json, updated_at: r.updated_at };
        });
        try {
          fs.writeFileSync(BACKUP_JSON, JSON.stringify(data, null, 2), 'utf8');
          console.log('[备份] SQLite 已备份到 JSON:', Object.keys(data.users).length, '个用户');
          resolve(true);
        } catch (err) {
          console.error('[备份失败]', err.message);
          resolve(false);
        }
      });
    });
  });
}

function restoreFromJson() {
  try {
    if (!fs.existsSync(BACKUP_JSON)) return false;
    const raw = fs.readFileSync(BACKUP_JSON, 'utf8');
    if (!raw || raw.length < 50) return false;
    const data = JSON.parse(raw);
    if (!data.users || !Object.keys(data.users).length) return false;

    console.log('[恢复] 检测到 JSON 备份，开始恢复...');
    let restoredUsers = 0, restoredModules = 0;

    const restoreOne = (username, hash, createdAt, cb) => {
      db.get('SELECT id FROM users WHERE username=?', [username], (e, row) => {
        if (row) { cb(null, row.id); return; }
        db.run('INSERT INTO users (id, username, password_hash, created_at) VALUES (?,?,?,?)',
          [data.users[username].id, username, hash, createdAt],
          function(e2) { cb(e2, data.users[username].id); });
      });
    };

    const names = Object.keys(data.users);
    let idx = 0;
    const doNext = () => {
      if (idx >= names.length) {
        console.log(`[恢复] 完成：${restoredUsers}个用户，${restoredModules}条模块数据`);
        return;
      }
      const uname = names[idx++];
      const u = data.users[uname];
      restoreOne(uname, u.password_hash, u.created_at, (e, uid) => {
        if (!e) restoredUsers++;
        const mods = (data.modules && data.modules[uname]) || {};
        const modNames = Object.keys(mods);
        let mIdx = 0;
        const nextMod = () => {
          if (mIdx >= modNames.length) { doNext(); return; }
          const mod = modNames[mIdx++];
          const md = mods[mod];
          db.run('INSERT OR REPLACE INTO module_data (user_id, module, data_json, updated_at) VALUES (?,?,?,?)',
            [uid, mod, md.data_json, md.updated_at],
            (e2) => { if (!e2) restoredModules++; nextMod(); });
        };
        nextMod();
      });
    };
    doNext();
    return true;
  } catch (e) {
    console.error('[恢复失败]', e.message);
    return false;
  }
}

// 启动时：如果SQLite是空的（新部署），尝试从JSON恢复
db.get('SELECT COUNT(*) AS c FROM users', (e, row) => {
  if (row && row.c === 0) restoreFromJson();
});
// 定时备份：每小时一次
setInterval(backupToJson, 60 * 60 * 1000);
// 每次保存数据后也备份（轻量，因为数据量小）

app.use(express.json({ limit: '20mb' }));

// CORS：支持桌面 file:// 打开时跨域访问（Origin 可能是 null）
app.use((req, res, next) => {
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Allow-Credentials', 'false');
  res.setHeader('Access-Control-Max-Age', '86400');
  // 预检请求直接通过，不进后面的业务中间件
  if (req.method === 'OPTIONS') return res.status(204).end();
  next();
});

// 禁用缓存，确保每次都加载最新代码
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  next();
});

app.use(express.static(__dirname));

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function signToken(user) {
  return jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '30d' });
}

function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return res.status(401).json({ error: '请先登录' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (err) {
    return res.status(401).json({ error: '登录已过期，请重新登录' });
  }
}

async function authHandler(req, res, mode) {
  try {
    const username = String(req.body.username || '').trim();
    const password = String(req.body.password || '');
    if (!username || !password) {
      return res.status(400).json({ error: '账号和密码不能为空' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: '密码至少 6 位' });
    }

    const existing = await get('SELECT * FROM users WHERE username = ?', [username]);
    if (mode === 'register') {
      if (existing) return res.status(409).json({ error: '账号已存在，请直接登录' });
      const passwordHash = await bcrypt.hash(password, 10);
      const result = await run('INSERT INTO users (username, password_hash) VALUES (?, ?)', [username, passwordHash]);
      const user = { id: result.lastID, username };
      setImmediate(backupToJson);
      return res.json({ token: signToken(user), user });
    }

    if (!existing) return res.status(401).json({ error: '账号或密码不正确' });
    const ok = await bcrypt.compare(password, existing.password_hash);
    if (!ok) return res.status(401).json({ error: '账号或密码不正确' });
    return res.json({ token: signToken(existing), user: { id: existing.id, username: existing.username } });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: '服务器错误' });
  }
}

app.post('/api/auth/register', (req, res) => authHandler(req, res, 'register'));
app.post('/api/auth/login', (req, res) => authHandler(req, res, 'login'));

app.get('/api/me', auth, (req, res) => {
  res.json({ user: { id: req.user.id, username: req.user.username } });
});

app.get('/api/data', auth, async (req, res) => {
  try {
    const rows = await all('SELECT module, data_json FROM module_data WHERE user_id = ?', [req.user.id]);
    const result = { tasks: null, todos: null, phone: null, visa: null };
    rows.forEach(row => {
      try {
        result[row.module] = JSON.parse(row.data_json || '[]');
      } catch {
        result[row.module] = [];
      }
    });
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '读取数据失败' });
  }
});

app.post('/api/data/bulk', auth, async (req, res) => {
  try {
    const modules = ['tasks', 'todos', 'phone', 'visa'];
    for (const module of modules) {
      if (!Array.isArray(req.body[module])) continue;
      await run(
        `INSERT INTO module_data (user_id, module, data_json, updated_at)
         VALUES (?, ?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(user_id, module)
         DO UPDATE SET data_json = excluded.data_json, updated_at = CURRENT_TIMESTAMP`,
        [req.user.id, module, JSON.stringify(req.body[module])]
      );
    }
    setImmediate(backupToJson);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '批量保存失败' });
  }
});

app.post('/api/data/:module', auth, async (req, res) => {
  try {
    const module = req.params.module;
    if (!['tasks', 'todos', 'phone', 'visa'].includes(module)) {
      return res.status(400).json({ error: '未知模块' });
    }
    const data = Array.isArray(req.body.data) ? req.body.data : [];
    await run(
      `INSERT INTO module_data (user_id, module, data_json, updated_at)
       VALUES (?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(user_id, module)
       DO UPDATE SET data_json = excluded.data_json, updated_at = CURRENT_TIMESTAMP`,
      [req.user.id, module, JSON.stringify(data)]
    );
    setImmediate(backupToJson);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '保存数据失败' });
  }
});

app.get('/api/backup/download', auth, async (req, res) => {
  try {
    const rows = await all('SELECT module, data_json FROM module_data WHERE user_id = ?', [req.user.id]);
    const result = { username: req.user.username, exportedAt: new Date().toISOString(), modules: {} };
    rows.forEach(row => {
      try { result.modules[row.module] = JSON.parse(row.data_json || '[]'); }
      catch { result.modules[row.module] = []; }
    });
    // 确保四个 key 都存在
    ['tasks', 'todos', 'phone', 'visa'].forEach(m => { if (!result.modules[m]) result.modules[m] = []; });
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="workbench-backup-${req.user.username}-${new Date().toISOString().slice(0,10)}.json"`);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '导出失败' });
  }
});

app.post('/api/backup/restore', auth, async (req, res) => {
  try {
    const modules = req.body && req.body.modules;
    if (!modules || typeof modules !== 'object') {
      return res.status(400).json({ error: '备份文件格式错误' });
    }
    const valid = ['tasks', 'todos', 'phone', 'visa'];
    let count = 0;
    for (const m of valid) {
      const data = Array.isArray(modules[m]) ? modules[m] : null;
      if (data) {
        await run(
          `INSERT INTO module_data (user_id, module, data_json, updated_at)
           VALUES (?, ?, ?, CURRENT_TIMESTAMP)
           ON CONFLICT(user_id, module)
           DO UPDATE SET data_json = excluded.data_json, updated_at = CURRENT_TIMESTAMP`,
          [req.user.id, m, JSON.stringify(data)]
        );
        count++;
      }
    }
    setImmediate(backupToJson);
    res.json({ ok: true, restored: count });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '恢复失败' });
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin-workbench.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`行政工作台系统已启动：http://localhost:${PORT}/admin-workbench.html`);
  console.log(`数据库位置：${DB_PATH}`);
});
