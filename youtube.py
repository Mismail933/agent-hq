"""
youtube.py (2.44.0): read-only access to the owner's YouTube channel, for Omar (the Social Media Manager).

Google's official libraries only (google-api-python-client, google-auth-oauthlib; Apache 2.0), installed into the office's Python the
first time they are needed (`_libs`), not at start: a failed download never stops the office. Two read-only scopes:
youtube.readonly (the channel, its videos, their public numbers and comments) and yt-analytics.readonly (views, watch time,
average view duration and percentage, subscribers gained, traffic sources). Nothing here can upload, post, reply, edit or
delete: those scopes are never asked for.

Setup, once, by the owner (the Builder never sees the values):
1. Google Cloud console -> a project -> enable "YouTube Data API v3" and "YouTube Analytics API" -> OAuth consent screen
   (External, add himself as a test user) -> Credentials -> Create OAuth client ID -> "Desktop app" -> Download JSON.
2. Office -> Spend & limits -> Your YouTube -> choose that JSON file (or save it as ~/.agent-hq/youtube-client.json).
3. "Connect YouTube": Google's consent page opens in his browser on this PC; he signs in with the account that owns the
   channel, picks the channel and allows read-only access. The token is kept in ~/.agent-hq/youtube-token-p<project>.json,
   never logged or shown.
2.52.0 (the owner: "let Omar handle both"): one sign-in per channel, each tied to its project (one Google client file for all).
The single youtube-token.json of 2.44.0 belongs to the first project Omar watches and is renamed once (`migrate`).
Practice mode (HQ_SIMULATE=1) returns made-up numbers and needs none of this.
"""
import json
import os
import threading
from datetime import date, timedelta
from pathlib import Path

HOME = Path(os.environ.get("HQ_YOUTUBE_HOME") or (Path.home() / ".agent-hq"))
CLIENT = HOME / "youtube-client.json"
TOKEN = HOME / "youtube-token.json"   # 2.44.0's one sign-in: moved to token_path(<first project>) by migrate()
SCOPES = ["https://www.googleapis.com/auth/youtube.readonly", "https://www.googleapis.com/auth/yt-analytics.readonly"]
STATE = {"connecting": 0, "error": {}}   # connecting = the project whose Google page is open; error per project
LOCK = threading.Lock()
LIBS = ["google-api-python-client>=2.100", "google-auth-oauthlib>=1.2", "google-auth-httplib2>=0.2"]
METRICS = "views,estimatedMinutesWatched,averageViewDuration,averageViewPercentage,subscribersGained,subscribersLost,likes,comments,shares"


def _sim():
    return os.environ.get("HQ_SIMULATE") == "1"


def _libs():
    """Google's libraries, installed once into this Python when first needed."""
    try:
        import googleapiclient.discovery  # noqa: F401
        import google_auth_oauthlib.flow  # noqa: F401
        return
    except ImportError:
        pass
    import importlib
    import subprocess
    import sys
    code = subprocess.call([sys.executable, "-m", "pip", "install", "--quiet", "--disable-pip-version-check", *LIBS])
    importlib.invalidate_caches()
    if code != 0:
        raise RuntimeError("Couldn't install Google's YouTube libraries (pip failed). Check the internet, then press Connect again.")


def token_path(pid):
    return HOME / f"youtube-token-p{int(pid)}.json"


def migrate(pid):
    """2.44.0 kept one sign-in in youtube-token.json: it is the first watched project's channel."""
    try:
        if TOKEN.exists() and not token_path(pid).exists():
            TOKEN.rename(token_path(pid))
    except OSError:
        pass


def connected_projects():
    return sorted(int(f.stem.rsplit("-p", 1)[1]) for f in HOME.glob("youtube-token-p*.json") if f.stem.rsplit("-p", 1)[1].isdigit())


def status(pid=None):
    """What the office shows: is the client file there, is this project's channel connected (any channel, without pid), any error.
    Never the secrets themselves."""
    on = token_path(pid).exists() if pid else bool(connected_projects())
    return {"client": CLIENT.exists() or _sim(), "connected": on or _sim(),
            "connecting": (STATE["connecting"] == int(pid)) if pid else bool(STATE["connecting"]),
            "error": STATE["error"].get(int(pid), "") if pid else "", "practice": _sim()}


def save_client(raw):
    """The owner's OAuth client file (the JSON Google gives for a Desktop app). Checked for shape, then saved privately."""
    try:
        data = json.loads(raw.decode("utf-8") if isinstance(raw, (bytes, bytearray)) else raw)
    except ValueError:
        raise ValueError("That isn't the JSON file Google gives for an OAuth client.")
    inner = data.get("installed") or data.get("web")
    if not isinstance(inner, dict) or not inner.get("client_id") or not inner.get("client_secret"):
        raise ValueError("That JSON has no OAuth client in it. In Google Cloud choose Create OAuth client ID -> Desktop app -> Download JSON.")
    if "installed" not in data:
        raise ValueError("That is a 'Web application' client. Create a 'Desktop app' client instead, so the sign-in can come back to this PC.")
    HOME.mkdir(parents=True, exist_ok=True)
    CLIENT.write_text(json.dumps(data), encoding="utf-8")
    try:
        os.chmod(CLIENT, 0o600)
    except OSError:
        pass
    STATE["error"] = {}
    return True


def connect(pid):
    """Run Google's consent page in the owner's browser on this PC (a local loopback address catches the answer). Blocks until he
    answers or 10 minutes pass; run it in a thread."""
    if _sim():
        return True
    if not CLIENT.exists():
        raise RuntimeError("Add the OAuth client file first (Spend & limits -> Your YouTube).")
    pid = int(pid)
    with LOCK:
        STATE["connecting"] = pid
        STATE["error"].pop(pid, None)
        try:
            _libs()
            from google_auth_oauthlib.flow import InstalledAppFlow
            flow = InstalledAppFlow.from_client_secrets_file(str(CLIENT), SCOPES)
            # select_account: Google shows the account and channel chooser, so the owner can pick THIS project's channel
            creds = flow.run_local_server(port=0, open_browser=True, timeout_seconds=600, prompt="consent select_account",
                                          success_message="YouTube is connected to the office (read-only). You can close this tab.")
            if not creds:
                raise RuntimeError("Google didn't answer within 10 minutes.")
            tok = token_path(pid)
            tok.write_text(creds.to_json(), encoding="utf-8")
            try:
                os.chmod(tok, 0o600)
            except OSError:
                pass
            return True
        except Exception as e:
            STATE["error"][pid] = f"{type(e).__name__}: {str(e)[:200]}"
            raise
        finally:
            STATE["connecting"] = 0


def disconnect(pid):
    tok = token_path(pid)
    if tok.exists():
        tok.unlink()
    return True


def _creds(pid=None):
    """This project's sign-in; without pid any connected one (public numbers of other channels read the same with any)."""
    _libs()
    from google.auth.transport.requests import Request
    from google.oauth2.credentials import Credentials
    if pid is None:
        have = connected_projects()
        pid = have[0] if have else 0
    tok = token_path(pid)
    if not tok.exists():
        raise RuntimeError("YouTube isn't connected for this channel yet (Spend & limits -> Your YouTube -> Connect).")
    creds = Credentials.from_authorized_user_file(str(tok), SCOPES)
    if not creds.valid:
        if creds.expired and creds.refresh_token:
            creds.refresh(Request())
            tok.write_text(creds.to_json(), encoding="utf-8")
        else:
            raise RuntimeError("The YouTube sign-in has expired. Connect again (Spend & limits -> Your YouTube).")
    return creds


def _rows(report):
    heads = [h["name"] for h in report.get("columnHeaders", [])]
    return [dict(zip(heads, r)) for r in report.get("rows", []) or []]


def snapshot(pid, days=28):
    """Everything Omar reads about one project's channel, in one dict: the channel, its last uploads with their public numbers,
    the last `days` days of analytics (channel totals, per video, traffic sources) and the newest comments on the last three uploads."""
    if _sim():
        return _fake(days, pid)
    from googleapiclient.discovery import build
    creds = _creds(pid)
    yt = build("youtube", "v3", credentials=creds, cache_discovery=False)
    ya = build("youtubeAnalytics", "v2", credentials=creds, cache_discovery=False)
    ch = yt.channels().list(part="snippet,statistics,contentDetails", mine=True).execute()["items"][0]
    uploads = ch["contentDetails"]["relatedPlaylists"]["uploads"]
    items = yt.playlistItems().list(part="contentDetails", playlistId=uploads, maxResults=25).execute().get("items", [])
    ids = [i["contentDetails"]["videoId"] for i in items]
    videos = []
    if ids:
        for v in yt.videos().list(part="snippet,statistics,contentDetails", id=",".join(ids)).execute().get("items", []):
            s = v.get("statistics", {})
            videos.append({"id": v["id"], "title": v["snippet"]["title"], "published": v["snippet"]["publishedAt"],
                           "duration": v["contentDetails"].get("duration"), "views": int(s.get("viewCount", 0)),
                           "likes": int(s.get("likeCount", 0)), "comments": int(s.get("commentCount", 0))})
    end = date.today() - timedelta(days=1)
    start = end - timedelta(days=days - 1)
    span = {"ids": "channel==MINE", "startDate": start.isoformat(), "endDate": end.isoformat()}
    total = _rows(ya.reports().query(metrics=METRICS, **span).execute())
    per_video = _rows(ya.reports().query(metrics=METRICS, dimensions="video", sort="-views", maxResults=25, **span).execute())
    sources = _rows(ya.reports().query(metrics="views,estimatedMinutesWatched", dimensions="insightTrafficSourceType",
                                       sort="-views", **span).execute())
    try:   # where viewers are from (same yt-analytics.readonly scope; YouTube's country numbers lag 1-2 days)
        countries = _rows(ya.reports().query(metrics="views,estimatedMinutesWatched", dimensions="country", sort="-views",
                                             maxResults=25, **span).execute())
    except Exception as e:   # never stops the rest of the snapshot
        countries = [{"error": f"{type(e).__name__}: {str(e)[:160]}"}]
    comments = []
    for v in videos[:3]:
        try:
            got = yt.commentThreads().list(part="snippet", videoId=v["id"], maxResults=5, order="time", textFormat="plainText").execute()
            for c in got.get("items", []):
                top = c["snippet"]["topLevelComment"]["snippet"]
                comments.append({"video": v["title"], "text": top.get("textOriginal", "")[:300], "likes": top.get("likeCount", 0),
                                 "when": top.get("publishedAt")})
        except Exception:   # comments turned off on a video
            pass
    st = ch.get("statistics", {})
    return {"taken": date.today().isoformat(), "days": days, "from": start.isoformat(), "to": end.isoformat(),
            "channel": {"id": ch["id"], "title": ch["snippet"]["title"], "subscribers": int(st.get("subscriberCount", 0)),
                        "views": int(st.get("viewCount", 0)), "videos": int(st.get("videoCount", 0))},
            "videos": videos, "analytics": {"total": total[0] if total else {}, "per_video": per_video, "sources": sources,
                                            "countries": countries},
            "comments": comments,
            "not_available": "YouTube's API gives no impressions or click-through rate; read them in YouTube Studio when needed."}


def seconds(iso):
    """ISO 8601 duration (PT1M58S) -> seconds."""
    import re
    m = re.fullmatch(r"P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?", iso or "")
    if not m:
        return 0
    d, h, mi, s = (int(x or 0) for x in m.groups())
    return d * 86400 + h * 3600 + mi * 60 + s


def _ref(ref):
    """A channel link, @handle or channel id -> ('id', 'UC...') / ('handle', '@x') / ('user', 'x') / ('search', 'words')."""
    import re
    from urllib.parse import unquote, urlparse
    r = unquote(str(ref).strip())
    if re.fullmatch(r"UC[\w-]{22}", r):
        return "id", r
    if r.startswith("@"):
        return "handle", r.split("/")[0]
    if "youtube.com" in r or "youtu.be" in r:
        path = urlparse(r if "://" in r else "https://" + r).path.strip("/").split("/")
        if path and path[0].startswith("@"):
            return "handle", path[0]
        if len(path) > 1 and path[0] == "channel":
            return "id", path[1]
        if len(path) > 1 and path[0] == "user":
            return "user", path[1]
        if len(path) > 1 and path[0] == "c":
            return "search", path[1]
    return "search", r


def public_channel(ref, n=15):
    """Any channel's PUBLIC numbers (for Omar's rivals): who it is, and its last n uploads with views, likes, comments, length and
    upload time. Read-only; nothing private exists for someone else's channel anyway."""
    if _sim():
        return _fake_rival(ref, n)
    from googleapiclient.discovery import build
    yt = build("youtube", "v3", credentials=_creds(), cache_discovery=False)
    kind, val = _ref(ref)
    part = "snippet,statistics,contentDetails"
    if kind == "search":   # an old /c/ name or plain words: the best channel match (costs more quota, so only when adding)
        got = yt.search().list(part="snippet", q=val, type="channel", maxResults=1).execute().get("items", [])
        if not got:
            raise LookupError(f"No YouTube channel found for {ref!r}.")
        kind, val = "id", got[0]["snippet"]["channelId"]
    args = {"id": val} if kind == "id" else {"forHandle": val} if kind == "handle" else {"forUsername": val}
    items = yt.channels().list(part=part, **args).execute().get("items", [])
    if not items:
        raise LookupError(f"No YouTube channel found for {ref!r}.")
    ch = items[0]
    st = ch.get("statistics", {})
    out = {"id": ch["id"], "title": ch["snippet"]["title"], "handle": ch["snippet"].get("customUrl", ""),
           "subscribers": int(st.get("subscriberCount", 0)), "views": int(st.get("viewCount", 0)), "videos": int(st.get("videoCount", 0)),
           "recent": []}
    if n:
        pl = ch["contentDetails"]["relatedPlaylists"]["uploads"]
        ids = [i["contentDetails"]["videoId"] for i in
               yt.playlistItems().list(part="contentDetails", playlistId=pl, maxResults=min(50, n)).execute().get("items", [])]
        if ids:
            for v in yt.videos().list(part="snippet,statistics,contentDetails", id=",".join(ids)).execute().get("items", []):
                s = v.get("statistics", {})
                out["recent"].append({"id": v["id"], "title": v["snippet"]["title"], "published": v["snippet"]["publishedAt"],
                                      "seconds": seconds(v["contentDetails"].get("duration")), "views": int(s.get("viewCount", 0)),
                                      "likes": int(s.get("likeCount", 0)), "comments": int(s.get("commentCount", 0))})
            out["recent"].sort(key=lambda v: v["published"], reverse=True)
    return out


def _fake_rival(ref, n):
    import hashlib
    k = int(hashlib.md5(str(ref).encode()).hexdigest()[:6], 16)
    name = str(ref).rstrip("/").split("/")[-1].lstrip("@") or "Rival"
    today = date.today()
    recent = [{"id": f"r{k}{i}", "title": f"{name}: the story of {t}", "published": (today - timedelta(days=2 * i + 1)).isoformat() + "T16:00:00Z",
               "seconds": 55 if i % 3 else 840, "views": (k % 900 + 100) * (40 - i) * 10, "likes": (k % 900 + 100) * (40 - i) // 3,
               "comments": (k % 90 + 10) * (40 - i) // 10}
              for i, t in enumerate(["the siege that failed", "a king's worst idea", "the map that lied", "the empire's last day",
                                     "a war over a pig", "the bridge of boats"][:n])]
    return {"id": f"UCfake{k:018d}"[:24], "title": f"{name} (practice)", "handle": "@" + name.lower(), "subscribers": (k % 900 + 100) * 1000,
            "views": (k % 900 + 100) * 90000, "videos": 120, "recent": recent}


PRACTICE_NAMES = {3: "POV Then History", 5: "Storygraphics"}


def _fake(days, pid=3):
    """Practice mode: a small, believable channel."""
    today = date.today()
    vids = [{"id": f"vid{i}", "title": t, "published": (today - timedelta(days=3 * i + 1)).isoformat() + "T15:00:00Z",
             "duration": "PT1M58S", "views": v, "likes": v // 25, "comments": v // 120}
            for i, (t, v) in enumerate([("How a stick measured the whole Earth", 1840), ("The well at Syene at noon", 620),
                                        ("Why Rome feared a stone", 2950), ("The map that lied for 300 years", 410)])]
    per = [{"video": v["id"], "views": v["views"], "estimatedMinutesWatched": v["views"] * 1.2, "averageViewDuration": 71,
            "averageViewPercentage": 61.0 - i * 6, "subscribersGained": v["views"] // 90, "subscribersLost": 1, "likes": v["likes"],
            "comments": v["comments"], "shares": v["views"] // 200} for i, v in enumerate(vids)]
    return {"taken": today.isoformat(), "days": days, "from": (today - timedelta(days=days)).isoformat(), "to": today.isoformat(),
            "channel": {"id": f"UCpractice{int(pid)}", "title": f"{PRACTICE_NAMES.get(int(pid), f'Project {pid}')} (practice)",
                        "subscribers": 212, "views": 5820, "videos": 4},
            "videos": vids,
            "analytics": {"total": {"views": 5820, "estimatedMinutesWatched": 6984, "averageViewDuration": 72, "averageViewPercentage": 55.2,
                                    "subscribersGained": 64, "subscribersLost": 4, "likes": 232, "comments": 47, "shares": 29},
                          "per_video": per, "sources": [{"insightTrafficSourceType": "SHORTS", "views": 4900, "estimatedMinutesWatched": 5600},
                                                        {"insightTrafficSourceType": "YT_SEARCH", "views": 520, "estimatedMinutesWatched": 800}],
                          "countries": [{"country": c, "views": v, "estimatedMinutesWatched": v * 1.2} for c, v in
                                        [("US", 2380), ("IN", 720), ("GB", 610), ("LB", 340), ("CA", 300), ("DE", 210)]]},
            "comments": [{"video": vids[0]["title"], "text": "Wait, he did this with a STICK?", "likes": 12, "when": vids[0]["published"]}],
            "not_available": "YouTube's API gives no impressions or click-through rate; read them in YouTube Studio when needed."}
