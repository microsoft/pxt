
let worker;
function update() {
  const cell = parseFloat($('#cell').val()); // inch
  const prefix = $('#prefix').val();
  
  $('#output').text('rendering...')
  $('#loader').addClass('active')
  worker.postMessage({
    type: 'render',
    img: $('#img').val(),
    cell: cell,
    prefix: prefix || ""
  })
}

function initWorker() {
  worker = new Worker('https://makecode.com/static/tools/arcade-stencils/worker.js');
  worker.addEventListener('message', function(e) {
    const d = e.data;
    console.log('Worker said: ', d);
    switch(d.type) {
      case 'render':
      $('#loader').removeClass('active')
        $('#output').text(d.output);
        $('#model').empty();        
        d.cards.forEach(c => {
          const card = $(c.card);
          card.attr("href", URL.createObjectURL(new Blob([c.href])))
          $('#model').append(card)
        });
        
        if (d.svg) {       
          $('#preview').empty();
          const img = document.createElement("img")
          img.onerror = function(e) { console.log(e) }
          img.onload = function() {
            const cvs = document.createElement("canvas");
            cvs.width = img.width;
            cvs.height = img.height;
            cvs.style.maxWidth = "15rem"
            const ctx = cvs.getContext("2d");
            ctx.drawImage(img, 0, 0)
            $('#preview').append($(cvs));
          }
          img.src = "data:image/svg+xml;base64," + btoa(d.svg);
          
        }
        
        break;
    }
  }, false);  
}

$(function() {
  console.log(`loaded...`)
  $('#generate').click(update)
  $('#img').val(`
let mySprite = sprites.create(img\`
    . . . . . . . 6 . . . . . . . .
    . . . . . . 8 6 6 . . . 6 8 . .
    . . . e e e 8 8 6 6 . 6 7 8 . .
    . . e 2 2 2 2 e 8 6 6 7 6 . . .
    . e 2 2 4 4 2 7 7 7 7 7 8 6 . .
    . e 2 4 4 2 6 7 7 7 6 7 6 8 8 .
    e 2 4 5 2 2 6 7 7 6 2 7 7 6 . .
    e 2 4 4 2 2 6 7 6 2 2 6 7 7 6 .
    e 2 4 2 2 2 6 6 2 2 2 e 7 7 6 .
    e 2 4 2 2 4 2 2 2 4 2 2 e 7 6 .
    e 2 4 2 2 2 2 2 2 2 2 2 e c 6 .
    e 2 2 2 2 2 2 2 4 e 2 e e c . .
    e e 2 e 2 2 4 2 2 e e e c . . .
    e e e e 2 e 2 2 e e e c . . . .
    e e e 2 e e c e c c c . . . . .
    . c c c c c c c . . . . . . . .
\`, SpriteKind.Player)

`)
  $('#cell').val(0.81)
  $('#prefix').val("strawberry")
  initWorker();
  update();  
})  

console.log('starting...')
