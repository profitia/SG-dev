import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { OPERATION_CONTRACT, isOperationDenied, type OperationExecutor } from '@profitia/platform-contracts/operation-context';
import { getBenchmarkPreview } from './service';
import { BenchmarkAppError } from './errors';
import { withCognitionAuth, parseSearchParams, cognitionError, cognitionOk, privateApiResponse } from '@/lib/api/middleware';
import { getSg2SelectionRuntime, type Sg2SelectionRuntime } from '@/lib/platform/private-runtime';
import { MarketPreviewSelection, marketPreviewResourceId } from '@/lib/platform/market-preview';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
// Preserve the existing default query parser and business error semantics.
const LegacyQuerySchema = z.object({ seriesName: z.string().trim().min(1), range: z.enum(['1M', '3M', '6M', '1Y', '3Y', '5Y', 'ALL']).default('1Y') });
export function createLegacyBenchmarkPreviewHandler(preview = getBenchmarkPreview) {
    return withCognitionAuth(async (_auth, request: NextRequest) => {
        const parsed = parseSearchParams(request, LegacyQuerySchema);
        if (!parsed.ok)
            return cognitionError('VALIDATION_ERROR', parsed.message, 400);
        try {
            return cognitionOk(await preview(parsed.data.seriesName, parsed.data.range ?? '1Y'));
        }
        catch (error) {
            if (error instanceof BenchmarkAppError)
                return cognitionError(error.code, error.message, error.status);
            return cognitionError('INTERNAL_ERROR', 'Benchmark preview failed.', 500);
        }
    });
}
export function createOperationBenchmarkPreviewHandler(executor: OperationExecutor<Prisma.TransactionClient>, defaultOrganisationId: string, preview: (selection: z.infer<typeof MarketPreviewSelection>) => Promise<unknown>) {
    if (!uuid.test(defaultOrganisationId) || typeof preview !== 'function')
        throw new TypeError('Explicit market preview host required');
    return async (request: NextRequest): Promise<NextResponse> => {
        const respond = (code: string, message: string, status: number) => privateApiResponse(cognitionError(code, message, status));
        if (request.method !== 'GET') {
            const response = respond('METHOD_NOT_ALLOWED', 'Use GET.', 405);
            response.headers.set('Allow', 'GET');
            return response;
        }
        const parameters = request.nextUrl.searchParams;
        if ([...parameters.keys()].some(key => !['seriesName', 'range', 'organisationId'].includes(key))
            || [...new Set(parameters.keys())].some(key => parameters.getAll(key).length !== 1))
            return respond('VALIDATION_ERROR', 'Invalid preview selection.', 400);
        const selected = MarketPreviewSelection.safeParse({ seriesName: parameters.get('seriesName'), range: parameters.get('range') ?? '1Y' });
        const organisationId = parameters.get('organisationId') ?? defaultOrganisationId;
        if (!selected.success || !uuid.test(organisationId))
            return respond('VALIDATION_ERROR', 'Invalid preview selection.', 400);
        try {
            const result = await executor.execute({ contractId: OPERATION_CONTRACT.id, contractVersion: OPERATION_CONTRACT.version,
                operation: 'knowledge.read', organisationId, resourceId: marketPreviewResourceId(selected.data.seriesName), payload: selected.data, request }, async () => cognitionOk(await preview(selected.data)));
            return privateApiResponse(result.value);
        }
        catch (error) {
            if (error instanceof BenchmarkAppError)
                return respond(error.code, error.message, error.status);
            const reason = isOperationDenied(error) ? error.reasonCode : 'POLICY_UNAVAILABLE';
            return respond('OPERATION_DENIED', 'Operation unavailable.', reason === 'UNVERIFIED_IDENTITY' ? 401 : ['POLICY_UNAVAILABLE', 'AUDIT_UNAVAILABLE'].includes(reason) ? 503 : reason === 'CONTEXT_INVALID' ? 400 : 403);
        }
    };
}
export function createRuntimeBenchmarkPreviewHandler(resolveRuntime: () => Sg2SelectionRuntime = getSg2SelectionRuntime, legacy = createLegacyBenchmarkPreviewHandler()) {
    return async (request: NextRequest): Promise<NextResponse> => {
        try {
            const runtime = resolveRuntime();
            if (runtime.provider === 'legacy_demo')
                return await legacy(request);
            if (runtime.provider !== 'clerk' || !runtime.marketRead)
                return privateApiResponse(cognitionError('OPERATION_DENIED', 'Operation unavailable.', 503));
            return await createOperationBenchmarkPreviewHandler(runtime.marketRead.executor, runtime.defaultOrganisationId, runtime.marketRead.preview)(request);
        }
        catch {
            return privateApiResponse(cognitionError('OPERATION_DENIED', 'Operation unavailable.', 503));
        }
    };
}
