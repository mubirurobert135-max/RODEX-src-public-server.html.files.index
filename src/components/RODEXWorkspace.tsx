import React, { useState } from 'react';
import {
  ArrowRight, CalendarDays, Code2, FileText,
  Globe2, Mail, Maximize2, PanelRightClose, Settings2,
  Sparkles, Wrench, MessageSquare, Brain, Stethoscope,
} from 'lucide-react';
import type { AssistantState, TaskState } from '../types';
import { HumanoidPresence } from './HumanoidPresence';
import './RODEXWorkspace.css';

type Action = () => void;

interface RODEXWorkspaceProps {
  onClose: Action;
  onChat: Action;
  onResearch: Action;
  onCode: Action;
  onDocument: Action;
  onCreate: Action;
  onEmail: Action;
  onCalendar: Action;
  onMemory: Action;
  onDiagnostics: Action;
  onSettings: Action;
  onTools: Action;
  onAsk: (value: string) => void;
  onRobotClick: () => void | Promise<void>;
  state: AssistantState;
  taskState?: TaskState;
  audioLevel: number;
}

export const RODEXWorkspace: React.FC<RODEXWorkspaceProps> = ({
  onClose, onChat, onResearch, onCode, onDocument, onCreate,
  onEmail, onCalendar, onMemory, onDiagnostics, onSettings, onTools,
  onAsk, onRobotClick, state, taskState, audioLevel,
}) => {
  const [draft, setDraft] = useState('');
  const [showAll, setShowAll] = useState(false);
  const primary = [
    { title: 'Research', description: 'Explore the web with verifiable results', icon: Globe2, run: onResearch },
    { title: 'Code', description: 'Build and troubleshoot software projects', icon: Code2, run: onCode },
    { title: 'Documents', description: 'Work with files and written material', icon: FileText, run: onDocument },
    { title: 'Create', description: 'Images, video and creative work', icon: Sparkles, run: onCreate },
  ];
  const connected = [
    { title: 'Chat', icon: MessageSquare, run: onChat },
    { title: 'Email', icon: Mail, run: onEmail },
    { title: 'Schedule', icon: CalendarDays, run: onCalendar },
    { title: 'Memory', icon: Brain, run: onMemory },
    { title: 'Diagnostics', icon: Stethoscope, run: onDiagnostics },
    { title: 'Settings', icon: Settings2, run: onSettings },
    { title: 'All tools', icon: Wrench, run: onTools },
  ];
  const send = (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft.trim()) return;
    onAsk(draft.trim());
    setDraft('');
  };
  return (
    <section id="rodex-workspace" className="rodex-workspace" aria-label="RODEX intelligent workspace">
      <header className="rodex-workspace-head">
        <div className="rodex-workspace-title">
          <span className="rodex-workspace-eyebrow">RODEX AI</span>
          <h1>Workspace</h1>
          <p>Research, create and get things done with your assistant.</p>
        </div>
        <button type="button" className="rodex-workspace-close" onClick={onClose}
          title="Return to RODEX companion" aria-label="Close workspace and return to RODEX">
          <PanelRightClose size={19} aria-hidden="true"/>
          <span>Home</span>
        </button>
      </header>
      <div className="rodex-workspace-columns">
        <div className="rodex-workspace-main">
          <div className="rodex-workspace-section-head">
            <h2>What would you like to do?</h2>
          </div>
          <div className="rodex-workspace-feature-grid">
            {primary.map(item => {
              const Icon = item.icon;
              return (
                <button className="rodex-workspace-feature" type="button" key={item.title} onClick={item.run}>
                  <Icon aria-hidden="true" size={23} strokeWidth={1.7}/>
                  <strong>{item.title}</strong>
                  <span>{item.description}</span>
                  <ArrowRight className="rodex-workspace-feature-arrow" size={16} aria-hidden="true"/>
                </button>
              );
            })}
          </div>
          <div className="rodex-workspace-tools">
            <div className="rodex-workspace-section-head">
              <h2>Your connected capabilities</h2>
              <button className="rodex-workspace-more" type="button" aria-expanded={showAll}
                onClick={() => setShowAll(!showAll)}>
                {showAll ? 'Less' : 'See all'}
              </button>
            </div>
            <div className="rodex-workspace-shortcuts">
              {(showAll ? connected : connected.slice(0, 4)).map(item => {
                const Icon = item.icon;
                return <button className="rodex-workspace-shortcut" type="button" key={item.title} onClick={item.run}>
                  <Icon size={16} aria-hidden="true"/><span>{item.title}</span>
                </button>;
              })}
            </div>
          </div>
          <form className="rodex-workspace-ask" onSubmit={send}>
            <label htmlFor="rodex-workspace-input" className="sr-only">Ask RODEX a question or task</label>
            <input id="rodex-workspace-input" value={draft} onChange={event=>setDraft(event.target.value)}
              placeholder="Ask RODEX about this task..." type="text" autoComplete="off"/>
            <button type="submit" disabled={!draft.trim()} aria-label="Send question to RODEX">
              <ArrowRight size={19} aria-hidden="true"/>
            </button>
          </form>
        </div>
        <aside className="rodex-workspace-companion" aria-label="RODEX floating companion">
          <header className="rodex-workspace-companion-head">
            <span>RODEX</span>
            <button type="button" onClick={onClose} aria-label="Expand RODEX to full conversation">
              <Maximize2 size={18} aria-hidden="true"/>
            </button>
          </header>
          <div className="rodex-workspace-companion-visual">
            <HumanoidPresence compact state={state} taskState={taskState} audioLevel={audioLevel}
              onInteract={onRobotClick} onExpand={onClose}/>
          </div>
          <div className="rodex-workspace-companion-bottom">
            <button type="button" onClick={onChat}>
              <MessageSquare size={17} aria-hidden="true"/><span>Chat with RODEX</span>
            </button>
          </div>
        </aside>
      </div>
    </section>
  );
};
