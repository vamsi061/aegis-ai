"""Services package: import delegations_ext to complete DelegationService."""

from aegis.services.audit import AuditService  # noqa: F401
from aegis.services.grants import JITGrantService  # noqa: F401
from aegis.services.registry import LifecycleError, RegistryService  # noqa: F401

import aegis.services.delegations as _delegations
import aegis.services.delegations_ext  # noqa: F401  (patches DelegationService)
