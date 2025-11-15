import { useEffect, useRef, useState } from "react";
import DOMPurify from "dompurify";
import { useTheme } from "next-themes";

interface EmailViewerProps {
  htmlContent?: string | null;
  textContent?: string | null;
  className?: string;
}

const EmailViewer = ({ htmlContent, textContent, className = "" }: EmailViewerProps) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!iframeRef.current) return;

    const iframe = iframeRef.current;
    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!iframeDoc) return;

    setLoading(true);

    // Sanitize and process HTML
    let processedHtml = htmlContent || "";

    if (processedHtml) {
      // Fix encoding issues - replace common problematic characters
      processedHtml = processedHtml
        .replace(/Â/g, " ")
        .replace(/â€™/g, "'")
        .replace(/â€œ/g, '"')
        .replace(/â€/g, '"')
        .replace(/â€"/g, "—")
        .replace(/â€"/g, "–")
        .replace(/Ã©/g, "é")
        .replace(/Ã¨/g, "è")
        .replace(/Ã /g, "à");

      // Configure DOMPurify with strict security settings to prevent XSS
      const cleanHtml = DOMPurify.sanitize(processedHtml, {
        ALLOWED_TAGS: [
          "div", "span", "p", "br", "strong", "b", "em", "i", "u", "a", "img", 
          "table", "thead", "tbody", "tr", "th", "td", "h1", "h2", "h3", "h4", 
          "h5", "h6", "ul", "ol", "li", "blockquote", "pre", "code", "hr"
        ],
        ALLOWED_ATTR: [
          "href", "src", "alt", "title", "width", "height", 
          "class", "id", "align", "valign", "colspan", "rowspan"
        ],
        // Explicitly forbid dangerous attributes that can execute scripts
        FORBID_ATTR: ["style", "onerror", "onload", "onclick", "onmouseover", "bgcolor", "color", "border"],
        // Explicitly forbid dangerous tags
        FORBID_TAGS: ["script", "iframe", "object", "embed", "form", "input", "button"],
        // Restrict URLs to safe protocols only (https, http, mailto)
        ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
      });

      // Determine theme colors
      const isDark = theme === "dark";
      const bgColor = isDark ? "#09090b" : "#ffffff";
      const textColor = isDark ? "#fafafa" : "#09090b";
      const linkColor = isDark ? "#60a5fa" : "#2563eb";

      // Build complete HTML document with CSS isolation and responsive styles
      const iframeContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              * {
                box-sizing: border-box;
              }
              
              html, body {
                margin: 0;
                padding: 0;
                width: 100%;
                height: auto;
                overflow-x: hidden;
                background-color: ${bgColor};
                color: ${textColor};
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
                font-size: 14px;
                line-height: 1.6;
                word-wrap: break-word;
                overflow-wrap: break-word;
              }

              body {
                padding: 16px;
              }

              /* Reset and responsive images */
              img {
                max-width: 100% !important;
                height: auto !important;
                display: inline-block;
                border: 0;
              }

              /* Broken image fallback */
              img[src=""], img:not([src]), img[src*="cid:"] {
                display: inline-block;
                width: auto;
                max-width: 200px;
                height: auto;
                background: ${isDark ? "#27272a" : "#f4f4f5"};
                border: 1px dashed ${isDark ? "#52525b" : "#d4d4d8"};
                padding: 8px;
              }

              img[src=""]::after, img:not([src])::after, img[src*="cid:"]::after {
                content: "🖼️ Image";
                color: ${isDark ? "#a1a1aa" : "#71717a"};
                font-size: 12px;
              }

              /* Responsive tables */
              table {
                max-width: 100% !important;
                width: auto !important;
                border-collapse: collapse;
                overflow-x: auto;
                display: block;
              }

              td, th {
                padding: 8px;
                vertical-align: top;
              }

              /* Links */
              a {
                color: ${linkColor};
                text-decoration: underline;
                word-break: break-word;
              }

              a:hover {
                opacity: 0.8;
              }

              /* Text elements */
              p {
                margin: 0 0 1em 0;
              }

              pre {
                white-space: pre-wrap;
                word-wrap: break-word;
                background: ${isDark ? "#18181b" : "#f9fafb"};
                padding: 12px;
                border-radius: 4px;
                overflow-x: auto;
              }

              blockquote {
                margin: 0 0 1em 0;
                padding-left: 16px;
                border-left: 3px solid ${isDark ? "#52525b" : "#d4d4d8"};
                color: ${isDark ? "#d4d4d8" : "#52525b"};
              }

              /* Override inline styles that break dark mode */
              [style*="background-color: white"],
              [style*="background-color: #ffffff"],
              [style*="background-color: #fff"],
              [style*="background: white"],
              [style*="background: #ffffff"],
              [style*="background: #fff"] {
                background-color: ${bgColor} !important;
              }

              [style*="color: black"],
              [style*="color: #000000"],
              [style*="color: #000"] {
                color: ${textColor} !important;
              }

              /* Prevent horizontal overflow */
              body > * {
                max-width: 100%;
              }

              /* Handle long words/URLs */
              * {
                word-wrap: break-word;
                overflow-wrap: break-word;
              }
            </style>
          </head>
          <body>
            ${cleanHtml}
          </body>
        </html>
      `;

      iframeDoc.open();
      iframeDoc.write(iframeContent);
      iframeDoc.close();

      // Auto-resize iframe to content height
      const resizeIframe = () => {
        try {
          // Force a reflow to ensure content is laid out
          iframeDoc.body.offsetHeight;
          
          const body = iframeDoc.body;
          const html = iframeDoc.documentElement;
          
          // Get the actual scrollable content height
          const contentHeight = Math.max(
            body.scrollHeight,
            body.offsetHeight,
            html.clientHeight,
            html.scrollHeight,
            html.offsetHeight
          );
          
          // Ensure minimum height and add padding
          const finalHeight = Math.max(contentHeight, 100) + 32;
          
          console.log("Resizing iframe:", {
            bodyScrollHeight: body.scrollHeight,
            bodyOffsetHeight: body.offsetHeight,
            htmlScrollHeight: html.scrollHeight,
            contentHeight,
            finalHeight
          });
          
          iframe.style.height = `${finalHeight}px`;
          setLoading(false);
        } catch (e) {
          console.error("Failed to resize iframe:", e);
          iframe.style.height = "500px"; // Fallback height
          setLoading(false);
        }
      };

      // Wait for images to load before resizing
      const images = iframeDoc.querySelectorAll("img");
      let loadedImages = 0;
      const totalImages = images.length;

      if (totalImages === 0) {
        // Multiple resize attempts to ensure accurate measurement
        setTimeout(resizeIframe, 50);
        setTimeout(resizeIframe, 150);
        setTimeout(resizeIframe, 300);
      } else {
        images.forEach((img) => {
          const handleImageLoad = () => {
            loadedImages++;
            if (loadedImages === totalImages) {
              // Multiple resize attempts after images load
              setTimeout(resizeIframe, 50);
              setTimeout(resizeIframe, 150);
              setTimeout(resizeIframe, 300);
            }
          };

          if (img.complete) {
            handleImageLoad();
          } else {
            img.addEventListener("load", handleImageLoad);
            img.addEventListener("error", handleImageLoad); // Count errors too
          }
        });

        // Fallback if images take too long
        setTimeout(() => {
          if (loadedImages < totalImages) {
            resizeIframe();
          }
        }, 3000);
      }

      // Watch for content changes and resize
      const observer = new MutationObserver(() => {
        resizeIframe();
      });

      observer.observe(iframeDoc.body, {
        childList: true,
        subtree: true,
        attributes: true,
      });

      return () => observer.disconnect();
    } else {
      setLoading(false);
    }
  }, [htmlContent, theme]);

  if (!htmlContent && !textContent) {
    return (
      <div className={`text-sm text-muted-foreground ${className}`}>
        No content available.
      </div>
    );
  }

  if (!htmlContent && textContent) {
    return (
      <pre className={`whitespace-pre-wrap text-sm text-foreground font-sans break-words ${className}`}>
        {textContent}
      </pre>
    );
  }

  return (
    <div className={`relative w-full ${className}`}>
      {loading && (
        <div className="text-sm text-muted-foreground mb-4">Loading message…</div>
      )}
      <iframe
        ref={iframeRef}
        title="Email content"
        sandbox="allow-same-origin"
        className="w-full border-0 overflow-hidden"
        style={{
          minHeight: "200px",
          display: loading ? "none" : "block",
        }}
      />
    </div>
  );
};

export default EmailViewer;
