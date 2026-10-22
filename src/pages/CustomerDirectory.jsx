import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { customerPortal } from '@/functions/customerPortal';
import { formatCPF, formatPhone, validateCPF } from '@/lib/format';
import { Plus, Users, Search, X, ExternalLink, Trash2, Pencil, Link2 } from 'lucide-react';
import DocumentPhotoUpload from '@/components/customers/DocumentPhotoUpload';

// Portal and registration links carry a signed token instead of the raw
// customer id, so a link can't be guessed or edited to open someone else.
async function customerLinkToken(customerId) {
  const res = await customerPortal({ action: 'adminLink', customer_id: customerId });
  return res.data.session;
}

export default function CustomerDirectory() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(searchParams.get('q') || '');
  const [showForm, setShowForm] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);

  const loadData = useCallback(async () => {
    try {
      const [c, s] = await Promise.all([
        base44.entities.Customer.list('-created_date', 200),
        base44.entities.Sale.list('-created_date', 200),
      ]);
      setCustomers(c); setSales(s);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const getSales = (cid) => sales.filter(s => s.cliente_id === cid);

  const handleDelete = async (c) => {
    const custSales = getSales(c.id);
    if (custSales.length > 0) {
      alert('Não é possível excluir um cliente com contratos. Remova os contratos primeiro.');
      return;
    }
    if (!confirm(`Excluir cliente ${c.nome_completo}?`)) return;
    try {
      await base44.entities.Customer.delete(c.id);
      loadData();
    } catch (e) { alert('Erro: ' + e.message); }
  };

  const handleCopyRegistrationLink = async (c) => {
    try {
      const token = await customerLinkToken(c.id);
      const link = `${window.location.origin}/completar-cadastro?cliente=${encodeURIComponent(token)}`;
      await navigator.clipboard.writeText(link);
      alert('Link copiado! Envie para o cliente completar o cadastro.');
    } catch (e) { alert('Erro: ' + e.message); }
  };

  const handleOpenPortal = async (c) => {
    try {
      const token = await customerLinkToken(c.id);
      navigate(`/portal?cliente=${encodeURIComponent(token)}`);
    } catch (e) { alert('Erro: ' + e.message); }
  };

  const filtered = customers.filter(c => {
    if (!search) return true;
    const q = search.toLowerCase();
    return c.nome_completo?.toLowerCase().includes(q) || c.cpf?.includes(search) || c.telefone?.includes(search);
  });

  if (loading) {
    return <div className="flex items-center justify-center h-full p-8"><div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" /></div>;
  }

  return (
    <div className="p-4 lg:p-6 space-y-4 max-w-[1200px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl lg:text-2xl font-extrabold tracking-tight">Diretório de Clientes</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{customers.length} cliente(s) cadastrado(s)</p>
        </div>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-sm px-4 py-2.5 rounded-md">
          <Plus className="w-4 h-4" /> Novo Cliente
        </button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por nome, CPF ou telefone..."
          className="w-full bg-card border border-border rounded-md pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      <div className="grid gap-2">
        {filtered.map(c => {
          const custSales = getSales(c.id);
          return (
            <div key={c.id} className="bg-card border border-border rounded-md p-3 hover:border-primary/30 transition-colors flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-sm font-bold text-secondary-foreground shrink-0">
                {c.nome_completo?.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm text-foreground truncate">{c.nome_completo}</div>
                <div className="text-xs text-muted-foreground">{formatCPF(c.cpf)} {c.telefone && `• ${formatPhone(c.telefone)}`}</div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-xs text-muted-foreground">{custSales.length} contrato(s)</div>
              </div>
              <button onClick={() => setEditingCustomer(c)} className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-md" title="Editar cliente">
                <Pencil className="w-4 h-4" />
              </button>
              <button onClick={() => handleDelete(c)} className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md" title="Excluir cliente">
                <Trash2 className="w-4 h-4" />
              </button>
              <button onClick={() => handleCopyRegistrationLink(c)} className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-md" title="Copiar link de cadastro">
                <Link2 className="w-4 h-4" />
              </button>
              <button onClick={() => handleOpenPortal(c)} className="p-2 text-primary hover:bg-primary/10 rounded-md" title="Ver portal do cliente">
                <ExternalLink className="w-4 h-4" />
              </button>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Users className="w-10 h-10 mx-auto mb-3 opacity-50" />
            <p className="text-sm">Nenhum cliente encontrado.</p>
          </div>
        )}
      </div>

      {showForm && <CustomerForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); loadData(); }} />}
      {editingCustomer && <CustomerForm customer={editingCustomer} onClose={() => setEditingCustomer(null)} onSaved={() => { setEditingCustomer(null); loadData(); }} />}
    </div>
  );
}

function CustomerForm({ onClose, onSaved, customer }) {
  const [form, setForm] = useState(customer ? {
    nome_completo: customer.nome_completo || '',
    cpf: customer.cpf || '',
    telefone: customer.telefone || '',
    whatsapp: customer.whatsapp || '',
    data_nascimento: customer.data_nascimento ? customer.data_nascimento.slice(0, 10) : '',
    endereco: customer.endereco || '',
  } : { nome_completo: '', cpf: '', telefone: '', whatsapp: '', data_nascimento: '', endereco: '' });
  const [fotoCpfUri, setFotoCpfUri] = useState(customer?.foto_cpf_url || '');
  const [fotoCnhUri, setFotoCnhUri] = useState(customer?.foto_cnh_url || '');
  const [fotoCompResUri, setFotoCompResUri] = useState(customer?.foto_comprovante_residencia_url || '');
  const [saving, setSaving] = useState(false);

  const handleDocExtracted = (dados, uri, field) => {
    if (field === 'cpf') setFotoCpfUri(uri);
    if (field === 'cnh') setFotoCnhUri(uri);
    if (field === 'comprovante') setFotoCompResUri(uri);
    if (dados) {
      setForm(f => ({
        ...f,
        nome_completo: dados.nome_completo || f.nome_completo,
        cpf: dados.cpf || f.cpf,
        data_nascimento: dados.data_nascimento || f.data_nascimento,
        endereco: dados.endereco || f.endereco,
      }));
    }
  };

  const handleSave = async () => {
    if (!form.nome_completo || !validateCPF(form.cpf)) return alert('Nome e CPF válido são obrigatórios');
    setSaving(true);
    try {
      const data = {
        ...form,
        cpf: form.cpf.replace(/\D/g, ''),
        data_nascimento: form.data_nascimento || null,
        foto_cpf_url: fotoCpfUri,
        foto_cnh_url: fotoCnhUri,
        foto_comprovante_residencia_url: fotoCompResUri,
      };
      if (customer) {
        await base44.entities.Customer.update(customer.id, data);
      } else {
        await base44.entities.Customer.create(data);
      }
      onSaved();
    } catch (e) { alert('Erro: ' + e.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-md w-full max-w-lg max-h-[90vh] overflow-y-auto scrollbar-thin" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border sticky top-0 bg-card z-10">
          <h2 className="font-bold text-foreground">{customer ? 'Editar Cliente' : 'Cadastrar Cliente'}</h2>
          <button onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-3">
          {/* Document photos with AI */}
          <div className="space-y-2 pb-3 border-b border-border">
            <div className="text-[10px] uppercase tracking-widest text-primary font-mono font-bold mb-1">Documentação (IA extrai os dados)</div>
            <DocumentPhotoUpload label="Foto do CPF" onExtracted={(d, uri) => handleDocExtracted(d, uri, 'cpf')} />
            <DocumentPhotoUpload label="Foto da CNH" onExtracted={(d, uri) => handleDocExtracted(d, uri, 'cnh')} />
            <DocumentPhotoUpload label="Comprovante de Residência" onExtracted={(d, uri) => handleDocExtracted(d, uri, 'comprovante')} />
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono mb-1.5 block">Nome Completo</label>
            <input value={form.nome_completo} onChange={e => setForm(f => ({ ...f, nome_completo: e.target.value }))} className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono mb-1.5 block">CPF</label>
              <input value={form.cpf} onChange={e => setForm(f => ({ ...f, cpf: e.target.value }))} placeholder="000.000.000-00" className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono mb-1.5 block">Data de Nascimento</label>
              <input type="date" value={form.data_nascimento} onChange={e => setForm(f => ({ ...f, data_nascimento: e.target.value }))} className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono mb-1.5 block">Endereço</label>
            <input value={form.endereco} onChange={e => setForm(f => ({ ...f, endereco: e.target.value }))} placeholder="Rua, número, bairro, cidade" className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono mb-1.5 block">Telefone</label>
              <input value={form.telefone} onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))} className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono mb-1.5 block">WhatsApp</label>
              <input value={form.whatsapp} onChange={e => setForm(f => ({ ...f, whatsapp: e.target.value }))} className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
          </div>
        </div>
        <div className="px-5 py-4 border-t border-border flex gap-2 sticky bottom-0 bg-card">
          <button onClick={onClose} className="flex-1 bg-secondary border border-border rounded-md py-2.5 text-sm font-semibold hover:bg-accent">Cancelar</button>
          <button onClick={handleSave} disabled={saving} className="flex-1 bg-primary text-primary-foreground rounded-md py-2.5 text-sm font-semibold hover:bg-primary/90 disabled:opacity-50">{saving ? 'Salvando...' : (customer ? 'Salvar' : 'Cadastrar')}</button>
        </div>
      </div>
    </div>
  );
}
