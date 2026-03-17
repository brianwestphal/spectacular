import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { runAIPrompt } from './ai.js';
import { serializeSpecFile } from './formatter.js';
import type { AIProvider, SpecFile } from './types.js';

// ── Git diff helpers ─────────────────────────────────────────────────

export type DiffMode =
  | { type: 'uncommitted' }
  | { type: 'staged' }
  | { type: 'unstaged' }
  | { type: 'commit'; sha: string }
  | { type: 'range'; range: string }
  | { type: 'branch'; branch: string }
  | { type: 'files'; patterns: string[] };

export function getGitDiff(mode: DiffMode, cwd: string): string {
  const exec = (cmd: string): string =>
    execSync(cmd, { cwd, encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 }).trim();

  switch (mode.type) {
    case 'uncommitted': {
      const staged = exec('git diff --cached');
      const unstaged = exec('git diff');
      const untracked = exec('git ls-files --others --exclude-standard');
      const parts = [staged, unstaged];
      if (untracked !== '') {
        for (const file of untracked.split('\n')) {
          const filePath = path.join(cwd, file);
          if (fs.existsSync(filePath)) {
            const content = fs.readFileSync(filePath, 'utf-8');
            parts.push(`diff --git a/${file} b/${file}\nnew file\n--- /dev/null\n+++ b/${file}\n${content.split('\n').map(l => `+${l}`).join('\n')}`);
          }
        }
      }
      return parts.filter(p => p !== '').join('\n\n');
    }
    case 'staged':
      return exec('git diff --cached');
    case 'unstaged':
      return exec('git diff');
    case 'commit':
      return exec(`git diff ${mode.sha}~1..${mode.sha}`);
    case 'range':
      return exec(`git diff ${mode.range}`);
    case 'branch':
      return exec(`git diff ${mode.branch}..HEAD`);
    case 'files': {
      const patterns = mode.patterns.join(' ');
      return exec(`git diff -- ${patterns}`);
    }
  }
}

// ── Absorb ───────────────────────────────────────────────────────────

const ABSORB_SYSTEM_PROMPT = `You are a software specification analyst. You will be given:
1. A software specification written in the Spectacular language
2. A code diff (changes made to the software)
3. The variant/platform these changes were made for (e.g., "ios", "android")

Your task: analyze the code changes and propose updates to the specification that would:
- Make the spec precise enough to prevent the class of bug that was fixed
- Capture any new behavior or constraints revealed by the changes
- Ensure the spec is clear enough that code generated from it would include this fix

Respond with a JSON object:
{
  "summary": "Brief description of what the code changes do and why spec changes are needed",
  "changes": [
    {
      "file": "filename.spc",
      "section": "Section Heading",
      "action": "add" | "modify" | "remove",
      "layer": "base" | "<variant-name>",
      "current": "the current spec text in this section (if modifying)",
      "proposed": "the proposed new spec text",
      "reason": "why this change prevents the bug class"
    }
  ]
}

Rules:
- Prefer changes to the base layer unless the fix is truly platform-specific
- If a fix applies to all platforms, put it in the base spec, not a variant layer
- Be precise but not overly verbose — match the style of the existing spec
- Include only the changed/added text, not the entire section
- If adding to an existing section, show what to append
- Respond ONLY with the JSON object. No markdown, no explanation.`;

export interface AbsorbChange {
  file: string;
  section: string;
  action: 'add' | 'modify' | 'remove';
  layer: string;
  current?: string;
  proposed: string;
  reason: string;
}

export interface AbsorbResult {
  summary: string;
  changes: AbsorbChange[];
  provider: string;
  model: string;
}

export async function runAbsorb(
  resolvedFiles: SpecFile[],
  diff: string,
  variant: string,
  provider: AIProvider,
  model: string,
): Promise<AbsorbResult> {
  const specText = resolvedFiles
    .map(f => {
      const filename = path.basename(f.path);
      return `--- ${filename} ---\n${serializeSpecFile(f)}`;
    })
    .join('\n\n');

  const userMessage = `Variant: ${variant}

Current specification:

${specText}

Code changes (diff):

\`\`\`diff
${diff}
\`\`\``;

  const responseText = await runAIPrompt(provider, model, ABSORB_SYSTEM_PROMPT, userMessage);

  try {
    let jsonText = responseText.trim();
    const codeBlockMatch = jsonText.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (codeBlockMatch?.[1] !== undefined) {
      jsonText = codeBlockMatch[1].trim();
    }

    const parsed = JSON.parse(jsonText) as {
      summary?: unknown;
      changes?: unknown[];
    };

    const summary = typeof parsed.summary === 'string' ? parsed.summary : 'No summary provided';
    const changes: AbsorbChange[] = [];

    if (Array.isArray(parsed.changes)) {
      for (const c of parsed.changes) {
        const change = c as Record<string, unknown>;
        if (typeof change['file'] === 'string' && typeof change['proposed'] === 'string') {
          changes.push({
            file: change['file'],
            section: typeof change['section'] === 'string' ? change['section'] : '',
            action: change['action'] === 'add' || change['action'] === 'modify' || change['action'] === 'remove'
              ? change['action'] : 'add',
            layer: typeof change['layer'] === 'string' ? change['layer'] : 'base',
            current: typeof change['current'] === 'string' ? change['current'] : undefined,
            proposed: change['proposed'],
            reason: typeof change['reason'] === 'string' ? change['reason'] : '',
          });
        }
      }
    }

    return { summary, changes, provider, model };
  } catch {
    return {
      summary: `Failed to parse AI response: ${responseText.slice(0, 200)}...`,
      changes: [],
      provider,
      model,
    };
  }
}
