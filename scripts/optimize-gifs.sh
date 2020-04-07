for file in $(find . -name "*.gif"); 
do
    # keep old copy
    cp "$file" "$file.original"
    # render file
    gifsicle --dither --colors 256 -O3 "$file" -o "$file"
    # read size from both files
    old_kb=`du -k "$file.original" | cut -f1`
    new_kb=`du -k "$file" | cut -f1`
    diff_kb=$(( $new_kb - $old_kb ))
    printf '%dkb\t%s\n' $diff_kb "$file"
    # cleanup if improved
    if [ $old_kb -lt $new_kb ]
    then # delete new file and restore old
        cp -f "$file.original" "$file"
    fi
    # delete old copy
    rm -f "$file.original"
    # regenerate mp4
    png="${file%.gif}.png";
    if [ ! test -f "$png" ]
    then
        magick convert "$file[0]" "${file%.gif}.png";
    fi
    ffmpeg -y -f gif -i "$file" -pix_fmt yuv420p -movflags faststart -vf "scale=trunc(iw/2)*2:trunc(ih/2)*2" "${file%.gif}.mp4";
done