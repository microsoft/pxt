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