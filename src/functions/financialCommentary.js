import { invokeFunction } from '@/api/base44Client';

export const financialCommentary = (body) => invokeFunction('financial-commentary', body);
