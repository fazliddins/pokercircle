// Минимальный WebSocket-сервер (RFC 6455) без внешних зависимостей
'use strict';
const crypto = require('crypto');
const { EventEmitter } = require('events');

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

class Conn extends EventEmitter {
  constructor(socket, req) {
    super();
    this.socket = socket;
    this.req = req;
    this.buf = Buffer.alloc(0);
    this.frag = null;
    this.alive = true;
    this.open = true;
    socket.setNoDelay(true);
    socket.on('data', d => this._onData(d));
    socket.on('close', () => this._close());
    socket.on('error', () => this._close());
  }
  _close() {
    if (!this.open) return;
    this.open = false;
    this.emit('close');
  }
  _onData(chunk) {
    this.buf = Buffer.concat([this.buf, chunk]);
    while (this.buf.length >= 2) {
      const b0 = this.buf[0], b1 = this.buf[1];
      const fin = (b0 & 0x80) !== 0, op = b0 & 0x0f, masked = (b1 & 0x80) !== 0;
      let len = b1 & 0x7f, off = 2;
      if (len === 126) { if (this.buf.length < 4) return; len = this.buf.readUInt16BE(2); off = 4; }
      else if (len === 127) { if (this.buf.length < 10) return; len = Number(this.buf.readBigUInt64BE(2)); off = 10; }
      if (len > 1e6) { this.socket.destroy(); return; }
      const need = off + (masked ? 4 : 0) + len;
      if (this.buf.length < need) return;
      let payload = this.buf.subarray(off + (masked ? 4 : 0), need);
      if (masked) {
        const mask = this.buf.subarray(off, off + 4);
        payload = Buffer.from(payload);
        for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i & 3];
      }
      this.buf = this.buf.subarray(need);
      this._frame(fin, op, payload);
    }
  }
  _frame(fin, op, payload) {
    if (op === 0x8) { this._write(0x8, Buffer.alloc(0)); this.socket.end(); this._close(); return; }
    if (op === 0x9) { this._write(0xA, payload); return; }
    if (op === 0xA) { this.alive = true; return; }
    if (op === 0x1 || op === 0x2) this.frag = [payload];
    else if (op === 0x0 && this.frag) this.frag.push(payload);
    else return;
    if (fin) {
      const msg = Buffer.concat(this.frag).toString('utf8');
      this.frag = null;
      this.emit('message', msg);
    }
  }
  _write(op, data) {
    if (!this.open || this.socket.destroyed) return;
    const len = data.length;
    let header;
    if (len < 126) header = Buffer.from([0x80 | op, len]);
    else if (len < 65536) { header = Buffer.alloc(4); header[0] = 0x80 | op; header[1] = 126; header.writeUInt16BE(len, 2); }
    else { header = Buffer.alloc(10); header[0] = 0x80 | op; header[1] = 127; header.writeBigUInt64BE(BigInt(len), 2); }
    this.socket.write(Buffer.concat([header, data]));
  }
  send(str) { this._write(0x1, Buffer.from(str, 'utf8')); }
  ping() { this._write(0x9, Buffer.alloc(0)); }
  close() { try { this._write(0x8, Buffer.alloc(0)); this.socket.end(); } catch (e) { } this._close(); }
}

function attach(server, onConnection) {
  server.on('upgrade', (req, socket) => {
    const key = req.headers['sec-websocket-key'];
    if (!key || (req.headers.upgrade || '').toLowerCase() !== 'websocket') { socket.destroy(); return; }
    const accept = crypto.createHash('sha1').update(key + GUID).digest('base64');
    socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n' +
      `Sec-WebSocket-Accept: ${accept}\r\n\r\n`);
    const c = new Conn(socket, req);
    onConnection(c, req);
  });
  // Пинг для обнаружения обрывов
  const conns = new Set();
  const orig = onConnection;
  onConnection = (c, req) => { conns.add(c); c.on('close', () => conns.delete(c)); orig(c, req); };
  setInterval(() => {
    for (const c of conns) {
      if (!c.alive) { c.socket.destroy(); c._close(); continue; }
      c.alive = false; c.ping();
    }
  }, 20000).unref();
}

module.exports = { attach };
