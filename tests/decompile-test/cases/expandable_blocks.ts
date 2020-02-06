
expandable.optionalParams("hello", 180, true, Direction.Right);
expandable.optionalParams("hi there", 180);

expandable.justOptional();
expandable.justOptional("how are you");

expandable.optionalSubset("i am fine", 180, true);
expandable.optionalSubset("that is good", 180, true, Direction.Right);