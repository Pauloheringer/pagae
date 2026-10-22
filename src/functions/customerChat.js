import { invokeFunction } from '@/api/base44Client';

export const customerChat = (body) => invokeFunction('customer-chat', body);
