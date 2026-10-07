"""
The owner's phone (2.22.0): a private Telegram bot.

- News: everything the office posts in Atlas's name (atlas_says) reaches the phone.
- Cards: each new thing that waits for the owner (a pitch, a plan, a script, a video to upload, Ghassan's change, Richard's
  ideas, a reference board) arrives once, with buttons. A button calls the office's own API on 127.0.0.1 exactly like the
  office page does, so every guardrail stays where it is.
- Chat: any text or photo the owner sends goes to Atlas; his reply comes back to the phone.
- Commands: /today /status /stop /resume /mute /unmute /help.

Only one Telegram chat is obeyed: the one that sent the pairing code shown in the office (Spend & limits -> Your phone) and in
the START-HERE window. Everyone else is ignored. The bot token lives only in .env (TELEGRAM_BOT_TOKEN); it is never logged.
Long polling (getUpdates): nothing on this PC is opened to the internet.
Test without Telegram: HQ_TELEGRAM_API=<fake server> (see the Builder's test notes).
"""
import html
import json
import os
import re
import secrets
import threading
import time
import urllib.error
import urllib.request
import uuid
from pathlib import Path

import control_plane as cp

ROOT = Path(__file__).parent
STORE = Path(os.environ.get("HQ_PHONE_STORE") or (Path.home() / ".agent-hq" / "telegram.json"))   # paired chat, seen cards, mute
SKIP = ROOT / ".telegram-skip"
API = os.environ.get("HQ_TELEGRAM_API", "https://api.telegram.org").rstrip("/")
MAX_VIDEO = 49 * 1024 * 1024    # bots may send files up to 50 MB
MAX_TRIES = 5                   # wrong pairing codes before the code stops working until the next start
POLL_WAITS = 30                 # seconds between looks for new things that wait for the owner

STATE = {"port": None, "running": False, "code": f"{secrets.randbelow(10 ** 6):06d}", "tries": 0, "bot": "", "error": "",
         "reply_to_phone": False}
ASK = {}          # chat id -> the button that waits for a reason: {"label", "path", "field", "body"}
OUT = []          # news waiting to be sent
OUT_LOCK = threading.Lock()
SAVE_LOCK = threading.Lock()
STATUS_FN = [lambda: []]   # server.py sets this: what is running right now, as short lines


# ---- settings ----------------------------------------------------------------------------------------------------------
def token():
    return os.environ.get("TELEGRAM_BOT_TOKEN", "").strip()


def configured():
    return bool(token())


def _load():
    try:
        return json.loads(STORE.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}


def _save(**changes):
    with SAVE_LOCK:
        d = _load()
        d.update(changes)
        STORE.parent.mkdir(parents=True, exist_ok=True)
        STORE.write_text(json.dumps(d), encoding="utf-8")
        return d


def owner_chat():
    return _load().get("chat")


def save_token(t):
    env = ROOT / ".env"
    lines = [l for l in (env.read_text(encoding="utf-8").splitlines() if env.exists() else []) if not l.startswith("TELEGRAM_BOT_TOKEN=")]
    lines.append(f"TELEGRAM_BOT_TOKEN={t}")
    env.write_text("\n".join(lines) + "\n", encoding="utf-8")
    os.environ["TELEGRAM_BOT_TOKEN"] = t
    SKIP.unlink(missing_ok=True)


def view():
    """For the office's 'Your phone' card. Never includes the token."""
    d = _load()
    return {"configured": configured(), "running": STATE["running"], "paired": bool(d.get("chat")), "bot": STATE["bot"],
            "code": "" if d.get("chat") else (STATE["code"] if STATE["tries"] < MAX_TRIES else ""),
            "locked": STATE["tries"] >= MAX_TRIES, "muted": bool(d.get("muted")), "error": STATE["error"]}


def offer_setup():
    """At startup, once, in the START-HERE window. Enter skips and it won't ask again (the office's Spend & limits page can
    still set it up)."""
    if configured() or SKIP.exists():
        return
    print("  Your phone: a private Telegram bot sends you the office's news and lets you approve things from your phone.")
    print("  In Telegram, open @BotFather, send /newbot, pick any name, then paste the token it gives you here.")
    print("  It stays in the .env file on this computer. Press Enter to skip (you can set it up later in Spend & limits).")
    try:
        t = input("  Telegram bot token: ").strip()
    except EOFError:
        return
    if not t:
        SKIP.write_text("skipped", encoding="utf-8")
        print("  Skipped.\n", flush=True)
        return
    save_token(t)
    print("  Saved.\n", flush=True)


# ---- Telegram ----------------------------------------------------------------------------------------------------------
def _tls():
    try:
        import linkpeek   # certifi or the video tools' copy: Windows' own store is stale on the owner's PC
        return linkpeek._tls()
    except Exception:
        return None


class TelegramError(Exception):
    pass


def tg(method, timeout=30, **params):
    data = json.dumps({k: v for k, v in params.items() if v is not None}).encode()
    req = urllib.request.Request(f"{API}/bot{token()}/{method}", data=data, headers={"Content-Type": "application/json"})
    return _call(req, timeout)


def _call(req, timeout):
    try:
        with urllib.request.urlopen(req, timeout=timeout, context=_tls() if req.full_url.startswith("https") else None) as r:
            got = json.loads(r.read())
    except urllib.error.HTTPError as e:
        try:
            got = json.loads(e.read())
        except ValueError:
            raise TelegramError(f"HTTP {e.code}")
    except (urllib.error.URLError, OSError, ValueError) as e:
        raise TelegramError(type(e).__name__ + ": " + str(e)[:200].replace(token() or "\0", "<token>"))
    if not got.get("ok"):
        raise TelegramError(str(got.get("description", "Telegram refused the request"))[:200])
    return got.get("result")


def tg_file(method, field, path, timeout=300, **params):
    """Upload a file (a video, a plan) with multipart/form-data."""
    b = uuid.uuid4().hex
    parts = []
    for k, v in params.items():
        if v is None:
            continue
        v = json.dumps(v) if isinstance(v, (dict, list)) else str(v)
        parts.append(f'--{b}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode())
    p = Path(path)
    parts.append(f'--{b}\r\nContent-Disposition: form-data; name="{field}"; filename="{p.name}"\r\n'
                 f'Content-Type: application/octet-stream\r\n\r\n'.encode() + p.read_bytes() + b"\r\n")
    parts.append(f"--{b}--\r\n".encode())
    req = urllib.request.Request(f"{API}/bot{token()}/{method}", data=b"".join(parts),
                                 headers={"Content-Type": f"multipart/form-data; boundary={b}"})
    return _call(req, timeout)


def to_html(text):
    """The office's light markdown -> Telegram HTML."""
    t = html.escape(str(text or ""), quote=False)
    t = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", t, flags=re.S)
    t = re.sub(r"(?<![\w*])_\((.+?)\)_(?!\w)", r"<i>(\1)</i>", t, flags=re.S)
    t = re.sub(r"`([^`\n]+)`", r"<code>\1</code>", t)
    t = re.sub(r"\[([^\]\n]+)\]\((https?://[^)\s]+)\)", lambda m: f'<a href="{m.group(2)}">{m.group(1)}</a>', t)
    t = re.sub(r"(?m)^#{1,4} +(.+)$", r"<b>\1</b>", t)
    return t


def _chunks(text, n=3900):
    out = []
    while len(text) > n:
        cut = text.rfind("\n", 0, n)
        cut = cut if cut > n // 2 else n
        out.append(text[:cut])
        text = text[cut:].lstrip("\n")
    return out + [text]


def send(text, buttons=None, chat=None, plain=False):
    """Send to the owner. buttons: rows of (label, callback data). Long text is split; the buttons go on the last part."""
    chat = chat or owner_chat()
    if not chat or not configured():
        return None
    body = text if plain else to_html(text)
    parts = _chunks(body)
    last = None
    for i, part in enumerate(parts):
        markup = {"inline_keyboard": [[{"text": l, "callback_data": d} for l, d in row] for row in buttons]} \
            if buttons and i == len(parts) - 1 else None
        try:
            last = tg("sendMessage", chat_id=chat, text=part, parse_mode=None if plain else "HTML",
                      disable_web_page_preview=True, reply_markup=markup)
        except TelegramError as e:
            if plain or "parse" not in str(e).lower():
                raise
            last = tg("sendMessage", chat_id=chat, text=html.unescape(re.sub(r"<[^>]+>", "", part)),   # bad markup: send it plain
                      disable_web_page_preview=True, reply_markup=markup)
    return last


def notify(text):
    """News from the office (atlas_says). Queued, so the office never waits on Telegram."""
    if configured():
        with OUT_LOCK:
            OUT.append(text)


def atlas_replied(reply):
    """server.run_chat: Atlas answered; if the question came from the phone, the answer goes there."""
    if STATE["reply_to_phone"]:
        STATE["reply_to_phone"] = False
        with OUT_LOCK:
            OUT.append("🧭 **Atlas:** " + (reply or "(no reply)"))


# ---- the office -------------------------------------------------------------------------------------------------------
def office(path, body=None):
    """POST to the running office, like a click in the page. Returns (ok, message)."""
    req = urllib.request.Request(f"http://127.0.0.1:{STATE['port']}{path}", data=json.dumps(body or {}).encode(),
                                 headers={"Content-Type": "application/json"}, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            got = json.loads(r.read() or b"{}")
            return True, got.get("message") or got.get("warning") or "Done."
    except urllib.error.HTTPError as e:
        try:
            return False, json.loads(e.read()).get("error") or f"HTTP {e.code}"
        except ValueError:
            return False, f"HTTP {e.code}"
    except (urllib.error.URLError, OSError) as e:
        return False, f"The office didn't answer: {e}"


def _short(t, n=48):
    t = str(t or "")
    return t if len(t) <= n else t[:n].rsplit(" ", 1)[0] + "…"


def _money(p):
    return f"${p.get('one_off_usd') or 0:.2f} one-off and ${p.get('monthly_usd') or 0:.2f} a month"


def _script_text(e):
    d = e["data"] or {}
    rows = d.get("scenes") or d.get("shots") or []
    if rows:
        out = []
        for i, s in enumerate(rows, 1):
            lines = s.get("lines") or []
            said = " ".join(f"{l.get('who', '')}: {l.get('text', '')}" if l.get("who") not in (None, "", "narrator")
                            else str(l.get("text", "")) for l in lines) if lines else s.get("voice_line", "")
            out.append(f"{i}. {said}")
        return "\n".join(out)
    return str(d.get("script") or "")


def _review_line(e, key="review"):
    r = (e["data"] or {}).get(key) or {}
    if not r:
        return ""
    return f"\n<b>Israa:</b> {html.escape(str(r.get('verdict', '')))} ({r.get('score', '?')}/10). {html.escape(str(r.get('summary', ''))[:500])}"


def waits():
    """Everything that waits for the owner, as {key, text (HTML), buttons, file, video}. Mirrors the office's Today page."""
    out = []
    for i in cp.list_inbox():
        p = i["pitch"] or {}
        out.append({"key": f"pitch:{i['id']}", "text":
                    f"💡 <b>Doulya's pitch #{i['id']}: {html.escape(i['title'])}</b>\n{html.escape(str(p.get('pitch', '')))}\n\n"
                    f"<b>Why now:</b> {html.escape(str(p.get('why_now', '')))}\n<b>Money:</b> {html.escape(str(p.get('how_it_makes_money', '')))}\n"
                    f"<i>Nothing is researched until you say so.</i>",
                    "buttons": [[("🔎 Research it", f"R:{i['id']}"), ("✖ Dismiss", f"D:{i['id']}")]]})
    projects = cp.list_projects(50)
    for p in projects:
        if p["status"] == "awaiting_approval":
            f = (ROOT / p["plan_path"]) if p.get("plan_path") else None
            out.append({"key": f"plan:{p['id']}:{p.get('revision') or 0}", "text":
                        f"📋 <b>Serge's plan: {html.escape(p['title'])}</b>\nBudget request: {_money(p)}.\n\n{html.escape(p.get('summary', '')[:1200])}\n\n"
                        "<i>Approving only records this budget as the project's ceiling. Nothing is bought.</i>",
                        "buttons": [[("✅ Approve", f"PA:{p['id']}"), ("✏ Ask for changes", f"PC:{p['id']}"), ("✖ Reject", f"PR:{p['id']}")]],
                        "file": str(f) if f and f.exists() else None})
        if p["status"] == "approved":
            b = cp.latest_refboard(p["id"])
            if b and b.get("status") == "ready":
                out.append({"key": f"board:{p['id']}:{b['id']}", "text":
                            f"🎬 <b>The Scout's reference board for {html.escape(p['title'])} is ready.</b>\n"
                            f"{len((b.get('data') or {}).get('references') or [])} real examples. Calina writes nothing until you choose a "
                            "direction. Open the project's Reference board page in the office to pick one.", "buttons": []})
    names = {p["id"]: (p["meta"] or {}).get("name") or ((p["meta"] or {}).get("channel") or {}).get("name") or _short(p["title"])
             for p in projects}
    for e in cp.list_episodes(limit=80):
        d = e["data"] or {}
        where = names.get(e["project_id"], f"project {e['project_id']}")
        if e["status"] == "awaiting_approval":
            out.append({"key": f"script:{e['id']}", "text":
                        f"📝 <b>Script #{e['id']}: {html.escape(e['title'])}</b> ({html.escape(where)}){_review_line(e)}\n\n"
                        + html.escape(_script_text(e)[:3000]),
                        "buttons": [[("✅ Approve", f"EA:{e['id']}"), ("✖ Reject", f"ER:{e['id']}")]]})
        elif e["status"] == "approved" and d.get("scenes"):
            out.append({"key": f"assemble:{e['id']}", "text":
                        f"🎞 <b>#{e['id']} {html.escape(e['title'])}</b> is approved and ready to become a video.",
                        "buttons": [[("▶ Make the video", f"EM:{e['id']}")]]})
        elif e["status"] == "rendered" and not d.get("do_not_upload"):
            v = ROOT / e["video_path"] if e.get("video_path") else None
            folder = v.parent if v else None
            desc = (folder / "description.txt") if folder else None
            title = (folder / "title.txt") if folder else None
            copy = ""
            if title and title.exists():
                copy += f"\n\n<b>Title:</b>\n{html.escape(title.read_text(encoding='utf-8').strip())}"
            if desc and desc.exists():
                copy += f"\n\n<b>Description:</b>\n{html.escape(desc.read_text(encoding='utf-8').strip()[:2500])}"
            out.append({"key": f"upload:{e['id']}", "text":
                        f"📺 <b>Video #{e['id']} is ready to upload: {html.escape(e['title'])}</b>{_review_line(e, 'video_review')}{copy}",
                        "buttons": [[("✅ Mark published", f"EP:{e['id']}"), ("⛔ Don't upload", f"EN:{e['id']}")]],
                        "video": str(v) if v and v.exists() else None})
    try:
        new = [i for i in cp.list_lnd_ideas(200) if i["status"] == "new"]
    except Exception:
        new = []
    for i in new:
        d = i["data"] or {}
        out.append({"key": f"lnd:{i['id']}", "text":
                    f"🎓 <b>Richard's idea {html.escape(str(i['id']))}: {html.escape(str(d.get('title', '')))}</b>\n"
                    f"{html.escape(str(d.get('problem', ''))[:600])}\n\n<b>Proposal:</b> {html.escape(str(d.get('proposal', ''))[:900])}\n"
                    f"<b>Effort:</b> {html.escape(str(d.get('effort', '?')))}",
                    "buttons": [[("👍 Yes", f"LY:{i['id']}"[:64]), ("👎 No", f"LN:{i['id']}"[:64])]]})
    try:
        import ghassan
        g = ghassan.pending()
    except Exception:
        g = None
    if g:
        files = g.get("files") or []
        out.insert(0, {"key": f"ghassan:{g.get('commit') or g.get('title')}", "text":
                       f"🛠 <b>Ghassan's change is ready to ship: {html.escape(str(g.get('title', '')))}</b>\n{html.escape(str(g.get('summary', '')))}\n"
                       f"It passed every check ({len(files)} file{'s' if len(files) != 1 else ''}: {html.escape(', '.join(files[:8]))}).\n"
                       "<i>Ship puts it on your PC and restarts the office.</i>",
                       "buttons": [[("🚀 Ship", "GS"), ("✖ Discard", "GD")]]})
    if cp.STOP_FILE.exists():
        out.insert(0, {"key": "kill", "text": "🛑 <b>Every agent is stopped</b> (the kill switch is on). Nothing runs until you resume.",
                       "buttons": [[("▶ Resume agents", "RES")]]})
    return out


def send_card(w, chat=None):
    if w.get("video"):
        try:
            if Path(w["video"]).stat().st_size <= MAX_VIDEO:
                tg_file("sendVideo", "video", w["video"], chat_id=chat or owner_chat(), supports_streaming="true")
        except (TelegramError, OSError) as e:
            send(f"(The video couldn't be sent to the phone: {e}. Watch it in the office.)", chat=chat)
    if w.get("file"):
        try:
            tg_file("sendDocument", "document", w["file"], chat_id=chat or owner_chat())
        except (TelegramError, OSError):
            pass
    _send_html(w["text"], w.get("buttons"), chat)


def _send_html(text, buttons, chat):
    """Cards are already HTML."""
    chat = chat or owner_chat()
    parts = _chunks(text)
    for i, part in enumerate(parts):
        markup = {"inline_keyboard": [[{"text": l, "callback_data": d} for l, d in row] for row in buttons]} \
            if buttons and i == len(parts) - 1 else None
        tg("sendMessage", chat_id=chat, text=part, parse_mode="HTML", disable_web_page_preview=True, reply_markup=markup)


# ---- buttons ----------------------------------------------------------------------------------------------------------
# code -> (what it does, office path, the field a reason goes in or None, extra body, ask to confirm)
ACTIONS = {
    "R":  ("Research it", "/api/inbox/{}/research", None, {}, False),
    "D":  ("Dismiss", "/api/inbox/{}/dismiss", "reason", {}, False),
    "PA": ("Approve the plan", "/api/project/{}/approve", None, {}, False),
    "PC": ("Ask Serge for changes", "/api/project/{}/changes", "note", {}, False),
    "PR": ("Reject the plan", "/api/project/{}/reject", "note", {}, False),
    "EA": ("Approve the script", "/api/episode/{}/approve", None, {}, False),
    "ER": ("Reject the script", "/api/episode/{}/reject", "note", {}, False),
    "EM": ("Make the video", "/api/episode/{}/render", None, {}, False),
    "EP": ("Mark as published", "/api/episode/{}/published", None, {}, False),
    "EN": ("Don't upload", "/api/episode/{}/do-not-upload", "reason", {"by": "owner"}, False),
    "LY": ("Yes to Richard's idea", "/api/lnd/{}/yes", None, {}, False),
    "LN": ("No to Richard's idea", "/api/lnd/{}/no", "reason", {}, False),
    "GS": ("Ship Ghassan's change", "/api/ghassan/ship", None, {"by": "owner"}, True),
    "GD": ("Discard Ghassan's change", "/api/ghassan/discard", "reason", {"by": "owner"}, False),
    "RES": ("Resume every agent", "/api/resume", None, {}, False),
    "STOP": ("Stop every agent", "/api/stop", None, {}, True),
}
DONE = {"R": "Sage starts researching it. Vera's verdict comes here when it's done.", "RES": "Every agent can work again.",
        "STOP": "Every agent is stopped. Send /resume to start again."}
WHY = {"reason": "Why? Your reason teaches the team.", "note": "What should change? Write it in one message."}


def _run_action(code, arg, extra=None):
    label, path, _, body, _ = ACTIONS[code]
    ok, msg = office(path.format(arg), {**body, **(extra or {})})
    msg = DONE.get(code, msg) if ok and msg == "Done." else msg
    cp.log("Owner", "phone_action", None, {"action": label, "on": arg, "ok": ok})
    return ("✅ " if ok else "⚠ ") + f"{label}: {msg}"


def on_button(q):
    chat = q["message"]["chat"]["id"]
    data = q.get("data") or ""
    code, _, arg = data.partition(":")
    confirmed = code.endswith("!")
    code = code.rstrip("!")
    try:
        tg("answerCallbackQuery", callback_query_id=q["id"])
    except TelegramError:
        pass
    if code == "NO":
        return send("Cancelled. Nothing changed.", chat=chat)
    if code not in ACTIONS:
        return send("That button is from an older version. Send /today for fresh ones.", chat=chat)
    label, _, field, _, confirm = ACTIONS[code]
    if confirm and not confirmed:
        return _send_html(f"<b>{html.escape(label)}?</b> Are you sure?", [[("Yes, do it", f"{code}!:{arg}"[:64]), ("Cancel", "NO")]], chat)
    if field:
        ASK[chat] = {"code": code, "arg": arg, "field": field}
        return _send_html(f"<b>{html.escape(label)}</b>: {WHY[field]}\n<i>Or send /skip to do it without a reason, /cancel to stop.</i>", None, chat)
    _clear_buttons(q)
    send(_run_action(code, arg), chat=chat, plain=True)


def _clear_buttons(q):
    try:
        tg("editMessageReplyMarkup", chat_id=q["message"]["chat"]["id"], message_id=q["message"]["message_id"],
           reply_markup={"inline_keyboard": []})
    except TelegramError:
        pass


# ---- messages ---------------------------------------------------------------------------------------------------------
HELP = ("I'm your Agent HQ on the phone.\n\n"
        "• Write anything and Atlas answers (photos too).\n"
        "• /today: everything that waits for you, with buttons\n"
        "• /status: who is working and today's spend\n"
        "• /stop: stop every agent (the kill switch), /resume to start again\n"
        "• /mute and /unmute: pause the news (cards and Atlas's replies still come)\n"
        "• /help: this list")


def on_message(m):
    chat = m["chat"]["id"]
    text = (m.get("text") or m.get("caption") or "").strip()
    owner = owner_chat()
    if not owner:
        return _pair(chat, text, m)
    if chat != owner:
        if text.startswith("/start"):
            tg("sendMessage", chat_id=chat, text="This is a private bot.")
        return
    if text in ("/cancel",):
        ASK.pop(chat, None)
        return send("Cancelled. Nothing changed.", chat=chat)
    if chat in ASK and not m.get("photo") and (not text.startswith("/") or text == "/skip"):
        a = ASK.pop(chat)
        reason = "" if text == "/skip" else text[:1000]
        return send(_run_action(a["code"], a["arg"], {a["field"]: reason}), chat=chat, plain=True)
    cmd = text.split()[0].split("@")[0].lower() if text.startswith("/") else ""
    if cmd in ("/start", "/help"):
        return send(HELP, chat=chat, plain=True)
    if cmd == "/today":
        ws = waits()
        if not ws:
            return send("Nothing waits for you right now. 🎉", chat=chat, plain=True)
        send(f"{len(ws)} thing{'s' if len(ws) != 1 else ''} wait for you:", chat=chat, plain=True)
        for w in ws[:15]:
            send_card({**w, "video": None, "file": None}, chat)
        return
    if cmd == "/status":
        return _send_html(status_text(), None, chat)
    if cmd == "/stop":
        return _send_html("<b>Stop every agent?</b> Nothing runs until you resume.", [[("🛑 Yes, stop them", "STOP!:"), ("Cancel", "NO")]], chat)
    if cmd == "/resume":
        return send(_run_action("RES", ""), chat=chat, plain=True)
    if cmd in ("/mute", "/unmute"):
        _save(muted=cmd == "/mute")
        return send("News paused. Cards that need you and Atlas's replies still come. /unmute to turn it back on."
                    if cmd == "/mute" else "News is back on.", chat=chat, plain=True)
    if cmd:
        return send("I don't know that one. /help lists what I can do.", chat=chat, plain=True)
    _to_atlas(chat, text, m)


def _to_atlas(chat, text, m):
    images = []
    if m.get("photo"):
        try:
            import base64
            f = tg("getFile", file_id=m["photo"][-1]["file_id"])
            with urllib.request.urlopen(f"{API}/file/bot{token()}/{f['file_path']}", timeout=60,
                                        context=_tls() if API.startswith("https") else None) as r:
                images.append({"name": "phone-photo", "data": base64.b64encode(r.read()).decode()})
        except Exception as e:
            return send(f"I couldn't get that photo: {type(e).__name__}.", chat=chat, plain=True)
    if not text and not images:
        return send("I can pass text and photos to Atlas. /help lists the rest.", chat=chat, plain=True)
    STATE["reply_to_phone"] = True
    ok, msg = office("/api/chat", {"text": text, "images": images, "phone": True})
    if not ok:
        STATE["reply_to_phone"] = False
        return send(f"⚠ {msg}", chat=chat, plain=True)
    try:
        tg("sendChatAction", chat_id=chat, action="typing")
    except TelegramError:
        pass


def _pair(chat, text, m):
    code = re.sub(r"\D", "", text)
    if STATE["tries"] >= MAX_TRIES:
        return tg("sendMessage", chat_id=chat, text="Too many wrong codes. Restart the office (START-HERE) for a new one.")
    if len(code) == 6:
        if secrets.compare_digest(code, STATE["code"]):
            _save(chat=chat, seen=[w["key"] for w in waits()], muted=False)
            cp.log("Owner", "phone_paired", None, {"name": (m.get("from") or {}).get("first_name", "")})
            send("✅ Paired. This phone now gets the office's news and the things that wait for you.\n\n" + HELP, chat=chat, plain=True)
            n = len(waits())
            if n:
                send(f"{n} thing{'s' if n != 1 else ''} already wait{'s' if n == 1 else ''} for you. Send /today to see them.", chat=chat, plain=True)
            return
        STATE["tries"] += 1
        return tg("sendMessage", chat_id=chat, text="That code is wrong.")
    tg("sendMessage", chat_id=chat, text="Hi! Send the 6-digit code shown in your office (Spend & limits → Your phone) "
                                         "or in the START-HERE window to pair this phone.")


def status_text():
    lines = STATUS_FN[0]() or ["Nobody is working right now."]
    n = len(waits())
    spent = cp.spend_today()
    try:
        import settings
        cap = f" of ${settings.DAILY_AI_BUDGET_USD:.2f}"
    except Exception:
        cap = ""
    return ("<b>Right now</b>\n" + "\n".join("• " + html.escape(l) for l in lines)
            + f"\n\n<b>Waiting for you:</b> {n} (send /today)\n<b>API spend today:</b> ${spent:.2f}{cap}"
            + ("\n🛑 <b>The kill switch is on.</b>" if cp.STOP_FILE.exists() else ""))


# ---- loops ------------------------------------------------------------------------------------------------------------
def _poll():
    offset = _load().get("offset", 0)
    while True:
        try:
            ups = _get_updates(offset)
            STATE["error"] = ""
            for u in ups or []:
                offset = u["update_id"] + 1
                _save(offset=offset)
                try:
                    if "callback_query" in u:
                        if u["callback_query"]["message"]["chat"]["id"] == owner_chat():
                            on_button(u["callback_query"])
                    elif "message" in u:
                        on_message(u["message"])
                except Exception as e:
                    print("Phone:", repr(e)[:300], flush=True)
        except TelegramError as e:
            STATE["error"] = str(e)
            if "Unauthorized" in str(e) or "Not Found" in str(e):
                print("  Phone: Telegram rejected the bot token. Set it again in Spend & limits -> Your phone.", flush=True)
                STATE["running"] = False
                return
            time.sleep(15)
        except Exception as e:   # the loop must never die
            print("Phone:", repr(e)[:300], flush=True)
            time.sleep(15)


def _get_updates(offset):
    data = json.dumps({"timeout": 50, "offset": offset, "allowed_updates": ["message", "callback_query"]}).encode()
    req = urllib.request.Request(f"{API}/bot{token()}/getUpdates", data=data, headers={"Content-Type": "application/json"})
    return _call(req, 70)


def _push():
    """Sends the queued news and, every POLL_WAITS seconds, a card for each new thing that waits for the owner."""
    last = 0.0
    while True:
        try:
            if owner_chat():
                with OUT_LOCK:
                    news = OUT[:]
                    OUT.clear()
                muted = _load().get("muted")
                for t in news:
                    if not muted or t.startswith("🧭"):
                        send(t)
                if time.time() - last >= POLL_WAITS:
                    last = time.time()
                    ws = waits()
                    seen = set(_load().get("seen") or [])
                    for w in ws:
                        if w["key"] not in seen:
                            seen.add(w["key"])
                            _save(seen=sorted(seen))   # before sending: a failed send is never repeated in a loop
                            send_card(w)
                    _save(seen=sorted(seen & {w["key"] for w in ws}))   # forget what's done, so it comes back if it waits again
            else:
                with OUT_LOCK:
                    OUT.clear()   # not paired yet: nothing to deliver
        except Exception as e:
            print("Phone:", repr(e)[:300], flush=True)
        time.sleep(3)


def start(port):
    """Start the bot if a token is set. Safe to call again after the token changes."""
    STATE["port"] = port
    if not configured():
        return
    try:
        me = tg("getMe")
        STATE["bot"], STATE["error"] = me.get("username", ""), ""
    except TelegramError as e:
        STATE["error"] = str(e)
        print("  Phone: Telegram didn't accept the bot token:", e, flush=True)
        return
    if STATE["running"]:   # a new token: the running loops pick it up by themselves
        return
    STATE["running"] = True
    threading.Thread(target=_poll, daemon=True).start()
    if not STATE.get("pushing"):
        STATE["pushing"] = True
        threading.Thread(target=_push, daemon=True).start()
    if owner_chat():
        print(f"  Your phone: @{STATE['bot']} is connected.\n", flush=True)
    else:
        print(f"  Your phone: open @{STATE['bot']} in Telegram and send this code to pair it: {STATE['code']}\n", flush=True)


def unpair():
    _save(chat=None, seen=[])
    STATE["code"], STATE["tries"] = f"{secrets.randbelow(10 ** 6):06d}", 0
