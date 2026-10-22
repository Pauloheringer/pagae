import React from 'react';
import { base44 } from '@/api/base44Client';
import { FileText, Download } from 'lucide-react';
import { formatDate } from '@/lib/format';

export default function ImportedDocuments({ docs }) {
  const open = async (d) => {
    const { signed_url } = await base44.integrations.Core.CreateFileSignedUrl({ file_uri: d.arquivo_uri, expires_in: 300 });
    window.open(signed_url, '_blank');
  };
  if (docs.length === 0) return null;
  return (
    <div className="space-y-2">
      <h2 className="text-sm font-bold text-foreground">Documentos já anexados aos contratos</h2>
      {docs.map(d => (
        <div key={d.id} className="bg-card border border-border rounded-md px-3 py-2 flex items-center gap-2 text-sm">
          <FileText className="w-4 h-4 text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="truncate text-foreground">{d.nome_arquivo}</div>
            <div className="text-[11px] text-muted-foreground">Contrato #{d.numero_contrato} · ref. {formatDate(d.data_geracao)}</div>
          </div>
          <button onClick={() => open(d)} className="flex items-center gap-1 text-xs text-primary font-semibold"><Download className="w-3.5 h-3.5" /> Abrir</button>
        </div>
      ))}
    </div>
  );
}
