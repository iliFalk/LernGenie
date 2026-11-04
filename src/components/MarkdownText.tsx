import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * The one markdown renderer for the app.
 *
 * `remark-gfm` is what makes tables, task lists, strikethrough and bare links work: without
 * it react-markdown follows plain CommonMark and shows a table as pipes and dashes.
 * A table is wrapped in `.md-table-scroll`, so a wide table scrolls inside the tile.
 * Styling lives in `.markdown-body` (src/index.css).
 */
export function MarkdownText({ children }: { children: string }) {
  return (
    <Markdown
      remarkPlugins={[remarkGfm]}
      components={{
        table: ({ node, ...props }) => (
          <div className="md-table-scroll">
            <table {...props} />
          </div>
        ),
      }}
    >
      {children}
    </Markdown>
  );
}
