# Agent HQ — Phase 1

Your first three real AI agents:

| Agent | Department | Job |
| --- | --- | --- |
| Atlas | Executive | The one you talk to. Routes your ideas and reports back. |
| Sage | Research | Researches an idea on the live web and writes a brief with sources. |
| Vera | Judgment | Scores the idea against the evidence and your settings, picks Path A or B. |

You pitch an idea to Atlas. Sage researches it, Vera judges it, Atlas tells you the verdict.
The full research is saved in the `briefs/` folder.

## Setup on Windows (easiest)

1. Get an API key at https://console.anthropic.com (add a few dollars of credit and set a spend limit).
2. Double-click `START-HERE.bat`. It installs what's needed, asks for your key once, and opens
   the live office in your browser, where you chat with Atlas and watch the team work.
   Next time, double-click it again. Keep its window open while you use the office.

## Setup by hand (any computer)

1. Install Python 3.10 or newer.
2. In this folder, run:
   ```
   pip install -r requirements.txt
   ```
3. Get an API key at https://console.anthropic.com
   - Add a small amount of credit (e.g. $5).
   - Under Limits, set a monthly spend limit. That is a second safety net on top of the caps in `settings.py`.
4. Copy `.env.example` to `.env` and paste your key into it. Never share this file.
5. Open `settings.py` and adjust your goals, limits and off-limits categories.

## Use it

The office (recommended): double-click START-HERE, or run `python server.py`.

Terminal only:

```
python main.py            # chat with Atlas
python main.py status     # every idea, its verdict and what it cost
python main.py stop       # kill switch: every agent stops before its next step
python main.py resume     # turn the kill switch off
```

Try without a key first (canned answers, costs nothing):
```
HQ_SIMULATE=1 python main.py          # macOS / Linux
set HQ_SIMULATE=1 && python main.py   # Windows
```

## What it costs

One idea is roughly 5–8 web searches plus reading and writing, about $0.15–0.50.
Hard limits in `settings.py` (default $1 per idea, $3 per day) are checked before every
model call, and the agent stops when one is reached.

## How it is built

- `settings.py` — your goals and money limits. The only file you need to edit.
- `control_plane.py` — plain code, no AI: agent registry, tool permissions (default deny),
  audit log, cost tracking, budget caps, kill switch. Everything is stored in `hq.db`.
- `llm.py` — the agent loop: call the model, run the tools it asks for, repeat.
- `agents.py` — Atlas, Sage and Vera: their instructions and tools.
- `server.py` + `office.html` — the live office in your browser (http://localhost:8765).
- `main.py` — the same chat in a terminal.
- `simulate.py` — fake model for free testing.

## Updates

Every time you double-click START-HERE it checks github.com/Mismail933/agent-hq for a newer
version and installs it. Your key (.env), your data (hq.db, briefs/) and your own settings
(settings_local.py) are never touched.

## Next steps

- Add the Ideas department, so new ideas arrive without you pitching them.
- Add Finance and the owner inbox for Path B funding requests.
