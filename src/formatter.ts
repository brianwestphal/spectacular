import * as path from 'node:path';

import chalk from 'chalk';

import type { AnalysisResult, ContentNode, DiffResult, Finding, Section, SpecFile } from './types.js';

/**
 * Format a resolved SpecFile for terminal display.
 */
export function formatSpecFile(file: SpecFile): string {
  const lines: string[] = [];

  lines.push(chalk.dim('\u2500'.repeat(60)));
  lines.push(chalk.bold.cyan(`  ${path.basename(file.path)}`));
  lines.push(chalk.dim('\u2500'.repeat(60)));
  lines.push('');

  for (const d of file.directives) {
    lines.push(formatDirective(d));
  }
  if (file.directives.length > 0) lines.push('');

  for (const section of file.sections) {
    lines.push(...formatSection(section));
  }

  return lines.join('\n');
}

function formatSection(section: Section): string[] {
  const lines: string[] = [];

  const hashes = '#'.repeat(section.level);
  lines.push(chalk.bold(`${hashes} ${section.title}`));

  if (section.label !== undefined) {
    lines.push(chalk.magenta(`@label(${section.label})`));
  }

  lines.push('');

  for (const node of section.content) {
    lines.push(...formatContentNode(node));
  }

  for (const child of section.children) {
    lines.push(...formatSection(child));
  }

  return lines;
}

function formatContentNode(node: ContentNode): string[] {
  const lines: string[] = [];

  switch (node.type) {
    case 'statement':
      lines.push(node.text);
      lines.push('');
      break;

    case 'list':
      for (let i = 0; i < node.items.length; i++) {
        const bullet = node.ordered ? `${i + 1}.` : '-';
        lines.push(`${bullet} ${node.items[i]}`);
      }
      lines.push('');
      break;

    case 'code':
      lines.push(chalk.dim('```' + (node.language ?? '')));
      for (const codeLine of node.code.split('\n')) {
        lines.push(chalk.green(codeLine));
      }
      lines.push(chalk.dim('```'));
      lines.push('');
      break;

    case 'see':
      lines.push(chalk.blue(`@see(${node.reference})`));
      lines.push('');
      break;

    case 'ref':
      lines.push(chalk.blue(`@ref(${node.url})`));
      lines.push('');
      break;

    case 'label':
      lines.push(chalk.magenta(`@label(${node.id})`));
      lines.push('');
      break;

    case 'remove':
      lines.push(chalk.red(`@remove ${'#'.repeat(node.level)} ${node.heading}`));
      lines.push('');
      break;
  }

  return lines;
}

interface DirectiveLike {
  type: string;
  reference?: string;
  url?: string;
  id?: string;
  level?: number;
  heading?: string;
}

function formatDirective(d: DirectiveLike): string {
  switch (d.type) {
    case 'see':
      return chalk.blue(`@see(${d.reference ?? ''})`);
    case 'ref':
      return chalk.blue(`@ref(${d.url ?? ''})`);
    case 'label':
      return chalk.magenta(`@label(${d.id ?? ''})`);
    case 'remove':
      return chalk.red(`@remove ${'#'.repeat(d.level ?? 1)} ${d.heading ?? ''}`);
    default:
      return '';
  }
}

/**
 * Format diff results for terminal display.
 */
export function formatDiff(diffs: DiffResult[], variantA: string, variantB: string): string {
  const lines: string[] = [];

  lines.push(chalk.bold(`\nDiff: ${chalk.red(variantA)} vs ${chalk.green(variantB)}`));
  lines.push(chalk.dim('\u2550'.repeat(60)));

  if (diffs.length === 0) {
    lines.push(chalk.dim('  No differences found.'));
    return lines.join('\n');
  }

  for (const diff of diffs) {
    lines.push('');
    lines.push(chalk.bold.cyan(`  ${diff.file}`));
    lines.push(chalk.dim('\u2500'.repeat(60)));

    for (const sd of diff.sections) {
      const hashes = '#'.repeat(sd.level);

      switch (sd.status) {
        case 'added':
          lines.push(chalk.green(`  + ${hashes} ${sd.heading}`));
          if (sd.contentB !== undefined) {
            for (const line of sd.contentB.split('\n')) {
              lines.push(chalk.green(`  + ${line}`));
            }
          }
          break;

        case 'removed':
          lines.push(chalk.red(`  - ${hashes} ${sd.heading}`));
          if (sd.contentA !== undefined) {
            for (const line of sd.contentA.split('\n')) {
              lines.push(chalk.red(`  - ${line}`));
            }
          }
          break;

        case 'changed':
          lines.push(chalk.yellow(`  ~ ${hashes} ${sd.heading}`));
          if (sd.contentA !== undefined) {
            for (const line of sd.contentA.split('\n')) {
              lines.push(chalk.red(`  - ${line}`));
            }
          }
          if (sd.contentB !== undefined) {
            for (const line of sd.contentB.split('\n')) {
              lines.push(chalk.green(`  + ${line}`));
            }
          }
          break;

        case 'unchanged':
          break;
      }
    }
  }

  lines.push('');
  return lines.join('\n');
}

/**
 * Format analysis results for terminal display.
 */
export function formatAnalysis(results: AnalysisResult[]): string {
  const lines: string[] = [];

  for (const result of results) {
    lines.push('');
    lines.push(chalk.bold(`Analysis: ${result.checkType}`));
    lines.push(chalk.dim(`  Provider: ${result.provider} | Model: ${result.model}`));
    lines.push(chalk.dim('\u2500'.repeat(60)));

    if (result.findings.length === 0) {
      lines.push(chalk.green('  No issues found.'));
      continue;
    }

    for (const finding of result.findings) {
      lines.push(formatFinding(finding));
    }

    const errors = result.findings.filter(f => f.severity === 'error').length;
    const warnings = result.findings.filter(f => f.severity === 'warning').length;
    const infos = result.findings.filter(f => f.severity === 'info').length;

    lines.push('');
    lines.push(
      chalk.dim('  Summary: ') +
      (errors > 0 ? chalk.red(`${errors} errors `) : '') +
      (warnings > 0 ? chalk.yellow(`${warnings} warnings `) : '') +
      (infos > 0 ? chalk.blue(`${infos} info`) : '')
    );
  }

  lines.push('');
  return lines.join('\n');
}

function formatFinding(finding: Finding): string {
  const lines: string[] = [];

  const severityIcon = {
    error: chalk.red.bold('[ERROR]'),
    warning: chalk.yellow.bold('[WARN] '),
    info: chalk.blue.bold('[INFO] '),
  }[finding.severity];

  let location = '';
  if (finding.location.file !== undefined) {
    location += finding.location.file;
  }
  if (finding.location.section !== undefined) {
    location += location !== '' ? ` > ${finding.location.section}` : finding.location.section;
  }

  lines.push(`  ${severityIcon} ${location !== '' ? chalk.dim(location) : ''}`);
  lines.push(`           ${finding.description}`);

  if (finding.suggestion !== undefined) {
    lines.push(`           ${chalk.dim('Suggestion:')} ${finding.suggestion}`);
  }

  return lines.join('\n');
}

/**
 * Serialize a resolved SpecFile back to Spectacular text (for sending to AI).
 */
export function serializeSpecFile(file: SpecFile): string {
  const lines: string[] = [];

  for (const d of file.directives) {
    lines.push(serializeDirective(d));
  }
  if (file.directives.length > 0) lines.push('');

  for (const section of file.sections) {
    lines.push(...serializeSection(section));
  }

  return lines.join('\n');
}

function serializeSection(section: Section): string[] {
  const lines: string[] = [];

  if (section.label !== undefined) {
    lines.push(`@label(${section.label})`);
  }

  const hashes = '#'.repeat(section.level);
  lines.push(`${hashes} ${section.title}`);
  lines.push('');

  for (const node of section.content) {
    lines.push(...serializeContentNode(node));
  }

  for (const child of section.children) {
    lines.push(...serializeSection(child));
  }

  return lines;
}

function serializeContentNode(node: ContentNode): string[] {
  const lines: string[] = [];

  switch (node.type) {
    case 'statement':
      lines.push(node.text);
      lines.push('');
      break;
    case 'list':
      for (let i = 0; i < node.items.length; i++) {
        const bullet = node.ordered ? `${i + 1}.` : '-';
        lines.push(`${bullet} ${node.items[i]}`);
      }
      lines.push('');
      break;
    case 'code':
      lines.push('```' + (node.language ?? ''));
      lines.push(node.code);
      lines.push('```');
      lines.push('');
      break;
    case 'see':
      lines.push(`@see(${node.reference})`);
      break;
    case 'ref':
      lines.push(`@ref(${node.url})`);
      break;
    case 'label':
      lines.push(`@label(${node.id})`);
      break;
    case 'remove':
      lines.push(`@remove ${'#'.repeat(node.level)} ${node.heading}`);
      break;
  }

  return lines;
}

function serializeDirective(d: DirectiveLike): string {
  switch (d.type) {
    case 'see':
      return `@see(${d.reference ?? ''})`;
    case 'ref':
      return `@ref(${d.url ?? ''})`;
    case 'label':
      return `@label(${d.id ?? ''})`;
    case 'remove':
      return `@remove ${'#'.repeat(d.level ?? 1)} ${d.heading ?? ''}`;
    default:
      return '';
  }
}
