const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'index.html');
let h = fs.readFileSync(file, 'utf8');
const before = h;

// Exact literal swap — no regex escaping headaches
h = h.split(`'<img src="logos/'+t.id+'.png"`).join(`'<img src="logos/'+t.id+'.svg"`);
h = h.split(`'<img src="logos/'+t?.id+'.png"`).join(`'<img src="logos/'+t?.id+'.svg"`);
h = h.split(`"logos/"+t.id+".png"`).join(`"logos/"+t.id+".svg"`);
h = h.split(`"logos/" + t.id + ".png"`).join(`"logos/" + t.id + ".svg"`);

fs.writeFileSync(file, h);
console.log(`Changed ${before.length - h.length} bytes`);
