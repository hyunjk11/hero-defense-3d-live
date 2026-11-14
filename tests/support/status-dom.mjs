
export class StatusDocument {
 constructor(){this.events={};this.defaultView={innerWidth:800,addEventListener(){}};this.documentElement={clientWidth:800};this.activeElement=null;this.body=new StatusNode(this);}
 createElement(tag){const n=new StatusNode(this);n.tagName=tag.toUpperCase();return n;}
 addEventListener(k,fn){(this.events[k]||=[]).push(fn);}
 fire(k,e={}){for(const fn of this.events[k]||[])fn({stopPropagation(){},...e});}
}
export class StatusNode {
 constructor(doc){this.ownerDocument=doc||new StatusDocument();this.children=[];this.dataset={};this.style={};this.attrs={};this.events={};this._text='';this.writes=0;this.labelWrites=0;this.hidden=false;this.scrollTop=0;this.scrollLeft=0;this.rect={left:100,top:200,width:32,height:32};}
 set textContent(v){this._text=v;this.writes++;}get textContent(){return this._text;}
 setAttribute(k,v){this.attrs[k]=String(v);if(k==='aria-label')this.labelWrites++;}
 getAttribute(k){return this.attrs[k]??null;}removeAttribute(k){delete this.attrs[k];}
 addEventListener(k,fn){(this.events[k]||=[]).push(fn);}
 fire(k,e={}){if(k==='focus')this.ownerDocument.activeElement=this;if(k==='blur')this.ownerDocument.activeElement=null;for(const fn of this.events[k]||[])fn({stopPropagation(){},...e});}
 contains(n){return n===this||this.children.some(c=>c.contains(n));}
 getBoundingClientRect(){return {...this.rect,right:this.rect.left+this.rect.width,bottom:this.rect.top+this.rect.height};}
 replaceChildren(){this.children.forEach(x=>x.parentNode=null);this.children=[];}
 appendChild(n){this.insertBefore(n,null);return n;}
 insertBefore(n,next){n.remove();this.children.splice(next?this.children.indexOf(next):this.children.length,0,n);n.parentNode=this;}
 remove(){if(this.parentNode){this.parentNode.children.splice(this.parentNode.children.indexOf(this),1);this.parentNode=null;}}
}
