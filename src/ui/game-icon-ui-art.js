const p=(d,f='none',s='#302943',w=1.65)=>`<path d="${d}" fill="${f}" stroke="${s}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"/>`;
const r=(x,y,w,h,f,rx=2)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${f}" stroke="#302943" stroke-width="1.65"/>`;
const c=(x,y,n,f)=>`<circle cx="${x}" cy="${y}" r="${n}" fill="${f}" stroke="#302943" stroke-width="1.65"/>`;
const sun='#ffd85a', amber='#f3a548', aqua='#62def3', water='#669fff', lea='#79df8b', violet='#b691ff', berry='#ee78a7', paper='#fff1ce', coral='#ff776f', ash='#7a8aad';
const line=d=>p(d);
const chalk=d=>p(d,'none','#fff7e8',2);
const env=(f=paper)=>r(3,7,26,19,f)+p('M4 9l12 10L28 9','none')+line('m4 24 7-7m17 7-7-7');
const house=(f=water)=>p('M6 13h20v15H6z',f)+p('M2 14 16 3l14 11-3 3-11-9-11 9z',coral)+r(13,18,6,10,paper,1);
const badge=(color=amber)=>p('M7 4h7l4 10-6 3zm11 0h7l-5 13-6-3z',water)+c(16,20,9,color)+p('m16 14 2 4 4 .5-3 3 .7 4-3.7-2-3.7 2 .7-4-3-3 4-.5z',paper);
const lock=open=>r(6,14,20,15,open?aqua:sun)+p(open?'M11 14V9a5 5 0 0 1 10 0h4a9 9 0 0 0-18 0v5':'M11 14V9a5 5 0 0 1 10 0v5h4V9A9 9 0 0 0 7 9v5',ash)+c(16,20,2,'#403655')+line('M16 22v3');
const profile=(x,y,f)=>c(x,y,4,f)+p(`M${x-6} ${y+12}v-1a6 6 0 0 1 12 0v1z`,f);
const bulb=()=>p('M10 21a9 9 0 1 1 12 0l-2 3h-8z',sun)+r(12,24,8,4,aqua,1)+line('m12 13 4 5 4-5m-4 5v5');
const triangle=(f,reverse=false)=>p(reverse?'M24 5 6 16l18 11z':'M8 5l18 11L8 27z',f);
const glass=()=>c(13,12,8,aqua)+p('m18 18 3-3 10 11-4 4z',water)+chalk('M9 12a4 4 0 0 1 4-4');
const hour=(running=false)=>p('M7 5h18v2c0 5-4 7-7 9 3 2 7 4 7 9v2H7v-2c0-5 4-7 7-9-3-2-7-4-7-9z',aqua)+p(running?'M10 8h12l-6 7zm5 9h2v4h-2zm-3 8 4-2 4 2z':'M11 25l5-5 5 5zm1-14h8l-4 3z',running?amber:sun)+r(5,3,22,4,ash,1)+r(5,25,22,4,ash,1);
export const UI_ICON_ART={
 '🔆':p('M16 2l2 6 6-3-1 7 7 1-6 4 4 6-7-1-1 7-4-6-5 6-1-7-7 1 4-6-6-4 7-1-1-7 6 3z',amber)+c(16,16,7,sun),
 '🏠':house(),
 '⚙':p('m13 2 6 0 1 4 3 1 4-2 3 5-3 3v5l3 3-3 5-4-2-3 1-1 5h-6l-1-5-3-1-4 2-3-5 3-3v-5l-3-3 3-5 4 2 3-1z',ash)+c(16,16,5,aqua),
 '📊':r(3,3,26,26,paper)+r(7,16,4,9,aqua,1)+r(14,11,4,14,berry,1)+r(21,6,4,19,lea,1),
 '▶':triangle(lea),
 '🔒':lock(false),
 '✉':env(),
 '♟':c(16,8,5,violet)+p('M11 12h10l-2 6 6 6v4H7v-4l6-6z',violet)+line('M10 23h12'),
 '🌀':p('M16 3C30 2 33 22 21 27 9 34 0 22 4 13 7 5 20 6 23 13 25 20 18 24 13 20 9 17 13 12 17 13 12 16 16 20 19 16 17 11 11 11 8 16 4 24 15 28 22 22 29 15 23 5 16 3z',aqua),
 '🎒':p('M11 10V7a5 5 0 0 1 10 0v3h-3V7a2 2 0 0 0-4 0v3z',ash)+r(6,9,20,20,berry,5)+r(10,18,12,8,amber,2)+line('M12 21h8'),
 '📦':p('M3 10l13-6 13 6-13 6z',sun)+p('M3 10v12l13 6V16z',amber)+p('M29 10v12l-13 6V16z','#db8555')+p('m11 6 13 6v6l-4 2v-6l-13-6z',paper),
 '🎁':r(5,13,22,15,berry)+p('M16 12C3 10 7 1 12 5c2 1 3 5 4 7 1-2 2-6 4-7 5-4 9 5-4 7',sun)+r(3,11,26,6,coral,1)+p('M13 11h6v17h-6z',sun),
 '🔨':p('m16 9 5 5L9 29l-5-5z',amber)+p('M14 4l9-1 6 6-1 9-5 1-2-5-4 1-7-7z',ash)+chalk('m15 7 6-1'),
 '🔬':p('M11 4l6 1-2 6-6-1z',aqua)+p('M10 10l7 2-2 7-7-2z',water)+p('M19 12c11 2 10 13 2 15h-9v-4h8c4 0 5-6-1-7z',violet)+r(5,26,23,4,ash,1)+line('M6 20h13'),
 '💰':p('M12 10 8 4l5-2 3 2 4-2 4 3-4 5c13 8 12 20-4 20S0 18 12 10z',amber)+p('M10 10h12v3H10z',violet)+c(16,21,5,sun)+line('M16 18v6'),
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
 '⚠':p('M16 3 31 28H1z',sun)+p('M15 12h2v8h-2z','#302943')+c(16,24,1.3,'#302943'),
 '✖':p('m5 9 4-4 7 7 7-7 4 4-7 7 7 7-4 4-7-7-7 7-4-4 7-7z',coral),
 '✅':r(3,3,26,26,lea,6)+chalk('m8 16 5 5 10-11'),
 '◀':triangle(aqua,true),
 '🔍':glass(),
 '↩':p('M3 13 13 4v6h6q10 0 10 10v7h-6v-7q0-4-4-4h-6v6z',aqua),
 '💾':p('M4 4h20l4 4v20H4z',water)+r(9,4,13,9,ash,1)+r(8,17,16,11,paper,2)+line('M18 6v5'),
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
 '♾':p('M16 16c-3-5-6-7-9-7-8 0-8 14 0 14 3 0 6-2 9-7 3 5 6 7 9 7 8 0 8-14 0-14-3 0-6 2-9 7z','none','#302943',5)+p('M16 16c-3-5-6-7-9-7-8 0-8 14 0 14 3 0 6-2 9-7 3 5 6 7 9 7 8 0 8-14 0-14-3 0-6 2-9 7z','none',violet,2.7),
 '💡':bulb(),
 '🎮':p('M9 8h14q4 1 6 8l1 8q0 6-5 4l-6-5h-6l-6 5q-5 2-5-4l1-8q2-7 6-8z',water)+p('M8 12h4v4h4v4h-4v4H8v-4H4v-4h4z',paper)+c(22,15,2,lea)+c(25,19,2,berry),
};
