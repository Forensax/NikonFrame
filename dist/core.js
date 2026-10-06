export const BAR_RATIO=354/4032;
export const DEFAULT_CAPTION='影像从心';
const number=v=>{if(Array.isArray(v))v=v[0];const n=Number(v);return Number.isFinite(n)&&n>0?n:null;};
export function shutterText(v){const n=number(v);if(!n)return '';if(n>=1)return String(Number(n.toFixed(3)));if(n>0.5)return String(Number(n.toFixed(4)));return `1/${Number((1/n).toFixed(2))}`;}
export function dateText(v){if(v instanceof Date&&!isNaN(v)){const pad=n=>String(n).padStart(2,'0');return `${v.getFullYear()}.${pad(v.getMonth()+1)}.${pad(v.getDate())} ${pad(v.getHours())}:${pad(v.getMinutes())}:${pad(v.getSeconds())}`;}return typeof v==='string'?v.replace(/^(\d{4}):(\d{2}):(\d{2})/,'$1.$2.$3'):'';}
export function fromExif(tags={}){const focal=number(tags.FocalLength);return {model:String(tags.Model??''),lens:[tags.LensModel,tags.Lens].find(value=>typeof value==='string'&&value.trim())?.trim()??'',date:dateText(tags.DateTimeOriginal??tags.CreateDate??tags.ModifyDate),focal:focal?String(focal):'',aperture:number(tags.FNumber)?String(number(tags.FNumber)):'',iso:number(tags.ISO??tags.ISOSpeedRatings)?String(number(tags.ISO??tags.ISOSpeedRatings)):'',shutter:shutterText(tags.ExposureTime),focalSource:focal?'实际焦距':''};}
export function isOtherBrand(tags={}){const make=String(tags.Make??'').trim();const model=String(tags.Model??'').trim();return make?!/nikon/i.test(make):/^(canon|sony|fujifilm|panasonic|olympus|om digital|leica|pentax|apple|samsung)/i.test(model);}
export function parameterLine(info){return [info.focal?`${info.focal}mm`:'',info.aperture?`f/${info.aperture}`:'',info.shutter||'',info.iso?`ISO${info.iso}`:''].filter(Boolean).join(' ');}
export function uniqueName(name,used){const base=name.replace(/\.[^.]+$/,'').replace(/[<>:"/\\|?*\u0000-\u001f]/g,'_')||'照片';let candidate=base+'_尼康边框.jpg',i=2;while(used.has(candidate))candidate=`${base}_尼康边框_${i++}.jpg`;used.add(candidate);return candidate;}
export function drawFrame(canvas,image,info,bar,width=image.width){
  const w=Math.round(width),photoHeight=Math.round(image.height*w/image.width),barHeight=Math.round(w*BAR_RATIO);
  canvas.width=w;canvas.height=photoHeight+barHeight;
  const ctx=canvas.getContext('2d',{colorSpace:'srgb'});
  if(!ctx)throw new Error('浏览器无法创建画布');
  ctx.fillStyle='#fff';ctx.fillRect(0,0,w,canvas.height);
  ctx.drawImage(image,0,0,w,photoHeight);ctx.drawImage(bar,0,photoHeight,w,barHeight);
  const scale=w/4032;
  const text=(value,x,y,size,max,{color='#080808',family='Frame Model',stroke=0,weight=400}={})=>{
    if(!value)return 0;
    ctx.save();
    let font=size*scale;
    const setFont=()=>{ctx.font=`${weight} ${font}px "${family}", "PingFang SC", "Microsoft YaHei", sans-serif`;};
    setFont();
    const measured=ctx.measureText(value).width;
    if(measured>max*scale){font*=max*scale/measured;setFont();}
    ctx.textAlign='left';ctx.textBaseline='middle';ctx.fillStyle=color;
    if(stroke){ctx.strokeStyle=color;ctx.lineWidth=stroke*scale;ctx.lineJoin='round';ctx.strokeText(value,x*scale,photoHeight+y*scale);}
    ctx.fillText(value,x*scale,photoHeight+y*scale);
    const drawnWidth=ctx.measureText(value).width/scale;
    ctx.restore();
    return drawnWidth;
  };
  const modelWidth=text(info.model,200,137,61,info.lens?1000:2450,{stroke:3});
  if(info.lens){const lensX=200+modelWidth+(info.model?48:0);text(info.lens,lensX,137,48,2650-lensX,{weight:300});}
  text(info.date,200,235,47,2450,{color:'#7e7e7e'});
  text(parameterLine(info),3085,131,62,747,{family:'Frame Parameters',stroke:3});
  text(info.caption??DEFAULT_CAPTION,3085,230,52,747,{family:'Frame Parameters',color:'#7a7a7a'});
  return {width:w,height:canvas.height};
}
