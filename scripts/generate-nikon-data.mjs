// Rebuild the vendored lookup data from a pinned ExifTool source revision.
import fs from 'node:fs';
const revision='38bdbace3037a89d2c332664fc60bddad118958a';
const url=`https://raw.githubusercontent.com/exiftool/exiftool/${revision}/lib/Image/ExifTool/Nikon.pm`;
const response=await fetch(url);if(!response.ok)throw new Error(`Source unavailable: ${response.status}`);
const source=await response.text(),groups=new Map();
const table=source.slice(source.indexOf('%nikonLensIDs = ('),source.indexOf('%nikonTextEncoding = ('));
for(const match of table.matchAll(/'((?:[A-F0-9]{2} ){7}[A-F0-9]{2})(?:\.\d+)?'\s*=>\s*'([^']+)'/g)){
  const names=groups.get(match[1])??new Set();names.add(match[2]);groups.set(match[1],names);
}
// Shared IDs remain unresolved rather than selecting an arbitrary lens.
const lensIds=Object.fromEntries([...groups].filter(([,names])=>names.size===1).map(([id,names])=>[id,[...names][0]]));
const zSection=source.slice(source.indexOf('%Image::ExifTool::Nikon::LensData0800 = ('),source.indexOf('%Image::ExifTool::Nikon::LensDataUnknown = ('));
const zTable=zSection.slice(zSection.indexOf('0x30 =>'),zSection.indexOf('0x34 =>'));
const zIds=Object.fromEntries([...zTable.matchAll(/^\s*(\d+) => '([^']+)',/gm)].map(m=>[m[1],m[2]]));
const xlat=source.match(/my @xlat = \(([\s\S]*?)\n\);/)[1];
const keys=[...xlat.matchAll(/\[([^\]]+)\]/g)].map(m=>[...m[1].matchAll(/0x[\da-f]+/g)].map(n=>Number(n[0])));
if(Object.keys(lensIds).length<200||keys.length!==2||keys.some(k=>k.length!==256))throw new Error('Unexpected upstream layout');
const header=`// Derived from ExifTool Nikon.pm, revision ${revision}.\n// Copyright 2003-2026 Phil Harvey; distributed under the Perl Artistic License.\n// Modified: extracted lookup tables for browser use, excluded ambiguous IDs.\n// Source: ${url}\n// License: vendor/licenses/ExifTool-Artistic.txt\n`;
fs.writeFileSync('dist/nikon-data.js',header+`export const NIKON_LENS_IDS=${JSON.stringify(lensIds,null,2)};\nexport const NIKON_Z_IDS=${JSON.stringify(zIds,null,2)};\nexport const NIKON_KEYS=${JSON.stringify(keys)};\n`);
console.log(`Generated ${Object.keys(lensIds).length} lens signatures and ${Object.keys(zIds).length} Z lens IDs`);
