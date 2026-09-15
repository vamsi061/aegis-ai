"""Mock tool executors and credential provider (Tool Gateway boundary).

No agent calls a governed tool directly in this architecture: execution goes
through /tools/{tool_name}/execute which validates the JIT grant first.
"""

import asyncio
import random
from typing import Any

from aegis.adapters import ToolExecutor


class MockToolExecutor:
    """Deterministic demo results per tool; stands in for real MCP endpoints."""

    async def execute(self, tool_name: str, tool_id: Any, payload: dict[str, Any]) -> dict[str, Any]:
        await asyncio.sleep(0.01)
        if tool_name == "flight_search":
            return {
                "flights": [
                    {"airline": "IndiGo", "flight_no": "6E-2124", "from": payload.get("from", "HYD"), "to": payload.get("to", "DEL"), "dep": "08:40", "price_inr": 5480},
                    {"airline": "Air India", "flight_no": "AI-864", "from": payload.get("from", "HYD"), "to": payload.get("to", "DEL"), "dep": "11:15", "price_inr": 6120},
                ],
                "count": 2,
            }
        if tool_name == "hotel_search":
            return {
                "hotels": [
                    {"name": "Hotel Aurora", "city": payload.get("city", "DEL"), "rating": 4.3, "price_inr": 7200},
                    {"name": "The Grand Delhi", "city": payload.get("city", "DEL"), "rating": 4.6, "price_inr": 11500},
                ],
                "count": 2,
            }
        if tool_name == "travel_profile_read":
            return {"profile": {"preferred_class": "Economy", "home_airport": "HYD", "loyalty_id": "XX-3341"}}
        if tool_name == "budget_read":
            return {"budget": {"department": "Corporate Travel", "available_inr": 148000, "cycle": "Q3"}}
        if tool_name == "payment_transfer":
            return {
                "transaction_id": f"txn-{random.randint(10**8, 10**9 - 1)}",
                "status": "SUCCESS",
                "amount_inr": payload.get("amount"),
                "to": payload.get("to") or payload.get("account_id"),
                "note": "Mock payment executed in demo mode",
            }
        if tool_name == "email_read":
            return {"messages": [{"from": "ops@example.com", "subject": "Travel policy update"}], "count": 1}
        if tool_name == "email_send":
            return {"message_id": f"msg-{random.randint(10**6, 10**7 - 1)}", "status": "SENT", "to": payload.get("to")}
        return {"status": "SUCCESS", "echo": payload, "note": f"Generic mock execution of {tool_name}"}


class StaticCredentialProvider:
    """Issues an opaque, non-secret demo credential bound to the grant."""

    def __init__(self) -> None:
        self._counter = 0

    def issue(self, grant) -> str:
        self._counter += 1
        return f"aegis-demo-cred:{str(grant.id)[:8]}:{self._counter:04d}"


__all__ = ["MockToolExecutor", "StaticCredentialProvider"]
