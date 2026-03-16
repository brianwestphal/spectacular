import * as path from 'node:path';

import type { DiffResult, Section, SectionDiff, SpecFile } from './types.js';

/**
 * Compute diff between two sets of resolved spec files.
 */
export function diffSpecs(filesA: SpecFile[], filesB: SpecFile[]): DiffResult[] {
  const results: DiffResult[] = [];

  const mapA = new Map<string, SpecFile>();
  const mapB = new Map<string, SpecFile>();
  for (const f of filesA) mapA.set(path.basename(f.path), f);
  for (const f of filesB) mapB.set(path.basename(f.path), f);

  const allNames = new Set([...mapA.keys(), ...mapB.keys()]);

  for (const name of [...allNames].sort()) {
    const fileA = mapA.get(name);
    const fileB = mapB.get(name);

    if (fileA !== undefined && fileB !== undefined) {
      const sectionDiffs = diffSectionLists(
        flattenSections(fileA.sections),
        flattenSections(fileB.sections)
      );

      const hasDiff = sectionDiffs.some(sd => sd.status !== 'unchanged');
      if (hasDiff) {
        results.push({ file: name, sections: sectionDiffs.filter(sd => sd.status !== 'unchanged') });
      }
    } else if (fileA !== undefined) {
      const sections = flattenSections(fileA.sections).map(s => ({
        heading: s.title,
        level: s.level,
        status: 'removed' as const,
        contentA: sectionContentToString(s),
      }));
      results.push({ file: name, sections });
    } else if (fileB !== undefined) {
      const sections = flattenSections(fileB.sections).map(s => ({
        heading: s.title,
        level: s.level,
        status: 'added' as const,
        contentB: sectionContentToString(s),
      }));
      results.push({ file: name, sections });
    }
  }

  return results;
}

function flattenSections(sections: Section[]): Section[] {
  const result: Section[] = [];
  for (const s of sections) {
    result.push(s);
    result.push(...flattenSections(s.children));
  }
  return result;
}

function diffSectionLists(sectionsA: Section[], sectionsB: Section[]): SectionDiff[] {
  const result: SectionDiff[] = [];
  const usedB = new Set<number>();

  for (const sA of sectionsA) {
    const idxB = sectionsB.findIndex((sB, i) => !usedB.has(i) && sB.title === sA.title && sB.level === sA.level);

    if (idxB >= 0) {
      usedB.add(idxB);
      const sB = sectionsB[idxB];

      const contentA = sectionContentToString(sA);
      const contentB = sectionContentToString(sB);

      if (contentA === contentB) {
        result.push({
          heading: sA.title,
          level: sA.level,
          status: 'unchanged',
        });
      } else {
        result.push({
          heading: sA.title,
          level: sA.level,
          status: 'changed',
          contentA,
          contentB,
        });
      }
    } else {
      result.push({
        heading: sA.title,
        level: sA.level,
        status: 'removed',
        contentA: sectionContentToString(sA),
      });
    }
  }

  for (let i = 0; i < sectionsB.length; i++) {
    if (usedB.has(i)) continue;
    const sB = sectionsB[i];
    result.push({
      heading: sB.title,
      level: sB.level,
      status: 'added',
      contentB: sectionContentToString(sB),
    });
  }

  return result;
}

function sectionContentToString(section: Section): string {
  const parts: string[] = [];

  if (section.label !== undefined) {
    parts.push(`@label(${section.label})`);
  }

  for (const node of section.content) {
    switch (node.type) {
      case 'statement':
        parts.push(node.text);
        break;
      case 'list':
        for (let i = 0; i < node.items.length; i++) {
          const bullet = node.ordered ? `${i + 1}.` : '-';
          parts.push(`${bullet} ${node.items[i]}`);
        }
        break;
      case 'code':
        parts.push('```' + (node.language ?? ''));
        parts.push(node.code);
        parts.push('```');
        break;
      case 'see':
        parts.push(`@see(${node.reference})`);
        break;
      case 'ref':
        parts.push(`@ref(${node.url})`);
        break;
      case 'label':
        parts.push(`@label(${node.id})`);
        break;
      case 'remove':
        parts.push(`@remove ${'#'.repeat(node.level)} ${node.heading}`);
        break;
    }
  }

  return parts.join('\n');
}
