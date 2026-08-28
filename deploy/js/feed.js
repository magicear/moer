const Feed = (() => {
  const { icon, esc, toast, fmtDur, avatarHtml, thumbNode, decorateThumbs } = UI;

  // 虚拟系列ID：未分组
  const UNGROUPED_ID = '__ungrouped__';

  let mode = 'recommend';
  let seriesList = [];   // [{ seriesId, series, videos, isVirtual }]
  let index = 0;
  let inited = false;
  let lastSwitch = 0;
  let commentVid = null;

  const slidesEl = () => document.getElementById('feedSlides');
  const drawer = () => document.getElementById('commentDrawer');

  // 当前系列信息
  function currentSeriesItem() { return seriesList[index] || null; }
  function currentSeriesId() { const s = currentSeriesItem(); return s ? s.seriesId : null; }
  function currentSeries() { const s = currentSeriesItem(); return s ? s.series : null; }
  function currentVideos() { const s = currentSeriesItem(); return s ? s.videos : []; }

  // 当前播放视频（系列内的）
  let seriesVideoIndex = {};  // seriesId -> current video index within series

  function currentVideo() {
    const s = currentSeriesItem();
    if (!s) return null;
    const vi = seriesVideoIndex[s.seriesId] || 0;
    return s.videos[vi] || null;
  }
  function currentVideoId() { const v = currentVideo(); return v ? v.id : null; }

  // 获取未分组虚拟系列
  function getUngroupedSeries() {
    const videos = Data.S.videos.filter((v) => !v.seriesId);
    if (!videos.length) return null;
    return {
      seriesId: UNGROUPED_ID,
      series: { id: UNGROUPED_ID, name: '未分组', avatar: null, createdAt: 0, isVirtual: true },
      videos: videos.sort((a, b) => b.addedAt - a.addedAt),
      isVirtual: true
    };
  }

  // 构建系列列表：从视频出发，按系列分组
  function buildSeriesList(m) {
    let sourceVideos = [];

    if (m === 'recommend') {
      // 推荐：按系列的"热度"排序
      sourceVideos = Data.S.videos.slice();
    } else if (m === 'follow') {
      // 关注：只显示已关注的系列
      sourceVideos = Data.S.videos.filter((v) => v.seriesId && Data.isFollowed(v.seriesId));
    } else {
      // 栏目页：该栏目下所有视频
      sourceVideos = Data.S.videos.filter((v) => v.categoryId === m);
    }

    if (!sourceVideos.length) return [];

    // 按 seriesId 分组
    const groups = {};
    for (const v of sourceVideos) {
      const sid = v.seriesId || UNGROUPED_ID;
      if (!groups[sid]) groups[sid] = [];
      groups[sid].push(v);
    }

    // 转换为系列项数组
    const items = [];
    for (const sid of Object.keys(groups)) {
      const vids = groups[sid].sort((a, b) => b.addedAt - a.addedAt);
      if (sid === UNGROUPED_ID) {
        items.push({
          seriesId: UNGROUPED_ID,
          series: { id: UNGROUPED_ID, name: '未分组', avatar: null, createdAt: 0, isVirtual: true },
          videos: vids,
          isVirtual: true
        });
      } else {
        const s = Data.seriesById(sid);
        if (s) {
          items.push({ seriesId: sid, series: s, videos: vids, isVirtual: false });
        } else {
          // 系列已删除但视频还在，归入未分组逻辑会在前面处理
          items.push({
            seriesId: UNGROUPED_ID + '_' + sid,
            series: { id: sid, name: '未知系列', avatar: null, createdAt: 0, isVirtual: true },
            videos: vids,
            isVirtual: true
          });
        }
      }
    }

    // 排序
    if (m === 'recommend') {
      // 推荐排序：系列内视频被观看/喜欢越多排越前
      items.sort((a, b) => seriesScore(b) - seriesScore(a));
    } else if (m === 'follow') {
      // 关注页：按关注时间排序
      items.sort((a, b) => {
        const fa = Data.S.follows.find((f) => f.seriesId === a.seriesId);
        const fb = Data.S.follows.find((f) => f.seriesId === b.seriesId);
        const ta = fa ? fa.followedAt : 0;
        const tb = fb ? fb.followedAt : 0;
        return tb - ta;
      });
    } else {
      // 栏目页：按最新视频时间排序
      items.sort((a, b) => (b.videos[0]?.addedAt || 0) - (a.videos[0]?.addedAt || 0));
    }

    return items;
  }

  function seriesScore(item) {
    let score = 0;
    for (const v of item.videos) {
      const inter = Data.getInter(v.id);
      if (inter.watchCount > 0) score += inter.watchCount;
      if (inter.liked) score += 3;
      if (inter.favored) score += 2;
      if (inter.lastWatchedAt) score += 0.5;
    }
    // 关注加分
    if (Data.isFollowed(item.seriesId)) score += 5;
    // 随机扰动
    score += Math.random() * 0.5;
    return score;
  }

  function open(m, startVideoId) {
    mode = m;
    seriesList = buildSeriesList(m);
    index = 0;
    seriesVideoIndex = {};

    // 如果指定了起始视频，定位到对应系列和视频索引
    if (startVideoId) {
      const si = seriesList.findIndex((s) => s.videos.some((v) => v.id === startVideoId));
      if (si >= 0) {
        index = si;
        const vi = seriesList[si].videos.findIndex((v) => v.id === startVideoId);
        if (vi >= 0) seriesVideoIndex[seriesList[si].seriesId] = vi;
      }
    }

    closeComments();
    const cont = slidesEl();
    cont.innerHTML = '';
    cont.classList.add('no-anim');
    render();
    void cont.offsetHeight;
    cont.classList.remove('no-anim');
    inited = true;
    if (seriesList.length) {
      playCurrent();
      Data.recordWatch(currentVideo().id);
    }
    renderEmpty();
  }

  function renderEmpty() {
    const el = document.getElementById('emptyFeed');
    if (seriesList.length) { el.classList.add('hidden'); return; }
    el.classList.remove('hidden');
    if (mode === 'follow') {
      el.innerHTML = `<div class="empty-ico">${icon('users', 52)}</div><p>还没有关注的系列</p><p class="tip">在视频右侧点头像下的 ➕ 即可关注系列</p>`;
    } else {
      el.innerHTML = `<div class="empty-ico">${icon('film', 52)}</div><p>${mode === 'recommend' ? '还没有视频，先去添加吧' : '该栏目还没有视频'}</p><button class="btn-primary" id="emptyGoAdd">去添加视频</button>`;
      el.querySelector('#emptyGoAdd').onclick = () => App.showPage('manage');
    }
  }

  function render() {
    const cont = slidesEl();
    const keep = [index - 1, index, index + 1].filter((i) => i >= 0 && i < seriesList.length);
    const have = new Set([...cont.children].map((c) => +c.dataset.idx));
    for (const i of keep) {
      if (!have.has(i)) cont.appendChild(slideEl(i));
    }
    [...cont.children].forEach((c) => {
      const i = +c.dataset.idx;
      if (!keep.includes(i)) {
        if (c._cleanupFs) c._cleanupFs();
        c.remove();
      } else {
        c.style.top = (i * 100) + '%';
      }
    });
    cont.style.transform = `translateY(-${index * 100}%)`;
    renderEmpty();
  }

  function slideEl(i) {
    const item = seriesList[i];
    const series = item.series;
    const videos = item.videos;
    const followed = !item.isVirtual && Data.isFollowed(item.seriesId);
    const vi = seriesVideoIndex[item.seriesId] || 0;
    const v = videos[vi];
    const inter = v ? Data.getInter(v.id) : { liked: false, favored: false, watchLater: false };

    const slide = document.createElement('div');
    slide.className = 'series-slide';
    slide.dataset.idx = i;
    slide.dataset.sid = item.seriesId;

    slide.innerHTML = `
      <div class="series-left">
        <div class="stage">
          <video src="${v ? Data.getVideoSrc(v) : ''}" loop playsinline preload="auto" webkit-playsinline x5-playsinline x5-video-player-type="h5"></video>
          <div class="center-flash">${icon('play', 56)}</div>
          <div class="video-error hidden" style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:rgba(0,0,0,.8);color:var(--txt2);gap:12px;z-index:2">
            <div style="font-size:48px">⚠️</div>
            <div style="font-size:15px;color:var(--txt)">视频格式不兼容</div>
            <div style="font-size:13px;text-align:center;max-width:280px;line-height:1.6">此视频格式（${v ? (v.fileName || '').split('.').pop() || '未知' : ''}）可能不被当前浏览器支持。<br>建议转码为 MP4 格式后重新上传。</div>
          </div>
          <div class="ad-overlay hidden" style="position:absolute;inset:0;background:#000;z-index:5;display:flex;flex-direction:column;align-items:center;justify-content:center">
            <div class="ad-content" style="width:100%;height:100%;position:relative"></div>
            <div class="ad-skip" style="position:absolute;top:12px;right:12px;z-index:6">
              <button class="btn btn-sm" id="adSkipBtn" style="background:rgba(0,0,0,.6);color:#fff;border:1px solid rgba(255,255,255,.3);display:none">跳过广告</button>
            </div>
            <div class="ad-timer" style="position:absolute;bottom:12px;right:12px;color:rgba(255,255,255,.7);font-size:12px;z-index:6"></div>
          </div>
          <div class="stage-ctrl">
            <div class="volume-wrap">
              <button class="ctrl-btn mute-btn">${icon(Data.S.settings.muted ? 'volumeX' : 'volume', 20)}</button>
              <input type="range" class="volume-slider" min="0" max="100" value="${Math.round((Data.S.settings.muted ? 0 : Data.S.settings.volume) * 100)}">
            </div>
            <div class="speed-wrap">
              <button class="ctrl-btn speed-btn">${(Data.S.settings.playbackRate || 1).toFixed(2)}x</button>
              <div class="speed-menu hidden">
                <div class="speed-item" data-rate="0.5">0.5x</div>
                <div class="speed-item" data-rate="0.75">0.75x</div>
                <div class="speed-item active" data-rate="1">1.0x 正常</div>
                <div class="speed-item" data-rate="1.25">1.25x</div>
                <div class="speed-item" data-rate="1.5">1.5x</div>
                <div class="speed-item" data-rate="2">2.0x</div>
              </div>
            </div>
            <button class="ctrl-btn fullscreen-btn" title="全屏">${icon('maximize', 20)}</button>
            <span class="time-label">00:00 / 00:00</span>
          </div>
          <div class="progress"><div class="progress-fill"></div></div>
        </div>
        <div class="video-info">
          <div class="vi-title" title="${v ? esc(v.title) : ''}">${v ? esc(v.title) : ''}${v && v.vipOnly ? ' <span style="color:#ffd700;font-size:11px;vertical-align:middle;background:rgba(255,215,0,.15);padding:2px 6px;border-radius:4px">VIP</span>' : ''}</div>
          ${v && v.description ? `<div class="vi-desc" title="${esc(v.description)}">${esc(v.description)}</div>` : ''}
          <div class="vi-sub">
            <span class="vi-series">${esc(series.name)}</span>
            <span>·</span>
            <span class="vi-tag">${v ? UI.ageIcon((CATEGORIES.find(c => c.id === v.categoryId) || {}).icon || 'sparkle', 14) + ' ' + esc(Data.catName(v.categoryId)) : ''}</span>
          </div>
        </div>
        <div class="episode-bar" data-epid="${item.seriesId}">
          <div class="ep-label">选集</div>
          <div class="ep-list">
            ${videos.map((vv, idx) => `
              <div class="ep-item ${idx === vi ? 'active' : ''}" data-epidx="${idx}" title="${esc(vv.title)}">
                <span class="ep-num">第${idx + 1}集</span>
                <span class="ep-title">${esc(vv.title)}${vv.vipOnly ? ' <span style="color:#ffd700;font-size:10px">VIP</span>' : ''}</span>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
      <div class="series-right">
        <div class="series-head">
          <div class="avatar-col" data-sid="${item.seriesId}">
            ${avatarHtml(item.isVirtual ? null : series, 50, '未')}
            ${item.isVirtual ? '' : `<button class="follow-plus ${followed ? 'hidden' : ''}" data-fp="${item.seriesId}" title="关注">${icon('plus', 13)}</button>`}
          </div>
          <div class="info-col">
            <div class="s-name">${esc(series.name)}</div>
            <div class="s-sub">${videos.length} 个视频</div>
          </div>
          <button class="follow-btn ${followed ? 'followed' : ''}" data-follow="${item.seriesId}">${followed ? '已关注' : '关注'}</button>
        </div>
        <div class="series-thumbs" data-stid="${item.seriesId}">
          ${videos.map((vv, idx) => `
            <div class="series-thumb-item ${idx === vi ? 'active' : ''}" data-vidx="${idx}" data-vid="${vv.id}">
              <div class="t-thumb">${thumbNode(vv, 'thumb')}</div>
              <div class="t-info">
                <div class="t-title">${esc(vv.title)}</div>
                <div class="t-meta">${fmtDur(Data.getInter(vv.id).duration || 0)}</div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
      <div class="series-side-bar">
        <button class="sb-btn like ${inter.liked ? 'active' : ''}" title="喜欢">${icon('heart', 30)}</button>
        <button class="sb-btn fav ${inter.favored ? 'active' : ''}" title="收藏">${icon('star', 30)}</button>
        <button class="sb-btn later ${inter.watchLater ? 'active' : ''}" title="稍后再看">${icon('clock', 30)}</button>
        <button class="sb-btn cmt" title="评论">${icon('comment', 30)}<span class="sb-count">${v ? Data.commentCount(v.id) : 0}</span></button>
        <button class="sb-btn share" title="分享">${icon('share', 30)}</button>
      </div>`;

    // 视频播放器交互
    const stage = slide.querySelector('.stage');
    const video = slide.querySelector('video');
    const flash = slide.querySelector('.center-flash');
    const fill = slide.querySelector('.progress-fill');
    const progress = slide.querySelector('.progress');
    const timeLabel = slide.querySelector('.time-label');
    const muteBtn = slide.querySelector('.mute-btn');
    video.muted = !!Data.S.settings.muted;
    video.playbackRate = Data.S.settings.playbackRate || 1;
    video.volume = Data.S.settings.volume;

    // 视频格式兼容性检测
    const errorEl = slide.querySelector('.video-error');
    video.addEventListener('error', () => {
      if (errorEl) errorEl.classList.remove('hidden');
    });
    video.addEventListener('playing', () => {
      if (errorEl) errorEl.classList.add('hidden');
    });

    // 广告系统
    const adOverlay = slide.querySelector('.ad-overlay');
    const adContent = slide.querySelector('.ad-content');
    const adSkipBtn = slide.querySelector('#adSkipBtn');
    const adTimer = slide.querySelector('.ad-timer');
    let currentAd = null;
    let adCountdown = null;

    async function showAd(adId, position, onDone) {
      if (!adId) { onDone(); return; }
      try {
        const res = await Cloud.apiGet('/admin/ads');
        const ads = res.ads || [];
        currentAd = ads.find((a) => a.id === adId && a.isActive);
        if (!currentAd) { onDone(); return; }
      } catch (e) { onDone(); return; }

      adOverlay.classList.remove('hidden');
      video.pause();

      let html = '';
      if (currentAd.videoUrl) {
        html = `<video src="${esc(currentAd.videoUrl)}" style="width:100%;height:100%;object-fit:contain" autoplay playsinline></video>`;
      } else if (currentAd.imageUrl) {
        html = `<img src="${esc(currentAd.imageUrl)}" style="max-width:100%;max-height:80%;object-fit:contain">`;
      } else {
        html = `<div style="color:#fff;font-size:18px">${esc(currentAd.title)}</div>`;
      }
      if (currentAd.linkUrl) {
        html = `<a href="${esc(currentAd.linkUrl)}" target="_blank" rel="noopener" style="display:block;width:100%;height:100%;position:absolute;inset:0">${html}</a>`;
      }
      adContent.innerHTML = html;

      const duration = currentAd.duration || 5;
      let remaining = duration;
      adTimer.textContent = `${remaining}秒后可跳过`;
      adSkipBtn.style.display = 'none';

      adCountdown = setInterval(() => {
        remaining--;
        if (remaining <= 0) {
          adSkipBtn.style.display = 'block';
          adTimer.textContent = '';
        } else {
          adTimer.textContent = `${remaining}秒`;
        }
      }, 1000);

      const skipAd = () => {
        clearInterval(adCountdown);
        adOverlay.classList.add('hidden');
        adContent.innerHTML = '';
        adSkipBtn.removeEventListener('click', skipAd);
        currentAd = null;
        onDone();
      };
      adSkipBtn.addEventListener('click', skipAd);

      if (currentAd.videoUrl) {
        const adVideo = adContent.querySelector('video');
        if (adVideo) {
          adVideo.onended = () => skipAd();
          adVideo.onerror = () => skipAd();
        }
      } else {
        setTimeout(skipAd, duration * 1000);
      }
    }

    // 暴露 showAd 给外部调用
    slide._showAd = showAd;

    let lastSave = 0;
    let scrubbing = false;

    video.addEventListener('timeupdate', () => {
      if (scrubbing || !video.duration) return;
      fill.style.width = (video.currentTime / video.duration * 100) + '%';
      timeLabel.textContent = `${fmtDur(video.currentTime)} / ${fmtDur(video.duration)}`;
      const now = Date.now();
      if (now - lastSave > 3000 && v) {
        lastSave = now;
        Data.saveProgress(v.id, video.currentTime, video.duration);
      }
    });

    const flashIcon = (name) => {
      flash.innerHTML = icon(name, 56);
      flash.classList.add('show');
      clearTimeout(flash._t);
      flash._t = setTimeout(() => flash.classList.remove('show'), 450);
    };

    const togglePlay = () => {
      if (video.paused) { video.play().catch(() => {}); flashIcon('play'); }
      else { video.pause(); flashIcon('pause'); }
    };

    let clickTimer = null;
    const likeBurst = (cx, cy) => {
      const h = document.createElement('div');
      h.className = 'heart-burst';
      h.innerHTML = icon('heart', 64);
      h.style.left = cx + 'px';
      h.style.top = cy + 'px';
      stage.appendChild(h);
      setTimeout(() => h.remove(), 700);
    };
    const forceLike = () => {
      if (!v) return;
      const inter = Data.getInter(v.id);
      inter.liked = true;
      DB.put('interactions', inter).then(() => Data.emit('interact', { videoId: v.id, field: 'liked', value: true }));
    };
    stage.addEventListener('click', (e) => {
      if (e.target.closest('.stage-ctrl') || e.target.closest('.progress')) return;
      if (e.target.closest('.heart-burst')) return;
      if (clickTimer) {
        clearTimeout(clickTimer);
        clickTimer = null;
        const rect = stage.getBoundingClientRect();
        likeBurst(e.clientX - rect.left, e.clientY - rect.top);
        forceLike();
        return;
      }
      clickTimer = setTimeout(() => { clickTimer = null; togglePlay(); }, 260);
    });

    const seekTo = (clientX) => {
      const rect = progress.getBoundingClientRect();
      const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      if (video.duration) {
        video.currentTime = ratio * video.duration;
        fill.style.width = (ratio * 100) + '%';
      }
    };
    progress.addEventListener('pointerdown', (e) => {
      scrubbing = true;
      progress.classList.add('scrubbing');
      progress.setPointerCapture(e.pointerId);
      seekTo(e.clientX);
    });
    progress.addEventListener('pointermove', (e) => { if (scrubbing) seekTo(e.clientX); });
    progress.addEventListener('pointerup', (e) => {
      scrubbing = false;
      progress.classList.remove('scrubbing');
      seekTo(e.clientX);
    });

    muteBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      Data.S.settings.muted = !Data.S.settings.muted;
      await Data.setSetting('muted', Data.S.settings.muted);
      document.querySelectorAll('.series-slide video').forEach((el) => { el.muted = Data.S.settings.muted; });
      document.querySelectorAll('.mute-btn').forEach((b) => { b.innerHTML = icon(Data.S.settings.muted ? 'volumeX' : 'volume', 20); });
      document.querySelectorAll('.volume-slider').forEach((s) => {
        s.value = Math.round((Data.S.settings.muted ? 0 : Data.S.settings.volume) * 100);
      });
      if (!Data.S.settings.muted) video.play().catch(() => {});
    });

    const volSlider = slide.querySelector('.volume-slider');
    volSlider.addEventListener('input', (e) => {
      e.stopPropagation();
      const val = parseInt(e.target.value) / 100;
      const wasMuted = Data.S.settings.muted;
      if (val === 0) {
        Data.S.settings.muted = true;
      } else {
        Data.S.settings.muted = false;
        Data.S.settings.volume = val;
      }
      document.querySelectorAll('.series-slide video').forEach((el) => {
        el.muted = Data.S.settings.muted;
        el.volume = Data.S.settings.volume;
      });
      document.querySelectorAll('.mute-btn').forEach((b) => {
        b.innerHTML = icon(Data.S.settings.muted ? 'volumeX' : 'volume', 20);
      });
      document.querySelectorAll('.volume-slider').forEach((s) => {
        if (s !== e.target) s.value = e.target.value;
      });
      if (!Data.S.settings.muted && wasMuted) video.play().catch(() => {});
    });
    volSlider.addEventListener('change', async (e) => {
      e.stopPropagation();
      const val = parseInt(e.target.value) / 100;
      if (val > 0) {
        Data.S.settings.volume = val;
        await Data.setSetting('volume', val);
      }
      await Data.setSetting('muted', val === 0);
    });

    // 倍速控制
    const speedWrap = slide.querySelector('.speed-wrap');
    const speedBtn = slide.querySelector('.speed-btn');
    const speedMenu = slide.querySelector('.speed-menu');
    const curRate = Data.S.settings.playbackRate || 1;
    video.playbackRate = curRate;
    speedBtn.textContent = curRate.toFixed(2) + 'x';
    speedMenu.querySelectorAll('.speed-item').forEach((item) => {
      item.classList.toggle('active', parseFloat(item.dataset.rate) === curRate);
    });
    speedBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      speedMenu.classList.toggle('hidden');
    });
    speedMenu.addEventListener('click', (e) => { e.stopPropagation(); });
    speedMenu.querySelectorAll('.speed-item').forEach((item) => {
      item.addEventListener('click', async (e) => {
        e.stopPropagation();
        const rate = parseFloat(item.dataset.rate);
        Data.S.settings.playbackRate = rate;
        await Data.setSetting('playbackRate', rate);
        video.playbackRate = rate;
        speedBtn.textContent = rate.toFixed(2) + 'x';
        speedMenu.querySelectorAll('.speed-item').forEach((si) => si.classList.toggle('active', si === item));
        speedMenu.classList.add('hidden');
      });
    });
    // 点击文档其他地方关闭菜单
    const closeSpeedMenu = (e) => {
      if (speedWrap && !speedWrap.contains(e.target)) {
        speedMenu.classList.add('hidden');
        document.removeEventListener('click', closeSpeedMenu);
      }
    };
    speedBtn.addEventListener('click', () => {
      if (!speedMenu.classList.contains('hidden')) {
        setTimeout(() => document.addEventListener('click', closeSpeedMenu), 0);
      }
    });

    // 全屏切换
    const fullscreenBtn = slide.querySelector('.fullscreen-btn');
    const updateFullscreenIcon = () => {
      const isFs = !!document.fullscreenElement || !!document.webkitFullscreenElement;
      fullscreenBtn.innerHTML = icon(isFs ? 'minimize' : 'maximize', 20);
      fullscreenBtn.title = isFs ? '退出全屏' : '全屏';
    };
    fullscreenBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const el = stage;
      if (!document.fullscreenElement && !document.webkitFullscreenElement) {
        if (el.requestFullscreen) el.requestFullscreen();
        else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
      } else {
        if (document.exitFullscreen) document.exitFullscreen();
        else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
      }
    });
    const onFsChange = () => updateFullscreenIcon();
    document.addEventListener('fullscreenchange', onFsChange);
    document.addEventListener('webkitfullscreenchange', onFsChange);
    slide._cleanupFs = () => {
      document.removeEventListener('fullscreenchange', onFsChange);
      document.removeEventListener('webkitfullscreenchange', onFsChange);
    };

    // 系列头像点击 → 进入系列详情页
    slide.querySelector('.avatar-col').addEventListener('click', () => {
      if (item.isVirtual) {
        toast('未分组视频没有系列详情页');
        return;
      }
      App.showSeriesPage(item.seriesId);
    });

    // 关注按钮（点一次关注，再点一次取关）+ loading + 防抖
    const followBtn = slide.querySelector('[data-follow]');
    let followBusy = false;
    const updateFollowUI = (sid) => {
      const f = Data.isFollowed(sid);
      if (followBtn) {
        followBtn.classList.toggle('followed', f);
        followBtn.textContent = f ? '已关注' : '关注';
      }
      slide.querySelectorAll('[data-fp]').forEach((p) => p.classList.toggle('hidden', f));
    };
    const toggleFollow = async () => {
      if (followBusy) return;
      if (item.isVirtual) {
        toast('未分组视频没有系列，可在「视频管理」中创建系列');
        return;
      }
      followBusy = true;
      const seriesId = followBtn ? followBtn.dataset.follow : item.seriesId;
      if (followBtn) { followBtn.textContent = '处理中…'; followBtn.style.pointerEvents = 'none'; }
      try {
        const f = Data.isFollowed(seriesId);
        if (f) {
          await Data.unfollowSeries(seriesId);
          toast(`已取消关注「${esc(series.name)}」`);
        } else {
          await Data.followSeries(seriesId);
          toast(`已关注「${esc(series.name)}」`);
        }
      } catch (e) {
        toast('操作失败，请重试');
      }
      updateFollowUI(seriesId);
      followBusy = false;
    };
    followBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleFollow(); });
    slide.querySelectorAll('[data-fp]').forEach((p) => {
      p.addEventListener('click', (e) => { e.stopPropagation(); toggleFollow(); });
    });

    // 缩略图列表切换视频
    slide.querySelectorAll('.series-thumb-item').forEach((itemEl) => {
      itemEl.addEventListener('click', () => {
        const vidx = +itemEl.dataset.vidx;
        switchSeriesVideo(item.seriesId, vidx);
      });
    });

    // 选集栏切换视频
    slide.querySelectorAll('.ep-item').forEach((epEl) => {
      epEl.addEventListener('click', () => {
        const eidx = +epEl.dataset.epidx;
        switchSeriesVideo(item.seriesId, eidx);
      });
    });

    // 互动按钮
    slide.querySelector('.like').addEventListener('click', () => {
      if (v) Data.toggleFlag(v.id, 'liked');
    });
    slide.querySelector('.fav').addEventListener('click', () => {
      if (v) Data.toggleFlag(v.id, 'favored');
    });
    slide.querySelector('.later').addEventListener('click', () => {
      if (v) Data.toggleFlag(v.id, 'watchLater');
    });
    slide.querySelector('.cmt').addEventListener('click', () => {
      if (v) openComments(v.id);
    });
    slide.querySelector('.share').addEventListener('click', () => {
      if (v) openShare(v);
    });

    // 异步生成缩略图
    decorateThumbs(slide.querySelector('.series-thumbs'), videos);

    return slide;
  }

  // VIP锁定遮罩（公共函数）
  const VIP_HTML = `
    <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:rgba(0,0,0,.85);z-index:10;gap:16px">
      <div style="width:64px;height:64px;border-radius:50%;background:linear-gradient(135deg,#ffd700,#ffaa00);display:flex;align-items:center;justify-content:center">${icon('crown', 36)}</div>
      <div style="color:#ffd700;font-size:18px;font-weight:600">会员专享内容</div>
      <div style="color:rgba(255,255,255,.6);font-size:13px;text-align:center;max-width:260px;line-height:1.6">此视频为VIP专属，开通会员即可观看全部内容</div>
      <button class="btn btn-primary vip-unlock-btn" style="background:linear-gradient(135deg,#ffd700,#ffaa00);color:#000;border:none;padding:10px 28px;border-radius:20px;font-size:15px;font-weight:600;cursor:pointer">开通会员</button>
    </div>`;
  function showVipLock(slide) {
    const video = slide.querySelector('video');
    video.pause();
    video.removeAttribute('src');
    let el = slide.querySelector('.vip-lock-overlay');
    if (!el) {
      el = document.createElement('div');
      el.className = 'vip-lock-overlay';
      el.innerHTML = VIP_HTML;
      slide.querySelector('.stage').appendChild(el);
      el.querySelector('.vip-unlock-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        if (typeof Pages !== 'undefined' && Pages.showVipDialog) Pages.showVipDialog();
      });
    }
    el.classList.remove('hidden');
  }
  function hideVipLock(slide) {
    const el = slide.querySelector('.vip-lock-overlay');
    if (el) el.classList.add('hidden');
  }

  // 切换系列内当前播放的视频
  function switchSeriesVideo(seriesId, vidx) {
    const item = seriesList.find((s) => s.seriesId === seriesId);
    if (!item) return;
    const videos = item.videos;
    if (vidx < 0 || vidx >= videos.length) return;

    seriesVideoIndex[seriesId] = vidx;

    // 如果是当前显示的系列，更新播放器
    const curItem = currentSeriesItem();
    if (curItem && curItem.seriesId === seriesId) {
      const slide = slidesEl().querySelector(`[data-idx="${index}"]`);
      if (!slide) return;

      const v = videos[vidx];

      // VIP-only check
      if (v.vipOnly && !Cloud.isVip()) {
        showVipLock(slide);
        slide.querySelector('.vi-title').innerHTML = esc(v.title) + ' <span style="color:#ffd700;font-size:11px;vertical-align:middle;background:rgba(255,215,0,.15);padding:2px 6px;border-radius:4px">VIP</span>';
        return;
      }
      hideVipLock(slide);

      // 更新视频源
      const video = slide.querySelector('video');
      video.src = Data.getVideoSrc(v);
      video.muted = !!Data.S.settings.muted;
      video.volume = Data.S.settings.volume;
      video.playbackRate = Data.S.settings.playbackRate || 1;
      video.play().catch(() => {});

      // 更新标题
      const titleHtml = esc(v.title) + (v.vipOnly ? ' <span style="color:#ffd700;font-size:11px;vertical-align:middle;background:rgba(255,215,0,.15);padding:2px 6px;border-radius:4px">VIP</span>' : '');
      slide.querySelector('.vi-title').innerHTML = titleHtml;
      slide.querySelector('.vi-title').title = v.title;

      // 更新简介
      const descEl = slide.querySelector('.vi-desc');
      if (v.description) {
        if (descEl) {
          descEl.textContent = v.description;
          descEl.title = v.description;
        } else {
          const titleEl = slide.querySelector('.vi-title');
          const newDesc = document.createElement('div');
          newDesc.className = 'vi-desc';
          newDesc.textContent = v.description;
          newDesc.title = v.description;
          titleEl.after(newDesc);
        }
      } else if (descEl) {
        descEl.remove();
      }

      // 更新标签
      const cat = CATEGORIES.find(c => c.id === v.categoryId);
      slide.querySelector('.vi-tag').innerHTML = `${UI.ageIcon((cat || {}).icon || 'sparkle', 14)} ${esc(Data.catName(v.categoryId))}`;

      // 更新互动按钮状态
      const inter = Data.getInter(v.id);
      slide.querySelector('.like').classList.toggle('active', inter.liked);
      slide.querySelector('.fav').classList.toggle('active', inter.favored);
      slide.querySelector('.later').classList.toggle('active', inter.watchLater);
      slide.querySelector('.sb-count').textContent = Data.commentCount(v.id);

      // 更新缩略图高亮
      slide.querySelectorAll('.series-thumb-item').forEach((el, idx) => {
        el.classList.toggle('active', idx === vidx);
      });

      // 更新选集栏高亮
      slide.querySelectorAll('.ep-item').forEach((el, idx) => {
        el.classList.toggle('active', idx === vidx);
      });

      // 进度条归零
      slide.querySelector('.progress-fill').style.width = '0%';

      // 记录观看
      Data.recordWatch(v.id);

      // 如果评论抽屉开着，更新评论
      if (drawer().classList.contains('open')) {
        commentVid = v.id;
        renderComments();
      }
    }
  }

  function playCurrent() {
    const v = currentVideo();
    if (!v) return;
    const slide = slidesEl().querySelector(`[data-idx="${index}"]`);
    if (!slide) return;
    const video = slide.querySelector('video');
    if (!video) return;

    // VIP-only check
    if (v.vipOnly && !Cloud.isVip()) {
      showVipLock(slide);
      return;
    }
    hideVipLock(slide);

    video.muted = !!Data.S.settings.muted;
    video.volume = Data.S.settings.volume;
    video.playbackRate = Data.S.settings.playbackRate || 1;
    video.currentTime = 0;

    const startPlay = () => {
      const p = video.play();
      if (p && p.catch) {
        p.catch(() => {
          video.muted = true;
          Data.S.settings.muted = true;
          Data.setSetting('muted', true);
          const mb = slide.querySelector('.mute-btn');
          if (mb) mb.innerHTML = icon('volumeX', 20);
          video.play().catch(() => {});
        });
      }
    };

    // 前贴广告
    if (slide._showAd && v.preAdId) {
      slide._showAd(v.preAdId, 'pre', startPlay);
    } else {
      startPlay();
    }

    // 后贴广告
    if (v.postAdId) {
      video.addEventListener('ended', function onEnd() {
        video.removeEventListener('ended', onEnd);
        if (slide._showAd) {
          slide._showAd(v.postAdId, 'post', () => {});
        }
      });
    }
  }

  function pauseAll() {
    document.querySelectorAll('#feedSlides video').forEach((el) => el.pause());
  }

  function setIndex(i) {
    if (!seriesList.length) return;
    i = Math.max(0, Math.min(seriesList.length - 1, i));
    if (i === index) return;
    const oldItem = currentSeriesItem();
    if (oldItem) {
      const oldSlide = slidesEl().querySelector(`[data-idx="${index}"] video`);
      if (oldSlide && oldItem.videos.length) {
        const vi = seriesVideoIndex[oldItem.seriesId] || 0;
        const oldV = oldItem.videos[vi];
        if (oldV) Data.saveProgress(oldV.id, oldSlide.currentTime, oldSlide.duration);
      }
    }
    pauseAll();
    index = i;
    render();
    requestAnimationFrame(() => {
      render();
      playCurrent();
      const v = currentVideo();
      if (v) Data.recordWatch(v.id);
      if (drawer().classList.contains('open')) {
        const cv = currentVideo();
        commentVid = cv ? cv.id : null;
        renderComments();
      }
    });
  }

  function next() { setIndex(index + 1); }
  function prev() { setIndex(index - 1); }

  function togglePlay() {
    const slide = slidesEl().querySelector(`[data-idx="${index}"]`);
    if (!slide) return;
    const video = slide.querySelector('video');
    if (!video) return;
    if (video.paused) { video.play().catch(() => {}); } else { video.pause(); }
  }

  function init() {
    if (inited) return;
    const vp = document.getElementById('feedViewport');
    vp.addEventListener('wheel', (e) => {
      if (App.currentPage !== 'feed') return;
      if (e.target.closest('#commentDrawer') || e.target.closest('.scrollable')) return;
      // 缩略图列表内滚轮不触发系列切换
      if (e.target.closest('.series-thumbs')) return;
      e.preventDefault();
      const now = Date.now();
      if (now - lastSwitch < 650) return;
      lastSwitch = now;
      if (e.deltaY > 0) next();
      else if (e.deltaY < 0) prev();
    }, { passive: false });

    let tX = 0, tY = 0, tT = 0;
    vp.addEventListener('touchstart', (e) => {
      if (e.touches.length !== 1) return;
      if (e.target.closest('#commentDrawer') || e.target.closest('.scrollable') || e.target.closest('.series-thumbs')) return;
      tX = e.touches[0].clientX;
      tY = e.touches[0].clientY;
      tT = Date.now();
    }, { passive: true });
    vp.addEventListener('touchend', (e) => {
      if (Date.now() - tT > 600 || !tT) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - tX, dy = t.clientY - tY;
      if (Math.abs(dy) > 55 && Math.abs(dy) > Math.abs(dx) * 1.4) {
        if (Date.now() - lastSwitch < 450) return;
        lastSwitch = Date.now();
        if (dy < 0) next(); else prev();
      }
    }, { passive: true });

    document.getElementById('feedPrevBtn').addEventListener('click', prev);
    document.getElementById('feedNextBtn').addEventListener('click', next);

    document.getElementById('cdClose').addEventListener('click', closeComments);
    const sendComment = async () => {
      const input = document.getElementById('cdText');
      const text = input.value.trim();
      if (!text || !commentVid) return;
      await Data.addComment(commentVid, text);
      input.value = '';
    };
    document.getElementById('cdSend').addEventListener('click', sendComment);
    document.getElementById('cdText').addEventListener('keydown', (e) => { if (e.key === 'Enter') sendComment(); });

    Data.on((evt, detail) => {
      if (evt === 'comments' && detail && detail.videoId) {
        document.querySelectorAll(`.series-slide .sb-count`).forEach((el) => {
          const slide = el.closest('.series-slide');
          if (!slide) return;
          const sid = slide.dataset.sid;
          const item = seriesList.find((s) => s.seriesId === sid);
          if (!item) return;
          const vi = seriesVideoIndex[sid] || 0;
          const v = item.videos[vi];
          if (v && v.id === detail.videoId) {
            el.textContent = Data.commentCount(detail.videoId);
          }
        });
        if (commentVid === detail.videoId && drawer().classList.contains('open')) renderComments();
      }
      if (evt === 'interact' && detail && detail.videoId) {
        const inter = Data.getInter(detail.videoId);
        document.querySelectorAll('.series-slide').forEach((slide) => {
          const sid = slide.dataset.sid;
          const item = seriesList.find((s) => s.seriesId === sid);
          if (!item) return;
          const vi = seriesVideoIndex[sid] || 0;
          const v = item.videos[vi];
          if (v && v.id === detail.videoId) {
            slide.querySelector('.like').classList.toggle('active', inter.liked);
            slide.querySelector('.fav').classList.toggle('active', inter.favored);
            slide.querySelector('.later').classList.toggle('active', inter.watchLater);
          }
        });
      }
      if (evt === 'follows' || evt === 'series') {
        document.querySelectorAll('.series-slide .follow-btn').forEach((btn) => {
          const sid = btn.dataset.follow;
          const followed = Data.isFollowed(sid);
          btn.classList.toggle('followed', followed);
          btn.textContent = followed ? '已关注' : '关注';
        });
        document.querySelectorAll('.series-slide [data-fp]').forEach((p) => {
          p.classList.toggle('hidden', Data.isFollowed(p.dataset.fp));
        });
        // 关注页列表可能需要刷新
        if (mode === 'follow') {
          const cur = currentSeriesItem();
          const newList = buildSeriesList(mode);
          if (cur) {
            const newIdx = newList.findIndex((s) => s.seriesId === cur.seriesId);
            if (newIdx < 0) { open(mode); return; }
            seriesList = newList;
            if (newIdx !== index) {
              const cont = slidesEl();
              cont.classList.add('no-anim');
              index = newIdx;
              render();
              void cont.offsetHeight;
              cont.classList.remove('no-anim');
            }
          } else {
            open(mode);
          }
        }
      }
      if (evt === 'videos') {
        if (!seriesList.length) { open(mode); return; }
        const cur = currentSeriesItem();
        if (!cur) { open(mode); return; }
        // 检查当前视频是否还存在
        const curV = currentVideo();
        if (!curV || !Data.videoById(curV.id)) { open(mode); return; }
        const newList = buildSeriesList(mode);
        const newIdx = newList.findIndex((x) => x.seriesId === cur.seriesId);
        if (newIdx < 0) { open(mode); return; }
        // 更新系列内视频索引
        const vi = seriesVideoIndex[cur.seriesId] || 0;
        const curVidId = curV.id;
        const newVi = newList[newIdx].videos.findIndex((v) => v.id === curVidId);
        seriesVideoIndex[cur.seriesId] = newVi >= 0 ? newVi : 0;
        if (newIdx !== index) {
          const cont = slidesEl();
          cont.classList.add('no-anim');
          seriesList = newList;
          index = newIdx;
          render();
          void cont.offsetHeight;
          cont.classList.remove('no-anim');
        } else {
          seriesList = newList;
        }
      }
      if (evt === 'imported') { open(mode); }
    });
  }

  function openComments(videoId) {
    commentVid = videoId;
    drawer().classList.add('open');
    renderComments();
    document.getElementById('cdText').focus();
  }

  function closeComments() {
    commentVid = null;
    drawer().classList.remove('open');
  }

  function renderComments() {
    const listEl = document.getElementById('cdList');
    const cs = Data.S.comments[commentVid] || [];
    document.getElementById('cdCount').textContent = cs.length ? `(${cs.length})` : '';
    if (!cs.length) {
      listEl.innerHTML = '<div class="empty in-panel"><p>还没有评论，来说第一句吧</p></div>';
      return;
    }
    listEl.innerHTML = cs.slice().reverse().map((c) => {
      const who = c.author || '游客';
      const letter = (who[0] || '客').toUpperCase();
      return `
      <div class="cd-item">
        <div class="avatar letter" style="width:34px;height:34px;background:#4ea6ff;font-size:14px">${esc(letter)}</div>
        <div class="cd-body">
          <div class="cd-name"><span>${esc(who)} · ${UI.fmtTime(c.createdAt)}</span></div>
          <div class="cd-text">${esc(c.text)}</div>
        </div>
        <span class="cd-del" data-cid="${c.id}">删除</span>
      </div>`;
    }).join('');
    listEl.querySelectorAll('.cd-del').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const ok = await UI.confirmDialog({ title: '删除评论', text: '确定删除这条评论吗？', okText: '删除', danger: true });
        if (ok) await Data.deleteComment(btn.dataset.cid);
      });
    });
  }

  async function openShare(v) {
    const link = location.href.split('#')[0] + '#v=' + v.id;
    const ext = (v.fileName.split('.').pop() || 'mp4').toLowerCase();
    const m = UI.modal(`
      <div class="modal-head">分享 <button class="icon-btn share-close">${icon('close', 18)}</button></div>
      <div class="modal-body">
        <div class="share-row">
          <input readonly value="${esc(link)}" id="shareLink">
          <button class="btn-primary" id="shareCopy">复制链接</button>
        </div>
        <div class="share-row">
          <button class="btn" id="shareSave" style="flex:1">${icon('download', 16)} 另存视频到电脑</button>
        </div>
        <p class="tip">链接在本机浏览器打开时会直接定位播放该视频；另存会把视频文件保存到浏览器默认下载位置。</p>
      </div>`);
    m.overlay.querySelector('.share-close').onclick = m.close;
    m.overlay.querySelector('#shareCopy').onclick = async () => {
      const ok = await UI.copyText(link);
      toast(ok ? '链接已复制' : '复制失败，请手动复制');
    };
    m.overlay.querySelector('#shareSave').onclick = () => {
      const a = document.createElement('a');
      const src = Data.getVideoSrc(v);
      a.href = src;
      a.download = (v.title || 'video') + '.' + ext;
      if (Data.isUrlVideo(v)) {
        a.target = '_blank';
        a.rel = 'noopener';
      }
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast(Data.isUrlVideo(v) ? '已在新窗口打开视频源' : '已开始保存视频');
    };
  }

  return {
    open, init, next, prev, togglePlay, currentVideoId, closeComments,
    currentSeriesId, currentSeries, currentSeriesItem, buildSeriesList,
    get mode() { return mode; }
  };
})();
