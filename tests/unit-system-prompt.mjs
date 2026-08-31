/**
 * Tests for Pi → CodeBuddy system prompt forwarding.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildCodebuddySystemPrompt } from "../src/skills.js";

const PI_PROMPT = `You are Pi's coding assistant in the terminal.

The following skills provide specialized instructions for specific tasks.
Use the read tool to load a skill's file when the task matches its description.

<available_skills>
  <skill>
    <name>br</name>
    <description>Browser automation.</description>
    <location>/tmp/skills/br/SKILL.md</location>
  </skill>
</available_skills>

Follow user rules.`;

describe("buildCodebuddySystemPrompt", () => {
	it("uses Pi identity instead of CodeBuddy default", () => {
		const result = buildCodebuddySystemPrompt(PI_PROMPT, { includeAgents: false });
		assert.ok(result?.includes("You are Pi's coding assistant"));
		assert.ok(result?.includes("mcp__custom_tools__read"));
		assert.ok(!result?.includes("CodeBuddy Code"));
	});

	it("rewrites skills read tool inside full prompt", () => {
		const result = buildCodebuddySystemPrompt(PI_PROMPT, { includeAgents: false });
		assert.ok(result?.includes("Use the read tool (mcp__custom_tools__read)"));
		assert.ok(!result?.includes("Use the read tool to load a skill's file\n"));
	});

	it("includeSkills=false strips skills block", () => {
		const result = buildCodebuddySystemPrompt(PI_PROMPT, { includeAgents: false, includeSkills: false });
		assert.ok(result?.includes("You are Pi's coding assistant"));
		assert.ok(!result?.includes("<available_skills>"));
	});

	it("undefined prompt with includeAgents=false → undefined", () => {
		assert.strictEqual(buildCodebuddySystemPrompt(undefined, { includeAgents: false }), undefined);
	});
});
