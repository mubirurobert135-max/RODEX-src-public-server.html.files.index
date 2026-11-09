import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { RODEX_APPROVED_PORTRAIT } from '../src/components/approvedAvatar';

const app = readFileSync('src/App.tsx', 'utf8');
const workspace = readFileSync('src/components/RODEXWorkspace.tsx', 'utf8');
const workspaceCss = readFileSync('src/components/RODEXWorkspace.css', 'utf8');
const humanoid = readFileSync('src/components/HumanoidPresence.tsx', 'utf8');
const humanoidCss = readFileSync('src/components/HumanoidPresence.css', 'utf8');
const scene3D = readFileSync('src/components/RODEX3DScene.tsx', 'utf8');
const immersiveCss = readFileSync('src/components/RodexImmersive.css', 'utf8');
const live = readFileSync('server/services/liveGeminiService.ts', 'utf8');
const speech = readFileSync('src/utils/speech.ts', 'utf8');
const server = readFileSync('server.ts', 'utf8');
const chatCss = readFileSync('src/components/ChatSheet.css', 'utf8');
const floating = readFileSync('src/components/RODEXFloatingCompanion.tsx', 'utf8');
const floatingCss = readFileSync('src/components/RODEXFloatingCompanion.css', 'utf8');

const imageBytes = Buffer.from(RODEX_APPROVED_PORTRAIT.split(',')[1] || '', 'base64');
const checks: [string, boolean][] = [
  ['Approved humanoid is available offline, using a real WebP image',
    RODEX_APPROVED_PORTRAIT.startsWith('data:image/webp;base64,') &&
    imageBytes.length > 5000 &&
    imageBytes.toString('ascii', 0, 4) === 'RIFF' &&
    imageBytes.toString('ascii', 8, 12) === 'WEBP'],
  ['New RODEX presence preserves original reference imagery',
    humanoid.includes('RODEX_APPROVED_PORTRAIT') &&
    humanoid.includes('rodex-human-portrait')],
  ['Character motion tied to assistant voice and task events',
    humanoid.includes("state === 'speaking'") && humanoid.includes('audioLevel') &&
    humanoid.includes("taskState === 'FAILED'")],
  ['Character click uses actual voice handler',
    app.includes('onInteract={handleOrbClick}') && humanoid.includes('onClick={onInteract}')],
  ['Adaptive floating character has expandable control',
    humanoid.includes('rodex-human-expand') && humanoid.includes('onClick={onExpand}')],
  ['Humanlike scene replaced old neon cockpit',
    app.includes('<HumanoidPresence') && !app.includes('<RodexCockpit')],
  ['Pure monochrome app background and all-white typography',
    immersiveCss.includes('.rodex-home.rodex-monochrome') &&
    immersiveCss.includes('background:#000 !important') &&
    immersiveCss.includes('color:#fff')],
  ['Workspace and compact companion are integrated into app',
    app.includes('<RODEXWorkspace') && app.includes('data-workspace=') &&
    workspace.includes('<HumanoidPresence compact')],
  ['Workspace actions use real app handlers, not dead buttons',
    app.includes('onResearch={() =>') && app.includes('onCode={() =>') &&
    app.includes('onEmail={() =>') && app.includes('onMemory={() =>') &&
    app.includes('onDiagnostics={() =>')],
  ['Existing chat retained, with visible close and return',
    app.includes('<ChatSheet') && app.includes('onClose={() => setIsChatOpen(false)}') &&
    chatCss.includes('rodex-chat-footer-home')],
  ['New home composer connected to live message dispatch',
    app.includes('className="rodex-command-bar"') && app.includes('handleSendMessage(command)')],
  ['Voice call uses original connected live service',
    app.includes('id="rodex-direct-voice-btn"') && app.includes('startLiveCall()') &&
    app.includes('endLiveCall()')],
  ['Natural feminine prebuilt voice chosen for live sessions',
    live.includes('voiceName: "Aoede"') && live.includes('RODEX HUMAN PRESENCE')],
  ['Local browser TTS respects explicit user voice selection',
    speech.includes('if (options.voiceURI)') &&
    speech.includes('selectedVoice =') && speech.includes('/aria|jenny|samantha')],
  ['Provider failure no longer presents fake success',
    !server.includes('My voice subsystems and live link remain verified and active') &&
    server.includes("I couldn't reach my AI service just now")],
  ['Floating companion portaled above tool dialogs but not chat',
    floating.includes('createPortal(') && floating.includes('document.body') &&
    floatingCss.includes('z-index:9500') && chatCss.includes('z-index: 9999')],
  ['Floating companion can expand, minimize and hide',
    floating.includes('Minimize RODEX companion') && floating.includes('Hide floating RODEX companion') &&
    floating.includes('onClick={onExpand}')],
  ['Floating companion appears only for active tool surfaces',
    app.includes('<RODEXFloatingCompanion') && app.includes("activeMode !== 'home'") &&
    app.includes('!isChatOpen')],
  ['Tools opened directly from Home retain floating RODEX',
    app.includes('active={!isChatOpen && (') &&
    app.includes("activeMode !== 'home'") &&
    app.includes('isMoreMenuOpen') &&
    !app.includes('active={isWorkspaceOpen && !isChatOpen')],
  ['RODEX now renders a genuine vertex-based WebGL2 3D bust',
    humanoid.includes('<RODEX3DScene') &&
    scene3D.includes("getContext('webgl2'") &&
    scene3D.includes('gl.drawElements(') &&
    scene3D.includes('gl.DEPTH_TEST') &&
    scene3D.includes('gl_Position') &&
    scene3D.includes('portraitShell(')],
  ['Approved RODEX identity is mapped to the real curved 3D face',
    scene3D.includes('RODEX_APPROVED_PORTRAIT') &&
    scene3D.includes('texImage2D(') &&
    scene3D.includes('uTextured') &&
    scene3D.includes('raw.head')],
  ['Articulated lips, eyelids and head gaze respond to real events',
    scene3D.includes('c.blink') &&
    scene3D.includes('c.mouth') &&
    scene3D.includes('c.yaw') &&
    scene3D.includes("state === 'speaking'") &&
    scene3D.includes('signalRef.current.audioLevel') &&
    scene3D.includes('onPointerMove=')],
  ['3D stage and camera fit wide, tall and compact layouts',
    scene3D.includes('ResizeObserver(') &&
    scene3D.includes('Math.max(vertical, horizontal)') &&
    scene3D.includes('window.devicePixelRatio') &&
    immersiveCss.includes('2026 adaptive 3D presence')],
  ['3D failure gracefully restores the original approved face',
    humanoid.includes('portrait-fallback') &&
    humanoid.includes('onUnavailable') &&
    humanoid.includes('rodex-human-portrait')],
  ['Reduced motion, hidden tabs and GPU resources are respected',
    scene3D.includes("prefers-reduced-motion: reduce") &&
    scene3D.includes('document.hidden') &&
    scene3D.includes('cancelAnimationFrame(raf)') &&
    scene3D.includes('engine.dispose()') &&
    humanoidCss.includes('transform: none !important;')],
  ['Browser speech animation follows real words rather than a fake sine',
    speech.includes('onBoundary?:') &&
    speech.includes('current.onboundary =') &&
    app.includes('onBoundary: (_charIndex, charLength) =>') &&
    !app.includes('Math.abs(Math.sin(elapsed * 6))')],
  ['Mobile workspace and portrait are responsive',
    workspaceCss.includes('@media(max-width:620px)') &&
    humanoidCss.includes('@media (max-width: 900px)')],
  ['Reduced motion supported for character and workspace',
    workspaceCss.includes('prefers-reduced-motion') && humanoidCss.includes('prefers-reduced-motion')],
];

let passed = 0;
for (const [name, result] of checks) {
  assert.ok(result, name);
  console.log('PASS:', name);
  passed++;
}
console.log(`RODEX human presence integration: ${passed}/${checks.length} checks passed`);
