// Browser adaptation of ExifTool Nikon LensData decoding.
// Copyright 2003-2026 Phil Harvey; Perl Artistic License (vendor/licenses).
// Modified: isolated lens identification; no serial numbers leave the browser.
import {NIKON_KEYS,NIKON_LENS_IDS,NIKON_Z_IDS} from './nikon-data.js?v=6';

export function decodeNikonLens(data,lensType,serial,shutterCount,model=''){
  if(!(data instanceof Uint8Array)||data.length<4)return '';
  const version=String.fromCharCode(...data.subarray(0,4));
  const offsets={'0100':6,'0101':11,'0201':11,'0202':11,'0203':11,'0204':12,'0800':13,'0801':13,'0802':13};
  const offset=offsets[version];if(offset===undefined)return '';
  let decoded=data;
  if(version[0]!=='0'||version[1]!=='1'){
    if(serial===undefined||serial===null||serial===''||!Number.isInteger(shutterCount)||shutterCount<0||shutterCount>0xffffffff)return '';
    const serialText=String(serial).trim();
    const serialKey=/^\d+$/.test(serialText)?Number(BigInt(serialText)&255n):/\bD50$/i.test(model)?0x22:0x60;
    const key=(shutterCount^(shutterCount>>>8)^(shutterCount>>>16)^(shutterCount>>>24))&255;
    const ci=NIKON_KEYS[0][serialKey];let cj=NIKON_KEYS[1][key],ck=0x60;
    decoded=data.slice();
    for(let i=4;i<decoded.length;i++){cj=(cj+ci*ck)&255;ck=(ck+1)&255;decoded[i]^=cj;}
  }
  if(version.startsWith('08')&&decoded.length>=0x32){
    const id=decoded[0x30]|decoded[0x31]<<8;
    if(id)return NIKON_Z_IDS[id]??'';
  }
  if(!Number.isInteger(lensType)||lensType<0||lensType>255||decoded.length<offset+7)return '';
  const signature=[...decoded.subarray(offset,offset+7),lensType].map(n=>n.toString(16).padStart(2,'0').toUpperCase()).join(' ');
  return NIKON_LENS_IDS[signature]??'';
}
