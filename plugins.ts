import title from "lume_markdown_plugins/title.ts";
import lightningcss from "lume/plugins/lightningcss.ts";
import basePath from "lume/plugins/base_path.ts";
import metas from "lume/plugins/metas.ts";
import { Options as SitemapOptions, sitemap } from "lume/plugins/sitemap.ts";
import { favicon, Options as FaviconOptions } from "lume/plugins/favicon.ts";
import { merge } from "lume/core/utils/object.ts";

import pagefind from "lume/plugins/pagefind.ts";
import multilanguage from "lume/plugins/multilanguage.ts";

import "lume/types.ts";

export interface Options {

  sitemap?: Partial<SitemapOptions>;

  /**
   * Options for the favicon plugin.
   */
  favicon?: Partial<FaviconOptions>;

  /**
   * Options for the phosphor plugin.
   */
  //icons?: IconOptions;

  /**
   * Language options for the multilanguage plugin.
   * The first language is the default language.
   */
  languages?: string[];

  /**
   * Language names for the multilanguage plugin.
   * The key is the language code and the value is the language name.
   * This is used to display the language name in the language switcher.
   */
  languageNames?: Record<string, string>;
}

export const defaults: Options = {
  favicon: {
    input: "uploads/favicon.svg",
  },
};

/** Configure the site */
export default function (userOptions?: Options) {
  const options = merge(defaults, userOptions);

  return (site: Lume.Site) => {
    site
      .use(title())
      .use(lightningcss())
      .use(basePath())
      .use(metas())
      .use(pagefind())
      .use(sitemap(options.sitemap))
      .use(favicon(options.favicon))
      .add("uploads")
      .add("nice.css")
      .add("simple.css")
      .add("monospace.css");

    // Multilanguage site
    if (options.languages?.length) {
      site.use(multilanguage({
        languages: options.languages,
        defaultLanguage: options.languages[0],
      }));

      const names = new Map<string, string>();
      options.languages.forEach((lang) => {
        if (options.languageNames?.[lang]) {
          names.set(lang, options.languageNames[lang]);
        } else {
          const dn = new Intl.DisplayNames(lang, { type: "language" });
          names.set(lang, dn.of(lang) || lang);
        }
      });
      site.filter("langName", (lang: string) => names.get(lang) || lang);
    }
  };
}
