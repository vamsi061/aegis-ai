"""Mock / local identity provider (Entra Agent ID adapter boundary)."""

import re
import uuid


class MockIdentityProvider:
    """Deterministic local identity provider.

    Production swaps in EntraAgentIDProvider implementing the same interface
    (docs/requirements.md FR-03). Identity ids are opaque and stable.
    """

    _slug = re.compile(r"[^a-z0-9]+")

    async def register_agent_identity(self, name: str, owner_user_id: str) -> str:
        slug = self._slug.sub("-", name.lower()).strip("-")
        return f"entra-mock:{slug}:{uuid.uuid4().hex[:12]}"

    async def deactivate_identity(self, external_identity_id: str) -> None:
        return None


class EntraAgentIDProvider:
    """Placeholder for Microsoft Entra Agent ID integration (FR-03).

    Requires tenant credentials that are not available in this prototype;
    enabled via AEGIS_IDENTITY_PROVIDER=entra with real configuration.
    """

    def __init__(self, tenant_id: str, client_id: str, client_secret: str):
        if not tenant_id or not client_id or not client_secret:
            raise RuntimeError(
                "Entra integration requires tenant credentials; use the mock provider locally"
            )
        self.tenant_id = tenant_id
        self.client_id = client_id
        self.client_secret = client_secret

    async def register_agent_identity(self, name: str, owner_user_id: str) -> str:
        raise NotImplementedError("Entra Agent ID integration is not configured in this prototype")


__all__ = ["MockIdentityProvider", "EntraAgentIDProvider"]
