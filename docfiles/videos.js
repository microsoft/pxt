$(document).ready(function () {
    renderSnippets();

    //This is an adapted version of the original template code in Semantic UI
    $.fn.embed.settings.templates.placeholder = function(image, icon) {
      var html = '';
      if(icon) {
        html += '<i class="' + icon + ' icon"></i>';
      }
      if(image) {
        //Remove the timestamp from the YouTube source URL
        image = image.replace(/\#t=([0-9]+m)?([0-9]+s)?/, "");
        html += '<img class="placeholder" src="' + image + '">';
      }
      return html;
    };
    //Again, this is a slightly modified version of the original Semantic UI source to support timestamped YouTube videos
    $.fn.embed.settings.templates.iframe = function(url, parameters) {
      var src = url;
      //The following if statement is all that is different from the original implementation
      var matches = src.match(/\#t=(([0-9]+)m)?(([0-9]+)s)?/);
      if (matches) {
          var minutes = matches[2] != undefined ? parseInt(matches[2]) : 0;
          var seconds = matches[4] != undefined ? parseInt(matches[4]) : 0;
          var param = "start=" + (minutes * 60 + seconds).toString();
          if (parameters) {
              parameters = param + "&" + parameters;
          }
          else {
              parameters = param;
          }
          src = src.replace(/\#t=([0-9]+m)?([0-9]+s)?/, "");
      }
      if (parameters) {
          src += '?' + parameters;
      }
      return ''
        + '<iframe src="' + src + '"'
        + ' width="100%" height="100%"'
        + ' frameborder="0" scrolling="no" webkitAllowFullScreen mozallowfullscreen allowFullScreen></iframe>'
      ;
    };

    $('.ui.embed').embed();
    
    $('.md-video-link').on("click", function () {
        var name = $(this).data("playerurl") || $(this).data("videosrc");
        $(this).find("img").remove();
        $(this).find("svg").remove();
        var outer = $('<div />', {
            "class": 'embed-responsive embed-responsive-16by9'
        });
        outer.appendTo($(this));
        $('<iframe>', {
            class: 'embed-responsive-item',
            src: name,
            frameborder: 0,
            scrolling: 'no'
        }).appendTo(outer);
    });
});