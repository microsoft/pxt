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
    interface DiscourseTopic {
        id: string;
        title: string;
        image_url: string;
        slug: string;
        views: number;
        like_count: number;
    }
    interface DiscourseTagsResponse {
        users: any[];
        topic_list: {
            topics: DiscourseTopic[];
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

    export function topicsByTag(apiUrl: string, tag: string): Promise<string[]> {
        apiUrl = apiUrl.replace(/\/$/, '');
        return pxt.Util.httpGetJsonAsync(`${apiUrl.replace(/\/$/, '')}/tags/${tag}.json`)
            .then((json: DiscourseTagsResponse) => json.topic_list.topics.map(t => `${apiUrl}/t/${t.slug}/${t.id}`))
    }
}