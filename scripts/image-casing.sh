find -name '*.JPEG' | sed 's/\(.*\)\.JPEG/git mv "\1.JPEG" "\1.jpg"/' |sh
find -name '*.JPG' | sed 's/\(.*\)\.JPG/git mv "\1.JPG" "\1.jpg"/' |sh
find -name '*.PNG' | sed 's/\(.*\)\.PNG/git mv "\1.PNG" "\1.png"/' |sh
find -name '*.GIF' | sed 's/\(.*\)\.GIF/git mv "\1.GIF" "\1.gif"/' |sh
find -name '*.MP4' | sed 's/\(.*\)\.MP4/git mv "\1.MP4" "\1.mp4"/' |sh
