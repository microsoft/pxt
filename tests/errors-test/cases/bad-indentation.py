if True:
def on_chat(num1, num2, num3): # TS9554 missing
print("a") # TS9554 missing
    pass # TS9573 unexpected
on_chat(1, 2, 3)
    pass # TS9573 unexpected

if True:
if True: # TS9554 missing
    pass

a = 5
if True:
    b = 3 # TS9552 inconsistent
   c = 4