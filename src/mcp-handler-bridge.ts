import type { McpResult } from "./extract-tool-results.js";
import type { PendingToolCall, QueryContext } from "./query-state.js";

export type McpDebug = (message: string) => void;

const noop: McpDebug = () => {};

/**
 * Attach a handler to a real CodeBuddy tool-call ID, or resolve it from a
 * result that arrived before the handler was invoked.
 */
export function attachMcpHandler(
	queryCtx: QueryContext,
	toolCallId: string,
	pending: PendingToolCall,
	debug: McpDebug = noop,
): void {
	if (queryCtx.pendingResults.has(toolCallId)) {
		const result = queryCtx.pendingResults.get(toolCallId)!;
		queryCtx.pendingResults.delete(toolCallId);
		debug(`mcp handler: ${pending.toolName} [${toolCallId}] → resolved from queue (${queryCtx.pendingResults.size} remaining)`);
		pending.resolve(result);
		return;
	}
	queryCtx.pendingToolCalls.set(toolCallId, pending);
	debug(`mcp handler: ${pending.toolName} [${toolCallId}] → waiting`);
}

/**
 * Register a tool_use event and bind the oldest same-named handler that the
 * SDK invoked before this event was delivered.
 */
export function registerMcpToolCall(
	queryCtx: QueryContext,
	toolCallId: string,
	toolName: string,
	debug: McpDebug = noop,
): void {
	const index = queryCtx.turnToolCallIds.length;
	queryCtx.turnToolCallIds.push(toolCallId);
	queryCtx.turnToolCallNames[index] = toolName;
	queryCtx.turnToolCallClaimed[index] = false;

	const handlerIndex = queryCtx.unboundToolHandlers.findIndex(
		(handler) => handler.toolName.toLowerCase() === toolName.toLowerCase(),
	);
	if (handlerIndex === -1) return;
	const pending = queryCtx.unboundToolHandlers.splice(handlerIndex, 1)[0];
	queryCtx.turnToolCallClaimed[index] = true;
	debug(`mcp tool call: ${toolName} [${toolCallId}] → bound waiting handler`);
	attachMcpHandler(queryCtx, toolCallId, pending, debug);
}

/** Claim the oldest registered, unclaimed tool call with this tool name. */
export function claimMcpToolCall(queryCtx: QueryContext, toolName: string): string | undefined {
	const normalizedName = toolName.toLowerCase();
	for (let i = 0; i < queryCtx.turnToolCallIds.length; i++) {
		if (!queryCtx.turnToolCallClaimed[i] && queryCtx.turnToolCallNames[i]?.toLowerCase() === normalizedName) {
			queryCtx.turnToolCallClaimed[i] = true;
			return queryCtx.turnToolCallIds[i];
		}
	}
	return undefined;
}

/**
 * Resolve all handlers during abort/query teardown, including handlers that
 * are still waiting for a late tool_use event.
 */
export function resolvePendingMcpHandlers(queryCtx: QueryContext, text: string): void {
	const result: McpResult = { content: [{ type: "text", text }] };
	for (const pending of queryCtx.pendingToolCalls.values()) pending.resolve(result);
	for (const pending of queryCtx.unboundToolHandlers) pending.resolve(result);
	queryCtx.pendingToolCalls.clear();
	queryCtx.unboundToolHandlers.length = 0;
	queryCtx.pendingResults.clear();
}
