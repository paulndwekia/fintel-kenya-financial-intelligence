# FINTEL AI Provider Architecture

FINTEL exposes a provider-neutral registry for AI research. The currently implemented research execution path uses the existing server-side LLM adapter. Provider discovery reports which optional credentials are configured.

Providers represented by the interface:

- OpenAI
- Anthropic
- Google
- Local model

Only configured providers may be used. Credentials are server-side environment variables. The provider abstraction does not claim that every provider is fully wired for tool execution in this release.
