const bind = path => ({ source: 'state', path });
const btn = (key, text) => ({ key, component: 'Button', text, action: key });
const txt = (key, text) => ({ key, component: 'Text', text });
const status = text => ({ key: 'status', component: 'Status', text });
const screen = (id, title, children, state = {}) => ({ id, actions: ['next','approve','reject','retry','reset','run','stop','invalid'], state,
  screen: { key: 'screen', component: 'Stack', children: [{ key: 'heading', component: 'Heading', text: title }, ...children] } });
const scenarios = {
  incident: { title: 'Incident investigation', summary: 'Model suggests investigating elevated error rates.', decision: 'Review evidence and approve an escalation.' },
  request: { title: 'Request approval', summary: 'Model extracts a proposed access request.', decision: 'Approve or reject the request.' },
  analysis: { title: 'Operational analysis', summary: 'Model identifies a capacity trend.', decision: 'Accept or reject a follow-up review.' },
};
export function descriptor(kind, step, model) {
  if (kind === 'llm') {
    const item = scenarios[model.scenario];
    if (step === 'input') return screen('llm-input', 'LLM to UI · simulated output', [txt('explain', 'Choose an authored model response. No model is called.'),
      { key:'scenario', component:'Select', label:'Scenario', binding:bind('scenario'), options:Object.entries(scenarios).map(([value,v]) => ({value,label:v.title})) }, btn('next','Generate descriptor'), btn('invalid','Try invalid output')], { scenario:model.scenario });
    if (step === 'done') return screen('llm-done','Local decision recorded',[status(model.message),btn('reset','New scenario')]);
    if (step === 'error') return screen('llm-error','Output rejected',[status('Invalid descriptor rejected. The last accepted interface is safe.'),btn('retry','Recover')]);
    return screen('llm-review',item.title,[status('Simulated model output · validated descriptor'),txt('summary',item.summary),txt('decision',item.decision),btn('approve','Approve locally'),btn('reject','Reject locally'),btn('reset','New scenario')]);
  }
  if (kind === 'operations') {
    const rows = model.history.slice(-6).map((entry,i) => ({ time:String(i+1), event:entry }));
    return { ...screen('operations','Operations console · simulation',[status(`Service ${model.health} · job ${model.job}`),txt('diagnostic',model.diagnostic),{ key:'history',component:'Table',ariaLabel:'Execution history',binding:{source:'data',path:'history'},columns:[{key:'time',label:'#'},{key:'event',label:'Event'}]},btn('run','Run job'),btn('stop','Simulate failure'),btn('retry','Retry job'),btn('reset','Reset simulation')]), data:{history:rows} };
  }
  if (step === 'input') return screen('workflow-input','Request · capture',[txt('help','Enter a title and reason for a simulated request.'),
    {key:'title',component:'Input',label:'Request title',binding:bind('title'),validation:{required:true}},
    {key:'reason',component:'Textarea',label:'Reason',binding:bind('reason'),validation:{required:true}},btn('next','Validate and review')],model.form);
  if (step === 'review') return screen('workflow-review','Review request',[status(`Title: ${model.form.title} · Reason: ${model.form.reason}`),btn('approve','Approve'),btn('reject','Reject'),btn('retry','Edit request')]);
  return screen('workflow-done','Request confirmation',[status(model.message),btn('reset','Start another request')]);
}
