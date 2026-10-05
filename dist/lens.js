// Nikon MakerNote Lens (0x0084): focal range and maximum apertures.
// Layout reference: ExifTool Nikon.pm and Exif.pm.
import {decodeNikonLens} from './nikon-lens.js?v=6';
export function lensSpecification(values){
  if(typeof values==='string')values=values.trim().split(/\s+/).map(v=>{const [a,b]=v.split('/').map(Number);return b===undefined?a:b?a/b:NaN;});
  if(!Array.isArray(values)||values.length!==4||values.some(v=>!Number.isFinite(v)||v<=0))return '';
  const [short,long,wide,tele]=values;
  if(short>long||short>10000||long>10000||wide>256||tele>256)return '';
  const format=v=>String(Number(v.toFixed(2)));
  return `${format(short)}${short===long?'':'-'+format(long)}mm f/${format(wide)}${wide===tele?'':'-'+format(tele)}`;
}
export function lensFromJpeg(buffer){
  const bytes=buffer instanceof Uint8Array?buffer:new Uint8Array(buffer),view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  const range=(p,n,end=bytes.length)=>Number.isSafeInteger(p)&&p>=0&&p+n<=end;
  const ascii=(p,n)=>String.fromCharCode(...bytes.subarray(p,p+n));
  function tiff(base,end){
    if(!range(base,8,end))return null;
    const order=ascii(base,2);if(order!=='II'&&order!=='MM')return null;
    const le=order==='II',u16=p=>view.getUint16(p,le),u32=p=>view.getUint32(p,le);
    if(u16(base+2)!==42)return null;
    function entries(offset){
      const p=base+offset;if(!range(p,2,end))return [];
      const count=u16(p);if(!range(p+2,count*12,end))return [];
      return Array.from({length:count},(_,i)=>p+2+i*12);
    }
    const find=(offset,tag)=>entries(offset).find(p=>u16(p)===tag);
    function rational(p){
      if(p===undefined||u16(p+2)!==5||u32(p+4)!==4)return '';
      const data=base+u32(p+8);if(!range(data,32,end))return '';
      return lensSpecification(Array.from({length:4},(_,i)=>{const den=u32(data+i*8+4);return den?u32(data+i*8)/den:NaN;}));
    }
    function value(p){
      if(p===undefined)return undefined;
      const type=u16(p+2),count=u32(p+4),size=({1:1,2:1,3:2,4:4,7:1})[type];
      if(!size||!count)return undefined;
      const length=count*size,data=length<=4?p+8:base+u32(p+8);
      if(!range(data,length,end))return undefined;
      if(type===2)return ascii(data,count).replace(/\0.*$/s,'').trim();
      if(count===1&&type!==7)return type===4?u32(data):type===3?u16(data):bytes[data];
      return bytes.subarray(data,data+length);
    }
    return {base,end,u16,u32,find,rational,value,first:u32(base+4)};
  }
  try{
    if(!range(0,2)||view.getUint16(0)!==0xffd8)return '';
    let p=2;
    while(range(p,4)){
      if(bytes[p++]!==255)return '';while(bytes[p]===255)p++;
      const marker=bytes[p++];if(marker===0xda||marker===0xd9)break;
      if(marker===0x01||(marker>=0xd0&&marker<=0xd7))continue;
      if(!range(p,2))break;const length=view.getUint16(p),start=p+2,end=p+length;
      if(length<2||!range(p,length))break;
      if(marker===0xe1&&ascii(start,6)==='Exif\0\0'){
        const outer=tiff(start+6,end);if(outer){
          const exif=outer.find(outer.first,0x8769);
          if(exif!==undefined&&outer.u16(exif+2)===4&&outer.u32(exif+4)===1){
            const offset=outer.u32(exif+8),standard=outer.rational(outer.find(offset,0xa432));
            const note=outer.find(offset,0x927c);
            if(note!==undefined&&outer.u16(note+2)===7){
              const size=outer.u32(note+4),pos=outer.base+outer.u32(note+8);
              if(size>=18&&range(pos,size,end)&&ascii(pos,6)==='Nikon\0'&&bytes[pos+6]===2){
                const nikon=tiff(pos+10,pos+size);
                if(nikon){
                  const tag=id=>nikon.value(nikon.find(nikon.first,id));
                  const detailed=decodeNikonLens(tag(0x98),tag(0x83),tag(0x1d),tag(0xa7),outer.value(outer.find(outer.first,0x110))??'');
                  if(detailed)return detailed;
                  const lens=nikon.rational(nikon.find(nikon.first,0x84));if(lens)return lens;
                }
              }
            }
            if(standard)return standard;
          }
        }
      }
      p=end;
    }
  }catch{/* Malformed optional metadata must not prevent photo import. */}
  return '';
}
export async function readLens(file,tags={}){
  const text=[tags.LensModel,tags.Lens].find(v=>typeof v==='string'&&v.trim())?.trim()??'';
  const numericName=/^\d+(?:\.\d+)?(?:-\d+(?:\.\d+)?)?\s*mm\s+f\/\d+(?:\.\d+)?(?:-\d+(?:\.\d+)?)?$/i.test(text);
  if(text&&!numericName)return text;
  const spec=lensSpecification(tags.LensInfo??tags.LensSpecification??tags.Lens);
  // JPEG metadata precedes the compressed image; avoid retaining the full photo.
  try{return lensFromJpeg(await file.slice(0,1024*1024).arrayBuffer())||text||spec;}catch{return text||spec;}
}
