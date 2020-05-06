
import * as nodeutil from './nodeutil';
import * as path from 'path';
import * as fs from 'fs';

export const GOOGLE_API_KEY = "GOOGLE_API_KEY";

function checkApiKey() {
    if (!pxt.youtube.apiKey) {
        const k = process.env[GOOGLE_API_KEY];
        if (!k) {
            throw new Error(`Missing ${GOOGLE_API_KEY} to access YouTube Apis. Use https://console.developers.google.com/ to generate a new API key.`)
        }
        pxt.youtube.apiKey = k;
    }
}

async function renderPlaylistAsync(fn: string, id: string): Promise<void> {
    fn = fn.replace(/\.md$/i, '');
    const assets = `/static/${fn}`
    nodeutil.mkdirP("docs" + assets)
    const playlist = await pxt.youtube.playlistInfoAsync(id);
    const videos = await pxt.youtube.listPlaylistVideosAsync(id);
    const playlistUrl = pxt.youtube.watchUrl(undefined, playlist.id);
    let cards: pxt.CodeCard[] = videos.map(pxt.youtube.playlistItemToCodeCard);
    // remove delete movies
    cards = cards.filter(card => !!card.imageUrl);
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
            fs.writeFileSync(limg, rimg.buffer, 'binary');
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
        "youTubePlaylistId": id,
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
    checkApiKey();
    return Promise.all(Object.keys(playlists).map(fn => renderPlaylistAsync(fn, playlists[fn])))
        .then(() => { pxt.log('playlists refreshed') });
}