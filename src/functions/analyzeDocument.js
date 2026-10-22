import { invokeFunction } from '@/api/base44Client';

export const analyzeDocument = (body) => invokeFunction('analyze-document', body);
