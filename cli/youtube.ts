
import * as nodeutil from './nodeutil';
import * as path from 'path';
import * as fs from 'fs';

export const GOOGLE_API_KEY = "GOOGLE_API_KEY";

function apiKey() {
    const k = process.env[GOOGLE_API_KEY];
    if (!k) {
        throw new Error(`Missing ${GOOGLE_API_KEY} to access YouTube Apis. Use https://console.developers.google.com/ to generate a new API key.`)
    }
    return k;
}

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

function resolveThumbnail(thumbnails: Thumbnails) {
    const url = (thumbnails.medium || thumbnails.high || thumbnails.standard || thumbnails.default).url;
    return url;
}

function playlistInfoAsync(playlistId: string) {
    const key = apiKey();
    const url = `https://www.googleapis.com/youtube/v3/playlists?part=snippet&id=${playlistId}&key=${key}`;
    return pxt.Util.httpGetJsonAsync(url)
        .then((res: PlaylistResource) => res.items[0]);
}

interface PlaylistItem {
    snippet: {
        title: string;
        description: string;
        publishedAt: string;
        thumbnails: Thumbnails;
        position: number;
        resourceId: {
            videoId: string;
        }
    }
}

interface PlaylistVideos {
    nextPageToken: string;
    prevPageToken: string;
    items: PlaylistItem[];
}

async function listPlaylistVideosAsync(playlistId: string): Promise<PlaylistItem[]> {
    let items: PlaylistItem[] = []
    const key = apiKey();
    let pageToken: string = undefined;
    do {
        let url = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=50&playlistId=${playlistId}&key=${key}`;
        if (pageToken)
            url += `&pageToken=${pageToken}`;
        const videos = await pxt.Util.httpGetJsonAsync(url)
        items = items.concat(videos.items);
        pageToken =  videos.nextPageToken;
    } while(pageToken);

    return items;
}

function resolveDescription(d: string) {
    return d.split('.', 1)[0];
}

async function renderPlaylistAsync(fn: string, id: string): Promise<void> {
    fn = fn.replace(/\.md$/i, '');
    const assets = `/static/${fn}`
    const playlist = await playlistInfoAsync(id);
    const videos = await listPlaylistVideosAsync(id);
    const playlistUrl = `https://www.youtube.com/playlist?list=${playlist.id}`;
    const cards: pxt.CodeCard[] = videos.map(video => {
        return <pxt.CodeCard>{
            "name": video.snippet.title.replace(/[^-]*-/, '').trim(),
            "description": resolveDescription(video.snippet.description),
            "youTubeId": video.snippet.resourceId.videoId,
            "imageUrl": resolveThumbnail(video.snippet.thumbnails)
        }
    });
    // download images for cards
    for (const card of cards) {
        const cimg = `${assets}/${card.youTubeId}.jpg`;
        const limg = `docs${cimg}`;
        if (!nodeutil.fileExistsSync(limg)) {
            const rimg = await pxt.Util.requestAsync({ 
                url: card.imageUrl, 
                method: "GET",
                responseArrayBuffer: true 
            });
            await fs.writeFile(limg, rimg.buffer, 'binary', function(err) {});
        }
        card.imageUrl = cimg;
    }

    // mixer channel
    const mixerRx = /(https:\/\/)?(mixer.com\/\w+)/.exec(playlist.snippet.description);
    if (!!mixerRx) {
        // reverse videos to show latest first
        cards.reverse();
        cards.unshift({
            "name": "Live Coding",
            "description": "Subscribe to our mixer.com live coding stream.",
            "url": `https://${mixerRx[2]}`,
            "imageUrl": `${assets}/live.png`
        })
    }
    // trailing card
    cards.push({
        "name": "PlayList",
        "description": "See entire playlist on YouTube",
        "url": playlistUrl,
        "imageUrl": `${assets}/playlist.png`
    });
    const md = 
`# ${playlist.snippet.title}

${playlist.snippet.description || ""}

## Videos

\`\`\`codecard
${JSON.stringify(cards, null, 4)}
\`\`\`

## See Also

[YouTube Playlist](${playlistUrl})

`

    nodeutil.writeFileSync(path.join('docs', fn + ".md"), md, { encoding: "utf8" });
}

export function renderPlaylistsAsync(playlists: pxt.Map<string>): Promise<void> {
    return Promise.all(Object.keys(playlists).map(fn => renderPlaylistAsync(fn, playlists[fn])))
        .then(() => { pxt.log('playlists refreshed')});
}