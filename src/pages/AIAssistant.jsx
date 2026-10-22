import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { formatCurrency, formatDate } from '@/lib/format';
import { Bot, Send, Sparkles } from 'lucide-react';

const SUGGESTIONS = [
  'Quanto tenho para receber hoje?',
  'Quem está atrasado?',
  'Quanto recebi neste mês?',
  'Quais pagamentos ainda precisam de conferência?',
];

export default function AIAssistant() {
  const [query, setQuery] = useState('');
  const [answer, setAnswer] = useState(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);

  const ask = async (q) => {
    if (!q.trim()) return;
    setLoading(true);
    setQuery('');
    const userMsg = { role: 'user', text: q };
    setHistory(h => [...h, userMsg]);
    try {
      // Gather data for the LLM
      const [reports, installments, customers, sales, vehicles] = await Promise.all([
        base44.entities.PaymentReport.list('-created_date', 200),
        base44.entities.Installment.list('-created_date', 500),
        base44.entities.Customer.list('-created_date', 200),
        base44.entities.Sale.list('-created_date', 200),
        base44.entities.Vehicle.list('-created_date', 200),
      ]);

      const today = new Date().toISOString().slice(0, 10);
      const thisMonth = today.slice(0, 7);

      const overdue = installments.filter(i => i.status !== 'paga' && new Date(i.vencimento) < new Date());
      const toReceiveToday = installments.filter(i => i.status !== 'paga' && i.vencimento === today);
      const receivedMonth = installments.filter(i => i.data_confirmacao?.slice(0, 7) === thisMonth);
      const pendingConf = reports.filter(r => r.status === 'informado' || r.status === 'em_analise');

      const getCustomer = (id) => customers.find(c => c.id === id);
      const getVehicle = (id) => vehicles.find(v => v.id === id);
      const getSale = (id) => sales.find(s => s.id === id);

      const dataContext = `
DADOS REAIS DO SISTEMA (use apenas estes dados para responder):

Parcelas atrasadas (${overdue.length}):
${overdue.slice(0, 10).map(i => {
  const c = getCustomer(i.cliente_id);
  const s = getSale(i.venda_id);
  const v = s ? getVehicle(s.veiculo_id) : null;
  return `- ${c?.nome_completo || 'Cliente'} | ${v ? v.marca + ' ' + v.modelo : ''} | ${v?.placa || ''} | Parcela ${i.numero} | ${formatCurrency(i.valor)} | Venc: ${formatDate(i.vencimento)}`;
}).join('\n')}

Parcelas a receber hoje (${toReceiveToday.length}):
${toReceiveToday.slice(0, 10).map(i => {
  const c = getCustomer(i.cliente_id);
  return `- ${c?.nome_completo || 'Cliente'} | Parcela ${i.numero} | ${formatCurrency(i.valor)}`;
}).join('\n')}

Total a receber hoje: ${formatCurrency(toReceiveToday.reduce((s, i) => s + i.valor, 0))}

Recebido neste mês (${receivedMonth.length} parcelas): ${formatCurrency(receivedMonth.reduce((s, i) => s + (i.valor_pago || 0), 0))}

Pagamentos aguardando conferência (${pendingConf.length}):
${pendingConf.slice(0, 10).map(r => `- ${r.dados_ia_pagador || 'Cliente'} | ${formatCurrency(r.valor_informado)} | ${r.tem_comprovante ? 'Com comprovante' : 'Sem comprovante'} | ${r.status}`).join('\n')}

PERGUNTA: ${q}

Responda em português, de forma direta e objetiva, usando os dados acima. Se perguntarem sobre uma placa específica, procure nos dados. Não invente informações.`;

      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Você é o assistente financeiro do Pagaê, sistema da Paulinho Veículos. ${dataContext}`,
      });

      const botMsg = { role: 'bot', text: result };
      setHistory(h => [...h, botMsg]);
      setAnswer(result);
    } catch (e) {
      setHistory(h => [...h, { role: 'bot', text: 'Erro: ' + e.message }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 lg:p-6 max-w-[800px] mx-auto h-full flex flex-col">
      <div className="mb-4">
        <h1 className="text-xl lg:text-2xl font-extrabold tracking-tight flex items-center gap-2">
          <Bot className="w-6 h-6 text-primary" /> Assistente de IA
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">Pergunte sobre recebimentos, atrasos, saldos e conferências</p>
      </div>

      {/* Chat history */}
      <div className="flex-1 space-y-3 overflow-y-auto scrollbar-thin pb-4">
        {history.length === 0 && (
          <div className="text-center py-8">
            <Sparkles className="w-10 h-10 text-primary/50 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground mb-4">Faça uma pergunta ou use uma sugestão:</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {SUGGESTIONS.map(s => (
                <button
                  key={s}
                  onClick={() => ask(s)}
                  className="bg-card border border-border hover:border-primary/30 rounded-md px-3 py-2 text-xs text-foreground"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {history.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-md px-3 py-2 text-sm ${msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-card border border-border text-foreground'}`}>
              <p className="whitespace-pre-wrap">{msg.text}</p>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-card border border-border rounded-md px-3 py-2 flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-border border-t-primary rounded-full animate-spin" />
              <span className="text-sm text-muted-foreground">Consultando dados...</span>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="flex gap-2 pt-3 border-t border-border">
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') ask(query); }}
          placeholder="Pergunte algo..."
          className="flex-1 bg-card border border-border rounded-md px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <button onClick={() => ask(query)} disabled={loading || !query.trim()} className="bg-primary text-primary-foreground px-4 rounded-md hover:bg-primary/90 disabled:opacity-50">
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
