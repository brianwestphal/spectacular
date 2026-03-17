#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

import chalk from 'chalk';
import { Command } from 'commander';

import type { AbsorbResult, DiffMode } from './absorber.js';
import { getGitDiff, runAbsorb } from './absorber.js';
import { getDefaultModel } from './ai.js';
import { runCheck } from './analyzer.js';
import { diffSpecs } from './differ.js';
import { formatAnalysis, formatDiff, formatSpecFile } from './formatter.js';
import type { GenerateResult } from './generator.js';
import { createSnapshot, formatRecoveryInstructions, parseSourceMappings, runGenerate } from './generator.js';
import { findProjectRoot } from './parser.js';
import { listVariants, resolveBase, resolveVariant } from './resolver.js';
import type { AIProvider, AnalysisResult, CheckType } from './types.js';

const program = new Command();

program
  .name('spc')
  .description('CLI tool for the Spectacular specification language')
  .version('0.1.0')
  .option('--path <dir>', 'Path to the project root (defaults to current directory)');

// ── init ─────────────────────────────────────────────────────────────

program
  .command('init [dir]')
  .description('Initialize a new Spectacular spec directory')
  .action((dir: string | undefined) => {
    const specDir = dir !== undefined && dir !== '' ? path.resolve(dir) : path.resolve('spec');

    if (fs.existsSync(specDir)) {
      const entries = fs.readdirSync(specDir);
      const hasSpec = entries.some(e => e.endsWith('.spc') || e.endsWith('.spectacular'));
      if (hasSpec) {
        console.error(chalk.red(`Spec files already exist in ${specDir}`));
        process.exit(1);
      }
    }

    fs.mkdirSync(specDir, { recursive: true });
    fs.mkdirSync(path.join(specDir, '_layers_'), { recursive: true });

    fs.writeFileSync(path.join(specDir, 'app.spc'), `# App

@rem Replace this with your application's overview.

A brief description of the application, its purpose, and core capabilities.

## Authentication

@rem Describe authentication requirements.

## Data Model

@rem Describe the core data model and relationships.
`);

    fs.writeFileSync(path.join(specDir, 'security.spc'), `# Security

@rem Cross-cutting security concerns that apply across all features.

All API communication **must** use TLS 1.3 or higher.
`);

    console.log(chalk.green(`Initialized Spectacular spec at ${specDir}/`));
    console.log(chalk.dim('  Created app.spc'));
    console.log(chalk.dim('  Created security.spc'));
    console.log(chalk.dim('  Created _layers_/'));
    console.log('');
    console.log(chalk.dim('Add variant layers by creating directories under _layers_/'));
    console.log(chalk.dim('  e.g., _layers_/ios/, _layers_/android/, _layers_/web/'));
  });

// ── resolve ──────────────────────────────────────────────────────────

program
  .command('resolve [variant]')
  .description('Resolve and print the merged spec for a variant (e.g., "ios" or "mobile.ios")')
  .action((variant: string | undefined, _opts: unknown, cmd: Command) => {
    try {
      const projectRoot = getProjectRoot(cmd);

      const files = variant !== undefined && variant !== ''
        ? resolveVariant(projectRoot, variant)
        : resolveBase(projectRoot);

      if (variant !== undefined && variant !== '') {
        console.log(chalk.bold(`\nResolved spec for variant: ${chalk.cyan(variant)}`));
      } else {
        console.log(chalk.bold('\nBase spec (no variant):'));
      }

      console.log('');

      for (const file of files) {
        console.log(formatSpecFile(file));
        console.log('');
      }

      const variants = listVariants(projectRoot);
      if (variants.length > 0) {
        console.log(chalk.dim(`Available variants: ${variants.join(', ')}`));
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(chalk.red(`Error: ${message}`));
      process.exit(1);
    }
  });

// ── diff ─────────────────────────────────────────────────────────────

program
  .command('diff <variant-a> <variant-b>')
  .description('Show differences between two resolved variants')
  .action((variantA: string, variantB: string, _opts: unknown, cmd: Command) => {
    try {
      const projectRoot = getProjectRoot(cmd);

      const filesA = variantA === 'base'
        ? resolveBase(projectRoot)
        : resolveVariant(projectRoot, variantA);

      const filesB = variantB === 'base'
        ? resolveBase(projectRoot)
        : resolveVariant(projectRoot, variantB);

      const diffs = diffSpecs(filesA, filesB);
      console.log(formatDiff(diffs, variantA, variantB));
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(chalk.red(`Error: ${message}`));
      process.exit(1);
    }
  });

// ── check ────────────────────────────────────────────────────────────

interface CheckOpts {
  provider?: string;
  model?: string;
  variant?: string;
  json: boolean;
}

const VALID_PROVIDERS: AIProvider[] = ['claude', 'claude-cli', 'codex', 'codex-cli', 'gemini', 'gemini-cli'];
const ALL_CHECKS: CheckType[] = ['ambiguity', 'consistency', 'completeness', 'redundancy'];

interface DetectedProvider {
  provider: AIProvider;
  reason: string;
}

function cliExists(command: string): boolean {
  try {
    execFileSync(command, ['--version'], { stdio: 'pipe', timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

function detectProvider(): DetectedProvider | null {
  // 1. API keys — check in preference order
  const apiKey = process.env['ANTHROPIC_API_KEY'];
  if (apiKey !== undefined && apiKey !== '') {
    return { provider: 'claude', reason: 'found ANTHROPIC_API_KEY' };
  }

  const openaiKey = process.env['OPENAI_API_KEY'];
  if (openaiKey !== undefined && openaiKey !== '') {
    return { provider: 'codex', reason: 'found OPENAI_API_KEY' };
  }

  const geminiKey = process.env['GEMINI_API_KEY'];
  if (geminiKey !== undefined && geminiKey !== '') {
    return { provider: 'gemini', reason: 'found GEMINI_API_KEY' };
  }

  // 2. CLI tools — check in preference order
  if (cliExists('claude')) {
    return { provider: 'claude-cli', reason: 'found claude CLI' };
  }

  if (cliExists('codex')) {
    return { provider: 'codex-cli', reason: 'found codex CLI' };
  }

  if (cliExists('gemini')) {
    return { provider: 'gemini-cli', reason: 'found gemini CLI' };
  }

  return null;
}

function printProviderHelp(): void {
  console.error(chalk.red('No AI provider found.\n'));
  console.error(chalk.bold('Set up one of the following:\n'));
  console.error(`  ${chalk.cyan('API keys:')}`);
  console.error(`    Set ${chalk.bold('ANTHROPIC_API_KEY')} for Claude API`);
  console.error(`    Set ${chalk.bold('OPENAI_API_KEY')} for OpenAI API`);
  console.error(`    Set ${chalk.bold('GEMINI_API_KEY')} for Google Gemini API`);
  console.error('');
  console.error(`  ${chalk.cyan('CLI tools:')}`);
  console.error(`    Install ${chalk.bold('Claude Code')}  — https://claude.com/claude-code`);
  console.error(`    Install ${chalk.bold('Codex CLI')}    — npm install -g @openai/codex`);
  console.error(`    Install ${chalk.bold('Gemini CLI')}   — npm install -g @google/gemini-cli`);
  console.error('');
  console.error(chalk.dim('Or specify explicitly: spc check --provider <name>'));
  console.error(chalk.dim(`  Providers: ${VALID_PROVIDERS.join(', ')}`));
}

program
  .command('check [type]')
  .description('Run AI-powered analysis (ambiguity, consistency, completeness, redundancy, or all)')
  .option('--provider <provider>', 'AI provider (auto-detected if omitted): claude, claude-cli, codex, codex-cli, gemini, gemini-cli')
  .option('--model <model>', 'Override the default model')
  .option('--variant <variant>', 'Variant to check (defaults to base)')
  .option('--json', 'Output results as JSON (for programmatic use)', false)
  .action(async (type: string | undefined, opts: CheckOpts, cmd: Command) => {
    try {
      const projectRoot = getProjectRoot(cmd);
      const aiProvider = resolveProvider(opts.provider, opts.json);

      const files = opts.variant !== undefined && opts.variant !== ''
        ? resolveVariant(projectRoot, opts.variant)
        : resolveBase(projectRoot);

      if (!opts.json) {
        if (opts.variant !== undefined && opts.variant !== '') {
          console.log(chalk.dim(`Checking variant: ${opts.variant}`));
        } else {
          console.log(chalk.dim('Checking base spec'));
        }
      }

      let checks: CheckType[];

      if (type !== undefined && type !== '') {
        if (!ALL_CHECKS.includes(type as CheckType)) {
          console.error(chalk.red(`Unknown check type: ${type}. Use: ${ALL_CHECKS.join(', ')}`));
          process.exit(1);
        }
        checks = [type as CheckType];
      } else {
        checks = ALL_CHECKS;
      }

      if (!opts.json) {
        console.log(chalk.dim(`Running ${checks.length} check(s)...`));
        console.log('');
      }

      const results: AnalysisResult[] = [];
      for (const checkType of checks) {
        if (!opts.json) {
          console.log(chalk.dim(`  Running ${checkType} check...`));
        }
        const result = await runCheck(files, checkType, aiProvider, opts.model);
        results.push(result);
      }

      if (opts.json) {
        console.log(JSON.stringify(results, null, 2));
      } else {
        console.log(formatAnalysis(results));
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      if (opts.json) {
        console.log(JSON.stringify({ error: message }));
      } else {
        console.error(chalk.red(`Error: ${message}`));
      }
      process.exit(1);
    }
  });

// ── absorb ───────────────────────────────────────────────────────────

interface AbsorbOpts {
  source: string[];
  provider?: string;
  model?: string;
  uncommitted: boolean;
  staged: boolean;
  unstaged: boolean;
  commit?: string;
  range?: string;
  branch?: string;
  files?: string;
  json: boolean;
}

program
  .command('absorb <variant>')
  .description('Absorb code changes into spec updates (e.g., "spc absorb ios --source ios=./ios-app")')
  .option('--source <mappings...>', 'Source directories: variant=path (e.g., ios=./ios-app)')
  .option('--provider <provider>', 'AI provider (auto-detected if omitted)')
  .option('--model <model>', 'Override the default model')
  .option('--uncommitted', 'Staged + unstaged + untracked changes (default)', false)
  .option('--staged', 'Only staged changes', false)
  .option('--unstaged', 'Only unstaged changes', false)
  .option('--commit <sha>', 'Changes from a specific commit')
  .option('--range <from..to>', 'Changes between two refs')
  .option('--branch <name>', 'Current branch vs the named branch')
  .option('--files <patterns>', 'Specific files (comma-separated globs)')
  .option('--json', 'Output results as JSON', false)
  .action(async (variant: string, opts: AbsorbOpts, cmd: Command) => {
    try {
      const projectRoot = getProjectRoot(cmd);
      const aiProvider = resolveProvider(opts.provider, opts.json);
      const model = opts.model ?? getDefaultModel(aiProvider);

      // Resolve source directory
      const sourceDir = getSourceDir(variant, opts.source);

      // Determine diff mode
      const diffMode = parseDiffMode(opts);

      if (!opts.json) {
        console.log(chalk.dim(`Getting ${diffMode.type} changes from ${sourceDir}...`));
      }
      const diff = getGitDiff(diffMode, sourceDir);

      if (diff === '') {
        if (opts.json) {
          console.log(JSON.stringify({ error: 'No changes found.' }));
        } else {
          console.error(chalk.yellow('No changes found. Make code changes first, then run absorb.'));
        }
        process.exit(1);
      }

      if (!opts.json) {
        const lineCount = diff.split('\n').length;
        console.log(chalk.dim(`Found ${lineCount} lines of diff`));
      }

      const files = resolveVariant(projectRoot, variant);

      if (!opts.json) {
        console.log(chalk.dim(`Analyzing changes against ${chalk.bold(variant)} spec...`));
        console.log('');
      }

      const result = await runAbsorb(files, diff, variant, aiProvider, model);

      if (opts.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        formatAbsorbResult(result, variant);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      if (opts.json) {
        console.log(JSON.stringify({ error: message }));
      } else {
        console.error(chalk.red(`Error: ${message}`));
      }
      process.exit(1);
    }
  });

function getSourceDir(variant: string, sources: string[] | undefined): string {
  if (sources === undefined || sources.length === 0) {
    return process.cwd();
  }
  const mappings = parseSourceMappings(sources);
  const dir = mappings.get(variant);
  if (dir === undefined) {
    throw new Error(`No source directory specified for variant "${variant}". Add: --source ${variant}=./path`);
  }
  return dir;
}

function parseDiffMode(opts: AbsorbOpts): DiffMode {
  if (opts.commit !== undefined && opts.commit !== '') {
    return { type: 'commit', sha: opts.commit };
  }
  if (opts.range !== undefined && opts.range !== '') {
    return { type: 'range', range: opts.range };
  }
  if (opts.branch !== undefined && opts.branch !== '') {
    return { type: 'branch', branch: opts.branch };
  }
  if (opts.files !== undefined && opts.files !== '') {
    return { type: 'files', patterns: opts.files.split(',').map(p => p.trim()) };
  }
  if (opts.staged) {
    return { type: 'staged' };
  }
  if (opts.unstaged) {
    return { type: 'unstaged' };
  }
  return { type: 'uncommitted' };
}

function formatAbsorbResult(result: AbsorbResult, variant: string): void {
  console.log(chalk.bold('\nSpec Update Proposal'));
  console.log(chalk.dim(`  Variant: ${variant} | Provider: ${result.provider} | Model: ${result.model}`));
  console.log(chalk.dim('\u2500'.repeat(60)));
  console.log('');
  console.log(chalk.bold('Summary:'));
  console.log(`  ${result.summary}`);
  console.log('');

  if (result.changes.length === 0) {
    console.log(chalk.green('  No spec changes needed — the current spec already covers this.'));
    return;
  }

  console.log(chalk.bold(`Proposed changes (${result.changes.length}):\n`));

  for (let i = 0; i < result.changes.length; i++) {
    const change = result.changes[i];
    const layerLabel = change.layer === 'base' ? 'base' : `_layers_/${change.layer}/`;
    const actionColor = change.action === 'add' ? chalk.green : change.action === 'remove' ? chalk.red : chalk.yellow;
    const actionLabel = change.action === 'add' ? 'ADD' : change.action === 'remove' ? 'REMOVE' : 'MODIFY';

    console.log(`  ${chalk.bold(`${i + 1}.`)} ${actionColor(`[${actionLabel}]`)} ${chalk.cyan(layerLabel)}${chalk.bold(change.file)} > ${change.section}`);

    if (change.current !== undefined && change.current !== '') {
      console.log(chalk.dim('     Current:'));
      for (const line of change.current.split('\n')) {
        console.log(chalk.red(`       - ${line}`));
      }
    }

    console.log(chalk.dim('     Proposed:'));
    for (const line of change.proposed.split('\n')) {
      console.log(chalk.green(`       + ${line}`));
    }

    console.log(chalk.dim(`     Reason: ${change.reason}`));
    console.log('');
  }

  console.log(chalk.dim('Review these changes, edit your .spc files accordingly, then run:'));
  console.log(chalk.dim(`  spc check --variant ${variant}`));
}

// ── generate ─────────────────────────────────────────────────────────

interface GenerateOpts {
  source: string[];
  targets?: string;
  excludeTarget?: string;
  provider?: string;
  model?: string;
  json: boolean;
}

program
  .command('generate <variant>')
  .description('Generate/update code from the spec (use "all" for all variants)')
  .option('--source <mappings...>', 'Source directories: variant=path (e.g., ios=./ios-app)')
  .option('--targets <variants>', 'Comma-separated list of variants (with "all")')
  .option('--exclude-target <variants>', 'Comma-separated variants to skip (with "all")')
  .option('--provider <provider>', 'AI provider (auto-detected if omitted)')
  .option('--model <model>', 'Override the default model')
  .option('--json', 'Output results as JSON', false)
  .action(async (variant: string, opts: GenerateOpts, cmd: Command) => {
    try {
      const projectRoot = getProjectRoot(cmd);
      const aiProvider = resolveProvider(opts.provider, opts.json);
      const model = opts.model ?? getDefaultModel(aiProvider);

      // Parse source mappings
      if (opts.source.length === 0) {
        console.error(chalk.red('No source directories specified.'));
        console.error(chalk.dim('Usage: spc generate ios --source ios=./ios-app'));
        console.error(chalk.dim('       spc generate all --source ios=./ios-app --source android=./android-app'));
        process.exit(1);
      }
      const sourceMappings = parseSourceMappings(opts.source);

      // Determine target variants
      const allVariants = listVariants(projectRoot);
      let targetVariants: string[];

      if (variant === 'all') {
        if (opts.targets !== undefined && opts.targets !== '') {
          targetVariants = opts.targets.split(',').map(t => t.trim());
        } else {
          targetVariants = allVariants;
        }
        if (opts.excludeTarget !== undefined && opts.excludeTarget !== '') {
          const excluded = new Set(opts.excludeTarget.split(',').map(t => t.trim()));
          targetVariants = targetVariants.filter(v => !excluded.has(v));
        }
      } else {
        targetVariants = [variant];
      }

      // Validate all targets have source mappings
      const missingSource = targetVariants.filter(v => !sourceMappings.has(v));
      if (missingSource.length > 0) {
        console.error(chalk.red(`Missing source directories for: ${missingSource.join(', ')}`));
        console.error(chalk.dim(`Add: ${missingSource.map(v => `--source ${v}=./path`).join(' ')}`));
        process.exit(1);
      }

      // Create snapshot before making changes
      const cwd = process.cwd();
      if (!opts.json) {
        console.log(chalk.dim('Creating snapshot...'));
      }
      const snapshot = createSnapshot(cwd);
      if (!opts.json) {
        console.log(chalk.green(`Snapshot created: ${chalk.bold(snapshot.tag)}`));
        if (snapshot.hadUncommitted) {
          console.log(chalk.dim(`  Patch saved: ${snapshot.patchFile ?? '(none)'}`));
        }
        console.log('');
      }

      // Generate for each variant sequentially
      const results: GenerateResult[] = [];
      for (const target of targetVariants) {
        const sourceDir = sourceMappings.get(target);
        if (sourceDir === undefined) continue;

        if (!opts.json) {
          console.log(chalk.bold(`Generating ${chalk.cyan(target)}...`));
          console.log(chalk.dim(`  Source: ${sourceDir}`));
        }

        const files = resolveVariant(projectRoot, target);
        const result = await runGenerate(files, target, sourceDir, aiProvider, model);
        results.push(result);

        if (!opts.json) {
          console.log(chalk.dim(`  ${result.summary}`));
          if (result.filesWritten.length > 0) {
            console.log(chalk.dim(`  Files: ${result.filesWritten.join(', ')}`));
          }
          if (result.notes !== '') {
            console.log(chalk.yellow(`  Note: ${result.notes}`));
          }
          console.log('');
        }
      }

      if (opts.json) {
        console.log(JSON.stringify({ snapshot, results }, null, 2));
      } else {
        console.log(chalk.dim('\u2500'.repeat(60)));
        console.log('');
        console.log(chalk.bold('Recovery:'));
        console.log(chalk.dim(formatRecoveryInstructions(snapshot).split('\n').map(l => `  ${l}`).join('\n')));
        console.log('');
        console.log(chalk.bold('Next steps:'));
        console.log(chalk.dim('  1. Review the generated changes'));
        console.log(chalk.dim('  2. Run your tests'));
        console.log(chalk.dim('  3. If something went wrong, recover using the instructions above'));
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      if (opts.json) {
        console.log(JSON.stringify({ error: message }));
      } else {
        console.error(chalk.red(`Error: ${message}`));
      }
      process.exit(1);
    }
  });

// ── helpers ──────────────────────────────────────────────────────────

function resolveProvider(providerOpt: string | undefined, json: boolean): AIProvider {
  if (providerOpt !== undefined && providerOpt !== '') {
    if (!VALID_PROVIDERS.includes(providerOpt as AIProvider)) {
      console.error(chalk.red(`Unknown provider: ${providerOpt}. Use: ${VALID_PROVIDERS.join(', ')}`));
      process.exit(1);
    }
    return providerOpt as AIProvider;
  }

  const detected = detectProvider();
  if (detected === null) {
    if (json) {
      console.log(JSON.stringify({ error: 'No AI provider found.' }));
    } else {
      printProviderHelp();
    }
    process.exit(1);
  }

  if (!json) {
    console.log(chalk.dim(`Using ${chalk.bold(detected.provider)} (${detected.reason})`));
  }

  return detected.provider;
}

function getProjectRoot(cmd: Command): string {
  let root = cmd;
  while (root.parent !== null) {
    root = root.parent;
  }
  const pathOpt = root.opts<{ path?: string }>().path;

  const startPath = pathOpt !== undefined && pathOpt !== '' ? path.resolve(pathOpt) : process.cwd();

  if (fs.existsSync(startPath) && fs.statSync(startPath).isDirectory()) {
    const entries = fs.readdirSync(startPath);
    const hasSpecFiles = entries.some(e => e.endsWith('.spc') || e.endsWith('.spectacular'));
    const hasLayers = entries.includes('_layers_');
    if (hasSpecFiles || hasLayers) {
      return startPath;
    }
  }

  const projectRoot = findProjectRoot(startPath);
  if (projectRoot === null) {
    throw new Error(
      `No Spectacular project found at or above "${startPath}". ` +
      'A project needs .spc/.spectacular files or a _layers_/ directory.'
    );
  }
  return projectRoot;
}

// ── run ──────────────────────────────────────────────────────────────

program.parse();
