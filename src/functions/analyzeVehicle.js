import { invokeFunction } from '@/api/base44Client';

export const analyzeVehicle = (body) => invokeFunction('analyze-vehicle', body);
