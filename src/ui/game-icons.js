// Presentation only: keep the authored Unicode and the control's native name.
// Painted backgrounds never become a pointer target or replace application data.
import { GAME_ICON_ART, CLEAR_STAR_ART } from './game-icon-art.js';

const prefilter = /[\p{Extended_Pictographic}\p{Regional_Indicator}\u20e3★☆✦✧♛♜☰♫]/u;
const fallback = /(?:\p{Regional_Indicator}{2}|[#*0-9]\ufe0f?\u20e3|[\p{Extended_Pictographic}★☆✦✧♛♜☰♫][\ufe0e\ufe0f]?\p{Emoji_Modifier}?(?:\u200d\p{Extended_Pictographic}[\ufe0e\ufe0f]?\p{Emoji_Modifier}?)*)/gu;
const segmenter = typeof Intl.Segmenter === 'function' ? new Intl.Segmenter(undefined,{granularity:'grapheme'}) : null;
const canonical = value => value.replace(/[\ufe0e\ufe0f]/g,'');
const boundaries = 'canvas,svg,script,style,textarea,input,select,option,datalist,[contenteditable],[data-native-emoji],game-icon-run,game-icon';
function svgImage(art) {
  const viewBox = typeof art === 'object' && /^-?(?:\d+(?:\.\d+)?\s+){3}\d+(?:\.\d+)?$/.test(art?.viewBox) ? art.viewBox : '0 0 32 32';
  const body = typeof art === 'string' ? art : art.body;
  return 'url("data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="'+viewBox+'" width="32" height="32">'+body+'</svg>')+'")';
}
export function iconMatches(value, art=GAME_ICON_ART) {
  if (!prefilter.test(value)) return [];
  const parts = segmenter ? segmenter.segment(value) : [...value.matchAll(fallback)].map(m=>({index:m.index,segment:m[0]}));
  const picked = [];
  for (const {segment,index} of parts) {
    const key=canonical(segment);
    if (Object.hasOwn(art,key)) picked.push({segment,index,key});
  }
  return picked;
}

export function installGameIcons(doc=document, art=GAME_ICON_ART, classic=null) {
  const root=doc.body, rootStyle=doc.documentElement.style, images=new Map();
  if (!root || root.classList.contains('drawn-game-icons')) return null;
  if (art===GAME_ICON_ART) rootStyle.setProperty('--drawn-clear-star',svgImage(CLEAR_STAR_ART));
  const image = key => {
    if (!images.has(key)) {
      const picture=classic && Object.hasOwn(classic,key) ? classic[key] : null;
      images.set(key,picture ? 'url("data:image/webp;base64,'+picture+'")' : svgImage(art[key]));
    }
    return images.get(key);
  };
  for (const [key,name] of [['⚒','tools'],['💀','skull'],['★','level-star']]) {
    if (Object.hasOwn(art,key)) rootStyle.setProperty('--drawn-'+name,image(key));
  }
  function replace(node) {
    const value=node.data, hits=iconMatches(value,art); if (!hits.length) return;
    const run=doc.createElement('game-icon-run');
    let start=0;
    for(const {segment,index,key} of hits){
      if(index>start)run.append(doc.createTextNode(value.slice(start,index)));
      const icon=doc.createElement('game-icon');icon.style.setProperty('--drawn-icon',image(key));
      // Keep the original grapheme in flow: it owns the width, line height
      // and baseline on every font/OS, but never paints over the artwork.
      const metric=doc.createElement('game-icon-metric');metric.textContent=segment;
      icon.append(metric);run.append(icon);start=index+segment.length;
    }
    if(start<value.length)run.append(doc.createTextNode(value.slice(start)));
    node.replaceWith(run);
  }
  function cleanTitle(node) {
    const value=node.getAttribute('title'); if (!value || !prefilter.test(value)) return;
    let clean=value;
    for (const {index,segment} of iconMatches(value,art).reverse()) {
      const before=clean.slice(0,index),after=clean.slice(index+segment.length);
      clean=before.replace(/\s+$/u,' ')+after.replace(/^\s+/u,before&&/\s$/u.test(before)?'':' ');
    }
    // Icon-only native titles are not decorative; preserve their usable name.
    if (clean!==value && /[\p{L}\p{N}]/u.test(clean)) node.setAttribute('title',clean.trim());
  }
  function visit(node, skipChecked=false) {
    if(!skipChecked&&!root.contains(node))return;
    if(node.nodeType===3){
      if(prefilter.test(node.data)&&(skipChecked||!node.parentElement.closest(boundaries)))replace(node);
      return;
    }
    if(node.nodeType!==1 || (skipChecked?node.matches(boundaries):node.closest(boundaries)))return;
    cleanTitle(node);
    // Walk the original siblings; replacement never queues its own children.
    for(let item=node.firstChild;item;){const next=item.nextSibling;visit(item,true);item=next;}
  }
  root.classList.add('drawn-game-icons');visit(root);
  const observer=new doc.defaultView.MutationObserver(records=>{
    for (const entry of records) {
      if (entry.type==='characterData') visit(entry.target);
      else for (const item of entry.addedNodes) visit(item);
    }
  });
  observer.observe(root,{subtree:true,childList:true,characterData:true});
  return observer;
}
if (typeof document !== 'undefined') {
  void import('./game-icon-classic-art.js').then(
    ({CLASSIC_ICON_ART}) => installGameIcons(document, GAME_ICON_ART, CLASSIC_ICON_ART),
    () => installGameIcons()
  );
}
