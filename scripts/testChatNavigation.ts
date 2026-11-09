import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Source-level regression guards for chat navigation, viewport layering,
// accessibility and essential controls. The production build additionally
// validates React JSX and bundled styles. Real tap behavior still needs an
// interactive browser smoke test.
const chat = readFileSync('src/components/ChatSheet.tsx', 'utf8');
const css = readFileSync('src/components/ChatSheet.css', 'utf8');
const app = readFileSync('src/App.tsx', 'utf8');

const tests: Array<[string, boolean]> = [
  ['Chat has a dedicated Return button', chat.includes('id="close-chat-to-orb-btn"') && chat.includes('Back to RODEX home')],
  ['Chat has a visible Close button', chat.includes('id="close-chat-btn"') && chat.includes('aria-label="Close chat and return to RODEX"')],
  ['Close and Back invoke navigation', (chat.match(/onClose\(\)/g) || []).length >= 3],
  ['Dialog exposes accessible name', chat.includes('role="dialog"') && chat.includes('aria-labelledby="rodex-chat-title"')],
  ['Escape navigation implemented', chat.includes("event.key === 'Escape'")],
  ['Keyboard focus trapped and restored', chat.includes('handleDialogKeyboard') && chat.includes('previousFocus.focus')],
  ['Chat is above home header', css.includes('z-index: 120;') && !chat.includes('z-40 bg-black/95')],
  ['Primary close control is independent of scrollable actions', chat.includes('rodex-chat-primary') && chat.includes('rodex-chat-actions')],
  ['Mobile safe-area and overflow supported', css.includes('env(safe-area-inset-top)') && css.includes('env(safe-area-inset-bottom)')],
  ['Conversation messages stay scrollable', chat.includes('rodex-chat-messages min-h-0 flex-1 overflow-y-auto')],
  ['Multiline keyboard-composition-safe composer exists', chat.includes('<textarea') && chat.includes('isComposing')],
  ['Session history selectable by keyboard', chat.includes('aria-current={isCurrent') && chat.includes('key={session.id}')],
  ['Clearing conversation requires confirmation', chat.includes('confirmClear &&') && chat.includes('Clear messages')],
  ['Chat is connected to RODEX App close state', app.includes('onClose={() => setIsChatOpen(false)}')],
  ['Voice call action preserved in chat', chat.includes('onToggleLiveCall();')],
];
let passed = 0;
for (const [name, ok] of tests) {
  assert.ok(ok, name);
  console.log(`PASS: ${name}`);
  passed++;
}
console.log(`RODEX chat UI regression: ${passed}/${tests.length} passed`);
