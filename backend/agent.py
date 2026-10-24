"""The Campus Customs Concierge — a PydanticAI agent wired to OpenAI via the Portkey gateway.

The agent can only read the product catalogue (through tools.py); it has no access to the
users table, so it cannot leak account data. The model returns product *ids*; main.py turns
those into authoritative product cards from the database.
"""

import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

os.environ.setdefault("PYDANTIC_AI_NO_BANNER", "1")  # keep server logs clean

from pydantic_ai import Agent, RunContext
from pydantic_ai.models.openai import OpenAIChatModel
from pydantic_ai.providers.openai import OpenAIProvider
from pydantic_ai.usage import UsageLimits

import tools
from models import AgentOutput

PROMPT_PATH = Path(__file__).resolve().parent / "prompts" / "prompt.md"
PORTKEY_BASE_URL = "https://api.portkey.ai/v1"
DEFAULT_MODEL = "gpt-terra"


@dataclass
class ChatDeps:
    """Per-request context handed to the agent and its tools."""

    user_first_name: str | None = None
    page_path: str = ""
    page_product_id: str | None = None


def _system_prompt() -> str:
    return PROMPT_PATH.read_text(encoding="utf-8")


@lru_cache(maxsize=1)
def build_agent() -> Agent[ChatDeps, AgentOutput]:
    """Construct the Concierge agent once. Reads PORTKEY_API_KEY and OPENAI_MODEL from the env."""
    api_key = os.environ.get("PORTKEY_API_KEY")
    if not api_key:
        raise RuntimeError("PORTKEY_API_KEY is not set — the chatbot cannot reach the model.")

    model = OpenAIChatModel(
        os.environ.get("OPENAI_MODEL", DEFAULT_MODEL),
        provider=OpenAIProvider(base_url=PORTKEY_BASE_URL, api_key=api_key),
    )

    agent = Agent(
        model,
        deps_type=ChatDeps,
        output_type=AgentOutput,
        instructions=_system_prompt(),
        retries=2,
    )

    @agent.instructions
    def _guest(ctx: RunContext[ChatDeps]) -> str:
        if ctx.deps.user_first_name:
            return f"The current guest is signed in; greet them by first name: {ctx.deps.user_first_name}."
        return "The current guest is not signed in. You do not know their name."

    @agent.instructions
    def _page(ctx: RunContext[ChatDeps]) -> str:
        """Tell the agent what page the guest is on so 'this'/'it' resolves to the right item."""
        if ctx.deps.page_product_id:
            item = tools.check_availability(ctx.deps.page_product_id)
            if item.get("found"):
                colors = ", ".join(item.get("colors") or []) or "unspecified"
                return (
                    f"The guest is currently viewing this product: {item['name']} "
                    f"(id={item['product_id']}, colors: {colors}). If they say 'this', 'it', or "
                    f"'this one', they mean this item. For 'do you have this in <color>', use "
                    f"find_in_color with that color and this item's garment type."
                )
        if ctx.deps.page_path:
            return f"The guest is currently on the page: {ctx.deps.page_path}."
        return ""

    @agent.tool
    def find_products(ctx: RunContext[ChatDeps], query: str, limit: int = 6) -> list[dict]:
        """Search the catalogue for items matching what the guest is looking for (by name, type,
        color, occasion, team, or recipient) and return the matches. Read-only. When the guest
        asks about a specific item or 'do you have…', call this, then put the matching product
        ids in `product_ids` so they appear as product cards the guest can open."""
        result = tools.search_catalogue(query, limit=limit)
        tools.audit_tool_call("find_products", {"query": query, "limit": limit}, result)
        return result

    @agent.tool
    def check_availability(ctx: RunContext[ChatDeps], product_id: str) -> dict:
        """Look up the real description, price and per-size stock for one product id from the
        database. USE THIS before stating any price or stock. Returns {"found": false} if the
        id is unknown — in that case tell the guest the item is unavailable, do not guess."""
        result = tools.check_availability(product_id)
        tools.audit_tool_call("check_availability", {"product_id": product_id}, result)
        return result

    @agent.tool
    def find_in_color(ctx: RunContext[ChatDeps], color: str, keywords: str = "") -> list[dict]:
        """Find products available in a given color, optionally narrowed by keywords such as the
        garment type. Use for 'do you have this in blue' — pass the color and the viewed item's
        garment type as keywords. Read-only."""
        result = tools.find_in_color(color, keywords=keywords)
        tools.audit_tool_call("find_in_color", {"color": color, "keywords": keywords}, result)
        return result

    @agent.tool
    def catalogue_overview(ctx: RunContext[ChatDeps]) -> list[dict]:
        """List the kinds of garments the house sells, with counts and price ranges."""
        result = tools.catalogue_overview()
        tools.audit_tool_call("catalogue_overview", {}, result)
        return result

    return agent


async def run_chat(
    message: str,
    history: list[dict],
    user_first_name: str | None,
    page_path: str = "",
    page_product_id: str | None = None,
) -> AgentOutput:
    """Run one turn. `history` is a list of {'role','content'} dicts from the browser."""
    agent = build_agent()
    # Fold recent turns into the prompt as lightweight context (keeps message-format handling simple).
    context = ""
    if history:
        lines = [f"{t['role']}: {t['content']}" for t in history[-8:]]
        context = "Recent conversation so far:\n" + "\n".join(lines) + "\n\n"
    try:
        result = await agent.run(
            f"{context}Guest says: {message}",
            deps=ChatDeps(user_first_name=user_first_name, page_path=page_path, page_product_id=page_product_id),
            # Safety cap so a misbehaving turn can never run away with model calls / cost.
            usage_limits=UsageLimits(request_limit=12),
        )
    except Exception as exc:  # noqa: BLE001 — log how the loop stopped, then re-raise for the route
        reason = "usage_limit" if "UsageLimit" in type(exc).__name__ else "error"
        tools.append_audit({"kind": "run", "stop_reason": reason, "error": type(exc).__name__})
        raise
    tools.append_audit(
        {
            "kind": "run",
            "stop_reason": "completed",
            "products": len(result.output.product_ids),
            "reply_preview": result.output.reply[:80],
        }
    )
    return result.output
