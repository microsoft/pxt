sh ./optimize-gifs.sh
for file in *.jpeg ; do
    mv "$file" "${file/%.jpeg/.jpg}"
done
find . -name '*.png' -size +200k -exec magick mogrify -format jpg {} +
find . -name '*.png' -size +200k -delete
find . -name '*.jpg' -exec magick mogrify -resize 800x600\> -strip -interlace Plane -sampling-factor 4:2:0 -quality 82% {} +
find . -name '*.png' -exec magick mogrify -strip -filter Triangle -define filter:support=2 -unsharp 0.25x0.08+8.3+0.045 -dither None -posterize 136 -quality 82 -define jpeg:fancy-upsampling=off -define png:compression-filter=5 -define png:compression-level=9 -define png:compression-strategy=1 -define png:exclude-chunk=all -interlace none -colorspace sRGB {} +
find . -name '*.png' -size +100k -exec magick mogrify -format jpg {} +
