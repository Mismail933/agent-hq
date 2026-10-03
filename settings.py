"""
Owner settings for Agent HQ.

This is the one file you edit. The agents read it on every run.
Money limits here are enforced in code (control_plane.py), not just told to the agents.
"""

# ---- Models -----------------------------------------------------------------
# Atlas only routes and talks, so it uses the cheap fast model.
# Sage and Vera do the thinking, so they use the stronger one.
MODELS = {
    "atlas": "claude-haiku-4-5-20251001",
    "sage": "claude-sonnet-5-5",
    "vera": "claude-sonnet-5-5",
    "doulya": "claude-sonnet-5-5",
    "serge": "claude-sonnet-5-5",
    "calina": "claude-sonnet-5-5",
}

# ---- Where the workers run ----------------------------------------------------
# "claude_code": on your Claude subscription through Claude Code, like Atlas. If that can't run (not signed in,
#                plan limit reached, the agent's daily allowance below used up), the run falls back to the API.
# "api":         on your API key, with the dollar caps further down.
WORKER_ENGINE = {"Doulya": "claude_code", "Sage": "claude_code", "Vera": "claude_code", "Serge": "claude_code",
                 "Calina": "claude_code"}
WORKER_MODELS = {"Doulya": "sonnet", "Sage": "sonnet", "Vera": "sonnet", "Serge": "sonnet", "Calina": "sonnet"}   # or "opus"
# Daily allowance per agent on the subscription, measured as what the same work would cost on the API
# (the only meter Claude Code reports). Protects your plan's limits for you, the Builder and Atlas.
SUBSCRIPTION_DAILY_VALUE_USD = {"Doulya": 2.00, "Sage": 6.00, "Vera": 2.00, "Serge": 3.00, "Calina": 6.00}
WORKER_TIMEOUT_SECONDS = 900

# Price per million tokens (input, output) in USD. Matched by model-name prefix.
# Check https://claude.com/pricing and update if prices change.
PRICES_PER_MTOK = {
    "claude-haiku-4-5": (1.00, 5.00),
    "claude-sonnet-5-5": (2.00, 10.00),
    "claude-opus-5-5": (4.00, 20.00),
}
WEB_SEARCH_PRICE_USD = 0.01  # $10 per 1,000 searches

# ---- Hard money limits (enforced by the control plane) ----------------------
DAILY_AI_BUDGET_USD = 3.00     # all agents together, per calendar day
PER_IDEA_BUDGET_USD = 1.00     # research + judgment for one idea
SAGE_MAX_SEARCHES = 8          # web searches Sage may run per idea

# ---- Doulya, the Idea Scout ----------------------------------------------------
DOULYA_MAX_SEARCHES = 6        # web searches per scouting round
DOULYA_PICKS = 2               # ideas she puts in your inbox each round
SCOUT_AUTOMATICALLY = True     # scout once a day while Agent HQ is running
# Her pitches wait in your Idea Inbox. Nothing is researched until you approve it.

# ---- Reading full pages (Sage and Doulya) -------------------------------------
PAGE_READS_PER_RUN = 3          # full web pages per idea (Sage) or per scouting round (Doulya)
PAGE_READ_MAX_TOKENS = 15000    # longest page read in one go (about 11,000 words)

# ---- Serge, the Product Owner ---------------------------------------------------
PLAN_MAX_SEARCHES = 3           # web searches per plan, to check real prices
PLAN_MAX_REVISIONS = 2          # times the owner can "ask for changes" on one plan
# Serge only plans when the owner says so. His budget request is checked against
# OWNER["max_new_spend_per_project_usd"] and OWNER["max_monthly_spend_per_project_usd"] below.

# ---- Calina, the Content Producer ------------------------------------------------
CALINA_BATCH_SIZE = 6           # scripts per batch, unless the owner asks for another number
CALINA_MAX_SEARCHES = 12        # web searches per batch, to find and check sources

# Per-agent daily caps (inside the overall daily budget above)
AGENT_DAILY_BUDGET_USD = {"Doulya": 0.60, "Serge": 1.00, "Calina": 1.50}
# Agents with their own cap per idea, outside PER_IDEA_BUDGET_USD (all of Serge's plan revisions for one idea)
AGENT_IDEA_BUDGET_USD = {"Serge": 0.60}

# ---- Atlas, the General Manager ----------------------------------------------
# "claude_code": the office chat is Claude Code running in your Atlas-HQ folder (C:\Users\<you>\Atlas-HQ),
#                on your Claude subscription, not the API key. His role is in atlas/CLAUDE.md.
# "api":         the small built-in Atlas on the API key. It also answers automatically when Claude Code can't.
ATLAS_ENGINE = "claude_code"
ATLAS_CLAUDE_MODEL = "opus"      # Claude Code model for Atlas; None = your Claude Code default
ATLAS_TIMEOUT_SECONDS = 300      # longest Atlas may take for one reply
ATLAS_MAX_TURNS = 20             # most steps (checks, notes) Atlas may take for one reply

# ---- What you want from the business ----------------------------------------
# Vera judges every idea against these. Change them to match your goals.
OWNER = {
    "target_monthly_revenue_usd": 1000,
    "max_new_spend_per_project_usd": 100,
    "max_monthly_spend_per_project_usd": 30,
    "risk_appetite": "medium",            # low / medium / high
    "traction_window_weeks": 6,           # no paying customer by then -> kill
    "location": "Lebanon",
    "skills": "software engineer; can build web apps, scripts and automations",
    "hours_per_week_owner_can_give": 3,
    "off_limits": [
        "NFTs and crypto tokens",
        "gambling and betting",
        "adult content",
        "medical, legal or financial advice products",
        "anything deceptive: fake reviews, spam, impersonation, misleading claims",
        "anything that breaks a platform's terms of service",
    ],
}


# ---- Your own overrides ------------------------------------------------------
# Updates replace this file. To change a limit permanently, put it in
# settings_local.py (same names, e.g. DAILY_AI_BUDGET_USD = 5.00). That file
# is never touched by updates.
try:
    from settings_local import *  # noqa: F401,F403
except ImportError:
    pass
