numbers = [2, 10, 1]

numbers.sort()
for n in numbers:
    print(n)

def sorter(a, b): 
    return b - a
numbers.sort(sorter)
for n in numbers:
    print(n)