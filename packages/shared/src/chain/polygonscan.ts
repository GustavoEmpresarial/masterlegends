import type { PolygonscanLogDTO } from '../chain/vault.js';

export class PolygonscanClient {
  constructor(
    private readonly apiKey: string,
    private readonly chainId: number,
  ) {}

  /** Etherscan unified API v2 (Polygon = chainid 137, Amoy = 80002). */
  private baseUrl(): string {
    return 'https://api.etherscan.io/v2/api';
  }

  private async get<T>(params: Record<string, string>): Promise<T> {
    const url = new URL(this.baseUrl());
    url.searchParams.set('chainid', String(this.chainId));
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
    url.searchParams.set('apikey', this.apiKey);

    const res = await fetch(url.toString(), {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      throw new Error(`Polygonscan HTTP ${res.status}`);
    }

    const contentType = res.headers.get('content-type') ?? '';
    if (!contentType.includes('application/json')) {
      const body = await res.text();
      throw new Error(`Polygonscan non-JSON response: ${body.slice(0, 120)}`);
    }

    const json = (await res.json()) as {
      status?: string;
      message?: string;
      result?: T;
    };

    if (json.status === '0' && json.message !== 'No records found') {
      const detail = typeof json.result === 'string' ? json.result : json.message;
      throw new Error(detail ?? 'Polygonscan request failed');
    }

    return json.result as T;
  }

  async getLatestBlockNumber(): Promise<number> {
    const hex = await this.get<string>({
      module: 'proxy',
      action: 'eth_blockNumber',
    });
    return Number.parseInt(hex, 16);
  }

  async getVaultLogs(params: {
    vaultAddress: string;
    topic0: string;
    fromBlock: number;
    toBlock: number;
    topic1?: string;
    topic2?: string;
  }): Promise<PolygonscanLogDTO[]> {
    const query: Record<string, string> = {
      module: 'logs',
      action: 'getLogs',
      address: params.vaultAddress,
      topic0: params.topic0,
      fromBlock: String(params.fromBlock),
      toBlock: String(params.toBlock),
    };
    if (params.topic1) query.topic1 = params.topic1;
    if (params.topic2) query.topic2 = params.topic2;

    const result = await this.get<PolygonscanLogDTO[] | string>(query);

    if (!result || result === 'No records found') return [];
    if (typeof result === 'string') return [];
    return result;
  }

  async getTransactionReceipt(txHash: string): Promise<{
    status?: string;
    logs?: Array<{ address: string; topics: string[]; data: string }>;
  } | null> {
    const result = await this.get<{
      status?: string;
      logs?: Array<{ address: string; topics: string[]; data: string }>;
    } | null>({
      module: 'proxy',
      action: 'eth_getTransactionReceipt',
      txhash: txHash,
    });
    return result ?? null;
  }
}
