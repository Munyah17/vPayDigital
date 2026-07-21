import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Bot, Send, Sparkles } from 'lucide-react';
import { api } from '../../../lib/adminAxios';
import toast from 'react-hot-toast';

type Mode = 'general' | 'marketing' | 'analytics';
interface Message { role: 'user' | 'assistant'; text: string }

const MODES: { key: Mode; label: string }[] = [
  { key: 'general', label: 'General' },
  { key: 'marketing', label: 'Marketing copy' },
  { key: 'analytics', label: 'Analytics Q&A' },
];

export default function AiAssistantPage() {
  const [mode, setMode] = useState<Mode>('general');
  const [prompt, setPrompt] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);

  const ask = useMutation({
    mutationFn: (p: string) => api.post<{ success: boolean; data: { response: string } }>('/api/admin/ai-assistant/ask', { mode, prompt: p }),
    onSuccess: (res) => {
      setMessages(m => [...m, { role: 'assistant', text: res.data.data.response }]);
    },
    onError: (e: any) => {
      const msg = e?.response?.data?.error ?? 'Failed to reach the AI Assistant';
      setMessages(m => [...m, { role: 'assistant', text: msg }]);
      if (e?.response?.status !== 503) toast.error(msg);
    },
  });

  const submit = () => {
    if (!prompt.trim()) return;
    setMessages(m => [...m, { role: 'user', text: prompt }]);
    ask.mutate(prompt);
    setPrompt('');
  };

  return (
    <div className="p-6 lg:p-8 max-w-3xl mx-auto space-y-6 flex flex-col h-[calc(100vh-2rem)]">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center shadow-lg">
          <Bot className="w-5 h-5 text-foreground" />
        </div>
        <div>
          <h1 className="font-display font-bold text-foreground text-2xl">AI Assistant</h1>
          <p className="text-foreground/40 text-sm">Marketing copy and analytics Q&A grounded in real platform metrics</p>
        </div>
      </div>

      <div className="flex gap-2 p-1 rounded-xl bg-foreground/5 w-fit">
        {MODES.map(m => (
          <button key={m.key} onClick={() => setMode(m.key)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${mode === m.key ? 'bg-background text-foreground shadow-sm' : 'text-foreground/50'}`}>
            {m.label}
          </button>
        ))}
      </div>

      <div className="glass-card flex-1 overflow-y-auto p-5 space-y-4 min-h-[300px]">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center gap-2">
            <Sparkles className="w-8 h-8 text-foreground/10" />
            <p className="text-foreground/20 text-sm">
              {mode === 'analytics' ? 'Ask about current platform metrics' : mode === 'marketing' ? 'Ask for marketing copy' : 'Ask anything about running the platform'}
            </p>
          </div>
        ) : messages.map((m, i) => (
          <div key={i} className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${m.role === 'user' ? 'ml-auto bg-indigo-600 text-white' : 'bg-foreground/5 text-foreground/80'}`}>
            {m.text}
          </div>
        ))}
        {ask.isPending && <div className="bg-foreground/5 rounded-2xl px-4 py-2.5 text-sm text-foreground/40 w-fit">Thinking…</div>}
      </div>

      <div className="flex gap-2">
        <input
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submit()}
          placeholder="Ask something…"
          className="input-field flex-1"
        />
        <button onClick={submit} disabled={ask.isPending || !prompt.trim()} className="btn-primary px-5 flex items-center gap-2">
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
