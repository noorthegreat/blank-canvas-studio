ffmpeg -y -framerate 35 -i png_sequence/nightsky_%05d.png -c:v prores_ks -profile:v 4 -pix_fmt yuva444p10le src/assets/temp_prores.mov

/usr/bin/avconvert -p PresetHEVC1920x1080WithAlpha -s src/assets/temp_prores.mov -o src/assets/nightsky8_apple.mp4       

