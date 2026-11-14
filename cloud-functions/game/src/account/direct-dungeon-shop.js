import {context,denied,failure} from '../../server/common.mjs';
import {dungeonItems} from '../../server/dungeon.mjs';

// A purchase ID is durable across reconnects. The catalog, debit, mail and
// receipt are independently checked in one Rules-protected atomic commit.
export async function directDungeonBuy(store,user,args,options){
 if(!args||Object.keys(args).some(k=>!['p_id','p_item'].includes(k))||!/^[A-Za-z0-9_-]{8,64}$/.test(args.p_id||''))throw Object.assign(Error('Invalid purchase ID'),{code:'INVALID_ARGUMENT'});
 return store.transaction(async tx=>{
  const c=await context(tx,user,options);c.requirePlayer();
  const id=c.uid+'~dgbuy~'+args.p_id,body=JSON.stringify({item:args.p_item}),prior=await c.get('growth_investments',id);
  if(prior){if(prior.body!==body)denied('purchase ID reused');return {data:{...prior.result,already:true},error:null};}
  const it=Object.hasOwn(dungeonItems,args.p_item)?dungeonItems[args.p_item]:null;
  if(!it)return {data:failure('bad_item'),error:null};
  const w=await c.wallet();
  if(it.title&&w.titles.includes(it.title))return {data:failure('already',{medals:w.medals}),error:null};
  if(w.medals<it.price)return {data:failure('not_enough',{medals:w.medals,price:it.price}),error:null};
  w.medals-=it.price;w.spent+=it.price;if(it.title)w.titles.push(it.title);w.updated_at=c.iso;
  await c.put('dungeon_wallet',w);
  const m=it.reward?await c.mail(c.uid,'던전 상점 · '+it.name,'구매한 상품입니다.',it.reward):null;
  const buy=await c.insert('dungeon_buys',{user_id:c.uid,item:args.p_item,price:it.price,mail_id:m?.id||null});
  const result={ok:true,action:'dungeon_buy',item:args.p_item,price:it.price,medals:w.medals,titles:w.titles,mail:m?.id||null,buy:buy.id};
  await c.put('growth_investments',{id,user_id:c.uid,body,at:c.iso,result});
  return {data:result,error:null};
 });
}
