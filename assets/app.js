// assets/app.js
(function() {
  'use strict';

  // ==================== GLOBAL ERROR PROTECTION ====================
  window.addEventListener('error', function(e) {
    console.error('[工作台错误]', e.error || e.message);
  });
  window.addEventListener('unhandledrejection', function(e) {
    console.error('[工作台Promise错误]', e.reason);
  });

  function safeExec(fn, fallback) {
    try { return fn(); }
    catch(e) { console.error('[执行错误]', e); return fallback; }
  }

  // ==================== DATA LAYER ====================
  var STORAGE_KEY = 'admin_workbench_tasks';
  var TODO_STORAGE_KEY = 'admin_workbench_daily_todos';
  var PHONE_STORAGE_KEY = 'admin_workbench_phone_records';
  var VISA_STORAGE_KEY = 'admin_workbench_visa_records';
  var AUTH_TOKEN_KEY = 'admin_workbench_auth_token';
  var AUTH_USER_KEY = 'admin_workbench_auth_user';
  var authToken = localStorage.getItem(AUTH_TOKEN_KEY) || '';
  var authUser = null;
  try { authUser = JSON.parse(localStorage.getItem(AUTH_USER_KEY) || 'null'); } catch(e) { authUser = null; }
  var isBootstrapping = false;
  var USER_CONFIG = {
    todoScopes: ['today', 'tomorrow', 'week', 'month', 'longterm'],
    reminderRules: {
      meetingHoursBefore: 24,
      todoHoursBefore: 1,
      visaDaysBefore: 15
    },
    phoneCategories: ['咨询', '投诉', '催办', '退款', '供应商', '其他'],
    visaCountries: ['日本', '韩国', '新加坡', '美国', '申根']
  };

  // Default seed data
  var defaultTasks = [
    {
      id: 't1', date: '2026-07-14', type: 'level-d', deadline: '09:00',
      people: null, seatCard: false, note: '',
      prepItems: [
        { text: '水果 - 三宫格盘子摆盘', done: false },
        { text: '茶水 - 准备一杯茶', done: false },
        { text: '耳机 - 摆放到位', done: false },
        { text: '排插 - 摆放到位', done: false }
      ],
      completed: false
    },
    {
      id: 't2', date: '2026-07-10', type: 'level-d', deadline: '09:00',
      people: null, seatCard: false, note: '周会',
      prepItems: [
        { text: '投影仪调试', done: true },
        { text: '矿泉水 6 瓶', done: true },
        { text: '白板笔更换', done: true }
      ],
      completed: true
    },
    {
      id: 't3', date: '2026-07-08', type: 'level-b', deadline: '08:30',
      people: 5, seatCard: true, note: '季度汇报',
      prepItems: [
        { text: '座位牌打印', done: true },
        { text: '水果茶水', done: true },
        { text: '投影仪', done: true }
      ],
      completed: true
    },
    {
      id: 't4', date: '2026-07-05', type: 'level-s', deadline: '08:00',
      people: 8, seatCard: true, note: '合作伙伴来访',
      prepItems: [
        { text: '座位牌', done: true },
        { text: '鲜花', done: true },
        { text: '茶点', done: true },
        { text: '礼品', done: true }
      ],
      completed: true
    },
    {
      id: 't5', date: '2026-07-03', type: 'level-d', deadline: '09:00',
      people: null, seatCard: false, note: '',
      prepItems: [
        { text: '矿泉水', done: true },
        { text: '白板', done: true }
      ],
      completed: true
    },
    {
      id: 't6', date: '2026-07-01', type: 'level-d', deadline: '09:30',
      people: null, seatCard: false, note: '月度例会',
      prepItems: [
        { text: '矿泉水 4 瓶', done: true },
        { text: '投影仪', done: true }
      ],
      completed: true
    },
    {
      id: 't7', date: '2026-06-28', type: 'level-b', deadline: '09:00',
      people: 6, seatCard: true, note: '客户考察',
      prepItems: [
        { text: '座位牌', done: true },
        { text: '水果摆盘', done: true },
        { text: '茶水', done: true },
        { text: '公司介绍资料', done: true }
      ],
      completed: true
    },
    {
      id: 't8', date: '2026-06-25', type: 'level-d', deadline: '09:00',
      people: null, seatCard: false, note: '',
      prepItems: [
        { text: '矿泉水', done: true },
        { text: '笔记本', done: true }
      ],
      completed: true
    }
  ];

  function loadTasks() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return migrateTaskTypes(JSON.parse(raw));
    } catch(e) {}
    return JSON.parse(JSON.stringify(defaultTasks));
  }

  function saveTasks(tasks) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    syncModule('tasks', tasks);
  }

  function migrateTaskTypes(list) {
    if (!Array.isArray(list)) return [];
    var map = { normal: 'level-d', important: 'level-b', vip: 'level-s' };
    var valid = { 'level-s': true, 'level-a': true, 'level-b': true, 'level-c': true, 'level-d': true };
    return list.map(function(task) {
      if (!task || typeof task !== 'object') return null;
      if (map[task.type]) task.type = map[task.type];
      if (!task.type || !valid[task.type]) task.type = 'level-d';
      if (!Array.isArray(task.prepItems)) task.prepItems = [];
      return task;
    }).filter(Boolean);
  }

  var tasks = loadTasks();

  function loadDailyTodos() {
    try {
      var raw = localStorage.getItem(TODO_STORAGE_KEY);
      if (raw) return migrateDailyTodos(JSON.parse(raw));
    } catch(e) {}
    return [
      { id: 'd1', date: '2026-07-14', scope: 'today', deadline: '2026-07-14T09:00', reminder: '2026-07-14T08:00', text: '确认明天会议室物品是否摆放到位', priority: 'important', done: false },
      { id: 'd2', date: '2026-07-14', scope: 'week', deadline: '2026-07-18T18:00', reminder: '2026-07-18T17:00', text: '整理本周接待记录', priority: 'normal', done: true }
    ];
  }

  function migrateDailyTodos(list) {
    if (!Array.isArray(list)) return [];
    return list.map(function(item) {
      if (!item || typeof item !== 'object') return null;
      if (!item.scope) item.scope = 'today';
      if (!item.deadline) item.deadline = item.date + 'T18:00';
      if (!item.date && item.deadline) item.date = item.deadline.slice(0, 10);
      if (!item.reminder) item.reminder = calcReminder(item.deadline, USER_CONFIG.reminderRules.todoHoursBefore);
      return item;
    }).filter(Boolean);
  }

  function saveDailyTodos(list) {
    localStorage.setItem(TODO_STORAGE_KEY, JSON.stringify(list));
    syncModule('todos', list);
  }

  var dailyTodos = loadDailyTodos();
  var App = window.App = window.App || {};
  var editingDailyTodoId = null;
  var editingSubtasks = [];
  var phoneRecords = loadPhoneRecords();
  var visaRecords = loadVisaRecords();
  var editingPhoneId = null;
  var editingVisaId = null;

  function setAuth(token, user) {
    authToken = token || '';
    authUser = user || null;
    if (authToken) localStorage.setItem(AUTH_TOKEN_KEY, authToken);
    else localStorage.removeItem(AUTH_TOKEN_KEY);
    if (authUser) localStorage.setItem(AUTH_USER_KEY, JSON.stringify(authUser));
    else localStorage.removeItem(AUTH_USER_KEY);
    renderAuthBar();
  }

  function renderAuthBar() {
    var loggedIn = !!authToken && !!authUser;
    var usernameEl = document.getElementById('loginUsername');
    var passwordEl = document.getElementById('loginPassword');
    var loginBtn = document.getElementById('loginBtn');
    var registerBtn = document.getElementById('registerBtn');
    var migrateBtn = document.getElementById('migrateBtn');
    var logoutBtn = document.getElementById('logoutBtn');
    if (usernameEl) usernameEl.style.display = loggedIn ? 'none' : 'block';
    if (passwordEl) passwordEl.style.display = loggedIn ? 'none' : 'block';
    if (loginBtn) loginBtn.style.display = loggedIn ? 'none' : 'inline-flex';
    if (registerBtn) registerBtn.style.display = loggedIn ? 'none' : 'inline-flex';
    if (migrateBtn) migrateBtn.style.display = loggedIn ? 'inline-flex' : 'none';
    if (logoutBtn) logoutBtn.style.display = loggedIn ? 'inline-flex' : 'none';
    var backupBtn = document.getElementById('backupBtn');
    var restoreBtn = document.getElementById('restoreBtn');
    if (backupBtn) backupBtn.style.display = loggedIn ? 'inline-flex' : 'none';
    if (restoreBtn) restoreBtn.style.display = loggedIn ? 'inline-flex' : 'none';
    updateSyncStatus(loggedIn ? ('已登录：' + authUser.username + '，数据自动同步') : '未登录：数据仅保存在当前浏览器');
  }

  function getLoginPayload() {
    var username = (document.getElementById('loginUsername') || {}).value || '';
    var password = (document.getElementById('loginPassword') || {}).value || '';
    username = username.trim();
    if (!username || !password) {
      alert('请输入账号和密码');
      return null;
    }
    return { username: username, password: password };
  }

  function applyServerData(data) {
    isBootstrapping = true;
    safeExec(function() {
      if (Array.isArray(data.tasks)) {
        tasks = migrateTaskTypes(data.tasks);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
      }
    });
    safeExec(function() {
      if (Array.isArray(data.todos)) {
        dailyTodos = migrateDailyTodos(data.todos);
        localStorage.setItem(TODO_STORAGE_KEY, JSON.stringify(dailyTodos));
      }
    });
    safeExec(function() {
      if (Array.isArray(data.phone)) {
        phoneRecords = data.phone;
        localStorage.setItem(PHONE_STORAGE_KEY, JSON.stringify(phoneRecords));
      }
    });
    safeExec(function() {
      if (Array.isArray(data.visa)) {
        visaRecords = data.visa;
        localStorage.setItem(VISA_STORAGE_KEY, JSON.stringify(visaRecords));
      }
    });
    isBootstrapping = false;
    renderAllModules();
  }

  App.login = function() {
    var payload = getLoginPayload();
    if (!payload) return;
    apiFetch('/api/auth/login', { method: 'POST', body: JSON.stringify(payload) })
      .then(function(data) {
        setAuth(data.token, data.user);
        return loadServerData();
      })
      .then(function() {
        renderAuthBar();
        renderAllModules();
        alert('登录成功，已加载账号数据');
      })
      .catch(function(err) {
        alert(err.message);
      });
  };

  App.register = function() {
    var payload = getLoginPayload();
    if (!payload) return;
    apiFetch('/api/auth/register', { method: 'POST', body: JSON.stringify(payload) })
      .then(function(data) {
        setAuth(data.token, data.user);
        return App.migrateLocalToServer(true);
      })
      .then(function() {
        renderAuthBar();
        renderAllModules();
        alert('注册成功，本机数据已保存到账号');
      })
      .catch(function(err) {
        alert(err.message);
      });
  };

  App.logout = function() {
    setAuth('', null);
    renderAuthBar();
    renderAllModules();
    alert('已退出。页面会继续使用当前浏览器本地数据。');
  };

  function loadServerData() {
    if (!authToken) return Promise.resolve();
    return apiFetch('/api/data').then(function(data) {
      applyServerData(data);
    }).catch(function(err) {
      // 如果是登录过期，自动清除本地登录状态，显示登录框
      if (err.message && err.message.indexOf('登录已过期') !== -1) {
        setAuth('', null);
        renderAuthBar();
      }
      updateSyncStatus('读取账号数据失败：' + err.message);
    });
  }

  App.migrateLocalToServer = function(silent) {
    if (!authToken) {
      alert('请先登录或注册账号');
      return Promise.resolve();
    }
    return apiFetch('/api/data/bulk', {
      method: 'POST',
      body: JSON.stringify({
        tasks: tasks,
        todos: dailyTodos,
        phone: phoneRecords,
        visa: visaRecords
      })
    }).then(function() {
      updateSyncStatus('本机数据已迁移到账号：' + authUser.username);
      if (!silent) alert('迁移完成。之后换电脑登录同一账号，就能看到这些数据。');
    }).catch(function(err) {
      alert('迁移失败：' + err.message);
    });
  };

  // ===== 数据备份：导出当前账号的所有数据为 JSON 文件 =====
  App.exportBackup = function() {
    if (!authToken) { alert('请先登录'); return; }
    apiFetch('/api/backup/download')
      .then(function(data) {
        // 注意：因为 Content-Disposition 是 attachment，浏览器会自动下载。
        // 但 fetch 不会触发下载，需要手动创建 blob 并触发。
        // 所以上面那个端点其实应该直接请求。这里我们用另一种方式：
        // 直接从当前内存中的数据拼接，然后下载。这样更简单也兼容。
      })
      .catch(function(err) {
        alert('导出失败：' + err.message);
      });
    // 实际上更简单：直接用当前内存中的数据构造并下载
    var exportData = {
      username: authUser ? authUser.username : 'local',
      exportedAt: new Date().toISOString(),
      modules: {
        tasks: tasks,
        todos: dailyTodos,
        phone: phoneRecords,
        visa: visaRecords
      }
    };
    var blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    var fname = 'workbench-backup-' + (exportData.username) + '-' + exportData.exportedAt.slice(0,10) + '.json';
    a.download = fname;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function() { URL.revokeObjectURL(url); }, 1000);
    alert('已导出备份文件：' + fname + '\n请妥善保存，恢复数据时需要它。');
  };

  // ===== 数据恢复：上传 JSON 备份并恢复 =====
  App.importBackup = function() {
    if (!authToken) { alert('请先登录'); return; }
    if (!confirm('恢复备份会覆盖当前账号的所有数据，确定继续吗？\n建议先备份当前数据再恢复。')) return;
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.onchange = function(ev) {
      var file = ev.target.files && ev.target.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function(e) {
        try {
          var data = JSON.parse(e.target.result);
          if (!data || !data.modules || typeof data.modules !== 'object') throw new Error('文件格式不对');
          apiFetch('/api/backup/restore', {
            method: 'POST',
            body: JSON.stringify(data)
          }).then(function(res) {
            alert('恢复成功！已恢复 ' + (res.restored || 0) + ' 个模块的数据。页面即将刷新。');
            setTimeout(function() { location.reload(); }, 800);
          }).catch(function(err) {
            alert('恢复失败：' + err.message);
          });
        } catch (err) {
          alert('解析备份文件失败：' + err.message);
        }
      };
      reader.readAsText(file, 'utf-8');
    };
    input.click();
  };

  function loadPhoneRecords() {
    try {
      var raw = localStorage.getItem(PHONE_STORAGE_KEY);
      if (raw) {
        var data = JSON.parse(raw);
        if (Array.isArray(data)) return data;
      }
    } catch(e) {}
    return [];
  }

  function savePhoneRecords() {
    localStorage.setItem(PHONE_STORAGE_KEY, JSON.stringify(phoneRecords));
    syncModule('phone', phoneRecords);
  }

  function loadVisaRecords() {
    try {
      var raw = localStorage.getItem(VISA_STORAGE_KEY);
      if (raw) {
        var data = JSON.parse(raw);
        if (Array.isArray(data)) return data;
      }
    } catch(e) {}
    return [];
  }

  function saveVisaRecords() {
    localStorage.setItem(VISA_STORAGE_KEY, JSON.stringify(visaRecords));
    syncModule('visa', visaRecords);
  }

  function apiFetch(url, options) {
    options = options || {};
    options.headers = options.headers || {};
    if (authToken) options.headers.Authorization = 'Bearer ' + authToken;
    if (options.body && !options.headers['Content-Type']) {
      options.headers['Content-Type'] = 'application/json';
    }
    return fetch(url, options).then(function(res) {
      return res.json().then(function(data) {
        if (!res.ok) throw new Error(data.error || '请求失败');
        return data;
      });
    });
  }

  function syncModule(module, data) {
    if (isBootstrapping || !authToken) return;
    apiFetch('/api/data/' + module, {
      method: 'POST',
      body: JSON.stringify({ data: data })
    }).then(function() {
      updateSyncStatus('已同步到账号：' + (authUser ? authUser.username : ''));
    }).catch(function(err) {
      updateSyncStatus('同步失败：' + err.message);
    });
  }

  function updateSyncStatus(text) {
    var el = document.getElementById('syncStatus');
    if (el) el.textContent = text;
  }

  // ==================== UTILS ====================
  var typeLabels = {
    'level-s': 'S级',
    'level-a': 'A级',
    'level-b': 'B级',
    'level-c': 'C级',
    'level-d': 'D级'
  };
  var typeOrder = ['level-s', 'level-a', 'level-b', 'level-c', 'level-d'];
  var weekDays = ['日', '一', '二', '三', '四', '五', '六'];

  function formatDate(dateStr) {
    var d = new Date(dateStr);
    return (d.getMonth() + 1) + '月' + d.getDate() + '日（周' + weekDays[d.getDay()] + '）';
  }

  function isToday(dateStr) {
    var t = new Date(); var d = new Date(dateStr);
    return d.getFullYear() === t.getFullYear() && d.getMonth() === t.getMonth() && d.getDate() === t.getDate();
  }

  function isThisWeek(dateStr) {
    var now = new Date(); var d = new Date(dateStr);
    var startOfWeek = new Date(now); startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0,0,0,0);
    var endOfWeek = new Date(startOfWeek); endOfWeek.setDate(startOfWeek.getDate() + 7);
    return d >= startOfWeek && d < endOfWeek;
  }

  function isThisMonth(dateStr) {
    var t = new Date(); var d = new Date(dateStr);
    return d.getFullYear() === t.getFullYear() && d.getMonth() === t.getMonth();
  }

  function genId() { return 't' + Date.now() + Math.random().toString(36).substr(2, 5); }

  // ==================== TAB SWITCHING ====================
  document.querySelectorAll('.tab-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.tab-btn').forEach(function(b) { b.classList.remove('active'); });
      document.querySelectorAll('.tab-content').forEach(function(c) { c.classList.remove('active'); });
      btn.classList.add('active');
      document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
      // Render dashboard charts when tab shown
      if (btn.dataset.tab === 'dashboard') { App.renderDashboardCharts(); }
      if (btn.dataset.tab === 'todos') { renderDailyTodos(); }
      if (btn.dataset.tab === 'phone') { renderPhoneRecords(); }
      if (btn.dataset.tab === 'visa') { renderVisaRecords(); }
    });
  });

  // ==================== SUB TAB SWITCHING (会议接待内) ====================
  document.querySelectorAll('.sub-tab-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.sub-tab-btn').forEach(function(b) { b.classList.remove('active'); });
      document.querySelectorAll('.sub-tab-content').forEach(function(c) { c.classList.remove('active'); });
      btn.classList.add('active');
      document.getElementById('subtab-' + btn.dataset.subtab).classList.add('active');
    });
  });

  // ==================== CHECKLIST DATA ====================
  var CHECKLIST_STORAGE_KEY = 'admin_workbench_checklist_records';
  var CHECKLIST_ITEMS = {
    pre: [
      { name: '空调温度', standard: '夏季 24-26℃，冬季 20-22℃，体感舒适' },
      { name: '照明设备', standard: '所有灯具正常点亮，无闪烁，亮度充足' },
      { name: '投影仪/会议平板', standard: '开机正常，画面清晰，无偏色模糊' },
      { name: '音响/麦克风', standard: '音量适中，无杂音啸叫，麦克风收音正常' },
      { name: '视频会议设备', standard: '摄像头清晰，网络连接稳定，软件登录正常' },
      { name: '桌椅摆放', standard: '桌椅整齐，数量充足，无污渍无损坏' },
      { name: '文具用品', standard: '纸笔、白板笔、板擦齐全可正常使用' },
      { name: '饮用水/茶水', standard: '矿泉水充足，热水机可用，杯具备齐' },
      { name: '白板/白板笔', standard: '白板清洁无残留字迹，笔可正常书写' },
      { name: '门窗窗帘', standard: '窗帘开合顺畅，门窗锁具完好，玻璃清洁' }
    ],
    daily: [
      { name: '桌面清洁', standard: '会议桌干净无污渍，无遗留物品和垃圾' },
      { name: '地面清洁', standard: '地面清扫干净，无纸屑、水渍、杂物' },
      { name: '椅子归位', standard: '所有椅子推进桌下，摆放整齐统一' },
      { name: '设备断电', standard: '投影仪、空调、灯光、音响等设备已关闭' },
      { name: '白板擦净', standard: '白板内容已擦除，表面干净无字迹残留' },
      { name: '垃圾桶清空', standard: '垃圾已清理，垃圾袋更换完毕' },
      { name: '门窗关闭', standard: '门窗关好锁好，窗帘拉至合适位置' },
      { name: '物品归位', standard: '遥控器、文具、杯具等放回指定位置' }
    ],
    weekly: [
      { name: '空调滤网', standard: '进风口无灰尘堆积，滤网清洁或更换' },
      { name: '设备表面除尘', standard: '投影仪、电视、会议平板表面无明显灰尘' },
      { name: '窗户玻璃', standard: '玻璃擦拭干净，无手印、水痕、污渍' },
      { name: '文件柜/储物柜', standard: '柜内物品摆放整齐，无混放，柜门关闭良好' },
      { name: '绿植养护', standard: '绿植浇水，无黄叶，花盆干净无积水' },
      { name: '线路整理', standard: '电源线、信号线整理整齐，无私拉乱接' },
      { name: '消耗品盘点', standard: '矿泉水、纸巾、白板笔等库存充足并登记' },
      { name: '地毯/地垫', standard: '地毯吸尘彻底，无污渍，地垫清洁' }
    ],
    monthly: [
      { name: '空调深度清洁', standard: '出风口、滤网彻底清洁，运行无异响' },
      { name: '投影仪/摄像头', standard: '镜头专用纸清洁，对焦准确，色彩正常' },
      { name: '插座与线路', standard: '插座牢固无破损，线路绝缘良好无老化' },
      { name: '消防设施', standard: '灭火器在有效期内，应急灯正常，通道畅通' },
      { name: '墙面天花板', standard: '无污渍、无掉皮、无渗水痕迹，状态良好' },
      { name: '家具检查', standard: '桌椅稳固无松动，无破损，五金件齐全' },
      { name: '设备遥控器', standard: '电池电量充足，按键灵敏有效' },
      { name: '钟表计时', standard: '挂钟走时准确，电池电量充足' }
    ]
  };

  function loadChecklistRecords() {
    try {
      var raw = localStorage.getItem(CHECKLIST_STORAGE_KEY);
      if (raw) {
        var data = JSON.parse(raw);
        if (Array.isArray(data)) return data;
      }
    } catch(e) {}
    return [];
  }

  function saveChecklistRecords(records) {
    localStorage.setItem(CHECKLIST_STORAGE_KEY, JSON.stringify(records));
    syncModule('checklist', records);
  }

  function renderChecklistSection(type, bodyId) {
    var items = CHECKLIST_ITEMS[type] || [];
    var body = document.getElementById(bodyId);
    if (!body) return;
    var html = '';
    items.forEach(function(item, idx) {
      var no = String(idx + 1).padStart(2, '0');
      html += '<tr>';
      html += '<td><span class="checklist-item-name"><span class="checklist-item-no">' + no + '</span>' + item.name + '</span></td>';
      html += '<td>' + item.standard + '</td>';
      html += '<td><select class="checklist-status-select" data-type="' + type + '" data-idx="' + idx + '">';
      html += '<option value="">-</option>';
      html += '<option class="status-ok" value="ok">正常</option>';
      html += '<option class="status-no" value="no">异常</option>';
      html += '<option class="status-na" value="na">不适用</option>';
      html += '</select></td>';
      html += '</tr>';
    });
    body.innerHTML = html;
  }

  function initChecklist() {
    renderChecklistSection('pre', 'checklist-pre-body');
    renderChecklistSection('daily', 'checklist-daily-body');
    renderChecklistSection('weekly', 'checklist-weekly-body');
    renderChecklistSection('monthly', 'checklist-monthly-body');

    var now = new Date();
    var dateEl = document.getElementById('checklistDate');
    var timeEl = document.getElementById('checklistTime');
    if (dateEl) dateEl.value = now.toISOString().slice(0, 10);
    if (timeEl) timeEl.value = now.toTimeString().slice(0, 5);
  }

  App.saveChecklist = function() {
    var record = {
      id: 'c' + Date.now(),
      date: new Date().toISOString(),
      room: safeGetVal('checklistRoom'),
      checkDate: safeGetVal('checklistDate'),
      checkTime: safeGetVal('checklistTime'),
      person: safeGetVal('checklistPerson'),
      items: {},
      notes: safeGetVal('checklistNotes'),
      sig1: safeGetVal('checklistSig1'),
      sig2: safeGetVal('checklistSig2'),
      sigDate: safeGetVal('checklistSigDate')
    };
    document.querySelectorAll('.checklist-status-select').forEach(function(sel) {
      var type = sel.dataset.type;
      var idx = parseInt(sel.dataset.idx);
      if (!record.items[type]) record.items[type] = {};
      record.items[type][idx] = sel.value;
    });
    var records = loadChecklistRecords();
    records.unshift(record);
    saveChecklistRecords(records);
    alert('点检记录已保存！');
  };

  App.resetChecklist = function() {
    if (!confirm('确定要清空所有点检内容吗？')) return;
    document.querySelectorAll('.checklist-status-select').forEach(function(sel) { sel.value = ''; });
    ['checklistPerson', 'checklistNotes', 'checklistSig1', 'checklistSig2'].forEach(function(id) {
      var el = document.getElementById(id);
      if (el) el.value = '';
    });
    var now = new Date();
    var dateEl = document.getElementById('checklistDate');
    var timeEl = document.getElementById('checklistTime');
    var sigDateEl = document.getElementById('checklistSigDate');
    if (dateEl) dateEl.value = now.toISOString().slice(0, 10);
    if (timeEl) timeEl.value = now.toTimeString().slice(0, 5);
    if (sigDateEl) sigDateEl.value = '';
  };

  App.printChecklist = function() {
    window.print();
  };

  // 点检视图切换
  function initChecklistViewToggle() {
    document.querySelectorAll('[data-checkview]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var view = btn.dataset.checkview;
        document.querySelectorAll('[data-checkview]').forEach(function(b) { b.classList.remove('active'); });
        btn.classList.add('active');
        document.getElementById('checkview-new').style.display = (view === 'new' ? '' : 'none');
        document.getElementById('checkview-history').style.display = (view === 'history' ? '' : 'none');
        if (view === 'history') {
          renderChecklistHistory();
        }
      });
    });
  }

  // 渲染历史记录
  function renderChecklistHistory() {
    var records = loadChecklistRecords();
    var container = document.getElementById('checklistHistoryList');
    if (!container) return;
    if (records.length === 0) {
      container.innerHTML = '<div class="checklist-history-empty">暂无点检记录，去新建点检吧～</div>';
      return;
    }
    var typeNames = { pre: '会前检查', daily: '日常点检', weekly: '每周点检', monthly: '每月点检' };
    var statusMap = { ok: '正常', no: '异常', na: '不适用' };
    var html = '';
    records.forEach(function(rec) {
      var totalCount = 0, okCount = 0, noCount = 0, naCount = 0;
      ['pre','daily','weekly','monthly'].forEach(function(t) {
        if (rec.items && rec.items[t]) {
          Object.keys(rec.items[t]).forEach(function(k) {
            var v = rec.items[t][k];
            totalCount++;
            if (v === 'ok') okCount++;
            else if (v === 'no') noCount++;
            else if (v === 'na') naCount++;
          });
        }
      });
      var d = rec.checkDate || rec.date ? new Date(rec.checkDate || rec.date) : null;
      var dateStr = d ? (d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0')) : '-';
      html += '<div class="checklist-history-item">';
      html += '<div class="checklist-history-header-row">';
      html += '<div class="checklist-history-title">🏢 ' + (rec.room || '未指定会议室') + '</div>';
      html += '<div class="checklist-history-actions">';
      html += '<button class="btn btn-sm" onclick="App.viewChecklistDetail(\'' + rec.id + '\')">查看详情</button>';
      html += '<button class="btn btn-sm" onclick="App.exportSingleChecklist(\'' + rec.id + '\')">导出</button>';
      html += '<button class="btn btn-sm" style="background:#fee2e2;color:#b91c1c;" onclick="App.deleteChecklistRecord(\'' + rec.id + '\')">删除</button>';
      html += '</div></div>';
      html += '<div class="checklist-history-meta">';
      html += '<span>📅 ' + dateStr + '</span>';
      html += '<span>🕐 ' + (rec.checkTime || '-') + '</span>';
      html += '<span>👤 ' + (rec.person || '-') + '</span>';
      html += '</div>';
      html += '<div class="checklist-history-summary">';
      html += '共检查 <b>' + totalCount + '</b> 项：';
      html += '<span class="status-ok-text">正常 ' + okCount + '</b></span> · ';
      html += '<span class="status-no-text">异常 ' + noCount + '</span> · ';
      html += '<span class="status-na-text">不适用 ' + naCount + '</span>';
      html += '</div>';
      if (rec.notes) {
        html += '<div style="font-size:0.78rem;color:var(--muted);border-top:1px solid var(--rule);padding-top:0.4rem;margin-top:0.3rem;">📝 备注：' + rec.notes + '</div>';
      }
      html += '</div>';
    });
    container.innerHTML = html;
  }

  // 查看单条记录详情
  App.viewChecklistDetail = function(id) {
    var records = loadChecklistRecords();
    var rec = records.find(function(r) { return r.id === id; });
    if (!rec) return;
    var typeNames = { pre: '会前检查', daily: '日常点检', weekly: '每周点检', monthly: '每月点检' };
    var statusMap = { ok: '正常', no: '异常', na: '不适用' };
    var msg = '【点检详情】\n';
    msg += '会议室：' + (rec.room || '-') + '\n';
    msg += '日期：' + (rec.checkDate || '-') + ' ' + (rec.checkTime || '-') + '\n';
    msg += '点检人：' + (rec.person || '-') + '\n\n';
    ['pre','daily','weekly','monthly'].forEach(function(t) {
      var items = CHECKLIST_ITEMS[t] || [];
      var checked = rec.items ? rec.items[t] : null;
      if (!checked || Object.keys(checked).length === 0) return;
      msg += '--- ' + typeNames[t] + ' ---\n';
      items.forEach(function(item, idx) {
        var v = checked[idx];
        if (v) {
          var statusText = statusMap[v] || v;
          msg += (idx+1) + '. ' + item.name + '：' + statusText + '\n';
        }
      });
      msg += '\n';
    });
    if (rec.notes) msg += '备注：' + rec.notes + '\n';
    if (rec.sig1 || rec.sig2) {
      msg += '\n签字：' + (rec.sig1 || '') + (rec.sig2 ? ' / ' + rec.sig2 : '');
    }
    alert(msg);
  };

  // 删除单条记录
  App.deleteChecklistRecord = function(id) {
    if (!confirm('确定删除这条点检记录吗？删除后无法恢复。')) return;
    var records = loadChecklistRecords().filter(function(r) { return r.id !== id; });
    saveChecklistRecords(records);
    renderChecklistHistory();
    alert('已删除');
  };

  // 导出全部点检记录为Excel（CSV格式）
  App.exportChecklistExcel = function() {
    var records = loadChecklistRecords();
    if (records.length === 0) { alert('暂无记录可导出'); return; }
    var typeNames = { pre: '会前检查', daily: '日常点检', weekly: '每周点检', monthly: '每月点检' };
    var statusMap = { ok: '正常', no: '异常', na: '不适用', '': '-' };
    // 构建所有检查项的完整列表
    var allItemNames = [];
    ['pre','daily','weekly','monthly'].forEach(function(t) {
      (CHECKLIST_ITEMS[t] || []).forEach(function(item, idx) {
        allItemNames.push({ type: t, idx: idx, name: typeNames[t] + '-' + item.name });
      });
    });
    // CSV表头
    var headers = ['序号','会议室','点检日期','点检时间','点检人'];
    allItemNames.forEach(function(it) { headers.push(it.name); });
    headers.push('异常项数','备注','点检人签字','复核人签字','签字日期');
    // 数据行
    var rows = [headers];
    records.forEach(function(rec, i) {
      var d = rec.checkDate || rec.date ? new Date(rec.checkDate || rec.date) : null;
      var dateStr = d ? (d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0')) : '';
      var row = [i+1, rec.room || '', dateStr, rec.checkTime || '', rec.person || ''];
      var noCount = 0;
      allItemNames.forEach(function(it) {
        var v = '';
        if (rec.items && rec.items[it.type] && rec.items[it.type][it.idx] !== undefined) {
          v = statusMap[rec.items[it.type][it.idx]] || '';
          if (rec.items[it.type][it.idx] === 'no') noCount++;
        }
        row.push(v);
      });
      row.push(noCount > 0 ? noCount + '项异常' : '无');
      row.push((rec.notes || '').replace(/[\r\n,]/g, ' '));
      row.push(rec.sig1 || '');
      row.push(rec.sig2 || '');
      row.push(rec.sigDate || '');
      rows.push(row);
    });
    // 生成CSV
    var csvContent = '\uFEFF'; // BOM for Excel中文
    rows.forEach(function(row) {
      csvContent += row.map(function(cell) {
        var s = String(cell || '');
        if (s.indexOf(',') >= 0 || s.indexOf('"') >= 0 || s.indexOf('\n') >= 0) {
          s = '"' + s.replace(/"/g, '""') + '"';
        }
        return s;
      }).join(',') + '\n';
    });
    var blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    var link = document.createElement('a');
    var now = new Date();
    var fname = '会议室点检记录_' + now.getFullYear() + String(now.getMonth()+1).padStart(2,'0') + String(now.getDate()).padStart(2,'0') + '.csv';
    link.href = URL.createObjectURL(blob);
    link.download = fname;
    link.click();
    URL.revokeObjectURL(link.href);
    alert('已导出 ' + records.length + ' 条记录到：' + fname);
  };

  // 导出单条记录
  App.exportSingleChecklist = function(id) {
    var records = loadChecklistRecords();
    var rec = records.find(function(r) { return r.id === id; });
    if (!rec) return;
    // 临时只导出这一条
    var _save = saveChecklistRecords;
    var _load = loadChecklistRecords;
    // 用闭包方式：临时创建一个只含单条的导出
    (function() {
      var single = [rec];
      var typeNames = { pre: '会前检查', daily: '日常点检', weekly: '每周点检', monthly: '每月点检' };
      var statusMap = { ok: '正常', no: '异常', na: '不适用', '': '-' };
      var allItemNames = [];
      ['pre','daily','weekly','monthly'].forEach(function(t) {
        (CHECKLIST_ITEMS[t] || []).forEach(function(item, idx) {
          allItemNames.push({ type: t, idx: idx, name: typeNames[t] + '-' + item.name });
        });
      });
      var headers = ['序号','会议室','点检日期','点检时间','点检人'];
      allItemNames.forEach(function(it) { headers.push(it.name); });
      headers.push('异常项数','备注','点检人签字','复核人签字','签字日期');
      var rows = [headers];
      single.forEach(function(rec2, i) {
        var d = rec2.checkDate || rec2.date ? new Date(rec2.checkDate || rec2.date) : null;
        var dateStr = d ? (d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0')) : '';
        var row = [i+1, rec2.room || '', dateStr, rec2.checkTime || '', rec2.person || ''];
        var noCount = 0;
        allItemNames.forEach(function(it) {
          var v = '';
          if (rec2.items && rec2.items[it.type] && rec2.items[it.type][it.idx] !== undefined) {
            v = statusMap[rec2.items[it.type][it.idx]] || '';
            if (rec2.items[it.type][it.idx] === 'no') noCount++;
          }
          row.push(v);
        });
        row.push(noCount > 0 ? noCount + '项异常' : '无');
        row.push((rec2.notes || '').replace(/[\r\n,]/g, ' '));
        row.push(rec2.sig1 || '');
        row.push(rec2.sig2 || '');
        row.push(rec2.sigDate || '');
        rows.push(row);
      });
      var csvContent = '\uFEFF';
      rows.forEach(function(row) {
        csvContent += row.map(function(cell) {
          var s = String(cell || '');
          if (s.indexOf(',') >= 0 || s.indexOf('"') >= 0 || s.indexOf('\n') >= 0) {
            s = '"' + s.replace(/"/g, '""') + '"';
          }
          return s;
        }).join(',') + '\n';
      });
      var blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      var link = document.createElement('a');
      var now = new Date();
      var fname = '会议室点检_' + (rec.room || '记录').replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g,'') + '_' + (rec.checkDate || now.toISOString().slice(0,10)) + '.csv';
      link.href = URL.createObjectURL(blob);
      link.download = fname;
      link.click();
      URL.revokeObjectURL(link.href);
      alert('已导出');
    })();
  };

  function safeGetVal(id) {
    var el = document.getElementById(id);
    return el ? el.value : '';
  }

  // ==================== RENDER TASKS ====================
  function renderTasks() {
    var list = document.getElementById('taskList');
    // Sort: incomplete first, then by date
    var sorted = tasks.slice().sort(function(a, b) {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      return new Date(a.date) - new Date(b.date);
    });

    var html = '';
    sorted.forEach(function(task) {
      var isDone = task.completed;
      var typeClass = task.type;
      var deadlineClass = isDone ? 'normal-deadline' : (isToday(task.date) ? '' : 'normal-deadline');

      html += '<div class="task-item" data-id="' + task.id + '">';
      html += '<div class="task-top">';
      html += '<div class="task-title-row">';
      html += '<div class="task-checkbox' + (isDone ? ' checked' : '') + '" onclick="App.toggleTask(\'' + task.id + '\')">' + (isDone ? '✓' : '') + '</div>';
      html += '<div class="task-title' + (isDone ? ' completed' : '') + '">' + (task.note || '会议接待准备') + '</div>';
      html += '</div>';
      html += '<div class="task-actions">';
      html += '<button class="btn btn-sm" onclick="App.editTask(\'' + task.id + '\')">编辑</button>';
      html += '<button class="btn btn-sm btn-danger" onclick="App.deleteTask(\'' + task.id + '\')">删除</button>';
      html += '</div>';
      html += '</div>';
      html += '<div class="task-meta">';
      html += '<span>📅 ' + formatDate(task.date) + '</span>';
      html += '<span>🏷️ <span class="type-tag ' + typeClass + '" onclick="App.cycleType(\'' + task.id + '\')">' + typeLabels[task.type] + '</span></span>';
      if (task.people) html += '<span>👥 ' + task.people + ' 人</span>';
      if (task.seatCard) html += '<span>🪑 座位牌</span>';
      if (task.customerName) html += '<span>🏢 ' + textSafe(task.customerName) + (task.customerCode ? '（' + textSafe(task.customerCode) + '）' : '') + '</span>';
      if (task.contactPerson) html += '<span>🤝 对接：' + textSafe(task.contactPerson) + '</span>';
      if (task.meetingRoom) html += '<span>📍 ' + textSafe(task.meetingRoom) + '</span>';
      if (task.meetingCost) html += '<span>💰 ' + money(task.meetingCost) + '</span>';
      html += '</div>';
      if (!isDone && task.deadline) {
        html += '<div style="margin-bottom:0.5rem;padding-left:2rem;"><span class="deadline-tag ' + deadlineClass + '">⏰ ' + task.deadline + ' 前完成</span></div>';
      }
      if (!isDone && task.reminderTime) {
        html += '<div style="margin-bottom:0.5rem;padding-left:2rem;"><span class="deadline-tag normal-deadline">🔔 ' + formatReminder(task.reminderTime) + '</span></div>';
      }
      // Prep items
      html += '<div class="prep-list"><div class="prep-title">准备事项</div><ul>';
      task.prepItems.forEach(function(item, idx) {
        html += '<li class="' + (item.done ? 'done-item' : '') + '">';
        html += '<input type="checkbox"' + (item.done ? ' checked' : '') + ' onchange="App.togglePrep(\'' + task.id + '\',' + idx + ')">';
        html += '<span>' + item.text + '</span>';
        html += '</li>';
      });
      html += '</ul></div>';
      html += '</div>';
    });

    list.innerHTML = html || '<div style="text-align:center;padding:2rem;color:var(--muted);font-size:0.9rem;">暂无待办任务 ✨</div>';
    updateStats();
    renderHistory();
  }

  // ==================== RENDER HISTORY TABLE ====================
  function renderHistory() {
    var wrap = document.getElementById('historyTableWrap');
    var sorted = tasks.slice().sort(function(a, b) { return new Date(b.date) - new Date(a.date); });

    var html = '<table class="history-table"><thead><tr>';
    html += '<th>日期</th><th>等级</th><th>客户</th><th>对接人</th><th>会议室</th><th>费用</th><th>准备内容</th><th>状态</th>';
    html += '</tr></thead><tbody>';

    sorted.forEach(function(task) {
      var prepText = task.prepItems.map(function(i) { return i.text; }).join('、');
      var statusHtml = task.completed
        ? '<span style="color:var(--success);font-weight:600;">已完成</span>'
        : '<span style="color:var(--danger);font-weight:600;">待完成</span>';

      html += '<tr>';
      html += '<td>' + task.date.slice(5) + '</td>';
      html += '<td><span class="type-tag ' + task.type + '">' + typeLabels[task.type] + '</span></td>';
      html += '<td>' + textSafe(task.customerName || '') + (task.customerCode ? '<br><span style="color:var(--muted);font-size:0.72rem;">' + textSafe(task.customerCode) + '</span>' : '') + '</td>';
      html += '<td>' + textSafe(task.contactPerson || '') + '</td>';
      html += '<td>' + textSafe(task.meetingRoom || '') + '</td>';
      html += '<td>' + (task.meetingCost ? money(task.meetingCost) : '') + '</td>';
      html += '<td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="' + prepText.replace(/"/g, '&quot;') + '">' + prepText + '</td>';
      html += '<td>' + statusHtml + '</td>';
      html += '</tr>';
    });

    html += '</tbody></table>';
    wrap.innerHTML = html;
  }

  // ==================== DAILY TODOS ====================
  function todayISO() {
    var d = new Date();
    return d.toISOString().slice(0, 10);
  }

  function weekEndISO() {
    var d = new Date();
    var day = d.getDay();
    var daysToSaturday = 6 - day;
    d.setDate(d.getDate() + daysToSaturday);
    return d.toISOString().slice(0, 10);
  }

  function tomorrowISO() {
    var d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  }

  function monthEndISO() {
    var d = new Date();
    d = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    return d.toISOString().slice(0, 10);
  }

  function addHoursToLocalInput(dateTime, hours) {
    var d = new Date(dateTime);
    if (isNaN(d.getTime())) return dateTime;
    d.setHours(d.getHours() + hours);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  }

  function calcReminder(deadline, hoursBefore) {
    if (!deadline) return '';
    var d = new Date(deadline);
    if (isNaN(d.getTime())) return '';
    d.setHours(d.getHours() - hoursBefore);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  }

  function defaultDeadlineByScope(scope) {
    if (scope === 'tomorrow') return tomorrowISO() + 'T18:00';
    if (scope === 'week') return weekEndISO() + 'T18:00';
    if (scope === 'month') return monthEndISO() + 'T18:00';
    if (scope === 'longterm') return monthEndISO() + 'T18:00';
    return todayISO() + 'T18:00';
  }

  function meetingDeadlineDateTime(date, time) {
    if (!date) return '';
    return date + 'T' + (time || '09:00');
  }

  function defaultMeetingReminder(date, time) {
    return calcReminder(meetingDeadlineDateTime(date, time), USER_CONFIG.reminderRules.meetingHoursBefore);
  }

  function defaultVisaReminderDate(submitDate) {
    if (!submitDate) return '';
    var d = new Date(submitDate + 'T09:00');
    if (isNaN(d.getTime())) return '';
    d.setDate(d.getDate() - USER_CONFIG.reminderRules.visaDaysBefore);
    return d.toISOString().slice(0, 10);
  }

  function isOverdueTodo(item) {
    if (item.done || !item.deadline) return false;
    var d = new Date(item.deadline);
    return !isNaN(d.getTime()) && d < new Date();
  }

  function formatDeadline(value) {
    if (!value) return '未设置截止时间';
    var d = new Date(value);
    if (isNaN(d.getTime())) return '截止：' + value;
    var dateText = (d.getMonth() + 1) + '月' + d.getDate() + '日';
    var timeText = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    return '截止：' + dateText + ' ' + timeText;
  }

  function formatReminder(value) {
    if (!value) return '未设置提醒';
    return formatDeadline(value).replace('截止：', '提醒：');
  }

  function escapeHtml(text) {
    if (text == null) return '';
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function priorityLabel(priority) {
    if (priority === 'urgent') return '紧急';
    if (priority === 'important') return '重要';
    return '普通';
  }

  function priorityClass(priority) {
    if (priority === 'urgent') return 'level-a';
    if (priority === 'important') return 'level-b';
    return 'level-d';
  }

  function renderDailyTodos() {
    var todoBox = document.getElementById('dailyTodoList');
    var tomorrowBox = document.getElementById('tomorrowTodoList');
    var weekBox = document.getElementById('weeklyTodoList');
    var monthBox = document.getElementById('monthlyTodoList');
    var longtermBox = document.getElementById('longtermTodoList');
    var overdueBox = document.getElementById('overdueTodoList');
    var doneBox = document.getElementById('dailyDoneList');
    if (!todoBox || !tomorrowBox || !weekBox || !monthBox || !longtermBox || !overdueBox || !doneBox) return;

    var todayPending = dailyTodos.filter(function(item) { return item.scope === 'today' && !item.done; });
    var tomorrowPending = dailyTodos.filter(function(item) { return item.scope === 'tomorrow' && !item.done; });
    var weekPending = dailyTodos.filter(function(item) { return item.scope === 'week' && !item.done; });
    var monthPending = dailyTodos.filter(function(item) { return item.scope === 'month' && !item.done; });
    var longtermPending = dailyTodos.filter(function(item) { return item.scope === 'longterm' && !item.done; });
    var overdue = dailyTodos.filter(isOverdueTodo);
    var done = dailyTodos.filter(function(item) { return item.done; }).slice().sort(function(a, b) {
      return new Date(b.deadline || b.date) - new Date(a.deadline || a.date);
    });

    document.getElementById('dailyTodoCount').textContent = todayPending.length;
    document.getElementById('tomorrowTodoCount').textContent = tomorrowPending.length;
    document.getElementById('overdueTodoCount').textContent = overdue.length;
    document.getElementById('dailyDoneCount').textContent = done.length;

    renderTodoGroup(todoBox, todayPending, '今天暂无待办');
    renderTodoGroup(tomorrowBox, tomorrowPending, '明天暂无待办');
    renderTodoGroup(weekBox, weekPending, '本周暂无待办');
    renderTodoGroup(monthBox, monthPending, '本月暂无待办');
    renderTodoGroup(longtermBox, longtermPending, '暂无长期跟进');
    renderTodoGroup(overdueBox, overdue, '暂无逾期事项');
    renderTodoGroup(doneBox, done, '暂无已办记录');
  }

  function renderTodoGroup(container, list, emptyText) {
    container.innerHTML = list.map(function(item) {
      return renderDailyTodoItem(item, item.done);
    }).join('') || '<div style="text-align:center;padding:2rem;color:var(--muted);font-size:0.9rem;">' + emptyText + '</div>';
  }

  function scopeLabel(scope) {
    if (scope === 'tomorrow') return '明日待办';
    if (scope === 'week') return '本周待办';
    if (scope === 'month') return '本月待办';
    if (scope === 'longterm') return '长期跟进';
    return '今日待办';
  }

  function renderDailyTodoItem(item, done) {
    var hasSubs = item.subtasks && item.subtasks.length > 0;
    var subDoneCount = hasSubs ? item.subtasks.filter(function(s) { return s.done; }).length : 0;
    var subTotal = hasSubs ? item.subtasks.length : 0;
    var allSubsDone = hasSubs && subDoneCount === subTotal;
    var progressPct = subTotal > 0 ? Math.round((subDoneCount / subTotal) * 100) : 0;

    var subtasksHtml = '';
    if (hasSubs && !done) {
      subtasksHtml = '<div class="prep-list" style="margin-left:2rem;margin-top:0.4rem;">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.35rem;">' +
          '<span class="prep-title">进度 ' + subDoneCount + '/' + subTotal + '</span>' +
          '<span style="font-size:0.7rem;color:var(--muted);">' + progressPct + '%</span>' +
        '</div>' +
        '<div style="width:100%;height:4px;background:#e2e8f0;border-radius:2px;margin-bottom:0.5rem;overflow:hidden;">' +
          '<div style="width:' + progressPct + '%;height:100%;background:var(--success);border-radius:2px;transition:width 0.3s;"></div>' +
        '</div>' +
        '<ul>' + item.subtasks.map(function(sub, idx) {
          return '<li class="' + (sub.done ? 'done-item' : '') + '">' +
            '<input type="checkbox" ' + (sub.done ? 'checked' : '') + ' onchange="App.toggleSubtask(\'' + item.id + '\',' + idx + ')" style="cursor:pointer;"> ' +
            escapeHtml(sub.text) +
          '</li>';
        }).join('') + '</ul>' +
      '</div>';
    }

    var doneHint = '';
    if (hasSubs && allSubsDone && !done) {
      doneHint = '<div style="margin-left:2rem;margin-top:0.3rem;font-size:0.75rem;color:var(--success);">✓ 全部子任务已完成，点击左侧复选框归档</div>';
    }

    return '' +
      '<div class="task-item" data-id="' + item.id + '">' +
        '<div class="task-top">' +
          '<div class="task-title-row">' +
            '<div class="task-checkbox' + (done ? ' checked' : '') + '" onclick="App.toggleDailyTodo(\'' + item.id + '\')">' + (done ? '✓' : '') + '</div>' +
            '<div class="task-title' + (done ? ' completed' : '') + '">' + escapeHtml(item.text) + (hasSubs && !done ? ' <span style="font-size:0.75rem;color:var(--muted);font-weight:400;">(' + subDoneCount + '/' + subTotal + ')</span>' : '') + '</div>' +
          '</div>' +
          '<div class="task-actions">' +
            '<span class="type-tag ' + priorityClass(item.priority) + '">' + priorityLabel(item.priority) + '</span>' +
            '<button class="btn btn-sm" onclick="App.editDailyTodo(\'' + item.id + '\')">编辑</button>' +
            '<button class="btn btn-sm btn-danger" onclick="App.deleteDailyTodo(\'' + item.id + '\')">删除</button>' +
          '</div>' +
        '</div>' +
        '<div class="task-meta" style="padding-left:2rem;margin-bottom:0;">' +
          '<span>📌 ' + scopeLabel(item.scope) + '</span>' +
          '<span>⏰ ' + formatDeadline(item.deadline) + '</span>' +
          '<span>🔔 ' + formatReminder(item.reminder) + '</span>' +
        '</div>' +
        subtasksHtml +
        doneHint +
      '</div>';
  }

  App.addDailyTodo = function() {
    var input = document.getElementById('dailyTodoInput');
    var scope = document.getElementById('dailyTodoScope').value;
    var priority = document.getElementById('dailyTodoPriority').value;
    var deadline = document.getElementById('dailyTodoDeadline').value;
    var reminder = document.getElementById('dailyTodoReminder').value;
    var text = input.value.trim();
    App.addSubtaskFromInput();
    if (!text) {
      alert('请先输入待办内容');
      return;
    }
    if (!deadline) {
      deadline = defaultDeadlineByScope(scope);
    }
    if (!reminder) {
      reminder = calcReminder(deadline, USER_CONFIG.reminderRules.todoHoursBefore);
    }

    if (editingDailyTodoId) {
      var existing = dailyTodos.find(function(todo) { return todo.id === editingDailyTodoId; });
      if (existing) {
        existing.date = deadline.slice(0, 10);
        existing.scope = scope;
        existing.deadline = deadline;
        existing.reminder = reminder;
        existing.text = text;
        existing.priority = priority;
        existing.subtasks = editingSubtasks.length ? editingSubtasks.slice() : [];
      }
    } else {
      dailyTodos.push({
        id: 'd' + Date.now() + Math.random().toString(36).slice(2, 5),
        date: deadline.slice(0, 10),
        scope: scope,
        deadline: deadline,
        reminder: reminder,
        text: text,
        priority: priority,
        done: false,
        subtasks: editingSubtasks.length ? editingSubtasks.slice() : []
      });
    }
    saveDailyTodos(dailyTodos);
    resetDailyTodoForm();
    renderDailyTodos();
  };

  App.editDailyTodo = function(id) {
    var item = dailyTodos.find(function(todo) { return todo.id === id; });
    if (!item) return;
    editingDailyTodoId = id;
    editingSubtasks = (item.subtasks || []).map(function(s) { return { text: s.text, done: s.done }; });
    document.getElementById('dailyTodoInput').value = item.text;
    document.getElementById('dailyTodoScope').value = item.scope || 'today';
    document.getElementById('dailyTodoPriority').value = item.priority || 'normal';
    document.getElementById('dailyTodoDeadline').value = item.deadline || '';
    document.getElementById('dailyTodoReminder').value = item.reminder || '';
    document.getElementById('dailyTodoSaveBtn').textContent = '保存修改';
    document.getElementById('dailyTodoEditHint').style.display = 'block';
    App.renderSubtaskTags();
    document.getElementById('dailyTodoInput').focus();
  };

  App.cancelDailyTodoEdit = function() {
    resetDailyTodoForm();
  };

  function resetDailyTodoForm() {
    editingDailyTodoId = null;
    editingSubtasks = [];
    document.getElementById('dailyTodoInput').value = '';
    document.getElementById('dailyTodoDeadline').value = '';
    document.getElementById('dailyTodoReminder').value = '';
    document.getElementById('dailyTodoScope').value = 'today';
    document.getElementById('dailyTodoPriority').value = 'normal';
    document.getElementById('dailyTodoSaveBtn').textContent = '添加';
    document.getElementById('dailyTodoEditHint').style.display = 'none';
    App.renderSubtaskTags();
    setDefaultTodoDeadline();
  }

  App.toggleDailyTodo = function(id) {
    var item = dailyTodos.find(function(todo) { return todo.id === id; });
    if (!item) return;
    var hasSubs = item.subtasks && item.subtasks.length > 0;
    if (!item.done && hasSubs) {
      var allDone = item.subtasks.every(function(s) { return s.done; });
      if (!allDone) {
        alert('请先完成所有子任务节点，再归档该待办');
        return;
      }
    }
    item.done = !item.done;
    saveDailyTodos(dailyTodos);
    renderDailyTodos();
  };

  App.toggleSubtask = function(todoId, subIdx) {
    var item = dailyTodos.find(function(todo) { return todo.id === todoId; });
    if (!item || !item.subtasks || !item.subtasks[subIdx]) return;
    item.subtasks[subIdx].done = !item.subtasks[subIdx].done;
    saveDailyTodos(dailyTodos);
    renderDailyTodos();
  };

  App.onSubtaskKeydown = function(e) {
    if (e.key !== 'Enter') return;
    if (e.isComposing) return;
    e.preventDefault();
    App.addSubtaskFromInput();
  };

  App.addSubtaskFromInput = function() {
    var input = document.getElementById('dailyTodoSubtaskInput');
    if (!input) return;
    var text = input.value.trim();
    if (!text) return;
    editingSubtasks.push({ text: text, done: false });
    input.value = '';
    App.renderSubtaskTags();
  };

  App.renderSubtaskTags = function() {
    var wrap = document.getElementById('dailyTodoSubtasksList');
    if (!wrap) return;
    wrap.innerHTML = editingSubtasks.map(function(sub, idx) {
      return '<span style="display:inline-flex;align-items:center;gap:0.25rem;background:#eff6ff;color:var(--accent);padding:0.25rem 0.55rem;border-radius:5px;font-size:0.8rem;">' +
        escapeHtml(sub.text) +
        '<button onclick="App.removeSubtask(' + idx + ')" style="border:none;background:none;cursor:pointer;color:var(--accent);font-size:0.75rem;font-weight:700;padding:0;">×</button>' +
      '</span>';
    }).join('');
  };

  App.removeSubtask = function(idx) {
    editingSubtasks.splice(idx, 1);
    App.renderSubtaskTags();
  };

  App.deleteDailyTodo = function(id) {
    if (!confirm('确定删除这条待办吗？')) return;
    dailyTodos = dailyTodos.filter(function(todo) { return todo.id !== id; });
    saveDailyTodos(dailyTodos);
    renderDailyTodos();
  };

  // ==================== PHONE REGISTER ====================
  function money(n) {
    n = Number(n) || 0;
    return '¥' + n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function textSafe(value) {
    return String(value || '').replace(/[&<>"']/g, function(ch) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch];
    });
  }

  function nowLocalInput() {
    var d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  }

  function renderPhoneRecords() {
    var wrap = document.getElementById('phoneTableWrap');
    if (!wrap) return;
    var today = todayISO();
    var todayCount = phoneRecords.filter(function(r) { return (r.time || '').slice(0, 10) === today; }).length;
    var pending = phoneRecords.filter(function(r) { return r.status !== '已办结'; }).length;
    var urgent = phoneRecords.filter(function(r) { return r.level === 'level-s' || r.level === 'level-a'; }).length;
    var done = phoneRecords.filter(function(r) { return r.status === '已办结'; }).length;
    document.getElementById('phoneTodayCount').textContent = todayCount;
    document.getElementById('phonePendingCount').textContent = pending;
    document.getElementById('phoneUrgentCount').textContent = urgent;
    document.getElementById('phoneDoneCount').textContent = done;

    var sorted = phoneRecords.slice().sort(function(a, b) {
      return new Date(b.time || 0) - new Date(a.time || 0);
    });
    var html = '<table class="history-table"><thead><tr><th>来电时间</th><th>来电人</th><th>电话</th><th>分类</th><th>等级</th><th>事项</th><th>状态</th><th>承办</th><th>操作</th></tr></thead><tbody>';
    sorted.forEach(function(r) {
      html += '<tr>' +
        '<td>' + textSafe((r.time || '').replace('T', ' ')) + '</td>' +
        '<td>' + textSafe(r.caller || '') + '<br><span style="color:var(--muted);font-size:0.72rem;">' + textSafe(r.unit || '') + '</span></td>' +
        '<td>' + textSafe(r.phone || '') + '</td>' +
        '<td>' + textSafe(r.category || '其他') + '</td>' +
        '<td><span class="type-tag ' + (r.level || 'level-d') + '">' + textSafe(typeLabels[r.level] || 'D级') + '</span></td>' +
        '<td style="min-width:180px;">' + textSafe(r.matter || '') + '</td>' +
        '<td>' + textSafe(r.status || '') + '</td>' +
        '<td>' + textSafe(r.owner || '') + '</td>' +
        '<td><button class="btn btn-sm" onclick="App.editPhoneRecord(\'' + r.id + '\')">编辑</button> <button class="btn btn-sm btn-danger" onclick="App.deletePhoneRecord(\'' + r.id + '\')">删除</button></td>' +
      '</tr>';
    });
    html += '</tbody></table>';
    wrap.innerHTML = sorted.length ? html : '<div style="text-align:center;padding:2rem;color:var(--muted);font-size:0.9rem;">暂无电话登记</div>';
  }

  App.quickAddPhone = function() {
    var text = document.getElementById('phoneQuickInput').value.trim();
    if (!text) return;
    var rec = parsePhoneText(text);
    phoneRecords.push(rec);
    savePhoneRecords();
    document.getElementById('phoneQuickInput').value = '';
    renderPhoneRecords();
  };

  function parsePhoneText(text) {
    var phone = (text.match(/1[3-9]\d{9}|0\d{2,3}[-\s]?\d{7,8}/) || [''])[0];
    var level = 'level-d';
    if (/S级|重大|领导关注|投诉升级|舆情/.test(text)) level = 'level-s';
    else if (/A级|紧急|马上|立即|很急|今天必须/.test(text)) level = 'level-a';
    else if (/B级|跟进|转办|催|退款|投诉/.test(text)) level = 'level-b';
    else if (/C级|咨询|问一下/.test(text)) level = 'level-c';
    var category = '其他';
    if (/退款|退费|退票/.test(text)) category = '退款';
    else if (/投诉|不满|升级/.test(text)) category = '投诉';
    else if (/催办|催|尽快|进度/.test(text)) category = '催办';
    else if (/供应商|供方|厂家|服务商/.test(text)) category = '供应商';
    else if (/咨询|问一下|了解/.test(text)) category = '咨询';
    var caller = '';
    var callerMatch = text.match(/([一-龥A-Za-z]{2,8})\s*(?:来电|打电话|电话|说|反馈)/);
    if (callerMatch) caller = callerMatch[1];
    var unit = '';
    var unitMatch = text.match(/(?:单位|公司|来自|来源)[:：]?\s*([一-龥A-Za-z0-9（）()]{2,20})/);
    if (unitMatch) unit = unitMatch[1];
    var owner = '';
    var ownerMatch = text.match(/(?:转|交|给|由)([一-龥A-Za-z]{2,8})(?:处理|跟进|办理)/);
    if (ownerMatch) owner = ownerMatch[1];
    return {
      id: 'p' + Date.now() + Math.random().toString(36).slice(2, 5),
      time: nowLocalInput(),
      caller: caller,
      unit: unit,
      phone: phone,
      category: category,
      level: level,
      matter: text.replace(phone, '').trim(),
      status: /已处理|已办结|解决/.test(text) ? '已办结' : (/转办|转/.test(text) ? '已转办' : '待处理'),
      owner: owner,
      deadline: '',
      result: ''
    };
  }

  App.savePhoneRecord = function() {
    var rec = {
      id: editingPhoneId || ('p' + Date.now() + Math.random().toString(36).slice(2, 5)),
      time: document.getElementById('phoneTime').value || nowLocalInput(),
      caller: document.getElementById('phoneCaller').value.trim(),
      unit: document.getElementById('phoneUnit').value.trim(),
      phone: document.getElementById('phoneNumber').value.trim(),
      category: document.getElementById('phoneCategory').value,
      level: document.getElementById('phoneLevel').value,
      matter: document.getElementById('phoneMatter').value.trim(),
      status: document.getElementById('phoneStatus').value,
      owner: document.getElementById('phoneOwner').value.trim(),
      deadline: document.getElementById('phoneDeadline').value,
      result: document.getElementById('phoneResult').value.trim()
    };
    if (!rec.matter && !rec.caller && !rec.phone) { alert('请至少填写来电人、电话或事项'); return; }
    if (editingPhoneId) {
      var idx = phoneRecords.findIndex(function(r) { return r.id === editingPhoneId; });
      if (idx >= 0) phoneRecords[idx] = rec;
    } else {
      phoneRecords.push(rec);
    }
    savePhoneRecords();
    App.cancelPhoneEdit();
    renderPhoneRecords();
  };

  App.editPhoneRecord = function(id) {
    var r = phoneRecords.find(function(item) { return item.id === id; });
    if (!r) return;
    editingPhoneId = id;
    document.getElementById('phoneTime').value = r.time || '';
    document.getElementById('phoneCaller').value = r.caller || '';
    document.getElementById('phoneUnit').value = r.unit || '';
    document.getElementById('phoneNumber').value = r.phone || '';
    document.getElementById('phoneCategory').value = r.category || '其他';
    document.getElementById('phoneLevel').value = r.level || 'level-d';
    document.getElementById('phoneStatus').value = r.status || '待处理';
    document.getElementById('phoneOwner').value = r.owner || '';
    document.getElementById('phoneDeadline').value = r.deadline || '';
    document.getElementById('phoneMatter').value = r.matter || '';
    document.getElementById('phoneResult').value = r.result || '';
    document.getElementById('phoneSaveBtn').textContent = '保存修改';
    document.getElementById('phoneEditHint').style.display = 'inline';
  };

  App.cancelPhoneEdit = function() {
    editingPhoneId = null;
    ['phoneTime','phoneCaller','phoneUnit','phoneNumber','phoneOwner','phoneDeadline','phoneMatter','phoneResult'].forEach(function(id) { document.getElementById(id).value = ''; });
    document.getElementById('phoneCategory').value = '咨询';
    document.getElementById('phoneLevel').value = 'level-d';
    document.getElementById('phoneStatus').value = '待处理';
    document.getElementById('phoneSaveBtn').textContent = '登记';
    document.getElementById('phoneEditHint').style.display = 'none';
  };

  App.deletePhoneRecord = function(id) {
    if (!confirm('确定删除这条电话登记吗？')) return;
    phoneRecords = phoneRecords.filter(function(r) { return r.id !== id; });
    savePhoneRecords();
    renderPhoneRecords();
  };

  App.exportPhoneExcel = function() {
    var rows = [['来电时间','来电人','单位/来源','联系电话','分类','等级','事项','状态','承办/转办人','截止时间','处理结果']];
    phoneRecords.forEach(function(r) {
      rows.push([r.time, r.caller, r.unit, r.phone, r.category || '其他', typeLabels[r.level] || 'D级', r.matter, r.status, r.owner, r.deadline, r.result]);
    });
    var ws = XLSX.utils.aoa_to_sheet(rows);
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '电话接听登记');
    XLSX.writeFile(wb, '电话接听登记_' + todayISO() + '.xlsx');
  };

  // ==================== VISA REGISTER ====================
  function visaTotal(r) {
    return (Number(r.fee) || 0) + (Number(r.serviceFee) || 0) + (Number(r.extraFee) || 0);
  }

  function renderVisaRecords() {
    var wrap = document.getElementById('visaTableWrap');
    if (!wrap) return;
    var processing = visaRecords.filter(function(r) { return r.status !== '已出签' && r.status !== '已拒签'; }).length;
    var unpaid = visaRecords.filter(function(r) { return r.payStatus === '待付款'; }).length;
    var total = visaRecords.reduce(function(sum, r) { return sum + visaTotal(r); }, 0);
    var month = visaRecords.filter(function(r) { return isThisMonth(r.applyDate || todayISO()); }).length;
    document.getElementById('visaProcessingCount').textContent = processing;
    document.getElementById('visaUnpaidCount').textContent = unpaid;
    document.getElementById('visaTotalCost').textContent = money(total);
    document.getElementById('visaMonthCount').textContent = month;

    var sorted = visaRecords.slice().sort(function(a, b) { return new Date(b.applyDate || 0) - new Date(a.applyDate || 0); });
    var html = '<table class="history-table"><thead><tr><th>登记日期</th><th>申请人</th><th>部门</th><th>国家/类型/类别</th><th>预计出签</th><th>提醒日期</th><th>状态</th><th>支付</th><th>费用合计</th><th>明细</th><th>操作</th></tr></thead><tbody>';
    sorted.forEach(function(r) {
      html += '<tr>' +
        '<td>' + textSafe(r.applyDate || '') + '</td>' +
        '<td>' + textSafe(r.name || '') + '</td>' +
        '<td>' + textSafe(r.dept || '') + '</td>' +
        '<td>' + textSafe(r.country || '') + '<br><span style="color:var(--muted);font-size:0.72rem;">' + textSafe(r.type || '') + ' / ' + textSafe(r.category || '单次入境') + '</span></td>' +
        '<td>' + (r.workdays ? textSafe(r.workdays) + '个工作日' : '') + '</td>' +
        '<td>' + textSafe(r.reminderDate || '') + '</td>' +
        '<td>' + textSafe(r.status || '') + '</td>' +
        '<td>' + textSafe(r.payStatus || '') + '</td>' +
        '<td style="font-weight:700;color:var(--accent2);">' + money(visaTotal(r)) + '</td>' +
        '<td style="min-width:160px;">签证费 ' + money(r.fee) + '<br>服务费 ' + money(r.serviceFee) + '<br>其他 ' + money(r.extraFee) + '</td>' +
        '<td><button class="btn btn-sm" onclick="App.editVisaRecord(\'' + r.id + '\')">编辑</button> <button class="btn btn-sm btn-danger" onclick="App.deleteVisaRecord(\'' + r.id + '\')">删除</button></td>' +
      '</tr>';
    });
    html += '</tbody></table>';
    wrap.innerHTML = sorted.length ? html : '<div style="text-align:center;padding:2rem;color:var(--muted);font-size:0.9rem;">暂无签证登记</div>';
  }

  App.quickAddVisa = function() {
    var text = document.getElementById('visaQuickInput').value.trim();
    if (!text) return;
    visaRecords.push(parseVisaText(text));
    saveVisaRecords();
    document.getElementById('visaQuickInput').value = '';
    renderVisaRecords();
  };

  function parseVisaText(text) {
    function feeByKeyword(keyword) {
      var m = text.match(new RegExp(keyword + '\\\\s*([0-9]+(?:\\\\.[0-9]+)?)'));
      return m ? Number(m[1]) : 0;
    }
    var country = (text.match(/(日本|韩国|美国|英国|法国|德国|意大利|西班牙|新加坡|泰国|越南|印度|澳大利亚|加拿大|俄罗斯|申根)/) || [''])[0];
    var type = /旅游/.test(text) ? '旅游签' : (/工作/.test(text) ? '工作签' : (/探亲/.test(text) ? '探亲签' : (/商务/.test(text) ? '商务签' : '其他')));
    var category = '单次入境';
    if (/90天多次|90 天多次|三个月多次|多次往返/.test(text)) category = '90天多次往返';
    else if (/半年多次/.test(text)) category = '半年多次往返';
    else if (/一年多次/.test(text)) category = '一年多次往返';
    else if (/过境/.test(text)) category = '过境签';
    var workdayMatch = text.match(/(\d+)\s*个?工作日|(\d+)\s*天出签/);
    var nameMatch = text.match(/^([一-龥A-Za-z]{2,8})/);
    var deptMatch = text.match(/([一-龥A-Za-z]{2,12}部|[一-龥A-Za-z]{2,12}中心|[一-龥A-Za-z]{2,12}组)/);
    return {
      id: 'v' + Date.now() + Math.random().toString(36).slice(2, 5),
      applyDate: todayISO(),
      name: nameMatch ? nameMatch[1] : '',
      dept: deptMatch ? deptMatch[1] : '',
      country: country,
      type: type,
      category: category,
      status: /已出签/.test(text) ? '已出签' : (/已递交/.test(text) ? '已递交' : (/审核/.test(text) ? '审核中' : '资料准备中')),
      payStatus: /已付款|已支付/.test(text) ? '已付款' : (/报销/.test(text) ? '待报销' : '待付款'),
      submitDate: '',
      reminderDate: '',
      workdays: workdayMatch ? Number(workdayMatch[1] || workdayMatch[2]) : '',
      fee: feeByKeyword('签证费'),
      serviceFee: feeByKeyword('服务费'),
      extraFee: feeByKeyword('加急费|快递费|其他费|其他'),
      invoice: /发票/.test(text) ? '需发票' : '',
      note: text
    };
  }

  App.saveVisaRecord = function() {
    var rec = {
      id: editingVisaId || ('v' + Date.now() + Math.random().toString(36).slice(2, 5)),
      applyDate: document.getElementById('visaApplyDate').value || todayISO(),
      name: document.getElementById('visaName').value.trim(),
      dept: document.getElementById('visaDept').value.trim(),
      country: document.getElementById('visaCountry').value.trim(),
      type: document.getElementById('visaType').value,
      category: document.getElementById('visaCategory').value,
      status: document.getElementById('visaStatus').value,
      payStatus: document.getElementById('visaPayStatus').value,
      submitDate: document.getElementById('visaSubmitDate').value,
      reminderDate: document.getElementById('visaReminderDate').value || defaultVisaReminderDate(document.getElementById('visaSubmitDate').value),
      workdays: Number(document.getElementById('visaWorkdays').value) || '',
      fee: Number(document.getElementById('visaFee').value) || 0,
      serviceFee: Number(document.getElementById('visaServiceFee').value) || 0,
      extraFee: Number(document.getElementById('visaExtraFee').value) || 0,
      invoice: document.getElementById('visaInvoice').value.trim(),
      note: document.getElementById('visaNote').value.trim()
    };
    if (!rec.name && !rec.country) { alert('请至少填写申请人或国家/地区'); return; }
    if (editingVisaId) {
      var idx = visaRecords.findIndex(function(r) { return r.id === editingVisaId; });
      if (idx >= 0) visaRecords[idx] = rec;
    } else {
      visaRecords.push(rec);
    }
    saveVisaRecords();
    App.cancelVisaEdit();
    renderVisaRecords();
  };

  App.editVisaRecord = function(id) {
    var r = visaRecords.find(function(item) { return item.id === id; });
    if (!r) return;
    editingVisaId = id;
    document.getElementById('visaApplyDate').value = r.applyDate || '';
    document.getElementById('visaName').value = r.name || '';
    document.getElementById('visaDept').value = r.dept || '';
    document.getElementById('visaCountry').value = r.country || '';
    document.getElementById('visaType').value = r.type || '其他';
    document.getElementById('visaCategory').value = r.category || '单次入境';
    document.getElementById('visaStatus').value = r.status || '资料准备中';
    document.getElementById('visaPayStatus').value = r.payStatus || '待付款';
    document.getElementById('visaSubmitDate').value = r.submitDate || '';
    document.getElementById('visaReminderDate').value = r.reminderDate || defaultVisaReminderDate(r.submitDate || '');
    document.getElementById('visaWorkdays').value = r.workdays || '';
    document.getElementById('visaFee').value = r.fee || '';
    document.getElementById('visaServiceFee').value = r.serviceFee || '';
    document.getElementById('visaExtraFee').value = r.extraFee || '';
    document.getElementById('visaInvoice').value = r.invoice || '';
    document.getElementById('visaNote').value = r.note || '';
    document.getElementById('visaSaveBtn').textContent = '保存修改';
    document.getElementById('visaEditHint').style.display = 'inline';
  };

  App.cancelVisaEdit = function() {
    editingVisaId = null;
    ['visaApplyDate','visaName','visaDept','visaCountry','visaSubmitDate','visaReminderDate','visaWorkdays','visaFee','visaServiceFee','visaExtraFee','visaInvoice','visaNote'].forEach(function(id) { document.getElementById(id).value = ''; });
    document.getElementById('visaType').value = '商务签';
    document.getElementById('visaCategory').value = '单次入境';
    document.getElementById('visaStatus').value = '资料准备中';
    document.getElementById('visaPayStatus').value = '待付款';
    document.getElementById('visaSaveBtn').textContent = '登记';
    document.getElementById('visaEditHint').style.display = 'none';
  };

  App.deleteVisaRecord = function(id) {
    if (!confirm('确定删除这条签证登记吗？')) return;
    visaRecords = visaRecords.filter(function(r) { return r.id !== id; });
    saveVisaRecords();
    renderVisaRecords();
  };

  App.exportVisaExcel = function() {
    var rows = [['登记日期','申请人','部门','国家/地区','签证类型','签证类别','办理状态','支付/报销状态','递交日期','提醒日期','预计出签工作日','签证费','服务费','加急/快递/其他','费用合计','发票/报销','备注']];
    visaRecords.forEach(function(r) {
      rows.push([r.applyDate, r.name, r.dept, r.country, r.type, r.category || '单次入境', r.status, r.payStatus, r.submitDate, r.reminderDate || '', r.workdays || '', r.fee, r.serviceFee, r.extraFee, visaTotal(r), r.invoice, r.note]);
    });
    var ws = XLSX.utils.aoa_to_sheet(rows);
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '签证费用管控');
    XLSX.writeFile(wb, '签证费用管控_' + todayISO() + '.xlsx');
  };

  // ==================== UPDATE STATS ====================
  function updateStats() {
    var todayCount = 0, todayPrep = 0;
    var weekTotal = 0, weekDone = 0;
    var monthTotal = 0;
    var monthCost = 0;

    tasks.forEach(function(t) {
      if (isToday(t.date) && !t.completed) { todayCount++; todayPrep += t.prepItems.length; }
      if (isThisWeek(t.date)) { weekTotal++; if (t.completed) weekDone++; }
      if (isThisMonth(t.date)) { monthTotal++; monthCost += Number(t.meetingCost) || 0; }
    });

    document.getElementById('statToday').textContent = todayCount;
    document.getElementById('statTodaySub').textContent = todayCount > 0 ? todayPrep + ' 项准备任务' : '无待办';
    document.getElementById('statWeek').textContent = weekTotal;
    document.getElementById('statWeekSub').textContent = weekDone + ' 场已完成 / ' + (weekTotal - weekDone) + ' 场待准备';
    document.getElementById('statMonth').textContent = monthTotal;
    document.getElementById('statMonthSub').textContent = '累计 ' + monthTotal + ' 次接待';
    document.getElementById('statFee').textContent = money(monthCost);
  }

  // ==================== TASK ACTIONS ====================
  window.App = window.App || {};

  App.toggleTask = function(id) {
    var task = tasks.find(function(t) { return t.id === id; });
    if (!task) return;
    task.completed = !task.completed;
    if (task.completed) {
      task.prepItems.forEach(function(i) { i.done = true; });
    }
    saveTasks(tasks);
    renderTasks();
  };

  App.togglePrep = function(id, idx) {
    var task = tasks.find(function(t) { return t.id === id; });
    if (!task || !task.prepItems[idx]) return;
    task.prepItems[idx].done = !task.prepItems[idx].done;
    // Check if all done
    var allDone = task.prepItems.every(function(i) { return i.done; });
    if (allDone && !task.completed) {
      task.completed = true;
    }
    saveTasks(tasks);
    renderTasks();
  };

  App.cycleType = function(id) {
    var task = tasks.find(function(t) { return t.id === id; });
    if (!task) return;
    var i = typeOrder.indexOf(task.type);
    task.type = typeOrder[(i + 1) % typeOrder.length];
    saveTasks(tasks);
    renderTasks();
  };

  App.deleteTask = function(id) {
    if (!confirm('确定删除这条记录吗？')) return;
    tasks = tasks.filter(function(t) { return t.id !== id; });
    saveTasks(tasks);
    renderTasks();
  };

  // ==================== MODAL ====================
  var editingId = null;

  App.openAddModal = function() {
    editingId = null;
    document.getElementById('modalTitle').textContent = '新增接待任务';
    document.getElementById('modalSaveBtn').textContent = '添加';
    document.getElementById('formDate').value = '';
    document.getElementById('formType').value = 'level-d';
    document.getElementById('formDeadline').value = '09:00';
    document.getElementById('formReminderTime').value = '';
    document.getElementById('formPeople').value = '';
    document.getElementById('formCustomerName').value = '';
    document.getElementById('formCustomerCode').value = '';
    document.getElementById('formContactPerson').value = '';
    document.getElementById('formMeetingRoom').value = '';
    document.getElementById('formMeetingCost').value = '';
    document.getElementById('formSeatCard').value = 'no';
    document.getElementById('formNote').value = '';
    document.getElementById('formPrepItems').value = '';
    document.getElementById('taskModal').classList.add('show');
  };

  App.editTask = function(id) {
    var task = tasks.find(function(t) { return t.id === id; });
    if (!task) return;
    editingId = id;
    document.getElementById('modalTitle').textContent = '编辑接待任务';
    document.getElementById('modalSaveBtn').textContent = '保存';
    document.getElementById('formDate').value = task.date;
    document.getElementById('formType').value = task.type;
    document.getElementById('formDeadline').value = task.deadline || '09:00';
    document.getElementById('formReminderTime').value = task.reminderTime || defaultMeetingReminder(task.date, task.deadline || '09:00');
    document.getElementById('formPeople').value = task.people || '';
    document.getElementById('formCustomerName').value = task.customerName || '';
    document.getElementById('formCustomerCode').value = task.customerCode || '';
    document.getElementById('formContactPerson').value = task.contactPerson || '';
    document.getElementById('formMeetingRoom').value = task.meetingRoom || '';
    document.getElementById('formMeetingCost').value = task.meetingCost || '';
    document.getElementById('formSeatCard').value = task.seatCard ? 'yes' : 'no';
    document.getElementById('formNote').value = task.note || '';
    document.getElementById('formPrepItems').value = task.prepItems.map(function(i) { return i.text; }).join('\n');
    document.getElementById('taskModal').classList.add('show');
  };

  App.closeModal = function() {
    document.getElementById('taskModal').classList.remove('show');
    editingId = null;
  };

  App.saveTask = function() {
    var date = document.getElementById('formDate').value;
    if (!date) { alert('请选择日期'); return; }
    var type = document.getElementById('formType').value;
    var deadline = document.getElementById('formDeadline').value;
    var reminderTime = document.getElementById('formReminderTime').value || defaultMeetingReminder(date, deadline);
    var people = document.getElementById('formPeople').value ? parseInt(document.getElementById('formPeople').value) : null;
    var customerName = document.getElementById('formCustomerName').value.trim();
    var customerCode = document.getElementById('formCustomerCode').value.trim();
    var contactPerson = document.getElementById('formContactPerson').value.trim();
    var meetingRoom = document.getElementById('formMeetingRoom').value.trim();
    var meetingCost = document.getElementById('formMeetingCost').value ? Number(document.getElementById('formMeetingCost').value) : 0;
    var seatCard = document.getElementById('formSeatCard').value === 'yes';
    var note = document.getElementById('formNote').value.trim();
    var prepText = document.getElementById('formPrepItems').value.trim();
    var prepItems = prepText ? prepText.split('\n').map(function(line) {
      return { text: line.trim(), done: false };
    }).filter(function(i) { return i.text; }) : [];

    if (editingId) {
      var task = tasks.find(function(t) { return t.id === editingId; });
      if (task) {
        task.date = date; task.type = type; task.deadline = deadline;
        task.reminderTime = reminderTime;
        task.people = people; task.seatCard = seatCard; task.note = note;
        task.customerName = customerName; task.customerCode = customerCode;
        task.contactPerson = contactPerson; task.meetingRoom = meetingRoom;
        task.meetingCost = meetingCost;
        // Preserve existing done states for matching items
        var oldMap = {};
        task.prepItems.forEach(function(i) { oldMap[i.text] = i.done; });
        task.prepItems = prepItems.map(function(i) {
          return { text: i.text, done: oldMap[i.text] !== undefined ? oldMap[i.text] : false };
        });
      }
    } else {
      tasks.push({
        id: genId(), date: date, type: type, deadline: deadline, reminderTime: reminderTime,
        people: people, seatCard: seatCard, note: note,
        customerName: customerName, customerCode: customerCode,
        contactPerson: contactPerson, meetingRoom: meetingRoom,
        meetingCost: meetingCost,
        prepItems: prepItems, completed: false
      });
    }

    saveTasks(tasks);
    App.closeModal();
    renderTasks();
  };

  // ==================== QUICK ADD ====================
  App.quickAdd = function() {
    var text = document.getElementById('quickInput').value.trim();
    if (!text) return;

    // Parse natural language input
    var task = parseNaturalInput(text);
    tasks.push(task);
    saveTasks(tasks);
    document.getElementById('quickInput').value = '';
    renderTasks();
  };

  function parseNaturalInput(text) {
    var task = {
      id: genId(), date: '', type: 'level-d', deadline: '09:00',
      reminderTime: '',
      people: null, seatCard: false, note: '', prepItems: [], completed: false,
      customerName: '', customerCode: '', contactPerson: '', meetingRoom: '', meetingCost: 0
    };

    // Date detection
    var dateMatch = text.match(/(今天|明天|后天|大后天|(\d{1,2})月(\d{1,2})[日号]|(\d{4})-(\d{2})-(\d{2}))/);
    if (dateMatch) {
      if (dateMatch[1] === '今天') {
        var d = new Date();
        task.date = d.toISOString().slice(0, 10);
      } else if (dateMatch[1] === '明天') {
        var d = new Date(); d.setDate(d.getDate() + 1);
        task.date = d.toISOString().slice(0, 10);
      } else if (dateMatch[1] === '后天') {
        var d = new Date(); d.setDate(d.getDate() + 2);
        task.date = d.toISOString().slice(0, 10);
      } else if (dateMatch[2] && dateMatch[3]) {
        task.date = '2026-' + dateMatch[2].padStart(2, '0') + '-' + dateMatch[3].padStart(2, '0');
      } else if (dateMatch[4]) {
        task.date = dateMatch[4] + '-' + dateMatch[5] + '-' + dateMatch[6];
      }
    } else {
      var d = new Date(); task.date = d.toISOString().slice(0, 10);
    }

    // Time detection
    var timeMatch = text.match(/(\d{1,2})[点时:：](\d{0,2})\s*(前|之前|以前)?/);
    if (timeMatch) {
      var h = parseInt(timeMatch[1]); var m = parseInt(timeMatch[2]) || 0;
      if (h > 0 && h <= 23) task.deadline = h.toString().padStart(2, '0') + ':' + m.toString().padStart(2, '0');
    }

    // Type detection
    if (text.match(/S级|s级|S 级|s 级|最高级|VIP|vip|贵宾/)) { task.type = 'level-s'; task.seatCard = true; }
    else if (text.match(/A级|a级|A 级|a 级|高优|高管|领导/)) { task.type = 'level-a'; }
    else if (text.match(/B级|b级|B 级|b 级|重要/)) { task.type = 'level-b'; }
    else if (text.match(/C级|c级|C 级|c 级/)) { task.type = 'level-c'; }
    else if (text.match(/D级|d级|D 级|d 级|普通/)) { task.type = 'level-d'; }

    // People count
    var peopleMatch = text.match(/(\d+)\s*[人名位个]/);
    if (peopleMatch) task.people = parseInt(peopleMatch[1]);

    // Seat card
    if (text.match(/座位牌|桌牌|名牌/)) task.seatCard = true;

    var customerMatch = text.match(/(?:客户|来访单位|客户名称)[:：]?\s*([一-龥A-Za-z0-9（）()·\-_]{2,30})/);
    if (customerMatch) task.customerName = customerMatch[1];

    var codeMatch = text.match(/(?:客户代码|代码|项目代码)[:：]?\s*([A-Za-z0-9\-_]{2,30})/);
    if (codeMatch) task.customerCode = codeMatch[1];

    var contactMatch = text.match(/(?:对接人|对接|联系人)[:：]?\s*([一-龥A-Za-z]{2,10})/);
    if (contactMatch) task.contactPerson = contactMatch[1];

    var roomMatch = text.match(/([A-Za-z0-9一二三四五六七八九十\d楼层号号\-_\s]{1,20}(?:会议室|洽谈室|接待室))/);
    if (roomMatch) task.meetingRoom = roomMatch[1].trim();

    var costMatch = text.match(/(?:费用|花费|金额|预算)[:：]?\s*(?:¥|￥)?\s*(\d+(?:\.\d+)?)\s*(?:元|块)?/);
    if (costMatch) task.meetingCost = Number(costMatch[1]) || 0;

    var foundItems = extractPrepItems(text, task);
    task.prepItems = foundItems.map(function(t) { return { text: t, done: false }; });
    task.reminderTime = defaultMeetingReminder(task.date, task.deadline);
    task.note = '';
    return task;
  }

  function extractPrepItems(text, task) {
    var items = [];
    var seen = {};

    function add(label) {
      label = label.replace(/\s+/g, '').replace(/[，,。.；;！!、]+$/g, '');
      if (!label || seen[label]) return;
      seen[label] = true;
      items.push(label);
    }

    function cnToNum(str) {
      if (!str) return '';
      var map = { 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };
      if (/^\d+$/.test(str)) return str;
      if (str === '十') return '10';
      if (str.indexOf('十') >= 0) {
        var parts = str.split('十');
        var ten = parts[0] ? map[parts[0]] : 1;
        var one = parts[1] ? map[parts[1]] : 0;
        return String(ten * 10 + one);
      }
      return map[str] ? String(map[str]) : str;
    }

    function qtyNear(keyword, unitPattern) {
      var units = unitPattern || '份|杯|瓶|个|只|套|张|台|支|盒|包';
      var reg1 = new RegExp('(?:' + keyword + ')\\\\s*([一二两三四五六七八九十\\\\d]+)\\\\s*(' + units + ')');
      var reg2 = new RegExp('([一二两三四五六七八九十\\\\d]+)\\\\s*(' + units + ')\\\\s*(?:' + keyword + ')');
      var m = text.match(reg1) || text.match(reg2);
      if (!m) return '';
      return cnToNum(m[1]) + m[2];
    }

    if (/水果|果盘|三宫格/.test(text)) {
      var fruitQty = qtyNear('水果|果盘', '份|盘|盒');
      var fruit = '水果' + (fruitQty ? ' ' + fruitQty : '');
      if (/三宫格/.test(text)) fruit += ' - 三宫格摆盘';
      add(fruit);
    }

    if (/咖啡/.test(text)) add('咖啡' + (qtyNear('咖啡', '杯|份') ? ' ' + qtyNear('咖啡', '杯|份') : ''));
    if (/茶|茶水/.test(text)) add('茶' + (qtyNear('茶|茶水', '杯|份|壶') ? ' ' + qtyNear('茶|茶水', '杯|份|壶') : ''));
    if (/矿泉水/.test(text)) add('矿泉水' + (qtyNear('矿泉水', '瓶|箱') ? ' ' + qtyNear('矿泉水', '瓶|箱') : ''));
    if (/耳机/.test(text)) add('耳机' + (qtyNear('耳机', '个|副') ? ' ' + qtyNear('耳机', '个|副') : ''));
    if (/排插|插排|插线板/.test(text)) add('排插' + (qtyNear('排插|插排|插线板', '个|只') ? ' ' + qtyNear('排插|插排|插线板', '个|只') : ''));
    if (/投影|投影仪/.test(text)) add('投影仪');
    if (/白板笔/.test(text)) add('白板笔' + (qtyNear('白板笔', '支|盒') ? ' ' + qtyNear('白板笔', '支|盒') : ''));
    else if (/白板/.test(text)) add('白板');
    if (/座位牌|桌牌|名牌/.test(text) || task.seatCard) add('座位牌' + (task.people ? ' ' + task.people + '张' : ''));
    if (/资料|材料|文件/.test(text)) add('会议资料');
    if (/签到/.test(text)) add('签到表');
    if (/鲜花/.test(text)) add('鲜花');
    if (/礼品|伴手礼/.test(text)) add('礼品');
    if (/纸巾/.test(text)) add('纸巾');
    if (/杯子|纸杯/.test(text)) add('纸杯');
    if (/麦克风|话筒/.test(text)) add('麦克风');
    if (/横幅/.test(text)) add('横幅');
    if (/展架|易拉宝/.test(text)) add('展架');

    return items;
  }

  // ==================== EXPORT EXCEL ====================
  App.exportExcel = function() {
    var data = tasks.slice().sort(function(a, b) { return new Date(b.date) - new Date(a.date); });
    var rows = [['日期', '会议等级', '客户名称', '客户代码', '对接人', '会议室', '费用金额', '参会人数', '座位牌', '截止时间', '提醒时间', '准备事项', '备注', '状态']];
    data.forEach(function(t) {
      rows.push([
        t.date,
        typeLabels[t.type],
        t.customerName || '',
        t.customerCode || '',
        t.contactPerson || '',
        t.meetingRoom || '',
        t.meetingCost || 0,
        t.people || '',
        t.seatCard ? '是' : '否',
        t.deadline || '',
        t.reminderTime || '',
        t.prepItems.map(function(i) { return i.text; }).join('、'),
        t.note || '',
        t.completed ? '已完成' : '待完成'
      ]);
    });

    var ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 12 }, { wch: 10 }, { wch: 18 }, { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 10 }, { wch: 8 }, { wch: 8 }, { wch: 10 }, { wch: 18 }, { wch: 40 }, { wch: 20 }, { wch: 8 }];
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '接待记录');
    XLSX.writeFile(wb, '接待记录_' + new Date().toISOString().slice(0, 10) + '.xlsx');
  };

  // ==================== DASHBOARD CHARTS ====================
  var chartInstances = {};

  function getThemeColors() {
    var s = getComputedStyle(document.documentElement);
    return {
      accent: s.getPropertyValue('--accent').trim(),
      accent2: s.getPropertyValue('--accent2').trim(),
      ink: s.getPropertyValue('--ink').trim(),
      muted: s.getPropertyValue('--muted').trim(),
      rule: s.getPropertyValue('--rule').trim(),
      bg2: s.getPropertyValue('--bg2').trim(),
      success: s.getPropertyValue('--success').trim()
    };
  }

  App.renderDashboardCharts = function() {
    var c = getThemeColors();

    // Monthly trend (last 6 months)
    var months = [];
    var now = new Date();
    for (var i = 5; i >= 0; i--) {
      var d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ label: (d.getMonth() + 1) + '月', year: d.getFullYear(), month: d.getMonth() });
    }

    var monthCounts = months.map(function(m) {
      return tasks.filter(function(t) {
        var td = new Date(t.date);
        return td.getFullYear() === m.year && td.getMonth() === m.month;
      }).length;
    });

    if (chartInstances.trend) chartInstances.trend.dispose();
    chartInstances.trend = echarts.init(document.getElementById('chart-monthly-trend'), null, { renderer: 'svg' });
    chartInstances.trend.setOption({
      animation: false,
      tooltip: { trigger: 'axis', appendToBody: true },
      grid: { top: 30, right: 20, bottom: 30, left: 45 },
      xAxis: { type: 'category', data: months.map(function(m) { return m.label; }), axisLine: { lineStyle: { color: c.rule } }, axisLabel: { color: c.muted, fontSize: 12 } },
      yAxis: { type: 'value', minInterval: 1, axisLine: { show: false }, splitLine: { lineStyle: { color: c.rule, type: 'dashed' } }, axisLabel: { color: c.muted, fontSize: 12 } },
      series: [{
        type: 'bar', data: monthCounts, barWidth: 32, itemStyle: { borderRadius: [4, 4, 0, 0], color: c.accent }
      }]
    });

    // Type distribution
    var typeCounts = { 'level-s': 0, 'level-a': 0, 'level-b': 0, 'level-c': 0, 'level-d': 0 };
    tasks.forEach(function(t) {
      var type = typeLabels[t.type] ? t.type : 'level-d';
      typeCounts[type]++;
    });

    if (chartInstances.typeDist) chartInstances.typeDist.dispose();
    chartInstances.typeDist = echarts.init(document.getElementById('chart-type-dist'), null, { renderer: 'svg' });
    chartInstances.typeDist.setOption({
      animation: false,
      tooltip: { trigger: 'item', appendToBody: true, formatter: '{b}: {c} 次 ({d}%)' },
      legend: { orient: 'vertical', right: 10, top: 'center', textStyle: { color: c.muted, fontSize: 12 }, itemWidth: 10, itemHeight: 10, itemGap: 14 },
      series: [{
        type: 'pie', radius: ['45%', '72%'], center: ['35%', '50%'],
        itemStyle: { borderRadius: 6, borderColor: c.bg2, borderWidth: 2 },
        label: { show: false },
        emphasis: { label: { show: true, fontSize: 13, fontWeight: 'bold', color: c.ink, formatter: '{b}\n{c} 次' } },
        color: ['#db2777', '#ef4444', c.accent2, c.success, c.accent],
        data: [
          { value: typeCounts['level-s'], name: 'S级' },
          { value: typeCounts['level-a'], name: 'A级' },
          { value: typeCounts['level-b'], name: 'B级' },
          { value: typeCounts['level-c'], name: 'C级' },
          { value: typeCounts['level-d'], name: 'D级' }
        ]
      }]
    });

    // Prep items frequency
    var prepFreq = {};
    tasks.forEach(function(t) {
      t.prepItems.forEach(function(item) {
        // Normalize: take first 4 chars
        var key = item.text.length > 6 ? item.text.slice(0, 6) : item.text;
        prepFreq[key] = (prepFreq[key] || 0) + 1;
      });
    });

    var prepArr = Object.keys(prepFreq).map(function(k) { return { name: k, value: prepFreq[k] }; });
    prepArr.sort(function(a, b) { return b.value - a.value; });
    prepArr = prepArr.slice(0, 10);

    if (chartInstances.prepFreq) chartInstances.prepFreq.dispose();
    chartInstances.prepFreq = echarts.init(document.getElementById('chart-prep-freq'), null, { renderer: 'svg' });
    chartInstances.prepFreq.setOption({
      animation: false,
      tooltip: { trigger: 'axis', appendToBody: true },
      grid: { top: 20, right: 20, bottom: 40, left: 100 },
      xAxis: { type: 'value', axisLine: { show: false }, splitLine: { lineStyle: { color: c.rule, type: 'dashed' } }, axisLabel: { color: c.muted, fontSize: 12 } },
      yAxis: { type: 'category', data: prepArr.map(function(p) { return p.name; }).reverse(), axisLine: { lineStyle: { color: c.rule } }, axisLabel: { color: c.ink, fontSize: 11, width: 90, overflow: 'truncate' } },
      series: [{
        type: 'bar', data: prepArr.map(function(p) { return p.value; }).reverse(),
        barWidth: 18, itemStyle: { borderRadius: [0, 4, 4, 0], color: c.accent2 }
      }]
    });

    window.addEventListener('resize', function() {
      Object.keys(chartInstances).forEach(function(k) { chartInstances[k].resize(); });
    });
  };

  // ==================== TRAVEL FEE ANALYSIS ====================
  var travelData = null;

  // Upload handling
  var uploadZone = document.getElementById('uploadZone');
  var fileInput = document.getElementById('fileInput');

  uploadZone.addEventListener('click', function() { fileInput.click(); });
  uploadZone.addEventListener('dragover', function(e) { e.preventDefault(); uploadZone.classList.add('dragover'); });
  uploadZone.addEventListener('dragleave', function() { uploadZone.classList.remove('dragover'); });
  uploadZone.addEventListener('drop', function(e) {
    e.preventDefault(); uploadZone.classList.remove('dragover');
    if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
  });
  fileInput.addEventListener('change', function() {
    if (fileInput.files.length) handleFile(fileInput.files[0]);
  });

  function handleFile(file) {
    var reader = new FileReader();
    reader.onload = function(e) {
      try {
        var data = new Uint8Array(e.target.result);
        var wb = XLSX.read(data, { type: 'array' });
        var ws = wb.Sheets[wb.SheetNames[0]];
        var json = XLSX.utils.sheet_to_json(ws, { defval: '' });
        if (json.length === 0) { alert('表格为空'); return; }
        analyzeTravel(json);
      } catch(err) {
        alert('文件读取失败：' + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
  }

  function getTaxRates() {
    var rates = {};
    document.querySelectorAll('.tax-rate-input').forEach(function(el) {
      rates[el.dataset.type] = parseFloat(el.value) / 100 || 0;
    });
    return rates;
  }

  function analyzeTravel(json) {
    var taxRates = getTaxRates();

    // Try to detect column names (flexible matching)
    var headers = Object.keys(json[0]);
    var colMap = detectColumns(headers);

    // Build records
    var records = json.map(function(row) {
      return {
        name: String(row[colMap.name] || '').trim(),
        dept: String(row[colMap.dept] || '').trim(),
        type: normalizeType(String(row[colMap.type] || ''), colMap),
        amount: parseAmount(row[colMap.amount])
      };
    }).filter(function(r) { return r.amount > 0 && r.name; });

    travelData = { raw: json, records: records, colMap: colMap };

    // Calculate
    var totalAmount = 0, totalTax = 0;
    records.forEach(function(r) {
      totalAmount += r.amount;
      var rate = taxRates[r.type] || 0.09;
      totalTax += r.amount * rate;
    });

    // Department aggregation
    var deptMap = {};
    records.forEach(function(r) {
      if (!deptMap[r.dept]) deptMap[r.dept] = { flight: 0, hotel: 0, train: 0, other: 0, total: 0 };
      var dept = deptMap[r.dept];
      if (r.type === '机票') dept.flight += r.amount;
      else if (r.type === '酒店') dept.hotel += r.amount;
      else if (r.type === '火车') dept.train += r.amount;
      else dept.other += r.amount;
      dept.total += r.amount;
    });

    var deptRanking = Object.keys(deptMap).map(function(k) {
      var d = deptMap[k];
      var tax = d.flight * (taxRates['机票'] || 0) + d.hotel * (taxRates['酒店'] || 0) + d.train * (taxRates['火车'] || 0) + d.other * 0.09;
      return { dept: k, flight: d.flight, hotel: d.hotel, train: d.train, other: d.other, total: d.total, tax: tax };
    }).sort(function(a, b) { return b.total - a.total; });

    // Person aggregation
    var personMap = {};
    records.forEach(function(r) {
      if (!personMap[r.name]) personMap[r.name] = { name: r.name, dept: r.dept, total: 0, count: 0 };
      personMap[r.name].total += r.amount;
      personMap[r.name].count++;
      personMap[r.name].dept = r.dept;
    });
    var topPeople = Object.values(personMap).sort(function(a, b) { return b.total - a.total; }).slice(0, 10);

    // Render
    renderTravelSummary(totalAmount, totalTax, records.length);
    renderDeptRanking(deptRanking);
    renderTopPeople(topPeople);
    renderDeptChart(deptRanking);

    document.getElementById('travelResults').style.display = 'block';
  }

  function detectColumns(headers) {
    var map = { name: '', dept: '', type: '', amount: '' };
    headers.forEach(function(h) {
      var l = h.toLowerCase();
      if (!map.name && (l.match(/姓名|名字|出行人|员工|申请人|user|name/))) map.name = h;
      if (!map.dept && (l.match(/部门|department|dept|组织/))) map.dept = h;
      if (!map.type && (l.match(/类型|项目|type|category|费用类型|费项/))) map.type = h;
      if (!map.amount && (l.match(/金额|费用|amount|price|总价|总额|合计|cost/))) map.amount = h;
    });
    // Fallbacks
    if (!map.name && headers.length > 0) map.name = headers[0];
    if (!map.amount && headers.length > 1) map.amount = headers[headers.length - 1];
    return map;
  }

  function normalizeType(val) {
    var v = val.toLowerCase();
    if (v.match(/机票|flight|飞机|航空/)) return '机票';
    if (v.match(/酒店|hotel|住宿|宾馆/)) return '酒店';
    if (v.match(/火车|train|高铁|动车|铁路/)) return '火车';
    if (v.match(/打车|taxi|滴滴|出租|交通/)) return '交通';
    if (v.match(/餐饮|meal|餐饮费/)) return '餐饮';
    return '其他';
  }

  function parseAmount(val) {
    if (typeof val === 'number') return Math.abs(val);
    var str = String(val).replace(/[¥￥,，\s]/g, '');
    var num = parseFloat(str);
    return isNaN(num) ? 0 : Math.abs(num);
  }

  function fmt(n) { return '¥' + n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

  function renderTravelSummary(total, tax, count) {
    document.getElementById('travelSummary').innerHTML =
      '<div class="stat-card"><div class="stat-label">差旅总费用（含税）</div><div class="stat-value warn">' + fmt(total + tax) + '</div><div class="stat-sub">' + count + ' 条记录</div></div>' +
      '<div class="stat-card"><div class="stat-label">税额合计</div><div class="stat-value accent">' + fmt(tax) + '</div><div class="stat-sub">按配置税率自动计算</div></div>' +
      '<div class="stat-card"><div class="stat-label">费用总额（不含税）</div><div class="stat-value">' + fmt(total) + '</div><div class="stat-sub">原始金额</div></div>';
  }

  function renderDeptRanking(ranking) {
    var html = '<table class="rank-table"><thead><tr><th>#</th><th>部门</th><th>机票</th><th>酒店</th><th>火车</th><th>税额</th><th>总费用</th></tr></thead><tbody>';
    ranking.forEach(function(d, i) {
      var cls = i === 0 ? 'top1' : (i === 1 ? 'top2' : (i === 2 ? 'top3' : ''));
      html += '<tr>';
      html += '<td><span class="rank-num ' + cls + '">' + (i + 1) + '</span></td>';
      html += '<td style="font-weight:600;">' + d.dept + '</td>';
      html += '<td>' + fmt(d.flight) + '</td>';
      html += '<td>' + fmt(d.hotel) + '</td>';
      html += '<td>' + fmt(d.train) + '</td>';
      html += '<td style="color:var(--accent);">' + fmt(d.tax) + '</td>';
      html += '<td style="font-weight:700;">' + fmt(d.total + d.tax) + '</td>';
      html += '</tr>';
    });
    html += '</tbody></table>';
    document.getElementById('deptRankTable').innerHTML = html;
  }

  function renderTopPeople(people) {
    var html = '<table class="rank-table"><thead><tr><th>#</th><th>姓名</th><th>部门</th><th>出行次数</th><th>总费用</th></tr></thead><tbody>';
    people.forEach(function(p, i) {
      var cls = i === 0 ? 'top1' : (i === 1 ? 'top2' : (i === 2 ? 'top3' : ''));
      html += '<tr>';
      html += '<td><span class="rank-num ' + cls + '">' + (i + 1) + '</span></td>';
      html += '<td style="font-weight:600;">' + p.name + '</td>';
      html += '<td>' + p.dept + '</td>';
      html += '<td>' + p.count + ' 次</td>';
      html += '<td style="font-weight:700;color:var(--accent2);">' + fmt(p.total) + '</td>';
      html += '</tr>';
    });
    html += '</tbody></table>';
    document.getElementById('topPeopleTable').innerHTML = html;
  }

  function renderDeptChart(ranking) {
    var c = getThemeColors();
    var depts = ranking.map(function(d) { return d.dept; });
    var flights = ranking.map(function(d) { return d.flight; });
    var hotels = ranking.map(function(d) { return d.hotel; });
    var trains = ranking.map(function(d) { return d.train; });
    var others = ranking.map(function(d) { return d.other; });

    if (chartInstances.deptBar) chartInstances.deptBar.dispose();
    chartInstances.deptBar = echarts.init(document.getElementById('chart-dept-bar'), null, { renderer: 'svg' });
    chartInstances.deptBar.setOption({
      animation: false,
      tooltip: { trigger: 'axis', appendToBody: true, axisPointer: { type: 'shadow' } },
      legend: { top: 0, textStyle: { color: c.muted, fontSize: 12 }, itemWidth: 12, itemHeight: 12 },
      grid: { top: 40, right: 20, bottom: 30, left: 80 },
      xAxis: { type: 'value', axisLine: { show: false }, splitLine: { lineStyle: { color: c.rule, type: 'dashed' } }, axisLabel: { color: c.muted, fontSize: 11, formatter: function(v) { return v >= 10000 ? (v / 10000).toFixed(0) + '万' : v; } } },
      yAxis: { type: 'category', data: depts.reverse(), axisLine: { lineStyle: { color: c.rule } }, axisLabel: { color: c.ink, fontSize: 11 } },
      series: [
        { name: '机票', type: 'bar', stack: 'total', data: flights.reverse(), itemStyle: { color: c.accent } },
        { name: '酒店', type: 'bar', stack: 'total', data: hotels.reverse(), itemStyle: { color: c.accent2 } },
        { name: '火车', type: 'bar', stack: 'total', data: trains.reverse(), itemStyle: { color: '#6366f1' } },
        { name: '其他', type: 'bar', stack: 'total', data: others.reverse(), itemStyle: { color: c.muted } }
      ]
    });
    window.addEventListener('resize', function() { if (chartInstances.deptBar) chartInstances.deptBar.resize(); });
  }

  // ==================== INIT ====================
  // Set topbar date
  var now = new Date();
  document.getElementById('topbarDate').textContent =
    now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0') + ' 星期' + weekDays[now.getDay()];

  function addRequestedFruitTaskOnce() {
    var meetingExists = tasks.some(function(task) {
      return task.date === '2026-07-17' && task.prepItems && task.prepItems.some(function(item) {
        return /水果/.test(item.text) && /3|三/.test(item.text);
      });
    });
    if (!meetingExists) {
      tasks.push({
        id: 't-fruit-20260717',
        date: '2026-07-17',
        type: 'level-d',
        deadline: '09:00',
        people: null,
        seatCard: false,
        note: '会议接待准备',
        prepItems: [
          { text: '水果 3份', done: false }
        ],
        completed: false
      });
      saveTasks(tasks);
    }

    var todoExists = dailyTodos.some(function(todo) {
      return todo.date === '2026-07-17' && /水果/.test(todo.text) && /3|三/.test(todo.text);
    });
    if (!todoExists) {
      dailyTodos.push({
        id: 'd-fruit-20260717',
        date: '2026-07-17',
        scope: 'week',
        deadline: '2026-07-17T18:00',
        text: '准备水果 3份',
        priority: 'important',
        done: false
      });
      saveDailyTodos(dailyTodos);
    }
  }

  function renderAllModules() {
    safeExec(function() { renderTasks(); });
    safeExec(function() { renderDailyTodos(); });
    safeExec(function() { renderPhoneRecords(); });
    safeExec(function() { renderVisaRecords(); });
    safeExec(function() { updateStats(); });
  }

  function initWorkbench() {
    safeExec(function() { renderAuthBar(); });
    safeExec(function() { initChecklist(); });
    safeExec(function() { initChecklistViewToggle(); });
    if (authToken) {
      loadServerData().then(function() {
        safeExec(function() { addRequestedFruitTaskOnce(); });
        renderAllModules();
      }).catch(function(err) {
        console.error('[初始化错误]', err);
        safeExec(function() { addRequestedFruitTaskOnce(); });
        renderAllModules();
      });
    } else {
      safeExec(function() { addRequestedFruitTaskOnce(); });
      renderAllModules();
    }
  }

  function setDefaultTodoDeadline() {
    var scopeEl = document.getElementById('dailyTodoScope');
    var deadlineEl = document.getElementById('dailyTodoDeadline');
    var reminderEl = document.getElementById('dailyTodoReminder');
    if (!scopeEl || !deadlineEl) return;
    if (!deadlineEl.value) deadlineEl.value = defaultDeadlineByScope(scopeEl.value);
    if (reminderEl && !reminderEl.value) {
      reminderEl.value = calcReminder(deadlineEl.value, USER_CONFIG.reminderRules.todoHoursBefore);
    }
  }

  var todoScopeEl = document.getElementById('dailyTodoScope');
  var todoInputEl = document.getElementById('dailyTodoInput');
  if (todoScopeEl) {
    todoScopeEl.addEventListener('change', function() {
      var deadlineEl = document.getElementById('dailyTodoDeadline');
      if (deadlineEl) deadlineEl.value = '';
      var reminderEl = document.getElementById('dailyTodoReminder');
      if (reminderEl) reminderEl.value = '';
      setDefaultTodoDeadline();
    });
  }
  var todoDeadlineEl = document.getElementById('dailyTodoDeadline');
  if (todoDeadlineEl) {
    todoDeadlineEl.addEventListener('change', function() {
      var reminderEl = document.getElementById('dailyTodoReminder');
      if (reminderEl) reminderEl.value = calcReminder(todoDeadlineEl.value, USER_CONFIG.reminderRules.todoHoursBefore);
    });
  }
  if (todoInputEl) {
    todoInputEl.addEventListener('focus', setDefaultTodoDeadline);
    todoInputEl.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && !e.isComposing) App.addDailyTodo();
    });
  }
  var subtaskInputEl = document.getElementById('dailyTodoSubtaskInput');
  if (subtaskInputEl) {
    subtaskInputEl.addEventListener('keydown', function(e) {
      if (e.key !== 'Enter') return;
      if (e.isComposing) return;
      e.preventDefault();
      App.addSubtaskFromInput();
    });
  }
  setDefaultTodoDeadline();

  var visaSubmitEl = document.getElementById('visaSubmitDate');
  if (visaSubmitEl) {
    visaSubmitEl.addEventListener('change', function() {
      var reminderEl = document.getElementById('visaReminderDate');
      if (reminderEl) reminderEl.value = defaultVisaReminderDate(visaSubmitEl.value);
    });
  }

  // Close modal on overlay click
  document.getElementById('taskModal').addEventListener('click', function(e) {
    if (e.target === this) App.closeModal();
  });

  // ==================== 云端版：全屏登录遮罩逻辑 ====================
  (function cloudLoginGate() {
    var overlay = document.getElementById('loginOverlay');
    if (!overlay) return; // 非云端版（没有遮罩DOM）就跳过

    var isRegisterMode = false;
    var userInput = document.getElementById('cloudLoginUser');
    var passInput = document.getElementById('cloudLoginPass');
    var loginBtn = document.getElementById('cloudLoginBtn');
    var errEl = document.getElementById('cloudLoginError');
    var toggleLink = document.getElementById('cloudToggleRegister');

    function setMode(reg) {
      isRegisterMode = reg;
      if (loginBtn) loginBtn.textContent = reg ? '注 册' : '登 录';
      if (toggleLink) toggleLink.textContent = reg ? '已有账号？返回登录' : '没有账号？点击注册';
      if (errEl) errEl.textContent = '';
    }

    function showOverlay() { overlay.classList.remove('hidden'); }
    function hideOverlay() { overlay.classList.add('hidden'); }

    function doSubmit() {
      var u = (userInput.value || '').trim();
      var p = passInput.value || '';
      if (!u || !p) { errEl.textContent = '请输入账号和密码'; return; }
      if (p.length < 6) { errEl.textContent = '密码至少6位'; return; }
      errEl.textContent = isRegisterMode ? '注册中...' : '登录中...';

      var endpoint = isRegisterMode ? '/api/auth/register' : '/api/auth/login';
      apiFetch(endpoint, {
        method: 'POST',
        body: JSON.stringify({ username: u, password: p })
      }).then(function(data) {
        // 登录/注册成功：保存token，加载服务器数据，关遮罩
        setAuth(data.token, data.user);
        if (isRegisterMode) {
          // 注册后把本机数据迁移到服务器（如果有的话）
          return App.migrateLocalToServer(true).then(function() {
            return loadServerData();
          });
        } else {
          return loadServerData();
        }
      }).then(function() {
        renderAllModules();
        hideOverlay();
        alert(isRegisterMode ? '注册成功，数据已同步' : '登录成功');
      }).catch(function(err) {
        errEl.textContent = (err && err.message) || '操作失败，请重试';
      });
    }

    if (loginBtn) loginBtn.addEventListener('click', doSubmit);
    if (toggleLink) toggleLink.addEventListener('click', function() { setMode(!isRegisterMode); });
    if (passInput) passInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && !e.isComposing) doSubmit();
    });
    if (userInput) userInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && !e.isComposing) { if (passInput) passInput.focus(); }
    });

    // 退出登录时重新显示遮罩
    var origLogout = App.logout;
    App.logout = function() {
      origLogout();
      if (userInput) userInput.value = '';
      if (passInput) passInput.value = '';
      setMode(false);
      showOverlay();
    };

    // 启动时：已登录且能取到服务器数据就直接进，否则强制登录取消遮罩
    if (authToken) {
      // 验证token：尝试取一次数据
      loadServerData().then(function() {
        renderAllModules();
        hideOverlay();
      }).catch(function() {
        // token失效，清掉
        setAuth('', null);
        showOverlay();
      });
    } else {
      showOverlay();
    }
  })();

  initWorkbench();

})();
