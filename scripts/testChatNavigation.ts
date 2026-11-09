import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Source-level regression guards for chat navigation, viewport layering,
// accessibility and essential controls. The production build additionally
// validates React JSX and bundled styles. Real tap behavior still needs an
// interactive browser smoke test.
const chat = readFileSync('src/components/ChatSheet.tsx', 'utf8');
const css = readFileSync('src/components/ChatSheet.css', 'utf8');
const app = readFileSync('src/App.tsx', 'utf8');
const menu = readFileSync('src/components/MoreMenu.tsx', 'utf8');
const settings = readFileSync('src/components/SettingsModal.tsx', 'utf8');

const tests: Array<[string, boolean]> = [
  ['Chat has a dedicated Return button', chat.includes('id="close-chat-to-orb-btn"') && chat.includes('Back to RODEX home')],
  ['Chat has a visible Close button', chat.includes('id="close-chat-btn"') && chat.includes('aria-label="Close chat and return to RODEX"')],
  ['Close and Back invoke navigation', (chat.match(/onClose\(\)/g) || []).length >= 2],
  ['Dialog exposes accessible name', chat.includes('role="dialog"') && chat.includes('aria-labelledby="rodex-chat-title"')],
  ['Escape navigation implemented', chat.includes("event.key === 'Escape'")],
  ['Keyboard focus trapped and restored', chat.includes('handleDialogKeyboard') && chat.includes('previousFocus.focus')],
  ['Chat uses a body-level portal beyond clipped app shell', chat.includes('createPortal(') && chat.includes('document.body')],
  ['Chat is above all home controls and overlays', css.includes('z-index: 9999;')],
  ['Close is visibly labeled, including narrow screens', chat.includes('rodex-chat-close-label') && chat.includes('>Close</span>')],
  ['Home exit is visibly labeled', chat.includes('<span>Home</span>')],
  ['Body scrolling is restored after leaving chat', chat.includes('document.body.style.overflow = previousBodyOverflow')],
  ['Reader-position awareness keeps old messages readable', chat.includes('onScroll={onMessagesScroll}') && chat.includes('shouldFollowLatestRef.current')],
  ['Jump to latest is present when scrolled up', chat.includes('rodex-chat-jump') && chat.includes('Latest messages')],
  ['New chat action is always accessible', chat.includes('id="new-chat-session-btn"')],
  ['Search has an accessible label', chat.includes('aria-label="Search conversation messages"')],
  ['Primary close control is independent of scrollable actions', chat.includes('rodex-chat-primary') && chat.includes('rodex-chat-actions')],
  ['Mobile safe-area and overflow supported', css.includes('env(safe-area-inset-top)') && css.includes('env(safe-area-inset-bottom)')],
  ['Conversation messages stay scrollable', chat.includes('rodex-chat-messages min-h-0 flex-1 overflow-y-auto')],
  ['Multiline keyboard-composition-safe composer exists', chat.includes('<textarea') && chat.includes('isComposing')],
  ['Session history selectable by keyboard', chat.includes('aria-current={isCurrent') && chat.includes('key={session.id}')],
  ['Clearing conversation requires confirmation', chat.includes('confirmClear &&') && chat.includes('Clear messages')],
  ['Chat is connected to RODEX App close state', app.includes('onClose={() => setIsChatOpen(false)}')],
  ['Voice call action preserved in chat', chat.includes('onToggleLiveCall();')],
  ['Persistent footer Back to RODEX action is present', chat.includes('id="chat-footer-return-home-btn"') && chat.includes('>Back to RODEX home</span>')],
  ['Footer escape route remains visible on phones', css.includes('.rodex-chat-footer-nav') && css.includes('.rodex-chat-footer-home')],
  ['Hardware browser Back closes chat rather than leaving the app', chat.includes('window.history.pushState(') && chat.includes("window.addEventListener('popstate', handleDeviceBack)") && chat.includes('closeCallbackRef.current();')],
  ['Normal chat close restores browser history', chat.includes('window.history.back()') && chat.includes('closedByBrowserBack')],
  ['More menu close stays available when items scroll', menu.includes('sticky top-0') && menu.includes('overflow-y-auto overscroll-contain')],
  ['More menu declares modal semantics', menu.includes('aria-modal="true"') && menu.includes('aria-label="Close menu"')],
  ['Settings has accessible Close and Escape handling', settings.includes('aria-label="Close settings and return to RODEX"') && settings.includes("event.key !== 'Escape'")],
  ['Settings dialog has an accessible title', settings.includes('aria-labelledby="rodex-settings-title"') && settings.includes('id="rodex-settings-title"')],
];
let passed = 0;
for (const [name, ok] of tests) {
  assert.ok(ok, name);
  console.log(`PASS: ${name}`);
  passed++;
}
console.log(`RODEX chat UI regression: ${passed}/${tests.length} passed`);
