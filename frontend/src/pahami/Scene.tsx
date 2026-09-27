import type { Scene as SceneT } from '../api/types';
import type { Mood } from '../design/Nosi';
import { PhaseTag } from '../design/ui';
import { Html } from '../lib/html';
import { IntroObjectives, IntroSide, Reveal, VisualView } from './visuals';

/** One Pahami scene: kicker, serif title, narration, one visual, optional reveal checks. Used by the player and the Builder preview. */
export function SceneView({ scene, kicker, setMood, onProgress, className, sceneRef }: {
  scene: SceneT; kicker: string; setMood: (m: Mood) => void; onProgress?: (seen: number, total: number) => void;
  className?: string; sceneRef?: React.Ref<HTMLElement>;
}) {
  const v = scene.visual;
  const ctx = { setMood, onProgress };
  return (
    <section className={['scene', className].filter(Boolean).join(' ')} ref={sceneRef} aria-label={`Scene: ${scene.title.replace(/<[^>]+>/g, '')}`}>
      <div className="scene-kicker"><PhaseTag>Pahami</PhaseTag><span className="t-faint">{kicker}</span></div>
      {v?.type === 'intro' ? (
        <>
          <div className="row gap-6 mt-4" style={{ alignItems: 'center' }}>
            <div className="grow">
              <Html as="h1" html={scene.title} />
              {scene.lead && <Html as="p" className="lead" html={scene.lead} />}
              {scene.say && <Html as="p" className="say mt-3" html={scene.say} />}
            </div>
            <IntroSide v={v} />
          </div>
          <IntroObjectives v={v} />
        </>
      ) : (
        <>
          <Html as="h1" html={scene.title} />
          {scene.lead && <Html as="p" className="lead" html={scene.lead} />}
          {scene.say && <Html as="p" className="say mt-3" html={scene.say} />}
          {v && <VisualView v={v} ctx={ctx} />}
        </>
      )}
      {scene.reveals?.map((r, i) => <div className={i === 0 && v?.type !== 'cards' ? 'mt-4' : ''} key={i}><Reveal q={r.q} a={r.a} /></div>)}
    </section>
  );
}
