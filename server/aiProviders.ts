export type AIProviderId = "openai" | "anthropic" | "google" | "local";

export type AIProvider = {
  id: AIProviderId;
  label: string;
  configured: boolean;
  capabilities: string[];
};

export function listAIProviders(): AIProvider[] {
  return [
    { id: "openai", label: "OpenAI", configured: Boolean(process.env.OPENAI_API_KEY), capabilities: ["chat", "tool-calling", "structured-output"] },
    { id: "anthropic", label: "Anthropic", configured: Boolean(process.env.ANTHROPIC_API_KEY), capabilities: ["chat", "tool-calling"] },
    { id: "google", label: "Google", configured: Boolean(process.env.GOOGLE_AI_API_KEY), capabilities: ["chat", "tool-calling"] },
    { id: "local", label: "Local model", configured: Boolean(process.env.LOCAL_AI_BASE_URL), capabilities: ["chat"] },
  ];
}

export function getDefaultAIProvider(): AIProvider {
  const configured = listAIProviders().find(provider => provider.configured);
  return configured ?? listAIProviders()[0];
}
