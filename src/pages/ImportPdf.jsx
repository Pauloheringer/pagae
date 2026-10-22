import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { parsePagaePdf } from '@/functions/parsePagaePdf';
import { buildWarnings, matchByCpf, suggestCustomers, confirmImport, digits } from '@/lib/pagaeImport';
import ImportItemCard from '@/components/import/ImportItemCard';
import ImportedDocuments from '@/components/import/ImportedDocuments';
import { Upload, Loader2, FileUp } from 'lucide-react';

export default function ImportPdf() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [docs, setDocs] = useState([]);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    const [c, d] = await Promise.all([
      base44.entities.Customer.list('-created_date', 1000),
      base44.entities.ContractDocument.list('-created_date', 500),
    ]);
    setCustomers(c); setDocs(d);
  }, []);
  useEffect(() => { load(); }, [load]);

  const knownDocs = docs.map(d => { try { return JSON.parse(d.dados_extraidos); } catch { return {}; } });

  const handleFiles = async (files) => {
    setBusy(true); setMsg('');
    for (const file of Array.from(files)) {
      try {
        const { file_uri } = await base44.integrations.Core.UploadPrivateFile({ file });
        const { signed_url } = await base44.integrations.Core.CreateFileSignedUrl({ file_uri, expires_in: 600 });
        const res = await parsePagaePdf({ file_url: signed_url });
        const data = res.data.dados;
        const dup = data.numero_documento && docs.some(x => x.numero_documento === data.numero_documento);
        const byCpf = matchByCpf(data.cliente_cpf, customers);
        setItems(prev => [...prev, {
          id: crypto.randomUUID(), fileUri: file_uri, fileName: file.name, data,
          status: dup ? 'duplicate' : 'ready',
          classificacao: /parcelado/i.test(data.forma_pagamento || '') ? 'parcelado' : '',
          customerChoice: byCpf ? byCpf.id : '',
        }]);
      } catch (e) {
        setMsg(`Erro ao ler ${file.name}: ${e.message}`);
      }
    }
    setBusy(false);
  };

  const update = (id, patch) => setItems(p => p.map(i => i.id === id ? { ...i, ...patch } : i));
  const updateData = (id, patch) => setItems(p => p.map(i => i.id === id ? { ...i, data: { ...i.data, ...patch } } : i));

  const ready = items.filter(i => i.status === 'ready');
  const warningsOf = (i) => buildWarnings(i.data, [...knownDocs, ...items.filter(o => o.id !== i.id && o.status === 'ready').map(o => o.data)]);
  const canSave = ready.length > 0 && ready.every(i => i.classificacao && i.customerChoice &&
    (i.customerChoice !== 'novo' || digits(i.data.cliente_cpf).length === 11));

  const save = async () => {
    setSaving(true); setMsg('');
    try {
      const n = await confirmImport(ready.map(i => ({ ...i, warnings: warningsOf(i) })), user?.full_name);
      setMsg(`Importação concluída: ${n} contrato(s) novo(s); ${ready.length} PDF(s) anexado(s).`);
      setItems(p => p.filter(i => i.status !== 'ready'));
      load();
    } catch (e) { setMsg('Erro: ' + e.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="p-4 lg:p-6 space-y-4 max-w-[900px] mx-auto">
      <div>
        <h1 className="text-xl lg:text-2xl font-extrabold tracking-tight flex items-center gap-2"><FileUp className="w-6 h-6 text-primary" /> Importar PDFs do Pagaê</h1>
        <p className="text-sm text-muted-foreground mt-0.5">O tipo do documento é identificado pelo conteúdo. Nada é gravado antes da sua conferência.</p>
      </div>
      <label className="block border-2 border-dashed border-border rounded-md p-6 text-center cursor-pointer hover:border-primary/50">
        <input type="file" multiple accept="application/pdf" className="hidden" disabled={busy} onChange={e => e.target.files.length && handleFiles(e.target.files)} />
        {busy ? <Loader2 className="w-7 h-7 mx-auto text-primary animate-spin" /> : <Upload className="w-7 h-7 mx-auto text-muted-foreground" />}
        <p className="text-sm font-medium mt-2">{busy ? 'Lendo documentos...' : 'Anexar um ou mais PDFs'}</p>
      </label>
      {msg && <p className="text-xs text-yellow-400">{msg}</p>}
      {items.map(i => (
        <ImportItemCard key={i.id} item={i} warnings={i.status === 'ready' ? warningsOf(i) : []}
          suggestions={matchByCpf(i.data.cliente_cpf, customers) ? [matchByCpf(i.data.cliente_cpf, customers)] : suggestCustomers(i.data, customers)}
          onData={(p) => updateData(i.id, p)} onChange={(p) => update(i.id, p)} />
      ))}
      {ready.length > 0 && (
        <button onClick={save} disabled={!canSave || saving} className="w-full bg-primary text-primary-foreground font-semibold text-sm py-3 rounded-md hover:bg-primary/90 disabled:opacity-50">
          {saving ? 'Gravando...' : `Confirmar importação (${ready.length})`}
        </button>
      )}
      <ImportedDocuments docs={docs} />
    </div>
  );
}
