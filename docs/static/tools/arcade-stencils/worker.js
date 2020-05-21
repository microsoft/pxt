console.log('worker started')
importScripts('https://maker.js.org/target/js/browser.maker.js')
const makerjs = require('makerjs');

let cell = 0.81; // inch
let margin = cell / 8; // inch
let corner = cell / 8;
const palette = [
  0x000000,
  0xffffff,
  0xff2121,
  0xff93c4,
  0xff8135,
  0xfff609,
  0x249ca3,
  0x78dc52,
  0x003fad,
  0x87f2ff,
  0x8e2ec4,
  0xa4839f,
  0x5c406c,
  0xe5cdc4,
  0x91463d,
  0x000000
];
const paletteNames = [
  "black",
  "white",
  "red",
  "fushia",
  "orange",
  "yellow",
  "olive",
  "green",
  "blue",
  "teal",
  "purple",
  "aqua",
  "silver",
  "gray",
  "maroon",
  "white",
  "black"
]

function rect(x, y, w, h) {
  const m = new makerjs.models.Rectangle(w, h);
  m.origin = [x,y];
  return m;
}

function rrect(x, y, w, h) {
  const m = new makerjs.models.RoundRectangle(w, h, corner);
  m.origin = [x,y];
  return m;
}

function outerbox(width, height) {
  const boxWidth = 2* cell /*padding*/ + width * cell /* boxes*/ + (width - 1) * margin;
  const boxHeight = 2* cell /*padding*/ + height * cell /* boxes*/ + (height - 1) * margin;
  return { w: boxWidth, h: boxHeight };
}

function renderSvg(img, width, height) {
  const bb = outerbox(width, height);
  const ppi = Math.min(300, Math.min(4096 / bb.w, 4096 / bb.h));
  
  let svg = `<svg version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
width="${bb.w * ppi}" height="${bb.h * ppi}" viewBox="0 0 ${bb.w * ppi} ${bb.h * ppi}">\n`;
  
  for(let i = 0; i < width; ++i) {
    let x = (cell + i * (cell + margin));
    for (let j = 0; j < height; ++j) {
      const ci = img[j * width + i];
      if (ci == 0) continue;
      const c = palette[ci];
      let y = (cell + j * (cell + margin));
      
      svg += `<rect x="${x * ppi}" y="${y * ppi}" width="${cell * ppi}" height="${cell * ppi}" rx="${corner * ppi}" class="cell" style="fill: #${c.toString(16)}" />\n`      
    }
  }  
  
  svg += `</svg>`;  
  console.log(svg)
  
  return svg;
}

function renderLayer(img, width, height, color) {
  // check if there is a color to render
  if (!img.some(c => color < 0 || c == color))
    return undefined;

  const bb = outerbox(width, height);
  const model = {
    units: makerjs.unitType.Inch,
    paths: {},
    models: {}
  };
  const paths = model.paths;
  const models = model.models;

  for(let x = 0; x < width; ++x) {
    for (let y = 0; y < height; ++y) {
      const c = img[y * width + x];
      if (color < 0 ? !!c : c == color) {
        const k = `${x},${y}`;
        models[k] = rrect(
          cell + x * (cell + margin),
          cell + (height - y - 1) * (cell + margin),
          cell,
          cell
        );        
      }
    }
  }

  models.in = new makerjs.models.RoundRectangle(bb.w, bb.h, cell);
  models.in.origin = [0,0];
  models.corners = rect(0, 0, bb.w, bb.h, cell);  
  makerjs.model.combine(models.corners, models.in, false, true, true, false);
  
  // all done
  return model;
}

function renderImage(img, width, height, prefix) {
  const bb = outerbox(width, height);
  let m = {
    type: "render",
    cards: []
  };
  
  let layers = 0;
  let h = '';
  let start = -1
  for(let c = start; c < 16; ++c) {
    if (c == 0) continue; // skip transparent
    const name = c < 0 ? "grid" : c.toString(16);
      const model = renderLayer(img, width, height, c, `${name} ${c < 0 ? "" : palette[c]}`);
    if (model) {   
      layers++;
      const fname = `${prefix || "model"}-${name}.dxf`;
      const svg = makerjs.exporter.toSVG(model);
      const dxf = makerjs.exporter.toDXF(model);
      const card = `<a download="${fname}" class="ui card">
<div class="image">${svg}</div>
<div class="content">
<div class="header">${name} (${c > 0 ? '#' + palette[c].toString(16) : ''}) <span style="color:${c < 0 ? "0" : '#' + palette[c].toString(16)}">■</span>
</div>
</div>
</a>`;
      m.cards.push({
        card: card,
        href: dxf
      })
    }
  }
  
  m.output = `${width}x${height} / ${bb.w.toFixed(2)}' x ${bb.h.toFixed(2)}' / ${layers} layers`;

  m.svg = renderSvg(img, width, height);
  
  self.postMessage(m)
}

function render(src, cellDim, prefix) {
  cell = cellDim;
  updateDims();
  console.log(`rendering image...`)
  let lines = src.trim().split('\n')
    .map(line => line.trim())
    .filter(line => !/^\s*(const|`|let)/.test(line));
  let height = 0;
  let width = 0;
  const img = [];
  for(let y = 0; y < lines.length; ++y) {
    height++;
    const cs = lines[y].split(/\s+/);
    width = cs.length;
    for(let x = 0; x < width; ++x) {
      let c = cs[x];
      if (!/^[0-9a-z]$/i.test(c))
        c = 0;
      img.push(parseInt("0x" + c))
    }
  }
  console.log(`image ${width} x ${height}`)
  renderImage(img, width, height, prefix);
}

function updateDims() {
  margin = cell / 8; // inch
  corner = cell / 8;    
}

self.addEventListener('message', function(e) {
  const d = e.data;
  console.log(`worker message ${d.type}`);
  switch(d.type) {
    case 'render':
        render(d.img, d.cell, d.prefix);
  }
}, false);