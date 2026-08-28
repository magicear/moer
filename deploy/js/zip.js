const MZip = (() => {
  const CRC_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      t[n] = c;
    }
    return t;
  })();

  function crc32(u8) {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < u8.length; i++) c = CRC_TABLE[(c ^ u8[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  function dosDateTime(d) {
    return {
      time: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1),
      date: (((d.getFullYear() - 1980) & 0x7f) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()
    };
  }

  function create(entries) {
    const enc = new TextEncoder();
    const parts = [];
    const central = [];
    let offset = 0;
    const { time, date } = dosDateTime(new Date());
    for (const e of entries) {
      const name = enc.encode(e.name);
      const data = e.data;
      const crc = crc32(data);
      const lh = new Uint8Array(30 + name.length);
      const dv = new DataView(lh.buffer);
      dv.setUint32(0, 0x04034b50, true);
      dv.setUint16(4, 20, true);
      dv.setUint16(6, 0x0800, true);
      dv.setUint16(8, 0, true);
      dv.setUint16(10, time, true);
      dv.setUint16(12, date, true);
      dv.setUint32(14, crc, true);
      dv.setUint32(18, data.length, true);
      dv.setUint32(22, data.length, true);
      dv.setUint16(26, name.length, true);
      dv.setUint16(28, 0, true);
      lh.set(name, 30);
      parts.push(lh, data);
      const ch = new Uint8Array(46 + name.length);
      const cv = new DataView(ch.buffer);
      cv.setUint32(0, 0x02014b50, true);
      cv.setUint16(4, 20, true);
      cv.setUint16(6, 20, true);
      cv.setUint16(8, 0x0800, true);
      cv.setUint16(10, 0, true);
      cv.setUint16(12, time, true);
      cv.setUint16(14, date, true);
      cv.setUint32(16, crc, true);
      cv.setUint32(20, data.length, true);
      cv.setUint32(24, data.length, true);
      cv.setUint16(28, name.length, true);
      cv.setUint16(30, 0, true);
      cv.setUint16(32, 0, true);
      cv.setUint16(34, 0, true);
      cv.setUint16(36, 0, true);
      cv.setUint32(38, 0, true);
      cv.setUint32(42, offset, true);
      ch.set(name, 46);
      central.push(ch);
      offset += lh.length + data.length;
    }
    const cdStart = offset;
    let cdSize = 0;
    for (const c of central) { parts.push(c); cdSize += c.length; }
    const eocd = new Uint8Array(22);
    const ev = new DataView(eocd.buffer);
    ev.setUint32(0, 0x06054b50, true);
    ev.setUint16(8, central.length, true);
    ev.setUint16(10, central.length, true);
    ev.setUint32(12, cdSize, true);
    ev.setUint32(16, cdStart, true);
    parts.push(eocd);
    return new Blob(parts, { type: 'application/zip' });
  }

  function read(buf) {
    const u8 = new Uint8Array(buf);
    const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    let i = u8.length - 22;
    const min = Math.max(0, u8.length - 22 - 65536);
    while (i >= min) {
      if (dv.getUint32(i, true) === 0x06054b50) break;
      i--;
    }
    if (i < min) throw new Error('无效的备份文件');
    const count = dv.getUint16(i + 10, true);
    const cdOff = dv.getUint32(i + 16, true);
    const dec = new TextDecoder();
    const files = {};
    let p = cdOff;
    for (let c = 0; c < count; c++) {
      if (p + 46 > u8.length || dv.getUint32(p, true) !== 0x02014b50) throw new Error('备份文件已损坏');
      const method = dv.getUint16(p + 10, true);
      const csize = dv.getUint32(p + 20, true);
      const nameLen = dv.getUint16(p + 28, true);
      const extraLen = dv.getUint16(p + 30, true);
      const commLen = dv.getUint16(p + 32, true);
      const lho = dv.getUint32(p + 42, true);
      const name = dec.decode(u8.subarray(p + 46, p + 46 + nameLen));
      if (method !== 0) throw new Error('暂不支持该压缩格式');
      const ln = dv.getUint16(lho + 26, true);
      const le = dv.getUint16(lho + 28, true);
      const start = lho + 30 + ln + le;
      files[name] = u8.slice(start, start + csize);
      p += 46 + nameLen + extraLen + commLen;
    }
    return files;
  }

  return { create, read };
})();
