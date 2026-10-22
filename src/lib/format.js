export function formatCurrency(value) {
  if (value == null || isNaN(value)) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
}

export function formatDate(dateStr) {
  if (!dateStr) return '-';
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('pt-BR');
  } catch {
    return dateStr;
  }
}

export function formatDateTime(dateStr) {
  if (!dateStr) return '-';
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('pt-BR') + ' ' + date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return dateStr;
  }
}

export function validateCPF(cpf) {
  if (!cpf) return false;
  cpf = cpf.replace(/\D/g, '');
  if (cpf.length !== 11) return false;
  if (/^(\d)\1+$/.test(cpf)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(cpf[i]) * (10 - i);
  let rev = 11 - (sum % 11);
  if (rev === 10 || rev === 11) rev = 0;
  if (rev !== parseInt(cpf[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(cpf[i]) * (11 - i);
  rev = 11 - (sum % 11);
  if (rev === 10 || rev === 11) rev = 0;
  if (rev !== parseInt(cpf[10])) return false;
  return true;
}

export function formatCPF(cpf) {
  if (!cpf) return '';
  const digits = cpf.replace(/\D/g, '');
  if (digits.length === 11) {
    return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }
  return cpf;
}

export function formatPhone(phone) {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11) {
    return digits.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  }
  if (digits.length === 10) {
    return digits.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
  }
  return phone;
}

export function formatPlate(plate) {
  if (!plate) return '';
  return plate.toUpperCase();
}

export function daysUntil(dateStr) {
  if (!dateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  const diff = Math.ceil((target - today) / (1000 * 60 * 60 * 24));
  return diff;
}

export function isOverdue(dateStr, status) {
  if (status === 'paga') return false;
  const days = daysUntil(dateStr);
  return days < 0;
}

export const installmentStatusMap = {
  aberta: { label: 'Em Aberto', className: 'bg-blue-500/10 text-blue-400 border-blue-500/30' },
  paga: { label: 'Paga', className: 'bg-green-500/10 text-green-400 border-green-500/30' },
  atrasada: { label: 'Atrasada', className: 'bg-red-500/10 text-red-400 border-red-500/30' },
  em_analise: { label: 'Aguardando Confirmação', className: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30' },
  parcial: { label: 'Parcial', className: 'bg-orange-500/10 text-orange-400 border-orange-500/30' }
};

export const reportStatusMap = {
  informado: { label: 'Informado', className: 'bg-blue-500/10 text-blue-400 border-blue-500/30' },
  em_analise: { label: 'Em Análise', className: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30' },
  confirmado: { label: 'Confirmado', className: 'bg-green-500/10 text-green-400 border-green-500/30' },
  recusado: { label: 'Recusado', className: 'bg-red-500/10 text-red-400 border-red-500/30' },
  divergencia: { label: 'Divergência', className: 'bg-orange-500/10 text-orange-400 border-orange-500/30' }
};
