import { createHash } from 'node:crypto';

export const baselinePath = 'tools/quality-governance-baseline.json';
export const approvalsPath = 'tools/quality-governance-approvals.json';
export const relevantCode = (path) => /\.(?:[cm]?[jt]sx?)$/.test(path);
const prefix = 'VEIL-GOV-001';
const apiRoute = (path) => path.startsWith('src/api/routes/');
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
      const moduleName = node.source?.value ?? (node.type === 'CallExpression'
        && node.callee?.name === 'require' ? node.arguments?.[0]?.value : undefined);
      if (apiRoute(path) && typeof moduleName === 'string'
        && /(?:^|\/)(?:capabilities|providers)\//.test(moduleName)) {
        kind = 'dynamic';
        detail = 'API routes must not import capability or provider implementations';
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
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const hashPattern = /^[a-f0-9]{64}$/;
const validPath = (path) => typeof path === 'string' && path !== '' && !path.startsWith('/')
  && !path.includes('\\') && !/[\*?\[\]]/.test(path)
  && path.split('/').every((part) => part !== '' && part !== '.' && part !== '..');
// The 31 identities at the PR #108 cutoff. Historical entries may be retired, not expanded.
const frozenLegacy = new Set([
  'examples/veil-starter/server/veil/capabilities.test.ts:52b8509038c6e02f0fccf1a34118a963984bded3ddc019b2bdee9e3083de44a3:execute',
  'src/runtime/execution/plan-validator.ts:56e72b010dc9a4c6c38fe49f317cebdf7bf52424d0bdc154a74214b5c867f0c4:dynamic',
  'src/runtime/execution/result-reference.ts:fa558518ddbff03dddc63d98f9496c264b3734a45dc09caea209ddc012cb7ffd:dynamic',
  'src/runtime/jobs/job-manager.ts:f1d32dd14560fcf9883e25c30c3663dc0078ebd49de915f920ec6abb1aca5849:job-manager',
  'src/runtime/jobs/job-manager.ts:1de7ac2827640d7ab79d276299f619e963f329668ec66628268887da6fc4c44e:execute',
  'src/runtime/operator-runtime.ts:f77cd0abb36b9b5030798b0bf36a75810ed3567c11336fe22d9a03efcbd42855:job-manager',
  'src/runtime/operator-runtime.ts:fc5e6e062ae4f33959c02e83b0b03b9e4fffd1bcc00166a369a3a9b4c167a6b4:execute',
  'src/runtime/execution/governed-value.ts:8dd63a8040d329c82382bc4ae292a642e8a44479de63b274242748bbd7c8e0d1:dynamic',
  'src/runtime/execution/governed-value.ts:bea564db8bd711e6fc0e2b17e6ab2e34929980c9cd32d31ee32b3434924b65bb:dynamic',
  'src/sdk/capability/create-capability.ts:0e58f16e6c26e79279fe0a35302a8c6c2f0194e689fda296fd424bbae98cc6b4:execute',
  'src/sdk/capability/create-capability.ts:71ee6e7e30c08a8a46082da1658dd23de501f521b2d2a4cc359fb8ef80940ddf:execute',
  'test/fixtures/package-consumer/verify.mjs:0ca0d41fecc7c7f23ede6d59e48201e69fd07dd15ae85888d2360f0ff3c65141:dynamic',
  'test/planner-routing.test.ts:3045cc55b637d5509c9705dc787c292013d3b248cc1c419b94df983bc1c9d561:execute',
  'test/planner-routing.test.ts:b36db2ba927195ec359f250c4493e61e178c3cabf1e3451dcbc8f900b63698a9:execute',
  'test/planner-routing.test.ts:132a61ba2d05f584ebc5cabffa0c65cb331b462c7f556da32c38ecfcfb7731f8:execute',
  'test/planner-routing.test.ts:349a445b6e74964e7191e282b1e06550d9c11dcf41c303b90615391cf966bd72:execute',
  'test/planner-routing.test.ts:838a7dae7e1f045541edd0d94c3aaca7c7f8721386d0cda8d7899da603671809:execute',
  'test/plan-admission.test.ts:0187fa2f4b6daff3da9797f03c97152101c7318704c3dd988042fa700a86fe3d:dynamic',
  'test/plan-admission.test.ts:b66fcc08bfab183eb951c39f40e1ad47a29208aa33e1285ee7f8bb912a66335d:dynamic',
  'test/plan-admission.test.ts:e5a2f8f0399da97e329901facf8636b7d550dac8fad166fcd39a21f2e2bc08d8:dynamic',
  'test/plan-admission.test.ts:9a74dee9a6be95e8470eec859dc028791944182a248397608a35313d8820c1bf:dynamic',
  'experiments/external-model-reasoner/model-adapter.mjs:28a49a354fa8f965c784293731603772b623ce565e33a1ca1381b2a2e76b8e2d:dynamic',
  'experiments/external-model-reasoner/model-adapter.mjs:aef3c1446aacedf2d4eae8133cf07f8e009a0825b29f08e1763a4e310beeda19:dynamic',
  'experiments/external-model-reasoner/run.mjs:7f78381ad5ff742445c3bea35efc42459684184a46a5f779673c1514f3ac2731:dynamic',
  'src/runtime/jobs/job-manager.ts:86079973f34a21759ce6f2d9e713ba8bf8a7b3741f0adefe90ec08671ab0749e:dynamic',
  'src/runtime/logging/job-log-sink.ts:91eee71f67beaad965a4230cefa411ecaa101cb0bfd74691fddf4ade8bf588e0:dynamic',
  'src/runtime/logging/sqlite-log-sink.ts:11dec86f4a4a6c70552af30360f80e65f5fe8ff49f17df241e180b939025b197:dynamic',
  'test/logging-reliability.test.ts:823bfec96de092683943d8dbb3d8f4706f3b3f79c230b768b12abec18ad08071:dynamic',
  'test/logging-reliability.test.ts:e063cf0572585862b6b0377d8c26958ef96941530729dfb4b3b42ab9c996d758:dynamic',
  'test/logging-reliability.test.ts:515773eb22aae19942ed14583cfdaae0918e8543c6470eb9de2a8e95343c2e2a:dynamic',
  'test/logging-reliability.test.ts:04c6b74a9489fbd5b56cf547b540b7b29d0b5461d787191105b7276a28d5683b:dynamic',
]);
const scopes = {
  'ui-showcase-v1': {
    prefixes: ['docs/assets/playground/', 'docs/playground/', 'docs/assets/showcase/',
      'docs/showcase/', 'docs/backend-lab/', 'examples/backend-lab/'],
    required: ['tools/showcase/package.json', 'tools/showcase/package-lock.json',
      'tools/showcase/build.mjs'],
  },
};
const keys = (value, expected) => value && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).length === expected.length
  && Object.keys(value).every((key) => expected.includes(key));
const nonempty = (value) => typeof value === 'string' && value.trim() !== '';
const date = (value) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
  && !Number.isNaN(Date.parse(`${value}T00:00:00Z`))
  && new Date(`${value}T00:00:00Z`).toISOString().startsWith(value);
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

export function parseApprovals(text, where) {
  let value;
  try { value = JSON.parse(text); }
  catch { throw fail(`${where}: invalid approval JSON`); }
  if (!keys(value, ['version', 'contexts', 'approvals']) || value.version !== 1
    || !Array.isArray(value.contexts) || !Array.isArray(value.approvals)) {
    throw fail(`${where}: invalid approval schema`);
  }
  const contexts = new Map();
  for (const context of value.contexts) {
    if (!keys(context, ['name', 'scope', 'files']) || !/^[a-z0-9][a-z0-9.-]*$/.test(context.name ?? '')
      || !Object.hasOwn(scopes, context.scope) || !Array.isArray(context.files)
      || contexts.has(context.name)) throw fail(`${where}: invalid or duplicate approval context`);
    const files = new Map();
    for (const file of context.files) {
      if (!keys(file, ['path', 'sha256']) || !validPath(file.path)
        || !hashPattern.test(file.sha256 ?? '') || files.has(file.path)) {
        throw fail(`${where}: invalid or duplicate context file`);
      }
      files.set(file.path, file.sha256);
    }
    contexts.set(context.name, { scope: context.scope, files });
  }
  const seen = new Set();
  const used = new Set();
  for (const approval of value.approvals) {
    if (!keys(approval, ['path', 'anchor', 'kind', 'fileSha256', 'context', 'reviewer',
      'decision', 'rationale', 'approvedAt']) || !validPath(approval.path)
      || !relevantCode(approval.path) || !hashPattern.test(approval.anchor ?? '')
      || !['execute', 'job-manager', 'dynamic'].includes(approval.kind)
      || !hashPattern.test(approval.fileSha256 ?? '')
      || !nonempty(approval.context) || !contexts.has(approval.context)
      || !keys(approval.reviewer, ['name', 'identity'])
      || !nonempty(approval.reviewer.name) || !nonempty(approval.reviewer.identity)
      || approval.decision !== 'approve' || !nonempty(approval.rationale)
      || !date(approval.approvedAt) || seen.has(identity(approval))) {
      throw fail(`${where}: invalid or duplicate approval record`);
    }
    const context = contexts.get(approval.context);
    if (context.files.get(approval.path) !== approval.fileSha256) {
      throw fail(`${where}: approval file hash is absent from or differs from its context`);
    }
    seen.add(identity(approval));
    used.add(approval.context);
  }
  if (contexts.size !== used.size) throw fail(`${where}: stale unused approval context`);
  return { contexts, approvals: value.approvals };
}

function contextState(context, paths, raw, where) {
  const scope = scopes[context.scope];
  const actual = new Set();
  for (const path of paths) {
    if (!scope.prefixes.some((prefix) => path.startsWith(prefix))) continue;
    try { if (raw(path) !== undefined) actual.add(path); }
    catch (error) { return `${where}: ${path}: unreadable context input: ${error.message}`; }
  }
  for (const path of scope.required) actual.add(path);
  const expected = new Set(context.files.keys());
  if (actual.size !== expected.size || [...actual].some((path) => !expected.has(path))) {
    return `${where}: context file membership changed`;
  }
  for (const path of actual) {
    let bytes;
    try { bytes = raw(path); }
    catch (error) { return `${where}: ${path}: unreadable context input: ${error.message}`; }
    if (bytes === undefined || sha256(bytes) !== context.files.get(path)) {
      return `${where}: ${path}: context file hash changed or file missing`;
    }
  }
}

export async function checkGovernance({ paths, before, after, beforeRaw, afterRaw,
  legacyIds = frozenLegacy }) {
  const rawBefore = beforeRaw ?? ((path) => {
    const value = before(path);
    return value === undefined ? undefined : Buffer.from(value);
  });
  const rawAfter = afterRaw ?? ((path) => {
    const value = after(path);
    return value === undefined ? undefined : Buffer.from(value);
  });
  const baseText = before(baselinePath);
  const candidateText = after(baselinePath);
  if (candidateText !== undefined) {
    const sites = parseBaseline(candidateText, 'candidate'); // Validate, never authorize.
    if (sites.some((site) => !legacyIds.has(identity(site)))) {
      throw fail('candidate: new legacy allowances are forbidden; use a hash-bound approval');
    }
    if (sites.some(site => apiRoute(site.path))) {
      throw fail('candidate: API route execution allowances are forbidden; remove retired route entries');
    }
  }
  const allowances = baseText === undefined ? [] : parseBaseline(baseText, 'base');
  if (allowances.some((site) => !legacyIds.has(identity(site)))) {
    throw fail('base: new legacy allowances are forbidden; use a hash-bound approval');
  }
  if (baseText !== undefined) {
    const original = await inspectTree(paths, before);
    const identities = new Set(original.findings.map(identity));
    for (const site of allowances) {
      if (!identities.has(identity(site))) throw fail(`base: stale allowance ${site.path}:${site.anchor}`);
    }
  }
  const candidate = await inspectTree(paths, after);
  const candidateApprovalText = after(approvalsPath);
  const baseApprovalText = before(approvalsPath);
  const empty = { contexts: new Map(), approvals: [] };
  const candidateApprovals = candidateApprovalText === undefined ? empty
    : parseApprovals(candidateApprovalText, 'candidate');
  const trusted = baseApprovalText === undefined ? empty : parseApprovals(baseApprovalText, 'base');
  if (baseApprovalText !== undefined && candidateApprovalText === undefined) {
    throw fail('candidate: approval manifest is missing');
  }
  const originalIds = new Set(baseText === undefined ? [] : (await inspectTree(paths, before)).findings.map(identity));
  const candidateApprovalIds = new Set(candidateApprovals.approvals.map(identity));
  const candidateLegacyIds = new Set(candidateText === undefined ? []
    : parseBaseline(candidateText, 'candidate').map(identity));
  if (candidateApprovals.approvals.some((site) => candidateLegacyIds.has(identity(site)))) {
    throw fail('candidate: approval overlaps a legacy allowance');
  }
  for (const approval of trusted.approvals) {
    if (!originalIds.has(identity(approval)) || allowances.some((site) => identity(site) === identity(approval))) {
      throw fail(`base: stale or overlapping approval ${identity(approval)}`);
    }
    const problem = contextState(trusted.contexts.get(approval.context), paths, rawBefore, 'base');
    if (problem) throw fail(problem);
  }
  const allowed = new Map(allowances.map((site) => [identity(site), site]));
  const approved = new Map(trusted.approvals.map((site) => [identity(site), site]));
  const candidateIds = new Set(candidate.findings.map(identity));
  const output = [`Governance — ${prefix} (${candidate.files} candidate files parsed)`];
  let status = 0;
  if (baseText === undefined) {
    output.push(`  ${prefix} review required: base has no baseline; candidate allowances are not trusted (initial adoption).`);
    status = 1;
  }
  for (const site of candidate.findings) {
    const allowance = allowed.get(identity(site));
    const approval = approved.get(identity(site));
    const location = `${site.path}:${site.line}:${site.column}`;
    if (apiRoute(site.path)) {
      output.push(`  UNRESOLVED ${prefix} ${location}: ${site.detail}; API route references cannot be allowed by a baseline. Use OperatorRuntime.run/executePlan.`);
      status = Math.max(status, site.kind === 'dynamic' ? 2 : 1);
      allowed.delete(identity(site));
    } else if (allowance) {
      output.push(`  ${allowance.classification} [APPROVED LEGACY]: ${location} — ${allowance.reason}`);
      allowed.delete(identity(site)); // An allowance can match exactly once.
    } else if (approval) {
      let bytes;
      try { bytes = rawAfter(site.path); }
      catch (error) { throw fail(`${site.path}: unreadable approval input: ${error.message}`); }
      const context = trusted.contexts.get(approval.context);
      const problem = contextState(context, paths, rawAfter, 'candidate');
      if (!candidateApprovalIds.has(identity(site))) {
        output.push(`  INVALIDATED ${prefix} ${location}: trusted approval record is missing from candidate manifest.`);
        status = 2;
      } else if (bytes !== undefined && sha256(bytes) === approval.fileSha256 && !problem) {
        output.push(`  APPROVED ${prefix} ${location}: ${site.detail}; ${approval.reviewer.name} (${approval.reviewer.identity}), ${approval.approvedAt}: ${approval.rationale}`);
      } else {
        output.push(`  INVALIDATED ${prefix} ${location}: ${problem ?? 'finding file hash changed'}; approval ${approval.context} no longer applies.`);
        status = 2;
      }
      approved.delete(identity(site));
    } else {
      output.push(`  UNRESOLVED ${prefix} ${location}: ${site.detail}; no trusted individual allowance or approval. Use OperatorRuntime.run/executePlan for capability work.`);
      status = Math.max(status, site.kind === 'dynamic' ? 2 : 1);
    }
  }
  for (const site of allowed.values()) output.push(`  retired site: ${site.path}:${site.anchor}; remove its candidate baseline entry.`);
  for (const site of approved.values()) {
    output.push(`  INVALIDATED ${prefix} ${site.path}:${site.anchor}: approved finding is absent; retire the stale approval.`);
    status = 2;
  }
  for (const site of candidateApprovals.approvals) {
    if (!candidateIds.has(identity(site))) {
      output.push(`  INVALIDATED ${prefix} ${site.path}:${site.anchor}: stale candidate approval has no finding.`);
      status = 2;
    }
    const problem = contextState(candidateApprovals.contexts.get(site.context), paths, rawAfter, 'candidate');
    if (problem) {
      output.push(`  INVALIDATED ${prefix} ${site.path}:${site.anchor}: ${problem}.`);
      status = 2;
    }
  }
  if (!status) output.push('  No unapproved execution references or unsupported accesses.');
  return { output: output.join('\n'), status };
}
