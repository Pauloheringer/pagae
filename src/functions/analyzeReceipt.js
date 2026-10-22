import { invokeFunction } from '@/api/base44Client';

export const analyzeReceipt = (body) => invokeFunction('analyze-receipt', body);
