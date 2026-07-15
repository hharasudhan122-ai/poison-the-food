interface Props {
  busy: boolean;
  onResume: () => void;
  onDiscard: () => void;
}

export function ResumePrompt({ busy, onResume, onDiscard }: Props) {
  return (
    <div className="card lobby-actions">
      <h2 className="phase-heading">Unfinished match found</h2>
      <p className="phase-sub">Pick up where you left off, or start fresh.</p>
      <button className="btn-primary" onClick={onResume} disabled={busy}>
        Resume match
      </button>
      <button className="btn-secondary" onClick={onDiscard} disabled={busy}>
        Start new instead
      </button>
    </div>
  );
}
