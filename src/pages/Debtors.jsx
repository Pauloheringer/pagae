import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { formatCurrency, formatDate, formatPlate, formatPhone, daysUntil } from '@/lib/format';
import StatusBadge from '@/components/StatusBadge';
import { installmentStatusMap } from '@/lib/format';
import { AlertTriangle, MessageCircle, Search, Users, Car, Download } from 'lucide-react';
import { downloadDelinquencyReport } from '@/lib/delinquencyReport';

function formatDateLong(dateStr) {
  if (!dateStr) return '-';
  const date = new Date(dateStr + 'T00:00:00');
  const months = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
  return `${date.getDate()} de ${months[date.getMonth()]} de ${date.getFullYear()}`;
}

export default function Debtors() {
  const { user } = useAuth();
  const [installments, setInstallments] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [sales, setSales] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const loadData = useCallback(async () => {
    try {
      const [i, c, s, v] = await Promise.all([
        base44.entities.Installment.list('-vencimento', 500),
        base44.entities.Customer.list('-created_date', 200),
        base44.entities.Sale.list('-created_date', 200),
        base44.entities.Vehicle.list('-created_date', 200),
      ]);
      setInstallments(i); setCustomers(c); setSales(s); setVehicles(v);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const getCustomer = (id) => customers.find(c => c.id === id);
  const getSale = (id) => sales.find(s => s.id === id);
  const getVehicle = (id) => vehicles.find(v => v.id === id);

  // Filter overdue installments (not paid and vencimento < today)
  const overdue = installments.filter(i => {
    if (i.status === 'paga') return false;
    const days = daysUntil(i.vencimento);
    return days < 0;
  }).sort((a, b) => new Date(a.vencimento) - new Date(b.vencimento));

  // Group by customer
  const grouped = {};
  overdue.forEach(inst => {
    if (!grouped[inst.cliente_id]) grouped[inst.cliente_id] = [];
    grouped[inst.cliente_id].push(inst);
  });

  // Filter by search
  const filteredCustomers = Object.keys(grouped).filter(cid => {
    if (!search) return true;
    const c = getCustomer(cid);
    const q = search.toLowerCase();
    return c?.nome_completo?.toLowerCase().includes(q) || c?.cpf?.includes(search) || c?.telefone?.includes(search);
  });

  const totalOverdue = overdue.reduce((s, i) => s + (i.valor - (i.valor_pago || 0)), 0);
  const totalDebtors = filteredCustomers.length;

  const handleCharge = (inst, customer) => {
    const sale = getSale(inst.venda_id);
    const totalParc = sale?.quantidade_parcelas || 0;
    const allInsts = installments.filter(i => i.venda_id === inst.venda_id);
    const openInsts = allInsts.filter(i => i.status !== 'paga');
    const saldoDevedor = openInsts.reduce((s, i) => s + (i.valor - (i.valor_pago || 0)), 0);
    const daysLate = Math.abs(daysUntil(inst.vencimento));

    const msg = `Falaê, ${customer.nome_completo}.

A parcela ${inst.numero}/${totalParc} do contrato #${sale?.numero_contrato || ''} está em aberto.

📋 *Resumo da parcela*
Total atualizado da parcela: ${formatCurrency(inst.valor)}
Valor base do saldo devedor: ${formatCurrency(saldoDevedor)}
Vencimento: ${formatDateLong(inst.vencimento)}
Dias em atraso: ${daysLate}

Organize o pagamento até o vencimento para manter essa parcela em dia.`;

    const phone = (customer.whatsapp || customer.telefone || '').replace(/\D/g, '');
    if (!phone) { alert('Cliente sem telefone/WhatsApp cadastrado'); return; }
    window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const handleExport = () => {
    const list = filteredCustomers.map((cid) => {
      const customer = getCustomer(cid);
      const insts = grouped[cid];
      const custSales = [...new Set(insts.map((i) => i.venda_id))].map(getSale).filter(Boolean);
      return {
        nome: customer?.nome_completo || 'Cliente',
        cpf: customer?.cpf,
        telefone: customer?.telefone,
        whatsapp: customer?.whatsapp,
        email: customer?.email,
        endereco: customer?.endereco,
        data_nascimento: customer?.data_nascimento,
        contratos: custSales.map((s) => s.numero_contrato).filter(Boolean).join(', ') || '-',
        veiculos: custSales
          .map((s) => {
            const v = getVehicle(s.veiculo_id);
            return v ? `${v.marca || ''} ${v.modelo || ''}${v.placa ? ` (${v.placa.toUpperCase()})` : ''}`.trim() : null;
          })
          .filter(Boolean)
          .join(', ') || '-',
        parcelas: insts.map((i) => ({
          numero: i.numero,
          vencimento: i.vencimento,
          dias: Math.abs(daysUntil(i.vencimento)),
          valor: i.valor,
          status: i.status,
        })),
        total: insts.reduce((s, i) => s + (i.valor - (i.valor_pago || 0)), 0),
      };
    }).sort((a, b) => b.total - a.total);

    downloadDelinquencyReport({
      debtors: list,
      totals: {
        clientes: list.length,
        parcelas: list.reduce((s, d) => s + d.parcelas.length, 0),
        valor: list.reduce((s, d) => s + d.total, 0),
      },
      generatedBy: user?.full_name || 'Admin',
      generatedAt: new Date().toISOString(),
    });
  };

  if (loading) {
    return <div className="flex items-center justify-center h-full p-8"><div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" /></div>;
  }

  return (
    <div className="p-4 lg:p-6 space-y-4 max-w-[1400px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl lg:text-2xl font-extrabold tracking-tight flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-red-400" /> Devedores & Cobrança
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {totalDebtors} cliente(s) com parcelas atrasadas • {overdue.length} parcela(s) em atraso • Total: {formatCurrency(totalOverdue)}
          </p>
        </div>
        <button
          onClick={handleExport}
          disabled={filteredCustomers.length === 0}
          className="flex items-center justify-center gap-2 bg-secondary border border-border hover:bg-accent font-semibold text-sm px-4 py-2.5 rounded-md disabled:opacity-50"
        >
          <Download className="w-4 h-4" /> Exportar Relatório PDF
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

      {overdue.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Users className="w-10 h-10 mx-auto mb-3 opacity-50" />
          <p className="text-sm font-semibold text-foreground">Nenhum devedor!</p>
          <p className="text-xs">Todas as parcelas estão em dia.</p>
        </div>
      )}

      <div className="space-y-4">
        {filteredCustomers.map(cid => {
          const customer = getCustomer(cid);
          const custInsts = grouped[cid];
          const customerTotal = custInsts.reduce((s, i) => s + (i.valor - (i.valor_pago || 0)), 0);
          const maxDaysLate = Math.max(...custInsts.map(i => Math.abs(daysUntil(i.vencimento))));
          return (
            <div key={cid} className="bg-card border border-border rounded-md overflow-hidden">
              {/* Customer header */}
              <div className="bg-red-500/5 border-b border-border px-4 py-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center shrink-0">
                    <span className="font-bold text-red-400 text-sm">
                      {customer?.nome_completo?.charAt(0)?.toUpperCase() || '?'}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-sm text-foreground truncate">{customer?.nome_completo || 'Cliente'}</div>
                    <div className="text-xs text-muted-foreground">
                      {customer?.telefone && formatPhone(customer.telefone)}
                      {customer?.whatsapp && customer.whatsapp !== customer.telefone && ` • WhatsApp: ${formatPhone(customer.whatsapp)}`}
                    </div>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[10px] uppercase text-muted-foreground font-mono">Em atraso</div>
                  <div className="font-bold text-sm text-red-400">{formatCurrency(customerTotal)}</div>
                  <div className="text-[10px] text-muted-foreground">{maxDaysLate} dia(s) de atraso</div>
                </div>
              </div>

              {/* Installments */}
              <div className="divide-y divide-border">
                {custInsts.map(inst => {
                  const sale = getSale(inst.venda_id);
                  const veh = sale ? getVehicle(sale.veiculo_id) : null;
                  const daysLate = Math.abs(daysUntil(inst.vencimento));
                  return (
                    <div key={inst.id} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-9 h-9 rounded-md bg-secondary flex items-center justify-center shrink-0">
                          <Car className="w-4 h-4 text-muted-foreground" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-foreground truncate">
                            {veh ? `${veh.marca} ${veh.modelo}` : 'Veículo'} {veh?.placa && <span className="text-xs text-muted-foreground font-mono">{formatPlate(veh.placa)}</span>}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Contrato #{sale?.numero_contrato || ''} • Parcela {inst.numero}/{sale?.quantidade_parcelas || '?'} • Venceu {formatDate(inst.vencimento)} • {daysLate} dia(s) de atraso
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 sm:gap-4">
                        <div className="text-right">
                          <div className="font-bold text-sm text-foreground">{formatCurrency(inst.valor)}</div>
                          <StatusBadge status={inst.status} statusMap={installmentStatusMap} />
                        </div>
                        <button
                          onClick={() => handleCharge(inst, customer)}
                          className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold px-3 py-2 rounded-md shrink-0"
                        >
                          <MessageCircle className="w-3.5 h-3.5" /> Cobrar
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
