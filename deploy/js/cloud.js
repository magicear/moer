/* ============================================================
 *  魔耳 - 云服务模块
 *  封装登录、云同步、会员系统
 *  默认使用本地模拟模式，设置 CLOUD_CONFIG.mode = 'remote' 切换到真实后端
 * ============================================================ */
(function(window) {
  'use strict';

  const STORAGE_KEYS = {
    user: 'moer_user',
    token: 'moer_token',
    vipExpire: 'moer_vip_expire',
    cloudSyncTime: 'moer_cloud_sync_time',
  };

  // 云配置 — 通过 http(s) 访问时自动连接后端，file:// 本地打开时用本地模拟
  const CLOUD_CONFIG = {
    mode: (location.protocol === 'http:' || location.protocol === 'https:') ? 'remote' : 'local',
    apiBase: '/api',        // 后端 API 地址
    appId: 'moer-ear-001',  // 应用ID
  };

  // ---------- 工具 ----------
  function storageGet(k) {
    try { return JSON.parse(localStorage.getItem(k)); } catch(e) { return null; }
  }
  function storageSet(k, v) {
    localStorage.setItem(k, JSON.stringify(v));
  }
  function storageDel(k) {
    localStorage.removeItem(k);
  }

  // ---------- 用户 ----------
  function getCurrentUser() {
    return storageGet(STORAGE_KEYS.user);
  }
  function getToken() {
    return storageGet(STORAGE_KEYS.token);
  }
  function isLoggedIn() {
    return !!getToken() && !!getCurrentUser();
  }

  // 注册
  async function register({ username, email, password }) {
    if (CLOUD_CONFIG.mode === 'remote') {
      const res = await apiPost('/auth/register', { username, email, password });
      storageSet(STORAGE_KEYS.user, res.user);
      storageSet(STORAGE_KEYS.token, res.token);
      if (res.user.vipExpire) storageSet(STORAGE_KEYS.vipExpire, res.user.vipExpire);
      return res.user;
    }
    // 本地模拟
    if (!username || username.length < 2) throw new Error('用户名至少2位');
    if (!password || password.length < 6) throw new Error('密码至少6位');
    const users = storageGet('moer_users') || {};
    if (users[username]) throw new Error('用户名已存在');
    const user = {
      id: 'u_' + Date.now(),
      username,
      email: email || '',
      createdAt: Date.now(),
      avatar: null,
    };
    users[username] = { ...user, password };
    storageSet('moer_users', users);
    const token = 'tok_' + Math.random().toString(36).slice(2, 18);
    storageSet(STORAGE_KEYS.user, user);
    storageSet(STORAGE_KEYS.token, token);
    return user;
  }

  // 登录
  async function login({ username, password }) {
    if (CLOUD_CONFIG.mode === 'remote') {
      const res = await apiPost('/auth/login', { username, password });
      storageSet(STORAGE_KEYS.user, res.user);
      storageSet(STORAGE_KEYS.token, res.token);
      if (res.user.vipExpire) storageSet(STORAGE_KEYS.vipExpire, res.user.vipExpire);
      return res.user;
    }
    // 本地模拟
    const users = storageGet('moer_users') || {};
    const u = users[username];
    if (!u) throw new Error('用户不存在');
    if (u.password !== password) throw new Error('密码错误');
    const user = { id: u.id, username: u.username, email: u.email, createdAt: u.createdAt, avatar: u.avatar };
    const token = 'tok_' + Math.random().toString(36).slice(2, 18);
    storageSet(STORAGE_KEYS.user, user);
    storageSet(STORAGE_KEYS.token, token);
    return user;
  }

  // 登出
  function logout() {
    storageDel(STORAGE_KEYS.user);
    storageDel(STORAGE_KEYS.token);
  }

  // ---------- 会员 ----------
  function isVip() {
    const expire = storageGet(STORAGE_KEYS.vipExpire);
    if (expire && expire > Date.now()) return true;
    const u = getCurrentUser();
    if (u && u.vipExpire && u.vipExpire > Date.now()) return true;
    return false;
  }
  function getVipInfo() {
    const expire = storageGet(STORAGE_KEYS.vipExpire);
    const u = getCurrentUser();
    const serverExpire = (u && u.vipExpire) || 0;
    const effectiveExpire = Math.max(expire || 0, serverExpire);
    return {
      isVip: effectiveExpire > Date.now(),
      expireAt: effectiveExpire || null,
      daysLeft: effectiveExpire > Date.now() ? Math.max(0, Math.ceil((effectiveExpire - Date.now()) / 86400000)) : 0,
    };
  }
  // 模拟激活会员（演示用）
  function activateVip(days = 30) {
    const expire = Date.now() + days * 86400000;
    storageSet(STORAGE_KEYS.vipExpire, expire);
    return getVipInfo();
  }

  // 会员权限检查
  function checkVipRequired(contentLevel = 'basic') {
    // basic = 免费，premium = 会员专享
    if (contentLevel === 'basic') return { allowed: true };
    if (isVip()) return { allowed: true };
    return { allowed: false, reason: 'vip_required', message: '此内容为会员专享，开通会员即可观看全部内容' };
  }

  // ---------- 互动数据云同步（喜欢/收藏/稍后再看/历史/评论） ----------
  function mapIOut(i) {
    return {
      videoId: i.videoId, liked: i.liked ? 1 : 0, favored: i.favored ? 1 : 0,
      watchLater: i.watchLater ? 1 : 0, watchCount: i.watchCount || 0,
      lastWatchedAt: i.lastWatchedAt || 0, progress: i.progress || 0, duration: i.duration || 0
    };
  }

  async function syncInteractionsUp() {
    if (CLOUD_CONFIG.mode !== 'remote' || !isLoggedIn()) return false;
    const comments = [];
    for (const vid of Object.keys(Data.S.comments)) {
      for (const c of Data.S.comments[vid]) {
        comments.push({ id: c.id, videoId: c.videoId, text: c.text, author: c.author || '', createdAt: c.createdAt });
      }
    }
    await apiPost('/interactions/upload', {
      interactions: Object.values(Data.S.interactions).map(mapIOut),
      comments
    });
    storageSet(STORAGE_KEYS.interSyncTime, Date.now());
    return true;
  }

  let pushTimer = null;
  function queueInteractionSync() {
    if (CLOUD_CONFIG.mode !== 'remote' || !isLoggedIn()) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(() => { syncInteractionsUp().catch(() => {}); }, 4000);
  }

  async function pullInteractions() {
    if (CLOUD_CONFIG.mode !== 'remote' || !isLoggedIn()) return false;
    const data = await apiGet('/interactions/download');
    let changed = false;
    for (const r of (data.interactions || [])) {
      const loc = Data.S.interactions[r.videoId];
      const srvNewer = !loc || ((r.lastWatchedAt || 0) >= (loc.lastWatchedAt || 0));
      const rec = srvNewer ? {
        videoId: r.videoId, liked: !!r.liked, favored: !!r.favored, watchLater: !!r.watchLater,
        watchCount: r.watchCount || 0, lastWatchedAt: r.lastWatchedAt || 0,
        progress: r.progress || 0, duration: r.duration || 0
      } : loc;
      Data.S.interactions[r.videoId] = rec;
      await DB.put('interactions', rec);
      changed = true;
    }
    const have = new Set();
    for (const vid of Object.keys(Data.S.comments)) Data.S.comments[vid].forEach((c) => have.add(c.id));
    for (const c of (data.comments || [])) {
      if (have.has(c.id)) continue;
      const rec = { id: c.id, videoId: c.videoId, text: c.text, author: c.author || '', createdAt: c.createdAt };
      (Data.S.comments[c.videoId] = Data.S.comments[c.videoId] || []).push(rec);
      await DB.put('comments', rec);
      changed = true;
    }
    if (changed) Data.emit('imported', {});
    return changed;
  }

  // ---------- 云同步 ----------
  async function syncToCloud() {
    if (!isLoggedIn()) throw new Error('请先登录');
    if (CLOUD_CONFIG.mode === 'remote') {
      // 真实后端：推送所有数据
      const data = {
        videos: await DB.getAll('videos'),
        series: await DB.getAll('series'),
        interactions: await DB.getAll('interactions'),
        comments: await DB.getAll('comments'),
        settings: Data.S.settings,
        follows: Data.S.follows,
      };
      await apiPost('/sync/upload', data);
      storageSet(STORAGE_KEYS.cloudSyncTime, Date.now());
      return true;
    }
    // 本地模拟：存入 localStorage
    const data = {
      syncedAt: Date.now(),
      user: getCurrentUser(),
    };
    storageSet('moer_cloud_backup', data);
    storageSet(STORAGE_KEYS.cloudSyncTime, Date.now());
    return true;
  }

  async function syncFromCloud() {
    if (!isLoggedIn()) throw new Error('请先登录');
    if (CLOUD_CONFIG.mode === 'remote') {
      const data = await apiGet('/sync/download');
      // TODO: 合并本地与云端数据
      return data;
    }
    const data = storageGet('moer_cloud_backup');
    return data || null;
  }

  function getLastSyncTime() {
    return storageGet(STORAGE_KEYS.cloudSyncTime);
  }

  // ---------- 网络状态 & 重连 ----------
  let isOnline = navigator.onLine !== false;
  let reconnectCallbacks = [];
  function onReconnect(fn) { reconnectCallbacks.push(fn); }

  window.addEventListener('online', () => {
    if (!isOnline) {
      isOnline = true;
      toast('网络已恢复');
      reconnectCallbacks.forEach((fn) => { try { fn(); } catch (e) {} });
      reconnectCallbacks = [];
    }
  });
  window.addEventListener('offline', () => {
    isOnline = false;
    toast('网络已断开，部分功能暂不可用');
  });

  // ---------- 通用 API 请求（remote 模式用，带重试） ----------
  async function apiGet(path, retries) {
    if (retries === undefined) retries = 1;
    try {
      const res = await fetch(CLOUD_CONFIG.apiBase + path, {
        headers: { 'Authorization': 'Bearer ' + getToken() },
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    } catch (e) {
      if (retries > 0 && !isOnline) {
        await new Promise((r) => setTimeout(r, 2000));
        return apiGet(path, retries - 1);
      }
      throw e;
    }
  }
  async function apiPost(path, body, retries) {
    if (retries === undefined) retries = 1;
    try {
      const res = await fetch(CLOUD_CONFIG.apiBase + path, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + getToken(),
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    } catch (e) {
      if (retries > 0 && !isOnline) {
        await new Promise((r) => setTimeout(r, 2000));
        return apiPost(path, body, retries - 1);
      }
      throw e;
    }
  }
  function apiUpload(path, formData, onProgress, onDone) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', CLOUD_CONFIG.apiBase + path);
      xhr.setRequestHeader('Authorization', 'Bearer ' + getToken());
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable && onProgress) onProgress(Math.round(e.loaded / e.total * 100));
      });
      xhr.upload.addEventListener('load', () => { if (onDone) onDone(); });
      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try { resolve(JSON.parse(xhr.responseText)); } catch (e) { resolve(null); }
        } else {
          reject(new Error(xhr.responseText || ('上传失败(' + xhr.status + ')')));
        }
      });
      xhr.addEventListener('error', () => reject(new Error('网络错误，上传失败')));
      xhr.addEventListener('abort', () => reject(new Error('上传已取消')));
      xhr.timeout = 600000;
      xhr.addEventListener('timeout', () => reject(new Error('上传超时，请检查网络')));
      xhr.send(formData);
    });
  }

  // ---------- 云端片库（审核通过的视频合并到本机） ----------
  async function fetchLibrary() {
    if (CLOUD_CONFIG.mode !== 'remote') return false;
    const lib = await apiGet('/library');
    let changed = false;
    for (const s of lib.series || []) {
      if (!Data.seriesById(s.id)) {
        const rec = { id: s.id, name: s.name, avatar: null, bio: '', createdAt: s.createdAt || Date.now() };
        Data.S.series.push(rec);
        await DB.put('series', rec);
        changed = true;
      }
    }
    for (const v of lib.videos || []) {
      if (Data.videoById(v.id)) continue;
      const rec = {
        id: v.id,
        title: v.title,
        description: v.description || '',
        categoryId: v.categoryId,
        seriesId: v.seriesId || null,
        blob: null,
        fileName: null,
        size: v.size || 0,
        addedAt: v.addedAt || Date.now(),
        thumb: v.thumb || null,
        videoUrl: v.url,
        preAdId: v.preAdId || '',
        midAdId: v.midAdId || '',
        postAdId: v.postAdId || '',
        vipOnly: v.vipOnly || 0,
      };
      Data.S.videos.push(rec);
      await DB.put('videos', rec);
      if (rec.seriesId && Data.isFollowed(rec.seriesId)) {
        const s = Data.seriesById(rec.seriesId);
        if (s) {
          await Data.addNotification({
            type: 'update',
            content: `你关注的系列「${s.name}」发布了新视频《${rec.title}》`,
            videoId: rec.id,
            seriesId: rec.seriesId
          });
        }
      }
      changed = true;
    }
    if (changed) Data.emit('videos', {});
    return changed;
  }

  function isAdmin() {
    const u = getCurrentUser();
    return !!(u && u.role === 'admin');
  }

  // ---------- 导出 ----------
  window.Cloud = {
    CONFIG: CLOUD_CONFIG,
    // 用户
    register, login, logout,
    getCurrentUser, getToken, isLoggedIn, isAdmin,
    // 会员
    isVip, getVipInfo, activateVip, checkVipRequired,
    // 云同步
    syncToCloud, syncFromCloud, getLastSyncTime,
    // 互动数据同步
    syncInteractionsUp, pullInteractions, queueInteractionSync,
    // API / 投稿
    apiGet, apiPost, apiUpload, fetchLibrary,
    // 网络状态
    onReconnect,
    get isOnline() { return isOnline; },
  };
})(window);
