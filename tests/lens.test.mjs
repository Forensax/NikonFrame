import test from 'node:test';
import assert from 'node:assert/strict';
import {lensFromJpeg,lensSpecification,readLens} from '../dist/lens.js';

// A Nikon type-2 MakerNote inside EXIF, with independent TIFF byte order.
function jpeg(outerLE,innerLE){
  const b=new Uint8Array(146),v=new DataView(b.buffer);
  b.set([255,216,255,225]);v.setUint16(4,142);b.set(new TextEncoder().encode('Exif\0\0'),6);
  const header=(p,le)=>{b.set(new TextEncoder().encode(le?'II':'MM'),p);v.setUint16(p+2,42,le);v.setUint32(p+4,8,le);};
  const entry=(p,tag,type,count,offset,le)=>{v.setUint16(p,tag,le);v.setUint16(p+2,type,le);v.setUint32(p+4,count,le);v.setUint32(p+8,offset,le);};
  header(12,outerLE);v.setUint16(20,1,outerLE);entry(22,0x8769,4,1,26,outerLE);
  v.setUint16(38,1,outerLE);entry(40,0x927c,7,68,44,outerLE);
  b.set(new TextEncoder().encode('Nikon\0'),56);b[62]=2;header(66,innerLE);
  v.setUint16(74,1,innerLE);entry(76,0x84,5,4,26,innerLE);
  [[18,1],[140,1],[7,2],[28,5]].forEach(([n,d],i)=>{v.setUint32(92+i*8,n,innerLE);v.setUint32(96+i*8,d,innerLE);});
  return b;
}
test('Nikon lens works without XMP or LensModel in both byte orders',async()=>{
  for(const outer of [true,false])for(const inner of [true,false]){
    const b=jpeg(outer,inner);assert.equal(lensFromJpeg(b),'18-140mm f/3.5-5.6');
    assert.equal(await readLens(new Blob([b]),{}),'18-140mm f/3.5-5.6');
  }
});
test('lens names take priority over numeric specifications',async()=>{
  const file=new Blob([jpeg(true,true)]);
  assert.equal(await readLens(file,{LensModel:' Full name ',Lens:'XMP name'}),'Full name');
  assert.equal(await readLens(file,{Lens:' XMP name '}),'XMP name');
  assert.equal(lensSpecification('18/1 140/1 7/2 28/5'),'18-140mm f/3.5-5.6');
  assert.equal(lensSpecification([50,50,1.8,1.8]),'50mm f/1.8');
});
test('missing, truncated and corrupt metadata safely stays empty',()=>{
  const b=jpeg(true,true);for(let i=0;i<b.length;i++)assert.equal(lensFromJpeg(b.slice(0,i)),'');
  new DataView(b.buffer).setUint32(84,0xffffffff,true);assert.equal(lensFromJpeg(b),'');
  for(const value of [null,[],[18,140,0,5.6],'18/0 140/1 7/2 28/5',[140,18,3.5,5.6]])assert.equal(lensSpecification(value),'');
});
