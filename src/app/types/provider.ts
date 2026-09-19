export type AiProvider = 
  | 'gemini' 
  | 'claude' 
  | 'nvidia' 
  | 'openai' 
  | 'deepseek' 
  | 'groq' 
  | 'mistral' 
  | 'openrouter' 
  | 'local';

export interface ProviderModel {
  id: string;
  name: string;
  description: string;
  contextWindow?: string;
  badge?: string;
}

export interface ProviderConfig {
  id: AiProvider;
  name: string;
  brand: string;
  icon: string;
  color: string;
  accentColor: string;
  defaultModel: string;
  models: ProviderModel[];
  keyEnvName: string;
  keyPlaceholder: string;
  endpointDescription: string;
}

export const AI_PROVIDERS: Record<AiProvider, ProviderConfig> = {
  nvidia: {
    id: 'nvidia',
    name: 'NVIDIA NIM',
    brand: 'NVIDIA',
    icon: 'developer_board',
    color: '#76b900',
    accentColor: 'rgba(118, 185, 0, 0.4)',
    defaultModel: 'meta/llama-3.1-70b-instruct',
    keyEnvName: 'NVIDIA_API_KEY',
    keyPlaceholder: 'nvapi-...',
    endpointDescription: 'NVIDIA Inference Microservices (integrate.api.nvidia.com)',
    models: [
      { id: 'meta/llama-3.1-70b-instruct', name: 'Llama 3.1 70B', description: 'Flagship open model optimized on NVIDIA GPUs', badge: 'FAST' },
      { id: 'meta/llama-3.1-405b-instruct', name: 'Llama 3.1 405B', description: 'Massive scale frontier reasoning', badge: 'FRONTIER' },
      { id: 'meta/llama-3.3-70b-instruct', name: 'Llama 3.3 70B', description: 'Latest Meta model with updated capabilities', badge: 'NEW' },
      { id: 'nvidia/llama-3.1-nemotron-70b-instruct', name: 'Nemotron 70B', description: 'NVIDIA customized model for high precision', badge: 'REASONING' },
      { id: 'deepseek-ai/deepseek-r1', name: 'DeepSeek R1 (NVIDIA)', description: 'DeepSeek R1 running on NVIDIA cloud infrastructure', badge: 'MATH/CODE' }
    ]
  },
  claude: {
    id: 'claude',
    name: 'Anthropic Claude',
    brand: 'Anthropic',
    icon: 'psychology',
    color: '#d97706',
    accentColor: 'rgba(217, 119, 6, 0.4)',
    defaultModel: 'claude-3-7-sonnet-20250219',
    keyEnvName: 'ANTHROPIC_API_KEY',
    keyPlaceholder: 'sk-ant-...',
    endpointDescription: 'Anthropic Claude Messages API (api.anthropic.com)',
    models: [
      { id: 'claude-3-7-sonnet-20250219', name: 'Claude 3.7 Sonnet', description: 'Hybrid reasoning & lightning coding frontier model', badge: 'FLAGSHIP' },
      { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet v2', description: 'Industry-standard coding & system design', badge: 'CODE' },
      { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', description: 'Ultra-fast lightweight intelligence', badge: 'TURBO' },
      { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', description: 'Deep analysis and philosophical complexity' }
    ]
  },
  gemini: {
    id: 'gemini',
    name: 'Google Gemini',
    brand: 'Google DeepMind',
    icon: 'auto_awesome',
    color: '#38bdf8',
    accentColor: 'rgba(56, 189, 248, 0.4)',
    defaultModel: 'gemini-2.5-flash',
    keyEnvName: 'GEMINI_API_KEY',
    keyPlaceholder: 'AIzaSy...',
    endpointDescription: 'Google AI / Gemini API via @google/genai SDK',
    models: [
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', description: 'Ultra-fast multimodal generation and coding', badge: 'DEFAULT' },
      { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', description: 'Advanced reasoning for complex graph architecture', badge: 'DEEP' },
      { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', description: 'Reliable fast inference with large context' },
      { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', description: 'Deep context analysis up to 2M tokens' }
    ]
  },
  openai: {
    id: 'openai',
    name: 'OpenAI',
    brand: 'OpenAI',
    icon: 'hub',
    color: '#10b981',
    accentColor: 'rgba(16, 185, 129, 0.4)',
    defaultModel: 'gpt-4o',
    keyEnvName: 'OPENAI_API_KEY',
    keyPlaceholder: 'sk-proj-...',
    endpointDescription: 'OpenAI API (api.openai.com)',
    models: [
      { id: 'gpt-4o', name: 'GPT-4o', description: 'Omni-model for high-precision logic and UI layout', badge: 'FLAGSHIP' },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', description: 'Fast, cost-effective reasoning', badge: 'FAST' },
      { id: 'o3-mini', name: 'o3-mini', description: 'High-speed reasoning model for math and code', badge: 'REASONING' },
      { id: 'o1', name: 'o1', description: 'Full reasoning powerhouse for intricate software design' }
    ]
  },
  deepseek: {
    id: 'deepseek',
    name: 'DeepSeek',
    brand: 'DeepSeek',
    icon: 'smart_toy',
    color: '#a855f7',
    accentColor: 'rgba(168, 85, 247, 0.4)',
    defaultModel: 'deepseek-chat',
    keyEnvName: 'DEEPSEEK_API_KEY',
    keyPlaceholder: 'sk-...',
    endpointDescription: 'DeepSeek Open Platform (api.deepseek.com)',
    models: [
      { id: 'deepseek-chat', name: 'DeepSeek-V3', description: 'Flagship 671B MoE model with exceptional coding power', badge: 'V3' },
      { id: 'deepseek-reasoner', name: 'DeepSeek-R1', description: 'Pure open reasoning and chain-of-thought execution', badge: 'R1' }
    ]
  },
  groq: {
    id: 'groq',
    name: 'Groq LPUs',
    brand: 'Groq',
    icon: 'bolt',
    color: '#f59e0b',
    accentColor: 'rgba(245, 158, 11, 0.4)',
    defaultModel: 'llama-3.3-70b-versatile',
    keyEnvName: 'GROQ_API_KEY',
    keyPlaceholder: 'gsk_...',
    endpointDescription: 'Groq LPU Inference Engine (api.groq.com)',
    models: [
      { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B (Groq)', description: '500+ tokens/sec instant inference speed', badge: '500 t/s' },
      { id: 'deepseek-r1-distill-llama-70b', name: 'DeepSeek R1 70B (Groq)', description: 'Groq-accelerated DeepSeek reasoning', badge: 'FAST R1' },
      { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B Instant', description: 'Ultra-low latency sub-second responses', badge: 'SUB-SEC' }
    ]
  },
  mistral: {
    id: 'mistral',
    name: 'Mistral AI',
    brand: 'Mistral',
    icon: 'storm',
    color: '#f97316',
    accentColor: 'rgba(249, 115, 22, 0.4)',
    defaultModel: 'codestral-latest',
    keyEnvName: 'MISTRAL_API_KEY',
    keyPlaceholder: '...',
    endpointDescription: 'Mistral AI La Plateforme (api.mistral.ai)',
    models: [
      { id: 'codestral-latest', name: 'Codestral Latest', description: 'State-of-the-art coding and generation specialist', badge: 'DEV' },
      { id: 'mistral-large-latest', name: 'Mistral Large 2', description: 'Top-tier general reasoning and multilingual prowess', badge: 'FLAGSHIP' },
      { id: 'mistral-small-latest', name: 'Mistral Small', description: 'Cost-effective responsive assistant' }
    ]
  },
  openrouter: {
    id: 'openrouter',
    name: 'OpenRouter',
    brand: 'OpenRouter',
    icon: 'language',
    color: '#06b6d4',
    accentColor: 'rgba(6, 182, 212, 0.4)',
    defaultModel: 'anthropic/claude-3.7-sonnet',
    keyEnvName: 'OPENROUTER_API_KEY',
    keyPlaceholder: 'sk-or-v1-...',
    endpointDescription: 'OpenRouter Unified LLM Gateway (openrouter.ai)',
    models: [
      { id: 'anthropic/claude-3.7-sonnet', name: 'Claude 3.7 Sonnet (Router)', description: 'Direct routing to Anthropic through OpenRouter' },
      { id: 'meta-llama/llama-3.3-70b-instruct', name: 'Meta Llama 3.3 70B', description: 'Open weights flagship routing' },
      { id: 'deepseek/deepseek-r1', name: 'DeepSeek R1 (Router)', description: 'Full R1 reasoning chain via OpenRouter' },
      { id: 'google/gemini-2.0-flash-001', name: 'Gemini 2.0 Flash (Router)', description: 'Google flash model via unified gateway' }
    ]
  },
  local: {
    id: 'local',
    name: 'Local Ollama',
    brand: 'Self-Hosted',
    icon: 'memory',
    color: '#94a3b8',
    accentColor: 'rgba(148, 163, 184, 0.4)',
    defaultModel: 'qwen2.5-coder',
    keyEnvName: 'LOCAL_API_URL',
    keyPlaceholder: 'http://127.0.0.1:11434',
    endpointDescription: 'Local Ollama instance running offline on localhost:11434',
    models: [
      { id: 'qwen2.5-coder', name: 'Qwen 2.5 Coder', description: 'Optimal local model for code generation', badge: 'LOCAL' },
      { id: 'llama3.2', name: 'Llama 3.2', description: 'Lightweight local model for general intent', badge: 'LOCAL' },
      { id: 'deepseek-r1:latest', name: 'DeepSeek R1 (Local)', description: 'Local quantized DeepSeek R1 via Ollama', badge: 'LOCAL R1' }
    ]
  }
};
