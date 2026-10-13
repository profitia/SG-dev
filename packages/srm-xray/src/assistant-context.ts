/**
 * SpendGuru application-context contract v1.
 * The dashboard is the only source of context; neither presentation window
 * scrapes the DOM or infers the selected supplier from the search input.
 * Window placement, conversation state and the future model transport are separate.
 * This presentation has no model endpoint. Browser context is never an authorization source.
 * A production adapter must resolve tenant/user on the server, reauthorize all
 * source IDs, and fetch authoritative financial facts before invoking a model.
 */
export type ContextMetric = {
  code: string;
  name: string;
  year: number | null;
  value: string | null;
  unit: string;
  availability: 'available' | 'missing';
  reason: string | null;
};
export type IndicatorViewContext = {
  tab: string;
  label: string;
  items: ContextMetric[];
};
export type AssistantApplicationContext = {
  schemaVersion: 1;
  dashboardInstanceId: string;
  application: 'SRM';
  source: {
    kind: 'financial-data-module';
    version: string | null;
    capturedOn: string | null;
    statementScope: 'standalone' | 'consolidated';
  };
  supplier: { id: string; name: string; nip: string | null; krs: string | null };
  view: {
    page: 'supplier-intelligence-dashboard';
    radar: {
      year: number | null;
      comparisonYear: number | null;
      referenceSelection: string;
      referenceKind: 'history' | 'peers';
      referenceStatus: 'unconfirmed' | 'available';
    };
    indicators: IndicatorViewContext;
    history: { code: string; year: number | null } | null;
  };
  financialSummary: ContextMetric[];
};

export type ConversationRequest = {
  schemaVersion: 1;
  requestId: string;
  conversationId: string;
  text: string;
  createdAt: string;
  contextSnapshot: AssistantApplicationContext;
};

function freezeTree<T>(value: T): T {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freezeTree);
    Object.freeze(value);
  }
  return value;
}

/** Call only when a future user message is actually submitted, not on every render.
 * Deep copying prevents subsequent year/supplier changes from rewriting old questions.
 * No request is sent by this factory. Missing values remain null, never zero.
 */
export function createConversationRequest(
  conversationId: string,
  text: string,
  context: AssistantApplicationContext
): Readonly<ConversationRequest> {
  if (!text.trim()) throw new Error('A question must not be empty.');
  return freezeTree({
    schemaVersion: 1 as const,
    requestId: crypto.randomUUID(),
    conversationId,
    text: text.trim(),
    createdAt: new Date().toISOString(),
    contextSnapshot: structuredClone(context)
  });
}

/** Optional dependency of the future conversation controller. No implementation
 * is installed in this design. Responses must remain attached to requestId and
 * contextSnapshot even if the live dashboard has moved to another supplier.
 */
export interface ConversationAdapter {
  submit(request: Readonly<ConversationRequest>, signal: AbortSignal): Promise<{
    requestId: string;
    text: string;
  }>;
}
