import { invokeFunction } from '@/api/base44Client';

export const customerPortal = (body) => invokeFunction('customer-portal', body);
