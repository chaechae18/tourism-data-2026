import React, {useRef, useState} from '/Users/yondori/Developer/PlayGyeongju/tourism-data-2026/frontend/node_modules/react/index.js';
import {createRoot} from '/Users/yondori/Developer/PlayGyeongju/tourism-data-2026/frontend/node_modules/react-dom/client.js';
import Donggyeong3D from '/Users/yondori/Developer/PlayGyeongju/tourism-data-2026/frontend/components/donggyeong/Donggyeong3D.jsx';
import {DONGGYEONG_ITEMS} from '/Users/yondori/Developer/PlayGyeongju/tourism-data-2026/frontend/lib/donggyeong/role-outfit.js';
const roles=[['king','왕'],['court_lady','궁녀'],['warrior','무사'],['monk','승려']];
function App(){
 const viewers=useRef([]),[ready,setReady]=useState({}),[status,setStatus]=useState('');
 async function save(){
  const canvas=document.createElement('canvas');canvas.width=2400;canvas.height=2400;
  const ctx=canvas.getContext('2d');ctx.fillStyle='#f7f4ee';ctx.fillRect(0,0,2400,2400);
  for(let i=0;i<4;i++){
   const x=36+(i%2)*1176,y=36+Math.floor(i/2)*1176;
   viewers.current[i].drawTo(ctx,x,y,1152,1056);
   ctx.fillStyle='#ffffff';ctx.fillRect(x,y+1056,1152,96);
   ctx.fillStyle='#302b25';ctx.font='600 44px "Apple SD Gothic Neo",sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(roles[i][1],x+576,y+1106);
  }
  const response=await fetch('/save/donggyeong-four-roles.png',{method:'POST',body:await new Promise(resolve=>canvas.toBlob(resolve,'image/png'))});
  setStatus(response.ok?'2400 × 2400 PNG 저장 완료':'저장 실패');
 }
 return <><nav><button disabled={!roles.every(([id])=>ready[id])} onClick={save}>4컷 PNG 저장</button><span role="status">{status||`${Object.values(ready).filter(Boolean).length}/4 역할 준비 완료`}</span></nav><main>{roles.map(([id,label],i)=><section key={id}><div className="portrait"><Donggyeong3D ref={v=>viewers.current[i]=v} className="absolute inset-0" interactive={false} items={DONGGYEONG_ITEMS.filter(item=>item.role===id)} onReadyChange={value=>setReady(current=>current[id]===value?current:{...current,[id]:value})}/></div><footer>{label}</footer></section>)}</main></>;
}
createRoot(document.getElementById('root')).render(<App/>);
