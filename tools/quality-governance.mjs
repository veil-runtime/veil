import { createHash } from 'node:crypto';

export const baselinePath = 'tools/quality-governance-baseline.json';
export const relevantCode = (path) => /\.(?:[cm]?[jt]sx?)$/.test(path);
const prefix = 'VEIL-GOV-001';
const fail = (message) => new Error(`${prefix} ${message}`);
const member = (node) => ['MemberExpression', 'OptionalMemberExpression'].includes(node?.type);
const unwrap = (node) => ['TSAsExpression', 'TSTypeAssertion', 'TSNonNullExpression',
  'TSSatisfiesExpression', 'TSInstantiationExpression', 'ParenthesizedExpression'].includes(node?.type) ? unwrap(node.expression) : node;
const property = (node) => !node.computed ? node.property?.name ?? node.key?.name ?? node.key?.value
  : (node.property ?? node.key)?.type === 'StringLiteral' ? (node.property ?? node.key).value
    : (node.property ?? node.key)?.type === 'TemplateLiteral'
      && (node.property ?? node.key).expressions.length === 0
      ? (node.property ?? node.key).quasis.at(0).value.cooked : undefined;
const ignored = new Set(['start', 'end', 'loc', 'extra', 'comments', 'leadingComments',
  'trailingComments', 'innerComments', 'tokens', 'errors']);

// Keep syntax and structural position, but not formatting, raw quotes or comments.
function syntax(value) {
  if (typeof value === 'bigint') return value.toString();
  if (Array.isArray(value)) return value.map(syntax);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !ignored.has(key)).map(([key, child]) => [key, syntax(child)]));
  return value;
}

function walk(node, visit, address = '', parent) {
  if (!node || typeof node !== 'object') return;
  if (typeof node.type === 'string') visit(node, address, parent);
  for (const [key, child] of Object.entries(node)) {
    if (ignored.has(key)) continue;
    if (Array.isArray(child)) child.forEach((item, index) => walk(item, visit, `${address}/${key}/${index}`, node));
    else if (child && typeof child === 'object') walk(child, visit, `${address}/${key}`, node);
  }
}

// Local use inspection only: no receiver-name heuristics or interprocedural flow.
// An unused extraction is ambiguous; reads with observable data-only uses are not.
function dynamicExecutionUse(program) {
  const parents = new Map();
  walk(program, (node, _address, parent) => parents.set(node, parent));
  const boundary = (node) => ['BlockStatement', 'Program'].includes(node?.type);
  const scopeOf = (node) => {
    while (node && !boundary(node)) node = parents.get(node);
    return node;
  };
  const bindings = (node) => {
    if (!node) return [];
    if (node.type === 'Identifier') return [node];
    if (node.type === 'RestElement') return bindings(node.argument);
    if (node.type === 'AssignmentPattern') return bindings(node.left);
    if (node.type === 'ArrayPattern') return node.elements.flatMap(bindings);
    if (node.type === 'ObjectPattern') return node.properties.flatMap((item) => bindings(item.value ?? item.argument));
    return [];
  };
  const declaration = (identifier) => {
    const parent = parents.get(identifier);
    if (parent?.type === 'VariableDeclarator' && parent.id === identifier) return parent;
    if (parent?.type === 'AssignmentPattern' && parent.left === identifier) {
      // Defaults bind through variable patterns or parameters, not assignment targets.
      for (let owner = parent; owner; owner = parents.get(owner)) {
        const container = parents.get(owner);
        if (container?.type === 'VariableDeclarator' && container.id === owner
          || container?.params?.includes(owner)) return parent;
        if (!['AssignmentPattern', 'ObjectProperty', 'ObjectPattern', 'ArrayPattern'].includes(container?.type)) break;
      }
    }
    for (let scope = scopeOf(identifier); scope; scope = scopeOf(parents.get(scope))) {
      for (const statement of scope.body) {
        const node = statement.declaration ?? statement;
        if (node.type === 'VariableDeclaration') {
          const found = node.declarations.find((item) => item.id.type === 'Identifier' && item.id.name === identifier.name);
          if (found) return found;
        }
      }
    }
  };
  function bindingUse(identifier, seen) {
    if (identifier?.type !== 'Identifier') return true;
    const decl = declaration(identifier);
    if (!decl || seen.has(decl) || parents.get(decl)?.kind === 'var') return true;
    const scope = scopeOf(decl);
    const bound = new Set();
    const references = [];
    walk(scope, (node, _address, parent) => {
      // Reject ambiguous shadowing rather than use another binding's data reads as evidence.
      if (node.type === 'VariableDeclarator') bindings(node.id).forEach((id) => bound.add(id));
      if (node.params) node.params.flatMap(bindings).forEach((id) => bound.add(id));
      if (node.type === 'CatchClause') bindings(node.param).forEach((id) => bound.add(id));
      if (node.type === 'FunctionDeclaration' || node.type === 'ClassDeclaration') bound.add(node.id);
      if (node.type !== 'Identifier' || node.name !== identifier.name) return;
      if (member(parent) && parent.property === node && !parent.computed) return;
      if (parent?.key === node && !parent.computed) return;
      if (parent?.type?.startsWith('TS') && !(parent.expression === node && unwrap(parent) !== parent)) return;
      if (parent?.type === 'AssignmentExpression' && parent.left === node) return;
      references.push(node);
    });
    if ([...bound].filter((id) => id?.name === identifier.name).length !== 1) return true;
    const uses = references.filter((node) => !bound.has(node));
    return uses.length === 0 || uses.some((node) => executionUse(node, new Set([...seen, decl])));
  }
  function executionUse(node, seen = new Set()) {
    const parent = parents.get(node);
    if (!parent) return false;
    if (parent.expression === node && unwrap(parent) !== parent || parent.type === 'AwaitExpression'
      || parent.type === 'LogicalExpression'
      || parent.type === 'ConditionalExpression' && parent.test !== node
      || parent.type === 'SequenceExpression' && parent.expressions.at(-1) === node) {
      return executionUse(parent, seen);
    }
    if (['CallExpression', 'OptionalCallExpression', 'NewExpression'].includes(parent.type)) {
      const callee = unwrap(parent.callee);
      const reflectiveTarget = member(callee) && unwrap(callee.object)?.type === 'Identifier'
        && unwrap(callee.object).name === 'Reflect'
        && (['apply', 'construct'].includes(property(callee)) && parent.arguments[0] === node
          || property(callee) === 'construct' && parent.arguments[2] === node);
      return parent.callee === node || reflectiveTarget;
    }
    if (parent.type === 'TaggedTemplateExpression') return parent.tag === node;
    if (member(parent) && parent.object === node) return ['executePlan', 'bind', 'call', 'apply'].includes(property(parent));
    if (parent.type === 'AssignmentExpression' && ['=', '||=', '&&=', '??='].includes(parent.operator)
      && executionUse(parent, seen)) return true;
    if (parent.type === 'VariableDeclarator' && parent.init === node) return bindingUse(parent.id, seen);
    if (['AssignmentExpression', 'AssignmentPattern'].includes(parent.type) && parent.right === node) return bindingUse(parent.left, seen);
    // Comparisons, returns, formatting, argument passing and object/JSX data uses
    // are not executable extraction in this local rule. Callee bodies are not followed.
    return false;
  }
  return executionUse;
}

let parser;
async function getParser() {
  const [major, minor] = process.versions.node.split('.').map(Number);
  if (major < 24 || (major === 24 && minor < 11)) {
    throw fail('the governance checker requires Node >=24.11; Veil runtime still supports Node >=24');
  }
  try { parser ??= (await import('@babel/parser')).parse; }
  catch (error) { throw fail(`parser unavailable: ${error.message}`); }
  return parser;
}

export async function inspectSource(path, source) {
  const parse = await getParser();
  let ast;
  try {
    ast = parse(source, {
      sourceType: 'unambiguous', errorRecovery: false, attachComment: false,
      plugins: [
        ...(/\.[cm]?tsx?$/.test(path) ? [['typescript', {
          dts: /\.d\.[cm]?ts$/.test(path), disallowAmbiguousJSXLike: /\.[cm]ts$/.test(path),
        }]] : []),
        ...(/\.[cm]?[jt]sx$/.test(path) ? ['jsx'] : []),
      ],
    });
  } catch (error) {
    throw fail(`${path}:${error.loc?.line ?? 1}:${(error.loc?.column ?? 0) + 1}: parser failure: ${error.message}`);
  }

  // Deliberately local, conservative binding recognition, not a call graph.
  // Shadowing can over-report. Every execute reference is checked regardless of type.
  const managers = new Set(['jobManager']);
  if (path === 'src/runtime/jobs/job-manager.ts') managers.add('JobManager');
  const namespaces = new Set();
  const managerModule = (value) => /(?:^|\/)job-manager(?:\.[cm]?[jt]s)?$/.test(value ?? '');
  walk(ast.program, (node) => {
    if (node.type === 'ImportDeclaration' && node.importKind !== 'type' && managerModule(node.source.value)) {
      for (const item of node.specifiers) {
        if (item.importKind === 'type') continue;
        (item.type === 'ImportNamespaceSpecifier' ? namespaces : managers).add(item.local.name);
      }
    }
  });
  const isManager = (value) => {
    const node = unwrap(value);
    // May contain a manager: inspect only local logical/conditional value branches.
    return node?.type === 'LogicalExpression' && (isManager(node.left) || isManager(node.right))
      || node?.type === 'ConditionalExpression' && (isManager(node.consequent) || isManager(node.alternate))
      || node?.type === 'Identifier' && managers.has(node.name)
      || node?.type === 'ThisExpression' && path === 'src/runtime/jobs/job-manager.ts'
      || node?.type === 'NewExpression' && isManager(node.callee)
      || member(node) && (property(node) === 'jobManager'
        || property(node) === 'prototype' && isManager(node.object));
  };
  let changed;
  do {
    changed = false;
    walk(ast.program, (node) => {
      const target = node.type === 'VariableDeclarator' ? node.id
        : ['AssignmentExpression', 'AssignmentPattern'].includes(node.type) ? node.left : undefined;
      const value = node.type === 'VariableDeclarator' ? node.init : node.right;
      if (target?.type === 'Identifier' && isManager(value) && !managers.has(target.name)) {
        managers.add(target.name);
        changed = true;
      }
      if (unwrap(value)?.type === 'Identifier' && namespaces.has(unwrap(value).name)) {
        if (target?.type === 'Identifier' && !namespaces.has(target.name)) {
          namespaces.add(target.name);
          changed = true;
        }
        if (target?.type === 'ObjectPattern') for (const item of target.properties) {
          const binding = item.value?.type === 'AssignmentPattern' ? item.value.left : item.value;
          if (property(item) === 'jobManager' && binding?.type === 'Identifier' && !managers.has(binding.name)) {
            managers.add(binding.name);
            changed = true;
          }
        }
      }
    });
  } while (changed);

  const executionRelevant = dynamicExecutionUse(ast.program);
  const findings = [];
  ast.program.body.forEach((statement, index) => {
    const owner = syntax(statement);
    walk(statement, (node, address, parent) => {
      let kind;
      let detail;
      if (member(node)) {
        const name = property(node);
        if (name === 'execute') kind = 'execute';
        if (['execute', 'executePlan'].includes(name) && isManager(node.object)) kind = 'job-manager';
        if (node.computed && name === undefined && executionRelevant(node)) {
          kind = 'dynamic';
          detail = 'unsupported dynamic invocation or executable extraction';
        }
        if (unwrap(node.object)?.type === 'Identifier'
          && ((unwrap(node.object).name === 'Reflect' && name === 'get')
            || (unwrap(node.object).name === 'Object' && ['getOwnPropertyDescriptor', 'getOwnPropertyDescriptors'].includes(name)))) {
          kind = 'dynamic';
          detail = 'unsupported reflective property access';
        }
      }
      if (node.type === 'ObjectProperty' && parent?.type === 'ObjectPattern') {
        const name = property(node);
        if (name === 'execute') kind = 'execute';
        // Conservatively reserve destructured executePlan too: its receiver may be a manager alias.
        if (name === 'executePlan') kind = 'job-manager';
        if (node.computed && name === undefined) kind = 'dynamic';
      }
      if (node.type === 'TSImportEqualsDeclaration' && node.importKind !== 'type') {
        kind = 'dynamic';
        detail = 'unsupported TypeScript import-equals; use a static named import for analysis';
      }
      // Non-static manager loading/re-exporting is unsupported rather than an unchecked entrance.
      if ((node.type === 'CallExpression' && node.callee.type === 'Identifier' && node.callee.name === 'require'
        || node.type === 'ImportExpression') && (managerModule(node.source?.value ?? node.arguments?.at(0)?.value)
          || (node.source ?? node.arguments?.at(0))?.type !== 'StringLiteral')
        || ['ExportNamedDeclaration', 'ExportAllDeclaration'].includes(node.type) && managerModule(node.source?.value)) {
        kind = 'dynamic';
        detail = 'unsupported dynamic module loading or JobManager require/re-export; use a static named import for analysis';
      }
      if (!kind) return;
      const anchor = createHash('sha256').update(JSON.stringify([index, address, owner])).digest('hex');
      findings.push({ path, anchor, kind, line: node.loc.start.line, column: node.loc.start.column + 1,
        detail: detail ?? (kind === 'dynamic' ? 'unsupported dynamic destructuring'
          : kind === 'job-manager' ? 'direct JobManager execution entrance' : 'execution-method reference') });
    });
  });
  return findings;
}

export async function inspectTree(paths, read) {
  const findings = [];
  let files = 0;
  for (const path of [...paths].filter(relevantCode).sort()) {
    let source;
    try { source = read(path); }
    catch (error) { throw fail(`${path}: unreadable analysis input: ${error.message}`); }
    if (source === undefined) continue;
    findings.push(...await inspectSource(path, source));
    files++;
  }
  return { findings, files };
}

const identity = (site) => `${site.path}:${site.anchor}:${site.kind}`;
export function parseBaseline(text, where) {
  let value;
  try { value = JSON.parse(text); }
  catch { throw fail(`${where}: invalid baseline JSON`); }
  if (!value || value.version !== 1 || !Array.isArray(value.sites)
    || Object.keys(value).some((key) => !['version', 'sites'].includes(key))) throw fail(`${where}: invalid baseline schema`);
  const seen = new Set();
  for (const site of value.sites) {
    if (!site || typeof site.path !== 'string' || !relevantCode(site.path)
      || site.path.startsWith('/') || site.path.includes('\\') || site.path.split('/').includes('..')
      || !/^[a-f0-9]{64}$/.test(site.anchor ?? '')
      || !['execute', 'job-manager', 'dynamic'].includes(site.kind)
      || !['GOVERNED_MACHINERY', 'LEGACY_BYPASS', 'LEGITIMATE_NON_CAPABILITY_EXECUTE', 'TEST_OR_FIXTURE'].includes(site.classification)
      || typeof site.reason !== 'string' || !site.reason.trim()
      || Object.keys(site).some((key) => !['path', 'anchor', 'kind', 'classification', 'reason'].includes(key))
      || seen.has(identity(site))) throw fail(`${where}: invalid or duplicate individual site`);
    seen.add(identity(site));
  }
  return value.sites;
}

export async function checkGovernance({ paths, before, after }) {
  const baseText = before(baselinePath);
  const candidateText = after(baselinePath);
  if (candidateText !== undefined) parseBaseline(candidateText, 'candidate'); // Validate, never authorize.
  const allowances = baseText === undefined ? [] : parseBaseline(baseText, 'base');
  if (baseText !== undefined) {
    const original = await inspectTree(paths, before);
    const identities = new Set(original.findings.map(identity));
    for (const site of allowances) {
      if (!identities.has(identity(site))) throw fail(`base: stale allowance ${site.path}:${site.anchor}`);
    }
  }
  const candidate = await inspectTree(paths, after);
  const allowed = new Map(allowances.map((site) => [identity(site), site]));
  const output = [`Governance — ${prefix} (${candidate.files} candidate files parsed)`];
  let status = 0;
  if (baseText === undefined) {
    output.push(`  ${prefix} review required: base has no baseline; candidate allowances are not trusted (initial adoption).`);
    status = 1;
  }
  for (const site of candidate.findings) {
    const allowance = allowed.get(identity(site));
    const location = `${site.path}:${site.line}:${site.column}`;
    if (allowance) {
      output.push(`  ${allowance.classification}: ${location} — ${allowance.reason}`);
      allowed.delete(identity(site)); // An allowance can match exactly once.
    } else {
      output.push(`  ${prefix} ${location}: ${site.detail}; no trusted individual allowance. Use OperatorRuntime.run/executePlan for capability work.`);
      status = Math.max(status, site.kind === 'dynamic' ? 2 : 1);
    }
  }
  for (const site of allowed.values()) output.push(`  retired site: ${site.path}:${site.anchor}; remove its candidate baseline entry.`);
  if (!status) output.push('  No unapproved execution references or unsupported accesses.');
  return { output: output.join('\n'), status };
}
