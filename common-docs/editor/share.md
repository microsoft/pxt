# Sharing your project

Once you've made your project, you can save it the cloud, share it, or embed it on another website.

* Click **More...**, then **Embed Project**:
* Click **Publish project**. This will make the project publicly available
* You will then see this information:

## Sharing the URL

You can share the URL for the project with other people, and they will be able to visit that page to see your project, download it, or edit it. 

### ~hint

**Developers:** This page supports [OEmbed](https://oembed.com/).

### ~

## Embedding into a blog or web site

Rather than just sharing the link, you can also embed the project so that your visitors can use the simulator, edit blocks or code, or download the project without having to leave your site.

### General instructions

Select the kind of embedding you would like.

* **Screenshot** - a lightweight screenshot of the blocks that links to the snippet
* **Editor** - embedded editor with minimal UI
* **Simulator** - embedded simulator only
* **Command line** - specific instructions to unpack the project using the [command line](/cli) tools

Copy the HTML for embedding the page from the publish dialog. It will look like the following:

Open the HTML editor for your blog or website and paste it with your content

### Wordpress

[wordpress.com][] blogs do not support embedding content from most websites, so you will need to link to your project instead. Alternatively, if you have a Wordpress VIP account you can follow [these instructions][wordpress-vip] to embed an `iframe` into your blog. The URL that you need to add is like `@homeurl@/#pub:PROJECTID`, but replace `PROJECTID` with your project's unique identifier.

If you self host a Wordpress blog you can install the [iframe-plugin][] and then write the following in your blog-post (again, replacing the `PROJECTID` with your project's identifier):

```
[iframe src="@homeurl@/#pub:PROJECTID"]
```

### Blogger

* Create a new post
* Click the 'HTML' button next to 'Compose' and paste in the HTML

### Squarespace

[Squarespace][] allows you to embed HTML code inside a blog post or page. In the editor, click to add a new block.

Scroll to **More** and select **Code**. Paste the embed HTML and click **Apply**.

### Google Sites

Google Sites doesn't currently [support iframes in custom HTML][google-sites-iframes], so you'll have to insert a link to your project's URL instead.

### Office Sway

[Microsoft Office Sway][sway] only allows iframes from [certain websites][sway-restricted], so you'll need to insert a link to your project instead.
### Embedding in Markdown documents

[Markdown][] is a popular text format supported by many blog editors. As Markdown supports embedded HTML, you should be able to paste the HTML into the document, although some sites may prevent you from doing this.

[wordpress.com]: https://wordpress.com
[wordpress-vip]: https://vip.wordpress.com/documentation/embedding-rich-media-from-around-the-web-with-protected-embeds/#scripts-iframes-and-objects
[iframe-plugin]: https://wordpress.org/plugins/iframe/
[squarespace]: https://squarespace.com
[google-sites-iframes]: https://support.google.com/sites/answer/2500646?hl=en
[sway]: https://sway.com/my
[sway-restricted]: https://support.office.com/en-us/article/Embed-content-in-your-Sway-1e1ab12a-f961-4a26-8afc-77a15f892b1d
[Markdown]: https://daringfireball.net/projects/markdown/