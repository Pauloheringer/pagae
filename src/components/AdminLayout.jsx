import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import {
  LayoutDashboard, ClipboardCheck, ScanLine, FileText, KeyRound,
  Users, BarChart3, Bot, LogOut, Menu, X, UserCog, AlertTriangle, FileUp
} from 'lucide-react';
import KeepAliveOutlet from '@/components/KeepAliveOutlet';
import BottomTabBar from '@/components/BottomTabBar';
import QuickSearch from '@/components/QuickSearch';

const KEEP_PATHS = ['/contratos', '/reconciliacao', '/clientes'];

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/reconciliacao', label: 'Conferência do Dia', icon: ClipboardCheck },
  { path: '/comprovantes', label: 'Caixa de Entrada IA', icon: ScanLine },
  { path: '/contratos', label: 'Contratos & Veículos', icon: FileText },
  { path: '/importar', label: 'Importar PDFs', icon: FileUp },
  { path: '/pix', label: 'Hub de Chaves Pix', icon: KeyRound },
  { path: '/clientes', label: 'Diretório de Clientes', icon: Users },
  { path: '/usuarios', label: 'Usuários & Acessos', icon: UserCog },
  { path: '/devedores', label: 'Devedores & Cobrança', icon: AlertTriangle },
  { path: '/relatorios', label: 'Relatórios & Export', icon: BarChart3 },
  { path: '/assistente', label: 'Assistente de IA', icon: Bot },
];

export default function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [activePixKey, setActivePixKey] = useState(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    base44.entities.PixKey.filter({ ativo: true }).then(keys => {
      if (keys.length > 0) setActivePixKey(keys[0]);
    }).catch(() => {});
  }, [location.pathname]);

  // Role guard: only admins can access the admin panel
  useEffect(() => {
    if (!user) return;
    if (user.role !== 'admin') {
      navigate('/portal', { replace: true });
      return;
    }
    // Check CPF against admin CPF whitelist
    const checkCpf = async () => {
      const cleanCpf = (user.cpf || '').replace(/\D/g, '');
      if (!cleanCpf) return;
      try {
        const adminCpfs = await base44.entities.AdminCpf.list();
        if (adminCpfs.length === 0) return;
        const found = adminCpfs.find(a => a.cpf.replace(/\D/g, '') === cleanCpf);
        if (!found) navigate('/portal', { replace: true });
      } catch (e) {}
    };
    checkCpf();
  }, [user, navigate]);

  const handleLogout = async () => {
    await logout();
  };

  return (
    <div className="h-dvh bg-background flex overflow-hidden">
      {/* Sidebar */}
      <aside className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-card border-r border-border flex flex-col transition-transform duration-200 ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="h-16 flex items-center gap-2.5 px-5 border-b border-border">
          <div className="w-9 h-9 rounded-md bg-primary flex items-center justify-center font-extrabold text-primary-foreground text-lg">P</div>
          <div>
            <div className="font-extrabold text-sm tracking-tight text-foreground">Paulinho Veículos</div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">Pagaê</div>
          </div>
        </div>
        <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto scrollbar-thin">
          {navItems.map(item => {
            const Icon = item.icon;
            const active = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                  active
                    ? 'bg-primary/10 text-primary border border-primary/30'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent border border-transparent'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-border">
          <div className="flex items-center gap-2.5 px-2 py-2">
            <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-xs font-bold text-secondary-foreground">
              {user?.full_name?.charAt(0)?.toUpperCase() || 'A'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-foreground truncate">{user?.full_name || 'Admin'}</div>
              <div className="text-[10px] text-muted-foreground capitalize">{user?.role || 'admin'}</div>
            </div>
            <button onClick={handleLogout} className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && <div className="fixed inset-0 bg-black/60 z-40 lg:hidden" onClick={() => setMobileOpen(false)} />}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="shrink-0 border-b border-border bg-card/50 backdrop-blur-sm z-30" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
          <div className="h-16 flex items-center gap-3 px-4 lg:px-6">
            <button className="lg:hidden p-2 -ml-1 text-muted-foreground" onClick={() => setMobileOpen(!mobileOpen)}>
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <QuickSearch />
            {activePixKey && (
              <Link to="/pix" className="hidden md:flex items-center gap-2 bg-primary/10 border border-primary/30 rounded-md px-3 py-1.5 text-xs hover:bg-primary/20 transition-colors">
                <KeyRound className="w-3.5 h-3.5 text-primary" />
                <span className="text-muted-foreground">Chave ativa:</span>
                <span className="font-semibold text-primary">{activePixKey.tipo.toUpperCase()} — {activePixKey.titular}</span>
              </Link>
            )}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-hidden relative">
          <KeepAliveOutlet keepPaths={KEEP_PATHS} />
        </main>

        <BottomTabBar />
      </div>
    </div>
  );
}
