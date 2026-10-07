// The art gallery (dev only, ?gallery): every spot illustration, game drawing and Ball buddy on
// one page, both themes side by side, so a drawing can be checked without finding its screen.
import { useEffect } from 'react';
import { Spot, SPOT_KINDS } from '../components/Spot.jsx';
import { GameArt, GAME_ART_KINDS } from '../components/GameArt.jsx';
import { Scene, SCENE_KINDS } from '../components/Scenes.jsx';
import { GAMES } from '../lib/round.js';
import { SIDE_GAMES } from '../lib/round.js';

function Shelf({ title, children }) {
  return (
    <section style={{ marginBottom: 24 }}>
      <h2 className="d" style={{ fontSize: 18, margin: '0 0 10px' }}>{title}</h2>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>{children}</div>
    </section>
  );
}
const Cell = ({ label, children }) => (
  <figure style={{ margin: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, width: 92 }}>
    {children}
    <figcaption style={{ fontSize: 11, color: 'var(--mute)', textAlign: 'center' }}>{label}</figcaption>
  </figure>
);

function Panel({ theme }) {
  return (
    <div style={{ background: 'var(--canvas)', color: 'var(--ink)', padding: 16, minHeight: '100vh' }}>
      <Shelf title={`Scenes · ${theme}`}>
        {SCENE_KINDS.map(k => <div key={k} style={{ width: 375, height: 200, overflow: 'hidden', borderRadius: 12 }}><Scene kind={k} className="gallery-scene" /></div>)}
      </Shelf>
      <Shelf title={`Games · ${theme}`}>
        {GAME_ART_KINDS.map(k => <Cell key={k} label={GAMES[k]?.name || SIDE_GAMES[k]?.label || k}><div className="game-art-box"><GameArt game={k} size={56} /></div></Cell>)}
      </Shelf>
      <Shelf title={`On a card · ${theme}`}>
        {['banker', 'match', 'scramble', 'stableford', 'snake'].map(k => (
          <div key={k} className="game-tile" style={{ width: 150 }}>
            <span className="gt-top"><GameArt game={k} className="game-icon sm" /></span>
            <span className="gn">{GAMES[k].name}</span><span className="gs">{GAMES[k].players}</span>
          </div>
        ))}
      </Shelf>
      <Shelf title={`Spots · ${theme}`}>
        {SPOT_KINDS.map(k => <Cell key={k} label={k}><Spot kind={k} size={84} /></Cell>)}
      </Shelf>
    </div>
  );
}

/** ?gallery&theme=dark shows the dark theme (the tokens live on the root, so one theme a page). */
export default function Gallery() {
  const theme = new URLSearchParams(location.search).get('theme') === 'dark' ? 'dark' : 'light';
  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);
  return <Panel theme={theme} />;
}
