import * as path from 'node:path';

import { runAIPrompt } from './ai.js';
import { serializeSpecFile } from './formatter.js';
import type { AIProvider, AnalysisResult, CheckType, Finding, Severity, SpecFile } from './types.js';

const SYSTEM_PROMPTS: Record<CheckType, string> = {
  ambiguity: `You are a specification analyst. Analyze the following software specification and identify statements that are ambiguous, vague, or could be misinterpreted during implementation.

For each issue found, respond with a JSON array of findings. Each finding has:
- "severity": "error" | "warning" | "info"
- "file": the filename if identifiable
- "section": the section heading where the issue appears
- "description": what is ambiguous and why
- "suggestion": how to make it more precise

Use "error" for statements so vague they could lead to completely wrong implementations.
Use "warning" for statements that could be interpreted in multiple reasonable ways.
Use "info" for statements that are slightly imprecise but probably fine.

Respond ONLY with a JSON array. No markdown, no explanation.`,

  consistency: `You are a specification analyst. Analyze the following software specification and identify statements that conflict with or contradict each other — whether literally or semantically.

For each issue found, respond with a JSON array of findings. Each finding has:
- "severity": "error" | "warning" | "info"
- "file": the filename if identifiable
- "section": the section heading where the issue appears
- "description": what conflicts and which statements are involved
- "suggestion": how to resolve the conflict

Use "error" for direct contradictions.
Use "warning" for semantic tensions that should be clarified.
Use "info" for minor inconsistencies in terminology or style.

Respond ONLY with a JSON array. No markdown, no explanation.`,

  completeness: `You are a specification analyst. Analyze the following software specification and identify areas that likely need more detail — missing error handling, edge cases, accessibility considerations, performance requirements, security concerns, etc.

For each gap found, respond with a JSON array of findings. Each finding has:
- "severity": "error" | "warning" | "info"
- "file": the filename if identifiable
- "section": the section heading where the gap exists
- "description": what is missing and why it matters
- "suggestion": what should be specified

Use "error" for critical gaps that would block implementation.
Use "warning" for important gaps that could cause issues.
Use "info" for nice-to-have specifications.

Respond ONLY with a JSON array. No markdown, no explanation.`,

  redundancy: `You are a specification analyst. Analyze the following software specification and identify statements that are unnecessarily repeated, overlapping, or could be consolidated.

For each issue found, respond with a JSON array of findings. Each finding has:
- "severity": "error" | "warning" | "info"
- "file": the filename if identifiable
- "section": the section heading where the redundancy appears
- "description": what is redundant and where the duplication occurs
- "suggestion": how to consolidate

Use "warning" for significant redundancy that could cause maintenance issues.
Use "info" for minor overlaps.
"error" is rarely needed for redundancy.

Respond ONLY with a JSON array. No markdown, no explanation.`,
};

interface RawFinding {
  severity?: unknown;
  file?: unknown;
  section?: unknown;
  description?: unknown;
  suggestion?: unknown;
}

export async function runCheck(
  files: SpecFile[],
  checkType: CheckType,
  provider: AIProvider,
  modelOverride?: string,
): Promise<AnalysisResult> {
  const { getDefaultModel } = await import('./ai.js');
  const model = modelOverride ?? getDefaultModel(provider);

  const specText = files
    .map(f => {
      const filename = path.basename(f.path);
      return `--- ${filename} ---\n${serializeSpecFile(f)}`;
    })
    .join('\n\n');

  const systemPrompt = SYSTEM_PROMPTS[checkType];
  const userMessage = `Analyze this specification:\n\n${specText}`;

  let responseText: string;

  try {
    responseText = await runAIPrompt(provider, model, systemPrompt, userMessage);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      checkType,
      findings: [{
        severity: 'error',
        location: {},
        description: `Analysis failed: ${message}`,
      }],
      provider,
      model,
    };
  }

  const findings = parseAIResponse(responseText);

  return {
    checkType,
    findings,
    provider,
    model,
  };
}

function parseAIResponse(responseText: string): Finding[] {
  try {
    let jsonText = responseText.trim();

    const codeBlockMatch = jsonText.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (codeBlockMatch?.[1] !== undefined) {
      jsonText = codeBlockMatch[1].trim();
    }

    const parsed: unknown = JSON.parse(jsonText);

    if (!Array.isArray(parsed)) {
      return [{
        severity: 'error',
        location: {},
        description: 'AI returned non-array response',
      }];
    }

    return (parsed as RawFinding[]).map((item) => ({
      severity: validateSeverity(item.severity),
      location: {
        file: typeof item.file === 'string' ? item.file : undefined,
        section: typeof item.section === 'string' ? item.section : undefined,
      },
      description: typeof item.description === 'string' ? item.description : 'No description provided',
      suggestion: typeof item.suggestion === 'string' ? item.suggestion : undefined,
    }));
  } catch {
    return [{
      severity: 'error',
      location: {},
      description: `Failed to parse AI response: ${responseText.slice(0, 200)}...`,
    }];
  }
}

function validateSeverity(s: unknown): Severity {
  if (s === 'error' || s === 'warning' || s === 'info') return s;
  return 'info';
}
