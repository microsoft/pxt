def count(n):
    print(n)
    if n <= 0:
        return 0
    else:
        return count(n - 1)

count(3)