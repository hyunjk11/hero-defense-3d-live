const p=(d,f='none',s='#292033',w=1.58)=>`<path d="${d}" fill="${f}" stroke="${s}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"/>`;
const r=(x,y,w,h,f,rx=2)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${f}" stroke="#292033" stroke-width="1.58"/>`;
const c=(x,y,n,f)=>`<circle cx="${x}" cy="${y}" r="${n}" fill="${f}" stroke="#292033" stroke-width="1.58"/>`;
const sun='#ffd85a', amber='#f3a548', aqua='#62def3', water='#669fff', lea='#79df8b', violet='#b691ff', berry='#ee78a7', paper='#fff1ce', coral='#ff776f', ash='#7a8aad';
const line=d=>p(d);
const chalk=d=>p(d,'none','#fff7e8',1.4);
const edge=d=>p(d,'none','#fff7db',.95);
const shade=d=>p(d,'none','#503449',1.15);
const env=(f=paper)=>r(2.7,6.6,26.6,19.4,f,3)+p('M4 23l9-8 3 2 3-2 9 8z',f)+p('M3 9q1-2 3-2h20q2 0 3 2L18 19q-2 2-4 0z',paper)+edge('M6 9h19')+c(16,19.2,2.65,coral);
const house=(f=water)=>p('M6 13 16 8l10 5v14l-8 3-12-3z',f)+p('M18 28V14l8-2v15z',water)+p('M5 14 15 3l13 7 2 5-4 2-10-8-10 9-4-3z',coral)+edge('M5 14 15 5l10 5')+p('M12 28V20q0-3 3-3t3 3v10z',amber)+r(7.7,18,3,4,paper,.5)+line('M16 23h.1');
const badge=(color=amber)=>p('M7 4h7l4 10-6 3zm11 0h7l-5 13-6-3z',water)+c(16,20,9,color)+p('m16 14 2 4 4 .5-3 3 .7 4-3.7-2-3.7 2 .7-4-3-3 4-.5z',paper);
const lock=open=>r(6,14,20,15,open?aqua:sun)+p(open?'M11 14V9a5 5 0 0 1 10 0h4a9 9 0 0 0-18 0v5':'M11 14V9a5 5 0 0 1 10 0v5h4V9A9 9 0 0 0 7 9v5',ash)+c(16,20,2,'#403655')+line('M16 22v3');
const profile=(x,y,f)=>c(x,y,4,f)+p(`M${x-6} ${y+12}v-1a6 6 0 0 1 12 0v1z`,f);
const bulb=()=>p('M10 21a9 9 0 1 1 12 0l-2 3h-8z',sun)+r(12,24,8,4,aqua,1)+line('m12 13 4 5 4-5m-4 5v5');
const triangle=(f,reverse=false)=>{const art=p('M7 7Q7 4 10 5l17 9q3 2 0 4l-17 9q-3 2-3-2z',f)+p('M8.3 24.8 26 16.7l-16.4 9.2z','#23765b','none')+edge('M10 8l12 6');return reverse?`<g transform="translate(32 0) scale(-1 1)">${art}</g>`:art;};
const glass=()=>p('m17 19 3-4 10 10q3 4-1 5l-4 0z',amber)+edge('m22 20 6 6')+c(13,12,9,ash)+c(13,12,6.6,aqua)+chalk('M9 12a4 4 0 0 1 4-4')+edge('M5 10a8 8 0 0 1 6-6');
const hour=(running=false)=>p('M7 5h18v2c0 5-4 7-7 9 3 2 7 4 7 9v2H7v-2c0-5 4-7 7-9-3-2-7-4-7-9z',aqua)+p(running?'M10 8h12l-6 7zm5 9h2v4h-2zm-3 8 4-2 4 2z':'M11 25l5-5 5 5zm1-14h8l-4 3z',running?amber:sun)+r(5,3,22,4,ash,1)+r(5,25,22,4,ash,1);
const icons={
 '🔆':p('M16 2l2 6 6-3-1 7 7 1-6 4 4 6-7-1-1 7-4-6-5 6-1-7-7 1 4-6-6-4 7-1-1-7 6 3z',amber)+c(16,16,7,sun),
 '🏠':house(),
 '⚙':p('M13 2h6l1 4 3 1 4-2 3 5-3 3v5l3 3-3 5-4-2-3 1-1 5h-6l-1-5-3-1-4 2-3-5 3-3v-5l-3-3 3-5 4 2 3-1z',ash)+edge('M7 9l2 1 5-2 1-3h3')+c(16,16,7.3,'#4d4965')+c(16,16,5,aqua)+edge('M13 15q0-2 2-3'),
 '📊':p('M5 4h22q2 0 2 2v22l-3 2H5q-2 0-2-2V6z',amber)+r(4,4,23,23,paper,2)+r(7,16,4.2,8,aqua,1)+r(13.5,12,4.2,12,violet,1)+r(20,7,4.2,17,lea,1)+edge('M8 17h2m5-4h2m5-5h2'),
 '▶':triangle(lea),
 '🔒':lock(false),
 '✉':env(),
 '♟':c(16,8,5,violet)+p('M11 12h10l-2 6 6 6v4H7v-4l6-6z',violet)+line('M10 23h12'),
 '🌀':p('M16 3C30 2 33 22 21 27 9 34 0 22 4 13 7 5 20 6 23 13 25 20 18 24 13 20 9 17 13 12 17 13 12 16 16 20 19 16 17 11 11 11 8 16 4 24 15 28 22 22 29 15 23 5 16 3z',aqua),
 '🎒':p('M9 9C6 8 3 11 2 17l-1 9 4 2 3-13m15-6c5 0 8 5 8 12v5l-4 2-3-13','#78445e')+p('M11 8V6a5 4 0 0 1 10 0v2h-3V6a2 1.7 0 0 0-4 0v2z',amber)+p('M4 25V15q0-9 9-9h6q9 1 9 9v10q0 4-4 4H8q-4 0-4-4Z',coral)+p('M5 14q2-8 9-8h4q7 0 9 8l-3 4H8z','#f79178')+edge('M8 11q1.8-3 6-3h4')+r(8,18,16,8,berry,2.7)+p('M12 18h8l-1 3h-6z',amber)+edge('M11 24h10'),
 '📦':p('M2 10l13-7 15 6-13 7z',sun)+p('M2 10v13l15 7V16z',amber)+p('M30 9v14l-13 7V16z','#ac5a4c')+p('m11 5 14 7v6l-4 2v-6L7 7z',paper)+edge('m4 13 10 5v8')+shade('M20 25l7-4'),
 '🎁':p('M4 13h24v13l-3 4H7l-3-4z',berry)+p('M16 12C4 11 5.5 2 11 3c3 1 4 5 5 8 1-3 2-7 5-8 5.5-1 7 8-5 9z',sun)+p('M5 11h22l3 2v6H2v-6z',coral)+p('M13 11h6v19h-6z',sun)+edge('M5 14h6m4 0v12m6-12h6')+shade('M5 22v4m22-4v4'),
 '🔨':p('m16 9 5 5L9 29l-5-5z',amber)+p('M14 4l9-1 6 6-1 9-5 1-2-5-4 1-7-7z',ash)+chalk('m15 7 6-1'),
 '🔬':p('M11 4l6 1-2 6-6-1z',aqua)+p('M10 10l7 2-2 7-7-2z',water)+p('M19 12c11 2 10 13 2 15h-9v-4h8c4 0 5-6-1-7z',violet)+r(5,26,23,4,ash,1)+line('M6 20h13'),
 '💰':p('M12 10 7 4l5-2 4 3 4-3 5 2-5 6q10 4 10 13 0 7-14 7T2 23q0-9 10-13z',amber)+p('M9 10q7-2 14 0v3q-7 2-14 0z',violet)+edge('M8 17q-3 2-3 5')+c(18,21,6,sun)+p('m18 17 3 4-3 4-3-4z',paper),
 '✨':p('M16 3l3 9 9 3-9 3-3 10-3-10-9-3 9-3z',sun)+p('M26 2l1 3 4 1-4 1-1 3-1-3-3-1 3-1z',aqua)+p('M5 22l1 2 3 1-3 1-1 3-1-3-3-1 3-1z',violet),
 '⚜':p('M16 2c-5 5-7 9-3 15-6-8-12-6-10-1 1 3 4 4 7 2l3 3-5 1 3 4 3-1 2 5 2-5 3 1 3-4-5-1 3-3c3 2 6 1 7-2 2-5-4-7-10 1 4-6 2-10-3-15z',sun)+line('M13 21h6'),
 '🎲':p('m5 6 22-1 1 22-22 1z',violet)+c(11,11,2,paper)+c(16,16,2,paper)+c(22,22,2,paper),
 '⚖':p('M14 6h4v20h-4zM8 26h16v3H8zM4 9h24v3H4z',sun)+line('m7 12-4 8m4-8 4 8m14-8-4 8m4-8 4 8')+p('M2 20h10q-5 9-10 0zm18 0h10q-5 9-10 0z',aqua)+c(16,6,3,amber),
 '🧾':p('M6 3l4 2 4-2 4 2 4-2 4 2v25l-4-2-4 2-4-2-4 2-4-2z',paper)+line('M10 10h12m-12 5h12m-12 5h7m3 0h2'),
 '👥':profile(22,11,violet)+profile(10,13,aqua),
 '📨':env(aqua)+p('M2 5h10V2l7 5-7 5V9H2z',sun),
 '📢':p('M11 11 26 4v23l-15-7z',sun)+r(3,11,10,9,water,2)+p('M8 20h4l3 8h-5z',violet)+line('M29 9l2-2m-2 9h2m-2 7 2 2'),
 '📜':p('M7 4h17q5 0 5 5v2h-6v11q0 6-5 6H5v-5h4V8Q10 5 7 4z',paper)+p('M18 28a4 4 0 0 1-4-4H3a4 4 0 0 0 4 4z',amber)+line('M13 12h7m-7 5h7'),
 '⛔':c(16,16,13,coral)+r(7,13,18,6,paper,1),
 '↔':p('m1 16 8-8v5h14V8l8 8-8 8v-5H9v5z',aqua),
 '💍':c(16,21,8,sun)+c(16,21,4,paper)+p('m8 8 4-5h8l4 5-8 8z',aqua)+line('M8 8h16m-12-5 4 13 4-13'),
 '🏅':badge(),
 '🧱':r(2,6,28,21,coral,1)+line('M2 13h28M2 20h28M11 6v7m10 0v7m-10 0v7'),
 '🔧':p('M21 3a8 8 0 0 0-8 10L3 23a4 4 0 1 0 6 6l10-11a8 8 0 0 0 10-8l-5 4-4-4 4-6z',ash)+line('m6 25 1 1'),
 '⌛':hour(),
 '✔':p('m2 17 4-4 7 7L25 7l5 4-17 17z',lea),
 '🎉':p('m5 27 5-19 14 15z',berry)+p('m8 18 9 8-5 1-5-5z',sun)+line('m19 10 5-5m-1 10 7 1m-13-9 1-4')+c(28,7,2,aqua)+c(29,23,2,lea),
 '📮':p('M9 5h14q4 0 4 4v20H5V9q0-4 4-4z',coral)+r(9,10,14,4,'#4b3f5a',1)+r(10,18,12,6,paper,1),
 '⚠':p('M16 3 31 28H1z',sun)+p('M15 12h2v8h-2z','#292033')+c(16,24,1.3,'#292033'),
 '✖':p('m5 9 4-4 7 7 7-7 4 4-7 7 7 7-4 4-7-7-7 7-4-4 7-7z',coral),
 '✅':r(3,3,26,26,lea,6)+chalk('m8 16 5 5 10-11'),
 '◀':triangle(aqua,true),
 '🔍':glass(),
 '↩':p('M3 13 13 4v6h6q10 0 10 10v7h-6v-7q0-4-4-4h-6v6z',aqua),
 '💾':p('M3 3h22l4 4v21q0 1-2 1H4q-1 0-1-1z',water)+r(8,3,15,9,ash,1)+r(7,16,18,13,paper,3)+r(17,4.5,3.5,5,'#41374e',.5)+edge('M5.5 8v14m4-4h12')+shade('M11 22h10m-10 3h7'),
 '➕':p('M12 3h8v9h9v8h-9v9h-8v-9H3v-8h9z',lea),
 '✂':p('m13 21 15-17c1 6-4 12-9 15l-4 4zm7 0L4 4c-1 6 4 12 9 15l4 4z',ash)+c(10,25,5,coral)+c(22,25,5,coral)+c(10,25,2,paper)+c(22,25,2,paper),
 '📈':r(3,3,26,26,paper)+line('M7 8v17h17')+p('m8 21 6-8 5 3 3-7-3-1 7-3v8l-2-2-4 9-5-3-5 6z',lea),
 '👍':r(2,13,7,14,aqua,1)+p('M9 14l5-6 1-5q6 0 5 7l-1 4h8q3 0 3 4l-3 8q-1 3-4 3l-14-2z',sun),
 '🗺':p('M3 7 11 4l10 3 8-3v21l-8 3-10-3-8 3z',paper)+line('M11 4v21M21 7v21')+p('m6 21 9-10 4 8 7-6','none','#64ae82',2)+p('m23 10 4 4m0-4-4 4','none',coral,2),
 '🏆':p('M10 8H3v4q1 9 9 7m10-11h7v4q-1 9-9 7',sun)+p('M8 4h16v7q0 8-6 11v3h6v4H8v-4h6v-3q-6-3-6-11z',amber)+chalk('M12 8h8'),
 '🏪':r(5,12,22,16,paper)+p('M3 12 7 5h18l4 7v5H3z',coral)+line('M9 12v5m7-5v5m7-5v5')+r(17,19,7,9,aqua,1)+r(8,20,6,4,water,1),
 '🏳':p('M7 4q7-4 13 0t9 1v14q-4 2-9-1t-13 0z',paper)+p('M4 3h3v27H4z',ash),
 '🔁':p('M6 13V9q0-3 4-3h11V2l9 7-9 7v-4H11v3H6zm20 6v4q0 3-4 3H11v4l-9-7 9-7v4h10v-3z',aqua),
 '📖':p('M3 5q8-3 13 2 5-5 13-2v21q-8-2-13 2-5-4-13-2z',paper)+line('M16 7v20m-10-15q4-1 7 1m-7 4q4-1 7 1m6-5q4-2 7-1m-7 6q4-2 7-1'),
 '🔓':lock(true),
 '⌨':r(2,7,28,19,ash,3)+p('M6 11h3m3 0h3m3 0h3m3 0h2M6 16h3m3 0h3m3 0h3m3 0h2M9 21h14','none',paper,2),
 '↗':p('M6 26 3 23 19 7h-7V2h17v17h-5v-8z',lea),
 '⏱':r(13,2,6,5,ash,1)+p('m22 8 3-3 3 3-3 3z',ash)+c(16,18,11,aqua)+line('M16 11v7l5 3'),
 '🏡':house(amber)+c(26,21,4,lea)+c(24,24,4,lea)+line('M27 24v5'),
 '⏳':hour(true),
 '💳':r(2,6,28,20,violet,3)+p('M3 11h26v5H3z','#4c3d75')+r(6,19,6,4,sun,1)+chalk('M19 21h6'),
 '👤':profile(16,9,aqua)+p('M8 27q0-8 8-8t8 8z',water),
 '▫':r(9,9,14,14,paper,3),
 '📅':r(4,6,24,23,paper,3)+p('M4 8q0-2 3-2h18q3 0 3 2v6H4z',coral)+line('M10 3v7m12-7v7M9 19h3m3 0h3m3 0h3M9 24h3m3 0h3m3 0h3'),
 '🥇':badge(sun),
 '🥈':badge('#bbd7ea'),
 '🥉':badge('#e79a6b'),
 '♾':p('M16 16c-3-5-6-7-9-7-8 0-8 14 0 14 3 0 6-2 9-7 3 5 6 7 9 7 8 0 8-14 0-14-3 0-6 2-9 7z','none','#292033',5)+p('M16 16c-3-5-6-7-9-7-8 0-8 14 0 14 3 0 6-2 9-7 3 5 6 7 9 7 8 0 8-14 0-14-3 0-6 2-9 7z','none',violet,2.7),
 '💡':bulb(),
 '🎮':p('M9 7h14q5 1 6 8l2 8q0 6-5 5l-7-5h-6l-7 5q-5 1-5-5l2-8q1-7 6-8z',violet)+p('M2 23l4 3 7-5h6l7 5 4-3q1 6-4 5l-7-5h-6l-7 5q-5 1-4-5z','#503449','none')+edge('M6 11q2-2 5-2h10')+p('M8 12h4v3h3v4h-3v3H8v-3H5v-4h3z',paper)+c(22,14,2.25,lea)+c(25,18,2.25,berry),
};

// Engraved material swatches. Every sprite has its own radial lighting, shade,
// and selective rim marks; swatches stay self-contained inside its SVG image.
const materials={
 [sun]:['honey','#fff7b0','#ffce52','#ae591d'],[amber]:['brass','#ffd48b','#e9a147','#9e492e'],
 [aqua]:['ice','#d0fcff','#53dbe9','#117b9e'],[water]:['sapphire','#badbff','#5f9be9','#2c479c'],
 [lea]:['jade','#d5ffc3','#7ee494','#277651'],[violet]:['amethyst','#dfcbff','#a583e8','#553a95'],
 [berry]:['rose','#ffd0df','#ed75ad','#9b3969'],[paper]:['enamel','#fffbea','#ffecd0','#be8b54'],
 [coral]:['scarlet','#ffd0a3','#ff746b','#a2304d'],[ash]:['silver','#dae2ef','#8795bd','#4e4e70'],
};
function glaze(raw){
 const used=new Set();
 const body=raw.replace(/fill="(#[a-f0-9]+)"/gi,(prop,color)=>{
  const swatch=materials[color];if(!swatch)return prop;used.add(swatch);
  return 'fill="url(#ui-'+swatch[0]+')"';
 });
 const defs=[...used].map(([id,light,mid,dark])=>`<radialGradient id="ui-${id}" cx=".27" cy=".15" r=".96"><stop stop-color="${light}"/><stop offset=".48" stop-color="${mid}"/><stop offset="1" stop-color="${dark}"/></radialGradient>`).join('');
 return (defs?`<defs>${defs}</defs>`:'')+body;
}
export const UI_ICON_ART=Object.fromEntries(Object.entries(icons).map(([key,value])=>[key,glaze(value)]));
