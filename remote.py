"""
The office on the owner's other computers (2.39.0; the owner: "my Windows is the main office", the Mac is a screen for it).

The office still listens on 127.0.0.1 for this PC. When Tailscale (a private network only the owner's own signed-in devices can
join, free, https://tailscale.com) is running here, the same office is also served on this PC's Tailscale address, so the Mac
opens http://<pc-name>:8765 and sees and does everything live. Nothing is opened to the internet or the home Wi-Fi: only the
Tailscale address is bound.

A second lock on top of Tailscale: a device that isn't this PC must enter the office's access code once (shown on this PC in
Spend & limits -> Your other computers, and in the START-HERE window). It then gets a cookie (a random token; only its hash is
kept in ~/.agent-hq/remote.json) for a year. 5 wrong codes lock the code until the office restarts. "New code" on this PC signs
every other device out. Off with settings.REMOTE_OFFICE = False (settings_local.py); practice mode only with HQ_REMOTE=1.
"""
import hashlib
import ipaddress
import json
import os
import secrets
import shutil
import socket
import subprocess
import threading
import time
from pathlib import Path

import settings

STORE = Path(os.environ.get("HQ_REMOTE_STORE") or Path.home() / ".agent-hq" / "remote.json")
COOKIE = "hq_remote"
MAX_TRIES = 5
TAILNET = ipaddress.ip_network("100.64.0.0/10")   # Tailscale's addresses
ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"   # no 0/O, 1/I/L
STATE = {"ip": None, "name": None, "port": None, "tries": 0, "error": "", "serving": False}
LOCK = threading.Lock()
NOFLAGS = getattr(subprocess, "CREATE_NO_WINDOW", 0)


def enabled():
    if os.environ.get("HQ_SIMULATE") == "1" and os.environ.get("HQ_REMOTE") != "1":
        return False
    return bool(getattr(settings, "REMOTE_OFFICE", True))


def _load():
    try:
        return json.loads(STORE.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}


def _save(d):
    STORE.parent.mkdir(parents=True, exist_ok=True)
    STORE.write_text(json.dumps(d, indent=1), encoding="utf-8")


def _hash(token):
    return hashlib.sha256(token.encode()).hexdigest()


def code():
    """The access code, made once (8 letters/digits, shown as XXXX-XXXX)."""
    with LOCK:
        d = _load()
        if not d.get("code"):
            d["code"] = "".join(secrets.choice(ALPHABET) for _ in range(8))
            _save(d)
        return d["code"]


def pretty(c):
    return c[:4] + "-" + c[4:]


def new_code():
    """A fresh code; every device signed in with the old one is signed out."""
    with LOCK:
        d = _load()
        d["code"] = "".join(secrets.choice(ALPHABET) for _ in range(8))
        d["devices"] = []
        _save(d)
        STATE["tries"] = 0
        return d["code"]


# ---- Tailscale ----------------------------------------------------------------------
def _tailscale_exe():
    found = shutil.which("tailscale")
    if found:
        return found
    for p in (Path(os.environ.get("ProgramFiles", r"C:\Program Files")) / "Tailscale" / "tailscale.exe",
              Path("/Applications/Tailscale.app/Contents/MacOS/Tailscale"), Path("/usr/local/bin/tailscale"),
              Path("/opt/homebrew/bin/tailscale")):
        if p.exists():
            return str(p)
    return None


def find_tailscale():
    """(this PC's Tailscale IPv4, its MagicDNS name or None), or (None, None) when Tailscale isn't up."""
    exe = _tailscale_exe()
    if exe:
        try:
            p = subprocess.run([exe, "status", "--json"], capture_output=True, text=True, timeout=15, creationflags=NOFLAGS)
            me = (json.loads(p.stdout or "{}").get("Self") or {})
            ips = [a for a in me.get("TailscaleIPs") or [] if ":" not in a]
            if ips and me.get("Online", True):
                name = (me.get("DNSName") or "").rstrip(".") or None
                return ips[0], name
        except (OSError, ValueError, subprocess.SubprocessError):
            pass
    try:   # no CLI: look for a 100.64/10 address on this computer
        for info in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET):
            ip = info[4][0]
            if ipaddress.ip_address(ip) in TAILNET:
                return ip, None
    except OSError:
        pass
    return None, None


def url():
    if not STATE["serving"]:
        return None
    host = (STATE["name"] or "").split(".")[0] or STATE["ip"]
    return f"http://{host}:{STATE['port']}"


def start(server_cls, handler_cls, port):
    """Serve the office on the Tailscale address too, as soon as Tailscale is up (checked every minute; Tailscale may start after
    the office). Never binds 0.0.0.0."""
    if not enabled():
        return
    STATE["port"] = port

    def loop():
        while True:
            if not STATE["serving"]:
                ip, name = find_tailscale()
                if ip:
                    try:
                        srv = server_cls((ip, port), handler_cls)
                        STATE.update(ip=ip, name=name, serving=True, error="")
                        print(f"  Your other computers: open {url()} (Tailscale). Access code: {pretty(code())}\n", flush=True)
                        threading.Thread(target=srv.serve_forever, daemon=True).start()
                    except OSError as e:
                        STATE["error"] = f"Couldn't listen on {ip}:{port}: {e}"
            time.sleep(60)
    threading.Thread(target=loop, daemon=True).start()


# ---- who may come in -----------------------------------------------------------------
def is_local(handler):
    try:
        return ipaddress.ip_address(handler.client_address[0]).is_loopback
    except ValueError:
        return False


def _cookie(handler):
    for part in (handler.headers.get("Cookie") or "").split(";"):
        k, _, v = part.strip().partition("=")
        if k == COOKIE:
            return v
    return ""


def allowed(handler):
    """This PC always; another device only with a valid sign-in cookie, and only from a Tailscale address."""
    if is_local(handler):
        return True
    try:
        if ipaddress.ip_address(handler.client_address[0]) not in TAILNET:
            return False
    except ValueError:
        return False
    tok = _cookie(handler)
    if not tok:
        return False
    h = _hash(tok)
    for dev in _load().get("devices") or []:
        if secrets.compare_digest(dev.get("hash", ""), h):
            return True
    return False


def sign_in(handler, given, label):
    """Checks the code: (cookie header value, "") on success, else (None, reason)."""
    if STATE["tries"] >= MAX_TRIES:
        return None, "Too many wrong codes. On the PC, close the Agent HQ window and start it again, then use the code shown there."
    want = code()
    given = "".join(ch for ch in str(given or "").upper() if ch.isalnum())
    if not secrets.compare_digest(given, want):
        STATE["tries"] += 1
        left = MAX_TRIES - STATE["tries"]
        return None, (f"Wrong code. {left} tr{'y' if left == 1 else 'ies'} left." if left
                      else "Wrong code. The code is now locked until the office restarts on the PC.")
    STATE["tries"] = 0
    tok = secrets.token_urlsafe(32)
    with LOCK:
        d = _load()
        devs = list(d.get("devices") or [])[-19:]
        devs.append({"hash": _hash(tok), "ts": time.time(), "label": str(label or "")[:80], "ip": handler.client_address[0]})
        d["devices"] = devs
        _save(d)
    return f"{COOKIE}={tok}; Max-Age=31536000; Path=/; HttpOnly; SameSite=Strict", ""


def sign_out(handler):
    tok = _cookie(handler)
    if not tok:
        return
    h = _hash(tok)
    with LOCK:
        d = _load()
        d["devices"] = [x for x in d.get("devices") or [] if x.get("hash") != h]
        _save(d)


def view(handler):
    """For the office's 'Your other computers' card. The code only to this PC."""
    d = _load()
    out = {"enabled": enabled(), "serving": STATE["serving"], "url": url(), "ip": STATE["ip"], "error": STATE["error"],
           "devices": [{"label": x.get("label") or "a device", "ts": x.get("ts")} for x in d.get("devices") or []],
           "local": is_local(handler), "locked": STATE["tries"] >= MAX_TRIES}
    if out["local"]:
        out["code"] = pretty(code())
    return out


LOGIN_PAGE = """<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Agent HQ</title><style>
:root{color-scheme:dark}body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0B1220;color:#E2E8F0;
font:16px/1.5 system-ui,-apple-system,Segoe UI,sans-serif}main{width:min(360px,calc(100% - 32px))}
h1{font-size:20px;letter-spacing:.08em;margin:0 0 8px}p{color:#94A3B8;margin:0 0 20px}
input{box-sizing:border-box;width:100%;padding:12px 14px;border-radius:10px;border:1px solid #334155;background:#111A2E;color:#E2E8F0;
font:22px/1 ui-monospace,Menlo,Consolas,monospace;letter-spacing:.2em;text-transform:uppercase;text-align:center}
button{margin-top:12px;width:100%;padding:12px;border:0;border-radius:10px;background:#22D3EE;color:#0B1220;font-weight:700;font-size:16px;cursor:pointer}
.err{color:#FDA4AF;margin-top:12px;min-height:1.5em}</style></head><body><main>
<h1>AGENT HQ</h1><p>Your office, running on the PC. Enter the access code shown on the PC (Spend &amp; limits, Your other computers).</p>
<form id="f"><input id="c" autocomplete="one-time-code" autofocus maxlength="9" placeholder="XXXX-XXXX" aria-label="Access code">
<button type="submit">Open the office</button><div class="err" id="e" role="alert"></div></form>
<script>
document.getElementById('f').addEventListener('submit', async e => {
  e.preventDefault();
  const r = await fetch('/api/remote/sign-in', {method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({code: document.getElementById('c').value, label: navigator.platform || 'a device'})});
  const j = await r.json().catch(() => ({}));
  if (r.ok) location.href = '/'; else document.getElementById('e').textContent = j.error || 'Not signed in.';
});
</script></main></body></html>"""
