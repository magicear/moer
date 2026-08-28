(function() {
  'use strict';

  const { icon, esc, toast } = UI;

  function catName(id) {
    const c = CATEGORIES.find((x) => x.id === id);
    return c ? c.name : '未知栏目';
  }

  function fmtMoney(n) {
    return '¥' + (Math.round((Number(n) || 0) * 100) / 100).toFixed(2);
  }

  function chip(status, paid, reward) {
    if (status === 'pending') return '<span class="chip gold">待审核</span>';
    if (status === 'approved') {
      if (paid) return `<span class="chip green">已通过 · 已结算 ${fmtMoney(reward)}</span>`;
      return `<span class="chip cyan">已通过 · 待结算 ${fmtMoney(reward)}</span>`;
    }
    return '<span class="chip red">未通过</span>';
  }

  window.addEventListener('moer-auth', () => {
    if (window.App && App.currentPage === 'submit') renderSubmit();
  });

  async function renderSubmit() {
    const page = document.getElementById('pageSubmit');
    if (!page) return;
    if (Cloud.CONFIG.mode !== 'remote') {
      page.innerHTML = `
        <div class="page-scroll scrollable">
          <div class="page-head"><h2>投稿</h2></div>
          <div class="card-panel">
            <p class="tip">当前是本地文件方式打开，投稿功能需要连接服务器。<br>请通过服务器地址访问魔耳（如 http://localhost:8787）。</p>
          </div>
        </div>`;
      return;
    }
    if (!Cloud.isLoggedIn()) {
      page.innerHTML = `
        <div class="page-scroll scrollable">
          <div class="page-head"><h2>投稿赚稿费</h2><span class="sub">上传视频作品，审核通过后获得稿费</span></div>
          <div class="card-panel" style="text-align:center;padding:48px 20px">
            <div style="color:var(--txt2);margin-bottom:18px">${icon('upload', 44)}</div>
            <p style="margin-bottom:6px;font-size:16px">登录后即可向本平台投稿视频</p>
            <p class="tip" style="margin-bottom:20px">视频由运营方审核，通过后会上架到片库并按约定支付稿费</p>
            <button class="btn-primary" id="subGoLogin" style="padding:10px 36px">立即登录 / 注册</button>
          </div>
        </div>`;
      page.querySelector('#subGoLogin').addEventListener('click', () => Pages.showLoginDialog());
      return;
    }

    page.innerHTML = `
      <div class="page-scroll scrollable">
        <div class="page-head"><h2>投稿赚稿费</h2><span class="sub">上传视频作品，审核通过后获得稿费</span></div>
        <div class="earn-row" id="subEarn"></div>
        <div class="card-panel">
          <h3>提交新投稿</h3>
          <div class="form-row">
            <label>视频文件</label>
            <button class="btn" id="subFileBtn">选择视频文件</button>
            <input type="file" id="subFile" accept="video/mp4,video/webm,video/quicktime,video/x-m4v,video/x-matroska,.mp4,.webm,.mov,.m4v,.mkv" style="display:none">
            <span class="file-name" id="subFileLabel">未选择文件（支持 mp4/webm/mov/mkv）</span>
          </div>
          <div class="form-row">
            <label>标题</label>
            <input type="text" id="subTitle" placeholder="默认使用文件名" maxlength="60">
          </div>
          <div class="form-row">
            <label>简介</label>
            <textarea id="subDesc" maxlength="200" rows="3" placeholder="简单介绍视频内容（选填）"></textarea>
          </div>
          <div class="form-row">
            <label>适合年龄</label>
            <select id="subCat">${CATEGORIES.map((c) => `<option value="${c.id}">${c.name}（${c.age}）</option>`).join('')}</select>
          </div>
          <div class="form-row" style="align-items:flex-start">
            <label></label>
            <label style="display:flex;gap:8px;align-items:flex-start;flex:1;max-width:420px;color:var(--txt);font-size:13px;cursor:pointer;line-height:1.6">
              <input type="checkbox" id="subOriginal" style="margin-top:3px;width:16px;height:16px;flex:none;accent-color:#fe2c55">
              <span>我声明此视频为本人原创或已获得合法授权，因上传、发布该视频产生的版权纠纷由本人承担全部责任</span>
            </label>
          </div>
          <div class="prog-wrap hidden" id="subProgWrap"><div class="prog-bar" id="subProg"></div></div>
          <div id="subProgText" class="tip hidden" style="margin-top:8px"></div>
          <button class="btn-primary" id="subSend" style="margin-top:14px">${icon('upload', 15)} 提交投稿</button>
          <p class="tip" style="margin-top:12px">提示：请确认视频为原创或已获授权。提交后由运营方人工审核，可随时在本页查看进度和稿费结算状态。</p>
        </div>
        <div class="card-panel">
          <h3>我的投稿</h3>
          <div id="subList"></div>
        </div>
      </div>`;

    loadEarn();
    loadMine();

    const fileInput = page.querySelector('#subFile');
    const fileLabel = page.querySelector('#subFileLabel');
    page.querySelector('#subFileBtn').addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => {
      const f = fileInput.files[0];
      fileLabel.textContent = f ? `${f.name}（${UI.fmtSize(f.size)}）` : '未选择文件';
      if (f && !page.querySelector('#subTitle').value) {
        page.querySelector('#subTitle').value = f.name.replace(/\.[^.]+$/, '');
      }
    });
    page.querySelector('#subSend').addEventListener('click', () => doUpload(page));
  }

  async function loadEarn() {
    const el = document.getElementById('subEarn');
    if (!el) return;
    try {
      const me = await Cloud.apiGet('/me');
      const s = me.stats;
      el.innerHTML = '<div class="earn-card"><div class="earn-num">' + fmtMoney(s.pendingEarn) + '</div><div class="earn-label">待结算稿费</div></div>'
        + '<div class="earn-card"><div class="earn-num green">' + fmtMoney(s.paidEarn) + '</div><div class="earn-label">已结算稿费</div></div>'
        + '<div class="earn-card"><div class="earn-num">' + (s.approved || 0) + '<small>/' + (s.submitted || 0) + '</small></div><div class="earn-label">通过 / 总投稿</div></div>';
    } catch (e) {
      el.innerHTML = '';
    }
  }

  async function loadMine() {
    const el = document.getElementById('subList');
    if (!el) return;
    el.innerHTML = '<p class="tip">加载中…</p>';
    try {
      const res = await Cloud.apiGet('/submissions/mine');
      const list = res.submissions || [];
      if (!list.length) {
        el.innerHTML = '<div class="empty in-panel"><p>还没有投稿，提交第一个视频吧</p></div>';
        return;
      }
      el.innerHTML = list.map((s) => '<div class="row">'
        + '<div class="rev-thumb thumb-empty">' + icon('film', 26) + '</div>'
        + '<div class="row-main">'
        + '<div class="row-title">' + esc(s.title) + '</div>'
        + '<div class="row-sub">' + catName(s.categoryId) + ' · ' + UI.fmtSize(s.size) + ' · ' + UI.fmtTime(s.createdAt) + '</div>'
        + '<div style="margin-top:6px">' + chip(s.status, s.paid, s.reward)
        + (s.status === 'rejected' && s.rejectReason ? '<span class="tip" style="margin-left:8px">原因：' + esc(s.rejectReason) + '</span>' : '')
        + (s.status === 'pending' ? '<span class="tip" style="margin-left:8px">审核预计1-3个工作日</span>' : '')
        + '</div></div></div>').join('');
    } catch (e) {
      el.innerHTML = '<p class="tip">加载失败：' + esc(e.message) + '</p>';
    }
  }

  async function doUpload(page) {
    const fileInput = page.querySelector('#subFile');
    const btn = page.querySelector('#subSend');
    const wrap = page.querySelector('#subProgWrap');
    const bar = page.querySelector('#subProg');
    const txt = page.querySelector('#subProgText');
    const f = fileInput.files[0];
    if (!f) { toast('请先选择视频文件'); return; }
    if (!/^video\//.test(f.type || 'video/') && !/\.(mp4|webm|mov|m4v|mkv)$/i.test(f.name)) {
      toast('仅支持 mp4/webm/mov/mkv 视频文件'); return;
    }
    if (!page.querySelector('#subOriginal').checked) {
      toast('请先勾选原创声明'); return;
    }
    const fd = new FormData();
    fd.append('file', f, f.name);
    fd.append('title', page.querySelector('#subTitle').value.trim());
    fd.append('description', page.querySelector('#subDesc').value.trim());
    fd.append('categoryId', page.querySelector('#subCat').value);
    fd.append('original', '1');
    btn.disabled = true;
    btn.style.opacity = '.6';
    btn.textContent = '上传中…';
    wrap.classList.remove('hidden');
    txt.classList.remove('hidden');
    bar.style.width = '0';
    bar.style.background = 'var(--red)';
    const startTime = Date.now();
    try {
      bar.style.transition = 'width .15s linear';
      await Cloud.apiUpload('/submissions', fd, (p) => {
        const elapsed = (Date.now() - startTime) / 1000;
        const speed = p > 0 ? (f.size * p / 100 / elapsed / 1024 / 1024).toFixed(1) : 0;
        bar.style.width = Math.min(p, 99) + '%';
        txt.textContent = '上传中 ' + p + '%（' + UI.fmtSize(f.size) + '）· ' + speed + 'MB/s · 已用时 ' + Math.round(elapsed) + 's';
      }, () => {
        bar.style.width = '100%';
        bar.style.background = 'var(--gold)';
        bar.style.transition = 'none';
        txt.textContent = '上传完毕，服务器处理中…';
      });
      bar.style.transition = 'none';
      bar.style.width = '100%';
      bar.style.background = 'var(--gold)';
      txt.textContent = '投稿成功！正在刷新投稿列表…';
      toast('投稿成功，已进入审核');
      fileInput.value = '';
      page.querySelector('#subTitle').value = '';
      page.querySelector('#subDesc').value = '';
      page.querySelector('#subFileLabel').textContent = '未选择文件';
      await loadEarn();
      await loadMine();
      await new Promise(function(r) { setTimeout(r, 800); });
      bar.style.width = '0';
      bar.style.background = '';
      wrap.classList.add('hidden');
      txt.classList.add('hidden');
      btn.innerHTML = icon('upload', 15) + ' 提交投稿';
      btn.disabled = false;
      btn.style.opacity = '';
    } catch (e) {
      bar.style.transition = 'none';
      bar.style.background = 'var(--red)';
      txt.textContent = '上传失败：' + (e.message || '未知错误');
      toast(e.message || '上传失败');
      await new Promise(function(r) { setTimeout(r, 2000); });
      bar.style.width = '0';
      bar.style.background = '';
      wrap.classList.add('hidden');
      txt.classList.add('hidden');
      btn.innerHTML = icon('upload', 15) + ' 提交投稿';
      btn.disabled = false;
      btn.style.opacity = '';
    }
  }

  // ---------------- 管理员：投稿审核 ----------------
  let reviewFilter = 'pending';

  async function renderManageReview(filter) {
    reviewFilter = filter || reviewFilter || 'pending';
    const box = document.getElementById('manageBody');
    if (!box) return;
    box.innerHTML = '<p class="tip">加载中…</p>';
    let all = [];
    try {
      all = (await Cloud.apiGet('/admin/submissions')).submissions || [];
    } catch (e) {
      box.innerHTML = `<p class="tip">加载失败：${esc(e.message)}（需要管理员账号登录）</p>`;
      return;
    }
    const n = (st) => all.filter((x) => x.status === st).length;
    const filters = [
      ['pending', `待审核（${n('pending')}）`],
      ['approved', `已通过（${n('approved')}）`],
      ['rejected', `已拒绝（${n('rejected')}）`],
      ['all', `全部（${all.length}）`]
    ];
    const shown = reviewFilter === 'all' ? all : all.filter((x) => x.status === reviewFilter);
    box.innerHTML = `
      <div class="card-panel">
        <h3>投稿审核</h3>
        <div class="sub-tabs">
          ${filters.map(([k, label]) => `<button class="sub-tab ${reviewFilter === k ? 'active' : ''}" data-rf="${k}">${label}</button>`).join('')}
        </div>
        <div id="revList"></div>
      </div>`;
    box.querySelectorAll('[data-rf]').forEach((el) => {
      el.addEventListener('click', () => renderManageReview(el.dataset.rf));
    });
    const listEl = box.querySelector('#revList');
    if (!shown.length) {
      listEl.innerHTML = '<div class="empty in-panel"><p>暂无投稿</p></div>';
      return;
    }
    listEl.innerHTML = shown.map((s) => `
      <div class="row" data-sid="${s.id}">
        ${s.stored_name
          ? `<video class="rev-thumb" src="/media/${esc(s.stored_name)}" preload="metadata" muted></video>`
          : '<div class="rev-thumb thumb-empty">' + icon('film', 26) + '</div>'}
        <div class="row-main">
          <div class="row-title">${esc(s.title)}</div>
          <div class="row-sub">@${esc(s.uploader || '未知')} · ${catName(s.category_id)} · ${UI.fmtSize(s.size)} · ${UI.fmtTime(s.created_at)}</div>
          <div style="margin-top:6px">${chip(s.status, s.paid, s.reward)}${s.status === 'rejected' && s.reject_reason ? `<span class="tip" style="margin-left:8px">原因：${esc(s.reject_reason)}</span>` : ''}</div>
        </div>
        <div class="row-acts">
          ${s.stored_name ? '<button class="btn btn-sm" data-act="preview">预览</button>' : ''}
          ${s.status === 'pending' ? `
            <button class="btn btn-sm btn-primary" data-act="approve">通过</button>
            <button class="btn btn-sm btn-danger" data-act="reject">拒绝</button>` : ''}
          ${s.status === 'approved' && !s.paid ? '<button class="btn btn-sm" data-act="pay">标记已结算</button>' : ''}
        </div>
      </div>`).join('');
    listEl.querySelectorAll('[data-act]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const sid = btn.closest('.row').dataset.sid;
        const sub = all.find((x) => x.id === sid);
        const act = btn.dataset.act;
        if (act === 'preview') showPreview(sub);
        if (act === 'approve') approveDialog(sub);
        if (act === 'reject') rejectDialog(sub);
        if (act === 'pay') {
          const ok = await UI.confirmDialog({
            title: '标记已结算',
            text: `确认已向 @${esc(sub.uploader)} 支付《${esc(sub.title)}》的稿费 ${fmtMoney(sub.reward)}？`,
            okText: '确认已支付'
          });
          if (!ok) return;
          try {
            await Cloud.apiPost(`/admin/submissions/${sid}/pay`, {});
            toast('已标记结算');
            renderManageReview();
          } catch (e) { toast(e.message); }
        }
      });
    });
  }

  function showPreview(s) {
    const m = UI.modal(`
      <div class="modal-head">${esc(s.title)} <span class="tip">@${esc(s.uploader || '')}</span></div>
      <div class="modal-body" style="padding:0">
        <video src="/media/${esc(s.stored_name)}" controls autoplay style="width:100%;max-height:60vh;background:#000;display:block"></video>
        <div style="padding:12px 16px" class="tip">${catName(s.category_id)} · ${UI.fmtSize(s.size)} · ${UI.fmtTime(s.created_at)}</div>
      </div>`, { cls: 'preview-modal' });
    m.overlay.querySelector('.modal-head').insertAdjacentHTML('beforeend',
      ' <button class="icon-btn pv-close">' + icon('close', 18) + '</button>');
    m.overlay.querySelector('.pv-close').onclick = () => {
      m.overlay.querySelector('video').pause();
      m.close();
    };
  }

  function approveDialog(s) {
    const m = UI.modal(`
      <div class="modal-head">通过投稿并上架</div>
      <div class="modal-body">
        <p class="tip" style="margin-bottom:14px">《${esc(s.title)}》 @${esc(s.uploader)}</p>
        <div class="form-row">
          <label>放入栏目</label>
          <select id="apCat">${CATEGORIES.map((c) => `<option value="${c.id}" ${c.id === s.category_id ? 'selected' : ''}>${c.name}（${c.age}）</option>`).join('')}</select>
        </div>
        <div class="form-row">
          <label>系列名</label>
          <input type="text" id="apSeries" placeholder="选填，如：小猪讲故事（同名自动归入同一系列）" maxlength="30" style="flex:1">
        </div>
        <div class="form-row">
          <label>稿费（元）</label>
          <input type="number" id="apReward" min="0" step="0.01" value="50" style="width:120px">
        </div>
        <p class="tip">通过后将立即发布到云端片库，所有用户都能看到；稿费记录会在对方「投稿」页显示为待结算。</p>
      </div>
      <div class="modal-foot">
        <button class="btn" data-a="cancel">取消</button>
        <button class="btn-primary" data-a="ok">通过并上架</button>
      </div>`, { overlayClose: false });
    m.overlay.querySelector('[data-a="cancel"]').onclick = () => m.close();
    m.overlay.querySelector('[data-a="ok"]').onclick = async () => {
      try {
        await Cloud.apiPost(`/admin/submissions/${s.id}/approve`, {
          categoryId: m.overlay.querySelector('#apCat').value,
          seriesName: m.overlay.querySelector('#apSeries').value.trim(),
          reward: parseFloat(m.overlay.querySelector('#apReward').value) || 0
        });
        m.close();
        toast('已上架到片库');
        Cloud.fetchLibrary().catch(() => {});
        renderManageReview();
      } catch (e) { toast(e.message); }
    };
  }

  function rejectDialog(s) {
    const m = UI.modal(`
      <div class="modal-head">拒绝投稿</div>
      <div class="modal-body">
        <p class="tip" style="margin-bottom:14px">《${esc(s.title)}》 @${esc(s.uploader)}</p>
        <div class="form-row">
          <label>拒绝原因</label>
          <textarea id="rjReason" rows="3" maxlength="100" placeholder="将展示给投稿者，如：画面模糊 / 时长过短 / 版权存疑" style="flex:1"></textarea>
        </div>
      </div>
      <div class="modal-foot">
        <button class="btn" data-a="cancel">取消</button>
        <button class="btn-danger" data-a="ok">确认拒绝</button>
      </div>`, { overlayClose: false });
    m.overlay.querySelector('[data-a="cancel"]').onclick = () => m.close();
    m.overlay.querySelector('[data-a="ok"]').onclick = async () => {
      try {
        await Cloud.apiPost(`/admin/submissions/${s.id}/reject`, {
          reason: m.overlay.querySelector('#rjReason').value.trim()
        });
        m.close();
        toast('已拒绝');
        renderManageReview();
      } catch (e) { toast(e.message); }
    };
  }

  Pages.renderSubmit = renderSubmit;
  Pages.renderManageReview = renderManageReview;
})();
