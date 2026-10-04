"""
Simulated model for testing without an API key: HQ_SIMULATE=1 python main.py
It imitates Anthropic API responses so the whole pipeline (tools, budgets,
logging, briefs) can be checked for free. Answers are canned, not real research.
"""
import json
import os
import time
import uuid
from types import SimpleNamespace as NS


def _id():
    return "toolu_" + uuid.uuid4().hex[:12]


def _usage(i, o, s=0):
    return NS(input_tokens=i, output_tokens=o, cache_creation_input_tokens=0, cache_read_input_tokens=0,
              server_tool_use=NS(web_search_requests=s))


def _text(t, citations=None):
    return NS(type="text", text=t, citations=citations)


class _Messages:
    def __init__(self):
        self.paused = set()

    def create(self, model, system, messages, max_tokens, tools=None, tool_choice=None):
        if tool_choice and tool_choice.get("type") in ("tool", "any"):   # like the real 5.5 models
            raise ValueError('tool_choice: type "tool" and "any" are not supported for this model.')
        time.sleep(float(os.environ.get("HQ_SIM_DELAY", "0")))
        last = messages[-1]["content"]
        if system.startswith("You are Doulya"):
            key = id(messages)
            if key not in self.paused:
                self.paused.add(key)
                q = NS(type="server_tool_use", id="srvtoolu_" + uuid.uuid4().hex[:8], name="web_search",
                       input={"query": "trending digital products selling now"})
                r = NS(type="web_search_tool_result", tool_use_id=q.id,
                       content=[NS(type="web_search_result", url="https://example.com/trending", title="Example trends")])
                return NS(stop_reason="pause_turn", usage=_usage(3000, 100, 1), content=[q, r])
            n = len([m for m in messages if m["role"] == "assistant"])
            pitches = [{"title": f"Simulated idea {n}{k}: AI-made printable planners for a niche", "pitch": "Simulated pitch.",
                        "why_now": "Simulated signal.", "who_pays": "Simulated buyers", "how_it_makes_money": "One-off sales",
                        "startup_cost_usd": 20, "hours_per_week": 3, "risks": ["Simulated risk"],
                        "evidence": [{"fact": "Simulated fact", "url": "https://example.com/evidence"}],
                        "confidence": "medium"} for k in "ab"]
            return NS(stop_reason="tool_use", usage=_usage(6000, 700, 1),
                      content=[NS(type="tool_use", id=_id(), name="submit_pitches", input={"pitches": pitches})])

        if system.startswith("You are Atlas"):
            if isinstance(last, list):  # tool results came back
                res = last[0]["content"]
                return NS(stop_reason="end_turn", usage=_usage(1800, 220),
                          content=[_text("[Simulated Atlas] Here is what the team found:\n" + res[:900])])
            low = last.lower()
            if "scout" in low:
                call = NS(type="tool_use", id=_id(), name="scout_now", input={})
            elif any(w in low for w in ["inbox", "doulya"]):
                call = NS(type="tool_use", id=_id(), name="list_inbox", input={})
            elif any(w in low for w in ["update", "briefing", "going on"]):
                call = NS(type="tool_use", id=_id(), name="company_status", input={})
            elif any(w in low for w in ["working on", "ideas", "status"]):
                call = NS(type="tool_use", id=_id(), name="list_ideas", input={})
            elif any(w in low for w in ["spend", "cost", "budget"]):
                call = NS(type="tool_use", id=_id(), name="spend_report", input={})
            else:
                call = NS(type="tool_use", id=_id(), name="route_idea", input={"idea": last.strip()[:200], "owner_notes": ""})
            return NS(stop_reason="tool_use", usage=_usage(1500, 80),
                      content=[_text("Sending this to the team."), call])

        if system.startswith("You are Sage"):
            key = id(messages)
            if key not in self.paused:  # imitate a long search that pauses once
                self.paused.add(key)
                q = NS(type="server_tool_use", id="srvtoolu_" + uuid.uuid4().hex[:8], name="web_search",
                       input={"query": "demand for " + messages[0]["content"][17:60]})
                r = NS(type="web_search_tool_result", tool_use_id=q.id,
                       content=[NS(type="web_search_result", url="https://example.com/market-report", title="Example market report")])
                return NS(stop_reason="pause_turn", usage=_usage(4000, 120, 1), content=[q, r])
            q = NS(type="server_tool_use", id="srvtoolu_" + uuid.uuid4().hex[:8], name="web_search",
                   input={"query": "competitors pricing"})
            cite = NS(type="web_search_result_location", url="https://example.com/competitors", title="Example competitor list", cited_text="...")
            brief = ("## The idea (one line)\nSimulated brief.\n## Who would pay, and how much\nSimulated.\n"
                     "## Demand evidence\nSimulated evidence.\n## Competitors and prices\nSimulated.\n"
                     "## Platform rules, legal and policy risks\nSimulated.\n## Red flags\nSimulated.\n## Angles that could work\nSimulated.")
            return NS(stop_reason="end_turn", usage=_usage(9000, 900, 1),
                      content=[q, NS(type="web_search_tool_result", tool_use_id=q.id, content=[]), _text(brief, [cite])])

        if system.startswith("You are Vera"):
            verdict = {"verdict": "approve_smaller_version", "one_line_summary": "Simulated verdict.", "path": "A",
                       "scores": {"demand": 6, "competition": 7, "cost": 3, "risk": 5},
                       "key_evidence": ["Simulated fact 1", "Simulated fact 2", "Simulated fact 3"],
                       "main_risks": ["Simulated risk"], "recommended_version": "A smaller simulated version",
                       "new_money_needed": "", "estimated_monthly_revenue": "$0-100 (simulated)",
                       "kill_criteria": "No paying customer in 6 weeks", "first_step": "Simulated first step"}
            return NS(stop_reason="tool_use", usage=_usage(3000, 400),
                      content=[NS(type="tool_use", id=_id(), name="submit_verdict", input=verdict)])
        if system.startswith("You are Serge"):
            # The first draft is over the owner's $100 limit, so the "fit the limits" retry gets exercised.
            fitted = isinstance(last, list) and any(isinstance(x, dict) and x.get("type") == "tool_result" for x in last)
            plan = {"summary": "Simulated plan: sell a small version to a few paying customers first.",
                    "goal": "3 paying customers in 6 weeks", "success_metric": "3 paying customers",
                    "non_goals": ["No mobile app"],
                    "first_experiment": {"hypothesis": "People will pay $20", "test": "Landing page + 50 outreach messages",
                                         "success_gate": "3 pre-orders", "cost_usd": 12, "days": 7},
                    "milestones": [{"week": 1, "goal": "Landing page live", "tasks": [
                                       {"task": "Write the offer", "owner": "owner", "hours": 2},
                                       {"task": "Build the page", "owner": "hire: web developer", "hours": 4}]},
                                   {"week": 2, "goal": "50 prospects contacted", "tasks": [
                                       {"task": "Outreach", "owner": "hire: marketing", "hours": 5}]}],
                    "owner_hours_per_week": 3, "hires_needed": ["web developer", "marketing"],
                    "budget": [{"item": "Domain", "vendor": "Namecheap", "kind": "one_off", "usd": 12, "why": "Landing page",
                                "when_week": 1, "source_url": "https://example.com/domain-price"},
                               {"item": "Email tool", "vendor": "Example", "kind": "monthly", "usd": 9, "why": "Outreach",
                                "when_week": 2, "source_url": "https://example.com/email-price"},
                               {"item": "Ads test", "vendor": "Example Ads", "kind": "one_off", "usd": 30 if fitted else 120,
                                "why": "Traffic", "when_week": 2}],
                    "trade_offs": ["Manual outreach instead of paid tools"],
                    "risks": [{"risk": "No one replies", "mitigation": "Change the offer in week 3"}],
                    "kill_criteria": "No paying customer in 6 weeks"}
            return NS(stop_reason="tool_use", usage=_usage(7000, 1500, 0 if fitted else 1),
                      content=[NS(type="tool_use", id=_id(), name="submit_plan", input=plan)])
        if system.startswith("You are Calina") and "as SCENE FILES" in system:
            def ep3(place, year):
                kit = ["court", "library", "nile", "well", "study", "map", "court", "study", "nile"]
                lines = [f"It is {year}, and you wake up in {place}.", "The street smells of bread and smoke.",
                         "A stranger hands you a sealed letter.", "Nobody here can read it but you.",
                         "Inside is a map to the city's lost well.", "By noon, the whole market is following you.",
                         "The well is real, and the water is sweet.", "That map still hangs in the museum today.",
                         "A letter, a well, a city saved."]
                return {"title": f"POV: {place}, {year}, the lost well", "place": place, "year": year, "hook": lines[0],
                        "storyline": "A stranger, a letter, a lost well (simulated).", "surprising_fact": "Simulated fact.",
                        "scenes": [{"n": i + 1, "voice_line": l, "backdrop": kit[i], "camera": ["push_in", "pan_left", "pull_out"][i % 3],
                                    "characters": [{"who": "narrator", "pose": "point", "at": "left"}] if i in (0, 5) else [],
                                    "map": {"focus": [30, 30], "zoom": 40, "pins": []} if kit[i] == "map" else None,
                                    "source_note": "Example Museum"} for i, l in enumerate(lines)],
                        "sources": [{"url": "https://example.com/source", "quote": "Simulated quote", "publisher": "Example Museum"}],
                        "description": "Simulated description.", "hashtags": ["#history", "#shorts"]}
            batch = {"episodes": [ep3("Fez", "1350"), ep3("Kyoto", "1600"), ep3("Lima", "1700")], "batch_note": "Simulated scene-file batch."}
            return NS(stop_reason="tool_use", usage=_usage(9000, 3000, 2),
                      content=[NS(type="tool_use", id=_id(), name="submit_batch", input=batch)])
        if system.startswith("You are Calina") and "as shot lists" in system:
            def ep(place, year):
                lines = [f"It is {year}, and you wake up in {place}.", "The street smells of bread and smoke.",
                         "A stranger hands you a sealed letter.", "Nobody here can read it but you.",
                         "Inside is a map to the city's lost well.", "By noon, the whole market is following you.",
                         "The well is real, and the water is sweet.", "That map still hangs in the museum today."]
                return {"title": f"POV: {place}, {year}, the lost well", "place": place, "year": year, "hook": lines[0],
                        "storyline": "A stranger, a letter, a lost well (simulated).", "surprising_fact": "Simulated fact.",
                        "shots": [{"n": i + 1, "premium": i == 0, "image_prompt": f"Simulated image prompt {i + 1}, 9:16",
                                   "motion_prompt": f"Simulated motion prompt {i + 1}", "voice_line": l,
                                   "uses_narrator": i in (0, 5), "source_note": "Example Museum"} for i, l in enumerate(lines)],
                        "voice_direction": "calm, warm, unhurried",
                        "sources": [{"url": "https://example.com/source", "quote": "Simulated quote", "publisher": "Example Museum"}],
                        "description": "Simulated description.\nAI-assisted: script, voice and visuals made with AI; facts sourced below.",
                        "hashtags": ["#history", "#shorts"]}
            batch = {"episodes": [ep("Fez", "1350"), ep("Kyoto", "1600"), ep("Lima", "1700")],
                     "narrator": "A silver-haired woman in a long indigo travelling coat, with a brass compass (simulated).",
                     "style": "Photoreal, golden-hour light, 35mm film look, vertical 9:16 (simulated).", "batch_note": "Simulated v2 batch."}
            return NS(stop_reason="tool_use", usage=_usage(9000, 3000, 2),
                      content=[NS(type="tool_use", id=_id(), name="submit_batch", input=batch)])
        if system.startswith("You are Calina"):
            if "Your job now: read the owner's stats" in system:
                return NS(stop_reason="end_turn", usage=_usage(3000, 400),
                          content=[_text("## What worked\nSimulated learning note.\n## Next batch\nMore Roman-era hooks.")])
            eps = [{"title": f"POV: you live in {place}", "place": place.split(",")[0], "year": place.split(", ")[-1],
                    "hook": f"It's {place.split(', ')[-1]} and the city smells of smoke.",
                    "script": "Simulated script of about 120 words. " * 6, "surprising_fact": "A simulated fact.",
                    "storyline": "Setting, turn, payoff (simulated).",
                    "sources": [{"url": "https://example.com/source", "quote": "Simulated quote", "publisher": "Example Museum"}],
                    "image_queries": ["simulated query"], "description": "Simulated description.\nAI-assisted: script and voice "
                    "made with AI; facts sourced below.", "hashtags": ["#history", "#shorts"]}
                   for place in ("Pompeii, 79 AD", "Edo, 1657", "London, 1858")]
            return NS(stop_reason="tool_use", usage=_usage(9000, 2500, 2),
                      content=[NS(type="tool_use", id=_id(), name="submit_batch", input={"episodes": eps, "batch_note": "Simulated batch."})])
        raise ValueError("Unknown agent in simulation")


class FakeClient:
    def __init__(self):
        self.messages = _Messages()
