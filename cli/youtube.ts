
import * as nodeutil from './nodeutil';

export const GOOGLE_API_KEY = "GOOGLE_API_KEY";

function apiKey() {
    const k = process.env[GOOGLE_API_KEY];
    if (!k) {
        throw new Error(`Missing ${GOOGLE_API_KEY} to access YouTube Apis. Use https://console.developers.google.com/ to generate a new API key.`)
    }
    return k;
}

/**
{
 "kind": "youtube#playlistListResponse",
 "etag": "\"nxOHAKTVB7baOKsQgTtJIyGxcs8/psJ8Rxgxdewxvp8Q-gaDIWOn5Ok\"",
 "pageInfo": {
  "totalResults": 1,
  "resultsPerPage": 5
 },
 "items": [
  {
   "kind": "youtube#playlist",
   "etag": "\"nxOHAKTVB7baOKsQgTtJIyGxcs8/0llZPewpv-N5YH7WR-wnn4fRBRI\"",
   "id": "PLMMBk9hE-Ser4QDPyX7kmA3bdghBwRSWd",
   "snippet": {
    "publishedAt": "2020-04-22T17:32:12.000Z",
    "channelId": "UCye7YlvFUUQ1dSy0WZZ1T_Q",
    "title": "MakeCode Python",
    "description": "",
    "thumbnails": {
     "default": {
      "url": "https://i.ytimg.com/vi/qTEo2X3N2ZI/default.jpg",
      "width": 120,
      "height": 90
     },
     "medium": {
      "url": "https://i.ytimg.com/vi/qTEo2X3N2ZI/mqdefault.jpg",
      "width": 320,
      "height": 180
     },
     "high": {
      "url": "https://i.ytimg.com/vi/qTEo2X3N2ZI/hqdefault.jpg",
      "width": 480,
      "height": 360
     },
     "standard": {
      "url": "https://i.ytimg.com/vi/qTEo2X3N2ZI/sddefault.jpg",
      "width": 640,
      "height": 480
     },
     "maxres": {
      "url": "https://i.ytimg.com/vi/qTEo2X3N2ZI/maxresdefault.jpg",
      "width": 1280,
      "height": 720
     }

 */

interface PlaylistResource {
    items: Playlist[];
}

interface Playlist {
    id: string;
    snippet: {
        publishedAt: string;
        channelId: string;
        title: string;
        description: string;
        thumbnails: Thumbnails;
    }
}

interface Thumbnail {
    url: string;
    width: number;
    height: number;
}

interface Thumbnails {
    default?: Thumbnail;
    medium?: Thumbnail;
    high?: Thumbnail;
    standard?: Thumbnail;
    maxres?: Thumbnail;
}

function playlistInfoAsync(playlistId: string) {
    const key = apiKey();
    const part = "snippet"
    const url = `https://www.googleapis.com/youtube/v3/playlists?part=${part}&maxResults=20&id=${playlistId}&key=${key}`;
    return pxt.Util.httpGetJsonAsync(url)
        .then((res: PlaylistResource) => res.items[0]);
}


/*
{
 "kind": "youtube#playlistItemListResponse",
 "etag": "\"nxOHAKTVB7baOKsQgTtJIyGxcs8/kRMK8xNbW9Z9-U4jdP-F7nacCjo\"",
 "pageInfo": {
  "totalResults": 2,
  "resultsPerPage": 20
 },
 "items": [
  {
   "kind": "youtube#playlistItem",
   "etag": "\"nxOHAKTVB7baOKsQgTtJIyGxcs8/w_iAFjV79HcHGDi3aOKVmOExSek\"",
   "id": "UExNTUJrOWhFLVNlcjRRRFB5WDdrbUEzYmRnaEJ3UlNXZC41NkI0NEY2RDEwNTU3Q0M2",
   "snippet": {
    "publishedAt": "2020-04-22T17:32:21.000Z",
    "channelId": "UCye7YlvFUUQ1dSy0WZZ1T_Q",
    "title": "MakeCode Python for Minecraft:Education Edition - Super Digger",
    "description": "",
    "thumbnails": {
     "default": {
      "url": "https://i.ytimg.com/vi/cH3U-U3AmKc/default.jpg",
      "width": 120,
      "height": 90
     },
     "medium": {
      "url": "https://i.ytimg.com/vi/cH3U-U3AmKc/mqdefault.jpg",
      "width": 320,
      "height": 180
     },
     "high": {
      "url": "https://i.ytimg.com/vi/cH3U-U3AmKc/hqdefault.jpg",
      "width": 480,
      "height": 360
     },
     "standard": {
      "url": "https://i.ytimg.com/vi/cH3U-U3AmKc/sddefault.jpg",
      "width": 640,
      "height": 480
     },
     "maxres": {
      "url": "https://i.ytimg.com/vi/cH3U-U3AmKc/maxresdefault.jpg",
      "width": 1280,
      "height": 720
     }
    },
    "channelTitle": "Microsoft MakeCode",
    "playlistId": "PLMMBk9hE-Ser4QDPyX7kmA3bdghBwRSWd",
    "position": 0,
    "resourceId": {
     "kind": "youtube#video",
     "videoId": "cH3U-U3AmKc"
    }
   }
  },
  {
   "kind": "youtube#playlistItem",
   "etag": "\"nxOHAKTVB7baOKsQgTtJIyGxcs8/RMAbRHVQ3veBcE8D8KJ1RAa9nt8\"",
   "id": "UExNTUJrOWhFLVNlcjRRRFB5WDdrbUEzYmRnaEJ3UlNXZC4yODlGNEE0NkRGMEEzMEQy",
   "snippet": {
    "publishedAt": "2020-04-22T17:32:52.000Z",
    "channelId": "UCye7YlvFUUQ1dSy0WZZ1T_Q",
    "title": "MakeCode Python for Minecraft:Education Edition - Chicken Rain",
    "description": "Learn to code using MakeCode and Minecraft EDU. \n* Download MinecraftEDU https://education.minecraft.net/get-started/download/\n* setup your video stream https://youtu.be/HRtzLjkqIJk\n* questions and feedback https://aka.ms/makecodeliveforum\n* show & tell Flipgrid https://flipgrid.com/e915ed6b\n* live streaming: https://mixer.com/MakeCode\n* all info at https://makecode.com/online-learning\n\nIf your school is using Office 365, your account probably already works with Minecraft:Education Edition. If your Office 365 account does not work, Minecraft:Education Edition is free through June 2020 for anyone with an Office 365 Education sign-in. \nRead the [announcement]( https://education.minecraft.net/blog/microsoft-extends-access-to-minecraft-education-edition-and-resources-to-support-remote-learning/) on how to enable it.",
    "thumbnails": {
     "default": {
      "url": "https://i.ytimg.com/vi/qTEo2X3N2ZI/default.jpg",
      "width": 120,
      "height": 90
     },
     "medium": {
      "url": "https://i.ytimg.com/vi/qTEo2X3N2ZI/mqdefault.jpg",
      "width": 320,
      "height": 180
     },
     "high": {
      "url": "https://i.ytimg.com/vi/qTEo2X3N2ZI/hqdefault.jpg",
      "width": 480,
      "height": 360
     },
     "standard": {
      "url": "https://i.ytimg.com/vi/qTEo2X3N2ZI/sddefault.jpg",
      "width": 640,
      "height": 480
     },
     "maxres": {
      "url": "https://i.ytimg.com/vi/qTEo2X3N2ZI/maxresdefault.jpg",
      "width": 1280,
      "height": 720
     }
    },
    "channelTitle": "Microsoft MakeCode",
    "playlistId": "PLMMBk9hE-Ser4QDPyX7kmA3bdghBwRSWd",
    "position": 1,
    "resourceId": {
     "kind": "youtube#video",
     "videoId": "qTEo2X3N2ZI"
    }
   }
  }
 ]
}
*/

interface PlaylistItem {
    snippet: {
        title: string;
        description: string;
        publishedAt: string;
        thumbnails: Thumbnails;
        resourceId: {
            videoId: string;
        }
    }
}

interface PlaylistVideos {
    items: PlaylistItem[];
}

function listPlaylistVideosAsync(playlistId: string) {
    const key = apiKey();
    const part = "snippet"
    const url = `https://www.googleapis.com/youtube/v3/playlistItems?part=${part}&maxResults=20&playlistId=${playlistId}&key=${key}`;
    return pxt.Util.httpGetJsonAsync(url)
        .then((res: PlaylistVideos) => res);
}

async function renderPlaylistAsync(fn: string, id: string): Promise<void> {
    const playlist = await playlistInfoAsync(id);
    const videos = await listPlaylistVideosAsync(id);
    const playlistUrl = `https://www.youtube.com/playlist?list=${playlist.id}`;
    const cards: pxt.CodeCard[] = videos.items.map(video => <pxt.CodeCard>{
        return {
            "title": video.snippet.title,
            "description": video.snippet.description || "",
            "youTubeId": video.snippet.resourceId.videoId
        }
    }).concat([{
        "title": "PlayList",
        "description": "See entire playlist on YouTube",
        "url": playlistUrl
    }]);
    const md = 
`# ${playlist.snippet.title}

${playlist.snippet.description || ""}

* [Open Playlist](${playlistUrl})

\`\`\`codecards
[${JSON.stringify(cards, null, 4)}]
\`\`\`
`

    nodeutil.writeFileSync(fn, md, { encoding: "utf8" });
}

export function renderPlaylistsAsync(playlists: pxt.Map<string>): Promise<void> {
    return Promise.all(Object.keys(playlists).map(fn => renderPlaylistAsync(fn, playlists[fn])))
        .then(() => { pxt.log('playlists refreshed')});
}