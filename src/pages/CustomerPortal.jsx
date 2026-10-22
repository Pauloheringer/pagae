import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { customerPortal } from '@/functions/customerPortal';
import { formatCurrency, formatDate, formatPlate, formatCPF, installmentStatusMap, daysUntil } from '@/lib/format';
import StatusBadge from '@/components/StatusBadge';
import { Car, Copy, Check, Upload, MessageCircle, LogOut, X, AlertTriangle, Bell, Trash2 } from 'lucide-react';
import CustomerChat from '@/components/portal/CustomerChat';

// The portal is opened either by a customer who logged in with CPF + phone
// (a signed session kept in localStorage) or by an admin previewing a
// customer (?cliente=<signed token> generated in the admin panel).
export default function CustomerPortal() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  const handleLogout = () => {
    if (searchParams.get('cliente')) {
      navigate('/', { replace: true });
    } else {
      localStorage.removeItem('pagae_customer_session');
      navigate('/login', { replace: true });
    }
  };

  useEffect(() => {
    const previewToken = searchParams.get('cliente');
    if (previewToken) {
      setSession(previewToken);
      setAuthLoading(false);
      return;
    }

    const stored = localStorage.getItem('pagae_customer_session');
    if (stored) {
      setSession(stored);
      setAuthLoading(false);
      return;
    }

    navigate('/login', { replace: true });
  }, [searchParams, navigate]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (session) {
    const isPreview = !!searchParams.get('cliente');
    return <CustomerDashboard session={session} onLogout={handleLogout} isPreview={isPreview} />;
  }

  return null;
}

function CustomerDashboard({ session, onLogout, isPreview }) {
  const [customer, setCustomer] = useState(null);
  const [sales, setSales] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [installments, setInstallments] = useState([]);
  const [pixKey, setPixKey] = useState(null);
  const [waContacts, setWaContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [payingInstallment, setPayingInstallment] = useState(null);
  const [reports, setReports] = useState([]);

  const loadData = useCallback(async () => {
    try {
      const result = await customerPortal({ action: 'load', session });
      const data = result.data;
      setCustomer(data.customer); setSales(data.sales); setVehicles(data.vehicles); setInstallments(data.installments);
      if (data.pixKeys.length > 0) setPixKey(data.pixKeys[0]);
      setWaContacts(data.waContacts); setReports(data.reports);
    } catch (e) {
      console.error(e);
      // Expired or invalid session: back to login.
      if (e.response?.status === 401) onLogout();
    }
    finally { setLoading(false); }
  }, [session, onLogout]);

  useEffect(() => { loadData(); }, [loadData]);

  const getVehicle = (id) => vehicles.find(v => v.id === id);
  const getSale = (id) => sales.find(s => s.id === id);

  // Next due installment
  const openInstallments = installments.filter(i => i.status === 'aberta' || i.status === 'atrasada' || i.status === 'parcial');
  const nextDue = openInstallments.sort((a, b) => new Date(a.vencimento) - new Date(b.vencimento))[0];
  const nextDueSale = nextDue ? getSale(nextDue.venda_id) : null;
  const nextDueVehicle = nextDueSale ? getVehicle(nextDueSale.veiculo_id) : null;

  const totalPaid = installments.filter(i => i.status === 'paga').reduce((s, i) => s + (i.valor_pago || 0), 0);
  const totalOutstanding = openInstallments.reduce((s, i) => s + (i.valor - (i.valor_pago || 0)), 0);

  const handleCopyPix = () => {
    if (navigator.clipboard && pixKey) {
      navigator.clipboard.writeText(pixKey.chave);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleWhatsApp = (phone) => {
    const clean = phone.replace(/\D/g, '');
    const msg = encodeURIComponent('Olá, gostaria de enviar o comprovante de pagamento.');
    window.open(`https://wa.me/55${clean}?text=${msg}`, '_blank');
  };

  const handleDeleteAccount = async () => {
    if (!confirm('Tem certeza que deseja excluir sua conta? Seus dados pessoais (nome, CPF, telefone, documentos) serão anonimizados, mas o histórico financeiro dos contratos será mantido.')) return;
    if (!confirm('Esta ação NÃO pode ser desfeita. Confirme novamente para excluir definitivamente.')) return;
    try {
      await customerPortal({ action: 'deleteAccount', session });
      await onLogout();
    } catch (e) {
      alert('Erro ao excluir conta: ' + e.message);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen"><div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" /></div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card sticky top-0 z-30" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="h-14 flex items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center font-extrabold text-primary-foreground text-sm">P</div>
            <span className="font-bold text-sm text-foreground">Paulinho Veículos</span>
          </div>
          <button onClick={onLogout} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
            <LogOut className="w-3.5 h-3.5" /> Sair
          </button>
        </div>
      </header>

      <div className="max-w-md mx-auto p-4 space-y-4" style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}>
        {/* Greeting */}
        <div>
          <h1 className="text-lg font-extrabold text-foreground">Olá, {customer?.nome_completo?.split(' ')[0]}</h1>
          <p className="text-xs text-muted-foreground">{formatCPF(customer?.cpf)}</p>
        </div>

        {/* Due notification banner */}
        {nextDue && (() => {
          const days = daysUntil(nextDue.vencimento);
          if (days < 0) {
            return (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 flex items-center gap-2.5">
                <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
                <div className="text-xs">
                  <span className="font-bold text-red-400">Parcela atrasada!</span>{' '}
                  <span className="text-foreground">A parcela {nextDue.numero} venceu há {Math.abs(days)} dia(s). Regularize para evitar juros.</span>
                </div>
              </div>
            );
          }
          if (days <= 3) {
            return (
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 flex items-center gap-2.5">
                <Bell className="w-5 h-5 text-yellow-400 shrink-0" />
                <div className="text-xs">
                  <span className="font-bold text-yellow-400">Vence em breve!</span>{' '}
                  <span className="text-foreground">Sua parcela {nextDue.numero} vence em {days === 0 ? 'hoje' : `${days} dia(s)`}. Não esqueça de pagar.</span>
                </div>
              </div>
            );
          }
          return null;
        })()}

        {/* Hero arrival card - next due */}
        {nextDue ? (
          <div className="bg-gradient-to-br from-primary/10 to-card border border-primary/20 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <Car className="w-5 h-5 text-primary" />
              <div>
                <div className="font-bold text-sm text-foreground">{nextDueVehicle ? `${nextDueVehicle.marca} ${nextDueVehicle.modelo} ${nextDueVehicle.ano_fabricacao}` : `Contrato #${nextDueSale?.numero_contrato || ''}`}</div>
                {nextDueVehicle && <div className="text-xs text-muted-foreground font-mono">{formatPlate(nextDueVehicle.placa)}</div>}
              </div>
            </div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">Próximo Vencimento</span>
              <span className="text-xs font-semibold text-foreground">{formatDate(nextDue.vencimento)}</span>
            </div>
            <div className="text-2xl font-extrabold text-foreground mb-3">{formatCurrency(nextDue.valor)}</div>
            {totalOutstanding > 0 && (
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-muted-foreground">Saldo restante</span>
                  <span className="font-semibold text-foreground">{formatCurrency(totalOutstanding)}</span>
                </div>
                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full" style={{ width: `${totalPaid > 0 ? Math.min(100, (totalPaid / (totalPaid + totalOutstanding)) * 100) : 0}%` }} />
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-card border border-border rounded-lg p-6 text-center">
            <Check className="w-10 h-10 text-green-500 mx-auto mb-2" />
            <p className="text-sm font-semibold text-foreground">Tudo em dia!</p>
            <p className="text-xs text-muted-foreground">Nenhuma parcela em aberto.</p>
          </div>
        )}

        {/* Primary action block - Pix payment */}
        {nextDue && pixKey && (
          <div className="bg-card border border-border rounded-lg p-4 space-y-3">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">Parcela Atual — #{nextDue.numero}</div>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xl font-extrabold text-foreground">{formatCurrency(nextDue.valor)}</div>
                <div className="text-xs text-muted-foreground">Vence em {formatDate(nextDue.vencimento)}</div>
              </div>
              <StatusBadge status={nextDue.status} statusMap={installmentStatusMap} />
            </div>
            <div className="bg-background border border-border rounded-md p-3 space-y-1.5">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">Chave Pix (definida pela loja)</div>
              <div className="font-mono font-bold text-foreground text-lg break-all">{pixKey.chave}</div>
              <div className="text-xs text-muted-foreground">{pixKey.titular} • {pixKey.banco}</div>
            </div>
            <button onClick={handleCopyPix} className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground font-semibold text-sm py-3 rounded-md hover:bg-primary/90">
              {copied ? <><Check className="w-4 h-4" /> Copiado!</> : <><Copy className="w-4 h-4" /> Copiar Chave Pix</>}
            </button>
          </div>
        )}

        {/* Payment confirmation actions */}
        {nextDue && (
          <div className="bg-card border border-border rounded-lg p-4 space-y-3">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">Após o pagamento</div>
            <p className="text-xs text-muted-foreground">Por gentileza, envie o comprovante pelo aplicativo ou pelo WhatsApp da gestão financeira da Paulinho Veículos.</p>
            <button
              onClick={() => setPayingInstallment(nextDue)}
              className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-semibold text-sm py-3 rounded-md"
            >
              <Upload className="w-4 h-4" /> Informar Pagamento e Anexar Comprovante
            </button>
            <div className="space-y-1.5">
              {waContacts.map(c => (
                <button
                  key={c.id}
                  onClick={() => handleWhatsApp(c.telefone)}
                  className="w-full flex items-center justify-between gap-2 bg-secondary hover:bg-accent border border-border rounded-md px-3 py-2.5 text-sm"
                >
                  <span className="flex items-center gap-2">
                    <MessageCircle className="w-4 h-4 text-green-500" />
                    <span className="text-foreground font-medium">{c.nome}</span>
                  </span>
                  <span className="text-xs text-muted-foreground">WhatsApp</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Contracts history */}
        <div className="space-y-2">
          <h2 className="text-sm font-bold text-foreground pt-2">Minhas Parcelas</h2>
          {installments.map(inst => {
            const sale = getSale(inst.venda_id);
            const veh = sale ? getVehicle(sale.veiculo_id) : null;
            return (
              <div key={inst.id} className="bg-card border border-border rounded-md p-3">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="text-xs text-muted-foreground truncate">
                    {veh ? `${veh.marca} ${veh.modelo}` : 'Contrato'} • Parcela {inst.numero}
                  </div>
                  <StatusBadge status={inst.status} statusMap={installmentStatusMap} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-foreground">{formatCurrency(inst.valor)}</span>
                  <span className="text-xs text-muted-foreground">
                    {inst.status === 'paga' ? `Pago em ${formatDate(inst.data_confirmacao)}` : `Vence ${formatDate(inst.vencimento)}`}
                  </span>
                </div>
                {inst.status === 'em_analise' && (
                  <div className="text-[11px] text-yellow-400 mt-1">Aguardando confirmação da loja</div>
                )}
              </div>
            );
          })}
          {installments.length === 0 && (
            <div className="text-center py-8 text-muted-foreground text-sm">Nenhuma parcela encontrada.</div>
          )}
        </div>

        {!isPreview && (
          <div className="pt-4 border-t border-border">
            <button
              onClick={handleDeleteAccount}
              className="w-full flex items-center justify-center gap-2 text-destructive text-xs font-semibold py-2"
            >
              <Trash2 className="w-3.5 h-3.5" /> Excluir minha conta
            </button>
          </div>
        )}
      </div>

      {payingInstallment && (
        <PaymentModal
          installment={payingInstallment}
          session={session}
          onClose={() => setPayingInstallment(null)}
          onSaved={() => { setPayingInstallment(null); loadData(); }}
        />
      )}

      <CustomerChat session={session} />
    </div>
  );
}

function PaymentModal({ installment, session, onClose, onSaved }) {
  const [file, setFile] = useState(null);
  const [fileUri, setFileUri] = useState('');
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [noReceipt, setNoReceipt] = useState(false);
  const [result, setResult] = useState(null);

  const handleFile = async (f) => {
    setFile(f);
    setUploading(true);
    try {
      const { file_uri } = await base44.integrations.Core.UploadPortalFile({ file: f, session });
      setFileUri(file_uri);
    } catch (e) {
      console.error(e);
      alert('Erro ao enviar comprovante: ' + e.message);
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const res = await customerPortal({
        action: 'reportPayment',
        session,
        installment_id: installment.id,
        file_uri: fileUri || undefined,
        no_receipt: noReceipt,
      });
      setResult(res.data);
    } catch (e) {
      alert('Erro: ' + (e.response?.data?.error || e.message));
    } finally {
      setSubmitting(false);
    }
  };

  if (result) {
    return (
      <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
        <div className="bg-card border border-border rounded-md w-full max-w-md p-6 text-center">
          <Check className="w-12 h-12 text-green-500 mx-auto mb-3" />
          <h2 className="font-bold text-foreground text-sm mb-2">
            {result.auto_confirmed ? 'Pagamento Confirmado!' : 'Comprovante Enviado!'}
          </h2>
          <p className="text-xs text-muted-foreground mb-4">
            {result.auto_confirmed
              ? 'Seu pagamento foi confirmado automaticamente.'
              : 'A loja irá conferir e confirmar a baixa. Até lá, você verá "Aguardando Confirmação".'}
          </p>
          <button onClick={onSaved} className="w-full bg-primary text-primary-foreground rounded-md py-2.5 text-sm font-semibold">
            Concluir
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-md w-full max-w-md max-h-[90vh] overflow-y-auto scrollbar-thin">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between sticky top-0 bg-card z-10">
          <h2 className="font-bold text-foreground text-sm">Informar Pagamento</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="bg-secondary rounded-md p-3 text-sm">
            <div className="flex justify-between mb-1"><span className="text-muted-foreground">Parcela</span><span className="font-semibold">#{installment.numero}</span></div>
            <div className="flex justify-between mb-1"><span className="text-muted-foreground">Valor</span><span className="font-bold">{formatCurrency(installment.valor)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Vencimento</span><span>{formatDate(installment.vencimento)}</span></div>
          </div>

          {!fileUri && !noReceipt && (
            <div className="space-y-2">
              <label className="block border-2 border-dashed border-border rounded-md p-6 text-center cursor-pointer hover:border-primary/50 transition-colors">
                <input type="file" accept="image/*,application/pdf" className="hidden" onChange={e => e.target.files[0] && handleFile(e.target.files[0])} />
                <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-foreground font-medium">Anexar comprovante</p>
                <p className="text-xs text-muted-foreground mt-1">Imagem ou PDF do comprovante Pix</p>
              </label>
              <button onClick={() => setNoReceipt(true)} className="w-full text-xs text-muted-foreground hover:text-foreground underline">
                Informar pagamento sem comprovante
              </button>
            </div>
          )}

          {uploading && (
            <div className="flex items-center justify-center gap-2 py-4">
              <div className="w-5 h-5 border-2 border-border border-t-primary rounded-full animate-spin" />
              <span className="text-sm text-muted-foreground">Enviando...</span>
            </div>
          )}

          {fileUri && !uploading && (
            <div className="flex items-center justify-between bg-green-500/5 border border-green-500/20 rounded-md px-3 py-2">
              <div className="flex items-center gap-2 min-w-0">
                <Check className="w-4 h-4 text-green-400 shrink-0" />
                <span className="text-xs text-foreground truncate">{file?.name || 'Comprovante anexado'}</span>
              </div>
              <button onClick={() => { setFileUri(''); setFile(null); }} className="text-muted-foreground hover:text-destructive shrink-0"><X className="w-4 h-4" /></button>
            </div>
          )}

          {noReceipt && !fileUri && (
            <div className="bg-orange-500/5 border border-orange-500/20 rounded-md p-3 text-xs text-orange-300">
              Cliente informou pagamento de {formatCurrency(installment.valor)}, sem comprovante. A loja irá conferir o recebimento no extrato.
            </div>
          )}
        </div>
        <div className="px-5 py-4 border-t border-border flex gap-2 sticky bottom-0 bg-card">
          <button onClick={onClose} className="flex-1 bg-secondary border border-border rounded-md py-2.5 text-sm font-semibold hover:bg-accent">Cancelar</button>
          <button
            onClick={handleSubmit}
            disabled={submitting || uploading || (!fileUri && !noReceipt)}
            className="flex-1 bg-primary text-primary-foreground rounded-md py-2.5 text-sm font-semibold hover:bg-primary/90 disabled:opacity-50"
          >
            {submitting ? 'Processando...' : 'Confirmar Informe'}
          </button>
        </div>
      </div>
    </div>
  );
}
