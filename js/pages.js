const Pages = (() => {
  const { icon, esc, toast, fmtTime, fmtSize } = UI;

  let mineTab = 'fav';
  let manageTab = 'videos';
  let searchQuery = '';
  let panelKind = null;
  let selectedConv = 'official';

  function catTag(v) {
    const cat = CATEGORIES.find(c => c.id === v.categoryId);
    return `${UI.ageIcon(cat ? cat.icon : 'adult', 14)} ${esc(Data.catName(v.categoryId))}`;
  }

  function cardHtml(v, action) {
    const actBtn = action ? `<div class="card-actions"><button class="btn btn-sm" data-act="${action.act}" data-vid="${v.id}">${action.label}</button></div>` : '';
    return `
      <div class="card" data-vid="${v.id}">
        <div class="thumb-wrap">
          ${UI.thumbNode(v)}
          <span class="play-overlay">${icon('play', 34)}</span>
        </div>
        <div class="card-body">
          <div class="card-title" title="${esc(v.title)}">${esc(v.title)}</div>
          <div class="card-sub">${esc(Data.seriesName(v))} · ${catTag(v)}</div>
          ${actBtn}
        </div>
      </div>`;
  }

  function gridHtml(videos, action, emptyText) {
    if (!videos.length) {
      return `<div class="empty in-panel"><p>${esc(emptyText)}</p></div>`;
    }
    return `<div class="grid">${videos.map((v) => cardHtml(v, action)).join('')}</div>`;
  }

  function bindGrid(scope) {
    scope.querySelectorAll('.card').forEach((card) => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('[data-act]')) return;
        App.playVideo(card.dataset.vid);
      });
    });
    scope.querySelectorAll('[data-act]').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const act = btn.dataset.act;
        const vid = btn.dataset.vid;
        if (act === 'unfav') { await Data.toggleFlag(vid, 'favored'); toast('已取消收藏'); }
        if (act === 'unlike') { await Data.toggleFlag(vid, 'liked'); toast('已取消喜欢'); }
        if (act === 'unlater') { await Data.toggleFlag(vid, 'watchLater'); toast('已移出稍后再看'); }
        if (act === 'delhist') { await Data.clearHistoryOne(vid); toast('已删除该条记录'); }
      });
    });
  }

  function decorate(scope, videos) {
    UI.decorateThumbs(scope, videos);
  }

  // ---------------- 我的 ----------------
  function renderMine(tab) {
    mineTab = tab || mineTab || 'fav';
    if (mineTab === 'backup' && !(Cloud.isLoggedIn() && Cloud.isAdmin())) mineTab = 'fav';
    const page = document.getElementById('pageMine');
    const items = [
      { id: 'fav', name: '收藏', ic: 'star' },
      { id: 'like', name: '喜欢', ic: 'heart' },
      { id: 'history', name: '观看历史', ic: 'clock' },
      { id: 'later', name: '稍后再看', ic: 'film' },
      { id: 'follow', name: '关注', ic: 'users' }
    ];
    if (Cloud.isLoggedIn() && Cloud.isAdmin()) {
      items.push({ id: 'backup', name: '数据与备份', ic: 'folder' });
    }
    page.innerHTML = `
      <div class="mine-layout">
        <aside class="mine-menu">
          ${items.map((it) => `<div class="menu-item ${mineTab === it.id ? 'active' : ''}" data-tab="${it.id}">${icon(it.ic, 19)}<span>${it.name}</span></div>`).join('')}
        </aside>
        <div class="mine-content scrollable" id="mineContent"></div>
      </div>`;
    page.querySelectorAll('.menu-item').forEach((el) => {
      el.addEventListener('click', () => renderMine(el.dataset.tab));
    });
    renderMineContent();
  }

  function renderMineContent() {
    const box = document.getElementById('mineContent');
    const S = Data.S;
    if (mineTab === 'follow') {
      const follows = S.follows.slice().sort((a, b) => b.followedAt - a.followedAt);
      box.innerHTML = `<h3>我的关注（${follows.length}）</h3>` + (follows.length ? follows.map((f) => {
        const s = Data.seriesById(f.seriesId);
        if (!s) return '';
        const count = S.videos.filter((v) => v.seriesId === s.id).length;
        return `
          <div class="series-card">
            ${UI.avatarHtml(s, 48)}
            <div class="series-info">
              <div class="series-name">${esc(s.name)}</div>
              <div class="series-sub">${count} 个视频 · 关注于 ${fmtTime(f.followedAt)}</div>
            </div>
            <div class="series-acts">
              <button class="btn btn-sm btn-primary" data-sact="play" data-sid="${s.id}">看视频</button>
              <button class="btn btn-sm" data-sact="unfollow" data-sid="${s.id}">取消关注</button>
            </div>
          </div>`;
      }).join('') : '<div class="empty in-panel"><p>还没有关注的系列，在视频右侧点 ➕ 关注吧</p></div>');
      box.querySelectorAll('[data-sact]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const sid = btn.dataset.sid;
          if (btn.dataset.sact === 'unfollow') {
            const ok = await UI.confirmDialog({ title: '取消关注', text: '确定取消关注该系列吗？', okText: '取消关注', danger: true });
            if (ok) { await Data.unfollowSeries(sid); toast('已取消关注'); }
          } else {
            const vids = S.videos.filter((v) => v.seriesId === sid).sort((a, b) => b.addedAt - a.addedAt);
            if (vids.length) App.playVideo(vids[0].id);
            else toast('该系列暂无视频');
          }
        });
      });
      return;
    }

    if (mineTab === 'backup') {
      box.innerHTML = `
        <h3>数据与备份</h3>
        <div class="panel-section">
          <h4>存储状态</h4>
          <div class="stat-row"><span>本机已用：<b id="stoUsage">统计中…</b></span><span>视频数量：<b>${S.videos.length}</b></span><span>系列数量：<b>${S.series.length}</b></span></div>
          <p class="tip">所有数据保存在这台电脑的浏览器（IndexedDB）中，刷新、关闭、重启都不会丢失。但清空浏览器缓存/网站数据会删除全部数据，请定期导出备份。</p>
        </div>
        <div class="panel-section">
          <h4>备份与恢复</h4>
          <div style="display:flex;gap:10px;flex-wrap:wrap">
            <button class="btn-primary" id="bkExport">${icon('download', 16)} 导出备份（zip）</button>
            <button class="btn" id="bkImportBtn">${icon('upload', 16)} 导入备份</button>
            <input type="file" id="bkImport" accept=".zip" style="display:none">
          </div>
          <p class="tip" style="margin-top:10px">备份包含全部视频文件与数据；导入会覆盖当前全部内容。</p>
        </div>`;
      if (navigator.storage && navigator.storage.estimate) {
        navigator.storage.estimate().then(({ usage, quota }) => {
          const el = document.getElementById('stoUsage');
          if (el) el.textContent = `${fmtSize(usage)} / 约 ${fmtSize(quota)}`;
        }).catch(() => {});
      }
      box.querySelector('#bkExport').addEventListener('click', async () => {
        try {
          toast('正在打包备份…');
          const blob = await Data.exportBackup();
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = '魔耳备份_' + new Date().toISOString().slice(0, 10) + '.zip';
          document.body.appendChild(a);
          a.click();
          a.remove();
          toast('备份已导出');
        } catch (e) { toast('导出失败：' + e.message); }
      });
      box.querySelector('#bkImportBtn').addEventListener('click', () => box.querySelector('#bkImport').click());
      box.querySelector('#bkImport').addEventListener('change', (e) => {
        const f = e.target.files[0];
        if (!f) return;
        UI.confirmDialog({ title: '导入备份', text: '导入将覆盖当前全部数据（视频、系列、记录、消息）。确定继续吗？', okText: '导入', danger: true }).then(async (ok) => {
          if (!ok) return;
          try {
            toast('正在导入…');
            await Data.importBackup(f);
            toast('导入完成');
          } catch (err) { toast('导入失败：' + err.message); }
        });
        e.target.value = '';
      });
      return;
    }

    let videos = [], action = null, title = '', empty = '';
    if (mineTab === 'fav') {
      title = '我的收藏';
      videos = S.videos.filter((v) => Data.getInter(v.id).favored).sort((a, b) => b.addedAt - a.addedAt);
      action = { act: 'unfav', label: '取消收藏' };
      empty = '还没有收藏视频，看视频时点 ⭐ 收藏吧';
    } else if (mineTab === 'like') {
      title = '我喜欢的';
      videos = S.videos.filter((v) => Data.getInter(v.id).liked).sort((a, b) => b.addedAt - a.addedAt);
      action = { act: 'unlike', label: '取消喜欢' };
      empty = '还没有喜欢的视频，看视频时点 ❤ 喜欢吧';
    } else if (mineTab === 'later') {
      title = '稍后再看';
      videos = S.videos.filter((v) => Data.getInter(v.id).watchLater).sort((a, b) => b.addedAt - a.addedAt);
      action = { act: 'unlater', label: '移除' };
      empty = '稍后再看列表是空的，看视频时点 🕐 添加';
    } else if (mineTab === 'history') {
      title = '观看历史';
      videos = S.videos.filter((v) => Data.getInter(v.id).lastWatchedAt).sort((a, b) => Data.getInter(b.id).lastWatchedAt - Data.getInter(a.id).lastWatchedAt);
      action = { act: 'delhist', label: '删除记录' };
      empty = '还没有观看记录';
    }
    box.innerHTML = `<h3>${title}${videos.length ? `（${videos.length}）` : ''}</h3>
      ${mineTab === 'history' && videos.length ? '<div style="margin-bottom:12px"><button class="btn btn-sm btn-danger" id="histClear">清空全部历史</button></div>' : ''}
      ${gridHtml(videos, action, empty)}`;
    const clearBtn = box.querySelector('#histClear');
    if (clearBtn) {
      clearBtn.addEventListener('click', async () => {
        const ok = await UI.confirmDialog({ title: '清空观看历史', text: '确定清空全部观看历史吗？', okText: '清空', danger: true });
        if (ok) { await Data.clearHistoryAll(); toast('已清空'); }
      });
    }
    bindGrid(box);
    decorate(box, videos);
  }

  // ---------------- 视频管理 ----------------
  function renderManage(tab) {
    manageTab = tab || manageTab || 'videos';
    if (manageTab === 'review' && !(Cloud.isLoggedIn() && Cloud.isAdmin())) manageTab = 'videos';
    if (manageTab === 'products' && !(Cloud.isLoggedIn() && Cloud.isAdmin())) manageTab = 'videos';
    if (manageTab === 'ads' && !(Cloud.isLoggedIn() && Cloud.isAdmin())) manageTab = 'videos';
    const page = document.getElementById('pageManage');
    const isAdminUser = Cloud.isLoggedIn() && Cloud.isAdmin();
    page.innerHTML = `
      <div class="page-scroll scrollable">
        <div class="page-head"><h2>管理后台</h2><span class="sub">视频、投稿、商品、账号管理</span></div>
        <div class="tabs">
          <button class="tab ${manageTab === 'videos' ? 'active' : ''}" data-mtab="videos">视频列表（${Data.S.videos.length}）</button>
          <button class="tab ${manageTab === 'series' ? 'active' : ''}" data-mtab="series">系列管理（${Data.S.series.length}）</button>
          ${isAdminUser ? `<button class="tab ${manageTab === 'review' ? 'active' : ''}" data-mtab="review">投稿审核</button>` : ''}
          ${isAdminUser ? `<button class="tab ${manageTab === 'products' ? 'active' : ''}" data-mtab="products">商品管理</button>` : ''}
          ${isAdminUser ? `<button class="tab ${manageTab === 'ads' ? 'active' : ''}" data-mtab="ads">广告管理</button>` : ''}
          ${isAdminUser ? `<button class="tab ${manageTab === 'users' ? 'active' : ''}" data-mtab="users">账号管理</button>` : ''}
        </div>
        <div id="manageBody"></div>
      </div>`;
    page.querySelectorAll('[data-mtab]').forEach((el) => {
      el.addEventListener('click', () => renderManage(el.dataset.mtab));
    });
    if (manageTab === 'videos') renderManageVideos();
    else if (manageTab === 'users') renderManageUsers();
    else if (manageTab === 'products') renderManageProducts();
    else if (manageTab === 'ads') renderManageAds();
    else if (manageTab === 'review' && Pages.renderManageReview) Pages.renderManageReview();
    else renderManageSeries();
  }

  function seriesOptions(selectedId) {
    return `<option value="">未分组</option>
      ${Data.S.series.map((s) => `<option value="${s.id}" ${selectedId === s.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}
      <option value="__new">＋ 新建系列…</option>`;
  }

  function renderManageVideos() {
    const box = document.getElementById('manageBody');
    box.innerHTML = `
      <div class="card-panel">
        <h3>添加视频</h3>
        <div class="sub-tabs">
          <button class="sub-tab active" data-stab="upload">本地上传</button>
          <button class="sub-tab" data-stab="url">粘贴链接</button>
        </div>
        <div id="stabUpload">
          <div class="form-row">
            <label>视频文件</label>
            <button class="btn" id="mvFileBtn">选择文件（可多选）</button>
            <input type="file" id="mvFile" accept="video/*" multiple style="display:none">
            <span class="file-name" id="mvFileLabel">未选择文件</span>
          </div>
          <div class="form-row">
            <label>标题</label>
            <input type="text" id="mvTitle" placeholder="默认使用文件名（多选时每个视频用各自文件名）" maxlength="60">
          </div>
          <div class="form-row">
            <label>栏目</label>
            <select id="mvCat">
              ${CATEGORIES.map((c) => `<option value="${c.id}">${c.name}（${c.age}）</option>`).join('')}
            </select>
          </div>
          <div class="form-row">
            <label>系列</label>
            <select id="mvSeries">${seriesOptions('')}</select>
          </div>
          <button class="btn-primary" id="mvAdd">添加视频</button>
          <p class="tip" style="margin-top:12px">提示：上传的视频仅保存在本机浏览器，适合个人本地使用。</p>
        </div>
        <div id="stabUrl" class="hidden">
          <div class="form-row">
            <label>视频链接</label>
            <input type="text" id="mvUrl" placeholder="粘贴视频直链，如 https://example.com/video.mp4" style="flex:1">
          </div>
          <div class="form-row">
            <label>标题</label>
            <input type="text" id="mvUrlTitle" placeholder="视频标题" maxlength="60">
          </div>
          <div class="form-row">
            <label>简介</label>
            <input type="text" id="mvUrlDesc" placeholder="视频简介（选填）" maxlength="200">
          </div>
          <div class="form-row">
            <label>栏目</label>
            <select id="mvUrlCat">
              ${CATEGORIES.map((c) => `<option value="${c.id}">${c.name}（${c.age}）</option>`).join('')}
            </select>
          </div>
          <div class="form-row">
            <label>系列</label>
            <select id="mvUrlSeries">${seriesOptions('')}</select>
          </div>
          <div class="form-row">
            <label>封面图链接（选填）</label>
            <input type="text" id="mvUrlThumb" placeholder="封面图片URL，留空则自动从视频截取" style="flex:1">
          </div>
          <button class="btn-primary" id="mvUrlAdd">添加外链视频</button>
          <p class="tip" style="margin-top:12px">提示：外链视频不占用本地存储空间，适合部署后共享给多人使用。支持 mp4/webm 等浏览器可直接播放的视频直链。</p>
        </div>
      </div>
      <div class="card-panel">
        <h3>全部视频</h3>
        <div id="mvList"></div>
      </div>
      <div class="card-panel" id="publishedVideosPanel">
        <h3>已发布视频 · 广告管理</h3>
        <div style="background:var(--bg3);border-radius:8px;padding:10px 14px;margin-bottom:12px;font-size:12px;color:var(--txt2);line-height:1.8">
          <b style="color:var(--txt)">操作说明：</b>为已上架的视频分配广告位。请先在「广告管理」Tab中创建广告。<br>
          <b style="color:var(--cyan)">前贴</b>=播放前 · <b style="color:var(--cyan)">中插</b>=播放中 · <b style="color:var(--cyan)">后贴</b>=播放后 · 选择「不播放广告」=跳过
        </div>
        <div id="pvAdList"></div>
      </div>`;

    const fileInput = box.querySelector('#mvFile');
    const fileLabel = box.querySelector('#mvFileLabel');
    box.querySelector('#mvFileBtn').addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => {
      const n = fileInput.files.length;
      fileLabel.textContent = n ? `已选择 ${n} 个文件` : '未选择文件';
      if (n === 1 && !box.querySelector('#mvTitle').value) {
        box.querySelector('#mvTitle').value = fileInput.files[0].name.replace(/\.[^.]+$/, '');
      }
    });
    box.querySelector('#mvSeries').addEventListener('change', async (e) => {
      if (e.target.value !== '__new') return;
      const name = await UI.promptDialog({ title: '新建系列', label: '系列名称（相当于一个"作者"）' });
      if (!name) { e.target.value = ''; return; }
      const s = await Data.addSeries(name, {});
      e.target.innerHTML = seriesOptions(s.id);
      e.target.value = s.id;
      toast(`系列「${name}」已创建`);
    });
    box.querySelector('#mvAdd').addEventListener('click', async () => {
      const files = [...fileInput.files];
      if (!files.length) { toast('请先选择视频文件'); return; }
      const seriesSel = box.querySelector('#mvSeries').value;
      let seriesId = seriesSel === '__new' ? '' : seriesSel;
      const n = await Data.addVideoFiles(files, box.querySelector('#mvCat').value, seriesId, box.querySelector('#mvTitle').value);
      toast(`成功添加 ${n} 个视频`);
      renderManage('videos');
    });

    // 子Tab切换
    box.querySelectorAll('.sub-tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        box.querySelectorAll('.sub-tab').forEach((t) => t.classList.remove('active'));
        tab.classList.add('active');
        const stab = tab.dataset.stab;
        box.querySelector('#stabUpload').classList.toggle('hidden', stab !== 'upload');
        box.querySelector('#stabUrl').classList.toggle('hidden', stab !== 'url');
      });
    });

    // 外链视频系列新建
    box.querySelector('#mvUrlSeries').addEventListener('change', async (e) => {
      if (e.target.value !== '__new') return;
      const name = await UI.promptDialog({ title: '新建系列', label: '系列名称（相当于一个"作者"）' });
      if (!name) { e.target.value = ''; return; }
      const s = await Data.addSeries(name, {});
      e.target.innerHTML = seriesOptions(s.id);
      e.target.value = s.id;
      toast(`系列「${name}」已创建`);
    });

    // 添加外链视频
    box.querySelector('#mvUrlAdd').addEventListener('click', async () => {
      const url = box.querySelector('#mvUrl').value.trim();
      const title = box.querySelector('#mvUrlTitle').value.trim();
      const description = box.querySelector('#mvUrlDesc').value.trim();
      const categoryId = box.querySelector('#mvUrlCat').value;
      const thumb = box.querySelector('#mvUrlThumb').value.trim() || null;
      const seriesSel = box.querySelector('#mvUrlSeries').value;
      const seriesId = seriesSel === '__new' ? '' : seriesSel;
      if (!url) { toast('请输入视频链接'); return; }
      if (!/^https?:\/\//i.test(url)) { toast('请输入有效的 http/https 链接'); return; }
      try {
        const v = await Data.addVideoByUrl({ url, title, description, categoryId, seriesId, thumb });
        toast('外链视频已添加');
        renderManage('videos');
      } catch (e) {
        toast('添加失败：' + e.message);
      }
    });

    const listEl = box.querySelector('#mvList');
    const vids = Data.S.videos.slice().sort((a, b) => b.addedAt - a.addedAt);
    if (!vids.length) {
      listEl.innerHTML = '<div class="empty in-panel"><p>还没有视频，用上方表单添加第一个视频吧</p></div>';
    } else {
      listEl.innerHTML = vids.map((v) => `
        <div class="row" data-vid="${v.id}">
          ${UI.thumbNode(v, 'row-thumb')}
          <div class="row-main">
            <div class="row-title">${esc(v.title)}</div>
            <div class="row-sub">${catTag(v)} · ${esc(Data.seriesName(v))} · ${v.videoUrl ? '<span class="url-badge">外链</span>' : fmtSize(v.size)} · ${fmtTime(v.addedAt)}</div>
          </div>
        <div class="row-acts">
          <button class="btn btn-sm" data-act="play">播放</button>
          <button class="btn btn-sm" data-act="vedit">${icon('edit', 13)} 编辑</button>
          <button class="btn btn-sm btn-primary" data-act="publish">发布到片库</button>
          <button class="btn btn-sm btn-danger" data-act="del">删除</button>
        </div>
        </div>`).join('');
      decorate(listEl, vids);
    }

    // 加载已发布视频广告管理
    loadPublishedVideoAds();

    listEl.querySelectorAll('[data-act]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const row = btn.closest('.row');
        const vid = row.dataset.vid;
        const v = Data.videoById(vid);
        if (btn.dataset.act === 'play') App.playVideo(vid);
        if (btn.dataset.act === 'vedit') {
          const m = UI.modal(`
            <div class="modal-head">编辑视频</div>
            <div class="modal-body">
              <div style="margin-bottom:12px">
                <div style="color:var(--txt2);margin-bottom:6px;font-size:13px">标题</div>
                <input type="text" id="veTitle" value="${UI.esc(v.title)}" maxlength="60" style="width:100%;height:38px;background:var(--bg3);border:1px solid var(--line);border-radius:8px;color:var(--txt);padding:0 12px;font-size:14px">
              </div>
              <div>
                <div style="color:var(--txt2);margin-bottom:6px;font-size:13px">简介</div>
                <textarea id="veDesc" maxlength="200" rows="4" placeholder="介绍一下这个视频的内容..." style="width:100%;background:var(--bg3);border:1px solid var(--line);border-radius:8px;color:var(--txt);padding:10px 12px;font-size:14px;font-family:inherit;outline:none;resize:vertical">${UI.esc(v.description || '')}</textarea>
              </div>
            </div>
            <div class="modal-foot">
              <button class="btn" data-a="cancel">取消</button>
              <button class="btn-primary" data-a="ok">保存</button>
            </div>`, { overlayClose: false });
          m.overlay.querySelector('[data-a="cancel"]').onclick = () => m.close();
          m.overlay.querySelector('[data-a="ok"]').onclick = async () => {
            const title = m.overlay.querySelector('#veTitle').value.trim();
            const description = m.overlay.querySelector('#veDesc').value.trim();
            if (!title) { UI.toast('标题不能为空'); return; }
            await Data.updateVideo(vid, { title, description });
            m.close();
            toast('已保存');
            renderManage('videos');
          };
        }
        if (btn.dataset.act === 'publish') {
          showPublishDialog(v);
        }
        if (btn.dataset.act === 'del') {
          const ok = await UI.confirmDialog({ title: '删除视频', text: `确定删除《${esc(v.title)}》吗？相关评论与记录会一并删除。`, okText: '删除', danger: true });
          if (ok) { await Data.deleteVideo(vid); toast('已删除'); }
        }
      });
    });
  }

  async function loadPublishedVideoAds() {
    var listEl = document.getElementById('pvAdList');
    if (!listEl) return;
    listEl.innerHTML = '<p class="tip">加载中…</p>';
    var videos = [], ads = [];
    try {
      var vRes = await Cloud.apiGet('/admin/published-videos');
      var aRes = await Cloud.apiGet('/admin/ads');
      videos = vRes.videos || [];
      ads = aRes.ads || [];
    } catch (e) {
      listEl.innerHTML = '<p class="tip">加载失败：' + esc(e.message) + '</p>';
      return;
    }
    if (!videos.length) {
      listEl.innerHTML = '<p class="tip" style="padding:20px 0;text-align:center">暂无已发布视频</p>';
      return;
    }
    function adOpts(selId) {
      var h = '<option value="">不播放广告</option>';
      for (var i = 0; i < ads.length; i++) {
        var a = ads[i];
        h += '<option value="' + a.id + '"' + (a.id === selId ? ' selected' : '') + '>' + esc(a.title) + '（' + a.duration + '秒）</option>';
      }
      return h;
    }
    var html = '';
    for (var i = 0; i < videos.length; i++) {
      var v = videos[i];
      html += '<div class="row pv-row" data-vid="' + v.id + '" style="flex-wrap:wrap;gap:8px;padding:12px">';
      html += '<div style="flex:1;min-width:200px">';
      html += '<div class="row-title" style="font-size:14px">' + esc(v.title) + (v.vipOnly ? ' <span style="color:var(--gold);font-size:11px;vertical-align:middle">● VIP</span>' : ' <span style="color:var(--green);font-size:11px;vertical-align:middle">● 免费</span>') + '</div>';
      html += '<div class="row-sub" style="font-size:12px">' + esc(v.seriesName || '未分组') + ' · ' + UI.fmtTime(v.addedAt) + '</div>';
      html += '</div>';
      html += '<div style="display:flex;gap:10px;flex-wrap:wrap;flex:2;min-width:300px">';
      html += '<div style="flex:1;min-width:120px">';
      html += '<label style="font-size:11px;color:var(--txt2);display:block;margin-bottom:3px">前贴广告</label>';
      html += '<select class="pv-ad-sel" data-vid="' + v.id + '" data-pos="preAdId" style="width:100%;height:32px;background:var(--bg3);border:1px solid var(--line);border-radius:6px;color:var(--txt);padding:0 8px;font-size:12px">';
      html += adOpts(v.preAdId);
      html += '</select></div>';
      html += '<div style="flex:1;min-width:120px">';
      html += '<label style="font-size:11px;color:var(--txt2);display:block;margin-bottom:3px">中插广告</label>';
      html += '<select class="pv-ad-sel" data-vid="' + v.id + '" data-pos="midAdId" style="width:100%;height:32px;background:var(--bg3);border:1px solid var(--line);border-radius:6px;color:var(--txt);padding:0 8px;font-size:12px">';
      html += adOpts(v.midAdId);
      html += '</select></div>';
      html += '<div style="flex:1;min-width:120px">';
      html += '<label style="font-size:11px;color:var(--txt2);display:block;margin-bottom:3px">后贴广告</label>';
      html += '<select class="pv-ad-sel" data-vid="' + v.id + '" data-pos="postAdId" style="width:100%;height:32px;background:var(--bg3);border:1px solid var(--line);border-radius:6px;color:var(--txt);padding:0 8px;font-size:12px">';
      html += adOpts(v.postAdId);
      html += '</select></div>';
      html += '</div>';
      html += '<div style="display:flex;align-items:flex-end;gap:6px">';
      html += '<button class="btn btn-sm btn-primary pv-ad-save" data-vid="' + v.id + '">保存</button>';
      html += '<button class="btn btn-sm btn-danger pv-ad-del" data-vid="' + v.id + '" data-title="' + esc(v.title) + '">删除</button>';
      html += '</div></div>';
    }
    listEl.innerHTML = html;
    listEl.querySelectorAll('.pv-ad-save').forEach(function(btn) {
      btn.addEventListener('click', async function() {
        var vid = btn.dataset.vid;
        var sels = listEl.querySelectorAll('.pv-ad-sel[data-vid="' + vid + '"]');
        var data = {};
        sels.forEach(function(sel) { data[sel.dataset.pos] = sel.value; });
        try {
          await Cloud.apiPost('/admin/published-videos/' + vid + '/ads', data);
          toast('广告设置已保存');
        } catch (e) {
          toast(e.message || '保存失败');
        }
      });
    });
    listEl.querySelectorAll('.pv-ad-del').forEach(function(btn) {
      btn.addEventListener('click', async function() {
        var vid = btn.dataset.vid;
        var title = btn.dataset.title;
        var ok = await UI.confirmDialog({ title: '删除已发布视频', text: '确定从片库删除「' + title + '」？', okText: '删除', danger: true });
        if (!ok) return;
        try {
          await Cloud.apiPost('/admin/published-videos/' + vid + '/delete', {});
          toast('已删除');
          loadPublishedVideoAds();
        } catch (e) {
          toast(e.message || '删除失败');
        }
      });
    });
  }


  function showPublishDialog(v) {
    var videoUrl = v.videoUrl || '';
    if (!videoUrl && v.blob) {
      videoUrl = URL.createObjectURL(v.blob);
    }
    if (!videoUrl) {
      toast('此视频没有可用的播放链接，无法发布');
      return;
    }
    var seriesOpts = '<option value="">未分组</option>';
    Data.S.series.forEach(function(s) {
      seriesOpts += '<option value="' + esc(s.name) + '">' + esc(s.name) + '</option>';
    });
    var catOpts = CATEGORIES.map(function(c) {
      return '<option value="' + c.id + '">' + c.name + '（' + c.age + '）</option>';
    }).join('');

    var html = '<div class="modal-head">发布到片库<button class="icon-btn" id="pubClose">' + icon('close', 18) + '</button></div>';
    html += '<div class="modal-body" style="max-height:60vh;overflow-y:auto">';
    html += '<div style="background:var(--bg3);border-radius:8px;padding:10px 14px;margin-bottom:14px;font-size:12px;color:var(--txt2);line-height:1.8">';
    html += '将本地视频发布到服务器片库，发布后可为视频分配广告位。<br>';
    html += '<b style="color:var(--cyan)">视频链接：</b>' + esc(videoUrl.substring(0, 80)) + (videoUrl.length > 80 ? '...' : '');
    html += '</div>';
    html += '<div class="form-row"><label>标题</label><input type="text" id="pubTitle" value="' + esc(v.title) + '" maxlength="60"></div>';
    html += '<div class="form-row"><label>简介</label><textarea id="pubDesc" rows="2" maxlength="200" placeholder="选填">' + esc(v.description || '') + '</textarea></div>';
    html += '<div class="form-row"><label>栏目</label><select id="pubCat">' + catOpts + '</select></div>';
    html += '<div class="form-row"><label>系列</label><select id="pubSeries">' + seriesOpts + '</select></div>';
    html += '<div class="form-row"><label>访问权限</label><select id="pubVip"><option value="0">免费 - 所有用户可看</option><option value="1">VIP - 仅会员可看</option></select></div>';
    html += '</div>';
    html += '<div class="modal-foot"><button class="btn" id="pubCancel">取消</button><button class="btn-primary" id="pubOk">发布</button></div>';

    var m = UI.modal(html);
    m.overlay.querySelector('#pubClose').onclick = function() { m.close(); };
    m.overlay.querySelector('#pubCancel').onclick = function() { m.close(); };
    m.overlay.querySelector('#pubCat').value = v.categoryId || 'hanlu';
    m.overlay.querySelector('#pubOk').onclick = async function() {
      var title = m.overlay.querySelector('#pubTitle').value.trim();
      if (!title) { toast('请输入标题'); return; }
      var data = {
        url: videoUrl,
        title: title,
        description: m.overlay.querySelector('#pubDesc').value.trim(),
        categoryId: m.overlay.querySelector('#pubCat').value,
        seriesName: m.overlay.querySelector('#pubSeries').value,
        vipOnly: m.overlay.querySelector('#pubVip').value === '1',
      };
      try {
        await Cloud.apiPost('/admin/publish-video', data);
        toast('已发布到片库');
        m.close();
        loadPublishedVideoAds();
      } catch (e) {
        toast(e.message || '发布失败');
      }
    };
  }


  function renderManageSeries() {
    const box = document.getElementById('manageBody');
    box.innerHTML = `
      <div class="card-panel">
        <h3>新建系列</h3>
        <div class="form-row">
          <label>系列名称</label>
          <input type="text" id="sfName" placeholder="如：小猪讲故事" maxlength="30">
        </div>
        <div class="form-row">
          <label>系列简介</label>
          <textarea id="sfBio" maxlength="200" rows="3" placeholder="介绍一下这个系列的内容和特色..."></textarea>
        </div>
        <div class="form-row" style="align-items:flex-start">
          <label>预设头像</label>
          <div class="preset-picker" id="sfPresetAvatar">
            ${Object.keys(UI.PRESET_AVATARS).map((key) => `
              <div class="pp-item" data-key="${key}" title="${UI.PRESET_AVATARS[key].name}">
                <div class="preset-avatar" style="width:32px;height:32px;background:linear-gradient(135deg,#fff5f5,#fff0f5)">${UI.PRESET_AVATARS[key].svg}</div>
              </div>
            `).join('')}
          </div>
        </div>
        <div class="form-row">
          <label>自定义头像</label>
          <button class="btn" id="sfAvatarBtn">或上传自定义头像</button>
          <input type="file" id="sfAvatar" accept="image/*" style="display:none">
          <span class="file-name" id="sfAvatarLabel">不选则使用预设头像或自动生成字母头像</span>
        </div>
        <button class="btn-primary" id="sfAdd">创建系列</button>
      </div>
      <div class="card-panel">
        <h3>全部系列</h3>
        <div id="sfList"></div>
      </div>`;

    // 预设头像选择
    let selectedPreset = null;
    const presetItems = box.querySelectorAll('#sfPresetAvatar .pp-item');
    presetItems.forEach((item) => {
      item.addEventListener('click', () => {
        presetItems.forEach((i) => i.classList.remove('active'));
        item.classList.add('active');
        selectedPreset = item.dataset.key;
        // 选了预设就清空文件选择提示
        box.querySelector('#sfAvatarLabel').textContent = '已选择预设头像';
      });
    });

    const avatarInput = box.querySelector('#sfAvatar');
    box.querySelector('#sfAvatarBtn').addEventListener('click', () => avatarInput.click());
    avatarInput.addEventListener('change', () => {
      if (avatarInput.files[0]) {
        box.querySelector('#sfAvatarLabel').textContent = avatarInput.files[0].name;
        // 选了文件就取消预设选择
        selectedPreset = null;
        presetItems.forEach((i) => i.classList.remove('active'));
      } else {
        box.querySelector('#sfAvatarLabel').textContent = '不选则使用预设头像或自动生成字母头像';
      }
    });
    box.querySelector('#sfAdd').addEventListener('click', async () => {
      const name = box.querySelector('#sfName').value.trim();
      if (!name) { toast('请输入系列名称'); return; }
      const bio = box.querySelector('#sfBio').value.trim();
      const avatarFile = avatarInput.files[0] || null;
      const presetAvatar = selectedPreset;
      await Data.addSeries(name, { avatarFile, bio, presetAvatar });
      toast(`系列「${name}」已创建`);
      renderManage('series');
    });

    const listEl = box.querySelector('#sfList');
    if (!Data.S.series.length) {
      listEl.innerHTML = '<div class="empty in-panel"><p>还没有系列。系列相当于视频的"作者"，建议把同一来源的视频归为一个系列</p></div>';
      return;
    }
    listEl.innerHTML = Data.S.series.map((s) => {
      const count = Data.S.videos.filter((v) => v.seriesId === s.id).length;
      const followed = Data.isFollowed(s.id);
      const bioHtml = s.bio ? `<div class="bio-text">${UI.esc(s.bio)}</div>` : '';
      return `
        <div class="row" data-sid="${s.id}">
          ${UI.avatarHtml(s, 44)}
          <div class="row-main">
            <div class="row-title">${esc(s.name)}</div>
            <div class="row-sub">${count} 个视频 · ${followed ? '已关注' : '未关注'}</div>
            ${bioHtml}
          </div>
          <div class="row-acts">
            <button class="btn btn-sm" data-act="srename">${icon('edit', 13)} 重命名</button>
            <button class="btn btn-sm" data-act="sbio">${icon('edit', 13)} 编辑简介</button>
            <button class="btn btn-sm" data-act="savatar">换头像</button>
            <input type="file" accept="image/*" style="display:none" data-act="savatarfile">
            <button class="btn btn-sm btn-danger" data-act="sdel">删除</button>
          </div>
        </div>`;
    }).join('');
    listEl.querySelectorAll('[data-act]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const row = btn.closest('.row');
        const sid = row.dataset.sid;
        const s = Data.seriesById(sid);
        const act = btn.dataset.act;
        if (act === 'srename') {
          const name = await UI.promptDialog({ title: '重命名系列', value: s.name });
          if (name) { await Data.updateSeries(sid, { name }); toast('已修改'); renderManage('series'); }
        }
        if (act === 'sbio') {
          const m = UI.modal(`
            <div class="modal-head">编辑系列简介</div>
            <div class="modal-body">
              <textarea id="bioInput" maxlength="200" rows="4" style="width:100%;background:var(--bg3);border:1px solid var(--line);border-radius:8px;color:var(--txt);padding:10px 12px;font-size:14px;font-family:inherit;outline:none;resize:vertical" placeholder="介绍一下这个系列的内容和特色...">${UI.esc(s.bio || '')}</textarea>
            </div>
            <div class="modal-foot">
              <button class="btn" data-a="cancel">取消</button>
              <button class="btn-primary" data-a="ok">保存</button>
            </div>`, { overlayClose: false });
          m.overlay.querySelector('[data-a="cancel"]').onclick = () => m.close();
          m.overlay.querySelector('[data-a="ok"]').onclick = async () => {
            const bio = m.overlay.querySelector('#bioInput').value.trim();
            await Data.updateSeries(sid, { bio });
            m.close();
            toast('简介已更新');
            renderManage('series');
          };
        }
        if (act === 'savatar') {
          // 打开换头像对话框，支持预设和上传两种方式
          const m = UI.modal(`
            <div class="modal-head">更换系列头像</div>
            <div class="modal-body">
              <div style="margin-bottom:12px;color:var(--txt2)">选择预设头像：</div>
              <div class="preset-picker" id="savatarPreset">
                ${Object.keys(UI.PRESET_AVATARS).map((key) => `
                  <div class="pp-item ${s.avatar && s.avatar.type === 'preset' && s.avatar.key === key ? 'active' : ''}" data-key="${key}" title="${UI.PRESET_AVATARS[key].name}">
                    <div class="preset-avatar" style="width:36px;height:36px;background:linear-gradient(135deg,#fff5f5,#fff0f5)">${UI.PRESET_AVATARS[key].svg}</div>
                  </div>
                `).join('')}
              </div>
              <div style="margin:16px 0 8px;color:var(--txt2)">或上传自定义头像：</div>
              <div style="display:flex;gap:10px;align-items:center">
                <button class="btn" id="savatarUploadBtn">选择图片</button>
                <input type="file" id="savatarUpload" accept="image/*" style="display:none">
                <span class="file-name" id="savatarFileLabel">未选择</span>
              </div>
            </div>
            <div class="modal-foot">
              <button class="btn" data-a="cancel">取消</button>
              <button class="btn-primary" data-a="ok">确定</button>
            </div>`, { overlayClose: false });

          let presetKey = (s.avatar && s.avatar.type === 'preset') ? s.avatar.key : null;
          let uploadFile = null;

          const presetItems = m.overlay.querySelectorAll('#savatarPreset .pp-item');
          presetItems.forEach((item) => {
            item.addEventListener('click', () => {
              presetItems.forEach((i) => i.classList.remove('active'));
              item.classList.add('active');
              presetKey = item.dataset.key;
              uploadFile = null;
              m.overlay.querySelector('#savatarFileLabel').textContent = '已选择预设头像';
            });
          });

          const uploadInput = m.overlay.querySelector('#savatarUpload');
          m.overlay.querySelector('#savatarUploadBtn').addEventListener('click', () => uploadInput.click());
          uploadInput.addEventListener('change', () => {
            if (uploadInput.files[0]) {
              uploadFile = uploadInput.files[0];
              presetKey = null;
              presetItems.forEach((i) => i.classList.remove('active'));
              m.overlay.querySelector('#savatarFileLabel').textContent = uploadFile.name;
            }
          });

          m.overlay.querySelector('[data-a="cancel"]').onclick = () => m.close();
          m.overlay.querySelector('[data-a="ok"]').onclick = async () => {
            if (presetKey) {
              await Data.updateSeries(sid, { presetAvatar: presetKey });
              toast('头像已更新');
            } else if (uploadFile) {
              await Data.updateSeries(sid, { avatarFile: uploadFile });
              toast('头像已更新');
            }
            m.close();
            renderManage('series');
          };
        }
        if (act === 'sdel') {
          const count = Data.S.videos.filter((v) => v.seriesId === sid).length;
          const ok = await UI.confirmDialog({
            title: '删除系列',
            text: `确定删除系列「${esc(s.name)}」吗？该系列下 ${count} 个视频将变为「未分组」，相关会话消息会删除。`,
            okText: '删除', danger: true
          });
          if (ok) { await Data.deleteSeries(sid); toast('已删除系列'); }
        }
      });
    });
  }

  // ---------------- 小游戏 ----------------
  function renderGame() {
    const page = document.getElementById('pageGame');
    const best = (Data.S.kvRaw && Data.S.kvRaw.gameBest) || 0;
    page.innerHTML = `
      <div class="page-scroll scrollable">
        <div class="game-wrap">
          <div class="game-hero card-panel">
            <div class="gh-ico">${icon('gamepad', 52)}</div>
            <h2>字母点点乐</h2>
            <p>30 秒内，点击屏幕上方提示的字母气泡。<br>点对得分，点错扣分，来锻炼你的眼睛和手速吧！</p>
            <button class="btn-primary" id="gameStartBtn" style="padding:12px 42px;font-size:16px">开始游戏</button>
            <div class="game-best">最高纪录：${best} 分</div>
          </div>
        </div>
      </div>`;
    page.querySelector('#gameStartBtn').addEventListener('click', openGameModal);
  }

  function openGameModal() {
    const m = UI.modal(`
      <div class="modal-head" style="padding-bottom:14px">字母点点乐 <button class="icon-btn game-close">${icon('close', 18)}</button></div>
      <div class="game-head">
        <div class="game-target">点击字母<b id="gTarget">-</b></div>
        <div class="game-stat">得分 <b id="gScore">0</b></div>
        <div class="game-stat">时间 <b id="gTime">30</b>s</div>
      </div>
      <div class="game-area" id="gArea"></div>`, { cls: 'game-modal', overlayClose: false });

    const area = m.overlay.querySelector('#gArea');
    const scoreEl = m.overlay.querySelector('#gScore');
    const targetEl = m.overlay.querySelector('#gTarget');
    const timeEl = m.overlay.querySelector('#gTime');
    let score = 0, target = '', timeLeft = 30, running = false;
    let spawnT = null, clockT = null;
    const clearTimers = () => { clearInterval(spawnT); clearInterval(clockT); };

    function newTarget() {
      target = String.fromCharCode(65 + Math.floor(Math.random() * 26));
      targetEl.textContent = target;
    }

    function spawn() {
      if (!running) return;
      const ch = String.fromCharCode(65 + Math.floor(Math.random() * 26));
      const size = 46 + Math.random() * 22;
      const b = document.createElement('div');
      b.className = 'g-bubble';
      b.style.width = b.style.height = size + 'px';
      b.style.fontSize = Math.round(size * 0.48) + 'px';
      b.style.left = Math.random() * Math.max(1, area.clientWidth - size) + 'px';
      b.style.top = Math.random() * Math.max(1, area.clientHeight - size) + 'px';
      b.style.background = `hsl(${Math.floor(Math.random() * 360)}, 65%, 52%)`;
      b.textContent = ch;
      b.addEventListener('click', () => {
        if (!running) return;
        if (ch === target) {
          score++;
          scoreEl.textContent = score;
          newTarget();
          b.classList.add('pop');
          setTimeout(() => b.remove(), 180);
        } else {
          score = Math.max(0, score - 1);
          scoreEl.textContent = score;
        }
      });
      area.appendChild(b);
      setTimeout(() => {
        if (!b.isConnected) return;
        b.style.transition = 'opacity .4s';
        b.style.opacity = '0';
        setTimeout(() => b.remove(), 400);
      }, 2600);
    }

    function end() {
      running = false;
      clearTimers();
      area.querySelectorAll('.g-bubble').forEach((b) => b.remove());
      const prevBest = (Data.S.kvRaw && Data.S.kvRaw.gameBest) || 0;
      const best = Math.max(prevBest, score);
      Data.S.kvRaw = Data.S.kvRaw || {};
      Data.S.kvRaw.gameBest = best;
      DB.put('kv', { key: 'gameBest', value: best });
      const ov = document.createElement('div');
      ov.className = 'game-center';
      ov.innerHTML = `<div style="font-size:18px">时间到</div><div class="go-score">${score} 分</div><div class="tip">最高纪录：${best} 分</div><button class="btn-primary" id="gAgain">再来一局</button>`;
      area.appendChild(ov);
      ov.querySelector('#gAgain').addEventListener('click', start);
    }

    function start() {
      area.querySelectorAll('.g-bubble, .game-center').forEach((b) => b.remove());
      score = 0;
      scoreEl.textContent = '0';
      timeLeft = 30;
      timeEl.textContent = '30';
      running = true;
      newTarget();
      clearTimers();
      spawnT = setInterval(spawn, 650);
      clockT = setInterval(() => {
        timeLeft--;
        timeEl.textContent = timeLeft;
        if (timeLeft <= 0) end();
      }, 1000);
    }

    m.overlay.querySelector('.game-close').addEventListener('click', () => {
      running = false;
      clearTimers();
      m.close();
      renderGame();
    });

    const ov = document.createElement('div');
    ov.className = 'game-center';
    ov.innerHTML = `<button class="btn-primary" id="gBegin" style="padding:12px 42px;font-size:16px">开始</button>`;
    area.appendChild(ov);
    ov.querySelector('#gBegin').addEventListener('click', start);
  }

  // ---------------- 搜索 ----------------
  function renderSearch(q) {
    searchQuery = q;
    const page = document.getElementById('pageSearch');
    const qq = q.trim().toLowerCase();
    const res = Data.S.videos
      .filter((v) => v.title.toLowerCase().includes(qq) || Data.seriesName(v).toLowerCase().includes(qq))
      .sort((a, b) => b.addedAt - a.addedAt);
    page.innerHTML = `
      <div class="page-scroll scrollable">
        <div class="search-head">搜索“<b>${esc(q)}</b>”：找到 ${res.length} 个视频</div>
        ${res.length ? `<div class="grid">${res.map((v) => cardHtml(v, null)).join('')}</div>` : '<div class="empty in-panel"><p>没有找到相关视频</p><p class="tip">换个关键词试试，或到「视频管理」添加更多视频</p></div>'}
      </div>`;
    bindGrid(page);
    decorate(page, res);
  }

  // ---------------- 首页（热度榜） ----------------
  function hotScore(v) {
    const inter = Data.getInter(v.id);
    const views = inter.watchCount || 0;
    const likes = inter.liked ? 1 : 0;
    const favs = inter.favored ? 1 : 0;
    // 加权：观看×1 + 点赞×5 + 收藏×3
    return views * 1 + likes * 5 + favs * 3;
  }

  function hotBadge(rank) {
    if (rank === 1) return '<span class="hot-badge hot-1">1</span>';
    if (rank === 2) return '<span class="hot-badge hot-2">2</span>';
    if (rank === 3) return '<span class="hot-badge hot-3">3</span>';
    return `<span class="hot-badge hot-n">${rank}</span>`;
  }

  function homeCardHtml(v, rank) {
    const score = hotScore(v);
    const inter = Data.getInter(v.id);
    return `
      <div class="card home-card" data-vid="${v.id}">
        <div class="thumb-wrap">
          ${UI.thumbNode(v)}
          ${hotBadge(rank)}
          <span class="play-overlay">${icon('play', 34)}</span>
        </div>
        <div class="card-body">
          <div class="card-title" title="${esc(v.title)}">${esc(v.title)}</div>
          <div class="card-sub">${esc(Data.seriesName(v))} · ${catTag(v)}</div>
          <div class="hot-stats">
            <span class="hot-stat">${icon('play-circle', 12)} ${inter.watchCount || 0}</span>
            <span class="hot-stat">${icon('heart', 12)} ${inter.liked ? 1 : 0}</span>
            <span class="hot-stat">${icon('star', 12)} ${inter.favored ? 1 : 0}</span>
            <span class="hot-score">综合 ${score}</span>
          </div>
        </div>
      </div>`;
  }

  function renderHome() {
    const page = document.getElementById('pageHome');
    const videos = Data.S.videos
      .slice()
      .sort((a, b) => hotScore(b) - hotScore(a));

    page.innerHTML = `
      <div class="page-scroll scrollable">
        <div class="page-head">
          <h2>🔥 热门榜单</h2>
          <span class="sub">综合观看、点赞、收藏排名</span>
        </div>
        ${videos.length
          ? `<div class="grid">${videos.map((v, i) => homeCardHtml(v, i + 1)).join('')}</div>`
          : '<div class="empty in-panel"><p>还没有视频</p><p class="tip">到「视频管理」添加视频后，这里会按热度排名显示</p></div>'}
      </div>`;
    bindGrid(page);
    decorate(page, videos);
  }

  // ---------------- 系列详情页 ----------------
  function renderSeriesPage(seriesId) {
    const page = document.getElementById('pageSeries');
    const s = Data.seriesById(seriesId);
    if (!s) {
      page.innerHTML = `
        <div class="page-scroll scrollable">
          <div class="empty in-panel"><p>系列不存在</p><button class="btn" onclick="App.showPage('feed')">返回首页</button></div>
        </div>`;
      return;
    }
    const videos = Data.S.videos
      .filter((v) => v.seriesId === seriesId)
      .sort((a, b) => b.addedAt - a.addedAt);
    const followed = Data.isFollowed(seriesId);

    page.innerHTML = `
      <div class="series-page-wrap">
        <div class="series-page-head">
          <button class="back-btn" id="spBack">${icon('close', 18)} 返回</button>
          <div class="sp-avatar">${UI.avatarHtml(s, 80)}</div>
          <div class="sp-info">
            <div class="sp-name">${esc(s.name)}</div>
            <div class="sp-meta">${videos.length} 个视频 · 系列</div>
            <div class="sp-actions">
              <button class="btn-primary" id="spFollow">${followed ? '已关注' : '关注系列'}</button>
              <button class="btn" id="spPlayAll">播放全部</button>
            </div>
          </div>
        </div>
        <div class="series-page-body">
          <h3>系列视频（${videos.length}）</h3>
          ${videos.length ? `
            <div class="grid sp-video-grid">
              ${videos.map((v) => `
                <div class="card" data-vid="${v.id}">
                  <div class="thumb-wrap">
                    ${UI.thumbNode(v)}
                    <span class="play-overlay">${icon('play', 34)}</span>
                  </div>
                  <div class="card-body">
                    <div class="card-title" title="${esc(v.title)}">${esc(v.title)}</div>
                    <div class="card-sub">${esc(Data.seriesName(v))} · ${catTag(v)}</div>
                    <div class="card-actions">
                      <button class="btn btn-sm" data-sp-act="edit" data-vid="${v.id}">${icon('edit', 12)} 编辑</button>
                      <button class="btn btn-sm" data-sp-act="play" data-vid="${v.id}">播放</button>
                    </div>
                  </div>
                </div>
              `).join('')}
            </div>
          ` : '<div class="empty in-panel"><p>该系列暂无视频</p></div>'}
        </div>
      </div>`;

    page.querySelector('#spBack').addEventListener('click', () => {
      App.showPage('feed');
      history.replaceState(null, '', location.href.split('#')[0]);
    });
    page.querySelector('#spFollow').addEventListener('click', async () => {
      if (followed) {
        await Data.unfollowSeries(seriesId);
        toast('已取消关注');
      } else {
        await Data.followSeries(seriesId);
        toast('已关注');
      }
      renderSeriesPage(seriesId);
    });
    page.querySelector('#spPlayAll').addEventListener('click', () => {
      if (videos.length) App.playVideo(videos[0].id);
    });

    // 系列详情页视频编辑按钮
    page.querySelectorAll('[data-sp-act="edit"]').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const vid = btn.dataset.vid;
        const v = Data.videoById(vid);
        if (!v) return;
        const html = `
          <div style="display:flex;flex-direction:column;gap:14px">
            <div>
              <label style="display:block;color:var(--txt2);font-size:13px;margin-bottom:6px">视频标题</label>
              <input type="text" id="evTitle" value="${esc(v.title)}" maxlength="80" style="width:100%;height:38px;background:var(--bg3);border:1px solid var(--line);border-radius:8px;color:var(--txt);padding:0 12px">
            </div>
            <div>
              <label style="display:block;color:var(--txt2);font-size:13px;margin-bottom:6px">视频简介</label>
              <textarea id="evDesc" rows="3" maxlength="300" placeholder="介绍一下这个视频的内容..." style="width:100%;background:var(--bg3);border:1px solid var(--line);border-radius:8px;color:var(--txt);padding:10px 12px;font-family:inherit;resize:vertical">${esc(v.description || '')}</textarea>
            </div>
            <div style="display:flex;gap:14px">
              <div style="flex:1">
                <label style="display:block;color:var(--txt2);font-size:13px;margin-bottom:6px">分类</label>
                <select id="evCat" style="width:100%;height:38px;background:var(--bg3);border:1px solid var(--line);border-radius:8px;color:var(--txt);padding:0 12px">
                  ${CATEGORIES.map((c) => `<option value="${c.id}" ${c.id === v.categoryId ? 'selected' : ''}>${c.name}</option>`).join('')}
                </select>
              </div>
              <div style="flex:1">
                <label style="display:block;color:var(--txt2);font-size:13px;margin-bottom:6px">所属系列</label>
                <select id="evSeries" style="width:100%;height:38px;background:var(--bg3);border:1px solid var(--line);border-radius:8px;color:var(--txt);padding:0 12px">
                  <option value="">未分组</option>
                  ${Data.S.series.map((s) => `<option value="${s.id}" ${s.id === v.seriesId ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}
                </select>
              </div>
            </div>
          </div>`;
        const ok = await UI.confirmDialog({
          title: '编辑视频',
          html,
          okText: '保存',
          onReady: () => {}
        });
        if (ok) {
          const title = document.getElementById('evTitle')?.value?.trim();
          const desc = document.getElementById('evDesc')?.value?.trim() || '';
          const cat = document.getElementById('evCat')?.value;
          const sid = document.getElementById('evSeries')?.value || null;
          if (title) {
            await Data.updateVideo(vid, { title, description: desc, categoryId: cat, seriesId: sid });
            toast('已保存');
            renderSeriesPage(seriesId);
          }
        }
      });
    });
    // 播放按钮
    page.querySelectorAll('[data-sp-act="play"]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        App.playVideo(btn.dataset.vid);
      });
    });

    decorate(page, videos);
  }

  // ---------------- 侧边面板：通知 / 消息 ----------------
  function openPanel(kind) {
    panelKind = kind;
    const panel = document.getElementById('sidePanel');
    const overlay = document.getElementById('panelOverlay');
    panel.classList.remove('hidden');
    overlay.classList.remove('hidden');
    panel.classList.toggle('wide', kind === 'msg');
    requestAnimationFrame(() => panel.classList.add('open'));
    if (kind === 'notify') renderNotify();
    else renderMsgPanel();
  }

  function closePanel() {
    panelKind = null;
    const panel = document.getElementById('sidePanel');
    panel.classList.remove('open');
    document.getElementById('panelOverlay').classList.add('hidden');
    setTimeout(() => { if (!panelKind) panel.classList.add('hidden'); }, 300);
  }

  function renderNotify() {
    const panel = document.getElementById('sidePanel');
    panel.innerHTML = `
      <div class="panel-header"><span>通知</span><button class="icon-btn panel-close">${icon('close', 20)}</button></div>
      <div class="panel-body scrollable">
        ${Data.S.notifications.length ? Data.S.notifications.map((n) => `
          <div class="notif ${n.read ? '' : 'unread'}">
            <div class="notif-ic">${icon(n.type === 'update' ? 'bell' : 'sparkle', 19)}</div>
            <div>
              <div class="notif-text">${esc(n.content)}</div>
              <div class="notif-time">${fmtTime(n.createdAt)}</div>
            </div>
          </div>`).join('') : '<div class="empty in-panel"><p>暂无通知</p></div>'}
      </div>`;
    panel.querySelector('.panel-close').addEventListener('click', closePanel);
    Data.markNotificationsRead();
  }

  function convListData() {
    const S = Data.S;
    const convs = [{ id: 'official', name: '魔耳小助手' }];
    for (const s of S.series) {
      const followed = Data.isFollowed(s.id);
      const hasMsg = S.messages.some((m) => m.convId === s.id);
      if (followed || hasMsg) convs.push({ id: s.id, name: s.name, series: s });
    }
    const lastTs = (id) => {
      let t = 0;
      for (const m of S.messages) if (m.convId === id && m.createdAt > t) t = m.createdAt;
      return t;
    };
    convs.sort((a, b) => lastTs(b.id) - lastTs(a.id));
    return convs;
  }

  function renderMsgPanel() {
    const panel = document.getElementById('sidePanel');
    panel.innerHTML = `
      <div class="panel-header"><span>消息</span><button class="icon-btn panel-close">${icon('close', 20)}</button></div>
      <div class="msg-layout">
        <div class="conv-list scrollable" id="convList"></div>
        <div class="chat-col">
          <div class="chat-head" id="chatHead"></div>
          <div class="chat-body scrollable" id="chatBody"></div>
          <div class="chat-input">
            <input id="chatInput" placeholder="发送消息…" maxlength="200" autocomplete="off">
            <button class="btn-primary" id="chatSend">发送</button>
          </div>
        </div>
      </div>`;
    panel.querySelector('.panel-close').addEventListener('click', closePanel);
    renderConvList();
    const convs = convListData();
    if (!convs.some((c) => c.id === selectedConv)) selectedConv = convs.length ? convs[0].id : 'official';
    renderChat();
    Data.markConvRead(selectedConv);
    const send = async () => {
      const input = panel.querySelector('#chatInput');
      const text = input.value.trim();
      if (!text) return;
      await Data.sendMessage(selectedConv, text);
      input.value = '';
    };
    panel.querySelector('#chatSend').addEventListener('click', send);
    panel.querySelector('#chatInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') send(); });
  }

  function convAvatar(id) {
    if (id === 'official') {
      return `<div class="avatar letter" style="width:40px;height:40px;background:linear-gradient(135deg,#fe2c55,#ff7847);font-size:15px">魔</div>`;
    }
    return UI.avatarHtml(Data.seriesById(id), 40);
  }

  function renderConvList() {
    const listEl = document.getElementById('convList');
    if (!listEl) return;
    const convs = convListData();
    listEl.innerHTML = convs.map((c) => {
      const msgs = Data.S.messages.filter((m) => m.convId === c.id);
      const last = msgs[msgs.length - 1];
      const unread = msgs.filter((m) => m.from === 'them' && !m.read).length;
      return `
        <div class="conv-item ${selectedConv === c.id ? 'active' : ''}" data-conv="${c.id}">
          ${convAvatar(c.id)}
          <div class="conv-mid">
            <div class="conv-name">${esc(c.name)}</div>
            <div class="conv-preview">${last ? esc((last.from === 'me' ? '我：' : '') + last.text) : '开始聊天吧'}</div>
          </div>
          ${unread ? `<span class="conv-badge">${unread}</span>` : ''}
        </div>`;
    }).join('');
    listEl.querySelectorAll('.conv-item').forEach((el) => {
      el.addEventListener('click', () => {
        selectedConv = el.dataset.conv;
        renderConvList();
        renderChat();
        Data.markConvRead(selectedConv);
      });
    });
  }

  function renderChat() {
    const head = document.getElementById('chatHead');
    const body = document.getElementById('chatBody');
    if (!head || !body) return;
    const conv = convListData().find((c) => c.id === selectedConv);
    head.textContent = conv ? conv.name : '';
    const msgs = Data.S.messages.filter((m) => m.convId === selectedConv);
    body.innerHTML = msgs.length
      ? msgs.map((m) => `<div class="bubble ${m.from === 'me' ? 'me' : 'them'}">${esc(m.text)}</div>`).join('')
      : '<div class="empty in-panel"><p>还没有消息，打个招呼吧</p></div>';
    body.scrollTop = body.scrollHeight;
  }

  function refreshMsgPanel() {
    if (panelKind !== 'msg') return;
    const convs = convListData();
    if (!convs.some((c) => c.id === selectedConv)) selectedConv = convs.length ? convs[0].id : 'official';
    renderConvList();
    renderChat();
  }

  Data.on((evt) => {
    if (evt === 'messages') refreshMsgPanel();
    if (evt === 'notify' && panelKind === 'notify') {
      const badge = Data.unreadNotify();
      if (badge > 0) renderNotify();
    }
  });


  // ---------------- 登录 / 注册弹窗 ----------------
  function showLoginDialog() {
    let mode = 'login';
    const render = () => {
      const title = mode === 'login' ? '登录' : '注册';
      const html = `
        <div style="display:flex;flex-direction:column;gap:14px;min-width:320px">
          <div style="text-align:center;margin-bottom:4px">
            <div style="font-size:22px;font-weight:700;margin-bottom:4px">${title}魔耳</div>
            <div style="color:var(--txt2);font-size:13px">开启云端同步与会员特权</div>
          </div>
          <div>
            <label style="display:block;color:var(--txt2);font-size:13px;margin-bottom:6px">用户名</label>
            <input type="text" id="authUsername" maxlength="20" placeholder="请输入用户名" style="width:100%;height:40px;background:var(--bg3);border:1px solid var(--line);border-radius:8px;color:var(--txt);padding:0 14px;font-size:14px">
          </div>
          ${mode === 'register' ? `
          <div>
            <label style="display:block;color:var(--txt2);font-size:13px;margin-bottom:6px">邮箱（选填）</label>
            <input type="email" id="authEmail" placeholder="用于找回密码" style="width:100%;height:40px;background:var(--bg3);border:1px solid var(--line);border-radius:8px;color:var(--txt);padding:0 14px;font-size:14px">
          </div>` : ''}
          <div>
            <label style="display:block;color:var(--txt2);font-size:13px;margin-bottom:6px">密码</label>
            <input type="password" id="authPassword" placeholder="至少6位" style="width:100%;height:40px;background:var(--bg3);border:1px solid var(--line);border-radius:8px;color:var(--txt);padding:0 14px;font-size:14px">
          </div>
          <div id="authError" style="color:var(--red);font-size:12px;min-height:16px"></div>
          <button class="btn-primary" id="authSubmit" style="width:100%;height:42px;font-size:15px">${mode === 'login' ? '登录' : '注册账号'}</button>
          <div style="text-align:center;color:var(--txt2);font-size:13px">
            ${mode === 'login' ? '还没有账号？' : '已有账号？'}
            <span class="link-btn" id="authToggle">${mode === 'login' ? '去注册' : '去登录'}</span>
          </div>
          <div style="text-align:center;color:var(--txt2);font-size:11px;padding-top:8px;border-top:1px solid var(--line)">
            ${Cloud.CONFIG.mode === 'remote' ? '登录后可投稿视频、查看稿费收益' : '本地演示模式 · 数据保存在本浏览器'}
          </div>
        </div>`;
      UI.modal({
        title: '',
        html,
        hideTitle: true,
        okText: '',
        showFooter: false,
        onReady: () => {
          document.getElementById('authToggle').onclick = () => {
            mode = mode === 'login' ? 'register' : 'login';
            UI.closeModal();
            render();
          };
          const submit = async () => {
            const username = document.getElementById('authUsername').value.trim();
            const password = document.getElementById('authPassword').value;
            const email = document.getElementById('authEmail')?.value?.trim() || '';
            const errEl = document.getElementById('authError');
            try {
              if (mode === 'login') {
                await Cloud.login({ username, password });
              } else {
                await Cloud.register({ username, email, password });
              }
              UI.closeModal();
              toast(mode === 'login' ? '登录成功' : '注册成功');
              App.updateLoginBtn();
              App.updateVipBtn();
              window.dispatchEvent(new Event('moer-auth'));
            } catch (e) {
              errEl.textContent = e.message || '操作失败';
            }
          };
          document.getElementById('authSubmit').onclick = submit;
          ['authUsername', 'authPassword'].forEach((id) => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
          });
        }
      });
    };
    render();
  }

  // ---------------- 会员弹窗 ----------------
  function showVipDialog() {
    const info = Cloud.getVipInfo();
    const html = `
      <div style="min-width:360px">
        <div style="text-align:center;padding:20px 0 24px;background:linear-gradient(135deg,#ff6b9d,#c44569);border-radius:12px;margin-bottom:20px">
          <div style="font-size:32px;margin-bottom:8px">👑</div>
          <div style="font-size:22px;font-weight:700;color:#fff;margin-bottom:4px">魔耳 VIP 会员</div>
          <div style="color:rgba(255,255,255,.85);font-size:13px">${info.isVip ? `已开通 · 剩余 ${info.daysLeft} 天` : '全部内容随心看'}</div>
        </div>
        <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:20px">
          <div style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:var(--bg3);border-radius:8px">
            <span style="color:var(--cyan)">✓</span>
            <span>解锁全部高清视频</span>
          </div>
          <div style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:var(--bg3);border-radius:8px">
            <span style="color:var(--cyan)">✓</span>
            <span>多设备云端同步</span>
          </div>
          <div style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:var(--bg3);border-radius:8px">
            <span style="color:var(--cyan)">✓</span>
            <span>专属会员内容系列</span>
          </div>
          <div style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:var(--bg3);border-radius:8px">
            <span style="color:var(--cyan)">✓</span>
            <span>无广告纯净体验</span>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:16px">
          <div style="text-align:center;padding:12px 6px;border:2px solid var(--line);border-radius:10px;cursor:pointer" class="vip-plan" data-days="30">
            <div style="font-size:16px;font-weight:700">月卡</div>
            <div style="color:var(--txt2);font-size:11px;margin:4px 0">30天</div>
            <div style="color:var(--red);font-weight:700">¥19.9</div>
          </div>
          <div style="text-align:center;padding:12px 6px;border:2px solid var(--line);border-radius:10px;cursor:pointer" class="vip-plan" data-days="90">
            <div style="font-size:16px;font-weight:700">季卡</div>
            <div style="color:var(--txt2);font-size:11px;margin:4px 0">90天</div>
            <div style="color:var(--red);font-weight:700">¥49.9</div>
          </div>
          <div style="text-align:center;padding:12px 6px;border:2px solid var(--red);border-radius:10px;cursor:pointer;background:rgba(254,44,85,.08)" class="vip-plan" data-days="365">
            <div style="font-size:16px;font-weight:700">年卡</div>
            <div style="color:var(--gold);font-size:11px;margin:4px 0">推荐 · 省60%</div>
            <div style="color:var(--red);font-weight:700">¥99</div>
          </div>
          <div style="text-align:center;padding:12px 6px;border:2px solid var(--line);border-radius:10px;cursor:pointer" class="vip-plan" data-days="9999">
            <div style="font-size:16px;font-weight:700">终身</div>
            <div style="color:var(--txt2);font-size:11px;margin:4px 0">永久享用</div>
            <div style="color:var(--red);font-weight:700">¥199</div>
          </div>
        </div>
        <button class="btn-primary" id="vipActivate" style="width:100%;height:44px;font-size:15px">
          ${info.isVip ? '延长会员' : '立即开通会员'}
        </button>
        <div style="text-align:center;color:var(--txt2);font-size:11px;margin-top:12px">
          当前为本地演示模式，点击即开通体验
        </div>
      </div>`;
    UI.modal({
      title: '',
      html,
      hideTitle: true,
      showFooter: false,
      onReady: () => {
        document.getElementById('vipActivate').onclick = () => {
          const selected = document.querySelector('.vip-plan[style*="border: 2px solid var(--red)"]') || document.querySelector('.vip-plan[data-days="365"]');
          const days = parseInt(selected.dataset.days);
          const info = Cloud.activateVip(days);
          UI.closeModal();
          toast(`会员已开通 ${days === 9999 ? '终身' : days + '天'}！`);
          App.updateVipBtn();
        };
        document.querySelectorAll('.vip-plan').forEach((plan) => {
          plan.onclick = () => {
            document.querySelectorAll('.vip-plan').forEach((p) => {
              p.style.borderColor = 'var(--line)';
              p.style.background = '';
            });
            plan.style.borderColor = 'var(--red)';
            plan.style.background = 'rgba(254,44,85,.08)';
          };
        });
      }
    });
  }

  // ---------------- 修改密码 ----------------
  function showChangePwdDialog() {
    if (Cloud.CONFIG.mode !== 'remote') {
      toast('本地演示模式不支持修改密码');
      return;
    }
    const m = UI.modal(`
      <div class="modal-head">修改密码</div>
      <div class="modal-body">
        <div style="display:flex;flex-direction:column;gap:12px;min-width:300px">
          <div>
            <label style="display:block;color:var(--txt2);font-size:13px;margin-bottom:6px">旧密码</label>
            <input type="password" id="pwOld" style="width:100%;height:40px;background:var(--bg3);border:1px solid var(--line);border-radius:8px;color:var(--txt);padding:0 14px;font-size:14px">
          </div>
          <div>
            <label style="display:block;color:var(--txt2);font-size:13px;margin-bottom:6px">新密码（至少6位）</label>
            <input type="password" id="pwNew" style="width:100%;height:40px;background:var(--bg3);border:1px solid var(--line);border-radius:8px;color:var(--txt);padding:0 14px;font-size:14px">
          </div>
          <div>
            <label style="display:block;color:var(--txt2);font-size:13px;margin-bottom:6px">确认新密码</label>
            <input type="password" id="pwNew2" style="width:100%;height:40px;background:var(--bg3);border:1px solid var(--line);border-radius:8px;color:var(--txt);padding:0 14px;font-size:14px">
          </div>
          <div id="pwError" style="color:var(--red);font-size:12px;min-height:16px"></div>
        </div>
      </div>
      <div class="modal-foot">
        <button class="btn" data-a="cancel">取消</button>
        <button class="btn-primary" data-a="ok">确认修改</button>
      </div>`, { overlayClose: false });
    m.overlay.querySelector('[data-a="cancel"]').onclick = () => m.close();
    m.overlay.querySelector('[data-a="ok"]').onclick = async () => {
      const oldPw = m.overlay.querySelector('#pwOld').value;
      const newPw = m.overlay.querySelector('#pwNew').value;
      const newPw2 = m.overlay.querySelector('#pwNew2').value;
      const err = m.overlay.querySelector('#pwError');
      if (!oldPw) { err.textContent = '请输入旧密码'; return; }
      if (newPw.length < 6) { err.textContent = '新密码至少6位'; return; }
      if (newPw !== newPw2) { err.textContent = '两次输入的新密码不一致'; return; }
      try {
        await Cloud.apiPost('/auth/change-password', { oldPassword: oldPw, newPassword: newPw });
        m.close();
        toast('密码已修改，下次登录请使用新密码');
      } catch (e) {
        err.textContent = e.message || '修改失败';
      }
    };
  }

  // ---------------- 用户中心 ----------------
  function showUserCenter() {
    const u = Cloud.getCurrentUser();
    const info = Cloud.getVipInfo();
    const lastSync = Cloud.getLastSyncTime();
    const html = `
      <div style="min-width:320px">
        <div style="display:flex;align-items:center;gap:14px;margin-bottom:20px;padding-bottom:20px;border-bottom:1px solid var(--line)">
          <div style="width:56px;height:56px;border-radius:50%;background:var(--red);display:flex;align-items:center;justify-content:center;color:#fff;font-size:22px;font-weight:700">${(u.username || 'U').charAt(0).toUpperCase()}</div>
          <div style="flex:1">
            <div style="font-size:18px;font-weight:600">${esc(u.username)}</div>
            <div style="color:var(--txt2);font-size:12px;margin-top:2px">
              ${info.isVip ? `<span style="color:var(--gold)">👑 VIP 会员 · ${info.daysLeft}天</span>` : '<span>普通用户</span>'}
            </div>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:20px">
          <button class="btn" style="width:100%;text-align:left;padding:12px 16px;display:flex;justify-content:space-between;align-items:center" id="btnChangePwd">
            <span>🔑 修改密码</span>
            <span style="color:var(--txt2);font-size:12px">账号安全</span>
          </button>
          <button class="btn" style="width:100%;text-align:left;padding:12px 16px;display:flex;justify-content:space-between;align-items:center" id="btnSync">
            <span>☁️ 云端同步</span>
            <span style="color:var(--txt2);font-size:12px">${lastSync ? '上次：' + new Date(lastSync).toLocaleString() : '未同步'}</span>
          </button>
          <button class="btn" style="width:100%;text-align:left;padding:12px 16px" id="btnVipCenter">
            👑 会员中心
          </button>
        </div>
        <div style="display:flex;gap:10px">
          <button class="btn" style="flex:1" id="btnLogout">退出登录</button>
          <button class="btn-primary" style="flex:1" id="btnCloseUser">关闭</button>
        </div>
      </div>`;
    UI.modal({
      title: '',
      html,
      hideTitle: true,
      showFooter: false,
      onReady: () => {
        document.getElementById('btnCloseUser').onclick = () => UI.closeModal();
        document.getElementById('btnChangePwd').onclick = () => {
          UI.closeModal();
          showChangePwdDialog();
        };
        document.getElementById('btnLogout').onclick = () => {
          Cloud.logout();
          UI.closeModal();
          toast('已退出登录');
          App.updateLoginBtn();
          window.dispatchEvent(new Event('moer-auth'));
        };
        document.getElementById('btnVipCenter').onclick = () => {
          UI.closeModal();
          showVipDialog();
        };
        document.getElementById('btnSync').onclick = async () => {
          try {
            await Cloud.syncToCloud();
            toast('同步成功');
            showUserCenter();
          } catch (e) {
            toast(e.message || '同步失败');
          }
        };
      }
    });
  }


  async function renderManageUsers() {
    const box = document.getElementById('manageBody');
    if (!box) return;
    box.innerHTML = '<p class="tip">加载中…</p>';
    let users = [];
    try {
      users = (await Cloud.apiGet('/admin/users')).users || [];
    } catch (e) {
      box.innerHTML = `<p class="tip">加载失败：${esc(e.message)}（需要管理员账号登录）</p>`;
      return;
    }
    const me = Cloud.getCurrentUser();
    box.innerHTML = `
      <div class="card-panel">
        <h3>账号管理</h3>
        <p class="tip">管理注册账号与权限分配。普通用户仅可投稿；管理员可审核投稿、管理账号。</p>
        <div id="userList"></div>
      </div>`;
    const listEl = box.querySelector('#userList');
    listEl.innerHTML = users.map((u) => {
      const isMe = me && me.id === u.id;
      const isAdmin = u.role === 'admin';
      const vipExpire = u.vipExpire || 0;
      const isVip = vipExpire > Date.now();
      const vipDaysLeft = isVip ? Math.ceil((vipExpire - Date.now()) / 86400000) : 0;
      return `
      <div class="row" data-uid="${u.id}">
        <div class="row-main">
          <div class="row-title">${esc(u.username)} ${isMe ? '<span class="chip cyan">我</span>' : ''} ${isAdmin ? '<span class="chip gold">管理员</span>' : '<span class="chip">普通用户</span>'} ${isVip ? '<span class="chip gold">VIP' + vipDaysLeft + '天</span>' : ''}</div>
          <div class="row-sub">${esc(u.email || '无邮箱')} · 注册于 ${UI.fmtTime(u.createdAt)} · 投稿 ${u.submitted || 0}（通过 ${u.approved || 0}）</div>
        </div>
        <div class="row-acts">
          ${isMe ? '' : (isAdmin
            ? '<button class="btn btn-sm" data-act="demote">设为普通用户</button>'
            : '<button class="btn btn-sm" data-act="promote">设为管理员</button>')}
          ${isMe ? '' : '<button class="btn btn-sm" data-act="vip7" title="赠送7天VIP">+7天</button>'}
          ${isMe ? '' : '<button class="btn btn-sm" data-act="vip30" title="赠送30天VIP">+30天</button>'}
          ${isMe ? '' : '<button class="btn btn-sm" data-act="vip90" title="赠送季度VIP">+季度</button>'}
          ${isMe ? '' : '<button class="btn btn-sm" data-act="vip365" title="赠送年度VIP">+年度</button>'}
          ${isMe ? '' : (isVip ? '<button class="btn btn-sm" data-act="vipCancel" title="取消VIP">取消VIP</button>' : '')}
          ${isMe ? '' : '<button class="btn btn-sm btn-danger" data-act="del">删除</button>'}
        </div>
      </div>`;
    }).join('');
    listEl.querySelectorAll('[data-act]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const row = btn.closest('.row');
        const uid = row.dataset.uid;
        const uname = row.querySelector('.row-title').textContent.split(' ')[0];
        const act = btn.dataset.act;
        if (act === 'promote') {
          const ok = await UI.confirmDialog({ title: '设为管理员', text: `确定将「${esc(uname)}」设为管理员？管理员可审核投稿、管理账号。`, okText: '确认' });
          if (!ok) return;
          try { await Cloud.apiPost(`/admin/users/${uid}/role`, { role: 'admin' }); toast('已设为管理员'); renderManageUsers(); }
          catch (e) { toast(e.message); }
        }
        if (act === 'demote') {
          const ok = await UI.confirmDialog({ title: '设为普通用户', text: `确定取消「${esc(uname)}」的管理员权限？`, okText: '确认' });
          if (!ok) return;
          try { await Cloud.apiPost(`/admin/users/${uid}/role`, { role: 'user' }); toast('已设为普通用户'); renderManageUsers(); }
          catch (e) { toast(e.message); }
        }
        if (act === 'vip7') {
          const ok = await UI.confirmDialog({ title: '赠送VIP', text: `为「${esc(uname)}」赠送7天VIP会员？`, okText: '确认' });
          if (!ok) return;
          try { await Cloud.apiPost(`/admin/users/${uid}/vip`, { days: 7 }); toast('已赠送7天VIP'); renderManageUsers(); }
          catch (e) { toast(e.message); }
        }
        if (act === 'vip30') {
          const ok = await UI.confirmDialog({ title: '赠送VIP', text: `为「${esc(uname)}」赠送30天VIP会员？`, okText: '确认' });
          if (!ok) return;
          try { await Cloud.apiPost(`/admin/users/${uid}/vip`, { days: 30 }); toast('已赠送30天VIP'); renderManageUsers(); }
          catch (e) { toast(e.message); }
        }
        if (act === 'vip90') {
          const ok = await UI.confirmDialog({ title: '赠送VIP', text: `为「${esc(uname)}」赠送季度VIP（90天）？`, okText: '确认' });
          if (!ok) return;
          try { await Cloud.apiPost(`/admin/users/${uid}/vip`, { days: 90 }); toast('已赠送季度VIP'); renderManageUsers(); }
          catch (e) { toast(e.message); }
        }
        if (act === 'vip365') {
          const ok = await UI.confirmDialog({ title: '赠送VIP', text: `为「${esc(uname)}」赠送年度VIP（365天）？`, okText: '确认' });
          if (!ok) return;
          try { await Cloud.apiPost(`/admin/users/${uid}/vip`, { days: 365 }); toast('已赠送年度VIP'); renderManageUsers(); }
          catch (e) { toast(e.message); }
        }
        if (act === 'vipCancel') {
          const ok = await UI.confirmDialog({ title: '取消VIP', text: `确定取消「${esc(uname)}」的VIP会员？`, okText: '确认', danger: true });
          if (!ok) return;
          try { await Cloud.apiPost(`/admin/users/${uid}/vip`, { days: 0 }); toast('已取消VIP'); renderManageUsers(); }
          catch (e) { toast(e.message); }
        }
        if (act === 'del') {
          const ok = await UI.confirmDialog({ title: '删除账号', text: `确定删除「${esc(uname)}」？其投稿、评论、互动数据将一并删除，且无法恢复。`, okText: '删除', danger: true });
          if (!ok) return;
          try { await Cloud.apiPost(`/admin/users/${uid}/delete`, {}); toast('账号已删除'); renderManageUsers(); }
          catch (e) { toast(e.message); }
        }
      });
    });
  }


  // ---------------- 商城（用户浏览） ----------------
  async function renderShop() {
    const page = document.getElementById('pageShop');
    if (!page) return;
    page.innerHTML = `
      <div class="page-scroll scrollable">
        <div class="page-head"><h2>商城</h2><span class="sub">精选好物，点击跳转淘宝购买</span></div>
        <div id="shopGrid" class="grid"></div>
      </div>`;
    const grid = page.querySelector('#shopGrid');
    grid.innerHTML = '<p class="tip" style="padding:40px 0;text-align:center">加载中…</p>';
    try {
      const res = await Cloud.apiGet('/shop');
      const products = res.products || [];
      if (!products.length) {
        grid.innerHTML = '<div class="empty in-panel"><p>商城暂无商品，敬请期待</p></div>';
        return;
      }
      grid.innerHTML = products.map((p) => `
        <div class="card shop-card" data-url="${esc(p.taobaoUrl)}">
          <div class="thumb-wrap" style="height:180px;background:#1a1c28">
            ${p.image
              ? `<img class="thumb" src="${esc(p.image)}" alt="${esc(p.name)}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><div class="thumb-empty" style="display:none">${icon('film', 36)}</div>`
              : `<div class="thumb-empty">${icon('bag', 36)}</div>`
            }
            ${p.price > 0 ? `<span class="shop-price">¥${p.price.toFixed(2)}</span>` : ''}
          </div>
          <div class="card-body">
            <div class="card-title" title="${esc(p.name)}">${esc(p.name)}</div>
            ${p.description ? `<div class="card-sub" style="display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${esc(p.description)}</div>` : ''}
            <div class="card-actions">
              ${p.taobaoUrl ? `<a class="btn btn-sm btn-primary" href="${esc(p.taobaoUrl)}" target="_blank" rel="noopener" onclick="event.stopPropagation()">去购买</a>` : ''}
            </div>
          </div>
        </div>`).join('');
      grid.querySelectorAll('.shop-card').forEach((card) => {
        card.addEventListener('click', () => {
          const url = card.dataset.url;
          if (url) window.open(url, '_blank');
        });
      });
    } catch (e) {
      grid.innerHTML = `<p class="tip" style="padding:40px 0;text-align:center">加载失败：${esc(e.message)}</p>`;
    }
  }

  // ---------------- 管理后台：商品管理 ----------------
  async function renderManageProducts() {
    const box = document.getElementById('manageBody');
    if (!box) return;
    box.innerHTML = '<p class="tip">加载中…</p>';
    let products = [];
    try {
      products = (await Cloud.apiGet('/admin/products')).products || [];
    } catch (e) {
      box.innerHTML = `<p class="tip">加载失败：${esc(e.message)}（需要管理员账号登录）</p>`;
      return;
    }
    box.innerHTML = `
      <div class="card-panel">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
          <h3 style="margin:0">商品管理</h3>
          <button class="btn btn-primary btn-sm" id="addProductBtn">${icon('plus', 14)} 添加商品</button>
        </div>
        <p class="tip" style="margin-bottom:14px">管理商城上架商品。商品链接填写淘宝商品地址，用户点击后跳转淘宝购买。</p>
        <div id="productList"></div>
      </div>`;
    const listEl = box.querySelector('#productList');
    if (!products.length) {
      listEl.innerHTML = '<p class="tip" style="padding:24px 0;text-align:center">暂无商品，点击上方按钮添加</p>';
    } else {
      listEl.innerHTML = products.map((p) => `
        <div class="row" data-pid="${p.id}">
          <div class="rev-thumb thumb-empty" style="background:#1a1c28">${p.image ? `<img src="${esc(p.image)}" style="width:100%;height:100%;object-fit:cover;border-radius:6px" onerror="this.style.display='none'">` : icon('bag', 26)}</div>
          <div class="row-main">
            <div class="row-title">${esc(p.name)} ${p.isPublished ? '<span class="chip green">上架</span>' : '<span class="chip red">下架</span>'}</div>
            <div class="row-sub">${p.price > 0 ? '¥' + p.price.toFixed(2) : '免费'} · ${esc(p.category || '未分类')} · 排序 ${p.sortOrder || 0}</div>
            ${p.taobaoUrl ? `<div class="row-sub" style="word-break:break-all;font-size:11px;opacity:.6">🔗 ${esc(p.taobaoUrl)}</div>` : ''}
          </div>
          <div class="row-acts">
            <button class="btn btn-sm" data-act="edit">编辑</button>
            <button class="btn btn-sm" data-act="toggle">${p.isPublished ? '下架' : '上架'}</button>
            <button class="btn btn-sm btn-danger" data-act="del">删除</button>
          </div>
        </div>`).join('');
    }
    box.querySelector('#addProductBtn').addEventListener('click', () => showProductDialog(null, renderManageProducts));
    listEl.querySelectorAll('[data-act]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const row = btn.closest('.row');
        const pid = row.dataset.pid;
        const act = btn.dataset.act;
        if (act === 'edit') {
          const p = products.find((x) => x.id === pid);
          if (p) showProductDialog(p, renderManageProducts);
        }
        if (act === 'toggle') {
          const p = products.find((x) => x.id === pid);
          if (!p) return;
          try {
            await Cloud.apiPost(`/admin/products/${pid}`, { ...p, isPublished: !p.isPublished });
            toast(p.isPublished ? '已下架' : '已上架');
            renderManageProducts();
          } catch (e) { toast(e.message); }
        }
        if (act === 'del') {
          const p = products.find((x) => x.id === pid);
          const ok = await UI.confirmDialog({ title: '删除商品', text: `确定删除「${esc(p ? p.name : '')}」？`, okText: '删除', danger: true });
          if (!ok) return;
          try { await Cloud.apiPost(`/admin/products/${pid}/delete`, {}); toast('已删除'); renderManageProducts(); }
          catch (e) { toast(e.message); }
        }
      });
    });
  }

  // ---------------- 管理后台：广告管理 ----------------
  async function renderManageAds() {
    const box = document.getElementById('manageBody');
    if (!box) return;
    box.innerHTML = '<p class="tip">加载中…</p>';
    let ads = [];
    try {
      ads = (await Cloud.apiGet('/admin/ads')).ads || [];
    } catch (e) {
      box.innerHTML = `<p class="tip">加载失败：${esc(e.message)}（需要管理员账号登录）</p>`;
      return;
    }
    box.innerHTML = `
      <div class="card-panel">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
          <h3 style="margin:0">广告管理</h3>
          <button class="btn btn-primary btn-sm" id="addAdBtn">${icon('plus', 14)} 添加广告</button>
        </div>
        <div style="background:var(--bg3);border-radius:8px;padding:12px 16px;margin-bottom:14px;font-size:13px;line-height:1.8;color:var(--txt2)">
          <b style="color:var(--txt)">使用流程：</b><br>
          1. 点击「添加广告」创建广告（填写标题、广告视频/图片链接、跳转链接、时长）<br>
          2. 创建后在下方列表确认广告状态为「启用」<br>
          3. 切换到「视频列表」Tab → 底部找到「已发布视频 · 广告管理」<br>
          4. 为每个视频选择前贴/中插/后贴广告，点击保存<br>
          <b style="color:var(--cyan)">提示：</b>广告位留空 = 该位置不播放广告
        </div>
        <div id="adList"></div>
      </div>`;
    const listEl = box.querySelector('#adList');
    if (!ads.length) {
      listEl.innerHTML = '<p class="tip" style="padding:24px 0;text-align:center">暂无广告，点击上方按钮添加</p>';
    } else {
      listEl.innerHTML = ads.map((a) => `
        <div class="row" data-aid="${a.id}">
          <div class="rev-thumb thumb-empty" style="background:#1a1c28">${a.imageUrl ? `<img src="${esc(a.imageUrl)}" style="width:100%;height:100%;object-fit:cover;border-radius:6px" onerror="this.style.display='none'">` : icon('megaphone', 26)}</div>
          <div class="row-main">
            <div class="row-title">${esc(a.title)} ${a.isActive ? '<span class="chip green">启用</span>' : '<span class="chip red">停用</span>'}</div>
            <div class="row-sub">${a.duration}秒 · 排序 ${a.sortOrder || 0} · ${a.videoUrl ? '有视频' : '无视频'} · ${a.linkUrl ? '有链接' : '无链接'}</div>
          </div>
          <div class="row-acts">
            <button class="btn btn-sm" data-act="edit">编辑</button>
            <button class="btn btn-sm" data-act="toggle">${a.isActive ? '停用' : '启用'}</button>
            <button class="btn btn-sm btn-danger" data-act="del">删除</button>
          </div>
        </div>`).join('');
    }
    box.querySelector('#addAdBtn').addEventListener('click', () => showAdDialog(null, renderManageAds));
    listEl.querySelectorAll('[data-act]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const row = btn.closest('.row');
        const aid = row.dataset.aid;
        const act = btn.dataset.act;
        if (act === 'edit') {
          const a = ads.find((x) => x.id === aid);
          if (a) showAdDialog(a, renderManageAds);
        }
        if (act === 'toggle') {
          const a = ads.find((x) => x.id === aid);
          if (!a) return;
          try {
            await Cloud.apiPost(`/admin/ads/${aid}`, { ...a, isActive: !a.isActive });
            toast(a.isActive ? '已停用' : '已启用');
            renderManageAds();
          } catch (e) { toast(e.message); }
        }
        if (act === 'del') {
          const a = ads.find((x) => x.id === aid);
          const ok = await UI.confirmDialog({ title: '删除广告', text: `确定删除「${esc(a ? a.title : '')}」？`, okText: '删除', danger: true });
          if (!ok) return;
          try { await Cloud.apiPost(`/admin/ads/${aid}/delete`, {}); toast('已删除'); renderManageAds(); }
          catch (e) { toast(e.message); }
        }
      });
    });
  }

  function showAdDialog(ad, onSaved) {
    const isEdit = !!ad;
    const html = `
      <div class="modal-head">${isEdit ? '编辑广告' : '添加广告'}<button class="icon-btn" id="adClose">${icon('close', 18)}</button></div>
      <div class="modal-body" style="max-height:60vh;overflow-y:auto">
        <div class="form-row"><label>广告标题 *</label><input type="text" id="adTitle" value="${esc(ad ? ad.title : '')}" placeholder="如：品牌推广广告" maxlength="60"></div>
        <div class="form-row"><label>广告视频 URL</label><input type="text" id="adVideo" value="${esc(ad ? ad.videoUrl || '' : '')}" placeholder="https://example.com/ad.mp4（选填，有视频则播放视频）"></div>
        <div class="form-row"><label>广告图片 URL</label><input type="text" id="adImage" value="${esc(ad ? ad.imageUrl || '' : '')}" placeholder="https://example.com/ad.jpg（无视频时显示图片）"></div>
        <div class="form-row"><label>跳转链接</label><input type="text" id="adLink" value="${esc(ad ? ad.linkUrl || '' : '')}" placeholder="https://example.com（点击广告跳转地址，选填）"></div>
        <div class="form-row"><label>广告时长（秒）</label><input type="number" id="adDur" value="${ad ? ad.duration || 5 : 5}" min="1" max="60"></div>
        <div class="form-row"><label>排序（越小越靠前）</label><input type="number" id="adSort" value="${ad ? ad.sortOrder || 0 : 0}" min="0"></div>
        <div class="form-row"><label><input type="checkbox" id="adActive" ${!ad || ad.isActive ? 'checked' : ''} style="width:16px;height:16px;accent-color:#fe2c55"> 启用</label></div>
      </div>
      <div class="modal-foot"><button class="btn" id="adCancel">取消</button><button class="btn-primary" id="adSave">保存</button></div>`;
    const m = UI.modal(html);
    m.overlay.querySelector('#adClose').onclick = () => m.close();
    m.overlay.querySelector('#adCancel').onclick = () => m.close();
    m.overlay.querySelector('#adSave').onclick = async () => {
      const title = m.overlay.querySelector('#adTitle').value.trim();
      if (!title) { toast('请输入广告标题'); return; }
      const data = {
        title,
        videoUrl: m.overlay.querySelector('#adVideo').value.trim(),
        imageUrl: m.overlay.querySelector('#adImage').value.trim(),
        linkUrl: m.overlay.querySelector('#adLink').value.trim(),
        duration: parseInt(m.overlay.querySelector('#adDur').value) || 5,
        sortOrder: parseInt(m.overlay.querySelector('#adSort').value) || 0,
        isActive: m.overlay.querySelector('#adActive').checked,
      };
      try {
        if (isEdit) {
          await Cloud.apiPost(`/admin/ads/${ad.id}`, data);
          toast('广告已更新');
        } else {
          await Cloud.apiPost('/admin/ads', data);
          toast('广告已添加');
        }
        m.close();
        if (onSaved) onSaved();
      } catch (e) {
        toast(e.message || '保存失败');
      }
    };
  }


  function showProductDialog(product, onSaved) {
    const isEdit = !!product;
    const html = `
      <div class="modal-head">${isEdit ? '编辑商品' : '添加商品'}<button class="icon-btn" id="pdClose">${icon('close', 18)}</button></div>
      <div class="modal-body" style="max-height:60vh;overflow-y:auto">
        <div class="form-row"><label>商品名称 *</label><input type="text" id="pdName" value="${esc(product ? product.name : '')}" placeholder="如：魔耳定制耳机" maxlength="60"></div>
        <div class="form-row"><label>价格（元）</label><input type="number" id="pdPrice" value="${product ? product.price || '' : ''}" placeholder="0.00" step="0.01" min="0"></div>
        <div class="form-row"><label>商品图片 URL</label><input type="text" id="pdImage" value="${esc(product ? product.image || '' : '')}" placeholder="https://img.alicdn.com/..."></div>
        <div class="form-row"><label>商品描述</label><textarea id="pdDesc" rows="2" maxlength="500" placeholder="简单描述商品信息（选填）">${esc(product ? product.description || '' : '')}</textarea></div>
        <div class="form-row"><label>淘宝链接 *</label><input type="text" id="pdUrl" value="${esc(product ? product.taobaoUrl || '' : '')}" placeholder="https://item.taobao.com/item.htm?id=..."></div>
        <div class="form-row"><label>分类</label><input type="text" id="pdCat" value="${esc(product ? product.category || '' : '')}" placeholder="如：玩具、绘本、文具" maxlength="30"></div>
        <div class="form-row"><label>排序（越小越靠前）</label><input type="number" id="pdSort" value="${product ? product.sortOrder || 0 : 0}" min="0"></div>
        <div class="form-row"><label><input type="checkbox" id="pdPub" ${!product || product.isPublished ? 'checked' : ''} style="width:16px;height:16px;accent-color:#fe2c55"> 上架</label></div>
      </div>
      <div class="modal-foot"><button class="btn" id="pdCancel">取消</button><button class="btn-primary" id="pdSave">保存</button></div>`;
    const m = UI.modal(html);
    m.overlay.querySelector('#pdClose').onclick = () => m.close();
    m.overlay.querySelector('#pdCancel').onclick = () => m.close();
    m.overlay.querySelector('#pdSave').onclick = async () => {
      const name = m.overlay.querySelector('#pdName').value.trim();
      if (!name) { toast('请输入商品名称'); return; }
      const taobaoUrl = m.overlay.querySelector('#pdUrl').value.trim();
      if (!taobaoUrl) { toast('请输入淘宝链接'); return; }
      const data = {
        name,
        price: parseFloat(m.overlay.querySelector('#pdPrice').value) || 0,
        image: m.overlay.querySelector('#pdImage').value.trim(),
        description: m.overlay.querySelector('#pdDesc').value.trim(),
        taobaoUrl,
        category: m.overlay.querySelector('#pdCat').value.trim(),
        sortOrder: parseInt(m.overlay.querySelector('#pdSort').value) || 0,
        isPublished: m.overlay.querySelector('#pdPub').checked,
      };
      try {
        if (isEdit) {
          await Cloud.apiPost(`/admin/products/${product.id}`, data);
          toast('商品已更新');
        } else {
          await Cloud.apiPost('/admin/products', data);
          toast('商品已添加');
        }
        m.close();
        if (onSaved) onSaved();
      } catch (e) {
        toast(e.message || '保存失败');
      }
    };
  }


  return {
    renderMine, renderManage, renderGame, renderSearch, renderSeriesPage, renderHome, renderManageUsers, renderShop, renderManageProducts,
    openPanel, closePanel, showLoginDialog, showVipDialog, showUserCenter,
    get panelKind() { return panelKind; }
  };
})();
