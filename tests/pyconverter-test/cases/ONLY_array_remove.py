b = [5] # b <= array@number
# remove_at is looked up on array@number
# types are assigned to the symbol
# but instance types should be assigned instead and unified if possible
a = b.remove_at(0) 
a.to_string()