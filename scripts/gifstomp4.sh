for file in $(find . -name "*.gif"); 
do
    magick convert "$file[0]" "${file%.gif}.png";
    ffmpeg -y -f gif -i "$file" -pix_fmt yuv420p -movflags faststart -vf "scale=trunc(iw/2)*2:trunc(ih/2)*2" "${file%.gif}.mp4";
done
