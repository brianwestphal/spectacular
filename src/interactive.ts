import * as fs from 'node:fs';
import * as path from 'node:path';
import { createInterface } from 'node:readline/promises';

import chalk from 'chalk';

import { runAIPrompt } from './ai.js';
import { runCheck } from './analyzer.js';
import { formatAnalysis } from './formatter.js';
import { discoverFiles } from './parser.js';
import { resolveBase, resolveVariant } from './resolver.js';
import type { AIProvider, CheckType, Finding } from './types.js';

// ── Types ──────────────────────────────────────────────────────────

type RL = ReturnType<typeof createInterface>;

interface FixProposal {
  finding_index: number;
  type: 'fix';
  file: string;
  description: string;
  old_text: string;
  new_text: string;
}

interface QuestionProposal {
  finding_index: number;
  type: 'question';
  question: string;
}

type Proposal = FixProposal | QuestionProposal;

type MenuChoice = 'errors' | 'all' | 'stop';

// ── Prompts ────────────────────────────────────────────────────────

const FIX_SYSTEM_PROMPT = `You are a specification editor. You edit .spc (Spectacular specification language) files to fix issues found during analysis.

Rules:
- Provide the EXACT text to find and replace in the source file
- The old_text must match the file contents EXACTLY (including whitespace and line breaks)
- Keep fixes minimal — change only what's needed to address the specific issue
- Do not rewrite entire sections when a small edit suffices
- For issues that require a specific decision from the user (e.g., choosing between technologies, defining business rules, setting specific values), ask a clarifying question instead of guessing
- For obvious improvements (e.g., adding missing error handling mention, clarifying vague language, fixing contradictions), propose a direct fix

Respond ONLY with JSON. No markdown wrapping, no explanation outside the JSON.`;

// ── Main entry point ───────────────────────────────────────────────

export async function runInteractiveCheck(
  projectRoot: string,
  variant: string | undefined,
  checks: CheckType[],
  provider: AIProvider,
  model: string,
): Promise<void> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });

  try {
    if (variant !== undefined && variant !== '') {
      console.log(chalk.dim(`Checking variant: ${variant}`));
    } else {
      console.log(chalk.dim('Checking base spec'));
    }

    let round = 0;
    let continueLoop = true;
    while (continueLoop) {
      round++;
      if (round > 1) {
        console.log(chalk.dim(`\n── Re-running checks (round ${round}) ──────────────────`));
        console.log('');
      }

      const files = variant !== undefined && variant !== ''
        ? resolveVariant(projectRoot, variant)
        : resolveBase(projectRoot);

      // Run checks, printing each result as it arrives
      console.log(chalk.dim(`Running ${checks.length} check(s)...\n`));
      const allFindings: Finding[] = [];
      for (const checkType of checks) {
        console.log(chalk.dim(`  Running ${checkType} check...`));
        const result = await runCheck(files, checkType, provider, model);
        allFindings.push(...result.findings);
        console.log(formatAnalysis([result]));
      }

      const errors = allFindings.filter(f => f.severity === 'error');
      const warnings = allFindings.filter(f => f.severity === 'warning');

      if (errors.length === 0 && warnings.length === 0) {
        console.log(chalk.green('No errors or warnings found. Spec looks good!'));
        break;
      }

      const menuChoice = await promptMenu(rl, errors.length, warnings.length);
      if (menuChoice === 'stop') break;

      const selectedFindings = menuChoice === 'errors' ? errors : [...errors, ...warnings];

      const specFilePaths = getSpecFilePaths(projectRoot, variant);
      const specContents = readSpecFileContents(specFilePaths);

      console.log(chalk.dim('\nAnalyzing issues and preparing proposals...'));
      let proposals: Proposal[];
      try {
        proposals = await getFixProposals(specContents, selectedFindings, projectRoot, provider, model);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(chalk.red(`Failed to get proposals: ${message}`));
        break;
      }

      if (proposals.length === 0) {
        console.log(chalk.yellow('No proposals generated.'));
        continueLoop = false;
        continue;
      }

      const fixCount = proposals.filter(p => p.type === 'fix').length;
      const questionCount = proposals.filter(p => p.type === 'question').length;
      const parts: string[] = [];
      if (fixCount > 0) parts.push(`${fixCount} fix proposal${fixCount === 1 ? '' : 's'}`);
      if (questionCount > 0) parts.push(`${questionCount} question${questionCount === 1 ? '' : 's'}`);
      console.log(chalk.dim(`Prepared ${parts.join(' and ')}.\n`));

      const applied = await walkProposals(
        rl, proposals, selectedFindings, specFilePaths, specContents,
        projectRoot, provider, model,
      );

      if (applied === 0) {
        console.log(chalk.yellow('\nNo changes applied.'));
        break;
      }

      console.log(chalk.dim(`\nApplied ${applied} change(s). Re-running checks...`));
    }
  } finally {
    rl.close();
  }
}

// ── Menu ───────────────────────────────────────────────────────────

async function promptMenu(
  rl: RL,
  errorCount: number,
  warningCount: number,
): Promise<MenuChoice> {
  console.log(chalk.dim('\u2500'.repeat(60)));
  console.log('');

  const summary: string[] = [];
  if (errorCount > 0) summary.push(chalk.red(`${errorCount} error${errorCount === 1 ? '' : 's'}`));
  if (warningCount > 0) summary.push(chalk.yellow(`${warningCount} warning${warningCount === 1 ? '' : 's'}`));
  console.log(chalk.bold(`Found ${summary.join(' and ')}.`));
  console.log('');
  console.log(chalk.bold('How would you like to proceed?'));

  const options: { label: string; choice: MenuChoice }[] = [];

  if (errorCount > 0 && warningCount > 0) {
    options.push({
      label: `Work on ${errorCount} error${errorCount === 1 ? '' : 's'} only`,
      choice: 'errors',
    });
    options.push({
      label: `Work on ${errorCount} error${errorCount === 1 ? '' : 's'} and ${warningCount} warning${warningCount === 1 ? '' : 's'}`,
      choice: 'all',
    });
  } else if (errorCount > 0) {
    options.push({
      label: `Work on ${errorCount} error${errorCount === 1 ? '' : 's'}`,
      choice: 'errors',
    });
  } else {
    options.push({
      label: `Work on ${warningCount} warning${warningCount === 1 ? '' : 's'}`,
      choice: 'all',
    });
  }

  options.push({ label: 'Stop', choice: 'stop' });

  for (let i = 0; i < options.length; i++) {
    console.log(`  ${chalk.bold(`${i + 1}.`)} ${options[i].label}`);
  }

  let choice: MenuChoice | null = null;
  while (choice === null) {
    const answer = await rl.question('\n> ');
    const num = parseInt(answer.trim(), 10);
    if (!isNaN(num) && num >= 1 && num <= options.length) {
      choice = options[num - 1].choice;
    } else {
      console.log(chalk.yellow(`Enter a number from 1 to ${options.length}.`));
    }
  }
  return choice;
}

// ── Fix proposal generation ────────────────────────────────────────

async function getFixProposals(
  specContents: Map<string, string>,
  findings: Finding[],
  projectRoot: string,
  provider: AIProvider,
  model: string,
): Promise<Proposal[]> {
  const filesList = Array.from(specContents.entries())
    .map(([absPath, content]) => `--- ${path.relative(projectRoot, absPath)} ---\n${content}`)
    .join('\n\n');

  const findingsList = findings.map((f, i) => {
    const sev = f.severity.toUpperCase();
    const loc = [f.location.file, f.location.section].filter(s => s !== undefined).join(' > ');
    let text = `${i}. [${sev}] ${loc}: ${f.description}`;
    if (f.suggestion !== undefined) text += `\n   Suggestion: ${f.suggestion}`;
    return text;
  }).join('\n\n');

  const userMessage = `Here are the specification files:

${filesList}

Issues to fix (${findings.length}):

${findingsList}

For each issue, respond with a JSON array. Each element should be either:
- A fix: {"finding_index": N, "type": "fix", "file": "filename.spc", "description": "...", "old_text": "exact text", "new_text": "replacement"}
- A question: {"finding_index": N, "type": "question", "question": "..."}`;

  const responseText = await runAIPrompt(provider, model, FIX_SYSTEM_PROMPT, userMessage);
  return parseProposals(responseText);
}

async function reviseProposal(
  specContents: Map<string, string>,
  finding: Finding,
  previousProposal: Proposal,
  userResponse: string,
  projectRoot: string,
  provider: AIProvider,
  model: string,
): Promise<Proposal | null> {
  const filesList = Array.from(specContents.entries())
    .map(([absPath, content]) => `--- ${path.relative(projectRoot, absPath)} ---\n${content}`)
    .join('\n\n');

  const sev = finding.severity.toUpperCase();
  const loc = [finding.location.file, finding.location.section].filter(s => s !== undefined).join(' > ');
  const findingText = `[${sev}] ${loc}: ${finding.description}`;

  let contextText: string;
  if (previousProposal.type === 'fix') {
    contextText = `Previous proposed fix in ${previousProposal.file}:
  Replace: ${JSON.stringify(previousProposal.old_text)}
  With: ${JSON.stringify(previousProposal.new_text)}

User's feedback: ${userResponse}`;
  } else {
    contextText = `Your question: ${previousProposal.question}

User's answer: ${userResponse}`;
  }

  const userMessage = `Specification files:

${filesList}

Original issue:
${findingText}

${contextText}

Propose a fix based on this feedback. Respond with a single JSON object:
{"finding_index": 0, "type": "fix", "file": "filename.spc", "description": "...", "old_text": "exact text", "new_text": "replacement"}`;

  const responseText = await runAIPrompt(provider, model, FIX_SYSTEM_PROMPT, userMessage);
  const proposals = parseProposals(responseText);
  return proposals.length > 0 ? proposals[0] : null;
}

// ── Proposal walkthrough ───────────────────────────────────────────

async function walkProposals(
  rl: RL,
  proposals: Proposal[],
  findings: Finding[],
  specFilePaths: string[],
  specContents: Map<string, string>,
  projectRoot: string,
  provider: AIProvider,
  model: string,
): Promise<number> {
  let applied = 0;

  for (let i = 0; i < proposals.length; i++) {
    let proposal: Proposal = proposals[i];
    const findingIdx = Math.min(proposal.finding_index, findings.length - 1);
    const finding = findings[Math.max(0, findingIdx)];

    console.log(chalk.dim(`\n\u2500\u2500 Proposal ${i + 1} of ${proposals.length} ${'\u2500'.repeat(42)}`));
    printFinding(finding);

    // Handle questions: get user's answer and convert to a fix
    if (proposal.type === 'question') {
      console.log('');
      console.log(chalk.cyan(`  Question: ${proposal.question}`));
      const answer = await rl.question(`\n${chalk.bold('Your answer')} (enter to skip): `);
      if (answer.trim() === '') {
        console.log(chalk.dim('  Skipped.'));
        continue;
      }

      console.log(chalk.dim('  Generating fix from your answer...'));
      const revised = await reviseProposal(
        specContents, finding, proposal, answer, projectRoot, provider, model,
      );
      if (revised === null || revised.type !== 'fix') {
        console.log(chalk.yellow('  Could not generate a fix from that answer. Skipping.'));
        continue;
      }
      proposal = revised;
    }

    // Review the fix proposal (guaranteed to be a fix at this point)
    const wasApplied = await reviewFixProposal(
      rl, proposal, finding, specFilePaths, specContents, projectRoot, provider, model,
    );
    if (wasApplied) applied++;
  }

  return applied;
}

async function reviewFixProposal(
  rl: RL,
  initialProposal: FixProposal,
  finding: Finding,
  specFilePaths: string[],
  specContents: Map<string, string>,
  projectRoot: string,
  provider: AIProvider,
  model: string,
): Promise<boolean> {
  let proposal = initialProposal;
  let decided = false;
  let wasApplied = false;

  while (!decided) {
    printFixProposal(proposal);

    const action = await rl.question(
      `\n  ${chalk.bold('[a]')}ccept  ${chalk.bold('[c]')}omment  ${chalk.bold('[s]')}kip\n\n> `,
    );
    const choice = action.trim().toLowerCase();

    if (choice === 'a' || choice === 'accept') {
      const success = applyFix(proposal, specFilePaths, projectRoot);
      if (success) {
        const absPath = resolveFilePath(proposal.file, specFilePaths, projectRoot);
        if (absPath !== null) {
          specContents.set(absPath, fs.readFileSync(absPath, 'utf-8'));
        }
        console.log(chalk.green('  Applied.'));
        wasApplied = true;
      } else {
        console.log(chalk.red('  Could not apply \u2014 exact text not found in file.'));
      }
      decided = true;
    } else if (choice === 's' || choice === 'skip') {
      console.log(chalk.dim('  Skipped.'));
      decided = true;
    } else if (choice === 'c' || choice === 'comment') {
      const comment = await rl.question(`\n${chalk.cyan('Your comment:')} `);
      if (comment.trim() === '') continue;

      console.log(chalk.dim('  Revising proposal...'));
      const revised = await reviseProposal(
        specContents, finding, proposal, comment, projectRoot, provider, model,
      );
      if (revised !== null && revised.type === 'fix') {
        proposal = revised;
      } else {
        console.log(chalk.yellow('  Could not revise. Showing original proposal.'));
      }
    } else {
      console.log(chalk.yellow('  Enter a, c, or s.'));
    }
  }

  return wasApplied;
}

// ── Display helpers ────────────────────────────────────────────────

function printFinding(finding: Finding): void {
  const icon = finding.severity === 'error'
    ? chalk.red.bold('[ERROR]')
    : finding.severity === 'warning'
      ? chalk.yellow.bold('[WARN] ')
      : chalk.blue.bold('[INFO] ');

  let location = '';
  if (finding.location.file !== undefined) location += finding.location.file;
  if (finding.location.section !== undefined) {
    location += location !== '' ? ` > ${finding.location.section}` : finding.location.section;
  }

  console.log(`  ${icon} ${location !== '' ? chalk.dim(location) : ''}`);
  console.log(`  ${finding.description}`);
  if (finding.suggestion !== undefined) {
    console.log(`  ${chalk.dim('Suggestion:')} ${finding.suggestion}`);
  }
}

function printFixProposal(proposal: FixProposal): void {
  console.log('');
  console.log(`  ${chalk.bold('Proposed fix')} ${chalk.dim(`(${proposal.file})`)}`);
  if (proposal.description !== '') {
    console.log(`  ${proposal.description}`);
  }
  console.log('');
  for (const line of proposal.old_text.split('\n')) {
    console.log(chalk.red(`    - ${line}`));
  }
  for (const line of proposal.new_text.split('\n')) {
    console.log(chalk.green(`    + ${line}`));
  }
}

// ── File operations ────────────────────────────────────────────────

function getSpecFilePaths(projectRoot: string, variant: string | undefined): string[] {
  const paths = [...discoverFiles(projectRoot)];

  if (variant !== undefined && variant !== '') {
    let currentDir = projectRoot;
    for (const part of variant.split('.')) {
      currentDir = path.join(currentDir, '_layers_', part);
      if (fs.existsSync(currentDir)) {
        paths.push(...discoverFiles(currentDir));
      }
    }
  }

  return paths;
}

function readSpecFileContents(specFilePaths: string[]): Map<string, string> {
  const contents = new Map<string, string>();
  for (const p of specFilePaths) {
    contents.set(p, fs.readFileSync(p, 'utf-8'));
  }
  return contents;
}

function resolveFilePath(
  filename: string,
  specFilePaths: string[],
  projectRoot: string,
): string | null {
  // Basename match
  for (const p of specFilePaths) {
    if (path.basename(p) === filename) return p;
  }
  // Relative path match
  for (const p of specFilePaths) {
    if (path.relative(projectRoot, p) === filename) return p;
  }
  // Direct path from project root
  const asPath = path.resolve(projectRoot, filename);
  if (fs.existsSync(asPath)) return asPath;
  return null;
}

function applyFix(
  proposal: FixProposal,
  specFilePaths: string[],
  projectRoot: string,
): boolean {
  const absPath = resolveFilePath(proposal.file, specFilePaths, projectRoot);
  if (absPath === null) return false;

  const content = fs.readFileSync(absPath, 'utf-8');
  if (!content.includes(proposal.old_text)) return false;

  const newContent = content.replace(proposal.old_text, proposal.new_text);
  fs.writeFileSync(absPath, newContent);
  return true;
}

// ── JSON parsing ───────────────────────────────────────────────────

function parseProposals(responseText: string): Proposal[] {
  try {
    let jsonText = responseText.trim();

    // Extract from code fences if present
    const codeBlockMatch = jsonText.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (codeBlockMatch?.[1] !== undefined) {
      jsonText = codeBlockMatch[1].trim();
    }

    const arrayStart = jsonText.indexOf('[');
    const objectStart = jsonText.indexOf('{');

    let parsed: unknown;

    if (arrayStart >= 0 && (objectStart < 0 || arrayStart < objectStart)) {
      const arrayEnd = jsonText.lastIndexOf(']');
      if (arrayEnd >= 0) jsonText = jsonText.slice(arrayStart, arrayEnd + 1);
      parsed = JSON.parse(jsonText) as unknown;
    } else if (objectStart >= 0) {
      const objectEnd = jsonText.lastIndexOf('}');
      if (objectEnd >= 0) jsonText = jsonText.slice(objectStart, objectEnd + 1);
      parsed = [JSON.parse(jsonText) as unknown];
    } else {
      return [];
    }

    if (!Array.isArray(parsed)) return [];

    return (parsed as Record<string, unknown>[])
      .map(toProposal)
      .filter((p): p is Proposal => p !== null);
  } catch {
    return [];
  }
}

function toProposal(item: Record<string, unknown>): Proposal | null {
  const findingIndex = typeof item['finding_index'] === 'number' ? item['finding_index'] : 0;

  if (item['type'] === 'question') {
    return {
      finding_index: findingIndex,
      type: 'question',
      question: typeof item['question'] === 'string' ? item['question'] : 'Could you provide more detail?',
    };
  }

  const file = typeof item['file'] === 'string' ? item['file'] : '';
  const oldText = typeof item['old_text'] === 'string' ? item['old_text'] : '';
  if (file === '' || oldText === '') return null;

  return {
    finding_index: findingIndex,
    type: 'fix',
    file,
    description: typeof item['description'] === 'string' ? item['description'] : '',
    old_text: oldText,
    new_text: typeof item['new_text'] === 'string' ? item['new_text'] : '',
  };
}
