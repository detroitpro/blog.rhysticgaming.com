module.exports = {
  layout: "post.njk",
  tags: ["posts"],
  permalink: "/posts/{{ title | slug }}/index.html",
  eleventyComputed: {
    permalink: function(data) {
      // If draft is true, don't generate a permalink (file won't be written)
      if (data.draft === true) {
        return false;
      }
      return "/posts/{{ title | slug }}/index.html";
    }
  }
};

