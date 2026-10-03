"""
The agent loop: send the task to the model, run the tools it asks for
(after the control plane approves), send results back, repeat until done.
"""
import os
import re

import control_plane as cp

MAX_TURNS = 12
_client = None


def client():
    global _client
    if _client is None:
        if os.environ.get("HQ_SIMULATE") == "1":
            from simulate import FakeClient
            _client = FakeClient()
        else:
            import anthropic
            if not os.environ.get("ANTHROPIC_API_KEY"):
                raise cp.Halt("ANTHROPIC_API_KEY is not set. Put it in the .env file (see README).")
            _client = anthropic.Anthropic(max_retries=5)  # rides out brief overloads and rate limits
    return _client


def run(agent, model, system, messages, tools=None, tool_choice=None,
        handlers=None, idea_id=None, max_tokens=4000):
    """
    Run one agent until it finishes.

    handlers: {tool_name: python_function(**input) -> str} for tools our code runs.
    Server tools (like web_search) run on Anthropic's side and need no handler.
    Returns the final response.
    """
    handlers = handlers or {}
    for _ in range(MAX_TURNS):
        cp.check_can_run(agent, idea_id)
        kwargs = dict(model=model, system=system, messages=messages, max_tokens=max_tokens)
        if tools:
            kwargs["tools"] = tools
        if tool_choice:
            kwargs["tool_choice"] = tool_choice
        resp = client().messages.create(**kwargs)
        usd = cp.record_cost(agent, model, resp.usage, idea_id)

        for b in resp.content:
            if b.type == "server_tool_use" and b.name == "web_search":
                cp.log(agent, "web_search", idea_id, {"query": b.input.get("query", "")})
            elif b.type == "server_tool_use" and b.name == "web_fetch":
                cp.log(agent, "page_read", idea_id, {"url": b.input.get("url", "")[:200]})
        cp.log(agent, "model_call", idea_id, {"usd": round(usd, 4), "stop": resp.stop_reason})

        messages.append({"role": "assistant", "content": resp.content})

        if resp.stop_reason == "pause_turn":
            continue  # long server-side search: send the same conversation back to continue
        if resp.stop_reason != "tool_use":
            return resp

        results = []
        for b in resp.content:
            if b.type != "tool_use":
                continue
            if b.name not in handlers:
                # a tool with no handler is a "submit" tool: its input is the output we wanted
                return resp
            try:
                cp.check_tool(agent, b.name)
                out = handlers[b.name](**b.input)
                results.append({"type": "tool_result", "tool_use_id": b.id, "content": str(out)})
            except cp.Halt as e:
                results.append({"type": "tool_result", "tool_use_id": b.id, "content": f"Blocked: {e}", "is_error": True})
        messages.append({"role": "user", "content": results})
    raise cp.Halt(f"{agent} did not finish within {MAX_TURNS} steps.")


_CONTROL = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f]")   # junk bytes that web pages sometimes carry


def text_of(resp):
    # Citations split one paragraph into several text blocks, so join them with nothing in between.
    return _CONTROL.sub("", "".join(b.text for b in resp.content if b.type == "text")).strip()


def all_text(messages):
    """Everything the agent wrote across the whole run (a long search run comes back in several responses)."""
    parts = [b.text for m in messages if m["role"] == "assistant" and not isinstance(m["content"], str)
             for b in m["content"] if getattr(b, "type", "") == "text"]
    return _CONTROL.sub("", "".join(parts)).strip()


def tool_input(resp, name):
    for b in resp.content:
        if b.type == "tool_use" and b.name == name:
            return b.input
    return None


def sources_of(messages):
    """Collect every web page the agent cited or saw, for the Sources list."""
    seen, cited, found = set(), [], []
    for m in messages:
        if m["role"] != "assistant" or isinstance(m["content"], str):
            continue
        for b in m["content"]:
            for c in (getattr(b, "citations", None) or []):
                url = getattr(c, "url", None)
                if url and url not in seen:
                    seen.add(url); cited.append((getattr(c, "title", url), url))
            if getattr(b, "type", "") == "web_search_tool_result" and isinstance(getattr(b, "content", None), list):
                for r in b.content:
                    url = getattr(r, "url", None)
                    if url:
                        found.append((getattr(r, "title", url), url))
    rest, extra = set(seen), []
    for t, u in found:
        if u not in rest:
            rest.add(u); extra.append((t, u))
    return cited + extra
