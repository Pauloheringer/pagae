import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Search, User, FileText } from 'lucide-react';
import { formatCPF, formatPhone, formatPlate } from '@/lib/format';

const norm = (s) => (s || '').toString().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export default function QuickSearch() {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const onDown = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  const ensureData = async () => {
    if (data || loading) return;
    setLoading(true);
    try {
      const [customers, sales, vehicles] = await Promise.all([
        base44.entities.Customer.list('-created_date', 300),
        base44.entities.Sale.list('-created_date', 300),
        base44.entities.Vehicle.list('-created_date', 300),
      ]);
      setData({ customers, sales, vehicles });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const results = useMemo(() => {
    if (!data) return { customers: [], sales: [] };
    const term = norm(q.trim());
    if (term.length < 2) return { customers: [], sales: [] };
    const digits = term.replace(/\D/g, '');

    const customers = data.customers
      .filter((c) =>
        norm(c.nome_completo).includes(term) ||
        (digits.length >= 3 && [c.cpf, c.telefone, c.whatsapp].some((f) => (f || '').replace(/\D/g, '').includes(digits)))
      )
      .slice(0, 5);

    const sales = data.sales
      .filter((s) => {
        const v = data.vehicles.find((x) => x.id === s.veiculo_id);
        const c = data.customers.find((x) => x.id === s.cliente_id);
        return (
          norm(s.numero_contrato).includes(term) ||
          norm(s.descricao).includes(term) ||
          norm(v?.placa).includes(term) ||
          norm(v?.modelo).includes(term) ||
          norm(c?.nome_completo).includes(term)
        );
      })
      .slice(0, 5);

    return { customers, sales };
  }, [q, data]);

  const hasResults = results.customers.length > 0 || results.sales.length > 0;

  const go = (path) => {
    setOpen(false);
    setQ('');
    navigate(path);
  };

  const handleSubmit = () => {
    const term = q.trim();
    if (!term) return;
    if (results.customers.length === 1 && results.sales.length === 0) {
      go(`/clientes?q=${encodeURIComponent(results.customers[0].cpf || term)}`);
    } else if (results.sales.length === 1 && results.customers.length === 0) {
      go(`/contratos?q=${encodeURIComponent(results.sales[0].numero_contrato || term)}`);
    } else {
      go(`/clientes?q=${encodeURIComponent(term)}`);
    }
  };

  return (
    <div className="flex-1 max-w-xl relative" ref={boxRef}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
      <input
        ref={inputRef}
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => { ensureData(); setOpen(true); }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleSubmit();
          if (e.key === 'Escape') { setOpen(false); e.currentTarget.blur(); }
        }}
        placeholder="Busca rápida: nome, CPF, placa ou contrato..."
        className="w-full bg-background border border-border rounded-md pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
      />
      <span className="hidden md:block absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground font-mono pointer-events-none">Ctrl K</span>

      {open && q.trim().length >= 2 && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-popover border border-border rounded-md shadow-lg z-50 max-h-80 overflow-y-auto scrollbar-thin">
          {loading && <div className="p-4 text-xs text-muted-foreground text-center">Carregando...</div>}
          {!loading && !hasResults && (
            <div className="p-4 text-xs text-muted-foreground text-center">Nenhum resultado para "{q.trim()}".</div>
          )}

          {results.customers.length > 0 && (
            <div>
              <div className="px-3 py-1.5 text-[10px] uppercase tracking-widest text-muted-foreground font-mono bg-secondary/50">Clientes</div>
              {results.customers.map((c) => (
                <button
                  key={c.id}
                  onClick={() => go(`/clientes?q=${encodeURIComponent(c.cpf || c.nome_completo)}`)}
                  className="w-full text-left px-3 py-2 hover:bg-accent flex items-center gap-2.5"
                >
                  <User className="w-4 h-4 text-primary shrink-0" />
                  <div className="min-w-0">
                    <div className="text-sm text-foreground truncate">{c.nome_completo}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {formatCPF(c.cpf)}{c.telefone ? ` · ${formatPhone(c.telefone)}` : ''}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {results.sales.length > 0 && (
            <div>
              <div className="px-3 py-1.5 text-[10px] uppercase tracking-widest text-muted-foreground font-mono bg-secondary/50">Contratos</div>
              {results.sales.map((s) => {
                const v = data.vehicles.find((x) => x.id === s.veiculo_id);
                const c = data.customers.find((x) => x.id === s.cliente_id);
                return (
                  <button
                    key={s.id}
                    onClick={() => go(`/contratos?q=${encodeURIComponent(s.numero_contrato || '')}`)}
                    className="w-full text-left px-3 py-2 hover:bg-accent flex items-center gap-2.5"
                  >
                    <FileText className="w-4 h-4 text-primary shrink-0" />
                    <div className="min-w-0">
                      <div className="text-sm text-foreground truncate">
                        Contrato #{s.numero_contrato} — {c?.nome_completo || 'Cliente'}
                      </div>
                      <div className="text-[11px] text-muted-foreground truncate">
                        {v ? `${v.marca} ${v.modelo} ${formatPlate(v.placa)}` : s.descricao || ''}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
