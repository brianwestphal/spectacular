// AST types for the Spectacular language

export interface SpecFile {
  path: string;
  sections: Section[];
  directives: Directive[];  // top-level directives before any heading
}

export interface Section {
  level: number;
  title: string;
  label?: string;
  content: ContentNode[];
  children: Section[];
}

export type ContentNode =
  | { type: 'statement'; text: string }
  | { type: 'list'; ordered: boolean; items: string[] }
  | { type: 'code'; language?: string; code: string }
  | { type: 'see'; reference: string }
  | { type: 'ref'; url: string }
  | { type: 'label'; id: string }
  | { type: 'remove'; level: number; heading: string };

export type Directive =
  | { type: 'see'; reference: string }
  | { type: 'ref'; url: string }
  | { type: 'label'; id: string }
  | { type: 'remove'; level: number; heading: string };

export interface SpecProject {
  root: string;
  files: SpecFile[];
  layers: LayerTree;
}

export interface LayerTree {
  name: string;
  files: SpecFile[];
  children: LayerTree[];
}

// Analysis result types

export type Severity = 'info' | 'warning' | 'error';

export interface Finding {
  severity: Severity;
  location: {
    file?: string;
    section?: string;
  };
  description: string;
  suggestion?: string;
}

export type CheckType = 'ambiguity' | 'consistency' | 'completeness' | 'redundancy';

export interface AnalysisResult {
  checkType: CheckType;
  findings: Finding[];
  provider: string;
  model: string;
}

export type AIProvider = 'claude' | 'codex' | 'gemini';

// Diff types

export interface DiffResult {
  file: string;
  sections: SectionDiff[];
}

export interface SectionDiff {
  heading: string;
  level: number;
  status: 'added' | 'removed' | 'changed' | 'unchanged';
  contentA?: string;
  contentB?: string;
}
