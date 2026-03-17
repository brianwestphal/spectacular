import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { runAIPrompt } from './ai.js';
import { serializeSpecFile } from './formatter.js';
import type { AIProvider, SpecFile } from './types.js';

// ── Source mapping ───────────────────────────────────────────────────

export function parseSourceMappings(sources: string[]): Map<string, string> {
  const mappings = new Map<string, string>();
  for (const source of sources) {
    const eqIdx = source.indexOf('=');
    if (eqIdx === -1) {
      throw new Error(`Invalid source mapping: "${source}". Use format: variant=./path (e.g., ios=./ios-app)`);
    }
    const variant = source.slice(0, eqIdx);
    const dir = path.resolve(source.slice(eqIdx + 1));
    if (!fs.existsSync(dir)) {
      throw new Error(`Source directory not found: ${dir} (for variant "${variant}")`);
    }
    mappings.set(variant, dir);
  }
  return mappings;
}

// ── Snapshot ─────────────────────────────────────────────────────────

export interface Snapshot {
  tag: string;
  patchFile: string | null;
  hadUncommitted: boolean;
}

export function createSnapshot(cwd: string): Snapshot {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const tag = `spc/pre-generate-${timestamp}`;

  // Tag the current HEAD
  execSync(`git tag "${tag}"`, { cwd, encoding: 'utf-8' });

  // Check for uncommitted changes
  const status = execSync('git status --porcelain', { cwd, encoding: 'utf-8' }).trim();
  const hadUncommitted = status !== '';

  let patchFile: string | null = null;
  if (hadUncommitted) {
    // Save all uncommitted changes (tracked files) as a patch
    const tracked = execSync('git diff HEAD', { cwd, encoding: 'utf-8' });
    const staged = execSync('git diff --cached', { cwd, encoding: 'utf-8' });
    const combined = [staged, tracked].filter(p => p.trim() !== '').join('\n');

    if (combined.trim() !== '') {
      patchFile = path.join(cwd, `.spc-snapshot-${timestamp}.patch`);
      fs.writeFileSync(patchFile, combined);
    }
  }

  return { tag, patchFile, hadUncommitted };
}

export function formatRecoveryInstructions(snapshot: Snapshot): string {
  const lines: string[] = [];
  lines.push(`Snapshot: ${snapshot.tag}`);
  if (snapshot.patchFile !== null) {
    lines.push(`Patch: ${snapshot.patchFile}`);
    lines.push('');
    lines.push('To recover your previous state:');
    lines.push(`  git reset --hard ${snapshot.tag}`);
    lines.push(`  git apply ${snapshot.patchFile}`);
  } else {
    lines.push('');
    lines.push('To recover your previous state:');
    lines.push(`  git reset --hard ${snapshot.tag}`);
  }
  lines.push('');
  lines.push('To remove the snapshot tag:');
  lines.push(`  git tag -d ${snapshot.tag}`);
  return lines.join('\n');
}

// ── Code generation ──────────────────────────────────────────────────

const GENERATE_SYSTEM_PROMPT = `You are a software engineer. You will be given a detailed software specification and a source directory path. Your task is to update the existing code in that directory — or create new files — so that the code accurately implements the specification.

Rules:
- Read the existing code first to understand the current state
- Make targeted changes — don't rewrite files that already conform to the spec
- Follow the existing code style, patterns, and conventions
- If the spec says something the code already does correctly, leave it alone
- Focus on correctness and completeness relative to the specification
- Add comments only where behavior isn't self-evident
- Respond ONLY with a JSON object describing what you did:

{
  "summary": "Brief description of changes made",
  "filesChanged": ["path/to/file1.ts", "path/to/file2.ts"],
  "filesCreated": ["path/to/new-file.ts"],
  "notes": "Any important decisions or things to verify"
}

Respond ONLY with the JSON object. No markdown, no explanation.`;

export interface GenerateResult {
  variant: string;
  sourceDir: string;
  summary: string;
  filesChanged: string[];
  filesCreated: string[];
  notes: string;
  provider: string;
  model: string;
}

export async function runGenerate(
  resolvedFiles: SpecFile[],
  variant: string,
  sourceDir: string,
  provider: AIProvider,
  model: string,
): Promise<GenerateResult> {
  const specText = resolvedFiles
    .map(f => {
      const filename = path.basename(f.path);
      return `--- ${filename} ---\n${serializeSpecFile(f)}`;
    })
    .join('\n\n');

  // List existing source files for context
  let sourceTree: string;
  try {
    sourceTree = execSync('find . -type f -not -path "*/node_modules/*" -not -path "*/.git/*" -not -path "*/dist/*" | head -100', {
      cwd: sourceDir,
      encoding: 'utf-8',
    }).trim();
  } catch {
    sourceTree = '(could not list source files)';
  }

  const userMessage = `Variant: ${variant}
Source directory: ${sourceDir}

Existing source files:
${sourceTree}

Specification:

${specText}

Update the code in ${sourceDir} to match this specification. Read the existing files first, then make targeted changes.`;

  const responseText = await runAIPrompt(provider, model, GENERATE_SYSTEM_PROMPT, userMessage);

  try {
    let jsonText = responseText.trim();
    const codeBlockMatch = jsonText.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (codeBlockMatch?.[1] !== undefined) {
      jsonText = codeBlockMatch[1].trim();
    }

    const parsed = JSON.parse(jsonText) as Record<string, unknown>;

    return {
      variant,
      sourceDir,
      summary: typeof parsed['summary'] === 'string' ? parsed['summary'] : 'No summary provided',
      filesChanged: Array.isArray(parsed['filesChanged'])
        ? (parsed['filesChanged'] as unknown[]).filter((f): f is string => typeof f === 'string')
        : [],
      filesCreated: Array.isArray(parsed['filesCreated'])
        ? (parsed['filesCreated'] as unknown[]).filter((f): f is string => typeof f === 'string')
        : [],
      notes: typeof parsed['notes'] === 'string' ? parsed['notes'] : '',
      provider,
      model,
    };
  } catch {
    return {
      variant,
      sourceDir,
      summary: `Failed to parse AI response: ${responseText.slice(0, 200)}...`,
      filesChanged: [],
      filesCreated: [],
      notes: '',
      provider,
      model,
    };
  }
}
