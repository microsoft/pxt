# Native python

### @diffs false
## Step 1 @showdialog

Tutorials can be written with code in Python.
```python
def on_chat():
    # @highlight
    player.teleport(pos(0, 100, 0))
player.on_chat("jump", on_chat)
```

## Step 2

Show some LEDs

```python
builder.teleport_to(pos(0, 0, 0))
for i in range(25):
    builder.move(FORWARD, 1)
    builder.move(UP, 1)
```