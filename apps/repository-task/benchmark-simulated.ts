// Offline fixtures only. Never included in a live model's context.
import { simulated, capabilityAction as a } from './trial.js';
import type { Condition } from './benchmark-tasks.js';
export const solutions: Record<string, string> = {
  'bounded-integer': 'export function parseBounded(text:string,min:number,max:number):number|null { const s=text.trim(), n=Number(s); return /^[+-]?\\d+$/.test(s) && Number.isSafeInteger(n) && Number.isSafeInteger(min) && Number.isSafeInteger(max) && n>=min && n<=max ? n : null; }',
  'group-totals': 'export function groupTotals(rows:{key:string;amount:number}[]) { const m=new Map<string,number>(); for(const r of rows) if(Number.isFinite(r.amount)) m.set(r.key,(m.get(r.key)??0)+r.amount); return [...m].map(([key,total])=>({key,total})); }',
  'interval-union': 'export function normalizeRanges(ranges:number[][]):number[][] { const out:number[][]=[]; for(const [s,e] of ranges.filter(r=>Number.isFinite(r[0])&&Number.isFinite(r[1])&&r[1]>r[0]).map(r=>[...r]).sort((a,b)=>a[0]-b[0])) { const last=out[out.length-1]; if(last&&s<=last[1]) last[1]=Math.max(e,last[1]); else out.push([s,e]); } return out; } export function coveredLength(ranges:number[][]) { return normalizeRanges(ranges).reduce((n,r)=>n+r[1]-r[0],0); }',
  'reservation-ledger': 'export function ledger(capacity:number,events:any[]) { const m=new Map<string,number>(); let available=capacity; for(const e of events) { if(e.type==="reserve"&&!m.has(e.id)&&Number.isInteger(e.quantity)&&e.quantity>0&&e.quantity<=available) { m.set(e.id,e.quantity); available-=e.quantity; } else if(e.type==="release"&&m.has(e.id)) { available+=m.get(e.id)!; m.delete(e.id); } } return {available,reservations:[...m].map(([id,quantity])=>({id,quantity}))}; }',
  'record-recovery': 'export function readRecords(lines:string[]) { const values:number[]=[],errors:number[]=[]; lines.forEach((s,i)=>{ try { const r=JSON.parse(s); if(!r||Array.isArray(r)||typeof r!=="object"||typeof r.value!=="number"||!Number.isFinite(r.value)) throw Error(); values.push(r.value); } catch { errors.push(i); } }); return {values,errors}; }',
};
export function offlineTransport(id: string, condition: Condition) {
  return simulated([a('workspace.list', {path:'.'}), a('workspace.list', {path:'src'}), a('workspace.read', {path:'src/task.ts'}),
    ...(condition === 'recovery' ? [a('verification.sandbox.run')] : []),
    a('workspace.write', {path:'src/task.ts',content:solutions[id]}), a('verification.sandbox.run'), '{"type":"finish"}']);
}
