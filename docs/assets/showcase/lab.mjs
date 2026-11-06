import { createMountedInterface } from '@veil-runtime/ui/dom';
import { validateInterfaceDefinition } from '@veil-runtime/ui/interface';

import { descriptor } from './lab-definition.mjs';
export function mountLab(target, kind, onError = () => {}) {
  const model = {scenario:'incident',health:'healthy',job:'idle',diagnostic:'Scheduler is ready; no infrastructure is connected.',history:['Ready'],form:{title:'',reason:''},message:''};
  let step = 'input', disposed = false, ticket = 0, ui;
  const allowed = ['next','approve','reject','retry','reset','run','stop','invalid'];
  const change = next => { if (disposed) return; const candidate=descriptor(kind,next,model); if (new TextEncoder().encode(JSON.stringify(candidate)).length>32768) throw Error('Descriptor too large'); validateInterfaceDefinition(candidate); if (ui.updateDefinition(candidate,ui.snapshot().revision)) step=next; };
  const initial=descriptor(kind,step,model); validateInterfaceDefinition(initial);
  ui=createMountedInterface(target,initial,{allowedActions:allowed,onError:()=>onError('Rendering failed. Reload to recover.'),onEvent(event){
    if(disposed || event.revision!==ui.snapshot().revision || event.source!==event.action || !allowed.includes(event.action)) return;
    try {
      if(kind==='llm') {
        if(event.action==='invalid') { try { validateInterfaceDefinition({id:'unsafe',actions:['unapproved'],screen:{key:'bad',component:'Script'}}); } catch { change('error'); } }
        else if(event.action==='next' && step==='input') { model.scenario=['incident','request','analysis'].includes(event.state.scenario) ? event.state.scenario : 'incident'; change('review'); }
        else if(event.action==='retry'||event.action==='reset') change('input');
        else if((event.action==='approve'||event.action==='reject')&&step==='review') { model.message=event.action === 'approve' ? 'Approved in this browser only.' : 'Rejected in this browser only.'; change('done'); }
      } else if(kind==='operations') {
        if(event.action==='reset') {ticket++;model.health='healthy';model.job='idle';model.history=['Ready'];model.diagnostic='Scheduler is ready; no infrastructure is connected.';}
        else if(event.action==='stop') {ticket++;model.health='degraded';model.job='failed';model.diagnostic='Simulated worker timeout. Retry is available.';model.history.push('Job failed: timeout');}
        else if(event.action==='run'||event.action==='retry') {const id=++ticket;model.job='running';model.history.push('Job started');setTimeout(()=>{if(disposed||ticket!==id)return;model.job='complete';model.health='healthy';model.diagnostic='Simulated job completed.';model.history.push('Job complete');change('input');},500);}
        model.history=model.history.slice(-20);change('input');
      } else {
        if(event.action==='next'&&step==='input') {const title=String(event.state.title||'').trim(),reason=String(event.state.reason||'').trim();if(!title||!reason||title.length>120||reason.length>500){onError('Enter a title and reason within the field limits.');return;}model.form={title,reason};change('review');}
        else if(event.action==='retry'&&step==='review') change('input');
        else if((event.action==='approve'||event.action==='reject')&&step==='review') {model.message=`Request ${event.action === 'approve' ? 'approved' : 'rejected'} in this browser only.`;change('done');}
        else if(event.action==='reset') {model.form={title:'',reason:''};change('input');}
      }
    } catch {onError('The candidate interface was rejected. The accepted interface remains available.');}
  }});
  return {snapshot:()=>ui.snapshot(),subscribe:listener=>ui.subscribe(listener),dispose(){disposed=true;ticket++;ui.dispose();}};
}
