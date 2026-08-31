// Skills block extraction + MCP naming constants.
// Extracted from index.ts so tests can import without activating the extension.

import { extractAgentsAppend } from "./agents-md.js";

export const MCP_SERVER_NAME = "custom_tools";
export const MCP_TOOL_PREFIX = `mcp__${MCP_SERVER_NAME}__`;

const SKILLS_START_MARKER = "The following skills provide specialized instructions for specific tasks.";
const SKILLS_END_MARKER = "</available_skills>";

// Extract skills block from pi's system prompt for forwarding to CodeBuddy.
export function extractSkillsBlock(systemPrompt?: string): string | undefined {
	if (!systemPrompt) return undefined;
	const startMarker = SKILLS_START_MARKER;
	const endMarker = SKILLS_END_MARKER;
	const start = systemPrompt.indexOf(startMarker);
	if (start === -1) return undefined;
	const end = systemPrompt.indexOf(endMarker, start);
	if (end === -1) return undefined;
	return rewriteSkillsBlock(systemPrompt.slice(start, end + endMarker.length).trim());
}

export function rewriteSkillsBlock(skillsBlock: string): string {
	return skillsBlock.replace(
		"Use the read tool to load a skill's file",
		`Use the read tool (mcp__${MCP_SERVER_NAME}__read) to load a skill's file`,
	);
}

function stripSkillsBlock(systemPrompt: string): string {
	const start = systemPrompt.indexOf(SKILLS_START_MARKER);
	if (start === -1) return systemPrompt;
	const end = systemPrompt.indexOf(SKILLS_END_MARKER, start);
	if (end === -1) return systemPrompt;
	return (systemPrompt.slice(0, start) + systemPrompt.slice(end + SKILLS_END_MARKER.length))
		.replace(/\n{3,}/g, "\n\n")
		.trim();
}

function applySkillsRewrite(systemPrompt: string): string {
	const rewritten = extractSkillsBlock(systemPrompt);
	if (!rewritten) return systemPrompt;
	const start = systemPrompt.indexOf(SKILLS_START_MARKER);
	const end = systemPrompt.indexOf(SKILLS_END_MARKER, start);
	if (start === -1 || end === -1) return systemPrompt;
	return systemPrompt.slice(0, start) + rewritten + systemPrompt.slice(end + SKILLS_END_MARKER.length);
}

/** Pi system prompt as CodeBuddy override (replaces default "CodeBuddy Code" identity). */
export function buildCodebuddySystemPrompt(
	piSystemPrompt: string | undefined,
	options?: { includeAgents?: boolean; includeSkills?: boolean },
): string | undefined {
	const parts: string[] = [];

	if (piSystemPrompt) {
		let prompt = piSystemPrompt;
		if (options?.includeSkills === false) {
			prompt = stripSkillsBlock(prompt);
		} else {
			prompt = applySkillsRewrite(prompt);
		}
		if (prompt) parts.push(prompt);
	}

	if (options?.includeAgents !== false) {
		const agents = extractAgentsAppend();
		if (agents) parts.push(agents);
	}

	return parts.length > 0 ? parts.join("\n\n") : undefined;
}
