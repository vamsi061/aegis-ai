"""Seed data: demo agents, MCP tools, policies (docs/demo-scenarios.md section 2)."""

USERS = {
    "user-001": "Priya Sharma (Travel Ops)",
    "user-002": "Ravi Kumar (Finance Ops)",
    "user-admin": "Aegis Administrator",
}

DEMO_AGENTS = [
    {
        "name": "TravelAgent",
        "description": "Books flights and hotels for employees",
        "owner_user_id": "user-001",
        "purpose": "Travel planning and booking",
        "environment": "demo",
        "risk_level": "MEDIUM",
        "data_scope": ["travel_profile"],
        "capabilities": ["flight_search", "hotel_search", "travel_profile_read"],
    },
    {
        "name": "FinanceAgent",
        "description": "Reads budgets and executes approved payments",
        "owner_user_id": "user-002",
        "purpose": "Budget and approved financial operations",
        "environment": "demo",
        "risk_level": "HIGH",
        "data_scope": ["finance_summary"],
        "capabilities": ["budget_read", "payment_transfer"],
    },
    {
        "name": "EmailAgent",
        "description": "Reads and sends email on behalf of users",
        "owner_user_id": "user-001",
        "purpose": "Email communication",
        "environment": "demo",
        "risk_level": "MEDIUM",
        "data_scope": ["mailbox"],
        "capabilities": ["email_read", "email_send"],
    },
]

MCP_SERVERS = [
    {"name": "core-apis", "endpoint": "https://mcp.local/core", "status": "ACTIVE"},
    {"name": "finance-apis", "endpoint": "https://mcp.local/finance", "status": "ACTIVE"},
    {"name": "comms-apis", "endpoint": "https://mcp.local/comms", "status": "ACTIVE"},
]

# (server, tool, risk, description)
MCP_TOOLS = [
    ("core-apis", "flight_search", "LOW", "Search flights"),
    ("core-apis", "hotel_search", "LOW", "Search hotels"),
    ("core-apis", "travel_profile_read", "LOW", "Read travel profile"),
    ("finance-apis", "budget_read", "MEDIUM", "Read department budget"),
    ("finance-apis", "payment_transfer", "CRITICAL", "Execute a payment transfer"),
    ("comms-apis", "email_read", "MEDIUM", "Read mailbox"),
    ("comms-apis", "email_send", "HIGH", "Send email"),
]
