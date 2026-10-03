# Agent HQ

Your AI company. The team so far:

| Agent | Department | Job |
| --- | --- | --- |
| Atlas | Executive | General Manager. The only one you talk to. Briefs you on everything and routes work. |
| Doulya | Ideas | Idea Scout. Once a day she finds ideas that are making money now and puts her top 2 in your Idea Inbox. |
| Sage | Research | Researches an idea on the live web and writes a brief with sources. |
| Vera | Judgment | Scores the idea against the evidence and your settings, picks Path A or B. |
| Serge | Product | Product Owner. When you ask, turns an approved idea into a plan and a budget request for your approval. |
| Calina | Content | Content Producer. Writes batches of sourced YouTube Shorts scripts for you to approve one by one, turns approved ones into finished Shorts, and writes a weekly learning note from your channel stats. |
| Richard | Learning & Dev | Every morning, in the cloud, he researches how to make the company better and brings you 1-2 ideas in the L&D tab. Yes goes to Atlas to prioritise. |

Doulya's picks wait in your Idea Inbox. Nothing is researched until you click **Research it** (or tell Atlas yes).
Dismiss an idea with a reason and Doulya steers away from similar ones. You can also pitch your own ideas to Atlas.
The full research is saved in the `briefs/` folder.

When Vera approves an idea, open it under **Ideas → Judged** and click **Make a plan with Serge** (or tell Atlas).
His plan lands under **Ideas → Plans**: goal, a cheap first experiment, week-by-week milestones, who does what, and a
budget with real prices. You **Approve**, **Ask for changes** (up to 2 times) or **Reject**. A plan over your
per-project limits can't be approved. Approving only records the budget as that project's ceiling: nothing is bought.
Plans are saved in the `plans/` folder.

## Atlas runs on Claude Code

Atlas, in the office chat, is Claude Code working in your `Atlas-HQ` folder (in your user folder). He uses your
Claude subscription, not the API key, so only the other agents spend API credit. The first time, START-HERE asks you
to sign in to your Claude account once. His role and rules are in `atlas/CLAUDE.md`; he checks and runs the company
with `hq.py`, keeps a journal of your decisions in `Atlas-HQ/atlas-journal.md`, and queues work that needs code in
`Atlas-HQ/requests-for-builder.md`. You can also open the `Atlas-HQ` folder in the Claude app to talk to him there.
If Claude Code isn't available, a small backup Atlas on the API key answers instead and says so.

## The team runs on your Claude subscription too

Doulya, Sage, Vera and Serge also run through Claude Code on your Claude plan, each with only their own job
description and tools. Each one has a daily allowance in `settings.py` (`SUBSCRIPTION_DAILY_VALUE_USD`), measured as
what the same work would cost on the API, so the team can't use up the plan you need for your own chats. If a run
can't use the subscription (plan limit reached, signed out, allowance used up), it automatically uses the API key
instead, with the usual dollar caps, and the office shows it. The Crew tab shows each agent's plan use today.
You change all of this in the office's **Limits** tab: where each agent runs (subscription or API key), its model,
its daily plan allowance and API cap, and the company's daily API cap, per-idea cap and per-project budget. Changes
apply at once, survive updates and show in Activity. Atlas can change them too, but only when you ask him.

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
- `agents.py` — Doulya, Sage, Vera and the backup Atlas: their instructions and tools.
- `atlas_engine.py` + `atlas/CLAUDE.md` — Atlas on Claude Code; `hq.py` — his controls.
- `server.py` + `office.html` — the live office in your browser (http://localhost:8765).
- `main.py` — the same chat in a terminal.
- `simulate.py` — fake model for free testing.

## Updates

Every time you double-click START-HERE it checks github.com/Mismail933/agent-hq for a newer
version and installs it. Your key (.env), your data (hq.db, briefs/) and your own settings
(settings_local.py) are never touched.

## Next steps

- Builders and QA, chosen per idea.
- Then Finance, Marketing and Reporting.
