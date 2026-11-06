import test from 'node:test';
import assert from 'node:assert/strict';
import { validateInterfaceDefinition, createInterfaceController } from '@veil-runtime/ui/interface';
import { descriptor } from '../../docs/assets/showcase/lab-definition.mjs';
const model={scenario:'incident',health:'healthy',job:'idle',diagnostic:'Ready',history:['Ready'],form:{title:'Access',reason:'Investigate'},message:'Approved'};
test('all public lab descriptor transitions validate and update through UI',()=>{
  for(const [kind,steps] of [['llm',['input','review','error','done']],['operations',['input']],['workflow',['input','review','done']]]){
    let controller;
    for(const step of steps){const definition=descriptor(kind,step,model);validateInterfaceDefinition(definition);if(!controller)controller=createInterfaceController(definition,{allowedActions:definition.actions});else assert.equal(controller.updateDefinition(definition,controller.snapshot().revision),true);}
    controller.dispose();
  }
});
