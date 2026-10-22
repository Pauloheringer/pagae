import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { customerPortal } from '@/functions/customerPortal';
import { formatCPF, formatPhone, validateCPF } from '@/lib/format';
import { IdCard, User, Phone, MapPin, Calendar, Loader2, Check, X, Upload, CheckCircle2 } from 'lucide-react';

export default function CompleteRegistration() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  // `cliente` is a signed link token generated in the admin panel, not a raw id.
  const session = searchParams.get('cliente');

  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    nome_completo: '', cpf: '', telefone: '', whatsapp: '',
    data_nascimento: '', endereco: '',
  });
  const [photos, setPhotos] = useState({ cpf: '', cnh: '', comprovante: '' });
  const [uploading, setUploading] = useState({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!session) { setLoading(false); return; }
    customerPortal({ action: 'load', session }).then(res => {
      const c = res.data.customer;
      setCustomer(c);
      setForm({
        nome_completo: c.nome_completo || '', cpf: c.cpf || '',
        telefone: c.telefone || '', whatsapp: c.whatsapp || '',
        data_nascimento: c.data_nascimento ? c.data_nascimento.slice(0, 10) : '',
        endereco: c.endereco || '',
      });
      setPhotos({
        cpf: c.foto_cpf_url || '', cnh: c.foto_cnh_url || '',
        comprovante: c.foto_comprovante_residencia_url || '',
      });
    }).catch(() => setError('Link inválido ou expirado.')).finally(() => setLoading(false));
  }, [session]);

  const handlePhoto = async (field, file) => {
    if (!file) return;
    setUploading(prev => ({ ...prev, [field]: true }));
    try {
      const { file_uri } = await base44.integrations.Core.UploadPortalFile({ file, session });
      setPhotos(prev => ({ ...prev, [field]: file_uri }));
    } catch (e) {
      alert('Erro ao enviar foto: ' + e.message);
    } finally {
      setUploading(prev => ({ ...prev, [field]: false }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.nome_completo.trim()) { setError('Nome completo é obrigatório'); return; }
    if (!validateCPF(form.cpf.replace(/\D/g, ''))) { setError('CPF inválido'); return; }
    if (!form.telefone.replace(/\D/g, '')) { setError('Telefone é obrigatório'); return; }
    setSaving(true);
    try {
      await customerPortal({
        action: 'updateCustomer',
        session,
        data: {
          nome_completo: form.nome_completo.trim(),
          cpf: form.cpf.replace(/\D/g, ''),
          telefone: form.telefone.replace(/\D/g, ''),
          whatsapp: form.whatsapp.replace(/\D/g, '') || form.telefone.replace(/\D/g, ''),
          data_nascimento: form.data_nascimento || null,
          endereco: form.endereco.trim(),
          foto_cpf_url: photos.cpf,
          foto_cnh_url: photos.cnh,
          foto_comprovante_residencia_url: photos.comprovante,
        },
      });
      setSaved(true);
    } catch (e) { setError('Erro ao salvar: ' + (e.response?.data?.error || e.message)); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="min-h-screen bg-background flex items-center justify-center"><div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" /></div>;

  if (saved) return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-md text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-green-500/10 border border-green-500/30 mb-4">
          <CheckCircle2 className="w-7 h-7 text-green-400" />
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-2">Dados salvos!</h1>
        <p className="text-sm text-muted-foreground mb-6">Seus dados foram enviados com sucesso.</p>
        <button onClick={() => navigate('/login')} className="bg-primary text-primary-foreground font-semibold text-sm px-6 py-3 rounded-md hover:bg-primary/90">Acessar Portal</button>
      </div>
    </div>
  );

  if (!session || (error && !customer)) return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="text-center text-muted-foreground"><p className="text-sm">{error || 'Link inválido. Solicite um novo link à loja.'}</p></div>
    </div>
  );

  const photoLabels = { cpf: 'Foto do CPF', cnh: 'Foto da CNH', comprovante: 'Comprovante de Residência' };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card sticky top-0 z-30" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="h-14 flex items-center gap-2 px-4">
          <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center font-extrabold text-primary-foreground text-sm">P</div>
          <span className="font-bold text-sm text-foreground">Paulinho Veículos</span>
        </div>
      </header>
      <div className="max-w-md mx-auto p-4 space-y-4" style={{ paddingBottom: 'calc(2rem + env(safe-area-inset-bottom))' }}>
        <div>
          <h1 className="text-lg font-extrabold text-foreground">Complete seu cadastro</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Preencha seus dados abaixo. As fotos são opcionais.</p>
        </div>
        {error && <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-2 pb-3 border-b border-border">
            <div className="text-[10px] uppercase tracking-widest text-primary font-mono font-bold mb-1">Documentação (opcional)</div>
            {['cpf', 'cnh', 'comprovante'].map(field => (
              <div key={field} className="space-y-1">
                <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono block">{photoLabels[field]}</label>
                {!photos[field] && !uploading[field] && (
                  <label className="block border-2 border-dashed border-border rounded-md p-3 text-center cursor-pointer hover:border-primary/50 transition-colors">
                    <input type="file" accept="image/*,application/pdf" className="hidden" onChange={e => e.target.files[0] && handlePhoto(field, e.target.files[0])} />
                    <Upload className="w-5 h-5 text-muted-foreground mx-auto mb-1" />
                    <p className="text-xs text-foreground font-medium">Anexar</p>
                  </label>
                )}
                {uploading[field] && (
                  <div className="flex items-center justify-center gap-2 py-3 border border-border rounded-md">
                    <Loader2 className="w-4 h-4 text-primary animate-spin" />
                    <span className="text-xs text-muted-foreground">Enviando...</span>
                  </div>
                )}
                {photos[field] && !uploading[field] && (
                  <div className="flex items-center justify-between bg-green-500/5 border border-green-500/20 rounded-md px-3 py-2">
                    <div className="flex items-center gap-2"><Check className="w-4 h-4 text-green-400" /><span className="text-xs text-foreground">Foto anexada</span></div>
                    <button type="button" onClick={() => setPhotos(prev => ({ ...prev, [field]: '' }))} className="text-muted-foreground hover:text-destructive"><X className="w-4 h-4" /></button>
                  </div>
                )}
              </div>
            ))}
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono mb-1.5 block">Nome Completo *</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input value={form.nome_completo} onChange={e => setForm(f => ({ ...f, nome_completo: e.target.value }))} className="w-full bg-background border border-border rounded-md pl-10 pr-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary" placeholder="Seu nome completo" required />
            </div>
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono mb-1.5 block">CPF *</label>
            <div className="relative">
              <IdCard className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input value={formatCPF(form.cpf)} onChange={e => setForm(f => ({ ...f, cpf: e.target.value.replace(/\D/g, '') }))} className="w-full bg-background border border-border rounded-md pl-10 pr-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary" placeholder="000.000.000-00" maxLength={14} required />
            </div>
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono mb-1.5 block">Telefone / WhatsApp *</label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input value={formatPhone(form.telefone)} onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))} className="w-full bg-background border border-border rounded-md pl-10 pr-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary" placeholder="(00) 00000-0000" required />
            </div>
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono mb-1.5 block">Data de Nascimento</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input type="date" value={form.data_nascimento} onChange={e => setForm(f => ({ ...f, data_nascimento: e.target.value }))} className="w-full bg-background border border-border rounded-md pl-10 pr-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono mb-1.5 block">Endereço</label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input value={form.endereco} onChange={e => setForm(f => ({ ...f, endereco: e.target.value }))} className="w-full bg-background border border-border rounded-md pl-10 pr-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary" placeholder="Rua, número, bairro, cidade" />
            </div>
          </div>
          <button type="submit" disabled={saving} className="w-full bg-primary text-primary-foreground font-semibold text-sm py-3 rounded-md hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2">
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Salvando...</> : <><Check className="w-4 h-4" /> Enviar Dados</>}
          </button>
        </form>
      </div>
    </div>
  );
}
