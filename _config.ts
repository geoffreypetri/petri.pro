import lume from "lume/mod.ts";

const site = lume({
  src: "./src",
  server: {
    open: false,
  },
});

site.add("_includes/styles.css");

export default site;
