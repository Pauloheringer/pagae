import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { KeyRound, Plus, Check, X, History } from 'lucide-react';

export default function PixKeyHub() {
  const { user } = useAuth();
  const [keys, setKeys] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ tipo: 'cpf', chave: '', titular: '', banco: '' });

  const loadData = useCallback(async () => {
    try {
      const [k, l] = await Promise.all([
        base44.entities.PixKey.list('-created_date', 50),
        base44.entities.AuditLog.filter({ acao: 'trocar_chave_pix' }, '-created_date', 20)
      ]);
      setKeys(k); setLogs(l);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleActivate = async (key) => {
    if (key.ativo) return;
    if (!confirm(`Confirmar ativação da chave ${key.tipo.toUpperCase()}: ${key.chave} (${key.titular})?\n\nEsta chave passará a aparecer para todos os clientes.`)) return;
    try {
      // Deactivate all others
      const others = keys.filter(k => k.ativo && k.id !== key.id);
      if (others.length > 0) {
        await base44.entities.PixKey.bulkUpdate(others.map(k => ({ id: k.id, ativo: false })));
      }
      await base44.entities.PixKey.update(key.id, { ativo: true });
      await base44.entities.AuditLog.create({
        acao: 'trocar_chave_pix',
        entidade: 'PixKey',
        entidade_id: key.id,
        detalhes: `Chave ativa alterada para ${key.tipo.toUpperCase()}: ${key.chave} — ${key.titular} (${key.banco})`,
        usuario_nome: user?.full_name || 'Admin'
      });
      loadData();
    } catch (e) { alert('Erro: ' + e.message); }
  };

  const handleCreate = async () => {
    if (!form.chave || !form.titular || !form.banco) return alert('Preencha todos os campos');
    try {
      await base44.entities.PixKey.create({ ...form, ativo: false });
      setForm({ tipo: 'cpf', chave: '', titular: '', banco: '' });
      setShowForm(false);
      loadData();
    } catch (e) { alert('Erro: ' + e.message); }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-full p-8"><div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" /></div>;
  }

  return (
    <div className="p-4 lg:p-6 space-y-4 max-w-[1000px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl lg:text-2xl font-extrabold tracking-tight">Hub de Chaves Pix</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Cadastre múltiplas chaves. Apenas uma fica ativa para os clientes.</p>
        </div>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-sm px-4 py-2.5 rounded-md">
          <Plus className="w-4 h-4" /> Cadastrar Chave
        </button>
      </div>

      <div className="grid gap-3">
        {keys.map(key => (
          <div key={key.id} className={`bg-card border rounded-md p-4 ${key.ativo ? 'border-green-500/40 bg-green-500/5' : 'border-border'}`}>
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-md flex items-center justify-center shrink-0 ${key.ativo ? 'bg-green-500/15 text-green-400' : 'bg-secondary text-muted-foreground'}`}>
                <KeyRound className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-sm text-foreground">{key.chave}</span>
                  <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">{key.tipo}</span>
                  {key.ativo && <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-green-500/15 text-green-400 border border-green-500/30">Ativa</span>}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">{key.titular} • {key.banco}</div>
              </div>
              {!key.ativo && (
                <button onClick={() => handleActivate(key)} className="flex items-center gap-1.5 text-xs font-semibold bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-md">
                  <Check className="w-3.5 h-3.5" /> Ativar
                </button>
              )}
            </div>
          </div>
        ))}
        {keys.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <KeyRound className="w-10 h-10 mx-auto mb-3 opacity-50" />
            <p className="text-sm">Nenhuma chave Pix cadastrada.</p>
          </div>
        )}
      </div>

      {logs.length > 0 && (
        <div className="mt-6">
          <h2 className="text-sm font-bold text-foreground flex items-center gap-2 mb-3"><History className="w-4 h-4" /> Histórico de Trocas</h2>
          <div className="space-y-2">
            {logs.map(log => (
              <div key={log.id} className="bg-card border border-border rounded-md p-3 text-xs">
                <div className="text-foreground">{log.detalhes}</div>
                <div className="text-muted-foreground mt-1">{log.usuario_nome} • {new Date(log.created_date).toLocaleString('pt-BR')}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="bg-card border border-border rounded-md w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h2 className="font-bold text-foreground">Cadastrar Chave Pix</h2>
              <button onClick={() => setShowForm(false)} className="p-1 text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono mb-1.5 block">Tipo</label>
                <select value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))} className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm">
                  <option value="cpf">CPF</option>
                  <option value="cnpj">CNPJ</option>
                  <option value="email">E-mail</option>
                  <option value="telefone">Telefone</option>
                  <option value="aleatoria">Chave Aleatória</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono mb-1.5 block">Chave</label>
                <input value={form.chave} onChange={e => setForm(f => ({ ...f, chave: e.target.value }))} className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono mb-1.5 block">Nome Exato do Titular</label>
                <input value={form.titular} onChange={e => setForm(f => ({ ...f, titular: e.target.value }))} className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono mb-1.5 block">Banco</label>
                <input value={form.banco} onChange={e => setForm(f => ({ ...f, banco: e.target.value }))} placeholder="Ex: Banco do Brasil, Nubank, Itaú..." className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
              </div>
            </div>
            <div className="px-5 py-4 border-t border-border flex gap-2">
              <button onClick={() => setShowForm(false)} className="flex-1 bg-secondary border border-border rounded-md py-2.5 text-sm font-semibold hover:bg-accent">Cancelar</button>
              <button onClick={handleCreate} className="flex-1 bg-primary text-primary-foreground rounded-md py-2.5 text-sm font-semibold hover:bg-primary/90">Cadastrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
