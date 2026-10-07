// The art sheet (?art, also ?gallery): every drawing in the app on one page, by kind, each labelled
// with where it shows and its box, with a light / dark toggle. Trevor hands the link to whoever
// makes the on-brand set; the files come back into src/art (see src/art/README.md) and replace
// the hand-drawn ones here one by one. In every build, outside the app's own screens.
import { useEffect, useRef, useState } from 'react';
import { Spot, SPOT_KINDS } from '../components/Spot.jsx';
import { GameArt, GAME_ART_KINDS } from '../components/GameArt.jsx';
import { SceneArt, SCENE_KINDS } from '../components/Scenes.jsx';
import { BuddyArt } from '../components/BuddyArt.jsx';
import { ArtIcon, BallIllo } from '../components/ui.jsx';
import { ART_FILES, PULLED_SCENES } from '../lib/art-files.js';
import { ART_ICONS, ART_KINDS, ART_USES, PALETTE } from '../lib/art-manifest.js';
import { BUDDIES, backdropOf } from '../lib/avatars.js';
import { GAMES, SIDE_GAMES } from '../lib/round.js';
import { ONBOARD_GAMES } from '../lib/onboarding.js';

const GROUP_NAME = { Classics: 'ochre', 'Head to head': 'pink', Team: 'mint', 'Full round': 'lavender', Points: 'peach' };

/** Where a game's art shows, from the game itself. */
function gameUses(k) {
  const out = [];
  if (GAMES[k]) out.push('Choose a game (44px in the list, 40px on the tiles)');
  if (ONBOARD_GAMES.includes(k)) out.push('Set up, What does your group play? (40px)');
  if (SIDE_GAMES[k]) out.push('Side games sheet (36px)');
  return out;
}

/**
 * Save the SVG in `el` as a file: the theme's colours are written in for every var(--token), so
 * the file stands on its own. Text keeps its font name (Bricolage Grotesque).
 */
function downloadSvg(el, name) {
  if (!el) return;
  const clone = el.cloneNode(true);
  const cs = getComputedStyle(el);
  const fill = n => {
    for (const a of n.attributes || []) if (a.value.includes('var(--')) a.value = a.value.replace(/var\((--[a-z0-9-]+)\)/g, (m, v) => cs.getPropertyValue(v).trim() || m);
    for (const c of n.children) fill(c);
  };
  fill(clone);
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.removeAttribute('class'); clone.removeAttribute('width'); clone.removeAttribute('height');
  const url = URL.createObjectURL(new Blob([clone.outerHTML], { type: 'image/svg+xml' }));
  const a = document.createElement('a');
  a.href = url; a.download = `${name}.svg`; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** One drawing: the stage, the name, the file it maps to, where it shows, and a download. */
function Card({ kind, id, name, used, note, px, box, wide = false, round = false, children }) {
  const stage = useRef(null);
  const file = ART_FILES[`${kind}/${id}`];
  const pulled = kind === 'scenes' && PULLED_SCENES.has(id);
  const status = file ? ['file', 'Outside file in'] : pulled ? ['pulled', 'Pulled from the app'] : ['hand', 'Hand-drawn'];
  return (
    <figure className={`as-card ${wide ? 'wide' : ''}`.trim()}>
      <div ref={stage} className={`as-stage ${round ? 'round' : ''}`.trim()}>{children}</div>
      <figcaption>
        <div className="as-row"><span className="as-name">{name}</span><span className={`as-status ${status[0]}`}>{status[1]}</span></div>
        <div className="as-file">{kind}/{id}.svg · {box}{px ? ` · shows ${px}` : ''}</div>
        <ul className="as-used">{used.map(u => <li key={u}>{u}</li>)}</ul>
        {note && <div className="as-note">{note}</div>}
      </figcaption>
      <button type="button" className="as-dl" onClick={() => downloadSvg(stage.current?.querySelector('svg'), `${kind}-${id}`)}>Download SVG</button>
    </figure>
  );
}

function Section({ kind, count, children }) {
  const k = ART_KINDS.find(x => x.id === kind);
  return (
    <section className="as-section" id={kind}>
      <h2 className="d">{k.name} <span className="as-count">{count}</span></h2>
      <p className="as-kind-note"><b>{k.box}.</b> {k.note}</p>
      <div className="as-grid">{children}</div>
    </section>
  );
}

export default function ArtSheet() {
  const [theme, setTheme] = useState(() => (new URLSearchParams(location.search).get('theme') === 'dark' ? 'dark' : 'light'));
  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);
  const landed = Object.keys(ART_FILES).length;
  const scenes = SCENE_KINDS, spots = SPOT_KINDS, games = GAME_ART_KINDS;
  const buddies = BUDDIES.filter(b => b.shelf === 'buddies'), critters = BUDDIES.filter(b => b.shelf === 'critters');
  const total = scenes.length + spots.length + games.length + buddies.length + critters.length + ART_ICONS.length;
  return (
    <main className="art-sheet">
      <header className="as-top">
        <h1>Birdie Bank art sheet</h1>
        <nav className="as-jump">{ART_KINDS.map(k => <a key={k.id} href={`#${k.id}`}>{k.name}</a>)}</nav>
        <div className="as-seg" role="group" aria-label="Theme">
          {['light', 'dark'].map(t => <button key={t} type="button" className={theme === t ? 'on' : ''} aria-pressed={theme === t} onClick={() => setTheme(t)}>{t === 'light' ? 'Light' : 'Dark'}</button>)}
        </div>
      </header>
      <section className="as-intro">
        <p><b>{total} drawings</b> in six kinds, every one the app shows today, labelled with where it shows and how big. Flip the theme to see each on the dark canvas. {landed ? `${landed} outside file${landed === 1 ? '' : 's'} in so far.` : 'No outside files yet: everything here is hand-drawn in code.'}</p>
        <p>A new set drops in as one file per drawing, named as each card says, in <code>src/art/&lt;kind&gt;/</code>. SVG first (it scales and takes the theme), PNG or WebP at 3x if it must be a bitmap. Add <code>&lt;id&gt;.dark.svg</code> beside any drawing that needs its own dark version. The app picks each file up with no code change; a drawing with no file stays hand-drawn. Details in <code>src/art/README.md</code>.</p>
        <p className="as-style">The look so far: flat colour, soft rounded shapes, ink outlines on faces and details, the smiley golf ball as the hero, nothing photographic. The palette:</p>
        <div className="as-swatches">{PALETTE.map(([n, hex]) => <span key={hex} className="as-swatch"><i style={{ background: hex }} />{n} <code>{hex}</code></span>)}</div>
        <p className="as-style">Surfaces the drawings sit on: light canvas <code>#fffaf0</code> and cards <code>#ffffff</code>; dark canvas <code>#121615</code> and cards <code>#1a1f1e</code>.</p>
      </section>

      <Section kind="scenes" count={scenes.length}>
        {scenes.map(k => {
          const u = ART_USES[`scenes/${k}`];
          return (
            <Card key={k} kind="scenes" id={k} name={u.name} used={u.used} px={u.px} box="400 by 240" wide>
              <div className="as-phone"><svg className="scene" viewBox="0 0 400 240" preserveAspectRatio="xMidYMax slice" aria-hidden="true"><SceneArt kind={k} /></svg></div>
            </Card>
          );
        })}
      </Section>

      <Section kind="spots" count={spots.length}>
        {spots.map(k => { const u = ART_USES[`spots/${k}`]; return <Card key={k} kind="spots" id={k} name={u.name} used={u.used} note={u.note} box="120 by 120"><Spot kind={k} size={120} /></Card>; })}
      </Section>

      <Section kind="games" count={games.length}>
        {games.map(k => {
          const g = GAMES[k];
          const name = g?.name || SIDE_GAMES[k]?.label || k;
          const group = g ? `${g.group} (${GROUP_NAME[g.group]} backdrop)` : 'Side game (peach backdrop)';
          return <Card key={k} kind="games" id={k} name={name} used={gameUses(k)} note={group} box="64 by 64"><GameArt game={k} size={96} /></Card>;
        })}
      </Section>

      <Section kind="buddies" count={buddies.length}>
        {buddies.map(b => (
          <Card key={b.id} kind="buddies" id={b.id} name={b.name} used={['Avatars everywhere: seat tiles, Play, the Tab, Players, results (28 to 96px)', 'The picker in Set up and on your profile (56px)']} note={`Starts on ${b.bg} (${backdropOf(b.bg).hex})`} box="64 by 64" round>
            <BuddyArt id={b.id} bg={b.bg} />
          </Card>
        ))}
      </Section>

      <Section kind="critters" count={critters.length}>
        {critters.map(b => (
          <Card key={b.id} kind="critters" id={b.id} name={b.name} box="64 by 64" round note={`Starts on ${b.bg} (${backdropOf(b.bg).hex})`}
            used={['The picker’s Critters shelf and anywhere an avatar shows', ...(b.id === 'birdie' || b.id === 'eagle' ? ['Pops up on a score under par (28px) and in the scorecard key (22px)'] : [])]}>
            <BuddyArt id={b.id} bg={b.bg} />
          </Card>
        ))}
      </Section>

      <Section kind="icons" count={ART_ICONS.length}>
        {ART_ICONS.map(i => (
          <Card key={i.id} kind="icons" id={i.id} name={i.name} used={i.used} box={i.id === 'ball' ? '150 by 150' : '24 by 24'}>
            {i.id === 'ball' ? <BallIllo className="as-ball" /> : <span className="chip ochre as-chip"><ArtIcon name={i.id} /> {i.name.replace(/ tag$/, '')}</span>}
          </Card>
        ))}
      </Section>
    </main>
  );
}
