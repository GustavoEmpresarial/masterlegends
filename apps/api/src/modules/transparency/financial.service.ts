import type { PrismaClient } from '@prisma/client';
import { AppError, ErrorCode } from '../../common/lib/errors.js';

export interface FinancialRecordDTO {
  id: string;
  type: 'receita' | 'despesa';
  label: string;
  description: string | null;
  amount: number;
  currency: string;
  recurring: boolean;
  recurringPeriod: string | null;
  source: string | null;
  referenceUrl: string | null;
  imageUrl: string | null;
  date: string;
  visible: boolean;
  createdAt: string;
  updatedAt: string;
}

function mapRecord(row: {
  id: string; type: string; label: string; description: string | null;
  amount: { toNumber(): number }; currency: string; recurring: boolean;
  recurringPeriod: string | null; source: string | null; referenceUrl: string | null;
  imageUrl: string | null; date: Date; visible: boolean; createdAt: Date; updatedAt: Date;
}): FinancialRecordDTO {
  return {
    id: row.id,
    type: row.type as 'receita' | 'despesa',
    label: row.label,
    description: row.description,
    amount: row.amount.toNumber(),
    currency: row.currency,
    recurring: row.recurring,
    recurringPeriod: row.recurringPeriod,
    source: row.source,
    referenceUrl: row.referenceUrl,
    imageUrl: row.imageUrl,
    date: row.date.toISOString(),
    visible: row.visible,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export class FinancialService {
  constructor(private readonly prisma: PrismaClient) {}

  async listAll(): Promise<FinancialRecordDTO[]> {
    const rows = await this.prisma.financialRecord.findMany({ orderBy: { date: 'desc' } });
    return rows.map(mapRecord);
  }

  async listVisible(): Promise<FinancialRecordDTO[]> {
    const rows = await this.prisma.financialRecord.findMany({
      where: { visible: true }, orderBy: { date: 'desc' },
    });
    return rows.map(mapRecord);
  }

  async create(data: {
    type: string; label: string; description?: string | null; amount: number;
    currency?: string; recurring?: boolean; recurringPeriod?: string | null;
    source?: string | null; referenceUrl?: string | null; imageUrl?: string | null;
    date?: string; visible?: boolean;
  }): Promise<FinancialRecordDTO> {
    const row = await this.prisma.financialRecord.create({
      data: {
        type: data.type,
        label: data.label,
        description: data.description ?? null,
        amount: data.amount,
        currency: data.currency ?? 'usdc',
        recurring: data.recurring ?? false,
        recurringPeriod: data.recurringPeriod ?? null,
        source: data.source ?? null,
        referenceUrl: data.referenceUrl ?? null,
        imageUrl: data.imageUrl ?? null,
        date: data.date ? new Date(data.date) : new Date(),
        visible: data.visible ?? true,
      },
    });
    return mapRecord(row);
  }

  async update(id: string, data: Partial<{
    type: string; label: string; description: string | null; amount: number;
    currency: string; recurring: boolean; recurringPeriod: string | null;
    source: string | null; referenceUrl: string | null; imageUrl: string | null;
    date: string; visible: boolean;
  }>): Promise<FinancialRecordDTO> {
    const existing = await this.prisma.financialRecord.findUnique({ where: { id } });
    if (!existing) throw new AppError(ErrorCode.ANNOUNCEMENT_NOT_FOUND, 404);
    const row = await this.prisma.financialRecord.update({
      where: { id },
      data: {
        ...(data.type !== undefined ? { type: data.type } : {}),
        ...(data.label !== undefined ? { label: data.label } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.amount !== undefined ? { amount: data.amount } : {}),
        ...(data.currency !== undefined ? { currency: data.currency } : {}),
        ...(data.recurring !== undefined ? { recurring: data.recurring } : {}),
        ...(data.recurringPeriod !== undefined ? { recurringPeriod: data.recurringPeriod } : {}),
        ...(data.source !== undefined ? { source: data.source } : {}),
        ...(data.referenceUrl !== undefined ? { referenceUrl: data.referenceUrl } : {}),
        ...(data.imageUrl !== undefined ? { imageUrl: data.imageUrl } : {}),
        ...(data.date !== undefined ? { date: new Date(data.date) } : {}),
        ...(data.visible !== undefined ? { visible: data.visible } : {}),
      },
    });
    return mapRecord(row);
  }

  async remove(id: string) {
    await this.prisma.financialRecord.delete({ where: { id } });
    return { ok: true };
  }

  async summary() {
    const records = await this.prisma.financialRecord.findMany({ where: { visible: true } });
    let totalReceita = 0;
    let totalDespesa = 0;
    let recorrente = 0;
    for (const r of records) {
      const amt = r.amount.toNumber();
      if (r.type === 'receita') totalReceita += amt;
      else totalDespesa += amt;
      if (r.recurring) recorrente++;
    }
    return {
      totalReceita,
      totalDespesa,
      lucroLiquido: totalReceita - totalDespesa,
      recorrente,
      total: records.length,
    };
  }
}
