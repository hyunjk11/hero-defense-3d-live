// Original 24 × 24 vector artwork. Paths use a shared dark outline, luminous
// color palette and occasional specular marks so the icons read at HUD sizes.
const D='#201b30', G='#ffd46f', L='#fff1ad', R='#ff737b', B='#75d9ff', W='#f3f9ff', V='#bea1ff', E='#83eab1', M='#a87449';
const shape=(d,f=G,s=D,w=1.2)=>`<path d="${d}" fill="${f}" stroke="${s}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
const line=(d,s=W,w=1.6)=>shape(d,'none',s,w);
const circle=(x,y,r,f=G,s=D)=>`<circle cx="${x}" cy="${y}" r="${r}" fill="${f}" stroke="${s}" stroke-width="1.2"/>`;
const rect=(x,y,w,h,f=G,r=2,s=D)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${f}" stroke="${s}" stroke-width="1.2"/>`;
const tilt=(a,x)=>`<g transform="rotate(${a} 12 12)">${x}</g>`;
const heart=(f=R)=>shape('M12 21C9 18 2 14 2 8a5 5 0 0 1 10-1 5 5 0 0 1 10 1c0 6-7 10-10 13z',f);
const boneFace=(f=M,ears='M3 10L2 4l6 3h8l6-3-1 6')=>shape(ears,f)+shape('M3 10q0-5 9-5t9 5v5q-2 6-9 7-7-1-9-7z',f)+circle(8,12,1.2,D,D)+circle(16,12,1.2,D,D)+shape('M9 15l3-2 3 2-3 3z',R)+line('M10 19q2 1 4 0',D,1.2);
const paw=(f=M)=>shape('M5 18q1-4 5-6 2-1 4 0 4 2 5 6 1 4-4 3-3-2-6 0-5 1-4-3z',f)+circle(4,10,2.4,f)+circle(9,6,2.5,f)+circle(15,6,2.5,f)+circle(20,10,2.4,f);
const plant=(f=E)=>shape('M3 19Q3 3 21 3q0 17-15 17z',f)+line('M3 22L16 9M8 16l-1-4m5 1h4',D,1.2);

import { UI_ICON_ART } from './game-icon-ui-art.js';
import { COMBAT_ICON_ART } from './game-icon-combat-art.js';

const tree=(pine=false)=>pine
 ?rect(10,17,4,5,M,1)+shape('M12 2l7 8h-3l5 7h-4l3 3H4l3-3H3l5-7H5z','#76d1a4')+line('M12 7v11','#b8f6bd',1.1)
 :rect(10,13,4,9,M,1)+shape('M5 16q-6-3-1-8-1-6 5-5 3-4 7 0 5-1 5 4 4 5 0 8-4 4-9 2-4 2-7-1z','#79d493')+line('M8 7q2-2 5-2',L,1.15);
const stars='M12 2l2.9 6.4 7 .9-5.2 4.8 1.4 7L12 17.5 5.9 21l1.4-6.9L2 9.3l7.1-.9z';
const four='M12 2l2.3 7.7L22 12l-7.7 2.3L12 22l-2.3-7.7L2 12l7.7-2.3z';
const nature={
 '♛':shape('M3 6l4 4 5-7 5 7 4-4-2 13H5z',V)+line('M6 16h12',W)+circle(12,13,1.5,G),
 '♜':shape('M5 22V10H3V3h5v3h2V3h4v3h2V3h5v7h-2v12z',V)+shape('M9 22v-4a3 3 0 0 1 6 0v4z',D)+line('M7 10h10M7 13h10',W,1),
 '☰':line('M5 6h14M5 12h14M5 18h14',L,2.5),
 '★':shape(stars,G),'☆':shape(stars,'none',G,1.5),'✦':shape(four,L),'✧':shape(four,'none',L,1.5),
 '🗼':shape('M11 2h2l1 5v4l7 11H3l7-11V7z','#f27b69')+shape('M8 22l4-6 4 6z','#302943')+line('M9 12h6m-10 7h14m-9-9h4M12 3v4',L,1.35),
 '🦇':shape('M12 9l-3-4-2 5-6-4 3 12 3-2 5 5 5-5 3 2 3-12-6 4-2-5z',V)+circle(10,13,1,R)+circle(14,13,1,R),
 '🍃':plant()+shape('M4 10Q3 3 12 2q-1 4-6 8z','#b6f385'),
 '🌿':line('M3 22L18 4',E,2)+shape('M8 16Q1 14 3 8q6 0 7 6z','#6bcf91')+shape('M12 13q3-8 11-7-2 7-11 8z','#a7ef91')+shape('M13 10Q7 6 13 1q4 4 1 8z',E)+shape('M6 19q4-4 10-2-4 5-10 3z','#a7ef91'),
 '🦅':shape('M3 20l2-9Q6 2 13 2q7 1 7 7l3 4-5 2-5 6z',W)+shape('M17 8l6 5-6 2z',G)+circle(14,8,1.2,D,D),
 '🦊':boneFace('#f69d60','M3 10L2 2l7 5h6l7-5-1 8')+shape('M5 13l7 5 7-5-3 7H8z',W,D,.55)+circle(12,17,1.1,D,D),
 '🦌':line('M6 10L4 5 2 3m2 2V2m3 5 1-4m10 7 2-5 2-2m-2 2V2m-3 5-1-4',M,1.8)+shape('M5 10l4-2h6l4 2-2 8-5 4-5-4z','#dba477')+circle(9,13,1,D,D)+circle(15,13,1,D,D)+circle(12,18,1.35,D,D),
 '🦎':shape('M4 17q-4-5 1-7l5-2q1-6 6-6c6 0 7 7 2 10l-5 2q-6 1-6 5 0 3-3 3l-2-1q3 0 2-4z','#8be281')+line('M8 9l-3-4m8 8 4 4m-9-2 1 4',E,2)+circle(17,5,1.2,D,D)+line('M18 8l3-1',D,1),
 '🐸':circle(6,8,4,E)+circle(18,8,4,E)+shape('M2 13q0-7 10-7t10 7q0 8-10 8T2 13z','#8de384')+circle(6,8,1.4,D,D)+circle(18,8,1.4,D,D)+line('M6 14q6 6 12 0',D,1.4),
 '🌾':line('M6 22L17 4',M,1.8)+shape('M10 16q-7 0-6-6 6-1 7 4zm2-4Q6 10 8 5q5 0 6 5zm3-4q-5-4-1-7 5 1 3 6zm-5 9q4-5 10-5-1 5-10 7zm3-5q4-5 9-4-2 5-9 6zm3-4q2-5 7-5-1 5-7 6z'),
 '🐞':circle(12,7,4,D,V)+shape('M3 13a9 8 0 0 1 18 0 9 9 0 1 1-18 0z',R)+line('M12 8v13M9 5L7 2m8 3 2-3',D,1.45)+circle(8,12,1.4,D,D)+circle(16,12,1.4,D,D)+circle(7,16,1.1,D,D)+circle(17,16,1.1,D,D),
 '🦋':shape('M11 11Q0-1 2 10q0 5 7 4-7 3-3 7 4 1 6-7 2 8 6 7 4-4-3-7 7 1 7-4 2-11-9 1z',B)+line('M12 9v9m0-10 3-4m-3 4L9 4',D,1.8)+circle(6,9,1,V)+circle(18,9,1,V),
 '🐛':circle(5,16,3,'#e8dd7d')+circle(9,15,4,E)+circle(14,11,4,'#a8e588')+circle(18,7,4,E)+line('M17 3l-1-2m4 2 2-2',D,1.2)+circle(19,6,1,D,D)+line('M6 19v2m5-3v2m4-5v2',E,2),
 '👺':shape('M3 10q0-6 7-7l2 3 3-3q6 2 6 8v5l-4 5H8l-5-5z','#ee705a')+shape('M11 11l3-1 7 4q2 2-3 2l-7-2z','#ffad85')+line('M6 9l4 2m5 7H9',D,1.7),
 '🐺':boneFace('#99acce')+line('M4 12l4-2m12 2-4-2',D,1.1),
 '🦠':line('M12 1v6m0 10v6M1 12h6m10 0h6M4 4l4 4m8 8 4 4M4 20l4-4m8-8 4-4',E,2.4)+circle(12,12,7,'#7cd6a1')+circle(9,10,1.5,'#479a87')+circle(14,14,1.75,'#479a87'),
 '🍄':shape('M10 12l-1 8q3 3 6 0l-1-8z','#fff0d3')+shape('M2 13Q2 3 12 2q10 1 10 11-10 4-20 0z',R)+circle(7,9,1.55,W,'#c08ba7')+circle(15,6,1.65,W,'#c08ba7')+circle(17,11,1.6,W,'#c08ba7'),
 '🌳':tree(),'🌲':tree(true),
 '⛄':circle(12,16,6,W)+circle(12,8,4,W)+rect(8,2,8,4,V,1)+line('M7 6h10',D,1.5)+shape('M12 8l6 1-6 2z','#ffaf68')+circle(10,8,.6,D,D)+circle(12,16,.7,D,D)+line('M6 15L2 12m16 3 4-3',M,1.2),
 '🐕':boneFace('#e9ac73','M4 8Q0 7 2 15l3 1m15-8q4-1 2 7l-3 1')+circle(15,12,2,'#a77556',D)+circle(15,12,1,D,D),
 '🌋':shape('M1 21l8-14 4 2 3-2 7 14z','#9f786d')+shape('M7 10l2-3 4 2 3-2 2 4-4 4-2-3-3 4z',R)+line('M12 6V2m4 3 3-3M8 5L6 3',G,1.8),
 '👻':shape('M3 16q0-13 9-13t9 13v5l-4-2-3 2-3-2-3 2-5-2z',W)+circle(9,10,1.5,D,D)+circle(15,10,1.5,D,D)+circle(12,14,1.1,V,D),
 '🔴':circle(12,12,9,R)+line('M6 10a6 6 0 0 1 4-4',W,1.7),
 '😡':circle(12,12,9,'#f9806a')+line('M6 8l4 2m8-2-4 2m-6 7q4-5 8 0',D,1.8)+circle(8,11,1,D,D)+circle(16,11,1,D,D),
 '💔':heart()+line('M13 7l-3 5 5 1-4 7',D,1.65),
 '🕳':`<ellipse cx="12" cy="13" rx="10" ry="7" fill="#8070ac" stroke="${D}" stroke-width="1.2"/><ellipse cx="12" cy="12" rx="8.3" ry="4.4" fill="#150f25" stroke="#5a4483" stroke-width="1.2"/>`+line('M5 16q6 3 13 0',V,1.25),
 '🐾':paw(),
 '🧪':tilt(38,shape('M8 3h8v14a4 4 0 1 1-8 0z',W)+shape('M8 11h8v6a4 4 0 1 1-8 0z',E)+line('M10 13v3',W,1.25)),
 '🌵':shape('M10 22v-5H6q-3 0-3-4V9a2 2 0 0 1 4 0v4h3V5a3 3 0 0 1 6 0v6h2V8a2 2 0 0 1 4 0v4q0 3-4 3h-2v7z','#7ad395')+line('M13 6v14',L,1),
 '☁':shape('M5 19a5 5 0 0 1-1-10q2-5 7-4 5 0 6 5 5-1 5 4t-5 5z',W)+line('M4 16q4 2 12 1',B,1.3),
 '🔩':tilt(35,shape('M7 3h10l2 3-2 3h-3v12h-4V9H7L5 6z',B)+line('M10 13l4-1m-4 4l4-1m-4 4l4-1',W,1)),
 '♫':shape('M8 15V6l12-3v13q0 2.6-3.6 3.4t-3.4-2.2q.3-2.6 4.6-2.9V8L10 10v8q0 2.6-3.6 3.4t-3.4-2.2q.3-2.7 5-4.2z',V)+line('M10 8l7-1.7',W,.95),
 '🍺':rect(6,7,12,14,G,2)+shape('M18 9h3q2 0 2 4t-2 4h-3v-3h2v-2h-2z',W)+shape('M6 8Q2 5 6 3q2-2 5 0 4-2 6 0 4 2 2 5z',W)+line('M9 11v7m5-7v7',L,1.5)
};
const native32=Object.fromEntries(Object.entries(nature).map(([key,body])=>[key,{viewBox:'0 0 32 32',body:`<g transform="scale(1.333333)">${body}</g>`}]));
export const GAME_ICON_ART=Object.freeze({...UI_ICON_ART,...COMBAT_ICON_ART,...native32});
