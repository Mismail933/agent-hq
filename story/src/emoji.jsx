// Ready-made props (2.54.0): Microsoft's Fluent Emoji, flat style (MIT licence, github.com/microsoft/fluentui-emoji), about 1,285
// objects, animals, foods, tools, vehicles and weather, so a story's things don't each need drawing by hand. story.ensure_app copies
// them into public/emoji/<name>.svg (from ~/.agent-hq-anim/fluent-emoji). They are flat without outlines; <Emoji> adds the kit's
// dark outline (a dilated silhouette behind the shape) so they sit with the cast. The SVG is read once and drawn inline (an <image>
// inside the scene's SVG could be drawn before it has loaded; delayRender holds the frame until it is there).
import React, {useEffect, useState} from 'react';
import {staticFile, delayRender, continueRender} from 'remotion';
import {INK} from './tis';

const cache = {};
export const emojiSlug = (name) => String(name || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

const load = (slug) => {
  if (!cache[slug]) {
    cache[slug] = fetch(staticFile('emoji/' + slug + '.svg')).then((r) => (r.ok ? r.text() : '')).then((t) => {
      const m = t.match(/<svg([^>]*)>([\s\S]*)<\/svg>/i);
      if (!m) return null;
      const vb = (m[1].match(/viewBox="([^"]+)"/i) || [])[1] || '0 0 32 32';
      // ids inside one emoji (clip paths) get its name, so two different emoji never share one
      const body = m[2].replace(/id="([^"]+)"/g, `id="${slug}-$1"`).replace(/url\(#([^)]+)\)/g, `url(#${slug}-$1)`).replace(/href="#([^"]+)"/g, `href="#${slug}-$1"`);
      return {vb, body};
    }).catch(() => null);
  }
  return cache[slug];
};

export function Emoji({name, x = 0, y = 0, size = 220, outline = 7, rot = 0, op = 1, flip = false}) {
  const slug = emojiSlug(name);
  const [data, setData] = useState(null);
  const [handle] = useState(() => delayRender('emoji ' + slug));
  useEffect(() => {
    let on = true;
    load(slug).then((d) => { if (on) setData(d); continueRender(handle); });
    return () => { on = false; };
  }, [slug, handle]);
  if (!data) return null;
  const [, , vw, vh] = data.vb.split(/[\s,]+/).map(Number);
  const k = size / Math.max(vw || 32, vh || 32);
  const fid = 'eo-' + slug;
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot}) scale(${flip ? -1 : 1} 1)`} opacity={op}>
      <filter id={fid} x="-20%" y="-20%" width="140%" height="140%">
        <feMorphology in="SourceAlpha" operator="dilate" radius={outline / k} result="d" />
        <feFlood floodColor={INK} />
        <feComposite in2="d" operator="in" result="o" />
        <feMerge><feMergeNode in="o" /><feMergeNode in="SourceGraphic" /></feMerge>
      </filter>
      <g transform={`scale(${k}) translate(${-(vw || 32) / 2} ${-(vh || 32) / 2})`} filter={outline ? `url(#${fid})` : undefined}
        dangerouslySetInnerHTML={{__html: data.body}} />
    </g>
  );
}
