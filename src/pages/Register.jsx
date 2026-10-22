import React, { useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserPlus, User, IdCard, Phone, Mail, Loader2, CheckCircle2, ArrowLeft, KeyRound } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";
import PasswordInput from "@/components/PasswordInput";
import { validateCPF } from "@/lib/format";

export default function Register() {
  const [step, setStep] = useState("form"); // form | otp | success
  const [form, setForm] = useState({ nomeCompleto: "", cpf: "", telefone: "", email: "", senha: "", confirmarSenha: "" });
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    const cleanCpf = form.cpf.replace(/\D/g, "");
    const cleanPhone = form.telefone.replace(/\D/g, "");

    if (!form.nomeCompleto.trim()) { setError("Nome completo é obrigatório"); return; }
    if (!validateCPF(cleanCpf)) { setError("CPF inválido"); return; }
    if (!cleanPhone) { setError("Telefone é obrigatório"); return; }
    if (!form.email.trim()) { setError("E-mail é obrigatório"); return; }
    if (form.senha.length < 6) { setError("A senha deve ter no mínimo 6 caracteres"); return; }
    if (form.senha !== form.confirmarSenha) { setError("As senhas não conferem"); return; }

    setLoading(true);
    try {
      // Create the User account (sends a 6-digit code to the e-mail).
      // CPF, name and phone travel as signup metadata; the database links the
      // new user to an existing Customer with the same CPF (or creates one).
      await base44.auth.register({
        email: form.email.trim(),
        password: form.senha,
        full_name: form.nomeCompleto.trim(),
        cpf: cleanCpf,
        telefone: cleanPhone,
      });
      setStep("otp");
    } catch (err) {
      setError(err.message || "Falha no cadastro");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError("");
    if (!otp.trim()) { setError("Digite o código recebido no e-mail"); return; }
    setLoading(true);
    try {
      await base44.auth.verifyOtp({ email: form.email.trim(), otpCode: otp.trim() });
      setStep("success");
      setTimeout(() => { window.location.href = "/portal"; }, 1500);
    } catch (err) {
      setError(err.message || "Código inválido");
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setError("");
    try {
      await base44.auth.resendOtp(form.email.trim());
    } catch (err) {
      setError(err.message);
    }
  };

  if (step === "success") {
    return (
      <AuthLayout icon={CheckCircle2} title="Conta criada!" subtitle="Sua conta está pronta. Redirecionando para o portal...">
        <div className="text-center space-y-3">
          <Loader2 className="w-5 h-5 animate-spin mx-auto text-primary" />
        </div>
      </AuthLayout>
    );
  }

  if (step === "otp") {
    return (
      <AuthLayout icon={Mail} title="Verifique seu e-mail" subtitle={`Enviamos um código para ${form.email}`}>
        {error && <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>}
        <form onSubmit={handleVerifyOtp} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="otp">Código de verificação</Label>
            <Input
              id="otp"
              type="text"
              autoFocus
              placeholder="000000"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              className="h-12 text-center text-lg tracking-widest"
              maxLength={6}
            />
          </div>
          <Button type="submit" className="w-full h-12 font-medium" disabled={loading}>
            {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Verificando...</> : "Confirmar e Acessar"}
          </Button>
          <button type="button" onClick={handleResendOtp} className="w-full text-xs text-primary hover:underline">
            Reenviar código
          </button>
          <button type="button" onClick={() => { setStep("form"); setOtp(""); setError(""); }} className="w-full flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-3.5 h-3.5" /> Voltar
          </button>
        </form>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      icon={UserPlus}
      title="Criar sua conta"
      subtitle="Cadastre-se para acessar o portal do cliente"
      footer={
        <>
          Já tem conta?{" "}
          <Link to="/login" className="text-primary font-medium hover:underline">Acessar portal</Link>
        </>
      }
    >
      {error && <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="nome">Nome Completo</Label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input id="nome" type="text" autoFocus placeholder="Seu nome completo" value={form.nomeCompleto} onChange={(e) => set("nomeCompleto", e.target.value)} className="pl-10 h-12" required />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="cpf">CPF</Label>
          <div className="relative">
            <IdCard className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input id="cpf" type="text" placeholder="000.000.000-00" value={form.cpf} onChange={(e) => set("cpf", e.target.value)} className="pl-10 h-12" maxLength={14} required />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="telefone">Telefone / WhatsApp</Label>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input id="telefone" type="tel" placeholder="(00) 00000-0000" value={form.telefone} onChange={(e) => set("telefone", e.target.value)} className="pl-10 h-12" required />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">E-mail</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input id="email" type="email" autoComplete="email" placeholder="voce@email.com" value={form.email} onChange={(e) => set("email", e.target.value)} className="pl-10 h-12" required />
          </div>
        </div>
        <PasswordInput
          id="senha"
          label="Senha"
          value={form.senha}
          onChange={(v) => set("senha", v)}
          placeholder="Mínimo 6 caracteres"
          autoComplete="new-password"
        />
        <PasswordInput
          id="confirmar"
          label="Confirmar Senha"
          value={form.confirmarSenha}
          onChange={(v) => set("confirmarSenha", v)}
          placeholder="Repita a senha"
          autoComplete="new-password"
        />
        <Button type="submit" className="w-full h-12 font-medium" disabled={loading}>
          {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Criando conta...</> : <><KeyRound className="w-4 h-4 mr-2" />Criar conta</>}
        </Button>
      </form>
    </AuthLayout>
  );
}
