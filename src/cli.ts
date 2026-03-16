#!/usr/bin/env node

import * as fs from 'node:fs';
import * as path from 'node:path';

import chalk from 'chalk';
import { Command } from 'commander';

import { runCheck } from './analyzer.js';
import { diffSpecs } from './differ.js';
import { formatAnalysis, formatDiff, formatSpecFile } from './formatter.js';
import { findProjectRoot } from './parser.js';
import { listVariants, resolveBase, resolveVariant } from './resolver.js';
import type { AIProvider, CheckType } from './types.js';

const program = new Command();

program
  .name('spc')
  .description('CLI tool for the Spectacular specification language')
  .version('0.1.0')
  .option('--path <dir>', 'Path to the project root (defaults to current directory)');

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
  provider: string;
  model?: string;
  variant?: string;
}

const VALID_PROVIDERS = ['claude', 'codex', 'gemini'] as const;
const ALL_CHECKS: CheckType[] = ['ambiguity', 'consistency', 'completeness', 'redundancy'];

program
  .command('check [type]')
  .description('Run AI-powered analysis (ambiguity, consistency, completeness, redundancy, or all)')
  .option('--provider <provider>', 'AI provider: claude, codex, gemini', 'claude')
  .option('--model <model>', 'Override the default model')
  .option('--variant <variant>', 'Variant to check (defaults to base)')
  .action(async (type: string | undefined, opts: CheckOpts, cmd: Command) => {
    try {
      const projectRoot = getProjectRoot(cmd);
      const provider = opts.provider;

      if (!VALID_PROVIDERS.includes(provider as AIProvider)) {
        console.error(chalk.red(`Unknown provider: ${provider}. Use claude, codex, or gemini.`));
        process.exit(1);
      }

      const aiProvider = provider as AIProvider;

      const files = opts.variant !== undefined && opts.variant !== ''
        ? resolveVariant(projectRoot, opts.variant)
        : resolveBase(projectRoot);

      if (opts.variant !== undefined && opts.variant !== '') {
        console.log(chalk.dim(`Checking variant: ${opts.variant}`));
      } else {
        console.log(chalk.dim('Checking base spec'));
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

      console.log(chalk.dim(`Running ${checks.length} check(s) with ${aiProvider}...`));
      console.log('');

      const results = [];
      for (const checkType of checks) {
        console.log(chalk.dim(`  Running ${checkType} check...`));
        const result = await runCheck(files, checkType, aiProvider, opts.model);
        results.push(result);
      }

      console.log(formatAnalysis(results));
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(chalk.red(`Error: ${message}`));
      process.exit(1);
    }
  });

// ── helpers ──────────────────────────────────────────────────────────

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
