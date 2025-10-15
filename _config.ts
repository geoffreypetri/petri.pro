import lume from "lume/mod.ts";
import plugins from "./plugins.ts";

const markdown = {
  options: {
    breaks: false,
    xhtmlOut: true,
    linkify: true
  },
};

const site = lume({
  src: "./src",
}, { markdown });

site
  .use(plugins())
  .data("layout", "layouts/base.vto")

export default site;
