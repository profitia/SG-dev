import { z } from 'zod';
import { OperationDenied, type OperationContext } from '@profitia/platform-contracts/operation-context';
export const MARKET_PREVIEW_PROJECTION = 'sg2-stored-market-preview-v1';
export const MAX_STORED_MARKET_POINTS = 100000;
export const MAX_MARKET_PREVIEW_BYTES = 4 * 1024 * 1024;
export const MarketPreviewSelection = z.object({
    seriesName: z.string().trim().min(1).max(256).regex(/^[a-z0-9_./-]+$/i),
    range: z.enum(['1M', '3M', '6M', '1Y', '3Y', '5Y', 'ALL']).default('1Y'),
}).strict();
const provider = z.object({ providerCode: z.literal('MACROBOND'), displayName: z.string().max(256) }).strict();
const nullableText = z.string().max(4096).nullable();
const point = z.object({ date: z.string().max(64).refine(value => Number.isFinite(Date.parse(value))), value: z.number().finite().nullable() }).strict();
const preview = z.object({
    providerSeries: z.object({ provider, providerSeriesId: z.string().max(256), providerSeriesKey: z.string().max(256).nullable().optional() }).strict(),
    displayName: z.string().max(4096), latestValue: z.number().finite().nullable(),
    frequency: nullableText, currency: nullableText, unit: nullableText, source: nullableText,
    range: z.enum(['1M', '3M', '6M', '1Y', '3Y', '5Y', 'ALL']),
    changeMetrics: z.object({ '1M': z.number().finite().optional(), '3M': z.number().finite().optional(), '1Y': z.number().finite().optional() }).strict(),
    historical: z.array(point).max(MAX_STORED_MARKET_POINTS),
}).strict();
export const marketPreviewResourceId = (seriesName: string) => `market-history:${seriesName}`;
export function readMarketPreviewSelection(input: unknown) {
    const result = MarketPreviewSelection.safeParse(input);
    if (!result.success)
        throw new OperationDenied('RESOURCE_SCOPE_MISMATCH');
    return result.data;
}
export async function projectMarketPreviewResponse(value: unknown, context: Pick<OperationContext, 'payload' | 'resource'>) {
    if (!(value instanceof Response) || !value.ok)
        throw new OperationDenied('RESOURCE_SCOPE_MISMATCH');
    const selection = readMarketPreviewSelection(context.payload);
    const text = await value.clone().text();
    if (Buffer.byteLength(text) > MAX_MARKET_PREVIEW_BYTES)
        throw new OperationDenied('RESOURCE_SCOPE_MISMATCH');
    let body: unknown;
    try {
        body = JSON.parse(text);
    }
    catch {
        throw new OperationDenied('RESOURCE_SCOPE_MISMATCH');
    }
    const parsed = preview.safeParse(body);
    if (!parsed.success || parsed.data.providerSeries.providerSeriesId !== selection.seriesName
        || parsed.data.range !== selection.range || context.resource.id !== marketPreviewResourceId(selection.seriesName))
        throw new OperationDenied('RESOURCE_SCOPE_MISMATCH');
    return value;
}
