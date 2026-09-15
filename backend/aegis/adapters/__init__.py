"""Adapter interfaces (docs/architecture.md section 5).

Every enterprise-boundary concern is behind an interface so mock/local
implementations can be swapped for integrations (Entra Agent ID, real LLM,
real MCP endpoints) without touching the governance core.
"""

from abc import ABC, abstractmethod
from typing import TYPE_CHECKING, Any, Protocol, runtime_checkable

if TYPE_CHECKING:  # pragma: no cover
    from aegis.engine.types import Intent, PolicyContext, PolicyResult
    from aegis.models.access import AccessGrant
    from aegis.schemas import AuthorizeRequest


@runtime_checkable
class IdentityProvider(Protocol):
    """Enterprise agent-identity foundation (Microsoft Entra Agent ID)."""

    async def register_agent_identity(self, name: str, owner_user_id: str) -> str:
        """Return an external identity id for the agent."""
        ...


@runtime_checkable
class IntentProvider(Protocol):
    """Converts a raw request into a normalized Intent (FR-04)."""

    async def extract_intent(self, request: "AuthorizeRequest") -> "Intent": ...


@runtime_checkable
class PolicyEvaluator(Protocol):
    """Deterministic policy decision point (FR-05)."""

    async def evaluate(self, ctx: "PolicyContext") -> "PolicyResult": ...


@runtime_checkable
class CredentialProvider(Protocol):
    """Issues/retrieves short-lived task-scoped credentials for tool calls."""

    def issue(self, grant: "AccessGrant") -> str: ...


@runtime_checkable
class ToolExecutor(Protocol):
    """Executes a governed tool call (MCP/tool gateway boundary)."""

    async def execute(self, tool_name: str, tool_id: Any, payload: dict[str, Any]) -> dict[str, Any]: ...


@runtime_checkable
class ApprovalProvider(Protocol):
    """Notification channel for approval requests."""

    async def notify(self, approval) -> None: ...


@runtime_checkable
class TelemetryProvider(Protocol):
    """Metrics/tracing sink (OpenTelemetry in production)."""

    def record(self, name: str, value: float = 0.0, attrs: dict[str, Any] | None = None) -> None: ...


__all__ = [
    "IdentityProvider",
    "IntentProvider",
    "PolicyEvaluator",
    "CredentialProvider",
    "ToolExecutor",
    "ApprovalProvider",
    "TelemetryProvider",
]
