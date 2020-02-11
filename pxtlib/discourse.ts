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
    interface TagTopic {
        id: string;
        title: string;
        image_url: string;
        slug: string;
        views: number;
        like_count: number;
        posters: {
            user_id: string;
        }[];
    }
    interface TagUser {
        id: number;
        username: string;
        name: string;
        avatar_template: string;
    }
    interface TagsResponse {
        users: TagUser[];
        topic_list: {
            topics: TagTopic[];
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

    export function topicsByTag(apiUrl: string, tag: string): Promise<pxt.CodeCard[]> {
        apiUrl = apiUrl.replace(/\/$/, '');
        const q = `${apiUrl}/tags/${tag}.json`;
        return pxt.Util.httpGetJsonAsync(q)
            .then((json: TagsResponse) => {
                const users = pxt.Util.toDictionary(json.users, u => u.id.toString());
                return json.topic_list.topics.map(t => {
                    return <pxt.CodeCard>{
                        id: t.id,
                        title: t.title,
                        url: `${apiUrl}/t/${t.slug}/${t.id}`,
                        imageUrl: t.image_url,
                        author: users[t.posters[0].user_id].name,
                        cardType: "forumUrl"
                    }
                });
            });
    }
}