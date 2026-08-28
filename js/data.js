const CATEGORIES = [
  { id: 'hanlu', name: '含露', age: '0-3岁', icon: 'baby' },
  { id: 'faya', name: '发芽', age: '3-6岁', icon: 'child' },
  { id: 'bacui', name: '拔翠', age: '6-12岁', icon: 'kid' },
  { id: 'chumang', name: '出芒', age: '12岁以上', icon: 'teen' },
  { id: 'guoxiang', name: '果香', age: '成人', icon: 'adult' }
];

const Data = (() => {
  const S = {
    videos: [],
    series: [],
    interactions: {},
    comments: {},
    notifications: [],
    messages: [],
    follows: [],
    settings: { muted: true, volume: 1 }
  };

  const subs = new Set();
  function on(fn) { subs.add(fn); return () => subs.delete(fn); }
  function emit(evt, detail) { subs.forEach((f) => { try { f(evt, detail); } catch (e) {} }); }

  function uid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  }

  function catName(id) { const c = CATEGORIES.find((x) => x.id === id); return c ? c.name : '未知栏目'; }
  function catAge(id) { const c = CATEGORIES.find((x) => x.id === id); return c ? c.age : ''; }
  function videoById(id) { return S.videos.find((v) => v.id === id) || null; }
  function seriesById(id) { return S.series.find((s) => s.id === id) || null; }
  function seriesName(v) { const s = v.seriesId ? seriesById(v.seriesId) : null; return s ? s.name : '未分组'; }
  function isFollowed(seriesId) { return S.follows.some((f) => f.seriesId === seriesId); }

  async function kvSet(key, value) { await DB.put('kv', { key, value }); }

  async function loadAll() {
    const [videos, series, interactions, comments, notifications, messages, kv] = await Promise.all([
      DB.getAll('videos'), DB.getAll('series'), DB.getAll('interactions'),
      DB.getAll('comments'), DB.getAll('notifications'), DB.getAll('messages'), DB.getAll('kv')
    ]);
    S.videos = videos;
    S.series = series;
    S.interactions = {};
    interactions.forEach((i) => { S.interactions[i.videoId] = i; });
    S.comments = {};
    comments.sort((a, b) => a.createdAt - b.createdAt).forEach((c) => {
      (S.comments[c.videoId] = S.comments[c.videoId] || []).push(c);
    });
    S.notifications = notifications.sort((a, b) => b.createdAt - a.createdAt);
    S.messages = messages.sort((a, b) => a.createdAt - b.createdAt);
    S.kvRaw = {};
    kv.forEach((r) => { S.kvRaw[r.key] = r.value; });
    S.follows = (S.kvRaw.follows || []).filter((f) => seriesById(f.seriesId));
    S.settings = Object.assign({ muted: true, volume: 1 }, S.kvRaw.settings || {});
    S.welcomed = !!S.kvRaw.welcomed;
  }

  function getInter(videoId) {
    if (!S.interactions[videoId]) {
      S.interactions[videoId] = { videoId, liked: false, favored: false, watchLater: false, watchCount: 0, lastWatchedAt: null, progress: 0, duration: 0 };
    }
    return S.interactions[videoId];
  }

  async function toggleFlag(videoId, field) {
    const i = getInter(videoId);
    i[field] = !i[field];
    await DB.put('interactions', i);
    emit('interact', { videoId, field, value: i[field] });
    return i[field];
  }

  async function recordWatch(videoId) {
    const i = getInter(videoId);
    i.watchCount++;
    i.lastWatchedAt = Date.now();
    await DB.put('interactions', i);
    emit('interact', { videoId });
  }

  async function saveProgress(videoId, progress, duration) {
    const i = getInter(videoId);
    i.progress = progress || 0;
    if (duration) i.duration = duration;
    await DB.put('interactions', i);
  }

  async function clearHistoryOne(videoId) {
    const i = getInter(videoId);
    i.lastWatchedAt = null;
    i.watchCount = 0;
    i.progress = 0;
    await DB.put('interactions', i);
    emit('interact', { videoId });
  }

  async function clearHistoryAll() {
    for (const id of Object.keys(S.interactions)) {
      const i = S.interactions[id];
      i.lastWatchedAt = null;
      i.watchCount = 0;
      i.progress = 0;
      await DB.put('interactions', i);
    }
    emit('interact', {});
  }

  function commentCount(videoId) { return (S.comments[videoId] || []).length; }

  async function addComment(videoId, text, author) {
    const c = { id: uid(), videoId, text, author: author || commentAuthor(), createdAt: Date.now() };
    (S.comments[videoId] = S.comments[videoId] || []).push(c);
    await DB.put('comments', c);
    emit('comments', { videoId });
  }

  function commentAuthor() {
    try {
      if (Cloud && Cloud.isLoggedIn()) {
        const u = Cloud.getCurrentUser();
        if (u && u.username) return u.username;
      }
    } catch (e) {}
    return '游客';
  }

  async function deleteComment(commentId) {
    for (const vid of Object.keys(S.comments)) {
      const idx = S.comments[vid].findIndex((c) => c.id === commentId);
      if (idx >= 0) {
        S.comments[vid].splice(idx, 1);
        await DB.del('comments', commentId);
        emit('comments', { videoId: vid });
        return;
      }
    }
  }

  async function addSeries(name, { avatarFile, bio, presetAvatar } = {}) {
    const avatar = presetAvatar ? { type: 'preset', key: presetAvatar } : (avatarFile || null);
    const s = { id: uid(), name, avatar, bio: bio || '', createdAt: Date.now() };
    S.series.push(s);
    await DB.put('series', s);
    emit('series', {});
    return s;
  }

  async function updateSeries(id, { name, avatarFile, bio, presetAvatar }) {
    const s = seriesById(id);
    if (!s) return;
    if (name !== undefined) s.name = name;
    if (avatarFile !== undefined) s.avatar = avatarFile;
    if (presetAvatar !== undefined) s.avatar = presetAvatar ? { type: 'preset', key: presetAvatar } : s.avatar;
    if (bio !== undefined) s.bio = bio || '';
    await DB.put('series', s);
    emit('series', {});
  }

  async function updateVideo(id, { title, description, categoryId, seriesId }) {
    const v = videoById(id);
    if (!v) return;
    if (title !== undefined) v.title = title;
    if (description !== undefined) v.description = description || '';
    if (categoryId !== undefined) v.categoryId = categoryId;
    if (seriesId !== undefined) v.seriesId = seriesId || null;
    await DB.put('videos', v);
    emit('videos', {});
    return v;
  }

  async function deleteSeries(id) {
    for (const v of S.videos) {
      if (v.seriesId === id) { v.seriesId = null; await DB.put('videos', v); }
    }
    S.series = S.series.filter((s) => s.id !== id);
    await DB.del('series', id);
    S.follows = S.follows.filter((f) => f.seriesId === id);
    await kvSet('follows', S.follows);
    const convMsgs = S.messages.filter((m) => m.convId === id);
    for (const m of convMsgs) await DB.del('messages', m.id);
    S.messages = S.messages.filter((m) => m.convId !== id);
    emit('series', {});
    emit('follows', {});
    emit('messages', {});
  }

  async function addVideoFiles(files, categoryId, seriesId, customTitle) {
    const added = [];
    for (const f of files) {
      const title = (files.length === 1 && customTitle && customTitle.trim())
        ? customTitle.trim()
        : f.name.replace(/\.[^.]+$/, '');
      const v = { id: uid(), title, description: '', categoryId, seriesId: seriesId || null, blob: f, fileName: f.name, size: f.size, addedAt: Date.now(), thumb: null, videoUrl: null };
      S.videos.push(v);
      await DB.put('videos', v);
      added.push(v);
    }
    for (const v of added) {
      if (v.seriesId && isFollowed(v.seriesId)) {
        const s = seriesById(v.seriesId);
        await addNotification({
          type: 'update',
          content: `你关注的系列「${s.name}」发布了新视频《${v.title}》`,
          videoId: v.id,
          seriesId: v.seriesId
        });
      }
    }
    emit('videos', {});
    return added.length;
  }

  // 添加外链视频（通过 URL，不存本地）
  async function addVideoByUrl({ url, title, description, categoryId, seriesId, thumb }) {
    if (!url) throw new Error('视频链接不能为空');
    const v = {
      id: uid(),
      title: title || url.split('/').pop() || '未命名视频',
      description: description || '',
      categoryId,
      seriesId: seriesId || null,
      blob: null,
      fileName: null,
      size: 0,
      addedAt: Date.now(),
      thumb: thumb || null,
      videoUrl: url
    };
    S.videos.push(v);
    await DB.put('videos', v);
    if (v.seriesId && isFollowed(v.seriesId)) {
      const s = seriesById(v.seriesId);
      if (s) {
        await addNotification({
          type: 'update',
          content: `你关注的系列「${s.name}」发布了新视频《${v.title}》`,
          videoId: v.id,
          seriesId: v.seriesId
        });
      }
    }
    emit('videos', {});
    return v;
  }

  // 获取视频播放源：优先 videoUrl，否则本地 blob
  function getVideoSrc(v) {
    if (!v) return '';
    if (v.videoUrl) return v.videoUrl;
    if (v.blob) return UI.blobUrl(v.id + ':vid', v.blob);
    return '';
  }

  function isUrlVideo(v) { return !!(v && v.videoUrl); }

  async function renameVideo(id, title) {
    const v = videoById(id);
    if (!v) return;
    v.title = title;
    await DB.put('videos', v);
    emit('videos', {});
  }

  async function deleteVideo(id) {
    const v = videoById(id);
    if (!v) return;
    S.videos = S.videos.filter((x) => x.id !== id);
    await DB.del('videos', id);
    if (S.interactions[id]) { delete S.interactions[id]; await DB.del('interactions', id); }
    const cs = S.comments[id] || [];
    for (const c of cs) await DB.del('comments', c.id);
    delete S.comments[id];
    UI.revokeUrl(id + ':vid');
    emit('videos', {});
  }

  async function followSeries(seriesId) {
    if (isFollowed(seriesId)) return;
    S.follows.push({ seriesId, followedAt: Date.now() });
    await kvSet('follows', S.follows);
    const s = seriesById(seriesId);
    if (s) {
      await pushMessage(seriesId, 'them', `感谢关注「${s.name}」！我会持续更新优质内容，记得常来看哦。`);
    }
    emit('follows', {});
  }

  async function unfollowSeries(seriesId) {
    S.follows = S.follows.filter((f) => f.seriesId === seriesId);
    await kvSet('follows', S.follows);
    emit('series', {});
  }

  async function addNotification({ type, content, videoId, seriesId }) {
    const n = { id: uid(), type, content, videoId: videoId || null, seriesId: seriesId || null, createdAt: Date.now(), read: false };
    S.notifications.unshift(n);
    await DB.put('notifications', n);
    emit('notify', {});
  }

  async function markNotificationsRead() {
    let changed = false;
    for (const n of S.notifications) {
      if (!n.read) { n.read = true; await DB.put('notifications', n); changed = true; }
    }
    if (changed) emit('notify', {});
  }

  async function pushMessage(convId, from, text) {
    const m = { id: uid(), convId, from, text, createdAt: Date.now(), read: from === 'me' };
    S.messages.push(m);
    await DB.put('messages', m);
    emit('messages', { convId });
    return m;
  }

  async function sendMessage(convId, text) {
    await pushMessage(convId, 'me', text);
    setTimeout(() => { pushMessage(convId, 'them', autoReplyText(text)); }, 700 + Math.random() * 700);
  }

  function autoReplyText(text) {
    const t = (text || '').trim().toLowerCase();
    const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
    if (/你好|您好|哈喽|嗨|^hi$|^hello$/.test(t)) return pick(['你好呀，很高兴和你聊天。', 'Hi，今天也来刷几个有趣的视频吧。']);
    if (/谢谢|感谢|thank/.test(t)) return '不客气啦。';
    if (/英语|故事|内容|推荐/.test(t)) return pick(['每天刷几个视频，越看越有感觉。', '喜欢的系列记得关注哦，更新了会提醒你。']);
    if (/拜拜|再见|bye/.test(t)) return '拜拜，下次再聊。';
    return pick(['收到啦。', '嗯嗯，一起加油。', '说得对哦。', '哈哈，继续保持。']);
  }

  async function markConvRead(convId) {
    let changed = false;
    for (const m of S.messages) {
      if (m.convId === convId && m.from === 'them' && !m.read) { m.read = true; await DB.put('messages', m); changed = true; }
    }
    if (changed) emit('messages', { convId });
  }

  function unreadNotify() { return S.notifications.filter((n) => !n.read).length; }
  function unreadMsg() { return S.messages.filter((m) => m.from === 'them' && !m.read).length; }

  async function ensureWelcome() {
    if (S.welcomed) return;
    await addNotification({ type: 'welcome', content: '欢迎来到魔耳！先去添加你喜欢的视频，开始刷起来吧。' });
    await pushMessage('official', 'them', '你好呀，我是魔耳小助手。添加视频后就可以开始刷故事啦，有任何问题随时问我。');
    S.welcomed = true;
    await kvSet('welcomed', true);
  }

  async function setSetting(key, value) {
    S.settings[key] = value;
    await kvSet('settings', S.settings);
  }

  function buildRecommendList() {
    const vids = S.videos.slice();
    if (!vids.length) return [];
    const anyInter = Object.values(S.interactions).some((i) => i.liked || i.favored || i.watchCount > 0);
    if (!anyInter) {
      for (let i = vids.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [vids[i], vids[j]] = [vids[j], vids[i]];
      }
      return vids;
    }
    const watched = new Set();
    const watchedCats = new Set();
    const hotSeries = new Set();
    const followedSet = new Set(S.follows.map((f) => f.seriesId));
    for (const [vid, i] of Object.entries(S.interactions)) {
      const v = videoById(vid);
      if (!v) continue;
      if (i.watchCount > 0 || i.lastWatchedAt) { watched.add(vid); watchedCats.add(v.categoryId); }
      if (i.liked || i.favored) { watchedCats.add(v.categoryId); if (v.seriesId) hotSeries.add(v.seriesId); }
    }
    const scored = vids.map((v) => {
      let sc = 0;
      if (!watched.has(v.id)) sc += 3;
      if (v.seriesId && hotSeries.has(v.seriesId)) sc += 2;
      if (v.seriesId && followedSet.has(v.seriesId)) sc += 2;
      if (watchedCats.has(v.categoryId)) sc += 1;
      sc += Math.random() * 0.5;
      return { v, sc };
    });
    scored.sort((a, b) => b.sc - a.sc);
    return scored.map((x) => x.v);
  }

  const MIME = {
    mp4: 'video/mp4', m4v: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime', avi: 'video/x-msvideo', mkv: 'video/x-matroska',
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp'
  };
  function extOf(name) {
    const m = String(name || '').toLowerCase().match(/\.([a-z0-9]+)$/);
    return m ? m[1] : 'mp4';
  }
  function mimeOf(ext) { return MIME[ext] || 'application/octet-stream'; }

  async function exportBackup() {
    const meta = {
      app: 'moer', version: 1, exportedAt: Date.now(),
      videos: S.videos.map((v) => ({ id: v.id, title: v.title, description: v.description || '', categoryId: v.categoryId, seriesId: v.seriesId, fileName: v.fileName, size: v.size, addedAt: v.addedAt, thumb: v.thumb, ext: extOf(v.fileName), videoUrl: v.videoUrl || null })),
      series: S.series.map((s) => ({ id: s.id, name: s.name, createdAt: s.createdAt, avatarExt: s.avatar ? extOf('a.' + (s.avatar.type === 'image/png' ? 'png' : s.avatar.type === 'image/gif' ? 'gif' : s.avatar.type === 'image/webp' ? 'webp' : 'jpg')) : null })),
      interactions: Object.values(S.interactions),
      comments: Object.values(S.comments).flat(),
      notifications: S.notifications,
      messages: S.messages,
      kv: await DB.getAll('kv')
    };
    const enc = new TextEncoder();
    const entries = [{ name: 'moer.json', data: enc.encode(JSON.stringify(meta)) }];
    for (const v of S.videos) {
      if (v.videoUrl) continue; // 外链视频不存文件
      if (!v.blob) continue;
      entries.push({ name: `files/${v.id}.${extOf(v.fileName)}`, data: new Uint8Array(await v.blob.arrayBuffer()) });
    }
    for (const s of S.series) {
      if (s.avatar) {
        const ext = meta.series.find((x) => x.id === s.id).avatarExt;
        entries.push({ name: `avatars/${s.id}.${ext}`, data: new Uint8Array(await s.avatar.arrayBuffer()) });
      }
    }
    return MZip.create(entries);
  }

  async function importBackup(file) {
    const files = MZip.read(await file.arrayBuffer());
    if (!files['moer.json']) throw new Error('备份文件缺少 moer.json');
    const meta = JSON.parse(new TextDecoder().decode(files['moer.json']));
    if (meta.app !== 'moer') throw new Error('不是有效的魔耳备份文件');
    for (const st of ['videos', 'series', 'interactions', 'comments', 'notifications', 'messages', 'kv']) {
      await DB.clear(st);
    }
    for (const v of meta.videos) {
      if (v.videoUrl) {
        await DB.put('videos', { id: v.id, title: v.title, description: v.description || '', categoryId: v.categoryId, seriesId: v.seriesId, blob: null, fileName: null, size: 0, addedAt: v.addedAt, thumb: v.thumb || null, videoUrl: v.videoUrl });
        continue;
      }
      const f = files[`files/${v.id}.${v.ext}`];
      if (!f) continue;
      await DB.put('videos', { id: v.id, title: v.title, description: v.description || '', categoryId: v.categoryId, seriesId: v.seriesId, blob: new Blob([f], { type: mimeOf(v.ext) }), fileName: v.fileName || (v.title + '.' + v.ext), size: v.size, addedAt: v.addedAt, thumb: v.thumb || null, videoUrl: null });
    }
    for (const s of meta.series) {
      let avatar = null;
      if (s.avatarExt) {
        const f = files[`avatars/${s.id}.${s.avatarExt}`];
        if (f) avatar = new Blob([f], { type: mimeOf(s.avatarExt) });
      }
      await DB.put('series', { id: s.id, name: s.name, avatar, createdAt: s.createdAt });
    }
    for (const i of meta.interactions) await DB.put('interactions', i);
    for (const c of meta.comments) await DB.put('comments', c);
    for (const n of meta.notifications) await DB.put('notifications', n);
    for (const m of meta.messages) await DB.put('messages', m);
    for (const r of meta.kv) await DB.put('kv', r);
    await loadAll();
    emit('imported', {});
  }

  return {
    S, on, emit, uid, loadAll,
    catName, catAge, videoById, seriesById, seriesName, isFollowed,
    getInter, toggleFlag, recordWatch, saveProgress, clearHistoryOne, clearHistoryAll,
    commentCount, addComment, deleteComment,
    addSeries, updateSeries, deleteSeries, updateVideo,
    addVideoFiles, addVideoByUrl, getVideoSrc, isUrlVideo, renameVideo, deleteVideo,
    followSeries, unfollowSeries,
    addNotification, markNotificationsRead,
    pushMessage, sendMessage, markConvRead, unreadNotify, unreadMsg,
    ensureWelcome, setSetting, buildRecommendList,
    exportBackup, importBackup
  };
})();
