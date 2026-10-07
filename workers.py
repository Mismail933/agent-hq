"""
Run the worker agents (Doulya, Sage, Vera, Serge) through Claude Code on the owner's Claude subscription.

Each run is a fresh one-shot `claude -p`: the agent's own system prompt instead of Claude Code's, only the tools
it needs, and a JSON schema when its answer must be structured. Every run is recorded in the usage table.
Anything that stops a run (not signed in, plan limit reached, the agent's daily allowance used up, a timeout)
raises Unavailable, and the caller falls back to the API with its dollar caps.
"""
import json
import os
import subprocess
import time
from pathlib import Path

import atlas_engine
import control_plane as cp
import settings

WORK = Path.home() / "Agent-HQ-workers"   # empty folders, so no project files or CLAUDE.md leak into a run

# Claude Code's names for the tools our prompts call web_search and web_fetch
CC_NOTE = ("\n\nIn this session your tools are named WebSearch and WebFetch. The limits above still apply: count your "
           "searches and page reads yourself.")


class Unavailable(Exception):
    """This run can't go through the subscription; the message says why."""


def engine(agent):
    forced = os.environ.get("HQ_WORKER_ENGINE")
    if forced:
        return forced
    if os.environ.get("HQ_SIMULATE") == "1":
        return "api"   # practice mode stays free
    return getattr(settings, "WORKER_ENGINE", {}).get(agent, "api")


def _extra(agent):
    """Standing instructions Atlas set for this agent (live rule prompt.<agent>.extra)."""
    try:
        import rules
        return rules.extra(agent)
    except Exception:
        return ""


def run(agent, idea_id, system, prompt, tools=(), schema=None, max_turns=20, cwd=None, allowed=None, disallowed=(), timeout=None):
    """One run. Returns (structured output or result text, info). Raises Unavailable or cp.Halt.
    cwd: work in that folder instead of the agent's empty one (Ghassan works in his copy of the code); allowed/disallowed:
    permission rules (e.g. "Bash(git diff*)") instead of the plain tool names."""
    if cp.STOP_FILE.exists():
        raise cp.Halt("Kill switch is on (STOP file exists). Delete it to resume.")
    cap = getattr(settings, "SUBSCRIPTION_DAILY_VALUE_USD", {}).get(agent)
    used = cp.subscription_value_today(agent)
    if cap is not None and used >= cap:
        raise Unavailable(f"{agent}'s daily subscription allowance is used up (${used:.2f} of ${cap:.2f} API value).")
    exe = atlas_engine.find_claude()
    if not exe:
        raise Unavailable("Claude Code isn't installed on this computer.")
    folder = Path(cwd) if cwd else WORK / agent.lower()
    folder.mkdir(parents=True, exist_ok=True)
    model = getattr(settings, "WORKER_MODELS", {}).get(agent, "sonnet")
    cmd = [exe, "-p", "--output-format", "json", "--no-session-persistence", "--max-turns", str(max_turns),
           "--model", model, "--system-prompt", system + _extra(agent) + (CC_NOTE if tools else ""), "--tools", ",".join(tools)]
    if tools:
        cmd += ["--allowedTools", *(allowed or tools)]
    if disallowed:
        cmd += ["--disallowedTools", *disallowed]
    if schema:
        cmd += ["--json-schema", json.dumps(schema)]
    t0 = time.time()
    try:
        p = subprocess.run(cmd, input=prompt, cwd=folder, env=atlas_engine._env(), capture_output=True, text=True,
                           encoding="utf-8", errors="replace", timeout=timeout or getattr(settings, "WORKER_TIMEOUT_SECONDS", 900),
                           creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
    except subprocess.TimeoutExpired:
        raise Unavailable("Claude Code took too long.")
    try:
        out = json.loads(p.stdout.strip().splitlines()[-1])
    except (ValueError, IndexError):
        raise Unavailable((p.stderr or p.stdout or f"Claude Code exited with code {p.returncode}").strip()[:300])
    secs = round(time.time() - t0, 1)
    searches = sum((m or {}).get("webSearchRequests", 0) or 0 for m in (out.get("modelUsage") or {}).values())
    ok = not out.get("is_error") and out.get("subtype") == "success"
    cp.record_usage(agent, "subscription", model, idea_id, out.get("usage"), searches, out.get("num_turns"), secs,
                    out.get("total_cost_usd"), ok)
    info = {"engine": "subscription", "model": model, "turns": out.get("num_turns"), "secs": secs, "searches": searches,
            "api_value_usd": round(out.get("total_cost_usd") or 0, 4)}
    cp.log(agent, "model_call", idea_id, info)
    if not ok:
        raise Unavailable(str(out.get("result") or out.get("subtype") or "unknown error")[:300])
    if schema:
        got = out.get("structured_output")
        if not isinstance(got, dict):
            raise Unavailable("Claude Code finished without the structured answer.")
        return got, info
    return (out.get("result") or "").strip(), info


def fallback(agent, idea_id, reason):
    """Note that this run is going to the API instead, and why."""
    cp.log(agent, "fallback_api", idea_id, {"reason": str(reason)[:200]})
