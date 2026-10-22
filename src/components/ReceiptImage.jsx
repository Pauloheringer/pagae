import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Image as ImageIcon } from 'lucide-react';

export default function ReceiptImage({ fileUri, className, alt }) {
  const [signedUrl, setSignedUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!fileUri) { setLoading(false); return; }
    let active = true;
    setLoading(true);
    base44.integrations.Core.CreateFileSignedUrl({ file_uri: fileUri, expires_in: 300 })
      .then(res => {
        if (active) setSignedUrl(res.signed_url);
      })
      .catch(() => { if (active) setError(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [fileUri]);

  if (!fileUri) {
    return (
      <div className={`flex items-center justify-center ${className || ''}`}>
        <div className="text-center">
          <ImageIcon className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-xs text-muted-foreground">Sem comprovante</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return <div className={`flex items-center justify-center ${className || ''}`}><div className="w-6 h-6 border-2 border-border border-t-primary rounded-full animate-spin" /></div>;
  }

  if (error || !signedUrl) {
    return <div className={`flex items-center justify-center ${className || 'h-48'} bg-secondary rounded text-xs text-muted-foreground`}>Erro ao carregar</div>;
  }

  return <img src={signedUrl} alt={alt || 'Comprovante'} className={className} />;
}
