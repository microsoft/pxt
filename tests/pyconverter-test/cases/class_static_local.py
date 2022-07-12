class Greeter:
    greeting = "default"
    def __init__(self, message):

        print ("constructor: " + self.greeting)
        self.greeting = message
        self.local = "local"




greeter = Greeter("world")


print (greeter.greeting)
print (Greeter.greeting)

Greeter.greeting = "newdefault"
greeter = Greeter("world")
print (Greeter.greeting)
greeter.greeting = None
print (greeter.greeting)