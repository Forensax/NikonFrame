import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {decodeNikonLens} from '../dist/nikon-lens.js';
import {lensFromJpeg,readLens} from '../dist/lens.js';
import {targetCipher,targetJpeg,targetName} from './nikon-fixtures.mjs';

test('encrypted 18-140mm ID resolves to the complete name including AF-S/DX/G/ED/VR',()=>{
  assert.equal(decodeNikonLens(targetCipher,14,'12345',67890),targetName);
  for(const outer of [true,false])for(const inner of [true,false])assert.equal(lensFromJpeg(targetJpeg(outer,inner)),targetName);
});
test('real Nikon metadata matches independently published ExifTool results',()=>{
  // ExifTool t/Nikon_4.out and t/Nikon_5.out at the pinned source revision.
  assert.equal(lensFromJpeg(fs.readFileSync(new URL('./fixtures/NikonD70.jpg',import.meta.url))),'AF-S DX Zoom-Nikkor 18-70mm f/3.5-4.5G IF-ED');
  assert.equal(lensFromJpeg(fs.readFileSync(new URL('./fixtures/NikonD2Hs.jpg',import.meta.url))),'AF Nikkor 50mm f/1.8D');
});
test('numeric lens text and LensInfo do not hide a detailed MakerNote lens name',async()=>{
  const file=new Blob([targetJpeg()]);
  for(const tags of [{},{Lens:'18-140mm f/3.5-5.6'},{LensInfo:[18,140,3.5,5.6]}])assert.equal(await readLens(file,tags),targetName);
  assert.equal(await readLens(file,{LensModel:'Authoritative standard name'}),'Authoritative standard name');
});
test('unknown, corrupt or missing lens IDs preserve numeric specs without guessing a name',()=>{
  assert.equal(decodeNikonLens(targetCipher,14,undefined,67890),'');
  assert.equal(decodeNikonLens(targetCipher,14,'12345',undefined),'');
  assert.equal(decodeNikonLens(targetCipher.subarray(0,12),14,'12345',67890),'');
  assert.equal(lensFromJpeg(targetJpeg(true,true,{lensType:0})),'18-140mm f/3.5-5.6');
  assert.equal(lensFromJpeg(targetJpeg(true,true,{count:0})),'18-140mm f/3.5-5.6');
  const unknown=targetCipher.slice();unknown.set(new TextEncoder().encode('9999'));assert.equal(decodeNikonLens(unknown,14,'12345',67890),'');
});
