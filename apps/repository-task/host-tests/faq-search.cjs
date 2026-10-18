// Private host oracle. Never copy this file into a model-readable workspace.
// Element/handler contract tests, NOT a browser or a complete React renderer.
const vm = require('node:vm');
const assert = require('node:assert/strict');
module.exports = ({ source, component, style }) => {
  assert.ok(style.includes('{') && style.includes('}'), 'new styles required');
  assert.ok(!/@import|url\s*\(/i.test(style), 'no external style resources');
  const fixtures = [
    { question: 'How to prepare?', answer: 'Bring a notebook.' },
    { question: 'Family visits?', answer: 'Children are welcome.' },
    { question: 'Opening [details]?', answer: 'Ask the reception team.' },
    { question: 'Other questions?', answer: 'A NOTEBOOK can be useful.' },
  ];
  function mount(faqs) {
    const context = vm.createContext(Object.create(null), { codeGeneration: { strings: false, wasm: false } });
    const run = code => vm.runInContext(code, context, { timeout: 300 });
    run(`
      const React = { Fragment: 'fragment', createElement(type, props, ...children) {
        if (typeof type === 'function') return type({ ...props, children });
        return { type, props: props || {}, children: children.flat(Infinity).filter(x => x !== null && x !== undefined && x !== false) };
      }};
      let slots = [], cursor = 0, tree;
      function useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial;
        return [slots[i], value => { slots[i] = typeof value === 'function' ? value(slots[i]) : value; }]; }
      function useMemo(fn) { return fn(); }
      const X = () => React.createElement('icon', { name: 'X' });
      const Plus = () => React.createElement('icon', { name: 'Plus' });
      const props = ${JSON.stringify({ faqs })};
      function nodes(root = tree) { return root && typeof root === 'object' ? [root, ...(root.children || []).flatMap(nodes)] : []; }
    `);
    run(source);
    run(`function render() { cursor = 0; tree = ${component}(props); } render();`);
    const tree = () => JSON.parse(run('JSON.stringify(tree)'));
    const elements = root => root && typeof root === 'object' ? [root, ...(root.children || []).flatMap(elements)] : [];
    const text = root => typeof root === 'string' || typeof root === 'number' ? String(root) : (root?.children || []).map(text).join('');
    const all = () => elements(tree());
    function event(predicate, handler, value) {
      const index = all().findIndex(predicate);
      assert.ok(index >= 0, 'control exists');
      run(`{ const node = nodes()[${index}]; if (typeof node.props[${JSON.stringify(handler)}] !== 'function') throw Error('handler missing');
        node.props[${JSON.stringify(handler)}](${JSON.stringify({ target: { value }, currentTarget: { value } })}); render(); }`);
    }
    const search = value => event(n => n.type === 'input' && n.props.type === 'search', 'onChange', value);
    const buttons = () => all().filter(n => n.type === 'button' && typeof n.props['aria-expanded'] === 'boolean');
    const questions = () => buttons().map(text);
    const count = n => {
      const status = all().find(n => n.props.role === 'status' || n.props['aria-live'] === 'polite');
      assert.ok(status, 'live count');
      assert.equal(text(status).trim(), `${n} of ${faqs.length} questions`);
    };
    const click = name => event(n => n.type === 'button' && text(n) === name, 'onClick');
    const checkClosed = () => {
      assert.ok(buttons().every(n => n.props['aria-expanded'] === false));
      assert.ok(!all().some(n => n.type === 'p' && faqs.some(f => text(n) === f.answer)));
    };
    const input = all().find(n => n.type === 'input' && n.props.type === 'search');
    assert.ok(input, 'search input');
    assert.ok(input.props['aria-label'] || all().some(n => n.type === 'label' && text(n).trim()
      && (n.props.htmlFor && n.props.htmlFor === input.props.id || elements(n).includes(input)
        || elements(n).some(c => c.type === 'input' && c.props.type === 'search'))), 'accessible label');
    return { all, text, search, questions, count, click, checkClosed, buttons };
  }
  const m = mount(fixtures);
  assert.deepEqual(m.questions(), fixtures.map(f => f.question)); m.count(4); m.checkClosed();
  m.click(fixtures[1].question);
  assert.deepEqual(m.buttons().filter(b => b.props['aria-expanded']).map(m.text), [fixtures[1].question]);
  assert.ok(m.all().some(n => n.type === 'p' && m.text(n) === fixtures[1].answer));
  m.search('CHILDREN'); m.checkClosed();
  m.search('  NOTEBOOK  '); m.count(2); m.checkClosed();
  assert.deepEqual(m.questions(), [fixtures[0].question, fixtures[3].question]);
  m.click(fixtures[3].question);
  assert.ok(m.all().some(n => n.type === 'p' && m.text(n) === fixtures[3].answer));
  m.click(fixtures[0].question);
  assert.deepEqual(m.buttons().filter(b => b.props['aria-expanded']).map(m.text), [fixtures[0].question]);
  m.click(fixtures[0].question); m.checkClosed();
  m.search('prepare? bring'); m.count(0); assert.deepEqual(m.questions(), []);
  m.search('['); assert.deepEqual(m.questions(), [fixtures[2].question]); m.count(1);
  m.click(fixtures[2].question); m.click('Clear search'); m.count(4); m.checkClosed();
  m.search('no-such-question'); assert.deepEqual(m.questions(), []); m.count(0);
  assert.ok(m.all().some(n => m.text(n).trim() === 'No questions found.'));
  m.click('Clear search'); m.count(4); m.checkClosed();
  assert.equal(m.all().find(n => n.type === 'input').props.value, '');
  m.search('   '); m.count(4); assert.deepEqual(m.questions(), fixtures.map(f => f.question));
  const empty = mount([]); empty.count(0); assert.deepEqual(empty.questions(), []);
  // Different data/order prevents fixed answers or index-specific filtering from passing.
  const other = mount([{ question: 'Zebra?', answer: 'First' }, { question: 'Alpha?', answer: 'Second' }]);
  other.search('SECOND'); other.count(1); assert.deepEqual(other.questions(), ['Alpha?']);
};
