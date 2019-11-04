for file in *.jpeg ; do
    mv "$file" "${file/%.jpeg/.jpg}"
done
for file in *.JPEG ; do
    mv "$file" "${file/%.JPEG/.jpg}"
done
for file in *.JPG ; do
    mv "$file" "${file/%.JPG/.jpg}"
done
for file in *.PNG ; do
    mv "$file" "${file/%.PNG/.png}"
done
find . -name '*.jpg' -exec magick mogrify -resize 800x600\> -strip -interlace Plane -sampling-factor 4:2:0 -quality 82% {} +
find . -name '*.png' -exec magick mogrify -strip -filter Triangle -define filter:support=2 -unsharp 0.25x0.08+8.3+0.045 -dither None -posterize 136 -quality 82 -define jpeg:fancy-upsampling=off -define png:compression-filter=5 -define png:compression-level=9 -define png:compression-strategy=1 -define png:exclude-chunk=all -interlace none -colorspace sRGB {} +
