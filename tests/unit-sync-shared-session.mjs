/**
 * Regression tests for syncSharedSession's session reuse decisions.
 */
import { describe, it, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const debugDir = mkdtempSync(join(tmpdir(), "sync-shared-session-debug-"));
process.env.CODEBUDDY_SDK_DEBUG_PATH = join(debugDir, "codebuddy-sdk.log");

const { __test } = await import("../src/index.js");

describe("syncSharedSession", () => {
	after(() => {
		rmSync(debugDir, { recursive: true, force: true });
	});

	afterEach(() => {
		__test.resetSharedSession();
	});

	it("does not reuse a cached main session for a shorter synthetic compact context", () => {
		const cwd = mkdtempSync(join(tmpdir(), "sync-shared-session-"));
		try {
			const mainSession = {
				sessionId: "11111111-1111-4111-8111-111111111111",
				cursor: 42,
				cwd,
			};
			__test.setSharedSession(mainSession);

			const result = __test.syncSharedSession([
				{
					role: "user",
					content: "Summarize this conversation.",
					timestamp: Date.now(),
				},
			], cwd);

			assert.equal(
				result.sessionId,
				null,
				"synthetic compact contexts have no prior messages and must start a fresh CodeBuddy session instead of resuming the main session",
			);
			assert.equal(
				result.preserveSharedSession,
				true,
				"the fresh synthetic CodeBuddy session must not replace the cached main session when it completes",
			);
			assert.deepEqual(__test.getSharedSession(), mainSession);
		} finally {
			rmSync(cwd, { recursive: true, force: true });
		}
	});
});
