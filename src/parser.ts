import * as fs from 'node:fs';
import * as path from 'node:path';

import type { ContentNode, Directive, LayerTree, Section, SpecFile } from './types.js';

/**
 * Parse a .spc or .spectacular file into a SpecFile AST.
 */
export function parseFile(filePath: string): SpecFile {
  const content = fs.readFileSync(filePath, 'utf-8');
  return parseContent(content, filePath);
}

/**
 * Parse raw text content into a SpecFile AST.
 */
export function parseContent(content: string, filePath: string = '<inline>'): SpecFile {
  const lines = content.split('\n');
  const stripped = stripComments(lines);
  return buildAST(stripped, filePath);
}

/**
 * Strip \@rem, \@+rem/\@-rem comment blocks from lines.
 * Returns the remaining lines.
 */
function stripComments(lines: string[]): string[] {
  const result: string[] = [];
  let commentDepth = 0;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed === '@+rem') {
      commentDepth++;
      continue;
    }

    if (trimmed === '@-rem') {
      if (commentDepth > 0) {
        commentDepth--;
      }
      continue;
    }

    if (commentDepth > 0) {
      continue;
    }

    // Single-line comment
    if (trimmed.startsWith('@rem ') || trimmed === '@rem') {
      continue;
    }

    result.push(line);
  }

  return result;
}

/**
 * Parse a parenthesized directive value.
 * Supports bare values and quoted values with JS-style escaping.
 */
function parseParenValue(raw: string): string {
  const trimmed = raw.trim();

  // Quoted value
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    const inner = trimmed.slice(1, -1);
    let result = '';
    let i = 0;
    while (i < inner.length) {
      if (inner[i] === '\\' && i + 1 < inner.length) {
        const next = inner[i + 1];
        switch (next) {
          case '"': result += '"'; break;
          case "'": result += "'"; break;
          case '\\': result += '\\'; break;
          case 'n': result += '\n'; break;
          case 't': result += '\t'; break;
          default: result += '\\' + next; break;
        }
        i += 2;
      } else {
        result += inner[i];
        i++;
      }
    }
    return result;
  }

  // Bare value
  return trimmed;
}

/**
 * Try to extract a directive from a line.
 * Returns the directive content node, or null if not a directive.
 */
function tryParseDirective(line: string): ContentNode | null {
  const trimmed = line.trim();

  const labelMatch = trimmed.match(/^@label\((.+)\)$/);
  if (labelMatch?.[1] !== undefined) {
    return { type: 'label', id: parseParenValue(labelMatch[1]) };
  }

  const seeMatch = trimmed.match(/^@see\((.+)\)$/);
  if (seeMatch?.[1] !== undefined) {
    return { type: 'see', reference: parseParenValue(seeMatch[1]) };
  }

  const refMatch = trimmed.match(/^@ref\((.+)\)$/);
  if (refMatch?.[1] !== undefined) {
    return { type: 'ref', url: parseParenValue(refMatch[1]) };
  }

  const removeMatch = trimmed.match(/^@remove\s+(#{1,6})\s+(.+)$/);
  if (removeMatch !== null) {
    return {
      type: 'remove',
      level: removeMatch[1].length,
      heading: removeMatch[2].trim(),
    };
  }

  return null;
}

/**
 * Build the AST from comment-stripped lines.
 */
function buildAST(lines: string[], filePath: string): SpecFile {
  const file: SpecFile = {
    path: filePath,
    sections: [],
    directives: [],
  };

  let i = 0;

  const flatSections: Section[] = [];
  let currentSection: Section | null = null;
  let pendingLabel: string | undefined = undefined;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Empty line
    if (trimmed === '') {
      i++;
      continue;
    }

    // Fenced code block
    if (trimmed.startsWith('```')) {
      const langMatch = trimmed.match(/^```(\w*)$/);
      const language = langMatch?.[1] !== undefined && langMatch[1] !== '' ? langMatch[1] : undefined;
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```

      const codeNode: ContentNode = {
        type: 'code',
        language,
        code: codeLines.join('\n'),
      };

      if (currentSection !== null) {
        currentSection.content.push(codeNode);
      }
      continue;
    }

    // Heading
    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch !== null) {
      const level = headingMatch[1].length;
      const title = headingMatch[2].trim();

      currentSection = {
        level,
        title,
        label: pendingLabel,
        content: [],
        children: [],
      };
      pendingLabel = undefined;
      flatSections.push(currentSection);
      i++;
      continue;
    }

    // Directive
    const directive = tryParseDirective(trimmed);
    if (directive !== null) {
      if (directive.type === 'label') {
        if (currentSection !== null && currentSection.content.length === 0 && currentSection.label === undefined) {
          // Label immediately after heading with no content yet — attach to current section
          currentSection.label = directive.id;
        } else if (currentSection !== null) {
          // Check if next non-empty line is a heading — label for the upcoming section
          let j = i + 1;
          while (j < lines.length && lines[j].trim() === '') j++;
          if (j < lines.length && (/^#{1,6}\s+/).test(lines[j].trim())) {
            pendingLabel = directive.id;
          } else {
            currentSection.content.push(directive);
          }
        } else {
          // Before any heading — check if it's for the first heading
          let j = i + 1;
          while (j < lines.length && lines[j].trim() === '') j++;
          if (j < lines.length && (/^#{1,6}\s+/).test(lines[j].trim())) {
            pendingLabel = directive.id;
          } else {
            file.directives.push({ type: 'label', id: directive.id });
          }
        }
      } else if (currentSection !== null) {
        currentSection.content.push(directive);
      } else {
        file.directives.push(directive as Directive);
      }
      i++;
      continue;
    }

    // List (ordered or unordered)
    if ((/^[-*+]\s+/).test(trimmed) || (/^\d+\.\s+/).test(trimmed)) {
      const ordered = /^\d+\.\s+/.test(trimmed);
      const items: string[] = [];
      while (i < lines.length) {
        const listLine = lines[i].trim();
        if (listLine === '') {
          // Check if next non-empty line is still a list item
          let j = i + 1;
          while (j < lines.length && lines[j].trim() === '') j++;
          if (j < lines.length) {
            const nextTrimmed = lines[j].trim();
            if ((ordered && (/^\d+\.\s+/).test(nextTrimmed)) ||
                (!ordered && (/^[-*+]\s+/).test(nextTrimmed))) {
              i = j;
              continue;
            }
          }
          break;
        }
        const itemMatch = ordered
          ? listLine.match(/^\d+\.\s+(.*)$/)
          : listLine.match(/^[-*+]\s+(.*)$/);
        if (itemMatch?.[1] !== undefined) {
          items.push(itemMatch[1]);
        } else if (items.length > 0) {
          // Continuation line — append to last item
          items[items.length - 1] += ' ' + listLine;
        } else {
          break;
        }
        i++;
      }

      const listNode: ContentNode = { type: 'list', ordered, items };
      if (currentSection !== null) {
        currentSection.content.push(listNode);
      }
      continue;
    }

    // Statement (regular prose paragraph)
    const paragraphLines: string[] = [];
    while (i < lines.length) {
      const pLine = lines[i].trim();
      if (pLine === '') break;
      if (pLine.startsWith('#') || pLine.startsWith('@') || pLine.startsWith('```')) break;
      if ((/^[-*+]\s+/).test(pLine) || (/^\d+\.\s+/).test(pLine)) break;
      paragraphLines.push(pLine);
      i++;
    }

    if (paragraphLines.length > 0) {
      const text = paragraphLines.join('\n');
      const stmtNode: ContentNode = { type: 'statement', text };
      if (currentSection !== null) {
        currentSection.content.push(stmtNode);
      }
      continue;
    }

    // Fallback — skip unrecognized line
    i++;
  }

  // Nest flat sections by heading level
  file.sections = nestSections(flatSections);

  return file;
}

/**
 * Nest a flat list of sections by heading level into a tree.
 * A section with level N becomes a child of the most recent section with level less than N.
 */
function nestSections(flat: Section[]): Section[] {
  const root: Section[] = [];
  const stack: Section[] = [];

  for (const section of flat) {
    while (stack.length > 0 && stack[stack.length - 1].level >= section.level) {
      stack.pop();
    }

    if (stack.length === 0) {
      root.push(section);
    } else {
      stack[stack.length - 1].children.push(section);
    }

    stack.push(section);
  }

  return root;
}

/**
 * Discover all .spc and .spectacular files in a directory (non-recursive, single layer).
 */
export function discoverFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir);
  return entries
    .filter(e => e.endsWith('.spc') || e.endsWith('.spectacular'))
    .map(e => path.join(dir, e))
    .sort();
}

/**
 * Find the project root by looking for a directory containing .spc/.spectacular files
 * or a _layers_/ directory. Walks up from the given path.
 */
export function findProjectRoot(startPath: string): string | null {
  let dir = path.resolve(startPath);

  if (fs.existsSync(dir) && fs.statSync(dir).isFile()) {
    dir = path.dirname(dir);
  }

  for (;;) {
    const entries = fs.readdirSync(dir);
    const hasSpecFiles = entries.some(e => e.endsWith('.spc') || e.endsWith('.spectacular'));
    const hasLayers = entries.includes('_layers_');

    if (hasSpecFiles || hasLayers) {
      return dir;
    }

    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  return null;
}

/**
 * Build the full LayerTree for a project root.
 */
export function buildLayerTree(root: string): LayerTree {
  return buildLayerTreeRecursive(root, path.basename(root));
}

function buildLayerTreeRecursive(dir: string, name: string): LayerTree {
  const files = discoverFiles(dir).map(f => parseFile(f));
  const children: LayerTree[] = [];

  const layersDir = path.join(dir, '_layers_');
  if (fs.existsSync(layersDir) && fs.statSync(layersDir).isDirectory()) {
    const variants = fs.readdirSync(layersDir).filter(e => {
      const fullPath = path.join(layersDir, e);
      return fs.statSync(fullPath).isDirectory() && !e.startsWith('.');
    });

    for (const variant of variants.sort()) {
      children.push(buildLayerTreeRecursive(path.join(layersDir, variant), variant));
    }
  }

  return { name, files, children };
}
