import { mountLab } from './lab.mjs';
import { sources } from 'lab:sources';
const kind=new URLSearchParams(location.search).get('example');
const names=new Map([['llm','LLM to UI'],['operations','Operations Console'],['workflow','Adaptive Workflow']]);
const selected=names.has(kind)?kind:'llm';
document.querySelector('#title').textContent=names.get(selected);
document.querySelector('#mode').textContent=selected==='llm'?'Authored, simulated model output':'Browser-local simulation';
const select=document.querySelector('#source-file');
for(const name of Object.keys(sources)){const option=document.createElement('option');option.value=name;option.textContent=name;select.append(option);}
const show=()=>document.querySelector('#host-source').textContent=new Map(Object.entries(sources)).get(select.value);select.addEventListener('change',show);show();
const tabs=[...document.querySelectorAll('[role="tab"]')];const panels=[...document.querySelectorAll('[role="tabpanel"]')];
function activate(tab,focus=false){for(const item of tabs){item.setAttribute('aria-selected',String(item===tab));item.tabIndex=item===tab?0:-1;}for(const panel of panels)panel.hidden=panel.id!==tab.getAttribute('aria-controls');if(focus)tab.focus();}
for(const [i,tab] of tabs.entries()){tab.addEventListener('click',()=>activate(tab));tab.addEventListener('keydown',e=>{const n={ArrowRight:(i+1)%4,ArrowLeft:(i+3)%4,Home:0,End:3}[e.key];if(n!==undefined){e.preventDefault();activate(tabs[n],true);}});}
const feedback=document.querySelector('#feedback');let mounted;
try{mounted=mountLab(document.querySelector('#interface'),selected,message=>feedback.textContent=message);const inspect=s=>{document.querySelector('#definition-json').textContent=JSON.stringify(s.definition,null,2);document.querySelector('#snapshot-json').textContent=JSON.stringify({revision:s.revision,state:s.state,data:s.data},null,2);};inspect(mounted.snapshot());mounted.subscribe(inspect);}catch{feedback.textContent='Could not mount the example. Reload to retry.';}
window.addEventListener('pagehide',()=>mounted?.dispose());window.addEventListener('pageshow',e=>{if(e.persisted)location.reload();});
