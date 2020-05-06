
namespace pxt.youtube {
    export let apiKey: string = undefined;

    function checkKey() {
        if (!apiKey)
            U.userError(`YouTube API key missing`);
    }

    export interface PlaylistResource {
        items: Playlist[];
    }

    export interface Playlist {
        id: string;
        snippet: {
            publishedAt: string;
            channelId: string;
            title: string;
            description: string;
            thumbnails?: Thumbnails;
        }
    }

    export interface Thumbnail {
        url: string;
        width: number;
        height: number;
    }

    export interface Thumbnails {
        default?: Thumbnail;
        medium?: Thumbnail;
        high?: Thumbnail;
        standard?: Thumbnail;
        maxres?: Thumbnail;
    }

    function resolveThumbnail(thumbnails: Thumbnails) {
        if (!thumbnails) return "";
        const thumbnail = (thumbnails.medium || thumbnails.high || thumbnails.standard || thumbnails.default);
        return thumbnail?.url || "";
    }

    function resolveDescription(d: string) {
        // grab first paragraph.
        return d.split(/\n\s+/, 1)[0].trim();
    }

    export function playlistItemToCodeCard(video: PlaylistItem): pxt.CodeCard {
        return <pxt.CodeCard>{
            "name": video.snippet.title.replace(/[^-]*-/, '').trim(),
            "description": resolveDescription(video.snippet.description),
            "youTubeId": video.snippet.resourceId.videoId,
            "youTubePlaylistId": video.snippet.playlistId,
            "imageUrl": resolveThumbnail(video.snippet.thumbnails)
        }
    }

    export function playlistInfoAsync(playlistId: string) {
        checkKey()
        const url = `https://www.googleapis.com/youtube/v3/playlists?part=snippet&id=${playlistId}&key=${apiKey}`;
        return pxt.Util.httpGetJsonAsync(url)
            .then((res: PlaylistResource) => res.items[0]);
    }

    export interface PlaylistItem {
        snippet: {
            playlistId: string;
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

    export interface PlaylistVideos {
        nextPageToken: string;
        prevPageToken: string;
        items: PlaylistItem[];
    }

    export async function listPlaylistVideosAsync(playlistId: string): Promise<PlaylistItem[]> {
        checkKey()
        let items: PlaylistItem[] = []
        let pageToken: string = undefined;
        do {
            let url = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=50&playlistId=${playlistId}&key=${apiKey}`;
            if (pageToken)
                url += `&pageToken=${pageToken}`;
            const videos = await pxt.Util.httpGetJsonAsync(url)
            items = items.concat(videos.items);
            pageToken = videos.nextPageToken;
        } while (pageToken);

        if (pxt.options.debug)
            pxt.debug(JSON.stringify(items, null, 2));
        return items;
    }

    export function watchUrl(videoId?: string, playlistId?: string) {
        let url: string = undefined;
        if (videoId) {
            url = `https://www.youtube.com/watch?v=${videoId}`;
            if (playlistId)
                url += `&list=${playlistId}`;
        } else if (playlistId) {
            url = `https://www.youtube.com/playlist?list=${playlistId}`;
        }
        return url;
    }
}