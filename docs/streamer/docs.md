# MakeCode Streamer BETA

**Streamer BETA**, https://makecode.com/streamer, is an experimental web application that simplifies the creation of 
interactive, high quality coding videos. Streamer is designed for teachers, students or
generally anyone who would want to do any kind of online MakeCode coding.

* got feedback or questions? https://forum.makecode.com/t/introducing-makecode-streamer/2437

https://youtu.be/P59Q0i6Zkrg

## Why Streamer?

"Streaming" is a very popular activity these days where gamers "stream" their gameplay on Twitch.tv and Mixer. Popular streams may have tens of thousands (or more) viewers watching them play. However, they are not just broadcasting; they are also interacting with their audience in various ways. The interaction between the live audience and the artist is one of the reasons streaming is so successul.

Talented streamers have a sophisticated live production environment to remix their webcams, game streams, sounds and live chat. Viewers can triggers events by making donation, vote for outcome of the game, etc...

Streamer aims at bringing some of the production magic of professional streamers into a simple integrated web page. It is designed to simplify the creating of interactive "live" (or recorded) coding sessions.

Streamer allows to seamlessly integrate your webcam feed(s), coding window and streaming chats into a single view.

* optimal screen layout for code editor and/or webcam(s)
* preset scenes optimized for online coding sessions: starting soon with countdown, left webcam + editor, right web cam + editor and chat
* on screen painting tools to highlight, mark, show parts of the screen
* embedding of Mixer or Twitch.tv chat windows if needed
* green screen chroma keying (erasing the green screen of a camera)
* record presentation to file
* integrated live captioning
* styling and theming to meet your organization branding

### ~ hint

Streamer uses the latest web technologies and only works in latest Edge or Chrome

### ~

## When to use Streamer?

Here are typical scenarios to use Streamer.

### Teacher in a live meeting

You are presenting a programming concept using a MakeCode editor to a live audience using
a conferencing tool. Turn off your webcam and share your Streamer browser tab. Your audience will see you and the code at all times.

The audience should use the chat to interact or ask questions.

### Teacher recording a lesson

Streamer let you automatically remix your video feed and the programming feed. It generates a video file that can be consumed in most conferencing application or YouTube.

### Student recording an assignment

As part of a returning an assignment, a student could record video "walking" through her/his code.

### Live streaming on Twitch or Mixer

Streamer simplifies the setup of scenes in your streaming software, you only have one scene :) You can definitely integrate Streamer in your exisiting OBS/StreamLabs/...

## How to use Streamer?

### Editor

Choose the MakeCode you wish to use. For some editors, like the micro:bit, you may want to use 2 editors at the same time (for radio coding for example).

### Face camera and document camera

The face camera is the primary web cam that points at you, the document camera would typically be filming a table or a device.

### Contrast, brightness, saturation

Don't hesitate to improve your video quality by tweaking those settings. Getting a good light source is the best way to increase your video quality (not an expensive camera).

### Rotation

The camera feed maybe be rotated backwards, this is quite common when using a document camera point down. Using the ``rotate 180 degrees`` to fix the orientation of the camera.

### Green screen

A green screen is a way to minimize the oclusion of your webcam over the code editor. Any green screen drapped placed behind you will work, make sure it is well lighted.

### Paint tools

The paint tools overlay 2d graphics on top of the video stream. You can use arrows, rectangle,
pen, highlighter, etc...

In settings, you can specify which emojis you want to be used.

### Captions

#### ~ hint

This feature relies on an experiment web api only available in Chrome.

#### ~

Turn on captioning, to display speech recognized sub titles. Quality may vary :)

## Recording

### How to

Click on the record icon, you will be prompted to select a screen. Select the current browser tab then resize the window to a 16/9 ratio,
like 1920x1080. Once your recording is done, click stop to generate the ``.webm`` file to your ``Downloads`` folder.

### Microphone delay offset

The video output and your microphone typically have a delay that needs to be compensated. To compute the delay, record a video and clap!
Then measure the time between the clap sound and the video. That's your offset!

### File format

Streamer will save your recording as a ".webm" file with the "h264" codec. .webm files can be uploaded to YouTube or viewed in Chrome or Edge but some popular video editting tools don't support this, like iMovie. One way to get around this is to convert it into a more standard format like .mp4. To do this, we recommend using a popular command line tool called "ffmpeg". 

#### Installing ffmpeg

Here are a few links to get you started.

Windows: https://video.stackexchange.com/questions/20495/how-do-i-set-up-and-use-ffmpeg-in-windows
Mac: https://superuser.com/questions/624561/install-ffmpeg-on-os-x

or try searching "install ffmpeg" in your favorite search engine

#### Converting to .mp4

Once ffmpeg is installed, you can run this command:
```
ffmpeg -i sample.webm -c:v copy sample.mp4
```
from the command line.

## Streaming

### Mixer

Enter your Mixer channel name in the text box. For example, if your url is ``https://makecode.com/MakeCode``, enter ``MakeCode``.

Streamer will display a chat icon that allows to toggle on/off an embedded chat. Streamer will also automatically show the chat whenever a new message is entered in the chat by a user.

## Advanced

## Styling

You can specify the title, subtitle, video subtitles and various other places. You can specify a background image or video.

The introduction video will automatically run once when transitioning from the countdown scene to any other view. This is typically a branding video.

The ending video will automatically run when transition from the any sence to the countdown scene. This is the time to wrap up your demo and eventually
stop the recording.
