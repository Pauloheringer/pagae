import React, { useState, useRef, useEffect } from 'react';
import { customerChat } from '@/functions/customerChat';
import { Bot, Send, X, MessageCircle, Sparkles } from 'lucide-react';

const SUGGESTIONS = [
  'Qual o meu saldo devedor?',
  'Quantas parcelas ainda faltam?',
  'A quanto tempo comprei o carro?',
  'Quando vence a próxima parcela?',
  'Quanto já paguei no total?',
];

export default function CustomerChat({ session }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history, loading]);

  const ask = async (q) => {
    if (!q.trim() || loading) return;
    setLoading(true);
    setQuery('');
    setHistory(h => [...h, { role: 'user', text: q }]);
    try {
      const res = await customerChat({ session, pergunta: q });
      const resposta = res.data?.resposta || res.data?.error || 'Erro ao consultar.';
      setHistory(h => [...h, { role: 'bot', text: resposta }]);
    } catch (e) {
      setHistory(h => [...h, { role: 'bot', text: 'Erro: ' + (e.response?.data?.error || e.message) }]);
    } finally {
      setLoading(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 z-40 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 flex items-center justify-center hover:bg-primary/90 transition-colors"
      >
        <MessageCircle className="w-6 h-6" />
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      {/* Header */}
      <div className="h-14 border-b border-border bg-card flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
            <Bot className="w-5 h-5 text-primary" />
          </div>
          <div>
            <div className="font-bold text-sm text-foreground">Assistente Pagaê</div>
            <div className="text-[10px] text-green-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400" /> Online
            </div>
          </div>
        </div>
        <button onClick={() => setOpen(false)} className="p-1.5 text-muted-foreground hover:text-foreground">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-3">
        {history.length === 0 && (
          <div className="text-center py-6">
            <Sparkles className="w-10 h-10 text-primary/50 mx-auto mb-3" />
            <p className="text-sm font-semibold text-foreground mb-1">Olá! Sou seu assistente financeiro.</p>
            <p className="text-xs text-muted-foreground mb-4">Pergunte sobre seu saldo, parcelas, veículo e mais:</p>
            <div className="flex flex-col gap-2">
              {SUGGESTIONS.map(s => (
                <button
                  key={s}
                  onClick={() => ask(s)}
                  className="bg-card border border-border hover:border-primary/30 rounded-md px-3 py-2.5 text-xs text-foreground text-left"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {history.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-card border border-border text-foreground'}`}>
              <p className="whitespace-pre-wrap">{msg.text}</p>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-card border border-border rounded-lg px-3 py-2 flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-border border-t-primary rounded-full animate-spin" />
              <span className="text-sm text-muted-foreground">Consultando...</span>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-border p-3 shrink-0">
        <div className="flex gap-2">
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') ask(query); }}
            placeholder="Digite sua pergunta..."
            className="flex-1 bg-card border border-border rounded-md px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <button onClick={() => ask(query)} disabled={loading || !query.trim()} className="bg-primary text-primary-foreground px-4 rounded-md hover:bg-primary/90 disabled:opacity-50">
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
