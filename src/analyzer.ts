import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { serializeSpecFile } from './formatter.js';
import type { AIProvider, AnalysisResult, CheckType, Finding, Severity, SpecFile } from './types.js';

const DEFAULT_MODELS: Record<AIProvider, string> = {
  claude: 'claude-opus-4-20250514',
  'claude-cli': 'opus',
  codex: 'o3',
  'codex-cli': 'o3',
  gemini: 'gemini-2.5-pro',
  'gemini-cli': 'gemini-2.5-pro',
};

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

/**
 * Run an AI-powered analysis check on resolved spec files.
 */
export async function runCheck(
  files: SpecFile[],
  checkType: CheckType,
  provider: AIProvider,
  modelOverride?: string,
): Promise<AnalysisResult> {
  const model = modelOverride ?? DEFAULT_MODELS[provider];

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
    switch (provider) {
      case 'claude':
        responseText = await callClaude(model, systemPrompt, userMessage);
        break;
      case 'claude-cli':
        responseText = await callClaudeCLI(model, systemPrompt, userMessage);
        break;
      case 'codex':
        responseText = await callOpenAI(model, systemPrompt, userMessage);
        break;
      case 'codex-cli':
        responseText = await callCodexCLI(model, systemPrompt, userMessage);
        break;
      case 'gemini':
        responseText = await callGemini(model, systemPrompt, userMessage);
        break;
      case 'gemini-cli':
        responseText = await callGeminiCLI(model, systemPrompt, userMessage);
        break;
    }
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

// ── API providers ────────────────────────────────────────────────────

async function callClaude(model: string, systemPrompt: string, userMessage: string): Promise<string> {
  const apiKey = process.env['ANTHROPIC_API_KEY'];
  if (apiKey === undefined || apiKey === '') {
    throw new Error('ANTHROPIC_API_KEY environment variable is not set. Set it to use the Claude provider.');
  }

  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey });

  const response = await client.messages.create({
    model,
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  });

  const textBlock = response.content.find(b => b.type === 'text');
  if (textBlock !== undefined) {
    return textBlock.text;
  }
  return '';
}

async function callOpenAI(model: string, systemPrompt: string, userMessage: string): Promise<string> {
  const apiKey = process.env['OPENAI_API_KEY'];
  if (apiKey === undefined || apiKey === '') {
    throw new Error('OPENAI_API_KEY environment variable is not set. Set it to use the Codex (OpenAI) provider.');
  }

  const { default: OpenAI } = await import('openai');
  const client = new OpenAI({ apiKey });

  const response = await client.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
    temperature: 0.2,
  });

  return response.choices[0]?.message.content ?? '';
}

async function callGemini(model: string, systemPrompt: string, userMessage: string): Promise<string> {
  const apiKey = process.env['GEMINI_API_KEY'];
  if (apiKey === undefined || apiKey === '') {
    throw new Error('GEMINI_API_KEY environment variable is not set. Set it to use the Gemini provider.');
  }

  const { GoogleGenerativeAI } = await import('@google/generative-ai');
  const genAI = new GoogleGenerativeAI(apiKey);

  const genModel = genAI.getGenerativeModel({
    model,
    systemInstruction: systemPrompt,
  });

  const result = await genModel.generateContent(userMessage);
  const response = result.response;
  return response.text();
}

// ── CLI providers ────────────────────────────────────────────────────

/**
 * Spawn a CLI process, pipe a prompt via stdin, and return stdout.
 */
function spawnCLI(command: string, args: string[], stdinData: string, label: string): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const proc = spawn(command, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data: Buffer) => { stdout += data.toString(); });
    proc.stderr.on('data', (data: Buffer) => { stderr += data.toString(); });

    proc.on('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') {
        reject(new Error(`${label} CLI not found. Install it first.`, { cause: error }));
      } else {
        reject(new Error(`${label} CLI failed to start: ${error.message}`, { cause: error }));
      }
    });

    proc.on('close', (code) => {
      if (code !== 0 && code !== null) {
        reject(new Error(`${label} CLI exited with code ${code}: ${stderr}`));
      } else {
        resolve(stdout.trim());
      }
    });

    proc.stdin.write(stdinData);
    proc.stdin.end();
  });
}

interface CLIJSONResponse {
  result?: string;
  error?: string;
}

/**
 * Parse a JSON response from a CLI tool that returns a result field.
 * Falls back to raw output if not JSON.
 */
function parseCLIJSON(output: string): string {
  try {
    const parsed = JSON.parse(output) as CLIJSONResponse;
    if (typeof parsed.result === 'string') {
      return parsed.result;
    }
    if (typeof parsed.error === 'string') {
      throw new Error(`CLI error: ${parsed.error}`);
    }
  } catch (parseError: unknown) {
    if (parseError instanceof SyntaxError) {
      return output;
    }
    throw parseError;
  }
  return output;
}

async function callClaudeCLI(model: string, systemPrompt: string, userMessage: string): Promise<string> {
  const args = [
    '-p',
    '--append-system-prompt', systemPrompt,
    '--model', model,
    '--output-format', 'json',
    '--no-session-persistence',
  ];

  const output = await spawnCLI('claude', args, userMessage, 'claude');
  return parseCLIJSON(output);
}

async function callCodexCLI(model: string, systemPrompt: string, userMessage: string): Promise<string> {
  // Codex CLI has no system prompt flag — embed in the prompt
  const combinedPrompt = `${systemPrompt}\n\n${userMessage}`;

  const args = [
    'exec', '-',
    '--model', model,
    '--ephemeral',
  ];

  const output = await spawnCLI('codex', args, combinedPrompt, 'codex');

  // codex exec with no --json flag returns raw text
  // With --json it returns JSONL events — we want raw text since our prompt
  // asks for a JSON array response directly
  return output;
}

async function callGeminiCLI(model: string, systemPrompt: string, userMessage: string): Promise<string> {
  // Gemini CLI supports system prompt via GEMINI_SYSTEM_MD env var pointing to a file.
  // Write a temp file, set the env var, and clean up after.
  const tmpDir = os.tmpdir();
  const systemPromptFile = path.join(tmpDir, `spc-gemini-system-${Date.now()}.md`);
  fs.writeFileSync(systemPromptFile, systemPrompt);

  try {
    const args = [
      '-p', userMessage,
      '--model', model,
      '--output-format', 'json',
    ];

    const output = await new Promise<string>((resolve, reject) => {
      const proc = spawn('gemini', args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          ...process.env,
          'GEMINI_SYSTEM_MD': systemPromptFile,
        },
      });

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data: Buffer) => { stdout += data.toString(); });
      proc.stderr.on('data', (data: Buffer) => { stderr += data.toString(); });

      proc.on('error', (error: NodeJS.ErrnoException) => {
        if (error.code === 'ENOENT') {
          reject(new Error('gemini CLI not found. Install it first: npm install -g @google/gemini-cli', { cause: error }));
        } else {
          reject(new Error(`gemini CLI failed to start: ${error.message}`, { cause: error }));
        }
      });

      proc.on('close', (code) => {
        if (code !== 0 && code !== null) {
          reject(new Error(`gemini CLI exited with code ${code}: ${stderr}`));
        } else {
          resolve(stdout.trim());
        }
      });
    });

    return parseCLIJSON(output);
  } finally {
    try { fs.unlinkSync(systemPromptFile); } catch { /* ignore cleanup errors */ }
  }
}

// ── Response parsing ─────────────────────────────────────────────────

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
