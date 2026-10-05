// Fixed Nikon 0204 LensData vector for signature A0 40 2D 74 2C 3C BB 0E.
// Synthetic serial/count keys; no private camera data.
export const targetCipher=Uint8Array.from(Buffer.from('3032303406ed1b904c4f992aa261aa40045f5eaebe15b398','hex'));
export const targetName='AF-S DX Nikkor 18-140mm f/3.5-5.6G ED VR';
export function targetJpeg(outerLE=true,innerLE=true,{count=67890,lensType=14}={}){
  const b=new Uint8Array(226),v=new DataView(b.buffer);
  b.set([255,216,255,225]);v.setUint16(4,222);b.set(new TextEncoder().encode('Exif\0\0'),6);
  const header=(p,le)=>{b.set(new TextEncoder().encode(le?'II':'MM'),p);v.setUint16(p+2,42,le);v.setUint32(p+4,8,le);};
  const entry=(p,tag,type,n,offset,le)=>{v.setUint16(p,tag,le);v.setUint16(p+2,type,le);v.setUint32(p+4,n,le);v.setUint32(p+8,offset,le);};
  header(12,outerLE);v.setUint16(20,1,outerLE);entry(22,0x8769,4,1,26,outerLE);
  v.setUint16(38,1,outerLE);entry(40,0x927c,7,152,44,outerLE);
  b.set(new TextEncoder().encode('Nikon\0'),56);b[62]=2;header(66,innerLE);
  v.setUint16(74,5,innerLE);
  entry(76,0x1d,2,6,102,innerLE);
  entry(88,0x83,1,1,0,innerLE);b[96]=lensType;
  entry(100,0x84,5,4,70,innerLE);
  entry(112,0x98,7,24,108,innerLE);
  entry(124,0xa7,4,1,count,innerLE);
  [[18,1],[140,1],[7,2],[28,5]].forEach(([n,d],i)=>{v.setUint32(136+i*8,n,innerLE);v.setUint32(140+i*8,d,innerLE);});
  b.set(new TextEncoder().encode('12345\0'),168);b.set(targetCipher,174);
  return b;
}
