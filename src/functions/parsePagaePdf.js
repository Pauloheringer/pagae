import { invokeFunction } from '@/api/base44Client';

export const parsePagaePdf = (body) => invokeFunction('parse-pagae-pdf', body);
