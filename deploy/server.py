import hashlib
import json
import os
import re
import secrets
import socket
import sqlite3
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs

ROOT = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(ROOT, 'data')
UPLOAD_DIR = os.path.join(DATA_DIR, 'uploads')
DB_PATH = os.path.join(DATA_DIR, 'moer.db')
PORT = int(os.environ.get('PORT') or os.environ.get('MOER_PORT', '8787'))
MAX_UPLOAD = int(os.environ.get('MOER_MAX_UPLOAD_MB', '500')) * 1024 * 1024
ALLOWED_EXT = {'mp4', 'webm', 'm4v', 'mov', 'mkv'}
CATEGORIES = {'hanlu', 'faya', 'bacui', 'chumang', 'guoxiang'}

os.makedirs(UPLOAD_DIR, exist_ok=True)

conn = sqlite3.connect(DB_PATH, check_same_thread=False)
conn.row_factory = sqlite3.Row
db_lock = __import__('threading').Lock()


def q(sql, args=(), fetch=False):
    with db_lock:
        cur = conn.execute(sql, args)
        if fetch:
            return [dict(r) for r in cur.fetchall()]
        conn.commit()
        return cur.lastrowid


def init_db():
    q('''CREATE TABLE IF NOT EXISTS users(
        id TEXT PRIMARY KEY, username TEXT UNIQUE NOT NULL, email TEXT DEFAULT '',
        pw_hash TEXT NOT NULL, salt TEXT NOT NULL, role TEXT DEFAULT 'user',
        vip_expire REAL DEFAULT 0, created_at REAL NOT NULL)''')
    q('''CREATE TABLE IF NOT EXISTS tokens(
        token TEXT PRIMARY KEY, user_id TEXT NOT NULL, created_at REAL NOT NULL)''')
    q('''CREATE TABLE IF NOT EXISTS submissions(
        id TEXT PRIMARY KEY, user_id TEXT NOT NULL, title TEXT NOT NULL,
        description TEXT DEFAULT '', category_id TEXT NOT NULL,
        orig_name TEXT, stored_name TEXT UNIQUE, size INTEGER DEFAULT 0, mime TEXT,
        status TEXT DEFAULT 'pending', reward REAL, reject_reason TEXT DEFAULT '',
        paid INTEGER DEFAULT 0, created_at REAL NOT NULL, reviewed_at REAL)''')
    q('''CREATE TABLE IF NOT EXISTS published_series(
        id TEXT PRIMARY KEY, name TEXT UNIQUE NOT NULL, created_at REAL NOT NULL)''')
    q('''CREATE TABLE IF NOT EXISTS published_videos(
        id TEXT PRIMARY KEY, submission_id TEXT, title TEXT NOT NULL,
        description TEXT DEFAULT '', category_id TEXT NOT NULL, series_id TEXT,
        url TEXT NOT NULL, size INTEGER DEFAULT 0, added_at REAL NOT NULL)''')
    q('''CREATE TABLE IF NOT EXISTS kv(key TEXT PRIMARY KEY, value TEXT)''')
    q('''CREATE TABLE IF NOT EXISTS interactions(
        user_id TEXT NOT NULL, video_id TEXT NOT NULL,
        liked INTEGER DEFAULT 0, favored INTEGER DEFAULT 0, watch_later INTEGER DEFAULT 0,
        watch_count INTEGER DEFAULT 0, last_watched_at REAL DEFAULT 0,
        progress REAL DEFAULT 0, duration REAL DEFAULT 0,
        PRIMARY KEY(user_id, video_id))''')
    q('''CREATE TABLE IF NOT EXISTS comments(
        id TEXT PRIMARY KEY, user_id TEXT NOT NULL, video_id TEXT NOT NULL,
        text TEXT, author TEXT DEFAULT '', created_at REAL NOT NULL)''')
    q('''CREATE TABLE IF NOT EXISTS products(
        id TEXT PRIMARY KEY, name TEXT NOT NULL, price REAL DEFAULT 0,
        image TEXT DEFAULT '', description TEXT DEFAULT '',
        taobao_url TEXT DEFAULT '', category TEXT DEFAULT '',
        is_published INTEGER DEFAULT 1, sort_order INTEGER DEFAULT 0,
        created_at REAL NOT NULL, updated_at REAL NOT NULL)''')
    q('''CREATE TABLE IF NOT EXISTS ads(
        id TEXT PRIMARY KEY, title TEXT NOT NULL,
        video_url TEXT DEFAULT '', image_url TEXT DEFAULT '',
        link_url TEXT DEFAULT '', duration INTEGER DEFAULT 5,
        is_active INTEGER DEFAULT 1, sort_order INTEGER DEFAULT 0,
        created_at REAL NOT NULL)''')
    try:
        q('ALTER TABLE comments ADD COLUMN author TEXT DEFAULT \'\'')
    except Exception:
        pass
    try:
        q('ALTER TABLE users ADD COLUMN vip_expire REAL DEFAULT 0')
    except Exception:
        pass
    try:
        q('ALTER TABLE published_videos ADD COLUMN pre_ad_id TEXT DEFAULT \'\'')
    except Exception:
        pass
    try:
        q('ALTER TABLE published_videos ADD COLUMN mid_ad_id TEXT DEFAULT \'\'')
    except Exception:
        pass
    try:
        q('ALTER TABLE published_videos ADD COLUMN post_ad_id TEXT DEFAULT \'\'')
    except Exception:
        pass
    try:
        q('ALTER TABLE published_videos ADD COLUMN vip_only INTEGER DEFAULT 0')
    except Exception:
        pass


def hash_pw(pw, salt):
    return hashlib.pbkdf2_hmac('sha256', pw.encode('utf-8'), bytes.fromhex(salt), 100000).hex()


def create_user(username, password, email='', role='user'):
    uid = 'u_' + secrets.token_hex(8)
    salt = secrets.token_hex(16)
    q('INSERT INTO users(id,username,email,pw_hash,salt,role,created_at) VALUES(?,?,?,?,?,?,?)',
      (uid, username, email, hash_pw(password, salt), salt, role, __import__('time').time()))
    return uid


def ensure_admin():
    rows = q('SELECT COUNT(*) AS c FROM users', fetch=True)
    if rows[0]['c'] == 0:
        pw = os.environ.get('MOER_ADMIN_PW', 'moer123456')
        create_user('admin', pw, '', 'admin')
        return pw
    return None


def user_from_request(h):
    auth = h.headers.get('Authorization', '')
    m = re.match(r'^Bearer\s+(.+)$', auth)
    if not m:
        return None
    rows = q('''SELECT u.id,u.username,u.email,u.role FROM tokens t
                JOIN users u ON u.id=t.user_id WHERE t.token=?''', (m.group(1),), fetch=True)
    return rows[0] if rows else None


def new_token(uid):
    tok = secrets.token_hex(32)
    q('INSERT INTO tokens(token,user_id,created_at) VALUES(?,?,?)',
      (tok, uid, __import__('time').time()))
    return tok


class UploadTooLarge(Exception):
    pass


class Handler(BaseHTTPRequestHandler):
    protocol_version = 'HTTP/1.1'
    server_version = 'MoerServer/4.4'

    def log_message(self, fmt, *args):
        sys.stdout.write('[%s] %s\n' % (self.log_date_time_string(), fmt % args))

    def send_json(self, obj, status=200):
        body = json.dumps(obj, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(body)

    def send_text(self, msg, status=200):
        body = msg.encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'text/plain; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def read_json_body(self, limit=1024 * 1024):
        length = int(self.headers.get('Content-Length') or 0)
        if length > limit:
            raise ValueError('请求体过大')
        raw = self.rfile.read(length) if length else b''
        return json.loads(raw.decode('utf-8')) if raw else {}

    def read_all(self, length):
        chunks = []
        got = 0
        while got < length:
            chunk = self.rfile.read(min(262144, length - got))
            if not chunk:
                break
            chunks.append(chunk)
            got += len(chunk)
        return b''.join(chunks)

    def parse_multipart(self, max_size):
        ctype = self.headers.get('Content-Type', '')
        m = re.search(r'boundary=(?:"([^"]+)"|([^;]+))', ctype)
        if not m:
            raise ValueError('缺少 multipart boundary')
        boundary = (m.group(1) or m.group(2)).strip().strip('"').encode('utf-8')
        delim = b'--' + boundary
        tail = b'\r\n' + delim
        st = {'remaining': int(self.headers.get('Content-Length') or 0), 'pending': b''}

        def fill(n):
            chunk = self.rfile.read(min(n, st['remaining']))
            if chunk:
                st['remaining'] -= len(chunk)
                st['pending'] += chunk
            return chunk

        def readline():
            while True:
                i = st['pending'].find(b'\r\n')
                if i != -1:
                    line = st['pending'][:i + 2]
                    st['pending'] = st['pending'][i + 2:]
                    return line
                if st['remaining'] <= 0:
                    line = st['pending']
                    st['pending'] = b''
                    return line
                if not fill(65536):
                    line = st['pending']
                    st['pending'] = b''
                    return line

        def read_until_tail(write, total_cap):
            buf = bytearray(st['pending'])
            st['pending'] = b''
            state = {'n': 0}

            def sink(data):
                if not data:
                    return
                if total_cap:
                    state['n'] += len(data)
                    if state['n'] > total_cap:
                        raise UploadTooLarge()
                write(data)

            while True:
                i = buf.find(tail)
                if i != -1:
                    out = bytes(buf[:i])
                    left = bytes(buf[i + len(tail):])
                    del buf[:]
                    sink(out)
                    return b'', left, True
                keep = len(tail) - 1
                if len(buf) > keep:
                    sink(bytes(buf[:-keep]))
                    del buf[:-keep]
                if st['remaining'] <= 0:
                    out = bytes(buf)
                    del buf[:]
                    sink(out)
                    return b'', b'', False
                if not fill(262144):
                    out = bytes(buf)
                    del buf[:]
                    sink(out)
                    return b'', b'', False
                buf += st['pending']
                st['pending'] = b''

        first = readline()
        if not first.startswith(delim):
            raise ValueError('multipart 格式错误')
        fields = {}
        files = {}
        while True:
            headers = {}
            while True:
                line = readline()
                if line in (b'\r\n', b'', b'\n'):
                    break
                if b':' in line:
                    k, v = line.split(b':', 1)
                    headers[k.decode('latin1').strip().lower()] = v.decode('latin1').strip()
            disp = headers.get('content-disposition', '')
            nm = re.search(r'name="([^"]*)"', disp)
            fm = re.search(r'filename="([^"]*)"', disp)
            name = nm.group(1) if nm else ''
            if fm is not None:
                orig = os.path.basename(fm.group(1).replace('\\', '/'))
                tmp = os.path.join(UPLOAD_DIR, '.tmp_' + secrets.token_hex(8))
                with open(tmp, 'wb') as fh:
                    _, left, done = read_until_tail(fh.write, MAX_UPLOAD)
                files[name] = {'orig_name': orig, 'tmp_path': tmp}
            else:
                chunks = []
                _, left, done = read_until_tail(chunks.append, 0)
                fields[name] = b''.join(chunks).decode('utf-8', 'replace')
            if left.startswith(b'--'):
                break
            if left.startswith(b'\r\n'):
                st['pending'] = left[2:]
            else:
                st['pending'] = left
            if not done:
                break
        return fields, files

    def do_GET(self):
        self.route('GET')

    def do_HEAD(self):
        self.route('HEAD')

    def do_POST(self):
        self.route('POST')

    def route(self, method):
        try:
            p = urlparse(self.path)
            path = p.path
            if path.startswith('/api/'):
                self.handle_api(method, path, parse_qs(p.query))
            elif path.startswith('/media/'):
                self.serve_media(method, path[len('/media/'):])
            else:
                self.serve_static(method, path)
        except (BrokenPipeError, ConnectionResetError):
            pass
        except Exception as e:
            try:
                self.send_json({'error': str(e)}, 500)
            except Exception:
                pass

    STATIC_MAP = {
        '/': ('index.html', 'text/html; charset=utf-8'),
        '/index.html': ('index.html', 'text/html; charset=utf-8'),
        '/manifest.json': ('manifest.json', 'application/json'),
        '/sw.js': ('sw.js', 'application/javascript'),
    }
    STATIC_DIRS = {
        '/css/': ('css', {
            '.css': 'text/css; charset=utf-8',
            '.map': 'application/json',
        }),
        '/js/': ('js', {
            '.js': 'application/javascript',
            '.map': 'application/json',
        }),
        '/icons/': ('icons', {
            '.png': 'image/png',
            '.svg': 'image/svg+xml',
            '.ico': 'image/x-icon',
        }),
    }

    def serve_static(self, method, path):
        if path in self.STATIC_MAP:
            fp = os.path.join(ROOT, self.STATIC_MAP[path][0])
            ct = self.STATIC_MAP[path][1]
            return self.stream_file(method, fp, ct)
        for prefix, (d, exts) in self.STATIC_DIRS.items():
            if path.startswith(prefix):
                rel = path[len(prefix):]
                if '..' in rel or rel.startswith('/'):
                    break
                fp = os.path.join(ROOT, d, rel)
                ext = os.path.splitext(fp)[1].lower()
                if ext not in exts or not os.path.isfile(fp):
                    break
                return self.stream_file(method, fp, exts[ext])
        self.send_json({'error': 'not found'}, 404)

    def stream_file(self, method, fp, ct, range_header=None):
        size = os.path.getsize(fp)
        start, end = 0, size - 1
        status = 200
        if range_header:
            m = re.match(r'bytes=(\d*)-(\d*)$', range_header.strip())
            if m:
                if m.group(1):
                    start = int(m.group(1))
                    if m.group(2):
                        end = min(int(m.group(2)), size - 1)
                elif m.group(2):
                    start = max(0, size - int(m.group(2)))
                if start > end or start >= size:
                    self.send_response(416)
                    self.send_header('Content-Range', 'bytes */%d' % size)
                    self.send_header('Content-Length', '0')
                    self.end_headers()
                    return
                status = 206
        clen = end - start + 1
        self.send_response(status)
        self.send_header('Content-Type', ct)
        self.send_header('Accept-Ranges', 'bytes')
        self.send_header('Content-Length', str(clen))
        if status == 206:
            self.send_header('Content-Range', 'bytes %d-%d/%d' % (start, end, size))
        self.end_headers()
        if method == 'HEAD':
            return
        with open(fp, 'rb') as f:
            f.seek(start)
            left = clen
            while left > 0:
                chunk = f.read(min(262144, left))
                if not chunk:
                    break
                self.wfile.write(chunk)
                left -= len(chunk)

    def serve_media(self, method, stored):
        if not re.match(r'^[a-f0-9]{32}\.[a-z0-9]{2,5}$', stored):
            return self.send_json({'error': 'bad media id'}, 404)
        fp = os.path.join(UPLOAD_DIR, stored)
        if not os.path.isfile(fp):
            return self.send_json({'error': 'not found'}, 404)
        ext = os.path.splitext(stored)[1]
        MIME = {'.mp4': 'video/mp4', '.m4v': 'video/mp4', '.webm': 'video/webm',
                '.mov': 'video/quicktime', '.mkv': 'video/x-matroska'}
        self.stream_file(method, fp, MIME.get(ext, 'application/octet-stream'),
                         self.headers.get('Range'))

    def handle_api(self, method, path, qs):
        if method == 'POST':
            return self.handle_api_post(path)
        if method != 'GET':
            return self.send_text('method not allowed', 405)

        if path == '/api/health':
            return self.send_json({'ok': True})

        if path == '/api/library':
            series = q('SELECT id,name,created_at AS createdAt FROM published_series ORDER BY created_at', (), True)
            videos = q('''SELECT id,title,description,category_id AS categoryId,
                          series_id AS seriesId,url,size,added_at AS addedAt,
                          pre_ad_id AS preAdId, mid_ad_id AS midAdId, post_ad_id AS postAdId,
                          vip_only AS vipOnly
                          FROM published_videos ORDER BY added_at DESC''', (), True)
            return self.send_json({'series': series, 'videos': videos})

        user = user_from_request(self)
        if not user:
            return self.send_text('请先登录', 401)

        if path == '/api/me':
            uid = user['id']
            stats = q('''SELECT COUNT(*) AS submitted,
                         SUM(CASE WHEN status='approved' THEN 1 ELSE 0 END) AS approved,
                         IFNULL(SUM(CASE WHEN status='approved' AND paid=0 THEN reward ELSE 0 END),0) AS pendingEarn,
                         IFNULL(SUM(CASE WHEN paid=1 THEN reward ELSE 0 END),0) AS paidEarn
                         FROM submissions WHERE user_id=?''', (uid,), True)[0]
            urow = q('SELECT vip_expire FROM users WHERE id=?', (uid,), True)
            vip_expire = urow[0]['vip_expire'] if urow else 0
            return self.send_json({'user': {**user, 'vipExpire': vip_expire or 0}, 'stats': stats})

        if path == '/api/submissions/mine':
            rows = q('''SELECT id,title,description,category_id AS categoryId,size,status,
                        reward,reject_reason AS rejectReason,paid,created_at AS createdAt
                        FROM submissions WHERE user_id=? ORDER BY created_at DESC''',
                     (user['id'],), True)
            return self.send_json({'submissions': rows})

        if path == '/api/sync/download':
            rows = q('SELECT value FROM kv WHERE key=?', ('sync:' + user['id'],), True)
            return self.send_json({'data': json.loads(rows[0]['value']) if rows else None})

        if path == '/api/interactions/download':
            inter = q('''SELECT video_id AS videoId, liked, favored, watch_later AS watchLater,
                         watch_count AS watchCount, last_watched_at AS lastWatchedAt,
                         progress, duration FROM interactions WHERE user_id=?''', (user['id'],), True)
            cmts = q('''SELECT id, video_id AS videoId, text, author, created_at AS createdAt
                        FROM comments WHERE user_id=? ORDER BY created_at''', (user['id'],), True)
            return self.send_json({'interactions': inter, 'comments': cmts})

        if path == '/api/admin/submissions':
            if user['role'] != 'admin':
                return self.send_text('需要管理员权限', 403)
            status = (qs.get('status') or ['all'])[0]
            cond = ''
            args = ()
            if status in ('pending', 'approved', 'rejected'):
                cond = 'WHERE s.status=?'
                args = (status,)
            rows = q('''SELECT s.*, COALESCE(u.username,'已注销') AS uploader FROM submissions s
                        LEFT JOIN users u ON u.id=s.user_id %s ORDER BY s.created_at DESC''' % cond,
                     args, True)
            return self.send_json({'submissions': rows})

        if path == '/api/admin/users':
            if user['role'] != 'admin':
                return self.send_text('需要管理员权限', 403)
            rows = q('''SELECT u.id, u.username, u.email, u.role, u.vip_expire AS vipExpire, u.created_at AS createdAt,
                        (SELECT COUNT(*) FROM submissions s WHERE s.user_id=u.id) AS submitted,
                        (SELECT COUNT(*) FROM submissions s WHERE s.user_id=u.id AND s.status='approved') AS approved
                        FROM users u ORDER BY u.created_at''', (), True)
            return self.send_json({'users': rows})

        if path == '/api/shop':
            rows = q('''SELECT id,name,price,image,description,taobao_url AS taobaoUrl,
                        category,sort_order AS sortOrder,created_at AS createdAt
                        FROM products WHERE is_published=1 ORDER BY sort_order, created_at DESC''', (), True)
            return self.send_json({'products': rows})

        if path == '/api/admin/products':
            if user['role'] != 'admin':
                return self.send_text('需要管理员权限', 403)
            rows = q('''SELECT id,name,price,image,description,taobao_url AS taobaoUrl,
                        category,is_published AS isPublished,sort_order AS sortOrder,
                        created_at AS createdAt,updated_at AS updatedAt
                        FROM products ORDER BY sort_order, created_at DESC''', (), True)
            return self.send_json({'products': rows})

        if path == '/api/admin/ads':
            if user['role'] != 'admin':
                return self.send_text('需要管理员权限', 403)
            rows = q('''SELECT id,title,video_url AS videoUrl,image_url AS imageUrl,
                        link_url AS linkUrl,duration,is_active AS isActive,
                        sort_order AS sortOrder,created_at AS createdAt
                        FROM ads ORDER BY sort_order, created_at DESC''', (), True)
            return self.send_json({'ads': rows})

        if path == '/api/admin/published-videos':
            if user['role'] != 'admin':
                return self.send_text('需要管理员权限', 403)
            rows = q('''SELECT pv.id,pv.title,pv.category_id AS categoryId,
                        pv.series_id AS seriesId,pv.url,pv.size,pv.added_at AS addedAt,
                        pv.pre_ad_id AS preAdId,pv.mid_ad_id AS midAdId,pv.post_ad_id AS postAdId,
                        pv.vip_only AS vipOnly,
                        COALESCE(ps.name,'') AS seriesName
                        FROM published_videos pv
                        LEFT JOIN published_series ps ON ps.id=pv.series_id
                        ORDER BY pv.added_at DESC''', (), True)
            return self.send_json({'videos': rows})

        return self.send_json({'error': 'not found'}, 404)

    def handle_api_post(self, path):
        if path == '/api/auth/register':
            body = self.read_json_body()
            username = str(body.get('username', '')).strip()
            password = str(body.get('password', ''))
            email = str(body.get('email', '')).strip()
            if len(username) < 2:
                return self.send_text('用户名至少2位', 400)
            if len(password) < 6:
                return self.send_text('密码至少6位', 400)
            dup = q('SELECT id FROM users WHERE username=?', (username,), True)
            if dup:
                return self.send_text('用户名已存在', 409)
            uid = create_user(username, password, email)
            tok = new_token(uid)
            return self.send_json({'user': {'id': uid, 'username': username, 'email': email, 'role': 'user', 'vipExpire': 0}, 'token': tok})

        if path == '/api/auth/login':
            body = self.read_json_body()
            username = str(body.get('username', '')).strip()
            password = str(body.get('password', ''))
            rows = q('SELECT * FROM users WHERE username=?', (username,), True)
            if not rows or hash_pw(password, rows[0]['salt']) != rows[0]['pw_hash']:
                return self.send_text('用户名或密码错误', 401)
            u = rows[0]
            tok = new_token(u['id'])
            return self.send_json({'user': {'id': u['id'], 'username': u['username'],
                                            'email': u['email'], 'role': u['role'],
                                            'vipExpire': u.get('vip_expire') or 0}, 'token': tok})

        if path == '/api/auth/logout':
            user = user_from_request(self)
            if user:
                auth = self.headers.get('Authorization', '')
                tok = re.sub(r'^Bearer\s+', '', auth)
                q('DELETE FROM tokens WHERE token=?', (tok,))
            return self.send_json({'ok': True})

        if path == '/api/auth/change-password':
            user = user_from_request(self)
            if not user:
                return self.send_text('请先登录', 401)
            body = self.read_json_body()
            old_pw = str(body.get('oldPassword', ''))
            new_pw = str(body.get('newPassword', ''))
            rows = q('SELECT * FROM users WHERE id=?', (user['id'],), True)
            if not rows or hash_pw(old_pw, rows[0]['salt']) != rows[0]['pw_hash']:
                return self.send_text('旧密码错误', 400)
            if len(new_pw) < 6:
                return self.send_text('新密码至少6位', 400)
            salt = secrets.token_hex(16)
            q('UPDATE users SET pw_hash=?, salt=? WHERE id=?',
              (hash_pw(new_pw, salt), salt, user['id']))
            return self.send_json({'ok': True})

        user = user_from_request(self)
        if not user:
            return self.send_text('请先登录', 401)

        if path == '/api/submissions':
            ctype = self.headers.get('Content-Type', '')
            if 'multipart/form-data' not in ctype:
                return self.send_text('请使用 multipart 上传', 400)
            length = int(self.headers.get('Content-Length') or 0)
            if length > MAX_UPLOAD + 1024 * 1024:
                return self.send_text('文件过大，最大 %dMB' % (MAX_UPLOAD // 1048576), 413)
            fields, files = self.parse_multipart(MAX_UPLOAD)
            title = fields.get('title', '').strip()[:60]
            desc = fields.get('description', '').strip()[:200]
            cat = fields.get('categoryId', '').strip()
            finfo = files.get('file')
            if not finfo:
                return self.send_text('缺少视频文件', 400)
            if fields.get('original', '') != '1':
                return self.send_text('请先勾选原创声明', 400)
            if not title:
                title = os.path.splitext(finfo['orig_name'])[0][:60] or '未命名投稿'
            if cat not in CATEGORIES:
                return self.send_text('栏目不正确', 400)
            ext = os.path.splitext(finfo['orig_name'])[1].lower().lstrip('.')
            if ext not in ALLOWED_EXT:
                return self.send_text('仅支持 ' + '/'.join(sorted(ALLOWED_EXT)), 400)
            stored = secrets.token_hex(16) + '.' + ext
            target = os.path.join(UPLOAD_DIR, stored)
            os.replace(finfo['tmp_path'], target)
            size = os.path.getsize(target)
            sid = 'sb_' + secrets.token_hex(8)
            import time
            q('''INSERT INTO submissions(id,user_id,title,description,category_id,
                  orig_name,stored_name,size,mime,status,created_at)
                  VALUES(?,?,?,?,?,?,?,?,?, 'pending', ?)''',
              (sid, user['id'], title, desc, cat, finfo['orig_name'], stored, size,
               'video/' + ext, time.time()))
            return self.send_json({'ok': True, 'submission': {
                'id': sid, 'title': title, 'status': 'pending'}})

        if path == '/api/sync/upload':
            body = self.read_json_body(limit=8 * 1024 * 1024)
            q('''INSERT INTO kv(key,value) VALUES(?,?)
                 ON CONFLICT(key) DO UPDATE SET value=excluded.value''',
              ('sync:' + user['id'], json.dumps(body, ensure_ascii=False)))
            return self.send_json({'ok': True})

        if path == '/api/interactions/upload':
            body = self.read_json_body(limit=16 * 1024 * 1024)
            uid = user['id']
            inter = body.get('interactions') or []
            cmts = body.get('comments') or []
            with db_lock:
                for it in inter:
                    conn.execute('''INSERT OR REPLACE INTO interactions
                        (user_id,video_id,liked,favored,watch_later,watch_count,last_watched_at,progress,duration)
                        VALUES(?,?,?,?,?,?,?,?,?)''',
                        (uid, str(it.get('videoId', '')), 1 if it.get('liked') else 0,
                         1 if it.get('favored') else 0, 1 if it.get('watchLater') else 0,
                         int(it.get('watchCount') or 0), float(it.get('lastWatchedAt') or 0),
                         float(it.get('progress') or 0), float(it.get('duration') or 0)))
                for c in cmts:
                    conn.execute('''INSERT OR REPLACE INTO comments(id,user_id,video_id,text,author,created_at)
                        VALUES(?,?,?,?,?,?)''',
                        (str(c.get('id', '')), uid, str(c.get('videoId', '')),
                         str(c.get('text', '')), str(c.get('author', '') or user['username']),
                         float(c.get('createdAt') or 0)))
                conn.commit()
            return self.send_json({'ok': True, 'interactions': len(inter), 'comments': len(cmts)})

        m = re.match(r'^/api/admin/submissions/([A-Za-z0-9_-]+)/(approve|reject|pay)$', path)
        if m:
            if user['role'] != 'admin':
                return self.send_text('需要管理员权限', 403)
            sid, action = m.group(1), m.group(2)
            rows = q('SELECT * FROM submissions WHERE id=?', (sid,), True)
            if not rows:
                return self.send_text('投稿不存在', 404)
            sub = rows[0]
            import time
            if action == 'approve':
                if sub['status'] != 'pending':
                    return self.send_text('该投稿已处理过', 400)
                body = self.read_json_body()
                cat = str(body.get('categoryId', '')).strip()
                if cat not in CATEGORIES:
                    return self.send_text('栏目不正确', 400)
                try:
                    reward = round(float(body.get('reward') or 0), 2)
                except (TypeError, ValueError):
                    reward = 0.0
                if reward < 0:
                    reward = 0.0
                series_name = str(body.get('seriesName', '')).strip()[:30]
                series_id = None
                if series_name:
                    ex = q('SELECT id FROM published_series WHERE name=?', (series_name,), True)
                    if ex:
                        series_id = ex[0]['id']
                    else:
                        series_id = 'ps_' + secrets.token_hex(6)
                        q('INSERT INTO published_series(id,name,created_at) VALUES(?,?,?)',
                          (series_id, series_name, time.time()))
                vid = 'pv_' + secrets.token_hex(8)
                pre_ad = str(body.get('preAdId', '')).strip()
                mid_ad = str(body.get('midAdId', '')).strip()
                post_ad = str(body.get('postAdId', '')).strip()
                vip_only = 1 if body.get('vipOnly') else 0
                q('''INSERT INTO published_videos(id,submission_id,title,description,
                      category_id,series_id,url,size,added_at,pre_ad_id,mid_ad_id,post_ad_id,vip_only)
                      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)''',
                  (vid, sid, sub['title'], sub['description'], cat, series_id,
                   '/media/' + sub['stored_name'], sub['size'], time.time(),
                   pre_ad, mid_ad, post_ad, vip_only))
                q('''UPDATE submissions SET status='approved', reward=?, reviewed_at=?
                      WHERE id=?''', (reward, time.time(), sid))
                return self.send_json({'ok': True})
            if action == 'reject':
                if sub['status'] != 'pending':
                    return self.send_text('该投稿已处理过', 400)
                body = self.read_json_body()
                reason = str(body.get('reason', '')).strip()[:100]
                q('''UPDATE submissions SET status='rejected', reject_reason=?,
                      reviewed_at=? WHERE id=?''', (reason, time.time(), sid))
                return self.send_json({'ok': True})
            if action == 'pay':
                if sub['status'] != 'approved':
                    return self.send_text('仅已通过的投稿可结算', 400)
                if sub['paid']:
                    return self.send_text('已结算过', 400)
                q('UPDATE submissions SET paid=1 WHERE id=?', (sid,))
                return self.send_json({'ok': True})

        m = re.match(r'^/api/admin/users/([A-Za-z0-9_-]+)/role$', path)
        if m and user['role'] == 'admin':
            tid = m.group(1)
            body = self.read_json_body()
            role = str(body.get('role', '')).strip()
            target = q('SELECT * FROM users WHERE id=?', (tid,), True)
            if not target:
                return self.send_text('用户不存在', 404)
            if role not in ('admin', 'user'):
                return self.send_text('角色不正确', 400)
            if target[0]['id'] == user['id'] and role != 'admin':
                return self.send_text('不能降级自己', 400)
            if target[0]['role'] == 'admin' and role != 'admin':
                admins = q("SELECT COUNT(*) AS n FROM users WHERE role='admin'", (), True)
                if (admins[0]['n'] or 0) <= 1:
                    return self.send_text('至少保留一名管理员', 400)
            q('UPDATE users SET role=? WHERE id=?', (role, tid))
            return self.send_json({'ok': True})
        if m:
            return self.send_text('需要管理员权限', 403)

        m = re.match(r'^/api/admin/users/([A-Za-z0-9_-]+)/vip$', path)
        if m and user['role'] == 'admin':
            tid = m.group(1)
            body = self.read_json_body()
            days = int(body.get('days') or 0)
            target = q('SELECT * FROM users WHERE id=?', (tid,), True)
            if not target:
                return self.send_text('用户不存在', 404)
            import time
            now = time.time()
            current_expire = target[0].get('vip_expire') or 0
            if days > 0:
                base = max(now, current_expire)
                new_expire = base + days * 86400
            else:
                new_expire = 0
            q('UPDATE users SET vip_expire=? WHERE id=?', (new_expire, tid))
            return self.send_json({'ok': True, 'vipExpire': new_expire})
        if m:
            return self.send_text('需要管理员权限', 403)

        m = re.match(r'^/api/admin/users/([A-Za-z0-9_-]+)/delete$', path)
        if m and user['role'] == 'admin':
            tid = m.group(1)
            target = q('SELECT * FROM users WHERE id=?', (tid,), True)
            if not target:
                return self.send_text('用户不存在', 404)
            if target[0]['id'] == user['id']:
                return self.send_text('不能删除自己', 400)
            if target[0]['role'] == 'admin':
                admins = q("SELECT COUNT(*) AS n FROM users WHERE role='admin'", (), True)
                if (admins[0]['n'] or 0) <= 1:
                    return self.send_text('至少保留一名管理员', 400)
            q('DELETE FROM comments WHERE user_id=?', (tid,))
            q('DELETE FROM interactions WHERE user_id=?', (tid,))
            q('DELETE FROM tokens WHERE user_id=?', (tid,))
            q('DELETE FROM submissions WHERE user_id=?', (tid,))
            q('DELETE FROM users WHERE id=?', (tid,))
            return self.send_json({'ok': True})
        if m:
            return self.send_text('需要管理员权限', 403)

        if path == '/api/admin/products' and user['role'] == 'admin':
            body = self.read_json_body()
            name = str(body.get('name', '')).strip()[:60]
            if not name:
                return self.send_text('商品名称不能为空', 400)
            try:
                price = round(float(body.get('price') or 0), 2)
            except (TypeError, ValueError):
                price = 0.0
            image = str(body.get('image', '')).strip()[:500]
            description = str(body.get('description', '')).strip()[:500]
            taobao_url = str(body.get('taobaoUrl', '')).strip()[:500]
            category = str(body.get('category', '')).strip()[:30]
            is_published = 1 if body.get('isPublished', True) else 0
            sort_order = int(body.get('sortOrder') or 0)
            import time
            now = time.time()
            pid = 'pd_' + secrets.token_hex(8)
            q('''INSERT INTO products(id,name,price,image,description,taobao_url,category,
                  is_published,sort_order,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)''',
              (pid, name, price, image, description, taobao_url, category,
               is_published, sort_order, now, now))
            return self.send_json({'ok': True, 'id': pid})

        m = re.match(r'^/api/admin/products/([A-Za-z0-9_-]+)$', path)
        if m and user['role'] == 'admin':
            pid = m.group(1)
            existing = q('SELECT * FROM products WHERE id=?', (pid,), True)
            if not existing:
                return self.send_text('商品不存在', 404)
            body = self.read_json_body()
            name = str(body.get('name', '')).strip()[:60]
            if not name:
                return self.send_text('商品名称不能为空', 400)
            try:
                price = round(float(body.get('price') or 0), 2)
            except (TypeError, ValueError):
                price = 0.0
            image = str(body.get('image', '')).strip()[:500]
            description = str(body.get('description', '')).strip()[:500]
            taobao_url = str(body.get('taobaoUrl', '')).strip()[:500]
            category = str(body.get('category', '')).strip()[:30]
            is_published = 1 if body.get('isPublished', True) else 0
            sort_order = int(body.get('sortOrder') or 0)
            import time
            q('''UPDATE products SET name=?,price=?,image=?,description=?,taobao_url=?,
                  category=?,is_published=?,sort_order=?,updated_at=? WHERE id=?''',
              (name, price, image, description, taobao_url, category,
               is_published, sort_order, time.time(), pid))
            return self.send_json({'ok': True})
        if m:
            return self.send_text('需要管理员权限', 403)

        m = re.match(r'^/api/admin/products/([A-Za-z0-9_-]+)/delete$', path)
        if m and user['role'] == 'admin':
            pid = m.group(1)
            existing = q('SELECT * FROM products WHERE id=?', (pid,), True)
            if not existing:
                return self.send_text('商品不存在', 404)
            q('DELETE FROM products WHERE id=?', (pid,))
            return self.send_json({'ok': True})
        if m:
            return self.send_text('需要管理员权限', 403)

        if path == '/api/admin/publish-video' and user['role'] == 'admin':
            import time as _time
            body = self.read_json_body()
            url = str(body.get('url', '')).strip()
            if not url:
                return self.send_text('视频链接不能为空', 400)
            title = str(body.get('title', '')).strip()[:60] or '未命名视频'
            description = str(body.get('description', '')).strip()[:200]
            cat = str(body.get('categoryId', '')).strip()
            if cat not in CATEGORIES:
                return self.send_text('栏目不正确', 400)
            series_name = str(body.get('seriesName', '')).strip()[:30]
            series_id = None
            if series_name:
                ex = q('SELECT id FROM published_series WHERE name=?', (series_name,), True)
                if ex:
                    series_id = ex[0]['id']
                else:
                    series_id = 'ps_' + secrets.token_hex(6)
                    q('INSERT INTO published_series(id,name,created_at) VALUES(?,?,?)',
                      (series_id, series_name, _time.time()))
            pre_ad = str(body.get('preAdId', '')).strip()
            mid_ad = str(body.get('midAdId', '')).strip()
            post_ad = str(body.get('postAdId', '')).strip()
            vip_only = 1 if body.get('vipOnly') else 0
            vid = 'pv_' + secrets.token_hex(8)
            q('''INSERT INTO published_videos(id,title,description,category_id,series_id,
                  url,size,added_at,pre_ad_id,mid_ad_id,post_ad_id,vip_only)
                  VALUES(?,?,?,?,?,?,?,?,?,?,?,?)''',
              (vid, title, description, cat, series_id, url, 0, _time.time(),
               pre_ad, mid_ad, post_ad, vip_only))
            return self.send_json({'ok': True, 'id': vid})

        m = re.match(r'^/api/admin/published-videos/([A-Za-z0-9_-]+)/delete$', path)
        if m and user['role'] == 'admin':
            vid = m.group(1)
            existing = q('SELECT id FROM published_videos WHERE id=?', (vid,), True)
            if not existing:
                return self.send_text('视频不存在', 404)
            q('DELETE FROM published_videos WHERE id=?', (vid,))
            return self.send_json({'ok': True})
        if m:
            return self.send_text('需要管理员权限', 403)

        m = re.match(r'^/api/admin/published-videos/([A-Za-z0-9_-]+)/ads$', path)
        if m and user['role'] == 'admin':
            vid = m.group(1)
            existing = q('SELECT id FROM published_videos WHERE id=?', (vid,), True)
            if not existing:
                return self.send_text('视频不存在', 404)
            body = self.read_json_body()
            pre_ad = str(body.get('preAdId', '')).strip()
            mid_ad = str(body.get('midAdId', '')).strip()
            post_ad = str(body.get('postAdId', '')).strip()
            q('UPDATE published_videos SET pre_ad_id=?,mid_ad_id=?,post_ad_id=? WHERE id=?',
              (pre_ad, mid_ad, post_ad, vid))
            return self.send_json({'ok': True})
        if m:
            return self.send_text('需要管理员权限', 403)

        if path == '/api/admin/ads' and user['role'] == 'admin':
            body = self.read_json_body()
            title = str(body.get('title', '')).strip()[:60]
            if not title:
                return self.send_text('广告标题不能为空', 400)
            video_url = str(body.get('videoUrl', '')).strip()[:500]
            image_url = str(body.get('imageUrl', '')).strip()[:500]
            link_url = str(body.get('linkUrl', '')).strip()[:500]
            duration = int(body.get('duration') or 5)
            is_active = 1 if body.get('isActive', True) else 0
            sort_order = int(body.get('sortOrder') or 0)
            import time
            now = time.time()
            aid = 'ad_' + secrets.token_hex(8)
            q('''INSERT INTO ads(id,title,video_url,image_url,link_url,duration,
                  is_active,sort_order,created_at) VALUES(?,?,?,?,?,?,?,?,?)''',
              (aid, title, video_url, image_url, link_url, duration, is_active, sort_order, now))
            return self.send_json({'ok': True, 'id': aid})

        m = re.match(r'^/api/admin/ads/([A-Za-z0-9_-]+)$', path)
        if m and user['role'] == 'admin':
            aid = m.group(1)
            existing = q('SELECT * FROM ads WHERE id=?', (aid,), True)
            if not existing:
                return self.send_text('广告不存在', 404)
            body = self.read_json_body()
            title = str(body.get('title', '')).strip()[:60]
            if not title:
                return self.send_text('广告标题不能为空', 400)
            video_url = str(body.get('videoUrl', '')).strip()[:500]
            image_url = str(body.get('imageUrl', '')).strip()[:500]
            link_url = str(body.get('linkUrl', '')).strip()[:500]
            duration = int(body.get('duration') or 5)
            is_active = 1 if body.get('isActive', True) else 0
            sort_order = int(body.get('sortOrder') or 0)
            import time
            q('''UPDATE ads SET title=?,video_url=?,image_url=?,link_url=?,duration=?,
                  is_active=?,sort_order=? WHERE id=?''',
              (title, video_url, image_url, link_url, duration, is_active, sort_order, aid))
            return self.send_json({'ok': True})
        if m:
            return self.send_text('需要管理员权限', 403)

        m = re.match(r'^/api/admin/ads/([A-Za-z0-9_-]+)/delete$', path)
        if m and user['role'] == 'admin':
            aid = m.group(1)
            existing = q('SELECT * FROM ads WHERE id=?', (aid,), True)
            if not existing:
                return self.send_text('广告不存在', 404)
            q('DELETE FROM ads WHERE id=?', (aid,))
            return self.send_json({'ok': True})
        if m:
            return self.send_text('需要管理员权限', 403)

        return self.send_json({'error': 'not found'}, 404)


def main():
    init_db()
    admin_pw = ensure_admin()
    ips = []
    try:
        for info in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET):
            ip = info[4][0]
            if ip != '127.0.0.1' and not ip.startswith('169.254.') and ip not in ips:
                ips.append(ip)
    except OSError:
        pass
    print('=' * 52)
    print('  魔耳 Magic Ear 本地服务器已启动')
    print('  本机访问:   http://localhost:%d' % PORT)
    for ip in ips:
        print('  手机/局域网: http://%s:%d' % (ip, PORT))
    if not ips:
        print('  局域网:     (未检测到局域网IP，请确认已连WiFi)')
    if admin_pw:
        print('  初始管理员: admin / %s （登录后请改密码）' % admin_pw)
    print('  数据目录:   %s' % DATA_DIR)
    print('  按 Ctrl+C 停止服务器')
    print('=' * 52)
    srv = None
    try:
        srv = ThreadingHTTPServer(('0.0.0.0', PORT), Handler)
    except OSError:
        print('=' * 52)
        print('  启动失败：端口 %d 已被占用！' % PORT)
        print('  通常是因为已经有一个魔耳服务器在运行。')
        print('  请检查任务栏/黑窗口是否已开着服务，')
        print('  或换个端口启动：set MOER_PORT=8788 后再运行。')
        print('=' * 52)
        sys.exit(1)
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        print('\n服务器已停止')


if __name__ == '__main__':
    main()
