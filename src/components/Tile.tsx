import type { RevealedTile } from '../types';

interface Props {
  food: string;
  isMyPoison: boolean;
  selected: boolean;
  revealed?: RevealedTile;
  clickable: boolean;
  onClick: () => void;
  /** True when a 3D model is rendering behind this tile — hides the emoji so it doesn't double up. */
  hideFront?: boolean;
}

export function Tile({ food, isMyPoison, selected, revealed, clickable, onClick, hideFront }: Props) {
  const classes = ['tile'];
  if (revealed) classes.push('flipped');
  if (selected) classes.push('poison-selected');
  if (clickable && !revealed) classes.push('selectable');
  else if (!clickable && !revealed) classes.push('locked');
  if (hideFront) classes.push('tile-3d');

  return (
    <div className={classes.join(' ')} onClick={clickable && !revealed ? onClick : undefined}>
      <div className="tile-face front">
        {!hideFront && <span>{food}</span>}
        {isMyPoison && <div className="poison-marker" title="Your poison" />}
      </div>
      {revealed && (
        <div className={`tile-face back ${revealed.result}`}>
          <span className="icon">{revealed.result === 'poison' ? '💀' : '✅'}</span>
        </div>
      )}
    </div>
  );
}
