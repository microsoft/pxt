Test file to be loaded in pxt-arcade.

```diff
let x = 1 + 1;
------------
let x = 1 + (2 * 3);
```

```diffblocks
let x = 1 + 1;
------------
let x = 1 + (2 * 3);
```

----------

```diff
let x = 1;
------------
let y = 1;
```

```diffblocks
let x = 1;
------------
let y = 1;
```

----------

```diffblocks
scene.setBackgroundColor(7)
------------
let mySprite: Sprite = null
scene.setBackgroundColor(7)
mySprite = sprites.create(img`
. . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . 
`, SpriteKind.Player)
```


```diffblocks
let mySprite: Sprite = null
scene.setBackgroundColor(7)
mySprite = sprites.create(img`
. . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . 
`, SpriteKind.Player)
------------
let mySprite: Sprite = null
scene.setBackgroundColor(7)
mySprite = sprites.create(img`
. . . . . 5 5 5 5 5 5 . . . . . 
. . . 5 5 5 5 5 5 5 5 5 5 . . . 
. . 5 5 5 5 5 5 5 5 5 5 5 5 . . 
. 5 5 5 5 5 5 5 5 5 5 5 5 5 5 . 
. 5 5 5 f f 5 5 5 5 f f 5 5 5 .
5 5 5 5 f f 5 5 5 5 f f 5 5 5 5 
5 5 5 5 5 5 5 5 5 5 5 5 5 5 5 5 
5 5 5 5 5 5 5 5 5 5 5 5 5 5 5 5 
5 5 5 5 5 5 5 5 5 5 5 5 5 5 5 5 
5 5 f 5 5 5 5 5 5 5 5 5 5 f 5 5 
5 5 5 f 5 5 5 5 5 5 5 5 f 5 5 5 
. 5 5 5 f 5 5 5 5 5 5 f 5 5 5 . 
. 5 5 5 5 f f f f f f 5 5 5 5 . 
. . 5 5 5 5 5 5 5 5 5 5 5 5 . . 
. . . 5 5 5 5 5 5 5 5 5 5 . . . 
. . . . . 5 5 5 5 5 5 . . . . .
`, SpriteKind.Player)
```

```diffblocks
let mySprite: Sprite = null
scene.setBackgroundColor(7)
mySprite = sprites.create(img`
. . . . . 5 5 5 5 5 5 . . . . . 
. . . 5 5 5 5 5 5 5 5 5 5 . . . 
. . 5 5 5 5 5 5 5 5 5 5 5 5 . . 
. 5 5 5 5 5 5 5 5 5 5 5 5 5 5 . 
. 5 5 5 f f 5 5 5 5 f f 5 5 5 .
5 5 5 5 f f 5 5 5 5 f f 5 5 5 5 
5 5 5 5 5 5 5 5 5 5 5 5 5 5 5 5 
5 5 5 5 5 5 5 5 5 5 5 5 5 5 5 5 
5 5 5 5 5 5 5 5 5 5 5 5 5 5 5 5 
5 5 f 5 5 5 5 5 5 5 5 5 5 f 5 5 
5 5 5 f 5 5 5 5 5 5 5 5 f 5 5 5 
. 5 5 5 f 5 5 5 5 5 5 f 5 5 5 . 
. 5 5 5 5 f f f f f f 5 5 5 5 . 
. . 5 5 5 5 5 5 5 5 5 5 5 5 . . 
. . . 5 5 5 5 5 5 5 5 5 5 . . . 
. . . . . 5 5 5 5 5 5 . . . . .
`, SpriteKind.Player)
------------
let mySprite: Sprite = null
scene.setBackgroundColor(7)
mySprite = sprites.create(img`
. . . . . 5 5 5 5 5 5 . . . . . 
. . . 5 5 5 5 5 5 5 5 5 5 . . . 
. . 5 5 5 5 5 5 5 5 5 5 5 5 . . 
. 5 5 5 5 5 5 5 5 5 5 5 5 5 5 . 
. 5 5 5 f f 5 5 5 5 f f 5 5 5 .
5 5 5 5 f f 5 5 5 5 f f 5 5 5 5 
5 5 5 5 5 5 5 5 5 5 5 5 5 5 5 5 
5 5 5 5 5 5 5 5 5 5 5 5 5 5 5 5 
5 5 5 5 5 5 5 5 5 5 5 5 5 5 5 5 
5 5 f 5 5 5 5 5 5 5 5 5 5 f 5 5 
5 5 5 f 5 5 5 5 5 5 5 5 f 5 5 5 
. 5 5 5 f 5 5 5 5 5 5 f 5 5 5 . 
. 5 5 5 5 f f f f f f 5 5 5 5 . 
. . 5 5 5 5 5 5 5 5 5 5 5 5 . . 
. . . 5 5 5 5 5 5 5 5 5 5 . . . 
. . . . . 5 5 5 5 5 5 . . . . .
`, SpriteKind.Player)
controller.moveSprite(mySprite)
```

```diffblocks
let mySprite: Sprite = null
scene.setBackgroundColor(7)
mySprite = sprites.create(img`
. . . . . 5 5 5 5 5 5 . . . . . 
. . . 5 5 5 5 5 5 5 5 5 5 . . . 
. . 5 5 5 5 5 5 5 5 5 5 5 5 . . 
. 5 5 5 5 5 5 5 5 5 5 5 5 5 5 . 
. 5 5 5 f f 5 5 5 5 f f 5 5 5 .
5 5 5 5 f f 5 5 5 5 f f 5 5 5 5 
5 5 5 5 5 5 5 5 5 5 5 5 5 5 5 5 
5 5 5 5 5 5 5 5 5 5 5 5 5 5 5 5 
5 5 5 5 5 5 5 5 5 5 5 5 5 5 5 5 
5 5 f 5 5 5 5 5 5 5 5 5 5 f 5 5 
5 5 5 f 5 5 5 5 5 5 5 5 f 5 5 5 
. 5 5 5 f 5 5 5 5 5 5 f 5 5 5 . 
. 5 5 5 5 f f f f f f 5 5 5 5 . 
. . 5 5 5 5 5 5 5 5 5 5 5 5 . . 
. . . 5 5 5 5 5 5 5 5 5 5 . . . 
. . . . . 5 5 5 5 5 5 . . . . .
`, SpriteKind.Player)
controller.moveSprite(mySprite)
------------
let mySprite: Sprite = null
let mySprite2: Sprite = null
scene.setBackgroundColor(7)
mySprite = sprites.create(img`
. . . . . 5 5 5 5 5 5 . . . . . 
. . . 5 5 5 5 5 5 5 5 5 5 . . . 
. . 5 5 5 5 5 5 5 5 5 5 5 5 . . 
. 5 5 5 5 5 5 5 5 5 5 5 5 5 5 . 
. 5 5 5 f f 5 5 5 5 f f 5 5 5 .
5 5 5 5 f f 5 5 5 5 f f 5 5 5 5 
5 5 5 5 5 5 5 5 5 5 5 5 5 5 5 5 
5 5 5 5 5 5 5 5 5 5 5 5 5 5 5 5 
5 5 5 5 5 5 5 5 5 5 5 5 5 5 5 5 
5 5 f 5 5 5 5 5 5 5 5 5 5 f 5 5 
5 5 5 f 5 5 5 5 5 5 5 5 f 5 5 5 
. 5 5 5 f 5 5 5 5 5 5 f 5 5 5 . 
. 5 5 5 5 f f f f f f 5 5 5 5 . 
. . 5 5 5 5 5 5 5 5 5 5 5 5 . . 
. . . 5 5 5 5 5 5 5 5 5 5 . . . 
. . . . . 5 5 5 5 5 5 . . . . .
`, SpriteKind.Player)
controller.moveSprite(mySprite)
mySprite2 = sprites.create(img`
. . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . 
`, SpriteKind.Player)
```

```diffblocks
let mySprite: Sprite = null
let mySprite2: Sprite = null
scene.setBackgroundColor(7)
mySprite = sprites.create(img`
. . . . . 5 5 5 5 5 5 . . . . . 
. . . 5 5 5 5 5 5 5 5 5 5 . . . 
. . 5 5 5 5 5 5 5 5 5 5 5 5 . . 
. 5 5 5 5 5 5 5 5 5 5 5 5 5 5 . 
. 5 5 5 f f 5 5 5 5 f f 5 5 5 .
5 5 5 5 f f 5 5 5 5 f f 5 5 5 5 
5 5 5 5 5 5 5 5 5 5 5 5 5 5 5 5 
5 5 5 5 5 5 5 5 5 5 5 5 5 5 5 5 
5 5 5 5 5 5 5 5 5 5 5 5 5 5 5 5 
5 5 f 5 5 5 5 5 5 5 5 5 5 f 5 5 
5 5 5 f 5 5 5 5 5 5 5 5 f 5 5 5 
. 5 5 5 f 5 5 5 5 5 5 f 5 5 5 . 
. 5 5 5 5 f f f f f f 5 5 5 5 . 
. . 5 5 5 5 5 5 5 5 5 5 5 5 . . 
. . . 5 5 5 5 5 5 5 5 5 5 . . . 
. . . . . 5 5 5 5 5 5 . . . . .
`, SpriteKind.Player)
controller.moveSprite(mySprite)
mySprite2 = sprites.create(img`
. . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . 
`, SpriteKind.Player)
----------
sprites.onOverlap(SpriteKind.Player, SpriteKind.Food, function (sprite, otherSprite) {
	info.changeScoreBy(1)
})
```

----------

```diff
let x = 1;
------------
let x = 1;
let y = 1;
```

```diffblocks
let x = 1;
------------
let x = 1;
let y = 1;
```

----------


```diff
let x = 1
let y = 1
------------
let x = 1
let y = 1
let z = 1
```

```diffblocks
let x = 1
let y = 1
------------
let x = 1
let y = 1
let z = 1
```

----------


```diff
console.log("1");
------------
console.log("1");
console.log("2");
```

```diffblocks
console.log("1");
------------
console.log("1");
console.log("2");
```

----------


```diff
console.log(
    "1"
    );
------------
console.log(
    "1"
    );
console.log("2");
```

```diffblocks
console.log(
    "1"
    );
------------
console.log(
    "1"
    );
console.log("2");
```

----------


```diff
game.onUpdate(function() {
    let x = 1;
})
------------
game.onUpdate(function() {
    let y = 1;
})
```

```diffblocks
game.onUpdate(function() {
    let x = 1;
})
------------
game.onUpdate(function() {
    let y = 1;
})
```

----------

```diff
game.onUpdate(function() {
    let y = 1;
})
------------
game.onUpdate(function() {
    let y = 1;
    let z = 1;
})
```

```diffblocks
game.onUpdate(function() {
    let y = 1;
})
------------
game.onUpdate(function() {
    let y = 1;
    let z = 1;
})
```

----------

```diff
let x = 1 + (2 * 3);
------------
let x = 1 + (2 * 3);
let y = 1;
```

```diffblocks
let x = 1 + (2 * 3);
------------
let x = 1 + (2 * 3);
let y = 1;
```
----------

```diff
let x = 1 + (
    2 
    * 3);
------------
let x = 1 + (
    4 
    * 3);
```

```diffblocks
let x = 1 + (
    2 
    * 3);
------------
let x = 1 + (
    4 
    * 3);
```
----------


```diff
for(let i = 0; i < 5; ++i) {
    console.log("1")
}
------------
for(let i = 0; i < 5; ++i) {
    console.log("1")
    console.log("2")
}
```

```diffblocks
for(let i = 0; i < 5; ++i) {
    console.log("1")
}
------------
for(let i = 0; i < 5; ++i) {
    console.log("1")
    console.log("2")
}
```
