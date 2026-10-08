"""
Checkpoints (Atlas's "No agent ever starts from zero after a stop", 2026-10-08).

A saved job (server.journaled) records each step it finishes here: `done("scripts saved", {...})`. When the same job runs again
(after a restart, a crash, an allowance stop, or `hq resume <job>`), `get(step)` returns what that step left, so the job skips it
and goes on from the last finished one. Steps belong to the job row in hq.db's `jobs` table (table `job_steps`, same file).
Live rule `jobs.resume_steps`: off = nothing is skipped (start over).
"""
import json
import threading
import time

import control_plane as cp
import rules

_NOW = threading.local()   # the saved job this thread is running (set by server.journaled)


def _db():
    con = cp._db()
    con.execute("CREATE TABLE IF NOT EXISTS job_steps (job INTEGER, n INTEGER, step TEXT, ts REAL, data TEXT, PRIMARY KEY (job, step))")
    return con


def begin(jid):
    _NOW.jid = jid


def end():
    _NOW.jid = None


def current():
    return getattr(_NOW, "jid", None)


def done(step, data=None):
    """The running job finished `step`; `data` (JSON) is what a resume needs to skip it."""
    jid = current()
    if not jid:
        return
    with _db() as con:
        r = con.execute("SELECT n FROM job_steps WHERE job=? AND step=?", (jid, step)).fetchone()
        n = r["n"] if r else con.execute("SELECT COALESCE(MAX(n),0)+1 n FROM job_steps WHERE job=?", (jid,)).fetchone()["n"]
        con.execute("INSERT OR REPLACE INTO job_steps (job, n, step, ts, data) VALUES (?,?,?,?,?)",
                    (jid, n, step, time.time(), json.dumps(data if data is not None else {})))


def get(step):
    """What `step` left in an earlier run of this job, or None (not finished, no saved job, or rule jobs.resume_steps off)."""
    jid = current()
    if not jid or not rules.get("jobs.resume_steps"):
        return None
    with _db() as con:
        r = con.execute("SELECT data FROM job_steps WHERE job=? AND step=?", (jid, step)).fetchone()
    return json.loads(r["data"]) if r else None


def steps(jid):
    with _db() as con:
        return [{"n": r["n"], "step": r["step"], "ts": r["ts"]} for r in
                con.execute("SELECT n, step, ts FROM job_steps WHERE job=? ORDER BY n", (jid,)).fetchall()]


def last(jid):
    """(n, step name) of the last finished step of a job, or None."""
    s = steps(jid)
    return (s[-1]["n"], s[-1]["step"]) if s else None


def resumed_from(jid):
    """'resumed from step N (name)' for a job that has finished steps, else ''."""
    s = last(jid)
    return f"resumed from step {s[0]} ({s[1]})" if s and rules.get("jobs.resume_steps") else ""
