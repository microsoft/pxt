Muatan buffer jika buffer dikirim dalam paket ini atau buffer kosong
panjang % nilai
panjang dari% VALUE
nama perangkat
nomor seri perangkat
cap waktu peristiwa
nilai acara
pada acara | dari %src = control_event_source_id | dengan nilai % value = control_event_value_id
meningkatkan aktivitas | dari sumber %src = control_event_source_id | dengan nilai% value = control_event_value_id
buat sprite di | x: %x | y: %y
pulsa dalam (μs) | pin %name | pulsed %value
Array
Boolean
Gambar
Nomor
Teks
Mengembalikan nilai konstanta c ++ runtime
Mengembalikan nilai konstanta c ++ runtime
definisi opsional tentang bagaimana acara harus diproses setelah konstruksi (defaultnya adalah CREATE_AND_FIRE).
ID Komponen MicroBit yang menghasilkan acara mis. MICROBIT_ID_BUTTON_A.
koordinat horizontal sprite, misal: 2
koordinat vertikal sprite, misal: 2
Mendapat waktu yang tersisa (sejak `mulai hitung mundur`) atau waktu sekarang (sejak perangkat dinyalakan atau` mulai stopwatch`) dalam milidetik.
Mendapatkan sprite yang tidak benar; digunakan untuk menginisialisasi penduduk setempat.
Menunjukkan jika game ini menampilkan permainan di atas urutan.
Mendapatkan nilai yang menunjukkan jika permainan masih berjalan. Mengembalikan `false` jika permainan berakhir.
Mendapatkan tingkat saat ini
Menetapkan nilai kehidupan saat ini
Menampilkan skor di layar.
Mulai timer stopwatch. `waktu sekarang` akan mengembalikan waktu yang telah berlalu.
Usang, kalibrasi kompas otomatis.
Langkah 7
Sudah selesai dilakukan dengan baik! Anda telah menyelesaikan aktivitas Microsoft MakeCode pertama Anda.
@extends
#mendukung
Pastikan Anda mengikuti petunjuk di <a href="/device/serial">cara men-setup koneksi serial</a>dengan @boardname@.
Skenario #example
Skenario yang umum dilakukan adalah memetakan beberapa data sensor, seperti percepatan, dan menganalisisnya di editor. Misalnya, jalankan kode ini di @boardname@ Anda.
Jika koneksi serial Anda bekerja, Anda akan mulai melihat grafik yang menunjukkan bahwa nilai akselerasi <code>x</code> dibaca dari @boardname@.
Tampilan log secara otomatis mendeteksi bahwa ada aliran data dan menampilkan grafik.
Referensi
@description@ List kategori API tersedia di editor
basic.showNumber (0); input.onButtonPressed (Button.A, () = &gt; { }); music.playTone (0, 0); led.plot (0, 0); radio.sendNumber (0);
Majuradio perangkat bluetooth
Lihat juga
<a href="/reference/basic">dasar</a>, <a href="/reference/input">masukan</a>, <a href="/reference/music">musik</a>, <a href="/reference/led">led</a>, <a href="/blocks/math">Matematika (blok)</a>, <5 >String </a>, <a href="/reference/game">permainan</a>, <a href="/reference/images">gambar</a>, <a href="/reference/pins">pin</a>, <a href="/reference/serial">serial</a>, <a href="/reference/control">kontrol<10 >, <a href="/reference/radio">radio</a>, <a href="/reference/devices"> perangkat</a>, <a href="/reference/bluetooth">bluetooth</a>
Membaca dan menulis data melalui koneksi serial.
serial.writeLine (""); serial.writeNumber (0); serial.writeValue ("x", 0); serial.writeString (""); serial.readUntil (","); serial.readLine (); serial.readString (); serial.onDataReceived (",", () = &gt; {})
Maju
serial.redirect (SerialPin.P0, SerialPin.P0, BaudRate.BaudRate115200); serial.redirectToUSB (); serial.writeBuffer (pins.createBuffer (0)); serial.readBuffer (64);
Lihat juga
Nilai menulis
Parameter
Contoh: streaming data
Setiap 10 detik, contoh di bawah ini mengirimkan suhu dan tingkat cahaya ke port serial.
basic.forever (() = &gt; {      serial.writeValue ("temp", input.temperature ())      serial.writeValue ("cahaya", input.lightLevel ())      basic.pause (10000); })
Siaran fungsi <a href="/reference/radio/send-value">kirim nilai</a> pasangan string/nomor.
Anda bisa menggunakan @boardname@ untuk menerimanya, dan kemudian mengirimkannya langsung ke port serial dengan <code>tulis nilai</code>.
Lihat juga
Serial Write String
Tuliskan string ke port <a href="/device/serial">serial</a> tanpa memulai baris baru sesudahnya.
serial.writeString ("");
Parameter
Contoh: serial sederhana
Program ini menulis kata <code>JUMBO</code> ke port serial berulang kali, tanpa baris baru.
Saat tombol <code>A</code> ditekan, contoh berikut akan mengkonfigurasi ulang contoh serial.
Lihat juga
<a href="/device/serial">serial</a>, <a href="/reference/serial/redirect-to-usb">redirectToUSB</a>
Serial Baca Sampai
Baca teks dari port serial sampai ada pembatas.
Kembali
Lihat juga
Serial Read String
Baca data serial buffer sebagai string.
Kembali
Program berikut menggulung teks pada layar saat pesan tersebut berasal dari serial.
Lihat juga
Serial Read Line
Baca baris teks dari port serial.
serial.readLine ();
Contoh berikut meminta nama pengguna, lalu mengulanginya untuk menyapa pengguna.
Serial On Data Diterima
Lihat juga
<a href="/device/pins">@boardname@ pin</a>, <a href="/reference/input/on-pin-pressed">di pin ditekan</a>, <a href="/reference/pins/analog-write-pin">pin tulis analog</a>, <a href="/reference/pins/digital-read-pin">pin baca digital</a>, <a href="/reference/pins/digital-write-pin">pin tulis digital</a>
Analog Pitch
Memancarkan sinyal Pulsa Dengan Modulasi (PWM) ke pin <code>P0</code>. Gunakan <a href="/reference/pins/analog-set-pitch-pin">pin pitch set analog</a> untuk mengatur pin pitch saat ini.
pins.analogPitch (440, 300)
Parameter
<code>frequensi</code> : <a href="/types/number">Nomor</a>
pins.analogSetPitchPin ("P0") biarkan frequency1 = 440 biarkan durasi = 1000 pin.analogSetPitchPin (AnalogPin.P1); pins.analogPitch (frekuensi1, durasi)
Beberapa catatan umum
440 = A4 pada piano
lihat <a href="https://en.wikipedia.org/wiki/Piano_key_frequencies">frekuensi kunci piano </a> untuk informasi lebih lanjut
Lihat juga
<a href="/device/pins">@boardname@ pin </a>, <a href="/reference/pins/analog-set-period">periode set analog</a>, <a href="/reference/pins/analog-set-pitch-pin">pin nada set analog</a>
Perilaku fungsi yang nilai parameternya di luar batas.
Banyak @boardname@ functions memiliki parameter. Jika parameter adalah nilai tak terduga, parameter dianggap <em>di luar batas</em>.
Sebagai contoh, fungsi <a href="/reference/led/plot">plot</a> memiliki dua parameter:
sintaksis
parameter
apa yang terjadi?
Biasanya, ketika parameter yang dipasok ke fungsi berada di luar batas, fungsi itu tidak melakukan apa-apa (seolah-olah fungsinya tidak pernah dieksekusi). Jadi, dalam kasus di atas, layar LED tidak akan berubah.
nilai kembali
Generasi nada musik melalui pin <code>P0</code>.
music.playTone (0, 0); music.ringTone (0); music.rest (0); music.beginMelodi (music.builtInMelody (Melodies.Entertainer), MelodyOptions.Once); music.onEvent (MusicEvent.MelodyNotePlayed, () = &gt; {}); music.beat (BeatFraction.Whole); music.tempo (); music.changeTempoBy (20); music.setTempo (120);
Lihat juga
Menemukan tempo (kecepatan sepotong musik).
music.tempo ()
Kembali
angka <a href="/types/number"></a> yang berarti ketukan per menit (jumlah Ketukan sebentar musik yang @boardname@ sedang diputar).
Lihat juga
biarkan frekuensi = music.noteFrequency (Note.C) music.playTone (frekuensi, 1000) music.rest (1000)
Lihat juga
Putar Nada
Mainkan nada musik melalui pin <code>P0</code> dari @boardname@ selama yang Anda katakan.
Fungsi ini hanya bekerja pada @ boardname @ dan di beberapa browser.
music.playTone (440, 120)
Parameter
Contoh ini menyimpan catatan musik C di variabel <code>freq</code>. Selanjutnya, itu memainkan catatan itu selama 1000 milidetik (satu detik).
biarkan freq = music.noteFrequency (Note.C) music.playTone (freq, 1000)
Menggunakan pin lainnya
Mengubah Tempo Dengan
Fungsi ini hanya bekerja pada @boardname@ dan di beberapa browser.
Parameter
<code>bpm</code> adalah <a href="/types/number">nomor</a> yang mengatakan berapa banyak ganti bpm (beats per minute, atau jumlah beats dalam satu menit musik yang @boardname@ sedang diputar).
Contoh
Program ini membuat musik lebih cepat dengan 12 bpm.
Program ini membuat musik <em>lebih lambat</em> dengan 12 bpm.	change-tempo-by.md	Indonesian	09:25 AM
music.changeTempoBy (12)
Menulis Paket Diterima ke Serial
Tuliskan paket terakhir yang diterima oleh <code>radio</code> ke serial dalam format JSON.
Harus dipanggil dalam callback ke <a href="/reference/radio/on-data-packet-received">pada paket data yang diterima</a>.
radio.writeReceivedPacketToSerial ();
Format data diterima
Format untuk data yang diterima dicetak ke serial adalah sebagai berikut:
kirim nomor
kirim nilai
{v: ValueSent, t: MicrobitTimeAlive, s: SerialNumber, n: "Name"}
kirim string
{t:MicrobitTimeAlive,s:SerialNumber,n:"Text"}
Contoh
Kapan
data diterima (setelah menekan
A
tombol di @ boardname@ kedua), program ini mengirimkan data suhu ke serial.
Contoh output ke serial saat <code>A</code> ditekan:
