import React, { useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogIn, Mail, IdCard, Phone, Loader2 } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";
import PasswordInput from "@/components/PasswordInput";
import { customerPortal } from "@/functions/customerPortal";
import { validateCPF } from "@/lib/format";
import { safeReturnTo } from "@/lib/authReturnTo";

export default function Login() {
  const [mode, setMode] = useState("cliente"); // cliente | admin
  const [cpf, setCpf] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const returnTo = safeReturnTo();

  const handleCustomerLogin = async (e) => {
    e.preventDefault();
    setError("");
    const cleanCpf = cpf.replace(/\D/g, "");
    const cleanPhone = telefone.replace(/\D/g, "");

    if (!validateCPF(cleanCpf)) { setError("CPF inválido"); return; }
    if (!cleanPhone) { setError("Telefone é obrigatório"); return; }

    setLoading(true);
    try {
      const res = await customerPortal({ action: "login", cpf: cleanCpf, phone: cleanPhone });
      // The portal session is a signed token (not the raw customer id), so it
      // cannot be forged by editing localStorage.
      localStorage.setItem("pagae_customer_session", res.data.session);
      window.location.href = "/portal";
    } catch (err) {
      const msg = err.response?.data?.error || err.message || "Erro ao entrar. Verifique seus dados.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleAdminLogin = async (e) => {
    e.preventDefault();
    setError("");
    if (!email || !senha) { setError("E-mail e senha são obrigatórios"); return; }
    setLoading(true);
    try {
      await base44.auth.loginViaEmailPassword(email, senha);
      if (returnTo && returnTo !== "/") {
        window.location.href = returnTo;
      } else {
        window.location.href = "/";
      }
    } catch (err) {
      setError(err.message || "E-mail ou senha inválidos");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      icon={LogIn}
      title={mode === "cliente" ? "Acessar Portal" : "Acesso do Administrador"}
      subtitle={mode === "cliente" ? "Entre com seu CPF e telefone" : "Painel administrativo"}
    >
      {/* Mode toggle */}
      <div className="flex gap-1 mb-6 bg-secondary rounded-lg p-1">
        <button
          type="button"
          onClick={() => { setMode("cliente"); setError(""); setSenha(""); }}
          className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${mode === "cliente" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          Cliente
        </button>
        <button
          type="button"
          onClick={() => { setMode("admin"); setError(""); setSenha(""); }}
          className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${mode === "admin" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          Administrador
        </button>
      </div>

      {error && <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>}

      {mode === "cliente" ? (
        <form onSubmit={handleCustomerLogin} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cpf">CPF</Label>
            <div className="relative">
              <IdCard className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
              <Input id="cpf" type="text" autoFocus placeholder="000.000.000-00" value={cpf} onChange={(e) => setCpf(e.target.value)} className="pl-10 h-12" maxLength={14} required />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="telefone">Telefone / WhatsApp</Label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
              <Input id="telefone" type="tel" placeholder="(00) 00000-0000" value={telefone} onChange={(e) => setTelefone(e.target.value)} className="pl-10 h-12" required />
            </div>
          </div>
          <Button type="submit" className="w-full h-12 font-medium" disabled={loading}>
            {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Entrando...</> : "Entrar"}
          </Button>
        </form>
      ) : (
        <form onSubmit={handleAdminLogin} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
              <Input id="email" type="email" autoFocus autoComplete="email" placeholder="voce@email.com" value={email} onChange={(e) => setEmail(e.target.value)} className="pl-10 h-12" required />
            </div>
          </div>
          <PasswordInput
            id="adminSenha"
            label="Senha"
            value={senha}
            onChange={setSenha}
            placeholder="••••••••"
            autoComplete="current-password"
          />
          <Button type="submit" className="w-full h-12 font-medium" disabled={loading}>
            {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Entrando...</> : "Entrar"}
          </Button>
          <Link to="/forgot-password" className="block text-xs text-primary hover:underline text-center">
            Esqueci minha senha
          </Link>
        </form>
      )}
    </AuthLayout>
  );
}
