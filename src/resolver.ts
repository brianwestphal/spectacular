import * as fs from 'node:fs';
import * as path from 'node:path';

import { buildLayerTree, discoverFiles, parseFile } from './parser.js';
import type { LayerTree, Section, SpecFile } from './types.js';

/**
 * Resolve a variant path (e.g., "ios" or "mobile.ios") against a project root.
 * Returns an array of resolved SpecFiles — one per unique filename across all layers.
 */
export function resolveVariant(projectRoot: string, variantPath: string): SpecFile[] {
  const variants = variantPath.split('.');

  const dirs: string[] = [projectRoot];
  let currentDir = projectRoot;

  for (const variant of variants) {
    const layerDir = path.join(currentDir, '_layers_', variant);
    if (!fs.existsSync(layerDir)) {
      throw new Error(`Layer not found: ${layerDir} (variant "${variant}" in path "${variantPath}")`);
    }
    dirs.push(layerDir);
    currentDir = layerDir;
  }

  const layerFiles = new Map<string, SpecFile[]>();

  for (const dir of dirs) {
    const filePaths = discoverFiles(dir);
    for (const fp of filePaths) {
      const basename = path.basename(fp);
      const parsed = parseFile(fp);
      const existing = layerFiles.get(basename);
      if (existing !== undefined) {
        existing.push(parsed);
      } else {
        layerFiles.set(basename, [parsed]);
      }
    }
  }

  const resolved: SpecFile[] = [];
  for (const [, files] of layerFiles) {
    if (files.length === 1) {
      resolved.push(files[0]);
    } else {
      let merged = files[0];
      for (let i = 1; i < files.length; i++) {
        merged = mergeSpecFiles(merged, files[i]);
      }
      merged.path = files[0].path;
      resolved.push(merged);
    }
  }

  return resolved.sort((a, b) => path.basename(a.path).localeCompare(path.basename(b.path)));
}

/**
 * Resolve the base variant (no layers) for a project root.
 */
export function resolveBase(projectRoot: string): SpecFile[] {
  const filePaths = discoverFiles(projectRoot);
  return filePaths.map(fp => parseFile(fp)).sort((a, b) =>
    path.basename(a.path).localeCompare(path.basename(b.path))
  );
}

/**
 * Merge two SpecFiles: base + layer.
 * The layer extends/overrides/removes content from the base.
 */
function mergeSpecFiles(base: SpecFile, layer: SpecFile): SpecFile {
  const removals = collectRemovals(layer);
  const mergedSections = mergeSectionLists(base.sections, layer.sections, removals);
  const mergedDirectives = [...base.directives, ...layer.directives];

  return {
    path: base.path,
    sections: mergedSections,
    directives: mergedDirectives,
  };
}

/**
 * Collect all \@remove directives from a SpecFile.
 */
function collectRemovals(file: SpecFile): Set<string> {
  const removals = new Set<string>();

  function collectFromSections(sections: Section[]): void {
    for (const section of sections) {
      for (const node of section.content) {
        if (node.type === 'remove') {
          removals.add(removalKey(node.level, node.heading));
        }
      }
      collectFromSections(section.children);
    }
  }

  for (const d of file.directives) {
    if (d.type === 'remove') {
      removals.add(removalKey(d.level, d.heading));
    }
  }

  collectFromSections(file.sections);
  return removals;
}

function removalKey(level: number, heading: string): string {
  return `${level}:${heading}`;
}

function mergeSectionLists(
  baseSections: Section[],
  layerSections: Section[],
  removals: Set<string>
): Section[] {
  const result: Section[] = [];
  const usedLayerIndices = new Set<number>();

  for (const baseSection of baseSections) {
    const key = removalKey(baseSection.level, baseSection.title);

    if (removals.has(key)) {
      continue;
    }

    const layerIdx = layerSections.findIndex(
      (ls, idx) => !usedLayerIndices.has(idx) &&
        ls.level === baseSection.level &&
        ls.title === baseSection.title
    );

    if (layerIdx >= 0) {
      usedLayerIndices.add(layerIdx);
      const layerSection = layerSections[layerIdx];
      result.push(mergeSections(baseSection, layerSection, removals));
    } else {
      const filteredChildren = mergeSectionLists(baseSection.children, [], removals);
      result.push({
        ...baseSection,
        children: filteredChildren,
      });
    }
  }

  for (let i = 0; i < layerSections.length; i++) {
    if (usedLayerIndices.has(i)) continue;
    const ls = layerSections[i];

    const isRemoveOnly = ls.content.every(n => n.type === 'remove') && ls.content.length > 0 && ls.children.length === 0;
    if (isRemoveOnly) continue;

    const filteredContent = ls.content.filter(n => n.type !== 'remove');
    result.push({
      ...ls,
      content: filteredContent,
    });
  }

  return result;
}

function mergeSections(base: Section, layer: Section, removals: Set<string>): Section {
  const baseContent = base.content.filter(n => n.type !== 'remove');
  const layerContent = layer.content.filter(n => n.type !== 'remove');

  const mergedContent = [...baseContent, ...layerContent];
  const label = layer.label ?? base.label;
  const mergedChildren = mergeSectionLists(base.children, layer.children, removals);

  return {
    level: base.level,
    title: base.title,
    label,
    content: mergedContent,
    children: mergedChildren,
  };
}

/**
 * List available variants for a project root.
 */
export function listVariants(projectRoot: string): string[] {
  const tree = buildLayerTree(projectRoot);
  const variants: string[] = [];

  function collect(node: LayerTree, prefix: string): void {
    for (const child of node.children) {
      const variantPath = prefix !== '' ? `${prefix}.${child.name}` : child.name;
      variants.push(variantPath);
      collect(child, variantPath);
    }
  }

  collect(tree, '');
  return variants.sort();
}
