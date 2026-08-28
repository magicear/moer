const App = (() => {
  const { icon, esc, toast } = UI;

  let currentPage = 'feed';
  let lastQuery = '';

  function pageEl(name) { return document.getElementById('page' + name.charAt(0).toUpperCase() + name.slice(1)); }

  function showPage(name) {
    currentPage = name;
    ['home', 'feed', 'series', 'search', 'mine', 'manage', 'submit', 'game', 'shop'].forEach((p) => {
      pageEl(p).classList.toggle('hidden', p !== name);
    });
    updateNavActive();
  }

  function showSeriesPage(seriesId) {
    showPage('series');
    Pages.renderSeriesPage(seriesId);
    // 更新hash
    const base = location.href.split('#')[0];
    history.replaceState(null, '', base + '#series=' + seriesId);
  }

  function playVideo(id) {
    const v = Data.videoById(id);
    if (!v) { toast('视频不存在'); return; }
    Feed.open(v.categoryId, id);
    showPage('feed');
    updateNavActive();
  }

  function navItemHtml(item) {
    let ico;
    if (item.ageIcon) {
      ico = `<span class="nav-ico cat-ico">${UI.ageIcon(item.ageIcon, 20)}</span>`;
    } else if (item.dot) {
      ico = `<span class="nav-dot" style="background:${item.color}">${esc(item.dot)}</span>`;
    } else {
      ico = `<span class="nav-ico">${icon(item.ic, 20)}</span>`;
    }
    return `<div class="nav-item" data-nav="${item.id}">${ico}<span>${esc(item.name)}</span></div>`;
  }

  function buildNav() {
    const cats = document.getElementById('navCats');
    const funcs = document.getElementById('navFuncs');
    const catItems = [
      { id: 'home', name: '首页', ic: 'home' },
      ...CATEGORIES.map((c) => ({
        id: c.id, name: c.name, ageIcon: c.icon
      }))
    ];
    catItems.push({ id: 'recommend', name: '推荐', ic: 'compass' });
    catItems.push({ id: 'follow', name: '关注', ic: 'users' });
    cats.innerHTML = catItems.map(navItemHtml).join('');
    const funcItems = [];
    if (Cloud.isLoggedIn() && Cloud.isAdmin()) {
      funcItems.push({ id: 'manage', name: '后台管理', ic: 'folder' });
    }
    funcItems.push({ id: 'submit', name: '投稿', ic: 'upload' });
    funcItems.push({ id: 'shop', name: '商城', ic: 'cart' });
    funcItems.push({ id: 'game', name: '小游戏', ic: 'gamepad' });
    funcItems.push({ id: 'mine', name: '我的', ic: 'user' });
    funcs.innerHTML = funcItems.map(navItemHtml).join('');
    document.querySelectorAll('.nav-item').forEach((el) => {
      el.addEventListener('click', () => {
        const id = el.dataset.nav;
        if (id === 'home') { showPage('home'); Pages.renderHome(); return; }
        if (id === 'manage') {
          if (!(Cloud.isLoggedIn() && Cloud.isAdmin())) { toast('视频管理仅管理员可用'); return; }
          showPage('manage'); Pages.renderManage(); return;
        }
        if (id === 'submit') { showPage('submit'); Pages.renderSubmit(); return; }
        if (id === 'shop') { showPage('shop'); Pages.renderShop(); return; }
        if (id === 'game') { showPage('game'); Pages.renderGame(); return; }
        if (id === 'mine') { showPage('mine'); Pages.renderMine(); return; }
        Feed.open(id);
        showPage('feed');
        updateNavActive();
      });
    });
  }

  function updateNavActive() {
    const feedMode = currentPage === 'feed' ? Feed.mode : null;
    document.querySelectorAll('.nav-item').forEach((el) => {
      el.classList.toggle('active', el.dataset.nav === feedMode || (currentPage !== 'feed' && el.dataset.nav === currentPage));
    });
    renderChannelTabs();
    const mtMap = { feed: 'feed', submit: 'submit', mine: 'mine', msg: 'msg' };
    const panelOpen = document.getElementById('sidePanel') && !document.getElementById('sidePanel').classList.contains('hidden');
    document.querySelectorAll('#mobileTabs [data-mt]').forEach((b) => {
      const active = b.dataset.mt === (mtMap[currentPage] || '') || (b.dataset.mt === 'msg' && panelOpen);
      b.classList.toggle('active', active && b.dataset.mt !== 'submit');
    });
  }

  function renderChannelTabs() {
    const wrap = document.getElementById('mobileChanTabs');
    if (!wrap) return;
    const current = currentPage === 'feed' ? (Feed.mode || 'recommend') : null;
    const defs = [
      { id: 'follow', name: '关注' },
      { id: 'recommend', name: '推荐' },
      ...CATEGORIES.map((c) => ({ id: c.id, name: c.name }))
    ];
    if (wrap._defs === defs.length) {
      wrap.querySelectorAll('[data-mct]').forEach((el) => {
        el.classList.toggle('active', el.dataset.mct === current);
      });
      return;
    }
    wrap._defs = defs.length;
    wrap.innerHTML = defs.map((d) =>
      `<button data-mct="${d.id}" class="${d.id === current ? 'active' : ''}">${d.name}</button>`
    ).join('');
    wrap.querySelectorAll('[data-mct]').forEach((el) => {
      el.addEventListener('click', () => {
        Feed.open(el.dataset.mct);
        showPage('feed');
        renderChannelTabs();
      });
    });
  }

  function showChannelSheet() {
    const items = CATEGORIES.map((c) =>
      `<button class="chan-btn" data-cat="${c.id}">${UI.ageIcon(c.icon, 26)}<b>${c.name}</b><small>${c.age}</small></button>`
    ).join('');
    const m = UI.modal(`
      <div class="modal-head">选择频道<button class="icon-btn" id="chanClose">${icon('close', 18)}</button></div>
      <div class="modal-body"><div class="chan-grid">
        ${items}
        <button class="chan-btn" data-cat="recommend">${icon('compass', 26)}<b>推荐</b><small>猜你喜欢</small></button>
        <button class="chan-btn" data-cat="follow">${icon('users', 26)}<b>关注</b><small>关注的系列</small></button>
      </div></div>`);
    m.overlay.querySelector('#chanClose').onclick = () => m.close();
    m.overlay.querySelectorAll('.chan-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        m.close();
        Feed.open(btn.dataset.cat);
        showPage('feed');
      });
    });
  }

  function initMobileTabs() {
    const bar = document.getElementById('mobileTabs');
    if (!bar) return;
    const submitMark = `<div class="tab-cam-mask">${icon('plus', 20)}</div>`;
    const defs = [
      { id: 'feed', name: '首页', ic: 'play' },
      { id: 'shop', name: '商城', ic: 'cart' },
      { id: 'submit', name: '', ic: '', big: submitMark },
      { id: 'msg', name: '消息', ic: 'message' },
      { id: 'mine', name: '我的', ic: 'user' }
    ];
    bar.innerHTML = defs.map((d) =>
      d.big
        ? `<button data-mt="${d.id}" class="tab-big">${d.big}<span>投稿</span></button>`
        : `<button data-mt="${d.id}">${icon(d.ic, 22)}<span>${d.name}</span></button>`
    ).join('');
    bar.querySelectorAll('[data-mt]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.mt;
        Pages.closePanel();
        if (id === 'feed') { Feed.open('recommend'); showPage('feed'); }
        if (id === 'cats') showChannelSheet();
        if (id === 'shop') { showPage('shop'); Pages.renderShop(); }
        if (id === 'submit') { showPage('submit'); Pages.renderSubmit(); }
        if (id === 'msg') { Pages.openPanel('msg'); }
        if (id === 'mine') { showPage('mine'); Pages.renderMine(); }
      });
    });
  }

  function updateBadges() {
    const n = Data.unreadNotify();
    const m = Data.unreadMsg();
    const nb = document.getElementById('notifyBadge');
    const mb = document.getElementById('msgBadge');
    nb.textContent = n > 99 ? '99+' : n;
    nb.classList.toggle('hidden', n === 0);
    mb.textContent = m > 99 ? '99+' : m;
    mb.classList.toggle('hidden', m === 0);
  }

  function initTopbar() {
    const logo = document.getElementById('logoBtn');
    logo.innerHTML = `${UI.logoSVG(36)}<span class="logo-text"><b>魔耳</b><small>MOER</small></span>`;
    logo.addEventListener('click', () => { Feed.open('recommend'); showPage('feed'); });

    document.querySelector('#btnClient .tb-ico').innerHTML = icon('monitor', 20);
    document.querySelector('#btnNotify .tb-ico').innerHTML = icon('bell', 20);
    document.querySelector('#btnMsg .tb-ico').innerHTML = icon('message', 20);
    // 登录/会员按钮
    const topbarRight = document.querySelector('.topbar-right');
    const avatarBtn = document.getElementById('btnAvatar');
    const loginBtn = document.createElement('button');
    loginBtn.className = 'tb-item';
    loginBtn.id = 'btnLogin';
    loginBtn.innerHTML = '<span class="tb-ico"></span><span class="tb-label">登录</span>';
    const vipBadge = document.createElement('button');
    vipBadge.className = 'tb-item vip-btn';
    vipBadge.id = 'btnVip';
    vipBadge.innerHTML = '<span class="tb-ico"></span><span class="tb-label">会员</span><i class="vip-tag">VIP</i>';
    topbarRight.insertBefore(loginBtn, avatarBtn);
    topbarRight.insertBefore(vipBadge, avatarBtn);
    document.querySelector('#btnLogin .tb-ico').innerHTML = icon('user', 20);
    document.querySelector('#btnVip .tb-ico').innerHTML = icon('crown', 20);

    function updateLoginBtn() {
      const btn = document.getElementById('btnLogin');
      if (Cloud.isLoggedIn()) {
        const u = Cloud.getCurrentUser();
        btn.querySelector('.tb-label').textContent = u.username;
      } else {
        btn.querySelector('.tb-label').textContent = '登录';
      }
    }
    function updateVipBtn() {
      const btn = document.getElementById('btnVip');
      const info = Cloud.getVipInfo();
      btn.classList.toggle('is-vip', info.isVip);
      btn.querySelector('.tb-label').textContent = info.isVip ? `会员${info.daysLeft}天` : '开通会员';
    }
    updateLoginBtn();
    updateVipBtn();

    document.getElementById('btnAvatar').innerHTML =
      `<div class="avatar letter" style="width:34px;height:34px;background:linear-gradient(135deg,#25f4ee,#4ea6ff);font-size:15px">魔</div>`;

    // PWA 安装提示
    let deferredPrompt = null;
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
      // 显示安装角标
      const btn = document.getElementById('btnClient');
      if (btn) btn.classList.add('pwa-installable');
    });
    window.addEventListener('appinstalled', () => {
      deferredPrompt = null;
      const btn = document.getElementById('btnClient');
      if (btn) btn.classList.remove('pwa-installable');
      toast('已安装到桌面');
    });

    document.getElementById('btnClient').addEventListener('click', async () => {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
          toast('正在安装…');
        }
        deferredPrompt = null;
        return;
      }
      // 已安装 or 不支持 PWA 安装
      if (window.matchMedia('(display-mode: standalone)').matches) {
        toast('已在APP模式中运行');
        return;
      }
      // 不支持自动安装时，显示手动安装指引
      const isMac = navigator.platform.includes('Mac');
      const tip = isMac
        ? 'Safari：文件 → 添加到程序坞\nChrome：地址栏右侧 → 安装魔耳'
        : 'Chrome/Edge 地址栏右侧有"安装"按钮\n点击即可装到桌面使用';
      UI.confirmDialog({
        title: '安装到桌面',
        html: '<div style="line-height:1.8;color:var(--txt2);font-size:14px">'
          + '<p style="color:var(--txt);font-size:15px;margin-bottom:8px">💡 把魔耳装到电脑上，像软件一样使用</p>'
          + '<p>• 独立窗口，无边框</p>'
          + '<p>• 桌面/开始菜单快捷方式</p>'
          + '<p>• 离线也能打开</p>'
          + '<br><p style="color:var(--txt);font-size:14px">安装方法：</p>'
          + '<p>' + tip.replace(/\n/g, '<br>') + '</p>'
          + '<br><p style="color:var(--txt3);font-size:12px">提示：需通过网址访问才能安装，本地文件打开不支持</p>'
          + '</div>',
        okText: '我知道了',
        showCancel: false
      });
    });
    document.getElementById('btnNotify').addEventListener('click', () => {
      if (Pages.panelKind === 'notify') { Pages.closePanel(); return; }
      Pages.closePanel();
      Pages.openPanel('notify');
    });
    document.getElementById('btnMsg').addEventListener('click', () => {
      if (Pages.panelKind === 'msg') { Pages.closePanel(); return; }
      Pages.closePanel();
      Pages.openPanel('msg');
    });
    document.getElementById('btnLogin').addEventListener('click', () => {
      if (Cloud.isLoggedIn()) {
        Pages.showUserCenter();
      } else {
        Pages.showLoginDialog();
      }
    });
    document.getElementById('btnVip').addEventListener('click', () => {
      Pages.showVipDialog();
    });
    document.getElementById('btnAvatar').addEventListener('click', () => { Pages.closePanel(); showPage('mine'); Pages.renderMine(); });

    const searchInput = document.getElementById('searchInput');
    document.getElementById('searchIconBtn').innerHTML = icon('search', 18);
    document.getElementById('searchIconBtn').addEventListener('click', () => doSearch());
    searchInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') doSearch(); });

    document.getElementById('panelOverlay').addEventListener('click', () => Pages.closePanel());

    document.getElementById('feedPrevBtn').innerHTML = icon('up', 22);
    document.getElementById('feedNextBtn').innerHTML = icon('down', 22);
    document.getElementById('cdClose').innerHTML = icon('close', 18);
  }

  function doSearch() {
    const q = document.getElementById('searchInput').value.trim();
    if (!q) { toast('请输入搜索关键词'); return; }
    lastQuery = q;
    Pages.closePanel();
    showPage('search');
    Pages.renderSearch(q);
  }

  function initKeyboard() {
    document.addEventListener('keydown', (e) => {
      const tag = document.activeElement ? document.activeElement.tagName : '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (currentPage !== 'feed') return;
      if (e.key === 'ArrowDown') { e.preventDefault(); Feed.next(); }
      if (e.key === 'ArrowUp') { e.preventDefault(); Feed.prev(); }
      if (e.key === ' ') { e.preventDefault(); Feed.togglePlay(); }
    });
  }

  function parseHash() {
    const vMatch = location.hash.match(/v=([A-Za-z0-9-]+)/);
    const sMatch = location.hash.match(/series=([A-Za-z0-9-]+)/);
    return { videoId: vMatch ? vMatch[1] : null, seriesId: sMatch ? sMatch[1] : null };
  }

  function initHashWatch() {
    window.addEventListener('hashchange', () => {
      const h = parseHash();
      if (h.seriesId) {
        const s = Data.seriesById(h.seriesId);
        if (s) { showPage('series'); Pages.renderSeriesPage(h.seriesId); return; }
      }
      if (h.videoId) {
        const v = Data.videoById(h.videoId);
        if (!v) return;
        if (currentPage === 'feed' && Feed.currentVideoId() === v.id) return;
        Feed.open(v.categoryId, v.id);
        showPage('feed');
      }
    });
  }

  async function boot() {
    initTopbar();
    initMobileTabs();
    await DB.open();
    await Data.loadAll();
    await Data.ensureWelcome();
    try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) {}

    buildNav();
    initKeyboard();
    initHashWatch();
    Feed.init();
    renderChannelTabs();
    updateNavActive();
    Cloud.fetchLibrary().catch(() => {});
    if (Cloud.isLoggedIn()) Cloud.pullInteractions().catch(() => {});

    // 网络恢复后自动重连
    Cloud.onReconnect(() => {
      if (Cloud.isLoggedIn()) {
        Cloud.pullInteractions().catch(() => {});
        Cloud.fetchLibrary().catch(() => {});
        toast('正在同步数据…');
      }
    });

    window.addEventListener('moer-auth', () => {
      buildNav();
      updateNavActive();
      if (Cloud.isLoggedIn()) Cloud.pullInteractions().catch(() => {});
      if (currentPage === 'manage' && !(Cloud.isLoggedIn() && Cloud.isAdmin())) {
        Feed.open('recommend');
        showPage('feed');
      }
    });

    Data.on((evt) => {
      updateBadges();
      if (evt === 'interact' || evt === 'comments') Cloud.queueInteractionSync();
      if (evt === 'interact' || evt === 'follows' || evt === 'videos' || evt === 'series' || evt === 'imported') {
        if (currentPage === 'mine') Pages.renderMine();
      }
      if (evt === 'videos' || evt === 'imported') {
        if (currentPage === 'manage') Pages.renderManage();
        if (currentPage === 'search' && lastQuery) Pages.renderSearch(lastQuery);
      }
    });

    updateBadges();

    const hash = parseHash();
    if (hash.seriesId && Data.seriesById(hash.seriesId)) {
      showPage('series');
      Pages.renderSeriesPage(hash.seriesId);
    } else if (hash.videoId && Data.videoById(hash.videoId)) {
      const v = Data.videoById(hash.videoId);
      Feed.open(v.categoryId, v.id);
      showPage('feed');
    } else {
      Feed.open('recommend');
      showPage('feed');
    }
  }

  document.addEventListener('DOMContentLoaded', boot);

  return { showPage, showSeriesPage, playVideo, updateBadges, get currentPage() { return currentPage; } };
})();
