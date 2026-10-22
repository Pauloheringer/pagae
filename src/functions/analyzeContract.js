import { invokeFunction } from '@/api/base44Client';

export const analyzeContract = (body) => invokeFunction('analyze-contract', body);
