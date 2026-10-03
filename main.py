"""
Agent HQ: talk to Atlas.

    python main.py              chat with Atlas
    python main.py status       ideas, verdicts and spend
    python main.py stop         kill switch: stop every agent
    python main.py resume       turn the kill switch off
"""
import os
import sys
import time
from pathlib import Path

ROOT = Path(__file__).parent

if os.name == "nt":
    os.system("")  # turn on colors in the Windows console
for stream in (sys.stdout, sys.stderr):
    try:
        stream.reconfigure(encoding="utf-8")
    except Exception:
        pass


def load_env():
    env = ROOT / ".env"
    if env.exists():
        for line in env.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


load_env()
sys.path.insert(0, str(ROOT))
import agents             # noqa: E402
import control_plane as cp  # noqa: E402
import settings           # noqa: E402

DIM, BOLD, RESET = "\033[2m", "\033[1m", "\033[0m"
COLORS = {"Atlas": "\033[35m", "Sage": "\033[36m", "Vera": "\033[31m"}


def show_event(ev):
    a, k, d = ev["agent"], ev["kind"], ev["detail"]
    c = COLORS.get(a, "")
    line = {
        "idea_routed": f"Atlas sent the idea to Sage in Research",
        "task_started": f"{a} started working",
        "web_search": f"{a} searched: {d.get('query', '')}",
        "brief_written": f"{a} wrote the brief: briefs/{d.get('path')} ({d.get('sources')} sources)",
        "handoff": f"{a} handed the brief to Vera in Judgment",
        "verdict": f"{a} decided: {d.get('verdict')} (Path {d.get('path')})",
        "halted": f"Stopped: {d.get('reason')}",
        "permission_denied": f"Blocked: {a} tried to use {d.get('tool')}",
    }.get(k)
    if line:
        print(f"  {c}●{RESET} {DIM}{line}{RESET}", flush=True)


def status():
    cp.init()
    ideas = cp.list_ideas()
    print(f"\n{BOLD}Spend today:{RESET} ${cp.spend_today():.3f} of ${settings.DAILY_AI_BUDGET_USD:.2f} cap")
    print(f"{BOLD}Kill switch:{RESET} {'ON' if cp.STOP_FILE.exists() else 'off'}\n")
    if not ideas:
        print("No ideas yet. Run `python main.py` and pitch one to Atlas.")
    for i in ideas:
        print(f"#{i['id']:<3} {i['title'][:60]:<60} {str(i['verdict'] or i['status']):<24} Path {i['path'] or '-'}  ${i['cost_usd']:.3f}")
    print()


def chat():
    cp.init()
    agents.register_all()
    cp.mark_interrupted()
    cp.on_event(show_event)
    atlas = agents.Atlas()
    sim = " (simulated mode)" if os.environ.get("HQ_SIMULATE") == "1" else ""
    print(f"\n{BOLD}Agent HQ{RESET}{sim}: you're talking to Atlas. Type an idea, a question, or 'quit'.")
    print(f"{DIM}Budget: ${settings.DAILY_AI_BUDGET_USD:.2f}/day, ${settings.PER_IDEA_BUDGET_USD:.2f}/idea. "
          f"Spent today: ${cp.spend_today():.3f}{RESET}\n")
    while True:
        try:
            text = input(f"{BOLD}You:{RESET} ").strip()
        except (EOFError, KeyboardInterrupt):
            print(); break
        if not text:
            continue
        if text.lower() in {"quit", "exit", "q"}:
            break
        t0 = time.time()
        reply = atlas.chat(text)
        print(f"\n{COLORS['Atlas']}{BOLD}Atlas:{RESET} {reply}")
        print(f"{DIM}({time.time() - t0:.0f}s · spent today ${cp.spend_today():.3f}){RESET}\n")


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "chat"
    if cmd == "status":
        status()
    elif cmd == "stop":
        cp.STOP_FILE.write_text("stop"); print("Kill switch ON. Every agent stops before its next step.")
    elif cmd == "resume":
        cp.STOP_FILE.unlink(missing_ok=True); print("Kill switch off.")
    else:
        chat()
