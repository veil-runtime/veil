import { createMountedInterface } from '@veil-runtime/ui/dom';
const heading = text => ({key:'heading',component:'Heading',text});
const status = {key:'status',component:'Status',text:{source:'data',path:'message'}};
const button = text => ({key:'action',component:'Button',text,action:'demo'});
const input = (key,label,inputType='text') => ({key,component:'Input',label,inputType,binding:{source:'state',path:key}});
const make = (id,children,state={},data={}) => ({id,actions:['demo'],state,data:{message:'Ready',...data},screen:{key:'root',component:'Stack',children:[...children,status]}});
const examples = {
 minimal:make('hello',[heading('Hello interface'),input('name','Your name'),button('Greet')],{name:''}),
 dashboard:make('dashboard',[heading('Service dashboard'),{key:'summary',component:'Text',text:'Local sample data — 3 services'}, {key:'services',component:'Table',binding:{source:'data',path:'services'},columns:[{key:'name',label:'Service'},{key:'state',label:'Status'}]},button('Refresh locally')],{},{services:[{name:'API',state:'Healthy'},{name:'Jobs',state:'Healthy'},{name:'Mail',state:'Review'}]}),
 form:make('contact',[heading('Contact request'),input('name','Name'),input('count','Seats','number'),input('consent','Contact me','checkbox'),button('Preview submission')],{name:'',count:1,consent:false}),
 review:make('review',[heading('Review deployment'),{key:'description',component:'Text',text:'Demonstration only: review staging release 42.'},input('note','Review note'),button('Record local approval')],{note:''}),
};
const editor=document.querySelector('#editor'), feedback=document.querySelector('#feedback'), preview=document.querySelector('#preview'), gallery=document.querySelector('#gallery');
let ui;
function report(error){ feedback.textContent=String(error.message || error).slice(0,500); }
function parse(){if(editor.value.length>32768 || new TextEncoder().encode(editor.value).length>32768)throw Error('Definition exceeds 32 KiB.');return JSON.parse(editor.value);}
function render(){try{const definition=parse(); if(ui)ui.updateDefinition(definition); else ui=createMountedInterface(preview,definition,{allowedActions:['demo'],onError:report,onEvent(event){try{ui.updateData({...ui.snapshot().data,message:event.state.name ? `Hello ${event.state.name}` : 'Local demo action recorded. No external operation executed.'},event.revision);}catch(error){report(error);}}});feedback.textContent='Rendered successfully.';}catch(error){report(error);}}
function reset(){ui?.dispose();ui=undefined;editor.value=JSON.stringify(examples[gallery.value],null,2);render();}
document.querySelector('#render').onclick=render;
document.querySelector('#reset').onclick=reset;
gallery.onchange=reset;
document.querySelector('#size').onchange=event=>preview.classList.toggle('mobile',event.target.value==='mobile');
document.querySelector('#copy').onclick=async()=>{try{parse();await navigator.clipboard.writeText(editor.value);feedback.textContent='Definition copied.';}catch(error){report(error);feedback.textContent+=' Select the editor text to copy manually.';}};
window.addEventListener('pagehide',()=>ui?.dispose());
reset();
