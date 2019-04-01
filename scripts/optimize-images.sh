for file in $(find . -name "*.gif"); 
do 
    magick convert "$file[0]" "${file%.gif}.png";
    # ffmpeg -y -f gif -i "$file" -pix_fmt yuv420p -c:v libx264 -movflags +faststart -filter:v crop='floor(in_w/2)*2:floor(in_h/2)*2' "${file%.gif}.mp4";
done
find . -name '*.png' -size +200k -exec magick mogrify -format jpg {} +
find . -name '*.png' -size +200k -delete
find . -name '*.jpg' -exec magick mogrify -resize 800x600\> -strip -interlace Plane -sampling-factor 4:2:0 -quality 82% {} +
find . -name '*.png' -exec magick mogrify -strip -filter Triangle -define filter:support=2 -unsharp 0.25x0.08+8.3+0.045 -dither None -posterize 136 -quality 82 -define jpeg:fancy-upsampling=off -define png:compression-filter=5 -define png:compression-level=9 -define png:compression-strategy=1 -define png:exclude-chunk=all -interlace none -colorspace sRGB {} +
find . -name '*.png' -size +100k -exec magick mogrify -format jpg {} +
