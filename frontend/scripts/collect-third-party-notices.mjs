import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url));
const lines=['Third-party library notices','Collected from installed runtime dependencies and their lockfiles.','These notices preserve known package licensing information. They are not a comprehensive legal clearance for site content.',''];
const seen=new Set();const missing=[];
for(const project of ['frontend','server']) {
 const lock=JSON.parse(fs.readFileSync(path.join(root,project,'package-lock.json'),'utf8'));
 for(const [relative,entry] of Object.entries(lock.packages??{})) {
  if(!relative.startsWith('node_modules/')||entry.dev)continue;
  const directory=path.join(root,project,relative),packagePath=path.join(directory,'package.json');if(!fs.existsSync(packagePath))continue;
  const pkg=JSON.parse(fs.readFileSync(packagePath,'utf8'));const key=`${pkg.name}@${pkg.version}`;if(seen.has(key))continue;seen.add(key);
  lines.push('='.repeat(64),key,`License: ${pkg.license??entry.license??'see upstream source'}`,`Source: ${typeof pkg.repository==='string'?pkg.repository:pkg.repository?.url??'see npm package'}`,'');
  const names=fs.readdirSync(directory).filter(name=>['license','license.md','license.txt','licence','licence.md','copying','copying.txt','copyright','notice','notice.txt'].includes(name.toLowerCase())&&fs.statSync(path.join(directory,name)).isFile());
  if(names.length)for(const name of names)lines.push(name,fs.readFileSync(path.join(directory,name),'utf8'),'');
  else{missing.push(key);lines.push('Consult the upstream package for its full license notice.','');}
 }
}
lines.push('='.repeat(64),'Town weather and approximate city data','Weather forecast: MET Norway Locationforecast https://api.met.no/','City lookup: Open-Meteo Geocoding (GeoNames) https://open-meteo.com/','Data license: CC BY 4.0 https://creativecommons.org/licenses/by/4.0/','Terms: https://api.met.no/doc/TermsOfService and https://open-meteo.com/en/terms','Weather is transformed into visual rain/snow categories and calendar seasons; it does not indicate provider endorsement.','');
fs.writeFileSync(path.join(root,'frontend/public/legal/third-party-notices.txt'),lines.join('\n')+'\n');
console.log(`Collected ${seen.size} runtime package notices. ${missing.length} packages require consulting upstream for complete local license files.`);
