#/ <reference path="./testBlocks/mb.ts" />
pauseUntil(lambda: True)
pauseUntil(lambda: True, 500)
pauseUntil(None)
def function_0():
  return False
pauseUntil(function_0)
def function_1():
  x = 0
  return x > 7
pauseUntil(function_1)