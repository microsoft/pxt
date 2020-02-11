namespace pxt.discourse {
    interface DiscoursePostResponse {
        featured_link?: string;
        post_stream?: DiscoursePostStream;
    }
    interface DiscoursePostStream {
        posts?: DiscoursePost[];
    }
    interface DiscoursePost {
        link_counts?: DiscourseLinkCount[];
    }
    interface DiscourseLinkCount {
        url?: string;
    }
    export interface Topic {
        id: string;
        title: string;
        image_url: string;
        slug: string;
        views: number;
        like_count: number;
        url: string;
    }
    export interface TagsResponse {
        users: any[];
        topic_list: {
            topics: Topic[];
        }
    }

    export function extractSharedIdFromPostUrl(url: string): Promise<string> {
        // https://docs.discourse.org/#tag/Posts%2Fpaths%2F~1posts~1%7Bid%7D.json%2Fget
        return pxt.Util.httpGetJsonAsync(url + ".json")
            .then((json: DiscoursePostResponse) => {
                // extract from post_stream
                let projectId = json.post_stream
                    && json.post_stream.posts
                    && json.post_stream.posts[0]
                    && json.post_stream.posts[0].link_counts
                        .map(link => pxt.Cloud.parseScriptId(link.url))
                        .filter(id => !!id)[0];
                return projectId;
            });
    }

    export function topicsByTag(apiUrl: string, tag: string): Promise<Topic[]> {
        apiUrl = apiUrl.replace(/\/$/, '');
        return pxt.Util.httpGetJsonAsync(`${apiUrl.replace(/\/$/, '')}/tags/${tag}.json`)
            .then((json: TagsResponse) =>
                json.topic_list.topics.map(t => {
                    t.url = `${apiUrl}/t/${t.slug}/${t.id}`;
                    return t;
                }));
    }
}