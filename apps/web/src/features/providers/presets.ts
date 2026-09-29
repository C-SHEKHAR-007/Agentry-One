/** One-click starting points for the register dialog. */
export const PRESET_TEMPLATES = [
  { label: "Google Gemini 1.5", cap: "text-generation", type: "gemini", name: "Google Gemini Cloud", model: "gemini-1.5-pro", url: "https://generativelanguage.googleapis.com/v1beta", icon: "✨" },
  { label: "OpenAI GPT-4o", cap: "text-generation", type: "openai_compatible", name: "OpenAI Cloud", model: "gpt-4o", url: "https://api.openai.com/v1", icon: "🤖" },
  { label: "Ollama (Qwen 3 / Local)", cap: "text-generation", type: "ollama_local", name: "Local Ollama Engine", model: "qwen3:8b", url: "http://localhost:11434", icon: "🦙" },
  { label: "Groq Cloud (Ultra Fast)", cap: "text-generation", type: "groq", name: "Groq Inference", model: "llama-3.3-70b-versatile", url: "https://api.groq.com/openai/v1", icon: "⚡" },
  { label: "Anthropic Claude 3.5", cap: "text-generation", type: "anthropic", name: "Anthropic Claude", model: "claude-3-5-sonnet-20241022", url: "https://api.anthropic.com/v1", icon: "🎭" },
  { label: "OpenRouter (400+ Models)", cap: "text-generation", type: "openai_compatible", name: "OpenRouter AI", model: "anthropic/claude-3.5-sonnet", url: "https://openrouter.ai/api/v1", icon: "🌐" },
  { label: "OpenAI DALL·E 3", cap: "image-generation", type: "openai_dalle", name: "OpenAI DALL-E 3", model: "dall-e-3", url: "https://api.openai.com/v1", icon: "🎨" },
  { label: "Stability AI Cloud", cap: "image-generation", type: "stability_ai", name: "Stability AI Cloud", model: "sd3-medium", url: "https://api.stability.ai", icon: "🖼️" },
  { label: "DuckDuckGo Search", cap: "web-search", type: "duckduckgo_free", name: "DuckDuckGo Live Search", model: "ddg-search", url: "", icon: "🔍" },
];
