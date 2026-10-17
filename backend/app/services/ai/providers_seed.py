"""Boshlang'ich provayderlar zanjiri (docs/04-ai.md). Admin paneldan o'zgartiriladi."""

PROVIDERS = [
    {
        "code": "gemini", "name": "Google Gemini", "priority": 10, "is_paid": False, "enabled": True,
        "base_url": "https://generativelanguage.googleapis.com/v1beta/openai",
        "model": "gemini-2.5-flash", "daily_request_cap": 1400, "api_key_env": "GEMINI_API_KEY",
    },
    {
        "code": "groq", "name": "Groq", "priority": 20, "is_paid": False, "enabled": True,
        "base_url": "https://api.groq.com/openai/v1",
        "model": "llama-3.3-70b-versatile", "daily_request_cap": 950, "api_key_env": "GROQ_API_KEY",
    },
    {
        "code": "openrouter", "name": "OpenRouter (free)", "priority": 30, "is_paid": False, "enabled": True,
        "base_url": "https://openrouter.ai/api/v1",
        "model": "meta-llama/llama-3.3-70b-instruct:free", "daily_request_cap": 45,
        "api_key_env": "OPENROUTER_API_KEY",
    },
    {
        "code": "deepseek", "name": "DeepSeek", "priority": 40, "is_paid": True, "enabled": True,
        "base_url": "https://api.deepseek.com/v1",
        "model": "deepseek-chat", "daily_request_cap": None, "api_key_env": "DEEPSEEK_API_KEY",
    },
    {
        "code": "grok", "name": "xAI Grok", "priority": 50, "is_paid": True, "enabled": False,
        "base_url": "https://api.x.ai/v1",
        "model": "grok-3-mini", "daily_request_cap": None, "api_key_env": "XAI_API_KEY",
    },
]
