"""Intent Engine (FR-04).

Deterministic intent extraction is the default and the authorization
authority. An LLM adapter may refine the intent later, but the LLM is never
the final authorization authority (docs/policy-spec.md section 1).
"""

import re
from typing import Any

from aegis.engine.types import Intent, scan_injection
from aegis.schemas import AuthorizeRequest

# Financial actions and the sensitivity/risk they imply.
_FINANCIAL_ACTIONS = {
    "payment_transfer": ("financial_transfer", "HIGH"),
    "transfer_funds": ("financial_transfer", "HIGH"),
    "fund_transfer": ("financial_transfer", "HIGH"),
    "wire_transfer": ("financial_transfer", "HIGH"),
}

_DATA_EXFIL_ACTIONS = {"data_exfiltration", "export_data", "send_data_external"}

# Words in free text that signal a financial action (requires a money signal,
# not merely the word "pay"/"transfer" appearing in any sentence).
_FINANCIAL_TEXT = re.compile(
    r"\b(transfer|pay|wire|remit)\b[^.;]{0,60}\b(money|funds?|invoice|vendor|salary|amount)\b",
    re.IGNORECASE,
)

_MONEY_RE = re.compile(r"(?:\u20b9|rs\.?|inr|\$)\s*([0-9][0-9,]*(?:\.[0-9]+)?)", re.IGNORECASE)


def _clean_money(raw: str) -> float:
    return float(raw.replace(",", ""))


class DeterministicIntentProvider:
    """Rule-based intent extraction from action, tool and textual input."""

    def extract(self, request: AuthorizeRequest) -> Intent:
        payload = request.input or {}
        context = request.context or {}

        # Injection screen over any free text supplied by the caller.
        text_blob = " ".join(
            str(part)
            for part in [
                payload.get("prompt", ""),
                payload.get("message", ""),
                payload.get("content", ""),
                payload.get("text", ""),
                context.get("prompt", ""),
                context.get("message", ""),
                context.get("content", ""),
                context.get("text", ""),
            ]
            if part
        )
        injected, injection_indicators = scan_injection(text_blob)

        action = (request.action or "").strip().lower()
        tool = (request.tool or "").strip().lower()

        risk_indicators: list[str] = list(injection_indicators)
        sensitivity = "LOW"
        if action in _FINANCIAL_ACTIONS or tool in _FINANCIAL_ACTIONS:
            action = _FINANCIAL_ACTIONS[action][0] if action in _FINANCIAL_ACTIONS else _FINANCIAL_ACTIONS[tool][0]
            sensitivity = "HIGH"
            if "financial_transaction" not in risk_indicators:
                risk_indicators.append("financial_transaction")
        elif _FINANCIAL_TEXT.search(text_blob):
            action = "financial_transfer"
            sensitivity = "HIGH"
            if "financial_transaction" not in risk_indicators:
                risk_indicators.append("financial_transaction")

        if action in _DATA_EXFIL_ACTIONS:
            sensitivity = "CRITICAL"
            if "data_exfiltration" not in risk_indicators:
                risk_indicators.append("data_exfiltration")

        amount = payload.get("amount") or context.get("amount")
        if amount is None:
            match = _MONEY_RE.search(text_blob)
            if match:
                amount = _clean_money(match.group(1))
        amount_f = float(amount) if amount is not None else None

        data_scope = list(payload.get("data_scope") or context.get("data_scope") or [])
        target = request.target or payload.get("target") or payload.get("account_id")

        if injected:
            sensitivity = "CRITICAL"

        return Intent(
            action=action or tool or "unknown",
            target=target,
            tool=tool or None,
            data_scope=data_scope,
            sensitivity=sensitivity,
            amount=amount_f,
            risk_indicators=risk_indicators,
            source="deterministic",
        )
