import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { formatCurrency, formatDate, formatCPF, formatPlate, validateCPF } from '@/lib/format';
import StatusBadge from '@/components/StatusBadge';
import ContractCalcPreview from '@/components/contracts/ContractCalcPreview';
import ContractPhotoUpload from '@/components/contracts/ContractPhotoUpload';
import ContractEditModal from '@/components/contracts/ContractEditModal';
import VehiclePhotoUpload from '@/components/contracts/VehiclePhotoUpload';
import { FileText, Plus, Search, X, Car, User, Pencil, Loader2, ChevronRight, ChevronLeft, Check } from 'lucide-react';
import PullToRefresh from '@/components/PullToRefresh';

// Recriada a partir do comportamento da versão Base44 (o arquivo original era
// grande demais para ser exportado): lista de contratos com busca, criação em
// etapas com leitura da promissória por IA e edição de vencimentos.

const saleStatusMap = {
  ativo: { label: 'Ativo', className: 'bg-blue-500/10 text-blue-400 border-blue-500/30' },
  quitado: { label: 'Quitado', className: 'bg-green-500/10 text-green-400 border-green-500/30' },
  renegociado: { label: 'Renegociado', className: 'bg-orange-500/10 text-orange-400 border-orange-500/30' },
};

const tipoLabel = { parcelado: 'Parcelado', sem_parcelamento: 'Sem parcelamento', venda: 'Venda' };

const inputCls = 'w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary';
const labelCls = 'text-[10px] uppercase tracking-widest text-muted-foreground font-mono mb-1.5 block';

export default function Contracts() {
  const [searchParams] = useSearchParams();
  const [sales, setSales] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [installments, setInstallments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingSale, setEditingSale] = useState(null);
  const [search, setSearch] = useState('');

  const loadData = useCallback(async () => {
    try {
      const [s, c, v, i] = await Promise.all([
        base44.entities.Sale.list('-created_date', 200),
        base44.entities.Customer.list('-created_date', 200),
        base44.entities.Vehicle.list('-created_date', 200),
        base44.entities.Installment.list('-created_date', 500),
      ]);
      setSales(s); setCustomers(c); setVehicles(v); setInstallments(i);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // A busca rápida do topo abre esta tela com ?q=<contrato>
  useEffect(() => {
    const q = searchParams.get('q');
    if (q != null) setSearch(q);
  }, [searchParams]);

  const getCustomer = (id) => customers.find(c => c.id === id);
  const getVehicle = (id) => vehicles.find(v => v.id === id);
  const getInstallments = (saleId) => installments.filter(i => i.venda_id === saleId);

  const filtered = sales.filter(s => {
    if (!search) return true;
    const q = search.toLowerCase();
    const c = getCustomer(s.cliente_id);
    const v = getVehicle(s.veiculo_id);
    return (s.numero_contrato || '').toLowerCase().includes(q) ||
      (c?.nome_completo || '').toLowerCase().includes(q) ||
      (c?.cpf || '').includes(search.replace(/\D/g, '') || '§') ||
      (v?.placa || '').toLowerCase().includes(q) ||
      (v?.modelo || '').toLowerCase().includes(q);
  });

  if (loading) {
    return <div className="flex items-center justify-center h-full p-8"><div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" /></div>;
  }

  return (
    <PullToRefresh onRefresh={loadData}>
    <div className="p-4 lg:p-6 space-y-4 max-w-[1200px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl lg:text-2xl font-extrabold tracking-tight flex items-center gap-2">
            <FileText className="w-6 h-6 text-primary" /> Contratos & Veículos
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">{sales.length} contrato(s) • {vehicles.length} veículo(s)</p>
        </div>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-sm px-4 py-2.5 rounded-md">
          <Plus className="w-4 h-4" /> Novo Contrato
        </button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por contrato, cliente, CPF ou placa..."
          className="w-full bg-card border border-border rounded-md pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      <div className="grid gap-3">
        {filtered.map(sale => {
          const c = getCustomer(sale.cliente_id);
          const v = getVehicle(sale.veiculo_id);
          const insts = getInstallments(sale.id);
          const paid = insts.filter(i => i.status === 'paga');
          const open = insts.filter(i => i.status !== 'paga');
          const saldo = open.reduce((s, i) => s + ((i.valor || 0) - (i.valor_pago || 0)), 0);
          const next = open.sort((a, b) => new Date(a.vencimento) - new Date(b.vencimento))[0];
          const pct = insts.length ? Math.round((paid.length / insts.length) * 100) : 0;
          return (
            <div key={sale.id} className="bg-card border border-border rounded-md p-4 hover:border-primary/30 transition-colors">
              <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                  <Car className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-sm text-foreground">#{sale.numero_contrato}</span>
                    <StatusBadge status={sale.status} statusMap={saleStatusMap} />
                    {sale.tipo_contrato && (
                      <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">{tipoLabel[sale.tipo_contrato] || sale.tipo_contrato}</span>
                    )}
                  </div>
                  <div className="text-sm text-foreground mt-0.5 truncate">{c?.nome_completo || 'Cliente não encontrado'} <span className="text-xs text-muted-foreground">{formatCPF(c?.cpf)}</span></div>
                  <div className="text-xs text-muted-foreground truncate">
                    {v ? `${v.marca} ${v.modelo}${v.ano_modelo ? ` ${v.ano_modelo}` : ''} • ${formatPlate(v.placa)}` : (sale.descricao || 'Sem veículo vinculado')}
                  </div>
                  {sale.sinalizacoes && (
                    <div className="text-[11px] text-orange-300 mt-1 line-clamp-2">{sale.sinalizacoes}</div>
                  )}
                </div>
                <div className="grid grid-cols-3 sm:flex sm:flex-col sm:items-end gap-2 sm:gap-0.5 text-xs shrink-0">
                  <div className="sm:text-right"><span className="text-muted-foreground">Venda </span><span className="font-bold text-foreground">{formatCurrency(sale.valor_venda)}</span></div>
                  <div className="sm:text-right"><span className="text-muted-foreground">Saldo </span><span className="font-semibold text-foreground">{formatCurrency(insts.length ? saldo : sale.saldo_inicial)}</span></div>
                  <div className="sm:text-right text-muted-foreground">{next ? `Próx.: ${formatDate(next.vencimento)}` : insts.length ? 'Quitado' : (sale.proximo_vencimento ? `Próx.: ${formatDate(sale.proximo_vencimento)}` : '—')}</div>
                </div>
              </div>
              {insts.length > 0 && (
                <div className="mt-3">
                  <div className="flex justify-between text-[11px] text-muted-foreground mb-1">
                    <span>{paid.length} de {insts.length} parcela(s) paga(s)</span>
                    <span>{pct}%</span>
                  </div>
                  <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )}
              {insts.length > 0 && (
                <div className="mt-3 flex justify-end">
                  <button onClick={() => setEditingSale(sale)} className="flex items-center gap-1.5 text-xs font-semibold bg-secondary border border-border hover:bg-accent px-3 py-1.5 rounded-md">
                    <Pencil className="w-3.5 h-3.5" /> Editar parcelas
                  </button>
                </div>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <FileText className="w-10 h-10 mx-auto mb-3 opacity-50" />
            <p className="text-sm">Nenhum contrato encontrado.</p>
          </div>
        )}
      </div>

      {showForm && (
        <ContractForm
          customers={customers}
          vehicles={vehicles}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); loadData(); }}
        />
      )}

      {editingSale && (
        <ContractEditModal
          sale={editingSale}
          customer={getCustomer(editingSale.cliente_id)}
          vehicle={getVehicle(editingSale.veiculo_id)}
          installments={getInstallments(editingSale.id)}
          onClose={() => setEditingSale(null)}
          onSaved={() => { setEditingSale(null); loadData(); }}
        />
      )}
    </div>
    </PullToRefresh>
  );
}

function nextContractNumber() {
  const d = new Date();
  const p = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${String(Date.now()).slice(-4)}`;
}

function ContractForm({ customers, vehicles, onClose, onSaved }) {
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    numero_contrato: nextContractNumber(),
    cliente_id: '', veiculo_id: '',
    data_contrato: new Date().toISOString().slice(0, 10),
    valor_venda: '', entrada_dinheiro: '',
    veiculo_troca_descricao: '', veiculo_troca_valor: '',
    quantidade_parcelas: '', valor_parcela: '', vencimento_primeira: '',
    descricao: '', observacoes: '',
  });
  const [saving, setSaving] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ nome_completo: '', cpf: '', telefone: '', whatsapp: '' });
  const [newVehicle, setNewVehicle] = useState({ marca: '', modelo: '', placa: '', ano_fabricacao: '', ano_modelo: '', cor: '' });
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [showNewVehicle, setShowNewVehicle] = useState(false);
  const [fotoUri, setFotoUri] = useState('');
  const [fotoCarroVendidoUri, setFotoCarroVendidoUri] = useState('');
  const [fotoCarroTrocaUri, setFotoCarroTrocaUri] = useState('');
  const [error, setError] = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const availableVehicles = vehicles.filter(v => v.status === 'disponivel' || v.id === form.veiculo_id);

  // IA leu a promissória: pré-preenche o que conseguir, sem apagar o que já foi digitado.
  const handleContractExtracted = (d, uri) => {
    setFotoUri(uri);
    if (!d) return;
    setForm(f => ({
      ...f,
      numero_contrato: d.numero_contrato || f.numero_contrato,
      valor_venda: d.valor_venda || f.valor_venda,
      entrada_dinheiro: d.entrada_dinheiro || f.entrada_dinheiro,
      quantidade_parcelas: d.quantidade_parcelas || f.quantidade_parcelas,
      valor_parcela: d.valor_parcela || f.valor_parcela,
      veiculo_troca_descricao: d.veiculo_troca_descricao || f.veiculo_troca_descricao,
      veiculo_troca_valor: d.veiculo_troca_valor || f.veiculo_troca_valor,
      vencimento_primeira: d.data_primeiro_vencimento || f.vencimento_primeira,
      observacoes: d.observacoes || f.observacoes,
    }));
    const cpf = (d.cliente_cpf || '').replace(/\D/g, '');
    const match = cpf.length === 11 && customers.find(c => (c.cpf || '').replace(/\D/g, '') === cpf);
    if (match) {
      set('cliente_id', match.id);
    } else if (d.cliente_nome) {
      setShowNewCustomer(true);
      setNewCustomer(n => ({ ...n, nome_completo: n.nome_completo || d.cliente_nome, cpf: n.cpf || cpf }));
    }
    const placa = (d.veiculo_placa || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    const vMatch = placa && vehicles.find(v => (v.placa || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase() === placa);
    if (vMatch) set('veiculo_id', vMatch.id);
    else if (placa) {
      setShowNewVehicle(true);
      setNewVehicle(n => ({ ...n, placa: n.placa || placa }));
    }
  };

  const handleSoldVehicleExtracted = (d, uri) => {
    setFotoCarroVendidoUri(uri);
    if (!d) return;
    setShowNewVehicle(true);
    setNewVehicle(n => ({
      ...n,
      marca: d.marca || n.marca, modelo: d.modelo || n.modelo,
      cor: d.cor || n.cor, placa: d.placa || n.placa, ano_modelo: d.ano || n.ano_modelo,
    }));
  };

  const handleTradeVehicleExtracted = (d, uri) => {
    setFotoCarroTrocaUri(uri);
    if (!d) return;
    const desc = [d.marca, d.modelo, d.ano, d.cor, d.placa].filter(Boolean).join(' ');
    if (desc) set('veiculo_troca_descricao', form.veiculo_troca_descricao || desc);
  };

  const createCustomer = async () => {
    const cpf = newCustomer.cpf.replace(/\D/g, '');
    if (!newCustomer.nome_completo || !validateCPF(cpf)) throw new Error('Novo cliente: nome e CPF válido são obrigatórios');
    const created = await base44.entities.Customer.create({
      ...newCustomer, cpf,
      telefone: newCustomer.telefone.replace(/\D/g, ''),
      whatsapp: (newCustomer.whatsapp || newCustomer.telefone).replace(/\D/g, ''),
      ativo: true,
    });
    return created.id;
  };

  const createVehicle = async () => {
    if (!newVehicle.marca || !newVehicle.modelo || !newVehicle.placa) throw new Error('Novo veículo: marca, modelo e placa são obrigatórios');
    const created = await base44.entities.Vehicle.create({
      ...newVehicle,
      placa: newVehicle.placa.toUpperCase(),
      ano_fabricacao: newVehicle.ano_fabricacao ? Number(newVehicle.ano_fabricacao) : null,
      status: 'vendido',
    });
    return created.id;
  };

  const validateStep = () => {
    setError('');
    if (step === 2) {
      if (!showNewCustomer && !form.cliente_id) return 'Selecione ou cadastre o cliente';
    }
    if (step === 3) {
      if (!(parseFloat(form.valor_venda) > 0)) return 'Informe o valor da venda';
    }
    return '';
  };

  const next = () => {
    const msg = validateStep();
    if (msg) { setError(msg); return; }
    setStep(s => s + 1);
  };

  const handleSave = async () => {
    const msg = validateStep();
    if (msg) { setError(msg); return; }
    setSaving(true);
    setError('');
    try {
      const clienteId = showNewCustomer ? await createCustomer() : form.cliente_id;
      const veiculoId = showNewVehicle ? await createVehicle() : (form.veiculo_id || null);

      const valorVenda = parseFloat(form.valor_venda) || 0;
      const entrada = parseFloat(form.entrada_dinheiro) || 0;
      const trocaValor = parseFloat(form.veiculo_troca_valor) || 0;
      const qtd = parseInt(form.quantidade_parcelas) || 0;
      const valorParc = parseFloat(form.valor_parcela) || 0;
      const saldo = +(valorVenda - entrada - trocaValor).toFixed(2);

      let trocaId = null;
      if (form.veiculo_troca_descricao && trocaValor > 0) {
        const [marca, ...resto] = form.veiculo_troca_descricao.split(' ');
        const placaMatch = form.veiculo_troca_descricao.match(/[A-Z]{3}-?\d[A-Z0-9]\d{2}/i);
        const troca = await base44.entities.Vehicle.create({
          marca: marca || 'Troca',
          modelo: resto.join(' ') || form.veiculo_troca_descricao,
          placa: placaMatch ? placaMatch[0].toUpperCase().replace('-', '') : 'SEM-PLACA',
          status: 'recebido_troca',
          cliente_troca_id: clienteId,
        });
        trocaId = troca.id;
      }

      if (veiculoId && !showNewVehicle) {
        await base44.entities.Vehicle.update(veiculoId, { status: 'vendido' });
      }

      const sale = await base44.entities.Sale.create({
        numero_contrato: form.numero_contrato,
        tipo_contrato: qtd > 0 ? 'parcelado' : 'venda',
        cliente_id: clienteId,
        veiculo_id: veiculoId,
        data_contrato: form.data_contrato,
        valor_venda: valorVenda,
        entrada_dinheiro: entrada,
        veiculo_troca_id: trocaId,
        veiculo_troca_descricao: form.veiculo_troca_descricao,
        veiculo_troca_valor: trocaValor,
        saldo_parcelado: saldo,
        quantidade_parcelas: qtd || null,
        valor_parcela: valorParc || null,
        descricao: form.descricao,
        observacoes: form.observacoes,
        foto_url: fotoUri,
        foto_carro_vendido_url: fotoCarroVendidoUri,
        foto_carro_troca_url: fotoCarroTrocaUri,
        status: 'ativo',
      });

      if (qtd > 0 && valorParc > 0) {
        const base = form.vencimento_primeira ? new Date(form.vencimento_primeira + 'T00:00:00') : new Date();
        const instData = [];
        for (let n = 0; n < qtd; n++) {
          const d = new Date(base);
          d.setMonth(d.getMonth() + n);
          instData.push({
            venda_id: sale.id,
            cliente_id: clienteId,
            numero: n + 1,
            valor: valorParc,
            vencimento: d.toISOString().slice(0, 10),
            status: 'aberta',
            valor_pago: 0,
          });
        }
        await base44.entities.Installment.bulkCreate(instData);
      }

      await base44.entities.AuditLog.create({
        acao: 'criar_contrato',
        entidade: 'Sale',
        entidade_id: sale.id,
        detalhes: `Contrato ${form.numero_contrato}: ${formatCurrency(valorVenda)}${qtd ? `, ${qtd}x de ${formatCurrency(valorParc)}` : ''}`,
        usuario_nome: user?.full_name || 'Admin',
      });

      onSaved();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const steps = ['Documento', 'Cliente & Veículo', 'Valores'];

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-md w-full max-w-xl max-h-[90vh] overflow-y-auto scrollbar-thin" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-border sticky top-0 bg-card z-10">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-foreground">Novo Contrato</h2>
            <button onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
          </div>
          <div className="flex gap-1.5 mt-3">
            {steps.map((label, i) => (
              <div key={label} className="flex-1">
                <div className={`h-1 rounded-full ${step > i ? 'bg-primary' : 'bg-secondary'}`} />
                <div className={`text-[10px] mt-1 ${step === i + 1 ? 'text-primary font-semibold' : 'text-muted-foreground'}`}>{i + 1}. {label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="p-5 space-y-3">
          {step === 1 && (
            <>
              <ContractPhotoUpload onExtracted={handleContractExtracted} />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Número do Contrato</label>
                  <input value={form.numero_contrato} onChange={e => set('numero_contrato', e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Data do Contrato</label>
                  <input type="date" value={form.data_contrato} onChange={e => set('data_contrato', e.target.value)} className={inputCls} />
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground">O documento é opcional. Sem ele, preencha os dados nas próximas etapas.</p>
            </>
          )}

          {step === 2 && (
            <>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className={labelCls + ' mb-0'}><User className="w-3 h-3 inline mr-1" />Cliente</label>
                  <button onClick={() => setShowNewCustomer(!showNewCustomer)} className="text-xs text-primary font-semibold">
                    {showNewCustomer ? 'Escolher existente' : '+ Novo cliente'}
                  </button>
                </div>
                {!showNewCustomer ? (
                  <select value={form.cliente_id} onChange={e => set('cliente_id', e.target.value)} className={inputCls}>
                    <option value="">Selecione o cliente...</option>
                    {customers.map(c => <option key={c.id} value={c.id}>{c.nome_completo} — {formatCPF(c.cpf)}</option>)}
                  </select>
                ) : (
                  <div className="grid grid-cols-2 gap-2 bg-background border border-border rounded-md p-3">
                    <input placeholder="Nome completo" value={newCustomer.nome_completo} onChange={e => setNewCustomer(n => ({ ...n, nome_completo: e.target.value }))} className={inputCls + ' col-span-2'} />
                    <input placeholder="CPF" value={newCustomer.cpf} onChange={e => setNewCustomer(n => ({ ...n, cpf: e.target.value }))} className={inputCls} />
                    <input placeholder="Telefone" value={newCustomer.telefone} onChange={e => setNewCustomer(n => ({ ...n, telefone: e.target.value }))} className={inputCls} />
                    <input placeholder="WhatsApp (se diferente)" value={newCustomer.whatsapp} onChange={e => setNewCustomer(n => ({ ...n, whatsapp: e.target.value }))} className={inputCls + ' col-span-2'} />
                  </div>
                )}
              </div>

              <div className="space-y-2 pt-3 border-t border-border">
                <div className="flex items-center justify-between">
                  <label className={labelCls + ' mb-0'}><Car className="w-3 h-3 inline mr-1" />Veículo Vendido</label>
                  <button onClick={() => setShowNewVehicle(!showNewVehicle)} className="text-xs text-primary font-semibold">
                    {showNewVehicle ? 'Escolher do estoque' : '+ Novo veículo'}
                  </button>
                </div>
                {!showNewVehicle ? (
                  <select value={form.veiculo_id} onChange={e => set('veiculo_id', e.target.value)} className={inputCls}>
                    <option value="">Sem veículo (empréstimo / outro)</option>
                    {availableVehicles.map(v => <option key={v.id} value={v.id}>{v.marca} {v.modelo} — {formatPlate(v.placa)}</option>)}
                  </select>
                ) : (
                  <div className="space-y-2 bg-background border border-border rounded-md p-3">
                    <VehiclePhotoUpload label="Foto do carro vendido" onExtracted={handleSoldVehicleExtracted} />
                    <div className="grid grid-cols-2 gap-2">
                      <input placeholder="Marca" value={newVehicle.marca} onChange={e => setNewVehicle(n => ({ ...n, marca: e.target.value }))} className={inputCls} />
                      <input placeholder="Modelo" value={newVehicle.modelo} onChange={e => setNewVehicle(n => ({ ...n, modelo: e.target.value }))} className={inputCls} />
                      <input placeholder="Placa" value={newVehicle.placa} onChange={e => setNewVehicle(n => ({ ...n, placa: e.target.value }))} className={inputCls} />
                      <input placeholder="Cor" value={newVehicle.cor} onChange={e => setNewVehicle(n => ({ ...n, cor: e.target.value }))} className={inputCls} />
                      <input placeholder="Ano fabricação" value={newVehicle.ano_fabricacao} onChange={e => setNewVehicle(n => ({ ...n, ano_fabricacao: e.target.value }))} className={inputCls} />
                      <input placeholder="Ano/Modelo" value={newVehicle.ano_modelo} onChange={e => setNewVehicle(n => ({ ...n, ano_modelo: e.target.value }))} className={inputCls} />
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Valor da Venda</label>
                  <input type="number" step="0.01" value={form.valor_venda} onChange={e => set('valor_venda', e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Entrada em Dinheiro</label>
                  <input type="number" step="0.01" value={form.entrada_dinheiro} onChange={e => set('entrada_dinheiro', e.target.value)} className={inputCls} />
                </div>
              </div>

              <div className="space-y-2 pt-3 border-t border-border">
                <label className={labelCls}>Bem Recebido na Troca (opcional)</label>
                <VehiclePhotoUpload label="Foto do carro recebido" onExtracted={handleTradeVehicleExtracted} />
                <div className="grid grid-cols-3 gap-2">
                  <input placeholder="Descrição (marca, modelo, placa)" value={form.veiculo_troca_descricao} onChange={e => set('veiculo_troca_descricao', e.target.value)} className={inputCls + ' col-span-2'} />
                  <input type="number" step="0.01" placeholder="Valor" value={form.veiculo_troca_valor} onChange={e => set('veiculo_troca_valor', e.target.value)} className={inputCls} />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 pt-3 border-t border-border">
                <div>
                  <label className={labelCls}>Nº Parcelas</label>
                  <input type="number" value={form.quantidade_parcelas} onChange={e => set('quantidade_parcelas', e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Valor Parcela</label>
                  <input type="number" step="0.01" value={form.valor_parcela} onChange={e => set('valor_parcela', e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>1º Vencimento</label>
                  <input type="date" value={form.vencimento_primeira} onChange={e => set('vencimento_primeira', e.target.value)} className={inputCls} />
                </div>
              </div>

              <ContractCalcPreview form={form} />

              <div>
                <label className={labelCls}>Descrição</label>
                <input value={form.descricao} onChange={e => set('descricao', e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Observações</label>
                <textarea rows={2} value={form.observacoes} onChange={e => set('observacoes', e.target.value)} className={inputCls} />
              </div>
            </>
          )}

          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>

        <div className="px-5 py-4 border-t border-border flex gap-2 sticky bottom-0 bg-card">
          {step > 1 ? (
            <button onClick={() => { setError(''); setStep(s => s - 1); }} className="flex-1 flex items-center justify-center gap-1 bg-secondary border border-border rounded-md py-2.5 text-sm font-semibold hover:bg-accent">
              <ChevronLeft className="w-4 h-4" /> Voltar
            </button>
          ) : (
            <button onClick={onClose} className="flex-1 bg-secondary border border-border rounded-md py-2.5 text-sm font-semibold hover:bg-accent">Cancelar</button>
          )}
          {step < 3 ? (
            <button onClick={next} className="flex-1 flex items-center justify-center gap-1 bg-primary text-primary-foreground rounded-md py-2.5 text-sm font-semibold hover:bg-primary/90">
              Avançar <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button onClick={handleSave} disabled={saving} className="flex-1 flex items-center justify-center gap-1.5 bg-primary text-primary-foreground rounded-md py-2.5 text-sm font-semibold hover:bg-primary/90 disabled:opacity-50">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {saving ? 'Salvando...' : 'Criar Contrato'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
