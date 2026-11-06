import React from 'react';
import {
  BarChart3,
  ChevronRight,
  Code2,
  FileText,
  Grid2X2,
  Home,
  Image as ImageIcon,
  Layers,
  MessageSquare,
  Settings,
  Sparkles,
} from 'lucide-react';
import './RodexCockpit.css';

type Action = () => void;

interface RodexCockpitProps {
  onHome: Action;
  onChat: Action;
  onApps: Action;
  onLayers: Action;
  onSettings: Action;
  onCreate: Action;
  onWrite: Action;
  onGenerate: Action;
  onAnalyze: Action;
  onBuild: Action;
  onExplore: Action;
}

/**
 * The navigation and six floating glass controls from the approved RODEX
 * reference. Every action is connected to an existing feature; no false
 * placeholder controls. The visual stage is behind the character, not a
 * cropped picture or a static wallpaper.
 *
 * On narrow displays, all six feature cards remain available in a paired
 * grid beneath the robot. No tools are lost to responsive breakpoints.
 */
export const RodexCockpit: React.FC<RodexCockpitProps> = ({
  onHome, onChat, onApps, onLayers, onSettings,
  onCreate, onWrite, onGenerate, onAnalyze, onBuild, onExplore,
}) => {
  const side = [
    { label: 'Home', icon: Home, onClick: onHome, active: true },
    { label: 'Chat', icon: MessageSquare, onClick: onChat, active: false },
    { label: 'Apps', icon: Grid2X2, onClick: onApps, active: false },
    { label: 'Tools', icon: Layers, onClick: onLayers, active: false },
    { label: 'Settings', icon: Settings, onClick: onSettings, active: false },
  ];
  const left = [
    { label: 'Create', icon: Sparkles, onClick: onCreate },
    { label: 'Write', icon: FileText, onClick: onWrite },
    { label: 'Generate', icon: ImageIcon, onClick: onGenerate },
  ];
  const right = [
    { label: 'Analyze', icon: BarChart3, onClick: onAnalyze },
    { label: 'Build', icon: Code2, onClick: onBuild },
    { label: 'Explore', icon: Grid2X2, onClick: onExplore },
  ];

  return (
    <div className="rodex-cockpit" aria-label="RODEX home controls">
      <nav className="rodex-nav-rail" aria-label="Primary navigation">
        {side.map(({ label, icon: Icon, onClick, active }) => (
          <button
            key={label}
            type="button"
            aria-label={label}
            aria-current={active ? 'page' : undefined}
            className={`rodex-nav-rail-btn${active ? ' is-active' : ''}`}
            onClick={onClick}
            title={label}
          >
            <Icon aria-hidden="true" size={25} strokeWidth={1.75} />
          </button>
        ))}
      </nav>

      <div className="rodex-feature-column rodex-feature-left" aria-label="Creative features">
        {left.map(({ label, icon: Icon, onClick }) => (
          <button type="button" className="rodex-feature-button" key={label} onClick={onClick}>
            <Icon aria-hidden="true" className="rodex-feature-icon" strokeWidth={1.85} />
            <span>{label}</span>
            <ChevronRight aria-hidden="true" className="rodex-feature-chevron" strokeWidth={1.7} />
          </button>
        ))}
      </div>

      <div className="rodex-feature-column rodex-feature-right" aria-label="AI tools">
        {right.map(({ label, icon: Icon, onClick }) => (
          <button type="button" className="rodex-feature-button" key={label} onClick={onClick}>
            <Icon aria-hidden="true" className="rodex-feature-icon" strokeWidth={1.85} />
            <span>{label}</span>
            <ChevronRight aria-hidden="true" className="rodex-feature-chevron" strokeWidth={1.7} />
          </button>
        ))}
      </div>
    </div>
  );
};
