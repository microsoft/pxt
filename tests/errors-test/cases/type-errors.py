a = 5
a = 'hi' #TS9500 num and str

for a in 0: # TS9500 iterating over num
    print(a)

a = 5 - "a" # TS9500

def helper():
    if True:
        return 5
    else:
        return "what" # TS9500 returning num or str