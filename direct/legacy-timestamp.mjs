// Offline import boundary: accept explicit ISO dates, never Date.parse's
// calendar rollover or loss of fractional precision during timezone conversion.
export function normalizeLegacyTimestamp(value) {
  if(typeof value!=='string')throw Error('Invalid legacy timestamp');
  const m=value.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?(Z|[+-]\d{2}:\d{2}))?$/);
  if(!m)throw Error('Invalid legacy timestamp');
  const [,ys,ms,ds,hs,mins,ss,fraction,zone]=m;
  const y=Number(ys),month=Number(ms),day=Number(ds),h=Number(hs||0),minute=Number(mins||0),second=Number(ss||0);
  const leap=y%4===0&&(y%100!==0||y%400===0);
  const days=[31,leap?29:28,31,30,31,30,31,31,30,31,30,31];
  if(y<1||month<1||month>12||day<1||day>days[month-1]||h>23||minute>59||second>59)throw Error('Invalid legacy calendar date');
  let offset=0;
  if(zone&&zone!=='Z'){
    const oh=Number(zone.slice(1,3)),om=Number(zone.slice(4,6));
    if(oh>23||om>59)throw Error('Invalid legacy timezone');
    offset=(zone[0]==='-'?-1:1)*(oh*60+om);
  }
  const d=new Date(0);d.setUTCFullYear(y,month-1,day);d.setUTCHours(h,minute,second,0);
  d.setTime(d.getTime()-offset*60000);
  if(d.getUTCFullYear()<1||d.getUTCFullYear()>9999)throw Error('Legacy timestamp outside supported range');
  const suffix=fraction!==undefined?'.'+fraction:hs===undefined?'.000':'';
  return d.toISOString().slice(0,19)+suffix+'Z';
}
