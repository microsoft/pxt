find . -name '*.png' -size +200k -exec magick mogrify -format jpg {} +
find . -name '*.png' -size +200k -delete