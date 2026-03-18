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

  execSync(`git tag "${tag}"`, { cwd, encoding: 'utf-8' });

  const status = execSync('git status --porcelain', { cwd, encoding: 'utf-8' }).trim();
  const hadUncommitted = status !== '';

  let patchFile: string | null = null;
  if (hadUncommitted) {
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

const GENERATE_SYSTEM_PROMPT = `You are a software engineer generating code from a specification.

You will be given:
1. A software specification
2. A list of existing source files and their contents
3. The target platform/variant

Your task: produce the complete source code for each file that needs to be created or updated.

Respond with a JSON object:
{
  "summary": "Brief description of what was generated",
  "files": [
    {
      "path": "relative/path/to/file.js",
      "action": "create" | "update",
      "content": "the complete file content"
    }
  ],
  "notes": "Any important decisions or things the developer should verify"
}

Rules:
- Return the COMPLETE content for each file — not diffs or partial snippets
- Use the file path relative to the source directory
- Follow the conventions of the target platform
- If existing files already conform to the spec, you can omit them from the response
- Only include files that need to be created or changed
- Write production-quality code with proper error handling
- Respond ONLY with the JSON object. No markdown wrapping, no explanation outside the JSON.`;

interface GeneratedFile {
  path: string;
  action: string;
  content: string;
}

export interface GenerateResult {
  variant: string;
  sourceDir: string;
  summary: string;
  filesWritten: string[];
  notes: string;
  provider: string;
  model: string;
}

function readExistingFiles(sourceDir: string): string {
  const parts: string[] = [];
  try {
    const fileList = execSync(
      'find . -type f -not -path "*/node_modules/*" -not -path "*/.git/*" -not -path "*/dist/*" -not -path "*/.build/*" -not -name "*.xcodeproj" -not -name ".DS_Store" | sort | head -50',
      { cwd: sourceDir, encoding: 'utf-8' }
    ).trim();

    if (fileList === '') return '(empty directory)';

    for (const relPath of fileList.split('\n')) {
      const fullPath = path.join(sourceDir, relPath);
      try {
        const stat = fs.statSync(fullPath);
        if (stat.size > 50_000) {
          parts.push(`--- ${relPath} --- (${stat.size} bytes, too large to include)`);
          continue;
        }
        const content = fs.readFileSync(fullPath, 'utf-8');
        parts.push(`--- ${relPath} ---\n${content}`);
      } catch {
        // skip unreadable files
      }
    }
  } catch {
    return '(could not list source files)';
  }
  return parts.join('\n\n');
}

export async function runGenerate(
  resolvedFiles: SpecFile[],
  variant: string,
  sourceDir: string,
  provider: AIProvider,
  model: string,
  onContinuationLimit?: (count: number) => Promise<boolean>,
): Promise<GenerateResult> {
  const specText = resolvedFiles
    .map(f => {
      const filename = path.basename(f.path);
      return `--- ${filename} ---\n${serializeSpecFile(f)}`;
    })
    .join('\n\n');

  const existingFiles = readExistingFiles(sourceDir);

  const userMessage = `Target variant: ${variant}
Source directory: ${sourceDir}

Existing source files:

${existingFiles}

Specification:

${specText}

Generate or update the code to implement this specification. Return complete file contents for every file that needs to be created or changed.`;

  const responseText = await runAIPrompt(provider, model, GENERATE_SYSTEM_PROMPT, userMessage, 32768, onContinuationLimit);

  // Parse the response
  let summary: string;
  let notes: string;
  const filesWritten: string[] = [];

  try {
    let jsonText = responseText.trim();
    const codeBlockMatch = jsonText.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (codeBlockMatch?.[1] !== undefined) {
      jsonText = codeBlockMatch[1].trim();
    }

    const parsed = JSON.parse(jsonText) as Record<string, unknown>;
    summary = typeof parsed['summary'] === 'string' ? parsed['summary'] : 'Code generated';
    notes = typeof parsed['notes'] === 'string' ? parsed['notes'] : '';

    if (Array.isArray(parsed['files'])) {
      for (const f of parsed['files'] as GeneratedFile[]) {
        if (typeof f.path !== 'string' || typeof f.content !== 'string') continue;

        const targetPath = path.join(sourceDir, f.path);
        const targetDir = path.dirname(targetPath);

        // Create directories as needed
        fs.mkdirSync(targetDir, { recursive: true });

        // Write the file
        fs.writeFileSync(targetPath, f.content);
        filesWritten.push(f.path);
      }
    }
  } catch {
    return {
      variant,
      sourceDir,
      summary: 'Failed to parse AI response',
      filesWritten: [],
      notes: responseText.slice(0, 500),
      provider,
      model,
    };
  }

  return {
    variant,
    sourceDir,
    summary,
    filesWritten,
    notes,
    provider,
    model,
  };
}
