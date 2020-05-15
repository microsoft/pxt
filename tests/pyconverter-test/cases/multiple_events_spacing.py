#%{ "whitespaceSensitive": true }
testNamespace.defaultArguments(1)
testNamespace.defaultArguments(2)

def on_died():
    pass
player.on_died(on_died)

def on_died2():
    pass
player.on_died(on_died2)

testNamespace.defaultArguments(3)
testNamespace.defaultArguments(4)