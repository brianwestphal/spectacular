import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import type { AIProvider } from './types.js';

const DEFAULT_MODELS: Record<AIProvider, string> = {
  claude: 'claude-opus-4-20250514',
  'claude-cli': 'opus',
  codex: 'o3',
  'codex-cli': 'o3',
  gemini: 'gemini-2.5-pro',
  'gemini-cli': 'gemini-2.5-pro',
};

export function getDefaultModel(provider: AIProvider): string {
  return DEFAULT_MODELS[provider];
}

/**
 * Send a prompt to an AI provider and return the response text.
 *
 * If the response is truncated, the provider automatically continues
 * up to MAX_CONTINUATIONS times. If onContinuationLimit is provided,
 * it is called at the limit and can authorize further continuations.
 */
export async function runAIPrompt(
  provider: AIProvider,
  model: string,
  systemPrompt: string,
  userMessage: string,
  maxTokens: number = 16384,
  onContinuationLimit?: (count: number) => Promise<boolean>,
): Promise<string> {
  switch (provider) {
    case 'claude':
      return callClaude(model, systemPrompt, userMessage, maxTokens, onContinuationLimit);
    case 'claude-cli':
      return callClaudeCLI(model, systemPrompt, userMessage);
    case 'codex':
      return callOpenAI(model, systemPrompt, userMessage);
    case 'codex-cli':
      return callCodexCLI(model, systemPrompt, userMessage);
    case 'gemini':
      return callGemini(model, systemPrompt, userMessage);
    case 'gemini-cli':
      return callGeminiCLI(model, systemPrompt, userMessage);
  }
}

// ── API providers ────────────────────────────────────────────────────

const MAX_CONTINUATIONS = 50;
const CONTINUATION_PROMPT = 'Your response was truncated due to length. Continue from exactly where you stopped. Do not repeat any previously generated content — begin your output at the precise point of truncation.';

function getClaudeMaxOutputTokens(model: string): number {
  if (model.startsWith('claude-opus-4')) return 32000;
  if (model.startsWith('claude-sonnet-4')) return 64000;
  if (model.startsWith('claude-3-5-sonnet')) return 8192;
  if (model.startsWith('claude-3-5-haiku')) return 8192;
  if (model.startsWith('claude-3-opus')) return 4096;
  if (model.startsWith('claude-3-haiku')) return 4096;
  return 16384;
}

async function callClaude(
  model: string,
  systemPrompt: string,
  userMessage: string,
  maxTokens: number,
  onContinuationLimit?: (count: number) => Promise<boolean>,
): Promise<string> {
  const apiKey = process.env['ANTHROPIC_API_KEY'];
  if (apiKey === undefined || apiKey === '') {
    throw new Error('ANTHROPIC_API_KEY environment variable is not set.');
  }

  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey });

  const effectiveMaxTokens = Math.min(maxTokens, getClaudeMaxOutputTokens(model));
  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [
    { role: 'user', content: userMessage },
  ];
  let fullText = '';
  let continuationLimit = MAX_CONTINUATIONS;

  for (let i = 0; i <= continuationLimit; i++) {
    // Use streaming to handle large outputs without timeout
    const stream = client.messages.stream({
      model,
      max_tokens: effectiveMaxTokens,
      system: systemPrompt,
      messages,
    });

    const response = await stream.finalMessage();

    let chunkText = '';
    for (const block of response.content) {
      if (block.type === 'text') {
        chunkText += block.text;
      }
    }
    fullText += chunkText;

    if (response.stop_reason !== 'max_tokens') break;

    // At the continuation limit, ask whether to keep going
    if (i >= continuationLimit) {
      if (onContinuationLimit !== undefined) {
        const shouldContinue = await onContinuationLimit(continuationLimit);
        if (!shouldContinue) break;
        continuationLimit += MAX_CONTINUATIONS;
      } else {
        break;
      }
    }

    // Response was truncated — ask the model to continue
    messages.push({ role: 'assistant', content: chunkText });
    messages.push({ role: 'user', content: CONTINUATION_PROMPT });
  }

  return fullText;
}

async function callOpenAI(model: string, systemPrompt: string, userMessage: string): Promise<string> {
  const apiKey = process.env['OPENAI_API_KEY'];
  if (apiKey === undefined || apiKey === '') {
    throw new Error('OPENAI_API_KEY environment variable is not set.');
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
    throw new Error('GEMINI_API_KEY environment variable is not set.');
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
        reject(new Error(`${label} CLI not found.`, { cause: error }));
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
  const combinedPrompt = `${systemPrompt}\n\n${userMessage}`;

  const args = [
    'exec', '-',
    '--model', model,
    '--ephemeral',
  ];

  return spawnCLI('codex', args, combinedPrompt, 'codex');
}

async function callGeminiCLI(model: string, systemPrompt: string, userMessage: string): Promise<string> {
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
          reject(new Error('gemini CLI not found. Install: npm install -g @google/gemini-cli', { cause: error }));
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
    try { fs.unlinkSync(systemPromptFile); } catch { /* ignore */ }
  }
}
