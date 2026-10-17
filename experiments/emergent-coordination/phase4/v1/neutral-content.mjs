import { createHash } from 'node:crypto';
import { getEncoding } from 'js-tiktoken';

export const TOKENIZER_ENCODING = 'o200k_base';
export const TOKENIZER_PACKAGE = 'js-tiktoken';
export const TOKENIZER_VERSION = '1.0.21';

const encoder = getEncoding(TOKENIZER_ENCODING);
const colors = Object.freeze(['blue', 'coral', 'gray', 'green', 'lilac', 'red', 'teal', 'violet', 'white', 'yellow']);
const subjectShapes = Object.freeze(['circle', 'oval', 'pentagon', 'rectangle']);
const objectShapes = Object.freeze(['square', 'triangle', 'hexagon']);
const relations = Object.freeze(['above', 'below', 'beside', 'near', 'to the left of', 'to the right of']);
const participants = Object.freeze(['p0', 'p1', 'p2']);
const allowedTokens = new Set([
  'A', 'The', 'a', 'the', 'appears', 'has', 'outline', 'blue', 'coral', 'gray', 'green',
  'lilac', 'red', 'teal', 'violet', 'white', 'yellow', 'circle', 'oval', 'pentagon',
  'rectangle', 'square', 'triangle', 'hexagon', 'above', 'below', 'beside', 'near', 'to',
  'left', 'right', 'of', '.',
]);

function rng(seed) {
  let state = seed >>> 0 || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
}

export function propertyTokenCount(fieldName, value) {
  if (typeof fieldName !== 'string' || !fieldName) throw new TypeError('Invalid condition field');
  return encoder.encode(JSON.stringify({ [fieldName]: value })).length;
}

function neutralCandidates(seed, participant) {
  const participantIndex = participants.indexOf(participant);
  const facts = [];
  for (let colorIndex = 0; colorIndex < colors.length; colorIndex++) {
    for (let shapeIndex = 0; shapeIndex < subjectShapes.length; shapeIndex++) {
      const relation = relations[(colorIndex * 7 + shapeIndex * 3 + participantIndex) % relations.length];
      const targetColor = colors[(colorIndex * 3 + shapeIndex * 7 + seed) % colors.length];
      const targetShape = objectShapes[(colorIndex + shapeIndex * 2 + seed) % objectShapes.length];
      facts.push(`The ${colors[colorIndex]} ${subjectShapes[shapeIndex]} appears ${relation} the ${targetColor} ${targetShape}.`);
    }
  }
  const next = rng((seed * 65537 + (participantIndex + 1) * 104729) >>> 0);
  for (let index = facts.length - 1; index > 0; index--) {
    const other = Math.floor(next() * (index + 1));
    [facts[index], facts[other]] = [facts[other], facts[index]];
  }
  return facts;
}

function validateNeutralText(text) {
  if (typeof text !== 'string' || !text.length) throw new Error('Neutral note must be non-empty text');
  const words = text.match(/[A-Za-z]+|\./g) ?? [];
  if (words.some(word => !allowedTokens.has(word))) throw new Error('Neutral note contains a non-allowlisted word');
  if (/\b(?:p[0-9]|agent|peer|capabilit|task|goal|extract|refin|release|value|specimen|sealed|provider|message|send|share|coordinate|first|then|must|should|can|will)\b/i.test(text)) {
    throw new Error('Neutral note contains a prohibited identifier, hint, or instruction');
  }
  return true;
}

export function generateNeutralNote({ targetTokens, seed, participant }) {
  if (!Number.isSafeInteger(targetTokens) || targetTokens < 1 ||
      !Number.isSafeInteger(seed) || seed < 1 || !participants.includes(participant)) {
    throw new TypeError('Invalid neutral-note matching target');
  }
  const candidates = neutralCandidates(seed, participant);
  let states = new Map([[propertyTokenCount('notes', ''), []]]);
  for (let index = 0; index < candidates.length; index++) {
    const next = new Map(states);
    for (const [count, selected] of states) {
      if (count >= targetTokens) continue;
      const indices = [...selected, index];
      const note = indices.map(item => candidates[item]).join(' ');
      const actual = propertyTokenCount('notes', note);
      if (actual <= targetTokens && !next.has(actual)) next.set(actual, indices);
      if (actual === targetTokens) {
        validateNeutralText(note);
        return note;
      }
    }
    states = next;
  }
  throw new Error(`No neutral note matches ${targetTokens} tokens for seed ${seed}/${participant}`);
}

export function buildNeutralBank(directoryPayloads) {
  const entries = [];
  for (let seed = 33; seed <= 56; seed++) {
    const actors = directoryPayloads?.[seed];
    if (!actors || Object.keys(actors).sort().join(',') !== participants.join(',')) {
      throw new Error(`Missing peer-directory payloads for seed ${seed}`);
    }
    for (const participant of participants) {
      const targetTokens = propertyTokenCount('peerCapabilities', actors[participant]);
      const notes = generateNeutralNote({ targetTokens, seed, participant });
      const notesTokens = propertyTokenCount('notes', notes);
      if (notesTokens !== targetTokens) throw new Error('Neutral notes token mismatch');
      entries.push({ seed, participant, directoryPropertyTokens: targetTokens,
        notes, notesPropertyTokens: notesTokens,
        notesSha256: createHash('sha256').update(notes).digest('hex') });
    }
  }
  return { schemaVersion: 1, tokenizer: { package: TOKENIZER_PACKAGE,
    version: TOKENIZER_VERSION, encoding: TOKENIZER_ENCODING }, entries };
}

export { validateNeutralText };
