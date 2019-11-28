for file in $(find . -name "*.gif"); 
do
    gifsicle --dither --colors 256 -O3 "$file" -o "$file"
done