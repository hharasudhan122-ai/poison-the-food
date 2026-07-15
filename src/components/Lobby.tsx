import { useEffect, useState } from 'react';
import { FOOD_PACKS } from '../lib/foodPacks';

interface Props {
  busy: boolean;
  error: string | null;
  onCreate: (foodPack: string) => void;
  onJoin: (code: string) => void;
}

export function Lobby({ busy, error, onCreate, onJoin }: Props) {
  const [code, setCode] = useState('');
  const [foodPack, setFoodPack] = useState(FOOD_PACKS[0].id);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fromLink = params.get('code');
    if (fromLink) setCode(fromLink.toUpperCase());
  }, []);

  return (
    <div className="card lobby-actions">
      <div>
        <div className="select-count" style={{ marginBottom: 10 }}>
          Choose the food for the plate (your opponent will see the same one)
        </div>
        <div className="pack-grid">
          {FOOD_PACKS.map((pack) => (
            <button
              key={pack.id}
              type="button"
              className={`pack-card ${foodPack === pack.id ? 'selected' : ''}`}
              onClick={() => setFoodPack(pack.id)}
            >
              <span className="pack-thumb">{pack.thumbnail}</span>
              <span>{pack.label}</span>
            </button>
          ))}
        </div>
      </div>

      <button className="btn-primary" onClick={() => onCreate(foodPack)} disabled={busy}>
        Create Match
      </button>

      <div className="divider">or</div>

      <div className="join-row">
        <input
          placeholder="ENTER CODE"
          value={code}
          maxLength={6}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
        />
        <button
          className="btn-secondary"
          disabled={busy || code.trim().length < 6}
          onClick={() => onJoin(code)}
        >
          Join
        </button>
      </div>

      {error && <div className="error-banner">{error}</div>}
    </div>
  );
}
