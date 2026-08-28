const UI = (() => {
  const IC = {
    search: '<circle cx="11" cy="11" r="7"/><path d="M16.5 16.5 21 21"/>',
    monitor: '<rect x="3" y="5" width="18" height="12" rx="2"/><path d="M9 21h6M12 17v4"/>',
    bell: '<path d="M6 16v-5a6 6 0 1 1 12 0v5l2 3H4z"/><path d="M10 22a2.2 2.2 0 0 0 4 0"/>',
    message: '<path d="M4 5h16v11H10l-6 4z"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4.2-6 8-6s7 2 8 6"/>',
    compass: '<circle cx="12" cy="12" r="9"/><polygon points="15.5 8.5 13.5 13.5 8.5 15.5 10.5 10.5"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5"/><circle cx="17.5" cy="9" r="2.8"/><path d="M15.8 14.7c2.7.4 4.8 2.2 5.5 5.3"/>',
    folder: '<path d="M3 6a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/>',
    gamepad: '<rect x="2" y="7" width="20" height="11" rx="5.5"/><path d="M7 10.5v4M5 12.5h4M15.5 11h.01M18 13.5h.01"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    check: '<path d="M4 12.5 10 18 20 6"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    heart: '<path d="M12 20.5C7.2 16.6 3.5 13.6 3.5 9.9 3.5 7.3 5.5 5.3 8 5.3c1.6 0 3.1.8 4 2.1.9-1.3 2.4-2.1 4-2.1 2.5 0 4.5 2 4.5 4.6 0 3.7-3.7 6.7-8.5 10.6z"/>',
    star: '<path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.7l5.9-.9z"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    comment: '<path d="M4 5h16v11H10l-6 4z"/>',
    share: '<path d="M4 12v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6"/><path d="M12 3v12M7.5 7.5 12 3l4.5 4.5"/>',
    play: '<path d="M8 5.5v13l11-6.5z"/>',
    pause: '<path d="M8.5 5.5v13M15.5 5.5v13"/>',
    volume: '<path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>',
    volumeX: '<path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z"/><path d="M16 9.5l5 5M21 9.5l-5 5"/>',
    up: '<path d="m6 14.5 6-6 6 6"/>',
    down: '<path d="m6 9.5 6 6 6-6"/>',
    trash: '<path d="M4 7h16M9 7V4h6v3M6.5 7l1 13h9l1-13"/><path d="M10 11v5M14 11v5"/>',
    edit: '<path d="M4 20h4L20 8l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
    download: '<path d="M12 3v12M7 10.5 12 15l5-4.5"/><path d="M4 20h16"/>',
    upload: '<path d="M12 15V3M7 7.5 12 3l5 4.5"/><path d="M4 20h16"/>',
    image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="m5 19 5.5-5.5L14 17l3-3 4 4"/>',
    film: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M8 4v16M16 4v16M3 9h5M3 15h5M16 9h5M16 15h5"/>',
    sparkle: '<path d="M12 3.5 13.8 9 19 10.8 13.8 12.6 12 18l-1.8-5.4L5 10.8 10.2 9z"/>',
    send: '<path d="M4 11.5 20 4l-4.5 16-4-6.5z"/><path d="M11.5 13.5 20 4"/>',
    crown: '<path d="M3 18h18v2H3z"/><path d="M5 14l4-6 3 4 3-4 4 6"/>',
    cloud: '<path d="M7 18a5 5 0 0 1-.5-9.9A6.5 6.5 0 0 1 19 11a4.5 4.5 0 0 1 .5 8.9"/>',
    bag: '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>',
    cart: '<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>',
    megaphone: '<path d="M3 11l18-5v12L3 13v-2z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>',
    maximize: '<path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"/>',
    minimize: '<path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7"/>'
  };

  function icon(name, size = 22) {
    return `<svg class="ic" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${IC[name] || ''}</svg>`;
  }

  const AGE_ICONS = {
    // 0-3岁 婴儿：超大头比例 + 奶嘴 + 圆滚滚身体
    baby: '<circle cx="12" cy="10.5" r="5.5"/>'
      + '<circle cx="10.5" cy="9.5" r=".6" fill="currentColor"/>'
      + '<circle cx="13.5" cy="9.5" r=".6" fill="currentColor"/>'
      + '<ellipse cx="12" cy="12.5" rx="1.2" ry=".8"/>'
      + '<path d="M12 13.3 l-.8 1.2 l1.6 0 z"/>'
      + '<path d="M7 20.5 c.5-3.5 2.7-5.5 5-5.5 s4.5 2 5 5.5"/>'
      + '<path d="M6 17 Q4.5 15.5 5 14"/>'
      + '<path d="M18 17 Q19.5 15.5 19 14"/>',
    // 3-6岁 幼儿：蝴蝶结 + 小辫子 + 圆脸
    child: '<circle cx="12" cy="9" r="4"/>'
      + '<path d="M8 7.5 Q7 5.5 8.5 5"/>'
      + '<path d="M16 7.5 Q17 5.5 15.5 5"/>'
      + '<path d="M6 10 Q5.5 8 7 7.5"/>'
      + '<path d="M18 10 Q18.5 8 17 7.5"/>'
      + '<circle cx="10.5" cy="9" r=".5" fill="currentColor"/>'
      + '<circle cx="13.5" cy="9" r=".5" fill="currentColor"/>'
      + '<path d="M11 10.5 Q12 11.5 13 10.5"/>'
      + '<path d="M7 20 c.8-2.8 2.8-4.5 5-4.5 s4.2 1.7 5 4.5"/>'
      + '<path d="M9.5 7 l-1 -1.5 l1.2 0 z"/>'
      + '<path d="M14.5 7 l1 -1.5 l-1.2 0 z"/>',
    // 6-12岁 儿童：棒球帽 + 门牙缝 + 活泼感
    kid: '<path d="M6 7.5 Q7 4 12 3.5 Q17 4 18 7.5"/>'
      + '<path d="M5 8 l14 0"/>'
      + '<path d="M18 8 Q20 9 19 10.5"/>'
      + '<circle cx="12" cy="10" r="3.5"/>'
      + '<circle cx="10.5" cy="9.5" r=".5" fill="currentColor"/>'
      + '<circle cx="13.5" cy="9.5" r=".5" fill="currentColor"/>'
      + '<path d="M10.5 12 l.5 1 l.5 -1"/>'
      + '<path d="M11 12.5 l1 0"/>'
      + '<path d="M6.5 20 c.8-2.5 2.9-4 5.5-4 s4.7 1.5 5.5 4"/>'
      + '<path d="M11.5 5 l0 -1.5"/>'
      + '<path d="M12.5 5 l0 -1.5"/>',
    // 12岁+ 青少年：刘海 + 脸型拉长 + 耳机
    teen: '<path d="M7.5 6 Q8 3.5 12 3 Q16 3.5 16.5 6"/>'
      + '<path d="M7 7 Q7.5 5 9 4.5 L9 7"/>'
      + '<path d="M17 7 Q16.5 5 15 4.5 L15 7"/>'
      + '<ellipse cx="12" cy="9.5" rx="3.8" ry="4.2"/>'
      + '<circle cx="10.5" cy="9" r=".5" fill="currentColor"/>'
      + '<circle cx="13.5" cy="9" r=".5" fill="currentColor"/>'
      + '<path d="M11 11.5 Q12 12.2 13 11.5"/>'
      + '<path d="M8 9 Q5.5 8.5 5 10.5"/>'
      + '<path d="M16 9 Q18.5 8.5 19 10.5"/>'
      + '<path d="M6 20 c.7-2.8 3-4.5 6-4.5 s5.3 1.7 6 4.5"/>',
    // 成人：短发利落 + 方下巴 + 宽肩
    adult: '<path d="M7.5 6.5 Q8 3.5 12 3 Q16 3.5 16.5 6.5"/>'
      + '<ellipse cx="12" cy="9" rx="4" ry="4.5"/>'
      + '<circle cx="10.5" cy="8.5" r=".5" fill="currentColor"/>'
      + '<circle cx="13.5" cy="8.5" r=".5" fill="currentColor"/>'
      + '<path d="M10.5 10.5 l3 0"/>'
      + '<path d="M12 10.5 l0 1.5"/>'
      + '<path d="M5 20.5 C5.5 17 8 14.5 12 14.5 C16 14.5 18.5 17 19 20.5"/>'
      + '<path d="M3.5 20.5 L5.5 16 L8 17"/>'
      + '<path d="M20.5 20.5 L18.5 16 L16 17"/>'
  };

  function ageIcon(name, size = 22) {
    return '<svg class="ic" width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' + (AGE_ICONS[name] || '') + '</svg>';
  }


  function logoSVG(size = 34) {
    return `<svg width="${size}" height="${size}" viewBox="0 0 96 96" fill="none" stroke="currentColor" stroke-width="6.5" stroke-linecap="round" stroke-linejoin="round"><path d="M31 84C15 76 10 50 22 33 34 15 63 11 76 26 87 39 83 57 71 67"/><circle cx="49" cy="49" r="10"/><path d="M37 35 43 26 49 34 55 26 61 35M37 65v10h13"/></svg>`;
  }

  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function toast(msg) {
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    document.getElementById('toastRoot').appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity .3s'; }, 1900);
    setTimeout(() => t.remove(), 2300);
  }

  function modal(htmlOrOpts, opts = {}) {
    const isObj = htmlOrOpts && typeof htmlOrOpts === 'object';
    const o = isObj ? htmlOrOpts : opts;
    const content = isObj ? (htmlOrOpts.html || '') : htmlOrOpts;
    const root = document.getElementById('modalRoot');
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `<div class="modal ${o.cls || ''}">${content}</div>`;
    root.appendChild(overlay);
    const close = () => overlay.remove();
    if (o.overlayClose !== false) overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    if (isObj && typeof o.onReady === 'function') setTimeout(() => { try { o.onReady(); } catch (err) { console.error(err); } }, 0);
    return { overlay, close };
  }

  function closeModal() {
    const root = document.getElementById('modalRoot');
    const last = root.lastElementChild;
    if (last) last.remove();
  }

  function confirmDialog({ title = '提示', text = '', okText = '确定', danger = false } = {}) {
    return new Promise((resolve) => {
      const m = modal(`
        <div class="modal-head">${esc(title)}</div>
        <div class="modal-body" style="color:var(--txt2);line-height:1.7">${text}</div>
        <div class="modal-foot">
          <button class="btn" data-a="cancel">取消</button>
          <button class="${danger ? 'btn-danger' : 'btn-primary'}" data-a="ok">${esc(okText)}</button>
        </div>`, { overlayClose: false });
      m.overlay.querySelector('[data-a="cancel"]').onclick = () => { m.close(); resolve(false); };
      m.overlay.querySelector('[data-a="ok"]').onclick = () => { m.close(); resolve(true); };
    });
  }

  function promptDialog({ title = '请输入', label = '', value = '' } = {}) {
    return new Promise((resolve) => {
      const m = modal(`
        <div class="modal-head">${esc(title)}</div>
        <div class="modal-body">
          ${label ? `<div style="color:var(--txt2);margin-bottom:8px">${esc(label)}</div>` : ''}
          <input type="text" id="pdInput" value="${esc(value)}" maxlength="50">
        </div>
        <div class="modal-foot">
          <button class="btn" data-a="cancel">取消</button>
          <button class="btn-primary" data-a="ok">确定</button>
        </div>`, { overlayClose: false });
      const input = m.overlay.querySelector('#pdInput');
      input.focus();
      input.select();
      const ok = () => { const v = input.value.trim(); m.close(); resolve(v || null); };
      const cancel = () => { m.close(); resolve(null); };
      m.overlay.querySelector('[data-a="ok"]').onclick = ok;
      m.overlay.querySelector('[data-a="cancel"]').onclick = cancel;
      input.onkeydown = (e) => { if (e.key === 'Enter') ok(); if (e.key === 'Escape') cancel(); };
    });
  }

  function fmtTime(ts) {
    if (!ts) return '';
    const diff = Date.now() - ts;
    const m = 60000, h = 3600000, d = 86400000;
    if (diff < m) return '刚刚';
    if (diff < h) return Math.floor(diff / m) + ' 分钟前';
    if (diff < d) return Math.floor(diff / h) + ' 小时前';
    if (diff < 7 * d) return Math.floor(diff / d) + ' 天前';
    return new Date(ts).toLocaleDateString('zh-CN');
  }

  function fmtDur(s) {
    if (!isFinite(s) || s < 0) s = 0;
    const m = Math.floor(s / 60), ss = Math.floor(s % 60);
    return String(m).padStart(2, '0') + ':' + String(ss).padStart(2, '0');
  }

  function fmtSize(bytes) {
    if (!bytes) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let i = 0, n = bytes;
    while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
    return n.toFixed(n >= 100 || i === 0 ? 0 : 1) + ' ' + units[i];
  }

  const _blobUrls = new Map();
  function blobUrl(key, blob) {
    if (!_blobUrls.has(key)) _blobUrls.set(key, URL.createObjectURL(blob));
    return _blobUrls.get(key);
  }
  function revokeUrl(key) {
    if (_blobUrls.has(key)) { URL.revokeObjectURL(_blobUrls.get(key)); _blobUrls.delete(key); }
  }

  const PALETTE = ['#fe2c55', '#25f4ee', '#ffb800', '#4ea6ff', '#a06bff', '#2ecc71', '#ff7849', '#f06eaa'];
  function colorFor(id) {
    let h = 0;
    for (const ch of String(id || '')) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return PALETTE[h % PALETTE.length];
  }

  // 预设卡通/小动物头像（SVG）
  const PRESET_AVATARS = {
    bear:     { name: '小熊',   svg: '<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="20" cy="16" r="8" fill="#8B5A2B"/><circle cx="44" cy="16" r="8" fill="#8B5A2B"/><ellipse cx="32" cy="36" rx="20" ry="18" fill="#D2691E"/><ellipse cx="32" cy="40" rx="10" ry="8" fill="#FFE4B5"/><circle cx="26" cy="32" r="2.5" fill="#222"/><circle cx="38" cy="32" r="2.5" fill="#222"/><ellipse cx="32" cy="40" rx="3" ry="2" fill="#222"/></svg>' },
    rabbit:   { name: '小兔',   svg: '<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg"><ellipse cx="22" cy="14" rx="5" ry="14" fill="#FFB6C1"/><ellipse cx="42" cy="14" rx="5" ry="14" fill="#FFB6C1"/><ellipse cx="22" cy="14" rx="2.5" ry="9" fill="#FF69B4"/><ellipse cx="42" cy="14" rx="2.5" ry="9" fill="#FF69B4"/><circle cx="32" cy="38" r="18" fill="#FFF0F5"/><circle cx="26" cy="34" r="2.5" fill="#222"/><circle cx="38" cy="34" r="2.5" fill="#222"/><ellipse cx="32" cy="42" rx="3" ry="2" fill="#FF69B4"/><path d="M26 46 Q32 50 38 46" stroke="#FF69B4" stroke-width="1.5" fill="none" stroke-linecap="round"/></svg>' },
    panda:    { name: '熊猫',   svg: '<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="16" cy="18" r="7" fill="#222"/><circle cx="48" cy="18" r="7" fill="#222"/><circle cx="32" cy="36" r="20" fill="#fff"/><ellipse cx="24" cy="32" rx="5" ry="6" fill="#222"/><ellipse cx="40" cy="32" rx="5" ry="6" fill="#222"/><circle cx="25" cy="33" r="1.5" fill="#fff"/><circle cx="41" cy="33" r="1.5" fill="#fff"/><ellipse cx="32" cy="40" rx="3" ry="2" fill="#222"/><path d="M28 45 Q32 48 36 45" stroke="#222" stroke-width="1.5" fill="none" stroke-linecap="round"/></svg>' },
    fox:      { name: '小狐狸', svg: '<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10 20 L22 8 L26 22 Z" fill="#FF8C00"/><path d="M54 20 L42 8 L38 22 Z" fill="#FF8C00"/><path d="M14 22 L22 14 L24 22 Z" fill="#FFF8DC"/><path d="M50 22 L42 14 L40 22 Z" fill="#FFF8DC"/><ellipse cx="32" cy="38" rx="20" ry="18" fill="#FF8C00"/><ellipse cx="32" cy="44" rx="12" ry="9" fill="#FFF8DC"/><circle cx="26" cy="34" r="2.5" fill="#222"/><circle cx="38" cy="34" r="2.5" fill="#222"/><ellipse cx="32" cy="42" rx="3.5" ry="2.5" fill="#222"/></svg>' },
    cat:      { name: '小猫',   svg: '<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 26 L18 10 L28 22 Z" fill="#FFB347"/><path d="M52 26 L46 10 L36 22 Z" fill="#FFB347"/><path d="M16 24 L20 15 L26 22 Z" fill="#FFE4B5"/><path d="M48 24 L44 15 L38 22 Z" fill="#FFE4B5"/><circle cx="32" cy="36" r="18" fill="#FFB347"/><circle cx="26" cy="32" r="2.5" fill="#222"/><circle cx="38" cy="32" r="2.5" fill="#222"/><path d="M32 38 L30 42 L34 42 Z" fill="#FFB6C1"/><path d="M24 44 Q32 48 40 44" stroke="#222" stroke-width="1.5" fill="none" stroke-linecap="round"/><path d="M18 36 L10 34 M18 39 L10 40" stroke="#222" stroke-width="1" stroke-linecap="round"/><path d="M46 36 L54 34 M46 39 L54 40" stroke="#222" stroke-width="1" stroke-linecap="round"/></svg>' },
    pig:      { name: '小猪',   svg: '<svg viewBox="0 0 64 64" fill="none" xmlns="www.w3.org/2000/svg"><ellipse cx="18" cy="20" rx="5" ry="7" fill="#FFB6C1"/><ellipse cx="46" cy="20" rx="5" ry="7" fill="#FFB6C1"/><circle cx="32" cy="36" r="20" fill="#FFB6C1"/><ellipse cx="32" cy="40" rx="9" ry="7" fill="#FF69B4"/><circle cx="29" cy="40" r="1.5" fill="#222"/><circle cx="35" cy="40" r="1.5" fill="#222"/><circle cx="26" cy="30" r="2" fill="#222"/><circle cx="38" cy="30" r="2" fill="#222"/></svg>' },
    frog:     { name: '小青蛙', svg: '<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="20" cy="18" r="8" fill="#7CFC00"/><circle cx="44" cy="18" r="8" fill="#7CFC00"/><circle cx="20" cy="18" r="4" fill="#fff"/><circle cx="44" cy="18" r="4" fill="#fff"/><circle cx="21" cy="19" r="2" fill="#222"/><circle cx="45" cy="19" r="2" fill="#222"/><ellipse cx="32" cy="40" rx="22" ry="18" fill="#7CFC00"/><ellipse cx="32" cy="44" rx="10" ry="6" fill="#98FB98"/><path d="M24 44 Q32 50 40 44" stroke="#228B22" stroke-width="2" fill="none" stroke-linecap="round"/></svg>' },
    penguin:  { name: '企鹅',   svg: '<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg"><ellipse cx="32" cy="38" rx="18" ry="22" fill="#222"/><ellipse cx="32" cy="42" rx="11" ry="15" fill="#fff"/><circle cx="27" cy="28" r="2" fill="#222"/><circle cx="37" cy="28" r="2" fill="#222"/><path d="M28 34 L32 38 L36 34 Z" fill="#FFA500"/><ellipse cx="22" cy="42" rx="4" ry="8" fill="#222" transform="rotate(-20 22 42)"/><ellipse cx="42" cy="42" rx="4" ry="8" fill="#222" transform="rotate(20 42 42)"/><ellipse cx="27" cy="58" rx="5" ry="3" fill="#FFA500"/><ellipse cx="37" cy="58" rx="5" ry="3" fill="#FFA500"/></svg>' },
    duck:     { name: '小鸭',   svg: '<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="32" cy="36" r="20" fill="#FFD700"/><ellipse cx="22" cy="16" rx="6" ry="10" fill="#FFD700" transform="rotate(-20 22 16)"/><circle cx="27" cy="30" r="2.5" fill="#222"/><circle cx="37" cy="30" r="2.5" fill="#222"/><ellipse cx="46" cy="38" rx="8" ry="5" fill="#FFA500"/><path d="M50 38 L58 36 L58 40 Z" fill="#FF8C00"/><ellipse cx="32" cy="48" rx="10" ry="4" fill="#FFF8DC"/></svg>' },
    owl:      { name: '猫头鹰', svg: '<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 24 L8 14 L18 20 Z" fill="#8B4513"/><path d="M52 24 L56 14 L46 20 Z" fill="#8B4513"/><ellipse cx="32" cy="36" rx="20" ry="22" fill="#A0522D"/><circle cx="24" cy="30" r="8" fill="#fff"/><circle cx="40" cy="30" r="8" fill="#fff"/><circle cx="24" cy="31" r="4" fill="#222"/><circle cx="40" cy="31" r="4" fill="#222"/><circle cx="25" cy="30" r="1.5" fill="#fff"/><circle cx="41" cy="30" r="1.5" fill="#fff"/><path d="M28 40 L32 44 L36 40 Z" fill="#FFA500"/><ellipse cx="32" cy="50" rx="12" ry="5" fill="#D2691E"/></svg>' },
    lion:     { name: '小狮子', svg: '<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="32" cy="34" r="22" fill="#DAA520"/><circle cx="32" cy="36" r="16" fill="#FFD700"/><circle cx="26" cy="30" r="2.5" fill="#222"/><circle cx="38" cy="30" r="2.5" fill="#222"/><ellipse cx="32" cy="38" rx="3" ry="2" fill="#8B4513"/><path d="M26 44 Q32 48 38 44" stroke="#8B4513" stroke-width="1.5" fill="none" stroke-linecap="round"/><path d="M14 22 L10 14 L18 18" fill="#DAA520"/><path d="M50 22 L54 14 L46 18" fill="#DAA520"/></svg>' },
    koala:    { name: '考拉',   svg: '<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="16" cy="22" r="8" fill="#696969"/><circle cx="48" cy="22" r="8" fill="#696969"/><circle cx="16" cy="22" r="4" fill="#D3D3D3"/><circle cx="48" cy="22" r="4" fill="#D3D3D3"/><ellipse cx="32" cy="36" rx="18" ry="20" fill="#808080"/><ellipse cx="32" cy="40" rx="11" ry="10" fill="#D3D3D3"/><circle cx="26" cy="30" r="2.5" fill="#222"/><circle cx="38" cy="30" r="2.5" fill="#222"/><ellipse cx="32" cy="38" rx="2.5" ry="1.5" fill="#222"/></svg>' }
  };

  function presetAvatarSvg(key, size = 44) {
    const p = PRESET_AVATARS[key];
    if (!p) return '';
    return `<div class="avatar preset-avatar" style="width:${size}px;height:${size}px;background:linear-gradient(135deg,#fff5f5,#fff0f5)">${p.svg}</div>`;
  }

  function avatarHtml(entity, size = 44, fallbackChar = '未') {
    const st = `width:${size}px;height:${size}px`;
    if (entity && entity.avatar) {
      // 预设头像（SVG）
      if (typeof entity.avatar === 'object' && entity.avatar.type === 'preset') {
        return presetAvatarSvg(entity.avatar.key, size);
      }
      // 文件头像（blob）
      return `<img class="avatar" style="${st}" src="${blobUrl(entity.id + ':av', entity.avatar)}">`;
    }
    const ch = entity && entity.name ? entity.name.trim().charAt(0) || fallbackChar : fallbackChar;
    const color = entity ? colorFor(entity.id) : '#3a3d4d';
    const fs = Math.round(size * 0.42);
    return `<div class="avatar letter" style="${st};background:${color};font-size:${fs}px">${esc(ch)}</div>`;
  }

  function videoSrcOf(v) {
    if (v && v.videoUrl) return v.videoUrl;
    if (v && v.blob) return blobUrl(v.id + ':vid', v.blob);
    return '';
  }

  function captureThumb(v) {
    if (v.thumb) return Promise.resolve(v.thumb);
    const src = videoSrcOf(v);
    if (!src) return Promise.resolve(null);
    return new Promise((resolve) => {
      let done = false;
      const finish = (d) => { if (!done) { done = true; resolve(d || null); } };
      const vid = document.createElement('video');
      vid.muted = true;
      vid.preload = 'auto';
      vid.crossOrigin = 'anonymous';
      vid.src = src;
      vid.onloadeddata = () => { try { vid.currentTime = Math.min(1.2, (vid.duration || 2) / 3); } catch (e) { finish(null); } };
      vid.onseeked = () => {
        try {
          const c = document.createElement('canvas');
          const w = 320;
          const ratio = vid.videoHeight ? w / vid.videoWidth : 1;
          c.width = w;
          c.height = Math.max(1, Math.round(vid.videoHeight * ratio)) || 180;
          c.getContext('2d').drawImage(vid, 0, 0, c.width, c.height);
          const d = c.toDataURL('image/jpeg', 0.72);
          v.thumb = d;
          DB.put('videos', v).catch(() => {});
          finish(d);
        } catch (e) { finish(null); }
      };
      vid.onerror = () => finish(null);
      setTimeout(() => finish(v.thumb || null), 8000);
    });
  }

  function thumbNode(v, cls = 'thumb') {
    if (v.thumb) return `<img class="${cls}" data-thumbvid="${v.id}" src="${v.thumb}">`;
    return `<div class="${cls} thumb-empty" data-thumbvid="${v.id}">${icon('film', 26)}</div>`;
  }

  function decorateThumbs(scope, videos) {
    for (const v of videos) {
      if (v.thumb) continue;
      captureThumb(v).then((d) => {
        if (!d) return;
        scope.querySelectorAll(`[data-thumbvid="${v.id}"]`).forEach((node) => {
          node.outerHTML = `<img class="${node.className.replace('thumb-empty', '').trim()}" src="${d}">`;
        });
      });
    }
  }

  async function copyText(t) {
    try { await navigator.clipboard.writeText(t); return true; } catch (e) {}
    try {
      const ta = document.createElement('textarea');
      ta.value = t;
      ta.style.cssText = 'position:fixed;opacity:0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch (e) { return false; }
  }

  return { icon, ageIcon, logoSVG, esc, toast, modal, closeModal, confirmDialog, promptDialog, fmtTime, fmtDur, fmtSize, blobUrl, revokeUrl, colorFor, avatarHtml, presetAvatarSvg, PRESET_AVATARS, videoSrcOf, captureThumb, thumbNode, decorateThumbs, copyText };
})();
