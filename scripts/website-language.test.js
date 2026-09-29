import { runInNewContext } from "node:vm";
import { expect, test } from "bun:test";

test("website defaults to English and switches both localized content and document language", async () => {
  const page = Bun.file("docs/index.html");
  const exists = await page.exists();
  expect(exists).toBe(true);
  if (!exists) return;

  const html = await page.text();
  expect(html).toContain('<html lang="en">');
  expect(html).toContain('data-language-content="en"');
  expect(html).toMatch(/data-language-content="zh-Hant"[^>]*\shidden/);

  const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  expect(script).toBeTruthy();
  if (!script) return;

  const content = [
    { dataset: { languageContent: "en" }, hidden: false },
    { dataset: { languageContent: "zh-Hant" }, hidden: true }
  ];
  const buttons = ["en", "zh-Hant"].map((language) => ({
    dataset: { languageToggle: language },
    attributes: {},
    addEventListener(event, handler) {
      this[event] = handler;
    },
    setAttribute(name, value) {
      this.attributes[name] = value;
    }
  }));
  const document = {
    documentElement: { lang: "en" },
    querySelectorAll(selector) {
      if (selector === "[data-language-toggle]") return buttons;
      if (selector === "[data-language-content]") return content;
      return [];
    }
  };

  runInNewContext(script, { document });
  buttons[1].click();
  expect(document.documentElement.lang).toBe("zh-Hant");
  expect(content.map((item) => item.hidden)).toEqual([true, false]);
  expect(buttons.map((button) => button.attributes["aria-pressed"])).toEqual(["false", "true"]);

  buttons[0].click();
  expect(document.documentElement.lang).toBe("en");
  expect(content.map((item) => item.hidden)).toEqual([false, true]);
});
