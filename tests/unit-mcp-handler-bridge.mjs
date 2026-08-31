import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
	attachMcpHandler,
	claimMcpToolCall,
	registerMcpToolCall,
	resolvePendingMcpHandlers,
} from "../src/mcp-handler-bridge.js";
import { QueryContext } from "../src/query-state.js";

function result(text) {
	return { content: [{ type: "text", text }] };
}

function pending(toolName, onResolve) {
	return { toolName, resolve: onResolve };
}

describe("MCP handler/tool-call binding", () => {
	it("binds a handler invoked before the tool_use event", () => {
		const query = new QueryContext();
		let received;
		query.unboundToolHandlers.push(pending("bash", (value) => { received = value; }));

		registerMcpToolCall(query, "call-1", "bash");

		assert.equal(query.unboundToolHandlers.length, 0);
		assert.ok(query.pendingToolCalls.has("call-1"));
		assert.equal(received, undefined);

		query.pendingToolCalls.get("call-1").resolve(result("ok"));
		assert.deepEqual(received, result("ok"));
	});

	it("binds a handler when the tool_use event arrived first", () => {
		const query = new QueryContext();
		let received;
		registerMcpToolCall(query, "call-1", "read");
		const id = claimMcpToolCall(query, "read");

		assert.equal(id, "call-1");
		attachMcpHandler(query, id, pending("read", (value) => { received = value; }));
		assert.ok(query.pendingToolCalls.has("call-1"));

		query.pendingToolCalls.get("call-1").resolve(result("file"));
		assert.deepEqual(received, result("file"));
		assert.equal(claimMcpToolCall(query, "read"), undefined);
	});

	it("matches parallel calls by name and preserves same-name order", () => {
		const query = new QueryContext();
		const received = [];
		query.unboundToolHandlers.push(pending("bash", (value) => received.push(["bash-1", value])));
		query.unboundToolHandlers.push(pending("read", (value) => received.push(["read", value])));
		query.unboundToolHandlers.push(pending("bash", (value) => received.push(["bash-2", value])));

		// The event order can differ from handler invocation order; names select
		// the right queue, while repeated names remain FIFO.
		registerMcpToolCall(query, "read-1", "read");
		registerMcpToolCall(query, "bash-1", "bash");
		registerMcpToolCall(query, "bash-2", "bash");

		assert.deepEqual([...query.pendingToolCalls.keys()], ["read-1", "bash-1", "bash-2"]);
		for (const [id, value] of [
			["bash-1", result("b1")],
			["read-1", result("r")],
			["bash-2", result("b2")],
		]) query.pendingToolCalls.get(id).resolve(value);

		assert.deepEqual(received, [
			["bash-1", result("b1")],
			["read", result("r")],
			["bash-2", result("b2")],
		]);
	});

	it("consumes a result queued before handler attachment", () => {
		const query = new QueryContext();
		let received;
		query.pendingResults.set("call-1", result("queued"));

		attachMcpHandler(query, "call-1", pending("bash", (value) => { received = value; }));

		assert.deepEqual(received, result("queued"));
		assert.equal(query.pendingResults.size, 0);
		assert.equal(query.pendingToolCalls.size, 0);
	});

	it("resolves unbound handlers during teardown", () => {
		const query = new QueryContext();
		let received;
		query.unboundToolHandlers.push(pending("bash", (value) => { received = value; }));

		resolvePendingMcpHandlers(query, "Operation aborted");

		assert.deepEqual(received, result("Operation aborted"));
		assert.equal(query.unboundToolHandlers.length, 0);
		assert.equal(query.pendingToolCalls.size, 0);
	});
});
