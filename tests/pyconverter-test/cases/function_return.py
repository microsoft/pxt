def return_void():
    x = True

def return_simple():
    return 0

def return_recursive(a):
    if a <= 0:
        return return_simple()
    else: 
        return return_recursive(a - 1)

return_recursive(3)