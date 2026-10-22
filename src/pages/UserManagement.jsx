import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { formatCPF, formatPhone } from '@/lib/format';
import { Shield, ShieldCheck, ShieldAlert, Search, Mail, UserCog, Loader2, KeyRound } from 'lucide-react';

const MAX_ADMINS = 4;

export default function UserManagement() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('admin');
  const [inviting, setInviting] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const [msg, setMsg] = useState('');
  const [adminCpfs, setAdminCpfs] = useState([]);
  const [newAdminCpf, setNewAdminCpf] = useState('');
  const [newAdminName, setNewAdminName] = useState('');

  const loadData = useCallback(async () => {
    try {
      const u = await base44.entities.User.list('-created_date', 500);
      setUsers(u);
      const ac = await base44.entities.AdminCpf.list('-created_date', 100);
      setAdminCpfs(ac);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const adminCount = users.filter(u => u.role === 'admin').length;

  const filtered = users.filter(u => {
    const q = search.toLowerCase();
    return !q ||
      (u.full_name || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q) ||
      (u.cpf || '').includes(q.replace(/\D/g, ''));
  });

  const handleToggleRole = async (u) => {
    if (u.id === currentUser?.id) return; // can't change own role
    setActionLoading(u.id);
    setMsg('');
    try {
      const newRole = u.role === 'admin' ? 'user' : 'admin';
      if (newRole === 'admin' && adminCount >= MAX_ADMINS) {
        setMsg(`Limite de ${MAX_ADMINS} administradores atingido.`);
        return;
      }
      await base44.entities.User.update(u.id, { role: newRole });
      await base44.entities.AuditLog.create({
        acao: 'alterar_role',
        entidade: 'User',
        entidade_id: u.id,
        detalhes: `${u.full_name || u.email}: ${u.role} → ${newRole}`,
        usuario_nome: currentUser?.full_name || 'Admin'
      });
      loadData();
    } catch (e) { setMsg('Erro: ' + e.message); }
    finally { setActionLoading(null); }
  };

  const handleInvite = async () => {
    setMsg('');
    if (!inviteEmail) return;
    if (inviteRole === 'admin' && adminCount >= MAX_ADMINS) {
      setMsg(`Limite de ${MAX_ADMINS} administradores atingido.`);
      return;
    }
    setInviting(true);
    try {
      await base44.users.inviteUser(inviteEmail, inviteRole);
      await base44.entities.AuditLog.create({
        acao: 'convidar_usuario',
        entidade: 'User',
        detalhes: `Convite enviado para ${inviteEmail} (${inviteRole})`,
        usuario_nome: currentUser?.full_name || 'Admin'
      });
      setMsg(`Convite enviado para ${inviteEmail}`);
      setInviteEmail('');
      loadData();
    } catch (e) { setMsg('Erro: ' + e.message); }
    finally { setInviting(false); }
  };

  const handleAddAdminCpf = async () => {
    setMsg('');
    const cleanCpf = newAdminCpf.replace(/\D/g, '');
    if (!cleanCpf) return;
    try {
      await base44.entities.AdminCpf.create({ cpf: cleanCpf, nome: newAdminName || 'Administrador' });
      setMsg(`CPF ${cleanCpf} autorizado como admin`);
      setNewAdminCpf(''); setNewAdminName('');
      loadData();
    } catch (e) { setMsg('Erro: ' + e.message); }
  };

  const handleRemoveAdminCpf = async (id) => {
    try {
      await base44.entities.AdminCpf.delete(id);
      loadData();
    } catch (e) { setMsg('Erro: ' + e.message); }
  };

  const handleSendResetLink = async (u) => {
    setActionLoading(u.id + '-reset');
    setMsg('');
    try {
      await base44.auth.resetPasswordRequest(u.email);
      setMsg(`Link de redefinição enviado para ${u.email}`);
    } catch (e) { setMsg('Erro: ' + e.message); }
    finally { setActionLoading(null); }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-full p-8"><div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" /></div>;
  }

  return (
    <div className="p-4 lg:p-6 space-y-4 max-w-[1000px] mx-auto">
      <div>
        <h1 className="text-xl lg:text-2xl font-extrabold tracking-tight flex items-center gap-2">
          <UserCog className="w-6 h-6 text-primary" /> Usuários & Acessos
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Gerencie quem tem acesso ao painel administrativo e ao portal de clientes.
        </p>
      </div>

      {/* Admin counter */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-card border border-border rounded-md p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-widest font-mono mb-1">
            <ShieldCheck className="w-3.5 h-3.5" /> Administradores
          </div>
          <div className="text-2xl font-extrabold text-foreground">
            {adminCount}<span className="text-base text-muted-foreground font-normal"> / {MAX_ADMINS}</span>
          </div>
        </div>
        <div className="bg-card border border-border rounded-md p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-widest font-mono mb-1">
            <Shield className="w-3.5 h-3.5" /> Clientes
          </div>
          <div className="text-2xl font-extrabold text-foreground">
            {users.filter(u => u.role === 'user').length}
          </div>
        </div>
      </div>

      {/* Invite */}
      <div className="bg-card border border-border rounded-md p-4">
        <div className="flex items-center gap-2 mb-3">
          <Mail className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-bold text-foreground">Convidar Usuário</h2>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="email"
            value={inviteEmail}
            onChange={e => setInviteEmail(e.target.value)}
            placeholder="email@exemplo.com"
            className="flex-1 bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <select
            value={inviteRole}
            onChange={e => setInviteRole(e.target.value)}
            className="bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="admin">Administrador</option>
            <option value="user">Cliente</option>
          </select>
          <button
            onClick={handleInvite}
            disabled={inviting || !inviteEmail}
            className="bg-primary text-primary-foreground font-semibold text-sm px-4 py-2 rounded-md hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            {inviting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
            Enviar Convite
          </button>
        </div>
        {msg && <p className="text-xs text-yellow-400 mt-2">{msg}</p>}
      </div>

      {/* Admin CPF management */}
      <div className="bg-card border border-border rounded-md p-4">
        <div className="flex items-center gap-2 mb-2">
          <ShieldCheck className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-bold text-foreground">CPFs Autorizados para Admin</h2>
        </div>
        <p className="text-xs text-muted-foreground mb-3">Somente usuários com estes CPFs podem acessar o painel administrativo. Se a lista estiver vazia, todos os admins convidados têm acesso.</p>
        <div className="flex flex-col sm:flex-row gap-2 mb-3">
          <input value={newAdminName} onChange={e => setNewAdminName(e.target.value)} placeholder="Nome (opcional)" className="flex-1 bg-background border border-border rounded-md px-3 py-2 text-sm" />
          <input value={newAdminCpf} onChange={e => setNewAdminCpf(e.target.value)} placeholder="000.000.000-00" className="flex-1 bg-background border border-border rounded-md px-3 py-2 text-sm" maxLength={14} />
          <button onClick={handleAddAdminCpf} disabled={!newAdminCpf.replace(/\D/g, '')} className="bg-primary text-primary-foreground font-semibold text-sm px-4 py-2 rounded-md hover:bg-primary/90 disabled:opacity-50">Adicionar</button>
        </div>
        <div className="space-y-1.5">
          {adminCpfs.map(a => (
            <div key={a.id} className="flex items-center justify-between bg-background border border-border rounded-md px-3 py-2">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-3.5 h-3.5 text-primary" />
                <span className="text-sm text-foreground">{a.nome || 'Admin'}</span>
                <span className="text-xs text-muted-foreground font-mono">{formatCPF(a.cpf)}</span>
              </div>
              <button onClick={() => handleRemoveAdminCpf(a.id)} className="text-destructive hover:text-destructive/80 text-xs font-semibold">Remover</button>
            </div>
          ))}
          {adminCpfs.length === 0 && <p className="text-xs text-muted-foreground">Nenhum CPF restrito — todos os admins convidados têm acesso.</p>}
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por nome, email ou CPF..."
          className="w-full bg-background border border-border rounded-md pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      {/* User list */}
      <div className="space-y-2">
        {filtered.map(u => {
          const isAdmin = u.role === 'admin';
          const isSelf = u.id === currentUser?.id;
          return (
            <div key={u.id} className="bg-card border border-border rounded-md p-3 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${
                isAdmin ? 'bg-primary/10 text-primary' : 'bg-secondary text-secondary-foreground'
              }`}>
                {u.full_name?.charAt(0)?.toUpperCase() || '?'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-foreground truncate">
                    {u.full_name || 'Sem nome'}
                  </span>
                  {isAdmin ? (
                    <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-primary/10 text-primary border border-primary/30 rounded px-1.5 py-0.5">
                      <ShieldCheck className="w-3 h-3" /> Admin
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-secondary text-muted-foreground border border-border rounded px-1.5 py-0.5">
                      Cliente
                    </span>
                  )}
                  {isSelf && <span className="text-[10px] text-muted-foreground">(você)</span>}
                </div>
                <div className="text-xs text-muted-foreground truncate">{u.email}</div>
                <div className="flex gap-3 text-[11px] text-muted-foreground mt-0.5">
                  {u.cpf && <span>CPF: {formatCPF(u.cpf)}</span>}
                  {u.telefone && <span>Tel: {formatPhone(u.telefone)}</span>}
                </div>
              </div>
              {!isSelf && (
                <div className="flex gap-1.5 shrink-0">
                  {!isAdmin && (
                    <button
                      onClick={() => handleSendResetLink(u)}
                      disabled={actionLoading === u.id + '-reset'}
                      className="flex items-center gap-1 text-xs font-semibold px-2.5 py-2 rounded-md border bg-secondary text-muted-foreground border-border hover:bg-accent disabled:opacity-50"
                      title="Enviar link de redefinição de senha"
                    >
                      {actionLoading === u.id + '-reset' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <KeyRound className="w-3.5 h-3.5" />}
                      <span className="hidden sm:inline">Redefinir senha</span>
                    </button>
                  )}
                  <button
                    onClick={() => handleToggleRole(u)}
                    disabled={actionLoading === u.id}
                    className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-md border disabled:opacity-50 ${
                      isAdmin
                        ? 'bg-destructive/10 text-destructive border-destructive/30 hover:bg-destructive/20'
                        : 'bg-primary/10 text-primary border-primary/30 hover:bg-primary/20'
                    }`}
                  >
                    {isAdmin ? <ShieldAlert className="w-3.5 h-3.5" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                    {isAdmin ? 'Remover Admin' : 'Tornar Admin'}
                  </button>
                </div>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="text-center py-8 text-muted-foreground text-sm">
            Nenhum usuário encontrado.
          </div>
        )}
      </div>
    </div>
  );
}
