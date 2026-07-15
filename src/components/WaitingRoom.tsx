interface Props {
  code: string;
  onLeave: () => void;
}

export function WaitingRoom({ code, onLeave }: Props) {
  const link = `${window.location.origin}${window.location.pathname}?code=${code}`;

  return (
    <div className="card waiting-code">
      <div className="brand-sub">
        <span className="pulse-dot" />
        waiting for opponent
      </div>
      <div className="code-display">{code}</div>
      <div className="brand-sub">share this code, or send the link below</div>
      <div className="share-link">{link}</div>
      <div style={{ marginTop: 20 }}>
        <button className="btn-ghost" onClick={onLeave}>
          Cancel match
        </button>
      </div>
    </div>
  );
}
